import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

async function main() {
  const cdpPort = 9466;
  const tmpDir = path.join(os.tmpdir(), `cdp_inspect_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    'http://localhost:4321/'
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Scroll to ledger or evaluate its state
    const result = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('transactions-tbody');
          const table = tbody ? tbody.closest('table') : null;
          const container = table ? table.parentElement : null;
          const ledgerCard = container ? container.closest('.bg-white') : null;
          const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
          
          return {
            hasTbody: !!tbody,
            rowCount: rows.length,
            tbodyInnerHTML: tbody ? tbody.innerHTML.slice(0, 300) : null,
            tbodyRect: tbody ? tbody.getBoundingClientRect() : null,
            containerRect: container ? container.getBoundingClientRect() : null,
            containerScrollHeight: container ? container.scrollHeight : null,
            containerClientHeight: container ? container.clientHeight : null,
            containerScrollWidth: container ? container.scrollWidth : null,
            containerClientWidth: container ? container.clientWidth : null,
            containerStyles: container ? {
              overflowX: window.getComputedStyle(container).overflowX,
              overflowY: window.getComputedStyle(container).overflowY,
              maxHeight: window.getComputedStyle(container).maxHeight,
              height: window.getComputedStyle(container).height,
              display: window.getComputedStyle(container).display,
              position: window.getComputedStyle(container).position
            } : null,
            firstRowStyles: rows[0] ? {
              display: window.getComputedStyle(rows[0]).display,
              visibility: window.getComputedStyle(rows[0]).visibility,
              opacity: window.getComputedStyle(rows[0]).opacity,
              height: window.getComputedStyle(rows[0]).height
            } : null,
            firstRowText: rows[0] ? rows[0].innerText : null,
            ledgerCardRect: ledgerCard ? ledgerCard.getBoundingClientRect() : null,
            emptyStateDisplay: document.getElementById('empty-ledger-state') ? window.getComputedStyle(document.getElementById('empty-ledger-state')).display : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Inspection result:', JSON.stringify(result.result?.value, null, 2));

    // Scroll down to the ledger and take a screenshot of before
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tbody = document.getElementById('transactions-tbody');
          if (tbody) tbody.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 600));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'before_ledger_mobile_375px.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved before_ledger_mobile_375px.png');

  } catch (e) {
    console.error(e);
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
