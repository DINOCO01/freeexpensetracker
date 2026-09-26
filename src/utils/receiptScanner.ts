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
  /\b(?:total\s*amount\s*payable)\b/i,
  /\b(?:total\s*amount\s*due)\b/i,
  /\b(?:total\s*amount)\b/i,
  /\b(?:amount\s*payable)\b/i,
  /\b(?:total\s*payable)\b/i,
  /\b(?:amount\s*due)\b/i,
  /\b(?:total\s*due)\b/i,
  /\b(?:balance\s*due)\b/i,
  /\b(?:net\s*amount)\b/i,
  /\b(?:final\s*amount)\b/i,
  /\b(?:payable)\b/i,
  /\b(?:total)\b/i
];

const EXPLICIT_TOTAL_TIER2_PATTERNS = [
  /\b(?:bill\s*total)\b/i,
  /\b(?:invoice\s*total)\b/i,
  /\b(?:net\s*pay)\b/i,
  /\b(?:total\s*charges?)\b/i,
  /\b(?:amount\s*paid)\b/i,
  /\b(?:paid\s*amount)\b/i,
  /\b(?:total\s*paid)\b/i,
  /\b(?:paid)\b/i,
  /\b(?:charges?)\b/i,
  /\b(?:deposit)\b/i
];

// Patterns that identify lines representing non-final-total values that must be avoided
const NON_TOTAL_LINE_PATTERNS = [
  /\b(?:sub\s*-?\s*total|subtotal|gross\s*total|items?\s*total)\b/i,
  /\b(?:cgst|sgst|igst|gst|vat|sales\s*tax|service\s*tax|tax)\b/i,
  /\b(?:discount|disc\b|rebate|savings|offer|coupon|less\b)/i,
  /\b(?:service\s*charge|service\s*fee|delivery\s*fee|delivery\s*charge|convenience\s*fee|fee|tip|gratuity|round\s*off)\b/i,
  /\b(?:cash\s*tendered|cash\s*given|change\s*due|change\s*returned|balance\s*return(?:ed)?)\b/i,
  /\b(?:invoice\s*no|bill\s*no|order\s*no|table\s*no|token\s*no|pos\s*no|terminal|cashier|gstin|pan|cin|fssai)\b/i,
  /\b(?:utr(?:\s*no)?|txn\s*id|transaction\s*id|ref(?:\s*no|\s*id)?|reference\s*(?:no|id|number)|rrn|auth\s*code|approval\s*code)\b/i,
  /\b(?:account\s*no|a\/c\s*no|card\s*no|ending\s*in|vpa|upi\s*id)\b/i,
  /\b(?:tel|phone|ph\b|mobile|fax|contact|helpline|support)\b/i,
  /\b(?:qty|quantity|rate|pcs|items?)\b/i
];

