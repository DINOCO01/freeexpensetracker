import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const DIST_DIR = path.resolve('dist');
const server = http.createServer((req, res) => {
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

server.listen(4398, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--remote-debugging-port=9298',
    '--headless=new',
    '--disable-gpu',
    'http://localhost:4398/bill-splitter/'
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const list = await (await fetch('http://localhost:9298/json/list')).json();
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

  const matched = (
    await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('#bmc-wbtn + div');
        return el ? { matched: true, text: el.innerText, tag: el.tagName } : { matched: false };
      })()`,
      returnByValue: true
    })
  ).result.value;

  console.log('Matched #bmc-wbtn + div:', JSON.stringify(matched, null, 2));

  edgeProc.kill();
  server.close();
  process.exit(0);
});
