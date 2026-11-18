import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4328;
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
      '.webmanifest': 'application/manifest+json; charset=utf-8',
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
          console.log(`[404] ${req.url} -> ${filePath}`);
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

    server.listen(PORT, () => {
      console.log(`[QA] HTTP server listening on http://localhost:${PORT}`);
      resolve();
    });
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

async function launchEdge() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-bill-splitter-qa-'));
  console.log(`[QA] Launching Edge at ${EDGE_PATH}`);

  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  for (let attempt = 0; attempt < 30; attempt++) {
    await delay(300);
    try {
      const resp = await fetch('http://localhost:9222/json/list');
      const list = await resp.json();
      if (list && list.length > 0) {
        const page = list.find((p) => p.type === 'page') || list[0];
        console.log(`[QA] Found browser page: ${page.id}`);
        return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
  }
  throw new Error('Could not connect to Edge DevTools');
}

async function runQA() {
  let passed = 0;
  let failed = 0;

  function assert(desc, condition, detail = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ ${desc}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      console.error(`  ❌ FAIL: ${desc}${detail ? ` (${detail})` : ''}`);
    }
  }

  await startServer();
  const wsUrl = await launchEdge();
  const WebSocketModule = await import('ws');
  const WebSocket = WebSocketModule.default || WebSocketModule;

  ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));
  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    if (parsed.method === 'Runtime.consoleAPICalled') {
      const args = parsed.params.args.map(a => a.value || a.description).join(' ');
      console.log(`[Browser Console] ${parsed.params.type}: ${args}`);
    }
    if (parsed.method === 'Runtime.exceptionThrown') {
      console.error(`[Browser Error]`, parsed.params.exceptionDetails);
    }
    if (parsed.id && callbacks.has(parsed.id)) {
      const { resolve, reject } = callbacks.get(parsed.id);
      callbacks.delete(parsed.id);
      if (parsed.error) reject(parsed.error);
      else resolve(parsed.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('DOM.enable');

  console.log(`[QA] Navigating to ${TARGET_URL}...`);
  await sendCommand('Page.navigate', { url: TARGET_URL });
  await delay(2000);

  console.log('\n--- 1. SEO & Metadata Verification ---');
  const pageTitle = await evalInBrowser('document.title');
  assert('Title is exact', pageTitle === 'Free Bill Splitter Calculator (No Sign-Up)', pageTitle);

  const canonicalHref = await evalInBrowser(`document.querySelector('link[rel="canonical"]')?.href`);
  assert('Canonical URL matches', canonicalHref === 'https://freexpensetracker.com/bill-splitter/', canonicalHref);

  const h1Text = await evalInBrowser(`document.querySelector('h1')?.textContent?.trim()`);
  assert('H1 heading exists', h1Text === 'Free Bill Splitter Calculator', h1Text);

  const breadcrumbsSchema = await evalInBrowser(`
    Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => { try { return JSON.parse(s.textContent); } catch(e) { return null; } })
      .find(d => d && d['@type'] === 'BreadcrumbList')
  `);
  assert('BreadcrumbList schema present', breadcrumbsSchema && breadcrumbsSchema.itemListElement?.length === 2);

  const faqSchema = await evalInBrowser(`
    Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => { try { return JSON.parse(s.textContent); } catch(e) { return null; } })
      .find(d => d && d['@type'] === 'FAQPage')
  `);
  assert('FAQPage schema present with 7 FAQs', faqSchema && faqSchema.mainEntity?.length === 7);

  console.log('\n--- 2. Mode 1: Even Split Interactive QA ---');
  // Fill bill amount
  await evalInBrowser(`
    const el = document.getElementById('input-even-bill');
    el.value = '2400';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await delay(200);

  // Fill tax
  await evalInBrowser(`
    const el = document.getElementById('input-even-tax');
    el.value = '5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await delay(200);

  // Click 10% tip preset button
  await evalInBrowser(`
    document.querySelector('#even-tip-presets button[data-tip="10"]').click();
  `);
  await delay(200);

  // Change people count to 4
  await evalInBrowser(`
    const pEl = document.getElementById('input-even-people');
    pEl.value = '4';
    pEl.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);

  const evenSubtotal = await evalInBrowser(`document.getElementById('even-subtotal-display')?.textContent`);
  const evenTax = await evalInBrowser(`document.getElementById('even-tax-display')?.textContent`);
  const evenTip = await evalInBrowser(`document.getElementById('even-tip-display')?.textContent`);
  const evenGrand = await evalInBrowser(`document.getElementById('even-grand-total-display')?.textContent`);
  const evenPerPerson = await evalInBrowser(`document.getElementById('even-per-person-display')?.textContent`);

  assert('Even subtotal correct', evenSubtotal?.includes('2,400'), evenSubtotal);
  assert('Even tax correct (5% = ₹120)', evenTax?.includes('120'), evenTax);
  assert('Even tip correct (10% on bill = ₹240)', evenTip?.includes('240'), evenTip);
  assert('Even grand total correct (₹2,760)', evenGrand?.includes('2,760'), evenGrand);
  assert('Even per person correct (4 people = ₹690)', evenPerPerson?.includes('690'), evenPerPerson);

  // Test Tip on Bill+Tax toggle
  await evalInBrowser(`
    const toggle = document.getElementById('toggle-even-tip-on-tax');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);
  const evenTipOnTax = await evalInBrowser(`document.getElementById('even-tip-display')?.textContent`);
  const evenGrandOnTax = await evalInBrowser(`document.getElementById('even-grand-total-display')?.textContent`);
  const evenPerPersonOnTax = await evalInBrowser(`document.getElementById('even-per-person-display')?.textContent`);
  assert('Tip on Bill+Tax calculates ₹252 (10% of 2520)', evenTipOnTax?.includes('252'), evenTipOnTax);
  assert('Grand total updates to ₹2,772', evenGrandOnTax?.includes('2,772'), evenGrandOnTax);
  assert('Per person updates to ₹693', evenPerPersonOnTax?.includes('693'), evenPerPersonOnTax);

  // Test Currency switch to USD
  await evalInBrowser(`
    const sel = document.getElementById('select-currency');
    sel.value = 'USD';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);
  const usdPerPerson = await evalInBrowser(`document.getElementById('even-per-person-display')?.textContent`);
  assert('Switches currency to USD symbol', usdPerPerson?.includes('$693.00'), usdPerPerson);

  // Test Currency switch to JPY (zero decimals)
  await evalInBrowser(`
    const sel = document.getElementById('select-currency');
    sel.value = 'JPY';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);
  const jpyPerPerson = await evalInBrowser(`document.getElementById('even-per-person-display')?.textContent`);
  assert('JPY formats with zero decimals', !jpyPerPerson?.includes('.'), jpyPerPerson);

  // Switch back to INR
  await evalInBrowser(`
    const sel = document.getElementById('select-currency');
    sel.value = 'INR';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);

  console.log('\n--- 3. Mode 2: Itemized Split Interactive QA ---');
  // Switch to Itemized Split tab
  await evalInBrowser(`document.getElementById('tab-btn-itemized').click();`);
  await delay(300);

  const isItemizedVisible = await evalInBrowser(`!document.getElementById('mode-panel-itemized')?.classList.contains('hidden')`);
  assert('Itemized panel is visible', isItemizedVisible);

  // Add person "Charlie"
  await evalInBrowser(`
    const input = document.getElementById('input-itemized-add-person');
    input.value = 'Charlie';
    document.getElementById('btn-itemized-add-person').click();
  `);
  await delay(200);
  const participantsCount = await evalInBrowser(`document.querySelectorAll('#itemized-participants-list span').length`);
  assert('Added Charlie to participants', participantsCount >= 3, `Count: ${participantsCount}`);

  // Add Item "Woodfired Pizza" price 600
  await evalInBrowser(`
    document.getElementById('btn-itemized-add-item').click();
  `);
  await delay(200);
  await evalInBrowser(`
    const items = document.querySelectorAll('.item-name-input');
    const prices = document.querySelectorAll('.item-price-input');
    const lastItem = items[items.length - 1];
    const lastPrice = prices[prices.length - 1];
    lastItem.value = 'Woodfired Pizza';
    lastItem.dispatchEvent(new Event('change', { bubbles: true }));
    lastPrice.value = '600';
    lastPrice.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await delay(200);

  // Toggle "Everyone" on that item
  await evalInBrowser(`
    const allBtns = document.querySelectorAll('.btn-item-toggle-all');
    allBtns[allBtns.length - 1].click();
  `);
  await delay(200);

  const itemizedSubtotal = await evalInBrowser(`document.getElementById('itemized-summary-subtotal')?.textContent`);
  assert('Itemized subtotal calculated', itemizedSubtotal?.includes('₹') || itemizedSubtotal?.length > 0, itemizedSubtotal);

  // Check breakdown cards rendered
  const breakdownCardsCount = await evalInBrowser(`document.querySelectorAll('#itemized-breakdown-cards > div').length`);
  assert('Individual breakdown cards rendered for all members', breakdownCardsCount >= 3, `Cards: ${breakdownCardsCount}`);

  console.log('\n--- 4. Mode 3: Trip / Group Split Interactive QA ---');
  // Switch to Trip tab
  await evalInBrowser(`document.getElementById('tab-btn-trip').click();`);
  await delay(300);

  const isTripVisible = await evalInBrowser(`!document.getElementById('mode-panel-trip')?.classList.contains('hidden')`);
  assert('Trip panel is visible', isTripVisible);

  // Add group member "Charlie"
  await evalInBrowser(`
    const input = document.getElementById('input-trip-add-person');
    input.value = 'Charlie';
    document.getElementById('btn-trip-add-person').click();
  `);
  await delay(200);

  // Add member "David"
  await evalInBrowser(`
    const input = document.getElementById('input-trip-add-person');
    input.value = 'David';
    document.getElementById('btn-trip-add-person').click();
  `);
  await delay(200);

  // Add Expense: "Airbnb Villa", amount 4000, paid by Alice, shared by all
  await evalInBrowser(`
    document.getElementById('input-trip-expense-desc').value = 'Airbnb Villa';
    document.getElementById('input-trip-expense-amount').value = '4000';
    document.getElementById('select-trip-expense-payer').value = 'Alice';
    document.getElementById('btn-trip-select-all-split').click();
    document.getElementById('btn-trip-add-expense').click();
  `);
  await delay(300);

  // Add Expense: "Dinner", amount 1200, paid by Bob, shared by all
  await evalInBrowser(`
    document.getElementById('input-trip-expense-desc').value = 'Dinner';
    document.getElementById('input-trip-expense-amount').value = '1200';
    document.getElementById('select-trip-expense-payer').value = 'Bob';
    document.getElementById('btn-trip-select-all-split').click();
    document.getElementById('btn-trip-add-expense').click();
  `);
  await delay(300);

  const totalSpendBadge = await evalInBrowser(`document.getElementById('trip-total-spend-badge')?.textContent`);
  assert('Total trip spend is ₹5,200', totalSpendBadge?.includes('5,200'), totalSpendBadge);

  const settlementStepsCount = await evalInBrowser(`document.querySelectorAll('#trip-settlement-steps label').length`);
  assert('Calculates optimal settlement transfers', settlementStepsCount > 0, `Transfers: ${settlementStepsCount}`);

  const settlementText = await evalInBrowser(`document.getElementById('trip-settlement-steps')?.textContent`);
  assert('Settlement plan identifies debtors paying creditor', settlementText?.includes('pays') && settlementText?.includes('₹'), settlementText?.replace(/\s+/g, ' ').substring(0, 100));

  console.log('\n--- 5. Persistence & LocalStorage QA ---');
  const storedState = await evalInBrowser(`localStorage.getItem('bs_v1')`);
  assert('localStorage bs_v1 key exists', !!storedState);
  if (storedState) {
    const parsed = JSON.parse(storedState);
    assert('Stored currency is INR', parsed.currency === 'INR', parsed.currency);
    assert('Stored trip expenses count >= 2', parsed.tripSplit?.expenses?.length >= 2, `Count: ${parsed.tripSplit?.expenses?.length}`);
  }

  console.log('\n--- 6. Reset All Modal QA ---');
  await evalInBrowser(`document.getElementById('btn-open-reset-modal').click();`);
  await delay(200);
  const isResetModalOpen = await evalInBrowser(`!document.getElementById('modal-reset-confirm')?.classList.contains('hidden')`);
  assert('Reset confirmation modal opens', isResetModalOpen);

  await evalInBrowser(`document.getElementById('btn-reset-confirm').click();`);
  await delay(300);
  const isResetModalClosed = await evalInBrowser(`document.getElementById('modal-reset-confirm')?.classList.contains('hidden')`);
  assert('Reset confirmation modal closes on confirm', isResetModalClosed);

  const resetMode = await evalInBrowser(`!document.getElementById('mode-panel-even')?.classList.contains('hidden')`);
  assert('Resets to Even Split mode', resetMode);

  console.log('\n--- 7. Educational Guide & FAQ Content QA ---');
  const guideSectionsCount = await evalInBrowser(`document.querySelectorAll('#section-bill-splitter-guide article').length`);
  assert('Educational guide has 6 detailed article sections', guideSectionsCount >= 6, `Found: ${guideSectionsCount}`);

  const faqDetailsCount = await evalInBrowser(`document.querySelectorAll('#section-bill-splitter-faq details').length`);
  assert('FAQ accordion has 7 questions', faqDetailsCount === 7, `Found: ${faqDetailsCount}`);

  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (ws) ws.close();
  if (edgeProc) edgeProc.kill();
  if (server) server.close();

  process.exit(failed > 0 ? 1 : 0);
}

runQA().catch((err) => {
  console.error('Browser QA failed with error:', err);
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
  process.exit(1);
});
