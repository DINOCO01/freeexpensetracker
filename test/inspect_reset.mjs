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

server.listen(4385, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--remote-debugging-port=9285',
    '--headless=new',
    '--disable-gpu',
    'http://localhost:4385/bill-splitter/'
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const list = await (await fetch('http://localhost:9285/json/list')).json();
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

  const sizes = [320, 360, 375, 390, 412, 430];
  for (const w of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 300));
    const r = (
      await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.getElementById('btn-open-reset-modal');
          const card = btn.closest('.rounded-3xl');
          const topBar = btn.parentElement;
          const select = document.getElementById('select-currency');
          const label = topBar.querySelector('label');
          const btnRect = btn.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          const topBarRect = topBar.getBoundingClientRect();
          const selectRect = select.getBoundingClientRect();
          const labelRect = label.getBoundingClientRect();
          return {
            viewport: ${w},
            cardRight: cardRect.right,
            cardInnerPaddingRight: 20,
            cardContentRightBound: cardRect.right - 20,
            btnLeft: btnRect.left,
            btnRight: btnRect.right,
            btnWidth: btnRect.width,
            selectWidth: selectRect.width,
            labelWidth: labelRect.width,
            overflowPixels: btnRect.right - (cardRect.right - 20),
            isCutOff: btnRect.right > cardRect.right - 20
          };
        })()`,
        returnByValue: true
      })
    ).result.value;
    console.log(`Result for ${w}px:`, JSON.stringify(r));
  }

  edgeProc.kill();
  server.close();
  process.exit(0);
});
