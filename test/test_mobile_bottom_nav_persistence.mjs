// test/test_mobile_bottom_nav_persistence.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PORT = 4805;
const DIST_DIR = path.resolve('dist');
const ARTIFACT_DIR = path.resolve('C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  if (!path.extname(reqPath)) reqPath += '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, '404.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Error loading ' + reqPath);
  }
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
  runTests();
});

let testResults = [];
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAIL: ${name} ${details}`);
    testResults.push({ name, pass: false, details });
  }
}

async function runTests() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=395,844'
  ]);

  let client = null;

  try {
    await new Promise((r) => setTimeout(r, 1500));

    const response = await fetch('http://127.0.0.1:9222/json');
    const targets = await response.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No Chrome page target available');

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) cb.reject(msg.error);
        else cb.resolve(msg.result);
      }
    });

    const send = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    await new Promise((resolve) => ws.on('open', resolve));

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    async function navigate(url) {
      await send('Page.navigate', { url });
      await new Promise((r) => setTimeout(r, 700));
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768
      });
      await new Promise((r) => setTimeout(r, 200));
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }

    // Set mobile viewport initially
    await setViewport(395, 844);

    // =========================================================================
    console.log('\n--- SUITE 1: Contact Us Page (/contact-us/) Navigation Verification ---');
    await navigate(`http://localhost:${PORT}/contact-us/`);

    const contactNav = await evaluate(`
      (function() {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return { exists: false };
        const cs = window.getComputedStyle(nav);
        const isVisible = cs.display !== 'none' && cs.visibility !== 'hidden';
        const isFixed = cs.position === 'fixed';
        const buttons = Array.from(nav.querySelectorAll('.bottom-nav-btn'));
        const labels = buttons.map(b => b.querySelector('span')?.textContent.trim());

        const pill = document.getElementById('bottom-nav-active-pill');
        const pillLeft = pill ? pill.style.left : '';

        const moreBtn = document.getElementById('btn-bottom-nav-more');
        const moreIsActive = moreBtn ? moreBtn.classList.contains('active') : false;

        // Check button hrefs / targets
        const trackerBtn = buttons[0];
        const splitBtn = buttons[1];
        const templatesBtn = buttons[2];
        const debtBtn = buttons[3];
        const goalsBtn = buttons[4];

        return {
          exists: true,
          isVisible,
          isFixed,
          buttonCount: buttons.length,
          labels,
          pillLeft,
          moreIsActive,
          trackerHref: trackerBtn?.getAttribute('href') || '',
          splitHref: splitBtn?.getAttribute('href') || '',
          templatesHref: templatesBtn?.getAttribute('href') || '',
          debtHref: debtBtn?.getAttribute('href') || '',
          goalsHref: goalsBtn?.getAttribute('href') || ''
        };
      })()
    `);

    check('Contact Us: Mobile bottom nav exists in DOM', contactNav.exists);
    check('Contact Us: Mobile bottom nav is visible (display !== none)', contactNav.isVisible);
    check('Contact Us: Mobile bottom nav is fixed at bottom', contactNav.isFixed);
    check('Contact Us: Contains all 6 buttons (Tracker, Split, Templates, Debt, Goals, More)',
      contactNav.buttonCount === 6 &&
      contactNav.labels.includes('Tracker') &&
      contactNav.labels.includes('Split') &&
      contactNav.labels.includes('Templates') &&
      contactNav.labels.includes('Debt') &&
      contactNav.labels.includes('Goals') &&
      contactNav.labels.includes('More')
    );
    check('Contact Us: "More" is highlighted with active class', contactNav.moreIsActive);
    check('Contact Us: Active pill is positioned on More (index 5)', contactNav.pillLeft.includes('5 *') || contactNav.pillLeft.includes('83.33') || contactNav.pillLeft.includes('5'));
    check('Contact Us: Tracker button links to /?tab=tracker', contactNav.trackerHref.includes('/?tab=tracker'));
    check('Contact Us: Split button links to /?tab=split', contactNav.splitHref.includes('/?tab=split'));
    check('Contact Us: Templates button links to /?tab=templates', contactNav.templatesHref.includes('/?tab=templates'));
    check('Contact Us: Debt button links to /?tab=debt', contactNav.debtHref.includes('/?tab=debt'));
    check('Contact Us: Goals button links to /?tab=targets', contactNav.goalsHref.includes('/?tab=targets'));

    // Test More sheet interaction on Contact Us page
    await evaluate(`document.getElementById('btn-bottom-nav-more')?.click();`);
    await new Promise((r) => setTimeout(r, 400));

    const sheetOpenCheck = await evaluate(`
      (function() {
        const sheet = document.getElementById('more-menu-sheet');
        const backdrop = document.getElementById('more-menu-backdrop');
        const sheetVisible = sheet && !sheet.classList.contains('hidden');
        const backdropVisible = backdrop && !backdrop.classList.contains('hidden');
        return { sheetVisible, backdropVisible };
      })()
    `);
    check('Contact Us: Tapping More opens bottom sheet overlay', sheetOpenCheck.sheetVisible && sheetOpenCheck.backdropVisible);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_mobile_more_open_395px.png'));
    console.log('  📸 Screenshot saved: contact_us_mobile_more_open_395px.png');

    // Close sheet
    await evaluate(`document.getElementById('btn-close-more-sheet')?.click();`);
    await new Promise((r) => setTimeout(r, 400));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_mobile_395px.png'));
    console.log('  📸 Screenshot saved: contact_us_mobile_395px.png');

    // Check footer spacing / overlap prevention on Contact Us
    const contactFooterCheck = await evaluate(`
      (function() {
        const footer = document.querySelector('footer.no-print');
        const nav = document.getElementById('mobile-bottom-nav');
        if (!footer || !nav) return { pass: false };

        const footerRect = footer.getBoundingClientRect();
        const footerPaddingBottom = parseFloat(window.getComputedStyle(footer).paddingBottom);
        return {
          footerPaddingBottom,
          hasClearance: footerPaddingBottom >= 80
        };
      })()
    `);
    check('Contact Us: Footer has sufficient bottom clearance (>=80px) for fixed navigation', contactFooterCheck.hasClearance);

    // =========================================================================
    console.log('\n--- SUITE 2: Secondary Pages Navigation Verification ---');
    const secondaryPages = [
      { name: 'About Us', url: '/about/', expectedTab: 'more' },
      { name: 'Privacy Policy', url: '/privacy-policy/', expectedTab: 'more' },
      { name: 'Terms & Conditions', url: '/terms-and-conditions/', expectedTab: 'more' },
      { name: 'Bill Splitter', url: '/bill-splitter/', expectedTab: 'split' },
      { name: 'Templates Index', url: '/templates/', expectedTab: 'templates' },
      { name: '404 Page', url: '/non-existent-page-test/', expectedTab: 'more' }
    ];

    for (const page of secondaryPages) {
      await navigate(`http://localhost:${PORT}${page.url}`);
      const navStatus = await evaluate(`
        (function() {
          const nav = document.getElementById('mobile-bottom-nav');
          if (!nav) return { exists: false };
          const cs = window.getComputedStyle(nav);
          const isVisible = cs.display !== 'none';
          const buttons = nav.querySelectorAll('.bottom-nav-btn');
          const activeBtn = nav.querySelector('.bottom-nav-btn.active');
          const activeTab = activeBtn ? activeBtn.getAttribute('data-bottom-tab') : '';
          return {
            exists: true,
            isVisible,
            btnCount: buttons.length,
            activeTab
          };
        })()
      `);

      check(`${page.name}: Bottom nav exists and is visible`, navStatus.exists && navStatus.isVisible);
      check(`${page.name}: Has all 6 navigation items`, navStatus.btnCount === 6);
      check(`${page.name}: Active tab is "${page.expectedTab}"`, navStatus.activeTab === page.expectedTab);
    }

    // Capture screenshots for About Us, Privacy Policy, Terms, Bill Splitter
    await navigate(`http://localhost:${PORT}/about/`);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'about_mobile_with_nav_395px.png'));
    console.log('  📸 Screenshot saved: about_mobile_with_nav_395px.png');

    await navigate(`http://localhost:${PORT}/privacy-policy/`);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'privacy_mobile_with_nav_395px.png'));
    console.log('  📸 Screenshot saved: privacy_mobile_with_nav_395px.png');

    await navigate(`http://localhost:${PORT}/terms-and-conditions/`);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'terms_mobile_with_nav_395px.png'));
    console.log('  📸 Screenshot saved: terms_mobile_with_nav_395px.png');

    // =========================================================================
    console.log('\n--- SUITE 3: Direct Tab Navigation & Browser History Flow ---');
    // Start at /contact-us/, then tap "Tracker" directly
    await navigate(`http://localhost:${PORT}/contact-us/`);
    await evaluate(`document.querySelector('.bottom-nav-btn[data-bottom-tab="tracker"]')?.click();`);
    await new Promise((r) => setTimeout(r, 800));

    const trackerPageCheck = await evaluate(`
      (function() {
        return {
          pathname: window.location.pathname,
          search: window.location.search,
          hasTrackerTab: !!document.getElementById('tab-view-tracker'),
          trackerActive: !document.getElementById('tab-view-tracker')?.classList.contains('hidden')
        };
      })()
    `);
    check('Direct Navigation: Tapping Tracker from Contact Us opens Tracker tab on homepage',
      trackerPageCheck.pathname === '/' && trackerPageCheck.trackerActive);

    // From Tracker, navigate to Split directly
    await evaluate(`
      (function() {
        if (typeof window.switchTab === 'function') window.switchTab('split');
        else document.querySelector('.bottom-nav-btn[data-bottom-tab="split"]')?.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    const splitActive = await evaluate(`!document.getElementById('tab-view-split')?.classList.contains('hidden')`);
    check('Direct Navigation: Tapping Split switches to Split tool without full page reload', splitActive);

    // Test Browser Back and Forward
    await evaluate(`window.history.back();`);
    await new Promise((r) => setTimeout(r, 700));
    const backUrl = await evaluate(`window.location.pathname`);
    check('Browser History: Back navigation returns to /contact-us/', backUrl.includes('/contact-us'));

    const navOnBack = await evaluate(`!!document.getElementById('mobile-bottom-nav')`);
    check('Browser History: Bottom nav remains active after Back navigation', navOnBack);

    await evaluate(`window.history.forward();`);
    await new Promise((r) => setTimeout(r, 700));
    const forwardUrl = await evaluate(`window.location.pathname`);
    check('Browser History: Forward navigation returns to homepage', forwardUrl === '/');

    // =========================================================================
    console.log('\n--- SUITE 4: Multi-Viewport Responsiveness & Screenshots (360px, 395px, 430px) ---');
    await navigate(`http://localhost:${PORT}/contact-us/`);

    // 360px
    await setViewport(360, 780);
    await new Promise((r) => setTimeout(r, 300));
    const overflow360 = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`);
    check('360px: Zero horizontal overflow on Contact Us', overflow360);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_mobile_360px.png'));
    console.log('  📸 Screenshot saved: contact_us_mobile_360px.png');

    // 395px
    await setViewport(395, 844);
    await new Promise((r) => setTimeout(r, 300));
    const overflow395 = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`);
    check('395px: Zero horizontal overflow on Contact Us', overflow395);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_mobile_395px_final.png'));
    console.log('  📸 Screenshot saved: contact_us_mobile_395px_final.png');

    // 430px
    await setViewport(430, 932);
    await new Promise((r) => setTimeout(r, 300));
    const overflow430 = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`);
    check('430px: Zero horizontal overflow on Contact Us', overflow430);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_mobile_430px.png'));
    console.log('  📸 Screenshot saved: contact_us_mobile_430px.png');

    // =========================================================================
    console.log('\n--- SUITE 5: Desktop & Tablet Invariance ---');
    // Tablet 768px
    await setViewport(768, 1024);
    await new Promise((r) => setTimeout(r, 400));
    const tabletNavCheck = await evaluate(`
      (function() {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return { hidden: true };
        return { hidden: window.getComputedStyle(nav).display === 'none' };
      })()
    `);
    check('Tablet 768px: Mobile bottom nav is strictly hidden (display === none)', tabletNavCheck.hidden);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_tablet_768px.png'));
    console.log('  📸 Screenshot saved: contact_us_tablet_768px.png');

    // Desktop 1280px
    await setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 400));
    const desktopNavCheck = await evaluate(`
      (function() {
        const nav = document.getElementById('mobile-bottom-nav');
        if (!nav) return { hidden: true };
        return { hidden: window.getComputedStyle(nav).display === 'none' };
      })()
    `);
    check('Desktop 1280px: Mobile bottom nav is strictly hidden (display === none)', desktopNavCheck.hidden);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'contact_us_desktop_1280px.png'));
    console.log('  📸 Screenshot saved: contact_us_desktop_1280px.png');

    // =========================================================================
    console.log('\n=============================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Total checks: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('Failed checks:', testResults.filter((r) => !r.pass));
      process.exit(1);
    } else {
      console.log('All Mobile Bottom Navigation Persistence tests PASSED perfectly!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    try {
      if (chromeProcess) chromeProcess.kill();
      server.close();
    } catch (e) {}
  }
}
