import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4340;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath)) {
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, async () => {
  const cdpPort = 9250;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/bill-splitter/`
  ]);

  await new Promise((r) => setTimeout(r, 2500));
  const resp = await fetch(`http://localhost:${cdpPort}/json/list`);
  const list = await resp.json();
  const page = list.find((p) => p.type === 'page');
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((r) => ws.on('open', r));

  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          Array.from(document.querySelectorAll('[id*="bmc"], [class*="bmc"], iframe, #bmc-wbtn')).map(el => ({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            style: el.getAttribute('style'),
            rect: el.getBoundingClientRect()
          }))
        `,
        returnByValue: true
      }
    })
  );

  ws.on('message', (data) => {
    const res = JSON.parse(data.toString());
    if (res.id === 1) {
      console.log('Result:', JSON.stringify(res, null, 2));
      edgeProc.kill();
      server.close();
      process.exit(0);
    }
  });
});
