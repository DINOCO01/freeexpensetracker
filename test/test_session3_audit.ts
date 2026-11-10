import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { SEASONAL_PROMOTIONS } from '../src/config/promotions';

console.log('=== RUNNING SESSION 3 SEO, INTERNAL LINKING & INDEXABILITY AUDIT ===\n');

const distDir = path.resolve('dist');
let total = 0;
let passed = 0;

function check(cond: boolean, msg: string) {
  total++;
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
}

function getAllHtmlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

// ==================================================
// 1. Phase 1: Contextual Internal Linking Verification
// ==================================================
console.log('--- 1. Verifying Phase 1 Contextual Internal Links ---');
const enContextualSlugs = [
  'emergency-fund-planner',
  'sinking-fund-planner',
  'paycheck-budget',
  'financial-dashboard',
  'monthly-spending-analyzer'
];

for (const slug of enContextualSlugs) {
  const html = fs.readFileSync(path.join(distDir, `templates/${slug}/index.html`), 'utf-8');
  check(
    html.includes('href="/templates/52-week-savings-challenge/"'),
    `[EN ${slug}] includes contextual link to /templates/52-week-savings-challenge/`
  );
  check(
    !html.toLowerCase().includes('>click here</a>'),
    `[EN ${slug}] uses descriptive anchor text (never "click here")`
  );
}

for (const slug of enContextualSlugs) {
  const html = fs.readFileSync(path.join(distDir, `fr/templates/${slug}/index.html`), 'utf-8');
  check(
    html.includes('href="/fr/templates/52-week-savings-challenge/"'),
    `[FR ${slug}] includes contextual French link to /fr/templates/52-week-savings-challenge/`
  );
  // Ensure body copy links stay on French /fr/templates/ paths (not leaking EN /templates/ links for translated destinations)
  check(
    !html.includes('href="/templates/52-week-savings-challenge/"'),
    `[FR ${slug}] avoids linking to English /templates/52-week-savings-challenge/ when French route exists`
  );
}

// ==================================================
// 2. Phase 2: Seasonal December 2026 Promotion Prep
// ==================================================
console.log('\n--- 2. Verifying Phase 2 Seasonal Promotion Config & Template ---');
check(
  SEASONAL_PROMOTIONS.enableDecember2026SavingsPromo === false,
  'Seasonal promotion feature flag is OFF by default (not prematurely active)'
);

const bannerSource = fs.readFileSync('src/components/SeasonalSavingsBanner.astro', 'utf-8');
check(bannerSource.includes('Start Your 52-Week Savings Challenge for 2027'), 'Seasonal banner contains suggested heading');
check(bannerSource.includes('Start the Challenge'), 'Seasonal banner contains primary CTA "Start the Challenge"');
check(bannerSource.includes('Download Free Template'), 'Seasonal banner contains secondary CTA "Download Free Template"');

const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
check(
  !homeHtml.includes('id="seasonal-savings-2027-banner"'),
  'Homepage does not prematurely render seasonal banner while flag is false'
);

// ==================================================
// 3. Phase 3: Full Build SEO, Canonical, JSON-LD & Broken Link Audit
// ==================================================
console.log('\n--- 3. Auditing All Built HTML Pages in dist/ ---');
const allHtml = getAllHtmlFiles(distDir);
check(allHtml.length === 54, `Total built HTML files = 54 (found ${allHtml.length})`);

const canonicalSet = new Map<string, string[]>();
const nonIndexableFiles = new Set(['404.html', '500.html']);
let brokenLinksFound = 0;

