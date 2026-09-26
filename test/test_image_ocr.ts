import Tesseract from 'tesseract.js';
import * as fs from 'fs';
import { autoCategorizeExpense, extractAmountsFromText, STATEMENT_DATE_REGEX, normalizeDate } from '../src/utils/fileImporter';

async function testImageOcr() {
  const imagePath = 'C:\\Users\\princ\\Desktop\\New folder\\FORAGE\\EXCEL WITH AI\\SD87\\SD87\\Chapter-2-Importing Data from Various Sources\\Table in Image format.png';
  console.log(`Testing OCR on actual image: ${imagePath}`);
  
  if (!fs.existsSync(imagePath)) {
    console.log('Image not found');
    return;
  }

  const { data } = await Tesseract.recognize(imagePath, 'eng');
  console.log('--- OCR RAW TEXT EXTRACTED ---');
  console.log(data.text);
  console.log(`Confidence: ${data.confidence}%`);

  const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const allAmounts = extractAmountsFromText(data.text);
  console.log('Amounts extracted by parser:', allAmounts);

  const isIncome = /\b(salary|payroll|deposit|dividend|interest|refund)\b/i.test(data.text);
  const type = isIncome ? 'income' : 'expense';

  // Total
  let totalAmount = 0;
  const totalMatch = data.text.match(/(?:total|amount|balance|due|net|charge|grand\s*total)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  if (totalMatch) {
    const parsed = extractAmountsFromText(totalMatch[0]);
    if (parsed.length > 0) totalAmount = Math.abs(parsed[0].value);
  }
  if (totalAmount <= 0 && allAmounts.length > 0) {
    totalAmount = Math.max(...allAmounts.map(a => Math.abs(a.value)));
  }

  console.log(`\nRecognized Type: ${type}`);
  console.log(`Recognized Amount: ₹${totalAmount}`);
}

testImageOcr();
