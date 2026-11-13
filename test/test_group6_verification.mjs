import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import assert from 'assert';

const PORT = 4340;
const distDir = path.resolve('dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`\n=================================================================`);
  console.log(`🧪 GROUP 6 VERIFICATION SUITE (Chromium Edge CDP)`);
  console.log(`   Serving: http://localhost:${PORT}`);
  console.log(`=================================================================\n`);

  // Launch headless browser
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find((p) => fs.existsSync(p));
  if (!edgePath) {
    console.error('Edge executable not found');
    server.close();
    process.exit(1);
  }

  const userDataDir = path.resolve('temp_cdp_group6_profile');
  if (fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const remotePort = 9224;
  const proc = spawn(edgePath, [
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${remotePort}/json/version`);
      const json = await res.json();
      wsUrl = json.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
  }

  if (!wsUrl) {
    console.error('Failed to attach to browser CDP');
    proc.kill();
    server.close();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.onopen = resolve);

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const targetRes = await send('Target.createTarget', { url: `http://localhost:${PORT}/` });
  const targetId = targetRes.result.targetId;

  const sessionRes = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = sessionRes.result.sessionId;

  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');
  await sendSession('DOM.enable');

  async function evaluate(expr) {
    const res = await sendSession('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result?.result?.value;
  }

  async function navigate(url) {
    await sendSession('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 800));
  }

  let passed = 0;
  let failed = 0;
  function testCheck(name, cond, details = '') {
    if (cond) {
      console.log(`  ✅ PASS: ${name}${details ? ` (${details})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}${details ? ` (${details})` : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // PART 1 / 4A: Navigation Sequence (1, 2, 3, 4, 5)
  // ---------------------------------------------------------------------------
  console.log('--- A. Navigation Numbering & Anchors (English /) ---');
  await navigate(`http://localhost:${PORT}/`);

  const navItemsEn = await evaluate(`
    Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Tabs"] .tab-btn:not(.mobile-tab-knowledge):not(.capsule-tab-btn)')).map(el => ({
      text: el.textContent.trim(),
      tag: el.tagName,
      href: el.getAttribute('href'),
      dataTab: el.getAttribute('data-tab')
    }))
  `);
  console.log('EN Nav items:', JSON.stringify(navItemsEn, null, 2));

  testCheck('Primary nav has exactly 5 items', navItemsEn.length === 5, `${navItemsEn.length} items`);
  testCheck('Item 1 starts with "1."', navItemsEn[0]?.text.includes('1.'), navItemsEn[0]?.text);
  testCheck('Item 2 starts with "2."', navItemsEn[1]?.text.includes('2.'), navItemsEn[1]?.text);
  testCheck('Item 3 is "3. Statement Importer"', navItemsEn[2]?.text.includes('3. Statement Importer'), navItemsEn[2]?.text);
  testCheck('Item 3 points to #importer', navItemsEn[2]?.href === '#importer', navItemsEn[2]?.href);
  testCheck('Item 4 starts with "4. Debt Planner"', navItemsEn[3]?.text.includes('4. Debt Planner'), navItemsEn[3]?.text);
  testCheck('Item 5 starts with "5. Budget & Goals"', navItemsEn[4]?.text.includes('5. Budget & Goals'), navItemsEn[4]?.text);

  // Check section #importer exists
  const importerAnchorExists = await evaluate(`Boolean(document.getElementById('importer'))`);
  testCheck('Actual importer section has id="importer"', importerAnchorExists);

  // Test clicking Step 3 switches to import tab
  const clickStep3Result = await evaluate(`
    (() => {
      const step3 = document.querySelector('a[href="#importer"]');
      if (step3) step3.click();
      const tabViewImport = document.getElementById('tab-view-import');
      return {
        tabViewImportVisible: tabViewImport && !tabViewImport.classList.contains('hidden'),
        activeBtn: document.querySelector('.tab-btn.active')?.getAttribute('data-tab'),
        step3Classes: step3?.className
      };
    })()
  `);
  console.log('DEBUG clickStep3Result:', JSON.stringify(clickStep3Result));
  testCheck('Clicking Step 3 activates importer tab view', clickStep3Result.tabViewImportVisible && clickStep3Result.activeBtn === 'import');

  // Check Hindi navigation
  console.log('\n--- A2. Navigation Numbering & Anchors (Hindi /hi/) ---');
  await navigate(`http://localhost:${PORT}/hi/`);

  const navItemsHi = await evaluate(`
    Array.from(document.querySelectorAll('nav[aria-label="Main Navigation Tabs"] .tab-btn:not(.mobile-tab-knowledge):not(.capsule-tab-btn)')).map(el => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
      dataTab: el.getAttribute('data-tab')
    }))
  `);
  console.log('HI Nav items:', JSON.stringify(navItemsHi, null, 2));

  testCheck('Hindi nav has exactly 5 items', navItemsHi.length === 5);
  testCheck('Hindi Item 1 starts with "1."', navItemsHi[0]?.text.includes('1.'));
  testCheck('Hindi Item 2 starts with "2."', navItemsHi[1]?.text.includes('2.'));
  testCheck('Hindi Item 3 is "3. स्टेटमेंट आयातक"', navItemsHi[2]?.text.includes('3. ') && navItemsHi[2]?.text.includes('आयातक'), navItemsHi[2]?.text);
  testCheck('Hindi Item 3 points to #importer', navItemsHi[2]?.href === '#importer');
  testCheck('Hindi Item 4 starts with "4."', navItemsHi[3]?.text.includes('4.'));
  testCheck('Hindi Item 5 starts with "5."', navItemsHi[4]?.text.includes('5.'));

  // ---------------------------------------------------------------------------
  // PART 2 / 4B: Reconcile Template Library Counts
  // ---------------------------------------------------------------------------
  console.log('\n--- B. Template Library Counts Verification ---');
  await navigate(`http://localhost:${PORT}/`);

  // Switch to templates tab
  await evaluate(`
    const tmplTabBtn = document.querySelector('button[data-tab="templates"]');
    if (tmplTabBtn) tmplTabBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 400));

  const tmplCounts = await evaluate(`
    (() => {
      const allFilterBadge = document.querySelector('button[data-category-filter="all"] span.font-mono')?.textContent?.trim();
      const excelBadge = document.querySelector('#btn-format-excel span.font-mono')?.textContent?.trim();
      const sheetsBadge = document.querySelector('#btn-format-sheets span.font-mono')?.textContent?.trim();

      const excelCards = document.querySelectorAll('#panel-templates-excel .template-card-item').length;
      const sheetsCards = document.querySelectorAll('#panel-templates-sheets .template-card-item').length;

      // Check broken links in sheets panel
      const sheetsLinks = Array.from(document.querySelectorAll('#panel-templates-sheets a.btn-open-google-sheets')).map(a => a.href);
      const invalidSheetsLinks = sheetsLinks.filter(href => !href.includes('docs.google.com') && !href.includes('drive.google.com'));

      return {
        allFilterBadge: Number(allFilterBadge),
        excelBadge: Number(excelBadge),
        sheetsBadge: Number(sheetsBadge),
        excelCards,
        sheetsCards,
        invalidSheetsLinksCount: invalidSheetsLinks.length
      };
    })()
  `);
  console.log('Homepage template counts:', JSON.stringify(tmplCounts, null, 2));

  testCheck('All count badge equals unique rendered Excel cards', tmplCounts.allFilterBadge === tmplCounts.excelCards, `${tmplCounts.allFilterBadge} vs ${tmplCounts.excelCards}`);
  testCheck('Excel badge equals actual rendered Excel cards', tmplCounts.excelBadge === tmplCounts.excelCards, `${tmplCounts.excelBadge} vs ${tmplCounts.excelCards}`);
  testCheck('Sheets badge equals actual rendered Sheets cards', tmplCounts.sheetsBadge === tmplCounts.sheetsCards, `${tmplCounts.sheetsBadge} vs ${tmplCounts.sheetsCards}`);
  testCheck('Zero broken/internal links in Google Sheets panel', tmplCounts.invalidSheetsLinksCount === 0);

  // Check /templates/ library landing page
  await navigate(`http://localhost:${PORT}/templates/`);
  const libCounts = await evaluate(`
    (() => {
      const countSpan = document.getElementById('template-count')?.textContent?.trim();
      const title = document.title;
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      const renderedCards = document.querySelectorAll('.template-card').length;
      return {
        countSpan: Number(countSpan),
        renderedCards,
        titleHasCount: title.includes(String(countSpan)),
        metaDescHasCount: metaDesc && metaDesc.includes(String(countSpan))
      };
    })()
  `);
  console.log('/templates/ landing page counts:', JSON.stringify(libCounts, null, 2));

  testCheck('/templates/ rendered cards equals count span', libCounts.renderedCards === libCounts.countSpan, `${libCounts.renderedCards} cards`);
  testCheck('Homepage and /templates/ have consistent total count (20)', tmplCounts.allFilterBadge === libCounts.renderedCards, `${tmplCounts.allFilterBadge} vs ${libCounts.renderedCards}`);
  testCheck('/templates/ title and meta description match actual count', libCounts.titleHasCount && libCounts.metaDescHasCount);

  // ---------------------------------------------------------------------------
  // PART 3 / 4C: Deduplicate Debt Planner Micro-Copy
  // ---------------------------------------------------------------------------
  console.log('\n--- C. Debt Planner Micro-Copy Verification (English /) ---');
  await navigate(`http://localhost:${PORT}/`);

  // Switch to debt tab
  await evaluate(`
    const debtTabBtn = document.querySelector('button[data-tab="debt"]');
    if (debtTabBtn) debtTabBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 400));

  const debtCopyEn = await evaluate(`
    (() => {
      const block1Sub = document.querySelector('#tab-view-debt .border-b p')?.textContent?.trim();
      const block2Sub = document.querySelector('#form-add-debt')?.parentElement?.querySelector('.border-b p')?.textContent?.trim();
      const block3Sub = document.getElementById('active-strategy-pill')?.parentElement?.querySelector('p')?.textContent?.trim();
      return { block1Sub, block2Sub, block3Sub };
    })()
  `);
  console.log('Debt Copy EN:\n', JSON.stringify(debtCopyEn, null, 2));

  testCheck('Block 1 retains general optimization description', debtCopyEn.block1Sub && debtCopyEn.block1Sub.includes('debt-free journey'));
  testCheck('Block 2 displays new loan-entry description', debtCopyEn.block2Sub === 'Enter your loan balance, interest rate (APR), and minimum monthly EMI to include it in your payoff simulation.');
  testCheck('Block 3 displays new active-ledger description', debtCopyEn.block3Sub === 'Review your active balances, compare total interest costs, and track your projected debt-free date across each payoff strategy.');
  testCheck('All three Debt Planner descriptions are distinct', debtCopyEn.block1Sub !== debtCopyEn.block2Sub && debtCopyEn.block2Sub !== debtCopyEn.block3Sub && debtCopyEn.block1Sub !== debtCopyEn.block3Sub);

  // Test Hindi Debt Copy
  console.log('\n--- C2. Debt Planner Micro-Copy Verification (Hindi /hi/) ---');
  await navigate(`http://localhost:${PORT}/hi/`);

  await evaluate(`
    const debtTabBtn = document.querySelector('button[data-tab="debt"]');
    if (debtTabBtn) debtTabBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 400));

  const debtCopyHi = await evaluate(`
    (() => {
      const block1Sub = document.querySelector('#tab-view-debt .border-b p')?.textContent?.trim();
      const block2Sub = document.querySelector('#form-add-debt')?.parentElement?.querySelector('.border-b p')?.textContent?.trim();
      const block3Sub = document.getElementById('active-strategy-pill')?.parentElement?.querySelector('p')?.textContent?.trim();
      return { block1Sub, block2Sub, block3Sub };
    })()
  `);
  console.log('Debt Copy HI:\n', JSON.stringify(debtCopyHi, null, 2));

  testCheck('Hindi Block 2 displays new loan-entry copy', debtCopyHi.block2Sub === 'अपनी ऋण राशि, ब्याज दर (APR), और न्यूनतम मासिक EMI दर्ज करें ताकि इसे आपके भुगतान सिमुलेशन में शामिल किया जा सके।');
  testCheck('Hindi Block 3 displays new active-ledger copy', debtCopyHi.block3Sub === 'अपने सक्रिय ऋण शेष की समीक्षा करें, कुल ब्याज लागत की तुलना करें, और प्रत्येक रणनीति के अनुसार अपनी ऋण-मुक्त तिथि ट्रैक करें।');
  testCheck('Hindi descriptions are distinct and non-empty', debtCopyHi.block1Sub !== debtCopyHi.block2Sub && debtCopyHi.block2Sub !== debtCopyHi.block3Sub);

  // ---------------------------------------------------------------------------
  // Verify all 8 locales have matching keys
  // ---------------------------------------------------------------------------
  console.log('\n--- C3. Checking all 8 locale dictionaries for matching keys ---');
  const locales = ['en', 'hi', 'es', 'de', 'fr', 'pt', 'ja', 'ko'];
  let allKeysPresent = true;
  for (const loc of locales) {
    const raw = fs.readFileSync(`src/locales/${loc}.ts`, 'utf8');
    const hasAdd = raw.includes('addDebtSubtitle:');
    const hasList = raw.includes('debtListSubtitle:');
    const hasTab3 = raw.includes('import:') && raw.includes('3. ');
    const hasTab4 = raw.includes('debt:') && raw.includes('4. ');
    const hasTab5 = raw.includes('budget:') && raw.includes('5. ');
    if (!hasAdd || !hasList || !hasTab3 || !hasTab4 || !hasTab5) {
      allKeysPresent = false;
      console.error(`Locale ${loc} is missing required keys`);
    }
  }
  testCheck('All 8 locales contain matching addDebtSubtitle, debtListSubtitle and 1..5 tab numbers', allKeysPresent);

  // Cleanup
  ws.close();
  proc.kill();
  server.close();
  if (fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  console.log('\n=================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  server.close();
  process.exit(1);
});
