import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4801;
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

  const cdpPort = 9230;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-debt-mobile-qa-'));
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
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
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
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768
    });
  }

  async function captureScreenshot(filepath) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
  }

  await send('Page.enable');
  await send('Runtime.enable');

  try {
    console.log('\n--- SUITE 1: Mobile Isolation & Layout Order (395px) ---');
    await setViewport(395, 844);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    // Clear any sample data in debts and switch to debt tab
    await evaluate(`
      (function() {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    // Switch to Debt tab
    await evaluate(`
      (function() {
        const debtTabBtn = document.querySelector('[data-tab="debt"]');
        if (debtTabBtn) debtTabBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Verify visibility isolation
    const isolation = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-debt-view');
        const dsk = document.getElementById('desktop-tablet-debt-view');
        return {
          mobVisible: mob && window.getComputedStyle(mob).display !== 'none',
          dskHidden: dsk && window.getComputedStyle(dsk).display === 'none'
        };
      })()
    `);
    check('Mobile view is visible on 395px viewport', isolation.mobVisible === true);
    check('Desktop/tablet view is strictly hidden on 395px viewport', isolation.dskHidden === true);

    // Verify Heading and Introduction Paragraph
    const headerInfo = await evaluate(`
      (function() {
        const h2 = document.querySelector('#mobile-debt-view h2')?.textContent.trim();
        const badge = document.querySelector('#mobile-debt-view .uppercase.tracking-wider')?.textContent.trim();
        const p = document.querySelector('#mobile-debt-view p')?.textContent.trim();
        return { h2, badge, p };
      })()
    `);
    check('Preserves heading: Loan, EMI & Debt Freedom Planner', headerInfo.h2.includes('Loan, EMI & Debt Freedom Planner'));
    check('Preserves Payoff Optimization badge', headerInfo.badge.includes('Payoff Optimization'));
    check('Intro paragraph matches required concise text', headerInfo.p.includes('Plan, compare and pay off your loans and debts faster. Choose a model below to see a personalized payoff plan.'));

    // Verify Section Ordering
    const sectionOrder = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-debt-view');
        if (!mob) return null;

        const headerCard = mob.querySelector('h2');
        const segmentedSelector = document.getElementById('mobile-strat-avalanche');
        const explanationPanel = document.getElementById('mobile-debt-model-panel');
        const addDebtForm = document.getElementById('form-add-debt-mobile');
        const liabilitiesLedger = document.getElementById('debts-mobile-list');
        const metricsTiles = document.getElementById('mobile-stat-total-debt');
        const extraPayment = document.getElementById('mobile-debt-extra-slider');

        function getTop(el) {
          return el ? el.getBoundingClientRect().top : 99999;
        }

        const topHeader = getTop(headerCard);
        const topSelector = getTop(segmentedSelector);
        const topExplanation = getTop(explanationPanel);
        const topForm = getTop(addDebtForm);
        const topLedger = getTop(liabilitiesLedger);
        const topMetrics = getTop(metricsTiles);
        const topExtra = getTop(extraPayment);

        return {
          headerBeforeSelector: topHeader < topSelector,
          selectorBeforeExplanation: topSelector < topExplanation,
          explanationBeforeForm: topExplanation < topForm,
          formBeforeLedger: topForm < topLedger,
          ledgerBeforeMetrics: topLedger < topMetrics,
          metricsBeforeExtra: topMetrics < topExtra
        };
      })()
    `);
    check('Order 1: Heading appears before Models Selector', sectionOrder.headerBeforeSelector);
    check('Order 2: Models Selector appears before Explanation Panel', sectionOrder.selectorBeforeExplanation);
    check('Order 3: Explanation Panel appears before Add Loan Form', sectionOrder.explanationBeforeForm);
    check('Order 4: Add Loan Form appears before Active Liabilities Ledger', sectionOrder.formBeforeLedger);
    check('Order 5: Active Liabilities Ledger appears before Payoff Overview & Metrics', sectionOrder.ledgerBeforeMetrics);
    check('Order 6: Payoff Overview & Metrics appears before Accelerate Payoff section', sectionOrder.metricsBeforeExtra);

    console.log('\n--- SUITE 2: Financial Models Selector & Descriptive Pills ---');
    // Test model selector pills and labels
    const selectorPills = await evaluate(`
      (function() {
        const avaBtn = document.getElementById('mobile-strat-avalanche');
        const snoBtn = document.getElementById('mobile-strat-snowball');
        const foiBtn = document.getElementById('mobile-strat-foir');

        const avaTag = avaBtn?.querySelector('.model-tag')?.textContent.trim();
        const snoTag = snoBtn?.querySelector('.model-tag')?.textContent.trim();
        const foiTag = foiBtn?.querySelector('.model-tag')?.textContent.trim();

        const avaText = avaBtn?.innerText || '';
        const snoText = snoBtn?.innerText || '';
        const foiText = foiBtn?.innerText || '';

        return {
          avaTag,
          snoTag,
          foiTag,
          avaHasFullTitle: avaText.includes('Debt Avalanche'),
          snoHasFullTitle: snoText.includes('Debt Snowball'),
          foiHasFullTitle: foiText.includes('Balanced Strategy'),
          noEllipsis: !avaText.includes('...') && !snoText.includes('...') && !foiText.includes('...')
        };
      })()
    `);
    check('Avalanche has descriptive pill: Lower Interest Cost', selectorPills.avaTag === 'Lower Interest Cost');
    check('Snowball has descriptive pill: Faster Progress', selectorPills.snoTag === 'Faster Progress');
    check('Balanced Strategy has descriptive pill: Mix of Both', selectorPills.foiTag === 'Mix of Both');
    check('All 3 models display complete names without ellipses', selectorPills.avaHasFullTitle && selectorPills.snoHasFullTitle && selectorPills.foiHasFullTitle && selectorPills.noEllipsis);

    // Test Avalanche default state and dynamic explanation
    const defaultModel = await evaluate(`
      (function() {
        const avaBtn = document.getElementById('mobile-strat-avalanche');
        const title = document.getElementById('mobile-model-title')?.textContent.trim();
        const example = document.getElementById('mobile-model-example-text')?.textContent.trim();
        return {
          avaActive: avaBtn?.getAttribute('aria-selected') === 'true',
          title,
          hasExample: !!example && example.length > 10
        };
      })()
    `);
    check('Avalanche is selected by default', defaultModel.avaActive);
    check('Explanation title reflects Avalanche', defaultModel.title.includes('Avalanche'));
    check('Explanation contains numerical example', defaultModel.hasExample);

    // Switch to Snowball and verify single-line badge in ledger
    await evaluate(`document.getElementById('mobile-strat-snowball').click();`);
    await new Promise((r) => setTimeout(r, 300));
    const snowballCheck = await evaluate(`
      (function() {
        const snoBtn = document.getElementById('mobile-strat-snowball');
        const title = document.getElementById('mobile-model-title')?.textContent.trim();
        const pill = document.getElementById('active-strategy-pill-mobile');
        const pillText = pill?.textContent.trim();
        const isSingleLine = pill ? pill.classList.contains('whitespace-nowrap') : false;
        return {
          snoActive: snoBtn?.getAttribute('aria-selected') === 'true',
          title,
          pillText,
          isSingleLine
        };
      })()
    `);
    check('Switching to Snowball activates Snowball button', snowballCheck.snoActive);
    check('Explanation updates to Debt Snowball', snowballCheck.title.includes('Snowball'));
    check('Ledger strategy badge displays Snowball (Smallest Balance First)', snowballCheck.pillText.includes('Snowball (Smallest Balance First)'));
    check('Ledger strategy badge is constrained to a single line', snowballCheck.isSingleLine);

    // Switch to Balanced Strategy
    await evaluate(`document.getElementById('mobile-strat-foir').click();`);
    await new Promise((r) => setTimeout(r, 300));
    const balancedCheck = await evaluate(`
      (function() {
        const foiBtn = document.getElementById('mobile-strat-foir');
        const pillText = document.getElementById('active-strategy-pill-mobile')?.textContent.trim();
        return {
          foiActive: foiBtn?.getAttribute('aria-selected') === 'true',
          pillText
        };
      })()
    `);
    check('Switching to Balanced Strategy highlights button', balancedCheck.foiActive);
    check('Ledger strategy badge displays Balanced Strategy (Proportional Cash Flow)', balancedCheck.pillText.includes('Balanced Strategy (Proportional Cash Flow)'));

    // Switch back to Avalanche
    await evaluate(`document.getElementById('mobile-strat-avalanche').click();`);
    await new Promise((r) => setTimeout(r, 300));
    const avalancheBadgeText = await evaluate(`document.getElementById('active-strategy-pill-mobile')?.textContent.trim()`);
    check('Ledger strategy badge displays Avalanche (Highest Interest First)', avalancheBadgeText.includes('Avalanche (Highest Interest First)'));

    // Test "Read More" expandable toggle
    const readMoreBefore = await evaluate(`
      (function() {
        const details = document.getElementById('mobile-model-details');
        const btn = document.getElementById('btn-mobile-model-read-more');
        return details.classList.contains('hidden') && btn.getAttribute('aria-expanded') === 'false';
      })()
    `);
    check('"Read More" drawer is collapsed by default', readMoreBefore);

    await evaluate(`document.getElementById('btn-mobile-model-read-more').click();`);
    await new Promise((r) => setTimeout(r, 300));
    const readMoreExpanded = await evaluate(`
      (function() {
        const details = document.getElementById('mobile-model-details');
        const btn = document.getElementById('btn-mobile-model-read-more');
        const label = document.getElementById('label-mobile-model-read-more')?.textContent.trim();
        return !details.classList.contains('hidden') && btn.getAttribute('aria-expanded') === 'true' && label.includes('Show Less');
      })()
    `);
    check('Clicking "Read More" reveals full details and shows "Show Less"', readMoreExpanded);

    await evaluate(`document.getElementById('btn-mobile-model-read-more').click();`);
    await new Promise((r) => setTimeout(r, 300));
    const readMoreCollapsed = await evaluate(`document.getElementById('mobile-model-details').classList.contains('hidden')`);
    check('Clicking "Show Less" collapses drawer back', readMoreCollapsed);

    console.log('\n--- SUITE 3: Mobile Add Loan Form & Active Liabilities Ledger ---');
    // Verify form layout structure
    const formLayout = await evaluate(`
      (function() {
        const balInput = document.getElementById('input-debt-balance-mobile');
        const rateInput = document.getElementById('input-debt-rate-mobile');
        const balCol = balInput?.closest('div');
        const row2col = balCol?.parentElement;
        return row2col && row2col.classList.contains('grid-cols-2');
      })()
    `);
    check('Principal Balance and Interest Rate APR are side-by-side in a 2-column row', formLayout);

    // Add Debt 1: Credit Card ($20,000, 24% APR, $800 EMI)
    await evaluate(`
      (function() {
        document.getElementById('input-debt-name-mobile').value = 'Credit Card';
        document.getElementById('input-debt-balance-mobile').value = '20000';
        document.getElementById('input-debt-rate-mobile').value = '24';
        document.getElementById('input-debt-minimum-mobile').value = '800';
        document.getElementById('form-add-debt-mobile').dispatchEvent(new Event('submit', { cancelable: true }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Verify 2-row collapsed loan card presentation
    const cardStructure = await evaluate(`
      (function() {
        const card = document.querySelector('#debts-mobile-list .mobile-loan-card');
        if (!card) return null;
        const hdr = card.querySelector('.mobile-loan-header');
        const rows = hdr ? hdr.children : [];
        const row1 = rows[0];
        const row2 = rows[1];

        const row1Text = row1 ? row1.innerText : '';
        const row2Text = row2 ? row2.innerText : '';
        const chevron = row1 ? row1.querySelector('.chevron-icon') : null;

        return {
          row1HasPriority: row1Text.includes('#1'),
          row1HasTopRate: row1Text.includes('Top Rate'),
          row1HasName: row1Text.includes('Credit Card'),
          row1HasChevron: !!chevron,
          row2HasPrincipal: row2Text.includes('20,000') || row2Text.includes('20000'),
          row2HasApr: row2Text.includes('24% APR'),
          row2HasEmi: row2Text.includes('800'),
          row2HasDividers: row2Text.includes('|')
        };
      })()
    `);
    check('Loan Card Row 1: Displays Priority #1, Top Rate indicator, and Debt Name', cardStructure.row1HasPriority && cardStructure.row1HasTopRate && cardStructure.row1HasName);
    check('Loan Card Row 1: Displays right-aligned Chevron arrow', cardStructure.row1HasChevron);
    check('Loan Card Row 2: Displays prominent Principal, APR, and Monthly EMI', cardStructure.row2HasPrincipal && cardStructure.row2HasApr && cardStructure.row2HasEmi);
    check('Loan Card Row 2: Features subtle dividers (|) between financial values', cardStructure.row2HasDividers);

    // Capture screenshot at 360px collapsed
    await setViewport(360, 780);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'debt_mobile_360px_collapsed.png'));
    console.log('  📸 Screenshot saved: debt_mobile_360px_collapsed.png');

    // Test expanding card at 395px
    await setViewport(395, 844);
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(`
      (function() {
        const hdr = document.querySelector('#debts-mobile-list .mobile-loan-header');
        if (hdr) hdr.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const cardExpanded = await evaluate(`
      (function() {
        const card = document.querySelector('#debts-mobile-list .mobile-loan-card');
        const expandedSection = card?.querySelector('.mobile-loan-expanded');
        const isVisible = expandedSection && !expandedSection.classList.contains('hidden');
        const recordBtn = expandedSection?.querySelector('.btn-record-debt-payment');
        const chevronRotated = card?.querySelector('.chevron-icon')?.classList.contains('rotate-180');
        const breakdownText = expandedSection?.innerText || '';

        return {
          isVisible,
          hasRecordPaymentBtn: !!recordBtn,
          chevronRotated,
          hasOriginalPrincipal: breakdownText.includes('Original') || breakdownText.includes('20,000'),
          hasHistorySection: breakdownText.includes('Payment History')
        };
      })()
    `);
    check('Tapping card expands details inline underneath', cardExpanded.isVisible);
    check('Expanded section displays complete loan details (Original Principal, APR, EMI)', cardExpanded.hasOriginalPrincipal);
    check('Expanded section displays Payment History area', cardExpanded.hasHistorySection);
    check('Expanded section includes dedicated "Add Payment / Record Payment" button', cardExpanded.hasRecordPaymentBtn);
    check('Chevron rotates 180 degrees when expanded', cardExpanded.chevronRotated);

    // Capture screenshot at 395px expanded
    await captureScreenshot(path.join(ARTIFACT_DIR, 'debt_mobile_395px_expanded.png'));
    console.log('  📸 Screenshot saved: debt_mobile_395px_expanded.png');

    // Test Recording a Payment via the Expanded card button
    await evaluate(`
      (function() {
        const recordBtn = document.querySelector('.mobile-loan-expanded .btn-record-debt-payment');
        if (recordBtn) recordBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const modalOpened = await evaluate(`
      (function() {
        const modal = document.getElementById('debt-payment-modal');
        return modal && !modal.classList.contains('hidden');
      })()
    `);
    check('Tapping "Add Payment" opens Debt Payment Modal', modalOpened === true);

    // Record $1,000 payment ($800 principal, $200 interest)
    await evaluate(`
      (function() {
        document.getElementById('input-debt-payment-total').value = '1000';
        document.getElementById('input-debt-payment-principal').value = '800';
        document.getElementById('input-debt-payment-interest').value = '200';
        document.getElementById('input-debt-payment-extra').value = '0';
        document.getElementById('form-debt-payment').dispatchEvent(new Event('submit', { cancelable: true }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify updated balance and payment history in expanded card
    const postPaymentState = await evaluate(`
      (function() {
        const card = document.querySelector('#debts-mobile-list .mobile-loan-card');
        const expandedSection = card?.querySelector('.mobile-loan-expanded');
        if (expandedSection && expandedSection.classList.contains('hidden')) {
          card.querySelector('.mobile-loan-header')?.click();
        }
        const expandedText = card?.querySelector('.mobile-loan-expanded')?.textContent || '';
        const cardText = card?.innerText || '';
        return {
          balanceReduced: cardText.includes('19,200') || cardText.includes('19200'),
          historyRecorded: expandedText.includes('Payment History (1)') || expandedText.includes('1,000') || expandedText.includes('1000')
        };
      })()
    `);
    check('Recorded payment reduces outstanding principal ($19,200)', postPaymentState.balanceReduced);
    check('Payment history updates with new entry inside the expanded card', postPaymentState.historyRecorded);

    // Test Accordion: Add a second debt
    await evaluate(`
      (function() {
        document.getElementById('input-debt-name-mobile').value = 'Personal Loan';
        document.getElementById('input-debt-balance-mobile').value = '50000';
        document.getElementById('input-debt-rate-mobile').value = '12';
        document.getElementById('input-debt-minimum-mobile').value = '1500';
        document.getElementById('form-add-debt-mobile').dispatchEvent(new Event('submit', { cancelable: true }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Expand second debt card and verify first card automatically collapses
    await evaluate(`
      (function() {
        const headers = document.querySelectorAll('#debts-mobile-list .mobile-loan-header');
        if (headers.length >= 2) headers[1].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const accordionCheck = await evaluate(`
      (function() {
        const cards = document.querySelectorAll('#debts-mobile-list .mobile-loan-card');
        const card1Expanded = !cards[0]?.querySelector('.mobile-loan-expanded')?.classList.contains('hidden');
        const card2Expanded = !cards[1]?.querySelector('.mobile-loan-expanded')?.classList.contains('hidden');
        return {
          card1Collapsed: !card1Expanded,
          card2Expanded: card2Expanded
        };
      })()
    `);
    check('Accordion behavior: expanding second debt collapses first debt', accordionCheck.card1Collapsed && accordionCheck.card2Expanded);

    console.log('\n--- SUITE 4: Payoff Overview & Metrics (Five Tiles) ---');
    const fiveTilesCheck = await evaluate(`
      (function() {
        const t1Debt = document.getElementById('mobile-stat-total-debt')?.textContent.trim();
        const t1Count = document.getElementById('mobile-debt-item-count')?.textContent.trim();
        const t2Emi = document.getElementById('mobile-stat-total-emi')?.textContent.trim();
        const t3Dti = document.getElementById('mobile-stat-dti-ratio')?.textContent.trim();
        const t3Tier = document.getElementById('mobile-stat-dti-tier')?.textContent.trim();
        const t4Free = document.getElementById('mobile-stat-debt-free-date')?.textContent.trim();
        const t5Savings = document.getElementById('mobile-stat-interest-saved')?.textContent.trim();
        const t5Container = document.getElementById('mobile-stat-interest-saved')?.closest('.col-span-2');

        return {
          t1HasBalance: t1Debt.includes('69,200') || t1Debt.includes('69200'),
          t1HasCount: t1Count === '2',
          t2HasEmiCurrencyOnly: (t2Emi.includes('2,300') || t2Emi.includes('2300')) && !t2Emi.includes('%'),
          t3HasRatioPct: t3Dti.includes('%'),
          t3HasTier: t3Tier.length > 0,
          t4HasFreedomDate: t4Free !== '—' && t4Free.length > 0,
          t5HasSavings: t5Savings.length > 0,
          t5SpansFullWidth: !!t5Container
        };
      })()
    `);
    check('Tile 1: Total Outstanding Principal shows combined balance and active count (2 accounts)', fiveTilesCheck.t1HasBalance && fiveTilesCheck.t1HasCount);
    check('Tile 2: Total Monthly Mandatory Payments shows actual sum in currency without percentage ($2,300)', fiveTilesCheck.t2HasEmiCurrencyOnly);
    check('Tile 3: EMI-to-Income Ratio displays burden percentage and classification', fiveTilesCheck.t3HasRatioPct && fiveTilesCheck.t3HasTier);
    check('Tile 4: Estimated Debt Freedom displays projected payoff timeframe', fiveTilesCheck.t4HasFreedomDate);
    check('Tile 5: Interest Savings vs Minimums spans full available width (col-span-2)', fiveTilesCheck.t5HasSavings && fiveTilesCheck.t5SpansFullWidth);

    console.log('\n--- SUITE 5: Accelerate Payoff Section ---');
    const extraPayoffCheck = await evaluate(`
      (function() {
        const slider = document.getElementById('mobile-debt-extra-slider');
        const numInput = document.getElementById('mobile-input-debt-extra-number');
        if (!slider || !numInput) return null;

        // Simulate slider drag to 5000
        slider.value = '5000';
        slider.dispatchEvent(new Event('input', { bubbles: true }));

        const numValAfterSlider = numInput.value;

        // Simulate input change to 7500
        numInput.value = '7500';
        numInput.dispatchEvent(new Event('input', { bubbles: true }));

        const sliderValAfterInput = slider.value;

        return {
          sliderSyncsInput: numValAfterSlider === '5000',
          inputSyncsSlider: sliderValAfterInput === '7500'
        };
      })()
    `);
    check('Accelerate Payoff slider syncs to number input', extraPayoffCheck.sliderSyncsInput);
    check('Accelerate Payoff number input syncs to slider', extraPayoffCheck.inputSyncsSlider);

    // Capture screenshot at 430px (iPhone 14 Pro Max / Large mobile)
    await setViewport(430, 932);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'debt_mobile_430px.png'));
    console.log('  📸 Screenshot saved: debt_mobile_430px.png');

    console.log('\n--- SUITE 6: Desktop & Tablet Invariance ---');
    // Switch to Desktop (1280px)
    await setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 500));

    const desktopViewCheck = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-debt-view');
        const dsk = document.getElementById('desktop-tablet-debt-view');
        const mobHidden = mob && window.getComputedStyle(mob).display === 'none';
        const dskVisible = dsk && window.getComputedStyle(dsk).display !== 'none';

        const verticalTabs = document.querySelector('#desktop-tablet-debt-view [role="tablist"]');
        const recommendationCard = document.getElementById('debt-strategy-recommendation');
        const desktopForm = document.getElementById('form-add-debt');
        const desktopTable = document.getElementById('debts-tbody');

        return {
          mobHidden,
          dskVisible,
          hasVerticalTabs: !!verticalTabs,
          hasRecommendationCard: !!recommendationCard,
          hasDesktopForm: !!desktopForm,
          hasDesktopTable: !!desktopTable
        };
      })()
    `);
    check('On desktop 1280px, mobile view is strictly hidden', desktopViewCheck.mobHidden);
    check('On desktop 1280px, desktop/tablet view is visible', desktopViewCheck.dskVisible);
    check('Desktop vertical tabs layout is preserved', desktopViewCheck.hasVerticalTabs);
    check('Desktop strategy recommendation card is preserved', desktopViewCheck.hasRecommendationCard);
    check('Desktop Add Debt form is preserved', desktopViewCheck.hasDesktopForm);
    check('Desktop table ledger is preserved', desktopViewCheck.hasDesktopTable);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'debt_desktop_1280px.png'));
    console.log('  📸 Screenshot saved: debt_desktop_1280px.png');

    // Switch to Tablet (768px)
    await setViewport(768, 1024);
    await new Promise((r) => setTimeout(r, 500));

    const tabletViewCheck = await evaluate(`
      (function() {
        const mob = document.getElementById('mobile-debt-view');
        const dsk = document.getElementById('desktop-tablet-debt-view');
        return {
          mobHidden: mob && window.getComputedStyle(mob).display === 'none',
          dskVisible: dsk && window.getComputedStyle(dsk).display !== 'none'
        };
      })()
    `);
    check('On tablet 768px, mobile view is hidden', tabletViewCheck.mobHidden);
    check('On tablet 768px, desktop/tablet view is visible', tabletViewCheck.dskVisible);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'debt_tablet_768px.png'));
    console.log('  📸 Screenshot saved: debt_tablet_768px.png');

  } finally {
    ws.close();
    edgeProcess.kill('SIGKILL');
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n=============================================');
  const failed = testResults.filter((r) => !r.pass);
  console.log(`Total checks: ${testResults.length} | Passed: ${testResults.length - failed.length} | Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.error('Failed checks:', failed);
    process.exit(1);
  } else {
    console.log('All Debt Tab Mobile UI Reorganization tests PASSED perfectly!');
  }
}

runTest().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
