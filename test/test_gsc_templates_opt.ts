import fs from 'node:fs';
import path from 'node:path';

console.log('=== VERIFYING GSC OPTIMIZATIONS, FRENCH PAGE, APP CTAS, & NEW TEMPLATES ===\n');

const distDir = path.resolve('dist');

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

// ==========================================
// PART 1: A) /templates/debt-snowball/
// ==========================================
console.log('--- PART 1A: Verifying /templates/debt-snowball/ ---');
const debtSnowballHtml = fs.readFileSync(path.join(distDir, 'templates/debt-snowball/index.html'), 'utf-8');

assert(
  debtSnowballHtml.includes('<title>Free Debt Snowball Spreadsheet (Excel &amp; Google Sheets) | Free Expense Tracker</title>') ||
  debtSnowballHtml.includes('<title>Free Debt Snowball Spreadsheet (Excel & Google Sheets) | Free Expense Tracker</title>'),
  'debt-snowball has correct title tag'
);

assert(
  debtSnowballHtml.includes('>Free Debt Snowball Spreadsheet</h1>'),
  'debt-snowball has exact H1 "Free Debt Snowball Spreadsheet"'
);

// Check meta description
const descMatch1 = debtSnowballHtml.match(/<meta name="description" content="([^"]+)"/);
assert(Boolean(descMatch1), 'debt-snowball meta description exists');
if (descMatch1) {
  const desc = descMatch1[1];
  assert(desc.length < 155, `Meta description is under 155 chars (${desc.length} chars)`);
  assert(desc.toLowerCase().includes('free'), 'Meta description mentions free');
  assert(desc.includes('Excel'), 'Meta description mentions Excel');
  assert(desc.includes('Google Sheets'), 'Meta description mentions Google Sheets');
  assert(desc.toLowerCase().includes('no sign-up') || desc.toLowerCase().includes('no signup'), 'Meta description mentions no sign-up');
}

// Check content below download
assert(debtSnowballHtml.includes('What the Debt Snowball Method Is'), 'Includes what the debt snowball method is');
assert(debtSnowballHtml.includes('Medical Bill') && debtSnowballHtml.includes('Credit Card') && debtSnowballHtml.includes('Auto Loan'), 'Includes 3-debt worked example');
assert(debtSnowballHtml.includes('/templates/debt-avalanche/'), 'Links to /templates/debt-avalanche/ with trailing slash');
assert(debtSnowballHtml.includes('How to Use This Spreadsheet in 4 Steps') || debtSnowballHtml.includes('How to Use This Spreadsheet'), 'Includes 4-step instructions');

// Check FAQ & JSON-LD
assert(debtSnowballHtml.includes('FAQPage'), 'FAQPage schema is present');
assert(debtSnowballHtml.includes('What is the debt snowball method and why does it work?'), 'FAQ question 1 is present');
assert(debtSnowballHtml.includes('What is the difference between the debt snowball and debt avalanche?'), 'FAQ question 2 is present');
assert(debtSnowballHtml.includes('Can I use this debt snowball spreadsheet in Google Sheets and Microsoft Excel?'), 'FAQ question 3 is present');
assert(debtSnowballHtml.includes('What happens to my payment when a debt is fully paid off?'), 'FAQ question 4 is present');

// Check Interactive Calculator
assert(debtSnowballHtml.includes('interactive-snowball-calculator'), 'Interactive Debt Snowball Calculator is embedded on /templates/debt-snowball/');

// ==========================================
// PART 1: B) /templates/student-loan-planner/
// ==========================================
console.log('\n--- PART 1B: Verifying /templates/student-loan-planner/ ---');
const studentLoanHtml = fs.readFileSync(path.join(distDir, 'templates/student-loan-planner/index.html'), 'utf-8');

assert(
  studentLoanHtml.includes('<title>Free Student Loan Planner (Spreadsheet + Calculator) | Free Expense Tracker</title>'),
  'student-loan-planner has correct title tag'
);

assert(
  studentLoanHtml.includes('>Free Student Loan Planner</h1>'),
  'student-loan-planner has exact H1 "Free Student Loan Planner"'
);

const descMatch2 = studentLoanHtml.match(/<meta name="description" content="([^"]+)"/);
assert(Boolean(descMatch2), 'student-loan-planner meta description exists');
if (descMatch2) {
  const desc = descMatch2[1];
  assert(desc.length < 155, `Meta description is under 155 chars (${desc.length} chars)`);
}

