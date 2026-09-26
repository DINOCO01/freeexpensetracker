import * as fs from 'fs';
import * as path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  parsePdfStatement,
  parseExcelFile,
  parseCsvContent,
  parseAndInterpretMultipleFiles
} from '../src/utils/fileImporter';
import { formatCurrency } from '../src/utils/calculations';

// Node.js File polyfill if needed
class NodeFile {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;

  constructor(buffer: Buffer, name: string, type: string = '') {
    this.buffer = buffer;
    this.name = name;
    this.size = buffer.length;
    this.type = type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
  }

  async text(): Promise<string> {
    return this.buffer.toString('utf-8');
  }
}

async function runVerification() {
  console.log('========================================================');
  console.log('ACTUAL VERIFICATION ON REAL SYSTEM & USER FILES');
  console.log('========================================================\n');

  // --- TEST 2: The actual user PDF file ---
  const pdfPath = 'C:\\Users\\princ\\Desktop\\SevenXI - Income & Exp.pdf';
  console.log(`Checking PDF file at: ${pdfPath}`);

  if (fs.existsSync(pdfPath)) {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfFile = new NodeFile(pdfBuffer, 'SevenXI - Income & Exp.pdf', 'application/pdf') as any as File;
    
    console.log('Running parse on actual PDF file with legacy pdfjs...');
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
      const pdfDoc = await loadingTask.promise;
      console.log(`PDF Pages: ${pdfDoc.numPages}`);
      
      const allPageRows: { page: number; cells: any[]; rowText: string; y: number }[] = [];
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
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
          const existing = pageRows.find(r => Math.abs(r[0].y - cell.y) <= 7);
          if (existing) existing.push(cell);
          else pageRows.push([cell]);
        }
        for (const row of pageRows) {
          row.sort((a, b) => a.x - b.x);
          allPageRows.push({
            page: p,
            cells: row,
            rowText: row.map(c => c.text).join(' '),
            y: row[0].y
          });
        }
      }
      console.log(`Extracted total rows from PDF: ${allPageRows.length}`);
      console.log('Sample rows:');
      allPageRows.slice(0, 10).forEach(r => console.log('  ROW:', r.rowText));
      allPageRows.slice(-6).forEach(r => console.log('  ROW:', r.rowText));
    } catch (err: any) {
      console.error('PDF parsing error:', err);
    }
  } else {
    console.log('PDF file not found at path');
  }

  // --- TEST 3: The actual Excel file ---
  const xlsxPath = 'C:\\Users\\princ\\Desktop\\SevenXI.xlsx';
  console.log(`\n\nChecking Excel file at: ${xlsxPath}`);
  if (fs.existsSync(xlsxPath)) {
    const xlsxBuffer = fs.readFileSync(xlsxPath);
    const xlsxFile = new NodeFile(xlsxBuffer, 'SevenXI.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') as any as File;
    try {
      const xlsxResult = await parseExcelFile(xlsxFile, 'INR');
      console.log('--- ACTUAL EXCEL EXTRACTION RESULTS ---');
      console.log(`Total Extracted Transactions: ${xlsxResult.recordCount}`);
      console.log(`Total Inflow: ₹${xlsxResult.totalInflow.toLocaleString()}`);
      console.log(`Total Outflow: ₹${xlsxResult.totalAmount.toLocaleString()}`);
      console.log(`Top Category: ${xlsxResult.topCategory?.category} (₹${xlsxResult.topCategory?.amount?.toLocaleString()})`);
      console.log('Sample rows:', xlsxResult.transactions.slice(0, 3).map(t => `${t.date} ${t.name}: ₹${t.amount} (${t.type})`));
    } catch (err: any) {
      console.error('Excel parsing error:', err);
    }
  } else {
    console.log('Excel file not found');
  }

  // --- TEST 4: CSV Test ---
  console.log('\n\n--- ACTUAL CSV TEST ---');
  const sampleCsv = `Date,Description,Category,Type,Amount
2026-09-01,Salary Deposit,Salary,Income,55000
2026-09-05,Apartment Rent,Housing,Expense,18000
2026-09-30,Miscellaneous Services,Miscellany,Expense,650`;
  const csvResult = parseCsvContent(sampleCsv, 'actual_test.csv', 'INR');
  console.log(`CSV Extracted: ${csvResult.recordCount} rows`);
  console.log(`CSV Total Inflow: ₹${csvResult.totalInflow}, Total Outflow: ₹${csvResult.totalAmount}`);
  csvResult.transactions.forEach(t => console.log(`  - ${t.date} | ${t.name} | ${t.type} | ₹${t.amount}`));

  // --- TEST 7: Currency Selector Test (INR, USD, EUR, GBP) ---
  console.log('\n\n--- CURRENCY FORMATTING TEST ---');
  const testVal = 650;
  console.log(`Amount: ${testVal}`);
  console.log(`INR: ${formatCurrency(testVal, 'INR')}`);
  console.log(`USD: ${formatCurrency(testVal, 'USD')}`);
  console.log(`EUR: ${formatCurrency(testVal, 'EUR')}`);
  console.log(`GBP: ${formatCurrency(testVal, 'GBP')}`);
}

runVerification();
