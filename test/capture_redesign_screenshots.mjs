import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4330;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/bill-splitter/`;
const ARTIFACT_DIR = 'C:\\Users\\princ\\.gemini\\antigravity\\brain\\8465f667-0b7d-42d6-a856-c56991559b8f';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();

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
      '.ico': 'image/x-icon'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      let cleanPath = reqPath.replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, cleanPath);

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
      resolve();
    });
  });
}

function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInBrowser(expression) {
  const res = await sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error('Eval Exception: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result ? res.result.value : undefined;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-redesign-ss-'));
  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9230',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=1200,1000'
  ]);

  let wsUrl;
  for (let i = 0; i < 30; i++) {
    await delay(300);
    try {
      const res = await fetch('http://127.0.0.1:9230/json');
      const list = await res.json();
      const page = list.find((p) => p.type === 'page') || list[0];
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
  }

  const { WebSocket } = await import('ws');
  ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await sendCommand('Page.navigate', { url: TARGET_URL });
  await delay(2000);

  // 1. Enter sample Even Split details
  await evalInBrowser(`
    (() => {
      const bill = document.getElementById('input-even-bill');
      bill.value = '2400';
      bill.dispatchEvent(new Event('input', { bubbles: true }));

      const tax = document.getElementById('input-even-tax');
      tax.value = '5';
      tax.dispatchEvent(new Event('input', { bubbles: true }));

      const tipBtn = document.querySelector('#even-tip-presets button[data-tip="10"]');
      if (tipBtn) tipBtn.click();
    })()
  `);
  await delay(800);

  // Screenshot 1: Desktop Even Split
  let ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'redesign_even_split.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved redesign_even_split.png');

  // Screenshot 2: Desktop Itemized Split
  await evalInBrowser(`document.getElementById('tab-btn-itemized').click();`);
  await delay(800);
  ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'redesign_itemized_split.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved redesign_itemized_split.png');

  // Screenshot 3: Desktop Trip Split
  await evalInBrowser(`document.getElementById('tab-btn-trip').click();`);
  await delay(800);
  ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'redesign_trip_split.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved redesign_trip_split.png');

  // Screenshot 4: Dark Mode
  await evalInBrowser(`
    document.documentElement.classList.add('dark');
    document.getElementById('tab-btn-even').click();
  `);
  await delay(800);
  ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'redesign_dark_mode.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved redesign_dark_mode.png');

  // Screenshot 5: Mobile Viewport (375x812)
  await evalInBrowser(`document.documentElement.classList.remove('dark');`);
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await delay(800);
  ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'redesign_mobile.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved redesign_mobile.png');

  console.log('All redesign screenshots captured successfully!');
  ws.close();
  edgeProc.kill();
  server.close();
}

main().catch(console.error);
