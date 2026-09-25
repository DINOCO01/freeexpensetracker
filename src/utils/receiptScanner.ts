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
  const isIncome = /\b(salary|payroll|paycheck|direct\s*deposit|deposit|dividend|interest|refund|cashback|bonus|stipend|freelance|client\s*payment|payment\s*received|received\s*from|credit\s*memo|net\s*pay|inflow)\b/i.test(rawText);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 2. Detect Merchant / Payee / Source Name
  let merchantName = '';

  // Check known brands first
  for (const store of COMMON_STORE_NAMES) {
    const regex = new RegExp(`\\b${store}\\b`, 'i');
    if (regex.test(rawText)) {
      merchantName = store;
      break;
    }
  }

  // Fallback: look at top 6 lines
  if (!merchantName) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i];
      if (
        /^\d+[\s\w]+(st|ave|blvd|rd|dr|lane|hwy|way)/i.test(line) ||
        /(tel|phone|fax|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/i.test(line) ||
        /(www\.|http|\.com|\.org|\.net)/i.test(line) ||
        /(receipt|invoice|tax\s*invoice|order|welcome|guest|register|cashier|statement|account|summary)/i.test(line) ||
        line.length < 3
      ) {
        continue;
      }

      const clean = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3 && !/^(date|amount|total|balance|page|statement)/i.test(clean)) {
        merchantName = clean;
        break;
      }
    }
  }

  if (!merchantName) {
    merchantName = isIncome ? 'Income / Deposit Payment' : 'Store / Merchant Receipt';
  }

  // 3. Detect Date using universal date regex and normalizer
  let dateStr = new Date().toISOString().split('T')[0];
  const { STATEMENT_DATE_REGEX, normalizeDate, extractAmountsFromText } = await import('./fileImporter');
  const dateMatch = rawText.match(STATEMENT_DATE_REGEX);
  if (dateMatch) {
    dateStr = normalizeDate(dateMatch[0]);
  }

  // 4. Detect Total Amount using universal amount extractor
  let amount = 0;
  const allAmounts = extractAmountsFromText(rawText);

  // Check for lines with total / amount / deposit keywords
  const totalMatch = rawText.match(/(?:total|amount|balance|due|net|charge|visa|mastercard|debit|paid|grand\s*total|deposit|salary|net\s*pay)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  if (totalMatch) {
    const parsed = extractAmountsFromText(totalMatch[0]);
    if (parsed.length > 0) {
      amount = Math.abs(parsed[0].value);
    }
  }

  if (amount <= 0 && allAmounts.length > 0) {
    amount = Math.max(...allAmounts.map((a) => Math.abs(a.value)));
  }

  // 5. Categorize
  const combinedContext = `${merchantName} ${rawText}`;
  const category = isIncome ? 'Savings' : autoCategorizeExpense(combinedContext);

  // 6. Line items extract
  const lineItems: { name: string; amount: number }[] = [];
  const lineItemPattern = /^([a-zA-Z0-9\s&'-]{3,25})\s+[$€£₹¥]?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/;

  for (const line of lines) {
    const itemMatch = line.match(lineItemPattern);
    if (itemMatch) {
      const itemName = itemMatch[1].trim();
      const numPart = itemMatch[2].replace(/,/g, '');
      const itemAmt = parseFloat(numPart);
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
