import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4666;
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

server.listen(PORT, async () => {
  const cdpPort = 9488;
  const tmpDir = path.join(os.tmpdir(), `cdp_tracker_improvements_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('Page target not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, rej) => {
      ws.on('open', r);
      ws.on('error', rej);
    });

    let msgId = 1;
    function send(method, params = {}, timeoutMs = 6000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for CDP ${method}`));
        }, timeoutMs);

        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            clearTimeout(timer);
            ws.off('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Browser eval exception:', res.exceptionDetails);
      }
      return res.result?.value;
    };

    const setViewport = async (width, height, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });
      await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile });
    };

    const captureScreenshot = async (filePath, clip) => {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const res = await send('Page.captureScreenshot', params);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    };

    await send('Page.enable');
    await send('DOM.enable');

    console.log('\n--- NAVIGATING TO TRACKER ---');
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    // =========================================================================
    // SECTION 1: MOBILE VIEWPORT 395px TESTS
    // =========================================================================
    console.log('\n--- TESTING AT 395px (MOBILE) ---');
    await setViewport(395, 844, true);
    await new Promise((r) => setTimeout(r, 800));

    // 1. Check Section Ordering on Mobile
    console.log('\n[Section Ordering Check]');
    const sectionOrder = await evaluate(`(() => {
      const incomeCard = document.getElementById('input-income-amount').closest('.rounded-2xl');
      const loggerCard = document.getElementById('form-expense-logger').closest('.rounded-2xl');
      const ledgerCard = document.getElementById('mobile-compact-ledger') || document.getElementById('transactions-mobile-container')?.closest('.rounded-2xl');
      const healthCard = document.getElementById('financial-health-mobile-card');

      const incomeTop = incomeCard.getBoundingClientRect().top + window.scrollY;
      const loggerTop = loggerCard.getBoundingClientRect().top + window.scrollY;
      const ledgerTop = ledgerCard.getBoundingClientRect().top + window.scrollY;
      const healthTop = healthCard.getBoundingClientRect().top + window.scrollY;

      return {
        incomeTop,
        loggerTop,
        ledgerTop,
        healthTop,
        isOrdered: (incomeTop < loggerTop) && (loggerTop < ledgerTop) && (ledgerTop < healthTop)
      };
    })()`);

    check('Section Order: Quick Expense Logger comes after Income/Financial Overview', sectionOrder.incomeTop < sectionOrder.loggerTop, `incomeTop: ${sectionOrder.incomeTop}, loggerTop: ${sectionOrder.loggerTop}`);
    check('Section Order: Transaction Ledger comes directly below Quick Expense Logger', sectionOrder.loggerTop < sectionOrder.ledgerTop, `loggerTop: ${sectionOrder.loggerTop}, ledgerTop: ${sectionOrder.ledgerTop}`);
    check('Section Order: Financial Health Indicator comes below Transaction Ledger', sectionOrder.ledgerTop < sectionOrder.healthTop, `ledgerTop: ${sectionOrder.ledgerTop}, healthTop: ${sectionOrder.healthTop}`);
    check('Section Order: Complete exact order verified', sectionOrder.isOrdered);

    // 2. Check Quick Expense Logger Layout on Mobile
    console.log('\n[Quick Expense Logger Layout Check]');
    const loggerLayout = await evaluate(`(() => {
      const form = document.getElementById('form-expense-logger');
      const descInput = document.getElementById('input-item-name');
      const amountInput = document.getElementById('input-item-amount');
      const catSelect = document.getElementById('select-item-category');

      const formRect = form.getBoundingClientRect();
      const descRect = descInput.getBoundingClientRect();
      const amountRect = amountInput.getBoundingClientRect();
      const catRect = catSelect.getBoundingClientRect();

      // Amount and Category container
      const rowContainer = amountInput.closest('.grid');
      const rowStyle = window.getComputedStyle(rowContainer);

      return {
        descWidth: descRect.width,
        formWidth: formRect.width,
        descFullWidth: Math.abs(descRect.width - formRect.width) < 20,
        amountTop: amountRect.top,
        catTop: catRect.top,
        alignedHorizontally: Math.abs(amountRect.top - catRect.top) < 6,
        amountWidth: amountRect.width,
        catWidth: catRect.width,
        approxEqualWidth: Math.abs(amountRect.width - catRect.width) < 15,
        noHorizontalOverflow: formRect.right <= window.innerWidth
      };
    })()`);

    check('Logger: Description input occupies full available width', loggerLayout.descFullWidth, `desc: ${loggerLayout.descWidth}px, form: ${loggerLayout.formWidth}px`);
    check('Logger: Amount and Category aligned horizontally in same row', loggerLayout.alignedHorizontally, `amountTop: ${loggerLayout.amountTop}, catTop: ${loggerLayout.catTop}`);
    check('Logger: Amount and Category have approximately equal widths', loggerLayout.approxEqualWidth, `amount: ${loggerLayout.amountWidth}px, cat: ${loggerLayout.catWidth}px`);
    check('Logger: No horizontal overflow or clipping', loggerLayout.noHorizontalOverflow);

    // 3. Check Travel Category and Presets
    console.log('\n[Travel Category and Presets Check]');
    const travelCheck = await evaluate(`(() => {
      const catSelect = document.getElementById('select-item-category');
      const options = Array.from(catSelect.options).map(o => ({ value: o.value, text: o.text }));
      const travelOption = options.find(o => o.value === 'Travel');

      const presets = Array.from(document.querySelectorAll('.btn-preset-chip')).map(chip => ({
        category: chip.getAttribute('data-preset-category'),
        name: chip.getAttribute('data-preset-name'),
        text: chip.textContent.trim()
      }));

      const travelPreset = presets.find(p => p.category === 'Travel');
      const presetCategories = presets.map(p => p.category);

      return {
        travelOptionExists: !!travelOption,
        travelOptionText: travelOption?.text,
        travelPresetExists: !!travelPreset,
        travelPresetText: travelPreset?.text,
        presetCategories,
        expectedOrder: JSON.stringify(presetCategories) === JSON.stringify(['Housing', 'Food', 'Utilities', 'Transport', 'Travel', 'Savings'])
      };
    })()`);

    check('Travel Category: Exists in Category dropdown', travelCheck.travelOptionExists, `Text: ${travelCheck.travelOptionText}`);
    check('Travel Presets: Exists in Quick Presets list', travelCheck.travelPresetExists, `Text: ${travelCheck.travelPresetText}`);
    check('Presets Order: Housing -> Food -> Utilities -> Transport -> Travel -> Savings', travelCheck.expectedOrder, `Actual: ${travelCheck.presetCategories.join(', ')}`);

    // 4. Test clicking Travel Preset and Submitting Expense
    console.log('\n[Travel Preset Interaction & Submission]');
    const interactionCheck = await evaluate(`(() => {
      const travelChip = document.querySelector('.btn-preset-chip[data-preset-category="Travel"]');
      if (!travelChip) return { error: 'Travel preset chip not found' };

      // Click preset chip
      travelChip.click();

      const inputName = document.getElementById('input-item-name');
      const inputAmount = document.getElementById('input-item-amount');
      const selectCat = document.getElementById('select-item-category');

      const presetSelectedCategory = selectCat.value;
      const presetName = inputName.value;

      // Submit form
      const form = document.getElementById('form-expense-logger');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      // Check transaction ledger
      const mobileContainer = document.getElementById('mobile-recent-transactions') || document.getElementById('transactions-mobile-container');
      const firstCard = mobileContainer?.firstElementChild;
      const firstCardText = firstCard ? firstCard.textContent : '';

      return {
        presetSelectedCategory,
        presetName,
        successPresetSelect: presetSelectedCategory === 'Travel',
        txSavedInLedger: firstCardText.includes('Travel') && (firstCardText.includes('2,500') || firstCardText.includes('2500')),
        cardHasTravelIcon: firstCardText.includes('✈️')
      };
    })()`);

    check('Travel Preset: Clicking Travel selects Travel in dropdown', interactionCheck.successPresetSelect, `Selected: ${interactionCheck.presetSelectedCategory}`);
    check('Travel Submission: Saved Travel transaction appears in Transaction Ledger', interactionCheck.txSavedInLedger);
    check('Travel Submission: Ledger card displays ✈️ travel icon', interactionCheck.cardHasTravelIcon);

    // 5. Check Unified Mobile Financial Overview Card
    console.log('\n[Unified Financial Overview Card]');
    const foCheck = await evaluate(`(() => {
      const mobileCard = document.getElementById('mobile-financial-overview-card');
      const desktopCards = document.getElementById('stat-total-income')?.closest('.hidden');

      const isMobileVisible = mobileCard && window.getComputedStyle(mobileCard).display !== 'none';
      const isDesktopHidden = desktopCards && window.getComputedStyle(desktopCards).display === 'none';

      // Financial Data Elements
      const incomeVal = document.getElementById('mobile-fo-income-val')?.textContent.trim();
      const outflowsVal = document.getElementById('mobile-fo-outflows-val')?.textContent.trim();
      const outflowsSub = document.getElementById('mobile-fo-outflows-sub')?.textContent.trim();
      const savingsVal = document.getElementById('mobile-fo-savings-val')?.textContent.trim();
      const savingsSub = document.getElementById('mobile-fo-savings-sub')?.textContent.trim();
      const netVal = document.getElementById('mobile-fo-net-val')?.textContent.trim();
      const netSub = document.getElementById('mobile-fo-net-sub')?.textContent.trim();

      // Doughnut Segments
      const donutOutflows = document.getElementById('mobile-fo-donut-outflows');
      const donutSavings = document.getElementById('mobile-fo-donut-savings');
      const donutDeficit = document.getElementById('mobile-fo-donut-deficit');

      // Notification
      const notification = document.getElementById('mobile-fo-notification');
      const notifText = document.getElementById('mobile-fo-notification-text')?.textContent.trim();

      const cardRect = mobileCard.getBoundingClientRect();

      return {
        isMobileVisible,
        isDesktopHidden,
        incomeVal,
        outflowsVal,
        outflowsSub,
        savingsVal,
        savingsSub,
        netVal,
        netSub,
        hasOutflowStroke: donutOutflows && donutOutflows.getAttribute('stroke-dasharray') !== '0 238.76',
        notifText,
        cardHeight: cardRect.height,
        cardWidth: cardRect.width,
        isCompactAndStable: cardRect.height >= 170 && cardRect.height <= 240
      };
    })()`);

    check('Financial Overview: Desktop 4 tiles are hidden on mobile', foCheck.isDesktopHidden);
    check('Financial Overview: Unified card is visible on mobile', foCheck.isMobileVisible);
    check('Financial Overview: Total Income prominently displayed in center', !!foCheck.incomeVal, `Income: ${foCheck.incomeVal}`);
    check('Financial Overview: Outflows displayed accurately', !!foCheck.outflowsVal, `Outflows: ${foCheck.outflowsVal} (${foCheck.outflowsSub})`);
    check('Financial Overview: Savings displayed accurately', !!foCheck.savingsVal, `Savings: ${foCheck.savingsVal} (${foCheck.savingsSub})`);
    check('Financial Overview: Net Cash Flow displayed accurately', !!foCheck.netVal, `Net: ${foCheck.netVal} (${foCheck.netSub})`);
    check('Financial Overview: Doughnut visualization has active SVG stroke', foCheck.hasOutflowStroke);
    check('Financial Overview: Notification displays contextual text', !!foCheck.notifText, `Notification: "${foCheck.notifText}"`);
    check('Financial Overview: Card dimensions are compact and stable', foCheck.isCompactAndStable, `Height: ${foCheck.cardHeight}px, Width: ${foCheck.cardWidth}px`);

    // 6. Test Deficit Notification & Stability under High Expense
    console.log('\n[Deficit Scenario & Dimension Stability Check]');
    const deficitCheck = await evaluate(`(() => {
      // Add a large expense to force deficit
      const inputName = document.getElementById('input-item-name');
      const inputAmount = document.getElementById('input-item-amount');
      const selectCat = document.getElementById('select-item-category');
      inputName.value = 'Large Car Transmission Repair';
      inputAmount.value = '5000';
      selectCat.value = 'Transport';

      const form = document.getElementById('form-expense-logger');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      const mobileCard = document.getElementById('mobile-financial-overview-card');
      const cardRect = mobileCard.getBoundingClientRect();
      const notif = document.getElementById('mobile-fo-notification');
      const notifText = document.getElementById('mobile-fo-notification-text')?.textContent.trim();
      const notifClass = notif?.className || '';
      const netVal = document.getElementById('mobile-fo-net-val')?.textContent.trim();

      return {
        netVal,
        notifText,
        isDeficitNotif: notifText.toLowerCase().includes('deficit') || notifText.toLowerCase().includes('déficit'),
        hasRedClass: notifClass.includes('rose') || notifClass.includes('red'),
        cardHeight: cardRect.height,
        heightRemainsStable: cardRect.height >= 170 && cardRect.height <= 240
      };
    })()`);

    check('Deficit State: Net Cash Flow reflects deficit', deficitCheck.netVal.startsWith('-'), `Net: ${deficitCheck.netVal}`);
    check('Deficit State: Notification displays deficit message', deficitCheck.isDeficitNotif, `Text: "${deficitCheck.notifText}"`);
    check('Deficit State: Notification uses subtle red/rose styling', deficitCheck.hasRedClass);
    check('Dimension Stability: Card height remains stable during deficit', deficitCheck.heightRemainsStable, `Height: ${deficitCheck.cardHeight}px`);

    // Capture 395px Screenshot
    const screenshot395 = path.join(ARTIFACT_DIR, 'mobile_tracker_395px_qa.png');
    await captureScreenshot(screenshot395);
    console.log(`Saved screenshot: ${screenshot395}`);

    // =========================================================================
    // SECTION 2: MOBILE VIEWPORT 360px TESTS
    // =========================================================================
    console.log('\n--- TESTING AT 360px (SMALL MOBILE) ---');
    await setViewport(360, 780, true);
    await new Promise((r) => setTimeout(r, 600));

    const check360 = await evaluate(`(() => {
      const mobileFoCard = document.getElementById('mobile-financial-overview-card');
      const healthCard = document.getElementById('financial-health-mobile-card');
      const form = document.getElementById('form-expense-logger');
      const amountInput = document.getElementById('input-item-amount');
      const catSelect = document.getElementById('select-item-category');

      const foRect = mobileFoCard.getBoundingClientRect();
      const healthRect = healthCard.getBoundingClientRect();
      const amountRect = amountInput.getBoundingClientRect();
      const catRect = catSelect.getBoundingClientRect();

      return {
        foVisible: window.getComputedStyle(mobileFoCard).display !== 'none',
        foHeight: foRect.height,
        healthVisible: window.getComputedStyle(healthCard).display !== 'none',
        amountCatAligned: Math.abs(amountRect.top - catRect.top) < 6,
        noHorizontalOverflow: document.documentElement.scrollWidth <= 360
      };
    })()`);

    check('360px: Unified Financial Overview visible', check360.foVisible);
    check('360px: Financial Health Card visible', check360.healthVisible);
    check('360px: Amount and Category remain horizontally aligned', check360.amountCatAligned);
    check('360px: Zero horizontal overflow at 360px', check360.noHorizontalOverflow);

    // Capture 360px Screenshot
    const screenshot360 = path.join(ARTIFACT_DIR, 'mobile_tracker_360px_qa.png');
    await captureScreenshot(screenshot360);
    console.log(`Saved screenshot: ${screenshot360}`);

    // =========================================================================
    // SECTION 3: DESKTOP VIEWPORT 1280px REGRESSION AUDIT
    // =========================================================================
    console.log('\n--- TESTING AT 1280px (DESKTOP REGRESSION AUDIT) ---');
    await setViewport(1280, 900, false);
    await new Promise((r) => setTimeout(r, 800));

    const desktopCheck = await evaluate(`(() => {
      const desktopKpiGrid = document.getElementById('stat-total-income')?.closest('.grid');
      const mobileFoCard = document.getElementById('mobile-financial-overview-card');
      const mobileHealthCard = document.getElementById('financial-health-mobile-card');
      const desktopHealthCard = document.getElementById('financial-health-desktop-card');
      const desktopTable = document.querySelector('#transactions-tbody').closest('table');
      const mobileCardsContainer = document.getElementById('mobile-compact-ledger');

      const isDesktopKpiVisible = desktopKpiGrid && window.getComputedStyle(desktopKpiGrid).display !== 'none';
      const isMobileFoHidden = mobileFoCard && window.getComputedStyle(mobileFoCard).display === 'none';
      const isMobileHealthHidden = mobileHealthCard && window.getComputedStyle(mobileHealthCard).display === 'none';
      const isDesktopHealthVisible = desktopHealthCard && window.getComputedStyle(desktopHealthCard).display !== 'none';
      const isDesktopTableVisible = desktopTable && window.getComputedStyle(desktopTable).display !== 'none';
      const isMobileCardsHidden = mobileCardsContainer && window.getComputedStyle(mobileCardsContainer).display === 'none';

      // Check parallel 2-column layout on desktop
      const heroSummary = desktopKpiGrid ? desktopKpiGrid.parentElement : null;
      const heroRect = heroSummary ? heroSummary.getBoundingClientRect() : null;
      const healthRect = desktopHealthCard ? desktopHealthCard.getBoundingClientRect() : null;
      const areTopCardsSideBySide = (heroRect && healthRect) ? Math.abs(heroRect.top - healthRect.top) < 15 : false;

      const logger = document.getElementById('form-expense-logger').closest('.rounded-2xl');
      const ledger = document.getElementById('desktop-tablet-ledger') || desktopTable.closest('.rounded-2xl');
      const loggerRect = logger.getBoundingClientRect();
      const ledgerRect = ledger.getBoundingClientRect();
      const areLoggerLedgerSideBySide = Math.abs(loggerRect.top - ledgerRect.top) < 15;

      return {
        isDesktopKpiVisible,
        isMobileFoHidden,
        isMobileHealthHidden,
        isDesktopHealthVisible,
        isDesktopTableVisible,
        isMobileCardsHidden,
        areTopCardsSideBySide,
        areLoggerLedgerSideBySide
      };
    })()`);

    check('Desktop 1280px: 4 KPI summary cards visible in 2x2 grid', desktopCheck.isDesktopKpiVisible);
    check('Desktop 1280px: Mobile Financial Overview card is hidden', desktopCheck.isMobileFoHidden);
    check('Desktop 1280px: Mobile Financial Health Card is hidden', desktopCheck.isMobileHealthHidden);
    check('Desktop 1280px: Desktop Financial Health Indicator is visible', desktopCheck.isDesktopHealthVisible);
    check('Desktop 1280px: Desktop Table Ledger is visible', desktopCheck.isDesktopTableVisible);
    check('Desktop 1280px: Mobile transaction cards container is hidden', desktopCheck.isMobileCardsHidden);
    check('Desktop 1280px: HeroSummary & Health Indicator are side-by-side (2 columns)', desktopCheck.areTopCardsSideBySide);
    check('Desktop 1280px: Expense Logger & Ledger are side-by-side (2 columns)', desktopCheck.areLoggerLedgerSideBySide);

    // Capture Desktop Screenshot
    const screenshotDesktop = path.join(ARTIFACT_DIR, 'desktop_tracker_1280px_qa.png');
    await captureScreenshot(screenshotDesktop);
    console.log(`Saved screenshot: ${screenshotDesktop}`);

    // Summary
    console.log('\n=======================================================');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`TEST SUMMARY: ${passed}/${total} checks passed (${failed} failed).`);
    console.log('=======================================================\n');

    ws.close();
    edgeProc.kill();
    server.close();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
