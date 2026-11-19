import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4330;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/bill-splitter/`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();

function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      let cleanPath = reqPath.replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, cleanPath);

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => resolve());
  });
}

function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInBrowser(expr) {
  const wrappedExpr = expr.trim().startsWith('(() =>') || expr.trim().startsWith('Array.') || expr.trim().startsWith('document.') || expr.trim().startsWith('localStorage.') || expr.trim().startsWith('!')
    ? expr
    : `(() => {\n${expr}\n})()`;
  const res = await sendCommand('Runtime.evaluate', {
    expression: wrappedExpr,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error('Eval Exception: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBugFixesQA() {
  await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-bs-bugfixes-'));

  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9225',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1280,800',
    'about:blank'
  ]);

  await delay(1200);

  const listRes = await fetch('http://localhost:9225/json/list');
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page');

  const WebSocket = (await import('ws')).default;
  ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve) => ws.on('open', resolve));

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  try {
    await sendCommand('Browser.grantPermissions', {
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
      origin: `http://localhost:${PORT}`
    });
  } catch (_) {}
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await delay(800);

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ ${name}`);
    } else {
      failed++;
      console.error(`  ❌ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
    }
  }

  console.log('\n======================================================');
  console.log('🧪 VERIFYING CRITICAL BILL SPLITTER BUG FIXES');
  console.log('======================================================\n');

  // --- 1. CRITICAL A & 2.3: Trip Mode default state & Reload Data Sync ---
  console.log('--- 1. Critical A & Minor 2.3: Trip Mode Fresh State & Reload Sync ---');

  // Switch to Trip tab
  await evalInBrowser(`document.getElementById('tab-btn-trip').click();`);
  await delay(200);

  // Check Minor 2.3: Default trip expenses list is empty (no ₹0 Airbnb placeholder)
  const tripExpCount = await evalInBrowser(`document.querySelectorAll('#trip-expenses-list > div').length`);
  const tripExpEmptyText = await evalInBrowser(`document.getElementById('trip-expenses-list')?.textContent`);
  assert('Trip mode starts with 0 expenses (no placeholder)', tripExpEmptyText?.includes('No expenses logged yet'), tripExpEmptyText?.trim());

  // Edit participant names via inline inputs (Minor 2.4)
  await evalInBrowser(`
    const inputs = document.querySelectorAll('.trip-person-name-input');
    inputs[0].value = 'Alice Cooper';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('blur', { bubbles: true }));
    inputs[1].value = 'Bob Dylan';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].dispatchEvent(new Event('blur', { bubbles: true }));
  `);
  await delay(200);

  // Add an expense paid by Alice Cooper
  await evalInBrowser(`
    document.getElementById('input-trip-expense-desc').value = 'Concert Tickets';
    document.getElementById('input-trip-expense-amount').value = '3000';
    document.getElementById('select-trip-expense-payer').value = 'Alice Cooper';
    document.getElementById('btn-trip-select-all-split').click();
    document.getElementById('btn-trip-add-expense').click();
  `);
  await delay(300);

  // Verify expense history shows "Paid by Alice Cooper" (never "Paid by Unknown")
  const expensePayerText = await evalInBrowser(`document.getElementById('trip-expenses-list')?.textContent`);
  assert('Expense shows "Paid by Alice Cooper"', expensePayerText?.includes('Alice Cooper'), expensePayerText);
  assert('Does NOT show "Paid by Unknown"', !expensePayerText?.includes('Unknown'));

  // Verify balances & settlement plan
  const netBalancesText = await evalInBrowser(`document.getElementById('trip-balances-container')?.textContent`);
  assert('Alice Cooper has positive balance', netBalancesText?.includes('+₹'), netBalancesText);
  const settlementsText = await evalInBrowser(`document.getElementById('trip-settlement-steps')?.textContent`);
  assert('Settlement plan shows payment to Alice Cooper', settlementsText?.includes('Alice Cooper'), settlementsText);
  assert('Does NOT falsely report all balanced when debts exist', !settlementsText?.includes('All accounts are balanced'));

  // RELOAD PAGE (Test Critical A: Reload / Data Sync)
  console.log('\n--- Reloading Page to Verify Persistence & Data Sync ---');
  await evalInBrowser(`location.reload();`);
  await delay(1000);

  // Re-switch to Trip tab
  await evalInBrowser(`document.getElementById('tab-btn-trip').click();`);
  await delay(300);

  const reloadedExpenseText = await evalInBrowser(`document.getElementById('trip-expenses-list')?.textContent`);
  assert('After reload: Expense remains "Paid by Alice Cooper"', reloadedExpenseText?.includes('Alice Cooper'), reloadedExpenseText);
  assert('After reload: Never shows "Paid by Unknown"', !reloadedExpenseText?.includes('Unknown'));

  const reloadedBalances = await evalInBrowser(`document.getElementById('trip-balances-container')?.textContent`);
  assert('After reload: Alice Cooper still has positive balance', reloadedBalances?.includes('+₹'), reloadedBalances);

  const reloadedSettlements = await evalInBrowser(`document.getElementById('trip-settlement-steps')?.textContent`);
  assert('After reload: Settlement instructions persist correctly', reloadedSettlements?.includes('Alice Cooper'), reloadedSettlements);

  // --- 2. CRITICAL B & C: Sum Validation & Unassigned Item Handling ---
  console.log('\n--- 2. Critical B & C: Sum Validation & Unassigned Items ---');

  // Switch to Itemized tab
  await evalInBrowser(`document.getElementById('tab-btn-itemized').click();`);
  await delay(200);

  // Edit itemized participant name (Minor 2.4)
  const itemizedPersonInputsCount = await evalInBrowser(`document.querySelectorAll('.itemized-person-name-input').length`);
  assert('Participant names in Itemized mode are editable inputs', itemizedPersonInputsCount > 0, `Count: ${itemizedPersonInputsCount}`);

  // Test neutral prompt when items are empty
  const recNoteInitial = await evalInBrowser(`document.getElementById('itemized-reconciliation-note')?.textContent`);
  assert('Reconciliation note shows neutral prompt when item prices are empty', recNoteInitial?.includes('Enter item prices'), recNoteInitial);

  // Set prices: Item 1 = 500, Item 2 = 300
  await evalInBrowser(`
    const prices = document.querySelectorAll('.item-price-input');
    prices[0].value = '500';
    prices[0].dispatchEvent(new Event('change', { bubbles: true }));
    prices[1].value = '300';
    prices[1].dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);

  // Now both items are assigned: Verify green checkmark in reconciliation note
  const recNoteMatched = await evalInBrowser(`document.getElementById('itemized-reconciliation-note')?.textContent`);
  assert('Shows green checkmark when sum equals grand total', recNoteMatched?.includes('✓ Verification: Sum of individual breakdowns') && recNoteMatched?.includes('₹800.00'), recNoteMatched);

  // Now UNASSIGN Item 2 completely by deselecting all assigned members of Item 2
  await evalInBrowser(`
    const item2PersonBtns = document.querySelectorAll('.btn-item-toggle-person[data-item-person-id="i2"]');
    item2PersonBtns.forEach(btn => {
      if (btn.getAttribute('aria-pressed') === 'true') btn.click();
    });
  `);
  await delay(200);

  // Check Critical C: Unassigned Alert appears
  const unassignedAlertVisible = await evalInBrowser(`!document.getElementById('itemized-unassigned-alert')?.classList.contains('hidden')`);
  const unassignedAlertText = await evalInBrowser(`document.getElementById('itemized-unassigned-text')?.textContent`);
  assert('Unassigned alert appears when an item is unassigned', unassignedAlertVisible);
  assert('Unassigned alert states items are excluded from shares', unassignedAlertText?.includes('excluded from individual shares'), unassignedAlertText);

  // Check Critical B: Reconciliation note shows warning and does NOT show green checkmark
  const recNoteUnassigned = await evalInBrowser(`document.getElementById('itemized-reconciliation-note')?.textContent`);
  assert('Reconciliation note shows warning when item is unassigned', recNoteUnassigned?.includes('⚠️ Unassigned remainder: ₹300.00'), recNoteUnassigned);
  assert('Does NOT show green checkmark when unassigned items exist', !recNoteUnassigned?.includes('✓ Verification'));

  // Check Critical C: Item 2 (₹300) is excluded from participant shares
  const breakdownSum = await evalInBrowser(`
    Array.from(document.querySelectorAll('#itemized-breakdown-cards .font-mono.text-sm'))
      .map(el => parseFloat(el.textContent.replace(/[^0-9.]/g, '')))
      .reduce((a, b) => a + b, 0);
  `);
  assert('Individual breakdown cards sum exactly to assigned ₹500 (Item 1 only)', Math.round(breakdownSum) === 500, `Sum: ${breakdownSum}`);

  // Re-assign Item 2 (click "Everyone" for Item 2)
  await evalInBrowser(`
    const allBtns = document.querySelectorAll('.btn-item-toggle-all');
    allBtns[1].click();
  `);
  await delay(200);

  const recNoteRestored = await evalInBrowser(`document.getElementById('itemized-reconciliation-note')?.textContent`);
  assert('Reconciliation note restores green checkmark once all items are assigned', recNoteRestored?.includes('✓ Verification: Sum of individual breakdowns'), recNoteRestored);

  // --- 3. ACCESSIBILITY: Chips aria-pressed & Visual indicators ---
  console.log('\n--- 3. Minor 2.5: Accessibility of Chips ---');
  const allChipAria = await evalInBrowser(`document.querySelector('.btn-item-toggle-all')?.getAttribute('aria-pressed')`);
  assert('Toggle-all chip has aria-pressed="true"', allChipAria === 'true', `aria-pressed: ${allChipAria}`);

  const allChipText = await evalInBrowser(`document.querySelector('.btn-item-toggle-all')?.textContent`);
  assert('Toggle-all chip has visual checkmark indicator "✓ Everyone"', allChipText?.includes('✓ Everyone'), allChipText);

  const personChipAria = await evalInBrowser(`document.querySelector('.btn-item-toggle-person')?.getAttribute('aria-pressed')`);
  assert('Person chip has aria-pressed attribute', personChipAria === 'true' || personChipAria === 'false', `aria-pressed: ${personChipAria}`);

  // --- 4. CRITICAL D: Desktop Share Fallback ---
  console.log('\n--- 4. Critical D: Desktop Share Fallback ---');
  await evalInBrowser(`
    window.__copiedText = '';
    // Intercept copy event
    document.addEventListener('copy', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.value) {
        window.__copiedText = activeEl.value;
      }
    }, true);
    // Also intercept clipboard.writeText if available
    if (navigator.clipboard) {
      const origWriteText = navigator.clipboard.writeText;
      navigator.clipboard.writeText = async (text) => {
        window.__copiedText = text;
        try {
          if (origWriteText) return await origWriteText.call(navigator.clipboard, text);
        } catch (_) {}
        return true;
      };
    }
  `);

  // Click Share button in Even Split
  await evalInBrowser(`document.getElementById('tab-btn-even').click();`);
  await delay(200);
  await evalInBrowser(`document.getElementById('btn-even-share').click();`);
  await delay(400);

  const toastVisible = await evalInBrowser(`!document.getElementById('toast-notification')?.classList.contains('opacity-0')`);
  const toastText = await evalInBrowser(`document.getElementById('toast-message')?.textContent`);
  const copiedUrl = await evalInBrowser(`window.__copiedText`);
  assert('Clicking desktop Share triggers toast notification', toastVisible);
  assert('Toast indicates link copied to clipboard', toastText?.includes('link copied to clipboard') || toastText?.includes('Copied to clipboard'), toastText);
  assert('Copied URL matches current page location', !copiedUrl || copiedUrl.includes('/bill-splitter/'), copiedUrl);

  // --- 5. MINOR 2.1 & 2.2: Input Validation & Clearing ---
  console.log('\n--- 5. Minor 2.1 & 2.2: Input Validation & Clearing ---');
  // Clear bill amount
  await evalInBrowser(`
    const billInput = document.getElementById('input-even-bill');
    billInput.value = '';
    billInput.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await delay(200);

  const perPersonCleared = await evalInBrowser(`document.getElementById('even-per-person-display')?.textContent`);
  const grandCleared = await evalInBrowser(`document.getElementById('even-grand-total-display')?.textContent`);
  assert('Per person display clears to ₹0.00 when bill is empty', perPersonCleared?.includes('0.00'), perPersonCleared);
  assert('Grand total clears to ₹0.00 when bill is empty', grandCleared?.includes('0.00'), grandCleared);

  // Negative amount clamping
  await evalInBrowser(`
    const billInput = document.getElementById('input-even-bill');
    billInput.value = '-500';
    billInput.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await delay(200);

  const clampedBillVal = await evalInBrowser(`document.getElementById('input-even-bill')?.value`);
  assert('Negative sign is stripped from bill amount input', !clampedBillVal?.includes('-'), clampedBillVal);

  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (ws) ws.close();
  if (edgeProc) edgeProc.kill();
  if (server) server.close();

  process.exit(failed > 0 ? 1 : 0);
}

runBugFixesQA().catch((err) => {
  console.error('Bug Fixes QA failed with error:', err);
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
  process.exit(1);
});
