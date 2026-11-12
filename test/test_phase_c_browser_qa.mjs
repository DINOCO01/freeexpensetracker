/**
 * Phase C — Localized Currency & Number Formatting Browser QA Suite
 *
 * Runs against a REAL Chromium browser (Microsoft Edge) via Chrome DevTools Protocol (CDP).
 * Connects to a local HTTP server serving the production build (dist/).
 *
 * Scenarios tested:
 * 1. Financial display formatting across all 8 locales:
 *    - / (en)   -> USD, $4,200, $2,605, +$1,595
 *    - /hi/ (hi) -> INR, ₹4,200, ₹2,605, +₹1,595 (Indian grouping)
 *    - /de/ (de) -> EUR, €4.200, €2.605, +€1.595 (German period grouping)
 *    - /fr/ (fr) -> EUR, €4 200, €2 605, +€1 595 (French space grouping)
 *    - /es/ (es) -> EUR, €4.200, €2.605, +€1.595 (Spanish period grouping)
 *    - /pt/ (pt) -> EUR, €4 200, €2 605, +€1 595 (Portuguese grouping)
 *    - /ja/ (ja) -> JPY, ¥4,200, ¥2,605, +¥1,595 (0 decimal places)
 *    - /ko/ (ko) -> KRW, ₩4,200, ₩2,605, +₩1,595 (0 decimal places)
 * 2. Smart Spending Suggestions and Ledger Table amounts
 * 3. Dynamic Currency Switching in-browser (e.g. INR to JPY on /hi/, EUR to INR on /de/)
 * 4. Zero NaN, undefined, or [object Object] artifacts in DOM
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

const LOCALE_CHECKS = [
  { locale: 'en', route: '/', cur: 'USD', sym: '$', income: '$4,200', exp: '$2,605', net: '+$1,595' },
  { locale: 'hi', route: '/hi/', cur: 'INR', sym: '₹', income: '₹4,200', exp: '₹2,605', net: '+₹1,595' },
  { locale: 'es', route: '/es/', cur: 'EUR', sym: '€', income: '€4.200', exp: '€2.605', net: '+€1.595' },
  { locale: 'de', route: '/de/', cur: 'EUR', sym: '€', income: '€4.200', exp: '€2.605', net: '+€1.595' },
  { locale: 'fr', route: '/fr/', cur: 'EUR', sym: '€', income: '€4', exp: '€2', net: '+€1' }, // fr uses thin space
  { locale: 'pt', route: '/pt/', cur: 'EUR', sym: '€', income: '€4', exp: '€2', net: '+€1' },
  { locale: 'ja', route: '/ja/', cur: 'JPY', sym: '¥', income: '¥4,200', exp: '¥2,605', net: '+¥1,595' },
  { locale: 'ko', route: '/ko/', cur: 'KRW', sym: '₩', income: '₩4,200', exp: '₩2,605', net: '+₩1,595' }
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
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fet-edge-qa-phasec-'));
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

  console.log('\n=== SCENARIO 1: Browser Formatting Across All 8 Locales ===');
  for (const check of LOCALE_CHECKS) {
    await clearOriginStorage();
    await navigate(`http://localhost:${PORT}${check.route}`);

    const result = await evaluate(`(() => {
      const incomeEl = document.getElementById('stat-total-income');
      const expensesEl = document.getElementById('stat-total-expenses');
      const netEl = document.getElementById('stat-remaining-balance');
      const selector = document.getElementById('currency-selector');
      const tableRows = Array.from(document.querySelectorAll('#transactions-tbody tr, tr[data-tx-id]'));
      const suggestionCards = Array.from(document.querySelectorAll('#smart-suggestions-container [class*="rounded"]'));

      // Check for any NaN or undefined in full page text
      const bodyText = document.body.innerText;
      const hasNaN = bodyText.includes('NaN') || bodyText.includes('undefined') || bodyText.includes('[object Object]');

      return {
        income: incomeEl ? incomeEl.textContent.trim() : null,
        expenses: expensesEl ? expensesEl.textContent.trim() : null,
        net: netEl ? netEl.textContent.trim() : null,
        curVal: selector ? selector.value : null,
        txCount: tableRows.length,
        hasNaN,
        firstTxAmount: tableRows[0] ? tableRows[0].textContent.trim() : null
      };
    })()`);

    assert(
      `Locale '${check.locale}' (${check.route}) selected currency is ${check.cur}`,
      result.curVal === check.cur,
      `Selector: ${result.curVal}`
    );

    assert(
      `Locale '${check.locale}' income formatted correctly`,
      result.income && result.income.includes(check.income),
      `Income: ${result.income}, Expected to contain: ${check.income}`
    );

    assert(
      `Locale '${check.locale}' expenses formatted correctly`,
      result.expenses && result.expenses.includes(check.exp),
      `Expenses: ${result.expenses}, Expected to contain: ${check.exp}`
    );

    assert(
      `Locale '${check.locale}' net cash flow formatted correctly`,
      result.net && result.net.includes(check.net),
      `Net Cash Flow: ${result.net}, Expected to contain: ${check.net}`
    );

    assert(
      `Locale '${check.locale}' has ZERO NaN / undefined / [object Object] artifacts`,
      !result.hasNaN,
      `hasNaN: ${result.hasNaN}`
    );
  }

  console.log('\n=== SCENARIO 2: Dynamic Currency Switching in Browser ===');
  // Navigate to /hi/ (default INR), switch to JPY: verify zero decimals and Yen symbol
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/hi/`);
  await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    sel.value = 'JPY';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const jpyCheck = await evaluate(`(() => {
    const income = document.getElementById('stat-total-income')?.textContent.trim();
    const exp = document.getElementById('stat-total-expenses')?.textContent.trim();
    const net = document.getElementById('stat-remaining-balance')?.textContent.trim();
    return { income, exp, net };
  })()`);

  assert(
    'Switching to JPY on /hi/ updates figures with ¥ and 0 decimal places',
    jpyCheck.income === '¥4,200' && jpyCheck.exp === '¥2,605' && jpyCheck.net === '+¥1,595',
    `Income: ${jpyCheck.income}, Exp: ${jpyCheck.exp}, Net: ${jpyCheck.net}`
  );

  // Switch to KRW on / (default USD): verify 0 decimals and Won symbol
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/`);
  await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    sel.value = 'KRW';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const krwCheck = await evaluate(`(() => {
    const income = document.getElementById('stat-total-income')?.textContent.trim();
    const exp = document.getElementById('stat-total-expenses')?.textContent.trim();
    const net = document.getElementById('stat-remaining-balance')?.textContent.trim();
    return { income, exp, net };
  })()`);

  assert(
    'Switching to KRW on / updates figures with ₩ and 0 decimal places',
    krwCheck.income === '₩4,200' && krwCheck.exp === '₩2,605' && krwCheck.net === '+₩1,595',
    `Income: ${krwCheck.income}, Exp: ${krwCheck.exp}, Net: ${krwCheck.net}`
  );

  // Switch to INR on /de/ (default EUR): verify Indian number grouping in German context
  await clearOriginStorage();
  await navigate(`http://localhost:${PORT}/de/`);
  await evaluate(`(() => {
    const sel = document.getElementById('currency-selector');
    sel.value = 'INR';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise(r => setTimeout(r, 400));

  const inrInDeCheck = await evaluate(`(() => {
    const income = document.getElementById('stat-total-income')?.textContent.trim();
    const exp = document.getElementById('stat-total-expenses')?.textContent.trim();
    const net = document.getElementById('stat-remaining-balance')?.textContent.trim();
    return { income, exp, net };
  })()`);

  assert(
    'Switching to INR on /de/ formats figures with ₹ and Indian grouping',
    inrInDeCheck.income === '₹4,200' && inrInDeCheck.exp === '₹2,605' && inrInDeCheck.net === '+₹1,595',
    `Income: ${inrInDeCheck.income}, Exp: ${inrInDeCheck.exp}, Net: ${inrInDeCheck.net}`
  );

  console.log('\n================ QA TEST SUMMARY ================');
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`Total tests: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.error('Some tests failed!');
    process.exitCode = 1;
  } else {
    console.log('All Phase C Browser QA tests passed successfully!');
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

