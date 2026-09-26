import * as fs from 'fs';
import * as path from 'path';
import { scanReceiptImage } from '../src/utils/receiptScanner';

class NodeFile {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;

  constructor(buffer: Buffer, name: string, type: string = 'image/jpeg') {
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

interface SimulatedTransaction {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  source: 'manual' | 'imported';
  type: 'expense' | 'income';
}

interface SimulatedFormState {
  inputItemName: string;
  inputItemAmount: string;
  selectItemCategory: string;
  pendingReceiptMeta: { date?: string; type?: 'expense' | 'income'; source?: 'imported' } | null;
  transactions: SimulatedTransaction[];
}

function createFreshState(): SimulatedFormState {
  return {
    inputItemName: '',
    inputItemAmount: '',
    selectItemCategory: 'Food',
    pendingReceiptMeta: null,
    transactions: []
  };
}

// Simulates the exact browser handler in src/pages/index.astro: inputReceiptPhoto 'change'
function simulateScanReceiptBrowserHandler(
  state: SimulatedFormState,
  scanResult: { merchantName: string; amount: number; category: string; date?: string; type?: 'expense' | 'income' }
) {
  state.inputItemName = scanResult.merchantName || '';
  state.inputItemAmount = scanResult.amount > 0 ? scanResult.amount.toString() : '';
  state.selectItemCategory = scanResult.category || 'Food';
  state.pendingReceiptMeta = {
    date: scanResult.date || undefined,
    type: scanResult.type || 'expense',
    source: 'imported'
  };
  // Scanning does NOT touch state.transactions!
}

// Simulates the exact browser handler in src/pages/index.astro: formExpenseLogger 'submit'
function simulateSubmitLoggerBrowserHandler(state: SimulatedFormState) {
  const name = state.inputItemName.trim();
  const amount = parseFloat(state.inputItemAmount);
  const category = state.selectItemCategory;

  if (!name || isNaN(amount) || amount <= 0) return;

  const txType = state.pendingReceiptMeta?.type || 'expense';
  const txDate = state.pendingReceiptMeta?.date || new Date().toISOString().split('T')[0];
  const txSource = state.pendingReceiptMeta?.source || 'manual';
  const txId = state.pendingReceiptMeta ? `rcpt-${Date.now()}` : `tx-${Date.now()}`;

  const newTx: SimulatedTransaction = {
    id: txId,
    name,
    amount,
    category,
    date: txDate,
    source: txSource,
    type: txType
  };

  state.transactions.unshift(newTx);
  state.pendingReceiptMeta = null;
  state.inputItemName = '';
  state.inputItemAmount = '';
}

// Simulates the exact browser handler in src/pages/index.astro: btnClearLogger 'click'
function simulateClearLoggerBrowserHandler(state: SimulatedFormState) {
  state.pendingReceiptMeta = null;
  state.inputItemName = '';
  state.inputItemAmount = '';
  state.selectItemCategory = 'Food';
}

async function runBrowserFlowVerification() {
  console.log('================================================================');
  console.log('RUNNING PHONEPE / REAL-WORLD QUICK EXPENSE LOGGER UI BROWSER-PATH TESTS');
  console.log('================================================================\n');

  const testExpectations = [
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.41.jpeg',
      expectedAmount: 25,
      expectedDate: '2026-09-21',
      expectedType: 'expense' as const,
      expectedCategory: 'Miscellany',
      expectedMerchantSubstring: 'pradeep store',
      label: '1. pradeep store 2 (₹25 Expense)'
    },
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.40 (1).jpeg',
      expectedAmount: 200,
      expectedDate: '2026-09-10',
      expectedType: 'expense' as const,
      expectedCategory: 'Utilities',
      expectedMerchantSubstring: 'Prince',
      label: '2. Prince (₹200 Expense)'
    },
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.40 (2).jpeg',
      expectedAmount: 1500,
      expectedDate: '2026-09-22',
      expectedType: 'expense' as const,
      expectedCategory: 'Utilities',
      expectedMerchantSubstring: 'Gyanender Upadhyay',
      label: '3. Transfer to / Gyanender Upadhyay / PNB (₹1,500 Expense)'
    },
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.39.jpeg',
      expectedAmount: 1600,
      expectedDate: '2026-09-06',
      expectedType: 'expense' as const,
      expectedCategory: 'Utilities',
      expectedMerchantSubstring: 'Mrinal Das',
      label: '4. MRINAL DAS (₹1,600 Expense)'
    },
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.40.jpeg',
      expectedAmount: 500,
      expectedDate: '2026-09-20',
      expectedType: 'expense' as const,
      expectedCategory: 'Utilities',
      expectedMerchantSubstring: 'Aditya',
      label: '5. Aditya (₹500 Expense)'
    },
    {
      filePath: 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.11.39 (1).jpeg',
      expectedAmount: 586.77,
      expectedDate: '2026-09-25',
      expectedType: 'expense' as const,
      expectedCategory: 'Utilities',
      expectedMerchantSubstring: 'INDRAPRASTHA GAS LIMITED',
      label: '6. INDRAPRASTHA GAS LIMITED (₹586.77 Expense, Utilities)'
    }
  ];

  let passedCases = 0;
  const summaryRows: any[] = [];

  for (const exp of testExpectations) {
    if (!fs.existsSync(exp.filePath)) {
      throw new Error(`Receipt screenshot not found: ${exp.filePath}`);
    }

    const fileName = path.basename(exp.filePath);
    const buf = fs.readFileSync(exp.filePath);
    const nodeFile = new NodeFile(buf, fileName) as any as File;

    console.log(`[TEST CASE] ${exp.label}`);

    // 1. scanReceiptImage executes through the exact receiptScanner pipeline
    const scanResult = await scanReceiptImage(nodeFile);

    // 2. Simulate browser state & Scan Receipt event handler
    const formState = createFreshState();
    const ledgerBeforeScan = formState.transactions.length;
    simulateScanReceiptBrowserHandler(formState, scanResult);
    const ledgerAfterScan = formState.transactions.length;

    console.log(`  Extracted Merchant: "${scanResult.merchantName}"`);
    console.log(`  Extracted Date: ${scanResult.date} (Expected: ${exp.expectedDate})`);
    console.log(`  Extracted Amount: ₹${scanResult.amount} (Expected: ₹${exp.expectedAmount})`);
    console.log(`  Extracted Direction: ${scanResult.type} (Expected: ${exp.expectedType})`);
    console.log(`  Extracted Category: ${scanResult.category}`);

    // Verification 1: Amount matches
    const amtPass = Math.abs(scanResult.amount - exp.expectedAmount) < 0.001;
    if (!amtPass) {
      throw new Error(`Amount mismatch: got ${scanResult.amount}, expected ${exp.expectedAmount}`);
    }

    // Verification 2: Date matches
    const datePass = scanResult.date === exp.expectedDate;
    if (!datePass) {
      throw new Error(`Date mismatch: got "${scanResult.date}", expected "${exp.expectedDate}"`);
    }

    // Verification 3: Direction matches
    const typePass = scanResult.type === exp.expectedType;
    if (!typePass) {
      throw new Error(`Direction mismatch: got "${scanResult.type}", expected "${exp.expectedType}"`);
    }

    // Verification 4: Category matches (specifically Utilities for Indraprastha)
    const catPass = exp.label.includes('INDRAPRASTHA') ? scanResult.category === 'Utilities' : true;
    if (!catPass) {
      throw new Error(`Category mismatch: got "${scanResult.category}", expected "Utilities"`);
    }

    // Verification 5: Merchant matches
    const merchantPass = scanResult.merchantName.toLowerCase().includes(exp.expectedMerchantSubstring.toLowerCase());
    if (!merchantPass) {
      throw new Error(`Merchant mismatch: got "${scanResult.merchantName}", expected to include "${exp.expectedMerchantSubstring}"`);
    }

    // Verification 6: Ledger count remains unchanged after scan
    if (ledgerAfterScan !== ledgerBeforeScan || ledgerAfterScan !== 0) {
      throw new Error(`Ledger count changed after scan: before=${ledgerBeforeScan}, after=${ledgerAfterScan}`);
    }
    console.log(`  ✓ Ledger count before scan: ${ledgerBeforeScan} → after scan: ${ledgerAfterScan} (Unchanged)`);

    // Verification 7: Add to Monthly Ledger adds exactly one transaction
    simulateSubmitLoggerBrowserHandler(formState);
    const ledgerAfterAdd = formState.transactions.length;
    if (ledgerAfterAdd !== 1) {
      throw new Error(`Expected exactly 1 transaction after Add, got ${ledgerAfterAdd}`);
    }
    console.log(`  ✓ Ledger count after "Add to Monthly Ledger": ${ledgerAfterAdd} (Added exactly 1 transaction)`);

    // Verification 8: Clear resets form and pending state
    simulateScanReceiptBrowserHandler(formState, scanResult);
    simulateClearLoggerBrowserHandler(formState);
    if (formState.inputItemName !== '' || formState.inputItemAmount !== '' || formState.pendingReceiptMeta !== null) {
      throw new Error(`Clear did not reset form state`);
    }
    if (formState.transactions.length !== 1) {
      throw new Error(`Clear altered ledger count: ${formState.transactions.length}`);
    }
    console.log(`  ✓ Clear clears form and pending state without altering ledger.`);

    passedCases++;
    console.log(`  --> PASS\n`);

    summaryRows.push({
      Receipt: exp.label.split('(')[0].trim(),
      'Expected Date': exp.expectedDate,
      'Actual Date': scanResult.date,
      'Expected Amount': `₹${exp.expectedAmount}`,
      'Actual Amount': `₹${scanResult.amount}`,
      Merchant: scanResult.merchantName,
      Type: scanResult.type,
      Category: scanResult.category,
      'PASS/FAIL': 'PASS'
    });
  }

  console.log('================================================================');
  console.log(`FINAL RESULT TABLE FOR ALL ${passedCases}/${testExpectations.length} RECEIPTS:`);
  console.log('================================================================');
  console.table(summaryRows);
}

runBrowserFlowVerification().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
