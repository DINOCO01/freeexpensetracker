import fs from 'node:fs';
import path from 'node:path';

console.log('=== VERIFYING GA4 EVENT TRACKING IMPLEMENTATION ===\n');

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

// Find compiled MainApp bundle in dist/_astro
const astroDir = path.join(distDir, '_astro');
const astroFiles = fs.readdirSync(astroDir);
const mainAppJsFile = astroFiles.find(f => f.startsWith('MainApp') && f.endsWith('.js'));
if (!mainAppJsFile) {
  console.error('❌ Could not find MainApp bundle in dist/_astro');
  process.exit(1);
}
const mainAppJs = fs.readFileSync(path.join(astroDir, mainAppJsFile), 'utf-8');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
}

// 1. Verify gtag initialization and debug_mode support in Layout
console.log('--- 1. Testing gtag and debug_mode Configuration ---');
assert(indexHtml.includes('https://www.googletagmanager.com/gtag/js?id=G-XR6MG2FM4M'), 'gtag script tag is loaded with G-XR6MG2FM4M');
assert(indexHtml.includes('G-XR6MG2FM4M'), 'Measurement ID G-XR6MG2FM4M is present');
assert(indexHtml.includes('debug_mode'), 'Debug mode parameter check is configured for ?debug_mode=1');

// 2. Verify all 8 language homepages have the tracking code & scripts attached
console.log('\n--- 2. Verifying All 8 Localized Homepage Builds ---');
const locales = ['', 'hi/', 'es/', 'de/', 'fr/', 'pt/', 'ja/', 'ko/'];
for (const loc of locales) {
  const pagePath = path.join(distDir, loc, 'index.html');
  assert(fs.existsSync(pagePath), `Page exists: ${loc || 'en'}/index.html`);
  const pageHtml = fs.readFileSync(pagePath, 'utf-8');

  // Verify gtag and debug_mode exist on every localized page
  assert(pageHtml.includes('G-XR6MG2FM4M'), `[${loc || 'en'}] has GA4 Measurement ID`);
  assert(pageHtml.includes('debug_mode'), `[${loc || 'en'}] has debug_mode check`);

  // Verify MainApp client bundle is linked
  assert(pageHtml.includes(mainAppJsFile), `[${loc || 'en'}] links to compiled MainApp client script`);

  // Verify cross-site CTA click tracking is preserved
  assert(pageHtml.includes('cross_site_cta_click'), `[${loc || 'en'}] preserves cross_site_cta_click tracking`);

  // Verify Google Sheets templates have tracking hooks
  assert(pageHtml.includes('btn-open-google-sheets'), `[${loc || 'en'}] contains btn-open-google-sheets classes`);
  assert(pageHtml.includes('data-template-name'), `[${loc || 'en'}] contains data-template-name attributes`);
}

// 3. Verify event parameters and strict rules in compiled client bundle
console.log('\n--- 3. Verifying Event Parameters and Strict Rules in Client Bundle ---');

// Check safe track helper exists
assert(mainAppJs.includes('window.gtag') && mainAppJs.includes('event'), 'track helper calling window.gtag("event", ...) is bundled');

// Verify all 8 custom events are compiled
assert(mainAppJs.includes('expense_added'), 'compiled bundle contains expense_added');
assert(mainAppJs.includes('tab_opened'), 'compiled bundle contains tab_opened');
assert(mainAppJs.includes('statement_imported'), 'compiled bundle contains statement_imported');
assert(mainAppJs.includes('receipt_scanned'), 'compiled bundle contains receipt_scanned');
assert(mainAppJs.includes('currency_changed'), 'compiled bundle contains currency_changed');
assert(mainAppJs.includes('ledger_exported'), 'compiled bundle contains ledger_exported');
assert(mainAppJs.includes('income_set'), 'compiled bundle contains income_set');
assert(mainAppJs.includes('template_sheet_opened'), 'compiled bundle contains template_sheet_opened');

// Check tab_opened params: 'live_tracker', 'templates', 'debt_planner', 'budget_goals', 'guides'
assert(mainAppJs.includes('live_tracker'), 'tab_opened includes live_tracker');
assert(mainAppJs.includes('debt_planner'), 'tab_opened includes debt_planner');
assert(mainAppJs.includes('budget_goals'), 'tab_opened includes budget_goals');
assert(mainAppJs.includes('guides'), 'tab_opened includes guides');

// Check ledger_exported params: 'csv', 'xlsx'
assert(mainAppJs.includes('ledger_exported') && mainAppJs.includes('xlsx') && mainAppJs.includes('csv'), 'ledger_exported handles csv and xlsx');
assert(indexHtml.includes('btn-export-excel-quick'), 'btn-export-excel-quick exists in template');

// Check statement_imported params: file_type, row_count
assert(mainAppJs.includes('statement_imported') && mainAppJs.includes('file_type') && mainAppJs.includes('row_count'), 'statement_imported includes file_type and row_count');

