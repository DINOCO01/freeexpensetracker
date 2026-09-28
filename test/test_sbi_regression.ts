import fs from 'fs';
import { parsePdfStatement } from '../src/utils/fileImporter';

async function testSbi() {
  const filePath = 'C:\\Users\\princ\\Downloads\\SBI_statement_testing_sample.pdf';
  const buffer = fs.readFileSync(filePath);
  const file = new File([buffer], 'SBI_statement_testing_sample.pdf', { type: 'application/pdf' });

  const res = await parsePdfStatement(file);
  console.log(`\n=== SBI EXTRACTION RESULT ===`);
  console.log(`Count: ${res.transactions.length}`);
  console.log(`Reconciliation:`, res.reconciliation);

  let totalCredit = 0;
  let totalDebit = 0;

  res.transactions.forEach((tx, idx) => {
    if (tx.type === 'income') totalCredit += tx.amount;
    else totalDebit += tx.amount;
    console.log(`[${idx + 1}] Date: ${tx.date} | Type: ${tx.type.padEnd(7)} | Amt: ₹${tx.amount.toFixed(2).padStart(10)} | Desc: "${tx.name}"`);
  });

  console.log('\n--- TOTALS ---');
  console.log('Total Credits:', totalCredit.toFixed(2), '(Expected: 44012.50)');
  console.log('Total Debits:', totalDebit.toFixed(2), '(Expected: 42778.00)');
  console.log('Net Cashflow:', (totalCredit - totalDebit).toFixed(2), '(Expected: 1234.50)');
}

testSbi().catch(console.error);
