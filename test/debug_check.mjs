// test/debug_check.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9233;
const tmp = path.join(process.cwd(), '.tmp_cdp_' + Date.now());

const proc = spawn(edge, [
  `--remote-debugging-port=${CDP_PORT}`,
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${tmp}`
]);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await sleep(2500);
  const r = await fetch(`http://localhost:${CDP_PORT}/json/list`);
  const pages = await r.json();
  const page = pages.find((p) => p.type === 'page');

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

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:4321/' });
  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        href: window.location.href,
        title: document.title,
        hasNav: !!document.getElementById('mobile-bottom-nav'),
        hasSplitView: !!document.getElementById('tab-view-split'),
        hasWindowSwitchTab: typeof window.switchTab,
        activeTabPill: document.getElementById('bottom-nav-active-pill')?.style.left
      };
    })()`,
    returnByValue: true
  });
  console.log('Result at load:', evalRes.result.value);

  // Test switchTab('split')
  const evalSwitch = await send('Runtime.evaluate', {
    expression: `(() => {
      if (typeof window.switchTab === 'function') {
        window.switchTab('split');
        return {
          called: true,
          splitVisible: !document.getElementById('tab-view-split')?.classList.contains('hidden'),
          trackerVisible: !document.getElementById('tab-view-tracker')?.classList.contains('hidden'),
          pillLeft: document.getElementById('bottom-nav-active-pill')?.style.left
        };
      }
      return { called: false };
    })()`,
    returnByValue: true
  });
  console.log('Result of window.switchTab("split"):', evalSwitch.result.value);

  // Test clicking bottom-nav Split button
  const evalBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      // First switch back to tracker
      window.switchTab('tracker');
      // Now click split button
      const splitBtn = document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]');
      splitBtn?.click();
      return {
        splitVisible: !document.getElementById('tab-view-split')?.classList.contains('hidden'),
        trackerVisible: !document.getElementById('tab-view-tracker')?.classList.contains('hidden'),
        pillLeft: document.getElementById('bottom-nav-active-pill')?.style.left
      };
    })()`,
    returnByValue: true
  });
  console.log('Result of clicking bottom-nav Split button:', evalBtn.result.value);

  ws.close();
  proc.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

main();
