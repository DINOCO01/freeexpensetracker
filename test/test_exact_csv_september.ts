import * as fs from 'fs';
import { parseCsvContent } from '../src/utils/fileImporter';

function runExactCsvTest() {
  const csvPath = 'C:\\Users\\princ\\Desktop\\test files\\test_transactions_september_2026.csv';
  console.log(`Loading CSV from: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const result = parseCsvContent(csvText, 'test_transactions_september_2026.csv', 'INR');

  console.log('\n==========================================');
  console.log('ACTUAL CSV PARSE RESULTS:');
  console.log(`Total Extracted Transactions: ${result.recordCount}`);

  const incomeTxs = result.transactions.filter((t) => t.type === 'income');
  const expenseTxs = result.transactions.filter((t) => t.type === 'expense');

  console.log(`Income Transactions Count: ${incomeTxs.length}`);
  console.log(`Expense Transactions Count: ${expenseTxs.length}`);
  console.log(`Total Income (Inflow): ₹${result.totalInflow.toLocaleString('en-IN')}`);
  console.log(`Total Expenses (Outflow): ₹${result.totalAmount.toLocaleString('en-IN')}`);

  const netCashflow = result.totalInflow - result.totalAmount;
  console.log(`Net Cashflow: ₹${netCashflow.toLocaleString('en-IN')}`);

  console.log('\n--- INCOME TRANSACTIONS ---');
  incomeTxs.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.date}] ${t.name.padEnd(20)} | Type: ${t.type.padEnd(7)} | Category: ${t.category.padEnd(10)} | Amount: ₹${t.amount}`);
  });

  console.log('\n--- EXPENSE TRANSACTIONS ---');
  expenseTxs.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.date}] ${t.name.padEnd(25)} | Type: ${t.type.padEnd(7)} | Category: ${t.category.padEnd(14)} | Amount: ₹${t.amount}`);
  });

  // Strict Assertions
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ FAILED ASSERTION: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ ${msg}`);
    }
  };

  console.log('\n--- VERIFYING EXACT REQUIREMENTS ---');
  assert(result.recordCount === 15, `Expected 15 transactions, got ${result.recordCount}`);
  assert(result.totalInflow === 66925, `Expected Total Income = ₹66,925, got ₹${result.totalInflow}`);
  assert(result.totalAmount === 29168, `Expected Total Expenses = ₹29,168, got ₹${result.totalAmount}`);
  assert(netCashflow === 37757, `Expected Net Cashflow = ₹37,757, got ₹${netCashflow}`);

  const salaryCredit = result.transactions.find((t) => t.name.includes('Salary Credit'));
  assert(salaryCredit?.type === 'income' && salaryCredit?.amount === 55000, 'Salary Credit ₹55,000 is Income');

  const freelance1 = result.transactions.find((t) => t.date === '2026-09-05' && t.name.includes('Freelance Payment'));
  assert(freelance1?.type === 'income' && freelance1?.amount === 7500, '2026-09-05 Freelance Payment ₹7,500 is Income');

  const freelance2 = result.transactions.find((t) => t.date === '2026-09-17' && t.name.includes('Freelance Payment'));
  assert(freelance2?.type === 'income' && freelance2?.amount === 4000, '2026-09-17 Freelance Payment ₹4,000 is Income');

  const bankInterest = result.transactions.find((t) => t.name.includes('Bank Interest'));
  assert(bankInterest?.type === 'income' && bankInterest?.amount === 425, 'Bank Interest ₹425 is Income');

  console.log('\n🎉 ALL 15 TRANSACTIONS & FINANCIAL TOTALS MATCHED 100%!');
  console.log('==========================================\n');
}

runExactCsvTest();
