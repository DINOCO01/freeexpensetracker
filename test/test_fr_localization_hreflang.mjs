import { readFileSync } from 'node:fs';

const BASE_URL = 'http://localhost:4321';

const TEMPLATE_SLUGS = [
  'paycheck-budget',
  'debt-snowball',
  'debt-avalanche',
  'debt-to-income-calculator',
  'student-loan-planner',
  'auto-loan-calculator',
  'mortgage-planner',
  '401k-retirement-planner',
  'roth-ira-planner',
  'emergency-fund-planner',
  'subscription-audit',
  'sinking-fund-planner',
  'net-worth-tracker',
  'financial-dashboard',
  'monthly-spending-analyzer',
  'monthly-bill-tracker'
];

async function fetchHtml(urlPath) {
  const res = await fetch(`${BASE_URL}${urlPath}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${urlPath}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function extractTag(html, regex) {
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractAllHreflangs(html) {
  const regex = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g;
  const list = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    list.push({ hreflang: m[1], href: m[2] });
  }
  return list;
}

async function runTests() {
  console.log('--- Starting French Localization & Hreflang SEO Audit Verification ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  // 1. Verify Homepage /fr/
  console.log('\n[1] Testing /fr/ Homepage');
  try {
    const htmlFr = await fetchHtml('/fr/');
    assert(htmlFr.includes('lang="fr"'), '/fr/ has lang="fr"');
    
    const canonical = extractTag(htmlFr, /<link\s+rel="canonical"\s+href="([^"]+)"/);
    assert(canonical === 'https://freexpensetracker.com/fr/', `/fr/ canonical is self-referencing: ${canonical}`);

    const hreflangs = extractAllHreflangs(htmlFr);
    assert(hreflangs.length >= 8, `/fr/ has full set of hreflang tags (found ${hreflangs.length})`);
    assert(hreflangs.some(h => h.hreflang === 'fr' && h.href === 'https://freexpensetracker.com/fr/'), 'Hreflang fr exists on /fr/');
    assert(hreflangs.some(h => h.hreflang === 'en' && h.href === 'https://freexpensetracker.com/'), 'Hreflang en exists on /fr/');
    assert(hreflangs.some(h => h.hreflang === 'x-default' && h.href === 'https://freexpensetracker.com/'), 'Hreflang x-default exists on /fr/');

    // SEO keywords
    assert(htmlFr.includes('tracker depenses gratuit'), '/fr/ contains primary keyword "tracker depenses gratuit"');
    assert(htmlFr.includes('suivi des d&#233;penses') || htmlFr.includes('suivi des dépenses'), '/fr/ contains supporting keyword "suivi des dépenses"');

    // Untranslated leak checks
    assert(!htmlFr.includes('>Track Your Money<'), '/fr/ does not have untranslated hero title');
    assert(!htmlFr.includes('>100% Free, Private<'), '/fr/ does not have untranslated hero subtitle');
    assert(!htmlFr.includes('>Add Expense Outflow<'), '/fr/ expense outflow button is localized');
    assert(!htmlFr.includes('>Maybe later<'), '/fr/ activity popup dismiss button is localized');
    assert(!htmlFr.includes('>Explore My Real Budget<'), '/fr/ MyRealBudget CTA button is localized');
  } catch (err) {
    assert(false, `/fr/ fetch failed: ${err.message}`);
  }

  // 2. Verify French Templates Hub /fr/templates/
  console.log('\n[2] Testing French Templates Hub /fr/templates/');
  try {
    const htmlFrHub = await fetchHtml('/fr/templates/');
    assert(htmlFrHub.includes('lang="fr"'), '/fr/templates/ has lang="fr"');

    const canonical = extractTag(htmlFrHub, /<link\s+rel="canonical"\s+href="([^"]+)"/);
    assert(canonical === 'https://freexpensetracker.com/fr/templates/', `/fr/templates/ canonical is self-referencing: ${canonical}`);

    const hreflangs = extractAllHreflangs(htmlFrHub);
    assert(hreflangs.length === 3, `/fr/templates/ has exactly 3 hreflang tags (en, fr, x-default) without phantom es/de 404s (found ${hreflangs.length})`);
    assert(hreflangs.some(h => h.hreflang === 'fr' && h.href === 'https://freexpensetracker.com/fr/templates/'), 'Hreflang fr points to /fr/templates/');
    assert(hreflangs.some(h => h.hreflang === 'en' && h.href === 'https://freexpensetracker.com/templates/'), 'Hreflang en points to /templates/');
    assert(hreflangs.some(h => h.hreflang === 'x-default' && h.href === 'https://freexpensetracker.com/templates/'), 'Hreflang x-default points to /templates/');

    // English hub check for reciprocity
    const htmlEnHub = await fetchHtml('/templates/');
    const enHreflangs = extractAllHreflangs(htmlEnHub);
    assert(enHreflangs.length === 3, `/templates/ has exactly 3 reciprocal hreflangs`);
    assert(enHreflangs.some(h => h.hreflang === 'fr' && h.href === 'https://freexpensetracker.com/fr/templates/'), '/templates/ has reciprocal fr hreflang');
    assert(enHreflangs.some(h => h.hreflang === 'en' && h.href === 'https://freexpensetracker.com/templates/'), '/templates/ has reciprocal en hreflang');
  } catch (err) {
    assert(false, `/fr/templates/ hub check failed: ${err.message}`);
  }

  // 3. Verify all 16 French template detail pages
  console.log('\n[3] Testing all 16 French Template detail pages');
  for (const slug of TEMPLATE_SLUGS) {
    try {
      const htmlFrDetail = await fetchHtml(`/fr/templates/${slug}/`);
      assert(htmlFrDetail.includes('lang="fr"'), `/fr/templates/${slug}/ has lang="fr"`);

      const canonical = extractTag(htmlFrDetail, /<link\s+rel="canonical"\s+href="([^"]+)"/);
      assert(canonical === `https://freexpensetracker.com/fr/templates/${slug}/`, `/fr/templates/${slug}/ canonical is self-referencing: ${canonical}`);

      const hreflangs = extractAllHreflangs(htmlFrDetail);
      assert(hreflangs.length === 3, `/fr/templates/${slug}/ has exactly 3 hreflangs (en, fr, x-default)`);
      assert(hreflangs.some(h => h.hreflang === 'fr' && h.href === `https://freexpensetracker.com/fr/templates/${slug}/`), `fr hreflang matches /fr/templates/${slug}/`);
      assert(hreflangs.some(h => h.hreflang === 'en' && h.href === `https://freexpensetracker.com/templates/${slug}/`), `en hreflang matches /templates/${slug}/`);
      assert(hreflangs.some(h => h.hreflang === 'x-default' && h.href === `https://freexpensetracker.com/templates/${slug}/`), `x-default matches /templates/${slug}/`);

      // Verify reciprocity with English detail page
      const htmlEnDetail = await fetchHtml(`/templates/${slug}/`);
      const enHreflangs = extractAllHreflangs(htmlEnDetail);
      assert(enHreflangs.some(h => h.hreflang === 'fr' && h.href === `https://freexpensetracker.com/fr/templates/${slug}/`), `/templates/${slug}/ has reciprocal fr link`);

      // Check for French breadcrumb and CTA
      assert(htmlFrDetail.includes('/fr/templates/'), `/fr/templates/${slug}/ links back to French templates hub`);
      assert(htmlFrDetail.includes('T&#233;l&#233;charger') || htmlFrDetail.includes('Télécharger') || htmlFrDetail.includes('télécharger'), `/fr/templates/${slug}/ has French download label`);
    } catch (err) {
      assert(false, `Template ${slug} failed: ${err.message}`);
    }
  }

  // 4. Verify Sitemap.xml
  console.log('\n[4] Testing public/sitemap.xml inclusion');
  const sitemapXml = readFileSync('public/sitemap.xml', 'utf8');
  assert(sitemapXml.includes('<loc>https://freexpensetracker.com/fr/templates/</loc>'), 'Sitemap has /fr/templates/');
  for (const slug of TEMPLATE_SLUGS) {
    assert(sitemapXml.includes(`<loc>https://freexpensetracker.com/fr/templates/${slug}/</loc>`), `Sitemap has /fr/templates/${slug}/`);
  }

  console.log(`\n--- Verification Finished with ${failures} failures ---`);
  if (failures > 0) {
    process.exit(1);
  }
}

runTests();

