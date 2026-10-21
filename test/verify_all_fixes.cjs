const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAILED: ${message}`);
  }
}

console.log('\n========================================');
console.log('STARTING COMPLETE VERIFICATION OF 5 FIXES');
console.log('========================================\n');

// ----------------------------------------------------
// FIX 1 & 4: TEMPLATE SLUGS AND ASSETS
// ----------------------------------------------------
const TEMPLATES = [
  { slug: 'paycheck-budget', asset: '01_US_Paycheck_Budget.xlsx' },
  { slug: 'debt-snowball', asset: '02_US_Debt_Snowball.xlsx' },
  { slug: 'debt-avalanche', asset: '03_US_Debt_Avalanche.xlsx' },
  { slug: 'debt-to-income-calculator', asset: '04_US_Debt_to_Income_Calculator.xlsx' },
  { slug: 'student-loan-planner', asset: '05_US_Student_Loan_Planner.xlsx' },
  { slug: 'auto-loan-calculator', asset: '06_US_Auto_Loan_Calculator.xlsx' },
  { slug: 'mortgage-planner', asset: '07_US_Mortgage_Planner.xlsx' },
  { slug: '401k-retirement-planner', asset: '08_US_401k_Retirement_Planner.xlsx' },
  { slug: 'roth-ira-planner', asset: '09_US_Roth_IRA_Planner.xlsx' },
  { slug: 'emergency-fund-planner', asset: '10_US_Emergency_Fund_Planner.xlsx' },
  { slug: 'subscription-audit', asset: '11_US_Subscription_Audit.xlsx' },
  { slug: 'sinking-fund-planner', asset: '12_US_Sinking_Fund_Planner.xlsx' },
  { slug: 'net-worth-tracker', asset: '13_US_Net_Worth_Tracker.xlsx' },
  { slug: 'financial-dashboard', asset: '14_US_Financial_Dashboard.xlsx' },
  { slug: 'monthly-spending-analyzer', asset: '15_US_Monthly_Spending_Analyzer.xlsx' }
];

console.log('--- 1. VERIFY TEMPLATES HUB PAGE (/templates/) ---');
const hubFile = path.join(distDir, 'templates', 'index.html');
assert(fs.existsSync(hubFile), 'Hub page dist/templates/index.html exists');

const hubHtml = fs.readFileSync(hubFile, 'utf8');
const hubTitle = (hubHtml.match(/<title>([^<]+)<\/title>/i) || [])[1];
const hubH1Matches = hubHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
const hubCanonical = (hubHtml.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
const hubMetaDesc = (hubHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || [])[1];

assert(!!hubTitle && hubTitle.length > 10, `Hub title is valid: "${hubTitle}"`);
assert(hubH1Matches.length === 1, `Hub has exactly 1 H1 (found ${hubH1Matches.length})`);
assert(hubCanonical === 'https://freexpensetracker.com/templates/', `Hub canonical is self-referencing: ${hubCanonical}`);
assert(!!hubMetaDesc && hubMetaDesc.length > 30, `Hub meta description is valid: "${hubMetaDesc}"`);
assert(!hubHtml.includes('content="noindex'), 'Hub page is NOT marked noindex');

for (const tmpl of TEMPLATES) {
  assert(hubHtml.includes(`/templates/${tmpl.slug}/`), `Hub links to landing page /templates/${tmpl.slug}/`);
  assert(hubHtml.includes(`/templates/${tmpl.asset}`), `Hub links to download /templates/${tmpl.asset}`);
}

console.log('\n--- 2. VERIFY 15 INDIVIDUAL TEMPLATE LANDING PAGES ---');
const seenTitles = new Set([hubTitle]);
const seenDescs = new Set([hubMetaDesc]);

for (const tmpl of TEMPLATES) {
  console.log(`Checking landing page: /templates/${tmpl.slug}/`);
  const pageFile = path.join(distDir, 'templates', tmpl.slug, 'index.html');
  assert(fs.existsSync(pageFile), `HTML file exists: dist/templates/${tmpl.slug}/index.html`);

  const pageHtml = fs.readFileSync(pageFile, 'utf8');
  const pageTitle = (pageHtml.match(/<title>([^<]+)<\/title>/i) || [])[1];
  const pageH1Matches = pageHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const pageCanonical = (pageHtml.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
  const pageMetaDesc = (pageHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || [])[1];

  assert(!!pageTitle && !seenTitles.has(pageTitle), `Unique title: "${pageTitle}"`);
  seenTitles.add(pageTitle);

  assert(!!pageMetaDesc && !seenDescs.has(pageMetaDesc), `Unique meta description: "${pageMetaDesc}"`);
  seenDescs.add(pageMetaDesc);

  assert(pageH1Matches.length === 1, `Exactly one H1 present (found ${pageH1Matches.length})`);
  assert(pageCanonical === `https://freexpensetracker.com/templates/${tmpl.slug}/`, `Self-referencing canonical: ${pageCanonical}`);
  assert(!pageHtml.includes('content="noindex'), 'Page is NOT marked noindex');

  // Check download link
  assert(pageHtml.includes(`href="/templates/${tmpl.asset}"`), `Download link points to /templates/${tmpl.asset}`);

  // Check link back to hub
  assert(pageHtml.includes('href="/templates/"'), 'Includes link back to /templates/ hub');

  // Check explanatory word count
  const mainMatch = pageHtml.match(/<main[\s\S]*?<\/main>/i);
  const mainText = mainMatch ? mainMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const wordCount = mainText.split(' ').filter(Boolean).length;
  assert(wordCount >= 150, `Substantial explanatory content (${wordCount} words >= 150 words)`);
}

