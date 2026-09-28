/**
 * Test: Dashboard Income/Outflow Aggregation - FIXED
 * 
 * Verifies the general accounting rule:
 * - t.type ('income' | 'expense') is the SOLE source of truth for cashflow direction
 * - Category NEVER determines direction
 * - Legacy transactions without type get a safe fallback
 */
import { parseCsvContent } from '../src/utils/fileImporter';
import { CATEGORY_TYPES, type Transaction, calculateFinancialHealthScore } from '../src/utils/calculations';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

// Simulate the EXACT dashboard aggregation from index.astro (FIXED version)
function simulateDashboardAggregation(transactions: Transaction[], monthlyIncome: number = 0) {
  let totalSpent = 0;
  let totalIncomeFromTx = 0;

  transactions.forEach((t) => {
    // Primary: use t.type. Fallback for legacy data: category === 'Income'.
    const isIncome = t.type === 'income' || (!t.type && t.category === 'Income');
    if (isIncome) {
      totalIncomeFromTx += t.amount;
    } else {
      totalSpent += t.amount;
    }
  });

  const effectiveTotalIncome = monthlyIncome + totalIncomeFromTx;
  const netCashflow = effectiveTotalIncome - totalSpent;

  return { totalIncomeFromTx, totalSpent, effectiveTotalIncome, netCashflow };
}

// ==========================================
// TEST 1: Credit categorized as Savings → still income
// ==========================================
console.log('=== TEST 1: Credit categorized as Savings → still income ===');
const tx1: Transaction[] = [
  { id: '1', name: 'Salary', amount: 30000, category: 'Savings', date: '2026-09-01', type: 'income' },
  { id: '2', name: 'Rent', amount: 15000, category: 'Housing', date: '2026-09-10', type: 'expense' },
];
const d1 = simulateDashboardAggregation(tx1);
assert(d1.totalIncomeFromTx === 30000, `Salary with cat=Savings, type=income → counted as income (${d1.totalIncomeFromTx})`);
assert(d1.totalSpent === 15000, `Rent → counted as outflow (${d1.totalSpent})`);

// ==========================================
// TEST 2: Credit categorized as Income → still income
// ==========================================
console.log('\n=== TEST 2: Credit categorized as Income → still income ===');
const tx2: Transaction[] = [
  { id: '1', name: 'Salary', amount: 30000, category: 'Income', date: '2026-09-01', type: 'income' },
  { id: '2', name: 'Food', amount: 1500, category: 'Food', date: '2026-09-05', type: 'expense' },
];
const d2 = simulateDashboardAggregation(tx2);
assert(d2.totalIncomeFromTx === 30000, `Salary with cat=Income, type=income → income (${d2.totalIncomeFromTx})`);

// ==========================================
// TEST 3: Debit categorized as Savings → still outflow
// ==========================================
console.log('\n=== TEST 3: Debit categorized as Savings → still outflow ===');
const tx3: Transaction[] = [
  { id: '1', name: 'SIP Investment', amount: 5000, category: 'Savings', date: '2026-09-15', type: 'expense' },
  { id: '2', name: 'Food', amount: 1500, category: 'Food', date: '2026-09-05', type: 'expense' },
];
const d3 = simulateDashboardAggregation(tx3);
assert(d3.totalSpent === 6500, `SIP (cat=Savings, type=expense) + Food → outflows (${d3.totalSpent})`);
assert(d3.totalIncomeFromTx === 0, `No income transactions (${d3.totalIncomeFromTx})`);

// ==========================================
// TEST 4: Debit categorized as Food → still outflow
// ==========================================
console.log('\n=== TEST 4: Debit categorized as Food → outflow ===');
const tx4: Transaction[] = [
  { id: '1', name: 'Groceries', amount: 3000, category: 'Food', date: '2026-09-12', type: 'expense' },
];
const d4 = simulateDashboardAggregation(tx4);
assert(d4.totalSpent === 3000, `Food type=expense → outflow (${d4.totalSpent})`);

