import {
  matchHeaderRole,
  parseMonetaryAmount,
  parseFlexibleDate,
  normalizeDate,
  detectDateConvention,
  cleanTransactionDescription,
  isOpeningOrClosingBalanceLine,
  isFooterOrSummaryLine,
  processTabularStatement,
  parseTextStatementLines,
  parseCsvContent,
  deduplicateTransactions,
  validateTransaction
} from '../src/utils/fileImporter';
import { type Transaction } from '../src/utils/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- RUNNING BANK-AGNOSTIC STATEMENT IMPORTER TESTS (TESTS A - L) ---\n');

// ==========================================
// TEST A: Date + Description + Debit + Credit + Balance
// ==========================================
console.log('TEST A: Date + Description + Debit + Credit + Balance');
const csvA = `Date,Description,Debit,Credit,Balance
01/09/2026,Opening Balance,,,50000.00
02/09/2026,Salary Credit,,65000.00,115000.00
05/09/2026,Apartment Rent,20000.00,,95000.00
10/09/2026,Grocery Store,3500.00,,91500.00
30/09/2026,Closing Balance,,,91500.00`;

const resA = parseCsvContent(csvA, 'test_a.csv', 'INR');
assert(resA.recordCount === 2 + 1, `Extracted 3 transactions (excluding opening/closing bal), got ${resA.recordCount}`);
assert(resA.totalInflow === 65000, `Total inflow is 65000, got ${resA.totalInflow}`);
assert(resA.totalAmount === 23500, `Total outflow is 23500, got ${resA.totalAmount}`);
assert(resA.reconciliation?.detected === true, 'Opening/Closing balance detected');
assert(resA.reconciliation?.reconciled === true, 'Reconciliation verified (50000 + 65000 - 23500 = 91500)');

// ==========================================
// TEST B: Date + Narration + Withdrawal + Deposit + Balance
// ==========================================
console.log('\nTEST B: Date + Narration + Withdrawal + Deposit + Balance');
const csvB = `Txn Date,Narration,Withdrawal,Deposit,Running Balance
12/09/2026,UPI-Swiggy-Order-9821,450.00,,49550.00
15/09/2026,NEFT-Client-Payout,,12000.00,61550.00
20/09/2026,Electricity Board Bill,1550.00,,60000.00`;

const resB = parseCsvContent(csvB, 'test_b.csv', 'INR');
assert(resB.recordCount === 3, `Extracted 3 transactions, got ${resB.recordCount}`);
const swiggyTx = resB.transactions.find((t) => t.name.includes('Swiggy'));
assert(swiggyTx?.type === 'expense' && swiggyTx.amount === 450, 'Swiggy is expense 450');
const clientTx = resB.transactions.find((t) => t.name.includes('Client'));
assert(clientTx?.type === 'income' && clientTx.amount === 12000, 'Client payout is income 12000');

// ==========================================
// TEST C: Date + Description + Amount + Balance (Direction inferred from Balance movement)
// ==========================================
console.log('\nTEST C: Date + Description + Amount + Balance (Inferred from Balance Movement)');
const rowsC = [
  ['Date', 'Description', 'Amount', 'Balance'],
  ['01/09/2026', 'Opening Balance', '', '50000.00'],
  ['03/09/2026', 'Transfer Alpha', '5000.00', '45000.00'], // 50000 -> 45000 = Expense
  ['08/09/2026', 'Transfer Beta', '10000.00', '55000.00'],  // 45000 -> 55000 = Income
  ['12/09/2026', 'Transfer Gamma', '3000.00', '52000.00'],  // 55000 -> 52000 = Expense
];
const resC = processTabularStatement(rowsC, 'test_c.xlsx', 'INR', 'excel');
assert(resC.recordCount === 3, `Extracted 3 transactions, got ${resC.recordCount}`);
const alpha = resC.transactions.find((t) => t.name.includes('Alpha'));
const beta = resC.transactions.find((t) => t.name.includes('Beta'));
const gamma = resC.transactions.find((t) => t.name.includes('Gamma'));
assert(alpha?.type === 'expense', 'Alpha inferred as expense from balance drop 50000 -> 45000');
assert(beta?.type === 'income', 'Beta inferred as income from balance rise 45000 -> 55000');
assert(gamma?.type === 'expense', 'Gamma inferred as expense from balance drop 55000 -> 52000');