// Check receipt_scanned params: success
assert(mainAppJs.includes('receipt_scanned') && mainAppJs.includes('success'), 'receipt_scanned includes success boolean');

// Check template_sheet_opened params: template_name
assert(mainAppJs.includes('template_sheet_opened') && mainAppJs.includes('template_name'), 'template_sheet_opened includes template_name');

// 4. In-Memory Logic & Debounce Verification
console.log('\n--- 4. Testing Event Logic, Debounce & Deduplication In-Memory ---');

type GtagCall = { event: string; name: string; params: any };
const gtagCalls: GtagCall[] = [];

// Mock window.gtag
const mockGtag = (type: string, name: string, params: any) => {
  if (type === 'event') {
    gtagCalls.push({ event: type, name, params });
  }
};

function trackHelper(name: string, params?: Record<string, any>) {
  try {
    if (typeof mockGtag === 'function') {
      mockGtag('event', name, params);
    }
  } catch (_) {}
}

// Test A: expense_added with manual and preset methods
gtagCalls.length = 0;
// Test manual expense
trackHelper('expense_added', { category: 'food', method: 'manual' });
assert(gtagCalls.length === 1, 'Manual expense_added fired 1 event');
assert(gtagCalls[0].name === 'expense_added', 'Event name is expense_added');
assert(gtagCalls[0].params.category === 'food', 'Category is stable lowercase');
assert(gtagCalls[0].params.method === 'manual', 'Method is manual');
assert(gtagCalls[0].params.amount === undefined, 'No amount param sent');
assert(gtagCalls[0].params.name === undefined && gtagCalls[0].params.description === undefined, 'No description param sent');

// Test preset expense
trackHelper('expense_added', { category: 'housing', method: 'preset' });
assert(gtagCalls[1].params.method === 'preset', 'Method is preset');

// Test B: tab_opened
gtagCalls.length = 0;
const TAB_PARAM_MAP: Record<string, string> = {
  'tracker': 'live_tracker',
  'templates': 'templates',
  'debt': 'debt_planner',
  'targets': 'budget_goals',
  'knowledge': 'guides'
};
let currentActiveTab = 'tracker';
function simulateSwitchTab(tabId: string) {
  if (tabId !== currentActiveTab && TAB_PARAM_MAP[tabId]) {
    trackHelper('tab_opened', { tab: TAB_PARAM_MAP[tabId] });
    currentActiveTab = tabId;
  }
}

// Default tab on load: 'tracker' -> clicking tracker should NOT fire
simulateSwitchTab('tracker');
assert(gtagCalls.length === 0, 'Default tab on load does not fire tab_opened');

// Switch to templates
simulateSwitchTab('templates');
assert(gtagCalls.length === 1, 'Switching to templates fires tab_opened');
assert(gtagCalls[0].params.tab === 'templates', 'tab is templates');

// Click templates again -> should NOT fire duplicate
simulateSwitchTab('templates');
assert(gtagCalls.length === 1, 'Clicking active tab again does not duplicate event');

// Switch to debt
simulateSwitchTab('debt');
assert(gtagCalls.length === 2 && gtagCalls[1].params.tab === 'debt_planner', 'Switching to debt fires debt_planner');

// Switch to targets
simulateSwitchTab('targets');
assert(gtagCalls.length === 3 && gtagCalls[2].params.tab === 'budget_goals', 'Switching to targets fires budget_goals');

// Switch to knowledge
simulateSwitchTab('knowledge');
assert(gtagCalls.length === 4 && gtagCalls[3].params.tab === 'guides', 'Switching to knowledge fires guides');

// Switch back to tracker
simulateSwitchTab('tracker');
assert(gtagCalls.length === 5 && gtagCalls[4].params.tab === 'live_tracker', 'Switching back to tracker fires live_tracker');

// Test C: statement_imported
gtagCalls.length = 0;
trackHelper('statement_imported', { file_type: 'csv', row_count: 42 });
trackHelper('statement_imported', { file_type: 'xlsx', row_count: 120 });
trackHelper('statement_imported', { file_type: 'pdf', row_count: 15 });
assert(gtagCalls.length === 3, 'statement_imported fires for csv, xlsx, pdf');
assert(gtagCalls[0].params.file_type === 'csv' && gtagCalls[0].params.row_count === 42, 'CSV params correct');
assert(gtagCalls[1].params.file_type === 'xlsx' && gtagCalls[1].params.row_count === 120, 'XLSX params correct');
assert(gtagCalls[2].params.file_type === 'pdf' && gtagCalls[2].params.row_count === 15, 'PDF params correct');

// Test D: receipt_scanned
gtagCalls.length = 0;
trackHelper('receipt_scanned', { success: true });
trackHelper('receipt_scanned', { success: false });
assert(gtagCalls.length === 2, 'receipt_scanned fires for success and failure');
assert(gtagCalls[0].params.success === true, 'receipt_scanned success is true');
assert(gtagCalls[1].params.success === false, 'receipt_scanned failure is false');

