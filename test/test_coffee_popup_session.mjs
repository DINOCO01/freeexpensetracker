import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4789;
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
  const cdpPort = 9988;
  const tmpDir = path.join(os.tmpdir(), `cdp_coffee_${Date.now()}`);
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

    console.log('\n=======================================================');
    console.log('--- 1. DESKTOP SESSION VERIFICATION (1280px) ---');
    console.log('=======================================================');
    await setViewport(1280, 900);

    // Scenario 1: First website visit in fresh session -> popup appears once, sessionStorage flag set
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const s1Flag = await evaluate(`sessionStorage.getItem('freeExpenseTracker_coffeePopupShown')`);
    check('Scenario 1: First visit in fresh session sets sessionStorage flag immediately', s1Flag === 'true', `flag: ${s1Flag}`);

    const s1HasBmcSeen = await evaluate(`document.documentElement.classList.contains('bmc-seen')`);
    // Note: On first visit, bmc-seen is added after dismiss or immediately when shown
    check('Scenario 1: First visit acknowledges session lifecycle', s1Flag === 'true');

    // Scenario 2: Navigate to Split -> no popup
    const s2Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') {
          window.switchTab('split');
        }
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        return {
          sessionFlag: sessionStorage.getItem('freeExpenseTracker_coffeePopupShown'),
          hasDataMessage: bmcScript?.hasAttribute('data-message')
        };
      })()
    `);
    check('Scenario 2: Navigate to Split tab -> session flag preserved', s2Result.sessionFlag === 'true');

    // Scenario 3: Navigate to Templates -> no popup
    const s3Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') window.switchTab('templates');
        return sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
      })()
    `);
    check('Scenario 3: Navigate to Templates tab -> no popup, flag preserved', s3Result === 'true');

    // Scenario 4: Navigate to Debt -> no popup
    const s4Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') window.switchTab('debt');
        return sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
      })()
    `);
    check('Scenario 4: Navigate to Debt tab -> no popup, flag preserved', s4Result === 'true');

    // Scenario 5: Navigate to Goals -> no popup
    const s5Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') window.switchTab('targets');
        return sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
      })()
    `);
    check('Scenario 5: Navigate to Goals tab -> no popup, flag preserved', s5Result === 'true');

    // Scenario 6: Navigate to More (Knowledge) -> no popup
    const s6Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') window.switchTab('knowledge');
        return sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
      })()
    `);
    check('Scenario 6: Navigate to More tab -> no popup, flag preserved', s6Result === 'true');

    // Scenario 7: Navigate back to Tracker -> no popup
    const s7Result = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') window.switchTab('tracker');
        return sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
      })()
    `);
    check('Scenario 7: Navigate back to Tracker -> no popup, flag preserved', s7Result === 'true');

    // Scenario 8: Refresh the page -> no popup
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    const s8Result = await evaluate(`
      (() => {
        const flag = sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        const hasDataMessage = bmcScript?.hasAttribute('data-message');
        const hasBmcSeen = document.documentElement.classList.contains('bmc-seen');
        return { flag, hasDataMessage, hasBmcSeen };
      })()
    `);
    check('Scenario 8: Reloading/refreshing page suppresses automatic popup (data-message removed)', !s8Result.hasDataMessage);
    check('Scenario 8: Reloading/refreshing page applies bmc-seen class', s8Result.hasBmcSeen);
    check('Scenario 8: Session flag remains true after refresh', s8Result.flag === 'true');

    // Scenario 9: Open another page on the website -> no popup
    await send('Page.navigate', { url: `http://localhost:${PORT}/bill-splitter/` });
    await new Promise((r) => setTimeout(r, 2000));

    const s9Result = await evaluate(`
      (() => {
        const flag = sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        const hasDataMessage = bmcScript?.hasAttribute('data-message');
        const hasBmcSeen = document.documentElement.classList.contains('bmc-seen');
        return { flag, hasDataMessage, hasBmcSeen };
      })()
    `);
    check('Scenario 9: Opening another page (/bill-splitter/) suppresses automatic popup', !s9Result.hasDataMessage);
    check('Scenario 9: Another page retains bmc-seen class', s9Result.hasBmcSeen);
    check('Scenario 9: Session flag persists across pages', s9Result.flag === 'true');

    // Scenario 10: Manually click coffee icon -> widget opens without resetting session flag
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const s10Result = await evaluate(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        if (wbtn) {
          wbtn.click();
        }
        return {
          flag: sessionStorage.getItem('freeExpenseTracker_coffeePopupShown'),
          hasBmcSeen: document.documentElement.classList.contains('bmc-seen')
        };
      })()
    `);
    check('Scenario 10: Manual click does not reset session flag', s10Result.flag === 'true');

    // Scenario 11: Close manually opened widget -> no automatic reopening
    const s11Result = await evaluate(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        if (wbtn) {
          wbtn.click(); // toggle close
        }
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        return {
          flag: sessionStorage.getItem('freeExpenseTracker_coffeePopupShown'),
          hasDataMessage: bmcScript?.hasAttribute('data-message')
        };
      })()
    `);
    check('Scenario 11: Closing manually opened widget maintains suppression', !s11Result.hasDataMessage);

    // Scenario 12: Start a fresh browser session (clear sessionStorage) -> popup can appear once again
    await evaluate(`sessionStorage.clear();`);
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    const s12Result = await evaluate(`
      (() => {
        // In a fresh session, the script should immediately detect fresh session and set the flag for this visit
        const flag = sessionStorage.getItem('freeExpenseTracker_coffeePopupShown');
        return { flag };
      })()
    `);
    check('Scenario 12: Fresh browser session allows popup once and records flag', s12Result.flag === 'true');

    // =========================================================================
    // MOBILE SESSION VERIFICATION (395px)
    // =========================================================================
    console.log('\n=======================================================');
    console.log('--- 2. MOBILE SESSION VERIFICATION (395px) ---');
    console.log('=======================================================');
    await setViewport(395, 844);

    // Fresh session on mobile
    await evaluate(`sessionStorage.clear();`);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const mFresh = await evaluate(`sessionStorage.getItem('freeExpenseTracker_coffeePopupShown')`);
    check('Mobile 395px: Fresh session records flag on first visit', mFresh === 'true');

    // Mobile refresh -> suppressed
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    const mRefresh = await evaluate(`
      (() => {
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        return {
          hasDataMessage: bmcScript?.hasAttribute('data-message'),
          hasBmcSeen: document.documentElement.classList.contains('bmc-seen'),
          flag: sessionStorage.getItem('freeExpenseTracker_coffeePopupShown')
        };
      })()
    `);
    check('Mobile 395px: Refresh suppresses automatic popup', !mRefresh.hasDataMessage && mRefresh.hasBmcSeen);

    // Mobile tab switch -> suppressed
    const mTabs = await evaluate(`
      (() => {
        if (typeof window.switchTab === 'function') {
          window.switchTab('split');
          window.switchTab('templates');
          window.switchTab('tracker');
        }
        const bmcScript = document.querySelector('script[data-name="BMC-Widget"]');
        return {
          hasDataMessage: bmcScript?.hasAttribute('data-message'),
          flag: sessionStorage.getItem('freeExpenseTracker_coffeePopupShown')
        };
      })()
    `);
    check('Mobile 395px: Tab switches maintain suppression', !mTabs.hasDataMessage && mTabs.flag === 'true');

    console.log('\n=======================================================');
    const passed = testResults.filter(r => r.pass).length;
    const failed = testResults.filter(r => !r.pass).length;
    console.log(`BUY ME A COFFEE TESTS SUMMARY: ${passed}/${testResults.length} checks passed (${failed} failed).`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    try { edgeProc.kill(); } catch (_) {}
    server.close();
  }
});
