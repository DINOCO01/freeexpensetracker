import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4466;
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
  const cdpPort = 9345;
  const tmpDir = path.join(os.tmpdir(), `cdp_restore_${Date.now()}`);
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
      await new Promise((r) => setTimeout(r, 350));
    };

    const captureScreenshot = async (filepath) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    };

    // Navigate to app
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    console.log('================================================================');
    console.log('🧪 VERIFYING DESKTOP RESTORATION & MOBILE ISOLATION');
    console.log('================================================================\n');

    // -------------------------------------------------------------
    // PART 1: DESKTOP VIEWPORTS (1024px, 1280px, 1440px)
    // -------------------------------------------------------------
    const desktopViewports = [
      { width: 1024, height: 768, name: '1024px' },
      { width: 1280, height: 800, name: '1280px' },
      { width: 1440, height: 900, name: '1440px' }
    ];

    for (const vp of desktopViewports) {
      console.log(`\n--- Desktop ${vp.name} Audit ---`);
      await setViewport(vp.width, vp.height, false);

      const desktopData = await evaluate(`(() => {
        const desktopCard = document.getElementById('health-score-number')?.closest('.rounded-2xl');
        const mobileCard = document.getElementById('health-score-number-mobile')?.closest('.rounded-2xl');
        if (!desktopCard) return null;

        const desktopStyle = window.getComputedStyle(desktopCard);
        const mobileStyle = mobileCard ? window.getComputedStyle(mobileCard) : null;

        const desktopVisible = desktopStyle.display !== 'none';
        const mobileHidden = mobileStyle ? mobileStyle.display === 'none' : true;

        // Desktop original structure verification:
        // 1. Private badge visible on desktop
        const privateBadge = Array.from(desktopCard.querySelectorAll('div')).find(el => el.textContent && el.textContent.includes('Private'));
        const privateBadgeVisible = privateBadge ? window.getComputedStyle(privateBadge).display !== 'none' : false;

        // 2. Dial circle container: should be sm:col-span-5 with w-24/28 (>= 96px)
        const dialCircleWrapper = desktopCard.querySelector('#score-circle-stroke')?.closest('.relative');
        const dialRect = dialCircleWrapper ? dialCircleWrapper.getBoundingClientRect() : null;
        const circleWidth = dialRect ? Math.round(dialRect.width) : 0;
        const circleHeight = dialRect ? Math.round(dialRect.height) : 0;

        // 3. 4 score tier pills in desktop dial column
        const tierPills = desktopCard.querySelectorAll('.grid-cols-4 span');

        // 4. Three horizontal metric bars in sm:col-span-7
        const barSavings = desktopCard.querySelector('#bar-savings-score');
        const barFixed = desktopCard.querySelector('#bar-fixed-score');
        const barBuffer = desktopCard.querySelector('#bar-buffer-score');

        // 5. Tailored advice box with recommendations list
        const recsList = desktopCard.querySelector('#health-recommendations-list');

        // 6. No toggle button on desktop card
        const toggleBtn = desktopCard.querySelector('#btn-toggle-health-details');

        // 7. Grid side-by-side with HeroSummary
        const gridParent = desktopCard.parentElement;
        const heroSummary = gridParent ? gridParent.firstElementChild : null;
        const cardRect = desktopCard.getBoundingClientRect();
        const heroRect = heroSummary ? heroSummary.getBoundingClientRect() : null;

        const bodyOverflow = document.body.scrollWidth > window.innerWidth;
        const overflowingElements = bodyOverflow ? Array.from(document.querySelectorAll('*'))
          .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
          .map(e => ({ tag: e.tagName, id: e.id, cls: e.className.toString().slice(0, 40), right: Math.round(e.getBoundingClientRect().right) }))
          .slice(0, 5) : [];

        return {
          desktopVisible,
          mobileHidden,
          privateBadgeVisible,
          circleWidth,
          circleHeight,
          tierPillCount: tierPills.length,
          has3Bars: !!(barSavings && barFixed && barBuffer),
          hasRecsList: !!recsList,
          hasNoToggleBtn: !toggleBtn,
          cardHeight: Math.round(cardRect.height),
          heroHeight: heroRect ? Math.round(heroRect.height) : 0,
          bodyOverflow,
          overflowingElements
        };
      })()`);

      check(`Desktop ${vp.name}: Desktop card visible`, desktopData.desktopVisible);
      check(`Desktop ${vp.name}: Mobile card hidden`, desktopData.mobileHidden);
      check(`Desktop ${vp.name}: '100% Private' badge visible`, desktopData.privateBadgeVisible);
      check(`Desktop ${vp.name}: Original score circle dimensions restored (112px)`, desktopData.circleWidth >= 96 && desktopData.circleWidth <= 120, `actual=${desktopData.circleWidth}px`);
      check(`Desktop ${vp.name}: 4 score tier pills in dial column`, desktopData.tierPillCount === 4);
      check(`Desktop ${vp.name}: 3 horizontal metric bars in right column`, desktopData.has3Bars);
      check(`Desktop ${vp.name}: Recommendations advice box present`, desktopData.hasRecsList);
      check(`Desktop ${vp.name}: No mobile toggle button on desktop card`, desktopData.hasNoToggleBtn);
      check(`Desktop ${vp.name}: Card proportions balanced with HeroSummary`, desktopData.cardHeight > 250 && Math.abs(desktopData.cardHeight - desktopData.heroHeight) < 80, `card=${desktopData.cardHeight}px, hero=${desktopData.heroHeight}px`);
      check(`Desktop ${vp.name}: No horizontal overflow`, !desktopData.bodyOverflow, JSON.stringify(desktopData.overflowingElements));

      await captureScreenshot(path.join(ARTIFACT_DIR, `financial_health_desktop_${vp.name}.png`));
    }

    // -------------------------------------------------------------
    // PART 2: MOBILE VIEWPORTS (375px, 395px, 430px)
    // -------------------------------------------------------------
    const mobileViewports = [
      { width: 375, height: 812, name: '375px' },
      { width: 395, height: 844, name: '395px' },
      { width: 430, height: 932, name: '430px' }
    ];

    for (const vp of mobileViewports) {
      console.log(`\n--- Mobile ${vp.name} Audit ---`);
      await setViewport(vp.width, vp.height, true);

      const mobileData = await evaluate(`(() => {
        const desktopCard = document.getElementById('health-score-number')?.closest('.rounded-2xl');
        const mobileCard = document.getElementById('health-score-number-mobile')?.closest('.rounded-2xl');
        if (!mobileCard) return null;

        const mobileStyle = window.getComputedStyle(mobileCard);
        const desktopStyle = desktopCard ? window.getComputedStyle(desktopCard) : null;

        const mobileVisible = mobileStyle.display !== 'none';
        const desktopHidden = desktopStyle ? desktopStyle.display === 'none' : true;

        // Mobile compact structure verification:
        // 1. Compact header with circle on the right (~56px)
        const dialCircleWrapper = mobileCard.querySelector('#score-circle-stroke-mobile')?.closest('.relative');
        const dialRect = dialCircleWrapper ? dialCircleWrapper.getBoundingClientRect() : null;
        const circleWidth = dialRect ? Math.round(dialRect.width) : 0;

        // 2. Three column side-by-side breakdown
        const threeColGrid = mobileCard.querySelector('.grid-cols-3');
        const colSavings = mobileCard.querySelector('#score-savings-rate-label-mobile');
        const colFixed = mobileCard.querySelector('#score-fixed-cost-label-mobile');
        const colBuffer = mobileCard.querySelector('#score-buffer-label-mobile');

        // 3. Toggle button & accordion
        const toggleBtn = mobileCard.querySelector('#btn-toggle-health-details');
        const content = mobileCard.querySelector('#health-details-content');
        const contentHidden = content ? content.classList.contains('hidden') : false;

        const cardRect = mobileCard.getBoundingClientRect();
        const cardOverflow = mobileCard.scrollWidth > mobileCard.clientWidth;
        const bodyOverflow = document.body.scrollWidth > window.innerWidth;

        return {
          mobileVisible,
          desktopHidden,
          circleWidth,
          has3Cols: !!(threeColGrid && colSavings && colFixed && colBuffer),
          hasToggleBtn: !!toggleBtn,
          contentHidden,
          cardHeight: Math.round(cardRect.height),
          cardOverflow,
          bodyOverflow
        };
      })()`);

      check(`Mobile ${vp.name}: Mobile card visible`, mobileData.mobileVisible);
      check(`Mobile ${vp.name}: Desktop card hidden`, mobileData.desktopHidden);
      check(`Mobile ${vp.name}: Compact 56px score circle in header`, mobileData.circleWidth >= 50 && mobileData.circleWidth <= 64, `actual=${mobileData.circleWidth}px`);
      check(`Mobile ${vp.name}: 3-column side-by-side financial breakdown`, mobileData.has3Cols);
      check(`Mobile ${vp.name}: Expandable advice collapsed by default`, mobileData.contentHidden);
      check(`Mobile ${vp.name}: Collapsed height within target 160-195px`, mobileData.cardHeight >= 160 && mobileData.cardHeight <= 195, `height=${mobileData.cardHeight}px`);
      check(`Mobile ${vp.name}: No horizontal overflow`, !mobileData.cardOverflow && !mobileData.bodyOverflow);

      await captureScreenshot(path.join(ARTIFACT_DIR, `financial_health_mobile_${vp.name}.png`));
    }

    // -------------------------------------------------------------
    // PART 3: ACCORDION EXPANSION & DYNAMIC DATA SYNCHRONIZATION
    // -------------------------------------------------------------
    console.log('\n--- Accordion & Data Synchronization Audit ---');
    await setViewport(375, 812, true);

    const accordionTest = await evaluate(`(() => {
      const btn = document.getElementById('btn-toggle-health-details');
      const content = document.getElementById('health-details-content');
      const chevron = document.getElementById('health-details-chevron');
      btn.click();
      const expanded = !content.classList.contains('hidden');
      const chevronRotated = chevron.classList.contains('rotate-180');
      btn.click();
      const collapsed = content.classList.contains('hidden');
      return { expanded, chevronRotated, collapsed };
    })()`);

    check('Mobile Accordion: Expands on tap and rotates chevron', accordionTest.expanded && accordionTest.chevronRotated);
    check('Mobile Accordion: Collapses on second tap', accordionTest.collapsed);

    // Dynamic data change test: change income to 8000
    const syncTest = await evaluate(`(() => {
      const input = document.getElementById('input-income-amount');
      input.value = "8000";
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const desktopScore = document.getElementById('health-score-number')?.textContent?.trim();
      const mobileScore = document.getElementById('health-score-number-mobile')?.textContent?.trim();
      const desktopSavingsLabel = document.getElementById('score-savings-rate-label')?.textContent?.trim();
      const mobileSavingsLabel = document.getElementById('score-savings-rate-label-mobile')?.textContent?.trim();

      return {
        desktopScore,
        mobileScore,
        scoresMatch: desktopScore === mobileScore && desktopScore.length > 0,
        labelsMatch: desktopSavingsLabel === mobileSavingsLabel && desktopSavingsLabel.length > 0
      };
    })()`);

    check('Data Sync: Desktop and Mobile scores update simultaneously', syncTest.scoresMatch, `desktop=${syncTest.desktopScore}, mobile=${syncTest.mobileScore}`);
    check('Data Sync: Desktop and Mobile breakdown labels match', syncTest.labelsMatch);

    // -------------------------------------------------------------
    // PART 4: MOBILE SLIDER TOUCH / SCROLL CONFLICT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Mobile Slider Touch Conflict Audit ---');
    const sliderTest = await evaluate(`(() => {
      const slider = document.getElementById('income-range-slider');
      const wrapper = slider?.parentElement;
      const sliderStyle = window.getComputedStyle(slider);
      const wrapperStyle = window.getComputedStyle(wrapper);

      const hasPanY = sliderStyle.touchAction.includes('pan-y') && wrapperStyle.touchAction.includes('pan-y');
      const initialVal = slider.value;

      // Simulate vertical swipe gesture
      slider.dispatchEvent(new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 1, target: slider, clientX: 100, clientY: 200 })],
        bubbles: true, cancelable: true
      }));

      // Native premature jump
      slider.value = "250000";
      slider.dispatchEvent(new Event('input', { bubbles: true }));

      // Vertical swipe move (dy = 35px)
      slider.dispatchEvent(new TouchEvent('touchmove', {
        touches: [new Touch({ identifier: 1, target: slider, clientX: 101, clientY: 235 })],
        bubbles: true, cancelable: true
      }));

      // Touchend
      slider.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [new Touch({ identifier: 1, target: slider, clientX: 101, clientY: 235 })],
        bubbles: true, cancelable: true
      }));

      const valAfterVerticalSwipe = slider.value;
      return {
        hasPanY,
        initialVal,
        valAfterVerticalSwipe,
        jumpPrevented: valAfterVerticalSwipe === initialVal
      };
    })()`);

    check('Slider: CSS touch-action is pan-y on slider and wrapper', sliderTest.hasPanY);
    check('Slider: Vertical swipe prevents accidental value jumps', sliderTest.jumpPrevented, `initial=${sliderTest.initialVal}, after=${sliderTest.valAfterVerticalSwipe}`);

    console.log('\n================================================================');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('================================================================\n');

    ws.close();
    edgeProc.kill();
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    if (failed > 0) process.exit(1);
    else process.exit(0);

  } catch (err) {
    console.error('Fatal error during audit:', err);
    try { edgeProc.kill(); } catch {}
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(1);
  }
});
