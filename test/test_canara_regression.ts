import fs from 'fs';
import { parsePdfStatement } from '../src/utils/fileImporter';

async function testRegression() {
  const filePath = 'C:\\Users\\princ\\Downloads\\canara_epassbook_2026-09-24 20_49_34.797171.pdf';
  const buffer = fs.readFileSync(filePath);
  const file = new File([buffer], 'canara_epassbook.pdf', { type: 'application/pdf' });

  console.log('Testing file:', filePath);
  const result = await parsePdfStatement(file);

  console.log('\n--- EXTRACTION RESULT ---');
  console.log('Success:', result.success);
  console.log('Transactions Count:', result.transactions.length);
  console.log('Detected Format:', result.detectedFormat);
  console.log('Account Info:', result.accountInfo);
  console.log('Summary:', result.summary);

  let totalCredit = 0;
  let totalDebit = 0;

  console.log('\n--- EXTRACTED TRANSACTIONS ---');
  result.transactions.forEach((tx, idx) => {
    if (tx.type === 'income') totalCredit += tx.amount;
    else totalDebit += tx.amount;
    console.log(`[${idx + 1}] Date: ${tx.date} | Type: ${tx.type.padEnd(7)} | Amt: ₹${tx.amount.toFixed(2).padStart(9)} | Desc: "${tx.name}"`);
  });

  console.log('\n--- TOTALS ---');
  console.log('Calculated Credits:', totalCredit.toFixed(2));
  console.log('Calculated Debits:', totalDebit.toFixed(2));
  console.log('Expected Credits: 47339.45');
  console.log('Expected Debits: 17099.18');
  console.log('Expected Opening: 5537.12');
  console.log('Expected Closing: 35777.39');
}

testRegression().catch(console.error);
