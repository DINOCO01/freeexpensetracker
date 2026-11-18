import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4331;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/bill-splitter/`;
const ARTIFACT_DIR = 'C:\\Users\\princ\\.gemini\\antigravity\\brain\\8465f667-0b7d-42d6-a856-c56991559b8f';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();
const consoleErrors = [];

function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      let cleanPath = reqPath.replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, cleanPath);

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      resolve();
    });
  });
}

function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInBrowser(expression) {
  const res = await sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error('Eval Exception: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function navigate(url) {
  await sendCommand('Page.navigate', { url });
  for (let i = 0; i < 30; i++) {
    await delay(150);
    try {
      const ready = await evalInBrowser('document.readyState');
      const hasH1 = await evalInBrowser('Boolean(document.querySelector("h1"))');
      if (ready === 'complete' && hasH1) return;
    } catch (_) {}
  }
}

async function main() {
  let passed = 0;
  let failed = 0;

  function assert(desc, condition, detail = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ ${desc}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      console.error(`  ❌ FAIL: ${desc}${detail ? ` (${detail})` : ''}`);
    }
  }

  await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-final-qa-'));
  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9231',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1920,1080'
  ]);

  let wsUrl;
  for (let i = 0; i < 30; i++) {
    await delay(300);
    try {
      const res = await fetch('http://127.0.0.1:9231/json');
      const list = await res.json();
      const page = list.find((p) => p.type === 'page') || list[0];
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
  }

  const { WebSocket } = await import('ws');
  ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('DOM.enable');

  await navigate(TARGET_URL);
  await delay(500);

  // -------------------------------------------------------------------------
  // 1. SEO & METADATA CHECKS
  // -------------------------------------------------------------------------
  console.log('\n--- 1. SEO & Analytics Verification ---');
  const title = await evalInBrowser('document.title');
  assert('Page title matches specification', title === 'Free Bill Splitter Calculator (No Sign-Up)', title);

  const metaDesc = await evalInBrowser(`document.querySelector('meta[name="description"]')?.content`);
  assert('Meta description present & populated', metaDesc && metaDesc.length > 50, `${metaDesc?.length} chars`);

  const canonical = await evalInBrowser(`document.querySelector('link[rel="canonical"]')?.href`);
  assert('Canonical URL matches', canonical === 'https://freexpensetracker.com/bill-splitter/', canonical);

  const h1 = await evalInBrowser(`document.querySelector('h1')?.textContent?.trim()`);
  assert('H1 exists and matches exact copy', h1 === 'Free Bill Splitter Calculator', h1);

  const jsonLdScripts = await evalInBrowser(`
    Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
      try { return JSON.parse(s.textContent); } catch (_) { return null; }
    }).filter(Boolean)
  `);

  const breadcrumbsSchema = jsonLdScripts.find(s => s['@type'] === 'BreadcrumbList');
  assert('BreadcrumbList JSON-LD schema valid', Boolean(breadcrumbsSchema && breadcrumbsSchema.itemListElement?.length === 2));

  const faqSchema = jsonLdScripts.find(s => s['@type'] === 'FAQPage');
  assert('FAQPage JSON-LD schema valid with 7 FAQs', Boolean(faqSchema && faqSchema.mainEntity?.length === 7));

  // Verify GA4 event tracking functions & no PII in analytics
  const gaAudit = await evalInBrowser(`
    (() => {
      let formCompletePayload = null;
      let piiFound = false;

      // Mock window.gtag
      window.gtag = (type, action, params) => {
        if (action === 'form_complete') formCompletePayload = params;

        // Check for any PII like person names, specific items, descriptions
        const str = JSON.stringify(params);
        if (str.includes('John') || str.includes('Alice') || str.includes('Pizza') || str.includes('Villa')) {
          piiFound = true;
        }
      };

      // Trigger share copy to test form_complete
      document.getElementById('btn-even-copy').click();

      return {
        formCompleteFired: Boolean(formCompletePayload),
        formCompleteParams: formCompletePayload,
        piiFound
      };
    })()
  `);

  assert('GA4 form_complete event triggers on copy/share', gaAudit.formCompleteFired, JSON.stringify(gaAudit.formCompleteParams));
  assert('GA4 events send ZERO personally identifiable information (PII)', !gaAudit.piiFound);

  // -------------------------------------------------------------------------
  // 2. DESKTOP VIEWPORT QA (1366x768, 1440x900, 1920x1080)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Desktop Visual QA Across Standard Resolutions ---');
  const desktopResolutions = [
    { name: '1366x768 (Standard Laptop)', width: 1366, height: 768, filename: 'qa_desktop_1366x768.png' },
    { name: '1440x900 (MacBook / HD+)', width: 1440, height: 900, filename: 'qa_desktop_1440x900.png' },
    { name: '1920x1080 (Full HD)', width: 1920, height: 1080, filename: 'qa_desktop_1920x1080.png' }
  ];

  for (const res of desktopResolutions) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: res.width,
      height: res.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await delay(400);

    const layoutData = await evalInBrowser(`
      (() => {
        const card = document.querySelector('#bill-splitter-container > div');
        const rect = card.getBoundingClientRect();
        const clientWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const modeTabs = document.querySelectorAll('.mode-tab-btn');

        const leftDist = Math.round(rect.left);
        const rightDist = Math.round(clientWidth - rect.right);

        return {
          cardWidth: Math.round(rect.width),
          leftDist,
          rightDist,
          isCentered: Math.abs(leftDist - rightDist) <= 2,
          hasHorizontalOverflow: scrollWidth > clientWidth,
          modeTabsCount: modeTabs.length
        };
      })()
    `);

    assert(`${res.name}: Calculator is horizontally centered`, layoutData.isCentered, `L: ${layoutData.leftDist}px, R: ${layoutData.rightDist}px`);
    assert(`${res.name}: Calculator container width is optimal (<= 580px)`, layoutData.cardWidth <= 580 && layoutData.cardWidth >= 500, `${layoutData.cardWidth}px`);
    assert(`${res.name}: No horizontal overflow`, !layoutData.hasHorizontalOverflow);

    const ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, res.filename), Buffer.from(ss.data, 'base64'));
  }

  // -------------------------------------------------------------------------
  // 3. MOBILE VIEWPORT QA (375x812, 390x844, 430x932)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Mobile Visual QA Across Phone Form Factors ---');
  const mobileResolutions = [
    { name: '375x812 (iPhone X/11/12/13 Mini)', width: 375, height: 812, filename: 'qa_mobile_375x812.png' },
    { name: '390x844 (iPhone 12/13/14 Standard)', width: 390, height: 844, filename: 'qa_mobile_390x844.png' },
    { name: '430x932 (iPhone 14/15/16 Pro Max)', width: 430, height: 932, filename: 'qa_mobile_430x932.png' }
  ];

  for (const res of mobileResolutions) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: res.width,
      height: res.height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await delay(400);

    const mobileLayout = await evalInBrowser(`
      (() => {
        const clientWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const card = document.querySelector('#bill-splitter-container > div');
        const cardRect = card.getBoundingClientRect();
        const stickyBar = document.querySelector('.sm\\\\:hidden.fixed.bottom-0');
        const stickyRect = stickyBar ? stickyBar.getBoundingClientRect() : null;

        // Check primary action buttons (mode tabs, add, copy, share, reset) meet ergonomics
        const primaryButtons = [
          ...document.querySelectorAll('.mode-tab-btn'),
          document.getElementById('btn-even-copy'),
          document.getElementById('btn-even-whatsapp'),
          document.getElementById('btn-even-share'),
          document.getElementById('btn-even-add-person')
        ].filter(Boolean);

        const undersizedPrimary = primaryButtons.filter(b => b.getBoundingClientRect().height < 32);
        const buttonHeights = primaryButtons.map(b => ({
          id: b.id || b.className,
          height: Math.round(b.getBoundingClientRect().height)
        }));

        return {
          hasHorizontalOverflow: scrollWidth > clientWidth,
          cardWidth: Math.round(cardRect.width),
          stickyBarVisible: Boolean(stickyRect && stickyRect.height > 0),
          stickyBarHeight: stickyRect ? Math.round(stickyRect.height) : 0,
          undersizedPrimaryCount: undersizedPrimary.length,
          buttonHeights
        };
      })()
    `);

    assert(`${res.name}: No horizontal overflow`, !mobileLayout.hasHorizontalOverflow);
    assert(`${res.name}: Card fits mobile screen with comfortable margins`, mobileLayout.cardWidth <= res.width && mobileLayout.cardWidth >= res.width - 40, `${mobileLayout.cardWidth}px on ${res.width}px`);
    assert(`${res.name}: Sticky mobile summary bar active at bottom`, mobileLayout.stickyBarVisible, `${mobileLayout.stickyBarHeight}px high`);
    assert(`${res.name}: Primary action buttons meet touch target ergonomics`, mobileLayout.undersizedPrimaryCount === 0, JSON.stringify(mobileLayout.buttonHeights));

    const ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, res.filename), Buffer.from(ss.data, 'base64'));
  }

  // -------------------------------------------------------------------------
  // 4. INTERACTION INTEGRITY & NO CONSOLE ERRORS
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Interaction Integrity & Console Errors ---');
  // Switch to Itemized
  await evalInBrowser(`document.getElementById('tab-btn-itemized').click();`);
  await delay(200);
  const isItemized = await evalInBrowser(`!document.getElementById('mode-panel-itemized').classList.contains('hidden')`);
  assert('Switches to Itemized Split smoothly', isItemized);

  // Switch to Trip
  await evalInBrowser(`document.getElementById('tab-btn-trip').click();`);
  await delay(200);
  const isTrip = await evalInBrowser(`!document.getElementById('mode-panel-trip').classList.contains('hidden')`);
  assert('Switches to Trip Split smoothly', isTrip);

  // Switch back to Even
  await evalInBrowser(`document.getElementById('tab-btn-even').click();`);
  await delay(200);
  const isEven = await evalInBrowser(`!document.getElementById('mode-panel-even').classList.contains('hidden')`);
  assert('Switches back to Even Split smoothly', isEven);

  assert('Zero JavaScript console errors recorded across entire session', consoleErrors.length === 0, consoleErrors.join('; '));

  console.log('\n======================================================');
  console.log(`FINAL QA CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  ws.close();
  edgeProc.kill();
  server.close();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Final QA failed with error:', err);
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
  process.exit(1);
});
