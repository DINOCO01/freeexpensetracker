import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4410;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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
    console.log(`  ✅ ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAILED: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ name, pass: false, details });
  }
}

server.listen(PORT, async () => {
  const cdpPort = 9310;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/bill-splitter/`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const list = await (await fetch(`http://localhost:${cdpPort}/json/list`)).json();
    const page = list.find((p) => p.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const onMsg = (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.id === curId) {
            ws.off('message', onMsg);
            if (parsed.error) reject(parsed.error);
            else resolve(parsed.result);
          }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    async function evalJs(exp) {
      const r = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return r.result?.value;
    }

    console.log('\n======================================================');
    console.log('🧪 VERIFYING BUY ME A COFFEE POPUP FREQUENCY & PERSISTENCE');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: First Visit (Fresh Storage)
    // -------------------------------------------------------------------------
    console.log('--- 1. First Visit Behavior ---');
    await evalJs(`localStorage.clear(); window.location.reload();`);
    // Wait 1.2 seconds for page load and BMC 500ms reveal
    await new Promise((r) => setTimeout(r, 1400));

    const firstVisitState = await evalJs(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        const isVisible = tooltip ? (window.getComputedStyle(tooltip).visibility === 'visible' && parseFloat(window.getComputedStyle(tooltip).opacity) > 0.5) : false;

        return {
          wbtnFound: !!wbtn,
          tooltipFound: !!tooltip,
          isVisible,
          tooltipText: tooltip ? tooltip.innerText : ''
        };
      })()
    `);

    check('Coffee button #bmc-wbtn is present on first visit', firstVisitState.wbtnFound);
    check('Promotional tooltip appears on first visit', firstVisitState.isVisible);
    check('Promotional tooltip contains support message', firstVisitState.tooltipText.includes('supporting independent projects'));

    // -------------------------------------------------------------------------
    // TEST 2: Dismiss Message
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Message Dismissal & LocalStorage Tracking ---');
    await evalJs(`
      (() => {
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        if (tooltip) tooltip.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const dismissState = await evalJs(`
      (() => {
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        const isHidden = tooltip ? (tooltip.style.visibility === 'hidden' || tooltip.style.opacity === '0' || window.getComputedStyle(tooltip).display === 'none') : true;
        const storedSeen = localStorage.getItem('bmc_message_seen');
        const hasClass = document.documentElement.classList.contains('bmc-seen');

        return {
          isHidden,
          storedSeen,
          hasClass
        };
      })()
    `);

    check('Dismissing message hides the tooltip immediately', dismissState.isHidden);
    check('Preference is persisted in localStorage (bmc_message_seen=true)', dismissState.storedSeen === 'true');
    check('html.bmc-seen class is added to document root', dismissState.hasClass);

    // -------------------------------------------------------------------------
    // TEST 3: Page Refresh (Subsequent Visit)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Page Refresh (Subsequent Visit) ---');
    await evalJs(`window.location.reload();`);
    await new Promise((r) => setTimeout(r, 1400));

    const reloadState = await evalJs(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        const script = document.querySelector('script[data-name="BMC-Widget"]');
        const dataMessage = script ? script.getAttribute('data-message') : null;
        const isVisible = tooltip ? (window.getComputedStyle(tooltip).visibility === 'visible' && parseFloat(window.getComputedStyle(tooltip).opacity) > 0.5) : false;

        return {
          wbtnFound: !!wbtn,
          tooltipVisible: isVisible,
          dataMessageStripped: dataMessage === null,
          storedSeen: localStorage.getItem('bmc_message_seen')
        };
      })()
    `);

    check('Coffee button #bmc-wbtn remains permanently accessible on reload', reloadState.wbtnFound);
    check('Promotional tooltip does NOT display on page refresh', !reloadState.tooltipVisible);
    check('data-message attribute was stripped before initialization', reloadState.dataMessageStripped);

    // -------------------------------------------------------------------------
    // TEST 4: Page Navigation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Cross-Page Navigation ---');
    await evalJs(`window.location.href = 'http://localhost:${PORT}/';`);
    await new Promise((r) => setTimeout(r, 1400));

    const homeNavState = await evalJs(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        const isVisible = tooltip ? (window.getComputedStyle(tooltip).visibility === 'visible' && parseFloat(window.getComputedStyle(tooltip).opacity) > 0.5) : false;

        return {
          wbtnFound: !!wbtn,
          tooltipVisible: isVisible,
          storedSeen: localStorage.getItem('bmc_message_seen')
        };
      })()
    `);

    check('Coffee button remains visible on homepage', homeNavState.wbtnFound);
    check('Promotional tooltip does NOT appear when navigating to another page', !homeNavState.tooltipVisible);

    // -------------------------------------------------------------------------
    // TEST 5: Manual Coffee Button Click (Widget Opening)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Widget Click & Donation Opening ---');
    const widgetOpenState = await evalJs(`
      (() => {
        const wbtn = document.getElementById('bmc-wbtn');
        wbtn.click();
        const iframe = document.getElementById('bmc-iframe');

        return {
          iframeFound: !!iframe,
          iframeSrc: iframe ? iframe.src : null,
          iframeOpacity: iframe ? window.getComputedStyle(iframe).opacity : null
        };
      })()
    `);

    check('Clicking coffee button opens Buy Me a Coffee widget iframe', widgetOpenState.iframeFound);
    check('Widget iframe src points to correct donation page', widgetOpenState.iframeSrc && widgetOpenState.iframeSrc.includes('buymeacoffee.com/widget/page/princeupads'));

    // -------------------------------------------------------------------------
    // TEST 6: Clear Site Data / LocalStorage Restores First-Visit
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Clear LocalStorage Restores First-Visit Behavior ---');
    await evalJs(`localStorage.clear(); window.location.reload();`);
    await new Promise((r) => setTimeout(r, 1400));

    const resetState = await evalJs(`
      (() => {
        const tooltip = document.querySelector('#bmc-wbtn + div, #bmc-tooltip');
        const isVisible = tooltip ? (window.getComputedStyle(tooltip).visibility === 'visible' && parseFloat(window.getComputedStyle(tooltip).opacity) > 0.5) : false;

        return {
          tooltipVisible: isVisible,
          storedSeen: localStorage.getItem('bmc_message_seen')
        };
      })()
    `);

    check('Clearing localStorage restores first-visit message display', resetState.tooltipVisible);

    console.log('\n======================================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`TOTAL BMC CHECKS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('======================================================\n');

    edgeProc.kill();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
