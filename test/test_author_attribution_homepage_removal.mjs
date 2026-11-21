import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4807;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

let testResults = [];
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ name, pass: false, details });
  }
}

async function runTest() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Static server running at http://localhost:${PORT}`);

  const cdpPort = 9236;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-author-qa-'));
  const edgeProcess = spawn(
    EDGE_PATH,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ]
  );

  await new Promise((r) => setTimeout(r, 2000));
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const data = await res.json();
      const page = data.find((p) => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (_) { }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!wsUrl) throw new Error('Could not connect to Edge DevTools');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.once('open', r));

  let reqId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('DOM.enable');

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async function captureScreenshot(filepath) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`  📸 Saved screenshot: ${filepath}`);
  }

  try {
    console.log('\n--- 1. Testing Homepage (Desktop 1280px & Mobile 395px) ---');

    // Desktop
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1200));

    // Check visible text for author line
    const desktopVisibleAuthor = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Built by Prince Upadhyay') || text.includes('Updated November 20, 2026');
      })()
    `);
    check('Homepage Desktop: Visible author line is NOT present', desktopVisibleAuthor === false);

    // Check JSON-LD Person schema is preserved
    const jsonLdPreserved = await evaluate(`
      (() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        return scripts.some(s => s.textContent.includes('Prince Upadhyay') && s.textContent.includes('Person'));
      })()
    `);
    check('Homepage Desktop: JSON-LD Person schema for Prince Upadhyay is preserved', jsonLdPreserved === true);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'homepage_desktop_no_author.png'));

    // Mobile
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 395,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1000));

    const mobileVisibleAuthor = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Built by Prince Upadhyay') || text.includes('Updated November 20, 2026');
      })()
    `);
    check('Homepage Mobile: Visible author line is NOT present', mobileVisibleAuthor === false);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'homepage_mobile_no_author.png'));

    console.log('\n--- 2. Testing Multilingual Homepages (/fr/, /es/, /de/, /hi/, etc.) ---');
    for (const lang of ['fr', 'es', 'de', 'hi', 'pt', 'ja', 'ko']) {
      await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/${lang}/` });
      await new Promise((r) => setTimeout(r, 600));

      const langVisibleAuthor = await evaluate(`
        (() => {
          const text = document.body.innerText;
          return text.includes('Prince Upadhyay');
        })()
      `);
      check(`Homepage [/${lang}/]: Visible author line is NOT present`, langVisibleAuthor === false);

      const langJsonLd = await evaluate(`
        (() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          return scripts.some(s => s.textContent.includes('Prince Upadhyay') && s.textContent.includes('Person'));
        })()
      `);
      check(`Homepage [/${lang}/]: JSON-LD Person schema is preserved`, langJsonLd === true);
    }

    console.log('\n--- 3. Testing Non-Homepage Routes (Author Attribution MUST be PRESERVED) ---');

    // A. About Us Page
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/about/` });
    await new Promise((r) => setTimeout(r, 1000));

    const aboutAuthorPreserved = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Built by Prince Upadhyay') && text.includes('November 20, 2026');
      })()
    `);
    check('About Us Page (/about/): Author attribution line IS preserved', aboutAuthorPreserved === true);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'about_page_author_preserved.png'));

    // B. Bill Splitter Page
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/bill-splitter/` });
    await new Promise((r) => setTimeout(r, 1000));

    const splitAuthorPreserved = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Built by Prince Upadhyay') && text.includes('November 20, 2026');
      })()
    `);
    check('Bill Splitter Page (/bill-splitter/): Author attribution line IS preserved', splitAuthorPreserved === true);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'split_page_author_preserved.png'));

    // C. Templates Index Page
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/templates/` });
    await new Promise((r) => setTimeout(r, 1000));

    const templatesIndexAuthorPreserved = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Built by') && text.includes('Prince Upadhyay');
      })()
    `);
    check('Templates Index Page (/templates/): Author attribution line IS preserved', templatesIndexAuthorPreserved === true);

    // D. Individual Template Guide Pages
    const sampleGuideSlugs = ['paycheck-budget', 'debt-snowball', 'emergency-fund-planner'];
    for (const slug of sampleGuideSlugs) {
      await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/templates/${slug}/` });
      await new Promise((r) => setTimeout(r, 800));

      const guideAuthorPreserved = await evaluate(`
        (() => {
          const text = document.body.innerText;
          return text.includes('Built by') && text.includes('Prince Upadhyay');
        })()
      `);
      check(`Template Guide (/templates/${slug}/): Author attribution IS preserved`, guideAuthorPreserved === true);

      const guideJsonLd = await evaluate(`
        (() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          return scripts.some(s => s.textContent.includes('Prince Upadhyay'));
        })()
      `);
      check(`Template Guide (/templates/${slug}/): Author JSON-LD metadata IS preserved`, guideJsonLd === true);
    }

    await captureScreenshot(path.join(ARTIFACT_DIR, 'template_guide_author_preserved.png'));

    console.log('\n--- Test Summary ---');
    const passed = testResults.filter((r) => r.pass).length;
    const total = testResults.length;
    console.log(`Total checks: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);

    if (total - passed === 0) {
      console.log('🎉 ALL AUTHOR ATTRIBUTION REMOVAL & PRESERVATION CHECKS PASSED 100%!');
    } else {
      process.exitCode = 1;
    }
  } finally {
    try {
      ws.close();
      edgeProcess.kill();
      server.close();
    } catch (_) { }
  }
}

runTest().catch((err) => {
  console.error('Fatal error running test:', err);
  process.exit(1);
});