assert(studentLoanHtml.includes('Student Loan Payoff Timelines'), 'Covers student loan payoff timelines');
assert(studentLoanHtml.includes('The Power of Extra Principal Payments'), 'Covers extra principal payments');
assert(studentLoanHtml.includes('Student Loan Refinancing Basics'), 'Covers refinancing basics');

assert(studentLoanHtml.includes('How does making extra payments change my student loan payoff timeline?'), 'FAQ question 1 is present');
assert(studentLoanHtml.includes('Should I pay off federal student loans early or pursue forgiveness?'), 'FAQ question 2 is present');
assert(studentLoanHtml.includes('When does refinancing student loans make financial sense?'), 'FAQ question 3 is present');
assert(studentLoanHtml.includes('Can I use this student loan planner for multiple student loans?'), 'FAQ question 4 is present');
assert(studentLoanHtml.includes('FAQPage'), 'FAQPage schema is present on student loan planner');

// ==========================================
// PART 1: C) Homepage "free monthly expense tracker"
// ==========================================
console.log('\n--- PART 1C: Verifying Homepage Target Keyword ---');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

assert(indexHtml.includes('<span>Free Expense Tracker</span></h1>'), 'Homepage H1 is unchanged ("Free Expense Tracker")');
assert(
  indexHtml.includes('free monthly expense tracker'),
  'Homepage contains phrase "free monthly expense tracker"'
);
assert(
  indexHtml.includes('Complete Guide to Using a Free Monthly Expense Tracker for Personal Finance'),
  'Phrase "free monthly expense tracker" is worked naturally into H2'
);

// ==========================================
// PART 2: French Page /fr/
// ==========================================
console.log('\n--- PART 2: Verifying French Page (/fr/) ---');
const frHtml = fs.readFileSync(path.join(distDir, 'fr/index.html'), 'utf-8');

assert(
  frHtml.includes('<title>Tracker de dépenses gratuit – Suivi de budget sans inscription</title>') ||
  frHtml.includes('Tracker de dépenses gratuit – Suivi de budget sans inscription'),
  '/fr/ title tag is exact'
);

assert(
  frHtml.includes('<span>Tracker de dépenses gratuit</span></h1>'),
  '/fr/ H1 is exact "Tracker de dépenses gratuit"'
);

const descMatchFr = frHtml.match(/<meta name="description" content="([^"]+)"/);
assert(Boolean(descMatchFr), '/fr/ meta description exists');
if (descMatchFr) {
  const desc = descMatchFr[1];
  assert(desc.toLowerCase().includes('gratuit'), 'French meta description mentions gratuit');
  assert(desc.toLowerCase().includes('sans inscription'), 'French meta description mentions sans inscription');
  assert(desc.toLowerCase().includes('données privées'), 'French meta description mentions données privées');
}

// Verify hreflang fr on / and /fr/
assert(indexHtml.includes('hreflang="fr" href="https://freexpensetracker.com/fr/"'), 'Homepage has hreflang fr pointing to /fr/');
assert(frHtml.includes('hreflang="fr" href="https://freexpensetracker.com/fr/"'), '/fr/ has hreflang fr pointing to /fr/');

// ==========================================
// PART 3: Template to App CTAs & Query Handling
// ==========================================
console.log('\n--- PART 3: Verifying App CTAs on Templates & Query Handling ---');

const templateSlugs = [
  'paycheck-budget',
  'debt-snowball',
  'debt-avalanche',
  'debt-to-income-calculator',
  'student-loan-planner',
  'emergency-fund-planner',
  'monthly-bill-tracker'
];

for (const slug of templateSlugs) {
  const tHtml = fs.readFileSync(path.join(distDir, `templates/${slug}/index.html`), 'utf-8');
  assert(
    tHtml.includes('Prefer not to use a spreadsheet?'),
    `[${slug}] contains "Prefer not to use a spreadsheet?"`
  );
  assert(
    tHtml.includes('Track this free in your browser'),
    `[${slug}] contains "Track this free in your browser"`
  );
  assert(
    tHtml.includes('template-to-app-btn'),
    `[${slug}] contains template-to-app-btn class`
  );
  assert(
    tHtml.includes('template_to_app'),
    `[${slug}] has template_to_app event tracking`
  );
}

