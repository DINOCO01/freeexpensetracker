import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4555;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

// 22 realistic transactions including long descriptions, imported entries, and income
const TEST_TRANSACTIONS = [
  { id: 'tx-1', name: 'Apartment Monthly Lease Rent', amount: 1350, category: 'Housing', date: '2026-11-01', source: 'manual' },
  { id: 'tx-2', name: 'Whole Foods Market Weekly Organic Family Grocery Run and Household Supplies', amount: 382.45, category: 'Food', date: '2026-11-02', source: 'imported' },
  { id: 'tx-3', name: 'High-Speed Fiber Gigabit Internet & Mesh WiFi Router Rental Package', amount: 95.00, category: 'Utilities', date: '2026-11-03', source: 'manual' },
  { id: 'tx-4', name: 'Primary Employer Bi-Weekly Direct Deposit Net Salary', amount: 2850, category: 'Income', type: 'income', date: '2026-11-04', source: 'imported' },
  { id: 'tx-5', name: 'Shell Express Clean Fuel Fill-up and Highway Toll Pass Recharge', amount: 68.20, category: 'Transport', date: '2026-11-05', source: 'manual' },
  { id: 'tx-6', name: 'Downtown Artisan Coffee Roasters Espresso Beans & Light Lunch', amount: 18.75, category: 'Food', date: '2026-11-06', source: 'manual' },
  { id: 'tx-7', name: 'Streaming All-Access Entertainment Bundle (Netflix, Disney+, Spotify Premium)', amount: 44.99, category: 'Entertainment', date: '2026-11-07', source: 'imported' },
  { id: 'tx-8', name: 'Comprehensive Annual Healthcare & Dental Insurance Premium Copay', amount: 175.50, category: 'Healthcare', date: '2026-11-08', source: 'manual' },
  { id: 'tx-9', name: 'Vanguard Index Fund Automatic Monthly Investment Contribution', amount: 500.00, category: 'Savings', date: '2026-11-09', source: 'manual' },
  { id: 'tx-10', name: 'Target Supercenter Home Essentials, Cleaning Supplies & Toiletries', amount: 112.30, category: 'Miscellany', date: '2026-11-10', source: 'imported' },
  { id: 'tx-11', name: 'Municipal Clean Water, Sewage & Storm Drain Utility Assessment', amount: 62.40, category: 'Utilities', date: '2026-11-11', source: 'manual' },
  { id: 'tx-12', name: 'Metropolitan Transit Authority Monthly Commuter Rail Transit Pass', amount: 120.00, category: 'Transport', date: '2026-11-12', source: 'manual' },
  { id: 'tx-13', name: 'Freelance UI/UX Consulting & Technical Design Review Retainer', amount: 1350.00, category: 'Income', type: 'income', date: '2026-11-13', source: 'imported' },
  { id: 'tx-14', name: 'Amazon Prime Order: Ergonomic Desk Accessories & Replacement Cable', amount: 48.90, category: 'Miscellany', date: '2026-11-14', source: 'imported' },
  { id: 'tx-15', name: 'Local Farmer Market Organic Fresh Produce & Honey', amount: 37.60, category: 'Food', date: '2026-11-15', source: 'manual' },
  { id: 'tx-16', name: 'Electric Vehicle Supercharger Rapid Charging Session', amount: 22.80, category: 'Transport', date: '2026-11-16', source: 'imported' },
  { id: 'tx-17', name: 'CVS Pharmacy Prescription Refills & Allergy Medication', amount: 29.15, category: 'Healthcare', date: '2026-11-17', source: 'manual' },
  { id: 'tx-18', name: 'Neighborhood Italian Bistro Dinner with Extended Friends', amount: 84.50, category: 'Food', date: '2026-11-18', source: 'manual' },
  { id: 'tx-19', name: 'Cloud Storage & GitHub Developer Tools Annual Subscription Renewal', amount: 36.00, category: 'Utilities', date: '2026-11-19', source: 'imported' },
  { id: 'tx-20', name: 'Emergency Liquid Cash Reserves High-Yield Savings Deposit', amount: 300.00, category: 'Savings', date: '2026-11-19', source: 'manual' },
  { id: 'tx-21', name: 'Petco Premium Veterinary Dental Chew & Grain-Free Cat Food', amount: 56.40, category: 'Miscellany', date: '2026-11-19', source: 'imported' },
  { id: 'tx-22', name: 'FINAL_TX: Weekend Home Depot Hardware & Weatherproofing Sealant Kit', amount: 34.20, category: 'Housing', date: '2026-11-19', source: 'manual' }
];

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
  const cdpPort = 9388;
  const tmpDir = path.join(os.tmpdir(), `cdp_final_check_${Date.now()}`);
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
    function send(method, params = {}, timeoutMs = 6000) {
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
      await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile });
      await new Promise((r) => setTimeout(r, 350));
    };

    const captureScreenshot = async (filepath) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    };

    // Navigate to page
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    // Seed the 22 transactions into localStorage and trigger state update
    console.log('\n--- SEEDING 22 TRANSACTIONS (WITH LONG TITLES & IMPORTED ENTRIES) ---');
    await evaluate(`
      (() => {
        const txs = ${JSON.stringify(TEST_TRANSACTIONS)};
        localStorage.setItem('fet_transactions_v4', JSON.stringify(txs));
        localStorage.setItem('fet_income_v4', '4200');
        // Reload to let app state hydrate from storage
        window.location.reload();
      })()
    `);
    await new Promise((r) => setTimeout(r, 2000));

    // ==========================================
    // 1. MOBILE 395px CHECK
    // ==========================================
    console.log('\n--- 1. MOBILE 395px AUDIT & SCREENSHOTS ---');
    await setViewport(395, 852, true);

    const check395 = await evaluate(`
      (() => {
        const healthCard = document.getElementById('financial-health-mobile-card');
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
        const scoreNum = document.getElementById('health-score-number-mobile');
        const barSavings = document.getElementById('mobile-bar-savings');
        const barFixed = document.getElementById('mobile-bar-fixed');
        const barBuffer = document.getElementById('mobile-bar-buffer');
        
        // Check for any clipping or text overflow in transaction cards
        let anyCardClipped = false;
        cards.forEach((card) => {
          const title = card.querySelector('.truncate');
          if (card.scrollWidth > card.clientWidth + 2) anyCardClipped = true;
        });

        return {
          score: scoreNum?.innerText.trim(),
          savingsWidth: barSavings?.style.width,
          fixedWidth: barFixed?.style.width,
          bufferWidth: barBuffer?.style.width,
          cardCount: cards.length,
          anyCardClipped,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: window.innerWidth,
          healthCardHeight: healthCard ? healthCard.getBoundingClientRect().height : 0
        };
      })()
    `);

    check('Mobile 395px: 22 transactions rendered', check395.cardCount === 22, `got ${check395.cardCount}`);
    check('Mobile 395px: Zero horizontal overflow on root', check395.scrollWidth <= check395.clientWidth, `${check395.scrollWidth} <= ${check395.clientWidth}`);
    check('Mobile 395px: No transaction card overflow clipping', !check395.anyCardClipped);
    check('Mobile 395px: Financial Health card is compact (<= 290px)', check395.healthCardHeight <= 290, `height is ${check395.healthCardHeight}px`);
    check('Mobile 395px: Financial health progress bars populated', !!check395.savingsWidth && !!check395.fixedWidth && !!check395.bufferWidth);

    // Capture Financial Health Card screenshot at 395px
    await evaluate(`document.getElementById('financial-health-mobile-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_financial_health_395px.png'));

    // Capture Ledger Cards screenshot at 395px
    await evaluate(`document.getElementById('transactions-mobile-container')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_ledger_20tx_395px.png'));

    // ==========================================
    // 2. MOBILE 360px CHECK
    // ==========================================
    console.log('\n--- 2. MOBILE 360px AUDIT & SCREENSHOTS ---');
    await setViewport(360, 800, true);

    const check360 = await evaluate(`
      (() => {
        const healthCard = document.getElementById('financial-health-mobile-card');
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
        let anyCardClipped = false;
        cards.forEach((card) => {
          if (card.scrollWidth > card.clientWidth + 2) anyCardClipped = true;
        });

        return {
          cardCount: cards.length,
          anyCardClipped,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: window.innerWidth,
          healthCardHeight: healthCard ? healthCard.getBoundingClientRect().height : 0
        };
      })()
    `);

    check('Mobile 360px: 22 transactions rendered', check360.cardCount === 22, `got ${check360.cardCount}`);
    check('Mobile 360px: Zero horizontal overflow on root', check360.scrollWidth <= check360.clientWidth, `${check360.scrollWidth} <= ${check360.clientWidth}`);
    check('Mobile 360px: No transaction card overflow clipping', !check360.anyCardClipped);
    check('Mobile 360px: Financial Health card is compact (<= 290px)', check360.healthCardHeight <= 290, `height is ${check360.healthCardHeight}px`);

    await evaluate(`document.getElementById('financial-health-mobile-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_financial_health_360px.png'));

    await evaluate(`document.getElementById('transactions-mobile-container')?.scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await new Promise((r) => setTimeout(r, 300));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_ledger_20tx_360px.png'));

    // ==========================================
    // 3. SCROLL TO FINAL TRANSACTION OBSTRUCTION CHECK
    // ==========================================
    console.log('\n--- 3. FINAL TRANSACTION VISIBILITY & CLEARANCE CHECK ---');
    await setViewport(395, 852, true);

    const lastCardCheck = await evaluate(`
      (() => {
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
        const lastCard = cards[cards.length - 1];
        if (!lastCard) return null;

        // Scroll last card into view with block: 'center'
        lastCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        
        const cardRect = lastCard.getBoundingClientRect();
        const bottomNav = document.querySelector('nav.fixed.bottom-0');
        const bmcBtn = document.getElementById('bmc-wbtn');
        
        const navRect = bottomNav ? bottomNav.getBoundingClientRect() : null;
        const bmcRect = bmcBtn ? bmcBtn.getBoundingClientRect() : null;
        
        // Check if card's bottom is unobstructed by fixed bottom elements
        const cardBottom = cardRect.bottom;
        const navTop = navRect ? navRect.top : window.innerHeight;
        
        return {
          lastCardText: lastCard.innerText,
          cardTop: cardRect.top,
          cardBottom: cardRect.bottom,
          navTop: navTop,
          isAboveNav: cardBottom < navTop,
          clearanceToNavPx: navTop - cardBottom,
          viewportHeight: window.innerHeight
        };
      })()
    `);

    check('Final transaction (22nd card) scrolled into view', lastCardCheck && lastCardCheck.lastCardText.includes('FINAL_TX'));
    check('Final transaction is unobstructed by bottom navigation', lastCardCheck && lastCardCheck.isAboveNav, `clearance is ${lastCardCheck?.clearanceToNavPx}px above nav`);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_ledger_last_card_scroll_395px.png'));

    // ==========================================
    // 4. FINANCIAL METRICS & PROGRESS BARS AUDIT
    // ==========================================
    console.log('\n--- 4. FINANCIAL METRICS AND RATIOS INTEGRITY AUDIT ---');
    const metricsAudit = await evaluate(`
      (() => {
        const scoreNum = document.getElementById('health-score-number-mobile')?.innerText.trim();
        const legSavingsVal = document.getElementById('mobile-legend-savings-val')?.innerText.trim();
        const legFixedVal = document.getElementById('mobile-legend-fixed-val')?.innerText.trim();
        const legBufferVal = document.getElementById('mobile-legend-buffer-val')?.innerText.trim();
        const barSavings = document.getElementById('mobile-bar-savings')?.style.width;
        const barFixed = document.getElementById('mobile-bar-fixed')?.style.width;
        const barBuffer = document.getElementById('mobile-bar-buffer')?.style.width;
        
        return {
          scoreNum,
          legSavingsVal,
          legFixedVal,
          legBufferVal,
          barSavings,
          barFixed,
          barBuffer
        };
      })()
    `);

    console.log('Metrics Audit Values:', metricsAudit);
    check('Score number is non-empty number', !isNaN(Number(metricsAudit.scoreNum)) && Number(metricsAudit.scoreNum) > 0);
    check('Savings legend has percentage string', metricsAudit.legSavingsVal.includes('%'));
    check('Fixed costs legend has percentage string', metricsAudit.legFixedVal.includes('%'));
    check('Buffer legend has percentage string', metricsAudit.legBufferVal.includes('%'));
    check('All 3 mobile progress bars have valid width percentages', 
      metricsAudit.barSavings.includes('%') &&
      metricsAudit.barFixed.includes('%') &&
      metricsAudit.barBuffer.includes('%')
    );

    // ==========================================
    // 5. DESKTOP 1280px LAYOUT AUDIT
    // ==========================================
    console.log('\n--- 5. DESKTOP 1280px RECHECK AGAINST ORIGINAL LAYOUT ---');
    await setViewport(1280, 900, false);

    const desktopCheck = await evaluate(`
      (() => {
        const desktopHealth = document.querySelector('.hidden.sm\\\\:flex');
        const mobileHealth = document.querySelector('.sm\\\\:hidden');
        const desktopTable = document.querySelector('.hidden.sm\\\\:block');
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const tbody = document.getElementById('transactions-tbody');
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        const scoreCircle = document.getElementById('score-circle-stroke');
        const barSavings = document.getElementById('bar-savings-score');
        const barFixed = document.getElementById('bar-fixed-score');
        const barBuffer = document.getElementById('bar-buffer-score');

        return {
          desktopHealthVisible: desktopHealth && desktopHealth.offsetWidth > 0,
          mobileHealthHidden: mobileHealth ? mobileHealth.offsetWidth === 0 : true,
          desktopTableVisible: desktopTable && desktopTable.offsetWidth > 0,
          mobileContainerHidden: mobileContainer ? mobileContainer.offsetWidth === 0 || window.getComputedStyle(mobileContainer).display === 'none' : true,
          desktopRowCount: rows.length,
          hasOriginalCircleStroke: !!scoreCircle,
          hasOriginalProgressBars: !!(barSavings && barFixed && barBuffer),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: window.innerWidth
        };
      })()
    `);

    check('Desktop health indicator visible at 1280px', desktopCheck.desktopHealthVisible);
    check('Mobile health indicator hidden at 1280px', desktopCheck.mobileHealthHidden);
    check('Desktop table container visible at 1280px', desktopCheck.desktopTableVisible);
    check('Mobile transaction cards hidden at 1280px', desktopCheck.mobileContainerHidden);
    check('Desktop table rendered all 22 transaction rows', desktopCheck.desktopRowCount === 22, `got ${desktopCheck.desktopRowCount}`);
    check('Desktop has original score circle stroke gauge', desktopCheck.hasOriginalCircleStroke);
    check('Desktop has original 3 horizontal metric progress bars', desktopCheck.hasOriginalProgressBars);
    check('Desktop zero horizontal overflow at 1280px', desktopCheck.scrollWidth <= desktopCheck.clientWidth);

    await captureScreenshot(path.join(ARTIFACT_DIR, 'final_desktop_1280px.png'));

  } catch (err) {
    console.error('Final check execution failed:', err);
  } finally {
    edgeProc.kill();
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    console.log('\n=======================================');
    console.log(`TOTAL FINAL CHECKS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(t => t.pass).length}`);
    console.log(`FAILED: ${testResults.filter(t => !t.pass).length}`);
    console.log('=======================================');
    process.exit(testResults.every(t => t.pass) ? 0 : 1);
  }
});
