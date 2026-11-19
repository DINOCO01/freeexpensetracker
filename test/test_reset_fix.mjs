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

server.listen(4386, async () => {
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--remote-debugging-port=9286',
    '--headless=new',
    '--disable-gpu',
    'http://localhost:4386/bill-splitter/'
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const list = await (await fetch('http://localhost:9286/json/list')).json();
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

  // Apply proposed styling directly via JS
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('btn-open-reset-modal');
      const topBar = btn.parentElement;
      const curGroup = topBar.firstElementChild;
      const select = document.getElementById('select-currency');
      const label = topBar.querySelector('label');

      // Top bar
      topBar.className = "flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800/80 min-w-0";
      
      // Cur group
      curGroup.className = "flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1";

      // Label
      label.className = "text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0";

      // Select
      select.className = "min-w-0 flex-1 w-full max-w-[140px] xs:max-w-[180px] sm:max-w-xs truncate bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold rounded-xl px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer transition-colors";

      // Button
      btn.className = "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer";
    })()`
  });

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

          // Check if button stays inside card padding box and inside viewport
          const insideCard = btnRect.right <= cardRect.right - 12;
          const insideViewport = btnRect.right <= window.innerWidth - 8;
          const gapBetweenSelectAndBtn = btnRect.left - selectRect.right;

          return {
            viewport: ${w},
            cardRight: cardRect.right,
            btnLeft: btnRect.left,
            btnRight: btnRect.right,
            btnWidth: btnRect.width,
            selectWidth: selectRect.width,
            gapBetweenSelectAndBtn,
            insideCard,
            insideViewport,
            rightMarginToCard: cardRect.right - btnRect.right
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
