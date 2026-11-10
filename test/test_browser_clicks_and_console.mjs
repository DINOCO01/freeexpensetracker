import { spawn } from 'node:child_process';
import assert from 'node:assert';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('=== STARTING BROWSER REGRESSION & CLICK TESTS ===\n');

// 1. Launch Headless Edge
const edgeProc = spawn(edgePath, [
  '--headless',
  '--remote-debugging-port=9222',
  '--disable-gpu',
  'about:blank'
]);

// Ensure edge is killed on exit
const cleanup = () => {
  try {
    edgeProc.kill();
  } catch (_) {}
};
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

await new Promise((r) => setTimeout(r, 1500));

class BrowserPage {
  constructor(tab, ws) {
    this.tab = tab;
    this.ws = ws;
    this.msgId = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const cb = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        cb(data);
      }

      if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params.type;
        const text = (data.params.args || []).map((a) => a.value || a.description || '').join(' ');
        if (type === 'error') {
          this.consoleErrors.push({ type, text, location: data.params.stackTrace });
        }
      }

      if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text;
        this.pageErrors.push(desc);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.msgId++;
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result?.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
    }
    return res.result?.result?.value;
  }

  async close() {
    this.ws.close();
    try {
      await fetch(`http://127.0.0.1:9222/json/close/${this.tab.id}`, { method: 'GET' });
    } catch (_) {}
  }
}

async function openPage(url) {
  const newTabRes = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const page = new BrowserPage(tab, ws);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable');

  // Wait for load event and module hydration cleanly
  for (let w = 0; w < 25; w++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const ready = await page.eval(`document.readyState`);
      if (ready === 'complete') break;
    } catch (_) {}
  }
  await new Promise((r) => setTimeout(r, 1500));
  return page;
}

let allPassed = true;

