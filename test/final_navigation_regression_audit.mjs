// test/final_navigation_regression_audit.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4550;
const CDP_PORT = 9255;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

// Crucial: Temporary profile in os.tmpdir() so it never touches the workspace
const tmpProfile = path.join(os.tmpdir(), 'edge_audit_prof_' + Date.now());

// Static file server serving production dist/
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
      '.png': 'image/png',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

let testResults = [];
function check(testId, name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS [${testId}]: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ id: testId, name, pass: true, details });
  } else {
    console.error(`  ❌ FAIL [${testId}]: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ id: testId, name, pass: false, details });
  }
}

server.listen(PORT, async () => {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${tmpProfile}`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page') || pages[0];
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
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

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
      await new Promise((r) => setTimeout(r, 300));
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }

    async function navigateTo(urlPath) {
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${urlPath}` });
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 150));
        try {
          const ready = await evaluate(`document.readyState === 'complete' && !!document.getElementById('mobile-bottom-nav')`);
          if (ready) {
            await new Promise((r) => setTimeout(r, 350));
            return;
          }
        } catch (_) {}
      }
    }

    console.log('\n================================================================');
    console.log('🧪 FINAL NAVIGATION REGRESSION AUDIT — PRODUCTION BUILD');
    console.log('================================================================\n');

    // Load Homepage
    await navigateTo('/');

    // -------------------------------------------------------------
    // Requirement 10: Multi-viewport audit (375px, 390px, 395px)
    // Requirement 8: Check for duplicate navigation bars
    // -------------------------------------------------------------
    console.log('--- Requirement 8 & 10: Viewports (375px, 390px, 395px) & No Duplicate Navs ---');
    const viewports = [375, 390, 395];
    for (const w of viewports) {
      await setViewport(w, 812, true);
      const navInspection = await evaluate(`(() => {
        const navs = document.querySelectorAll('#mobile-bottom-nav');
        const nav = navs[0];
        const style = nav ? window.getComputedStyle(nav) : null;
        return {
          count: navs.length,
          visible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
          position: style?.position,
          hasPill: !!document.getElementById('bottom-nav-active-pill')
        };
      })()`);

      check(`VIEWPORT_${w}`, `Single persistent bottom navigation at ${w}px`,
        navCheckSingle(navInspection),
        `count=${navInspection.count}, visible=${navInspection.visible}, position=${navInspection.position}`
      );
    }

    function navCheckSingle(info) {
      return info.count === 1 && info.visible && info.position === 'fixed' && info.hasPill;
    }

    // Set standard 390px viewport for sequence testing
    await setViewport(390, 844, true);

    // -------------------------------------------------------------
    // Requirement 1, 2, 5: Tab Sequence: Tracker → Split → Templates → Debt → Goals → More
    // Bottom nav visible on every primary tab, active-tab highlighting updates correctly
    // -------------------------------------------------------------
    console.log('\n--- Requirement 1, 2, 5: Tab Sequence & Active-Tab Highlighting ---');

    const tabsToTest = [
      { tab: 'tracker', idx: '0', viewId: 'tab-view-tracker', label: 'Tracker' },
      { tab: 'split', idx: '1', viewId: 'tab-view-split', label: 'Split' },
      { tab: 'templates', idx: '2', viewId: 'tab-view-templates', label: 'Templates' },
      { tab: 'debt', idx: '3', viewId: 'tab-view-debt', label: 'Debt' },
      { tab: 'targets', idx: '4', viewId: 'tab-view-targets', label: 'Goals' }
    ];

    for (const item of tabsToTest) {
      // Tap tab button
      await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="${item.tab}"]')?.click()`);
      await new Promise((r) => setTimeout(r, 350));

      const tabState = await evaluate(`(() => {
        const nav = document.getElementById('mobile-bottom-nav');
        const style = nav ? window.getComputedStyle(nav) : null;
        const activeBtn = document.querySelector('.bottom-nav-btn.active');
        const pill = document.getElementById('bottom-nav-active-pill');
        const targetView = document.getElementById('${item.viewId}');
        return {
          navVisible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
          activeTabAttr: activeBtn?.getAttribute('data-bottom-tab'),
          activeIdxAttr: activeBtn?.getAttribute('data-index'),
          pillLeft: pill?.style.left,
          viewVisible: targetView && !targetView.classList.contains('hidden'),
          hasBoldEmerald: activeBtn?.classList.contains('font-bold') && activeBtn?.classList.contains('text-emerald-700')
        };
      })()`);

      check(`TAB_${item.label.toUpperCase()}`,
        `Bottom nav persistent and ${item.label} active (highlight at index ${item.idx})`,
        tabState.navVisible && tabState.activeTabAttr === item.tab && tabState.viewVisible && tabState.hasBoldEmerald,
        `activeTab=${tabState.activeTabAttr}, viewVisible=${tabState.viewVisible}, pillLeft=${tabState.pillLeft}`
      );

      await captureScreenshot(path.join(ARTIFACT_DIR, `audit_tab_${item.tab}_390px.png`));
    }

    // -------------------------------------------------------------
    // Requirement 3: Split displays the existing Bill Splitter interface
    // -------------------------------------------------------------
    console.log('\n--- Requirement 3: Bill Splitter Content Inside Split Tab ---');
    await evaluate(`window.switchTab('split')`);
    await new Promise((r) => setTimeout(r, 300));

    const splitterEngineCheck = await evaluate(`(() => {
      const container = document.getElementById('bill-splitter-container');
      const currencySelector = document.getElementById('select-currency');
      const resetBtn = document.querySelector('#bill-splitter-container #btn-open-reset-modal');
      const tabEven = document.getElementById('tab-btn-even');
      const tabItemized = document.getElementById('tab-btn-itemized');
      const tabTrip = document.getElementById('tab-btn-trip');
      const inputBill = document.getElementById('input-even-bill');
      const tipPresets = document.querySelectorAll('.btn-tip-preset');

      // Test Even calculation (3 people default, 2400 bill -> each person 800)
      if (inputBill) {
        inputBill.value = '2400';
        inputBill.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const grandTotal = document.getElementById('even-grand-total-display')?.textContent?.trim();
      const perPerson = document.getElementById('even-per-person-display')?.textContent?.trim();

      // Test Mode Switch
      tabItemized?.click();
      const itemizedAria = tabItemized?.getAttribute('aria-selected') === 'true';
      tabEven?.click();

      return {
        hasContainer: !!container,
        hasCurrency: currencySelector && currencySelector.options.length >= 10,
        hasResetBtn: !!resetBtn,
        hasAllModes: !!tabEven && !!tabItemized && !!tabTrip,
        tipPresetsCount: tipPresets.length,
        evenCalculates: grandTotal === '₹2,400.00' && perPerson === '₹800.00',
        itemizedSwitches: itemizedAria
      };
    })()`);

    check('SPLIT_INTERFACE', 'Existing Bill Splitter calculator interface & engine rendered in-place',
      splitterEngineCheck.hasContainer && splitterEngineCheck.hasCurrency && splitterEngineCheck.hasResetBtn &&
      splitterEngineCheck.hasAllModes && splitterEngineCheck.tipPresetsCount >= 4 &&
      splitterEngineCheck.evenCalculates && splitterEngineCheck.itemizedSwitches,
      `currencies=${splitterEngineCheck.hasCurrency}, tipPresets=${splitterEngineCheck.tipPresetsCount}, calc=${splitterEngineCheck.evenCalculates}`
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'audit_splitter_rendered_390px.png'));

    // -------------------------------------------------------------
    // Requirement 4: Navigation does not disappear when scrolling
    // -------------------------------------------------------------
    console.log('\n--- Requirement 4: Bottom Navigation Scroll Persistence ---');
    await evaluate(`window.scrollTo({ top: 1000, behavior: 'instant' })`);
    await new Promise((r) => setTimeout(r, 300));

    const scrollAudit = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const style = nav ? window.getComputedStyle(nav) : null;
      const rect = nav ? nav.getBoundingClientRect() : null;
      const inViewport = rect ? (rect.bottom <= window.innerHeight + 1 && rect.top > 0) : false;
      return {
        scrollY: window.scrollY,
        navVisible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
        position: style?.position,
        inViewport,
        bottomNavRect: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) } : null
      };
    })()`);

    check('SCROLL_PERSISTENCE', 'Bottom navigation remains fixed and visible during scrolling',
      scrollAudit.scrollY > 0 && scrollAudit.navVisible && scrollAudit.position === 'fixed' && scrollAudit.inViewport,
      `scrollY=${scrollAudit.scrollY}, position=${scrollAudit.position}, inViewport=${scrollAudit.inViewport}`
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'audit_scroll_persistence_390px.png'));
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------
    // Requirement 6: Knowledge Guides and secondary links remain inside More
    // Requirement 7: More panel opens and closes correctly
    // -------------------------------------------------------------
    console.log('\n--- Requirement 6 & 7: More Panel Open/Close & Content ---');

    // 1. Initial State: Sheet strictly closed
    const initialSheetState = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const backdrop = document.getElementById('more-menu-backdrop');
      return {
        sheetHidden: sheet?.classList.contains('hidden'),
        backdropHidden: backdrop?.classList.contains('hidden')
      };
    })()`);
    check('MORE_INITIAL_CLOSED', 'More panel is closed by default on initial page load',
      initialSheetState.sheetHidden && initialSheetState.backdropHidden
    );

    // 2. Open via More button tap
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 450));

    const openedSheetState = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const backdrop = document.getElementById('more-menu-backdrop');
      // Tools
      const btnKnowledge = document.querySelector('[data-more-action="knowledge"]');
      const btnImport = document.querySelector('[data-more-action="import"]');
      const btnTemplates = document.querySelector('[data-more-action="templates"]');
      const btnSplit = document.querySelector('[data-more-action="split"]');
      // Legal & About
      const linkAbout = document.querySelector('#more-menu-sheet a[href="/about/"]');
      const linkContact = document.querySelector('#more-menu-sheet a[href="/contact-us/"]');
      const linkPrivacy = document.querySelector('#more-menu-sheet a[href="/privacy/"]');
      const linkTerms = document.querySelector('#more-menu-sheet a[href="/terms/"]');
      return {
        sheetOpen: !sheet?.classList.contains('hidden') && sheet?.getAttribute('aria-hidden') === 'false',
        backdropOpen: !backdrop?.classList.contains('hidden'),
        hasKnowledge: !!btnKnowledge,
        hasImport: !!btnImport,
        hasTemplates: !!btnTemplates,
        hasSplit: !!btnSplit,
        hasAbout: !!linkAbout,
        hasContact: !!linkContact,
        hasPrivacy: !!linkPrivacy,
        hasTerms: !!linkTerms
      };
    })()`);

    check('MORE_PANEL_OPEN', 'More panel opens with Knowledge Guides and secondary links',
      openedSheetState.sheetOpen && openedSheetState.backdropOpen &&
      openedSheetState.hasKnowledge && openedSheetState.hasImport && openedSheetState.hasTemplates && openedSheetState.hasSplit &&
      openedSheetState.hasAbout && openedSheetState.hasContact && openedSheetState.hasPrivacy && openedSheetState.hasTerms,
      `knowledge=${openedSheetState.hasKnowledge}, about=${openedSheetState.hasAbout}, privacy=${openedSheetState.hasPrivacy}`
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'audit_more_panel_open_390px.png'));

    // 3. Close via Close button (X)
    await evaluate(`document.getElementById('btn-close-more-sheet')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const closedByX = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const backdrop = document.getElementById('more-menu-backdrop');
      return sheet?.classList.contains('hidden') && backdrop?.classList.contains('hidden');
    })()`);
    check('MORE_PANEL_CLOSE_X', 'More panel closes cleanly on close button (X)', closedByX);

    // 4. Open and close via backdrop tap
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`document.getElementById('more-menu-backdrop')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const closedByBackdrop = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      return sheet?.classList.contains('hidden');
    })()`);
    check('MORE_PANEL_CLOSE_BACKDROP', 'More panel closes cleanly on tapping backdrop outside', closedByBackdrop);

    // -------------------------------------------------------------
    // Requirement 9: Verify Desktop navigation remains unchanged
    // -------------------------------------------------------------
    console.log('\n--- Requirement 9: Desktop 1280px Navigation Unchanged ---');
    await setViewport(1280, 800, false);
    await evaluate(`window.switchTab('tracker')`);
    await new Promise((r) => setTimeout(r, 350));

    const desktopAudit = await evaluate(`(() => {
      const mobileNav = document.getElementById('mobile-bottom-nav');
      const mobileNavStyle = mobileNav ? window.getComputedStyle(mobileNav) : null;
      const desktopNav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
      const desktopNavStyle = desktopNav ? window.getComputedStyle(desktopNav) : null;
      // 5 Desktop tab buttons
      const btn1 = document.querySelector('button[data-tab="tracker"]');
      const btn2 = document.querySelector('button[data-tab="templates"]');
      const btn3 = document.querySelector('button[data-tab="split"]');
      const btn4 = document.querySelector('button[data-tab="debt"]');
      const btn5 = document.querySelector('button[data-tab="targets"]');
      return {
        mobileNavHidden: mobileNavStyle?.display === 'none',
        desktopNavVisible: desktopNavStyle?.display !== 'none',
        hasAll5Tabs: !!btn1 && !!btn2 && !!btn3 && !!btn4 && !!btn5
      };
    })()`);

    check('DESKTOP_LAYOUT', 'Desktop hides mobile bottom nav and retains balanced 5-tab strip',
      desktopAudit.mobileNavHidden && desktopAudit.desktopNavVisible && desktopAudit.hasAll5Tabs,
      `mobileNavHidden=${desktopAudit.mobileNavHidden}, desktopNavVisible=${desktopAudit.desktopNavVisible}`
    );

    // Test Desktop Split Button in-place switch
    await evaluate(`document.querySelector('button[data-tab="split"]')?.click()`);
    await new Promise((r) => setTimeout(r, 350));

    const desktopSplitInPlace = await evaluate(`(() => {
      const splitView = document.getElementById('tab-view-split');
      const trackerView = document.getElementById('tab-view-tracker');
      const activeDesktopTab = document.querySelector('.tab-btn.active');
      return {
        splitVisible: splitView && !splitView.classList.contains('hidden'),
        trackerHidden: trackerView && trackerView.classList.contains('hidden'),
        activeTab: activeDesktopTab?.getAttribute('data-tab')
      };
    })()`);

    check('DESKTOP_SPLIT_IN_PLACE', 'Desktop 3. Bill Split switches in-place without page reload',
      desktopSplitInPlace.splitVisible && desktopSplitInPlace.trackerHidden && desktopSplitInPlace.activeTab === 'split',
      `activeTab=${desktopSplitInPlace.activeTab}`
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'audit_desktop_1280px.png'));

    // -------------------------------------------------------------
    // Standalone Route /bill-splitter/ Audit
    // -------------------------------------------------------------
    console.log('\n--- Standalone Route /bill-splitter/ Verification ---');
    await setViewport(390, 844, true);
    await navigateTo('/bill-splitter/');

    const standaloneState = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const style = nav ? window.getComputedStyle(nav) : null;
      const activeBtn = document.querySelector('.bottom-nav-btn.active');
      const pill = document.getElementById('bottom-nav-active-pill');
      const trackerLink = document.querySelector('.bottom-nav-btn[data-bottom-tab="tracker"]');
      const splitBtn = document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]');
      return {
        navVisible: style ? style.display !== 'none' && style.visibility !== 'hidden' : false,
        activeTab: activeBtn?.getAttribute('data-bottom-tab'),
        pillLeft: pill?.style.left,
        trackerHref: trackerLink?.getAttribute('href'),
        splitIsButton: splitBtn?.tagName === 'BUTTON'
      };
    })()`);

    check('STANDALONE_SPLITTER_NAV', 'Standalone /bill-splitter/ route includes persistent bottom nav with Split active',
      standaloneState.navVisible && standaloneState.activeTab === 'split' && standaloneState.trackerHref === '/?tab=tracker' && standaloneState.splitIsButton,
      `activeTab=${standaloneState.activeTab}, trackerHref=${standaloneState.trackerHref}, pillLeft=${standaloneState.pillLeft}`
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'audit_standalone_splitter_390px.png'));

    // Final Summary
    console.log('\n================================================================');
    const passedCount = testResults.filter(r => r.pass).length;
    const failedCount = testResults.filter(r => !r.pass).length;
    console.log(`TOTAL AUDIT CHECKS: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Audit execution error:', err);
    process.exitCode = 1;
  } finally {
    edgeProc.kill();
    server.close();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
});