// Disqualifiers for merchant name candidates
const NON_MERCHANT_LINE_PATTERNS = [
  // Status headings
  /\b(?:payment|transaction|bill\s*payment|transfer|order)\s+(?:successful|completed|succeeded|failed|pending|confirmed|received|processed)\b/i,
  /\b(?:paid\s*successfully|successfully\s*paid|transferred\s*successfully)\b/i,
  // Generic document titles
  /^(?:tax\s*invoice|retail\s*invoice|cash\s*invoice|commercial\s*invoice|proforma\s*invoice|invoice|bill\s*of\s*supply)/i,
  /^(?:cash\s*memo|cash\s*receipt|sales\s*receipt|payment\s*receipt|receipt|e-receipt|digital\s*receipt)/i,
  /^(?:customer\s*copy|merchant\s*copy|store\s*copy|original\s*for\s*recipient|duplicate\s*for\s*transporter|triplicate)/i,
  /^(?:payment\s*details|transaction\s*details|order\s*details|bill\s*details|payment\s*confirmation)/i,
  /^(?:account\s*summary|order\s*summary|statement\s*of\s*account|transaction\s*history|overview|summary)/i,
  // Greetings / Marketing / Politeness
  /^(?:welcome|thank\s*you|thanks\s*for|have\s*a\s*nice\s*day|visit\s*again|please\s*visit|terms\s*&?\s*conditions|powered\s*by|save\s*paper)/i,
  // Payment methods / mode / instrument
  /^(?:payment(?:\s*mode|\s*method|\s*option)?|mode\s*of\s*payment|paid\s*via|paid\s*using|debited\s*from)\s*[:\-–—]?/i,
  // Date & Time lines
  /^(?:date|time|dated)\s*[:\-–—]?/i,
  // Technical identifiers & Reference lines
  /^(?:txn\s*id|transaction\s*id|utr(?:\s*no)?|ref(?:\s*no|\s*id)?|reference\s*(?:no|id|number)|rrn|order\s*id|invoice\s*no|bill\s*no|receipt\s*no|token\s*no|counter\s*no|table\s*no|pos\s*id|terminal\s*id|approval\s*code|auth\s*code|arn)\b/i,
  /^(?:gstin|pan|cin|fssai|tin|tan|sac\s*code|hsn\s*code)\b/i,
  /^(?:tel|phone|ph\b|mobile|fax|contact|helpline|support|toll\s*free|call\s*us)\b/i,
  /^(?:www\.|https?:\/\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  // Totals & numbers
  /^(?:sub\s*-?\s*total|total|amount|balance|discount|cgst|sgst|igst|vat|tax|change|round\s*off)\b/i,
  // Standalone dates / times
  /^(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i,
  // Purely punctuation / non-alphanumeric noise
  /^[-=_*~#^&|/\\+<>.,;:!?'"(){}[\]\s]+$/
];

// Payment platform / method names that should NOT be selected as the merchant
const PAYMENT_PLATFORM_PATTERNS = [
  /^(?:google\s*pay|gpay|phonepe|paytm|bhim\s*upi|bhim|upi|amazon\s*pay|paypal|apple\s*pay|samsung\s*pay|cred|mobikwik|freecharge)\b/i,
  /^(?:credit\s*card|debit\s*card|visa|mastercard|maestro|rupay|amex|american\s*express)\b/i,
  /^(?:net\s*banking|internet\s*banking|mobile\s*banking|bank\s*transfer|neft|rtgs|imps|wallet|cash\s*on\s*delivery|cod)\b/i,
  /^(?:debited\s*from|paid\s*via|payment\s*mode|payment\s*method|payment\s*option|mode\s*of\s*payment|paid\s*from)\b/i
];

// Explicit merchant / biller label patterns (requiring colon/dash/dot/pipe or whitespace boundary)
const EXPLICIT_MERCHANT_LABEL_REGEX =
  /^(?:biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|paid\s*to|pay\s*to|transferred\s*to|sent\s*to|service\s*provider|provider(?:\s*name)?|beneficiary(?:\s*name)?|credited\s*to|company(?:\s*name)?|organization|recipient|\bto)\s*[:\-–—.|]?\s+(.+)$/i;

const EXPLICIT_LABEL_STANDALONE_REGEX =
  /^(?:biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|paid\s*to|pay\s*to|transferred\s*to|sent\s*to|service\s*provider|provider(?:\s*name)?|beneficiary(?:\s*name)?|credited\s*to|company(?:\s*name)?|organization|recipient|\bto)\s*[:\-–—.|]?$/i;

// Corporate / business suffix and entity keywords
const BUSINESS_MARKER_REGEX =
  /\b(?:pvt|private|ltd|limited|inc|incorporated|corp|corporation|llc|llp|gmbh|co|company|enterprises|industries|holdings|services|solutions|technologies)\b/i;

const STORE_INDUSTRY_REGEX =
  /\b(?:pharmacy|chemist|medical|clinic|hospital|store|mart|supermarket|bazaar|market|shop|cafe|coffee|restaurant|diner|bakers|bakery|kitchen|grill|bistro|hotel|motors|automotive|energy|power|electric|gas|water|telecom|broadband|station|petrol|fuel|boutique|apparel|jewellers|opticals|retail)\b/i;

// Semantic contextual category rules
const CATEGORY_CONTEXT_RULES: { category: ExpenseCategory; patterns: RegExp[] }[] = [
  {
    category: 'Utilities',
    patterns: [
      /\b(electric|electricity|power|energy|discom|bescom|cesc|tneb|msedcl|uppcl|dhbvn|torrent\s*power|tata\s*power|adani\s*electricity|utility|utilities)\b/i,
      /\b(water\s*board|water\s*supply|jal\s*board|water\s*bill|sewage|sewerage|drainage)\b/i,
      /\b(gas\s*bill|lpg|png|indane|bharat\s*gas|hp\s*gas|piped\s*gas|gas\s*utility|cylinder)\b/i,
      /\b(broadband|internet|fiber|wifi|fibernet|act\s*fiber|hathway|airtel\s*broadband|jio\s*fiber|tata\s*play|dth|cable\s*tv|dish\s*tv|recharge|postpaid|telecom)\b/i
    ]
  },
  {
    category: 'Food',
    patterns: [
      /\b(restaurant|cafe|coffee|bistro|diner|dhaba|eatery|canteen|kitchen|grill|barbeque|bbq|pizzeria|pizza|burger|bakery|bakers|bakehouse|patisserie|sweets|sweet\s*shop|confectionery)\b/i,
      /\b(groceries|grocery|supermarket|hypermarket|provision|mart|bazaar|bigbasket|blinkit|zepto|instamart|dmart|spencer|super\s*store|veggies|fruits|vegetables|meat|fish|dairy)\b/i,
      /\b(dining|food|lunch|dinner|breakfast|meal|takeaway|takeout|zomato|swiggy|ubereats|doordash)\b/i
    ]
  },
  {
    category: 'Transport',
    patterns: [
      /\b(fuel|petrol|diesel|gas\s*station|cng|petroleum|filling\s*station|iocl|bpcl|hpcl|shell|indianoil|bharat\s*petroleum|hindustan\s*petroleum)\b/i,
      /\b(cab|taxi|ride|uber|ola|lyft|rapido|auto\s*rickshaw|metro|transit|subway|bus|train|railway|irctc|flight|airline|airways|indigo|air\s*india|spicejet|toll|fastag|parking|garage|tyres?|tires?|motor\s*service|auto\s*repair)\b/i
    ]
  },
  {
    category: 'Housing',
    patterns: [
      /\b(rent|house\s*rent|room\s*rent|office\s*rent|lease|landlord|tenant|maintenance|society\s*maintenance|apartment|flat|housing\s*society|rwa|mortgage|property\s*tax|brokerage)\b/i
    ]
  },
  {
    category: 'Entertainment',
    patterns: [
      /\b(movie|cinema|pvr|inox|cinepolis|theatre|theater|concert|ticket|bookmyshow|show|event|amusement|theme\s*park|bowling|gaming|arcade|nightclub|lounge)\b/i,
      /\b(netflix|spotify|prime\s*video|disney|hotstar|hulu|apple\s*tv|youtube\s*premium|hbo|streaming|subscription|playstation|xbox|nintendo|steam)\b/i
    ]
  },
  {
    category: 'Savings',
    patterns: [
      /\b(investment|invest|mutual\s*fund|sip|equity|shares|stocks|securities|zerodha|groww|upstox|angel\s*one|vanguard|fidelity|schwab|robinhood)\b/i,
      /\b(fixed\s*deposit|recurring\s*deposit|deposit|provident\s*fund|ppf|epfo|nps|pension|gold\s*bond|sgb|bullion|life\s*insurance|lic)\b/i
    ]
  },
  {
    category: 'Miscellany',
    patterns: [
      /\b(pharmacy|chemist|medical|meds|drugstore|pharma|clinic|hospital|doctor|dentist|dental|optician|eyewear|opticals|healthcare|diagnostic|pathology|lab|apollo|medplus|netmeds|1mg|pharmeasy)\b/i,
      /\b(apparel|clothing|fashion|garments|wear|boutique|tailor|shoes|footwear|zara|h&m|uniqlo)\b/i,
      /\b(electronics|computer|laptop|mobile\s*store|gadgets|appliances|hardware|sanitary)\b/i,
      /\b(salon|spa|parlour|barber|laundry|dry\s*clean|dryclean)\b/i,
      /\b(stationery|books|bookstore|courier|post|shipping|packaging)\b/i,
      /\b(shopping|retail|store|mall|amazon|flipkart|myntra)\b/i
    ]
  }
];

function cleanMerchantString(str: string): string {
  if (!str) return '';
  let clean = str.trim();

  // Strip leading explicit labels
  clean = clean.replace(
    /^(?:biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|paid\s*to|pay\s*to|transferred\s*to|sent\s*to|service\s*provider|provider(?:\s*name)?|beneficiary(?:\s*name)?|credited\s*to|company(?:\s*name)?|organization|recipient|\bto)\s*[:\-–—.|]?\s+/i,
    ''
  );

  // Strip M/s or Messrs prefix
  clean = clean.replace(/^(?:m\/s\.?|messrs\.?)\s+/i, '');

  // Strip leading non-alphanumeric chars
  clean = clean.replace(/^[^a-zA-Z0-9]+/, '');

  // Strip trailing dates
  clean = clean.replace(
    /\s+(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]\d{2,4})$/i,
    ''
  );

  // Strip trailing amounts or currencies
  clean = clean.replace(/\s+(?:[₹$€£¥]|rs\.?|inr)?\s*[x*]?\s*\d+(?:\.\d{1,2})?$/i, '');

  // Strip trailing non-alphanumeric chars except closing paren or period
  clean = clean.replace(/[^a-zA-Z0-9.)]+$/, '');

  // Collapse consecutive whitespaces
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

function isValidMerchantCandidate(str: string): boolean {
  if (!str || str.length < 3) return false;

  // Must have at least 3 letters
  const letters = str.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 3) return false;

  // Cannot match non-merchant patterns
  if (NON_MERCHANT_LINE_PATTERNS.some((p) => p.test(str))) return false;

  // Cannot be purely a number or date or currency
  if (/^[\d\s.,:/\-–—₹$€£¥]+$/.test(str)) return false;

  // Cannot be purely an ID/reference pattern
  if (/^(?:utr|txn|rrn|ref|order|inv|gstin|pan|cin)\s*[:#\-]/i.test(str)) return false;

  // Cannot be a total or subtotal phrase
  if (/^(?:sub\s*-?\s*total|total|amount|balance|due|payable|change)\b/i.test(str)) return false;

  return true;
}

export function extractMerchantName(lines: string[], rawText: string, isIncome: boolean): string {
  interface Candidate {
    name: string;
    source: 'labeled' | 'header' | 'brand';
    lineIndex: number;
    score: number;
  }

  const candidates: Candidate[] = [];

  // 1. Scan for explicit labeled fields (e.g. "Biller Name: ...", "Paid to: ...", or "Paid to" followed by next line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check same-line label with separator: e.g. "Biller Name: Apex Energy Ltd"
    const matchSameLine = line.match(EXPLICIT_MERCHANT_LABEL_REGEX);
    if (matchSameLine && matchSameLine[1]) {
      const val = matchSameLine[1].trim();
      const cleaned = cleanMerchantString(val);
      if (isValidMerchantCandidate(cleaned)) {
        let score = 160;
        if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 30;
        if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 30;
        candidates.push({
          name: cleaned,
          source: 'labeled',
          lineIndex: i,
          score
        });
      }
    }

    // Check standalone label line: e.g. "Paid to" or "Biller:"
    const matchStandalone = line.match(EXPLICIT_LABEL_STANDALONE_REGEX);
    if (matchStandalone && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (
        nextLine.length >= 3 &&
        !NON_MERCHANT_LINE_PATTERNS.some((p) => p.test(nextLine)) &&
        !PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(nextLine))
      ) {
        const cleaned = cleanMerchantString(nextLine);
        if (isValidMerchantCandidate(cleaned)) {
          let score = 150;
          if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 30;
          if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 30;
          candidates.push({
            name: cleaned,
            source: 'labeled',
            lineIndex: i + 1,
            score
          });
        }
      }
    }
  }

  // 2. Scan header and body lines for prominent business names
  const scanLimit = Math.min(15, lines.length);
  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;

    // Skip disqualified lines
    if (NON_MERCHANT_LINE_PATTERNS.some((p) => p.test(line))) continue;

    const isPaymentPlatform = PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(line));

    const cleaned = cleanMerchantString(line);
    if (!isValidMerchantCandidate(cleaned)) continue;

    let score = 0;
    // Position score (higher near top of receipt header)
    if (i === 0) score += 60;
    else if (i === 1) score += 50;
    else if (i === 2) score += 40;
    else if (i < 5) score += 25;
    else score += 10;

    // Business entity marker bonus
    if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 45;
    if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 40;

    // Formatting bonus
    if (/^[A-Z]/.test(cleaned)) score += 10;
    if (/^[A-Za-z\s&'-]+$/.test(cleaned)) score += 15;
    if (cleaned.length >= 5 && cleaned.length <= 35) score += 15;

    // Penalties
    if (isPaymentPlatform) score -= 80;
    if (/\d/.test(cleaned)) score -= 25;
    if (/\b(?:st|ave|blvd|rd|road|street|lane|nagar|sector|floor|pin|zip)\b/i.test(cleaned)) score -= 70;
    if (/\b(?:total|amount|due|paid|balance|change|subtotal)\b/i.test(cleaned)) score -= 80;

    candidates.push({
      name: cleaned,
      source: 'header',
      lineIndex: i,
      score
    });
  }

  // 3. Known common store names as secondary contextual candidates
  for (const store of COMMON_STORE_NAMES) {
    const regex = new RegExp(`\\b${store}\\b`, 'i');
    if (regex.test(rawText)) {
      const lineMatching = lines.find((l) => regex.test(l)) || '';
      if (!PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(lineMatching))) {
        candidates.push({
          name: store,
          source: 'brand',
          lineIndex: 0,
          score: 85
        });
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score > 15) {
    return cleanMerchantString(candidates[0].name);
  }

  return isIncome ? 'Income / Deposit Payment' : 'Store / Merchant Receipt';
}

export function inferReceiptCategory(
  merchantName: string,
  rawText: string,
  isIncome: boolean
): ExpenseCategory {
  if (isIncome) return 'Income';

  // 1. Primary Priority: Check merchantName directly
  if (merchantName && merchantName.length >= 3) {
    for (const rule of CATEGORY_CONTEXT_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(merchantName)) {
          return rule.category;
        }
      }
    }
  }

  // 2. Secondary Priority: Check full receipt rawText (line items, descriptions, labels)
  if (rawText && rawText.length >= 3) {
    for (const rule of CATEGORY_CONTEXT_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(rawText)) {
          return rule.category;
        }
      }
    }
  }

  // 3. Fallback to autoCategorizeExpense from fileImporter
  try {
    const fallback = autoCategorizeExpense(`${merchantName} ${rawText}`);
    if (fallback) return fallback;
  } catch {}

  // 4. Default sensible fallback
  return 'Miscellany';
}

