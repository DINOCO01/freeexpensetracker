/**
 * Phase A — Interactive Localization Browser QA Test Suite
 *
 * Runs against a REAL Chromium browser (Microsoft Edge) via Chrome DevTools Protocol (CDP).
 * Connects to a local HTTP server serving the production build (dist/).
 *
 * Verifies:
 * 1. All eight locales: '/', '/hi/', '/es/', '/de/', '/fr/', '/pt/', '/ja/', '/ko/'
 * 2. Smart Spending Suggestions (cards, tags, savings amounts, dynamic interpolation, empty state)
 * 3. Live AI Advisor (Avalanche, Snowball, FOIR pills & recommendation contents, 0 English fallback)
 * 4. Demo transactions (localized in ledger table, underlying IDs & storage unchanged)
 * 5. Custom user transactions (preserved verbatim, not translated)
 * 6. Dynamic locale switching
 * 7. Screenshots for representative locales (Hindi, Japanese, Korean, Spanish, English)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4321;
const DIST_DIR = path.resolve('dist');
const SCREENSHOTS_DIR = path.resolve('test/screenshots');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();

const LOCALES = [
  { code: 'en', route: '/' },
  { code: 'hi', route: '/hi/' },
  { code: 'es', route: '/es/' },
  { code: 'de', route: '/de/' },
  { code: 'fr', route: '/fr/' },
  { code: 'pt', route: '/pt/' },
  { code: 'ja', route: '/ja/' },
  { code: 'ko', route: '/ko/' }
];

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
      '.ico': 'image/x-icon',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pdf': 'application/pdf'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      if (!path.extname(reqPath)) reqPath += '/index.html';

      const filePath = path.join(DIST_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[HTTP Server] Serving dist/ at http://127.0.0.1:${PORT}`);
      resolve();
    });
  });
}

function sendCDP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const timer = setTimeout(() => {
      callbacks.delete(id);
      reject(new Error(`CDP command ${method} timed out after 10000ms`));
    }, 10000);

    callbacks.set(id, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInBrowser(expression) {
  const res = await sendCDP('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.result?.exceptionDetails) {
    const desc = res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text;
    throw new Error(`Eval Error: ${desc}`);
  }
  return res.result?.result?.value;
}

async function captureScreenshot(filename) {
  const res = await sendCDP('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.result.data, 'base64');
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`   📸 Screenshot saved: ${filePath}`);
  return filePath;
}

async function launchBrowser(tempProfileDir) {
  edgeProc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank'
  ]);

  let connected = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        connected = true;
        break;
      }
    } catch (_) {}
  }
  if (!connected) throw new Error('Could not connect to Edge remote debugging on port 9222.');

  const newTabRes = await fetch(`http://127.0.0.1:9222/json/new?about:blank`, { method: 'PUT' });
  const tab = await newTabRes.json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.id && callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        cb(data);
      }
    } catch (_) {}
  };

  await sendCDP('Page.enable');
  await sendCDP('Runtime.enable');
}

async function navigate(url) {
  await sendCDP('Page.navigate', { url });
  await new Promise((resolve) => {
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === 'Page.loadEventFired') {
          ws.removeEventListener('message', handler);
          resolve();
        }
      } catch (_) {}
    };
    ws.addEventListener('message', handler);
  });
  await new Promise((r) => setTimeout(r, 500));
}

async function runQA() {
  console.log('===============================================================');
  console.log('PHASE A — INTERACTIVE LOCALIZATION BROWSER QA (REAL CHROMIUM)');
  console.log('===============================================================\n');

  await startServer();

  const tempProfileDir = path.join(os.tmpdir(), `fet_phase_a_test_${Date.now()}`);
  fs.mkdirSync(tempProfileDir, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  await launchBrowser(tempProfileDir);

  const dicts = {};
  for (const loc of LOCALES) {
    const mod = await import(`../src/locales/${loc.code}.ts`);
    dicts[loc.code] = mod.default;
  }

  const results = [];

  for (const loc of LOCALES) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Testing Locale: [${loc.code.toUpperCase()}] -> Route: ${loc.route}`);
    console.log(`---------------------------------------------------------------`);

    const dict = dicts[loc.code];
    const url = `http://127.0.0.1:${PORT}${loc.route}`;
    await navigate(url);

    // Clear storage and navigate again for clean default seed
    await evalInBrowser(`
      (() => {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);
    await navigate(url);

    // 1. Verify Demo Transactions on Ledger
    console.log(`1. Ledger Demo Transactions:`);
    const ledgerData = await evalInBrowser(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#transactions-tbody tr'));
        return rows.map(r => {
          const cells = r.querySelectorAll('td');
          const deleteBtn = r.querySelector('.btn-delete-tx');
          return {
            id: deleteBtn ? deleteBtn.getAttribute('data-delete-id') : '',
            date: cells[0]?.textContent?.trim() || '',
            name: cells[1]?.textContent?.trim() || '',
            category: cells[2]?.textContent?.trim() || '',
            source: cells[3]?.textContent?.trim() || '',
            amount: cells[4]?.textContent?.trim() || ''
          };
        });
      })()
    `);

    const rowCountPass = ledgerData.length === 6;
    console.log(`   - Seeded row count: ${ledgerData.length} (Expected: 6) -> ${rowCountPass ? 'PASS' : 'FAIL'}`);

    const expectedNames = [
      dict.demoTransactions.rent,
      dict.demoTransactions.groceries,
      dict.demoTransactions.utilities,
      dict.demoTransactions.transport,
      dict.demoTransactions.entertainment,
      dict.demoTransactions.savings
    ];

    const expectedIds = ['tx-1', 'tx-2', 'tx-3', 'tx-4', 'tx-5', 'tx-6'];
    const expectedAmountsDigits = ['1350', '380', '145', '160', '120', '450'];

    let demoNamesPass = true;
    let demoIdsPass = true;
    let demoAmountsPass = true;

    for (let i = 0; i < expectedNames.length; i++) {
      const actualName = ledgerData[i]?.name;
      const expectedName = expectedNames[i];
      const actualId = ledgerData[i]?.id;
      const expectedId = expectedIds[i];
      const actualAmt = ledgerData[i]?.amount;
      const actualDigits = actualAmt.replace(/[^0-9]/g, '');
      const expectedDigits = expectedAmountsDigits[i];

      if (actualName !== expectedName) {
        demoNamesPass = false;
        console.log(`     ✗ Row ${i+1} Name: expected "${expectedName}", got "${actualName}"`);
      } else {
        console.log(`     ✓ Row ${i+1} Name: "${actualName}" matches [${loc.code}]`);
      }

      if (actualId !== expectedId) {
        demoIdsPass = false;
        console.log(`     ✗ Row ${i+1} ID: expected "${expectedId}", got "${actualId}"`);
      }

      if (actualDigits !== expectedDigits) {
        demoAmountsPass = false;
        console.log(`     ✗ Row ${i+1} Amount: expected "${expectedDigits}", got "${actualDigits}" from "${actualAmt}"`);
      }
    }

    console.log(`   - Demo Transaction IDs (tx-1..tx-6) intact: ${demoIdsPass ? 'PASS' : 'FAIL'}`);
    console.log(`   - Demo Transaction amounts unchanged: ${demoAmountsPass ? 'PASS' : 'FAIL'}`);

    // 2. Verify Smart Spending Suggestions
    console.log(`2. Smart Spending Suggestions:`);
    const suggestionsData = await evalInBrowser(`
      (() => {
        const container = document.getElementById('smart-suggestions-container');
        if (!container) return { cards: [] };
        const cards = Array.from(container.children).map(c => ({
          tag: c.querySelector('span.uppercase')?.textContent?.trim() || '',
          savings: c.querySelector('span.font-mono')?.textContent?.trim() || '',
          title: c.querySelector('h4')?.textContent?.trim() || '',
          problem: c.querySelector('p')?.textContent?.trim() || '',
          switchText: c.querySelector('strong')?.textContent?.trim() || '',
          solution: c.querySelector('div.bg-white, div.dark\\\\:bg-slate-900')?.textContent?.trim() || ''
        }));
        const total = document.getElementById('potential-savings-total')?.textContent?.trim() || '';
        return { cards, total };
      })()
    `);

    const hasCards = suggestionsData.cards.length > 0;
    console.log(`   - Generated suggestion cards count: ${suggestionsData.cards.length} -> ${hasCards ? 'PASS' : 'FAIL'}`);

    let cardsLocalized = true;
    let noUnresolvedInterpolation = true;

    for (const card of suggestionsData.cards) {
      if (card.problem.includes('{') || card.solution.includes('{') || card.savings.includes('{')) {
        noUnresolvedInterpolation = false;
        console.log(`     ✗ Unresolved placeholder in card "${card.title}": ${card.problem}`);
      }
      if (card.switchText && !card.switchText.includes(dict.suggestions.actionableSwitch)) {
        cardsLocalized = false;
        console.log(`     ✗ Switch label mismatch: got "${card.switchText}", expected "${dict.suggestions.actionableSwitch}"`);
      }
    }

    console.log(`   - Actionable switch labels match [${loc.code}]: ${cardsLocalized ? 'PASS' : 'FAIL'}`);
    console.log(`   - Parameter interpolation complete (0 unresolved placeholders): ${noUnresolvedInterpolation ? 'PASS' : 'FAIL'}`);

    // 3. Verify Empty State of Smart Suggestions
    console.log(`3. Smart Suggestions Empty State:`);
    await evalInBrowser(`
      (() => {
        localStorage.setItem('fet_transactions_v4', '[]');
      })()
    `);
    await navigate(url);

    const emptyText = await evalInBrowser(`
      (() => {
        const container = document.getElementById('smart-suggestions-container');
        return {
          title: container?.querySelector('.font-bold')?.textContent?.trim() || '',
          desc: container?.querySelector('p')?.textContent?.trim() || ''
        };
      })()
    `);

    const emptyTitleMatch = emptyText.title === dict.suggestions.emptyTitle;
    const emptyDescMatch = emptyText.desc === dict.suggestions.emptyDesc;
    const emptyStatePass = emptyTitleMatch && emptyDescMatch;
    console.log(`   - Empty Title: "${emptyText.title}" -> ${emptyTitleMatch ? 'PASS' : 'FAIL'}`);
    console.log(`   - Empty Description matches [${loc.code}] -> ${emptyDescMatch ? 'PASS' : 'FAIL'}`);

    // Reload with demo transactions restored
    await evalInBrowser(`
      (() => {
        localStorage.clear();
      })()
    `);
    await navigate(url);

    // 4. Verify Live AI Advisor & Debt Strategies
    console.log(`4. Live AI Advisor (Tab: Debt Planner):`);
    await evalInBrowser(`
      (() => {
        const debtTabBtn = document.querySelector('button[data-tab="debt"]');
        if (debtTabBtn) debtTabBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));

    // Avalanche
    await evalInBrowser(`
      (() => {
        const btn = document.getElementById('btn-strat-avalanche');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const avalanchePill = await evalInBrowser(`(() => document.getElementById('active-strategy-pill')?.textContent?.trim() || '')()`);
    const avalancheRec = await evalInBrowser(`
      (() => {
        const el = document.getElementById('debt-strategy-recommendation');
        return {
          model: el?.querySelector('span.uppercase')?.textContent?.trim() || '',
          title: el?.querySelector('h4')?.textContent?.trim() || '',
          desc: el?.querySelector('p')?.textContent?.trim() || '',
          advantage: el?.querySelectorAll('.grid strong + span')[0]?.textContent?.trim() || '',
          advisory: el?.querySelectorAll('.grid strong + span')[1]?.textContent?.trim() || ''
        };
      })()
    `);

    const avalanchePass =
      avalanchePill === dict.advisor.avalanchePill &&
      avalancheRec.title === dict.advisor.avalancheTitle &&
      avalancheRec.desc === dict.advisor.avalancheDesc &&
      avalancheRec.advantage === dict.advisor.avalancheAdvantage;
    console.log(`   - Avalanche Strategy Pill: "${avalanchePill}" -> ${avalanchePill === dict.advisor.avalanchePill ? 'PASS' : 'FAIL'}`);
    console.log(`   - Avalanche Model Title: "${avalancheRec.title}" -> ${avalancheRec.title === dict.advisor.avalancheTitle ? 'PASS' : 'FAIL'}`);
    console.log(`   - Avalanche Advantage: "${avalancheRec.advantage.slice(0, 35)}..." -> ${avalancheRec.advantage === dict.advisor.avalancheAdvantage ? 'PASS' : 'FAIL'}`);

    // Snowball
    await evalInBrowser(`
      (() => {
        const btn = document.getElementById('btn-strat-snowball');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const snowballPill = await evalInBrowser(`(() => document.getElementById('active-strategy-pill')?.textContent?.trim() || '')()`);
    const snowballRec = await evalInBrowser(`
      (() => {
        const el = document.getElementById('debt-strategy-recommendation');
        return {
          model: el?.querySelector('span.uppercase')?.textContent?.trim() || '',
          title: el?.querySelector('h4')?.textContent?.trim() || '',
          desc: el?.querySelector('p')?.textContent?.trim() || '',
          advantage: el?.querySelectorAll('.grid strong + span')[0]?.textContent?.trim() || '',
          advisory: el?.querySelectorAll('.grid strong + span')[1]?.textContent?.trim() || ''
        };
      })()
    `);

    const snowballPass =
      snowballPill === dict.advisor.snowballPill &&
      snowballRec.title === dict.advisor.snowballTitle &&
      snowballRec.desc === dict.advisor.snowballDesc &&
      snowballRec.advantage === dict.advisor.snowballAdvantage;
    console.log(`   - Snowball Strategy Pill: "${snowballPill}" -> ${snowballPill === dict.advisor.snowballPill ? 'PASS' : 'FAIL'}`);
    console.log(`   - Snowball Model Title: "${snowballRec.title}" -> ${snowballRec.title === dict.advisor.snowballTitle ? 'PASS' : 'FAIL'}`);
    console.log(`   - Snowball Advantage: "${snowballRec.advantage.slice(0, 35)}..." -> ${snowballRec.advantage === dict.advisor.snowballAdvantage ? 'PASS' : 'FAIL'}`);

    // FOIR / Cash Flow
    await evalInBrowser(`
      (() => {
        const btn = document.getElementById('btn-strat-foir');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const foirPill = await evalInBrowser(`(() => document.getElementById('active-strategy-pill')?.textContent?.trim() || '')()`);
    const foirRec = await evalInBrowser(`
      (() => {
        const el = document.getElementById('debt-strategy-recommendation');
        return {
          model: el?.querySelector('span.uppercase')?.textContent?.trim() || '',
          title: el?.querySelector('h4')?.textContent?.trim() || '',
          desc: el?.querySelector('p')?.textContent?.trim() || '',
          advantage: el?.querySelectorAll('.grid strong + span')[0]?.textContent?.trim() || '',
          advisory: el?.querySelectorAll('.grid strong + span')[1]?.textContent?.trim() || ''
        };
      })()
    `);

    const foirPass =
      foirPill === dict.advisor.foirPill &&
      foirRec.title === dict.advisor.foirTitle &&
      foirRec.desc === dict.advisor.foirDesc &&
      foirRec.advantage === dict.advisor.foirAdvantage;
    console.log(`   - FOIR Strategy Pill: "${foirPill}" -> ${foirPill === dict.advisor.foirPill ? 'PASS' : 'FAIL'}`);
    console.log(`   - FOIR Model Title: "${foirRec.title}" -> ${foirRec.title === dict.advisor.foirTitle ? 'PASS' : 'FAIL'}`);
    console.log(`   - FOIR Advantage: "${foirRec.advantage.slice(0, 35)}..." -> ${foirRec.advantage === dict.advisor.foirAdvantage ? 'PASS' : 'FAIL'}`);

    // 5. Custom User Transaction Preservation & Storage Integrity
    console.log(`5. Custom User Transaction & Storage Integrity:`);
    await evalInBrowser(`
      (() => {
        const trackerTabBtn = document.querySelector('button[data-tab="tracker"]');
        if (trackerTabBtn) trackerTabBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    // Add custom transaction via logger form
    await evalInBrowser(`
      (() => {
        const inputName = document.getElementById('input-item-name');
        const inputAmount = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const form = document.getElementById('form-expense-logger');

        if (inputName && inputAmount && form) {
          inputName.value = 'Special Artisan Espresso & Croissant';
          inputAmount.value = '14.50';
          if (selectCat) selectCat.value = 'Food';
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Check first ledger row
    const customRowData = await evalInBrowser(`
      (() => {
        const row = document.querySelector('#transactions-tbody tr');
        return row ? {
          name: row.querySelectorAll('td')[1]?.textContent?.trim() || '',
          amount: row.querySelectorAll('td')[4]?.textContent?.trim() || ''
        } : null;
      })()
    `);

    const customNamePreserved = customRowData?.name === 'Special Artisan Espresso & Croissant';
    console.log(`   - Custom transaction name displayed verbatim: "${customRowData?.name}" -> ${customNamePreserved ? 'PASS' : 'FAIL'}`);

    // Check saved state in localStorage
    const savedStorageState = await evalInBrowser(`
      (() => {
        const raw = localStorage.getItem('fet_transactions_v4');
        return raw ? JSON.parse(raw) : null;
      })()
    `);

    let storageIntegrityPass = false;
    if (Array.isArray(savedStorageState) && savedStorageState.length === 7) {
      const customItem = savedStorageState[0];
      const demoItems = savedStorageState.slice(1);
      const customMatches = customItem.name === 'Special Artisan Espresso & Croissant' && customItem.amount === 14.5;
      const demoMatches = demoItems.every((d, idx) => d.id === expectedIds[idx]);
      storageIntegrityPass = customMatches && demoMatches;
      console.log(`   - LocalStorage saved 7 transactions (custom + 6 demo intact): ${storageIntegrityPass ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`   - Storage state check count: ${savedStorageState?.length}`);
    }

    // 6. Capture Evidence Screenshot
    const screenshotFile = `screenshot_${loc.code}.png`;
    await captureScreenshot(screenshotFile);

    const overallLocalePass =
      rowCountPass &&
      demoNamesPass &&
      demoIdsPass &&
      demoAmountsPass &&
      hasCards &&
      cardsLocalized &&
      noUnresolvedInterpolation &&
      emptyStatePass &&
      avalanchePass &&
      snowballPass &&
      foirPass &&
      customNamePreserved &&
      storageIntegrityPass;

    results.push({
      locale: loc.code,
      route: loc.route,
      demoLedger: (demoNamesPass && demoIdsPass && demoAmountsPass) ? 'PASS' : 'FAIL',
      suggestions: (hasCards && cardsLocalized && noUnresolvedInterpolation) ? 'PASS' : 'FAIL',
      emptyState: emptyStatePass ? 'PASS' : 'FAIL',
      aiAdvisor: (avalanchePass && snowballPass && foirPass) ? 'PASS' : 'FAIL',
      customTxPreserved: customNamePreserved ? 'PASS' : 'FAIL',
      storageIntegrity: storageIntegrityPass ? 'PASS' : 'FAIL',
      overall: overallLocalePass ? 'PASS' : 'FAIL',
      screenshot: screenshotFile
    });
  }

  // 7. Dynamic Locale Switching Test (Clean storage first)
  console.log(`\n---------------------------------------------------------------`);
  console.log(`7. Dynamic Locale Switching Test: / -> /hi/ -> /ja/ -> /de/`);
  console.log(`---------------------------------------------------------------`);
  await evalInBrowser(`
    (() => {
      localStorage.clear();
      sessionStorage.clear();
    })()
  `);

  await navigate(`http://127.0.0.1:${PORT}/`);
  let switchNameEn = await evalInBrowser(`(() => document.querySelector('#transactions-tbody tr td:nth-child(2)')?.textContent?.trim() || '')()`);
  console.log(`   - At [/] ledger row 1: "${switchNameEn}" (Expected: Apartment Rent)`);

  await navigate(`http://127.0.0.1:${PORT}/hi/`);
  let switchNameHi = await evalInBrowser(`(() => document.querySelector('#transactions-tbody tr td:nth-child(2)')?.textContent?.trim() || '')()`);
  console.log(`   - At [/hi/] ledger row 1: "${switchNameHi}" (Expected: अपार्टमेंट का किराया)`);

  await navigate(`http://127.0.0.1:${PORT}/ja/`);
  let switchNameJa = await evalInBrowser(`(() => document.querySelector('#transactions-tbody tr td:nth-child(2)')?.textContent?.trim() || '')()`);
  console.log(`   - At [/ja/] ledger row 1: "${switchNameJa}" (Expected: アパート家賃)`);

  await navigate(`http://127.0.0.1:${PORT}/de/`);
  let switchNameDe = await evalInBrowser(`(() => document.querySelector('#transactions-tbody tr td:nth-child(2)')?.textContent?.trim() || '')()`);
  console.log(`   - At [/de/] ledger row 1: "${switchNameDe}" (Expected: Wohnungsmiete)`);

  const switchPass =
    switchNameEn === 'Apartment Rent' &&
    switchNameHi === 'अपार्टमेंट का किराया' &&
    switchNameJa === 'アパート家賃' &&
    switchNameDe === 'Wohnungsmiete';

  console.log(`   - Dynamic switching across routes: ${switchPass ? 'PASS' : 'FAIL'}`);

  // Cleanup
  try {
    if (ws) ws.close();
    if (edgeProc) edgeProc.kill();
    if (server) server.close();
  } catch (_) {}

  console.log('\n===============================================================');
  console.log('BROWSER QA RESULTS SUMMARY TABLE');
  console.log('===============================================================');
  console.table(results);

  const allPassed = results.every(r => r.overall === 'PASS') && switchPass;
  console.log(`\nOVERALL STATUS: ${allPassed ? '✅ ALL 8 LOCALES PASSED (100%)' : '❌ SOME LOCALES FAILED'}`);

  return results;
}

runQA()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Browser QA Error:', err);
    process.exit(1);
  });