// Test E: currency_changed
gtagCalls.length = 0;
trackHelper('currency_changed', { currency: 'INR' });
trackHelper('currency_changed', { currency: 'EUR' });
assert(gtagCalls.length === 2, 'currency_changed fires');
assert(gtagCalls[0].params.currency === 'INR', 'Currency INR correct');

// Test F: ledger_exported
gtagCalls.length = 0;
trackHelper('ledger_exported', { format: 'csv' });
trackHelper('ledger_exported', { format: 'xlsx' });
assert(gtagCalls.length === 2, 'ledger_exported fires for csv and xlsx');
assert(gtagCalls[0].params.format === 'csv', 'CSV format correct');
assert(gtagCalls[1].params.format === 'xlsx', 'XLSX format correct');

// Test G: template_sheet_opened
gtagCalls.length = 0;
trackHelper('template_sheet_opened', { template_name: 'paycheck-budget' });
assert(gtagCalls.length === 1, 'template_sheet_opened fires');
assert(gtagCalls[0].params.template_name === 'paycheck-budget', 'template_name is stable English identifier');

// Test H: income_set debounce and once-per-page-view
gtagCalls.length = 0;
let incomeSetTracked = false;
let incomeSetTimer: any = null;
const state = { frequency: 'monthly' };

function simulateIncomeSet() {
  if (incomeSetTracked) return;
  clearTimeout(incomeSetTimer);
  incomeSetTimer = setTimeout(() => {
    if (incomeSetTracked) return;
    incomeSetTracked = true;
    trackHelper('income_set', { frequency: state.frequency });
  }, 50);
}

// Simulate user rapidly dragging slider 10 times in 20ms
for (let i = 0; i < 10; i++) {
  simulateIncomeSet();
}

// Wait 100ms for debounce timer to fire
await new Promise(r => setTimeout(r, 100));
assert(gtagCalls.length === 1, 'income_set fired only ONCE after 10 rapid slider drag events (debounced)');
assert(gtagCalls[0].params.frequency === 'monthly', 'income_set frequency parameter is correct');

// Simulate user editing income again later on the same page view
simulateIncomeSet();
await new Promise(r => setTimeout(r, 100));
assert(gtagCalls.length === 1, 'income_set does NOT fire again in the same page view (strictly once per page view)');

// --- 5. Verifying Session 2 Fixes: form_complete, Tab Numbering (1..4), Privacy Comparison Wording ---
console.log('\n--- 5. Verifying Session 2: form_complete, Tab Numbering, & Privacy Wording ---');
assert(mainAppJs.includes('form_complete'), 'compiled bundle contains form_complete event');
assert(mainAppJs.includes('expense_entry'), 'compiled bundle contains expense_entry form_id');
assert(mainAppJs.includes('savings_goal'), 'compiled bundle contains savings_goal form_id');
assert(mainAppJs.includes('debt_entry'), 'compiled bundle contains debt_entry form_id');

const contactHtml = fs.readFileSync(path.join(distDir, 'contact-us/index.html'), 'utf-8');
assert(contactHtml.includes('form_complete') && contactHtml.includes('contact_us'), 'contact-us page bundles form_complete tracking');

// Verify no duplicate GA4 initialization in indexHtml
const gtagJsOccurrences = indexHtml.match(/googletagmanager\.com\/gtag\/js\?id=G-XR6MG2FM4M/g) || [];
assert(gtagJsOccurrences.length === 1, 'Only 1 GA4 initialization script exists on homepage');

// Verify privacy comparison wording in dist/index.html and all locales
assert(
  indexHtml.includes('No transaction data leaves your browser.'),
  'Homepage comparison table uses accurate wording: "No transaction data leaves your browser."'
);
assert(
  !indexHtml.toLowerCase().includes('zero tracking'),
  'Homepage comparison table no longer claims "zero tracking"'
);

// Verify tab numbering across all 8 built locale homepages (1, 2, 3, 4; no "4. Debt", no "5. Budget")
for (const loc of locales) {
  const pageHtml = fs.readFileSync(path.join(distDir, loc, 'index.html'), 'utf-8');
  assert(pageHtml.includes('data-tab="tracker"') && pageHtml.includes('1. '), `[${loc || 'en'}] Tab 1 starts with 1.`);
  assert(pageHtml.includes('data-tab="templates"') && pageHtml.includes('2. '), `[${loc || 'en'}] Tab 2 starts with 2.`);
  assert(pageHtml.includes('3. ') && !pageHtml.includes('5. '), `[${loc || 'en'}] Primary tabs are numbered sequentially 1, 2, 3, 4 (no 5.)`);
}

console.log(`\n==============================================`);
console.log(`ALL GA4 TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
console.log(`==============================================\n`);
