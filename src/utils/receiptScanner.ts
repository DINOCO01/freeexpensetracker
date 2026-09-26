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

// 1. Explicit Total Labels ordered by precedence
const EXPLICIT_TOTAL_TIER1_PATTERNS = [
  /\b(?:grand\s*total)\b/i,
  /\b(?:final\s*total)\b/i,
  /\b(?:net\s*total)\b/i,
  /\b(?:amount\s*due)\b/i,
  /\b(?:total\s*due)\b/i,
  /\b(?:balance\s*due)\b/i,
  /\b(?:amount\s*payable)\b/i,
  /\b(?:total\s*payable)\b/i,
  /\b(?:net\s*amount)\b/i,
  /\b(?:payable)\b/i,
  /\b(?:total)\b/i
];

const EXPLICIT_TOTAL_TIER2_PATTERNS = [
  /\b(?:total\s*amount)\b/i,
  /\b(?:bill\s*total)\b/i,
  /\b(?:invoice\s*total)\b/i,
  /\b(?:net\s*pay)\b/i,
  /\b(?:total\s*charges?)\b/i,
  /\b(?:amount\s*paid)\b/i,
  /\b(?:paid\s*amount)\b/i,
  /\b(?:paid)\b/i,
  /\b(?:charges?)\b/i,
  /\b(?:deposit)\b/i
];

// Patterns that identify lines representing non-final-total values that must be avoided
const NON_TOTAL_LINE_PATTERNS = [
  /\b(?:sub\s*-?\s*total|subtotal|gross\s*total|items?\s*total)\b/i,
  /\b(?:cgst|sgst|igst|gst|vat|sales\s*tax|service\s*tax|tax)\b/i,
  /\b(?:discount|disc\b|rebate|savings|offer|coupon|less\b)/i,
  /\b(?:service\s*charge|service\s*fee|delivery\s*fee|delivery\s*charge|tip|gratuity|round\s*off)\b/i,
  /\b(?:cash\s*tendered|cash\s*given|change\s*due|change\s*returned|balance\s*return(?:ed)?)\b/i,
  /\b(?:invoice\s*no|bill\s*no|order\s*no|table\s*no|token\s*no|pos\s*no|terminal|cashier|gstin|pan|cin|fssai)\b/i,
  /\b(?:tel|phone|ph\b|mobile|fax|contact|helpline|support)\b/i,
  /\b(?:qty|quantity|rate|pcs|items?)\b/i
];