// Check specific query params
const emergencyHtml = fs.readFileSync(path.join(distDir, 'templates/emergency-fund-planner/index.html'), 'utf-8');
assert(emergencyHtml.includes('/?tab=goals&amp;preset=emergency-fund') || emergencyHtml.includes('/?tab=goals&preset=emergency-fund'), 'emergency-fund links to /?tab=goals&preset=emergency-fund');

const paycheckHtml = fs.readFileSync(path.join(distDir, 'templates/paycheck-budget/index.html'), 'utf-8');
assert(paycheckHtml.includes('/?tab=budget&amp;preset=paycheck') || paycheckHtml.includes('/?tab=budget&preset=paycheck'), 'paycheck-budget links to /?tab=budget&preset=paycheck');

const snowballHtml = fs.readFileSync(path.join(distDir, 'templates/debt-snowball/index.html'), 'utf-8');
assert(snowballHtml.includes('/?tab=debt&amp;preset=snowball') || snowballHtml.includes('/?tab=debt&preset=snowball'), 'debt-snowball links to /?tab=debt&preset=snowball');

const studentHtml = fs.readFileSync(path.join(distDir, 'templates/student-loan-planner/index.html'), 'utf-8');
assert(studentHtml.includes('/?tab=debt&amp;preset=student-loan') || studentHtml.includes('/?tab=debt&preset=student-loan'), 'student-loan links to /?tab=debt&preset=student-loan');

// Check compiled JS bundle for query parameter handling
const astroDir = path.join(distDir, '_astro');
const mainAppJsFile = fs.readdirSync(astroDir).find(f => f.startsWith('MainApp') && f.endsWith('.js'))!;
const mainAppJs = fs.readFileSync(path.join(astroDir, mainAppJsFile), 'utf-8');
assert(
  mainAppJs.includes('preset') && mainAppJs.includes('URLSearchParams') && mainAppJs.includes('btn-strat-snowball'),
  'MainApp JS bundle includes URLSearchParams, preset, and tab routing logic'
);

// ==========================================
// PART 4: New Template /templates/monthly-bill-tracker/ & Sitemap
// ==========================================
console.log('\n--- PART 4: Verifying /templates/monthly-bill-tracker/ & Sitemap ---');

assert(fs.existsSync(path.join(distDir, 'templates/monthly-bill-tracker/index.html')), 'Route /templates/monthly-bill-tracker/ exists in build');
assert(fs.existsSync(path.join(distDir, 'templates/16_US_Monthly_Bill_Tracker.xlsx')), 'Excel file 16_US_Monthly_Bill_Tracker.xlsx exists in build');

const billHtml = fs.readFileSync(path.join(distDir, 'templates/monthly-bill-tracker/index.html'), 'utf-8');
assert(billHtml.includes('>Free Monthly Bill Tracker Spreadsheet</h1>'), 'monthly-bill-tracker has correct H1');
assert(billHtml.includes('/templates/paycheck-budget/'), 'monthly-bill-tracker links to /templates/paycheck-budget/');
assert(billHtml.includes('/templates/subscription-audit/'), 'monthly-bill-tracker links to /templates/subscription-audit/');

// Check /templates/ index page
const templatesIndexHtml = fs.readFileSync(path.join(distDir, 'templates/index.html'), 'utf-8');
assert(templatesIndexHtml.includes('/templates/monthly-bill-tracker/'), 'Templates hub page links to /templates/monthly-bill-tracker/');

// Check Sitemap
const sitemapContent = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf-8');
assert(sitemapContent.includes('<loc>https://freexpensetracker.com/fr/</loc>'), 'Sitemap includes /fr/');
assert(sitemapContent.includes('<loc>https://freexpensetracker.com/templates/monthly-bill-tracker/</loc>'), 'Sitemap includes /templates/monthly-bill-tracker/');
assert(sitemapContent.includes('<loc>https://freexpensetracker.com/templates/debt-snowball/</loc>'), 'Sitemap includes /templates/debt-snowball/');

// Validate XML basic format
assert(sitemapContent.trim().startsWith('<?xml') && sitemapContent.trim().endsWith('</urlset>'), 'Sitemap has valid XML root elements');

// Validate all URLs in sitemap have trailing slashes
const locMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) || [];
assert(locMatches.length > 25, `Sitemap has ${locMatches.length} URLs`);
for (const locTag of locMatches) {
  const url = locTag.replace('<loc>', '').replace('</loc>', '');
  assert(url.endsWith('/'), `Sitemap URL has trailing slash: ${url}`);
}

