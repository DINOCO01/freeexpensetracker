import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { type ExpenseCategory } from './calculations';
import { autoCategorizeExpense } from './fileImporter';

// Ensure PDF.js worker is initialized
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
  }
}

export interface ScannedReceiptResult {
  merchantName: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  rawText: string;
  imageUrl: string;
  confidence: number;
  lineItems: { name: string; amount: number }[];
  type: 'expense' | 'income';
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
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let rawText = '';
  let confidence = 85;
  let imageUrl = '';

  if (isPdf) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = Math.min(3, pdfDoc.numPages);
      let extractedPdfText = '';

      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const pageLines = textContent.items
          .map((item: any) => item.str || '')
          .filter((s: string) => s.trim().length > 0)
          .join(' ');
        if (pageLines.trim()) {
          extractedPdfText += '\n' + pageLines;
        }
      }

      if (extractedPdfText.trim().length > 20) {
        rawText = extractedPdfText;
        confidence = 95;
      } else {
        // Scanned PDF receipt without digital text layer: render page 1 to canvas and run OCR
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          try {
            imageUrl = canvas.toDataURL('image/jpeg', 0.85);
          } catch {
            imageUrl = '';
          }
          const { data } = await Tesseract.recognize(canvas, 'eng', {
            logger: (m) => {
              if (onProgress && m.status === 'recognizing text') {
                onProgress(Math.round((m.progress || 0) * 100), m.status);
              }
            }
          });
          rawText = data.text || '';
          confidence = Math.round(data.confidence || 85);
        }
      }
    } catch (pdfErr: any) {
      console.warn('PDF direct read fallback:', pdfErr);
    }
  } else {
    // Normal Image (PNG, JPG, WebP, etc.)
    try {
      imageUrl = URL.createObjectURL(file);
    } catch {
      imageUrl = '';
    }

    const { data } = await Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round((m.progress || 0) * 100), m.status);
        }
      }
    });

    rawText = data.text || '';
    confidence = Math.round(data.confidence || 85);
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Detect if Transaction is Income or Expense
  const isIncome = /\b(salary|payroll|paycheck|direct\s*deposit|deposit|dividend|interest\s*credit|interest\s*earned|refund|cashback|bonus|stipend|freelance|client\s*payment|payment\s*received|received\s*from|credit\s*memo|net\s*pay)\b/i.test(rawText);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 2. Detect Merchant / Payee / Source Name
  let merchantName = '';

  if (isIncome) {
    if (/\b(salary|payroll|paycheck)\b/i.test(rawText)) merchantName = 'Salary / Payroll Deposit';
    else if (/\b(refund|cashback)\b/i.test(rawText)) merchantName = 'Refund / Cashback';
    else if (/\b(dividend|interest)\b/i.test(rawText)) merchantName = 'Investment Dividend / Interest';
    else if (/\b(freelance|client)\b/i.test(rawText)) merchantName = 'Client / Freelance Payment';
    else merchantName = 'Direct Deposit / Income';
  }

  // Check known brands first
  if (!merchantName) {
    for (const store of COMMON_STORE_NAMES) {
      const regex = new RegExp(`\\b${store}\\b`, 'i');
      if (regex.test(rawText)) {
        merchantName = store;
        break;
      }
    }
  }

  // Fallback: look at top 5 lines
  if (!merchantName) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i];
      if (
        /^\d+[\s\w]+(st|ave|blvd|rd|dr|lane|hwy|way)/i.test(line) ||
        /(tel|phone|fax|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/i.test(line) ||
        /(www\.|http|\.com|\.org|\.net)/i.test(line) ||
        /(receipt|invoice|tax\s*invoice|order|welcome|guest|register|cashier)/i.test(line) ||
        line.length < 3
      ) {
        continue;
      }

      const clean = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3) {
        merchantName = clean;
        break;
      }
    }
  }

  if (!merchantName) {
    merchantName = isIncome ? 'Income Payment' : 'Store / Merchant Receipt';
  }

  // 3. Detect Date
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

  // 4. Detect Total Amount
  let amount = 0;
  const amountRegex = isIncome
    ? /(?:deposit|net\s*pay|gross\s*pay|salary|amount|credit|refund|total|paid|balance)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,4}(?:,\d{3})*\.\d{2})/i
    : /(?:total|amount|balance|due|net|charge|visa|mastercard|debit|paid|grand\s*total)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,4}(?:,\d{3})*\.\d{2})/i;

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
        if (!isNaN(val) && val > 0 && val < 500000) {
          allAmounts.push(val);
        }
      }
    }

    if (allAmounts.length > 0) {
      amount = Math.max(...allAmounts);
    }
  }

  // 5. Categorize
  const combinedContext = `${merchantName} ${rawText}`;
  const category = isIncome ? 'Savings' : autoCategorizeExpense(combinedContext);

  // 6. Line items extract
  const lineItems: { name: string; amount: number }[] = [];
  const lineItemPattern = /^([a-zA-Z0-9\s&'-]{3,25})\s+[$€£₹¥]?\s*(\d+\.\d{2})$/;

  for (const line of lines) {
    const itemMatch = line.match(lineItemPattern);
    if (itemMatch) {
      const itemName = itemMatch[1].trim();
      const itemAmt = parseFloat(itemMatch[2]);
      if (itemName && !isNaN(itemAmt) && (amount === 0 || itemAmt < amount)) {
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
    confidence,
    lineItems,
    type
  };
}
