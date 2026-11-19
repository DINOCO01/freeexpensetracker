import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4422;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

// Start static server
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

server.listen(PORT, async () => {
  const cdpPort = 9325;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('No page found');

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

    async function evaluate(exp) {
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.value;
    }

    async function setViewport(w, h) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: w <= 768
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }

    console.log('\n======================================================');
    console.log('📱 MOBILE HOMEPAGE UI REDESIGN QA VERIFICATION');
    console.log('======================================================\n');

    // 1. Multi-viewport testing
    const mobileViewports = [
      { name: '320px', width: 320, height: 650 },
      { name: '360px', width: 360, height: 740 },
      { name: '375px', width: 375, height: 812 },
      { name: '390px', width: 390, height: 844 },
      { name: '412px', width: 412, height: 915 },
      { name: '430px', width: 430, height: 932 },
    ];

    for (const vp of mobileViewports) {
      await setViewport(vp.width, vp.height);

      const overflow = await evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth;`);
      check(`No horizontal overflow at ${vp.name}`, !overflow);

      const bottomNavVisible = await evaluate(`(() => {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return false;
        const style = window.getComputedStyle(nav);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })()`);
      check(`Mobile bottom nav visible at ${vp.name}`, bottomNavVisible);

      const desktopNavHidden = await evaluate(`(() => {
        const nav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
        if (!nav) return true;
        const style = window.getComputedStyle(nav);
        return style.display === 'none';
      })()`);
      check(`Desktop TabNav hidden at ${vp.name}`, desktopNavHidden);

      await captureScreenshot(path.join(ARTIFACT_DIR, `mobile_redesign_${vp.width}px.png`));
    }

    // Set to 390px for detailed functional testing
    await setViewport(390, 844);

    console.log('\n--- Section 1: Mobile Header ---');
    const headerInfo = await evaluate(`(() => {
      const brand = document.querySelector('header a[aria-label="Free Expense Tracker Home"]');
      const langBtn = document.getElementById('btn-lang-selector');
      const themeBtn = document.getElementById('btn-theme-toggle');
      const importBtn = document.getElementById('btn-open-file-importer-nav');
      return {
        brand: !!brand,
        lang: !!langBtn,
        theme: !!themeBtn,
        import: !!importBtn
      };
    })()`);
    check('Header contains brand logo/name, language selector, theme toggle, and import button', headerInfo.brand && headerInfo.lang && headerInfo.theme && headerInfo.import);

    console.log('\n--- Section 2: Mobile Currency & Reset Controls ---');
    const controlsInfo = await evaluate(`(() => {
      const mobileCurrency = document.getElementById('currency-selector-mobile');
      const mobileReset = document.querySelector('#tab-view-tracker .btn-open-reset-modal');
      return {
        currencyExists: !!mobileCurrency,
        resetExists: !!mobileReset,
        currencyVisible: mobileCurrency ? window.getComputedStyle(mobileCurrency).display !== 'none' : false,
        resetVisible: mobileReset ? window.getComputedStyle(mobileReset).display !== 'none' : false,
      };
    })()`);
    check('Dedicated mobile Currency selector exists and is visible', controlsInfo.currencyExists && controlsInfo.currencyVisible);
    check('Dedicated mobile Reset button exists and is visible', controlsInfo.resetExists && controlsInfo.resetVisible);

    // Test Currency selection
    await evaluate(`(() => {
      const sel = document.getElementById('currency-selector-mobile');
      if (sel) {
        sel.value = 'EUR';
        sel.dispatchEvent(new Event('change'));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));
    const currencyUpdated = await evaluate(`(() => {
      const normalized = document.getElementById('income-normalized-amount')?.textContent || '';
      return normalized.includes('€');
    })()`);
    check('Selecting EUR in mobile currency selector formats amounts with €', currencyUpdated);

    // Test Mobile Reset Button triggers modal
    await evaluate(`document.querySelector('#tab-view-tracker .btn-open-reset-modal')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const resetModalVisible = await evaluate(`(() => {
      const modal = document.getElementById('reset-confirm-modal');
      return modal && !modal.classList.contains('hidden');
    })()`);
    check('Clicking mobile Reset button opens Reset Confirmation Modal', resetModalVisible);

    // Close reset modal
    await evaluate(`document.getElementById('btn-cancel-reset')?.click()`);
    await new Promise((r) => setTimeout(r, 300));

    console.log('\n--- Section 3: Financial Health Card & Collapsible Breakdown ---');
    const healthInfo = await evaluate(`(() => {
      const score = document.getElementById('health-score-number')?.textContent?.trim();
      const tierBadge = document.getElementById('health-tier-badge');
      const dialStroke = document.getElementById('score-circle-stroke');
      const savingsLabel = document.getElementById('score-savings-rate-label')?.textContent?.trim();
      const fixedLabel = document.getElementById('score-fixed-cost-label')?.textContent?.trim();
      const bufferLabel = document.getElementById('score-buffer-label')?.textContent?.trim();
      const detailsContent = document.getElementById('health-details-content');
      const toggleBtn = document.getElementById('btn-toggle-health-details');

      return {
        score,
        tierVisible: !!tierBadge,
        dialStroke: !!dialStroke,
        savingsLabel,
        fixedLabel,
        bufferLabel,
        isCollapsedInitially: detailsContent?.classList.contains('hidden'),
        toggleBtnVisible: toggleBtn ? window.getComputedStyle(toggleBtn).display !== 'none' : false
      };
    })()`);
    check('Financial Health Card shows score number, tier badge and radial dial', healthInfo.score && healthInfo.tierVisible && healthInfo.dialStroke);
    check('Financial Health Card shows 3 metric pills with score points', healthInfo.savingsLabel && healthInfo.fixedLabel && healthInfo.bufferLabel);
    check('Health details breakdown is collapsed by default on mobile', healthInfo.isCollapsedInitially);
    check('Health details toggle accordion button is visible on mobile', healthInfo.toggleBtnVisible);

    // Expand accordion
    await evaluate(`document.getElementById('btn-toggle-health-details')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const isExpanded = await evaluate(`(() => {
      const detailsContent = document.getElementById('health-details-content');
      const chevron = document.getElementById('health-details-chevron');
      return !detailsContent?.classList.contains('hidden') && chevron?.classList.contains('rotate-180');
    })()`);
    check('Clicking accordion button expands score breakdown, progress bars and recommendations', isExpanded);

    // Collapse accordion back
    await evaluate(`document.getElementById('btn-toggle-health-details')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const isCollapsedAgain = await evaluate(`document.getElementById('health-details-content')?.classList.contains('hidden')`);
    check('Clicking accordion button again collapses details breakdown', isCollapsedAgain);

    console.log('\n--- Section 4: Fixed Bottom Liquid Glass Navigation (6 Items) ---');
    const bottomNavItems = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      if (!nav) return [];
      const items = Array.from(nav.querySelectorAll('.bottom-nav-btn'));
      return items.map((el) => ({
        tag: el.tagName.toLowerCase(),
        tab: el.getAttribute('data-bottom-tab'),
        href: el.getAttribute('href') || null,
        text: el.querySelector('span')?.textContent?.trim()
      }));
    })()`);

    check(`Bottom nav has exactly 6 items (found ${bottomNavItems.length})`, bottomNavItems.length === 6);
    check('Item 1 is Tracker', bottomNavItems[0]?.tab === 'tracker' && bottomNavItems[0]?.text === 'Tracker');
    check('Item 2 is Split linking to /bill-splitter/', bottomNavItems[1]?.tab === 'split' && bottomNavItems[1]?.href === '/bill-splitter/');
    check('Item 3 is Templates', bottomNavItems[2]?.tab === 'templates' && bottomNavItems[2]?.text === 'Templates');
    check('Item 4 is Debt', bottomNavItems[3]?.tab === 'debt' && bottomNavItems[3]?.text === 'Debt');
    check('Item 5 is Goals', bottomNavItems[4]?.tab === 'targets' && bottomNavItems[4]?.text === 'Goals');
    check('Item 6 is More', bottomNavItems[5]?.tab === 'more' && bottomNavItems[5]?.text === 'More');

    // Test Tab Switching & Pill Movement:
    // Tab 2: Templates
    await evaluate(`document.querySelector('button[data-bottom-tab="templates"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    const templatesActive = await evaluate(`(() => {
      const templatesView = document.getElementById('tab-view-templates');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !templatesView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    })()`);
    check('Clicking Templates bottom tab switches to Templates view', templatesActive.viewVisible);
    check(`Active pill moved to Templates column (index 2: ${templatesActive.pillLeft})`, templatesActive.pillLeft.includes('33.3') || templatesActive.pillLeft.includes('2 *'));

    // Tab 3: Debt
    await evaluate(`document.querySelector('button[data-bottom-tab="debt"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    const debtActive = await evaluate(`(() => {
      const debtView = document.getElementById('tab-view-debt');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !debtView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    })()`);
    check('Clicking Debt bottom tab switches to Debt Planner view', debtActive.viewVisible);
    check(`Active pill moved to Debt column (index 3: ${debtActive.pillLeft})`, debtActive.pillLeft.includes('50%') || debtActive.pillLeft.includes('3 *'));

    // Tab 4: Goals
    await evaluate(`document.querySelector('button[data-bottom-tab="targets"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    const targetsActive = await evaluate(`(() => {
      const targetsView = document.getElementById('tab-view-targets');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !targetsView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    })()`);
    check('Clicking Goals bottom tab switches to Budget & Goals view', targetsActive.viewVisible);
    check(`Active pill moved to Goals column (index 4: ${targetsActive.pillLeft})`, targetsActive.pillLeft.includes('66.6') || targetsActive.pillLeft.includes('4 *'));

    // Return to Tracker
    await evaluate(`document.querySelector('button[data-bottom-tab="tracker"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    const trackerActive = await evaluate(`(() => {
      const trackerView = document.getElementById('tab-view-tracker');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !trackerView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    })()`);
    check('Clicking Tracker bottom tab returns to Tracker view', trackerActive.viewVisible);
    check(`Active pill moved to Tracker column (index 0: ${trackerActive.pillLeft})`, trackerActive.pillLeft.includes('0%') || trackerActive.pillLeft.includes('0 *'));

    console.log('\n--- Section 5: More Menu Bottom Sheet ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const sheetOpen = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const backdrop = document.getElementById('more-menu-backdrop');
      return {
        sheetVisible: !sheet?.classList.contains('translate-y-full'),
        backdropVisible: !backdrop?.classList.contains('hidden'),
        hasKnowledge: !!sheet?.querySelector('[data-more-action="knowledge"]'),
        hasImport: !!sheet?.querySelector('[data-more-action="import"]'),
        hasTemplates: !!sheet?.querySelector('[data-more-action="templates"]'),
        hasSplitter: !!sheet?.querySelector('a[href="/bill-splitter/"]'),
        hasReset: !!sheet?.querySelector('.btn-open-reset-modal')
      };
    })()`);
    check('Clicking More opens bottom sheet overlay', sheetOpen.sheetVisible && sheetOpen.backdropVisible);
    check('More sheet contains Knowledge & Guides, Importer, Templates, Bill Splitter, and Reset button', sheetOpen.hasKnowledge && sheetOpen.hasImport && sheetOpen.hasTemplates && sheetOpen.hasSplitter && sheetOpen.hasReset);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_more_sheet_390px.png'));

    // Test Clicking Knowledge & Guides inside More sheet
    await evaluate(`document.querySelector('[data-more-action="knowledge"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const knowledgeSwitched = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const knowledgeView = document.getElementById('tab-view-knowledge');
      return {
        sheetClosed: sheet?.classList.contains('translate-y-full'),
        knowledgeVisible: !knowledgeView?.classList.contains('hidden')
      };
    })()`);
    check('Clicking Knowledge in More sheet closes the bottom sheet', knowledgeSwitched.sheetClosed);
    check('Clicking Knowledge in More sheet switches to Knowledge & Guides tab view', knowledgeSwitched.knowledgeVisible);

    console.log('\n--- Section 6: Buy Me a Coffee Widget Clearance ---');
    await evaluate(`document.querySelector('button[data-bottom-tab="tracker"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const bmcClearance = await evaluate(`(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      const bmc = document.getElementById('bmc-wbtn');
      if (!nav || !bmc) return { ok: true, reason: 'BMC button not in DOM' };
      const navRect = nav.getBoundingClientRect();
      const bmcRect = bmc.getBoundingClientRect();
      return {
        ok: bmcRect.bottom <= navRect.top + 5,
        bmcBottom: bmcRect.bottom,
        navTop: navRect.top
      };
    })()`);
    check(`BMC widget floats above bottom navigation bar (BMC bottom: ${bmcClearance.bmcBottom}px, Nav top: ${bmcClearance.navTop}px)`, bmcClearance.ok);

    console.log('\n--- Section 7: Desktop Regression (1280px Viewport) ---');
    await setViewport(1280, 800);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const desktopChecks = await evaluate(`(() => {
      try {
        const desktopNav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
        const mobileNav = document.getElementById('mobile-bottom-nav');
        const mobileCurrency = document.getElementById('currency-selector-mobile');
        const desktopCurrency = document.getElementById('currency-selector');
        const desktopReset = document.getElementById('btn-open-reset-modal');

        const dNavStyle = desktopNav ? window.getComputedStyle(desktopNav).display : 'none';
        const mNavStyle = mobileNav ? window.getComputedStyle(mobileNav).display : 'none';
        const mCurrencyHidden = mobileCurrency ? (mobileCurrency.offsetParent === null || mobileCurrency.getBoundingClientRect().width === 0) : true;

        return {
          desktopNavVisible: dNavStyle !== 'none',
          mobileNavHidden: mNavStyle === 'none',
          mobileControlsHidden: mCurrencyHidden,
          desktopCurrencyVisible: desktopCurrency ? window.getComputedStyle(desktopCurrency).display !== 'none' : false,
          desktopResetVisible: desktopReset ? window.getComputedStyle(desktopReset).display !== 'none' : false,
        };
      } catch (e) {
        return { error: e.message };
      }
    })()`);

    check('Desktop TabNav is visible on desktop (1280px)', desktopChecks.desktopNavVisible);
    check('Mobile bottom nav is hidden on desktop (1280px)', desktopChecks.mobileNavHidden);
    check('Mobile Currency/Reset row is hidden on desktop (1280px)', desktopChecks.mobileControlsHidden);
    check('Desktop Currency & Reset buttons are visible on desktop (1280px)', desktopChecks.desktopCurrencyVisible && desktopChecks.desktopResetVisible);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_regression_1280px.png'));

    const passes = testResults.filter((r) => r.pass).length;
    const fails = testResults.filter((r) => !r.pass).length;

    console.log(`\n======================================================`);
    console.log(`QA SUMMARY: ${passes} PASSED, ${fails} FAILED`);
    console.log(`======================================================\n`);

    ws.close();
    edgeProc.kill();
    server.close();

    if (fails > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    try { edgeProc.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(1);
  }
});
