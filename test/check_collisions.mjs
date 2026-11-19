import fs from 'node:fs';
import path from 'node:path';

const bsContent = fs.readFileSync('src/components/bill-splitter/BillSplitterApp.astro', 'utf8');
const bsIds = [...bsContent.matchAll(/id=["']([a-zA-Z0-9_-]+)["']/g)].map(m => m[1]);

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!full.includes('bill-splitter')) results = results.concat(getAllFiles(full));
    } else if (full.endsWith('.astro')) {
      results.push(full);
    }
  });
  return results;
}

const otherFiles = getAllFiles('src/components');
const otherIds = new Map();
otherFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const ids = [...content.matchAll(/id=["']([a-zA-Z0-9_-]+)["']/g)].map(m => m[1]);
  ids.forEach(id => {
    if (!otherIds.has(id)) otherIds.set(id, []);
    otherIds.get(id).push(file);
  });
});

console.log('BillSplitterApp has', bsIds.length, 'unique alphanumeric IDs.');
const realCollisions = bsIds.filter(id => otherIds.has(id));
console.log('Real ID collisions with components outside bill-splitter:', realCollisions);
realCollisions.forEach(id => {
  console.log(`  ID "${id}" also exists in:`, otherIds.get(id));
});
