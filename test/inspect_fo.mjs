import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const cdpPort = 9555;
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--remote-debugging-port=' + cdpPort,
  '--headless=new',
  '--disable-gpu',
  'about:blank'
]);

await new Promise(r => setTimeout(r, 2000));
const list = await (await fetch('http://localhost:' + cdpPort + '/json/list')).json();
const page = list.find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.on('open', r));

let id = 1;
const send = (method, params = {}) => new Promise((resolve) => {
  const curId = id++;
  const handler = (data) => {
    const res = JSON.parse(data.toString());
    if (res.id === curId) { ws.off('message', handler); resolve(res.result); }
  };
  ws.on('message', handler);
  ws.send(JSON.stringify({ id: curId, method, params }));
});

const capture = async (filename, clip) => {
  const params = { format: 'png' };
  if (clip) params.clip = clip;
  const res = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(ARTIFACT_DIR, filename), Buffer.from(res.data, 'base64'));
  console.log(`Saved screenshot: ${filename}`);
};

await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:4321/' });
await new Promise(r => setTimeout(r, 2000));

// Viewport 1: 395px
console.log('\n--- 395px Layout Inspection ---');
await send('Emulation.setDeviceMetricsOverride', { width: 395, height: 844, deviceScaleFactor: 2, mobile: true });
await new Promise(r => setTimeout(r, 1000));

const res395 = await send('Runtime.evaluate', {
  expression: `(() => {
    const card = document.getElementById("mobile-financial-overview-card");
    const donut = card.querySelector("svg")?.parentElement;
    const rightCol = donut?.parentElement?.nextElementSibling;
    const notif = document.getElementById("mobile-fo-notification");
    const notifText = document.getElementById("mobile-fo-notification-text");
    const labels = Array.from(rightCol.querySelectorAll(".text-xs.font-semibold"));
    const values = Array.from(rightCol.querySelectorAll(".font-mono.text-xs"));
    
    return {
      cardWidth: card.getBoundingClientRect().width,
      cardHeight: card.getBoundingClientRect().height,
      donutWidth: donut.getBoundingClientRect().width,
      donutHeight: donut.getBoundingClientRect().height,
      rightColWidth: rightCol.getBoundingClientRect().width,
      notifHeight: notif.getBoundingClientRect().height,
      notifScrollWidth: notifText.scrollWidth,
      notifClientWidth: notifText.clientWidth,
      isNotifClipped: notifText.scrollWidth > notifText.clientWidth,
      labels: labels.map(l => ({
        text: l.textContent.trim(),
        width: l.getBoundingClientRect().width,
        scrollWidth: l.scrollWidth,
        isClipped: l.scrollWidth > l.clientWidth
      })),
      values: values.map(v => ({
        text: v.textContent.trim(),
        width: v.getBoundingClientRect().width,
        isClipped: v.scrollWidth > v.clientWidth
      })),
      pageScrollWidth: document.documentElement.scrollWidth
    };
  })()`,
  returnByValue: true
});

console.log('395px Results:', JSON.stringify(res395.result?.value, null, 2));
await capture('mobile_fo_fixed_395px.png');

// Viewport 2: 360px
console.log('\n--- 360px Layout Inspection ---');
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
await new Promise(r => setTimeout(r, 800));

const res360 = await send('Runtime.evaluate', {
  expression: `(() => {
    const card = document.getElementById("mobile-financial-overview-card");
    const donut = card.querySelector("svg")?.parentElement;
    const rightCol = donut?.parentElement?.nextElementSibling;
    const notifText = document.getElementById("mobile-fo-notification-text");
    const labels = Array.from(rightCol.querySelectorAll(".text-xs.font-semibold"));
    
    return {
      cardWidth: card.getBoundingClientRect().width,
      cardHeight: card.getBoundingClientRect().height,
      donutWidth: donut.getBoundingClientRect().width,
      rightColWidth: rightCol.getBoundingClientRect().width,
      isNotifClipped: notifText.scrollWidth > notifText.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      labelsClipped: labels.some(l => l.scrollWidth > l.clientWidth)
    };
  })()`,
  returnByValue: true
});

console.log('360px Results:', JSON.stringify(res360.result?.value, null, 2));
await capture('mobile_fo_fixed_360px.png');

// Viewport 3: 1280px Desktop
console.log('\n--- 1280px Desktop Audit ---');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
await new Promise(r => setTimeout(r, 800));

const res1280 = await send('Runtime.evaluate', {
  expression: `(() => {
    const mobileFo = document.getElementById("mobile-financial-overview-card");
    const desktopKpi = document.getElementById("stat-total-income")?.closest(".grid");
    return {
      mobileFoHidden: window.getComputedStyle(mobileFo).display === 'none',
      desktopKpiVisible: window.getComputedStyle(desktopKpi).display !== 'none'
    };
  })()`,
  returnByValue: true
});

console.log('1280px Results:', JSON.stringify(res1280.result?.value, null, 2));
await capture('desktop_fo_audit_1280px.png');

ws.close();
edgeProc.kill();