// ==========================================
// TEST D: Multi-page Statement with Repeated Headers/Footers
// ==========================================
console.log('\nTEST D: Multi-page Statement with Repeated Headers/Footers');
const rowsD = [
  ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'],
  ['01/09/2026', 'Internet Bill', '1200.00', '', '48800.00'],
  ['Page 1 of 2', 'Statement generated on 30 Sep 2026', '', '', ''],
  ['Branch Code: 1234', 'Confidential - All rights reserved', '', '', ''],
  ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'], // Repeated header on Page 2
  ['15/09/2026', 'Interest Payout', '', '350.00', '49150.00'],
  ['Page 2 of 2', 'End of Statement', '', '', '']
];
const resD = processTabularStatement(rowsD, 'test_d.csv', 'INR', 'csv');
assert(resD.recordCount === 2, `Extracted 2 transactions across pages, got ${resD.recordCount}`);
assert(!resD.transactions.some((t) => t.name.includes('Page') || t.name.includes('Branch')), 'Headers and footers excluded');

// ==========================================
// TEST E: Multi-line Transaction Descriptions
// ==========================================
console.log('\nTEST E: Multi-line Transaction Descriptions');
const rowsE = [
  ['Date', 'Description', 'Amount', 'Balance'],
  ['01/09/2026', 'UPI/RAHUL', '850.00', '25000.00'],
  ['', '@OKICICI/123456', '', ''],
  ['', 'Grocery Store Purchase', '', ''],
  ['05/09/2026', 'Mobile Recharge Jio', '299.00', '24701.00']
];
const resE = processTabularStatement(rowsE, 'test_e.csv', 'INR', 'csv');
assert(resE.recordCount === 2, `Extracted 2 transactions, got ${resE.recordCount}`);
const rahulTx = resE.transactions.find((t) => t.date === '2026-09-01');
assert(
  rahulTx !== undefined &&
    rahulTx.name.includes('UPI/RAHUL') &&
    rahulTx.name.includes('@OKICICI/123456') &&
    rahulTx.name.includes('Grocery Store Purchase'),
  `Multi-line description concatenated properly: "${rahulTx?.name}"`
);
assert(rahulTx?.amount === 850, `Amount preserved as 850, got ${rahulTx?.amount}`);

// ==========================================
// TEST F: CSV with Different Column Names and Order
// ==========================================
console.log('\nTEST F: CSV with Different Column Names and Order');
const csvF = `Particulars,Txn Date,Cr,Dr,Bal
Freelance Project,10/09/2026,18000.00,,68000.00
Medical Pharmacy,12/09/2026,,750.00,67250.00`;

const resF = parseCsvContent(csvF, 'test_f.csv', 'INR');
assert(resF.recordCount === 2, `Extracted 2 records with altered column order, got ${resF.recordCount}`);
const freelance = resF.transactions.find((t) => t.name.includes('Freelance'));
assert(freelance?.type === 'income' && freelance.amount === 18000, 'Freelance is income 18000');
const med = resF.transactions.find((t) => t.name.includes('Pharmacy'));
assert(med?.type === 'expense' && med.amount === 750, 'Pharmacy is expense 750');

// ==========================================
// TEST G: XLSX with Blank Rows and Header not starting at Row 1
// ==========================================
console.log('\nTEST G: XLSX with Blank Rows and Header not starting at Row 1');
const rowsG = [
  ['ACME Commercial Bank'],
  ['Account Holder: Rahul Sharma', 'Account Number: 987654321012'],
  ['IFSC: ACME0001234', 'Branch: Connaught Place'],
  ['Statement Period: 01-Sep-2026 to 30-Sep-2026'],
  [], // blank row
  ['Transaction Date', 'Transaction Details', 'Debit Amount', 'Credit Amount', 'Net Balance'],
  ['02-Sep-2026', 'Fuel Station HPCL', '2200.00', '', '47800.00'],
  ['07-Sep-2026', 'Quarterly Dividend', '', '1400.00', '49200.00']
];
const resG = processTabularStatement(rowsG, 'test_g.xlsx', 'INR', 'excel');
assert(resG.recordCount === 2, `Header detected at row 6, extracted 2 transactions, got ${resG.recordCount}`);
assert(resG.transactions[0].date === '2026-09-07' || resG.transactions[0].date === '2026-09-02', 'Dates formatted to YYYY-MM-DD');

// ==========================================
// TEST H: Scanned / OCR Text Statement Lines
// ==========================================
console.log('\nTEST H: Scanned / OCR Text Statement Lines');
const ocrRawText = `
STATEMENT OF ACCOUNT
Opening Balance: 10,000.00
01/09/2026 ATM Cash Withdrawal 2,000.00 8,000.00
05/09/2026 Direct Deposit Salary 50,000.00 58,000.00
12/09/2026 Supermarket Grocery Store 3,500.00 54,500.00
Closing Balance: 54,500.00
`;
const resH = parseTextStatementLines(ocrRawText, 'scanned_statement.pdf', 'INR', 'pdf');
assert(resH !== null, 'OCR statement parsed successfully');
assert(resH?.recordCount === 3, `Extracted 3 statement rows from OCR text, got ${resH?.recordCount}`);
assert(resH?.reconciliation?.reconciled === true, 'OCR statement balance reconciled (10000 + 50000 - 5500 = 54500)');

