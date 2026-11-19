import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4331;
const DIST_DIR = path.resolve('dist');
const TARGET_URL = `http://localhost:${PORT}/bill-splitter/`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_PATH = 'C:\\Users\\princ\\.gemini\\antigravity\\brain\\8465f667-0b7d-42d6-a856-c56991559b8f\\qa_mobile_390_verified.png';

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
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      let cleanPath = reqPath.replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, cleanPath);

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) filePath += '.html';
        else if (fs.existsSync(path.join(filePath, 'index.html'))) filePath = path.join(filePath, 'index.html');
      }

      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => resolve());
  });
}

function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-mobile-qa-'));

  edgeProc = spawn(EDGE_PATH, [
    '--remote-debugging-port=9226',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--window-size=390,844',
    'about:blank'
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  const listRes = await fetch('http://localhost:9226/json/list');
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page');

  const WebSocket = (await import('ws')).default;
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
  });

  await sendCommand('Page.enable');
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await sendCommand('Page.navigate', { url: TARGET_URL });
  await new Promise((r) => setTimeout(r, 1000));

  // Capture screenshot
  const scr = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(scr.data, 'base64'));
  console.log(`[QA] Screenshot saved to ${SCREENSHOT_PATH}`);

  const scrollWidth = await sendCommand('Runtime.evaluate', {
    expression: 'document.documentElement.scrollWidth <= 390',
    returnByValue: true
  });
  console.log('[QA] 390px No horizontal overflow:', scrollWidth.result.value);

  if (ws) ws.close();
  if (edgeProc) edgeProc.kill();
  if (server) server.close();
}

run().catch(console.error);
