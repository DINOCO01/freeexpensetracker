import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';
const BASE_URL = 'http://localhost:4321';

async function runTests() {
  console.log('🚀 Starting Comprehensive Mobile Homepage UI Redesign QA...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Multi-viewport testing (320, 360, 375, 390, 412, 430)
    const mobileViewports = [
      { name: '320px', width: 320, height: 650 },
      { name: '360px', width: 360, height: 740 },
      { name: '375px', width: 375, height: 812 },
      { name: '390px', width: 390, height: 844 },
      { name: '412px', width: 412, height: 915 },
      { name: '430px', width: 430, height: 932 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert(!overflow, `No horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`);

      // Check mobile bottom nav visible
      const bottomNavVisible = await page.evaluate(() => {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return false;
        const style = window.getComputedStyle(nav);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      assert(bottomNavVisible, `Mobile bottom nav visible at ${vp.name}`);

      // Check desktop TabNav hidden
      const desktopNavHidden = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
        if (!nav) return true;
        const style = window.getComputedStyle(nav);
        return style.display === 'none';
      });
      assert(desktopNavHidden, `Desktop TabNav hidden at ${vp.name}`);

      // Take screenshot
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `mobile_redesign_${vp.width}px.png`),
        fullPage: false
      });
    }

    // Use 390px as primary mobile test viewport
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    console.log('\n--- Testing Mobile Header ---');
    const headerInfo = await page.evaluate(() => {
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
    });
    assert(headerInfo.brand && headerInfo.lang && headerInfo.theme && headerInfo.import, 'Header contains brand logo/name, language selector, theme toggle, and import button');

    console.log('\n--- Testing Mobile Currency & Reset Controls ---');
    const controlsInfo = await page.evaluate(() => {
      const mobileCurrency = document.getElementById('currency-selector-mobile');
      const mobileReset = document.querySelector('#tab-view-tracker .btn-open-reset-modal');
      return {
        currencyExists: !!mobileCurrency,
        resetExists: !!mobileReset,
        currencyVisible: mobileCurrency ? window.getComputedStyle(mobileCurrency).display !== 'none' : false,
        resetVisible: mobileReset ? window.getComputedStyle(mobileReset).display !== 'none' : false,
      };
    });
    assert(controlsInfo.currencyExists && controlsInfo.currencyVisible, 'Dedicated mobile Currency selector exists and is visible');
    assert(controlsInfo.resetExists && controlsInfo.resetVisible, 'Dedicated mobile Reset button exists and is visible');

    // Test Currency switch functionality
    await page.select('#currency-selector-mobile', 'EUR');
    await page.waitForTimeout(300);
    const currencyUpdated = await page.evaluate(() => {
      const normalized = document.getElementById('income-normalized-amount')?.textContent || '';
      return normalized.includes('€');
    });
    assert(currencyUpdated, 'Selecting EUR in mobile currency selector formats amounts with €');

    // Test Mobile Reset Button triggers modal
    await page.click('#tab-view-tracker .btn-open-reset-modal');
    await page.waitForTimeout(200);
    const resetModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('reset-confirm-modal');
      return modal && !modal.classList.contains('hidden');
    });
    assert(resetModalVisible, 'Clicking mobile Reset button opens Reset Confirmation Modal');

    // Close reset modal
    await page.click('#btn-cancel-reset');
    await page.waitForTimeout(200);

    console.log('\n--- Testing Financial Health Card & Collapsible Breakdown ---');
    const healthInfo = await page.evaluate(() => {
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
    });
    assert(healthInfo.score && healthInfo.tierVisible && healthInfo.dialStroke, 'Financial Health Card shows score number, tier badge and radial dial');
    assert(healthInfo.savingsLabel && healthInfo.fixedLabel && healthInfo.bufferLabel, 'Financial Health Card shows 3 metric pills with score points');
    assert(healthInfo.isCollapsedInitially, 'Health details breakdown is collapsed by default on mobile');
    assert(healthInfo.toggleBtnVisible, 'Health details toggle accordion button is visible on mobile');

    // Test expanding accordion
    await page.click('#btn-toggle-health-details');
    await page.waitForTimeout(200);
    const isExpanded = await page.evaluate(() => {
      const detailsContent = document.getElementById('health-details-content');
      const chevron = document.getElementById('health-details-chevron');
      return !detailsContent?.classList.contains('hidden') && chevron?.classList.contains('rotate-180');
    });
    assert(isExpanded, 'Clicking accordion button expands score breakdown, progress bars and recommendations');

    // Test collapsing accordion back
    await page.click('#btn-toggle-health-details');
    await page.waitForTimeout(200);
    const isCollapsedAgain = await page.evaluate(() => {
      const detailsContent = document.getElementById('health-details-content');
      return detailsContent?.classList.contains('hidden');
    });
    assert(isCollapsedAgain, 'Clicking accordion button again collapses details breakdown');

    console.log('\n--- Testing Fixed Bottom Liquid Glass Navigation (6 Items) ---');
    const bottomNavItems = await page.evaluate(() => {
      const nav = document.getElementById('mobile-bottom-nav');
      if (!nav) return [];
      const items = Array.from(nav.querySelectorAll('.bottom-nav-btn'));
      return items.map((el) => ({
        tag: el.tagName.toLowerCase(),
        tab: el.getAttribute('data-bottom-tab'),
        href: el.getAttribute('href') || null,
        text: el.querySelector('span')?.textContent?.trim()
      }));
    });

    assert(bottomNavItems.length === 6, `Bottom nav has exactly 6 items (found ${bottomNavItems.length})`);
    assert(bottomNavItems[0]?.tab === 'tracker' && bottomNavItems[0]?.text === 'Tracker', 'Item 1 is Tracker');
    assert(bottomNavItems[1]?.tab === 'split' && bottomNavItems[1]?.href === '/bill-splitter/', 'Item 2 is Split linking to /bill-splitter/');
    assert(bottomNavItems[2]?.tab === 'templates' && bottomNavItems[2]?.text === 'Templates', 'Item 3 is Templates');
    assert(bottomNavItems[3]?.tab === 'debt' && bottomNavItems[3]?.text === 'Debt', 'Item 4 is Debt');
    assert(bottomNavItems[4]?.tab === 'targets' && bottomNavItems[4]?.text === 'Goals', 'Item 5 is Goals');
    assert(bottomNavItems[5]?.tab === 'more' && bottomNavItems[5]?.text === 'More', 'Item 6 is More');

    // Test Tab Switching & Pill Movement:
    // Tab 2: Templates
    await page.click('button[data-bottom-tab="templates"]');
    await page.waitForTimeout(300);
    const templatesActive = await page.evaluate(() => {
      const templatesView = document.getElementById('tab-view-templates');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !templatesView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    });
    assert(templatesActive.viewVisible, 'Clicking Templates bottom tab switches to Templates view');
    assert(templatesActive.pillLeft.includes('2 *'), `Active pill moved to Templates column (index 2: ${templatesActive.pillLeft})`);

    // Tab 3: Debt
    await page.click('button[data-bottom-tab="debt"]');
    await page.waitForTimeout(300);
    const debtActive = await page.evaluate(() => {
      const debtView = document.getElementById('tab-view-debt');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !debtView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    });
    assert(debtActive.viewVisible, 'Clicking Debt bottom tab switches to Debt Planner view');
    assert(debtActive.pillLeft.includes('3 *'), `Active pill moved to Debt column (index 3: ${debtActive.pillLeft})`);

    // Tab 4: Goals
    await page.click('button[data-bottom-tab="targets"]');
    await page.waitForTimeout(300);
    const targetsActive = await page.evaluate(() => {
      const targetsView = document.getElementById('tab-view-targets');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !targetsView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    });
    assert(targetsActive.viewVisible, 'Clicking Goals bottom tab switches to Budget & Goals view');
    assert(targetsActive.pillLeft.includes('4 *'), `Active pill moved to Goals column (index 4: ${targetsActive.pillLeft})`);

    // Return to Tracker
    await page.click('button[data-bottom-tab="tracker"]');
    await page.waitForTimeout(300);
    const trackerActive = await page.evaluate(() => {
      const trackerView = document.getElementById('tab-view-tracker');
      const pill = document.getElementById('bottom-nav-active-pill');
      return {
        viewVisible: !trackerView?.classList.contains('hidden'),
        pillLeft: pill?.style.left
      };
    });
    assert(trackerActive.viewVisible, 'Clicking Tracker bottom tab returns to Tracker view');
    assert(trackerActive.pillLeft.includes('0 *'), `Active pill moved to Tracker column (index 0: ${trackerActive.pillLeft})`);

    console.log('\n--- Testing More Menu Bottom Sheet ---');
    await page.click('#btn-bottom-nav-more');
    await page.waitForTimeout(300);

    const sheetOpen = await page.evaluate(() => {
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
    });
    assert(sheetOpen.sheetVisible && sheetOpen.backdropVisible, 'Clicking More opens bottom sheet overlay');
    assert(sheetOpen.hasKnowledge && sheetOpen.hasImport && sheetOpen.hasTemplates && sheetOpen.hasSplitter && sheetOpen.hasReset, 'More sheet contains Knowledge & Guides, Importer, Templates, Bill Splitter, and Reset button');

    // Take screenshot of open More sheet
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'mobile_more_sheet_390px.png'),
      fullPage: false
    });

    // Test Clicking Knowledge & Guides inside More sheet
    await page.click('[data-more-action="knowledge"]');
    await page.waitForTimeout(350);

    const knowledgeSwitched = await page.evaluate(() => {
      const sheet = document.getElementById('more-menu-sheet');
      const knowledgeView = document.getElementById('tab-view-knowledge');
      return {
        sheetClosed: sheet?.classList.contains('translate-y-full'),
        knowledgeVisible: !knowledgeView?.classList.contains('hidden')
      };
    });
    assert(knowledgeSwitched.sheetClosed, 'Clicking Knowledge in More sheet closes the bottom sheet');
    assert(knowledgeSwitched.knowledgeVisible, 'Clicking Knowledge in More sheet switches to Knowledge & Guides tab view');

    console.log('\n--- Testing Buy Me a Coffee Clearance ---');
    // Return to Tracker
    await page.click('button[data-bottom-tab="tracker"]');
    await page.waitForTimeout(300);

    const bmcClearance = await page.evaluate(() => {
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
    });
    assert(bmcClearance.ok, `BMC widget floats above bottom navigation bar (BMC bottom: ${bmcClearance.bmcBottom}px, Nav top: ${bmcClearance.navTop}px)`);

    console.log('\n--- Testing Desktop Regression (1280px Viewport) ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    const desktopChecks = await page.evaluate(() => {
      const desktopNav = document.querySelector('nav[aria-label="Main Navigation Tabs"]');
      const mobileNav = document.getElementById('mobile-bottom-nav');
      const mobileControls = document.querySelector('#tab-view-tracker .sm\\:hidden');
      const desktopCurrency = document.getElementById('currency-selector');
      const desktopReset = document.getElementById('btn-open-reset-modal');

      const dNavStyle = desktopNav ? window.getComputedStyle(desktopNav).display : 'none';
      const mNavStyle = mobileNav ? window.getComputedStyle(mobileNav).display : 'none';
      const mControlsStyle = mobileControls ? window.getComputedStyle(mobileControls).display : 'none';

      return {
        desktopNavVisible: dNavStyle !== 'none',
        mobileNavHidden: mNavStyle === 'none',
        mobileControlsHidden: mControlsStyle === 'none',
        desktopCurrencyVisible: desktopCurrency ? window.getComputedStyle(desktopCurrency).display !== 'none' : false,
        desktopResetVisible: desktopReset ? window.getComputedStyle(desktopReset).display !== 'none' : false,
      };
    });

    assert(desktopChecks.desktopNavVisible, 'Desktop TabNav is visible on desktop (1280px)');
    assert(desktopChecks.mobileNavHidden, 'Mobile bottom nav is hidden on desktop (1280px)');
    assert(desktopChecks.mobileControlsHidden, 'Mobile Currency/Reset row is hidden on desktop (1280px)');
    assert(desktopChecks.desktopCurrencyVisible && desktopChecks.desktopResetVisible, 'Desktop Currency & Reset buttons are visible on desktop (1280px)');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'desktop_regression_1280px.png'),
      fullPage: false
    });

    console.log(`\n===========================================`);
    console.log(`QA Results: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`===========================================`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