function parseReceiptMonetaryValue(str: string): number | null {
  if (!str) return null;
  let clean = str.trim();
  clean = clean.replace(/^[₹$€£¥\s]+/, '');
  clean = clean.replace(/^(?:rs\.?|inr)\s*/i, '');
  clean = clean.replace(/^[%Xx*?~#§]+\s*/, '');

  // Indian format: 1,50,000.50 or 2,746.50
  if (/^\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?$/.test(clean)) {
    const val = parseFloat(clean.replace(/,/g, ''));
    return isNaN(val) ? null : val;
  }
  // Standard decimal or integer
  if (/^\d+(?:\.\d{1,2})?$/.test(clean)) {
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }
  return null;
}

function extractReceiptLineAmounts(line: string): { raw: string; value: number }[] {
  const results: { raw: string; value: number }[] = [];
  const regex = /(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§])?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const raw = match[0].trim();
    const val = parseReceiptMonetaryValue(raw);
    if (val !== null && val > 0) {
      results.push({ raw, value: val });
    }
  }
  return results;
}

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

    const imageInput: any = typeof Buffer !== 'undefined' && (file as any).buffer ? (file as any).buffer : file;
    const { data } = await Tesseract.recognize(imageInput, 'eng', {
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

  // 4. Line Items Extraction
  const lineItems: { name: string; amount: number }[] = [];
  const lineItemPattern = /^([a-zA-Z0-9\s&'.-]{2,35})\s+(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§])?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2}))$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isExcluded =
      NON_TOTAL_LINE_PATTERNS.some((p) => p.test(line)) ||
      EXPLICIT_TOTAL_TIER1_PATTERNS.some((p) => p.test(line)) ||
      EXPLICIT_TOTAL_TIER2_PATTERNS.some((p) => p.test(line)) ||
      /^(date|time|payment|merchant|thank|welcome|subtotal)/i.test(line);

    if (isExcluded) continue;

    const m = line.match(lineItemPattern);
    if (m) {
      const name = m[1].replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      const numPart = m[2].replace(/,/g, '');
      const amt = parseFloat(numPart);
      if (name.length >= 2 && !isNaN(amt) && amt > 0) {
        lineItems.push({ name, amount: amt });
      }
    }
  }

  const lineItemsSum = Math.round(lineItems.reduce((acc, it) => acc + it.amount, 0) * 100) / 100;

  // Check for explicit subtotal and tax amounts
  let subtotalAmount = 0;
  let taxAmount = 0;
  for (const line of lines) {
    if (/\b(?:sub\s*-?\s*total|subtotal|items?\s*total)\b/i.test(line)) {
      const amts = extractReceiptLineAmounts(line);
      if (amts.length > 0) subtotalAmount = amts[amts.length - 1].value;
    }
    if (/\b(?:cgst|sgst|igst|gst|vat|tax)\b/i.test(line) && !/tax\s*invoice/i.test(line)) {
      const amts = extractReceiptLineAmounts(line);
      if (amts.length > 0) taxAmount += amts[amts.length - 1].value;
    }
  }
  const calculatedTotal = subtotalAmount > 0 ? subtotalAmount + taxAmount : lineItemsSum;

  // 5. Detect Total Amount using Priority Architecture & Spatial Proximity
  interface CandidateTotal {
    amount: number;
    rawString: string;
    lineIndex: number;
    score: number;
    label: string;
  }

  const candidates: CandidateTotal[] = [];
  const totalDocLines = lines.length;

  lines.forEach((line, idx) => {
    // Skip if line represents non-total lines (subtotal, tax, discount, invoice number, phone, etc.)
    if (NON_TOTAL_LINE_PATTERNS.some((p) => p.test(line))) return;

    // Check Tier 1 explicit total labels
    let matchedTier = 0;
    let matchedLabel = '';
    for (const pat of EXPLICIT_TOTAL_TIER1_PATTERNS) {
      const m = line.match(pat);
      if (m) {
        matchedTier = 1;
        matchedLabel = m[0].toUpperCase();
        break;
      }
    }

    // Check Tier 2 secondary total labels
    if (matchedTier === 0) {
      for (const pat of EXPLICIT_TOTAL_TIER2_PATTERNS) {
        const m = line.match(pat);
        if (m) {
          matchedTier = 2;
          matchedLabel = m[0].toUpperCase();
          break;
        }
      }
    }

    if (matchedTier > 0) {
      let amountsOnLine = extractReceiptLineAmounts(line);
      let targetLineIndex = idx;

      // If no amount on this line, inspect the immediate next line
      if (amountsOnLine.length === 0 && idx + 1 < totalDocLines) {
        const nextLine = lines[idx + 1];
        if (!NON_TOTAL_LINE_PATTERNS.some((p) => p.test(nextLine))) {
          amountsOnLine = extractReceiptLineAmounts(nextLine);
          targetLineIndex = idx + 1;
        }
      }

      amountsOnLine.forEach((amtObj) => {
        let val = amtObj.value;

        // Proximity and document position scoring (totals typically appear in lower half)
        const posRatio = targetLineIndex / Math.max(1, totalDocLines - 1);
        let score = (matchedTier === 1 ? 100 : 50) + Math.round(posRatio * 30);

        // Verification against line items / subtotal + tax
        const baselineTotal = calculatedTotal > 0 ? calculatedTotal : lineItemsSum;
        if (baselineTotal > 0) {
          if (Math.abs(val - baselineTotal) < 0.01) {
            score += 150;
          } else {
            // Check if val ends with baselineTotal due to OCR currency glyph artifact (e.g. '3' for '₹')
            const valIntStr = Math.round(val * 100).toString();
            const baseIntStr = Math.round(baselineTotal * 100).toString();
            if (valIntStr.endsWith(baseIntStr) && valIntStr.length > baseIntStr.length) {
              const prefix = valIntStr.slice(0, valIntStr.length - baseIntStr.length);
              if (prefix.length === 1 && /[1-9]/.test(prefix)) {
                val = baselineTotal;
                score += 180;
              }
            }
          }
        }

        candidates.push({
          amount: val,
          rawString: amtObj.raw,
          lineIndex: targetLineIndex,
          score,
          label: matchedLabel
        });
      });
    }
  });

  let amount = 0;
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    amount = candidates[0].amount;
  } else if (lineItemsSum > 0) {
    amount = lineItemsSum;
  } else {
    // Universal amount extractor fallback only if no total label or line items could be identified
    const allAmounts = extractAmountsFromText(rawText);
    if (allAmounts.length > 0) {
      amount = Math.max(...allAmounts.map((a) => Math.abs(a.value)));
    }
  }

  // 6. Categorize
  const combinedContext = `${merchantName} ${rawText}`;
  const category = isIncome ? 'Savings' : autoCategorizeExpense(combinedContext);

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
