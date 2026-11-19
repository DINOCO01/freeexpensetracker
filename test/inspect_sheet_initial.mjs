import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4488;
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

server.listen(PORT, async () => {
  const cdpPort = 9388;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            ws.off('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(exp) {
      const res = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 1000));

    const check = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const backdrop = document.getElementById("more-menu-backdrop");
      const rect = sheet ? sheet.getBoundingClientRect() : null;
      const computed = sheet ? window.getComputedStyle(sheet) : null;
      return {
        rect: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height, y: rect.y } : null,
        display: computed?.display,
        visibility: computed?.visibility,
        transform: computed?.transform,
        translate: computed?.translate,
        classList: sheet ? Array.from(sheet.classList) : [],
        windowHeight: window.innerHeight,
        backdropHidden: backdrop?.classList.contains("hidden")
      };
    })()`);

    console.log('INITIAL STATE ON LOAD:', JSON.stringify(check, null, 2));

    ws.close();
    edgeProc.kill();
    server.close();
  } catch (e) {
    console.error(e);
    try { edgeProc.kill(); } catch (err) {}
    try { server.close(); } catch (err) {}
  }
});
