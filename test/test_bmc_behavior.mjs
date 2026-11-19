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
    let content = fs.readFileSync(filePath, 'utf-8');
    // Inject test script right after <script data-name="BMC-Widget" ...>
    content = content.replace(
      'data-name="BMC-Widget"',
      'data-name="BMC-Widget" data-test="true"'
    );
    // Simulate seen state: remove data-message
    content = content.replace(
      'data-message="Thanks for supporting independent projects! ❤️ Your contribution helps keep my tools useful, accessible, and improving."',
      ''
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4399, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--remote-debugging-port=9299',
    '--headless=new',
    '--disable-gpu',
    'http://localhost:4399/bill-splitter/'
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const list = await (await fetch('http://localhost:9299/json/list')).json();
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

  // Wait 1.5 seconds (past the 500ms timeout)
  await new Promise((r) => setTimeout(r, 1500));

  // Inspect elements
  const elements = (
    await send('Runtime.evaluate', {
      expression: `(() => {
        const bmcBtn = document.getElementById('bmc-wbtn');
        const tooltip = Array.from(document.body.children).find(el =>
          el.tagName === 'DIV' &&
          el.id !== 'bmc-wbtn' &&
          el.style.fontFamily &&
          el.style.fontFamily.includes('Avenir')
        );

        return {
          bmcBtnFound: !!bmcBtn,
          tooltipFound: !!tooltip,
          tooltipVisible: tooltip ? (tooltip.style.visibility === 'visible' || tooltip.style.opacity === '1') : false,
          tooltipStyle: tooltip ? tooltip.getAttribute('style') : null
        };
      })()`,
      returnByValue: true
    })
  ).result.value;

  console.log('Result when data-message is absent:', JSON.stringify(elements, null, 2));

  // Test clicking #bmc-wbtn
  const clickRes = (
    await send('Runtime.evaluate', {
      expression: `(() => {
        const bmcBtn = document.getElementById('bmc-wbtn');
        bmcBtn.click();
        const iframe = document.getElementById('bmc-iframe');
        return {
          iframeFound: !!iframe,
          iframeSrc: iframe ? iframe.src : null,
          iframeOpacity: iframe ? iframe.style.opacity : null
        };
      })()`,
      returnByValue: true
    })
  ).result.value;

  console.log('Click result:', JSON.stringify(clickRes, null, 2));

  edgeProc.kill();
  server.close();
  process.exit(0);
});
