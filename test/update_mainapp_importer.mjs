import fs from 'fs';

let content = fs.readFileSync('src/components/MainApp.astro', 'utf8');

// 1. Update tabButtons click handler
const oldTabButtons = `  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });`;

const newTabButtons = `  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        if (btn.tagName === 'A') e.preventDefault();
        switchTab(tabId);
        if (tabId === 'import') {
          setTimeout(() => {
            const target = document.getElementById('importer') || document.getElementById('tab-view-import');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      }
    });
  });`;

if (content.includes(oldTabButtons.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldTabButtons.replace(/\n/g, '\r\n'), newTabButtons.replace(/\n/g, '\r\n'));
  console.log('Replaced tabButtons (CRLF)');
} else if (content.includes(oldTabButtons)) {
  content = content.replace(oldTabButtons, newTabButtons);
  console.log('Replaced tabButtons (LF)');
} else {
  console.log('Warning: oldTabButtons not matched');
}

// 2. Update anchor selector
const oldAnchorSelector = `document.querySelectorAll<HTMLAnchorElement>('a[href^="#tab-view-"]').forEach((link) => {`;
const newAnchorSelector = `document.querySelectorAll<HTMLAnchorElement>('a[href^="#tab-view-"], a[href="#importer"]').forEach((link) => {`;

if (content.includes(oldAnchorSelector)) {
  content = content.replace(oldAnchorSelector, newAnchorSelector);
  console.log('Replaced anchor selector');
} else {
  console.log('Warning: oldAnchorSelector not matched');
}

// 3. Update anchor handler body
const oldAnchorBody = `      const hash = link.getAttribute('href');
      if (!hash) return;
      const tabName = hash.replace('#tab-view-', '');
      if (tabName) {
        e.preventDefault();
        switchTab(tabName);
        setTimeout(() => {
          const targetView = document.getElementById(\`tab-view-\${tabName}\`);
          targetView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }`;

const newAnchorBody = `      const hash = link.getAttribute('href');
      if (!hash) return;
      const tabName = hash === '#importer' ? 'import' : hash.replace('#tab-view-', '');
      if (tabName) {
        e.preventDefault();
        switchTab(tabName);
        setTimeout(() => {
          const targetView = hash === '#importer' ? (document.getElementById('importer') || document.getElementById('tab-view-import')) : document.getElementById(\`tab-view-\${tabName}\`);
          targetView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }`;

if (content.includes(oldAnchorBody.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldAnchorBody.replace(/\n/g, '\r\n'), newAnchorBody.replace(/\n/g, '\r\n'));
  console.log('Replaced anchor body (CRLF)');
} else if (content.includes(oldAnchorBody)) {
  content = content.replace(oldAnchorBody, newAnchorBody);
  console.log('Replaced anchor body (LF)');
} else {
  console.log('Warning: oldAnchorBody not matched');
}

// 4. On page load / hash check for #importer
const oldHashCheck = `  // --- Check URL Query Parameters for Tab & Preset Selection on Page Load ---`;
const newHashCheck = `  // --- Check URL Hash or Query Parameters for Tab & Preset Selection on Page Load ---
  if (typeof window !== 'undefined' && window.location.hash === '#importer') {
    switchTab('import');
    setTimeout(() => {
      (document.getElementById('importer') || document.getElementById('tab-view-import'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }`;

if (content.includes(oldHashCheck.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldHashCheck.replace(/\n/g, '\r\n'), newHashCheck.replace(/\n/g, '\r\n') + '\r\n  // --- Check URL Query Parameters for Tab & Preset Selection on Page Load ---');
  console.log('Added initial hash check (CRLF)');
} else if (content.includes(oldHashCheck)) {
  content = content.replace(oldHashCheck, newHashCheck + '\n  // --- Check URL Query Parameters for Tab & Preset Selection on Page Load ---');
  console.log('Added initial hash check (LF)');
}

fs.writeFileSync('src/components/MainApp.astro', content, 'utf8');
console.log('Updated MainApp.astro successfully.');

