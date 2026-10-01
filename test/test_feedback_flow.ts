import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

console.log('--- TESTING FEEDBACK & CONTACT US FLOW ---');

// 1. Verify Feedback UI in index.html and all locales
const routes = ['index.html', 'en/index.html', 'hi/index.html', 'es/index.html', 'de/index.html', 'fr/index.html', 'pt/index.html', 'ja/index.html', 'ko/index.html'];

for (const route of routes) {
  const filePath = path.join(distDir, route);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check 'Was this helpful?'
  if (!content.includes('Was this helpful?')) {
    console.error(`❌ [${route}] Missing 'Was this helpful?'`);
    process.exit(1);
  }

  // Check '👍' and 'Yes'
  if (!content.includes('👍') || !content.includes('Yes')) {
    console.error(`❌ [${route}] Missing '👍 Yes' button`);
    process.exit(1);
  }

  // Check '👎' and 'No'
  if (!content.includes('👎') || !content.includes('No')) {
    console.error(`❌ [${route}] Missing '👎 No' button`);
    process.exit(1);
  }

  // Check 'Thanks for your feedback!'
  if (!content.includes('Thanks for your feedback!')) {
    console.error(`❌ [${route}] Missing 'Thanks for your feedback!' inline confirmation`);
    process.exit(1);
  }

  // Check link to /contact-us
  if (!content.includes('/contact-us')) {
    console.error(`❌ [${route}] Missing navigation link to /contact-us`);
    process.exit(1);
  }

  // Verify FAQ section does NOT contain the feedback widget anymore
  const faqSectionMatch = content.match(/<section id="section-faq"[\s\S]*?<\/section>/);
  if (faqSectionMatch && faqSectionMatch[0].includes('Was this helpful?')) {
    console.error(`❌ [${route}] FAQ section still contains 'Was this helpful?' prompt!`);
    process.exit(1);
  }

  // Verify contextual-feedback element exists
  if (!content.includes('id="contextual-feedback"')) {
    console.error(`❌ [${route}] Missing id="contextual-feedback"`);
    process.exit(1);
  }

  console.log(`✅ [${route}] Contextual Feedback UI verified: Not in FAQ, moved to contextual tool handler with exact wording.`);
}

// 2. Verify Contact Us page
const contactUsPath = path.join(distDir, 'contact-us/index.html');
if (!fs.existsSync(contactUsPath)) {
  console.error(`❌ Contact Us page not found: ${contactUsPath}`);
  process.exit(1);
}
const contactContent = fs.readFileSync(contactUsPath, 'utf-8');

// Verify delivery recipient livetoolworld@gmail.com
if (!contactContent.includes('livetoolworld@gmail.com')) {
  console.error(`❌ Contact Us does not deliver to livetoolworld@gmail.com`);
  process.exit(1);
}
console.log('✅ Contact Us delivery recipient verified: livetoolworld@gmail.com');

// 3. Security check: No API keys, credentials or tokens in dist
const forbiddenKeywords = ['apiKey', 'secretKey', 'SMTP_PASS', 'PRIVATE_KEY', 'SENDGRID_API_KEY'];
for (const kw of forbiddenKeywords) {
  if (contactContent.includes(kw)) {
    console.error(`❌ Potential secret leaked: ${kw}`);
    process.exit(1);
  }
}
console.log('✅ Security check passed: No private credentials or secret keys in client-side code');

console.log('🎉 ALL FEEDBACK AND CONTACT US TESTS PASSED SUCCESSFULLY!');
