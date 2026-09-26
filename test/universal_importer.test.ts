import {
  matchHeaderRole,
  parseMonetaryAmount,
  parseFlexibleDate,
  normalizeDate,
  normalizeCategory,
  classifyTransactionType,
  isFooterOrSummaryLine,
  validateTransaction,
  deduplicateTransactions,
  detectCsvDelimiter,
  parseCsvContent,
  isGoogleSheetsUrl,
  extractGoogleSpreadsheetId
} from '../src/utils/fileImporter';
import { formatCurrency, type Transaction } from '../src/utils/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- RUNNING UNIVERSAL IMPORTER TEST SUITE ---\n');

// 1. Semantic Field Mapping Tests
console.log('1. Testing Semantic Field Mapping:');
assert(matchHeaderRole('Transaction Date') === 'date', 'Transaction Date maps to date');
assert(matchHeaderRole('Txn Date') === 'date', 'Txn Date maps to date');
assert(matchHeaderRole('Posting Date') === 'date', 'Posting Date maps to date');
assert(matchHeaderRole('Particulars') === 'description', 'Particulars maps to description');
assert(matchHeaderRole('Narration') === 'description', 'Narration maps to description');
assert(matchHeaderRole('Merchant') === 'description', 'Merchant maps to description');
assert(matchHeaderRole('Withdrawal') === 'debit', 'Withdrawal maps to debit');
assert(matchHeaderRole('Dr') === 'debit', 'Dr maps to debit');
assert(matchHeaderRole('Deposit') === 'credit', 'Deposit maps to credit');
assert(matchHeaderRole('Cr') === 'credit', 'Cr maps to credit');
assert(matchHeaderRole('Running Balance') === 'balance', 'Running Balance maps to balance');
assert(matchHeaderRole('Closing Balance') === 'balance', 'Closing Balance maps to balance');
assert(matchHeaderRole('Amount') === 'amount', 'Amount maps to amount');
assert(matchHeaderRole('Expense Category') === 'category', 'Expense Category maps to category');
assert(matchHeaderRole('Type') === 'txType', 'Type maps to txType');

// 2. Monetary Amount Parsing Tests
console.log('\n2. Testing Monetary Amount Parser:');
const amt1 = parseMonetaryAmount('₹650');
assert(amt1 !== null && amt1.amount === 650, '₹650 parses to 650');

const amt2 = parseMonetaryAmount('₹1,50,000.50');
assert(amt2 !== null && amt2.amount === 150000.5, 'Indian formatting 1,50,000.50 parses correctly');

const amt3 = parseMonetaryAmount('1.250,50');
assert(amt3 !== null && amt3.amount === 1250.5, 'European formatting 1.250,50 parses correctly');

const amt4 = parseMonetaryAmount('$1,250.00');
assert(amt4 !== null && amt4.amount === 1250, '$1,250.00 parses to 1250');

const amt5 = parseMonetaryAmount('(500.00)');
assert(amt5 !== null && amt5.amount === 500 && amt5.isNegative, '(500.00) is negative 500');

const amt6 = parseMonetaryAmount('750.00 CR');
assert(amt6 !== null && amt6.amount === 750 && amt6.isCredit, '750.00 CR is credit');

const amt7 = parseMonetaryAmount('350.00 DR');
assert(amt7 !== null && amt7.amount === 350 && amt7.isDebit, '350.00 DR is debit');

// 3. Flexible Date Parsing Tests
console.log('\n3. Testing Date Parser:');
assert(parseFlexibleDate('30 Sep 2026') === '2026-09-30', '30 Sep 2026 normalizes to 2026-09-30');
assert(parseFlexibleDate('01/09/2026') === '2026-09-01', '01/09/2026 normalizes to 2026-09-01');
assert(parseFlexibleDate('2026-09-15') === '2026-09-15', 'ISO date normalizes to 2026-09-15');
assert(parseFlexibleDate('Sep 05, 2026') === '2026-09-05', 'Sep 05, 2026 normalizes to 2026-09-05');

