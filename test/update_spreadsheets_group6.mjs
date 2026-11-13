import fs from 'fs';

let content = fs.readFileSync('src/components/SpreadsheetsAndPrintable.astro', 'utf8');

// 1. Add dynamic counts definitions right before CATEGORIES
const oldCategories = `const CATEGORIES = [
  { key: 'all', labelKey: 'templates.catAll', count: 20, icon: '📂' },
  { key: 'catBudget', labelKey: 'templates.catBudget', count: 3, icon: '💰' },
  { key: 'catDebt', labelKey: 'templates.catDebt', count: 6, icon: '💳' },
  { key: 'catSavings', labelKey: 'templates.catSavings', count: 6, icon: '🛡️' },
  { key: 'catInvesting', labelKey: 'templates.catInvesting', count: 3, icon: '📈' },
  { key: 'catBills', labelKey: 'templates.catBills', count: 2, icon: '🧾' }
];`;

const newCategories = `const excelTemplates = TEMPLATES.filter((t) => Boolean(t.fileName));
const sheetsTemplates = TEMPLATES.filter((t) => Boolean(t.googleSheetsUrl && (t.googleSheetsUrl.includes('docs.google.com') || t.googleSheetsUrl.includes('drive.google.com'))));
const totalTemplates = TEMPLATES.length;
const excelCount = excelTemplates.length;
const sheetsCount = sheetsTemplates.length;

const CATEGORIES = [
  { key: 'all', labelKey: 'templates.catAll', count: totalTemplates, icon: '📂' },
  { key: 'catBudget', labelKey: 'templates.catBudget', count: TEMPLATES.filter((t) => t.categoryKey === 'catBudget').length, icon: '💰' },
  { key: 'catDebt', labelKey: 'templates.catDebt', count: TEMPLATES.filter((t) => t.categoryKey === 'catDebt').length, icon: '💳' },
  { key: 'catSavings', labelKey: 'templates.catSavings', count: TEMPLATES.filter((t) => t.categoryKey === 'catSavings').length, icon: '🛡️' },
  { key: 'catInvesting', labelKey: 'templates.catInvesting', count: TEMPLATES.filter((t) => t.categoryKey === 'catInvesting').length, icon: '📈' },
  { key: 'catBills', labelKey: 'templates.catBills', count: TEMPLATES.filter((t) => t.categoryKey === 'catBills').length, icon: '🧾' }
];`;

if (content.includes(oldCategories.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldCategories.replace(/\n/g, '\r\n'), newCategories.replace(/\n/g, '\r\n'));
  console.log('Replaced CATEGORIES (CRLF)');
} else if (content.includes(oldCategories)) {
  content = content.replace(oldCategories, newCategories);
  console.log('Replaced CATEGORIES (LF)');
} else {
  console.log('Warning: oldCategories not matched');
}

// 2. Replace hardcoded 15 badges
const oldExcelBadge = `<span>{t('templates.tabExcel', locale)}</span>\n          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">15</span>`;
const newExcelBadge = `<span>{t('templates.tabExcel', locale)}</span>\n          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">{excelCount}</span>`;

if (content.includes(oldExcelBadge.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldExcelBadge.replace(/\n/g, '\r\n'), newExcelBadge.replace(/\n/g, '\r\n'));
  console.log('Replaced Excel Badge (CRLF)');
} else if (content.includes(oldExcelBadge)) {
  content = content.replace(oldExcelBadge, newExcelBadge);
  console.log('Replaced Excel Badge (LF)');
}

const oldSheetsBadge = `<span>{t('templates.tabSheets', locale)}</span>\n          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">15</span>`;
const newSheetsBadge = `<span>{t('templates.tabSheets', locale)}</span>\n          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{sheetsCount}</span>`;

if (content.includes(oldSheetsBadge.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldSheetsBadge.replace(/\n/g, '\r\n'), newSheetsBadge.replace(/\n/g, '\r\n'));
  console.log('Replaced Sheets Badge (CRLF)');
} else if (content.includes(oldSheetsBadge)) {
  content = content.replace(oldSheetsBadge, newSheetsBadge);
  console.log('Replaced Sheets Badge (LF)');
}

// 3. In panel-templates-excel, map excelTemplates; in panel-templates-sheets, map sheetsTemplates
const oldPanelExcel = `<div id="panel-templates-excel" class="space-y-4" role="tabpanel" aria-labelledby="btn-format-excel">\n    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">\n      {TEMPLATES.map((tmpl) => {`;
const newPanelExcel = `<div id="panel-templates-excel" class="space-y-4" role="tabpanel" aria-labelledby="btn-format-excel">\n    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">\n      {excelTemplates.map((tmpl) => {`;

if (content.includes(oldPanelExcel.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldPanelExcel.replace(/\n/g, '\r\n'), newPanelExcel.replace(/\n/g, '\r\n'));
  console.log('Replaced panel-templates-excel map (CRLF)');
} else if (content.includes(oldPanelExcel)) {
  content = content.replace(oldPanelExcel, newPanelExcel);
  console.log('Replaced panel-templates-excel map (LF)');
}

const oldPanelSheets = `<div id="panel-templates-sheets" class="space-y-4 hidden" role="tabpanel" aria-labelledby="btn-format-sheets">\n    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">\n      {TEMPLATES.map((tmpl) => {`;
const newPanelSheets = `<div id="panel-templates-sheets" class="space-y-4 hidden" role="tabpanel" aria-labelledby="btn-format-sheets">\n    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">\n      {sheetsTemplates.map((tmpl) => {`;

if (content.includes(oldPanelSheets.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldPanelSheets.replace(/\n/g, '\r\n'), newPanelSheets.replace(/\n/g, '\r\n'));
  console.log('Replaced panel-templates-sheets map (CRLF)');
} else if (content.includes(oldPanelSheets)) {
  content = content.replace(oldPanelSheets, newPanelSheets);
  console.log('Replaced panel-templates-sheets map (LF)');
}

fs.writeFileSync('src/components/SpreadsheetsAndPrintable.astro', content, 'utf8');
console.log('Updated SpreadsheetsAndPrintable.astro successfully.');

