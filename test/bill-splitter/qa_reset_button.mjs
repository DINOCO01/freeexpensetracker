import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4390;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
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

async function runBrowserTests(browserName, browserPath, cdpPort) {
  console.log(`\n======================================================`);
  console.log(`🧪 TESTING IN ${browserName.toUpperCase()}`);
  console.log(`======================================================`);

  const proc = spawn(browserPath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/bill-splitter/`
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const list = await (await fetch(`http://localhost:${cdpPort}/json/list`)).json();
  const page = list.find((p) => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  let id = 1;
  function send(method, params = {}) {
    return new Promise((res, rej) => {
      const curId = id++;
      const onMsg = (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.id === curId) {
          ws.off('message', onMsg);
          if (parsed.error) rej(parsed.error);
          else res(parsed.result);
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

  async function setViewport(w, h) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  const viewports = [
    { w: 320, h: 568, name: '320px (iPhone SE / Ultra-compact)' },
    { w: 360, h: 800, name: '360px (Standard Android / Galaxy)' },
    { w: 375, h: 812, name: '375px (Compact iOS)' },
    { w: 390, h: 844, name: '390px (Mobile Focus iOS)' },
    { w: 412, h: 915, name: '412px (Large Android / Pixel)' },
    { w: 430, h: 932, name: '430px (iPhone Pro Max)' }
  ];

  for (const vp of viewports) {
    await setViewport(vp.w, vp.h);

    const metrics = await evalJs(`
      (() => {
        const btn = document.getElementById('btn-open-reset-modal');
        const card = btn.closest('.rounded-3xl');
        const topBar = btn.parentElement;
        const select = document.getElementById('select-currency');
        const label = topBar.querySelector('label');

        const btnRect = btn.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const selectRect = select.getBoundingClientRect();

        const insideCard = btnRect.right <= cardRect.right - 8;
        const insideViewport = btnRect.right <= window.innerWidth - 6 && btnRect.left >= 0;
        const gap = btnRect.left - selectRect.right;
        const hasTextVisible = btn.textContent.trim().includes('Reset');
        const svgVisible = !!btn.querySelector('svg');

        return {
          insideCard,
          insideViewport,
          gap,
          hasTextVisible,
          svgVisible,
          btnWidth: btnRect.width,
          btnRight: btnRect.right,
          cardRight: cardRect.right,
          windowWidth: window.innerWidth
        };
      })()
    `);

    check(`[${browserName}] Reset button stays within card boundary at ${vp.name}`, metrics.insideCard, `btnRight=${metrics.btnRight}, cardRight=${metrics.cardRight}`);
    check(`[${browserName}] Reset button stays completely within viewport at ${vp.name}`, metrics.insideViewport, `btnRight=${metrics.btnRight}, winWidth=${metrics.windowWidth}`);
    check(`[${browserName}] Proper spacing between Currency selector and Reset button at ${vp.name} (gap >= 8px)`, metrics.gap >= 7.5, `gap=${metrics.gap}px`);
    check(`[${browserName}] Reset button text and SVG icon visible at ${vp.name}`, metrics.hasTextVisible && metrics.svgVisible);

    // Capture screenshot if Edge
    if (browserName === 'Edge') {
      const ssRes = await send('Page.captureScreenshot', { format: 'png' });
      const ssPath = path.join(ARTIFACT_DIR, `reset_button_${vp.w}px.png`);
      fs.writeFileSync(ssPath, Buffer.from(ssRes.data, 'base64'));
      console.log(`  📸 Captured screenshot: reset_button_${vp.w}px.png`);
    }
  }

  // Functional test: verify Reset button is clickable and reset flow works
  console.log(`\n--- [${browserName}] Functional Reset Verification ---`);
  await setViewport(390, 844);

  // 1. Enter some non-default values in Even Split
  await evalJs(`
    (() => {
      const billInput = document.getElementById('input-even-bill');
      billInput.value = '5000';
      billInput.dispatchEvent(new Event('input', { bubbles: true }));

      const curSelect = document.getElementById('select-currency');
      curSelect.value = 'USD';
      curSelect.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  const preState = await evalJs(`
    (() => {
      const bill = document.getElementById('input-even-bill').value;
      const cur = document.getElementById('select-currency').value;
      const total = document.getElementById('even-grand-total-display').textContent;
      return { bill, cur, total };
    })()
  `);
  check(`[${browserName}] Modified inputs before reset: bill=$5000`, preState.bill === '5000' && preState.cur === 'USD');

  // 2. Click the Reset button
  const modalOpened = await evalJs(`
    (() => {
      const btn = document.getElementById('btn-open-reset-modal');
      btn.click();
      const modal = document.getElementById('modal-reset-confirm');
      return !modal.classList.contains('hidden');
    })()
  `);
  check(`[${browserName}] Clicking Reset button opens confirmation modal`, modalOpened);

  // 3. Confirm reset
  const postResetState = await evalJs(`
    (() => {
      const confirmBtn = document.getElementById('btn-reset-confirm');
      confirmBtn.click();

      const modal = document.getElementById('modal-reset-confirm');
      const bill = document.getElementById('input-even-bill').value;
      const cur = document.getElementById('select-currency').value;
      const total = document.getElementById('even-grand-total-display').textContent;

      return {
        modalClosed: modal.classList.contains('hidden'),
        bill,
        cur,
        total
      };
    })()
  `);

  check(`[${browserName}] Confirming reset closes modal`, postResetState.modalClosed);
  check(`[${browserName}] State restored to sample defaults after reset`, postResetState.cur === 'INR');

  proc.kill();
}

server.listen(PORT, async () => {
  try {
    // Test Edge
    await runBrowserTests('Edge', EDGE_PATH, 9291);

    // Test Chrome
    if (fs.existsSync(CHROME_PATH)) {
      await runBrowserTests('Chrome', CHROME_PATH, 9292);
    } else {
      console.log('Google Chrome not installed at default path, skipping Chrome run');
    }

    console.log('\n======================================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`TOTAL RESET CHECKS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('======================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test failed with error:', err);
    server.close();
    process.exit(1);
  }
});