// 4. Regression Test for the 25-Row Statement
console.log('\n4. Testing 25-Row Statement Dataset (5 Income, 20 Expense):');
// Let's create the 25 transactions as CSV data mirroring the exact statement structure
const test25Csv = `Date,Description,Category,Type,Amount
01 Sep 2026,Salary Direct Deposit,Salary,Income,₹55000
05 Sep 2026,House Rent Payment,Housing,Expense,₹18000
07 Sep 2026,Freelance Client Retainer,Freelance,Income,₹10000
08 Sep 2026,Supermarket Grocery,Food,Expense,₹3500
10 Sep 2026,Electricity & Power Bill,Utilities,Expense,₹2400
11 Sep 2026,High Speed Internet Fiber,Utilities,Expense,₹1200
12 Sep 2026,Stock Dividend Payout,Investments,Income,₹2500
14 Sep 2026,Metro Card Recharge,Transport,Expense,₹800
15 Sep 2026,Dining Out Restaurant,Food,Expense,₹1850
16 Sep 2026,Movie Tickets & Popcorn,Entertainment,Expense,₹650
18 Sep 2026,Fuel Petrol Station,Transport,Expense,₹2200
19 Sep 2026,Coffee & Cafe Snacks,Food,Expense,₹450
20 Sep 2026,Savings Auto-Transfer,Savings,Expense,₹2550
21 Sep 2026,Mobile Prepaid Recharge,Utilities,Expense,₹599
22 Sep 2026,Cashback Rewards,Rewards,Income,₹425
23 Sep 2026,Pharmacy Medicines,Health,Expense,₹650
24 Sep 2026,Streaming Subscription,Entertainment,Expense,₹499
25 Sep 2026,Gym Membership Fee,Health,Expense,₹1500
26 Sep 2026,Bookstore Purchase,Education,Expense,₹450
27 Sep 2026,Ride Share Taxi,Transport,Expense,₹353
28 Sep 2026,Office Supplies Stationery,Office,Expense,₹250
29 Sep 2026,Bank Account Interest,Interest,Income,₹1000
30 Sep 2026,Dry Cleaning Laundry,Services,Expense,₹450
30 Sep 2026,Miscellaneous,Miscellaneous,Expense,₹650
30 Sep 2026,Pet Supplies Store,Pets,Expense,₹100`;

const parsedStatement = parseCsvContent(test25Csv, 'statement_september.csv', 'INR');

assert(parsedStatement.recordCount === 25, `Expected 25 total transactions, got ${parsedStatement.recordCount}`);

const incomeTxs = parsedStatement.transactions.filter((t) => t.type === 'income');
const expenseTxs = parsedStatement.transactions.filter((t) => t.type === 'expense');

assert(incomeTxs.length === 5, `Expected 5 income transactions, got ${incomeTxs.length}`);
assert(expenseTxs.length === 20, `Expected 20 expense transactions, got ${expenseTxs.length}`);

assert(parsedStatement.totalInflow === 68925, `Expected Income = ₹68,925, got ${parsedStatement.totalInflow}`);
assert(parsedStatement.totalAmount === 39101, `Expected Expenses = ₹39,101, got ${parsedStatement.totalAmount}`);

assert(parsedStatement.topCategory?.category === 'Housing', `Expected top category = Housing, got ${parsedStatement.topCategory?.category}`);
assert(parsedStatement.topCategory?.amount === 18000, `Expected Housing amount = 18,000, got ${parsedStatement.topCategory?.amount}`);

// Check the exact 30 Sep ₹650 row
const miscTx = parsedStatement.transactions.find((t) => t.date === '2026-09-30' && t.name === 'Miscellaneous');
assert(miscTx !== undefined, 'Found 30 Sep 2026 Miscellaneous transaction');
assert(miscTx?.amount === 650, `Amount MUST be 650, got ${miscTx?.amount} (NOT 30!)`);
assert(miscTx?.type === 'expense', `Type MUST be expense, got ${miscTx?.type}`);

// 5. Debit / Credit Column CSV Test
console.log('\n5. Testing Debit / Credit Split Columns:');
const debitCreditCsv = `Date,Narration,Withdrawal,Deposit,Balance
2026-09-01,Opening Balance,,,10000
2026-09-02,Client Payment,,5000,15000
2026-09-03,Grocery Store,1200,,13800
2026-09-04,ATM Cash,2000,,11800`;

const dcParsed = parseCsvContent(debitCreditCsv, 'bank_statement.csv', 'INR');
assert(dcParsed.recordCount === 3, `Expected 3 records (excluding empty row), got ${dcParsed.recordCount}`);
const clientTx = dcParsed.transactions.find((t) => t.name === 'Client Payment');
assert(clientTx?.type === 'income' && clientTx?.amount === 5000, 'Client Payment is Income 5000');
const groceryTx = dcParsed.transactions.find((t) => t.name === 'Grocery Store');
assert(groceryTx?.type === 'expense' && groceryTx?.amount === 1200, 'Grocery Store is Expense 1200');

// 6. CSV Delimiter Detection (Semicolon & European Decimals)
console.log('\n6. Testing Semicolon CSV with European Decimals:');
const euroCsv = `Txn Date;Particulars;Category;Value
01.09.2026;Office Lease;Housing;1.250,50
02.09.2026;Client Invoice;Savings;2.500,00`;

assert(detectCsvDelimiter(euroCsv) === ';', 'Semicolon delimiter auto-detected');
const euroParsed = parseCsvContent(euroCsv, 'euro.csv', 'EUR');
assert(euroParsed.recordCount === 2, `Parsed 2 European records, got ${euroParsed.recordCount}`);
assert(euroParsed.transactions[0].amount === 2500 || euroParsed.transactions[1].amount === 2500, 'Parsed 2.500,00 as 2500');

