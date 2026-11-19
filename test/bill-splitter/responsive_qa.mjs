import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4355;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

// Start static HTTP server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
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
    console.log(`  ✅ ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAILED: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ name, pass: false, details });
  }
}

server.listen(PORT, async () => {
  const cdpPort = 9260;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=390,844',
    `http://localhost:${PORT}/bill-splitter/`
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

    async function evaluate(exp) {
      const res = await send('Runtime.evaluate', {
        expression: exp,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.value;
    }

    async function setViewport(w, h) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: w <= 768
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }

    console.log('\n======================================================');
    console.log('🧪 RESPONSIVE QA: BILL SPLITTER MOBILE & TABLET');
    console.log('======================================================\n');

    // Wait for BMC widget & app initialization
    await new Promise((r) => setTimeout(r, 1500));

    // Clear local storage for a fresh state
    await evaluate(`localStorage.clear(); window.location.reload();`);
    await new Promise((r) => setTimeout(r, 2000));

    // -------------------------------------------------------------------------
    // TEST SECTION 1: Viewport Horizontal Overflow & BMC Widget at Multiple Resolutions
    // -------------------------------------------------------------------------
    console.log('--- 1. Viewport Horizontal Overflow & BMC Widget Clearance ---');
    const viewports = [
      { name: '320px (Ultra-compact mobile)', w: 320, h: 568 },
      { name: '360px (Standard Android)', w: 360, h: 800 },
      { name: '375px (Compact iOS)', w: 375, h: 812 },
      { name: '390px (Mobile Focus iOS)', w: 390, h: 844 },
      { name: '412px (Large Android)', w: 412, h: 915 },
      { name: '430px (iPhone Pro Max)', w: 430, h: 932 },
      { name: '768px (Tablet)', w: 768, h: 1024 },
      { name: '1280px (Desktop)', w: 1280, h: 800 }
    ];

    for (const vp of viewports) {
      await setViewport(vp.w, vp.h);

      const overflowInfo = await evaluate(`
        (() => {
          const bodyWidth = document.body.clientWidth;
          const scrollWidth = document.documentElement.scrollWidth;
          const windowWidth = window.innerWidth;
          return {
            windowWidth,
            scrollWidth,
            hasHorizontalOverflow: scrollWidth > windowWidth
          };
        })()
      `);

      check(`No horizontal overflow at ${vp.name} (${vp.w}x${vp.h})`, !overflowInfo.hasHorizontalOverflow, `scrollWidth=${overflowInfo.scrollWidth}, winWidth=${overflowInfo.windowWidth}`);

      // Check BMC widget vs mobile sticky bar when on mobile
      if (vp.w <= 639) {
        const bmcClearance = await evaluate(`
          (() => {
            const bmc = document.getElementById('bmc-wbtn');
            const stickyBar = document.querySelector('.sm\\\\:hidden.fixed.bottom-0');
            const copyBtn = document.getElementById('btn-mobile-copy');
            const shareBtn = document.getElementById('btn-mobile-whatsapp');

            if (!bmc || !stickyBar) return { bmcFound: !!bmc, stickyBarFound: !!stickyBar };

            const bmcRect = bmc.getBoundingClientRect();
            const barRect = stickyBar.getBoundingClientRect();
            const copyRect = copyBtn ? copyBtn.getBoundingClientRect() : null;
            const shareRect = shareBtn ? shareBtn.getBoundingClientRect() : null;

            // BMC should sit ABOVE the sticky bar (bmcRect.bottom <= barRect.top + 2)
            const sitsAboveBar = bmcRect.bottom <= barRect.top + 2;
            const overlapsCopy = copyRect ? !(bmcRect.right < copyRect.left || bmcRect.left > copyRect.right || bmcRect.bottom < copyRect.top || bmcRect.top > copyRect.bottom) : false;
            const overlapsShare = shareRect ? !(bmcRect.right < shareRect.left || bmcRect.left > shareRect.right || bmcRect.bottom < shareRect.top || bmcRect.top > shareRect.bottom) : false;

            return {
              bmcFound: true,
              stickyBarFound: true,
              sitsAboveBar,
              bmcBottom: bmcRect.bottom,
              barTop: barRect.top,
              overlapsCopy,
              overlapsShare,
              bmcWidth: bmcRect.width,
              bmcHeight: bmcRect.height
            };
          })()
        `);

        if (bmcClearance.bmcFound) {
          check(`BMC widget sits cleanly above sticky bottom bar at ${vp.w}px`, bmcClearance.sitsAboveBar, `bmcBottom=${bmcClearance.bmcBottom}, barTop=${bmcClearance.barTop}`);
          check(`BMC widget does not overlap Copy button at ${vp.w}px`, !bmcClearance.overlapsCopy);
          check(`BMC widget does not overlap Share button at ${vp.w}px`, !bmcClearance.overlapsShare);
        }
      }
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Amount Input Sizing & Digit Visibility in Itemized Mode
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Amount Input Responsiveness & Digit Visibility ---');
    await setViewport(390, 844);

    // Switch to Itemized Mode
    await evaluate(`document.getElementById('tab-btn-itemized').click();`);
    await new Promise((r) => setTimeout(r, 400));

    // Test numbers: 3 digits, 4 digits, 5 digits, 6 digits, 7 digits
    const testAmounts = ['450', '1000', '10000', '100000', '1000000'];

    for (const amt of testAmounts) {
      const inputCheck = await evaluate(`
        (() => {
          const priceInput = document.querySelector('.item-price-input');
          const symbolSpan = priceInput.parentElement.querySelector('.currency-symbol-display');
          if (!priceInput || !symbolSpan) return { error: 'Not found' };

          priceInput.value = '${amt}';
          priceInput.dispatchEvent(new Event('input', { bubbles: true }));

          const inputRect = priceInput.getBoundingClientRect();
          const symbolRect = symbolSpan.getBoundingClientRect();
          const style = window.getComputedStyle(priceInput);
          const paddingLeft = parseFloat(style.paddingLeft);

          // Check if symbol overlaps text entry area
          // Symbol right edge relative to input left edge:
          const symbolOffsetRight = symbolRect.right - inputRect.left;
          const symbolSeparated = paddingLeft > symbolOffsetRight;

          // Check if input clips or scrolls text horizontally
          const isClipped = priceInput.scrollWidth > priceInput.clientWidth;

          return {
            amount: '${amt}',
            width: inputRect.width,
            paddingLeft,
            symbolOffsetRight,
            symbolSeparated,
            isClipped,
            scrollWidth: priceInput.scrollWidth,
            clientWidth: priceInput.clientWidth
          };
        })()
      `);

      check(`Amount ₹${amt} displays without horizontal text clipping (scrollWidth <= clientWidth)`, !inputCheck.isClipped, `scrollWidth=${inputCheck.scrollWidth}, clientWidth=${inputCheck.clientWidth}`);
      check(`Currency symbol ₹ is separated from entered amount ₹${amt} (paddingLeft > symbolOffset)`, inputCheck.symbolSeparated, `padLeft=${inputCheck.paddingLeft}px, symbolOffset=${inputCheck.symbolOffsetRight}px`);
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Fixed Tax & Tip Inputs Spacing & Alignment
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Fixed Tax & Tip Input Spacing & Alignment ---');

    // Toggle Tax to Fixed
    await evaluate(`document.getElementById('btn-tax-mode-fixed').click();`);
    await new Promise((r) => setTimeout(r, 300));

    const taxInputCheck = await evaluate(`
      (() => {
        const taxInput = document.getElementById('input-itemized-tax');
        const taxSymbol = document.getElementById('tax-symbol-indicator');
        if (!taxInput || !taxSymbol) return { error: 'Not found' };

        taxInput.value = '10000';
        taxInput.dispatchEvent(new Event('input', { bubbles: true }));

        const inRect = taxInput.getBoundingClientRect();
        const symRect = taxSymbol.getBoundingClientRect();
        const padLeft = parseFloat(window.getComputedStyle(taxInput).paddingLeft);
        const symRightOffset = symRect.right - inRect.left;

        return {
          taxSymbolVisible: !taxSymbol.classList.contains('hidden'),
          padLeft,
          symRightOffset,
          separated: padLeft > symRightOffset,
          isClipped: taxInput.scrollWidth > taxInput.clientWidth
        };
      })()
    `);

    check('Fixed Tax indicator symbol is visible', taxInputCheck.taxSymbolVisible);
    check('Fixed Tax input has proper padding separating currency symbol from digits', taxInputCheck.separated, `padLeft=${taxInputCheck.padLeft}px, symRightOffset=${taxInputCheck.symRightOffset}px`);
    check('Fixed Tax input does not clip digits for 10000', !taxInputCheck.isClipped);

    // Toggle Tip to Fixed
    await evaluate(`document.getElementById('btn-tip-mode-fixed').click();`);
    await new Promise((r) => setTimeout(r, 300));

    const tipInputCheck = await evaluate(`
      (() => {
        const tipInput = document.getElementById('input-itemized-tip');
        const tipSymbol = document.getElementById('tip-symbol-indicator');
        if (!tipInput || !tipSymbol) return { error: 'Not found' };

        tipInput.value = '5000';
        tipInput.dispatchEvent(new Event('input', { bubbles: true }));

        const inRect = tipInput.getBoundingClientRect();
        const symRect = tipSymbol.getBoundingClientRect();
        const padLeft = parseFloat(window.getComputedStyle(tipInput).paddingLeft);
        const symRightOffset = symRect.right - inRect.left;

        return {
          tipSymbolVisible: !tipSymbol.classList.contains('hidden'),
          padLeft,
          symRightOffset,
          separated: padLeft > symRightOffset,
          isClipped: tipInput.scrollWidth > tipInput.clientWidth
        };
      })()
    `);

    check('Fixed Tip indicator symbol is visible', tipInputCheck.tipSymbolVisible);
    check('Fixed Tip input has proper padding separating currency symbol from digits', tipInputCheck.separated, `padLeft=${tipInputCheck.padLeft}px, symRightOffset=${tipInputCheck.symRightOffset}px`);
    check('Fixed Tip input does not clip digits for 5000', !tipInputCheck.isClipped);

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Bottom Scroll Clearance & Tap Targets
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Bottom Scroll Clearance & Tap Targets ---');

    // Scroll all the way down
    await evaluate(`window.scrollTo(0, document.body.scrollHeight);`);
    await new Promise((r) => setTimeout(r, 500));

    const scrollClearance = await evaluate(`
      (() => {
        const stickyBar = document.querySelector('.sm\\\\:hidden.fixed.bottom-0');
        const container = document.getElementById('bill-splitter-container');
        const lastActionRow = container.querySelector('#mode-panel-itemized .grid.grid-cols-3');

        if (!stickyBar || !lastActionRow) return { error: 'Elements not found' };

        const barRect = stickyBar.getBoundingClientRect();
        const lastRect = lastActionRow.getBoundingClientRect();

        // The bottom-most action buttons should be completely above the sticky bar top
        const cleared = lastRect.bottom <= barRect.top + 5;

        return {
          cleared,
          lastRowBottom: lastRect.bottom,
          stickyBarTop: barRect.top,
          diff: barRect.top - lastRect.bottom
        };
      })()
    `);

    check('Scrolling to page bottom completely clears sticky action bar without overlap', scrollClearance.cleared, `gap=${scrollClearance.diff}px`);

    // Verify Copy and Share buttons remain interactive on mobile
    const tapTargetCheck = await evaluate(`
      (() => {
        const copyBtn = document.getElementById('btn-mobile-copy');
        const shareBtn = document.getElementById('btn-mobile-whatsapp');

        const copyRect = copyBtn.getBoundingClientRect();
        const shareRect = shareBtn.getBoundingClientRect();

        return {
          copyWidth: copyRect.width,
          copyHeight: copyRect.height,
          shareWidth: shareRect.width,
          shareHeight: shareRect.height,
          copyValidSize: copyRect.width >= 40 && copyRect.height >= 30,
          shareValidSize: shareRect.width >= 40 && shareRect.height >= 30
        };
      })()
    `);

    check('Mobile Copy button has comfortable tap target size', tapTargetCheck.copyValidSize, `${tapTargetCheck.copyWidth}x${tapTargetCheck.copyHeight}px`);
    check('Mobile Share button has comfortable tap target size', tapTargetCheck.shareValidSize, `${tapTargetCheck.shareWidth}x${tapTargetCheck.shareHeight}px`);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Capture Artifact Screenshots
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Capturing Artifact Screenshots ---');

    // Screenshot at 390px (mobile focus)
    await setViewport(390, 844);
    await evaluate(`window.scrollTo(0, 0);`);
    await new Promise((r) => setTimeout(r, 400));
    const ss390Path = path.join(ARTIFACT_DIR, 'mobile_qa_390px.png');
    await captureScreenshot(ss390Path);
    console.log(`  📸 Saved mobile 390px screenshot: ${ss390Path}`);

    // Screenshot at 360px (standard android)
    await setViewport(360, 800);
    await new Promise((r) => setTimeout(r, 400));
    const ss360Path = path.join(ARTIFACT_DIR, 'mobile_qa_360px.png');
    await captureScreenshot(ss360Path);
    console.log(`  📸 Saved mobile 360px screenshot: ${ss360Path}`);

    // Screenshot at 320px (ultra-compact)
    await setViewport(320, 568);
    await new Promise((r) => setTimeout(r, 400));
    const ss320Path = path.join(ARTIFACT_DIR, 'mobile_qa_320px.png');
    await captureScreenshot(ss320Path);
    console.log(`  📸 Saved mobile 320px screenshot: ${ss320Path}`);

    console.log('\n======================================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`TOTAL RESPONSIVE CHECKS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('======================================================\n');

    edgeProc.kill();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
