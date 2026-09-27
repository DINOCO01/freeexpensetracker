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
}

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

async function verifyGrowwReceipt() {
  let filePath = 'C:\\Users\\princ\\Desktop\\test files\\STRESS TEST\\WhatsApp Image 2026-09-26 at 17.49.36.jpeg';
  if (!fs.existsSync(filePath)) {
    filePath = 'C:\\Users\\princ\\Desktop\\WhatsApp Image 2026-09-26 at 17.49.36.jpeg';
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buf = fs.readFileSync(filePath);
  const file = new NodeFile(buf, path.basename(filePath)) as any as File;

  const formState: SimulatedFormState = {
    inputItemName: '',
    inputItemAmount: '',
    selectItemCategory: 'Food',
    pendingReceiptMeta: null,
    transactions: []
  };

  const ledgerBeforeScan = formState.transactions.length;

  // Run through exact scanner
  const scanResult = await scanReceiptImage(file);

  // Run through browser handler
  simulateScanReceiptBrowserHandler(formState, scanResult);

  const ledgerAfterScan = formState.transactions.length;

  console.log('=== ACTUAL BROWSER-FLOW RESULT FOR GROWW RECEIPT ===');
  console.log('Merchant:', scanResult.merchantName);
  console.log('Amount: ₹' + scanResult.amount);
  console.log('Date:', scanResult.date);
  console.log('Type:', scanResult.type);
  console.log('Category:', scanResult.category);
  console.log('');
  console.log('Ledger count before scanning:', ledgerBeforeScan);
  console.log('Ledger count after scanning WITHOUT clicking "Add to Monthly Ledger":', ledgerAfterScan);

  simulateSubmitLoggerBrowserHandler(formState);
  console.log('Ledger count after clicking "Add to Monthly Ledger":', formState.transactions.length);

  const errors: string[] = [];
  if (scanResult.amount !== 1680) {
    errors.push(`Amount expected 1680, got ${scanResult.amount}`);
  }
  if (scanResult.date !== '2026-01-22') {
    errors.push(`Date expected 2026-01-22, got ${scanResult.date}`);
  }
  if (scanResult.type !== 'expense') {
    errors.push(`Type expected expense, got ${scanResult.type}`);
  }
  if (!scanResult.merchantName.toLowerCase().includes('groww')) {
    errors.push(`Merchant expected Groww, got ${scanResult.merchantName}`);
  }
  if (ledgerAfterScan !== 0) {
    errors.push(`Ledger count after scan should be 0, got ${ledgerAfterScan}`);
  }
  if (formState.transactions.length !== 1) {
    errors.push(`Ledger count after submit should be 1, got ${formState.transactions.length}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  console.log('\n--> GROWW RECEIPT BROWSER FLOW: PASS\n');
}

verifyGrowwReceipt().catch((err) => {
  console.error(err);
  process.exit(1);
});