for (const filePath of allHtml) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf-8');

  // Check if meta-refresh alias redirect stub
  const isMetaRefresh = /http-equiv="refresh"/i.test(html);

  if (!nonIndexableFiles.has(rel) && !isMetaRefresh) {
    // Title
    const titles = html.match(/<title>[^<]+<\/title>/g) || [];
    check(titles.length === 1, `[${rel}] has single non-empty <title>`);

    // Meta description
    const descs = html.match(/<meta\s+name="description"\s+content="[^"]+"/g) || [];
    check(descs.length === 1, `[${rel}] has single <meta name="description">`);

    // Single H1
    const h1s = html.match(/<h1\b/g) || [];
    check(h1s.length === 1, `[${rel}] has exactly 1 <h1> (found ${h1s.length})`);

    // Canonical tag
    const canonicals = Array.from(html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g)).map(m => m[1]);
    check(canonicals.length === 1, `[${rel}] has exactly 1 canonical link`);
    const can = canonicals[0];
    check(can.startsWith('https://freexpensetracker.com/') && can.endsWith('/'), `[${rel}] canonical uses https & trailing slash (${can})`);

    const existingList = canonicalSet.get(can) || [];
    existingList.push(rel);
    canonicalSet.set(can, existingList);

    // No accidental noindex
    check(!/content="[^"]*noindex/i.test(html), `[${rel}] does not contain accidental noindex`);

    // Validate all JSON-LD blocks parse cleanly
    const jsonLdBlocks = Array.from(html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g));
    check(jsonLdBlocks.length >= 1, `[${rel}] has JSON-LD structured data blocks (${jsonLdBlocks.length})`);
    for (const blk of jsonLdBlocks) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(blk[1]);
      } catch (e) {
        assert.fail(`[${rel}] Invalid JSON-LD syntax: ${e}`);
      }
      check(Boolean(parsed && parsed['@type']), `[${rel}] JSON-LD block parses with valid @type (${parsed['@type']})`);
    }

    // Validate every hreflang URL maps to an actual route in dist/
    const hreflangs = Array.from(html.matchAll(/<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="([^"]+)"/g)).map(m => m[1]);
    for (const hUrl of hreflangs) {
      const targetPath = hUrl.replace('https://freexpensetracker.com', '');
      const cleanRel = targetPath === '/' ? 'index.html' : targetPath.replace(/^\/+/, '') + 'index.html';
      check(fs.existsSync(path.join(distDir, cleanRel)), `[${rel}] hreflang destination exists in dist/: ${cleanRel}`);
    }
  }

  // Validate all internal <a href="/..."> and <img src="/..."> links resolve in dist/
  const hrefMatches = Array.from(html.matchAll(/\b(?:href|src)="(\/[^"#?]*)/g)).map(m => m[1]);
  for (const rawTarget of hrefMatches) {
    if (rawTarget.startsWith('//')) continue; // protocol-relative external URL
    const trimmed = rawTarget.replace(/^\/+/, '');
    if (trimmed === '') {
      if (!fs.existsSync(path.join(distDir, 'index.html'))) brokenLinksFound++;
      continue;
    }
    const candidateFile = path.join(distDir, trimmed);
    const candidateIndex = path.join(distDir, trimmed.replace(/\/+$/, ''), 'index.html');
    if (!fs.existsSync(candidateFile) && !fs.existsSync(candidateIndex)) {
      console.error(`❌ BROKEN INTERNAL LINK on [${rel}]: ${rawTarget}`);
      brokenLinksFound++;
    }
  }
}

check(brokenLinksFound === 0, `Zero broken internal links or missing assets across all 54 HTML pages`);

// Check no duplicate canonicals across non-alias pages
let duplicateCanonicals = 0;
for (const [can, pages] of canonicalSet.entries()) {
  if (pages.length > 1) {
    console.error(`❌ DUPLICATE CANONICAL ${can} used by: ${pages.join(', ')}`);
    duplicateCanonicals++;
  }
}
check(duplicateCanonicals === 0, 'Zero duplicate canonical URLs across all indexable pages');

// Validate all sitemap URLs resolve cleanly in dist/
const sitemapXml = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf-8');
const locs = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
check(locs.length >= 48, `Sitemap has ${locs.length} URLs`);
for (const loc of locs) {
  const relPath = loc.replace('https://freexpensetracker.com', '');
  const expectedFile = relPath === '/' ? 'index.html' : relPath.replace(/^\/+/, '') + 'index.html';
  check(fs.existsSync(path.join(distDir, expectedFile)), `Sitemap URL exists in dist/: ${relPath}`);
}

console.log(`\n=============================================================`);
console.log(`ALL SESSION 3 AUDIT CHECKS PASSED: ${passed} / ${total} assertions!`);
console.log(`=============================================================\n`);