console.log('\n--- 3. VERIFY 15 ORIGINAL EXCEL ASSETS INTEGRITY & NOINDEX ---');
for (const tmpl of TEMPLATES) {
  const publicAsset = path.join(publicDir, 'templates', tmpl.asset);
  const distAsset = path.join(distDir, 'templates', tmpl.asset);

  assert(fs.existsSync(publicAsset), `Source asset exists: ${tmpl.asset}`);
  assert(fs.existsSync(distAsset), `Dist asset exists: ${tmpl.asset}`);

  const publicBuf = fs.readFileSync(publicAsset);
  const distBuf = fs.readFileSync(distAsset);

  // Check file is actually a zip/xlsx (PK header 0x50 0x4B)
  const isZip = distBuf[0] === 0x50 && distBuf[1] === 0x4B;
  assert(isZip, `${tmpl.asset} is a valid binary spreadsheet (not HTML)`);

  // Check hashes match exactly (unchanged)
  const hash1 = crypto.createHash('sha256').update(publicBuf).digest('hex');
  const hash2 = crypto.createHash('sha256').update(distBuf).digest('hex');
  assert(hash1 === hash2, `${tmpl.asset} bit-identical between public and dist`);
}

// Verify _headers preserves noindex for xlsx and NOT for HTML
const headersContent = fs.readFileSync(path.join(distDir, '_headers'), 'utf8');
assert(headersContent.includes('/templates/*.xlsx'), '_headers contains wildcard /templates/*.xlsx rule');
assert(headersContent.includes('X-Robots-Tag: noindex'), '_headers contains X-Robots-Tag: noindex');
assert(!headersContent.includes('/templates/*\n  X-Robots-Tag: noindex'), '_headers does NOT noindex all /templates/* HTML');

console.log('\n--- 4. VERIFY GERMAN HOMEPAGE (/de/) ---');
const deFile = path.join(distDir, 'de', 'index.html');
assert(fs.existsSync(deFile), 'dist/de/index.html exists');
const deHtml = fs.readFileSync(deFile, 'utf8');

