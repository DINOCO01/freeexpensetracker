// test/test_persistent_split_nav.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\princ\\.gemini\\antigravity\\brain\\8465f667-0b7d-42d6-a856-c56991559b8f';
const PORT = 4321;
const CDP_PORT = 9240;

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

let edgePath = EDGE_PATHS.find(p => fs.existsSync(p));
if (!edgePath) {
  console.error('No Edge/Chrome found');
  process.exit(1);
}

const tmpProfile = path.join(process.cwd(), '.tmp_cdp_profile_' + Date.now());

const browser = spawn(edgePath, [
  `--remote-debugging-port=${CDP_PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--user-data-dir=${tmpProfile}`,
  `http://localhost:${PORT}/`
]);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await sleep(2500);

  const listRes = await fetch(`http://localhost:${CDP_PORT}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page' && p.url.includes(String(PORT)));

  if (!page) {
    console.error('Could not find page target among:', pages);
    process.exit(1);
  }

  const { default: WebSocket } = await import('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (data) => {
        const res = JSON.parse(data.toString());
        if (res.id === id) {
          ws.off('message', handler);
          if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
          else resolve(res.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(exp) {
    const res = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async function setViewport(w, h, mobile = true) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile
    });
    await sleep(300);
  }

  async function captureScreenshot(filepath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }

  async function waitForHydration() {
    for (let i = 0; i < 30; i++) {
      const isReady = await evaluate(`typeof window.switchTab === 'function' && !!document.getElementById('mobile-bottom-nav')`);
      if (isReady) return true;
      await sleep(200);
    }
    return false;
  }

  const results = [];
  function check(desc, passed) {
    results.push({ desc, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${desc}`);
  }

  try {
    console.log('\n======================================================');
    console.log('🧪 QA: PERSISTENT MOBILE BOTTOM NAV ON BILL SPLITTER');
    console.log('======================================================\n');

    // 1. Initial Load at 395x656
    await setViewport(395, 656, true);
    const hydrated = await waitForHydration();
    check('Page hydrates successfully with switchTab available', hydrated);

    const initial = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const pill = document.getElementById('bottom-nav-active-pill');
      const activeBtn = document.querySelector('.bottom-nav-btn.active');
      const trackerTab = document.getElementById('tab-view-tracker');
      const splitTab = document.getElementById('tab-view-split');
      const style = nav ? window.getComputedStyle(nav) : null;
      return {
        navExists: !!nav,
        navVisible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
        activeTab: activeBtn?.getAttribute('data-bottom-tab'),
        pillLeft: pill?.style.left,
        trackerVisible: trackerTab && !trackerTab.classList.contains('hidden'),
        splitVisible: splitTab && !splitTab.classList.contains('hidden')
      };
    })()`);
    console.log('Initial State (395px):', initial);

    check('Mobile bottom nav is visible on homepage load', initial.navVisible);
    check('Tracker is active tab by default', initial.activeTab === 'tracker' && initial.trackerVisible && !initial.splitVisible);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'persistent_nav_1_tracker_395px.png'));

    // 2. Tap Split tab on bottom nav
    console.log('\n--- Test 2: Tap Split Tab in Bottom Nav ---');
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]')?.click()`);
    await sleep(400);

    const afterSplit = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const pill = document.getElementById('bottom-nav-active-pill');
      const activeBtn = document.querySelector('.bottom-nav-btn.active');
      const trackerTab = document.getElementById('tab-view-tracker');
      const splitTab = document.getElementById('tab-view-split');
      const bsc = document.getElementById('bill-splitter-container');
      const style = nav ? window.getComputedStyle(nav) : null;
      return {
        navVisible: style ? style.display !== 'none' : false,
        activeTab: activeBtn?.getAttribute('data-bottom-tab'),
        pillLeft: pill?.style.left,
        trackerHidden: trackerTab?.classList.contains('hidden'),
        splitVisible: splitTab && !splitTab.classList.contains('hidden'),
        splitterRendered: !!bsc
      };
    })()`);
    console.log('After Split Tap:', afterSplit);

    check('Tapping Split renders Bill Splitter in-place', afterSplit.splitVisible && afterSplit.trackerHidden && afterSplit.splitterRendered);
    check('Mobile bottom nav remains persistent and visible on Split view', afterSplit.navVisible);
    check('Active pill highlight moves to Split tab (index 1)', afterSplit.activeTab === 'split');

    await captureScreenshot(path.join(ARTIFACT_DIR, 'persistent_nav_2_split_active_395px.png'));

    // 3. Test Bill Splitter calculations and mode switching
    console.log('\n--- Test 3: Bill Splitter Functionality Inside Split Tab ---');
    const calcTest = await evaluate(`(() => {
      const inputTotal = document.getElementById('input-even-total');
      if (inputTotal) {
        inputTotal.value = '1000';
        inputTotal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const grandTotal = document.getElementById('text-even-grand-total')?.textContent?.trim();
      const eachPays = document.getElementById('text-even-each-pays')?.textContent?.trim();

      // Switch to Itemized Mode
      const btnItemized = document.getElementById('tab-btn-itemized');
      btnItemized?.click();
      const itemizedSelected = btnItemized?.getAttribute('aria-selected') === 'true';

      // Switch to Trip Mode
      const btnTrip = document.getElementById('tab-btn-trip');
      btnTrip?.click();
      const tripSelected = btnTrip?.getAttribute('aria-selected') === 'true';

      // Switch back to Even Mode
      document.getElementById('tab-btn-even')?.click();

      return {
        grandTotal,
        eachPays,
        itemizedSelected,
        tripSelected
      };
    })()`);
    console.log('Splitter Calculator Checks:', calcTest);

    check('Bill Splitter calculates amounts accurately inside tab', calcTest.grandTotal === '₹1,000.00' && calcTest.eachPays === '₹500.00');
    check('Mode tabs (Even, Itemized, Trip) switch properly inside tab', calcTest.itemizedSelected && calcTest.tripSelected);

    // 4. Test Reset Isolation (MainApp vs BillSplitter)
    console.log('\n--- Test 4: Reset Button Isolation ---');
    const resetIsolation = await evaluate(`(() => {
      const bscResetBtn = document.querySelector('#bill-splitter-container #btn-open-reset-modal');
      bscResetBtn?.click();
      const bscModal = document.getElementById('modal-reset-confirm');
      const trackerModal = document.getElementById('reset-confirm-modal');
      const bscOpen = bscModal && !bscModal.classList.contains('hidden');
      const trackerOpen = trackerModal && !trackerModal.classList.contains('hidden');
      // Dismiss bsc modal
      document.getElementById('btn-cancel-reset-modal')?.click();
      return { bscOpen, trackerOpen };
    })()`);
    console.log('Reset Modal Isolation:', resetIsolation);
    check('Bill Splitter reset triggers its own modal without opening Tracker reset modal', resetIsolation.bscOpen && !resetIsolation.trackerOpen);

    // 5. Test Switching Across Other Tabs (Debt, Goals, Templates, Tracker)
    console.log('\n--- Test 5: Switching Across All Tabs with Persistent Bottom Nav ---');

    // Debt
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="debt"]')?.click()`);
    await sleep(300);
    const debtCheck = await evaluate(`(() => ({
      active: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab'),
      debtVisible: !document.getElementById('tab-view-debt')?.classList.contains('hidden'),
      splitHidden: document.getElementById('tab-view-split')?.classList.contains('hidden')
    }))()`);
    check('Tapping Debt displays debt view while keeping nav persistent', debtCheck.active === 'debt' && debtCheck.debtVisible && debtCheck.splitHidden);

    // Goals
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="targets"]')?.click()`);
    await sleep(300);
    const goalsCheck = await evaluate(`(() => ({
      active: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab'),
      goalsVisible: !document.getElementById('tab-view-targets')?.classList.contains('hidden')
    }))()`);
    check('Tapping Goals displays goals view while keeping nav persistent', goalsCheck.active === 'targets' && goalsCheck.goalsVisible);

    // Templates
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="templates"]')?.click()`);
    await sleep(300);
    const tmplCheck = await evaluate(`(() => ({
      active: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab'),
      templatesVisible: !document.getElementById('tab-view-templates')?.classList.contains('hidden')
    }))()`);
    check('Tapping Templates displays templates view while keeping nav persistent', tmplCheck.active === 'templates' && tmplCheck.templatesVisible);

    // Tracker
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="tracker"]')?.click()`);
    await sleep(300);
    const trackerCheck = await evaluate(`(() => ({
      active: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab'),
      trackerVisible: !document.getElementById('tab-view-tracker')?.classList.contains('hidden')
    }))()`);
    check('Tapping Tracker returns to tracker view while keeping nav persistent', trackerCheck.active === 'tracker' && trackerCheck.trackerVisible);

    // 6. Test More Sheet -> Bill Splitter
    console.log('\n--- Test 6: More Sheet -> Bill Splitter Navigation ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await sleep(400);
    await evaluate(`document.querySelector('[data-more-action="split"]')?.click()`);
    await sleep(400);

    const moreSplitCheck = await evaluate(`(() => ({
      sheetHidden: document.getElementById('more-menu-sheet')?.classList.contains('hidden'),
      splitVisible: !document.getElementById('tab-view-split')?.classList.contains('hidden'),
      activeTab: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab')
    }))()`);
    check('Tapping Bill Splitter inside More sheet switches to Split view and closes sheet',
      moreSplitCheck.sheetHidden && moreSplitCheck.splitVisible && moreSplitCheck.activeTab === 'split'
    );

    // 7. Test Standalone Route /bill-splitter/
    console.log('\n--- Test 7: Standalone Route /bill-splitter/ with Persistent Bottom Nav ---');
    await send('Page.navigate', { url: `http://localhost:${PORT}/bill-splitter/` });
    // wait for standalone page ready
    for (let i = 0; i < 30; i++) {
      const ready = await evaluate(`document.readyState === 'complete' && !!document.getElementById('mobile-bottom-nav')`);
      if (ready) break;
      await sleep(200);
    }

    const standalone = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const activeBtn = document.querySelector('.bottom-nav-btn.active');
      const trackerLink = document.querySelector('.bottom-nav-btn[data-bottom-tab="tracker"]');
      const splitBtn = document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]');
      const pill = document.getElementById('bottom-nav-active-pill');
      const style = nav ? window.getComputedStyle(nav) : null;
      return {
        navVisible: style ? style.display !== 'none' : false,
        activeTab: activeBtn?.getAttribute('data-bottom-tab'),
        pillLeft: pill?.style.left,
        isSplitButton: splitBtn?.tagName === 'BUTTON',
        trackerHref: trackerLink?.getAttribute('href')
      };
    })()`);
    console.log('Standalone Splitter Nav State:', standalone);

    check('Standalone /bill-splitter/ renders mobile bottom nav', standalone.navVisible);
    check('Split tab is active by default on /bill-splitter/', standalone.activeTab === 'split');
    check('Active pill highlight is on Split (index 1) on /bill-splitter/', standalone.pillLeft === 'calc(16.6667%)');
    check('Tracker tab links to /?tab=tracker from standalone page', standalone.trackerHref === '/?tab=tracker');

    await captureScreenshot(path.join(ARTIFACT_DIR, 'persistent_nav_3_standalone_page_395px.png'));

    // 8. Desktop 1280px QA
    console.log('\n--- Test 8: Desktop 1280px Navigation QA ---');
    await setViewport(1280, 800, false);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(2000);
    await waitForHydration();

    const desktopState = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const style = nav ? window.getComputedStyle(nav) : null;
      const desktopSplitBtn = document.querySelector('button[data-tab="split"]');
      return {
        mobileNavHidden: style ? style.display === 'none' : true,
        desktopSplitBtnExists: !!desktopSplitBtn
      };
    })()`);
    check('Desktop hides mobile bottom nav', desktopState.mobileNavHidden);
    check('Desktop TabNav includes 3. Bill Split button', desktopState.desktopSplitBtnExists);

    // Click desktop Split button
    await evaluate(`document.querySelector('button[data-tab="split"]')?.click()`);
    await sleep(400);

    const desktopSplitCheck = await evaluate(`(() => ({
      splitVisible: !document.getElementById('tab-view-split')?.classList.contains('hidden'),
      trackerHidden: document.getElementById('tab-view-tracker')?.classList.contains('hidden')
    }))()`);
    check('Desktop 3. Bill Split button switches to Split tab in-place', desktopSplitCheck.splitVisible && desktopSplitCheck.trackerHidden);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'persistent_nav_4_desktop_split_1280px.png'));

    console.log('\n======================================================');
    const allPassed = results.every(r => r.passed);
    console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
    console.log('======================================================\n');

    if (!allPassed) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error in test:', err);
    process.exitCode = 1;
  } finally {
    try { ws.close(); } catch (_) {}
    browser.kill();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
}

run();