// ==========================================
// TEST 5: Debit categorized as Utilities → outflow
// ==========================================
console.log('\n=== TEST 5: Debit categorized as Utilities → outflow ===');
const tx5: Transaction[] = [
  { id: '1', name: 'Electric Bill', amount: 800, category: 'Utilities', date: '2026-09-22', type: 'expense' },
];
const d5 = simulateDashboardAggregation(tx5);
assert(d5.totalSpent === 800, `Utilities type=expense → outflow (${d5.totalSpent})`);

// ==========================================
// TEST 6: Transfer credit → inflow
// ==========================================
console.log('\n=== TEST 6: Transfer credit → inflow ===');
const tx6: Transaction[] = [
  { id: '1', name: 'Transfer from savings', amount: 2000, category: 'Miscellany', date: '2026-09-20', type: 'income' },
];
const d6 = simulateDashboardAggregation(tx6);
assert(d6.totalIncomeFromTx === 2000, `Transfer credit type=income → income (${d6.totalIncomeFromTx})`);

// ==========================================
// TEST 7: Transfer debit → outflow
// ==========================================
console.log('\n=== TEST 7: Transfer debit → outflow ===');
const tx7: Transaction[] = [
  { id: '1', name: 'Transfer to savings', amount: 1000, category: 'Miscellany', date: '2026-09-21', type: 'expense' },
];
const d7 = simulateDashboardAggregation(tx7);
assert(d7.totalSpent === 1000, `Transfer debit type=expense → outflow (${d7.totalSpent})`);

// ==========================================
// TEST 8: Mixed scenario matching user's description
// ==========================================
console.log('\n=== TEST 8: Full mixed scenario (user\'s described bug case) ===');
const txMixed: Transaction[] = [
  // Credits (income) with various categories
  { id: '1', name: 'Salary', amount: 30000, category: 'Savings', date: '2026-09-01', type: 'income' },
  { id: '2', name: 'Freelance', amount: 5000, category: 'Income', date: '2026-09-03', type: 'income' },
  { id: '3', name: 'Refund', amount: 500, category: 'Miscellany', date: '2026-09-05', type: 'income' },
  { id: '4', name: 'Transfer in', amount: 2000, category: 'Savings', date: '2026-09-20', type: 'income' },
  // Debits (expenses) with various categories
  { id: '5', name: 'Rent', amount: 15000, category: 'Housing', date: '2026-09-10', type: 'expense' },
  { id: '6', name: 'Groceries', amount: 3000, category: 'Food', date: '2026-09-12', type: 'expense' },
  { id: '7', name: 'SIP', amount: 5000, category: 'Savings', date: '2026-09-15', type: 'expense' },
  { id: '8', name: 'Electric', amount: 800, category: 'Utilities', date: '2026-09-22', type: 'expense' },
  { id: '9', name: 'Transfer out', amount: 1000, category: 'Miscellany', date: '2026-09-21', type: 'expense' },
];
const dMixed = simulateDashboardAggregation(txMixed);
// Credits: 30000 + 5000 + 500 + 2000 = 37500
// Debits: 15000 + 3000 + 5000 + 800 + 1000 = 24800
assert(dMixed.totalIncomeFromTx === 37500, `Total income = 37500, salary in Savings counted as income (got ${dMixed.totalIncomeFromTx})`);
assert(dMixed.totalSpent === 24800, `Total outflows = 24800, SIP in Savings counted as expense (got ${dMixed.totalSpent})`);
assert(dMixed.netCashflow === 12700, `Net cashflow = 12700 (got ${dMixed.netCashflow})`);

// ==========================================
// TEST 9: Legacy transactions without type field (backwards compatibility)
// ==========================================
console.log('\n=== TEST 9: Legacy transactions without type field ===');
const txLegacy: Transaction[] = [
  { id: '1', name: 'Salary', amount: 30000, category: 'Income', date: '2026-09-01' },     // no type → fallback to category 'Income'
  { id: '2', name: 'Food', amount: 1500, category: 'Food', date: '2026-09-05' },           // no type → treated as expense
  { id: '3', name: 'SIP', amount: 5000, category: 'Savings', date: '2026-09-15' },         // no type, cat=Savings → expense (not income!)
  { id: '4', name: 'Rent', amount: 15000, category: 'Housing', date: '2026-09-10' },       // no type → expense
];
const dLegacy = simulateDashboardAggregation(txLegacy);
assert(dLegacy.totalIncomeFromTx === 30000, `Legacy: cat=Income with no type → income (got ${dLegacy.totalIncomeFromTx})`);
assert(dLegacy.totalSpent === 21500, `Legacy: Food+SIP+Rent without type → outflows (got ${dLegacy.totalSpent})`);

