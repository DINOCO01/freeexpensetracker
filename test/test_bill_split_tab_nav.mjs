import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4329;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/`;
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
      console.log(`[QA] Server listening on http://localhost:${PORT}`);
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

async function launchEdge() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tab-nav-qa-'));
  console.log(`[QA] Launching Edge at ${EDGE_PATH}`);

  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9223',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let attempt = 0; attempt < 30; attempt++) {
    await delay(300);
    try {
      const resp = await fetch('http://localhost:9223/json/list');
      const list = await resp.json();
      if (list && list.length > 0) {
        const page = list.find((p) => p.type === 'page') || list[0];
        console.log(`[QA] Found browser page: ${page.id}`);
        return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
  }
  throw new Error('Could not connect to Edge DevTools');
}

async function runQA() {
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
  const wsUrl = await launchEdge();
  const WebSocketModule = await import('ws');
  const WebSocket = WebSocketModule.default || WebSocketModule;

  ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));
  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    if (parsed.method === 'Runtime.consoleAPICalled' && parsed.params.type === 'error') {
      const args = parsed.params.args.map((a) => a.value || a.description).join(' ');
      consoleErrors.push(args);
    }
    if (parsed.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(parsed.params.exceptionDetails?.text || 'Uncaught Exception');
    }
    if (parsed.id && callbacks.has(parsed.id)) {
      const { resolve, reject } = callbacks.get(parsed.id);
      callbacks.delete(parsed.id);
      if (parsed.error) reject(parsed.error);
      else resolve(parsed.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('DOM.enable');

  console.log(`[QA] Navigating to homepage ${TARGET_URL}...`);
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await delay(1500);

  // -------------------------------------------------------------------------
  // 1. Navigation items inspection
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Verification of Homepage Navigation Tabs ---');
  const navTabs = await evalInBrowser(`
    Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Tabs"] [class*="sm:grid"] > *')).map(el => ({
      tagName: el.tagName,
      text: el.textContent.trim().replace(/\\s+/g, ' '),
      href: el.getAttribute('href'),
      dataTab: el.getAttribute('data-tab')
    }))
  `);
  console.log('[DEBUG] Nav tabs:', JSON.stringify(navTabs, null, 2));

  assert('Primary nav has 5 desktop tab slots + 1 mobile knowledge slot', navTabs.length >= 5, `Found ${navTabs.length}`);

  // Tab 1: Live Tracker
  assert('Tab 1 is Live Tracker', navTabs[0]?.text.includes('1. Live Tracker') || navTabs[0]?.dataTab === 'tracker', navTabs[0]?.text);

  // Tab 2: Free Templates
  assert('Tab 2 is Free Templates', navTabs[1]?.text.includes('2. Free Templates') || navTabs[1]?.dataTab === 'templates', navTabs[1]?.text);

  // Tab 3: Bill Split
  assert('Statement tab is removed from position 3', !navTabs[2]?.text.includes('Statement Importer'), navTabs[2]?.text);
  assert('Tab 3 is labeled "3. Bill Split"', navTabs[2]?.text.includes('3. Bill Split'), navTabs[2]?.text);
  assert('Tab 3 is an <a> tag linking to /bill-splitter/', navTabs[2]?.tagName === 'A' && navTabs[2]?.href === '/bill-splitter/', `${navTabs[2]?.tagName} -> ${navTabs[2]?.href}`);

  // Tab 4: Debt Planner
  assert('Tab 4 is Debt Planner', navTabs[3]?.text.includes('4. Debt Planner') || navTabs[3]?.dataTab === 'debt', navTabs[3]?.text);

  // Tab 5: Budget & Goals
  assert('Tab 5 is Budget & Goals', navTabs[4]?.text.includes('5. Budget & Goals') || navTabs[4]?.dataTab === 'targets', navTabs[4]?.text);

  // -------------------------------------------------------------------------
  // 2. Click Bill Split Tab
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Clicking Bill Split Tab ---');
  await evalInBrowser(`
    const billSplitLink = document.querySelector('nav[aria-label="Main Navigation Tabs"] a[href="/bill-splitter/"]');
    billSplitLink.click();
  `);
  await delay(1500);

  const currentUrl = await evalInBrowser('window.location.pathname');
  assert('Clicking Tab 3 navigates to /bill-splitter/', currentUrl === '/bill-splitter/', currentUrl);

  const billSplitterH1 = await evalInBrowser(`document.querySelector('h1')?.textContent?.trim()`);
  assert('Bill Splitter page loaded with correct H1', billSplitterH1 === 'Free Bill Splitter Calculator', billSplitterH1);

  // Navigate back to homepage
  console.log('\n--- 3. Top-Right "Import Statement" Button Verification ---');
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await delay(1500);

  // Check top-right button exists and is untouched
  const importerNavBtn = await evalInBrowser(`
    (() => {
      const btn = document.getElementById('btn-open-file-importer-nav');
      return {
        exists: Boolean(btn),
        text: btn?.textContent?.trim().replace(/\\s+/g, ' '),
        dataTab: btn?.getAttribute('data-tab')
      };
    })()
  `);
  assert('Top-right Import Statement button exists in navbar', importerNavBtn.exists, importerNavBtn.text);
  assert('Top-right button has data-tab="import"', importerNavBtn.dataTab === 'import');

  // Click top-right Import Statement button
  await evalInBrowser(`
    document.getElementById('btn-open-file-importer-nav').click();
  `);
  await delay(500);

  const isImportTabVisible = await evalInBrowser(`
    (() => {
      const tabImport = document.getElementById('tab-view-import');
      return Boolean(tabImport && !tabImport.classList.contains('hidden'));
    })()
  `);
  assert('Clicking top-right button opens Universal Statement & Receipt Importer', isImportTabVisible);

  const importerDropzoneExists = await evalInBrowser(`Boolean(document.getElementById('tab-importer-dropzone'))`);
  assert('Statement & Receipt dropzone is present in DOM', importerDropzoneExists);

  // -------------------------------------------------------------------------
  // 4. Test other homepage navigation tabs
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Remaining Homepage Navigation Tabs ---');
  // Switch to Templates
  await evalInBrowser(`document.querySelector('.tab-btn[data-tab="templates"]').click();`);
  await delay(300);
  const isTemplatesVisible = await evalInBrowser(`!document.getElementById('tab-view-templates')?.classList.contains('hidden')`);
  assert('Templates tab switches correctly', isTemplatesVisible);

  // Switch to Debt Planner
  await evalInBrowser(`document.querySelector('.tab-btn[data-tab="debt"]').click();`);
  await delay(300);
  const isDebtVisible = await evalInBrowser(`!document.getElementById('tab-view-debt')?.classList.contains('hidden')`);
  assert('Debt tab switches correctly', isDebtVisible);

  // Switch to Budget & Goals
  await evalInBrowser(`document.querySelector('.tab-btn[data-tab="targets"]').click();`);
  await delay(300);
  const isTargetsVisible = await evalInBrowser(`!document.getElementById('tab-view-targets')?.classList.contains('hidden')`);
  assert('Budget & Goals tab switches correctly', isTargetsVisible);

  // Switch back to Tracker
  await evalInBrowser(`document.querySelector('.tab-btn[data-tab="tracker"]').click();`);
  await delay(300);
  const isTrackerVisible = await evalInBrowser(`!document.getElementById('tab-view-tracker')?.classList.contains('hidden')`);
  assert('Tracker tab switches correctly', isTrackerVisible);

  // -------------------------------------------------------------------------
  // 5. Mobile Viewport Responsiveness Verification
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Mobile Viewport Testing (375x667) ---');
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true
  });
  await delay(300);

  const mobileNavVisible = await evalInBrowser(`
    (() => {
      const tab = document.querySelector('nav[aria-label="Main Navigation Tabs"] a[href="/bill-splitter/"]');
      const rect = tab?.getBoundingClientRect();
      return {
        exists: Boolean(tab),
        width: rect?.width,
        height: rect?.height,
        displayed: rect && rect.width > 0 && rect.height > 0
      };
    })()
  `);
  assert('Bill Split tab is visible and sized properly on mobile', mobileNavVisible.displayed, `${Math.round(mobileNavVisible.width)}x${Math.round(mobileNavVisible.height)}px`);

  // Reset viewport
  await sendCommand('Emulation.clearDeviceMetricsOverride');

  // -------------------------------------------------------------------------
  // 6. Console Error Check
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Console Errors Check ---');
  assert('Zero console errors reported', consoleErrors.length === 0, consoleErrors.join(' | '));

  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (ws) ws.close();
  if (edgeProc) edgeProc.kill();
  if (server) server.close();

  process.exit(failed > 0 ? 1 : 0);
}

runQA().catch((err) => {
  console.error('QA Failed with exception:', err);
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
  process.exit(1);
});
