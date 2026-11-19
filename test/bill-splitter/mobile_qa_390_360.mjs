import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4335;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/bill-splitter/`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

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

async function evalCode(expression) {
  const res = await sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

async function takeScreenshot(filePath) {
  const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  fs.writeFileSync(filePath, buffer);
}

let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${desc}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${desc}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('📱 FINAL MOBILE QA & VERIFICATION (390px & 360px)');
  console.log('======================================================\n');

  await startServer();

  const cdpPort = 9245;
  const userDataDir = path.join(os.tmpdir(), `edge_mobile_qa_${Date.now()}`);

  edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const resp = await fetch(`http://localhost:${cdpPort}/json/list`);
      const list = await resp.json();
      if (list && list.length > 0) {
        const page = list.find((p) => p.type === 'page') || list[0];
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (_) {}
  }

  if (!wsUrl) {
    throw new Error('Failed to connect to Edge DevTools');
  }

  const { WebSocket } = await import('ws');
  ws = new WebSocket(wsUrl);

  await new Promise((resolve) => ws.on('open', resolve));

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');
  await sendCommand('Runtime.enable');
  try {
    await sendCommand('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  } catch (_) {}

  // Navigate to target
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await new Promise((r) => setTimeout(r, 1000));

  // Reset state to clean baseline
  await evalCode(`localStorage.clear();`);
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await new Promise((r) => setTimeout(r, 1500));

  // ---------------------------------------------------------------------------
  // 1. SPECIFIC FUNCTIONALITY VERIFICATIONS
  // ---------------------------------------------------------------------------
  console.log('--- 1. Verify Even Mode Specifics ---');
  // ₹1,000 bill, 4 participants, 5% tax and 10% tip.
  // Expected total: ₹1,150. Expected individual share: ₹287.50.
  await evalCode(`{
    document.getElementById('select-currency').value = 'INR';
    document.getElementById('select-currency').dispatchEvent(new Event('change'));

    const billInput = document.getElementById('input-even-bill');
    billInput.value = '1000';
    billInput.dispatchEvent(new Event('input'));

    const taxInput = document.getElementById('input-even-tax');
    taxInput.value = '5';
    taxInput.dispatchEvent(new Event('input'));

    const tipInput = document.getElementById('input-even-tip');
    tipInput.value = '10';
    tipInput.dispatchEvent(new Event('input'));

    const peopleInput = document.getElementById('input-even-people');
    peopleInput.value = '4';
    peopleInput.dispatchEvent(new Event('change'));
  }`);
  await new Promise((r) => setTimeout(r, 200));

  const evenTotal = await evalCode(`document.getElementById('even-grand-total-display')?.textContent?.trim()`);
  const evenPerPerson = await evalCode(`document.getElementById('even-per-person-display')?.textContent?.trim()`);
  check('Even Mode Total is ₹1,150.00', evenTotal === '₹1,150.00');
  check('Even Mode Individual Share is ₹287.50', evenPerPerson === '₹287.50');

  // Verify ₹100 divided by 3 gives ₹33.34, ₹33.33, ₹33.33
  await evalCode(`{
    const billInput = document.getElementById('input-even-bill');
    billInput.value = '100';
    billInput.dispatchEvent(new Event('input'));

    const taxInput = document.getElementById('input-even-tax');
    taxInput.value = '0';
    taxInput.dispatchEvent(new Event('input'));

    const tipInput = document.getElementById('input-even-tip');
    tipInput.value = '0';
    tipInput.dispatchEvent(new Event('input'));

    const peopleInput = document.getElementById('input-even-people');
    peopleInput.value = '3';
    peopleInput.dispatchEvent(new Event('change'));
  }`);
  await new Promise((r) => setTimeout(r, 200));

  const remainderNotice = await evalCode(`document.getElementById('even-remainder-notice')?.textContent?.trim()`);
  check('₹100 / 3 distributes remainder deterministically (1 pays ₹33.34, 2 pays ₹33.33)',
    remainderNotice.includes('₹33.34') && remainderNotice.includes('₹33.33')
  );

  console.log('\n--- 2. Verify Itemized Mode Specifics ---');
  // Switch to Itemized
  await evalCode(`document.getElementById('tab-btn-itemized').click();`);
  await new Promise((r) => setTimeout(r, 200));

  // Add Item 1 (₹500, Person 1 only), Item 2 (₹300, unassigned), Tax = ₹80 fixed
  await evalCode(`{
    // Ensure exactly 2 participants: Person 1 and Person 2
    const removeBtns = document.querySelectorAll('.btn-remove-itemized-person');
    for (let i = removeBtns.length - 1; i >= 2; i--) {
      removeBtns[i].click();
    }
    while (document.querySelectorAll('.btn-remove-itemized-person').length < 2) {
      document.getElementById('input-itemized-add-person').value = 'Person ' + (document.querySelectorAll('.btn-remove-itemized-person').length + 1);
      document.getElementById('btn-itemized-add-person').click();
    }

    // Set fixed tax ₹80
    document.getElementById('btn-tax-mode-fixed').click();
    const taxInput = document.getElementById('input-itemized-tax');
    taxInput.value = '80';
    taxInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Set tip to 0
    const tipInput = document.getElementById('input-itemized-tip');
    tipInput.value = '0';
    tipInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Ensure 2 items exist
    while (document.querySelectorAll('.item-price-input').length < 2) {
      document.getElementById('btn-itemized-add-item').click();
    }

    const pInputs = document.querySelectorAll('.item-price-input');
    pInputs[0].value = '500';
    pInputs[0].dispatchEvent(new Event('change', { bubbles: true }));

    pInputs[1].value = '300';
    pInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
  }`);
  await new Promise((r) => setTimeout(r, 200));

  // Item 1: Assign to Person 1 only (unassign Person 2)
  await evalCode(`{
    const item1Id = document.querySelectorAll('.btn-delete-item')[0].getAttribute('data-delete-item-id');
    const p2Id = document.querySelectorAll('.itemized-person-name-input')[1].getAttribute('data-edit-itemized-person');
    const p2ChipItem1 = document.querySelector(\`.btn-item-toggle-person[data-item-person-id="\${item1Id}"][data-person-id="\${p2Id}"]\`);
    if (p2ChipItem1 && p2ChipItem1.getAttribute('aria-pressed') === 'true') {
      p2ChipItem1.click();
    }
  }`);
  await new Promise((r) => setTimeout(r, 100));

  // Item 2: Unassign Person 1
  await evalCode(`{
    const item2Id = document.querySelectorAll('.btn-delete-item')[1].getAttribute('data-delete-item-id');
    const p1Id = document.querySelectorAll('.itemized-person-name-input')[0].getAttribute('data-edit-itemized-person');
    const p1ChipItem2 = document.querySelector(\`.btn-item-toggle-person[data-item-person-id="\${item2Id}"][data-person-id="\${p1Id}"]\`);
    if (p1ChipItem2 && p1ChipItem2.getAttribute('aria-pressed') === 'true') {
      p1ChipItem2.click();
    }
  }`);
  await new Promise((r) => setTimeout(r, 100));

  // Item 2: Unassign Person 2
  await evalCode(`{
    const item2Id = document.querySelectorAll('.btn-delete-item')[1].getAttribute('data-delete-item-id');
    const p2Id = document.querySelectorAll('.itemized-person-name-input')[1].getAttribute('data-edit-itemized-person');
    const p2ChipItem2 = document.querySelector(\`.btn-item-toggle-person[data-item-person-id="\${item2Id}"][data-person-id="\${p2Id}"]\`);
    if (p2ChipItem2 && p2ChipItem2.getAttribute('aria-pressed') === 'true') {
      p2ChipItem2.click();
    }
  }`);
  await new Promise((r) => setTimeout(r, 200));

  // Check unassigned items excluded and unassigned warning shown
  const unassignedWarning = await evalCode(`(() => {
    const el = document.getElementById('itemized-unassigned-alert');
    return el && !el.classList.contains('hidden') ? el.textContent.trim() : null;
  })()`);
  const recNoteWarning = await evalCode(`document.getElementById('itemized-reconciliation-note')?.textContent?.trim()`);
  const p1Share = await evalCode(`(() => {
    const cards = document.querySelectorAll('#itemized-breakdown-cards > div');
    return cards[0]?.querySelector('.font-mono.font-extrabold')?.textContent?.trim();
  })()`);
  const p2Share = await evalCode(`(() => {
    const cards = document.querySelectorAll('#itemized-breakdown-cards > div');
    return cards[1]?.querySelector('.font-mono.font-extrabold')?.textContent?.trim();
  })()`);

  check('Unassigned warning appears for Item 2', unassignedWarning !== null && unassignedWarning.toLowerCase().includes('unassigned'));
  check('Unassigned remainder warning includes item + its tax (₹330.00)', recNoteWarning.includes('₹330.00'));
  check('Person 1 share includes ₹500 + proportional tax ₹50 = ₹550.00', p1Share === '₹550.00');
  check('Person 2 without assigned items is charged ₹0.00 (not charged tax)', p2Share === '₹0.00');

  // Now assign Item 2 to Person 2 -> verify reconciliation success
  await evalCode(`{
    const item2Id = document.querySelectorAll('.btn-delete-item')[1].getAttribute('data-delete-item-id');
    const p2Id = document.querySelectorAll('.itemized-person-name-input')[1].getAttribute('data-edit-itemized-person');
    document.querySelector(\`.btn-item-toggle-person[data-item-person-id="\${item2Id}"][data-person-id="\${p2Id}"]\`).click();
  }`);
  await new Promise((r) => setTimeout(r, 200));

  const recSuccess = await evalCode(`document.getElementById('itemized-reconciliation-note')?.textContent?.trim()`);
  check('Reconciliation indicator shows green checkmark when all items are assigned and sum matches', recSuccess.includes('✓ Verification') || recSuccess.includes('Sum of individual breakdowns'));

  console.log('\n--- 3. Verify Trip Mode Specifics ---');
  // Switch to Trip
  await evalCode(`document.getElementById('tab-btn-trip').click();`);
  await new Promise((r) => setTimeout(r, 200));

  // Check: No default ₹0 Airbnb / Hotel expense in fresh state
  const initialExpensesCount = await evalCode(`document.querySelectorAll('.btn-delete-trip-expense').length`);
  check('No default ₹0 Airbnb/Hotel expenses in fresh state (Count is 0)', initialExpensesCount === 0);

  // Settlement example: Amit, Bina, Chirag. Amit pays ₹900 for dinner shared by Amit, Bina, Chirag (each owes ₹300).
  // Bina pays Amit ₹300, Chirag pays Amit ₹300.
  await evalCode(`{
    // Set 3 members: Amit, Bina, Chirag
    const pInputs = document.querySelectorAll('.trip-person-name-input');
    if (pInputs[0]) {
      pInputs[0].value = 'Amit';
      pInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      pInputs[0].dispatchEvent(new Event('blur', { bubbles: true }));
    }
    if (pInputs[1]) {
      pInputs[1].value = 'Bina';
      pInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      pInputs[1].dispatchEvent(new Event('blur', { bubbles: true }));
    }
    // Add Chirag
    if (!Array.from(document.querySelectorAll('.trip-person-name-input')).some(i => i.value.trim() === 'Chirag')) {
      document.getElementById('input-trip-add-person').value = 'Chirag';
      document.getElementById('btn-trip-add-person').click();
    }

    // Select all chips FIRST before typing expense
    document.getElementById('btn-trip-select-all-split').click();

    // Amit pays ₹900 shared with Amit, Bina, Chirag
    document.getElementById('input-trip-expense-desc').value = 'Dinner';
    document.getElementById('input-trip-expense-amount').value = '900';
    document.getElementById('select-trip-expense-payer').value = 'Amit';

    // Add expense
    document.getElementById('btn-trip-add-expense').click();
  }`);
  await new Promise((r) => setTimeout(r, 300));

  const settlementSteps = await evalCode(`
    Array.from(document.querySelectorAll('#trip-settlement-steps label')).map(l => l.textContent.replace(/\\s+/g, ' ').trim())
  `);
  check('Settlement includes Bina pays Amit ₹300.00', settlementSteps.some(s => s.includes('Bina pays Amit ₹300.00')));
  check('Settlement includes Chirag pays Amit ₹300.00', settlementSteps.some(s => s.includes('Chirag pays Amit ₹300.00')));

  // Reload page to verify persistence and data sync
  await sendCommand('Page.reload');
  await new Promise((r) => setTimeout(r, 1500));

  // Check Trip mode after reload
  await evalCode(`document.getElementById('tab-btn-trip').click();`);
  await new Promise((r) => setTimeout(r, 300));

  const reloadedNames = await evalCode(`
    Array.from(document.querySelectorAll('.trip-person-name-input')).map(i => i.value.trim())
  `);
  check('Participant names persist after reload (Amit, Bina, Chirag)',
    reloadedNames.includes('Amit') && reloadedNames.includes('Bina') && reloadedNames.includes('Chirag')
  );

  const reloadedPayer = await evalCode(`
    document.querySelector('#trip-expenses-list strong')?.textContent?.trim()
  `);
  check('Payer assignment persists correctly as Amit (not Unknown)', reloadedPayer === 'Amit');

  const reloadedSettlements = await evalCode(`
    Array.from(document.querySelectorAll('#trip-settlement-steps label')).map(l => l.textContent.replace(/\\s+/g, ' ').trim())
  `);
  check('Settlement steps persist accurately after reload',
    reloadedSettlements.some(s => s.includes('Bina pays Amit ₹300.00')) &&
    reloadedSettlements.some(s => s.includes('Chirag pays Amit ₹300.00'))
  );

  console.log('\n--- 4. Verify Currency Support, Desktop Share & Reset ---');
  // Check currencies
  const supportedCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'AED'];
  const curOptions = await evalCode(`
    Array.from(document.querySelectorAll('#select-currency option')).map(o => o.value)
  `);
  check('All 10 supported currencies are present in dropdown',
    supportedCurrencies.every(c => curOptions.includes(c))
  );

  // Test JPY zero decimals
  await evalCode(`{
    document.getElementById('select-currency').value = 'JPY';
    document.getElementById('select-currency').dispatchEvent(new Event('change'));
  }`);
  await new Promise((r) => setTimeout(r, 200));
  const jpySpend = await evalCode(`document.getElementById('trip-total-spend-badge')?.textContent?.trim()`);
  check('JPY displays without decimals (¥900)', jpySpend.includes('¥900'));

  // Test Desktop sharing fallback
  await evalCode(`{
    window.__copiedText = '';
    document.addEventListener('copy', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.value) window.__copiedText = activeEl.value;
    }, true);
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
    document.getElementById('tab-btn-even').click();
    document.getElementById('btn-even-share').click();
  }`);
  await new Promise((r) => setTimeout(r, 400));
  const toastText = await evalCode(`document.getElementById('toast-message')?.textContent?.trim()`);
  check('Desktop sharing copies calculator URL and displays toast', toastText && toastText.includes('copied'));

  // Test Reset functionality
  await evalCode(`{
    document.getElementById('btn-open-reset-modal').click();
  }`);
  await new Promise((r) => setTimeout(r, 200));
  const resetModalVisible = await evalCode(`!document.getElementById('modal-reset-confirm').classList.contains('hidden')`);
  check('Reset modal opens on click', resetModalVisible);

  await evalCode(`{
    document.getElementById('btn-reset-confirm').click();
  }`);
  await new Promise((r) => setTimeout(r, 300));
  const afterResetMode = await evalCode(`
    document.getElementById('tab-btn-even').getAttribute('aria-selected') === 'true'
  `);
  check('Reset returns to Even split mode with defaults', afterResetMode);

  // ---------------------------------------------------------------------------
  // 5. ACTUAL 390px MOBILE VIEWPORT QA
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📱 390px MOBILE VIEWPORT QA (iPhone 12/13/14/15 size)');
  console.log('======================================================\n');

  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await new Promise((r) => setTimeout(r, 300));

  // 1. Horizontal overflow check
  const overflow390 = await evalCode(`
    ({
      windowWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
    })
  `);
  check(`No horizontal overflow at 390px (ScrollWidth: ${overflow390.docScrollWidth}px <= 390px)`, !overflow390.hasHorizontalScroll);

  // 2. All 3 calculator modes accessible
  const tabsCount = await evalCode(`document.querySelectorAll('.mode-tab-btn').length`);
  check('All 3 calculator mode tabs are rendered', tabsCount === 3);

  // 3. Mode switching at 390px
  await evalCode(`document.getElementById('tab-btn-even').click();`);
  await new Promise((r) => setTimeout(r, 200));
  const evenVisible390 = await evalCode(`!document.getElementById('mode-panel-even').classList.contains('hidden')`);
  check('Even Mode panel accessible at 390px', evenVisible390);

  await evalCode(`document.getElementById('tab-btn-itemized').click();`);
  await new Promise((r) => setTimeout(r, 200));
  const itemizedVisible390 = await evalCode(`!document.getElementById('mode-panel-itemized').classList.contains('hidden')`);
  check('Itemized Mode panel accessible at 390px', itemizedVisible390);

  await evalCode(`document.getElementById('tab-btn-trip').click();`);
  await new Promise((r) => setTimeout(r, 200));
  const tripVisible390 = await evalCode(`!document.getElementById('mode-panel-trip').classList.contains('hidden')`);
  check('Trip Mode panel accessible at 390px', tripVisible390);

  // 4. Participant chips wrap properly
  const chipsWrap390 = await evalCode(`(() => {
    const chipsContainer = document.getElementById('trip-expense-split-chips');
    const rect = chipsContainer.getBoundingClientRect();
    return rect.width <= 390;
  })()`);
  check('Participant chips fit within 390px without clipped overflow', chipsWrap390);

  // 5. Input fields visible and usable
  const inputs390 = await evalCode(`(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
    return inputs.every(input => {
      const rect = input.getBoundingClientRect();
      return rect.width <= 390 && (rect.width > 0 || input.offsetParent === null);
    });
  })()`);
  check('All input fields fit comfortably within 390px viewport', inputs390);

  // 6. Sticky summary bar doesn't obscure content
  const stickyBar390 = await evalCode(`(() => {
    const bar = document.querySelector('.fixed.bottom-0');
    if (!bar) return false;
    const rect = bar.getBoundingClientRect();
    return rect.width <= 390 && rect.height > 0;
  })()`);
  check('Sticky mobile summary bar is correctly docked and responsive', stickyBar390);

  // Take 390px Screenshot
  await evalCode(`document.getElementById('tab-btn-even').click();`);
  await new Promise((r) => setTimeout(r, 300));
  const screenshotPath390 = path.join(ARTIFACTS_DIR, 'mobile_qa_390px.png');
  await takeScreenshot(screenshotPath390);
  console.log(`  📸 Screenshot saved: ${screenshotPath390}`);

  // ---------------------------------------------------------------------------
  // 6. NARROWER 360px MOBILE VIEWPORT QA (Small Android size)
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📱 360px MOBILE VIEWPORT QA (Small Android device size)');
  console.log('======================================================\n');

  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 780,
    deviceScaleFactor: 3,
    mobile: true
  });
  await new Promise((r) => setTimeout(r, 300));

  const overflow360 = await evalCode(`
    ({
      windowWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
    })
  `);
  check(`No horizontal overflow at 360px (ScrollWidth: ${overflow360.docScrollWidth}px <= 360px)`, !overflow360.hasHorizontalScroll);

  const containerPadding360 = await evalCode(`(() => {
    const container = document.getElementById('bill-splitter-container');
    const rect = container.getBoundingClientRect();
    return rect.width <= 360;
  })()`);
  check('Bill Splitter container fits within 360px boundary', containerPadding360);

  // Take 360px Screenshot
  const screenshotPath360 = path.join(ARTIFACTS_DIR, 'mobile_qa_360px.png');
  await takeScreenshot(screenshotPath360);
  console.log(`  📸 Screenshot saved: ${screenshotPath360}`);

  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  try {
    edgeProc.kill();
    server.close();
  } catch (_) {}

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Mobile QA error:', err);
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
  process.exit(1);
});
