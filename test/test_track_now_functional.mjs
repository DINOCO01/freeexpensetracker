import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4809;
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

  const cdpPort = 9238;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-templates-tracknow-functional-'));
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
    // =========================================================================
    // 1. MOBILE TESTS (360px, 395px, 430px)
    // =========================================================================
    for (const width of [360, 395, 430]) {
      console.log(`\n========================================`);
      console.log(`=== Testing Mobile Viewport: ${width}px ===`);
      console.log(`========================================`);

      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });

      // Clear localStorage before each test run
      await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
      await new Promise((r) => setTimeout(r, 1200));
      await evaluate('localStorage.clear()');
      await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
      await new Promise((r) => setTimeout(r, 1200));

      // 1. Verify Home & Navigation to Templates Tab
      await evaluate(`document.querySelector('button[data-bottom-tab="templates"]')?.click()`);
      await new Promise((r) => setTimeout(r, 400));

      const isTemplatesVisible = await evaluate(`
        !document.getElementById('tab-view-templates')?.classList.contains('hidden')
      `);
      check(`[${width}px] Navigated to Templates tab`, isTemplatesVisible === true);

      // Verify Track Now buttons exist
      const trackBtnsCount = await evaluate(`document.querySelectorAll('.btn-track-template').length`);
      check(`[${width}px] Found ${trackBtnsCount} Track Now buttons`, trackBtnsCount >= 20);

      // -----------------------------------------------------------------------
      // TEST A: Savings Template Track Now -> Goals / Targets Experience
      // -----------------------------------------------------------------------
      console.log(`  [${width}px] Testing Track Now on Savings Template (52-Week Challenge)...`);
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="52-week-savings-challenge"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      // 1. No standalone page navigation
      const pathA = await evaluate('window.location.pathname');
      check(`[${width}px] URL remains root ('/') with NO page reload or standalone redirect`, pathA === '/' || pathA === '/index.html');

      // 2. Active tab is Goals / Targets
      const isGoalsTabVisible = await evaluate(`
        !document.getElementById('tab-view-targets')?.classList.contains('hidden') &&
        document.getElementById('tab-view-templates')?.classList.contains('hidden')
      `);
      check(`[${width}px] Opened functional Savings Goals tracking experience (tab-view-targets)`, isGoalsTabVisible === true);

      // 3. Bottom nav highlights Goals (index 4)
      const bottomNavGoals = await evaluate(`
        (() => {
          const btn = document.querySelector('button[data-bottom-tab="targets"]');
          const pill = document.getElementById('mobile-nav-pill');
          return {
            active: btn ? btn.classList.contains('active') : false,
            pillLeft: pill ? pill.style.left : ''
          };
        })()
      `);
      check(`[${width}px] Bottom nav highlights Goals tab`, bottomNavGoals.active === true);

      // 4. Goal record populated and created in state / localStorage
      const goalsInStorage = await evaluate(`
        (() => {
          const raw = localStorage.getItem('budget_goals_v1');
          return raw ? JSON.parse(raw) : [];
        })()
      `);
      const createdGoal = goalsInStorage.find(g => g.name.includes('52-Week'));
      check(`[${width}px] 52-Week Challenge goal created and saved in localStorage`, !!createdGoal);
      if (createdGoal) {
        check(`[${width}px] Goal target is preserved (target = 1378)`, createdGoal.target === 1378);
        check(`[${width}px] Goal monthly contribution is preserved (monthly = 115)`, createdGoal.monthly === 115);
      }

      // 5. Goal form inputs pre-populated
      const goalFormInputs = await evaluate(`
        (() => {
          const name = document.getElementById('input-goal-name')?.value;
          const target = document.getElementById('input-goal-target')?.value;
          return { name, target };
        })()
      `);
      check(`[${width}px] Goal form populated: name="${goalFormInputs.name}", target="${goalFormInputs.target}"`,
        goalFormInputs.name?.includes('52-Week') && goalFormInputs.target === '1378');

      await captureScreenshot(path.join(ARTIFACT_DIR, `track_now_savings_mobile_${width}px.png`));

      // -----------------------------------------------------------------------
      // TEST B: Debt Template Track Now -> Debt Proforma Experience
      // -----------------------------------------------------------------------
      console.log(`  [${width}px] Returning to Templates tab...`);
      await evaluate(`document.querySelector('button[data-bottom-tab="templates"]')?.click()`);
      await new Promise((r) => setTimeout(r, 400));

      console.log(`  [${width}px] Testing Track Now on Debt Template (Debt Snowball)...`);
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="debt-snowball"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      // 1. No standalone page navigation
      const pathB = await evaluate('window.location.pathname');
      check(`[${width}px] URL remains root ('/') with NO page reload`, pathB === '/' || pathB === '/index.html');

      // 2. Active tab is Debt
      const isDebtTabVisible = await evaluate(`
        !document.getElementById('tab-view-debt')?.classList.contains('hidden') &&
        document.getElementById('tab-view-templates')?.classList.contains('hidden')
      `);
      check(`[${width}px] Opened functional Debt Proforma tracking experience (tab-view-debt)`, isDebtTabVisible === true);

      // 3. Bottom nav highlights Debt (index 3)
      const bottomNavDebt = await evaluate(`
        (() => {
          const btn = document.querySelector('button[data-bottom-tab="debt"]');
          return {
            active: btn ? btn.classList.contains('active') : false
          };
        })()
      `);
      check(`[${width}px] Bottom nav highlights Debt tab`, bottomNavDebt.active === true);

      // 4. Debt strategy is Snowball
      const snowballActive = await evaluate(`
        (() => {
          const mob = document.getElementById('mobile-btn-strat-snowball');
          const desk = document.getElementById('btn-strat-snowball');
          return (mob && mob.classList.contains('active')) || (desk && desk.classList.contains('active'));
        })()
      `);
      check(`[${width}px] Debt Snowball strategy is actively selected`, snowballActive === true);

      // 5. Debt record created and saved in localStorage
      const debtsInStorage = await evaluate(`
        (() => {
          const raw = localStorage.getItem('budget_debts_v1');
          return raw ? JSON.parse(raw) : [];
        })()
      `);
      const createdDebt = debtsInStorage.find(d => d.name.toLowerCase().includes('credit') || d.name.toLowerCase().includes('snowball'));
      check(`[${width}px] Debt created and saved in localStorage`, !!createdDebt);
      if (createdDebt) {
        check(`[${width}px] Debt balance preserved (balance = 2500)`, createdDebt.balance === 2500);
        check(`[${width}px] Debt rate preserved (rate = 19.9)`, createdDebt.rate === 19.9);
      }

      await captureScreenshot(path.join(ARTIFACT_DIR, `track_now_debt_mobile_${width}px.png`));

      // -----------------------------------------------------------------------
      // TEST C: Budget Template Track Now -> Live Tracker Experience
      // -----------------------------------------------------------------------
      console.log(`  [${width}px] Returning to Templates tab...`);
      await evaluate(`document.querySelector('button[data-bottom-tab="templates"]')?.click()`);
      await new Promise((r) => setTimeout(r, 400));

      console.log(`  [${width}px] Testing Track Now on Budget Template (Paycheck Budget)...`);
      await evaluate(`
        (() => {
          const btn = document.querySelector('.btn-track-template[data-template-id="paycheck-budget"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      const isTrackerTabVisible = await evaluate(`
        !document.getElementById('tab-view-tracker')?.classList.contains('hidden') &&
        document.getElementById('tab-view-templates')?.classList.contains('hidden')
      `);
      check(`[${width}px] Opened functional Tracker experience (tab-view-tracker)`, isTrackerTabVisible === true);

      const bottomNavTracker = await evaluate(`
        (() => {
          const btn = document.querySelector('button[data-bottom-tab="tracker"]');
          return {
            active: btn ? btn.classList.contains('active') : false
          };
        })()
      `);
      check(`[${width}px] Bottom nav highlights Tracker tab`, bottomNavTracker.active === true);
    }

    // =========================================================================
    // 2. DESKTOP TEST (1280px)
    // =========================================================================
    console.log(`\n========================================`);
    console.log(`=== Testing Desktop Viewport: 1280px ===`);
    console.log(`========================================`);

    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1200));
    await evaluate('localStorage.clear()');
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1200));

    // 1. Switch to Templates via Desktop Tab
    await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-tab="templates"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const isTemplatesVisibleDesk = await evaluate(`
      !document.getElementById('tab-view-templates')?.classList.contains('hidden')
    `);
    check(`[Desktop 1280px] Templates tab is visible`, isTemplatesVisibleDesk === true);

    // Verify desktop cards have Track Now button
    const deskTrackNowBtns = await evaluate(`
      (() => {
        const cards = document.querySelectorAll('#panel-templates-excel .template-card-item');
        let countWithTrack = 0;
        cards.forEach(c => {
          const dBlock = c.querySelector('.hidden.sm\\:block') || Array.from(c.querySelectorAll('div')).find(el => el.classList.contains('hidden') && el.className.includes('sm:block'));
          if (dBlock && dBlock.querySelector('.btn-track-template')) countWithTrack++;
        });
        return countWithTrack;
      })()
    `);
    check(`[Desktop 1280px] Desktop Excel template cards contain Track Now action button`, deskTrackNowBtns >= 10);

    // Test clicking Track Now on Savings Template (Emergency Fund Planner) on desktop
    console.log(`  [Desktop] Clicking Track Now on Emergency Fund Planner...`);
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.btn-track-template[data-template-id="emergency-fund-planner"]'));
        const visibleBtn = btns.find(b => b.offsetParent !== null) || btns[0];
        if (visibleBtn) visibleBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isDeskGoalsVisible = await evaluate(`
      !document.getElementById('tab-view-targets')?.classList.contains('hidden')
    `);
    check(`[Desktop 1280px] Track Now navigates smoothly to Goals tracking tab`, isDeskGoalsVisible === true);

    const deskGoalsInStorage = await evaluate(`
      (() => {
        const raw = localStorage.getItem('budget_goals_v1');
        return raw ? JSON.parse(raw) : [];
      })()
    `);
    const createdEmergencyGoal = deskGoalsInStorage.find(g => g.name.includes('Emergency'));
    check(`[Desktop 1280px] Emergency Reserve Fund goal created and saved in localStorage`, !!createdEmergencyGoal);

    await captureScreenshot(path.join(ARTIFACT_DIR, `track_now_savings_desktop_1280px.png`));

    // Test clicking Track Now on Debt Avalanche on desktop
    console.log(`  [Desktop] Returning to Templates...`);
    await evaluate(`document.querySelector('button[data-tab="templates"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    console.log(`  [Desktop] Clicking Track Now on Debt Avalanche template...`);
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.btn-track-template[data-template-id="debt-avalanche"]'));
        const visibleBtn = btns.find(b => b.offsetParent !== null) || btns[0];
        if (visibleBtn) visibleBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isDeskDebtVisible = await evaluate(`
      !document.getElementById('tab-view-debt')?.classList.contains('hidden')
    `);
    check(`[Desktop 1280px] Track Now navigates smoothly to Debt Proforma tab`, isDeskDebtVisible === true);

    const deskDebtAvalancheSelected = await evaluate(`
      (() => {
        const btn = document.getElementById('btn-strat-avalanche');
        return btn ? btn.classList.contains('active') : false;
      })()
    `);
    check(`[Desktop 1280px] Debt Avalanche strategy is actively selected`, deskDebtAvalancheSelected === true);

    await captureScreenshot(path.join(ARTIFACT_DIR, `track_now_debt_desktop_1280px.png`));

  } finally {
    try {
      ws.close();
      edgeProcess.kill();
      server.close();
    } catch (_) { }
  }

  console.log('\n========================================');
  console.log(`SUMMARY: ${testResults.filter(r => r.pass).length} PASSED, ${testResults.filter(r => !r.pass).length} FAILED`);
  console.log('========================================\n');
  if (testResults.some(r => !r.pass)) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