// ==========================================
// PART 5: On-Page SEO for /templates/52-week-savings-challenge/
// ==========================================
console.log('\n--- PART 5: Verifying On-Page SEO for /templates/52-week-savings-challenge/ ---');

assert(fs.existsSync(path.join(distDir, 'templates/52-week-savings-challenge/index.html')), 'Route /templates/52-week-savings-challenge/ exists in build');
assert(fs.existsSync(path.join(distDir, 'templates/17_US_52_Week_Savings_Challenge.xlsx')), 'Excel workbook 17_US_52_Week_Savings_Challenge.xlsx exists in build');
assert(fs.existsSync(path.join(distDir, 'templates/52-week-savings-challenge-preview.svg')), 'Preview SVG image exists in build');

const savingsHtml = fs.readFileSync(path.join(distDir, 'templates/52-week-savings-challenge/index.html'), 'utf-8');

assert(
  savingsHtml.includes('<title>Free 52-Week Savings Challenge (Excel, Google Sheets &amp; Printable) | Free Expense Tracker</title>') ||
  savingsHtml.includes('<title>Free 52-Week Savings Challenge (Excel, Google Sheets & Printable) | Free Expense Tracker</title>'),
  '52-week-savings-challenge has exact Title tag'
);

// Check meta description
const descMatch52 = savingsHtml.match(/<meta name="description" content="([^"]+)"/);
assert(Boolean(descMatch52), '52-week-savings-challenge meta description exists');
if (descMatch52) {
  const desc = descMatch52[1];
  assert(desc.length < 155, `52-week meta description is under 155 chars (${desc.length} chars)`);
  assert(desc.toLowerCase().includes('free'), '52-week meta description mentions free');
  assert(desc.includes('Excel'), '52-week meta description mentions Excel');
  assert(desc.includes('Google Sheets'), '52-week meta description mentions Google Sheets');
  assert(desc.toLowerCase().includes('printable'), '52-week meta description mentions printable');
  assert(desc.includes('$1,378'), '52-week meta description mentions $1,378');
  assert(desc.toLowerCase().includes('no sign-up') || desc.toLowerCase().includes('no signup'), '52-week meta description mentions no sign-up');
}

// Check single H1
const h1Matches = savingsHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g) || [];
assert(h1Matches.length === 1, `52-week-savings-challenge has exactly 1 H1 (found ${h1Matches.length})`);
assert(savingsHtml.includes('>Free 52-Week Savings Challenge</h1>'), 'H1 is "Free 52-Week Savings Challenge"');

// Check intro paragraph
const introMatch = savingsHtml.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/);
assert(Boolean(introMatch), 'Intro paragraph directly follows H1');
if (introMatch) {
  const introText = introMatch[1].trim();
  const sentences = introText.split(/(?<=[.!?])\s+/).filter(Boolean);
  assert(sentences.length === 2, `Intro has exactly 2 sentences (found ${sentences.length})`);
  assert(sentences[0].toLowerCase().includes('52-week savings challenge'), 'First sentence includes "52-week savings challenge"');
  assert(introText.includes('$1,378') && introText.toLowerCase().includes('year'), 'Opening 2 sentences explain what it is and that it saves $1,378 in a year');
}

// Check exact H2 sequence
const h2Matches = Array.from(savingsHtml.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)).map(m =>
  m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
);
const expectedH2s = [
  'How the 52-Week Savings Challenge Works',
  '52-Week Savings Challenge Chart',
  'Reverse 52-Week Challenge',
  'Biweekly Version (Paid Every Two Weeks)',
  'Tips to Finish the Challenge',
  'FAQ'
];
assert(
  JSON.stringify(h2Matches) === JSON.stringify(expectedH2s),
  `H2s match exact required order (found: ${JSON.stringify(h2Matches)})`
);

// Check full 52-week static HTML table
assert(savingsHtml.includes('<table id="challenge-chart-table"'), 'Static HTML table #challenge-chart-table is present');
const tbodyMatch = savingsHtml.match(/<tbody id="challenge-schedule-body"[^>]*>([\s\S]*?)<\/tbody>/);
assert(Boolean(tbodyMatch), '#challenge-schedule-body exists in static HTML');
if (tbodyMatch) {
  const trMatches = tbodyMatch[1].match(/<tr\b/g) || [];
  assert(trMatches.length === 52, `Static HTML table contains all 52 weeks (found ${trMatches.length} rows)`);
  assert(tbodyMatch[1].includes('Week 1') && tbodyMatch[1].includes('$1.00'), 'Static table includes Week 1 row ($1.00)');
  assert(tbodyMatch[1].includes('Week 52') && tbodyMatch[1].includes('$52.00') && tbodyMatch[1].includes('$1,378.00'), 'Static table includes Week 52 row ($52.00 / $1,378.00)');
}

