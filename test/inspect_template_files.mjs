import fs from 'fs';
import path from 'path';

const compContent = fs.readFileSync('src/components/SpreadsheetsAndPrintable.astro', 'utf8');

// Extract TEMPLATES
const templatesMatch = compContent.match(/const TEMPLATES: TemplateDefinition\[\] = (\[[\s\S]*?\]);/);
if (!templatesMatch) {
  console.log('Could not find TEMPLATES');
  process.exit(1);
}

const templates = eval(templatesMatch[1]);
console.log('Total templates in TEMPLATES array:', templates.length);

templates.forEach((t, i) => {
  const xlsxPath = path.join('public/templates', t.fileName);
  const xlsxExists = fs.existsSync(xlsxPath);
  const isGoogleDoc = t.googleSheetsUrl && t.googleSheetsUrl.includes('docs.google.com');
  console.log(`${i+1}. id: ${t.id}, file: ${t.fileName} (exists: ${xlsxExists}), sheets: ${t.googleSheetsUrl}`);
});
// Check templatesData.ts
const dataContent = fs.readFileSync('src/data/templatesData.ts', 'utf8');
const lines = dataContent.split('\n');
let currentId = '';
console.log('\n--- templatesData.ts googleSheetsUrl ---');
for (const line of lines) {
  const idM = line.match(/id:\s*['"]([^'"]+)['"]/);
  if (idM) currentId = idM[1];
  const sheetsM = line.match(/googleSheetsUrl:\s*['"]([^'"]+)['"]/);
  if (sheetsM) {
    console.log(`${currentId} -> ${sheetsM[1]}`);
  }
}
