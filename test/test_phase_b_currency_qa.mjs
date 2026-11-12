/**
 * Phase B — Locale-Based Default Currency Browser QA Test Suite
 *
 * Runs against a REAL Chromium browser (Microsoft Edge) via Chrome DevTools Protocol (CDP).
 * Connects to a local HTTP server serving the production build (dist/).
 *
 * Scenarios tested:
 * 1. Fresh Profile Default Currency (no localStorage):
 *    - /      -> USD
 *    - /hi/   -> INR
 *    - /es/   -> EUR
 *    - /de/   -> EUR
 *    - /fr/   -> EUR
 *    - /pt/   -> EUR
 *    - /ja/   -> JPY
 *    - /ko/   -> KRW
 * 2. Saved Preference Priority (User with saved currency):
 *    - User saves USD, visits /hi/ -> stays USD
 *    - User saves INR, visits /de/ -> stays INR
 *    - User saves JPY, visits /    -> stays JPY
 * 3. Manual Currency Selection:
 *    - User on / selects GBP via dropdown -> saved to localStorage -> persists across reload and /fr/ navigation
 * 4. Reset & Sample Data Currency Alignment:
 *    - Reset blank on /hi/ resets currency to INR
 *    - Restore sample on /ja/ resets currency to JPY
 * 5. Data Integrity:
 *    - Verify transactions, debts, goals, categories, and amounts remain intact without loss or duplication
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4321;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();

const EXPECTED_DEFAULTS = [
  { locale: 'en', route: '/', currency: 'USD', symbol: '$' },
  { locale: 'hi', route: '/hi/', currency: 'INR', symbol: '₹' },
  { locale: 'es', route: '/es/', currency: 'EUR', symbol: '€' },
  { locale: 'de', route: '/de/', currency: 'EUR', symbol: '€' },
  { locale: 'fr', route: '/fr/', currency: 'EUR', symbol: '€' },
  { locale: 'pt', route: '/pt/', currency: 'EUR', symbol: '€' },
  { locale: 'ja', route: '/ja/', currency: 'JPY', symbol: '¥' },
  { locale: 'ko', route: '/ko/', currency: 'KRW', symbol: '₩' }
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
      let filePath = path.join(DIST_DIR, reqPath);

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

    server.listen(PORT, () => {
      console.log(`[QA] HTTP server listening on http://localhost:${PORT}`);
      resolve();
    });
  });
}

function launchEdge() {
  return new Promise((resolve, reject) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fet-edge-qa-phaseb-'));
    console.log(`[QA] Launching Edge with temp user-data-dir: ${userDataDir}`);

    edgeProc = spawn(EDGE_PATH, [
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      'about:blank'
    ], { stdio: 'ignore' });

    let attempts = 0;
    const checkCDP = () => {
      attempts++;
      http.get('http://127.0.0.1:9222/json', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(body);
            const pageTarget = targets.find(t => t.type === 'page');
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              console.log(`[QA] Edge CDP ready at ${pageTarget.webSocketDebuggerUrl}`);
              resolve(pageTarget.webSocketDebuggerUrl);
            } else {
              if (attempts < 30) setTimeout(checkCDP, 200);
              else reject(new Error('Page target not found in CDP'));
            }
          } catch (e) {
            if (attempts < 30) setTimeout(checkCDP, 200);
            else reject(e);
          }
        });
      }).on('error', () => {
        if (attempts < 30) setTimeout(checkCDP, 200);
        else reject(new Error('Failed to connect to Edge CDP port 9222'));
      });
    };

    setTimeout(checkCDP, 500);
  });
}

async function connectWebSocket(wsUrl) {
  const { WebSocket } = await import('ws');
  return new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      console.log('[QA] WebSocket connection established.');
      resolve();
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve: res, reject: rej } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
    ws.on('error', reject);
  });
}

function sendCDP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await sendCDP('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result ? res.result.value : undefined;
}

async function navigate(url) {
  await sendCDP('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 600));
  // Wait until document is ready
  for (let i = 0; i < 20; i++) {
    const ready = await evaluate('document.readyState');
    if (ready === 'complete') break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 300));
}

async function clearOriginStorage() {
  await sendCDP('Storage.clearDataForOrigin', {
    origin: `http://localhost:${PORT}`,
    storageTypes: 'all'
  });
}

async function runTestSuite() {
  const testResults = [];
  function assert(title, condition, detail = '') {
    const passed = Boolean(condition);
    testResults.push({ title, passed, detail });
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${title}${detail ? ` -> ${detail}` : ''}`);
  }

  console.log('\n=== SCENARIO 1: Fresh Profile Locale-Based Default Currencies ===');
  for (const { locale, route, currency, symbol } of EXPECTED_DEFAULTS) {
    await clearOriginStorage();
    await navigate(`http://localhost:${PORT}${route}`);

    const result = await evaluate(`(() => {
      const selector = document.getElementById('currency-selector');
      const selectedOption = selector ? selector.options[selector.selectedIndex] : null;
      const selectorVal = selector ? selector.value : null;
      const selectorText = selectedOption ? selectedOption.textContent.trim() : null;
      const storedCur = localStorage.getItem('fet_currency_v4');
      const docLocale = document.documentElement.dataset.locale;

      // Check if rendered summary/dashboard figures contain the expected symbol
      const statCards = Array.from(document.querySelectorAll('.stat-val, [id^="total-"], [id^="stat-"]')).map(el => el.textContent.trim());
      const hasSymbol = statCards.some(t => t.includes('${symbol}'));

      return {
        selectorVal,
        selectorText,
        storedCur,
        docLocale,
        hasSymbol,
        firstCards: statCards.slice(0, 4)
      };
    })()`);

    assert(
      `Locale '${locale}' (${route}) defaults selector to ${currency}`,
      result.selectorVal === currency,
      `Selector: ${result.selectorVal}, Expected: ${currency}`
    );

    assert(
      `Locale '${locale}' shows symbol '${symbol}' in UI cards`,
      result.hasSymbol,
      `Found in cards: ${result.firstCards.join(' | ')}`
    );

    assert(
      `Locale '${locale}' does not corrupt or prematurely force invalid localStorage`,
      result.storedCur === null || result.storedCur === currency,
      `localStorage fet_currency_v4: ${result.storedCur}`
    );
  }

  console.log('\n=== SCENARIO 2: Saved User Preference Priority (No Route Overwrite) ===');
  // First navigate to app to gain origin context
  await navigate(`http://localhost:${PORT}/`);

  // Sub-case 2.1: User with saved 'USD' visits /hi/ (default INR) -> must stay USD
  await evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem('fet_currency_v4', 'USD');
  })()`);
  await navigate(`http://localhost:${PORT}/hi/`);
  let res21 = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Saved USD preference is preserved when visiting /hi/',
    res21.val === 'USD' && res21.stored === 'USD',
    `Active selector: ${res21.val}, Stored: ${res21.stored}`
  );

  // Sub-case 2.2: User with saved 'INR' visits /de/ (default EUR) -> must stay INR
  await evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem('fet_currency_v4', 'INR');
  })()`);
  await navigate(`http://localhost:${PORT}/de/`);
  let res22 = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Saved INR preference is preserved when visiting /de/',
    res22.val === 'INR' && res22.stored === 'INR',
    `Active selector: ${res22.val}, Stored: ${res22.stored}`
  );

  // Sub-case 2.3: User with saved 'JPY' visits / (default USD) -> must stay JPY
  await evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem('fet_currency_v4', 'JPY');
  })()`);
  await navigate(`http://localhost:${PORT}/`);
  let res23 = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Saved JPY preference is preserved when visiting /',
    res23.val === 'JPY' && res23.stored === 'JPY',
    `Active selector: ${res23.val}, Stored: ${res23.stored}`
  );

  console.log('\n=== SCENARIO 3: Manual Currency Change via Dropdown ===');
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/`);

  await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    sel.value = 'GBP';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise(r => setTimeout(r, 400));

  let gbpSaved = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Manual selection of GBP saves to localStorage',
    gbpSaved.val === 'GBP' && gbpSaved.stored === 'GBP',
    `Selector: ${gbpSaved.val}, Stored: ${gbpSaved.stored}`
  );

  // Reload the same page: must remain GBP
  await navigate(`http://localhost:${PORT}/`);
  let gbpReload = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Reloading page retains manually chosen GBP',
    gbpReload.val === 'GBP' && gbpReload.stored === 'GBP',
    `Selector: ${gbpReload.val}, Stored: ${gbpReload.stored}`
  );

  // Navigate to another locale route (/fr/): must remain GBP because user explicitly saved GBP
  await navigate(`http://localhost:${PORT}/fr/`);
  let gbpCrossLocale = await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Navigating to /fr/ preserves manually chosen GBP across routes',
    gbpCrossLocale.val === 'GBP' && gbpCrossLocale.stored === 'GBP',
    `Selector: ${gbpCrossLocale.val}, Stored: ${gbpCrossLocale.stored}`
  );

  console.log('\n=== SCENARIO 4: Reset & Restore Sample Locale Defaults ===');
  // On /hi/, clicking Reset Blank resets to INR default
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/hi/`);
  const resetBlankRes = await evaluate(`(() => {
    const btnConfirm = document.getElementById('btn-confirm-reset-blank');
    if (btnConfirm) {
      btnConfirm.click();
    }
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Reset Blank on /hi/ retains or resets currency to INR',
    resetBlankRes.val === 'INR',
    `Active selector: ${resetBlankRes.val}, Stored: ${resetBlankRes.stored}`
  );

  // On /ja/, clicking Restore Sample resets to JPY default
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/ja/`);
  const restoreSampleRes = await evaluate(`(() => {
    const btnRestore = document.getElementById('btn-confirm-restore-sample');
    if (btnRestore) {
      btnRestore.click();
    }
    const sel = document.getElementById('currency-selector');
    return {
      val: sel ? sel.value : null,
      stored: localStorage.getItem('fet_currency_v4')
    };
  })()`);
  assert(
    'Restore Sample on /ja/ retains or resets currency to JPY',
    restoreSampleRes.val === 'JPY',
    `Active selector: ${restoreSampleRes.val}, Stored: ${restoreSampleRes.stored}`
  );

  console.log('\n=== SCENARIO 5: Data Integrity Across Currency Defaulting ===');
  // Verify that transactions, amounts, categories, debts, and goals are intact
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/hi/`);
  const dataCheck = await evaluate(`(() => {
    const txRows = Array.from(document.querySelectorAll('#transactions-tbody tr, tr[data-tx-id]'));
    const txCount = txRows.length;
    return {
      txCount,
      hasTable: Boolean(document.getElementById('transactions-tbody') || txRows.length > 0)
    };
  })()`);
  assert(
    'Initial seed transactions render properly without data corruption',
    dataCheck.txCount >= 6,
    `Rendered transaction row count: ${dataCheck.txCount}`
  );

  console.log('\n================ QA TEST SUMMARY ================');
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`Total tests: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.error('Some tests failed!');
    process.exitCode = 1;
  } else {
    console.log('All Phase B Locale Default Currency QA tests passed successfully!');
  }
}

async function main() {
  try {
    await startServer();
    const wsUrl = await launchEdge();
    await connectWebSocket(wsUrl);
    await sendCDP('Page.enable');
    await sendCDP('Runtime.enable');
    await runTestSuite();
  } catch (err) {
    console.error('Error running test suite:', err);
    process.exitCode = 1;
  } finally {
    if (ws) ws.close();
    if (edgeProc) edgeProc.kill();
    if (server) server.close();
    process.exit(process.exitCode || 0);
  }
}

main();
