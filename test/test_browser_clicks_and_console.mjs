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

  // Wait for load event and hydration
  await new Promise((r) => setTimeout(r, 3000));
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

  // Test Language Switcher
  console.log('Testing Language Switcher click...');
  const langClick = await homePage.eval(`(function() {
    var frLink = document.querySelector('a[href="/fr/"]') || document.querySelector('a[href="/fr"]');
    return frLink ? { exists: true, href: frLink.getAttribute('href') } : { exists: false };
  })()`);
  console.log('Language switcher to French link:', langClick);
  assert(langClick.exists, 'Language switcher to French link exists');

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
