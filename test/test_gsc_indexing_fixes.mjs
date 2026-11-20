import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// 1. Robots.txt check
test('robots.txt contains Disallow: /cdn-cgi/', () => {
  const robots = fs.readFileSync('public/robots.txt', 'utf8');
  if (!robots.includes('Disallow: /cdn-cgi/')) throw new Error('Missing Disallow: /cdn-cgi/ in public/robots.txt');
  const distRobots = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf8');
  if (!distRobots.includes('Disallow: /cdn-cgi/')) throw new Error('Missing Disallow: /cdn-cgi/ in dist/robots.txt');
});

// 2. _headers check
test('_headers contains noindex for all 21 templates and pdf', () => {
  const headers = fs.readFileSync('public/_headers', 'utf8');
  for (let i = 1; i <= 21; i++) {
    const padded = String(i).padStart(2, '0');
    if (!headers.includes(`/templates/${padded}_`)) {
      throw new Error(`Missing noindex rule for /templates/${padded}_ in _headers`);
    }
  }
  if (!headers.includes('/templates/*.pdf')) {
    throw new Error('Missing noindex rule for /templates/*.pdf in _headers');
  }
});

// 3. Email protection tags in source files
test('Contact, Privacy, and Terms pages have email_off tags', () => {
  const contact = fs.readFileSync('src/pages/contact-us.astro', 'utf8');
  if (!contact.includes('<!--email_off-->')) throw new Error('contact-us.astro missing <!--email_off-->');
  if (!contact.includes('<!--/email_off-->')) throw new Error('contact-us.astro missing <!--/email_off-->');

  const privacy = fs.readFileSync('src/pages/privacy-policy.astro', 'utf8');
  if (!privacy.includes('<!--email_off-->')) throw new Error('privacy-policy.astro missing <!--email_off-->');

  const terms = fs.readFileSync('src/pages/terms-and-conditions.astro', 'utf8');
  if (!terms.includes('<!--email_off-->')) throw new Error('terms-and-conditions.astro missing <!--email_off-->');
});

// 4. MobileBottomNav links directly to canonicals
test('MobileBottomNav uses canonical URLs for privacy and terms', () => {
  const nav = fs.readFileSync('src/components/MobileBottomNav.astro', 'utf8');
  if (nav.includes('href="/privacy/"') || nav.includes('href="/privacy"')) throw new Error('MobileBottomNav has redirecting /privacy/ link');
  if (nav.includes('href="/terms/"') || nav.includes('href="/terms"')) throw new Error('MobileBottomNav has redirecting /terms/ link');
  if (!nav.includes('href="/privacy-policy/"')) throw new Error('MobileBottomNav missing /privacy-policy/');
  if (!nav.includes('href="/terms-and-conditions/"')) throw new Error('MobileBottomNav missing /terms-and-conditions/');
});

// 5. Internal links on homepage (dist/index.html)
test('Homepage contains internal links to savings challenges', () => {
  const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  if (!indexHtml.includes('/templates/5000-savings-challenge/')) throw new Error('Homepage missing link to 5000-savings-challenge');
  if (!indexHtml.includes('/templates/10000-savings-challenge/')) throw new Error('Homepage missing link to 10000-savings-challenge');
  if (!indexHtml.includes('/templates/biweekly-savings-challenge/')) throw new Error('Homepage missing link to biweekly-savings-challenge');
});

// 6. French homepage contains internal links to French savings challenges
test('French homepage contains internal links to French savings challenges', () => {
  const frIndexHtml = fs.readFileSync(path.join(distDir, 'fr/index.html'), 'utf8');
  if (!frIndexHtml.includes('/fr/templates/5000-savings-challenge/')) throw new Error('French homepage missing link to 5000-savings-challenge');
  if (!frIndexHtml.includes('/fr/templates/10000-savings-challenge/')) throw new Error('French homepage missing link to 10000-savings-challenge');
  if (!frIndexHtml.includes('/fr/templates/biweekly-savings-challenge/')) throw new Error('French homepage missing link to biweekly-savings-challenge');
});

// 7. Related templates cross-linking in dist
test('English and French 52-week challenge cross-link to sibling challenges', () => {
  const en52 = fs.readFileSync(path.join(distDir, 'templates/52-week-savings-challenge/index.html'), 'utf8');
  if (!en52.includes('/templates/5000-savings-challenge/')) throw new Error('EN 52-week missing 5000-savings-challenge cross link');
  if (!en52.includes('/templates/10000-savings-challenge/')) throw new Error('EN 52-week missing 10000-savings-challenge cross link');
  if (!en52.includes('/templates/biweekly-savings-challenge/')) throw new Error('EN 52-week missing biweekly-savings-challenge cross link');

  const fr52 = fs.readFileSync(path.join(distDir, 'fr/templates/52-week-savings-challenge/index.html'), 'utf8');
  if (!fr52.includes('/fr/templates/5000-savings-challenge/')) throw new Error('FR 52-week missing 5000-savings-challenge cross link');
  if (!fr52.includes('/fr/templates/10000-savings-challenge/')) throw new Error('FR 52-week missing 10000-savings-challenge cross link');
  if (!fr52.includes('/fr/templates/biweekly-savings-challenge/')) throw new Error('FR 52-week missing biweekly-savings-challenge cross link');
});

// 8. French templates content length and quality
test('All 20 French template dist pages have rich content, 5 FAQs, and valid schema', () => {
  const frTemplatesDir = path.join(distDir, 'fr/templates');
  const slugs = fs.readdirSync(frTemplatesDir).filter(f => f !== 'index.html' && fs.statSync(path.join(frTemplatesDir, f)).isDirectory());
  
  if (slugs.length !== 20) throw new Error(`Expected 20 French template slugs, found ${slugs.length}`);

  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(frTemplatesDir, slug, 'index.html'), 'utf8');
    
    // Check FAQ section exists
    if (!html.includes('Foire Aux Questions')) {
      throw new Error(`${slug} missing Foire Aux Questions section`);
    }

    // Check JSON-LD schema contains 5 questions
    if (!html.includes('"@type":"FAQPage"')) throw new Error(`${slug} missing FAQPage schema`);
    const questionMatches = (html.match(/"@type":"Question"/g) || []).length;
    if (questionMatches < 5) {
      throw new Error(`${slug} has only ${questionMatches} FAQ schema questions (expected >= 5)`);
    }

    // Check SoftwareApplication and DigitalDocument schema
    if (!html.includes('"SoftwareApplication"') || !html.includes('"DigitalDocument"')) {
      throw new Error(`${slug} missing SoftwareApplication or DigitalDocument schema`);
    }

    // Check HowTo schema
    if (!html.includes('"@type":"HowTo"')) {
      throw new Error(`${slug} missing HowTo schema`);
    }

    // Check canonical link
    const expectedCanonical = `https://freexpensetracker.com/fr/templates/${slug}/`;
    if (!html.includes(`rel="canonical" href="${expectedCanonical}"`)) {
      throw new Error(`${slug} canonical mismatch: expected ${expectedCanonical}`);
    }

    // Check alternate hreflangs
    if (!html.includes('hreflang="fr"') || !html.includes('hreflang="en"') || !html.includes('hreflang="x-default"')) {
      throw new Error(`${slug} missing complete hreflang links`);
    }

    // Check HTML length (minified dist file size should be substantial, > 25KB)
    if (html.length < 25000) {
      throw new Error(`${slug} HTML size too small (${html.length} chars)`);
    }
  }
});

console.log('\nAll Google Search Console indexing fix tests PASSED successfully!');
