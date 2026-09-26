import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { matchHeaderRole } from '../src/utils/fileImporter';

async function inspectPdf() {
  const filePath = 'C:\\Users\\princ\\Desktop\\test files\\test_statement_september_2026.pdf';
  console.log(`Loading: ${filePath}`);
  const buffer = fs.readFileSync(filePath);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  console.log(`Pages: ${pdfDoc.numPages}`);

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    console.log(`Page ${p} items count: ${textContent.items.length}`);
    
    const pageCells: any[] = [];
    for (const item of textContent.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const str = item.str.trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      pageCells.push({ text: str, x, y, width: item.width || 0 });
    }

    pageCells.sort((a, b) => b.y - a.y);
    const pageRows: any[][] = [];

    for (const cell of pageCells) {
      const existing = pageRows.find((r) => Math.abs(r[0].y - cell.y) <= 7);
      if (existing) {
        existing.push(cell);
      } else {
        pageRows.push([cell]);
      }
    }

    for (let r = 0; r < pageRows.length; r++) {
      const row = pageRows[r];
      row.sort((a, b) => a.x - b.x);
      console.log(`Row ${r}:`);
      row.forEach(c => console.log(`   x=${c.x.toFixed(1)}, w=${c.width.toFixed(1)} -> "${c.text}" (role=${matchHeaderRole(c.text)})`));
    }
  }
}

inspectPdf();
