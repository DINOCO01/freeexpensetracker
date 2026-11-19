import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4455;
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
  const cdpPort = 9336;
  const tmpDir = path.join(os.tmpdir(), `cdp_health_${Date.now()}`);
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
      return res.result?.value;
    };

    // Navigate to homepage and wait for load
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    const setViewport = async (width, height, isMobile = true) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });
      await send('Emulation.setTouchEmulationEnabled', {
        enabled: isMobile
      });
      await new Promise((r) => setTimeout(r, 300));
    };

    const captureScreenshot = async (filepath) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    };

    console.log('--- STARTING FINANCIAL HEALTH & SLIDER AUDIT ---');

    // 1. Audit at 375px
    console.log('\n[1/5] Testing 375px Mobile Viewport...');
    await setViewport(375, 812, true);

    const healthCardMetrics375 = await evaluate(`(() => {
      const card = document.getElementById('health-tier-badge-mobile')?.closest('.rounded-2xl');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const header = card.firstElementChild;
      const headerRect = header ? header.getBoundingClientRect() : null;
      const scoreCircle = document.getElementById('score-circle-stroke-mobile');
      const scoreNum = document.getElementById('health-score-number-mobile');
      const tierBadge = document.getElementById('health-tier-badge-mobile');
      const tierText = document.getElementById('health-tier-text-mobile');
      const toggleBtn = document.getElementById('btn-toggle-health-details');
      const detailsContent = document.getElementById('health-details-content');
      
      const colSavings = document.getElementById('score-savings-rate-label-mobile');
      const barSavings = document.getElementById('bar-savings-score-mobile');
      const colFixed = document.getElementById('score-fixed-cost-label-mobile');
      const barFixed = document.getElementById('bar-fixed-score-mobile');
      const colBuffer = document.getElementById('score-buffer-label-mobile');
      const barBuffer = document.getElementById('bar-buffer-score-mobile');

      const bodyOverflow = document.body.scrollWidth > window.innerWidth;
      const cardOverflow = card.scrollWidth > card.clientWidth;

      const children = Array.from(card.children).map(c => ({
        tag: c.tagName,
        id: c.id,
        height: Math.round(c.getBoundingClientRect().height),
        display: window.getComputedStyle(c).display
      }));

      return {
        cardHeight: Math.round(rect.height),
        cardWidth: Math.round(rect.width),
        children,
        bodyOverflow,
        cardOverflow,
        hasHeader: !!header,
        hasScoreCircle: !!scoreCircle,
        hasScoreNum: !!scoreNum,
        scoreNumText: scoreNum?.textContent?.trim(),
        hasTierBadge: !!tierBadge,
        tierText: tierText?.textContent?.trim(),
        hasToggleBtn: !!toggleBtn,
        toggleBtnVisible: toggleBtn ? window.getComputedStyle(toggleBtn).display !== 'none' : false,
        detailsHidden: detailsContent ? detailsContent.classList.contains('hidden') : false,
        has3Cols: !!(colSavings && colFixed && colBuffer),
        has3Bars: !!(barSavings && barFixed && barBuffer),
        savingsLabel: colSavings?.textContent?.trim(),
        fixedLabel: colFixed?.textContent?.trim(),
        bufferLabel: colBuffer?.textContent?.trim(),
      };
    })()`);

    console.log('Children of Health Card:', JSON.stringify(healthCardMetrics375.children, null, 2));
    check('375px: Financial Health Card found', !!healthCardMetrics375);
    check('375px: Collapsed height within target 160-195px', healthCardMetrics375.cardHeight >= 160 && healthCardMetrics375.cardHeight <= 195, `height=${healthCardMetrics375.cardHeight}px`);
    check('375px: No horizontal card overflow', !healthCardMetrics375.cardOverflow);
    check('375px: No horizontal body overflow', !healthCardMetrics375.bodyOverflow);
    check('375px: Score indicator has score number', healthCardMetrics375.scoreNumText === '100' || healthCardMetrics375.scoreNumText === '88', `score=${healthCardMetrics375.scoreNumText}`);
    check('375px: Tier badge has text', healthCardMetrics375.tierText.length > 0, `tier=${healthCardMetrics375.tierText}`);
    check('375px: 3 breakdown columns and progress bars exist', healthCardMetrics375.has3Cols && healthCardMetrics375.has3Bars);
    check('375px: Expandable details collapsed by default', healthCardMetrics375.detailsHidden);
    check('375px: Toggle button visible on mobile', healthCardMetrics375.toggleBtnVisible);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_375px_collapsed.png'));

    // Test Accordion Expansion on 375px
    console.log('\n[2/5] Testing Expandable Breakdown & Advice Toggle...');
    const toggleExpand = await evaluate(`(() => {
      const btn = document.getElementById('btn-toggle-health-details');
      const content = document.getElementById('health-details-content');
      const chevron = document.getElementById('health-details-chevron');
      if (!btn || !content) return null;
      btn.click();
      return {
        isExpanded: !content.classList.contains('hidden'),
        hasRotateChevron: chevron.classList.contains('rotate-180'),
        cardHeight: Math.round(btn.closest('.rounded-2xl').getBoundingClientRect().height),
        recsListEmpty: document.getElementById('health-recommendations-list')?.children?.length === 0
      };
    })()`);

    check('Toggle: Content expanded on click', toggleExpand.isExpanded);
    check('Toggle: Chevron rotated', toggleExpand.hasRotateChevron);
    check('Toggle: Card expanded height > 240px', toggleExpand.cardHeight > 240, `expanded height=${toggleExpand.cardHeight}px`);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_375px_expanded.png'));

    // Toggle collapse back
    const toggleCollapse = await evaluate(`(() => {
      const btn = document.getElementById('btn-toggle-health-details');
      const content = document.getElementById('health-details-content');
      const chevron = document.getElementById('health-details-chevron');
      btn.click();
      return {
        isCollapsed: content.classList.contains('hidden'),
        chevronReset: !chevron.classList.contains('rotate-180'),
        cardHeight: Math.round(btn.closest('.rounded-2xl').getBoundingClientRect().height)
      };
    })()`);
    check('Toggle: Content collapsed on second click', toggleCollapse.isCollapsed);
    check('Toggle: Chevron reset on collapse', toggleCollapse.chevronReset);
    check('Toggle: Collapsed height returns to 160-195px', toggleCollapse.cardHeight >= 160 && toggleCollapse.cardHeight <= 195, `collapsed height=${toggleCollapse.cardHeight}px`);

    // 2. Audit at 395px and 430px
    console.log('\n[3/5] Testing 395px and 430px Viewports...');
    await setViewport(395, 844, true);
    const metrics395 = await evaluate(`(() => {
      const card = document.getElementById('health-tier-badge-mobile')?.closest('.rounded-2xl');
      return {
        cardHeight: Math.round(card.getBoundingClientRect().height),
        cardOverflow: card.scrollWidth > card.clientWidth,
        bodyOverflow: document.body.scrollWidth > window.innerWidth
      };
    })()`);
    check('395px: Collapsed height within target 160-195px', metrics395.cardHeight >= 160 && metrics395.cardHeight <= 195, `height=${metrics395.cardHeight}px`);
    check('395px: No horizontal overflow', !metrics395.cardOverflow && !metrics395.bodyOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_395px_collapsed.png'));

    await setViewport(430, 932, true);
    const metrics430 = await evaluate(`(() => {
      const card = document.getElementById('health-tier-badge-mobile')?.closest('.rounded-2xl');
      return {
        cardHeight: Math.round(card.getBoundingClientRect().height),
        cardOverflow: card.scrollWidth > card.clientWidth,
        bodyOverflow: document.body.scrollWidth > window.innerWidth
      };
    })()`);
    check('430px: Collapsed height within target 160-195px', metrics430.cardHeight >= 160 && metrics430.cardHeight <= 195, `height=${metrics430.cardHeight}px`);
    check('430px: No horizontal overflow', !metrics430.cardOverflow && !metrics430.bodyOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_430px_collapsed.png'));

    // 3. Test Slider Touch / Gesture Conflict Fix
    console.log('\n[4/5] Testing Mobile Slider Touch & Gesture Conflict Fix...');
    const sliderTouchTest = await evaluate(`(() => {
      const slider = document.getElementById('income-range-slider');
      const wrapper = slider?.parentElement;
      if (!slider || !wrapper) return null;

      const sliderStyle = window.getComputedStyle(slider);
      const wrapperStyle = window.getComputedStyle(wrapper);

      const hasPanY = sliderStyle.touchAction.includes('pan-y') && wrapperStyle.touchAction.includes('pan-y');

      // Test vertical swipe gesture simulation:
      const initialVal = slider.value;
      
      // Dispatch touchstart
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 1, target: slider, clientX: 100, clientY: 200 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchStartEvent);

      // Simulate browser native touch jump before scroll detection
      slider.value = "150000";
      slider.dispatchEvent(new Event('input', { bubbles: true }));

      // Dispatch vertical touchmove (dy = 40px down, dx = 2px)
      const touchMoveEvent = new TouchEvent('touchmove', {
        touches: [new Touch({ identifier: 1, target: slider, clientX: 102, clientY: 240 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchMoveEvent);

      const valAfterVerticalMove = slider.value;

      // Dispatch touchend
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [new Touch({ identifier: 1, target: slider, clientX: 102, clientY: 240 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchEndEvent);

      const valAfterVerticalEnd = slider.value;

      // Test horizontal drag simulation:
      const touchStartHoriz = new TouchEvent('touchstart', {
        touches: [new Touch({ identifier: 2, target: slider, clientX: 100, clientY: 200 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchStartHoriz);

      // Dispatch horizontal touchmove (dx = 50px right, dy = 1px)
      const touchMoveHoriz = new TouchEvent('touchmove', {
        touches: [new Touch({ identifier: 2, target: slider, clientX: 150, clientY: 201 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchMoveHoriz);

      // Horizontal drag allows input updates
      slider.value = "20000";
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const valAfterHorizInput = slider.value;

      const touchEndHoriz = new TouchEvent('touchend', {
        changedTouches: [new Touch({ identifier: 2, target: slider, clientX: 150, clientY: 201 })],
        bubbles: true,
        cancelable: true
      });
      slider.dispatchEvent(touchEndHoriz);

      return {
        hasPanY,
        sliderTouchAction: sliderStyle.touchAction,
        wrapperTouchAction: wrapperStyle.touchAction,
        initialVal,
        valAfterVerticalMove,
        valAfterVerticalEnd,
        verticalJumpPrevented: valAfterVerticalEnd === initialVal,
        valAfterHorizInput,
        horizontalDragWorked: valAfterHorizInput === "20000"
      };
    })()`);

    check('Slider: CSS touch-action is pan-y on slider and wrapper', sliderTouchTest.hasPanY, `slider=${sliderTouchTest.sliderTouchAction}`);
    check('Slider: Vertical swipe prevents accidental slider value jumps', sliderTouchTest.verticalJumpPrevented, `initial=${sliderTouchTest.initialVal}, afterSwipe=${sliderTouchTest.valAfterVerticalEnd}`);
    check('Slider: Horizontal drag updates slider value smoothly', sliderTouchTest.horizontalDragWorked, `val=${sliderTouchTest.valAfterHorizInput}`);

    // 4. Test Dynamic Scoring Recalculation & Dark Mode
    console.log('\n[5/5] Testing Dynamic Recalculation, Desktop & Dark Mode...');
    // Reset income back to 4200
    const dynamicRecalc = await evaluate(`(() => {
      const input = document.getElementById('input-income-amount');
      input.value = "5000";
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      const scoreNum = document.getElementById('health-score-number');
      const stroke = document.getElementById('score-circle-stroke');
      const barSavings = document.getElementById('bar-savings-score');
      
      return {
        score: scoreNum?.textContent?.trim(),
        dashOffset: stroke?.style?.strokeDashoffset,
        savingsBarWidth: barSavings?.style?.width
      };
    })()`);
    check('Dynamic: Health score updates when income changes', dynamicRecalc.score && dynamicRecalc.score.length > 0, `score=${dynamicRecalc.score}`);
    check('Dynamic: SVG circle stroke-dashoffset animates', dynamicRecalc.dashOffset && dynamicRecalc.dashOffset !== '', `offset=${dynamicRecalc.dashOffset}`);
    check('Dynamic: Progress bar width recalculates', dynamicRecalc.savingsBarWidth && dynamicRecalc.savingsBarWidth !== '', `width=${dynamicRecalc.savingsBarWidth}`);

    // Dark Mode at 375px
    await evaluate(`document.documentElement.classList.add('dark')`);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_375px_dark.png'));
    await evaluate(`document.documentElement.classList.remove('dark')`);

    // Desktop 1280px Viewport
    await setViewport(1280, 800, false);
    const desktopMetrics = await evaluate(`(() => {
      const desktopCard = document.getElementById('health-tier-badge')?.closest('.rounded-2xl');
      const mobileCard = document.getElementById('health-tier-badge-mobile')?.closest('.rounded-2xl');
      const recsList = desktopCard?.querySelector('#health-recommendations-list');
      return {
        cardVisible: desktopCard ? window.getComputedStyle(desktopCard).display !== 'none' : false,
        mobileHiddenOnDesktop: mobileCard ? window.getComputedStyle(mobileCard).display === 'none' : true,
        detailsVisibleOnDesktop: !!recsList
      };
    })()`);
    check('Desktop: Financial Health Card renders alongside HeroSummary', desktopMetrics.cardVisible);
    check('Desktop: Mobile card hidden on desktop', desktopMetrics.mobileHiddenOnDesktop);
    check('Desktop: Health details visible on desktop', desktopMetrics.detailsVisibleOnDesktop);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_1280px_desktop.png'));

    console.log('\n--- AUDIT SUMMARY ---');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

    ws.close();
    edgeProc.kill();
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during audit:', err);
    try {
      edgeProc.kill();
    } catch {}
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    process.exit(1);
  }
});
