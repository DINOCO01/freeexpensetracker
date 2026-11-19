// test/debug_tab_click.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
let edgePath = EDGE_PATHS.find(p => fs.existsSync(p));

const tmpProfile = path.join(process.cwd(), '.tmp_cdp_debug_' + Date.now());
const CDP_PORT = 9229;

const browser = spawn(edgePath, [
  `--remote-debugging-port=${CDP_PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--user-data-dir=${tmpProfile}`,
  `http://localhost:4321/`
]);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await sleep(2500);
  const listRes = await fetch(`http://localhost:${CDP_PORT}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page');

  const { default: WebSocket } = await import('ws');
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
          if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
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

  // Set mobile viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 395,
    height: 656,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(500);

  const debug1 = await evaluate(`(() => {
    return {
      hasWindowSwitchTab: typeof window.switchTab,
      splitBtn: !!document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]'),
      splitBtnTag: document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]')?.tagName,
      splitView: !!document.getElementById('tab-view-split'),
      splitViewClasses: document.getElementById('tab-view-split')?.className,
      trackerViewClasses: document.getElementById('tab-view-tracker')?.className,
    };
  })()`);
  console.log('Debug 1 before click:', debug1);

  // Directly call window.switchTab('split')
  const debugCall = await evaluate(`(() => {
    if (typeof window.switchTab === 'function') {
      window.switchTab('split');
      return 'called switchTab';
    }
    return 'switchTab NOT a function';
  })()`);
  console.log('Direct call result:', debugCall);

  const debugAfterDirect = await evaluate(`(() => {
    return {
      splitViewClasses: document.getElementById('tab-view-split')?.className,
      trackerViewClasses: document.getElementById('tab-view-tracker')?.className,
    };
  })()`);
  console.log('Debug after direct call:', debugAfterDirect);

  // Now click the button
  const debugButtonClick = await evaluate(`(() => {
    const btn = document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]');
    btn.click();
    return {
      btnClicked: true,
      splitViewClasses: document.getElementById('tab-view-split')?.className,
      trackerViewClasses: document.getElementById('tab-view-tracker')?.className,
    };
  })()`);
  console.log('Debug button click:', debugButtonClick);

  ws.close();
  browser.kill();
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
}

run();
