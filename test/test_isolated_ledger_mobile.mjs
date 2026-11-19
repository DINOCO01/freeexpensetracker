import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4488;
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

server.listen(PORT, async () => {
  const cdpPort = 9366;
  const tmpDir = path.join(os.tmpdir(), `cdp_ledger_${Date.now()}`);
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
    function send(method, params = {}, timeoutMs = 5000) {
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

    // Set mobile device metrics
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });

    // Navigate to local build server
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    // Evaluate Ledger Mobile DOM
    const ledgerState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const mobileContainer = document.getElementById('transactions-mobile-container');
          const tbody = document.getElementById('transactions-tbody');
          const desktopTableContainer = document.querySelector('.hidden.sm\\\\:block');
          const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
          const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
          const emptyState = document.getElementById('empty-ledger-state');
          
          return {
            mobileContainerExists: !!mobileContainer,
            mobileContainerVisible: mobileContainer ? window.getComputedStyle(mobileContainer).display !== 'none' : false,
            desktopTableHidden: desktopTableContainer ? window.getComputedStyle(desktopTableContainer).display === 'none' : true,
            tbodyExists: !!tbody,
            trCount: trs.length,
            cardCount: cards.length,
            firstCardVisible: cards[0] ? cards[0].getBoundingClientRect().height > 0 : false,
            firstCardText: cards[0] ? cards[0].innerText : null,
            firstCardHtml: cards[0] ? cards[0].innerHTML : null,
            hasDeleteButtons: cards.length > 0 && !!cards[0].querySelector('.btn-delete-tx'),
            emptyStateHidden: emptyState ? emptyState.classList.contains('hidden') : null,
            txCountText: document.getElementById('tx-count-display')?.innerText,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `,
      returnByValue: true
    });

    console.log('\n--- ISOLATED TRANSACTION LEDGER MOBILE TEST ---');
    console.log('Ledger Mobile State:', JSON.stringify(ledgerState.result?.value, null, 2));

    const val = ledgerState.result?.value;
    const pass = val &&
      val.mobileContainerExists &&
      val.mobileContainerVisible &&
      val.desktopTableHidden &&
      val.cardCount === 6 &&
      val.firstCardVisible &&
      val.hasDeleteButtons &&
      val.scrollWidth <= val.clientWidth;

    if (pass) {
      console.log('✅ PASS: Isolated mobile ledger test passed!');
    } else {
      console.error('❌ FAIL: Isolated mobile ledger test failed!');
    }

    // Scroll to ledger on mobile and take screenshot
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const mobileContainer = document.getElementById('transactions-mobile-container');
          if (mobileContainer) mobileContainer.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 400));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'after_ledger_mobile_375px.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved after_ledger_mobile_375px.png');

    process.exit(pass ? 0 : 1);

  } catch (err) {
    console.error('Error during isolated test:', err);
    process.exit(1);
  } finally {
    edgeProc.kill();
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});
