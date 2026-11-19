import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4999;
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

server.listen(PORT, async () => {
  const cdpPort = 9888;
  const tmpDir = path.join(os.tmpdir(), `cdp_ledger_scope_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('Page target not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, rej) => {
      ws.on('open', r);
      ws.on('error', rej);
    });

    let msgId = 1;
    function send(method, params = {}, timeoutMs = 7000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for CDP ${method}`));
        }, timeoutMs);

        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            clearTimeout(timer);
            ws.off('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    };

    const captureScreenshot = async (filePath) => {
      const data = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filePath, Buffer.from(data.data, 'base64'));
    };

    const setViewport = async (width, height) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 768
      });
    };

    await send('Page.enable');
    await send('DOM.enable');

    // =========================================================================
    // TEST 1: MOBILE 360px
    // =========================================================================
    console.log('\n--- 1. MOBILE VERIFICATION (360px) ---');
    await setViewport(360, 740);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const m360CompactVisible = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-compact-ledger');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })()
    `);
    check('360px Mobile: Compact Transaction Ledger card is visible', m360CompactVisible);

    const m360DesktopHidden = await evaluate(`
      (() => {
        const el = document.getElementById('desktop-tablet-ledger');
        if (!el) return true;
        return window.getComputedStyle(el).display === 'none';
      })()
    `);
    check('360px Mobile: Desktop/Tablet full ledger card is hidden', m360DesktopHidden);

    const m360TxCount = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-recent-transactions');
        return el ? el.children.length : 0;
      })()
    `);
    check('360px Mobile: Exactly 3 recent transactions appear', m360TxCount === 3, `count: ${m360TxCount}`);

    const m360RowDetails = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-recent-transactions');
        if (!el) return [];
        return Array.from(el.children).map(r => {
          const icon = r.querySelector('.rounded-xl');
          const desc = r.querySelector('.truncate');
          const amount = r.querySelector('.text-right span');
          const isIncome = amount?.textContent.includes('+');
          const isExpense = amount?.textContent.includes('-');
          const hasGreen = amount?.className.includes('emerald');
          const hasRed = amount?.className.includes('rose');
          return {
            hasIcon: !!icon,
            hasDesc: !!desc,
            isIncome,
            isExpense,
            hasCorrectColor: (isIncome && hasGreen) || (isExpense && hasRed)
          };
        });
      })()
    `);
    const m360RowsValid = m360RowDetails.every(r => r.hasIcon && r.hasDesc && r.hasCorrectColor);
    check('360px Mobile: Row styling (category icon, description, amounts, soft colors)', m360RowsValid);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_ledger_scope_360px.png'));

    // =========================================================================
    // TEST 2: MOBILE 395px
    // =========================================================================
    console.log('\n--- 2. MOBILE VERIFICATION (395px) ---');
    await setViewport(395, 844);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const m395CompactVisible = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-compact-ledger');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })()
    `);
    check('395px Mobile: Compact Transaction Ledger card is visible', m395CompactVisible);

    const m395DesktopHidden = await evaluate(`
      (() => {
        const el = document.getElementById('desktop-tablet-ledger');
        if (!el) return true;
        return window.getComputedStyle(el).display === 'none';
      })()
    `);
    check('395px Mobile: Desktop/Tablet full ledger card is hidden', m395DesktopHidden);

    const m395TxCount = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-recent-transactions');
        return el ? el.children.length : 0;
      })()
    `);
    check('395px Mobile: Exactly 3 recent transactions appear', m395TxCount === 3, `count: ${m395TxCount}`);

    // Test View All triggers on mobile
    const m395ModalOpensViaHeader = await evaluate(`
      (() => {
        const headerBtn = document.querySelector('#mobile-compact-ledger .btn-open-tx-history');
        if (!headerBtn) return false;
        headerBtn.click();
        const modal = document.getElementById('modal-transaction-history');
        return modal && !modal.classList.contains('hidden');
      })()
    `);
    check('395px Mobile: Top-right View All opens Complete History Modal', m395ModalOpensViaHeader);

    const m395ModalCloses = await evaluate(`
      (() => {
        const btn = document.getElementById('btn-close-ledger-modal');
        if (!btn) return false;
        btn.click();
        const modal = document.getElementById('modal-transaction-history');
        return modal && modal.classList.contains('hidden');
      })()
    `);
    check('395px Mobile: Modal closes via close button', m395ModalCloses);

    const m395ModalOpensViaBottom = await evaluate(`
      (() => {
        const btns = document.querySelectorAll('#mobile-compact-ledger .btn-open-tx-history');
        const bottomBtn = btns[btns.length - 1];
        if (!bottomBtn) return false;
        bottomBtn.click();
        const modal = document.getElementById('modal-transaction-history');
        return modal && !modal.classList.contains('hidden');
      })()
    `);
    check('395px Mobile: Bottom View All Transactions button opens Complete History Modal', m395ModalOpensViaBottom);

    await evaluate(`
      (() => {
        const modal = document.getElementById('modal-transaction-history');
        if (modal) modal.classList.add('hidden');
      })()
    `);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_ledger_scope_395px.png'));

    // =========================================================================
    // TEST 3: TABLET 768px
    // =========================================================================
    console.log('\n--- 3. TABLET VERIFICATION (768px) ---');
    await setViewport(768, 1024);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const t768CompactHidden = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-compact-ledger');
        if (!el) return true;
        return window.getComputedStyle(el).display === 'none';
      })()
    `);
    check('768px Tablet: Mobile compact ledger is hidden', t768CompactHidden);

    const t768FullLedgerVisible = await evaluate(`
      (() => {
        const el = document.getElementById('desktop-tablet-ledger');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })()
    `);
    check('768px Tablet: Original full ledger card is visible', t768FullLedgerVisible);

    const t768TableVisible = await evaluate(`
      (() => {
        const table = document.getElementById('transactions-tbody')?.closest('table');
        if (!table) return false;
        return window.getComputedStyle(table).display !== 'none';
      })()
    `);
    check('768px Tablet: Original table is visible', t768TableVisible);

    const t768RowCount = await evaluate(`
      (() => {
        const tbody = document.getElementById('transactions-tbody');
        return tbody ? tbody.children.length : 0;
      })()
    `);
    check('768px Tablet: Shows all transactions (not limited to 3)', t768RowCount >= 6, `rows: ${t768RowCount}`);

    const t768HasOriginalButtons = await evaluate(`
      (() => {
        const card = document.getElementById('desktop-tablet-ledger');
        const csv = card?.querySelector('#btn-export-csv');
        const xlsx = card?.querySelector('#btn-export-excel-quick');
        const backup = card?.querySelector('#btn-backup-json');
        const restore = card?.querySelector('#btn-restore-json');
        const search = card?.querySelector('#search-transactions');
        return !!(csv && xlsx && backup && restore && search);
      })()
    `);
    check('768px Tablet: Preserves original Search, CSV, XLSX, Backup, and Restore buttons', t768HasOriginalButtons);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'tablet_ledger_scope_768px.png'));

    // =========================================================================
    // TEST 4: DESKTOP 1280px
    // =========================================================================
    console.log('\n--- 4. DESKTOP VERIFICATION (1280px) ---');
    await setViewport(1280, 900);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const d1280CompactHidden = await evaluate(`
      (() => {
        const el = document.getElementById('mobile-compact-ledger');
        if (!el) return true;
        return window.getComputedStyle(el).display === 'none';
      })()
    `);
    check('1280px Desktop: Mobile compact ledger is hidden', d1280CompactHidden);

    const d1280FullLedgerVisible = await evaluate(`
      (() => {
        const el = document.getElementById('desktop-tablet-ledger');
        if (!el) return false;
        return window.getComputedStyle(el).display !== 'none';
      })()
    `);
    check('1280px Desktop: Original full ledger card is visible', d1280FullLedgerVisible);

    const d1280TableVisible = await evaluate(`
      (() => {
        const table = document.getElementById('transactions-tbody')?.closest('table');
        if (!table) return false;
        return window.getComputedStyle(table).display !== 'none';
      })()
    `);
    check('1280px Desktop: Original full ledger table is visible', d1280TableVisible);

    const d1280RowCount = await evaluate(`
      (() => {
        const tbody = document.getElementById('transactions-tbody');
        return tbody ? tbody.children.length : 0;
      })()
    `);
    check('1280px Desktop: Shows all transactions (original full ledger, not limited to 3)', d1280RowCount >= 6, `rows: ${d1280RowCount}`);

    const d1280HasOriginalButtons = await evaluate(`
      (() => {
        const card = document.getElementById('desktop-tablet-ledger');
        const csv = card?.querySelector('#btn-export-csv');
        const xlsx = card?.querySelector('#btn-export-excel-quick');
        const backup = card?.querySelector('#btn-backup-json');
        const restore = card?.querySelector('#btn-restore-json');
        const search = card?.querySelector('#search-transactions');
        return !!(csv && xlsx && backup && restore && search);
      })()
    `);
    check('1280px Desktop: Preserves original Search, CSV, XLSX, Backup, and Restore', d1280HasOriginalButtons);

    // Verify side-by-side with Expense Logger
    const d1280SideBySide = await evaluate(`
      (() => {
        const logger = document.getElementById('form-expense-logger')?.closest('.rounded-2xl');
        const ledger = document.getElementById('desktop-tablet-ledger');
        if (!logger || !ledger) return false;
        const loggerRect = logger.getBoundingClientRect();
        const ledgerRect = ledger.getBoundingClientRect();
        return Math.abs(loggerRect.top - ledgerRect.top) < 15;
      })()
    `);
    check('1280px Desktop: Expense Logger & Ledger are side-by-side in 2-column grid', d1280SideBySide);

    // Verify zero horizontal overflow
    const d1280NoOverflow = await evaluate(`
      (() => {
        const ledger = document.getElementById('desktop-tablet-ledger');
        if (!ledger) return false;
        return ledger.scrollWidth <= ledger.clientWidth + 2;
      })()
    `);
    check('1280px Desktop: Zero horizontal overflow or clipping', d1280NoOverflow);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'desktop_ledger_scope_1280px.png'));

    console.log('\n=======================================================');
    const passed = testResults.filter(r => r.pass).length;
    const failed = testResults.filter(r => !r.pass).length;
    console.log(`REGRESSION TESTS SUMMARY: ${passed}/${testResults.length} checks passed (${failed} failed).`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    try { edgeProc.kill(); } catch (_) {}
    server.close();
  }
});
