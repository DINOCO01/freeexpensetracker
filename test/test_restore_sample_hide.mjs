import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4799;
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

async function runTest() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Static server running at http://localhost:${PORT}`);

  const cdpPort = 9228;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-restore-sample-qa-'));
  const edgeProcess = spawn(
    EDGE_PATH,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ]
  );

  await new Promise((r) => setTimeout(r, 2000));
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const data = await res.json();
      const page = data.find((p) => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!wsUrl) throw new Error('Could not connect to Edge DevTools');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let idCounter = 1;
  const send = (method, params = {}, timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      const timer = setTimeout(() => {
        ws.off('message', handler);
        reject(new Error(`Timeout waiting for CDP ${method}`));
      }, timeoutMs);

      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res?.result?.value;
  };

  const navigateTo = async (url) => {
    await send('Page.navigate', { url });
    await new Promise((resolve) => {
      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Page.loadEventFired') {
            ws.off('message', handler);
            resolve();
          }
        } catch (_) {}
      };
      ws.on('message', handler);
      setTimeout(() => {
        ws.off('message', handler);
        resolve();
      }, 3000);
    });
    await new Promise((r) => setTimeout(r, 500));
  };

  const setViewport = async (width, height, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile });
    await evaluate(`window.dispatchEvent(new Event('resize'))`);
    await new Promise((r) => setTimeout(r, 200));
  };

  const captureScreenshot = async (filename) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log(`  📸 Screenshot saved: ${filename}`);
  };

  try {
    // -------------------------------------------------------------------------
    // 1. FRESH VISITOR ON DESKTOP (1280px)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. SCENARIO 1: FRESH VISITOR (DESKTOP 1280px) ---');
    await setViewport(1280, 800, false);
    await navigateTo(`http://localhost:${PORT}/`);

    // Ensure completely clean storage for fresh visitor test
    await evaluate(`(() => {
      localStorage.clear();
      window.location.reload();
    })()`);
    await new Promise((r) => setTimeout(r, 1200));

    // Open Reset Confirmation Modal on Desktop
    await evaluate(`(() => {
      const btn = document.getElementById('btn-open-reset-modal');
      btn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    const freshModalState = await evaluate(`(() => {
      const modal = document.getElementById('reset-confirm-modal');
      const isModalVisible = modal && !modal.classList.contains('hidden');
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreVisible = btnRestore && !btnRestore.classList.contains('hidden') && getComputedStyle(btnRestore).display !== 'none';
      const optionsBox = document.getElementById('reset-modal-options-box');
      const isOptionsBoxVisible = optionsBox && !optionsBox.classList.contains('hidden') && getComputedStyle(optionsBox).display !== 'none';
      const btnResetBlank = document.getElementById('btn-confirm-reset-blank');
      const isBtnResetVisible = btnResetBlank && !btnResetBlank.classList.contains('hidden');
      return {
        isModalVisible,
        isBtnRestoreVisible,
        isOptionsBoxVisible,
        isBtnResetVisible
      };
    })()`);

    check('Fresh visitor: Reset confirmation modal opens', freshModalState.isModalVisible);
    check('Fresh visitor: "Restore Sample Data" button is VISIBLE', freshModalState.isBtnRestoreVisible);
    check('Fresh visitor: Reset modal options hint box is VISIBLE', freshModalState.isOptionsBoxVisible);
    check('Fresh visitor: "Reset to Blank Slate" button is VISIBLE', freshModalState.isBtnResetVisible);
    await captureScreenshot('reset_modal_fresh_visitor_desktop.png');

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // 2. USER SAVES FIRST TRANSACTION (DESKTOP 1280px)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. SCENARIO 2: USER SAVES FIRST TRANSACTION ---');
    await evaluate(`(() => {
      const nameInput = document.getElementById('input-item-name');
      const amtInput = document.getElementById('input-item-amount');
      const catSelect = document.getElementById('select-item-category');
      const form = document.getElementById('form-expense-logger');

      nameInput.value = 'First Real User Expense';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      amtInput.value = '75.50';
      amtInput.dispatchEvent(new Event('input', { bubbles: true }));

      catSelect.value = 'Food';
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Check storage flag
    const flagAfterFirstTx = await evaluate(`localStorage.getItem('fet_user_has_saved_v1')`);
    check('User saves first transaction: fet_user_has_saved_v1 is persisted as "true"', flagAfterFirstTx === 'true');

    // Open Reset Modal
    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const postSaveModalState = await evaluate(`(() => {
      const modal = document.getElementById('reset-confirm-modal');
      const isModalVisible = modal && !modal.classList.contains('hidden');
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreHidden = !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
      const optionsBox = document.getElementById('reset-modal-options-box');
      const isOptionsBoxHidden = !optionsBox || optionsBox.classList.contains('hidden') || getComputedStyle(optionsBox).display === 'none';
      const btnResetBlank = document.getElementById('btn-confirm-reset-blank');
      const isBtnResetVisible = btnResetBlank && !btnResetBlank.classList.contains('hidden');
      return {
        isModalVisible,
        isBtnRestoreHidden,
        isOptionsBoxHidden,
        isBtnResetVisible
      };
    })()`);

    check('User saves first transaction: "Restore Sample Data" button is automatically HIDDEN', postSaveModalState.isBtnRestoreHidden);
    check('User saves first transaction: Options hint box is automatically HIDDEN', postSaveModalState.isOptionsBoxHidden);
    check('User saves first transaction: "Reset to Blank Slate" remains visible', postSaveModalState.isBtnResetVisible);
    await captureScreenshot('reset_modal_user_saved_data_desktop.png');

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // 3. REFRESH / RELOAD PAGE (PERSISTENCE)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. SCENARIO 3: REFRESH PAGE PERSISTENCE ---');
    await evaluate(`window.location.reload()`);
    await new Promise((r) => setTimeout(r, 1200));

    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const refreshModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreHidden = !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
      const optionsBox = document.getElementById('reset-modal-options-box');
      const isOptionsBoxHidden = !optionsBox || optionsBox.classList.contains('hidden') || getComputedStyle(optionsBox).display === 'none';
      return {
        isBtnRestoreHidden,
        isOptionsBoxHidden
      };
    })()`);

    check('Refresh page: "Restore Sample Data" button stays HIDDEN', refreshModalState.isBtnRestoreHidden);
    check('Refresh page: Options box stays HIDDEN', refreshModalState.isOptionsBoxHidden);

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // 4. ADD MORE TRANSACTIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. SCENARIO 4: ADD MORE TRANSACTIONS ---');
    await evaluate(`(() => {
      const nameInput = document.getElementById('input-item-name');
      const amtInput = document.getElementById('input-item-amount');
      const catSelect = document.getElementById('select-item-category');
      const form = document.getElementById('form-expense-logger');

      nameInput.value = 'Second User Expense (Electric Bill)';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      amtInput.value = '110.00';
      amtInput.dispatchEvent(new Event('input', { bubbles: true }));

      catSelect.value = 'Utilities';
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const addMoreModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      return !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
    })()`);
    check('Add more transactions: "Restore Sample Data" button stays HIDDEN', addMoreModalState);

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // 5. DELETE INDIVIDUAL TRANSACTIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SCENARIO 5: DELETE INDIVIDUAL TRANSACTIONS ---');
    await evaluate(`(() => {
      // Delete transactions one by one
      const deleteButtons = Array.from(document.querySelectorAll('.btn-delete-tx'));
      deleteButtons.forEach((btn) => btn.click());
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const deleteTxsModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreHidden = !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
      const flag = localStorage.getItem('fet_user_has_saved_v1');
      return {
        isBtnRestoreHidden,
        flag
      };
    })()`);
    check('Delete individual transactions: flag remains "true"', deleteTxsModalState.flag === 'true');
    check('Delete individual transactions: "Restore Sample Data" stays HIDDEN', deleteTxsModalState.isBtnRestoreHidden);

    // -------------------------------------------------------------------------
    // 6. FULL APPLICATION RESET (RESET TO BLANK SLATE)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. SCENARIO 6: EXPLICIT APPLICATION RESET ---');
    await evaluate(`document.getElementById('btn-confirm-reset-blank').click()`);
    await new Promise((r) => setTimeout(r, 500));

    const flagAfterFullReset = await evaluate(`localStorage.getItem('fet_user_has_saved_v1')`);
    check('Full application reset: fet_user_has_saved_v1 flag is removed', flagAfterFullReset === null);

    // Reopen Reset modal after explicit application reset
    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const postResetModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreVisible = btnRestore && !btnRestore.classList.contains('hidden') && getComputedStyle(btnRestore).display !== 'none';
      const optionsBox = document.getElementById('reset-modal-options-box');
      const isOptionsBoxVisible = optionsBox && !optionsBox.classList.contains('hidden') && getComputedStyle(optionsBox).display !== 'none';
      return {
        isBtnRestoreVisible,
        isOptionsBoxVisible
      };
    })()`);
    check('Full application reset: "Restore Sample Data" button REAPPEARS', postResetModalState.isBtnRestoreVisible);
    check('Full application reset: Options box REAPPEARS', postResetModalState.isOptionsBoxVisible);

    // -------------------------------------------------------------------------
    // 7. RESTORE SAMPLE DATA ACTION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. SCENARIO 7: RESTORE SAMPLE DATA FUNCTIONALITY ---');
    await evaluate(`document.getElementById('btn-restore-sample').click()`);
    await new Promise((r) => setTimeout(r, 500));

    const sampleRestoreState = await evaluate(`(() => {
      const txRows = document.querySelectorAll('#transactions-tbody tr');
      const flag = localStorage.getItem('fet_user_has_saved_v1');
      return {
        txCount: txRows.length,
        flag
      };
    })()`);
    check('Restore Sample Data loads default 6 sample transactions', sampleRestoreState.txCount === 6);
    check('Restore Sample Data does not falsely set user_has_saved flag', sampleRestoreState.flag !== 'true');

    // Reopen Reset modal to verify option remains available for sample data user
    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const sampleUserModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      return btnRestore && !btnRestore.classList.contains('hidden') && getComputedStyle(btnRestore).display !== 'none';
    })()`);
    check('Restore Sample Data user: Option remains available and visible', sampleUserModalState);

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // 8. MOBILE VIEWPORT VERIFICATION (395px)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. SCENARIO 8: MOBILE VIEWPORT VERIFICATION (395px) ---');
    await setViewport(395, 844, true);
    await evaluate(`(() => {
      localStorage.clear();
      window.location.reload();
    })()`);
    await new Promise((r) => setTimeout(r, 1200));

    // Open More menu sheet on mobile
    await evaluate(`document.getElementById('btn-bottom-nav-more').click()`);
    await new Promise((r) => setTimeout(r, 400));

    // Click "Reset All Saved Data" button inside More sheet
    await evaluate(`document.querySelector('#more-menu-sheet .btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 400));

    const mobileFreshModalState = await evaluate(`(() => {
      const modal = document.getElementById('reset-confirm-modal');
      const isVisible = modal && !modal.classList.contains('hidden');
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnVisible = btnRestore && !btnRestore.classList.contains('hidden') && getComputedStyle(btnRestore).display !== 'none';
      return {
        isVisible,
        isBtnVisible
      };
    })()`);
    check('Mobile fresh visitor: Reset modal opens from More sheet', mobileFreshModalState.isVisible);
    check('Mobile fresh visitor: "Restore Sample Data" button is VISIBLE', mobileFreshModalState.isBtnVisible);
    await captureScreenshot('mobile_reset_modal_fresh_395px.png');

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 300));

    // Add transaction on mobile
    await evaluate(`(() => {
      const nameInput = document.getElementById('input-item-name');
      const amtInput = document.getElementById('input-item-amount');
      const catSelect = document.getElementById('select-item-category');
      const form = document.getElementById('form-expense-logger');

      nameInput.value = 'Mobile Coffee Purchase';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      amtInput.value = '4.75';
      amtInput.dispatchEvent(new Event('input', { bubbles: true }));

      catSelect.value = 'Food';
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Open More sheet and Reset modal on mobile after adding transaction
    await evaluate(`document.getElementById('btn-bottom-nav-more').click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`document.querySelector('#more-menu-sheet .btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 400));

    const mobilePostSaveModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      return !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
    })()`);
    check('Mobile after saving transaction: "Restore Sample Data" button is HIDDEN', mobilePostSaveModalState);
    await captureScreenshot('mobile_reset_modal_user_saved_395px.png');

    // Close modal
    await evaluate(`document.getElementById('btn-cancel-reset').click()`);
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------------------
    // 9. EXISTING USER DETECTION (SIMULATED PRE-EXISTING DATA)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. SCENARIO 9: EXISTING USER WITH SAVED DATA ---');
    await evaluate(`(() => {
      localStorage.clear();
      // Simulate existing user who saved transactions before this update
      localStorage.setItem('fet_transactions_v4', JSON.stringify([
        { id: 'tx-custom-99', name: 'Existing User Rent', amount: 2000, category: 'Housing', date: '2026-11-01', source: 'manual' }
      ]));
      window.location.reload();
    })()`);
    await new Promise((r) => setTimeout(r, 1200));

    await evaluate(`document.getElementById('btn-open-reset-modal').click()`);
    await new Promise((r) => setTimeout(r, 300));

    const existingUserModalState = await evaluate(`(() => {
      const btnRestore = document.getElementById('btn-restore-sample');
      const isBtnRestoreHidden = !btnRestore || btnRestore.classList.contains('hidden') || getComputedStyle(btnRestore).display === 'none';
      const flag = localStorage.getItem('fet_user_has_saved_v1');
      return {
        isBtnRestoreHidden,
        flag
      };
    })()`);
    check('Existing user with saved transactions: Automatically detected and flag set to "true"', existingUserModalState.flag === 'true');
    check('Existing user with saved transactions: "Restore Sample Data" button is HIDDEN', existingUserModalState.isBtnRestoreHidden);

  } finally {
    ws.close();
    edgeProcess.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }

  const passedCount = testResults.filter((r) => r.pass).length;
  const totalCount = testResults.length;
  console.log(`\n=======================================================`);
  console.log(`RESTORE SAMPLE TESTS SUMMARY: ${passedCount}/${totalCount} checks passed.`);
  console.log(`=======================================================`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
