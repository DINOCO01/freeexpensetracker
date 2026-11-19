import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4777;
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
  const cdpPort = 9688;
  const tmpDir = path.join(os.tmpdir(), `cdp_preset_test_${Date.now()}`);
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
    function send(method, params = {}, timeoutMs = 6000) {
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
      if (res.exceptionDetails) {
        console.error('Browser eval exception:', res.exceptionDetails);
      }
      return res.result?.value;
    };

    const setViewport = async (width, height, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });
      await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile });
    };

    const captureScreenshot = async (filePath) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    };

    await send('Page.enable');
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    // Test runner function that executes all 6 required scenarios on current viewport
    const runPresetScenarios = async (viewportName) => {
      console.log(`\n--- EXECUTING PRESET SCENARIOS ON ${viewportName} ---`);

      // Scenario 1: Enter 15000, select Housing -> amount remains 15000
      const s1 = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const housingChip = document.querySelector('.btn-preset-chip[data-preset-category="Housing"]');

        inputAmt.value = '15000';
        inputAmt.dispatchEvent(new Event('input', { bubbles: true }));

        housingChip.click();

        return {
          amount: inputAmt.value,
          category: selectCat.value,
          success: inputAmt.value === '15000' && selectCat.value === 'Housing'
        };
      })()`);
      check(`${viewportName} - Scenario 1: Enter 15000, select Housing -> amount remains 15000`, s1.success, `Amount: ${s1.amount}, Cat: ${s1.category}`);

      // Scenario 2: Enter 2500, select Travel -> amount remains 2500
      const s2 = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const travelChip = document.querySelector('.btn-preset-chip[data-preset-category="Travel"]');

        inputAmt.value = '2500';
        inputAmt.dispatchEvent(new Event('input', { bubbles: true }));

        travelChip.click();

        return {
          amount: inputAmt.value,
          category: selectCat.value,
          success: inputAmt.value === '2500' && selectCat.value === 'Travel'
        };
      })()`);
      check(`${viewportName} - Scenario 2: Enter 2500, select Travel -> amount remains 2500`, s2.success, `Amount: ${s2.amount}, Cat: ${s2.category}`);

      // Scenario 3: Select Food with an empty amount -> default amount can populate (3500)
      const s3 = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const foodChip = document.querySelector('.btn-preset-chip[data-preset-category="Food"]');

        // Verify clean empty amount
        if (inputAmt.value !== '') inputAmt.value = '';

        foodChip.click();

        return {
          amount: inputAmt.value,
          category: selectCat.value,
          success: inputAmt.value === '3500' && selectCat.value === 'Food'
        };
      })()`);
      check(`${viewportName} - Scenario 3: Select Food with empty amount -> default amount populates (3500)`, s3.success, `Amount: ${s3.amount}, Cat: ${s3.category}`);

      // Scenario 4: Select Housing, then Utilities without editing the suggested amount -> suggested amount can update (15000 -> 1800)
      const s4 = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const housingChip = document.querySelector('.btn-preset-chip[data-preset-category="Housing"]');
        const utilChip = document.querySelector('.btn-preset-chip[data-preset-category="Utilities"]');

        // Step 1: Click Housing
        housingChip.click();
        const housingAmt = inputAmt.value;
        const housingCat = selectCat.value;

        // Step 2: Click Utilities directly without editing
        utilChip.click();
        const utilAmt = inputAmt.value;
        const utilCat = selectCat.value;

        return {
          housingAmt,
          housingCat,
          utilAmt,
          utilCat,
          success: housingAmt === '15000' && housingCat === 'Housing' && utilAmt === '1800' && utilCat === 'Utilities'
        };
      })()`);
      check(`${viewportName} - Scenario 4: Select Housing, then Utilities unedited -> updates suggested amount (15000 -> 1800)`, s4.success, `H: ${s4.housingAmt}, U: ${s4.utilAmt}`);

      // Scenario 5: Select Food, manually change amount to 500, then select Travel -> amount remains 500
      const s5 = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const foodChip = document.querySelector('.btn-preset-chip[data-preset-category="Food"]');
        const travelChip = document.querySelector('.btn-preset-chip[data-preset-category="Travel"]');

        // Step 1: Select Food
        foodChip.click();
        const step1Amt = inputAmt.value;

        // Step 2: Manually edit amount to 500
        inputAmt.value = '500';
        inputAmt.dispatchEvent(new Event('input', { bubbles: true }));

        // Step 3: Select Travel
        travelChip.click();

        return {
          step1Amt,
          finalAmount: inputAmt.value,
          finalCat: selectCat.value,
          success: step1Amt === '3500' && inputAmt.value === '500' && selectCat.value === 'Travel'
        };
      })()`);
      check(`${viewportName} - Scenario 5: Select Food, manually change to 500, select Travel -> amount remains 500`, s5.success, `Amount: ${s5.finalAmount}, Cat: ${s5.finalCat}`);

      // Scenario 6: Clear the form and verify preset state resets
      const s6 = await evaluate(`(() => {
        // Form currently has 500 from previous step
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputAmt = document.getElementById('input-item-amount');
        const inputName = document.getElementById('input-item-name');
        const selectCat = document.getElementById('select-item-category');
        const isFieldsCleared = inputAmt.value === '' && inputName.value === '';

        // Now clicking Food preset should populate 3500 normally
        const foodChip = document.querySelector('.btn-preset-chip[data-preset-category="Food"]');
        foodChip.click();

        return {
          isFieldsCleared,
          afterClearFoodAmt: inputAmt.value,
          afterClearFoodCat: selectCat.value,
          success: isFieldsCleared && inputAmt.value === '3500' && selectCat.value === 'Food'
        };
      })()`);
      check(`${viewportName} - Scenario 6: Clear form resets preset state properly`, s6.success, `Cleared: ${s6.isFieldsCleared}, Amount: ${s6.afterClearFoodAmt}`);

      // Add Expense submission test
      const sSubmit = await evaluate(`(() => {
        const clearBtn = document.getElementById('btn-clear-logger');
        clearBtn.click();

        const inputName = document.getElementById('input-item-name');
        const inputAmt = document.getElementById('input-item-amount');
        const selectCat = document.getElementById('select-item-category');
        const form = document.getElementById('form-expense-logger');

        inputName.value = 'Test Flight to Paris';
        inputAmt.value = '420';
        inputAmt.dispatchEvent(new Event('input', { bubbles: true }));

        const travelChip = document.querySelector('.btn-preset-chip[data-preset-category="Travel"]');
        travelChip.click(); // Should update category to Travel, keep 420 and keep custom description

        const amountPreserved = inputAmt.value === '420';
        const namePreserved = inputName.value === 'Test Flight to Paris';
        const catUpdated = selectCat.value === 'Travel';

        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

        // Check if transaction was added to ledger
        const firstRow = document.querySelector('#transactions-tbody tr, #transactions-mobile-container > div');
        const rowText = firstRow ? firstRow.textContent : '';
        const txSaved = rowText.includes('Test Flight to Paris') || rowText.includes('420');

        return {
          amountPreserved,
          namePreserved,
          catUpdated,
          txSaved,
          success: amountPreserved && namePreserved && catUpdated && txSaved
        };
      })()`);
      check(`${viewportName} - Expense Submission: Custom description & amount preserved through preset and saved`, sSubmit.success, `Amt: ${sSubmit.amountPreserved}, Name: ${sSubmit.namePreserved}, Saved: ${sSubmit.txSaved}`);
    };

    // 1. Test at 395px (Standard Mobile)
    await setViewport(395, 844, true);
    await runPresetScenarios('395px Mobile');
    await captureScreenshot(path.join(ARTIFACT_DIR, 'presets_test_395px.png'));

    // 2. Test at 360px (Compact Mobile)
    await setViewport(360, 780, true);
    await runPresetScenarios('360px Mobile');
    await captureScreenshot(path.join(ARTIFACT_DIR, 'presets_test_360px.png'));

    // 3. Test at 1280px (Desktop)
    await setViewport(1280, 900, false);
    await runPresetScenarios('1280px Desktop');
    await captureScreenshot(path.join(ARTIFACT_DIR, 'presets_test_1280px.png'));

    console.log('\n=======================================================');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`PRESET TESTS SUMMARY: ${passed}/${total} checks passed (${failed} failed).`);
    console.log('=======================================================\n');

    ws.close();
    edgeProc.kill();
    server.close();

    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
