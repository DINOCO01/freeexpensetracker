import Tesseract from 'tesseract.js';
import { type ExpenseCategory } from './calculations';
import { autoCategorizeExpense } from './fileImporter';

export interface ScannedReceiptResult {
  merchantName: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  rawText: string;
  imageUrl: string;
  confidence: number;
  lineItems: { name: string; amount: number }[];
}

const COMMON_STORE_NAMES = [
  'Walmart',
  'Target',
  'Costco',
  'Trader Joe',
  'Whole Foods',
  'Starbucks',
  "McDonald's",
  'Chipotle',
  'Home Depot',
  "Lowe's",
  'Best Buy',
  'CVS Pharmacy',
  'Walgreens',
  'Kroger',
  'Safeway',
  'Aldi',
  'Shell',
  'Chevron',
  'Exxon',
  'BP',
  'Mobil',
  'Uber',
  'Lyft',
  'Amazon',
  'Subway',
  'Dunkin',
  'Burger King',
  'Wendy',
  'Taco Bell',
  'Apple Store',
  'IKEA',
  'Sephora',
  'Dollar Tree',
  '7-Eleven'
];

export async function scanReceiptImage(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<ScannedReceiptResult> {
  const imageUrl = URL.createObjectURL(file);

  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100), m.status);
      }
    }
  });

  const rawText = data.text || '';
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Detect Merchant Name
  let merchantName = '';

  // Check known brands first
  for (const store of COMMON_STORE_NAMES) {
    const regex = new RegExp(`\\b${store}\\b`, 'i');
    if (regex.test(rawText)) {
      merchantName = store;
      break;
    }
  }

  // Fallback: look at top 4 lines
  if (!merchantName) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Skip addresses, phone numbers, website URLs, or generic receipt words
      if (
        /^\d+[\s\w]+(st|ave|blvd|rd|dr|lane|hwy|way)/i.test(line) ||
        /(tel|phone|fax|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/i.test(line) ||
        /(www\.|http|\.com|\.org|\.net)/i.test(line) ||
        /(receipt|invoice|tax\s*invoice|order|welcome|guest|register|cashier)/i.test(line) ||
        line.length < 3
      ) {
        continue;
      }

      // Clean line
      const clean = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3) {
        merchantName = clean;
        break;
      }
    }
  }

  if (!merchantName) {
    merchantName = 'Store / Merchant Receipt';
  }

  // 2. Detect Date
  let dateStr = new Date().toISOString().split('T')[0];
  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i;

  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const parsed = new Date(match[0]);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split('T')[0];
        break;
      }
    }
  }

  // 3. Detect Total Amount
  let amount = 0;
  const amountRegex = /(?:total|amount|balance|due|net|charge|visa|mastercard|debit|paid)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,4}(?:,\d{3})*\.\d{2})/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(amountRegex);
    if (match) {
      const numStr = match[1].replace(/[^0-9.]/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // Fallback: search all lines for amounts and take largest (excluding likely subtotal/tax)
  if (amount <= 0) {
    const allAmounts: number[] = [];
    const standaloneAmtRegex = /(?:[$€£₹¥])?\s*(\d{1,4}(?:,\d{3})*\.\d{2})\b/g;

    for (const line of lines) {
      let m;
      while ((m = standaloneAmtRegex.exec(line)) !== null) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 50000) {
          allAmounts.push(val);
        }
      }
    }

    if (allAmounts.length > 0) {
      amount = Math.max(...allAmounts);
    }
  }

  // 4. Auto-Categorize
  const combinedContext = `${merchantName} ${rawText}`;
  const category = autoCategorizeExpense(combinedContext);

  // 5. Line items extract (bonus)
  const lineItems: { name: string; amount: number }[] = [];
  const lineItemPattern = /^([a-zA-Z0-9\s&'-]{3,25})\s+[$€£₹¥]?\s*(\d+\.\d{2})$/;

  for (const line of lines) {
    const itemMatch = line.match(lineItemPattern);
    if (itemMatch) {
      const itemName = itemMatch[1].trim();
      const itemAmt = parseFloat(itemMatch[2]);
      if (itemName && !isNaN(itemAmt) && itemAmt < amount) {
        lineItems.push({ name: itemName, amount: itemAmt });
      }
    }
  }

  return {
    merchantName,
    amount: Math.round(amount * 100) / 100,
    date: dateStr,
    category,
    rawText,
    imageUrl,
    confidence: Math.round(data.confidence || 85),
    lineItems
  };
}