// Check canonical, OG, Twitter tags
assert(
  savingsHtml.includes('<link rel="canonical" href="https://freexpensetracker.com/templates/52-week-savings-challenge/">') ||
  savingsHtml.includes('<link rel="canonical" href="https://freexpensetracker.com/templates/52-week-savings-challenge/" />'),
  'Canonical URL points to /templates/52-week-savings-challenge/ with trailing slash'
);
assert(savingsHtml.includes('property="og:title"'), 'og:title tag present');
assert(savingsHtml.includes('property="og:description"'), 'og:description tag present');
assert(savingsHtml.includes('property="og:url" content="https://freexpensetracker.com/templates/52-week-savings-challenge/"'), 'og:url matches canonical');
assert(savingsHtml.includes('property="og:image" content="https://freexpensetracker.com/web-app-manifest-512x512.png"'), 'og:image uses site image system');
assert(savingsHtml.includes('name="twitter:card"'), 'twitter:card present');
assert(savingsHtml.includes('name="twitter:title"'), 'twitter:title present');
assert(savingsHtml.includes('name="twitter:description"'), 'twitter:description present');
assert(savingsHtml.includes('name="twitter:image"'), 'twitter:image present');

// Check preview image attributes
const imgMatch = savingsHtml.match(/<img\b[^>]*src="\/templates\/52-week-savings-challenge-preview\.svg"[^>]*>/);
assert(Boolean(imgMatch), 'Preview image tag is present');
if (imgMatch) {
  const imgTag = imgMatch[0];
  assert(imgTag.includes('alt="52-week savings challenge spreadsheet in Excel"'), 'Image has descriptive alt text');
  assert(imgTag.includes('width="800"') && imgTag.includes('height="420"'), 'Image sets explicit width and height');
  assert(imgTag.includes('loading="lazy"'), 'Image uses loading="lazy" below the fold');
}

// Check BreadcrumbList JSON-LD & visible breadcrumbs
assert(savingsHtml.includes('aria-label="Breadcrumb"'), 'Visible breadcrumb nav is present');
assert(savingsHtml.includes('"@type":"BreadcrumbList"'), 'BreadcrumbList schema present');
assert(
  savingsHtml.includes('"name":"Home"') &&
  savingsHtml.includes('"name":"Templates"') &&
  savingsHtml.includes('"name":"52-Week Savings Challenge"'),
  'BreadcrumbList schema includes Home > Templates > 52-Week Savings Challenge'
);
assert(savingsHtml.includes('"@type":"FAQPage"'), 'FAQPage JSON-LD schema is present');

// Check internal links & descriptive anchor text
assert(savingsHtml.includes('>sinking fund planner</a>'), 'Internal link uses descriptive anchor text "sinking fund planner"');
assert(savingsHtml.includes('>emergency fund planner</a>'), 'Internal link uses descriptive anchor text "emergency fund planner"');
assert(!savingsHtml.toLowerCase().includes('>click here</a>'), 'Never uses "click here" anchor text');

// Check Homepage link & download button text
assert(indexHtml.includes('/templates/52-week-savings-challenge/'), 'Homepage templates section links to /templates/52-week-savings-challenge/');
assert(indexHtml.includes('52-Week Savings Challenge</a>'), 'Homepage templates section uses descriptive anchor text');
assert(savingsHtml.includes('>Download the 52-Week Savings Challenge (Excel)<'), 'Download button text matches "Download the 52-Week Savings Challenge (Excel)"');
assert(savingsHtml.includes('/?tab=goals&amp;preset=savings-challenge') || savingsHtml.includes('/?tab=goals&preset=savings-challenge'), 'App CTA links to /?tab=goals&preset=savings-challenge');
assert(sitemapContent.includes('<loc>https://freexpensetracker.com/templates/52-week-savings-challenge/</loc>'), 'Sitemap includes /templates/52-week-savings-challenge/');

console.log(`\n========================================================`);
console.log(`ALL VERIFICATION TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
console.log(`========================================================\n`);