function parseReceiptMonetaryValue(str: string): number | null {
  if (!str) return null;
  let clean = str.trim();
  clean = clean.replace(/^[₹$€£¥\s]+/, '');
  clean = clean.replace(/^(?:rs\.?|inr)\s*/i, '');
  clean = clean.replace(/^[%Xx*?~#§]+\s*/, '');

  // Reject long digit sequences without decimal (e.g. UTR, account numbers, phone numbers)
  if (/^\d{9,}$/.test(clean)) {
    return null;
  }

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
  // Strip out any ID, reference, or phone labels and their values first to prevent false amount extraction
  const sanitizedLine = line
    .replace(/\b(?:utr|txn\s*id|transaction\s*id|ref\s*(?:no|id)?|order\s*id|invoice\s*no|bill\s*no|phone|tel|mobile|a\/c|account)\s*[:#\-]?\s*[a-zA-Z0-9_-]+/gi, '')
    .trim();

  const results: { raw: string; value: number }[] = [];
  const regex = /(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§])?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi;
  let match;
  while ((match = regex.exec(sanitizedLine)) !== null) {
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

  // 2. Detect Merchant / Payee / Source Name with generalized confidence scoring
  const merchantName = extractMerchantName(lines, rawText, isIncome);

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
            // Check if val ends with baselineTotal due to OCR currency glyph artifact
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

  // 6. Generalized Semantic Categorization
  const category = inferReceiptCategory(merchantName, rawText, isIncome);

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
