import * as fs from 'fs';
import { scanReceiptImage } from '../src/utils/receiptScanner';

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

async function testReceipts() {
  const pharmacyPath = 'C:\\Users\\princ\\Desktop\\test files\\STRESS TEST\\04_stress_receipt_pharmacy.png';
  const mixedPath = 'C:\\Users\\princ\\Desktop\\test files\\STRESS TEST\\mixed_stress_test_expense_tracker\\04_mixed_test_receipt_delta.png';

  console.log('--- TESTING STRESS PHARMACY RECEIPT ---');
  const bufPharm = fs.readFileSync(pharmacyPath);
  const filePharm = new NodeFile(bufPharm, '04_stress_receipt_pharmacy.png', 'image/png') as any as File;
  const resPharm = await scanReceiptImage(filePharm);
  console.log(`Pharmacy Merchant: "${resPharm.merchantName}"`);
  console.log(`Pharmacy Date: "${resPharm.date}"`);
  console.log(`Pharmacy Amount: ₹${resPharm.amount}`);
  console.log(`Pharmacy Type: ${resPharm.type}`);

  console.log('\n--- TESTING MIXED DELTA RECEIPT ---');
  const bufMixed = fs.readFileSync(mixedPath);
  const fileMixed = new NodeFile(bufMixed, '04_mixed_test_receipt_delta.png', 'image/png') as any as File;
  const resMixed = await scanReceiptImage(fileMixed);
  console.log(`Mixed Merchant: "${resMixed.merchantName}"`);
  console.log(`Mixed Date: "${resMixed.date}"`);
  console.log(`Mixed Amount: ₹${resMixed.amount}`);
  console.log(`Mixed Type: ${resMixed.type}`);
}

testReceipts().catch(console.error);
