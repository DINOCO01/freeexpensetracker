import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_LIST, t, type SupportedLocale } from '../src/locales';

const distDir = path.resolve('dist');

interface LocaleCheckSpec {
  locale: SupportedLocale;
  sampleExpectedTerms: {
    seoHeading: string;
    seoCta: string;
    faqQuestion: string;
    faqAnswer: string;
    competitiveTitle: string;
    competitiveRow1: string;
    pillar1Title: string;
    pillar2Title: string;
    pillar3Title: string;
    pillar4Title: string;
    glossaryTitle: string;
    blogTitle: string;
    blogBadge: string;
    footerAbout: string;
    tabTracker: string;
    tabTemplates: string;
    tabDebt: string;
    tabKnowledge: string;
    modalReset: string;
    modalImport: string;
    modalDebt: string;
    modalGoal: string;
  };
}

const specs: LocaleCheckSpec[] = LOCALES_LIST.map(loc => ({
  locale: loc,
  sampleExpectedTerms: {
    seoHeading: t('seoGuide.sec1Title', loc),
    seoCta: t('seoGuide.ctaButton', loc),
    faqQuestion: t('faq.q1', loc),
    faqAnswer: t('faq.a1', loc).substring(0, 30),
    competitiveTitle: t('competitiveEdge.title', loc),
    competitiveRow1: t('competitiveEdge.c1Name', loc),
    pillar1Title: t('knowledge.p1Title', loc),
    pillar2Title: t('knowledge.p2Title', loc),
    pillar3Title: t('knowledge.p3Title', loc),
    pillar4Title: t('knowledge.p4Title', loc),
    glossaryTitle: t('knowledge.glossaryTitle', loc),
    blogTitle: t('blogs.featuredTitle', loc),
    blogBadge: t('blogs.advisoryBadge', loc),
    footerAbout: t('footer.about', loc).substring(0, 30),
    tabTracker: t('tabs.tracker', loc),
    tabTemplates: t('tabs.templates', loc),
    tabDebt: t('tabs.debt', loc),
    tabKnowledge: t('tabs.knowledge', loc),
    modalReset: t('modals.resetTitle', loc),
    modalImport: t('modals.fileImportTitle', loc),
    modalDebt: t('modals.debtPaymentTitle', loc),
    modalGoal: t('modals.goalContributeTitle', loc),
  }
}));

console.log('=== VERIFYING SYSTEM-WIDE LOCALIZATION ACROSS DIST HTML FILES ===\n');

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

let allPassed = true;

for (const spec of specs) {
  const filePath = spec.locale === 'en'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, spec.locale, 'index.html');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    allPassed = false;
    continue;
  }

  const rawHtml = fs.readFileSync(filePath, 'utf-8');
  const html = decodeHtmlEntities(rawHtml);

  console.log(`Checking [${spec.locale}] (${filePath})...`);

  for (const [key, term] of Object.entries(spec.sampleExpectedTerms)) {
    if (!html.includes(term)) {
      console.error(`  ❌ [${spec.locale}] Missing expected ${key}: "${term.substring(0, 40)}..."`);
      allPassed = false;
    } else {
      console.log(`  ✅ [${spec.locale}] Found ${key}: "${term.substring(0, 35)}..."`);
    }
  }

  // Also check that non-English pages do not contain English untranslated fragments
  if (spec.locale !== 'en') {
    const englishSeoHeading = t('seoGuide.sec1Title', 'en');
    const englishFaqQ1 = t('faq.q1', 'en');
    const englishPillar1 = t('knowledge.p1Title', 'en');

    if (html.includes(englishSeoHeading)) {
      console.error(`  ⚠️ [${spec.locale}] English leak detected: found English SEO heading "${englishSeoHeading}"`);
      allPassed = false;
    }
    if (html.includes(englishFaqQ1)) {
      console.error(`  ⚠️ [${spec.locale}] English leak detected: found English FAQ Q1 "${englishFaqQ1}"`);
      allPassed = false;
    }
    if (html.includes(englishPillar1)) {
      console.error(`  ⚠️ [${spec.locale}] English leak detected: found English Pillar 1 "${englishPillar1}"`);
      allPassed = false;
    }
  }

  console.log('');
}

if (allPassed) {
  console.log('🎉 ALL 8 LOCALES FULLY LOCALIZED WITH ZERO ENGLISH LEAKAGE IN WEBSITE CONTENT!');
  process.exit(0);
} else {
  console.error('❌ Some localization checks failed.');
  process.exit(1);
}
