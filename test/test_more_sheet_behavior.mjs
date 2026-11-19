import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4499;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

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
  const cdpPort = 9399;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
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
            if (res.error) reject(res.error);
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

    async function setViewport(w, h) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: true
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }

    console.log('\n======================================================');
    console.log('🧪 QA: MORE TOOLS & RESOURCES SHEET VISIBILITY FIX');
    console.log('======================================================\n');

    // Test across viewports that initial state is CLOSED on load
    const viewports = [320, 360, 375, 390, 412, 430];
    for (const width of viewports) {
      await setViewport(width, 844);
      const isClosedOnLoad = await evaluate(`(() => {
        const sheet = document.getElementById("more-menu-sheet");
        const backdrop = document.getElementById("more-menu-backdrop");
        const style = sheet ? window.getComputedStyle(sheet) : null;
        const rect = sheet ? sheet.getBoundingClientRect() : null;
        return {
          displayNone: style?.display === 'none',
          isHidden: sheet?.classList.contains('hidden'),
          isTranslateYFull: sheet?.classList.contains('translate-y-full'),
          backdropHidden: backdrop?.classList.contains('hidden'),
          zeroHeight: rect ? rect.height === 0 : true
        };
      })()`);

      check(`Fresh page load at ${width}px: More sheet is closed by default`,
        isClosedOnLoad.displayNone && isClosedOnLoad.isHidden && isClosedOnLoad.zeroHeight && isClosedOnLoad.backdropHidden
      );
    }

    // Set standard 390px mobile viewport
    await setViewport(390, 844);

    // Capture screenshot of initial load (Must NOT show More sheet)
    await captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_load_sheet_closed_390px.png'));

    console.log('\n--- Test 1: Explicit Tap on More Navigation Tab ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const isOpenAfterTap = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const backdrop = document.getElementById("more-menu-backdrop");
      const moreBtn = document.getElementById("btn-bottom-nav-more");
      const style = sheet ? window.getComputedStyle(sheet) : null;
      const rect = sheet ? sheet.getBoundingClientRect() : null;
      return {
        displayNotNone: style?.display !== 'none',
        notHidden: !sheet?.classList.contains('hidden'),
        translatedUp: sheet?.classList.contains('translate-y-0'),
        backdropVisible: !backdrop?.classList.contains('hidden'),
        hasHeight: rect ? rect.height > 200 : false,
        ariaExpanded: moreBtn?.getAttribute('aria-expanded') === 'true'
      };
    })()`);

    check('Explicitly tapping More opens the bottom sheet smoothly',
      isOpenAfterTap.displayNotNone && isOpenAfterTap.notHidden && isOpenAfterTap.backdropVisible && isOpenAfterTap.hasHeight && isOpenAfterTap.ariaExpanded
    );

    await captureScreenshot(path.join(ARTIFACT_DIR, 'mobile_sheet_open_after_tap_390px.png'));

    console.log('\n--- Test 2: Close Sheet Using X Button ---');
    await evaluate(`document.getElementById('btn-close-more-sheet')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const isClosedAfterX = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const backdrop = document.getElementById("more-menu-backdrop");
      const style = sheet ? window.getComputedStyle(sheet) : null;
      return {
        displayNone: style?.display === 'none',
        isHidden: sheet?.classList.contains('hidden'),
        backdropHidden: backdrop?.classList.contains('hidden')
      };
    })()`);

    check('Tapping X button closes the More sheet and hides backdrop',
      isClosedAfterX.displayNone && isClosedAfterX.isHidden && isClosedAfterX.backdropHidden
    );

    console.log('\n--- Test 3: Open More and Close by Tapping Backdrop ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`document.getElementById('more-menu-backdrop')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const isClosedAfterBackdrop = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const backdrop = document.getElementById("more-menu-backdrop");
      const style = sheet ? window.getComputedStyle(sheet) : null;
      return {
        displayNone: style?.display === 'none',
        isHidden: sheet?.classList.contains('hidden'),
        backdropHidden: backdrop?.classList.contains('hidden')
      };
    })()`);

    check('Tapping outside backdrop closes the More sheet and hides backdrop',
      isClosedAfterBackdrop.displayNone && isClosedAfterBackdrop.isHidden && isClosedAfterBackdrop.backdropHidden
    );

    console.log('\n--- Test 4: Open More and Close Using Escape Key ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await new Promise((r) => setTimeout(r, 400));

    const isClosedAfterEsc = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      return sheet?.classList.contains('hidden');
    })()`);
    check('Pressing Escape closes the More sheet', isClosedAfterEsc);

    console.log('\n--- Test 5: Page Refresh Starts with Panel Closed ---');
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const isClosedAfterRefresh = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const backdrop = document.getElementById("more-menu-backdrop");
      const style = sheet ? window.getComputedStyle(sheet) : null;
      const rect = sheet ? sheet.getBoundingClientRect() : null;
      return {
        displayNone: style?.display === 'none',
        isHidden: sheet?.classList.contains('hidden'),
        backdropHidden: backdrop?.classList.contains('hidden'),
        zeroHeight: rect ? rect.height === 0 : true
      };
    })()`);

    check('Refreshing page always starts with More panel closed',
      isClosedAfterRefresh.displayNone && isClosedAfterRefresh.isHidden && isClosedAfterRefresh.zeroHeight && isClosedAfterRefresh.backdropHidden
    );

    console.log('\n--- Test 6: Navigating Between Navigation Tabs Keeps Sheet Closed ---');
    const tabsToTest = ['templates', 'debt', 'targets', 'tracker'];
    for (const tab of tabsToTest) {
      await evaluate(`document.querySelector('button[data-bottom-tab="${tab}"]')?.click()`);
      await new Promise((r) => setTimeout(r, 300));
      const sheetClosed = await evaluate(`(() => {
        const sheet = document.getElementById("more-menu-sheet");
        return sheet?.classList.contains('hidden');
      })()`);
      check(`Switching to ${tab} tab keeps More sheet closed`, sheetClosed);
    }

    console.log('\n--- Test 7: Selecting Item Inside More Closes Sheet & Navigates ---');
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    await evaluate(`document.querySelector('[data-more-action="knowledge"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    const knowledgeResult = await evaluate(`(() => {
      const sheet = document.getElementById("more-menu-sheet");
      const knowledgeView = document.getElementById("tab-view-knowledge");
      return {
        sheetClosed: sheet?.classList.contains('hidden'),
        knowledgeVisible: !knowledgeView?.classList.contains('hidden')
      };
    })()`);

    check('Selecting Knowledge & Guides inside More sheet closes sheet and shows guides view',
      knowledgeResult.sheetClosed && knowledgeResult.knowledgeVisible
    );

    const passes = testResults.filter((r) => r.pass).length;
    const fails = testResults.filter((r) => !r.pass).length;

    console.log(`\n======================================================`);
    console.log(`QA SUMMARY: ${passes} PASSED, ${fails} FAILED`);
    console.log(`======================================================\n`);

    ws.close();
    edgeProc.kill();
    server.close();

    if (fails > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    try { edgeProc.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(1);
  }
});
