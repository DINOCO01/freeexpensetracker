import fs from 'fs';

// 1. Inspect src/data/templatesData.ts
const dataContent = fs.readFileSync('src/data/templatesData.ts', 'utf8');
const templateIds = [...dataContent.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('1. templatesData.ts templates count:', templateIds.length);
console.log('   IDs:', templateIds);

// 2. Inspect src/components/SpreadsheetsAndPrintable.astro
const compContent = fs.readFileSync('src/components/SpreadsheetsAndPrintable.astro', 'utf8');
const compTemplateIds = [...compContent.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('\n2. SpreadsheetsAndPrintable.astro IDs count:', compTemplateIds.length);
console.log('   IDs:', compTemplateIds);

// 3. Inspect src/pages/templates/index.astro
const pageContent = fs.readFileSync('src/pages/templates/index.astro', 'utf8');
console.log('\n3. templates/index.astro headline/title mentions:');
const h1Match = pageContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
console.log('   H1:', h1Match ? h1Match[1].trim() : 'NONE');
const titleMatch = pageContent.match(/title="([^"]+)"/);
console.log('   Title prop:', titleMatch ? titleMatch[1] : 'NONE');

