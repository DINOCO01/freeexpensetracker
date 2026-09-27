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

export type PaymentMethodType =
  | 'UPI'
  | 'Card'
  | 'Bank Transfer'
  | 'Wallet'
  | 'Payment Gateway'
  | 'Bill Payment'
  | 'Recharge'
  | 'Other';

export interface PaymentTransactionMetadata {
  upiId?: string;
  transactionId?: string;
  utr?: string;
  bankName?: string;
  maskedAccount?: string;
  maskedCard?: string;
  paymentApp?: string;
}

export interface FieldConfidenceScores {
  merchant: number;
  amount: number;
  date: number;
  type: number;
  category: number;
  overall: number;
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
  time?: string;
  paymentMethod?: PaymentMethodType;
  metadata?: PaymentTransactionMetadata;
  fieldConfidence?: FieldConfidenceScores;
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

// 1. Explicit Final-Payment Labels (Highest Priority - Tier 1)
export const EXPLICIT_FINAL_PAYMENT_PATTERNS = [
  /\b(?:total\s*amount\s*paid|amount\s*paid|paid\s*amount|total\s*paid)\b/i,
  /\b(?:you\s*paid|paid\s*by\s*you)\b/i,
  /\b(?:paid)\b/i,
  /\b(?:total\s*amount\s*payable|amount\s*payable|net\s*payable|total\s*payable|payable\s*amount)\b/i,
  /\b(?:total\s*amount\s*due|amount\s*due|balance\s*due|total\s*due)\b/i,
  /\b(?:net\s*amount|final\s*amount|final\s*payable)\b/i,
  /\b(?:paid\s*successfully|payment\s*successful)\b/i,
  /\b(?:amount\s*received|payment\s*received|money\s*received|amount\s*credited|credited\s*amount)\b/i,
  /\b(?:amount\s*debited|debited\s*amount)\b/i
];

// 2. Grand Total / Total Labels (Tier 2)
export const EXPLICIT_GRAND_TOTAL_PATTERNS = [
  /\b(?:grand\s*total|final\s*total|net\s*total)\b/i,
  /\b(?:total\s*amount|total\s*bill|bill\s*total|invoice\s*total)\b/i,
  /\b(?:total\s*charges?|total\s*cost|total\s*price)\b/i,
  /\b(?:recharge\s*amount|recharge(?:\s*of)?|payment\s*amount|transaction\s*amount)\b/i,
  /\b(?:net\s*pay)\b/i,
  /\b(?:total)\b/i
];

// 3. Fallback Total / Subtotal Labels (Tier 3)
export const EXPLICIT_FALLBACK_TOTAL_PATTERNS = [
  /\b(?:bill\s*amount|bill\s*payment)\b/i,
  /\b(?:item\s*bill|items?\s*bill|item\s*total|items?\s*total)\b/i,
  /\b(?:sub\s*-?\s*total|subtotal|gross\s*total)\b/i,
  /\b(?:amount)\b/i,
  /\b(?:payable)\b/i,
  /\b(?:charges?|deposit)\b/i
];

// Backward-compatible exports
export const EXPLICIT_TOTAL_TIER1_PATTERNS = EXPLICIT_FINAL_PAYMENT_PATTERNS;
export const EXPLICIT_TOTAL_TIER2_PATTERNS = EXPLICIT_GRAND_TOTAL_PATTERNS;
export const EXPLICIT_TOTAL_TIER3_PATTERNS = EXPLICIT_FALLBACK_TOTAL_PATTERNS;

// Patterns that identify lines representing non-final-total values that must be avoided
const NON_TOTAL_LINE_PATTERNS = [
  /\b(?:sub\s*-?\s*total|subtotal|gross\s*total|items?\s*total|item\s*bill|items?\s*bill)\b/i,
  /\b(?:cgst|sgst|igst|gst|vat|sales\s*tax|service\s*tax|tax)\b/i,
  /\b(?:discount|disc\b|rebate|savings?|offer|coupon|less\b|you\s*saved)\b/i,
  /\b(?:cashback|reward\s*points?|earned\s*points?|points\s*earned)\b/i,
  /\b(?:service\s*charge|service\s*fee|delivery\s*fee|delivery\s*charge|convenience\s*fee|handling\s*fee|handling\s*charge|platform\s*fee|platform\s*charge|packaging\s*charges?|packaging\s*fee|packing\s*charges?|fee|tip|gratuity|round\s*off)\b/i,
  /\b(?:cash\s*tendered|cash\s*given|change\s*due|change\s*returned|balance\s*return(?:ed)?)\b/i,
  /\b(?:invoice\s*no|bill\s*no|order\s*no|table\s*no|token\s*no|pos\s*no|terminal|cashier|gstin|pan|cin|fssai|roll\s*no)\b/i,
  /\b(?:utr(?:\s*no)?|txn(?:\s*id)?|transaction\s*id|upi\s*ref(?:\s*no)?|ref(?:\s*no|\s*id|\s*num)?|reference\s*(?:no|id|number)|rrn|auth\s*code|approval\s*code|arn)\b/i,
  /\b(?:account\s*(?:no|num)?|a\/c\s*(?:no|num)?|card\s*no|ending\s*in|ending\s*with|vpa|upi\s*id)\b/i,
  /\b(?:tel|phone|ph\b|mobile|fax|contact|helpline|support)\b/i,
  /\b(?:qty|quantity|rate|pcs|items?|units?|nos?|plates?|packs?)\b/i,
  /\b(?:pin|postal|zip)\s*(?:code)?\b/i,
  /\b(?:paytm\s*\||phonepe\s*\||upi\s*\||lipid|ljp|split\s*this\s*payment|split\s*bill|hl\s*o\s*<)\b/i,
  /\b(?:copy\s*code|copy\s*ref|copy\s*txn|\bcopy\b)\b/i
];

// Disqualifiers for merchant name candidates
const NON_MERCHANT_LINE_PATTERNS = [
  // Status headings
  /\b(?:payment|transaction|bill\s*payment|transfer|order)\s+(?:successful|completed|succeeded|failed|pending|confirmed|received|processed)\b/i,
  /\b(?:paid\s*successfully|successfully\s*paid|transferred\s*successfully|money\s*received|payment\s*received)\b/i,
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
  // UI / Navigation / Action Buttons
  /^(?:help|need\s*help\??|support|contact\s*support|customer\s*care|customer\s*support)\b/i,
  /^(?:view\s*history|check\s*balance|view\s*balance|check\s*bank\s*balance|view\s*ticket|open\s*maps?)\b/i,
  /^(?:pay\s*again|repeat\s*payment|repeat|share\s*receipt|share|download\s*receipt|download\s*pdf|download\s*invoice)\b/i,
  /^(?:split\s*with\s*friends?|split\s*bill|view\s*details|view\s*breakup|view\s*more)\b/i,
  /^(?:done|close|ok|back|home|cancel|submit|next|proceed|continue)\b/i,
  /^(?:raise\s*(?:a\s*)?dispute|report\s*(?:an?\s*)?issue|rate\s*us|feedback)\b/i,
  // Technical identifiers & Reference lines
  /^(?:txn\s*id|transaction\s*id|utr(?:\s*no)?|ref(?:\s*no|\s*id)?|reference\s*(?:no|id|number)|rrn|order\s*id|invoice\s*no|bill\s*no|receipt\s*no|token\s*no|counter\s*no|table\s*no|pos\s*id|terminal\s*id|approval\s*code|auth\s*code|arn)\b/i,
  /^(?:gstin|pan|cin|fssai|tin|tan|sac\s*code|hsn\s*code)\b/i,
  /^(?:tel|phone|ph\b|mobile|fax|contact|helpline|support|toll\s*free|call\s*us)\b/i,
  /^(?:www\.|https?:\/\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  // Totals, fees & numbers
  /^(?:sub\s*-?\s*total|total|amount|balance|discount|cgst|sgst|igst|vat|tax|change|round\s*off)\b/i,
  /^(?:delivery\s*(?:fee|charge)|handling\s*(?:fee|charge)|packaging\s*(?:charges?|fee)|platform\s*(?:fee|charge)|convenience\s*(?:fee|charge)|service\s*(?:fee|charge)|restaurant\s*packaging\s*(?:charges?|fee)|item\s*bill|item\s*total)\b/i,
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

// Expense counterparty labels (payee/merchant)
const EXPENSE_COUNTERPARTY_LABEL_REGEX =
  /^(?:paid\s*to|pay\s*to|transfer\s*to|transferred\s*to|sent\s*to|banking\s*name|purchase\s*at|purchased\s*at|spent\s*at|credit\s*to|biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|service\s*provider|provider(?:\s*name)?|recharge\s*of|purchased\s*from|sold\s*by|restaurant(?:\s*name)?|company(?:\s*name)?|organization|beneficiary(?:\s*name)?|\bto\b)\s*[:\-–—.|]?\s*(.+)$/i;

const EXPENSE_COUNTERPARTY_STANDALONE_REGEX =
  /^(?:paid\s*to|pay\s*to|transfer\s*to|transferred\s*to|sent\s*to|banking\s*name|purchase\s*at|purchased\s*at|spent\s*at|credit\s*to|biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|service\s*provider|provider(?:\s*name)?|recharge\s*of|purchased\s*from|sold\s*by|restaurant(?:\s*name)?|company(?:\s*name)?|organization|beneficiary(?:\s*name)?|\bto\b)\s*[:\-–—.|]?$/i;

// Income counterparty labels (sender/payer)
const INCOME_COUNTERPARTY_LABEL_REGEX =
  /^(?:received\s*from|from|sender(?:\s*name)?|remitter(?:\s*name)?|sent\s*by|transferred\s*from|payment\s*from|payer(?:\s*name)?|client(?:\s*name)?)\s*[:\-–—.|]?\s*(.+)$/i;

const INCOME_COUNTERPARTY_STANDALONE_REGEX =
  /^(?:received\s*from|from|sender(?:\s*name)?|remitter(?:\s*name)?|sent\s*by|transferred\s*from|payment\s*from|payer(?:\s*name)?|client(?:\s*name)?)\s*[:\-–—.|]?$/i;

// Account holder / User's own account lines (disqualified as counterparty)
const USER_ACCOUNT_HOLDER_PATTERNS = [
  /^(?:debited\s*from|paid\s*from|paid\s*by|remitter|account\s*holder|card\s*holder|customer(?:\s*name)?|billed\s*to|buyer(?:\s*name)?|client(?:\s*name)?)\b/i,
  /^(?:credited\s*to(?:\s*(?:bank|a\/c|account))?|credited\s*in|deposited\s*(?:in|to)|recipient(?:\s*name)?|my\s*account)\b/i,
  /^(?:account\s*number|a\/c\s*no|saving(?:s)?\s*a\/c|current\s*a\/c)\b/i
];

// Corporate / business suffix and entity keywords
const BUSINESS_MARKER_REGEX =
  /\b(?:pvt|private|ltd|limited|inc|incorporated|corp|corporation|llc|llp|gmbh|co|company|enterprises|industries|holdings|services|solutions|technologies)\b/i;

const STORE_INDUSTRY_REGEX =
  /\b(?:pharmacy|chemist|medical|clinic|hospital|store|mart|supermarket|bazaar|market|shop|cafe|coffee|restaurant|diner|bakers|bakery|kitchen|grill|bistro|hotel|motors|automotive|energy|power|electric|gas|water|telecom|broadband|station|petrol|fuel|boutique|apparel|jewellers|opticals|retail|beauty|cosmetics)\b/i;

// Semantic contextual category rules
const CATEGORY_CONTEXT_RULES: { category: ExpenseCategory; patterns: RegExp[] }[] = [
  {
    category: 'Utilities',
    patterns: [
      /\b(electric|electricity|power|energy|discom|bescom|cesc|tneb|msedcl|uppcl|dhbvn|torrent\s*power|tata\s*power|adani\s*electricity|utility|utilities)\b/i,
      /\b(water\s*board|water\s*supply|jal\s*board|water\s*bill|sewage|sewerage|drainage)\b/i,
      /\b(gas\s*bill|lpg|png|indane|bharat\s*gas|hp\s*gas|piped\s*gas|gas\s*utility|cylinder|gas\s*limited|indraprastha\s*gas|igl|mgl|city\s*gas|natural\s*gas)\b/i,
      /\b(broadband|internet|fiber|wifi|fibernet|act\s*fiber|hathway|airtel\s*broadband|jio\s*fiber|tata\s*play|dth|cable\s*tv|dish\s*tv|recharge|prepaid|postpaid|telecom|jio)\b/i
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
      /\b(cab|taxi|ride|uber|ola|lyft|rapido|auto\s*rickshaw|metro|transit|subway|bus|train|railway|irctc|flight|airline|airways|indigo|air\s*india|spicejet|toll|fastag|parking|garage|tyres?|tires?|motor\s*service|auto\s*repair|one\s*delhi)\b/i
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
      /\b(beauty|cosmetics|tira|nykaa|sephora|skincare|salon|spa|parlour|barber|laundry|dry\s*clean|dryclean)\b/i,
      /\b(shopping|retail|store|mall|amazon|flipkart|myntra|ajio|meesho|clothing|fashion|garments|wear|boutique|tailor|shoes|footwear)\b/i,
      /\b(school|college|university|tuition|education|academy|institute|fees?)\b/i,
      /\b(electronics|computer|laptop|mobile\s*store|gadgets|appliances|hardware|sanitary)\b/i,
      /\b(stationery|books|bookstore|courier|post|shipping|packaging)\b/i
    ]
  }
];

function cleanMerchantString(str: string): string {
  if (!str) return '';
  let clean = str.trim();

  // Strip leading explicit labels (both expense and income)
  clean = clean.replace(
    /^(?:received\s*from|from|sender(?:\s*name)?|remitter(?:\s*name)?|sent\s*by|transferred\s*from|payment\s*from|payer(?:\s*name)?|client(?:\s*name)?|biller(?:\s*name)?|merchant(?:\s*name)?|payee(?:\s*name)?|seller(?:\s*name)?|vendor(?:\s*name)?|store(?:\s*name)?|supplier(?:\s*name)?|paid\s*to|pay\s*to|transferred\s*to|sent\s*to|service\s*provider|provider(?:\s*name)?|beneficiary(?:\s*name)?|credited\s*to|credit\s*to|purchase\s*at|purchased\s*at|spent\s*at|company(?:\s*name)?|organization|recipient|recharge\s*of|purchased\s*from|sold\s*by|restaurant(?:\s*name)?|\bto\b)\s*[:\-–—.|]?\s*/i,
    ''
  );

  // Strip leading UI words if grouped with merchant
  clean = clean.replace(
    /^(?:help|view\s*history|pay\s*again|share\s*receipt|share|check\s*balance|view\s*balance|open\s*maps?|view\s*ticket|done|close|download|need\s*help\??|split\s*bill|view\s*details|back|home)\b\s*[:\-–—.]?\s*/i,
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
  clean = clean.replace(/\s+(?:[₹$€£¥]|rs\.?|inr)?\s*[x*]?\s*(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/i, '');

  // Strip trailing UI / action words if grouped with merchant at end of line (e.g. "Merchant Name HELP" or "Tata Power View history")
  clean = clean.replace(
    /\s+(?:help|view\s*history|pay\s*again|share\s*receipt|share|check\s*balance|view\s*balance|open\s*maps?|view\s*ticket|done|close|download(?:\s*receipt|\s*invoice|\s*pdf)?|need\s*help\??|split\s*bill|view\s*details|repeat(?:\s*payment)?|raise\s*dispute|report\s*issue)\b.*$/i,
    ''
  );

  // Strip trailing non-alphanumeric chars except closing paren or period
  clean = clean.replace(/[^a-zA-Z0-9.)]+$/, '');

  // Strip trailing lone numbers or symbol artifacts (e.g. "One Delhi 8", "Aditya Upadhyay 2")
  clean = clean.replace(/\s+\d+$/, '');

  // Separate concatenated corporate and entity terms (e.g. "Growwinvesttechprivatelimited" -> "Groww Invest Tech Private Limited")
  clean = clean.replace(/\b(groww)(invest)(tech)(private)(limited)\b/gi, (_m, p1, p2, p3, p4, p5) => {
    return `${p1.charAt(0).toUpperCase() + p1.slice(1).toLowerCase()} ${p2.charAt(0).toUpperCase() + p2.slice(1).toLowerCase()} ${p3.charAt(0).toUpperCase() + p3.slice(1).toLowerCase()} ${p4.charAt(0).toUpperCase() + p4.slice(1).toLowerCase()} ${p5.charAt(0).toUpperCase() + p5.slice(1).toLowerCase()}`;
  });
  clean = clean.replace(/([a-z])(privatelimited)\b/gi, '$1 Private Limited');
  clean = clean.replace(/([a-z])(limited)\b/gi, '$1 Limited');
  clean = clean.replace(/([a-z])(private)\b/gi, '$1 Private');
  clean = clean.replace(/([a-z])(technologies)\b/gi, '$1 Technologies');
  clean = clean.replace(/([a-z])(solutions)\b/gi, '$1 Solutions');

  // Collapse consecutive whitespaces
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

function isValidMerchantCandidate(str: string): boolean {
  if (!str || str.length < 2) return false;

  // Must have at least 2 letters
  const letters = str.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) return false;

  // Cannot match non-merchant patterns
  if (NON_MERCHANT_LINE_PATTERNS.some((p) => p.test(str))) return false;

  // Cannot be purely a number or date or currency
  if (/^[\d\s.,:/\-–—₹$€£¥]+$/.test(str)) return false;

  // Cannot be purely an ID/reference pattern
  if (/^(?:utr|txn|rrn|ref|order|inv|gstin|pan|cin)\s*[:#\-]/i.test(str)) return false;

  // Cannot be a total or subtotal phrase
  if (/^(?:sub\s*-?\s*total|total|amount|balance|due|payable|change)\b/i.test(str)) return false;

  // Cannot be a payment platform or payment method
  if (PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(str))) return false;

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

  const targetLabelRegex = isIncome ? INCOME_COUNTERPARTY_LABEL_REGEX : EXPENSE_COUNTERPARTY_LABEL_REGEX;
  const targetStandaloneRegex = isIncome ? INCOME_COUNTERPARTY_STANDALONE_REGEX : EXPENSE_COUNTERPARTY_STANDALONE_REGEX;

  // 1. Scan for explicit labeled fields (e.g. "Paid to: ...", "To: ...", "Received from: ...", "From: ...")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check same-line label with separator: e.g. "Paid to: XYZ" or "From: ABC"
    const matchSameLine = line.match(targetLabelRegex);
    if (matchSameLine && matchSameLine[1]) {
      const val = matchSameLine[1].trim();
      const cleaned = cleanMerchantString(val);
      if (isValidMerchantCandidate(cleaned)) {
        let score = 200;
        if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 30;
        if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 30;
        // Penalize if matches user account holder pattern
        if (USER_ACCOUNT_HOLDER_PATTERNS.some((p) => p.test(line))) score -= 150;
        candidates.push({
          name: cleaned,
          source: 'labeled',
          lineIndex: i,
          score
        });
      }
    }

    // Check standalone label line: e.g. "Paid to" or "To" or "From" or "Received from"
    const matchStandalone = line.match(targetStandaloneRegex);
    if (matchStandalone && i + 1 < lines.length) {
      let nextLineIndex = i + 1;
      while (
        nextLineIndex < lines.length &&
        (!lines[nextLineIndex].trim() ||
          NON_MERCHANT_LINE_PATTERNS.some((p) => p.test(lines[nextLineIndex])))
      ) {
        nextLineIndex++;
      }

      if (nextLineIndex < lines.length && nextLineIndex <= i + 2) {
        let nextLine = lines[nextLineIndex].trim();
        // Strip leading avatar icons in brackets/parentheses e.g. [=], [2], (2)
        nextLine = nextLine.replace(/^(?:\[[^\]]*\]|\([^)]*\)|[^\w\s])\s*/, '');
        // Strip isolated single-letter prefix e.g. "e pradeep store" -> "pradeep store"
        nextLine = nextLine.replace(/^[a-z]\s+(?=[a-z]{2,})/i, '');
        // Strip trailing amount from nextLine before checking next line suffix
        nextLine = nextLine.replace(/\s+(?:[₹$€£¥]|rs\.?|inr)?\s*(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/i, '');
        // If next line contains corporate/entity suffix (e.g. "GAS LIMITED"), combine
        if (
          nextLineIndex + 1 < lines.length &&
          /^(?:gas\s*limited|pvt|ltd|limited|enterprises|industries|holdings|technologies)\b/i.test(lines[nextLineIndex + 1])
        ) {
          nextLine += ' ' + lines[nextLineIndex + 1].trim();
        }

        if (
          nextLine.length >= 2 &&
          !PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(nextLine))
        ) {
          const cleaned = cleanMerchantString(nextLine);
          if (isValidMerchantCandidate(cleaned)) {
            let score = 190;
            if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 30;
            if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 30;
            if (USER_ACCOUNT_HOLDER_PATTERNS.some((p) => p.test(nextLine))) score -= 150;
            candidates.push({
              name: cleaned,
              source: 'labeled',
              lineIndex: nextLineIndex,
              score
            });
          }
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

    // Avoid user account holder lines as merchant
    if (USER_ACCOUNT_HOLDER_PATTERNS.some((p) => p.test(line))) continue;

    const isPaymentPlatform = PAYMENT_PLATFORM_PATTERNS.some((p) => p.test(line));

    const cleaned = cleanMerchantString(line);
    if (!isValidMerchantCandidate(cleaned)) continue;

    let score = 0;
    // Position score (higher near top of receipt header)
    if (i === 0) score += 70;
    else if (i === 1) score += 60;
    else if (i === 2) score += 50;
    else if (i < 5) score += 30;
    else score += 10;

    // Business entity marker bonus
    if (BUSINESS_MARKER_REGEX.test(cleaned)) score += 50;
    if (STORE_INDUSTRY_REGEX.test(cleaned)) score += 40;

    // Formatting bonus
    if (/^[A-Z]/.test(cleaned)) score += 10;
    if (/^[A-Za-z\s&'-]+$/.test(cleaned)) score += 15;
    if (cleaned.length >= 4 && cleaned.length <= 35) score += 15;

    // Penalties
    if (isPaymentPlatform) score -= 100;
    if (/\d/.test(cleaned)) score -= 25;
    if (/\b(?:st|ave|blvd|rd|road|street|lane|nagar|sector|floor|pin|zip)\b/i.test(cleaned)) score -= 70;
    if (/\b(?:total|amount|due|paid|balance|change|subtotal)\b/i.test(cleaned)) score -= 90;

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

function sanitizeLineForAmount(line: string): string {
  let s = line;

  // 1. Remove timestamps: e.g. 04:15 PM, 16:30:00, 04:15:20 AM, 12:30 PM, 9AM, 8 AM, 11 AM
  s = s.replace(/\b\d{1,2}(?::\d{2}(?::\d{2})?)?\s*(?:am|pm)\b/gi, ' ');
  s = s.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');

  // 2. Remove standard date patterns so date numbers are never parsed as amounts
  s = s.replace(
    /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]['’]?\d{2,4})\b/gi,
    ' '
  );

  // 3. Remove bank account suffixes & card suffixes: e.g. "HDFC Bank - 0456", "SBI - 1234", "State Bank of India - 8443", "...8443", "ending in 4102", "ending with 5678"
  s = s.replace(
    /\b(?:debited\s*from|paid\s*from|paid\s*via|credited\s*to|transferred\s*from|bank|a\/c|account|card)\b[^\n\r]*?\b(?:ending\s*(?:with|in)?\s*)?[-–—:#\s]*[xX*.]*\d{2,6}\b/gi,
    ' '
  );
  s = s.replace(
    /\b(?:sbi|hdfc|icici|axis|pnb|bob|kotak|canara|union|idfc|yes|citi)\s*(?:bank)?\s*[-–—:#\s]+[xX*.]*\d{2,6}\b/gi,
    ' '
  );
  s = s.replace(/\b(?:ending\s*(?:with|in))\s*[-–—:#\s]*[xX*.]*\d{2,6}\b/gi, ' ');
  s = s.replace(/\b(?:account|a\/c|card)\s*(?:no|num)?[:\s#\-]*(?:[xX*.]*\d{3,})\b/gi, ' ');
  s = s.replace(/\b[xX*]{2,}\d{2,6}\b/g, ' ');
  s = s.replace(/\b\.{2,}\d{2,6}\b/g, ' '); // e.g. ...8443 or ...7890

  // 4. Remove identifier labels and their values:
  s = s.replace(
    /\b(?:utr(?:\s*no)?|txn(?:\s*id)?|transaction\s*id|upi\s*(?:ref|txn)(?:\s*no)?|ref(?:\s*no|\s*id|\s*num)?|reference\s*(?:no|id|number)?|rrn|order(?:\s*id|\s*no|\s*num|\s*number)?|invoice(?:\s*id|\s*no|\s*num|\s*number)?|inv(?:\s*no)?|bill(?:\s*id|\s*no)?|receipt(?:\s*no)?|ticket(?:\s*id|\s*no)?|route|bus\s*route|approval\s*code|auth\s*code|arn|roll\s*(?:no)?|consumer\s*(?:no|num|id)?|ca\s*no|meter\s*(?:no)?|connection\s*id|customer\s*id)\b[:\s#\-]*(?:[a-zA-Z0-9_-]+)/gi,
    ' '
  );

  // 5. Remove long integer sequences (10+ digits without decimal like UTR, txn IDs, long account numbers)
  s = s.replace(/\b\d{10,}\b/g, ' ');

  // 6. Remove phone numbers (various formats):
  s = s.replace(/\b(?:phone|mobile|tel|contact|helpline|support)\b[:\s#\-]*(?:\+?\d{1,3}[-\s]?)?(?:\d{3,5}[-\s]?\d{3,5}|\d{10})\b/gi, ' ');
  s = s.replace(/\b(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}\b/g, ' ');
  s = s.replace(/\b(?:\+91[-\s]?)?[6-9]\d{2}[-\s]?\d{3}[-\s]?\d{4}\b/g, ' ');

  // 7. Remove UPI IDs (including trailing numbers):
  s = s.replace(/\b[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+\b/g, ' ');

  // 8. Remove postal/PIN codes and OTPs/UPI PINs:
  s = s.replace(/\b(?:pin|postal|zip)\s*(?:code)?[:\s\-]*\d{6}\b/gi, ' ');
  s = s.replace(/\b(?:otp|one\s*time\s*password|security\s*code)\b[:\s#\-]*\d{4,8}\b/gi, ' ');
  s = s.replace(/\b(?:upi\s*)?pin\b[:\s#\-]*\d{4,6}\b/gi, ' ');

  // 9. Remove quantities, counters, table, token, cashier, terminal numbers:
  s = s.replace(
    /\b(?:qty|quantity|items?|units?|nos?|table|token|counter|cashier|terminal|screen|seat|tickets?|page|version|rating|step|route)\b[:\s#\-]*\d+\b/gi,
    ' '
  );
  s = s.replace(/\b\d+\s*(?:pcs|items?|qty|units?|nos?|plates?|packs?)\b/gi, ' ');
  s = s.replace(/\b\d+\s*[xX]\b/g, ' ');
  s = s.replace(/\b[xX]\s*\d+\b/g, ' ');

  // 10. Remove promotional cashback / reward points / savings:
  s = s.replace(
    /\b(?:cashback|reward\s*points?|earned\s*points?|points\s*earned|you\s*saved|savings?)\b[:\s#\-]*(?:[₹$€£¥]|rs\.?|inr)?\s*\d+(?:\.\d{1,2})?\b/gi,
    ' '
  );

  // 11. Remove payment partner footers and app navigation UI
  s = s.replace(/\b(?:paytm|phonepe|gpay|google\s*pay|bhim|upi)\s*\|.*$/gi, ' ');
  s = s.replace(/\b(?:lipid|ljp|yes\s*bank|axis\s*bank|sbi|hdfc|icici)\b[^\n\r]*/gi, ' ');
  s = s.replace(/\b(?:split\s*this\s*payment|split\s*bill|share\s*receipt|need\s*help\??)\b.*$/gi, ' ');
  s = s.replace(/\b(?:hl\s*o\s*<|[<>]|\bcopy\b)\s*$/gi, ' ');

  // 12. Remove bottom navigation bars / Android icons (e.g. "2 © id <", "1 oO <", "[1 @] <", "[1 oO <", "CG) 4 <", "2 © Y o&")
  s = s.replace(/^[0-9\s\[\](){}<>|oO0@©®™*^~_#\-=+/:;!?'"]*[<>oO@©®™][0-9\s\[\](){}<>|oO0@©®™*^~_#\-=+/:;!?'"]*$/gm, ' ');
  s = s.replace(/\b(?:send\s*again|view\s*history|split\s*expense|share\s*receipt|contact\s*phonepe|powered\s*by)\b.*$/gim, ' ');

  return s;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const MAGNITUDES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  million: 1000000,
  crore: 10000000,
  crores: 10000000
};

export function parseWordsToAmount(phrase: string): number | null {
  if (!phrase) return null;

  const lower = phrase.toLowerCase().replace(/[-–—]/g, ' ');
  const words = lower.match(/[a-z]+/g);
  if (!words) return null;

  let hasNumberWord = false;
  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined || MAGNITUDES[w] !== undefined) {
      hasNumberWord = true;
      break;
    }
  }
  if (!hasNumberWord) return null;

  // Check for paise / cents part at the end
  let mainPart = lower;
  let paisaVal = 0;

  const paisaRegex = /(?:and\s+)?((?:[a-z]+\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))\s+(?:paise?|paisa|cents?)\b/i;
  const paisaMatch = mainPart.match(paisaRegex);
  if (paisaMatch) {
    const rawPaisaText = paisaMatch[1].trim();
    mainPart = mainPart.replace(paisaMatch[0], ' ');
    const pTokens = rawPaisaText.match(/[a-z]+/g) || [];
    let pSum = 0;
    for (const pt of pTokens) {
      if (NUMBER_WORDS[pt] !== undefined) pSum += NUMBER_WORDS[pt];
    }
    paisaVal = pSum / 100;
  }

  // Check for explicit indicator of legal words amount
  const hasLegalAmountMarker = /\b(?:rupees?|rs|inr|dollars?|cents?|paise?|paisa|only|sum\s*of|amount\s*in\s*words|in\s*words)\b/i.test(lower);

  // Clean main part
  mainPart = mainPart.replace(/\b(?:rupees?|rs|inr|dollars?|cents?|paise?|paisa|only|and|sum\s*of|amount\s*in\s*words|in\s*words)\b/g, ' ').trim();

  const tokens = mainPart.match(/[a-z]+/g) || [];
  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;

  for (const token of tokens) {
    if (NUMBER_WORDS[token] !== undefined) {
      current += NUMBER_WORDS[token];
    } else if (token === 'hundred') {
      current = (current === 0 ? 1 : current) * 100;
    } else if (MAGNITUDES[token] !== undefined) {
      const mag = MAGNITUDES[token];
      total += (current === 0 ? 1 : current) * mag;
      current = 0;
    } else {
      // Encountered non-number word (e.g. "commune", "trippy", "delhi", "pizza") -> NOT a word amount!
      return null;
    }
  }

  // Without explicit legal indicator ("rupees", "only"), an isolated single digit (e.g. "one") is not a currency amount
  if (!hasLegalAmountMarker && tokens.length === 1 && total + current <= 10) {
    return null;
  }

  const mainVal = total + current;
  const result = Math.round((mainVal + paisaVal) * 100) / 100;
  return result > 0 ? result : null;
}

function parseReceiptMonetaryValue(str: string): number | null {
  if (!str) return null;
  let clean = str.trim();
  const hasCurrencySymbol = /(?:[₹$€£¥]|rs\.?|inr)/i.test(clean);

  clean = clean.replace(/^[₹$€£¥\s]+/, '');
  clean = clean.replace(/^(?:rs\.?|inr)\s*/i, '');
  clean = clean.replace(/^[%Xx*?~#§✓✔•]+\s*/, '');

  // Reject long digit sequences without decimal (e.g. UTR, account numbers, phone numbers)
  if (/^\d{6,}$/.test(clean) && !hasCurrencySymbol && !/,/.test(clean)) {
    return null;
  }

  // Reject 4-digit years (1990 - 2040) if without decimal and without currency symbol
  if (/^(?:199\d|20[0-4]\d)$/.test(clean) && !hasCurrencySymbol) {
    return null;
  }

  // Indian format: 1,20,000 or 1,50,000.50 or 2,746.50
  if (/^\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$/.test(clean)) {
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
  const sanitizedLine = sanitizeLineForAmount(line).trim();
  if (!sanitizedLine) return [];

  const results: { raw: string; value: number }[] = [];
  const regex = /(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§✓✔•])?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
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

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function normalizeReceiptDateString(rawDate: string): string | null {
  if (!rawDate) return null;
  let clean = rawDate
    .trim()
    .replace(/['’]/g, '')
    .replace(/,/g, ' ')
    .replace(/(\d{1,2})(?:st|nd|rd|th)/i, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = dmyMatch[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // DD-Mon-YYYY or DD Mon YYYY (e.g. 24 Sep 2026, 22 Jan 26, 22 January 2026)
  const dmyMonthMatch = clean.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/);
  if (dmyMonthMatch) {
    const d = dmyMonthMatch[1].padStart(2, '0');
    const monStr = dmyMonthMatch[2].slice(0, 3).toLowerCase();
    const m = MONTH_MAP[monStr] || '01';
    let y = dmyMonthMatch[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  // Mon DD YYYY or Month DD, YYYY (e.g. Jan 22 2026, January 22 2026, Jan 22 26)
  const mdyMonthMatch = clean.match(/^([A-Za-z]{3,9})[-/\s](\d{1,2})[-/\s](\d{2,4})$/);
  if (mdyMonthMatch) {
    const monStr = mdyMonthMatch[1].slice(0, 3).toLowerCase();
    const m = MONTH_MAP[monStr] || '01';
    const d = mdyMonthMatch[2].padStart(2, '0');
    let y = mdyMonthMatch[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  return null;
}

function isValidReceiptDate(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (y < 2000 || y > 2035) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  return true;
}

export function extractReceiptDate(rawText: string, lines: string[]): string {
  const DATE_CAPTURE_REGEX =
    /(?:\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{1,2}(?:st|nd|rd|th)?[-/.\s,]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s,]+['’]?\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s,]+\d{1,2}(?:st|nd|rd|th)?(?:[-/.\s,]+['’]?\d{2,4})?\b)/i;

  // 1. Explicitly labeled date lines (highest confidence)
  const EXPLICIT_DATE_LABEL_REGEX =
    /\b(?:payment\s*(?:date|time)|bill\s*(?:date|time)|txn\s*(?:date|time)|transaction\s*(?:date|time)|order\s*(?:date|time)|trip\s*(?:date|time)|invoice\s*(?:date|time)|paid\s*(?:on|at)|transferred\s*(?:on|at)|dated|date|time)\b[:\s\-–—]*([^\n\r]+)/i;

  for (const line of lines) {
    const m = line.match(EXPLICIT_DATE_LABEL_REGEX);
    if (m && m[1]) {
      const match = m[1].match(DATE_CAPTURE_REGEX);
      if (match) {
        const norm = normalizeReceiptDateString(match[0]);
        if (norm && isValidReceiptDate(norm)) {
          return norm;
        }
      }
    }
  }

  // 2. Timestamps with dates (e.g. "04:15 PM, 24 Sep 2026", "11 AM, 22 Jan '26")
  for (const line of lines) {
    if (/\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm))\b/i.test(line)) {
      const match = line.match(DATE_CAPTURE_REGEX);
      if (match) {
        const norm = normalizeReceiptDateString(match[0]);
        if (norm && isValidReceiptDate(norm)) {
          return norm;
        }
      }
    }
  }

  // 3. Scan general lines from top to bottom (skipping technical IDs, phone status bars)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip phone status bar at the top (battery percentage, wifi icons, notification time)
    if (i === 0 && /(?:\d+%\s*$|rel\s*all|\b(?:volte|lte|4g|5g|wifi|kb\/s|mb\/s)\b)/i.test(line)) continue;
    if (/^(?:txn|utr|ref|rrn|card|total|amount|balance|upi\s*transaction\s*id)\b/i.test(line)) continue;
    const match = line.match(DATE_CAPTURE_REGEX);
    if (match) {
      const norm = normalizeReceiptDateString(match[0]);
      if (norm && isValidReceiptDate(norm)) {
        return norm;
      }
    }
  }

  // 4. PhonePe / UPI Transaction ID timestamp (e.g. T2609212140456689655411 -> 2026-09-21)
  const phonePeMatch = rawText.match(/\bT(2[4-9]|20[2-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{6,}\b/i);
  if (phonePeMatch) {
    const y = phonePeMatch[1].length === 2 ? `20${phonePeMatch[1]}` : phonePeMatch[1];
    const m = phonePeMatch[2];
    const d = phonePeMatch[3];
    const norm = `${y}-${m}-${d}`;
    if (isValidReceiptDate(norm)) {
      return norm;
    }
  }

  return new Date().toISOString().split('T')[0];
}

export function detectTransactionType(rawText: string, lines: string[]): 'expense' | 'income' {
  let incomeScore = 0;
  let expenseScore = 0;

  // Explicit Income Patterns
  const INCOME_STRONG_PATTERNS = [
    /\b(?:money\s*received|payment\s*received|amount\s*received|transfer\s*received|refund\s*received|cash\s*received)\b/i,
    /\b(?:received\s*from|received\s*payment|received\s*money|\breceived\b)\b/i,
    /\b(?:credited\s*(?:to|in)?|amount\s*credited|\bcredited\b)\b/i,
    /\bcredit\b(?!\s*card)/i,
    /\b(?:direct\s*deposit|salary\s*(?:credit|deposit)?|payroll|paycheck)\b/i
  ];

  const INCOME_SECONDARY_PATTERNS = [
    /\b(?:deposit|dividend|interest|stipend|refund|cashback|inflow)\b/i
  ];

  // Explicit Expense Patterns
  const EXPENSE_STRONG_PATTERNS = [
    /\b(?:paid\s*successfully|payment\s*successful|transferred\s*successfully|successfully\s*paid)\b/i,
    /\b(?:paid\s*to|pay\s*to|transferred\s*to|transfer\s*to|sent\s*to|money\s*sent|\bpaid\b)\b/i,
    /\b(?:amount\s*paid|paid\s*amount|you\s*paid)\b/i,
    /\b(?:debited\s*(?:from)?|amount\s*debited|\bdebited\b|\bdebit\b)\b/i,
    /\b(?:bill\s*paid|bill\s*payment|utility\s*bill|recharge(?:\s*of|\s*amount)?|\brecharge\b)\b/i,
    /\b(?:tax\s*invoice|retail\s*invoice|sales\s*receipt|cash\s*memo)\b/i
  ];

  const EXPENSE_SECONDARY_PATTERNS = [
    /\b(?:purchase|order\s*total|grand\s*total)\b/i
  ];

  for (const line of lines) {
    for (const pat of INCOME_STRONG_PATTERNS) {
      if (pat.test(line)) incomeScore += 100;
    }
    for (const pat of EXPENSE_STRONG_PATTERNS) {
      if (pat.test(line)) expenseScore += 100;
    }
  }

  // If still ambiguous, check secondary patterns
  if (incomeScore === 0 && expenseScore === 0) {
    for (const pat of INCOME_SECONDARY_PATTERNS) {
      if (pat.test(rawText)) incomeScore += 40;
    }
    for (const pat of EXPENSE_SECONDARY_PATTERNS) {
      if (pat.test(rawText)) expenseScore += 40;
    }
  }

  return incomeScore > expenseScore ? 'income' : 'expense';
}

export function extractReceiptAmount(
  rawText: string,
  lines: string[],
  calculatedTotal: number = 0,
  lineItemsSum: number = 0
): number {
  interface AmountCandidate {
    amount: number;
    rawString: string;
    lineIndex: number;
    hasCurrencySymbol: boolean;
    hasDecimal: boolean;
    score: number;
    matchedLabel?: string;
  }

  const candidates: AmountCandidate[] = [];
  const totalDocLines = Math.max(1, lines.length);

  // Check if mobile payment context (GPay, PhonePe, Paytm, BHIM, UPI, Payment Successful, Money Received, Paid Successfully, Paid to, Transfer to, Debited from)
  const isMobilePaymentContext =
    /\b(payment\s*successful|paid\s*successfully|transferred\s*successfully|money\s*received|payment\s*received|amount\s*received|google\s*pay|phonepe|paytm|bhim|upi|bill\s*payment|recharge\s*successful|paid\s*to|transfer\s*to|debited\s*from)\b/i.test(
      rawText
    );

  // Check for PhonePe / UPI structured payment lines (Recipient line and Debited line)
  let phonePeRecipientAmt: number | null = null;
  let phonePeDebitedAmt: number | null = null;
  let recipientLineIdx = -1;
  let debitedLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(?:paid\s*to|transfer\s*to)\s*[:\-–—]?\s*$/i.test(l.trim()) && i + 1 < lines.length) {
      if (!/\b(?:sub\s*-?\s*total|gross\s*total|items?\s*total|cgst|sgst|gst|tax)\b/i.test(lines[i + 1])) {
        recipientLineIdx = i + 1;
        const sanitized = sanitizeLineForAmount(lines[i + 1]).trim();
        const amtMatch = sanitized.match(/(?:[₹$€£¥]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/i);
        if (amtMatch) {
          const val = parseFloat(amtMatch[1].replace(/,/g, ''));
          if (!isNaN(val) && val > 0 && val < 500000 && !/^\d{5,}$/.test(amtMatch[1])) {
            phonePeRecipientAmt = val;
          }
        }
      }
    }
    if (/debited\s*from/i.test(l) && i + 1 < lines.length) {
      debitedLineIdx = i + 1;
      const sanitized = sanitizeLineForAmount(lines[i + 1]).trim();
      const amtMatch = sanitized.match(/(?:[₹$€£¥]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/i);
      if (amtMatch) {
        const val = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 500000 && !/^\d{5,}$/.test(amtMatch[1])) {
          phonePeDebitedAmt = val;
        }
      }
    }
  }

  function normalizeRupeeGlyphAmount(v: number): number {
    const s = Math.round(v).toString();
    // e.g. 21500 -> 1500, 21600 -> 1600
    if (/^2[1-9]\d{3}$/.test(s)) {
      return parseFloat(s.slice(1));
    }
    // e.g. 2200 -> 200, 2500 -> 500, 2100 -> 100
    if (/^[23][1-9]00$/.test(s)) {
      return parseFloat(s.slice(1));
    }
    // e.g. 325 -> 25
    if (/^[23][1-9]5$/.test(s)) {
      return parseFloat(s.slice(1));
    }
    return v;
  }

  if (phonePeRecipientAmt !== null && phonePeRecipientAmt > 0) {
    const normRecipient = normalizeRupeeGlyphAmount(phonePeRecipientAmt);
    candidates.push({
      amount: normRecipient,
      rawString: phonePeRecipientAmt.toString(),
      lineIndex: recipientLineIdx,
      hasCurrencySymbol: true,
      hasDecimal: normRecipient % 1 !== 0,
      score: 550,
      matchedLabel: 'PHONEPE_RECIPIENT_AMOUNT'
    });
  }

  if (phonePeDebitedAmt !== null && phonePeDebitedAmt > 0) {
    const normDebited = normalizeRupeeGlyphAmount(phonePeDebitedAmt);
    const score =
      phonePeRecipientAmt !== null &&
      Math.abs(normDebited - normalizeRupeeGlyphAmount(phonePeRecipientAmt)) < 0.001
        ? 600
        : 520;
    candidates.push({
      amount: normDebited,
      rawString: phonePeDebitedAmt.toString(),
      lineIndex: debitedLineIdx,
      hasCurrencySymbol: true,
      hasDecimal: normDebited % 1 !== 0,
      score,
      matchedLabel: 'PHONEPE_DEBITED_AMOUNT'
    });
  }

interface ReconciledBreakdown {
  detectedSubtotal: number;
  detectedFee: number;
  detectedDiscount: number;
  detectedTax: number;
  targetComputedTotal: number;
  confirmedPaidAmount?: number;
  isConfirmedByArithmetic: boolean;
}

function reconcileBreakdownWithGlyphContext(
  lines: string[],
  rawText: string
): ReconciledBreakdown {
  let rawSubtotal = 0;
  let rawDiscount = 0;
  let rawTax = 0;
  const feeItems: { text: string; val: number }[] = [];
  let rawFinalPaid = 0;

  for (const line of lines) {
    const amtMatches = Array.from(
      line.matchAll(/(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§✓✔•])?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi)
    );
    if (amtMatches.length === 0) continue;
    const lastToken = amtMatches[amtMatches.length - 1][1];
    const val = parseFloat(lastToken.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) continue;

    if (/\b(?:sub\s*-?\s*total|subtotal|items?\s*total|item\s*bill|items?\s*bill)\b/i.test(line)) {
      if (rawSubtotal === 0) rawSubtotal = val;
    } else if (
      /\b(?:delivery\s*(?:fee|charge)|handling\s*(?:fee|charge)|packaging\s*(?:charges?|fee)|platform\s*(?:fee|charge)|convenience\s*(?:fee|charge)|service\s*(?:charge|fee)|toll)\b/i.test(
        line
      )
    ) {
      feeItems.push({ text: line, val });
    } else if (
      /\b(?:discount|disc\b|rebate|coupon|offer\s*discount)\b/i.test(line) &&
      !/\b(?:saved|you\s*saved)\b/i.test(line)
    ) {
      rawDiscount += val;
    } else if (/\b(?:cgst|sgst|igst|gst|vat|sales\s*tax|tax)\b/i.test(line) && !/tax\s*invoice/i.test(line)) {
      rawTax += val;
    } else if (
      /\b(?:amount\s*paid|paid\s*amount|total\s*paid|you\s*paid|\bpaid\b|final\s*amount|net\s*amount|amount\s*payable|amount\s*due|balance\s*due)\b/i.test(
        line
      )
    ) {
      if (rawFinalPaid === 0) rawFinalPaid = val;
    }
  }

  const rawFees = feeItems.reduce((acc, f) => acc + f.val, 0);

  function getFeeCandidates(item: { text: string; val: number }): number[] {
    const opts = [item.val];
    // Delivery / platform fee with OCR leading glyph 2XX or 3XX (e.g. 216 -> 16)
    if (item.val >= 200 && item.val < 400 && /delivery|platform|convenience|service/i.test(item.text)) {
      opts.unshift(item.val % 100);
    }
    // Handling fee e.g. 38 -> 8
    if (item.val >= 20 && item.val < 100 && /handling/i.test(item.text) && item.val % 10 !== 0) {
      opts.unshift(item.val % 10);
    }
    return opts;
  }

  function getSubtotalCandidates(v: number): number[] {
    const opts = [v];
    if (v >= 2000 && v < 4000) {
      opts.unshift(v % 1000);
    }
    return opts;
  }

  function getPaidCandidates(v: number): number[] {
    const opts = [v];
    if (v >= 2000 && v < 4000) {
      opts.unshift(v % 1000);
    }
    return opts;
  }

  // 1. Check if raw matches perfectly without suspect fee artifacts
  if (rawSubtotal > 0 && rawFinalPaid > 0) {
    const rawComputed = Math.round((rawSubtotal + rawFees + rawTax - rawDiscount) * 100) / 100;
    const hasSuspectRawFee = feeItems.some(f => f.val >= 200 && f.val < 400 && /delivery|platform/i.test(f.text));
    if (!hasSuspectRawFee && Math.abs(rawComputed - rawFinalPaid) < 0.05) {
      return {
        detectedSubtotal: rawSubtotal,
        detectedFee: rawFees,
        detectedDiscount: rawDiscount,
        detectedTax: rawTax,
        targetComputedTotal: rawComputed,
        confirmedPaidAmount: rawFinalPaid,
        isConfirmedByArithmetic: true
      };
    }

    // 2. Test glyph-normalized permutations (prioritizing normalized values)
    const subOpts = getSubtotalCandidates(rawSubtotal);
    const paidOpts = getPaidCandidates(rawFinalPaid);

    let feeCombinations: number[] = [0];
    for (const item of feeItems) {
      const cands = getFeeCandidates(item);
      const nextCombos: number[] = [];
      for (const prev of feeCombinations) {
        for (const c of cands) {
          nextCombos.push(prev + c);
        }
      }
      feeCombinations = nextCombos;
    }

    for (const p of paidOpts) {
      for (const s of subOpts) {
        for (const f of feeCombinations) {
          const comp = Math.round((s + f + rawTax - rawDiscount) * 100) / 100;
          if (Math.abs(comp - p) < 0.05) {
            return {
              detectedSubtotal: s,
              detectedFee: f,
              detectedDiscount: rawDiscount,
              detectedTax: rawTax,
              targetComputedTotal: comp,
              confirmedPaidAmount: p,
              isConfirmedByArithmetic: true
            };
          }
        }
      }
    }

    // 3. Subtotal and Paid consistency check without full fee balance
    const sNorm = rawSubtotal >= 2000 && rawSubtotal < 4000 ? rawSubtotal % 1000 : rawSubtotal;
    const pNorm = rawFinalPaid >= 2000 && rawFinalPaid < 4000 ? rawFinalPaid % 1000 : rawFinalPaid;
    if (pNorm >= sNorm && pNorm - sNorm < 150 && rawFinalPaid >= 2000 && rawFinalPaid < 4000) {
      return {
        detectedSubtotal: sNorm,
        detectedFee: rawFees,
        detectedDiscount: rawDiscount,
        detectedTax: rawTax,
        targetComputedTotal: pNorm,
        confirmedPaidAmount: pNorm,
        isConfirmedByArithmetic: true
      };
    }
  }

  return {
    detectedSubtotal: rawSubtotal,
    detectedFee: rawFees,
    detectedDiscount: rawDiscount,
    detectedTax: rawTax,
    targetComputedTotal: rawSubtotal > 0 ? rawSubtotal + rawFees + rawTax - rawDiscount : 0,
    isConfirmedByArithmetic: false
  };
}

  // Check for explicit subtotal and tax amounts to calculate or compare using generalized breakdown reconciliation
  const breakdown = reconcileBreakdownWithGlyphContext(lines, rawText);
  let detectedSubtotal = breakdown.detectedSubtotal;
  let detectedTax = breakdown.detectedTax;
  let detectedDiscount = breakdown.detectedDiscount;
  let detectedFee = breakdown.detectedFee;
  const arithmeticConfirmedPaid = breakdown.confirmedPaidAmount;

  const targetComputedTotal =
    calculatedTotal > 0
      ? calculatedTotal
      : breakdown.targetComputedTotal > 0
        ? breakdown.targetComputedTotal
        : lineItemsSum;

  if (arithmeticConfirmedPaid !== undefined && breakdown.isConfirmedByArithmetic && arithmeticConfirmedPaid > 0) {
    candidates.push({
      amount: arithmeticConfirmedPaid,
      rawString: arithmeticConfirmedPaid.toString(),
      lineIndex: 0,
      hasCurrencySymbol: true,
      hasDecimal: arithmeticConfirmedPaid % 1 !== 0,
      score: 620,
      matchedLabel: 'ARITHMETIC_CONFIRMED_FINAL_PAYMENT'
    });
  }

  // Check if document contains ANY explicit Tier 1 final-payment label
  const docHasTier1Label = lines.some((l) =>
    EXPLICIT_FINAL_PAYMENT_PATTERNS.some((p) => p.test(l))
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Tier 1, Tier 2, or Tier 3 total label
    let matchedTier = 0;
    let matchedLabel = '';

    const isTaxLine =
      /\b(?:cgst|sgst|igst|gst|vat|sales\s*tax|tax)\b/i.test(line) &&
      !/\b(?:tax\s*invoice|grand\s*total|total\s*amount|final\s*amount|net\s*amount|bill\s*amount|amount\s*paid|paid|you\s*paid|total\s*paid)\b/i.test(line);

    if (!isTaxLine) {
      for (const pat of EXPLICIT_FINAL_PAYMENT_PATTERNS) {
        const m = line.match(pat);
        if (m) {
          matchedTier = 1;
          matchedLabel = m[0].toUpperCase();
          break;
        }
      }
      if (matchedTier === 0) {
        for (const pat of EXPLICIT_GRAND_TOTAL_PATTERNS) {
          const m = line.match(pat);
          if (m) {
            matchedTier = 2;
            matchedLabel = m[0].toUpperCase();
            break;
          }
        }
      }
      if (matchedTier === 0) {
        for (const pat of EXPLICIT_FALLBACK_TOTAL_PATTERNS) {
          const m = line.match(pat);
          if (m) {
            matchedTier = 3;
            matchedLabel = m[0].toUpperCase();
            break;
          }
        }
      }
    }

    // Disqualify line if it represents non-total elements AND does NOT match a Tier 1 label
    const isDisqualifiedNonTotal =
      NON_TOTAL_LINE_PATTERNS.some((p) => p.test(line)) && matchedTier !== 1;

    // Check if previous line had a standalone Tier 1 label (e.g. "Grand Total" or "Amount" on line i-1, amount on line i)
    let prevLineTier1 = false;
    if (i > 0) {
      const prevLine = lines[i - 1].trim();
      if (
        EXPLICIT_FINAL_PAYMENT_PATTERNS.some((p) => p.test(prevLine)) &&
        !NON_TOTAL_LINE_PATTERNS.some((p) => p.test(prevLine)) &&
        extractReceiptLineAmounts(prevLine).length === 0
      ) {
        prevLineTier1 = true;
        matchedTier = 1;
        matchedLabel = prevLine.toUpperCase();
      } else if (
        matchedTier === 0 &&
        EXPLICIT_GRAND_TOTAL_PATTERNS.some((p) => p.test(prevLine)) &&
        !NON_TOTAL_LINE_PATTERNS.some((p) => p.test(prevLine)) &&
        extractReceiptLineAmounts(prevLine).length === 0
      ) {
        matchedTier = 2;
        matchedLabel = prevLine.toUpperCase();
      }
    }

    // Check if next line has a standalone Tier 1 label (e.g. amount on line i, "You paid" or "Amount paid" on line i+1)
    let nextLineTier1 = false;
    let nextLineIsYouPaid = false;
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (
        EXPLICIT_FINAL_PAYMENT_PATTERNS.some((p) => p.test(nextLine)) &&
        !NON_TOTAL_LINE_PATTERNS.some((p) => p.test(nextLine)) &&
        extractReceiptLineAmounts(nextLine).length === 0
      ) {
        nextLineTier1 = true;
        matchedTier = 1;
        matchedLabel = nextLine.toUpperCase();
        if (/\byou\s*paid\b/i.test(nextLine)) {
          nextLineIsYouPaid = true;
        }
      }
    }

    // Check if within 2 lines of primary transaction status header (e.g. "Payment Successful" or "Money Received" or "Paid Successfully")
    let nearPaymentStatus = false;
    for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 1); k++) {
      if (
        k !== i &&
        /\b(?:payment\s*successful|paid\s*successfully|transferred\s*successfully|money\s*received|payment\s*received|amount\s*received|transaction\s*successful|bill\s*payment|recharge\s*successful)\b/i.test(
          lines[k]
        )
      ) {
        nearPaymentStatus = true;
        break;
      }
    }

    // Check if the entire line is a standalone prominent amount (e.g. "₹291" or "₹350" or "₹620.01" or "₹9" or "₹30" or "₹189")
    const isStandaloneAmountLine = /^[\s₹$€£¥rs.inr✓✔+•*#\-_]*(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)[\s]*$/i.test(line.trim());

    // Check if line (or line combined with next line) represents an amount written in words
    // (e.g. "Rupees Three Hundred Fifty Only" or "Rupees Six Hundred Twenty and One Paisa Only")
    let wordAmountVal = parseWordsToAmount(line);
    let isCombinedWords = false;
    if (i + 1 < lines.length) {
      if (wordAmountVal === null || /\b(?:paise?|paisa|cents?|only)\b/i.test(lines[i + 1])) {
        const combinedVal = parseWordsToAmount(line + ' ' + lines[i + 1]);
        if (combinedVal !== null) {
          wordAmountVal = combinedVal;
          isCombinedWords = true;
        }
      }
    }

    if (wordAmountVal !== null && wordAmountVal > 0) {
      let wordScore = 320; // High base score for explicit legal amount in words
      if (matchedTier === 1 || prevLineTier1 || nextLineTier1) wordScore += 260;
      if (nearPaymentStatus) wordScore += 160;
      if (isMobilePaymentContext && i <= 8) wordScore += 200;

      candidates.push({
        amount: wordAmountVal,
        rawString: isCombinedWords ? `${line} ${lines[i + 1]}` : line,
        lineIndex: i,
        hasCurrencySymbol: true,
        hasDecimal: wordAmountVal % 1 !== 0,
        score: wordScore,
        matchedLabel: matchedLabel || 'WORDS_AMOUNT'
      });
    }

    // Isolate numeric token directly attached to Tier 1 final-payment label on this line
    let directlyAttachedAmount: number | null = null;
    if (matchedTier === 1) {
      const labelFollowedByAmt = line.match(
        /(?:total\s*amount\s*paid|amount\s*paid|paid\s*amount|total\s*paid|you\s*paid|paid|final\s*amount|amount\s*payable|amount\s*due|balance\s*due|net\s*amount|net\s*payable|paid\s*successfully|payment\s*successful)\s*[:\-–—\s]*([₹$€£¥]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i
      );
      if (labelFollowedByAmt && labelFollowedByAmt[2]) {
        directlyAttachedAmount = parseReceiptMonetaryValue(labelFollowedByAmt[2]);
      }
      if (directlyAttachedAmount === null) {
        const amtFollowedByLabel = line.match(
          /([₹$€£¥]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*[:\-–—\s]*(?:total\s*amount\s*paid|amount\s*paid|paid\s*amount|total\s*paid|you\s*paid|paid|final\s*amount|net\s*amount)/i
        );
        if (amtFollowedByLabel && amtFollowedByLabel[2]) {
          directlyAttachedAmount = parseReceiptMonetaryValue(amtFollowedByLabel[2]);
        }
      }
    }

    // Extract monetary candidate amounts from this line
    const lineCandidates = extractReceiptLineAmounts(line);

    for (const cand of lineCandidates) {
      const val = cand.value;
      const raw = cand.raw;

      // Reject Android navbar or bottom footer single-digit artifacts (e.g. "1 oO <", "[1 @] <", "sal” = 1")
      if (val === 1 && (i >= totalDocLines - 2 || /[<>]|[oO@]/.test(line))) {
        continue;
      }

      // Currency symbol presence
      const hasCurrency = /(?:[₹$€£¥]|rs\.?|inr)/i.test(raw) || /(?:[₹$€£¥]|rs\.?|inr)/i.test(line);
      const hasDecimal = /\.\d{1,2}$/.test(raw) || /\.\d{1,2}\b/.test(line);
      const hasComma = /,/.test(raw);

      // Explicit reject: 4-digit years (1990 - 2040) without currency symbol and without decimal and without Tier 1 label
      if (val >= 1990 && val <= 2040 && !hasDecimal && !hasCurrency && matchedTier !== 1 && !prevLineTier1 && !nextLineTier1) {
        continue;
      }

      // Explicit reject: 6+ digit unformatted integers without decimal point, without currency symbol, and without comma
      if (val >= 100000 && !hasDecimal && !hasCurrency && !hasComma && matchedTier !== 1) {
        continue;
      }

      // Compute base score
      let score = 0;

      // Tier Scoring Hierarchy
      if (matchedTier === 1 || prevLineTier1 || nextLineTier1) {
        score += 320; // Highest precedence for explicit final-payment labels
      } else if (matchedTier === 2) {
        score += 160; // Secondary precedence for Grand Total
      } else if (matchedTier === 3) {
        score += 60; // Fallback precedence for subtotal/item bill
      }

      // When document contains an explicit Tier 1 final-payment label, penalize non-Tier-1 candidates
      if (docHasTier1Label && matchedTier !== 1 && !prevLineTier1 && !nextLineTier1) {
        score -= 220;
      }

      // Token isolation: boost numeric token directly associated with label, penalize others on same line
      if (directlyAttachedAmount !== null) {
        if (Math.abs(val - directlyAttachedAmount) < 0.001) {
          score += 140;
        } else {
          score -= 120;
        }
      }

      if (nextLineTier1) {
        score += 120;
        if (nextLineIsYouPaid) {
          score += 100;
        }
        // If line has multiple candidates, prefer the one with currency or the last candidate
        if (hasCurrency) {
          score += 80;
        }
        if (lineCandidates.indexOf(cand) === lineCandidates.length - 1) {
          score += 60;
        }
      }

      if (hasCurrency) score += 60;
      if (hasDecimal) score += 35;

      // Prominent amount in mobile payment / UPI / Money Received screen
      if (isMobilePaymentContext && i <= 8) {
        if (isStandaloneAmountLine) {
          score += 240; // Massive confidence for prominent standalone transaction amount
        }
        if (nearPaymentStatus) {
          score += 120;
        }
        if (prevLineTier1) {
          score += 260; // Strong confidence for digits immediately below explicit "Amount" heading
        }
        if (wordAmountVal !== null && Math.abs(val - wordAmountVal) < 1.01) {
          score += 350; // Exact agreement between displayed digits and words (prioritizing exact decimal)
        }
        // If next line is "Paid to" or "To" or "Received from" or "From", this line is the primary amount!
        if (
          i + 1 < lines.length &&
          /^(?:paid\s*to|pay\s*to|\bto\b|transferred\s*to|received\s*from|from|sender)\b/i.test(lines[i + 1])
        ) {
          score += 150;
        }
      } else {
        // Traditional receipt/invoice: lower half of receipt gets position bonus
        const posRatio = i / totalDocLines;
        score += Math.round(posRatio * 35);
      }

      // Verification against computed total (when there are multiple items / subtotal+tax)
      if (targetComputedTotal > 0 && (detectedSubtotal > 0 || (calculatedTotal > 0 && lineItemsSum > 0))) {
        if (Math.abs(val - targetComputedTotal) < 0.01) {
          score += 200;
        } else {
          // Check for OCR leading glyph artifact (e.g. ₹ 780 parsed as 2780 or 1780, ₹ 246 parsed as 3246)
          const valIntStr = Math.round(val * 100).toString();
          const baseIntStr = Math.round(targetComputedTotal * 100).toString();
          if (valIntStr.endsWith(baseIntStr) && valIntStr.length === baseIntStr.length + 1) {
            candidates.push({
              amount: targetComputedTotal,
              rawString: raw,
              lineIndex: i,
              hasCurrencySymbol: hasCurrency,
              hasDecimal,
              score: score + 220,
              matchedLabel
            });
            continue;
          }
        }
      }

      // Strong contextual check for OCR glyph prefix 3,XXX / 2,XXX when subtotal or arithmetic evidence supports it
      const rawHasDirectCurrency = /^[₹$€£¥]/i.test(raw.trim());
      const rawHasComma = /,/.test(raw);
      if (
        matchedTier === 1 &&
        val >= 2000 &&
        val < 4000 &&
        !rawHasDirectCurrency &&
        !rawHasComma
      ) {
        const strippedVal = val % 1000;
        const isArithmeticMatch = arithmeticConfirmedPaid !== undefined && Math.abs(strippedVal - arithmeticConfirmedPaid) < 0.05;
        const isSubtotalConsistent = detectedSubtotal > 0 && Math.abs(strippedVal - detectedSubtotal) < 250;
        const isLineItemsConsistent = lineItemsSum > 0 && Math.abs(strippedVal - lineItemsSum) < 150;

        if (isArithmeticMatch || isSubtotalConsistent || isLineItemsConsistent) {
          const chosenAmt = isArithmeticMatch
            ? arithmeticConfirmedPaid!
            : (targetComputedTotal > 0 && Math.abs(strippedVal - targetComputedTotal) < 50 ? targetComputedTotal : strippedVal);
          candidates.push({
            amount: chosenAmt,
            rawString: raw,
            lineIndex: i,
            hasCurrencySymbol: hasCurrency,
            hasDecimal,
            score: score + (isArithmeticMatch ? 350 : 250),
            matchedLabel: isArithmeticMatch ? 'ARITHMETIC_CONFIRMED_GLYPH_NORMALIZED' : 'CONTEXTUAL_GLYPH_NORMALIZED'
          });
          continue;
        }
      }

      // In complex bills with explicit "You paid" / "Amount paid", penalize pre-discount "Bill amount"
      if (/\b(?:bill\s*amount)\b/i.test(line) && /\b(?:you\s*paid|total\s*paid|amount\s*paid)\b/i.test(rawText)) {
        score -= 250;
      }

      // Penalties for sub-totals, discounts, taxes, fees, rewards
      if (isDisqualifiedNonTotal) {
        score -= 140;
      }
      if (/\b(?:cashback|reward\s*points?|earned\s*points?|savings?|discount|coupon)\b/i.test(line)) {
        score -= 180;
      }
      if (detectedSubtotal > 0 && Math.abs(val - detectedSubtotal) < 0.01 && targetComputedTotal > detectedSubtotal) {
        score -= 100;
      }
      if (detectedTax > 0 && Math.abs(val - detectedTax) < 0.01) {
        score -= 100;
      }
      if (detectedFee > 0 && Math.abs(val - detectedFee) < 0.01) {
        score -= 100;
      }

      candidates.push({
        amount: val,
        rawString: raw,
        lineIndex: i,
        hasCurrencySymbol: hasCurrency,
        hasDecimal,
        score,
        matchedLabel
      });
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score > 10) {
    return Math.round(candidates[0].amount * 100) / 100;
  }

  if (targetComputedTotal > 0 && (detectedSubtotal > 0 || lineItemsSum > 0)) {
    return Math.round(targetComputedTotal * 100) / 100;
  }

  if (candidates.length > 0) {
    return Math.round(candidates[0].amount * 100) / 100;
  }

  return 0;
}

export function detectPaymentMethod(rawText: string, lines: string[]): PaymentMethodType {
  // 1. Bank Transfer Checks (IMPS, NEFT, RTGS, Account Transfer)
  if (
    /\b(imps|neft|rtgs)\b/i.test(rawText) ||
    /\b(?:bank\s*transfer|account\s*transfer|internal\s*(?:bank\s*)?transfer|fund\s*transfer|wire\s*transfer|transferred\s*to\s*(?:bank|a\/c|account))\b/i.test(rawText)
  ) {
    return 'Bank Transfer';
  }

  // 2. UPI Checks
  if (
    /\b(upi|bhim|vpa|gpay|google\s*pay|phonepe|paytm\s*upi|groww\s*pay)\b/i.test(rawText) ||
    /\b(?:upi\s*(?:id|ref|txn|transaction|reference)|to\s*upi\s*id)\b/i.test(rawText) ||
    /\bT(?:2[4-9]|20[2-9]\d)\d{10,}\b/i.test(rawText) ||
    /\b(?:utr(?:\s*no|\s*number)?|rrn)\s*[:#\-]?\s*[A-Za-z0-9]+/i.test(rawText) ||
    /[\w.\-]+@(okhdfcbank|okaxis|okicici|oksbi|ybl|ibl|axl|paytm|upi|apl|fbl|idfcbank|barodampay|federal)/i.test(rawText)
  ) {
    return 'UPI';
  }

  // 3. Card Transactions (Debit / Credit / Card POS / Swiped)
  if (
    /\b(debit\s*card|credit\s*card|visa|mastercard|rupay|amex|american\s*express|maestro)\b/i.test(rawText) ||
    /\b(?:card\s*(?:payment|ending|no|number|txn|transaction)|swiped\s*at|pos\s*(?:sale|terminal|transaction)|chip\s*card|contactless)\b/i.test(rawText)
  ) {
    return 'Card';
  }

  // 4. Recharge
  if (
    /\b(?:recharge\s*successful|mobile\s*recharge|dth\s*recharge|prepaid\s*recharge|recharge\s*of|prepaid\s*mobile|data\s*pack|talktime)\b/i.test(rawText)
  ) {
    return 'Recharge';
  }

  // 5. Bill Payment
  if (
    /\b(?:bill\s*payment|electricity\s*bill|water\s*bill|gas\s*bill|broadband\s*bill|dth\s*bill|piped\s*gas|postpaid\s*bill|utility\s*bill|bill\s*paid)\b/i.test(rawText)
  ) {
    return 'Bill Payment';
  }

  // 6. Digital Wallets
  if (
    /\b(paytm\s*wallet|phonepe\s*wallet|amazon\s*pay\s*balance|mobikwik|freecharge|wallet\s*balance|paid\s*via\s*wallet)\b/i.test(rawText)
  ) {
    return 'Wallet';
  }

  // 7. Payment Gateways
  if (
    /\b(razorpay|payu|ccavenue|cashfree|billdesk|instamojo|stripe|payment\s*gateway|payvia\b)/i.test(rawText)
  ) {
    return 'Payment Gateway';
  }

  // Generic UPI handle check fallback
  if (/[a-zA-Z0-9._-]+@[a-zA-Z]{3,}/i.test(rawText)) {
    return 'UPI';
  }

  return 'Other';
}

export function extractTransactionTime(rawText: string, lines: string[]): string | undefined {
  // 1. Explicitly labeled time line: e.g. "Transaction time 11 AM, 22 Jan '26" or "Time: 04:15:30 PM"
  const EXPLICIT_TIME_LABEL_REGEX =
    /\b(?:transaction\s*time|txn\s*time|payment\s*time|time|paid\s*at|completed\s*at)\b[:\s\-–—]*([^\n\r]+)/i;

  const TIME_CAPTURE_REGEX =
    /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i;

  for (const line of lines) {
    const m = line.match(EXPLICIT_TIME_LABEL_REGEX);
    if (m && m[1]) {
      const timeMatch = m[1].match(TIME_CAPTURE_REGEX);
      if (timeMatch) return timeMatch[1].trim();
    }
  }

  // 2. Generic timestamp lines with AM/PM (skipping phone status bar at line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(?:txn|utr|ref|rrn|upi\s*transaction\s*id)\b/i.test(line)) continue;
    const timeMatch = line.match(TIME_CAPTURE_REGEX);
    if (timeMatch && (/(?:am|pm)/i.test(timeMatch[1]) || /,\s*\d{1,2}\s+[A-Za-z]{3}/i.test(line))) {
      return timeMatch[1].trim();
    }
  }

  return undefined;
}

export function extractPaymentMetadata(rawText: string, lines: string[]): PaymentTransactionMetadata {
  const meta: PaymentTransactionMetadata = {};

  // 1. UPI ID / VPA
  const vpaMatch = rawText.match(/\b([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+)\b/);
  if (vpaMatch && !/^(?:noreply|support|help|info|contact)@/i.test(vpaMatch[1])) {
    meta.upiId = vpaMatch[1];
  }

  // 2. UPI Transaction ID / Reference Number
  const upiIdMatch = rawText.match(/\b(?:upi\s*transaction\s*id|upi\s*txn\s*id|transaction\s*id|txn\s*id)\b[:\s\-#]*([A-Za-z0-9]{8,24})/i);
  if (upiIdMatch) {
    meta.transactionId = upiIdMatch[1].trim();
  } else {
    const refMatch = rawText.match(/\b(?:upi\s*ref(?:\s*no|\s*number)?|ref(?:\s*no|\s*number)?)\b[:\s\-#]*(\d{12})\b/i);
    if (refMatch) {
      meta.transactionId = refMatch[1];
    }
  }

  // 3. UTR / RRN
  const utrMatch = rawText.match(/\b(?:utr(?:\s*no|\s*number)?|rrn)\b[:\s\-#]*([A-Za-z0-9]{10,22})/i);
  if (utrMatch) {
    meta.utr = utrMatch[1].trim();
  }

  // 4. Bank Name
  const bankMatch = rawText.match(/\b(state\s*bank\s*of\s*india|sbi|hdfc\s*(?:bank)?|icici\s*(?:bank)?|punjab\s*national\s*bank|pnb|axis\s*bank|kotak\s*(?:mahindra)?|bank\s*of\s*baroda|bob|canara\s*bank|union\s*bank|equitas\s*(?:small\s*finance\s*bank)?|yes\s*bank|indusind\s*bank|idfc\s*first\s*bank)\b/i);
  if (bankMatch) {
    meta.bankName = bankMatch[1].toUpperCase();
  }

  // 5. Masked Account
  const acctMatch = rawText.match(/(?:[xX*]{3,8}\s*\d{3,4}|\b\*{4}\d{4}\b|\b\*{2,4}\s*\d{4}\b)/);
  if (acctMatch) {
    meta.maskedAccount = acctMatch[0].trim();
  }

  // 6. Masked Card
  const cardMatch = rawText.match(/\b(?:ending\s*in\s*|card\s*no\.?\s*)[xX*]{4,12}\s*(\d{4})\b/i);
  if (cardMatch) {
    meta.maskedCard = `****${cardMatch[1]}`;
  }

  // 7. Payment App Name
  const appMatch = rawText.match(/\b(phonepe|google\s*pay|gpay|paytm|groww|bhim|cred|amazon\s*pay|supermoney|mobikwik|navi)\b/i);
  if (appMatch) {
    meta.paymentApp = appMatch[1].replace(/\s+/g, ' ').trim();
  }

  return meta;
}

export function calculateFieldConfidenceScores(
  merchant: string,
  amount: number,
  date: string,
  type: 'expense' | 'income',
  category: ExpenseCategory,
  rawText: string,
  lines: string[]
): FieldConfidenceScores {
  // Merchant Confidence
  let merchantScore = 75;
  if (/(?:paid\s*to|sent\s*to|transfer\s*to|received\s*from|to\s+|from\s+)/i.test(rawText)) {
    merchantScore = 95;
  } else if (BUSINESS_MARKER_REGEX.test(merchant) || STORE_INDUSTRY_REGEX.test(merchant)) {
    merchantScore = 90;
  }
  if (!merchant || merchant.length < 3 || /receipt|payment/i.test(merchant)) {
    merchantScore = 50;
  }

  // Amount Confidence
  let amountScore = 75;
  if (amount > 0) {
    if (EXPLICIT_TOTAL_TIER1_PATTERNS.some((p) => p.test(rawText))) {
      amountScore = 99;
    } else if (/[₹$€£¥]/.test(rawText)) {
      amountScore = 92;
    } else {
      amountScore = 80;
    }
  } else {
    amountScore = 20;
  }

  // Date Confidence
  let dateScore = 60;
  const isToday = date === new Date().toISOString().split('T')[0];
  const hasExplicitDate = /(?:\b(?:202[4-9]|203[0-5])[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]['’]?\d{2,4}\b)/i.test(rawText);
  const hasPhonePeTimestamp = /\bT(2[4-9]|20[2-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{6,}\b/i.test(rawText);
  if (hasExplicitDate || hasPhonePeTimestamp) {
    dateScore = 97;
  } else if (!isToday) {
    dateScore = 88;
  } else {
    dateScore = 60;
  }

  // Type Confidence
  let typeScore = 70;
  if (/(?:money\s*received|received\s*from|credited|paid\s*to|sent\s*to|transfer\s*to|debited\s*from|paid\s*successfully)/i.test(rawText)) {
    typeScore = 98;
  } else {
    typeScore = 80;
  }

  // Category Confidence
  let categoryScore = 70;
  if (category !== 'Miscellany') {
    categoryScore = 90;
  } else {
    categoryScore = 60;
  }

  const overall = Math.round(
    merchantScore * 0.25 +
    amountScore * 0.30 +
    dateScore * 0.20 +
    typeScore * 0.15 +
    categoryScore * 0.10
  );

  return {
    merchant: merchantScore,
    amount: amountScore,
    date: dateScore,
    type: typeScore,
    category: categoryScore,
    overall
  };
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
          await (page.render({ canvas, canvasContext: ctx, viewport } as any)).promise;
          try {
            imageUrl = canvas.toDataURL('image/jpeg', 0.85);
          } catch {
            imageUrl = '';
          }
          const { data } = await Tesseract.recognize(canvas as any, 'eng', {
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

    const hasNodeBuffer = typeof (globalThis as any).Buffer !== 'undefined';
    const imageInput: any = hasNodeBuffer && (file as any).buffer ? (file as any).buffer : file;
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

  // 1. Detect if Transaction is Income or Expense using multi-factor evidence scoring
  const type = detectTransactionType(rawText, lines);
  const isIncome = type === 'income';

  // 2. Detect Merchant / Counterparty / Payee / Sender Name with generalized confidence scoring
  const merchantName = extractMerchantName(lines, rawText, isIncome);

  // 3. Detect Date using explicit labels & date normalizer
  const dateStr = extractReceiptDate(rawText, lines);

  // 4. Line Items Extraction (filtering out metadata, counters, cashier, bank lines)
  const lineItems: { name: string; amount: number }[] = [];
  const lineItemPattern = /^([a-zA-Z0-9\s&'.-]{2,35})\s+(?:[₹$€£¥]|rs\.?|inr|[%Xx*?~#§])?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2}))$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isExcluded =
      NON_TOTAL_LINE_PATTERNS.some((p) => p.test(line)) ||
      EXPLICIT_TOTAL_TIER1_PATTERNS.some((p) => p.test(line)) ||
      EXPLICIT_TOTAL_TIER2_PATTERNS.some((p) => p.test(line)) ||
      /^(?:date|time|payment|merchant|thank|welcome|subtotal|cashier|counter|table|token|terminal|screen|seat|ticket|version|page|rating|phone|mobile|help|status|paid|received|debited|credited|bank|a\/c|card)/i.test(
        line
      );

    if (isExcluded) continue;

    const m = line.match(lineItemPattern);
    if (m) {
      const name = m[1].replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      const numPart = m[2].replace(/,/g, '');
      const amt = parseFloat(numPart);
      if (
        name.length >= 2 &&
        !isNaN(amt) &&
        amt > 0 &&
        !/^(?:cashier|counter|table|token|terminal|screen|seat|tickets?|page|version|status|ref|order|inv|help)$/i.test(
          name
        )
      ) {
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

  // 5. Detect Total Amount using generalized candidate scoring
  const amount = extractReceiptAmount(rawText, lines, calculatedTotal, lineItemsSum);

  // 6. Generalized Semantic Categorization
  const category = inferReceiptCategory(merchantName, rawText, isIncome);

  // 7. Generalized Payment Method & Metadata Detection
  const paymentMethod = detectPaymentMethod(rawText, lines);
  const time = extractTransactionTime(rawText, lines);
  const metadata = extractPaymentMetadata(rawText, lines);

  // 8. Field-Level & Overall Confidence Scoring
  const fieldConfidence = calculateFieldConfidenceScores(
    merchantName,
    amount,
    dateStr,
    type,
    category,
    rawText,
    lines
  );
  const finalConfidence = Math.max(confidence, fieldConfidence.overall);

  return {
    merchantName,
    amount: Math.round(amount * 100) / 100,
    date: dateStr,
    category,
    rawText,
    imageUrl,
    confidence: finalConfidence,
    lineItems,
    type,
    time,
    paymentMethod,
    metadata,
    fieldConfidence
  };
}
