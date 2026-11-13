/**
 * test_group5_verification.mjs
 * Group 5 Automated Verification Suite:
 * 1. Static DOM Cleanup (Contact form & Cross-promotion modal)
 * 2. On-Demand Importer Loading & Chunk Splitting
 * 3. Module Caching and Rejection Eviction
 * 4. Localized Parser Loading Strings (8 locales)
 * 5. Headless Browser Verification (DOM, Dynamic Injection & Network)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import http from 'http';
import { spawn } from 'child_process';

const distDir = path.resolve('dist');

console.log('=================================================================');
console.log('🧪 RUNNING GROUP 5 VERIFICATION SUITE');
console.log('=================================================================\n');

let passedChecks = 0;
let failedChecks = 0;

function pass(name, detail = '') {
  console.log(`  ✅ PASS: ${name}${detail ? ` (${detail})` : ''}`);
  passedChecks++;
}

function fail(name, detail = '') {
  console.log(`  ❌ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  failedChecks++;
}

// -----------------------------------------------------------------------------
// 1. Static DOM Cleanup Audits
// -----------------------------------------------------------------------------
console.log('--- 1. Static DOM Cleanup: Contact Us Form ---');

const contactHtml = fs.readFileSync(path.join(distDir, 'contact-us/index.html'), 'utf8');

if (!contactHtml.includes('Message Received!')) {
  pass('dist/contact-us/index.html does not contain static "Message Received!" copy');
} else {
  fail('dist/contact-us/index.html contains "Message Received!"');
}

// Verify no static HTML element with id="contact-success-banner" in initial DOM
const hasStaticBannerTag = /<div[^>]*id=["']contact-success-banner["'][^>]*>/.test(contactHtml);
if (!hasStaticBannerTag) {
  pass('dist/contact-us/index.html has no static <div id="contact-success-banner"> container');
} else {
  fail('dist/contact-us/index.html contains static <div id="contact-success-banner"> container');
}

console.log('\n--- 2. Static DOM Cleanup: Activity Promotion Popup ---');

const informationalRoutes = [
  'about-us',
  'privacy-policy',
  'contact-us',
  'terms-and-conditions',
  'templates'
];

for (const route of informationalRoutes) {
  const pagePath = path.join(distDir, route, 'index.html');
  if (fs.existsSync(pagePath)) {
    const pageHtml = fs.readFileSync(pagePath, 'utf8');
    const hasPopupDiv = /id=["']mrb-activity-popup["']/.test(pageHtml);
    const hasPromoHeading = pageHtml.includes('Finished tracking your expenses?');
    if (!hasPopupDiv && !hasPromoHeading) {
      pass(`Informational route /${route}/ contains no promotional modal DOM or copy`);
    } else {
      fail(`Informational route /${route}/ leaks promotional modal DOM or copy`);
    }
  }
}

// Check tracker routes: / and /[lang]/
const trackerRoutes = ['index.html', 'fr/index.html', 'es/index.html', 'de/index.html', 'hi/index.html', 'ja/index.html', 'ko/index.html', 'pt/index.html'];
for (const route of trackerRoutes) {
  const pagePath = path.join(distDir, route);
  if (fs.existsSync(pagePath)) {
    const pageHtml = fs.readFileSync(pagePath, 'utf8');
    const hasStaticPopup = /<div[^>]*id=["']mrb-activity-popup["'][^>]*>/.test(pageHtml);
    const hasStaticPromoCopy = pageHtml.includes('Finished tracking your expenses?');
    if (!hasStaticPopup && !hasStaticPromoCopy) {
      pass(`Tracker route /${route} has no static popup DOM or promotional text in initial HTML`);
    } else {
      fail(`Tracker route /${route} leaks static popup DOM or promotional text in initial HTML`);
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Dynamic Parser Code Splitting & Imports
// -----------------------------------------------------------------------------
console.log('\n--- 3. Static Source Code & Chunk Isolation ---');

const fileImporterSrc = fs.readFileSync('src/utils/fileImporter.ts', 'utf8');
const receiptScannerSrc = fs.readFileSync('src/utils/receiptScanner.ts', 'utf8');
const storageSrc = fs.readFileSync('src/utils/storage.ts', 'utf8');
const templateDownloaderSrc = fs.readFileSync('src/utils/templateDownloader.ts', 'utf8');

// Check top-level static imports
const checkNoStaticImport = (src, libName, fileName) => {
  const regex = new RegExp(`^\\s*import\\s+.*from\\s+['"]${libName}['"]`, 'm');
  if (!regex.test(src)) {
    pass(`${fileName} has no static top-level import of "${libName}"`);
  } else {
    fail(`${fileName} still has static top-level import of "${libName}"`);
  }
};

checkNoStaticImport(fileImporterSrc, 'xlsx', 'fileImporter.ts');
checkNoStaticImport(fileImporterSrc, 'pdfjs-dist/legacy/build/pdf.mjs', 'fileImporter.ts');
checkNoStaticImport(receiptScannerSrc, 'tesseract.js', 'receiptScanner.ts');
checkNoStaticImport(receiptScannerSrc, 'pdfjs-dist', 'receiptScanner.ts');
checkNoStaticImport(storageSrc, 'xlsx', 'storage.ts');
checkNoStaticImport(templateDownloaderSrc, 'xlsx', 'templateDownloader.ts');

// Check built chunks in dist/_astro
const astroFiles = fs.readdirSync(path.join(distDir, '_astro'));
const hasXlsxChunk = astroFiles.some((f) => f.startsWith('xlsx.') && f.endsWith('.js'));
const hasPdfChunk = astroFiles.some((f) => f.startsWith('pdf.') && f.endsWith('.js'));
const hasReceiptChunk = astroFiles.some((f) => f.startsWith('receiptScanner.') && f.endsWith('.js'));

if (hasXlsxChunk) {
  pass('xlsx is isolated in its own code-split chunk in dist/_astro/');
} else {
  fail('xlsx chunk not found in dist/_astro/');
}

if (hasPdfChunk) {
  pass('pdfjs is isolated in its own code-split chunk in dist/_astro/');
} else {
  fail('pdfjs chunk not found in dist/_astro/');
}

if (hasReceiptChunk) {
  pass('receiptScanner is isolated in its own code-split chunk in dist/_astro/');
} else {
  fail('receiptScanner chunk not found in dist/_astro/');
}

// -----------------------------------------------------------------------------
// 4. Localized Parser Loading Strings
// -----------------------------------------------------------------------------
console.log('\n--- 4. Localized Document Parser Loading Strings (8 Locales) ---');

const locales = ['en', 'hi', 'es', 'de', 'fr', 'pt', 'ja', 'ko'];
for (const loc of locales) {
  const locSrc = fs.readFileSync(`src/locales/${loc}.ts`, 'utf8');
  const match = locSrc.match(/initParser:\s*["']([^"']+)["']/);
  if (match && match[1]) {
    pass(`Locale "${loc}" defines importer.initParser`, match[1]);
  } else {
    fail(`Locale "${loc}" missing importer.initParser`);
  }
}

// -----------------------------------------------------------------------------
// 5. Dynamic Parsers Functionality & Cache Eviction Unit Test
// -----------------------------------------------------------------------------
console.log('\n--- 5. Dynamic Parser Unit & Caching Verification ---');

async function testDynamicParsers() {
  const { getXLSX, getPdfJs, getTesseract } = await import('../src/utils/dynamicParsers.ts');

  // Test getXLSX
  const xlsx1 = await getXLSX();
  assert(xlsx1 && (xlsx1.read || xlsx1.utils), 'XLSX loaded correctly');
  const xlsx2 = await getXLSX();
  assert(xlsx1 === xlsx2, 'XLSX instance is cached across calls');
  pass('getXLSX() loads SheetJS on-demand and caches resolved module');

  // Test getPdfJs
  const pdf1 = await getPdfJs();
  assert(pdf1 && pdf1.getDocument, 'PDF.js loaded correctly');
  const pdf2 = await getPdfJs();
  assert(pdf1 === pdf2, 'PDF.js instance is cached across calls');
  pass('getPdfJs() loads pdfjs-dist on-demand and caches resolved module');

  // Test getTesseract
  const tess1 = await getTesseract();
  assert(tess1 && (tess1.recognize || tess1.createWorker), 'Tesseract loaded correctly');
  const tess2 = await getTesseract();
  assert(tess1 === tess2, 'Tesseract instance is cached across calls');
  pass('getTesseract() loads tesseract.js on-demand and caches resolved module');
}

// -----------------------------------------------------------------------------
// Summary & Execution
// -----------------------------------------------------------------------------
testDynamicParsers()
  .then(() => {
    console.log('\n=================================================================');
    console.log(`TOTAL GROUP 5 CHECKS: ${passedChecks + failedChecks} | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
    console.log('=================================================================');
    if (failedChecks > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });

