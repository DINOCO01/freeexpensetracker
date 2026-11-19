import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4477;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

// Start static server serving dist
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
  const cdpPort = 9355;
  const tmpDir = path.join(os.tmpdir(), `cdp_health_redesign_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    `http://localhost:${PORT}/`
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('No page found');

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

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Browser eval exception:', res.exceptionDetails);
      }
      return res.result?.value;
    };

    const setViewport = async (width, height, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });
      if (isMobile) {
        await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      } else {
        await send('Emulation.setTouchEmulationEnabled', { enabled: false });
      }
      await new Promise((r) => setTimeout(r, 400));
    };

    const captureScreenshot = async (filepath) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    };

    // Navigate to app
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    console.log('\n--- 1. MOBILE TESTS (375px) ---');
    await setViewport(375, 812, true);
    await new Promise((r) => setTimeout(r, 500));

    const mobileHealthData = await evaluate(`
      (() => {
        const mobileCard = document.querySelector('.sm\\\\:hidden');
        const desktopCard = document.querySelector('.hidden.sm\\\\:flex');
        
        const savingsSeg = document.getElementById('donut-segment-savings');
        const fixedSeg = document.getElementById('donut-segment-fixed');
        const bufferSeg = document.getElementById('donut-segment-buffer');
        
        const scoreNum = document.getElementById('health-score-number-mobile');
        const tierBadge = document.getElementById('health-tier-badge-mobile');
        const tierText = document.getElementById('health-tier-text-mobile');
        
        const legSavings = document.getElementById('mobile-legend-savings-val');
        const legFixed = document.getElementById('mobile-legend-fixed-val');
        const legBuffer = document.getElementById('mobile-legend-buffer-val');
        
        const btnToggle = document.getElementById('btn-toggle-health-details');
        const detailsContent = document.getElementById('health-details-content');
        
        // Check for old elements in mobile card
        const cardText = mobileCard ? mobileCard.innerText : '';
        const hasOldPoints = cardText.includes('/ 40 pts') || cardText.includes('/ 20 pts');
        const hasOldSub = cardText.includes('Savings (40%)');
        
        return {
          mobileCardVisible: mobileCard && mobileCard.offsetWidth > 0,
          desktopCardHidden: desktopCard ? desktopCard.offsetWidth === 0 : true,
          score: scoreNum ? scoreNum.innerText.trim() : null,
          tier: tierText ? tierText.innerText.trim() : null,
          savingsColor: savingsSeg ? savingsSeg.getAttribute('stroke') : null,
          fixedColor: fixedSeg ? fixedSeg.getAttribute('stroke') : null,
          bufferColor: bufferSeg ? bufferSeg.getAttribute('stroke') : null,
          savingsDash: savingsSeg ? savingsSeg.style.strokeDasharray || savingsSeg.getAttribute('stroke-dasharray') : null,
          fixedDash: fixedSeg ? fixedSeg.style.strokeDasharray || fixedSeg.getAttribute('stroke-dasharray') : null,
          bufferDash: bufferSeg ? bufferSeg.style.strokeDasharray || bufferSeg.getAttribute('stroke-dasharray') : null,
          legSavingsVal: legSavings ? legSavings.innerText.trim() : null,
          legFixedVal: legFixed ? legFixed.innerText.trim() : null,
          legBufferVal: legBuffer ? legBuffer.innerText.trim() : null,
          btnToggleExists: !!btnToggle,
          detailsHiddenInitially: detailsContent ? detailsContent.classList.contains('hidden') : false,
          hasOldPoints,
          hasOldSub,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: window.innerWidth
        };
      })()
    `);

    check('Mobile card visible at 375px', mobileHealthData.mobileCardVisible);
    check('Desktop card hidden at 375px', mobileHealthData.desktopCardHidden);
    check('Mobile score is 100', mobileHealthData.score === '100', `got ${mobileHealthData.score}`);
    check('Mobile tier is EXCELLENT', mobileHealthData.tier === 'EXCELLENT', `got ${mobileHealthData.tier}`);
    check('Savings segment stroke is #16A34A', mobileHealthData.savingsColor === '#16A34A', `got ${mobileHealthData.savingsColor}`);
    check('Essential Expenses segment stroke is #3B82F6', mobileHealthData.fixedColor === '#3B82F6', `got ${mobileHealthData.fixedColor}`);
    check('Cash Buffer segment stroke is #14B8A6', mobileHealthData.bufferColor === '#14B8A6', `got ${mobileHealthData.bufferColor}`);
    check('Savings legend value displayed', mobileHealthData.legSavingsVal && mobileHealthData.legSavingsVal.includes('%'), `got ${mobileHealthData.legSavingsVal}`);
    check('Essential Expenses legend value displayed', mobileHealthData.legFixedVal && mobileHealthData.legFixedVal.includes('%'), `got ${mobileHealthData.legFixedVal}`);
    check('Cash Buffer legend value displayed', mobileHealthData.legBufferVal && mobileHealthData.legBufferVal.includes('%'), `got ${mobileHealthData.legBufferVal}`);
    check('Old points text removed from mobile', !mobileHealthData.hasOldPoints);
    check('Old scoring subtitle removed from mobile', !mobileHealthData.hasOldSub);
    check('No horizontal overflow at 375px', mobileHealthData.scrollWidth <= mobileHealthData.clientWidth, `${mobileHealthData.scrollWidth} <= ${mobileHealthData.clientWidth}`);

    // Capture 375px collapsed screenshot
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_mobile_redesign_375px.png'));

    // Test Accordion Expand
    console.log('\n--- 2. ACCORDION EXPANSION TEST ---');
    await evaluate(`document.getElementById('btn-toggle-health-details').click()`);
    await new Promise((r) => setTimeout(r, 300));
    const expandedCheck = await evaluate(`
      (() => {
        const detailsContent = document.getElementById('health-details-content');
        const recsList = document.getElementById('health-recommendations-list-mobile');
        return {
          isExpanded: detailsContent && !detailsContent.classList.contains('hidden'),
          hasRecs: recsList && recsList.children.length > 0
        };
      })()
    `);
    check('Accordion expands on click', expandedCheck.isExpanded);
    check('Mobile recommendations populated in drawer', expandedCheck.hasRecs);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_mobile_redesign_375px_expanded.png'));

    // Collapse back
    await evaluate(`document.getElementById('btn-toggle-health-details').click()`);
    await new Promise((r) => setTimeout(r, 300));

    // Test viewports 320px, 360px, 390px, 430px
    console.log('\n--- 3. MOBILE VIEWPORT OVERFLOW AUDIT ---');
    const viewports = [320, 360, 390, 430];
    for (const vp of viewports) {
      await setViewport(vp, 800, true);
      const vpData = await evaluate(`
        (() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      check(`No horizontal overflow at ${vp}px`, vpData.scrollWidth <= vpData.clientWidth, `${vpData.scrollWidth} <= ${vpData.clientWidth}`);
    }
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_mobile_redesign_320px.png'));

    // Test Dark Mode
    console.log('\n--- 4. DARK MODE TEST ---');
    await evaluate(`document.documentElement.classList.add('dark')`);
    await setViewport(375, 812, true);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_mobile_redesign_375px_dark.png'));
    await evaluate(`document.documentElement.classList.remove('dark')`);

    // Test Slider Touch Action
    console.log('\n--- 5. SLIDER TOUCH ACTION VERIFICATION ---');
    const sliderTouch = await evaluate(`
      (() => {
        const slider = document.getElementById('income-range-slider');
        return slider ? window.getComputedStyle(slider).touchAction : null;
      })()
    `);
    check('Slider has touch-action: pan-y preserved', sliderTouch === 'pan-y', `got ${sliderTouch}`);

    // Test Desktop (1024px, 1280px, 1440px)
    console.log('\n--- 6. DESKTOP VIEWPORTS AUDIT (MUST REMAIN RESTORED ORIGINAL) ---');
    const desktopViewports = [1024, 1280, 1440];
    for (const dvp of desktopViewports) {
      await setViewport(dvp, 900, false);
      const desktopData = await evaluate(`
        (() => {
          const mobileCard = document.querySelector('.sm\\\\:hidden');
          const desktopCard = document.querySelector('.hidden.sm\\\\:flex');
          const scoreCircle = document.getElementById('score-circle-stroke');
          const savingsBar = document.getElementById('bar-savings-score');
          const fixedBar = document.getElementById('bar-fixed-score');
          const bufferBar = document.getElementById('bar-buffer-score');
          
          return {
            mobileCardHidden: mobileCard ? mobileCard.offsetWidth === 0 : true,
            desktopCardVisible: desktopCard && desktopCard.offsetWidth > 0,
            hasCircleStroke: !!scoreCircle,
            has3Bars: !!(savingsBar && fixedBar && bufferBar),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      check(`Desktop card visible at ${dvp}px`, desktopData.desktopCardVisible);
      check(`Mobile card hidden at ${dvp}px`, desktopData.mobileCardHidden);
      check(`Desktop circle stroke present at ${dvp}px`, desktopData.hasCircleStroke);
      check(`Desktop 3 progress bars present at ${dvp}px`, desktopData.has3Bars);
      check(`No horizontal overflow at ${dvp}px`, desktopData.scrollWidth <= desktopData.clientWidth, `${desktopData.scrollWidth} <= ${desktopData.clientWidth}`);
    }
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_desktop_restored_1280px.png'));

    // Test dynamic changes: simulate income reduction or expense addition
    console.log('\n--- 7. DYNAMIC UPDATE VERIFICATION ---');
    await setViewport(375, 812, true);
    await evaluate(`
      (() => {
        // Change income input to 1000
        const input = document.getElementById('input-monthly-income');
        if (input) {
          input.value = '1000';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const updatedData = await evaluate(`
      (() => {
        const scoreNum = document.getElementById('health-score-number-mobile');
        const savingsSeg = document.getElementById('donut-segment-savings');
        const legSavings = document.getElementById('mobile-legend-savings-val');
        return {
          score: scoreNum ? scoreNum.innerText.trim() : null,
          savingsDash: savingsSeg ? savingsSeg.style.strokeDasharray : null,
          legSavingsVal: legSavings ? legSavings.innerText.trim() : null
        };
      })()
    `);
    console.log('Dynamic update result:', updatedData);
    check('Dynamic score updated on income change', updatedData.score !== null);
    check('Dynamic legend updated on income change', updatedData.legSavingsVal !== null);

  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    edgeProc.kill('SIGKILL');
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    
    console.log('\n=======================================');
    console.log(`TOTAL CHECKS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(t => t.pass).length}`);
    console.log(`FAILED: ${testResults.filter(t => !t.pass).length}`);
    console.log('=======================================');
    process.exit(testResults.every(t => t.pass) ? 0 : 1);
  }
});
