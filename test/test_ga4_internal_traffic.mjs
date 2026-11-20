import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4792;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

let testResults = [];
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ name, pass: false, details });
  }
}

server.listen(PORT, async () => {
  const cdpPort = 9990;
  const tmpDir = path.join(os.tmpdir(), `cdp_ga_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));

    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('Page target not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, rej) => {
      ws.on('open', r);
      ws.on('error', rej);
    });

    let msgId = 1;
    function send(method, params = {}, timeoutMs = 7000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for CDP ${method}`));
        }, timeoutMs);

        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            clearTimeout(timer);
            ws.off('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    };

    await send('Page.enable');
    await send('DOM.enable');

    console.log('\n--- SUITE: GA4 INTERNAL TRAFFIC FLAG VERIFICATION ---');

    // 1. Initial visit without flag: default behavior
    console.log('\n1. Initial visit without any flag:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1000));

    let state0 = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('fet_internal is not set by default', state0.localStorageVal === null);
    check('__fetInternal is false by default', state0.fetInternal === false);
    check('GA4 config options do NOT contain traffic_type: internal', !state0.configOptions || state0.configOptions.traffic_type !== 'internal');

    // 2. Visit with ?internal=1
    console.log('\n2. Visit with ?internal=1:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/?internal=1` });
    await new Promise((r) => setTimeout(r, 1000));

    let state1 = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal is set to "1"', state1.localStorageVal === '1');
    check('window.__fetInternal is true', state1.fetInternal === true);
    check('GA4 config receives { traffic_type: "internal" }', state1.configOptions && state1.configOptions.traffic_type === 'internal');

    // 3. Navigate to /bill-splitter/ WITHOUT query param: flag should persist
    console.log('\n3. Navigate to /bill-splitter/ without query param:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/bill-splitter/` });
    await new Promise((r) => setTimeout(r, 1000));

    let stateSplit = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal persists on /bill-splitter/', stateSplit.localStorageVal === '1');
    check('window.__fetInternal is true on /bill-splitter/', stateSplit.fetInternal === true);
    check('GA4 config on /bill-splitter/ carries { traffic_type: "internal" }', stateSplit.configOptions && stateSplit.configOptions.traffic_type === 'internal');

    // 4. Navigate to /templates/ without query param: flag should persist
    console.log('\n4. Navigate to /templates/ without query param:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/templates/` });
    await new Promise((r) => setTimeout(r, 1000));

    let stateTemplates = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal persists on /templates/', stateTemplates.localStorageVal === '1');
    check('window.__fetInternal is true on /templates/', stateTemplates.fetInternal === true);
    check('GA4 config on /templates/ carries { traffic_type: "internal" }', stateTemplates.configOptions && stateTemplates.configOptions.traffic_type === 'internal');

    // 5. Navigate to localized page /fr/ without query param: flag should persist
    console.log('\n5. Navigate to localized page /fr/ without query param:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/fr/` });
    await new Promise((r) => setTimeout(r, 1000));

    let stateFr = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal persists on /fr/', stateFr.localStorageVal === '1');
    check('window.__fetInternal is true on /fr/', stateFr.fetInternal === true);
    check('GA4 config on /fr/ carries { traffic_type: "internal" }', stateFr.configOptions && stateFr.configOptions.traffic_type === 'internal');

    // 6. Navigate to /?internal=0 to remove flag
    console.log('\n6. Visit with ?internal=0 to clear flag:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/?internal=0` });
    await new Promise((r) => setTimeout(r, 1000));

    let stateReset = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal is removed by ?internal=0', stateReset.localStorageVal === null);
    check('window.__fetInternal is false after ?internal=0', stateReset.fetInternal === false);
    check('GA4 config options no longer carry traffic_type: internal', !stateReset.configOptions || stateReset.configOptions.traffic_type !== 'internal');

    // 7. Subsequent navigation after removal remains clean
    console.log('\n7. Navigate to /bill-splitter/ after removal:');
    await send('Page.navigate', { url: `http://localhost:${PORT}/bill-splitter/` });
    await new Promise((r) => setTimeout(r, 1000));

    let stateSubsequent = await evaluate(`(() => {
      const configItem = window.dataLayer ? window.dataLayer.find(item => item[0] === 'config' && item[1] === 'G-XR6MG2FM4M') : null;
      return {
        fetInternal: window.__fetInternal,
        localStorageVal: localStorage.getItem('fet_internal'),
        configOptions: configItem ? configItem[2] : null
      };
    })()`);

    check('localStorage fet_internal remains null', stateSubsequent.localStorageVal === null);
    check('window.__fetInternal remains false', stateSubsequent.fetInternal === false);
    check('GA4 config options remains empty/without traffic_type', !stateSubsequent.configOptions || stateSubsequent.configOptions.traffic_type !== 'internal');

    // Print summary
    console.log('\n=======================================');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = total - passed;
    console.log(`GA4 INTERNAL TRAFFIC TESTS: ${passed}/${total} checks PASSED (${failed} failed)`);
    console.log('=======================================\n');

    ws.close();
    edgeProc.kill();
    server.close();
    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('Test execution error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
