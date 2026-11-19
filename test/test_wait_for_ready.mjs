// test/test_wait_for_ready.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9237;
const tmp = path.join(process.cwd(), '.tmp_cdp_' + Date.now());

const proc = spawn(edge, [
  `--remote-debugging-port=${CDP_PORT}`,
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${tmp}`,
  'http://127.0.0.1:4321/'
]);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await sleep(2500);
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await r.json();
  const page = pages.find((p) => p.type === 'page' && p.url.includes('4321'));

  console.log('Target found:', page ? { url: page.url, title: page.title } : 'NONE');

  const { default: WebSocket } = await import('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => ws.on('open', res));

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const h = data => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Set mobile viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 395,
    height: 656,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(1000);

  // Poll for ready and window.switchTab
  for (let i = 0; i < 20; i++) {
    const res = await send('Runtime.evaluate', {
      expression: '({ href: window.location.href, title: document.title, ready: document.readyState, hasSwitchTab: typeof window.switchTab, hasNav: !!document.getElementById("mobile-bottom-nav") })',
      returnByValue: true
    });
    console.log(`Poll ${i}:`, res?.result?.value);
    if (res?.result?.value?.hasSwitchTab === 'function') {
      break;
    }
    await sleep(500);
  }

  // Click Split tab
  const splitResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]');
      btn?.click();
      return {
        activeTab: document.querySelector('.bottom-nav-btn.active')?.getAttribute('data-bottom-tab'),
        splitVisible: !document.getElementById('tab-view-split')?.classList.contains('hidden'),
        trackerHidden: document.getElementById('tab-view-tracker')?.classList.contains('hidden'),
        pillLeft: document.getElementById('bottom-nav-active-pill')?.style.left
      };
    })()`,
    returnByValue: true
  });
  console.log('Split Click Result:', splitResult?.result?.value);

  ws.close();
  proc.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

main();
