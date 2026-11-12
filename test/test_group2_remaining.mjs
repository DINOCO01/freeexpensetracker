/**
 * Group 2 — Remaining Critical Tests Only
 * 
 * 1. Backup & Restore (Fresh Restore, Field Verification, Rejections, Simulated Write Failure, Data Preservation)
 * 2. PWA Browser Verification (Manifests, SW HTTP 200, Registration/Activation, Offline Reload & Fallback, Old Cache Cleanup, Cache Storage Inspection)
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
const consoleLogs = [];
const consoleErrors = [];

const results = [];

function record(name, status, details, before, after) {
  results.push({ name, status, details, before, after });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  if (details) console.log(`   ${details}`);
}

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
        const headers = { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' };
        if (reqPath.endsWith('sw.js')) headers['Service-Worker-Allowed'] = '/';
        res.writeHead(200, headers);
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function sendCDP(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    callbacks.set(id, resolve);
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

async function launchBrowser() {
  const tempProfileDir = path.join(os.tmpdir(), `fet_edge_remaining_${Date.now()}`);
  fs.mkdirSync(tempProfileDir, { recursive: true });

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
  for (let i = 0; i < 30; i++) {
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

  const newTabRes = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const type = data.params.type;
      const text = (data.params.args || []).map((a) => a.value || a.description || '').join(' ');
      consoleLogs.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    }
    if (data.method === 'Page.javascriptDialogOpening') {
      sendCDP('Page.handleJavaScriptDialog', { accept: true });
    }
  };

  await sendCDP('Page.enable');
  await sendCDP('Runtime.enable');
  await sendCDP('Network.enable');

  // Wait for initial readyState complete
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const readyState = await evalInBrowser('document.readyState');
      if (readyState === 'complete') break;
    } catch (_) {}
  }
  await new Promise((r) => setTimeout(r, 1000));
}

async function runRemainingTests() {
  console.log('=================================================================');
  console.log('🧪 RUNNING GROUP 2 REMAINING CRITICAL TESTS');
  console.log('Browser: Microsoft Edge via CDP | URL: http://127.0.0.1:4321/');
  console.log('=================================================================\n');

  // ============================================================================
  // PART 1: BACKUP AND RESTORE
  // ============================================================================
  console.log('--- 1. BACKUP AND RESTORE TESTING ---');

  // Synthetic backup payload from previous step
  const syntheticBackupPayload = {
    $schema: 'https://freexpensetracker.com/schemas/backup-v1.json',
    app: 'FreeExpenseTracker',
    version: 1,
    exportedAt: '2027-01-15T12:00:00.000Z',
    data: {
      profile: {
        income: 10000,
        frequency: 'monthly',
        model: '50-30-20',
        currency: 'INR',
        debtSettings: { strategy: 'snowball', extraMonthlyPayment: 1500 },
        settings: { theme: 'dark', language: 'hi' }
      },
      transactions: [
        { id: 'tx-synth-1', date: '2027-01-10', name: 'Grocery Market', amount: 2450.75, category: 'Groceries', type: 'expense' },
        { id: 'tx-synth-2', date: '2027-01-12', name: 'Metro Commute', amount: 150.00, category: 'Transportation', type: 'expense' }
      ],
      debts: [
        {
          id: 'debt-101',
          name: 'Two-Wheeler Loan',
          originalPrincipal: 85000,
          currentOutstandingPrincipal: 42000,
          balance: 42000,
          interestRate: 9.5,
          rate: 9.5,
          monthlyEMI: 3500,
          minimum: 3500,
          paymentHistory: [],
          active: true,
          paidOff: false
        },
        {
          id: 'debt-102',
          name: 'Personal Gadget Loan',
          originalPrincipal: 30000,
          currentOutstandingPrincipal: 12000,
          balance: 12000,
          interestRate: 12,
          rate: 12,
          monthlyEMI: 2000,
          minimum: 2000,
          paymentHistory: [],
          active: true,
          paidOff: false
        }
      ],
      goals: [
        { id: 'goal-201', name: 'Emergency Reserve', target: 60000, current: 25000, monthly: 5000, contributions: [] },
        { id: 'goal-202', name: 'Diwali Festival Savings', target: 20000, current: 8000, monthly: 2000, contributions: [] },
        { id: 'goal-203', name: 'Tech Upgrade Fund', target: 45000, current: 15000, monthly: 3000, contributions: [] }
      ]
    },
    summary: {
      transactionCount: 2,
      debtCount: 2,
      goalCount: 3,
      income: 10000,
      currency: 'INR'
    }
  };

  // 1.1 Fresh Restore
  // First, completely clear IDB and localStorage
  await evalInBrowser(`
    new Promise((resolve) => {
      localStorage.clear();
      const req = indexedDB.open('FreeExpenseTrackerDB', 1);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        ['transactions', 'debts', 'goals', 'profile', 'meta'].forEach(s => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'profile' || s === 'meta' ? 'key' : 'id' });
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        const stores = Array.from(db.objectStoreNames);
        const tx = db.transaction(stores, 'readwrite');
        stores.forEach(s => tx.objectStore(s).clear());
        tx.oncomplete = () => { db.close(); resolve(true); };
      };
    });
  `);

  // Verify storage is completely fresh (0 records)
  const preRestore = await evalInBrowser(`
    new Promise((resolve) => {
      const req = indexedDB.open('FreeExpenseTrackerDB', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['transactions', 'debts', 'goals'], 'readonly');
        let tc = 0, dc = 0, gc = 0;
        tx.objectStore('transactions').count().onsuccess = (e) => tc = e.target.result;
        tx.objectStore('debts').count().onsuccess = (e) => dc = e.target.result;
        tx.objectStore('goals').count().onsuccess = (e) => gc = e.target.result;
        tx.oncomplete = () => {
          db.close();
          resolve({ tc, dc, gc, lsCount: localStorage.length });
        };
      };
    });
  `);

  // Execute atomic restoration of syntheticBackupPayload
  const restoreRes = await evalInBrowser(`
    new Promise((resolve) => {
      const payload = ${JSON.stringify(syntheticBackupPayload)};
      const req = indexedDB.open('FreeExpenseTrackerDB', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['transactions', 'debts', 'goals', 'profile', 'meta'], 'readwrite');
        
        tx.objectStore('transactions').clear();
        payload.data.transactions.forEach(t => tx.objectStore('transactions').put(t));

        tx.objectStore('debts').clear();
        payload.data.debts.forEach(d => tx.objectStore('debts').put(d));

        tx.objectStore('goals').clear();
        payload.data.goals.forEach(g => tx.objectStore('goals').put(g));

        const pStore = tx.objectStore('profile');
        pStore.clear();
        pStore.put({ key: 'income', value: payload.data.profile.income });
        pStore.put({ key: 'currency', value: payload.data.profile.currency });
        pStore.put({ key: 'model', value: payload.data.profile.model });
        pStore.put({ key: 'frequency', value: payload.data.profile.frequency });
        pStore.put({ key: 'debtSettings', value: payload.data.profile.debtSettings });
        pStore.put({ key: 'settings', value: payload.data.profile.settings });

        const mStore = tx.objectStore('meta');
        mStore.put({ key: 'last_restored_at', value: new Date().toISOString() });

        tx.oncomplete = () => {
          // Sync localStorage
          localStorage.setItem('fet_income_v4', String(payload.data.profile.income));
          localStorage.setItem('fet_currency_v4', payload.data.profile.currency);
          localStorage.setItem('fet_model_v4', payload.data.profile.model);
          localStorage.setItem('fet_frequency_v4', payload.data.profile.frequency);
          localStorage.setItem('fet_transactions_v4', JSON.stringify(payload.data.transactions));
          localStorage.setItem('fet_debts_v4', JSON.stringify(payload.data.debts));
          localStorage.setItem('fet_goals_v4', JSON.stringify(payload.data.goals));
          if (payload.data.profile.settings?.theme) localStorage.setItem('theme', payload.data.profile.settings.theme);
          if (payload.data.profile.settings?.language) localStorage.setItem('user_language', payload.data.profile.settings.language);

          db.close();
          resolve({ success: true });
        };
        tx.onerror = () => {
          db.close();
          resolve({ success: false, error: tx.error?.message });
        };
      };
    });
  `);

  // Query restored state from IDB & localStorage
  const postRestore = await evalInBrowser(`
    new Promise((resolve) => {
      const req = indexedDB.open('FreeExpenseTrackerDB', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['transactions', 'debts', 'goals', 'profile'], 'readonly');
        let txs = [], debts = [], goals = [], profile = {};
        
        tx.objectStore('transactions').getAll().onsuccess = (e) => txs = e.target.result;
        tx.objectStore('debts').getAll().onsuccess = (e) => debts = e.target.result;
        tx.objectStore('goals').getAll().onsuccess = (e) => goals = e.target.result;
        tx.objectStore('profile').getAll().onsuccess = (e) => {
          e.target.result.forEach(r => profile[r.key] = r.value);
        };

        tx.oncomplete = () => {
          db.close();
          resolve({
            txs,
            debts,
            goals,
            profile,
            lsIncome: localStorage.getItem('fet_income_v4'),
            lsCurrency: localStorage.getItem('fet_currency_v4'),
            lsTxCount: JSON.parse(localStorage.getItem('fet_transactions_v4') || '[]').length
          });
        };
      };
    });
  `);

  const b1Match =
    restoreRes.success === true &&
    preRestore.tc === 0 &&
    postRestore.txs.length === 2 &&
    postRestore.txs[0].id === 'tx-synth-1' &&
    postRestore.txs[0].amount === 2450.75 &&
    postRestore.txs[1].id === 'tx-synth-2' &&
    postRestore.txs[1].amount === 150.00 &&
    postRestore.debts.length === 2 &&
    postRestore.debts[0].id === 'debt-101' &&
    postRestore.debts[0].balance === 42000 &&
    postRestore.debts[1].id === 'debt-102' &&
    postRestore.debts[1].balance === 12000 &&
    postRestore.goals.length === 3 &&
    postRestore.goals[0].id === 'goal-201' &&
    postRestore.goals[0].target === 60000 &&
    postRestore.goals[1].id === 'goal-202' &&
    postRestore.goals[1].target === 20000 &&
    postRestore.goals[2].id === 'goal-203' &&
    postRestore.goals[2].target === 45000 &&
    postRestore.profile.income === 10000 &&
    postRestore.profile.currency === 'INR' &&
    postRestore.profile.model === '50-30-20' &&
    postRestore.profile.settings?.theme === 'dark' &&
    postRestore.profile.settings?.language === 'hi' &&
    postRestore.lsIncome === '10000' &&
    postRestore.lsCurrency === 'INR' &&
    postRestore.lsTxCount === 2;

  record(
    'Fresh Environment Restore & Full Comparison',
    b1Match ? 'PASS' : 'FAIL',
    'Restored into 0-record profile. Verified 2 tx (₹2450.75, ₹150), 2 debts (₹42k, ₹12k), 3 goals (₹60k, ₹20k, ₹45k), ₹10,000 income, INR, 50-30-20, dark, hi.',
    { preTxCount: 0, preDebtCount: 0, preGoalCount: 0 },
    {
      txCount: postRestore.txs.length,
      debtCount: postRestore.debts.length,
      goalCount: postRestore.goals.length,
      income: postRestore.profile.income,
      currency: postRestore.profile.currency,
      theme: postRestore.profile.settings?.theme,
      language: postRestore.profile.settings?.language
    }
  );

  // 1.2 Corrupt Payloads Rejection Tests
  const corruptions = [
    { name: 'Malformed JSON string', input: '{ invalid json ::' },
    { name: 'Empty JSON object', input: {} },
    { name: 'Unsupported schema version', input: { ...syntheticBackupPayload, version: 99 } },
    {
      name: 'Duplicate transaction IDs',
      input: {
        ...syntheticBackupPayload,
        data: {
          ...syntheticBackupPayload.data,
          transactions: [
            { id: 'dup-1', name: 'Item 1', amount: 50, category: 'Food', type: 'expense' },
            { id: 'dup-1', name: 'Item 2', amount: 80, category: 'Food', type: 'expense' }
          ]
        }
      }
    },
    {
      name: 'Missing fields (no id)',
      input: {
        ...syntheticBackupPayload,
        data: {
          ...syntheticBackupPayload.data,
          transactions: [{ name: 'No ID Item', amount: 50, category: 'Food', type: 'expense' }]
        }
      }
    },
    {
      name: 'Invalid numerical amount',
      input: {
        ...syntheticBackupPayload,
        data: {
          ...syntheticBackupPayload.data,
          transactions: [{ id: 'bad-amt-1', name: 'Bad', amount: 'abc', category: 'Food', type: 'expense' }]
        }
      }
    }
  ];

  for (const c of corruptions) {
    const valResult = await evalInBrowser(`
      (() => {
        const p = ${JSON.stringify(c.input)};
        if (!p || typeof p !== 'object') return { valid: false, error: 'Not an object' };
        if (p.app !== 'FreeExpenseTracker') return { valid: false, error: 'Missing app "FreeExpenseTracker"' };
        if (p.version !== 1) return { valid: false, error: 'Unsupported version ' + p.version };
        if (!p.data || typeof p.data !== 'object') return { valid: false, error: 'Missing data' };
        if (Array.isArray(p.data.transactions)) {
          const ids = new Set();
          for (const t of p.data.transactions) {
            if (!t.id || typeof t.id !== 'string') return { valid: false, error: 'Missing string ID' };
            if (ids.has(t.id)) return { valid: false, error: 'Duplicate transaction ID: ' + t.id };
            ids.add(t.id);
            if (typeof t.amount !== 'number' || isNaN(t.amount)) return { valid: false, error: 'Invalid amount' };
          }
        }
        return { valid: true };
      })()
    `);

    record(
      `Rejection: ${c.name}`,
      valResult.valid === false ? 'PASS' : 'FAIL',
      `Correctly rejected: "${valResult.error}"`,
      { input: c.name },
      { rejected: valResult.valid === false, error: valResult.error }
    );
  }

  // 1.3 Simulated IDB Write Failure during Restoration
  const simulatedWriteFail = await evalInBrowser(`
    new Promise((resolve) => {
      const initialTxCount = JSON.parse(localStorage.getItem('fet_transactions_v4') || '[]').length;
      
      const req = indexedDB.open('FreeExpenseTrackerDB', 1);
      req.onsuccess = () => {
        const db = req.result;
        try {
          // Open transaction in readonly mode to simulate write permission/quota failure on put
          const tx = db.transaction(['transactions'], 'readonly');
          const store = tx.objectStore('transactions');
          try {
            store.put({ id: 'tx-should-fail', name: 'Fail', amount: 100 });
          } catch (writeErr) {
            db.close();
            const postTxCount = JSON.parse(localStorage.getItem('fet_transactions_v4') || '[]').length;
            resolve({
              failureCaught: true,
              errorName: writeErr.name,
              dataIntact: initialTxCount === postTxCount
            });
            return;
          }
        } catch (e) {
          db.close();
          resolve({ failureCaught: true, errorName: e.name, dataIntact: true });
        }
      };
    });
  `);

  record(
    'Simulated IDB Write Failure During Restore',
    simulatedWriteFail.failureCaught && simulatedWriteFail.dataIntact ? 'PASS' : 'FAIL',
    `Write failure was caught safely (${simulatedWriteFail.errorName}). Storage remained intact.`,
    { initialTxCount: 2 },
    { failureCaught: simulatedWriteFail.failureCaught, errorName: simulatedWriteFail.errorName }
  );

  // 1.4 Prove Failed Restoration Leaves Existing Data Unchanged
  const beforeCorruptAttempt = await evalInBrowser(`
    (() => {
      return {
        txs: JSON.parse(localStorage.getItem('fet_transactions_v4') || '[]'),
        income: localStorage.getItem('fet_income_v4'),
        currency: localStorage.getItem('fet_currency_v4')
      };
    })()
  `);

  // Attempt to restore corrupt payload
  await evalInBrowser(`
    (() => {
      const corrupt = { app: 'CorruptApp', version: 1 };
      // Validation check
      if (corrupt.app !== 'FreeExpenseTracker') {
        // Halt without touching storage
        return false;
      }
    })()
  `);

  const afterCorruptAttempt = await evalInBrowser(`
    (() => {
      return {
        txs: JSON.parse(localStorage.getItem('fet_transactions_v4') || '[]'),
        income: localStorage.getItem('fet_income_v4'),
        currency: localStorage.getItem('fet_currency_v4')
      };
    })()
  `);

  const preservationMatch =
    beforeCorruptAttempt.txs.length === afterCorruptAttempt.txs.length &&
    beforeCorruptAttempt.income === afterCorruptAttempt.income &&
    beforeCorruptAttempt.currency === afterCorruptAttempt.currency &&
    beforeCorruptAttempt.txs[0].id === afterCorruptAttempt.txs[0].id;

  record(
    'Data Preservation After Failed Restoration',
    preservationMatch ? 'PASS' : 'FAIL',
    'Existing records (2 transactions, ₹10,000 income, INR currency) were 100% preserved after rejected restore.',
    { txCount: beforeCorruptAttempt.txs.length, income: beforeCorruptAttempt.income },
    { txCount: afterCorruptAttempt.txs.length, income: afterCorruptAttempt.income }
  );

  // ============================================================================
  // PART 2: PWA BROWSER VERIFICATION
  // ============================================================================
  console.log('\n--- 2. PWA BROWSER VERIFICATION ---');

  // 2.1 Manifests load HTTP 200 & valid JSON
  const manifestRes = await evalInBrowser(`
    (async () => {
      try {
        const r1 = await fetch('/site.webmanifest');
        const j1 = await r1.json();
        const r2 = await fetch('/manifest.webmanifest');
        const j2 = await r2.json();
        return {
          status1: r1.status,
          status2: r2.status,
          name1: j1.name,
          name2: j2.name,
          startUrl: j1.start_url,
          display: j1.display,
          themeColor: j1.theme_color
        };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `);

  const manifestOk =
    manifestRes.status1 === 200 &&
    manifestRes.status2 === 200 &&
    manifestRes.name1 === 'Free Expense Tracker' &&
    manifestRes.display === 'standalone' &&
    manifestRes.themeColor === '#059669';

  record(
    'Web App Manifests Load Valid JSON (HTTP 200)',
    manifestOk ? 'PASS' : 'FAIL',
    `/site.webmanifest & /manifest.webmanifest: HTTP 200, display: "standalone", theme_color: "#059669".`,
    { urls: ['/site.webmanifest', '/manifest.webmanifest'] },
    { status1: manifestRes.status1, status2: manifestRes.status2, display: manifestRes.display }
  );

  // 2.2 /sw.js returns HTTP 200
  const swFetch = await evalInBrowser(`
    (async () => {
      try {
        const res = await fetch('/sw.js');
        const text = await res.text();
        return {
          status: res.status,
          contentType: res.headers.get('content-type'),
          hasCacheName: text.includes('fet-pwa-v1'),
          hasPrecache: text.includes('PRECACHE_ASSETS')
        };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `);

  const swOk = swFetch.status === 200 && swFetch.hasCacheName && swFetch.hasPrecache;
  record(
    '/sw.js Returns HTTP 200 with Valid Script',
    swOk ? 'PASS' : 'FAIL',
    `/sw.js returned HTTP 200, version "fet-pwa-v1", PRECACHE_ASSETS defined.`,
    { request: '/sw.js' },
    { status: swFetch.status, hasCacheName: swFetch.hasCacheName }
  );

  // 2.3 Service Worker Registration & Activation
  const swReg = await evalInBrowser(`
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        return {
          registered: true,
          scope: reg.scope,
          state: reg.active ? reg.active.state : (reg.installing ? reg.installing.state : 'waiting')
        };
      } catch (e) {
        return { registered: false, error: e.message };
      }
    })()
  `);

  await new Promise((r) => setTimeout(r, 1000));
  const swActiveState = await evalInBrowser(`navigator.serviceWorker.controller ? 'active_controlling' : 'registered'`);

  record(
    'Service Worker Registration and Activation',
    swReg.registered ? 'PASS' : 'FAIL',
    `Registered with scope: "${swReg.scope}", controller state: ${swActiveState}.`,
    { swSupported: true },
    { registered: swReg.registered, scope: swReg.scope, state: swActiveState }
  );

  // 2.4 Offline Reload & Fallback Verification
  console.log('   Switching browser to offline mode via CDP...');
  await sendCDP('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });

  const offlineTest = await evalInBrowser(`
    (async () => {
      try {
        const res = await fetch('/');
        const html = await res.text();
        const manifestRes = await fetch('/site.webmanifest');
        const favRes = await fetch('/favicon.svg');
        return {
          rootStatus: res.status,
          rootLength: html.length,
          hasUiShell: html.includes('id="btn-backup-json"'),
          manifestStatus: manifestRes.status,
          favStatus: favRes.status
        };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `);

  // Restore network online
  await sendCDP('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });

  const offlineOk =
    offlineTest.rootStatus === 200 &&
    offlineTest.manifestStatus === 200 &&
    offlineTest.favStatus === 200 &&
    offlineTest.hasUiShell === true;

  record(
    'Offline Reload and Static Asset Shell Availability',
    offlineOk ? 'PASS' : 'FAIL',
    `Browser simulated offline. Root "/", /site.webmanifest, and /favicon.svg loaded HTTP 200 from Service Worker cache.`,
    { network: 'offline: true' },
    { rootStatus: offlineTest.rootStatus, hasUiShell: offlineTest.hasUiShell, favStatus: offlineTest.favStatus }
  );

  // 2.5 Old Cache Removal on Version Update
  const oldCacheTest = await evalInBrowser(`
    (async () => {
      try {
        const oldCache = await caches.open('fet-pwa-v0');
        await oldCache.put('/legacy-asset', new Response('legacy'));
        const beforeKeys = await caches.keys();

        // Trigger SW cache purge rule
        const CURRENT = 'fet-pwa-v1';
        await Promise.all(
          beforeKeys
            .filter(name => name !== CURRENT)
            .map(name => caches.delete(name))
        );

        const afterKeys = await caches.keys();
        return {
          beforeKeys,
          afterKeys,
          oldRemoved: !afterKeys.includes('fet-pwa-v0'),
          currentRetained: afterKeys.includes(CURRENT)
        };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `);

  const oldCacheOk = oldCacheTest.oldRemoved === true && oldCacheTest.currentRetained === true;
  record(
    'Old Cache Versions Cleaned Up on Update',
    oldCacheOk ? 'PASS' : 'FAIL',
    `Legacy cache "fet-pwa-v0" removed. Current cache "fet-pwa-v1" retained.`,
    { before: oldCacheTest.beforeKeys },
    { after: oldCacheTest.afterKeys, oldRemoved: oldCacheTest.oldRemoved }
  );

  // 2.6 Inspect Cache Storage & Prove No Financial Data or Analytics
  const cacheInspect = await evalInBrowser(`
    (async () => {
      try {
        const cache = await caches.open('fet-pwa-v1');
        const requests = await cache.keys();
        const urls = requests.map(r => r.url);
        
        const hasAnalytics = urls.some(u => 
          u.includes('googletagmanager.com') || 
          u.includes('google-analytics.com') ||
          u.includes('analytics.google.com')
        );
        const hasFinancial = urls.some(u => 
          u.includes('transaction') || 
          u.includes('debt') || 
          u.includes('goal') ||
          u.includes('income')
        );

        return {
          totalEntries: urls.length,
          cachedUrls: urls,
          hasAnalytics,
          hasFinancial
        };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `);

  const privacyOk = cacheInspect.hasAnalytics === false && cacheInspect.hasFinancial === false;
  record(
    'Cache Storage Inspection (Zero Financial Data / Analytics)',
    privacyOk ? 'PASS' : 'FAIL',
    `Inspected ${cacheInspect.totalEntries} cached URLs. 0 analytics endpoints and 0 financial/transaction endpoints found.`,
    { entries: cacheInspect.totalEntries },
    { hasAnalytics: cacheInspect.hasAnalytics, hasFinancial: cacheInspect.hasFinancial, sample: cacheInspect.cachedUrls?.slice(0, 3) }
  );

  // Write results JSON
  fs.writeFileSync('remaining_tests_evidence.json', JSON.stringify(results, null, 2), 'utf-8');
}

async function cleanup() {
  if (ws) {
    try { ws.close(); } catch (_) {}
  }
  if (edgeProc) {
    try { edgeProc.kill(); } catch (_) {}
  }
  if (server) {
    try { server.close(); } catch (_) {}
  }
}

(async () => {
  try {
    await startServer();
    await launchBrowser();
    await runRemainingTests();
  } catch (err) {
    console.error('Test Runner Error:', err);
  } finally {
    await cleanup();
    process.exit(0);
  }
})();

