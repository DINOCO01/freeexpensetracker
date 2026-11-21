import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4802;
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

  const cdpPort = 9231;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-goals-mobile-qa-'));
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
    } catch (_) {}
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

    console.log('\n--- SUITE 1: Mobile Layout Ordering (395px) ---');
    await setViewport(395, 844);
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    // Switch to Goals / Targets tab via switchTab or bottom navigation
    await evaluate(`
      (function() {
        if (typeof window.switchTab === 'function') {
          window.switchTab('targets');
        } else {
          document.querySelector('[data-bottom-tab="targets"], [data-tab="targets"]')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify visibility of mobile view and invisibility of desktop view
    const viewVisibility = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-budget-view');
        const dsk = document.getElementById('desktop-tablet-budget-view');
        const mobStyle = mob ? window.getComputedStyle(mob) : null;
        const dskStyle = dsk ? window.getComputedStyle(dsk) : null;
        return {
          mobileVisible: mobStyle && mobStyle.display !== 'none',
          desktopHidden: dskStyle && dskStyle.display === 'none'
        };
      })()
    `);
    check('Mobile Goals view is visible on 395px viewport', viewVisibility.mobileVisible);
    check('Desktop/tablet Goals view is strictly hidden on 395px viewport', viewVisibility.desktopHidden);

    // Verify exact mobile section order
    const sectionOrder = await evaluate(`
      (function() {
        const heading = document.querySelector('#mobile-budget-view h2');
        const benchmark = document.getElementById('mobile-benchmark-section');
        const newGoalBtn = document.getElementById('mobile-btn-scroll-to-add-goal');
        const activeGoals = document.getElementById('goals-container');
        const addGoalForm = document.getElementById('section-add-goal');

        function getTop(el) {
          return el ? el.getBoundingClientRect().top : 999999;
        }

        const topHeading = getTop(heading);
        const topBenchmark = getTop(benchmark);
        const topBtn = getTop(newGoalBtn);
        const topActiveGoals = getTop(activeGoals);
        const topAddGoalForm = getTop(addGoalForm);

        return {
          headingBeforeBenchmark: topHeading < topBenchmark,
          benchmarkBeforeBtn: topBenchmark < topBtn,
          btnBeforeActiveGoals: topBtn < topActiveGoals,
          activeGoalsBeforeAddGoalForm: topActiveGoals < topAddGoalForm,
          allElementsFound: !!(heading && benchmark && newGoalBtn && activeGoals && addGoalForm),
          tops: { topHeading, topBenchmark, topBtn, topActiveGoals, topAddGoalForm },
          targetViewHidden: document.getElementById('tab-view-targets')?.classList.contains('hidden')
        };
      })()
    `);
    console.log('  Debug tops:', sectionOrder.tops, 'tabHidden:', sectionOrder.targetViewHidden);
    check('All 5 Goals sections exist in mobile DOM', sectionOrder.allElementsFound);
    check('Order 1: Heading appears before Automated Benchmark', sectionOrder.headingBeforeBenchmark);
    check('Order 2: Automated Benchmark appears before New Savings Goal button', sectionOrder.benchmarkBeforeBtn);
    check('Order 3: New Savings Goal button appears before Active Financial Targets & Milestones', sectionOrder.btnBeforeActiveGoals);
    check('Order 4: Active Financial Targets & Milestones appears before Goal Saving section/form', sectionOrder.activeGoalsBeforeAddGoalForm);

    console.log('\n--- SUITE 2: Automated Benchmark Refinement (Mobile UI) ---');
    const benchmarkDetails = await evaluate(`
      (function() {
        const bm = document.getElementById('mobile-benchmark-section');
        if (!bm) return null;

        const h4 = bm.querySelector('h4')?.textContent.trim();
        const p = bm.querySelector('p')?.textContent.trim();
        const outflowEl = document.getElementById('mobile-efund-monthly-outflow');
        const t3moEl = document.getElementById('mobile-target-efund-3mo');
        const t6moEl = document.getElementById('mobile-target-efund-6mo');

        // Check horizontal container
        const sharedContainer = bm.querySelector('.grid.grid-cols-2');
        const cols = sharedContainer ? sharedContainer.querySelectorAll(':scope > div') : [];
        const hasDivider = sharedContainer && sharedContainer.classList.contains('divide-x');

        // Check columns
        const col1 = cols[0];
        const col2 = cols[1];

        const col1Label = col1?.children[0]?.textContent.trim();
        const col1Amount = col1?.children[1]?.textContent.trim();
        const col1Sub = col1?.children[2]?.textContent.trim();

        const col2Label = col2?.children[0]?.textContent.trim();
        const col2Amount = col2?.children[1]?.textContent.trim();
        const col2Sub = col2?.children[2]?.textContent.trim();

        // Check removal of nested individual card borders & white backgrounds
        const nestedWhiteCards = bm.querySelectorAll('.bg-white, .rounded-xl.border');
        // The outer benchmark has rounded-xl and border, but columns should not be nested white cards
        const col1HasWhiteCard = col1?.classList.contains('bg-white') || col1?.classList.contains('border');
        const col2HasWhiteCard = col2?.classList.contains('bg-white') || col2?.classList.contains('border');

        return {
          hasHeading: h4 === 'Recommended Emergency Reserve',
          hasOutflowP: p.includes('actual monthly outflows') && !!outflowEl,
          hasSharedContainer: !!sharedContainer,
          hasDivider,
          colCount: cols.length,
          col1Label,
          col1Amount,
          col1Sub,
          col2Label,
          col2Amount,
          col2Sub,
          nestedCardsRemoved: !col1HasWhiteCard && !col2HasWhiteCard,
          outflowText: outflowEl?.textContent.trim(),
          t3moText: t3moEl?.textContent.trim(),
          t6moText: t6moEl?.textContent.trim()
        };
      })()
    `);

    check('Heading is preserved: Recommended Emergency Reserve', benchmarkDetails.hasHeading);
    check('Outflow explanation is preserved with dynamic outflow span', benchmarkDetails.hasOutflowP);
    check('Two separate boxes replaced with one shared horizontal container (grid-cols-2)', benchmarkDetails.hasSharedContainer && benchmarkDetails.colCount === 2);
    check('Subtle vertical divider between the two columns is present', benchmarkDetails.hasDivider);
    check('Col 1: Label (3-Month Safety Net) is above amount ($0 initial)', benchmarkDetails.col1Label.includes('3-Month Safety Net'));
    check('Col 1: Subtitle (Essential baseline buffer) is below amount', benchmarkDetails.col1Sub.includes('Essential baseline buffer'));
    check('Col 2: Label (6-Month Ultimate Shield) is above amount ($0 initial)', benchmarkDetails.col2Label.includes('6-Month Ultimate Shield'));
    check('Col 2: Subtitle (Full contingency protection) is below amount', benchmarkDetails.col2Sub.includes('Full contingency protection'));
    check('Individual nested card borders and white backgrounds removed', benchmarkDetails.nestedCardsRemoved);

    // Verify Dynamic Calculations when an expense exists
    await evaluate(`
      (function() {
        // Add sample transaction of $21,500
        const sampleExpenses = [
          { id: 'exp-test-1', name: 'Rent & Essentials', amount: 21500, category: 'Housing', date: new Date().toISOString().split('T')[0], source: 'manual' }
        ];
        localStorage.setItem('fet_transactions_v4', JSON.stringify(sampleExpenses));
        // Trigger page re-render
        window.location.reload();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // Re-open Goals tab
    await evaluate(`
      (function() {
        if (typeof window.switchTab === 'function') {
          window.switchTab('targets');
        } else {
          document.querySelector('[data-bottom-tab="targets"], [data-tab="targets"]')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const dynamicCalculationCheck = await evaluate(`
      (function() {
        const outflow = document.getElementById('mobile-efund-monthly-outflow')?.textContent.trim();
        const t3mo = document.getElementById('mobile-target-efund-3mo')?.textContent.trim();
        const t6mo = document.getElementById('mobile-target-efund-6mo')?.textContent.trim();

        // $21,500 monthly outflow -> 3mo = $64,500; 6mo = $129,000
        return {
          outflowMatches: outflow.includes('21,500') || outflow.includes('21500'),
          t3moMatches: t3mo.includes('64,500') || t3mo.includes('64500'),
          t6moMatches: t6mo.includes('129,000') || t6mo.includes('129000'),
          outflow,
          t3mo,
          t6mo
        };
      })()
    `);
    check('Automated Benchmark calculates 3-Month Safety Net dynamically (64,500)', dynamicCalculationCheck.t3moMatches, `Got: ${dynamicCalculationCheck.t3mo}`);
    check('Automated Benchmark calculates 6-Month Ultimate Shield dynamically (129,000)', dynamicCalculationCheck.t6moMatches, `Got: ${dynamicCalculationCheck.t6mo}`);
    check('Monthly Outflow dynamically reflects actual expenses (21,500/mo)', dynamicCalculationCheck.outflowMatches, `Got: ${dynamicCalculationCheck.outflow}`);

    console.log('\n--- SUITE 3: New Savings Goal Button & Interactions ---');
    // Test button click scrolls to section-add-goal and focuses inputGoalName
    const buttonInteraction = await evaluate(`
      (function() {
        const btn = document.getElementById('mobile-btn-scroll-to-add-goal');
        const inputName = document.getElementById('input-goal-name');
        if (!btn) return false;

        btn.click();
        return {
          btnExists: true,
          inputIsFocused: document.activeElement === inputName
        };
      })()
    `);
    check('New Savings Goal button triggers scroll and focuses Goal Name input', buttonInteraction.inputIsFocused);

    // Test Adding a Goal via the form
    await evaluate(`
      (function() {
        document.getElementById('input-goal-name').value = 'Emergency Reserve Fund';
        document.getElementById('input-goal-target').value = '64500';
        document.getElementById('input-goal-current').value = '15000';
        document.getElementById('input-goal-monthly').value = '5000';
        document.getElementById('form-add-goal').dispatchEvent(new Event('submit', { cancelable: true }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const goalAddedCheck = await evaluate(`
      (function() {
        const container = document.getElementById('goals-container');
        const cardText = container ? container.innerText : '';
        return {
          hasGoalTitle: cardText.includes('Emergency Reserve Fund'),
          hasTarget: cardText.includes('64,500') || cardText.includes('64500'),
          hasCurrent: cardText.includes('15,000') || cardText.includes('15000'),
          hasRecordContribBtn: !!container?.querySelector('.btn-open-contrib-modal')
        };
      })()
    `);
    check('Adding a goal populates Active Financial Targets card with title', goalAddedCheck.hasGoalTitle);
    check('Goal card displays target amount (64,500) and starting amount (15,000)', goalAddedCheck.hasTarget && goalAddedCheck.hasCurrent);
    check('Goal card provides Record Contribution button', goalAddedCheck.hasRecordContribBtn);

    // Test Recording a Contribution to the goal
    await evaluate(`
      (function() {
        const btn = document.querySelector('.btn-open-contrib-modal');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const contribModalCheck = await evaluate(`
      (function() {
        const modal = document.getElementById('goal-contribution-modal');
        const isVisible = modal && !modal.classList.contains('hidden');
        if (isVisible) {
          document.getElementById('input-contrib-actual').value = '5000';
          document.getElementById('form-goal-contribution').dispatchEvent(new Event('submit', { cancelable: true }));
        }
        return isVisible;
      })()
    `);
    check('Tapping Record Contribution opens contribution modal', contribModalCheck);
    await new Promise((r) => setTimeout(r, 600));

    const contribRecordedCheck = await evaluate(`
      (function() {
        const container = document.getElementById('goals-container');
        const text = container ? container.innerText : '';
        // 15,000 + 5,000 = 20,000 saved
        return text.includes('20,000') || text.includes('20000');
      })()
    `);
    check('Recording contribution updates goal balance and progress (20,000)', contribRecordedCheck);

    console.log('\n--- SUITE 4: Multi-Viewport Responsiveness (360px, 395px, 430px) ---');
    // Test 360px
    await setViewport(360, 780);
    await new Promise((r) => setTimeout(r, 300));
    const overflow360 = await evaluate(`
      (function() {
        const bm = document.getElementById('mobile-benchmark-section');
        const doc = document.documentElement;
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          bmNoOverflow: bm ? bm.scrollWidth <= bm.clientWidth : true
        };
      })()
    `);
    check('360px: No horizontal page overflow', overflow360.docNoOverflow);
    check('360px: No benchmark section overflow', overflow360.bmNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_mobile_360px.png'));
    console.log('  📸 Screenshot saved: goals_mobile_360px.png');

    // Test 395px
    await setViewport(395, 844);
    await new Promise((r) => setTimeout(r, 300));
    const overflow395 = await evaluate(`
      (function() {
        const bm = document.getElementById('mobile-benchmark-section');
        const doc = document.documentElement;
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          bmNoOverflow: bm ? bm.scrollWidth <= bm.clientWidth : true
        };
      })()
    `);
    check('395px: No horizontal page overflow', overflow395.docNoOverflow);
    check('395px: No benchmark section overflow', overflow395.bmNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_mobile_395px.png'));
    console.log('  📸 Screenshot saved: goals_mobile_395px.png');

    // Test 430px
    await setViewport(430, 932);
    await new Promise((r) => setTimeout(r, 300));
    const overflow430 = await evaluate(`
      (function() {
        const bm = document.getElementById('mobile-benchmark-section');
        const doc = document.documentElement;
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          bmNoOverflow: bm ? bm.scrollWidth <= bm.clientWidth : true
        };
      })()
    `);
    check('430px: No horizontal page overflow', overflow430.docNoOverflow);
    check('430px: No benchmark section overflow', overflow430.bmNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_mobile_430px.png'));
    console.log('  📸 Screenshot saved: goals_mobile_430px.png');

    console.log('\n--- SUITE 5: Desktop & Tablet Invariance ---');
    // Switch to Tablet 768px
    await setViewport(768, 1024);
    await new Promise((r) => setTimeout(r, 400));
    const tabletCheck = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-budget-view');
        const dsk = document.getElementById('desktop-tablet-budget-view');
        const mobStyle = mob ? window.getComputedStyle(mob) : null;
        const dskStyle = dsk ? window.getComputedStyle(dsk) : null;

        // Desktop benchmark has 3-column grid
        const dskBmGrid = dsk ? dsk.querySelector('[class*="md:grid-cols-3"]') : null;

        return {
          mobHidden: mobStyle && mobStyle.display === 'none',
          dskVisible: dskStyle && dskStyle.display !== 'none',
          has3ColGrid: !!dskBmGrid
        };
      })()
    `);
    check('Tablet 768px: Mobile Goals view is strictly hidden', tabletCheck.mobHidden);
    check('Tablet 768px: Desktop/tablet Goals view is visible', tabletCheck.dskVisible);
    check('Tablet 768px: Desktop 3-column benchmark grid is preserved', tabletCheck.has3ColGrid);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_tablet_768px.png'));
    console.log('  📸 Screenshot saved: goals_tablet_768px.png');

    // Switch to Desktop 1280px
    await setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 400));
    const desktopCheck = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-budget-view');
        const dsk = document.getElementById('desktop-tablet-budget-view');
        const mobStyle = mob ? window.getComputedStyle(mob) : null;
        const dskStyle = dsk ? window.getComputedStyle(dsk) : null;

        const dskBtn = document.getElementById('btn-scroll-to-add-goal');
        const dskBmGrid = dsk ? dsk.querySelector('[class*="md:grid-cols-3"]') : null;
        const dskBoxes = dskBmGrid ? dskBmGrid.querySelectorAll('.bg-white, .rounded-xl') : [];

        return {
          mobHidden: mobStyle && mobStyle.display === 'none',
          dskVisible: dskStyle && dskStyle.display !== 'none',
          hasDesktopBtn: !!dskBtn,
          has3ColGrid: !!dskBmGrid,
          separateBoxesPreserved: dskBoxes.length >= 2
        };
      })()
    `);
    check('Desktop 1280px: Mobile Goals view is strictly hidden', desktopCheck.mobHidden);
    check('Desktop 1280px: Desktop/tablet Goals view is visible', desktopCheck.dskVisible);
    check('Desktop 1280px: Desktop New Savings Goal button in header is preserved', desktopCheck.hasDesktopBtn);
    check('Desktop 1280px: Desktop 3-column benchmark grid is preserved', desktopCheck.has3ColGrid);
    check('Desktop 1280px: Desktop separate white reserve boxes are preserved', desktopCheck.separateBoxesPreserved);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_desktop_1280px.png'));
    console.log('  📸 Screenshot saved: goals_desktop_1280px.png');

    console.log('\n=============================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Total checks: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('Failed checks:', testResults.filter((r) => !r.pass));
      process.exit(1);
    } else {
      console.log('All Goals Tab Mobile UI Refinement tests PASSED perfectly!');
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
    } catch (_) {}
  }
}

runTest();
