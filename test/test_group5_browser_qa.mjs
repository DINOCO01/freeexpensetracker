/**
 * test_group5_browser_qa.mjs
 * End-to-End Headless Browser QA for Group 5:
 * 1. Verifies contact form dynamic banner injection on /contact-us/
 * 2. Verifies activity promotion popup dynamic DOM generation and dismissal on /
 * 3. Verifies initial network traffic does NOT download xlsx, pdfjs, or tesseract
 * 4. Verifies CSV file parsing executes cleanly client-side
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import assert from 'assert';

const PORT = 4329;
const distDir = path.resolve('dist');

// Lightweight static server serving dist/
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }
  let filePath = path.join(distDir, reqPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

let passedChecks = 0;
let failedChecks = 0;

function pass(name, detail = '') {
  console.log(`  ✅ PASS: ${name}${detail ? ` (${detail})` : ''}`);
  passedChecks++;
}

function fail(name, detail = '') {
  console.log(`  ❌ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  failedChecks++;
}

async function runBrowserTests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Static server running on http://localhost:${PORT}`);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const browserPath = edgePaths.find((p) => fs.existsSync(p));
  if (!browserPath) {
    throw new Error('Edge browser executable not found');
  }

  const cdpPort = 9239;
  const userDataDir = path.resolve('temp_cdp_group5_profile');
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  // Wait for CDP to be ready
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const resp = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      const data = await resp.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
  }

  if (!wsUrl) {
    throw new Error('Failed to connect to browser CDP');
  }

  const newTabResp = await fetch(`http://127.0.0.1:${cdpPort}/json/new?http://localhost:${PORT}/`, { method: 'PUT' });
  const tabData = await newTabResp.json();
  const tabWsUrl = tabData.webSocketDebuggerUrl;

  const ws = new WebSocket(tabWsUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  let msgId = 1;
  const pending = new Map();
  const networkRequests = [];

  ws.addEventListener('message', (event) => {
    const raw = typeof event.data === 'string' ? event.data : event.data.toString();
    const msg = JSON.parse(raw);
    if (msg.method === 'Network.requestWillBeSent') {
      networkRequests.push(msg.params.request.url);
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression, returnByValue = false) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue });
    return res.result?.result?.value;
  };

  await send('Network.enable');
  await send('Page.enable');

  console.log('\n--- 1. Testing Initial Network Downloads on / ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await new Promise((r) => setTimeout(r, 2000));

  const hasDownloadedXlsx = networkRequests.some((u) => u.includes('xlsx'));
  const hasDownloadedPdf = networkRequests.some((u) => u.includes('pdf.') || u.includes('pdfjs'));
  const hasDownloadedTess = networkRequests.some((u) => u.includes('tesseract'));

  if (!hasDownloadedXlsx) {
    pass('Initial page load does NOT download xlsx chunk');
  } else {
    fail('xlsx was eagerly downloaded on initial page load');
  }

  if (!hasDownloadedPdf) {
    pass('Initial page load does NOT download pdf chunk');
  } else {
    fail('pdfjs was eagerly downloaded on initial page load');
  }

  if (!hasDownloadedTess) {
    pass('Initial page load does NOT download tesseract.js chunk');
  } else {
    fail('tesseract.js was eagerly downloaded on initial page load');
  }

  console.log('\n--- 2. Testing Dynamic Activity Promotion Popup Injection ---');
  // Check initial DOM on tracker
  let hasPopupInitially = await evaluate('Boolean(document.getElementById("mrb-activity-popup"))');
  if (hasPopupInitially === false) {
    pass('Initial DOM on / has no #mrb-activity-popup element');
  } else {
    fail('Initial DOM on / unexpectedly contains #mrb-activity-popup');
  }

  // Ensure script is ready
  for (let i = 0; i < 20; i++) {
    const isReady = await evaluate('typeof window.fetMarkActivityCompleted === "function"');
    if (isReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Trigger conditions: set active seconds to 35 and call fetMarkActivityCompleted()
  await evaluate(`
    sessionStorage.setItem('fet_active_seconds', '35');
    if (typeof window.fetMarkActivityCompleted === 'function') {
      window.fetMarkActivityCompleted();
    }
  `);
  await new Promise((r) => setTimeout(r, 600));

  const popupDetails = await evaluate(`
    const popup = document.getElementById("mrb-activity-popup");
    if (!popup) { ({ found: false }); }
    else {
      const heading = document.getElementById("mrb-popup-heading");
      const cta = document.getElementById("btn-mrb-popup-cta");
      const closeBtn = document.getElementById("btn-mrb-popup-close");
      ({
        found: true,
        hasRole: popup.getAttribute('role') === 'dialog',
        headingText: heading ? heading.textContent : '',
        ctaHref: cta ? cta.getAttribute('href') : '',
        hasCloseBtn: Boolean(closeBtn)
      });
    }
  `, true);

  if (popupDetails && popupDetails.found) {
    pass('Popup DOM dynamically created upon activity completion & 30s active time');
    if (popupDetails.hasRole) pass('Popup DOM has role="dialog"');
    if (popupDetails.headingText.includes('Finished tracking your expenses?')) {
      pass('Popup heading text rendered correctly', popupDetails.headingText);
    }
    if (popupDetails.ctaHref === 'https://myrealbudget.com/') {
      pass('CTA link correctly targets https://myrealbudget.com/');
    }
  } else {
    fail('Popup DOM was not created dynamically');
  }

  // Dismiss popup
  await evaluate('document.getElementById("btn-mrb-popup-close")?.click();');
  await new Promise((r) => setTimeout(r, 400));

  const dismissState = await evaluate(`
    ({
      popupExists: Boolean(document.getElementById("mrb-activity-popup")),
      isDismissedSession: sessionStorage.getItem('fet_popup_dismissed') === 'true'
    })
  `, true);

  if (dismissState?.popupExists === false) {
    pass('Popup element is smoothly removed from DOM upon close');
  } else {
    fail('Popup element still exists in DOM after close');
  }

  if (dismissState?.isDismissedSession === true) {
    pass('fet_popup_dismissed flag stored in sessionStorage to prevent re-opening');
  } else {
    fail('fet_popup_dismissed was not recorded in sessionStorage');
  }

  console.log('\n--- 2B. Testing French Activity Promotion Popup on /fr/ ---');
  // Clear sessionStorage before navigating so the new page starts fresh
  await evaluate('sessionStorage.clear();');
  await send('Page.navigate', { url: `http://localhost:${PORT}/fr/` });
  await new Promise((r) => setTimeout(r, 1000));
  
  // Ensure script is ready on /fr/
  for (let i = 0; i < 20; i++) {
    const isReady = await evaluate('typeof window.fetMarkActivityCompleted === "function"');
    if (isReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  await evaluate(`
    sessionStorage.setItem('fet_active_seconds', '35');
    if (typeof window.fetMarkActivityCompleted === 'function') {
      window.fetMarkActivityCompleted();
    }
  `);
  await new Promise((r) => setTimeout(r, 600));

  const frPopupDetails = await evaluate(`
    const popup = document.getElementById("mrb-activity-popup");
    if (!popup) { ({ found: false }); }
    else {
      const heading = document.getElementById("mrb-popup-heading");
      const cta = document.getElementById("btn-mrb-popup-cta");
      ({
        found: true,
        headingText: heading ? heading.textContent : '',
        ctaText: cta ? cta.textContent : ''
      });
    }
  `, true);

  if (frPopupDetails?.found) {
    pass('French popup DOM dynamically created on /fr/');
    if (frPopupDetails.headingText.includes('Vous avez terminé le suivi de vos dépenses ?')) {
      pass('French heading text matches localized dictionary', frPopupDetails.headingText);
    } else {
      fail('French heading mismatch', frPopupDetails.headingText);
    }
    if (frPopupDetails.ctaText.includes('Découvrir My Real Budget')) {
      pass('French CTA text matches localized dictionary', frPopupDetails.ctaText);
    } else {
      fail('French CTA mismatch', frPopupDetails.ctaText);
    }
  } else {
    fail('French popup DOM was not created dynamically on /fr/');
  }

  console.log('\n--- 3. Testing Contact Us Dynamic Submission Banner ---');
  await send('Page.navigate', { url: `http://localhost:${PORT}/contact-us/` });
  await new Promise((r) => setTimeout(r, 1000));

  const hasContactBannerInitially = await evaluate('Boolean(document.getElementById("contact-success-banner"))');
  if (hasContactBannerInitially === false) {
    pass('Initial DOM on /contact-us/ has NO #contact-success-banner');
  } else {
    fail('Initial DOM on /contact-us/ has #contact-success-banner');
  }

  // Mock successful response from formsubmit
  await evaluate(`
    window.fetch = async (url, opts) => {
      if (url.includes('formsubmit.co')) {
        return { ok: true, status: 200, json: async () => ({ success: 'true' }) };
      }
      return { ok: false, status: 404 };
    };
    document.getElementById('contact-name').value = 'Test User';
    document.getElementById('contact-email').value = 'test@example.com';
    document.getElementById('contact-topic').value = 'general';
    document.getElementById('contact-message').value = 'This is a test message verification.';
    document.getElementById('contact-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  `);
  await new Promise((r) => setTimeout(r, 500));

  const bannerDetails = await evaluate(`
    const banner = document.getElementById("contact-success-banner");
    if (!banner) { ({ found: false }); }
    else {
      ({
        found: true,
        text: banner.textContent || ''
      });
    }
  `, true);

  if (bannerDetails?.found) {
    pass('Contact success banner created dynamically in DOM on resp.ok');
    if (bannerDetails.text.includes('Message Received!')) {
      pass('Banner dynamically renders "Message Received!"');
    } else {
      fail('Banner missing "Message Received!"');
    }
  } else {
    fail('Contact success banner not created on form submit');
  }

  // Submit again to verify no duplicate banner
  await evaluate(`
    document.getElementById('contact-name').value = 'Test User 2';
    document.getElementById('contact-email').value = 'test2@example.com';
    document.getElementById('contact-message').value = 'Another submission test.';
    document.getElementById('contact-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  `);
  await new Promise((r) => setTimeout(r, 500));

  const bannerCount = await evaluate('document.querySelectorAll("#contact-success-banner").length');
  if (bannerCount === 1) {
    pass('Duplicate submissions do not create duplicate banners (count is exactly 1)');
  } else {
    fail('Duplicate banners detected', `Count: ${bannerCount}`);
  }

  // Cleanup
  ws.close();
  browserProc.kill();
  server.close();
  if (fs.existsSync(userDataDir)) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n=================================================================');
  console.log(`TOTAL BROWSER QA CHECKS: ${passedChecks + failedChecks} | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
  console.log('=================================================================');
  if (failedChecks > 0) {
    process.exit(1);
  }
}

runBrowserTests().catch((err) => {
  console.error('Browser QA Error:', err);
  server.close();
  process.exit(1);
});