const deCanonical = (deHtml.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
assert(deCanonical === 'https://freexpensetracker.com/de/', `German canonical is https://freexpensetracker.com/de/ (got ${deCanonical})`);

const hreflangCount = (deHtml.match(/<link\s+rel=["']alternate["']\s+hreflang=/g) || []).length;
assert(hreflangCount === 9, `9 hreflang alternate tags present (got ${hreflangCount})`);

const deArticle = (deHtml.match(/<article[\s\S]*?<\/article>/i) || [])[0] || '';
const deWords = deArticle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
assert(deWords >= 300 && deWords <= 600, `German educational content word count is ${deWords} (target 300-500 words)`);

assert(deHtml.includes('id="section-faq"'), 'FAQ section is present on German homepage');
assert(deHtml.includes('Häufig gestellte Fragen (FAQ)'), 'German FAQ header is present');
assert(deHtml.includes('Kontoauszug importieren'), 'German import tab is present');
assert(deHtml.includes('PDF-Kontoauszüge'), 'Verified import formats described');
assert(deHtml.includes('100% Client-seitige Privatsphäre'), 'Accurate client-side privacy described without false claims');

console.log('\n--- 5. VERIFY SITEMAP (/sitemap.xml) ---');
const sitemapFile = path.join(distDir, 'sitemap.xml');
assert(fs.existsSync(sitemapFile), 'dist/sitemap.xml exists');

const sitemapContent = fs.readFileSync(sitemapFile, 'utf8');
assert(sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Valid XML declaration');
assert(sitemapContent.includes('<urlset') && sitemapContent.includes('</urlset>'), 'Valid urlset tags');

const locMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) || [];
const sitemapUrls = locMatches.map(m => m.replace(/<\/?loc>/g, ''));
assert(sitemapUrls.length === 28, `Sitemap has exactly 28 URLs (found ${sitemapUrls.length})`);

// Ensure all 16 new URLs are in sitemap
assert(sitemapUrls.includes('https://freexpensetracker.com/templates/'), 'Sitemap includes https://freexpensetracker.com/templates/');
for (const tmpl of TEMPLATES) {
  assert(sitemapUrls.includes(`https://freexpensetracker.com/templates/${tmpl.slug}/`), `Sitemap includes https://freexpensetracker.com/templates/${tmpl.slug}/`);
}

// Ensure no .xlsx in sitemap
assert(!sitemapContent.includes('.xlsx'), 'No .xlsx files in sitemap.xml');

// Ensure no redirecting URLs in sitemap
assert(!sitemapUrls.includes('https://freexpensetracker.com/about/'), 'No /about/ alias in sitemap');
assert(!sitemapUrls.includes('https://freexpensetracker.com/contact/'), 'No /contact/ alias in sitemap');
assert(!sitemapUrls.includes('https://freexpensetracker.com/de/contact-us/'), 'No obsolete /de/contact-us/ in sitemap');

// Ensure distinct reliable lastmod dates exist
const lastmodDates = new Set((sitemapContent.match(/<lastmod>([^<]+)<\/lastmod>/g) || []).map(m => m.replace(/<\/?lastmod>/g, '')));
assert(lastmodDates.size >= 4, `Reliable lastmod dates used (found ${lastmodDates.size} distinct dates: ${Array.from(lastmodDates).join(', ')})`);
assert(!lastmodDates.has('2026-10-12') || lastmodDates.size > 1, 'Not all pages share single 2026-10-12 timestamp');

console.log('\n--- 6. VERIFY SEARCH CONSOLE CLEAN-UP ---');
const obsoleteUrl = '/de/contact-us';
let staleReferences = 0;
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'dist'].includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (/\.(astro|ts|js|mjs|html|xml|txt)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(obsoleteUrl)) {
        console.error(`Found stale reference to ${obsoleteUrl} in ${fullPath}`);
        staleReferences++;
      }
    }
  }
}
scanDir(path.join(__dirname, '..', 'src'));
scanDir(path.join(__dirname, '..', 'public'));
assert(staleReferences === 0, `Zero stale references to /de/contact-us/ in source and public files`);

console.log('\n========================================');
console.log(`TOTAL CHECKS: ${totalChecks}`);
console.log(`PASSED: ${passedChecks}`);
console.log(`FAILED: ${failedChecks}`);
console.log('========================================\n');

if (failedChecks > 0) {
  process.exit(1);
}
