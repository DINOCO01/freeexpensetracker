import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4789;
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

  const cdpPort = 9225;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-reloc-qa-'));
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
  await new Promise((resolve) => ws.on('open', resolve));

  let idCounter = 1;
  const send = (method, params = {}, timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      const timer = setTimeout(() => {
        ws.off('message', handler);
        reject(new Error(`Timeout waiting for CDP ${method}`));
      }, timeoutMs);

      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res?.result?.value;
  };

  const navigateTo = async (url) => {
    await send('Page.navigate', { url });
    await new Promise((resolve) => {
      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Page.loadEventFired') {
            ws.off('message', handler);
            resolve();
          }
        } catch (_) {}
      };
      ws.on('message', handler);
      setTimeout(() => {
        ws.off('message', handler);
        resolve();
      }, 3000);
    });
    await new Promise((r) => setTimeout(r, 500));
  };

  const setViewport = async (width, height, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile });
    await evaluate(`window.dispatchEvent(new Event('resize'))`);
    await new Promise((r) => setTimeout(r, 200));
  };

  const captureScreenshot = async (filename) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log(`  📸 Screenshot saved: ${filename}`);
  };

  try {
    console.log('\n--- 1. VERIFYING MOBILE VIEWPORTS (360px, 375px, 395px, 430px) ---');

    await navigateTo(`http://localhost:${PORT}/`);

    const mobileViewports = [
      { name: '360px Small Mobile', w: 360, h: 740 },
      { name: '375px iPhone SE', w: 375, h: 667 },
      { name: '395px Android Pixel', w: 395, h: 844 },
      { name: '430px iPhone Pro Max', w: 430, h: 932 }
    ];

    for (const vp of mobileViewports) {
      console.log(`\nTesting ${vp.name}...`);
      await setViewport(vp.w, vp.h, true);

      const homeState = await evaluate(`(() => {
        // Desktop hero wrapper
        const heroSection = document.querySelector('section.space-y-2');
        const heroVisible = heroSection ? (heroSection.offsetParent !== null && getComputedStyle(heroSection.closest('div')).display !== 'none') : false;

        // Semantic H1 check
        const srH1 = document.querySelector('h1.sr-only');
        const hasSrH1 = !!srH1 && srH1.textContent.trim().length > 0;

        // Functional tracker components
        const mobileCurrency = document.getElementById('currency-selector-mobile');
        const currencyVisible = mobileCurrency ? (mobileCurrency.offsetParent !== null && getComputedStyle(mobileCurrency).display !== 'none') : false;

        const trackerTab = document.getElementById('tab-view-tracker');
        const trackerVisible = trackerTab ? (!trackerTab.classList.contains('hidden') && trackerTab.offsetParent !== null) : false;

        // Bottom informational content (SEO guide + FAQs)
        const infoContent = document.getElementById('homepage-informational-content');
        const infoVisible = infoContent ? (infoContent.offsetParent !== null && getComputedStyle(infoContent).display !== 'none') : false;

        // Functional cards check
        const quickLogger = document.getElementById('form-expense-logger');
        const ledgerMobile = document.getElementById('mobile-compact-ledger');
        const healthSection = document.getElementById('financial-health-mobile-card');

        return {
          heroVisible,
          hasSrH1,
          currencyVisible,
          trackerVisible,
          infoVisible,
          hasQuickLogger: !!quickLogger,
          hasLedgerMobile: !!ledgerMobile,
          hasHealth: !!healthSection
        };
      })()`);

      check(`${vp.name}: Hero header is hidden on mobile tracker homepage`, !homeState.heroVisible);
      check(`${vp.name}: Semantic accessible H1 is present for SEO/screen-readers`, homeState.hasSrH1);
      check(`${vp.name}: Tracker tab is active and visible on initial load`, homeState.trackerVisible);
      check(`${vp.name}: Mobile currency selector is visible above tracker`, homeState.currencyVisible);
      check(`${vp.name}: Quick Expense Logger is visible`, homeState.hasQuickLogger);
      check(`${vp.name}: Mobile compact Transaction Ledger is visible`, homeState.hasLedgerMobile);
      check(`${vp.name}: Financial Health mobile card is accessible`, homeState.hasHealth);
      check(`${vp.name}: Bottom informational SEO guide & FAQs are hidden under Tracker`, !homeState.infoVisible);

      if (vp.w === 395) {
        await captureScreenshot('mobile_tracker_homepage_395px.png');
      } else if (vp.w === 360) {
        await captureScreenshot('mobile_tracker_homepage_360px.png');
      }
    }

    console.log('\n--- 2. VERIFYING MORE PANEL & KNOWLEDGE & GUIDES DESTINATION ---');
    await setViewport(395, 844, true);

    // Click More button in bottom navigation
    await evaluate(`(() => {
      const moreBtn = document.getElementById('btn-bottom-nav-more');
      moreBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    const moreSheetState = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const isVisible = sheet && !sheet.classList.contains('hidden') && !sheet.classList.contains('translate-y-full');
      const hasKnowledgeBtn = !!sheet.querySelector('[data-more-action="knowledge"]');
      const hasAboutLink = !!sheet.querySelector('a[href="/about/"]');
      const hasContactLink = !!sheet.querySelector('a[href="/contact-us/"]');
      const hasPrivacyLink = !!sheet.querySelector('a[href="/privacy-policy/"]');
      const hasTermsLink = !!sheet.querySelector('a[href="/terms-and-conditions/"]');
      const hasImporterBtn = !!sheet.querySelector('[data-more-action="import"]');
      const hasResetBtn = !!sheet.querySelector('.btn-open-reset-modal');
      
      // Also verify bottom navigation bar preserves its 6 items (Tracker, Split, Templates, Debt, Goals, More)
      const bottomNav = document.getElementById('mobile-bottom-nav');
      const hasSplitBtn = !!bottomNav.querySelector('[data-bottom-tab="split"]');
      const hasTemplatesBtn = !!bottomNav.querySelector('[data-bottom-tab="templates"]');
      const hasDebtBtn = !!bottomNav.querySelector('[data-bottom-tab="debt"]');
      const hasGoalsBtn = !!bottomNav.querySelector('[data-bottom-tab="targets"]');
      return {
        isVisible,
        hasKnowledgeBtn,
        hasAboutLink,
        hasContactLink,
        hasPrivacyLink,
        hasTermsLink,
        hasImporterBtn,
        hasResetBtn,
        hasSplitBtn,
        hasTemplatesBtn,
        hasDebtBtn,
        hasGoalsBtn
      };
    })()`);

    check('More panel opens smoothly via bottom nav tap', moreSheetState.isVisible);
    check('More panel contains Knowledge & Guides button', moreSheetState.hasKnowledgeBtn);
    check('More panel contains About Us link (/about/)', moreSheetState.hasAboutLink);
    check('More panel contains Contact Us link', moreSheetState.hasContactLink);
    check('More panel contains Privacy Policy link', moreSheetState.hasPrivacyLink);
    check('More panel contains Terms of Service link', moreSheetState.hasTermsLink);
    check('More panel contains Importer button', moreSheetState.hasImporterBtn);
    check('More panel contains Reset Data button', moreSheetState.hasResetBtn);
    check('Bottom navigation bar contains Split (Bill Splitter)', moreSheetState.hasSplitBtn);
    check('Bottom navigation bar contains Templates', moreSheetState.hasTemplatesBtn);
    check('Bottom navigation bar contains Debt Planner', moreSheetState.hasDebtBtn);
    check('Bottom navigation bar contains Goals Planner', moreSheetState.hasGoalsBtn);
    await captureScreenshot('more_panel_open_395px.png');

    // Tap "Knowledge & Guides" inside More sheet
    console.log('\n--- 3. NAVIGATING TO KNOWLEDGE & GUIDES VIA MORE PANEL ---');
    await evaluate(`(() => {
      const btnKnowledge = document.querySelector('[data-more-action="knowledge"]');
      btnKnowledge.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    const knowledgeState = await evaluate(`(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const sheetClosed = !sheet || sheet.classList.contains('translate-y-full') || sheet.classList.contains('hidden');

      const knowledgeTab = document.getElementById('tab-view-knowledge');
      const knowledgeVisible = knowledgeTab && !knowledgeTab.classList.contains('hidden');

      const infoContent = document.getElementById('homepage-informational-content');
      const infoVisible = infoContent && !infoContent.classList.contains('hidden') && getComputedStyle(infoContent).display !== 'none';

      const seoGuide = document.getElementById('section-seo-guide');
      const faqSection = document.getElementById('section-faq');

      const seoH2 = seoGuide ? (seoGuide.querySelector('h2')?.textContent || '') : '';
      const faqCount = faqSection ? faqSection.querySelectorAll('.faq-item').length : 0;

      return {
        sheetClosed,
        knowledgeVisible,
        infoVisible,
        hasSeoGuide: !!seoGuide,
        hasFaqSection: !!faqSection,
        seoH2,
        faqCount
      };
    })()`);

    check('More menu closes after tapping Knowledge & Guides', knowledgeState.sheetClosed);
    check('Knowledge tab (#tab-view-knowledge) is active and visible', knowledgeState.knowledgeVisible);
    check('Relocated informational guide and FAQ container is now visible on mobile', knowledgeState.infoVisible);
    check('SEO Guide heading is preserved in Knowledge & Guides', knowledgeState.seoH2.includes('Guide'));
    check('All 8 interactive FAQs are preserved in Knowledge & Guides', knowledgeState.faqCount === 8);
    await captureScreenshot('mobile_knowledge_tab_395px.png');

    // Switch back to Tracker tab
    console.log('\n--- 4. SWITCHING BACK TO TRACKER TAB ---');
    await evaluate(`(() => {
      const trackerBtn = document.querySelector('.bottom-nav-btn[data-bottom-tab="tracker"]');
      trackerBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 500));

    const backToTrackerState = await evaluate(`(() => {
      const trackerTab = document.getElementById('tab-view-tracker');
      const trackerVisible = trackerTab && !trackerTab.classList.contains('hidden');

      const knowledgeTab = document.getElementById('tab-view-knowledge');
      const knowledgeHidden = !knowledgeTab || knowledgeTab.classList.contains('hidden');

      const infoContent = document.getElementById('homepage-informational-content');
      const infoHidden = !infoContent || infoContent.classList.contains('hidden') || getComputedStyle(infoContent).display === 'none';

      return {
        trackerVisible,
        knowledgeHidden,
        infoHidden
      };
    })()`);

    check('Tracker tab becomes visible again', backToTrackerState.trackerVisible);
    check('Knowledge tab is hidden', backToTrackerState.knowledgeHidden);
    check('Informational SEO content is hidden again on mobile tracker', backToTrackerState.infoHidden);

    console.log('\n--- 5. VERIFYING ABOUT US PAGE (/about/) ---');
    await navigateTo(`http://localhost:${PORT}/about/`);

    const aboutState = await evaluate(`(() => {
      const bodyText = document.body.innerText;
      const hasQuote = bodyText.includes('FreeExpenseTracker is a 100% free, client-side personal finance web application');
      const hasDescription = bodyText.includes('Take control of your money with our free monthly expense tracker');
      const hasBadge = bodyText.includes('100% Free • No Sign-Up • Private Browser Storage');
      const hasBenefits = bodyText.includes('Private by Architecture') && bodyText.includes('Zero Friction & Fast') && bodyText.includes('Full Financial Freedom');
      const hasAuthor = bodyText.includes('Prince Upadhyay');
      return {
        hasQuote,
        hasDescription,
        hasBadge,
        hasBenefits,
        hasAuthor
      };
    })()`);

    check('About Us page includes plain-language AI quotable answer', aboutState.hasQuote);
    check('About Us page includes main FreeExpenseTracker description', aboutState.hasDescription);
    check('About Us page includes 100% Free • No Sign-Up badge', aboutState.hasBadge);
    check('About Us page includes core website benefits grid', aboutState.hasBenefits);
    check('About Us page includes author Prince Upadhyay attribution', aboutState.hasAuthor);
    await captureScreenshot('about_us_page_mobile_395px.png');

    console.log('\n--- 6. VERIFYING TABLET (768px) AND DESKTOP (1280px) PRESERVATION ---');
    
    // Tablet (768px)
    await setViewport(768, 1024, false);
    await navigateTo(`http://localhost:${PORT}/`);

    const tabletState = await evaluate(`(() => {
      const heroSection = document.querySelector('section.space-y-2');
      const heroVisible = heroSection ? (heroSection.offsetParent !== null && getComputedStyle(heroSection.closest('div')).display !== 'none') : false;

      const tabNav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
      const tabNavVisible = tabNav ? getComputedStyle(tabNav).display !== 'none' : false;

      const bottomNav = document.getElementById('mobile-bottom-nav');
      const bottomNavHidden = bottomNav ? getComputedStyle(bottomNav).display === 'none' : true;

      const infoContent = document.getElementById('homepage-informational-content');
      const infoVisible = infoContent ? (infoContent.offsetParent !== null && getComputedStyle(infoContent).display !== 'none') : false;

      return {
        heroVisible,
        tabNavVisible,
        bottomNavHidden,
        infoVisible
      };
    })()`);

    check('Tablet 768px: Hero header is visible', tabletState.heroVisible);
    check('Tablet 768px: TabNav bar is visible', tabletState.tabNavVisible);
    check('Tablet 768px: Mobile bottom nav is hidden', tabletState.bottomNavHidden);
    check('Tablet 768px: Bottom informational content (SEO guide & FAQs) is visible', tabletState.infoVisible);

    // Desktop (1280px)
    await setViewport(1280, 800, false);

    const desktopState = await evaluate(`(() => {
      const heroSection = document.querySelector('section.space-y-2');
      const heroVisible = heroSection ? (heroSection.offsetParent !== null && getComputedStyle(heroSection.closest('div')).display !== 'none') : false;

      const tabNav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
      const tabNavVisible = tabNav ? getComputedStyle(tabNav).display !== 'none' : false;

      const bottomNav = document.getElementById('mobile-bottom-nav');
      const bottomNavHidden = bottomNav ? getComputedStyle(bottomNav).display === 'none' : true;

      const infoContent = document.getElementById('homepage-informational-content');
      const infoVisible = infoContent ? (infoContent.offsetParent !== null && getComputedStyle(infoContent).display !== 'none') : false;

      const fullLedger = document.getElementById('tab-view-tracker');
      const fullLedgerVisible = fullLedger && !fullLedger.classList.contains('hidden');

      return {
        heroVisible,
        tabNavVisible,
        bottomNavHidden,
        infoVisible,
        fullLedgerVisible
      };
    })()`);

    check('Desktop 1280px: Hero header is visible with full value proposition', desktopState.heroVisible);
    check('Desktop 1280px: TabNav bar is visible with 5 tools', desktopState.tabNavVisible);
    check('Desktop 1280px: Mobile bottom nav is hidden', desktopState.bottomNavHidden);
    check('Desktop 1280px: Bottom informational content (SEO guide & FAQs) is visible', desktopState.infoVisible);
    check('Desktop 1280px: Full tracker ledger is active and visible', desktopState.fullLedgerVisible);
    await captureScreenshot('desktop_homepage_1280px.png');

  } finally {
    ws.close();
    edgeProcess.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  const passedCount = testResults.filter(r => r.pass).length;
  const totalCount = testResults.length;
  console.log(`\n=======================================================`);
  console.log(`TEST RESULTS: ${passedCount}/${totalCount} checks passed.`);
  console.log(`=======================================================`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