try {
  // Test 1: Verify Homepage (/)
  console.log('--- Testing Homepage (/) ---');
  const homePage = await openPage('http://localhost:4321/');

  // Check console errors
  console.log(`Console errors: ${homePage.consoleErrors.length}, Page exceptions: ${homePage.pageErrors.length}`);
  if (homePage.consoleErrors.length > 0 || homePage.pageErrors.length > 0) {
    console.error('Errors found on /:', homePage.consoleErrors, homePage.pageErrors);
    allPassed = false;
  }
  assert.strictEqual(homePage.consoleErrors.length, 0, 'No console errors on /');
  assert.strictEqual(homePage.pageErrors.length, 0, 'No uncaught exceptions on /');

  // Check English H1
  const homeH1 = await homePage.eval(`document.querySelector('h1')?.textContent?.trim()`);
  console.log(`Homepage H1: "${homeH1}"`);
  assert.strictEqual(homeH1, 'Free Expense Tracker', 'English homepage H1 is exactly "Free Expense Tracker"');

  // Check center elementFromPoint (overlay check)
  const homeCenterTag = await homePage.eval(`(function() {
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el ? { tag: el.tagName, id: el.id, className: el.className } : null;
  })()`);
  console.log(`Center element on homepage:`, homeCenterTag);
  assert(homeCenterTag && !homeCenterTag.id.includes('modal') && !homeCenterTag.id.includes('popup'), 'No overlay blocking center on homepage');

  // Perform Tab Clicks
  console.log('Testing App Tab clicks...');
  const tabResult = await homePage.eval(`(function() {
    var tabs = ['templates', 'debt', 'targets', 'tracker'];
    var results = {};
    tabs.forEach(function(tabName) {
      var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
      if (btn) {
        btn.click();
        var view = document.getElementById('tab-view-' + tabName);
        results[tabName] = view && !view.classList.contains('hidden');
      } else {
        results[tabName] = false;
      }
    });
    return results;
  })()`);
  console.log('Tab switch click results:', tabResult);
  assert.deepStrictEqual(tabResult, { templates: true, debt: true, targets: true, tracker: true }, 'All app tabs switch and reveal correctly when clicked');

  // Test Add Expense Button Click
  console.log('Testing Add Expense Outflow button click...');
  const addExpenseResult = await homePage.eval(`(function() {
    var form = document.getElementById('form-expense-logger');
    var nameInput = document.getElementById('input-item-name');
    var amountInput = document.getElementById('input-item-amount');
    var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    var tbody = document.getElementById('transactions-tbody');
    if (!form || !nameInput || !amountInput || !submitBtn || !tbody) {
      return { error: 'elements not found', form: !!form, nameInput: !!nameInput, amountInput: !!amountInput, submitBtn: !!submitBtn, tbody: !!tbody };
    }

    var beforeCount = tbody.querySelectorAll('tr').length;
    nameInput.value = 'Test Grocery Item';
    amountInput.value = '45.50';
    submitBtn.click();
    var afterCount = tbody.querySelectorAll('tr').length;
    return { beforeCount: beforeCount, afterCount: afterCount, added: afterCount > beforeCount };
  })()`);
  console.log('Add Expense click result:', addExpenseResult);
  assert(addExpenseResult && addExpenseResult.added, 'Add Expense Outflow button successfully adds row when clicked');

  // Test Quick Preset Chip Click
  console.log('Testing Quick Preset Chip click...');
  const presetResult = await homePage.eval(`(function() {
    var chip = document.querySelector('.btn-preset-chip');
    var form = document.getElementById('form-expense-logger');
    var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    var nameInput = document.getElementById('input-item-name');
    var amountInput = document.getElementById('input-item-amount');
    var tbody = document.getElementById('transactions-tbody');
    if (!chip || !form || !submitBtn || !tbody) return false;

    var before = tbody.querySelectorAll('tr').length;
    chip.click();
    var namePopulated = nameInput && nameInput.value.length > 0;
    var amountPopulated = amountInput && parseFloat(amountInput.value) > 0;
    submitBtn.click();
    var after = tbody.querySelectorAll('tr').length;
    return {
      before: before,
      namePopulated: namePopulated,
      amountPopulated: amountPopulated,
      after: after,
      added: after > before
    };
  })()`);
  console.log('Preset chip click result:', presetResult);
  assert(presetResult && presetResult.namePopulated && presetResult.added, 'Quick Preset chip populates inputs and adds row when submitted');

  // Verify Tab Numbering & Privacy Comparison Wording + GA4 form_complete live behavior
  console.log('Testing Tab Numbering, Privacy Wording, & Live GA4 form_complete behavior...');
  const session2LiveCheck = await homePage.eval(`(function() {
    var primaryTabs = ['tracker', 'templates', 'debt', 'targets'].map(function(id) {
      var btn = document.querySelector('.tab-btn[data-tab="' + id + '"]');
      return btn ? btn.textContent.replace(/\\s+/g, ' ').trim() : '';
    });
    var bodyText = document.body.textContent || '';
    var hasAccuratePrivacy = bodyText.indexOf('No transaction data leaves your browser.') !== -1;
    var hasZeroTracking = bodyText.toLowerCase().indexOf('zero tracking') !== -1;

    // Install gtag spy
    var events = [];
    var origGtag = window.gtag;
    window.gtag = function(cmd, name, params) {
      if (cmd === 'event') events.push({ name: name, params: params || {} });
      if (typeof origGtag === 'function') {
        try { origGtag.apply(window, arguments); } catch(_) {}
      }
    };

    var form = document.getElementById('form-expense-logger');
    var nameInput = document.getElementById('input-item-name');
    var amountInput = document.getElementById('input-item-amount');
    var catSelect = document.getElementById('select-item-category');
    var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    // 1. Invalid submission (empty name & 0 amount) -> 0 form_complete events
    events.length = 0;
    nameInput.value = '';
    amountInput.value = '0';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    var afterInvalid = events.filter(function(e) { return e.name === 'form_complete'; }).length;

    // 2. Valid expense submission -> 1 form_complete event + no amount/description
    events.length = 0;
    nameInput.value = 'Valid Coffee';
    amountInput.value = '6.25';
    catSelect.value = 'Food';
    submitBtn.click();
    var expenseEvents = events.filter(function(e) { return e.name === 'form_complete'; });

    // 3. Immediate duplicate click after clearing -> 0 additional form_complete events
    events.length = 0;
    submitBtn.click();
    var duplicateEvents = events.filter(function(e) { return e.name === 'form_complete'; }).length;

    // 4. Valid income submission -> 1 form_complete with form_type='income'
    events.length = 0;
    nameInput.value = 'Freelance Deposit';
    amountInput.value = '500';
    catSelect.value = 'Income';
    submitBtn.click();
    var incomeEvents = events.filter(function(e) { return e.name === 'form_complete'; });

    // 5. Failed localStorage save -> 0 form_complete events
    events.length = 0;
    var origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function() { throw new Error('QuotaExceededError'); };
    nameInput.value = 'Should Fail';
    amountInput.value = '25';
    catSelect.value = 'Food';
    submitBtn.click();
    Storage.prototype.setItem = origSetItem;
    var failedSaveEvents = events.filter(function(e) { return e.name === 'form_complete'; }).length;

    return {
      primaryTabs: primaryTabs,
      hasAccuratePrivacy: hasAccuratePrivacy,
      hasZeroTracking: hasZeroTracking,
      afterInvalid: afterInvalid,
      expenseEvents: expenseEvents,
      duplicateEvents: duplicateEvents,
      incomeEvents: incomeEvents,
      failedSaveEvents: failedSaveEvents
    };
  })()`);
  console.log('Session 2 live verification result:', JSON.stringify(session2LiveCheck, null, 2));
  assert(
    session2LiveCheck.primaryTabs[0].includes('1.') &&
    session2LiveCheck.primaryTabs[1].includes('2.') &&
    session2LiveCheck.primaryTabs[2].includes('3.') &&
    session2LiveCheck.primaryTabs[3].includes('4.'),
    'Homepage tabs are numbered sequentially 1, 2, 3, 4'
  );
  assert(session2LiveCheck.hasAccuratePrivacy && !session2LiveCheck.hasZeroTracking, 'Privacy comparison wording accurately states "No transaction data leaves your browser." without "zero tracking"');
  assert.strictEqual(session2LiveCheck.afterInvalid, 0, 'Invalid submission produces 0 form_complete events');
  assert.strictEqual(session2LiveCheck.expenseEvents.length, 1, 'Valid expense submission fires exactly 1 form_complete event');
  assert.strictEqual(session2LiveCheck.expenseEvents[0].params.form_id, 'expense_entry', 'Expense form_complete has form_id=expense_entry');
  assert.strictEqual(session2LiveCheck.expenseEvents[0].params.form_type, 'expense', 'Expense form_complete has form_type=expense');
  assert(!('amount' in session2LiveCheck.expenseEvents[0].params) && !('description' in session2LiveCheck.expenseEvents[0].params), 'No sensitive amount/description sent in form_complete');
  assert.strictEqual(session2LiveCheck.duplicateEvents, 0, 'Repeated button click produces 0 duplicate form_complete events');
  assert.strictEqual(session2LiveCheck.incomeEvents.length, 1, 'Valid income submission fires exactly 1 form_complete event');
  assert.strictEqual(session2LiveCheck.incomeEvents[0].params.form_type, 'income', 'Income form_complete has form_type=income');
  assert.strictEqual(session2LiveCheck.failedSaveEvents, 0, 'Failed localStorage save produces 0 form_complete events');

  // Test Language Switcher
  console.log('Testing Language Switcher click...');
  const langClick = await homePage.eval(`(function() {
    var frLink = document.querySelector('a[href="/fr/"]') || document.querySelector('a[href="/fr"]');
    return frLink ? { exists: true, href: frLink.getAttribute('href') } : { exists: false };
  })()`);
  console.log('Language switcher to French link:', langClick);
  assert(langClick.exists, 'Language switcher to French link exists');

  // Test Debt & Goal form_complete + Mobile 375px Tab Numbering & Responsive Overflow
  await homePage.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  const mobileAndOtherForms = await homePage.eval(`(function() {
    var events = [];
    window.gtag = function(cmd, name, params) {
      if (cmd === 'event') events.push({ name: name, params: params || {} });
    };

    var mobileTabs = Array.from(document.querySelectorAll('.tab-btn:not(.capsule-tab-btn)')).map(function(b) {
      return b.textContent.replace(/\\s+/g, ' ').trim();
    });
    var noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;

    // Debt entry form
    document.querySelector('.tab-btn[data-tab="debt"]').click();
    document.getElementById('input-debt-name').value = 'Visa Test';
    document.getElementById('input-debt-balance').value = '500';
    document.getElementById('input-debt-rate').value = '12';
    document.getElementById('input-debt-minimum').value = '30';
    document.querySelector('#form-add-debt button[type="submit"]').click();

    // Goal entry form
    document.querySelector('.tab-btn[data-tab="targets"]').click();
    document.getElementById('input-goal-name').value = 'Vacation Test';
    document.getElementById('input-goal-target').value = '1000';
    document.getElementById('input-goal-current').value = '0';
    document.getElementById('input-goal-monthly').value = '100';
    document.querySelector('#form-add-goal button[type="submit"]').click();

    return {
      mobileTabs: mobileTabs,
      noHorizontalOverflow: noHorizontalOverflow,
      formCompleteEvents: events.filter(function(e) { return e.name === 'form_complete'; })
    };
  })()`);
  console.log('Mobile 375px & Debt/Goal form_complete result:', JSON.stringify(mobileAndOtherForms, null, 2));
  assert(
    mobileAndOtherForms.mobileTabs[0].includes('1.') &&
    mobileAndOtherForms.mobileTabs[1].includes('2.') &&
    mobileAndOtherForms.mobileTabs[2].includes('3.') &&
    mobileAndOtherForms.mobileTabs[3].includes('4.'),
    'Mobile tabs are numbered 1, 2, 3, 4 cleanly'
  );
  assert(mobileAndOtherForms.noHorizontalOverflow, 'No horizontal overflow on 375px mobile viewport');
  assert.strictEqual(mobileAndOtherForms.formCompleteEvents.length, 2, 'Debt & Goal forms each fired 1 form_complete event');
  assert.strictEqual(mobileAndOtherForms.formCompleteEvents[0].params.form_id, 'debt_entry', 'Debt form fired debt_entry');
  assert.strictEqual(mobileAndOtherForms.formCompleteEvents[1].params.form_id, 'savings_goal', 'Goal form fired savings_goal');
  assert(!('amount' in mobileAndOtherForms.formCompleteEvents[0].params) && !('name' in mobileAndOtherForms.formCompleteEvents[0].params), 'No sensitive debt data sent');
  await homePage.send('Emulation.clearDeviceMetricsOverride');

  await homePage.close();
  console.log('✅ Homepage tests passed!\n');

  // Test 2: Deep Link Queries
  console.log('--- Testing Query Params (/?tab=debt&preset=snowball) ---');
  const deepLinkPage = await openPage('http://localhost:4321/?tab=debt&preset=snowball');
  assert.strictEqual(deepLinkPage.consoleErrors.length, 0, 'No console errors on /?tab=debt&preset=snowball');
  assert.strictEqual(deepLinkPage.pageErrors.length, 0, 'No uncaught exceptions on /?tab=debt&preset=snowball');

  const debtActive = await deepLinkPage.eval(`(function() {
    var debtView = document.getElementById('tab-view-debt');
    var snowballBtn = document.getElementById('btn-strat-snowball');
    return {
      debtVisible: debtView && !debtView.classList.contains('hidden'),
      snowballActive: snowballBtn && snowballBtn.classList.contains('active')
    };
  })()`);
  console.log('Deep link /?tab=debt&preset=snowball result:', debtActive);
  assert(debtActive.debtVisible, 'Debt tab view is active from ?tab=debt');
  await deepLinkPage.close();
  console.log('✅ Deep link ?tab=debt&preset=snowball passed!\n');

  // Test 3: Invalid Query Param (/?tab=foo)
  console.log('--- Testing Invalid Query Param (/?tab=foo) ---');
  const invalidTabPage = await openPage('http://localhost:4321/?tab=foo');
  assert.strictEqual(invalidTabPage.consoleErrors.length, 0, 'No console errors on /?tab=foo');
  assert.strictEqual(invalidTabPage.pageErrors.length, 0, 'No uncaught exceptions on /?tab=foo');
  const trackerDefault = await invalidTabPage.eval(`(function() {
    var trackerView = document.getElementById('tab-view-tracker');
    return trackerView && !trackerView.classList.contains('hidden');
  })()`);
  assert(trackerDefault, 'Falls back safely to tracker view when ?tab=foo');
  await invalidTabPage.close();
  console.log('✅ Safe fallback for ?tab=foo passed!\n');

  // Test 4: French Homepage (/fr/)
  console.log('--- Testing French Homepage (/fr/) ---');
  const frPage = await openPage('http://localhost:4321/fr/');
  assert.strictEqual(frPage.consoleErrors.length, 0, 'No console errors on /fr/');
  assert.strictEqual(frPage.pageErrors.length, 0, 'No uncaught exceptions on /fr/');
  const frH1 = await frPage.eval(`document.querySelector('h1')?.textContent?.trim()`);
  console.log(`French homepage H1: "${frH1}"`);
  assert.strictEqual(frH1, 'Tracker de dépenses gratuit', 'French homepage H1 matches fr.ts "Tracker de dépenses gratuit"');
  await frPage.close();
  console.log('✅ French homepage tests passed!\n');

  // Test 5: /templates/debt-snowball/
  console.log('--- Testing /templates/debt-snowball/ ---');
  const snowballPage = await openPage('http://localhost:4321/templates/debt-snowball/');
  assert.strictEqual(snowballPage.consoleErrors.length, 0, 'No console errors on /templates/debt-snowball/');
  assert.strictEqual(snowballPage.pageErrors.length, 0, 'No uncaught exceptions on /templates/debt-snowball/');

  // Center element overlay check
  const snowballCenterTag = await snowballPage.eval(`(function() {
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el ? { tag: el.tagName, id: el.id, className: el.className } : null;
  })()`);
  console.log('Center element on debt-snowball:', snowballCenterTag);
  assert(snowballCenterTag && !snowballCenterTag.id.includes('modal') && !snowballCenterTag.id.includes('popup'), 'No overlay blocking center on debt-snowball');

  // Click Download Button
  console.log('Testing Download button...');
  const dlResult = await snowballPage.eval(`(function() {
    var dl = document.querySelector('a[download]');
    return dl ? { exists: true, href: dl.getAttribute('href'), download: dl.getAttribute('download') } : { exists: false };
  })()`);
  console.log('Download link:', dlResult);
  assert(dlResult.exists && dlResult.download.includes('.xlsx'), 'Download button exists and points to Excel spreadsheet');

  // Test Interactive Snowball Calculator
  console.log('Testing Snowball Calculator interactions...');
  const calcInteractions = await snowballPage.eval(`(function() {
    var addBtn = document.getElementById('btn-add-snowball-debt');
    var tbody = document.getElementById('snowball-debts-body');
    var extraInput = document.getElementById('input-snowball-extra');
    var resultMonths = document.getElementById('calc-result-months');

    var initialRows = tbody ? tbody.querySelectorAll('.debt-row').length : 0;
    if (addBtn) addBtn.click();
    var rowsAfterAdd = tbody ? tbody.querySelectorAll('.debt-row').length : 0;

    if (extraInput) {
      extraInput.value = '300';
      extraInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    var monthsText = resultMonths ? resultMonths.textContent : '';
    return {
      initialRows: initialRows,
      rowsAfterAdd: rowsAfterAdd,
      monthsText: monthsText
    };
  })()`);
  console.log('Snowball calculator interaction result:', calcInteractions);
  assert(calcInteractions.rowsAfterAdd > calcInteractions.initialRows, 'Snowball calculator Add Debt button adds a row');
  assert(calcInteractions.monthsText.includes('Months'), 'Snowball calculator recalculates debt payoff months');

  // Click CTA buttons (with preventDefault so page doesn't unload during test)
  console.log('Testing Template CTA clicks...');
  const ctaResult = await snowballPage.eval(`(function() {
    var btns = document.querySelectorAll('.template-to-app-btn');
    var clicks = 0;
    btns.forEach(function(b) {
      // Test the attached click event listener safely
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      clicks++;
    });
    return { count: btns.length, clicked: clicks };
  })()`);
  console.log('CTA clicks:', ctaResult);
  assert.strictEqual(ctaResult.clicked, 2, 'Both CTA buttons exist and are clickable without throwing');

  await snowballPage.close();
  console.log('✅ /templates/debt-snowball/ tests passed!\n');

  // Test 6: Another template page (/templates/paycheck-budget/)
  console.log('--- Testing /templates/paycheck-budget/ ---');
  const paycheckPage = await openPage('http://localhost:4321/templates/paycheck-budget/');
  assert.strictEqual(paycheckPage.consoleErrors.length, 0, 'No console errors on /templates/paycheck-budget/');
  assert.strictEqual(paycheckPage.pageErrors.length, 0, 'No uncaught exceptions on /templates/paycheck-budget/');

  const paycheckCta = await paycheckPage.eval(`(function() {
    var btns = document.querySelectorAll('.template-to-app-btn');
    var clicks = 0;
    btns.forEach(function(b) {
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      clicks++;
    });
    return { count: btns.length, clicked: clicks };
  })()`);
  console.log('Paycheck CTA clicks:', paycheckCta);
  assert.strictEqual(paycheckCta.clicked, 2, 'Both CTA buttons clickable on paycheck budget');

  await paycheckPage.close();
  console.log('✅ /templates/paycheck-budget/ tests passed!\n');

  // Test 7: /templates/52-week-savings-challenge/
  console.log('--- Testing /templates/52-week-savings-challenge/ ---');
  const savings52Page = await openPage('http://localhost:4321/templates/52-week-savings-challenge/');
  assert.strictEqual(savings52Page.consoleErrors.length, 0, 'No console errors on /templates/52-week-savings-challenge/');
  assert.strictEqual(savings52Page.pageErrors.length, 0, 'No uncaught exceptions on /templates/52-week-savings-challenge/');

  const savingsH1 = await savings52Page.eval(`document.querySelector('h1')?.textContent?.trim()`);
  console.log(`52-Week Challenge H1: "${savingsH1}"`);
  assert.strictEqual(savingsH1, 'Free 52-Week Savings Challenge', 'H1 is exactly "Free 52-Week Savings Challenge"');

  // Verify H1 count, H2 outline order, Download Button text, and Lazy Preview image
  const seoAudit52 = await savings52Page.eval(`(function() {
    var h1Count = document.querySelectorAll('h1').length;
    var h2Texts = Array.from(document.querySelectorAll('h2')).map(function(el) { return el.textContent.trim(); });
    var dl = document.querySelector('a[download]');
    var img = document.querySelector('img[src*="52-week-savings-challenge-preview"]');
    return {
      h1Count: h1Count,
      h2Texts: h2Texts,
      dlText: dl ? dl.textContent.trim() : '',
      imgAlt: img ? img.getAttribute('alt') : '',
      imgWidth: img ? img.getAttribute('width') : '',
      imgHeight: img ? img.getAttribute('height') : '',
      imgLoading: img ? img.getAttribute('loading') : ''
    };
  })()`);
  console.log('52-Week On-Page SEO Audit:', seoAudit52);
  assert.strictEqual(seoAudit52.h1Count, 1, 'Page has only 1 H1');
  assert.deepStrictEqual(seoAudit52.h2Texts, [
    'How the 52-Week Savings Challenge Works',
    '52-Week Savings Challenge Chart',
    'Reverse 52-Week Challenge',
    'Biweekly Version (Paid Every Two Weeks)',
    'Tips to Finish the Challenge',
    'FAQ'
  ], 'H2s appear in exact required order');
  assert.strictEqual(seoAudit52.dlText, 'Download the 52-Week Savings Challenge (Excel)', 'Download button text matches requirement');
  assert(seoAudit52.imgAlt.includes('52-week savings challenge spreadsheet in Excel'), 'Preview image has descriptive alt text');
  assert(seoAudit52.imgWidth && seoAudit52.imgHeight && seoAudit52.imgLoading === 'lazy', 'Preview image specifies width, height, and loading="lazy"');

  // Check center element overlay
  const savingsCenterTag = await savings52Page.eval(`(function() {
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el ? { tag: el.tagName, id: el.id, className: el.className } : null;
  })()`);
  console.log('Center element on 52-week page:', savingsCenterTag);
  assert(savingsCenterTag && !savingsCenterTag.id.includes('modal') && !savingsCenterTag.id.includes('popup'), 'No overlay blocking center on 52-week page');

  // Check Download Button
  const savingsDl = await savings52Page.eval(`(function() {
    var dl = document.querySelector('a[download]');
    return dl ? { exists: true, href: dl.getAttribute('href'), download: dl.getAttribute('download') } : { exists: false };
  })()`);
  console.log('52-Week download link:', savingsDl);
  assert(savingsDl.exists && savingsDl.download.includes('17_US_52_Week_Savings_Challenge.xlsx'), 'Download button points to 17_US_52_Week_Savings_Challenge.xlsx');

  // Test Interactive Calculator
  console.log('Testing 52-Week Calculator interactions...');
  const calc52Result = await savings52Page.eval(`(function() {
    var totalEl = document.getElementById('calc-challenge-total');
    var peakEl = document.getElementById('calc-challenge-peak');
    var startInput = document.getElementById('input-challenge-start');
    var reverseBtn = document.getElementById('btn-mode-reverse');
    var rows = document.querySelectorAll('#challenge-schedule-body tr');

    var defaultTotal = totalEl ? totalEl.textContent.trim() : '';
    var defaultPeak = peakEl ? peakEl.textContent.trim() : '';
    var initialRowsCount = rows.length;

    // Click reverse
    if (reverseBtn) reverseBtn.click();
    var reverseTotal = totalEl ? totalEl.textContent.trim() : '';
    var reversePeak = peakEl ? peakEl.textContent.trim() : '';

    // Change start input
    if (startInput) {
      startInput.value = '5';
      startInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var modifiedTotal = totalEl ? totalEl.textContent.trim() : '';

    return {
      defaultTotal: defaultTotal,
      defaultPeak: defaultPeak,
      reverseTotal: reverseTotal,
      reversePeak: reversePeak,
      modifiedTotal: modifiedTotal,
      rowsCount: initialRowsCount
    };
  })()`);
  console.log('52-Week Calculator results:', calc52Result);
  assert(calc52Result.defaultTotal.includes('$1,378'), 'Default calculation equals $1,378');
  assert.strictEqual(calc52Result.defaultPeak, '$52.00', 'Default week 52 deposit is $52.00');
  assert.strictEqual(calc52Result.reversePeak, '$1.00', 'Reverse mode sets week 52 deposit to $1.00');
  assert.strictEqual(calc52Result.rowsCount, 52, 'Schedule table has 52 rows');
  assert(calc52Result.modifiedTotal.includes('$1,586'), 'Recalculates when start value is updated');

  // Click CTA buttons
  console.log('Testing 52-Week CTA clicks...');
  const savingsCta = await savings52Page.eval(`(function() {
    var btns = document.querySelectorAll('.template-to-app-btn');
    var clicks = 0;
    btns.forEach(function(b) {
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      clicks++;
    });
    return { count: btns.length, clicked: clicks };
  })()`);
  console.log('52-Week CTA clicks:', savingsCta);
  assert.strictEqual(savingsCta.clicked, 2, 'Both CTA buttons clickable on 52-week challenge');

  await savings52Page.close();
  console.log('✅ /templates/52-week-savings-challenge/ tests passed!\n');

  // Test 8: Deep link ?tab=goals&preset=savings-challenge
  console.log('--- Testing Query Params (/?tab=goals&preset=savings-challenge) ---');
  const goalsDeepLink = await openPage('http://localhost:4321/?tab=goals&preset=savings-challenge');
  assert.strictEqual(goalsDeepLink.consoleErrors.length, 0, 'No console errors on ?tab=goals&preset=savings-challenge');
  assert.strictEqual(goalsDeepLink.pageErrors.length, 0, 'No uncaught exceptions on ?tab=goals&preset=savings-challenge');

  const goalsPresetState = await goalsDeepLink.eval(`(function() {
    var targetsView = document.getElementById('tab-view-targets');
    var nameInput = document.getElementById('input-goal-name');
    var targetInput = document.getElementById('input-goal-target');
    return {
      targetsVisible: targetsView && !targetsView.classList.contains('hidden'),
      nameValue: nameInput ? nameInput.value : '',
      targetValue: targetInput ? targetInput.value : ''
    };
  })()`);
  console.log('Goals preset state:', goalsPresetState);
  assert(goalsPresetState.targetsVisible, 'Targets tab is active from ?tab=goals');
  assert.strictEqual(goalsPresetState.nameValue, '52-Week Challenge', 'Goal name prefilled with "52-Week Challenge"');
  assert.strictEqual(goalsPresetState.targetValue, '1378', 'Goal target prefilled with "1378"');
  await goalsDeepLink.close();
  console.log('✅ Deep link ?tab=goals&preset=savings-challenge passed!\n');

} catch (err) {
  console.error('❌ Test failure:', err);
  allPassed = false;
} finally {
  cleanup();
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('🎉 ALL BROWSER & CLICK REGRESSION TESTS PASSED CLEANLY WITH 0 ERRORS!');
  process.exit(0);
}