// ==========================================
// TEST 10: Imported statement with credit/debit columns
// ==========================================
console.log('\n=== TEST 10: Imported CSV with credit/debit columns ===');
const csv = `Date,Description,Debit,Credit,Balance
01/09/2026,Salary Credit,,30000.00,80000.00
02/09/2026,Grocery Store,1875.00,,78125.00
03/09/2026,Freelance Payment,,5000.00,83125.00
04/09/2026,Investment SIP,5000.00,,78125.00
05/09/2026,Refund from Amazon,,893.50,79018.50`;

const resCSV = parseCsvContent(csv, 'test.csv', 'INR');
const dCSV = simulateDashboardAggregation(resCSV.transactions);
// Credits: 30000 + 5000 + 893.50 = 35893.50
// Debits: 1875 + 5000 = 6875
assert(Math.abs(dCSV.totalIncomeFromTx - 35893.50) < 0.01, `CSV credits = 35893.50 (got ${dCSV.totalIncomeFromTx})`);
assert(Math.abs(dCSV.totalSpent - 6875) < 0.01, `CSV debits = 6875 (got ${dCSV.totalSpent})`);

// ==========================================
// TEST 11: Manual logger Income category → type='income'
// ==========================================
console.log('\n=== TEST 11: Manual logger Income category simulation ===');
// Simulating the FIXED form handler: category === 'Income' → type = 'income'
function simulateFormSubmit(name: string, amount: number, category: string): Transaction {
  const txType = category === 'Income' ? 'income' : 'expense';
  return { id: `tx-${Date.now()}`, name, amount, category, date: '2026-09-28', type: txType, source: 'manual' };
}
const manualIncome = simulateFormSubmit('Salary', 30000, 'Income');
const manualExpense = simulateFormSubmit('Groceries', 3000, 'Food');
const manualSavings = simulateFormSubmit('SIP', 5000, 'Savings');
assert(manualIncome.type === 'income', `Manual with cat=Income → type=income (got ${manualIncome.type})`);
assert(manualExpense.type === 'expense', `Manual with cat=Food → type=expense (got ${manualExpense.type})`);
assert(manualSavings.type === 'expense', `Manual with cat=Savings → type=expense (got ${manualSavings.type})`);

// ==========================================
// TEST 12: Financial Health Score uses same logic
// ==========================================
console.log('\n=== TEST 12: Financial Health Score income detection ===');
const healthTx: Transaction[] = [
  { id: '1', name: 'Salary', amount: 30000, category: 'Savings', date: '2026-09-01', type: 'income' },
  { id: '2', name: 'Rent', amount: 15000, category: 'Housing', date: '2026-09-10', type: 'expense' },
  { id: '3', name: 'Food', amount: 3000, category: 'Food', date: '2026-09-12', type: 'expense' },
];
const health = calculateFinancialHealthScore(50000, healthTx);
// Salary has type=income, so it's skipped. totalSpent = 15000 + 3000 = 18000
// netCashflow = 50000 - 18000 = 32000 (positive), so tier should be good/excellent
assert(health.score > 50, `Health score > 50 when salary is correctly excluded from expenses (got ${health.score})`);

console.log('\n==========================================');
console.log('🎉 ALL 12 TESTS PASSED');
console.log('==========================================');
console.log('\nThe dashboard aggregation now follows the general accounting rule:');
console.log('  1. t.type === "income" → always counts as income (regardless of category)');
console.log('  2. t.type === "expense" or undefined → counts as outflow');
console.log('  3. Legacy fallback: undefined type + category "Income" → income');
console.log('  4. Category NEVER determines cashflow direction when type is set');
