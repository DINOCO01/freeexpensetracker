import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details}`);
    failed++;
  }
}

console.log('--- FreeExpenseTracker AEO/GEO Optimization Verification Suite ---');

// 1. Robots.txt bot allowances
console.log('\n[1] Checking public/robots.txt AI Bot Allowances...');
const robots = fs.readFileSync('public/robots.txt', 'utf8');
['GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'].forEach(bot => {
  assert(robots.includes(`User-agent: ${bot}`), `robots.txt declares User-agent: ${bot}`);
});

// 2. llms.txt & llms-full.txt
console.log('\n[2] Checking llms.txt and llms-full.txt...');
const llms = fs.readFileSync('public/llms.txt', 'utf8');
assert(llms.includes('Prince Upadhyay'), 'llms.txt mentions author Prince Upadhyay');
assert(llms.includes('https://freexpensetracker.com/about/'), 'llms.txt links to /about/');
assert(llms.includes('https://freexpensetracker.com/bill-splitter/'), 'llms.txt links to /bill-splitter/');

const llmsFull = fs.readFileSync('public/llms-full.txt', 'utf8');
assert(llmsFull.length > 8000, `llms-full.txt contains rich full knowledge base (${llmsFull.length} bytes)`);
assert(llmsFull.includes('Prince Upadhyay'), 'llms-full.txt covers author background');
assert(llmsFull.includes('Debt Snowball'), 'llms-full.txt covers Debt Snowball');
assert(llmsFull.includes('Debt Avalanche'), 'llms-full.txt covers Debt Avalanche');
assert(llmsFull.includes('Debt-to-Income'), 'llms-full.txt covers Debt-to-Income (DTI)');
assert(llmsFull.includes('Multi-Currency Bill Splitter'), 'llms-full.txt covers Bill Splitter');
assert(llmsFull.includes('Frequently Asked Questions'), 'llms-full.txt includes FAQs');

// 3. Sitemap freshness and routes
console.log('\n[3] Checking public/sitemap.xml...');
const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
assert(sitemap.includes('<loc>https://freexpensetracker.com/about/</loc>'), 'sitemap includes /about/');
assert(!sitemap.includes('<loc>https://freexpensetracker.com/about-us/</loc>'), 'sitemap excludes /about-us/');
assert(sitemap.includes('<lastmod>2026-11-20</lastmod>'), 'sitemap contains 2026-11-20 lastmod');

// 4. About page (/about/) and redirect (/about-us/)
console.log('\n[4] Checking dist/about/index.html & dist/about-us/index.html...');
const aboutHtml = fs.readFileSync('dist/about/index.html', 'utf8');
assert(aboutHtml.includes('Prince Upadhyay'), 'About page mentions Prince Upadhyay');
assert(aboutHtml.includes('Intermediate') || aboutHtml.includes('Chartered Accountancy'), 'About page mentions CA background');
assert(aboutHtml.includes('IndexedDB') && aboutHtml.includes('localStorage'), 'About page details client-side storage architecture');
assert(aboutHtml.includes('WebAssembly') || aboutHtml.includes('OCR'), 'About page details client-side processing');
assert(aboutHtml.includes('schema.org') && aboutHtml.includes('"@type":"Person"'), 'About page contains Person JSON-LD schema');

const aboutUsHtml = fs.readFileSync('dist/about-us/index.html', 'utf8');
assert(aboutUsHtml.includes('/about/'), 'About-us page redirects cleanly to /about/');

// 5. Author byline & 40-60 word AI answers across main surfaces
console.log('\n[5] Checking Byline & AI Answers in built HTML files...');

const homeHtml = fs.readFileSync('dist/index.html', 'utf8');
assert(homeHtml.includes('Prince Upadhyay') && homeHtml.includes('/about/'), 'Homepage includes byline linked to /about/');
assert(homeHtml.includes('FreeExpenseTracker is a 100% free, client-side personal finance web application'), 'Homepage has quotable AI answer');

const billSplitterHtml = fs.readFileSync('dist/bill-splitter/index.html', 'utf8');
assert(billSplitterHtml.includes('Prince Upadhyay') && billSplitterHtml.includes('/about/'), 'Bill Splitter includes byline linked to /about/');
assert(billSplitterHtml.includes('FreeExpenseTracker Bill Splitter is a free, browser-based group expense calculator'), 'Bill Splitter has quotable AI answer');

const templatesIndexHtml = fs.readFileSync('dist/templates/index.html', 'utf8');
assert(templatesIndexHtml.includes('Prince Upadhyay') && templatesIndexHtml.includes('/about/'), 'Templates index includes byline linked to /about/');
assert(templatesIndexHtml.includes('FreeExpenseTracker provides free, formula-ready financial spreadsheet templates'), 'Templates index has quotable AI answer');

const snowballHtml = fs.readFileSync('dist/templates/debt-snowball/index.html', 'utf8');
assert(snowballHtml.includes('Prince Upadhyay') && snowballHtml.includes('/about/'), 'Debt Snowball template includes byline linked to /about/');
assert(snowballHtml.includes('free, pre-formatted spreadsheet'), 'Debt Snowball template has quotable AI answer');

const avalancheHtml = fs.readFileSync('dist/templates/debt-avalanche/index.html', 'utf8');
assert(avalancheHtml.includes('Prince Upadhyay') && avalancheHtml.includes('/about/'), 'Debt Avalanche template includes byline linked to /about/');
assert(avalancheHtml.includes('How the Debt Avalanche Method Works'), 'Debt Avalanche template has calculation methodology');
assert(avalancheHtml.includes('19.9% APR') && avalancheHtml.includes('6.5% APR'), 'Debt Avalanche template has 3-step worked numerical example');

const dtiHtml = fs.readFileSync('dist/templates/debt-to-income-calculator/index.html', 'utf8');
assert(dtiHtml.includes('Prince Upadhyay') && dtiHtml.includes('/about/'), 'DTI template includes byline linked to /about/');
assert(dtiHtml.includes('How Debt-to-Income (DTI) Is Calculated'), 'DTI template has calculation methodology');
assert(dtiHtml.includes('Total Monthly Debt Payments ÷ Gross Monthly Income') || dtiHtml.includes('30% DTI Ratio'), 'DTI template has formula & worked example');

// 6. Localized pages bylines & answers
console.log('\n[6] Checking Localized Templates & Homepages...');
const frTemplateHtml = fs.readFileSync('dist/fr/templates/paycheck-budget/index.html', 'utf8');
assert(frTemplateHtml.includes('Prince Upadhyay') && frTemplateHtml.includes('/about/'), 'FR Template includes byline linked to /about/');
assert(frTemplateHtml.includes('feuille de calcul gratuite'), 'FR Template has French quotable AI answer');

const hiTemplateHtml = fs.readFileSync('dist/hi/templates/rupee-savings-challenge/index.html', 'utf8');
assert(hiTemplateHtml.includes('Prince Upadhyay') && hiTemplateHtml.includes('/about/'), 'HI Template includes byline linked to /about/');
assert(hiTemplateHtml.includes('निर्माता:'), 'HI Template has Hindi byline');
assert(hiTemplateHtml.includes('पूरी तरह से निःशुल्क स्प्रेडशीट टेम्पलेट'), 'HI Template has Hindi quotable AI answer');

const esHomeHtml = fs.readFileSync('dist/es/index.html', 'utf8');
assert(esHomeHtml.includes('Prince Upadhyay') && esHomeHtml.includes('/about/'), 'ES Home includes byline');

// 7. Schema markup verification
console.log('\n[7] Checking JSON-LD Schemas in HTML...');
assert(!homeHtml.includes('SearchAction'), 'WebSite schema does not contain SearchAction');
assert(homeHtml.includes('"@type":"Person"') && homeHtml.includes('Prince Upadhyay'), 'Home contains Person schema');
assert(homeHtml.includes('"author":{"@type":"Person"') && homeHtml.includes('/about/#person'), 'WebApplication schema has author Person');
assert(homeHtml.includes('"publisher":{"@type":"Person"') && homeHtml.includes('/about/#person'), 'WebApplication schema has publisher Person');
assert(homeHtml.includes('"datePublished":"2026-01-15"') && homeHtml.includes('"dateModified":"2026-11-20"'), 'Homepage has synchronized dates in JSON-LD');

// Check Template Schemas
assert(snowballHtml.includes('DigitalDocument') || snowballHtml.includes('SoftwareApplication'), 'Template has DigitalDocument/SoftwareApplication schema');
assert(snowballHtml.includes('"datePublished":"2026-02-15"') && snowballHtml.includes('"dateModified":"2026-11-20"'), 'Template has datePublished and dateModified');
assert(snowballHtml.includes('HowTo') && snowballHtml.includes('HowToStep'), 'Template has HowTo schema');

// 8. Natural FAQs & FAQPage schema synchronization
console.log('\n[8] Checking Natural FAQs & FAQPage JSON-LD Synchronization...');
assert(homeHtml.includes('Is FreeExpenseTracker free?'), 'Home displays natural question: Is FreeExpenseTracker free?');
assert(homeHtml.includes('Do I need to create an account?'), 'Home displays natural question: Do I need to create an account?');
assert(homeHtml.includes('Is my financial information stored online?'), 'Home displays natural question: Is my financial information stored online?');
assert(homeHtml.includes('How do I make my own expense tracker?'), 'Home displays natural question: How do I make my own expense tracker?');
assert(homeHtml.includes('How does the debt snowball method work?'), 'Home displays natural question: How does the debt snowball method work?');
assert(homeHtml.includes('What is the difference between debt snowball and avalanche?'), 'Home displays natural question: What is the difference between debt snowball and avalanche?');
assert(homeHtml.includes('How do I calculate my debt-to-income ratio?'), 'Home displays natural question: How do I calculate my debt-to-income ratio?');
assert(homeHtml.includes('How do I split a bill with different amounts?'), 'Home displays natural question: How do I split a bill with different amounts?');

// Check FAQPage schema contains these exact questions
assert(homeHtml.includes('"@type":"FAQPage"'), 'Home contains FAQPage JSON-LD schema');
assert(homeHtml.includes('"name":"Is FreeExpenseTracker free?"'), 'FAQPage schema contains question 1');
assert(homeHtml.includes('"name":"Do I need to create an account?"'), 'FAQPage schema contains question 2');
assert(homeHtml.includes('"name":"Is my financial information stored online?"'), 'FAQPage schema contains question 3');
assert(homeHtml.includes('"name":"How do I calculate my debt-to-income ratio?"'), 'FAQPage schema contains question 7');

console.log(`\nVerification Complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL AEO/GEO VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}
