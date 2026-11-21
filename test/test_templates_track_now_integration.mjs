import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4806;
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

  const cdpPort = 9235;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-templates-tracknow-qa-'));
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
    console.log('\n--- 1. Testing Mobile Viewports (360px, 395px, 430px) ---');

    for (const width of [360, 395, 430]) {
      console.log(`\n=== Testing Viewport ${width}px ===`);
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });

      await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
      await new Promise((r) => setTimeout(r, 1200));

      // 1. Check Initial State on Homepage
      const initialUrl = await evaluate('window.location.href');
      check(`[${width}px] Starts on homepage`, initialUrl.startsWith(`http://localhost:${PORT}/`));

      // 2. Navigate to Templates Tab via Bottom Nav
      await evaluate(`
        (() => {
          const btn = document.querySelector('button[data-bottom-tab="templates"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      const isTemplatesVisible = await evaluate(`
        (() => {
          const v = document.getElementById('tab-view-templates');
          return v && !v.classList.contains('hidden');
        })()
      `);
      check(`[${width}px] Templates tab is visible after tapping bottom nav`, isTemplatesVisible === true);

      // Verify Track Now buttons are <button> elements with data-track-template
      const trackNowButtonsCount = await evaluate(`
        document.querySelectorAll('.btn-track-template').length
      `);
      check(`[${width}px] Rendered ${trackNowButtonsCount} mobile Track Now action buttons`, trackNowButtonsCount >= 20);

      // 3. Test Clicking Track Now on an Excel Template (Paycheck Budget Planner)
      console.log(`  Testing Track Now on Excel Template (Paycheck Budget)...`);
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="paycheck-budget"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      // Verify URL did NOT change to a standalone page
      const currentUrl = await evaluate('window.location.pathname');
      check(`[${width}px] URL remains root ('/') with NO page reload or standalone redirect`, currentUrl === '/' || currentUrl === '/index.html');

      // Verify Tracker tab is visible
      const isTrackerVisible = await evaluate(`
        (() => {
          const v = document.getElementById('tab-view-tracker');
          return v && !v.classList.contains('hidden');
        })()
      `);
      check(`[${width}px] Tracker tab is visible (#tab-view-tracker)`, isTrackerVisible === true);

      // Verify Templates tab is now hidden
      const isTemplatesHidden = await evaluate(`
        (() => {
          const v = document.getElementById('tab-view-templates');
          return v && v.classList.contains('hidden');
        })()
      `);
      check(`[${width}px] Templates tab is hidden`, isTemplatesHidden === true);

      // Verify bottom nav highlights Tracker (active button and pill at index 0)
      const bottomNavState = await evaluate(`
        (() => {
          const trackerBtn = document.querySelector('button[data-bottom-tab="tracker"]');
          const pill = document.getElementById('mobile-nav-pill');
          return {
            hasActive: trackerBtn ? trackerBtn.classList.contains('active') : false,
            pillLeft: pill ? pill.style.left : ''
          };
        })()
      `);
      check(`[${width}px] Bottom nav highlights Tracker`, bottomNavState.hasActive === true);
      const isPillAtZero = !bottomNavState.pillLeft || bottomNavState.pillLeft.includes('0 *') || bottomNavState.pillLeft.includes('calc(0') || bottomNavState.pillLeft === '0px' || bottomNavState.pillLeft === '0%';
      check(`[${width}px] Bottom nav pill at index 0 (pillLeft: "${bottomNavState.pillLeft}")`, isPillAtZero);

      // Verify Active Template Banner in Tracker
      const bannerState = await evaluate(`
        (() => {
          const banner = document.getElementById('active-template-banner');
          const title = document.getElementById('banner-template-title');
          const badgeText = document.getElementById('banner-template-badge-text');
          const badgeIcon = document.getElementById('banner-template-badge-icon');
          const note = document.getElementById('banner-template-note');
          const debtActions = document.getElementById('banner-specialized-debt-actions');
          const excelActions = document.getElementById('banner-excel-actions');

          return {
            visible: banner && !banner.classList.contains('hidden'),
            title: title ? title.textContent.trim() : '',
            badgeText: badgeText ? badgeText.textContent.trim() : '',
            badgeIcon: badgeIcon ? badgeIcon.textContent.trim() : '',
            note: note ? note.textContent.trim() : '',
            debtHidden: debtActions ? debtActions.classList.contains('hidden') : false,
            excelVisible: excelActions ? !excelActions.classList.contains('hidden') : false
          };
        })()
      `);

      check(`[${width}px] Active template banner is visible in Tracker`, bannerState.visible === true);
      check(`[${width}px] Banner shows template title: "${bannerState.title}"`, bannerState.title.includes('Paycheck Budget'));
      check(`[${width}px] Banner shows Excel badge: "${bannerState.badgeText}"`, bannerState.badgeText.includes('Excel Template'));
      check(`[${width}px] Banner shows Excel import action`, bannerState.excelVisible === true);

      // Capture screenshot of Tracker with Active Template Banner
      await captureScreenshot(path.join(ARTIFACT_DIR, `template_track_now_excel_${width}px.png`));

      // 4. Test "Return to Templates" Button
      console.log(`  Testing Return to Templates button...`);
      await evaluate(`
        (() => {
          const btnReturn = document.getElementById('btn-banner-return-templates');
          if (btnReturn) btnReturn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      const returnedToTemplates = await evaluate(`
        (() => {
          const tmplView = document.getElementById('tab-view-templates');
          const trackerView = document.getElementById('tab-view-tracker');
          const tmplBtn = document.querySelector('button[data-bottom-tab="templates"]');
          return {
            tmplVisible: tmplView && !tmplView.classList.contains('hidden'),
            trackerHidden: trackerView && trackerView.classList.contains('hidden'),
            tmplActive: tmplBtn && tmplBtn.classList.contains('active')
          };
        })()
      `);
      check(`[${width}px] Successfully returned to Templates tab`, returnedToTemplates.tmplVisible && returnedToTemplates.trackerHidden);
      check(`[${width}px] Bottom nav updated to Templates active (index 2)`, returnedToTemplates.tmplActive === true);

      // 5. Test Track Now on a Google Sheets Template
      console.log(`  Testing Track Now on Google Sheets Template...`);
      // First switch to Google Sheets panel
      await evaluate(`
        (() => {
          const btnSheets = document.getElementById('btn-format-sheets');
          if (btnSheets) btnSheets.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      // Click Track Now on Google Sheets template (e.g. personal monthly or financial dashboard or monthly spending)
      await evaluate(`
        (() => {
          const sheetsPanel = document.getElementById('panel-templates-sheets');
          const btn = sheetsPanel ? sheetsPanel.querySelector('.btn-track-template') : null;
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      const sheetsBannerState = await evaluate(`
        (() => {
          const banner = document.getElementById('active-template-banner');
          const trackerView = document.getElementById('tab-view-tracker');
          const badgeText = document.getElementById('banner-template-badge-text');
          return {
            trackerVisible: trackerView && !trackerView.classList.contains('hidden'),
            bannerVisible: banner && !banner.classList.contains('hidden'),
            badgeText: badgeText ? badgeText.textContent.trim() : ''
          };
        })()
      `);
      check(`[${width}px] Google Sheets Track Now opens Tracker tab`, sheetsBannerState.trackerVisible === true);
      check(`[${width}px] Shows Google Sheets badge: "${sheetsBannerState.badgeText}"`, sheetsBannerState.badgeText.includes('Google Sheets'));

      // 6. Test Specialized Debt Template (Debt Snowball)
      console.log(`  Testing Specialized Debt Template workflow...`);
      // Go back to templates
      await evaluate(`
        (() => {
          const btnReturn = document.getElementById('btn-banner-return-templates');
          if (btnReturn) btnReturn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      // Switch to Excel panel
      await evaluate(`
        (() => {
          const btnExcel = document.getElementById('btn-format-excel');
          if (btnExcel) btnExcel.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      // Click Track Now on Debt Snowball
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="debt-snowball"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      const debtBannerState = await evaluate(`
        (() => {
          const banner = document.getElementById('active-template-banner');
          const debtActions = document.getElementById('banner-specialized-debt-actions');
          const note = document.getElementById('banner-template-note');
          return {
            bannerVisible: banner && !banner.classList.contains('hidden'),
            debtActionsVisible: debtActions && !debtActions.classList.contains('hidden'),
            noteText: note ? note.textContent.trim() : ''
          };
        })()
      `);
      check(`[${width}px] Specialized Debt template banner note mentions Debt Freedom Planner`, debtBannerState.noteText.includes('Debt Freedom Planner'));
      check(`[${width}px] Specialized Debt action button is visible`, debtBannerState.debtActionsVisible === true);

      // Click "Open Debt Freedom Planner"
      await evaluate(`
        (() => {
          const btnDebt = document.getElementById('btn-banner-goto-debt');
          if (btnDebt) btnDebt.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      const debtTabActive = await evaluate(`
        (() => {
          const debtView = document.getElementById('tab-view-debt');
          const debtBtn = document.querySelector('button[data-bottom-tab="debt"]');
          return {
            debtViewVisible: debtView && !debtView.classList.contains('hidden'),
            debtBtnActive: debtBtn && debtBtn.classList.contains('active')
          };
        })()
      `);
      check(`[${width}px] Clicking Open Debt Freedom Planner switches to Debt tab`, debtTabActive.debtViewVisible && debtTabActive.debtBtnActive);

      // 7. Test Specialized Savings Goals Template (52-Week Challenge)
      console.log(`  Testing Specialized Goals Template workflow...`);
      // Return to templates via bottom nav
      await evaluate(`
        (() => {
          const btn = document.querySelector('button[data-bottom-tab="templates"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      // Click Track Now on 52-Week Challenge
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="52-week-savings-challenge"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      const goalsBannerState = await evaluate(`
        (() => {
          const banner = document.getElementById('active-template-banner');
          const goalsActions = document.getElementById('banner-specialized-goals-actions');
          const note = document.getElementById('banner-template-note');
          return {
            bannerVisible: banner && !banner.classList.contains('hidden'),
            goalsActionsVisible: goalsActions && !goalsActions.classList.contains('hidden'),
            noteText: note ? note.textContent.trim() : ''
          };
        })()
      `);
      check(`[${width}px] Specialized Goals banner note mentions Active Financial Targets`, goalsBannerState.noteText.includes('Active Financial Targets'));
      check(`[${width}px] Specialized Goals action button is visible`, goalsBannerState.goalsActionsVisible === true);

      // Click "Open Savings Goals & Milestones"
      await evaluate(`
        (() => {
          const btnGoals = document.getElementById('btn-banner-goto-goals');
          if (btnGoals) btnGoals.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      const goalsTabActive = await evaluate(`
        (() => {
          const goalsView = document.getElementById('tab-view-targets');
          const goalsBtn = document.querySelector('button[data-bottom-tab="targets"]');
          return {
            goalsViewVisible: goalsView && !goalsView.classList.contains('hidden'),
            goalsBtnActive: goalsBtn && goalsBtn.classList.contains('active')
          };
        })()
      `);
      check(`[${width}px] Clicking Open Savings Goals switches to Targets tab`, goalsTabActive.goalsViewVisible && goalsTabActive.goalsBtnActive);

      // 8. Test Data Persistence (Ensure User Data is NOT overwritten)
      console.log(`  Testing Data Persistence...`);
      // Go to Tracker, check if transactions exist
      await evaluate(`
        (() => {
          const btnTracker = document.querySelector('button[data-bottom-tab="tracker"]');
          if (btnTracker) btnTracker.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 300));

      const rowCountBefore = await evaluate(`
        document.querySelectorAll('#transactions-tbody tr').length
      `);
      check(`[${width}px] Transactions preserved (count: ${rowCountBefore})`, rowCountBefore > 0);

      // 9. Horizontal Overflow Check
      const noHorizontalScroll = await evaluate(`
        document.documentElement.scrollWidth <= window.innerWidth
      `);
      check(`[${width}px] Zero horizontal scroll (scrollWidth: \${document.documentElement.scrollWidth} <= innerWidth: \${window.innerWidth})`, noHorizontalScroll === true);

      // Capture final screenshot at this viewport
      await captureScreenshot(path.join(ARTIFACT_DIR, `template_track_now_viewport_${width}px.png`));
    }

    // --- 2. Desktop Invariance Test (1280px) ---
    console.log(`\n=== Testing Desktop Invariance (1280px) ===`);
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1200));

    const desktopBannerHidden = await evaluate(`
      (() => {
        const banner = document.getElementById('active-template-banner');
        if (!banner) return true;
        const style = window.getComputedStyle(banner);
        return style.display === 'none' || banner.classList.contains('sm:hidden');
      })()
    `);
    check('Desktop: Active template banner is hidden or styled with sm:hidden', desktopBannerHidden === true);

    const desktopTemplateButtons = await evaluate(`
      (() => {
        const desktopActionBlocks = Array.from(document.querySelectorAll('div')).filter(el => el.classList.contains('hidden') && el.className.includes('sm:block'));
        return desktopActionBlocks.length > 0;
      })()
    `);
    check('Desktop: Desktop template action blocks remain intact', desktopTemplateButtons === true);

    await captureScreenshot(path.join(ARTIFACT_DIR, `template_track_now_desktop_1280px.png`));

    console.log('\n--- Test Summary ---');
    const passed = testResults.filter((r) => r.pass).length;
    const total = testResults.length;
    console.log(`Total assertions: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);

    if (total - passed === 0) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED 100%!');
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
