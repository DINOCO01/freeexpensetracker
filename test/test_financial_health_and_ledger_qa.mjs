import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  const cdpPort = 9377;
  const tmpDir = path.join(os.tmpdir(), `cdp_full_qa_${Date.now()}`);
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

    // Navigate to app
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    console.log('\n--- 1. FINANCIAL HEALTH INDICATOR (MOBILE) ---');
    await setViewport(375, 812, true);

    const healthData = await evaluate(`
      (() => {
        const scoreNum = document.getElementById('health-score-number-mobile');
        const barSavings = document.getElementById('mobile-bar-savings');
        const barFixed = document.getElementById('mobile-bar-fixed');
        const barBuffer = document.getElementById('mobile-bar-buffer');
        
        const legSavings = document.getElementById('mobile-legend-savings-val');
        const legFixed = document.getElementById('mobile-legend-fixed-val');
        const legBuffer = document.getElementById('mobile-legend-buffer-val');
        
        const textContent = document.getElementById('financial-health-mobile-card')?.innerText || '';
        
        return {
          score: scoreNum?.innerText.trim(),
          hasBarSavings: !!barSavings,
          hasBarFixed: !!barFixed,
          hasBarBuffer: !!barBuffer,
          barSavingsWidth: barSavings?.style.width,
          barFixedWidth: barFixed?.style.width,
          barBufferWidth: barBuffer?.style.width,
          legSavingsVal: legSavings?.innerText.trim(),
          legFixedVal: legFixed?.innerText.trim(),
          legBufferVal: legBuffer?.innerText.trim(),
          hasSavingsTitle: textContent.includes('Savings'),
          hasFixedTitle: textContent.includes('Fixed Essential Expenses'),
          hasBufferTitle: textContent.includes('Cashflow Buffer'),
          hasSavingsTarget: textContent.includes('Target: ~20% of income'),
          hasFixedTarget: textContent.includes('Target: ≤50% of income'),
          hasBufferTarget: textContent.includes('Target: 3–6 months costs')
        };
      })()
    `);

    check('Mobile score is 100', healthData.score === '100', `got ${healthData.score}`);
    check('Category 1: Savings exists with title & target', healthData.hasSavingsTitle && healthData.hasSavingsTarget);
    check('Category 2: Fixed Essential Expenses exists with title & target', healthData.hasFixedTitle && healthData.hasFixedTarget);
    check('Category 3: Cashflow Buffer exists with title & target', healthData.hasBufferTitle && healthData.hasBufferTarget);
    check('Category 1 progress bar present and populated', healthData.hasBarSavings && !!healthData.barSavingsWidth);
    check('Category 2 progress bar present and populated', healthData.hasBarFixed && !!healthData.barFixedWidth);
    check('Category 3 progress bar present and populated', healthData.hasBarBuffer && !!healthData.barBufferWidth);
    check('Category values displayed', !!healthData.legSavingsVal && !!healthData.legFixedVal && !!healthData.legBufferVal);

    // Capture financial health card screenshot
    await captureScreenshot(path.join(ARTIFACT_DIR, 'financial_health_mobile_bars_375px.png'));

    console.log('\n--- 2. TRANSACTION LEDGER (MOBILE) ---');
    const ledgerData = await evaluate(`
      (() => {
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
        const desktopContainer = document.querySelector('.hidden.sm\\\\:block');
        return {
          mobileVisible: mobileContainer && window.getComputedStyle(mobileContainer).display !== 'none',
          desktopHidden: desktopContainer ? window.getComputedStyle(desktopContainer).display === 'none' : true,
          cardCount: cards.length,
          firstCardText: cards[0]?.innerText || '',
          hasDeleteBtn: !!cards[0]?.querySelector('.btn-delete-tx')
        };
      })()
    `);

    check('Mobile cards container visible', ledgerData.mobileVisible);
    check('Desktop table hidden on mobile', ledgerData.desktopHidden);
    check('Transaction cards rendered (count > 0)', ledgerData.cardCount > 0, `got ${ledgerData.cardCount}`);
    check('Card displays description, category, amount, date & source', 
      ledgerData.firstCardText.includes('Apartment Rent') &&
      ledgerData.firstCardText.includes('Housing') &&
      ledgerData.firstCardText.includes('$1,350') &&
      ledgerData.firstCardText.includes('Manual')
    );
    check('Card contains delete button', ledgerData.hasDeleteBtn);

    // Scroll to ledger and screenshot
    await evaluate(`document.getElementById('transactions-mobile-container')?.scrollIntoView({ behavior: 'instant', block: 'center' })`);
    await new Promise((r) => setTimeout(r, 400));
    await captureScreenshot(path.join(ARTIFACT_DIR, 'transaction_ledger_mobile_cards_375px.png'));

    console.log('\n--- 3. SEARCH & DELETE FUNCTIONALITY ---');
    // Test Search Filtering
    await evaluate(`
      (() => {
        const input = document.getElementById('search-transactions');
        if (input) {
          input.value = 'Supermarket';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));
    const searchFilterCheck = await evaluate(`
      (() => {
        const mobileContainer = document.getElementById('transactions-mobile-container');
        const cards = mobileContainer ? Array.from(mobileContainer.children) : [];
        return {
          cardCount: cards.length,
          text: cards[0]?.innerText || ''
        };
      })()
    `);
    check('Search filtering updates mobile cards', searchFilterCheck.cardCount === 1 && searchFilterCheck.text.includes('Supermarket'));

    // Clear search
    await evaluate(`
      (() => {
        const input = document.getElementById('search-transactions');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));

    // Test Delete Action
    const beforeDeleteCount = await evaluate(`document.getElementById('transactions-mobile-container')?.children.length || 0`);
    await evaluate(`
      (() => {
        const firstDelBtn = document.querySelector('#transactions-mobile-container .btn-delete-tx');
        if (firstDelBtn) firstDelBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    const afterDeleteCount = await evaluate(`document.getElementById('transactions-mobile-container')?.children.length || 0`);
    check('Deleting transaction on mobile removes card', afterDeleteCount === beforeDeleteCount - 1, `before ${beforeDeleteCount}, after ${afterDeleteCount}`);

    console.log('\n--- 4. MOBILE VIEWPORTS OVERFLOW AUDIT (360px, 375px, 390px, 395px, 430px) ---');
    const viewports = [360, 375, 390, 395, 430];
    for (const vp of viewports) {
      await setViewport(vp, 812, true);
      const vpData = await evaluate(`
        (() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      check(`Zero horizontal overflow at ${vp}px`, vpData.scrollWidth <= vpData.clientWidth, `${vpData.scrollWidth} <= ${vpData.clientWidth}`);
    }

    console.log('\n--- 5. DESKTOP VIEWPORTS (1024px, 1280px, 1440px) ---');
    const desktopViewports = [1024, 1280, 1440];
    for (const dvp of desktopViewports) {
      await setViewport(dvp, 900, false);
      const dData = await evaluate(`
        (() => {
          const mobileHealth = document.querySelector('.sm\\\\:hidden');
          const desktopHealth = document.querySelector('.hidden.sm\\\\:flex');
          const mobileLedger = document.getElementById('transactions-mobile-container');
          const desktopLedger = document.querySelector('.hidden.sm\\\\:block');
          const tbody = document.getElementById('transactions-tbody');
          
          return {
            mobileHealthHidden: mobileHealth ? mobileHealth.offsetWidth === 0 : true,
            desktopHealthVisible: desktopHealth && desktopHealth.offsetWidth > 0,
            mobileLedgerHidden: mobileLedger ? mobileLedger.offsetWidth === 0 || window.getComputedStyle(mobileLedger).display === 'none' : true,
            desktopLedgerVisible: desktopLedger && desktopLedger.offsetWidth > 0,
            tableRowsCount: tbody ? tbody.children.length : 0,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: window.innerWidth
          };
        })()
      `);
      check(`Desktop health visible at ${dvp}px`, dData.desktopHealthVisible);
      check(`Mobile health hidden at ${dvp}px`, dData.mobileHealthHidden);
      check(`Desktop ledger table visible at ${dvp}px`, dData.desktopLedgerVisible && dData.tableRowsCount > 0);
      check(`Mobile ledger cards hidden at ${dvp}px`, dData.mobileLedgerHidden);
      check(`Zero horizontal overflow at ${dvp}px`, dData.scrollWidth <= dData.clientWidth, `${dData.scrollWidth} <= ${dData.clientWidth}`);
    }

  } catch (err) {
    console.error('QA Suite error:', err);
  } finally {
    edgeProc.kill();
    server.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    console.log('\n=======================================');
    console.log(`TOTAL QA CHECKS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(t => t.pass).length}`);
    console.log(`FAILED: ${testResults.filter(t => !t.pass).length}`);
    console.log('=======================================');
    process.exit(testResults.every(t => t.pass) ? 0 : 1);
  }
});