// 7. Google Sheets URL Validation
console.log('\n7. Testing Google Sheets URL Detection:');
const gsUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
assert(isGoogleSheetsUrl(gsUrl), 'Detected Google Sheets URL');
const meta = extractGoogleSpreadsheetId(gsUrl);
assert(meta?.spreadsheetId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Extracted spreadsheet ID correctly');
assert(meta?.gid === '0', 'Extracted sheet GID correctly');

// 8. Deduplication Tests
console.log('\n8. Testing Deduplication Layer:');
const dupList: Transaction[] = [
  { id: '1', date: '2026-09-30', name: 'Miscellaneous', category: 'Miscellany', type: 'expense', amount: 650, source: 'imported' },
  { id: '2', date: '2026-09-30', name: 'Miscellaneous', category: 'Miscellany', type: 'expense', amount: 650, source: 'imported' },
  { id: '3', date: '2026-09-30', name: 'Another Expense', category: 'Miscellany', type: 'expense', amount: 650, source: 'imported' }
];
const deduped = deduplicateTransactions(dupList);
assert(deduped.length === 2, `Expected 2 unique transactions after deduplication, got ${deduped.length}`);

// 9. Validation Tests
console.log('\n9. Testing Validation Layer:');
const validTx: Transaction = { id: 'v1', date: '2026-09-30', name: 'Legitimate Item', category: 'Food', type: 'expense', amount: 650, source: 'imported' };
assert(validateTransaction(validTx, '30 Sep 2026 Legitimate Item Food Expense ₹650').isValid, 'Valid transaction passes');

const suspiciousTx: Transaction = { id: 's1', date: '2026-09-30', name: 'Suspicious Item', category: 'Food', type: 'expense', amount: 30, source: 'imported' };
const suspCheck = validateTransaction(suspiciousTx, '30 Sep 2026 Suspicious Item Food Expense ₹650');
assert(!suspCheck.isValid, 'Suspicious transaction where amount equals date day (30) while 650 is present fails validation');

const footerTx: Transaction = { id: 'f1', date: '2026-09-30', name: 'Page 1 of 3 - Computer Generated Statement', category: 'Miscellany', type: 'expense', amount: 100, source: 'imported' };
assert(!validateTransaction(footerTx).isValid, 'Footer/summary text line fails validation');

// 10. Spatial PDF Coordinate Zone Mapping Test
console.log('\n10. Testing Spatial PDF Coordinate Zone Mapping:');
const headers = [
  { text: 'Date', x: 50, width: 30, role: matchHeaderRole('Date') },
  { text: 'Description', x: 150, width: 60, role: matchHeaderRole('Description') },
  { text: 'Category', x: 280, width: 50, role: matchHeaderRole('Category') },
  { text: 'Type', x: 380, width: 30, role: matchHeaderRole('Type') },
  { text: 'Amount', x: 480, width: 40, role: matchHeaderRole('Amount') }
];

const sortedHeaders = headers.sort((a, b) => a.x - b.x);
const columnZones = sortedHeaders.map((h, idx) => {
  const prev = sortedHeaders[idx - 1];
  const next = sortedHeaders[idx + 1];
  const xStart = prev ? (prev.x + prev.width + h.x) / 2 : 0;
  const xEnd = next ? (h.x + h.width + next.x) / 2 : 99999;
  return {
    role: h.role,
    xStart,
    xEnd,
    centerX: h.x + h.width / 2
  };
});

// A row from the PDF where Date contains day 30, and Amount is ₹650
const rowCells = [
  { text: '30 Sep 2026', x: 50, width: 65 },
  { text: 'Miscellaneous', x: 150, width: 70 },
  { text: 'Miscellaneous', x: 280, width: 70 },
  { text: 'Expense', x: 380, width: 40 },
  { text: '₹650', x: 480, width: 35 }
];

const colCells: Record<string, string[]> = {
  date: [], description: [], category: [], txType: [], amount: []
};

for (const cell of rowCells) {
  const cx = cell.x + cell.width / 2;
  const matchedZone = columnZones.find((z) => cx >= z.xStart && cx < z.xEnd);
  if (matchedZone) {
    colCells[matchedZone.role].push(cell.text);
  }
}

assert(colCells.date.join(' ') === '30 Sep 2026', 'Date column received 30 Sep 2026');
assert(colCells.amount.join(' ') === '₹650', 'Amount column received ₹650');
const extractedAmt = parseMonetaryAmount(colCells.amount.join(' '));
assert(extractedAmt?.amount === 650, `Amount extracted from Amount column is 650 (NOT 30!)`);
assert(extractedAmt?.amount !== 30, 'Amount is strictly NOT the date day 30');

console.log('\n==========================================');
console.log('🎉 ALL TEST SUITE ASSERTIONS PASSED!');
console.log('==========================================\n');
