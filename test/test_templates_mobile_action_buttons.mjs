import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4804;
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

  const cdpPort = 9233;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-templates-action-qa-'));
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

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async function setViewport(width, height) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768
    });
    await sendCommand('Emulation.setVisibleSize', { width, height });
  }

  async function captureScreenshot(filepath) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('DOM.enable');

    console.log('\n--- SUITE 1: Mobile Excel Templates Button Verification (395px) ---');
    await setViewport(395, 844);
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    // Switch to Templates tab
    await evaluate(`
      (function() {
        if (typeof window.switchTab === 'function') {
          window.switchTab('templates');
        } else {
          document.querySelector('[data-bottom-tab="templates"], [data-tab="templates"]')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const excelCardCheck = await evaluate(`
      (function() {
        const panel = document.getElementById('panel-templates-excel');
        const card = panel?.querySelector('.template-card-item');
        if (!card) return null;

        // Mobile button container
        const mobRow = Array.from(card.querySelectorAll('div')).find(d => d.classList.contains('sm:hidden') && d.classList.contains('flex'));
        const buttons = mobRow ? Array.from(mobRow.querySelectorAll('a, button')) : [];

        const btn1 = buttons[0]; // Primary
        const btn2 = buttons[1]; // Secondary

        const btn1Text = btn1 ? btn1.textContent.trim() : '';
        const btn1IsGreen = btn1 && btn1.classList.contains('bg-emerald-700');
        const btn1Href = btn1 ? btn1.getAttribute('href') : '';
        const btn1HasDownload = btn1 ? btn1.hasAttribute('download') : false;

        const btn2Text = btn2 ? btn2.textContent.trim() : '';
        const btn2IsOutlined = btn2 && btn2.classList.contains('border-emerald-300');
        const btn2HasTrack = btn2 && (btn2.hasAttribute('data-track-template') || btn2.classList.contains('btn-track-template'));

        // Check description is hidden on mobile for compact layout
        const descEl = card.querySelector('p');
        const descHiddenOnMobile = descEl && descEl.classList.contains('hidden') && descEl.classList.contains('sm:block');

        return {
          cardExists: true,
          mobRowExists: !!mobRow,
          buttonCount: buttons.length,
          btn1Text,
          btn1IsGreen,
          btn1Href,
          btn1HasDownload,
          btn2Text,
          btn2IsOutlined,
          btn2HasTrack,
          descHiddenOnMobile
        };
      })()
    `);

    check('Excel template card exists in DOM', excelCardCheck?.cardExists);
    check('Req 2: Primary button label is "Download" and green on Excel', excelCardCheck?.btn1Text === 'Download' && excelCardCheck?.btn1IsGreen);
    check('Req 5: Download button downloads the correct .xlsx file', excelCardCheck?.btn1Href.endsWith('.xlsx') && excelCardCheck?.btn1HasDownload);
    check('Req 1 & 3: Secondary button label is "Track Now" and outlined on Excel', excelCardCheck?.btn2Text === 'Track Now' && excelCardCheck?.btn2IsOutlined);
    check('Req 5: Track Now opens browser-based template experience', excelCardCheck?.btn2HasTrack);
    check('Req 7 & 8: Compact mobile layout hides bulky description on mobile', excelCardCheck?.descHiddenOnMobile);

    console.log('\n--- SUITE 2: Mobile Google Sheets Button Verification (395px) ---');
    // Switch to Google Sheets format tab
    await evaluate(`
      (function() {
        const btnSheets = document.getElementById('btn-format-sheets');
        if (btnSheets) btnSheets.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const sheetsCardCheck = await evaluate(`
      (function() {
        const panel = document.getElementById('panel-templates-sheets');
        const isVisible = panel && !panel.classList.contains('hidden');
        const card = panel?.querySelector('.template-card-item');
        if (!card) return null;

        const mobRow = Array.from(card.querySelectorAll('div')).find(d => d.classList.contains('sm:hidden') && d.classList.contains('flex'));
        const buttons = mobRow ? Array.from(mobRow.querySelectorAll('a, button')) : [];

        const btn1 = buttons[0]; // Primary
        const btn2 = buttons[1]; // Secondary

        const btn1Text = btn1 ? btn1.textContent.trim() : '';
        const btn1IsGreen = btn1 && btn1.classList.contains('bg-emerald-700');
        const btn1Href = btn1 ? btn1.getAttribute('href') : '';
        const btn1OpensNewTab = btn1 ? btn1.getAttribute('target') === '_blank' : false;

        const btn2Text = btn2 ? btn2.textContent.trim() : '';
        const btn2IsOutlined = btn2 && btn2.classList.contains('border-emerald-300');
        const btn2HasTrack = btn2 && (btn2.hasAttribute('data-track-template') || btn2.classList.contains('btn-track-template'));

        return {
          panelVisible: isVisible,
          cardExists: true,
          mobRowExists: !!mobRow,
          buttonCount: buttons.length,
          btn1Text,
          btn1IsGreen,
          btn1Href,
          btn1OpensNewTab,
          btn2Text,
          btn2IsOutlined,
          btn2HasTrack
        };
      })()
    `);

    check('Google Sheets panel is active and visible', sheetsCardCheck?.panelVisible);
    check('Req 2 & 4: Primary button label is "Download" and green on Google Sheets', sheetsCardCheck?.btn1Text === 'Download' && sheetsCardCheck?.btn1IsGreen);
    check('Req 5: Primary button preserves Google Sheets Make a Copy link', sheetsCardCheck?.btn1Href.includes('docs.google.com/spreadsheets') && sheetsCardCheck?.btn1OpensNewTab);
    check('Req 1, 3 & 4: Secondary button label is "Track Now" and outlined on Google Sheets', sheetsCardCheck?.btn2Text === 'Track Now' && sheetsCardCheck?.btn2IsOutlined);
    check('Req 5: Track Now opens browser-based template experience on Sheets', sheetsCardCheck?.btn2HasTrack);

    console.log('\n--- SUITE 3: Responsiveness & Screenshots (360px, 395px, 430px) ---');
    // Test 360px
    await setViewport(360, 780);
    await new Promise((r) => setTimeout(r, 300));
    const overflow360 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const panel = document.getElementById('panel-templates-sheets');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          panelNoOverflow: panel ? panel.scrollWidth <= panel.clientWidth : true
        };
      })()
    `);
    check('360px: Zero horizontal page overflow', overflow360.docNoOverflow);
    check('360px: Zero templates panel overflow', overflow360.panelNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'templates_buttons_360px.png'));
    console.log('  📸 Screenshot saved: templates_buttons_360px.png');

    // Test 395px
    await setViewport(395, 844);
    await new Promise((r) => setTimeout(r, 300));
    const overflow395 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const panel = document.getElementById('panel-templates-sheets');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          panelNoOverflow: panel ? panel.scrollWidth <= panel.clientWidth : true
        };
      })()
    `);
    check('395px: Zero horizontal page overflow', overflow395.docNoOverflow);
    check('395px: Zero templates panel overflow', overflow395.panelNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'templates_buttons_395px.png'));
    console.log('  📸 Screenshot saved: templates_buttons_395px.png');

    // Test 430px
    await setViewport(430, 932);
    await new Promise((r) => setTimeout(r, 300));
    const overflow430 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const panel = document.getElementById('panel-templates-sheets');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          panelNoOverflow: panel ? panel.scrollWidth <= panel.clientWidth : true
        };
      })()
    `);
    check('430px: Zero horizontal page overflow', overflow430.docNoOverflow);
    check('430px: Zero templates panel overflow', overflow430.panelNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'templates_buttons_430px.png'));
    console.log('  📸 Screenshot saved: templates_buttons_430px.png');

    console.log('\n--- SUITE 4: Desktop & Tablet Invariance ---');
    // Switch to Tablet 768px
    await setViewport(768, 1024);
    await new Promise((r) => setTimeout(r, 400));
    const tabletCheck = await evaluate(`
      (function() {
        const card = document.querySelector('#panel-templates-sheets .template-card-item');
        const mobRow = Array.from(card?.querySelectorAll('div') || []).find(d => d.classList.contains('sm:hidden') && d.classList.contains('flex'));
        const dskRow = Array.from(card?.querySelectorAll('div') || []).find(d => d.classList.contains('hidden') && d.classList.contains('sm:block'));

        const mobRowHidden = mobRow ? window.getComputedStyle(mobRow).display === 'none' : true;
        const dskRowVisible = dskRow ? window.getComputedStyle(dskRow).display !== 'none' : false;

        return {
          mobRowHidden,
          dskRowVisible
        };
      })()
    `);
    check('Tablet 768px: Mobile action button row is hidden', tabletCheck.mobRowHidden);
    check('Tablet 768px: Desktop action button block is visible', tabletCheck.dskRowVisible);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'templates_buttons_tablet_768px.png'));
    console.log('  📸 Screenshot saved: templates_buttons_tablet_768px.png');

    // Switch to Desktop 1280px
    await setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 400));
    const desktopCheck = await evaluate(`
      (function() {
        // Switch back to Excel on desktop to verify original desktop buttons
        document.getElementById('btn-format-excel')?.click();
        const card = document.querySelector('#panel-templates-excel .template-card-item');
        const dskRow = Array.from(card?.querySelectorAll('div') || []).find(d => d.classList.contains('hidden') && d.classList.contains('sm:block'));
        const dskBtn = dskRow?.querySelector('a.w-full');
        const dskBtnText = dskBtn ? dskBtn.textContent.trim() : '';

        return {
          dskRowVisible: dskRow && window.getComputedStyle(dskRow).display !== 'none',
          dskBtnPreserved: dskBtnText.includes('Download')
        };
      })()
    `);
    check('Desktop 1280px: Desktop action block is visible', desktopCheck.dskRowVisible);
    check('Desktop 1280px: Desktop download button text is preserved', desktopCheck.dskBtnPreserved);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'templates_buttons_desktop_1280px.png'));
    console.log('  📸 Screenshot saved: templates_buttons_desktop_1280px.png');

    console.log('\n=============================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Total checks: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('Failed checks:', testResults.filter((r) => !r.pass));
      process.exit(1);
    } else {
      console.log('All Templates Button & Mobile Action tests PASSED perfectly!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    try {
      ws.close();
      edgeProcess.kill();
      server.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) { }
  }
}

runTest();