// ==========================================
// TEST I: Indian Currency Formatting such as ₹1,25,000.50
// ==========================================
console.log('\nTEST I: Indian Currency Formatting');
const amtIndian1 = parseMonetaryAmount('₹1,25,000.50');
assert(amtIndian1 !== null && amtIndian1.amount === 125000.5, '₹1,25,000.50 parses to 125000.5');

const amtIndian2 = parseMonetaryAmount('₹ 10,50,000.00 CR');
assert(amtIndian2 !== null && amtIndian2.amount === 1050000 && amtIndian2.isCredit === true, '10,50,000 CR is credit');

const amtIndian3 = parseMonetaryAmount('(1,250.00)');
assert(amtIndian3 !== null && amtIndian3.amount === 1250 && amtIndian3.isNegative === true, '(1,250.00) is negative 1250');

// Account number 12 digits must NOT parse as amount
const acctNum = parseMonetaryAmount('987654321098');
assert(acctNum === null, '12-digit integer account number ignored as amount');

// ==========================================
// TEST J: Opening and Closing Balances Mathematical Reconciliation
// ==========================================
console.log('\nTEST J: Statement Reconciliation Verification');
const csvJ = `Date,Description,Debit,Credit,Balance
"Opening Balance: 50,000.00",,,,
02/09/2026,Client Payout,,30000.00,80000.00
05/09/2026,Office Rent,15000.00,,65000.00
10/09/2026,Equipment,5000.00,,60000.00
"Closing Balance: 60,000.00",,,,`;

const resJ = parseCsvContent(csvJ, 'reconcile_test.csv', 'INR');
assert(resJ.recordCount === 3, `Extracted 3 transactions, got ${resJ.recordCount}`);
assert(resJ.reconciliation !== undefined, 'Reconciliation generated');
assert(resJ.reconciliation?.openingBalance === 50000, `Opening balance is 50000, got ${resJ.reconciliation?.openingBalance}`);
assert(resJ.reconciliation?.closingBalance === 60000, `Closing balance is 60000, got ${resJ.reconciliation?.closingBalance}`);
assert(resJ.reconciliation?.calculatedClosingBalance === 60000, `Calculated closing is 60000, got ${resJ.reconciliation?.calculatedClosingBalance}`);
assert(resJ.reconciliation?.reconciled === true, 'Statement is mathematically reconciled');

// ==========================================
// TEST K: Statement Containing Duplicate-looking Legitimate Transactions
// ==========================================
console.log('\nTEST K: Duplicate-looking Legitimate Transactions');
const rowsK = [
  ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
  ['01/09/2026', 'Coffee Shop Metro Station Ref:TXN101', '150.00', '', '9850.00'],
  ['01/09/2026', 'Coffee Shop Metro Station Ref:TXN102', '150.00', '', '9700.00'], // Legitimate second coffee on same day
  ['02/09/2026', 'Book Purchase', '450.00', '', '9250.00']
];
const resK = processTabularStatement(rowsK, 'test_k.csv', 'INR', 'csv');
assert(resK.recordCount === 3, `Both legitimate 150 transactions preserved, got ${resK.recordCount}`);

// ==========================================
// TEST L: Statement with at least one Malformed/Ambiguous Row
// ==========================================
console.log('\nTEST L: Ambiguous Row Discrepancy Flagging');
const rowsL = [
  ['Date', 'Description', 'Amount', 'Balance'],
  ['01/09/2026', 'Opening Balance', '', '10000.00'],
  ['02/09/2026', 'Payment A', '1000.00', '9000.00'],
  ['03/09/2026', 'Payment B with Corrupted Balance', '1000.00', '15000.00'], // Corrupted balance!
  ['04/09/2026', 'Payment C', '500.00', '14500.00']
];
const resL = processTabularStatement(rowsL, 'test_l.csv', 'INR', 'csv');
assert(resL.recordCount === 3, `Extracted 3 transactions, got ${resL.recordCount}`);
const ambiguousTx = resL.transactions.find((t) => t.name.includes('Payment B'));
assert(ambiguousTx?.needsReview === true, 'Ambiguous row with balance discrepancy flagged with needsReview');

console.log('\n==========================================');
console.log('🎉 ALL TESTS A THROUGH L PASSED COMPLETELY!');
console.log('==========================================\n');
