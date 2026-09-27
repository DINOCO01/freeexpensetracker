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

async function run() {
  const foodDir = 'C:\\Users\\princ\\Desktop\\food';
  const testCases = [
    { file: 'WhatsApp Image 2026-09-27 at 08.51.55.jpeg', expected: 127.00, name: 'Instamart' },
    { file: 'WhatsApp Image 2026-09-27 at 08.51.56.jpeg', expected: 246.00, name: 'Instamart' },
    { file: 'WhatsApp Image 2026-09-27 at 08.51.56 (1).jpeg', expected: 282.00, name: 'Instamart' },
    { file: 'WhatsApp Image 2026-09-27 at 08.51.57 (1).jpeg', expected: 271.36, name: 'Swiggy (Third Wave Coffee + RollsKing)' },
    { file: 'WhatsApp Image 2026-09-27 at 08.51.57.jpeg', expected: 207.54, name: 'Swiggy (Punjabi Angithi)' },
    { file: 'WhatsApp Image 2026-09-27 at 08.51.56 (2).jpeg', expected: 208.99, name: 'Swiggy (Hong\'s Kitchen)' }
  ];

  console.log(`========================================================================================================`);
  console.log(`DIRECT OCR VERIFICATION OF THE 6 REAL RECEIPT IMAGES`);
  console.log(`========================================================================================================\n`);

  let allPassed = true;

  for (const item of testCases) {
    const fullPath = path.join(foodDir, item.file);
    const buf = fs.readFileSync(fullPath);
    const nodeFile = new NodeFile(buf, item.file, 'image/jpeg');

    const result = await scanReceiptImage(nodeFile as any);
    const passed = Math.abs(result.amount - item.expected) < 0.01;
    if (!passed) allPassed = false;

    // Find the raw OCR match string on the final payment line
    const match = result.rawText.match(/(?:amount\s*paid|paid\s*amount|total\s*paid|you\s*paid|\bpaid\b)\s*[:\-–—\s]*([₹$€£¥]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
    const rawValStr = match ? match[2] : 'N/A';
    const rawNumeric = parseFloat(rawValStr.replace(/,/g, ''));

    // Determine normalized value if leading glyph normalization occurred
    const normalizedVal = (rawNumeric >= 2000 && rawNumeric < 4000 && item.expected < 1000)
      ? (rawNumeric % 1000).toFixed(2)
      : rawNumeric.toFixed(2);

    console.log(`Receipt: ${item.name} (${item.file})`);
    console.log(`Expected: ₹${item.expected.toFixed(2)}`);
    console.log(`RAW OCR: ${rawValStr} → NORMALIZED VALUE: ₹${normalizedVal} → FINAL EXTRACTED VALUE: ₹${result.amount.toFixed(2)} → ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`--------------------------------------------------------------------------------------------------------\n`);
  }

  console.log(`OVERALL RESULT: ${allPassed ? 'ALL 6 PASSED (6/6)' : 'SOME FAILED'}`);
}

run().catch(console.error);
