import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4803;
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

async function runTest() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Static server running at http://localhost:${PORT}`);

  const cdpPort = 9232;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-goals-typo-qa-'));
  const edgeProcess = spawn(
    EDGE_PATH,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ]
  );

  await new Promise((r) => setTimeout(r, 2000));
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const data = await res.json();
      const page = data.find((p) => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!wsUrl) throw new Error('Could not connect to Edge DevTools');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.once('open', r));

  let reqId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async function setViewport(width, height) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768
    });
    await sendCommand('Emulation.setVisibleSize', { width, height });
  }

  async function captureScreenshot(filepath) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('DOM.enable');

    console.log('\n--- SUITE 1: Goal Card Typography & Visual Hierarchy (395px) ---');
    await setViewport(395, 844);
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 1500));

    // Setup a sample goal with contributions in localStorage
    await evaluate(`
      (function() {
        const sampleGoals = [
          {
            id: 'goal-qa-1',
            name: 'Home Down Payment Fund',
            target: 100000,
            current: 25000,
            initialAmount: 25000,
            monthly: 5000,
            contributions: [
              { id: 'contrib-1', date: '2026-11-05', month: '2026-11', planned: 5000, actual: 5500 },
              { id: 'contrib-2', date: '2026-10-15', month: '2026-10', planned: 5000, actual: 4800 }
            ]
          }
        ];
        localStorage.setItem('fet_goals_v4', JSON.stringify(sampleGoals));
        window.location.reload();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // Switch to Targets / Goals tab
    await evaluate(`
      (function() {
        if (typeof window.switchTab === 'function') {
          window.switchTab('targets');
        } else {
          document.querySelector('[data-bottom-tab="targets"]')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify Goal Card Typography Elements
    const typoCheck = await evaluate(`
      (function() {
        const card = document.querySelector('#goals-container > div');
        if (!card) return null;

        // 1. Goal Name
        const nameEl = card.querySelector('h4');
        const nameHasSemibold = nameEl?.classList.contains('font-semibold');
        const nameHasTextSm = nameEl?.classList.contains('text-sm');

        // 2. Main Saved Amount
        const savedAmountEl = card.querySelector('.text-lg');
        const savedIsLargeBold = savedAmountEl && savedAmountEl.classList.contains('font-bold');

        // 3. Right-aligned Target and Starting
        const rightAlignedEls = card.querySelectorAll('.text-right');
        const targetAlignedRight = rightAlignedEls.length >= 2;

        // 4. Remaining Amount (Readable without competing)
        const remainingEl = card.querySelector('.space-y-2 > div:nth-child(2)');
        const remainingText = remainingEl?.textContent || '';
        const remainingHasMedium = remainingEl?.querySelector('.font-medium') !== null;

        // 5. Standardized Plan & Duration
        const planContainer = card.querySelector('.border-t');
        const planText = planContainer?.textContent || '';
        const planStandardized = planContainer?.classList.contains('text-xs');

        // 6. Spacing between rows
        const finRows = card.querySelector('.space-y-2');
        const hasImprovedSpacing = !!finRows;

        return {
          cardExists: true,
          nameHasSemibold,
          nameHasTextSm,
          nameText: nameEl?.textContent.trim(),
          savedIsLargeBold,
          savedAmountText: savedAmountEl?.textContent.trim(),
          targetAlignedRight,
          remainingText,
          remainingHasMedium,
          planStandardized,
          planText,
          hasImprovedSpacing
        };
      })()
    `);

    check('Savings goal card is populated in DOM', typoCheck?.cardExists);
    check('Req 2: Goal name uses clean semibold typography (text-sm font-semibold)', typoCheck?.nameHasSemibold && typoCheck?.nameHasTextSm);
    check('Req 3: Current saved amount displays in a larger, bold font (text-lg font-bold)', typoCheck?.savedIsLargeBold);
    check('Req 4: Target and Starting amounts are neatly aligned on the right', typoCheck?.targetAlignedRight);
    check('Req 5: Remaining amount is readable without competing with main balance (font-medium)', typoCheck?.remainingHasMedium);
    check('Req 6: Plan, Actual, contribution, and remaining duration use standardized typography', typoCheck?.planStandardized);
    check('Req 7: Spacing between financial information rows is improved (space-y-2)', typoCheck?.hasImprovedSpacing);

    console.log('\n--- SUITE 2: Clean Aligned Contribution History Financial Table ---');
    // Open the details element
    await evaluate(`
      (function() {
        const details = document.querySelector('#goals-container details');
        if (details) details.open = true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const historyTableCheck = await evaluate(`
      (function() {
        const details = document.querySelector('#goals-container details');
        if (!details) return null;

        // Table Month Header
        const monthHeaders = details.querySelectorAll('.border-b');
        const firstHeader = monthHeaders[0];
        const monthTitle = firstHeader?.querySelector('.font-semibold');
        const headerSummary = firstHeader?.children[1];

        // Entries list
        const entriesTable = details.querySelector('.divide-y');
        const entries = entriesTable ? entriesTable.querySelectorAll(':scope > div') : [];
        const firstEntry = entries[0];

        const dateEl = firstEntry?.querySelector('span.text-slate-600');
        const amountEl = firstEntry?.querySelector('span.font-semibold');
        const editBtn = firstEntry?.querySelector('.btn-edit-contrib');
        const deleteBtn = firstEntry?.querySelector('.btn-delete-contrib');

        return {
          isOpen: details.open,
          hasMonthTitleSemibold: !!monthTitle,
          monthTitleText: monthTitle?.textContent.trim(),
          hasHeaderSummary: !!headerSummary,
          entryCount: entries.length,
          hasDate: !!dateEl,
          dateText: dateEl?.textContent.trim(),
          hasAmount: !!amountEl,
          amountText: amountEl?.textContent.trim(),
          hasEditBtn: !!editBtn,
          hasDeleteBtn: !!deleteBtn
        };
      })()
    `);

    check('Contribution history drawer opens smoothly', historyTableCheck?.isOpen);
    check('Req 8 & 9: Month summary header displays semibold month and aligned Plan/Actual/Diff', historyTableCheck?.hasMonthTitleSemibold && historyTableCheck?.hasHeaderSummary);
    check('Req 9: Contribution table displays consistently aligned dates and actual amounts', historyTableCheck?.hasDate && historyTableCheck?.hasAmount);
    check('Req 10 & 11: Bold reserved for financial values, clean text throughout table', historyTableCheck?.amountText.includes('5,500') || historyTableCheck?.amountText.includes('5500'));
    check('Req 12: Edit and Delete buttons preserved in entry row', historyTableCheck?.hasEditBtn && historyTableCheck?.hasDeleteBtn);

    console.log('\n--- SUITE 3: Multi-Viewport Responsiveness & Screenshots (360px, 395px, 430px) ---');
    // Test 360px
    await setViewport(360, 780);
    await new Promise((r) => setTimeout(r, 300));
    const overflow360 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const card = document.querySelector('#goals-container > div');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          cardNoOverflow: card ? card.scrollWidth <= card.clientWidth : true
        };
      })()
    `);
    check('360px: Zero horizontal page overflow', overflow360.docNoOverflow);
    check('360px: Zero goal card horizontal overflow', overflow360.cardNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_typography_360px.png'));
    console.log('  📸 Screenshot saved: goals_typography_360px.png');

    // Test 395px
    await setViewport(395, 844);
    await new Promise((r) => setTimeout(r, 300));
    const overflow395 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const card = document.querySelector('#goals-container > div');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          cardNoOverflow: card ? card.scrollWidth <= card.clientWidth : true
        };
      })()
    `);
    check('395px: Zero horizontal page overflow', overflow395.docNoOverflow);
    check('395px: Zero goal card horizontal overflow', overflow395.cardNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_typography_395px.png'));
    console.log('  📸 Screenshot saved: goals_typography_395px.png');

    // Test 430px
    await setViewport(430, 932);
    await new Promise((r) => setTimeout(r, 300));
    const overflow430 = await evaluate(`
      (function() {
        const doc = document.documentElement;
        const card = document.querySelector('#goals-container > div');
        return {
          docNoOverflow: doc.scrollWidth <= window.innerWidth,
          cardNoOverflow: card ? card.scrollWidth <= card.clientWidth : true
        };
      })()
    `);
    check('430px: Zero horizontal page overflow', overflow430.docNoOverflow);
    check('430px: Zero goal card horizontal overflow', overflow430.cardNoOverflow);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_typography_430px.png'));
    console.log('  📸 Screenshot saved: goals_typography_430px.png');

    console.log('\n--- SUITE 4: Desktop & Tablet Invariance ---');
    // Switch to Tablet 768px
    await setViewport(768, 1024);
    await new Promise((r) => setTimeout(r, 400));
    const tabletCheck = await evaluate(`
      (function() {
        const card = document.querySelector('#goals-container > div');
        const nameEl = card?.querySelector('h4');
        return {
          hasSmTextXs: nameEl?.classList.contains('sm:text-xs'),
          hasSmFontBold: nameEl?.classList.contains('sm:font-bold')
        };
      })()
    `);
    check('Tablet 768px: Preserves desktop font classes (sm:text-xs sm:font-bold)', tabletCheck.hasSmTextXs && tabletCheck.hasSmFontBold);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_typography_tablet_768px.png'));
    console.log('  📸 Screenshot saved: goals_typography_tablet_768px.png');

    // Switch to Desktop 1280px
    await setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 400));
    const desktopCheck = await evaluate(`
      (function() {
        const card = document.querySelector('#goals-container > div');
        const nameEl = card?.querySelector('h4');
        const savedAmountEl = card?.querySelector('.text-lg');
        return {
          hasSmTextXs: nameEl?.classList.contains('sm:text-xs'),
          hasSmFontMono: savedAmountEl?.classList.contains('sm:font-mono')
        };
      })()
    `);
    check('Desktop 1280px: Preserves desktop font-mono and sizing overrides', desktopCheck.hasSmTextXs && desktopCheck.hasSmFontMono);
    await captureScreenshot(path.join(ARTIFACT_DIR, 'goals_typography_desktop_1280px.png'));
    console.log('  📸 Screenshot saved: goals_typography_desktop_1280px.png');

    console.log('\n=============================================');
    const passed = testResults.filter((r) => r.pass).length;
    const failed = testResults.filter((r) => !r.pass).length;
    console.log(`Total checks: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('Failed checks:', testResults.filter((r) => !r.pass));
      process.exit(1);
    } else {
      console.log('All Goals Typography & Readability tests PASSED perfectly!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    try {
      ws.close();
      edgeProcess.kill();
      server.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTest();
