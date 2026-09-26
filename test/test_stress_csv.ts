import * as fs from 'fs';
import { parseCsvContent } from '../src/utils/fileImporter';

function runStressCsvTest() {
  const csvPath = 'C:\\Users\\princ\\Desktop\\test files\\STRESS TEST\\01_stress_transactions.csv';
  console.log(`Loading Stress CSV from: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const result = parseCsvContent(csvText, '01_stress_transactions.csv', 'INR');

  console.log('\n==========================================');
  console.log('ACTUAL STRESS CSV PARSE RESULTS:');
  console.log(`Total Extracted Transactions: ${result.recordCount}`);

  const incomeTxs = result.transactions.filter((t) => t.type === 'income');
  const expenseTxs = result.transactions.filter((t) => t.type === 'expense');

  console.log(`Income Count: ${incomeTxs.length}`);
  console.log(`Expense Count: ${expenseTxs.length}`);
  console.log(`Total Income (Inflow): ₹${result.totalInflow.toLocaleString('en-IN')}`);
  console.log(`Total Expenses (Outflow): ₹${result.totalAmount.toLocaleString('en-IN')}`);

  const netCashflow = result.totalInflow - result.totalAmount;
  console.log(`Net Cashflow: ₹${netCashflow.toLocaleString('en-IN')}`);

  console.log('\nALL 6 TRANSACTIONS:');
  result.transactions.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.date}] ${t.name.padEnd(35)} | Type: ${t.type.padEnd(7)} | Category: ${t.category.padEnd(18)} | Amount: ₹${t.amount}`);
  });

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ FAILED: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ ${msg}`);
    }
  };

  console.log('\n--- VERIFYING USER REQUIREMENTS ---');
  assert(result.recordCount === 6, `Expected 6 transactions, got ${result.recordCount}`);
  assert(result.totalInflow === 63250, `Expected Income = ₹63,250, got ₹${result.totalInflow}`);
  assert(result.totalAmount === 7120.5, `Expected Expenses = ₹7,120.50, got ₹${result.totalAmount}`);
  assert(netCashflow === 56129.5, `Expected Net = ₹56,129.50, got ₹${netCashflow}`);

  // Check specific transactions
  const salary = result.transactions.find((t) => t.name.includes('Salary'));
  assert(salary !== undefined && salary.amount === 62000 && salary.type === 'income', 'Salary = 62000.00 Income');

  const grocery = result.transactions.find((t) => t.name.includes('Fresh Basket'));
  assert(grocery !== undefined && grocery.amount === 2345.5 && grocery.type === 'expense' && grocery.category === 'Food', 'Fresh Basket = 2345.50 Expense Food');

  const cab = result.transactions.find((t) => t.name.includes('Airport Cab'));
  assert(cab !== undefined && cab.amount === 875 && cab.type === 'expense' && cab.category === 'Transport', 'Airport Cab = 875.00 Expense Transport');

  const cashback = result.transactions.find((t) => t.name.includes('Cashback'));
  assert(cashback !== undefined && cashback.amount === 1250 && cashback.type === 'income', 'Credit Card Cashback = 1250.00 Income');

  const elec = result.transactions.find((t) => t.name.includes('Electricity Bill'));
  assert(elec !== undefined && elec.amount === 2100 && elec.type === 'expense' && elec.category === 'Utilities', 'Electricity Bill = 2100.00 Expense Utilities');

  const gym = result.transactions.find((t) => t.name.includes('Gym Membership'));
  assert(gym !== undefined && gym.amount === 1800 && gym.type === 'expense' && gym.category === 'Health & Fitness', 'Gym Membership = 1800.00 Expense Health & Fitness');

  console.log('\n🎉 ALL CHECKS PASSED WITH 100% PRECISION!');
  console.log('==========================================\n');
}

runStressCsvTest();
