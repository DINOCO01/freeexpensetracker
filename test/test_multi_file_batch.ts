import * as fs from 'fs';
import { parseCsvContent, parseExcelFile, parseAndInterpretMultipleFiles, deduplicateTransactions } from '../src/utils/fileImporter';
import { formatCurrency, type Transaction } from '../src/utils/calculations';
import * as XLSX from 'xlsx';

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

async function testMultiFileBatch() {
  console.log('--- RUNNING MULTI-FILE BATCH TEST ---');

  // File 1: CSV Statement
  const csvContent = `Date,Description,Category,Type,Amount
2026-09-01,Tech Consulting Client,Freelance,Income,45000
2026-09-05,Coworking Space Rent,Housing,Expense,12000
2026-09-12,High Speed Fiber Internet,Utilities,Expense,1500`;
  const file1 = new NodeFile(Buffer.from(csvContent, 'utf-8'), 'batch_september.csv', 'text/csv') as any as File;

  // File 2: Excel Statement
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Posting Date', 'Particulars', 'Debit', 'Credit', 'Balance'],
    ['2026-09-02', 'Salary Advance', '', '25000', '25000'],
    ['2026-09-08', 'Supermarket Mart', '4500', '', '20500'],
    ['2026-09-15', 'Flight Ticket', '7800', '', '12700']
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'SeptemberTransactions');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const file2 = new NodeFile(xlsxBuf, 'batch_bank_statement.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') as any as File;

  // Test individual extractions
  const res1 = parseCsvContent(csvContent, 'batch_september.csv', 'INR');
  const res2 = await parseExcelFile(file2, 'INR');

  console.log(`File 1 (CSV): ${res1.recordCount} records, Inflow=₹${res1.totalInflow}, Outflow=₹${res1.totalAmount}`);
  console.log(`File 2 (Excel): ${res2.recordCount} records, Inflow=₹${res2.totalInflow}, Outflow=₹${res2.totalAmount}`);

  // Combine and deduplicate
  const combinedTxs = [...res1.transactions, ...res2.transactions];
  const deduped = deduplicateTransactions(combinedTxs);

  console.log(`Total Combined Records: ${combinedTxs.length}`);
  console.log(`Deduplicated Records: ${deduped.length}`);

  let totalInflow = 0;
  let totalOutflow = 0;
  for (const t of deduped) {
    if (t.type === 'income') totalInflow += t.amount;
    else totalOutflow += t.amount;
  }

  console.log(`Batch Total Inflow: ₹${totalInflow.toLocaleString()}`);
  console.log(`Batch Total Outflow: ₹${totalOutflow.toLocaleString()}`);

  console.log('\nExtracted Transactions in Combined Batch:');
  deduped.forEach((t, i) => {
    console.log(`  ${i+1}. [${t.date}] ${t.name.padEnd(25)} | ${t.type.padEnd(7)} | ₹${t.amount} | File: ${t.sourceFile}`);
  });
}

testMultiFileBatch();
