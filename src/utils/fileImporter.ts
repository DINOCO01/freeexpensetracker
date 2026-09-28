import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { formatCurrency, type ExpenseCategory, type StandardExpenseCategory, type Transaction } from './calculations';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
  }
}

export type SupportedSourceType = 'pdf' | 'excel' | 'csv' | 'image' | 'sheets';

export type ColumnRole =
  | 'date'
  | 'description'
  | 'category'
  | 'txType'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'ref'
  | 'currency'
  | 'unknown';

export interface StatementReconciliation {
  detected: boolean;
  openingBalance?: number;
  closingBalance?: number;
  calculatedClosingBalance?: number;
  difference?: number;
  reconciled: boolean;
  transactionsDetected: number;
  debitsCount: number;
  creditsCount: number;
  totalDebits: number;
  totalCredits: number;
  warning?: string;
}

export interface FileProcessingStatus {
  name: string;
  type: string;
  sourceType: SupportedSourceType;
  recordCount: number;
  outflowAmount: number;
  inflowAmount: number;
  status: 'success' | 'warning' | 'error';
  warnings?: string[];
  error?: string;
}

export interface FileInterpretationResult {
  recordCount: number;
  totalAmount: number; // Total outflow (expenses)
  totalInflow: number; // Total inflow (deposits/income)
  categoryBreakdown: Record<ExpenseCategory, number>;
  topCategory: { category: ExpenseCategory; amount: number; percentage: number } | null;
  highestExpense: { name: string; amount: number; date: string } | null;
  earliestDate: string;
  latestDate: string;
  insights: string[];
  transactions: Transaction[];
  warnings?: string[];
  needsReviewCount?: number;
  reconciliation?: StatementReconciliation;
}

export interface MultiFileInterpretationResult extends FileInterpretationResult {
  fileCount: number;
  successfulFiles: number;
  warningFiles: number;
  failedFiles: number;
  fileSummaries: FileProcessingStatus[];
}

export interface DetectedColumnZone {
  role: ColumnRole;
  name: string;
  xStart: number;
  xEnd: number;
  centerX: number;
}

// --- 1. Semantic Field Mapping & Classification ---

export function matchHeaderRole(headerText: string): ColumnRole {
  const norm = headerText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm) return 'unknown';

  // Date
  if (
    /(date|txndate|transactiondate|trandate|postingdate|valuedate|dateoftransaction|bookingdate|entrydate|valdate|stmtdate|valuedt|transdate)/i.test(
      norm
    ) ||
    /^(dt|date)$/i.test(norm)
  ) {
    return 'date';
  }

  // Balance (must check before generic Amount, Credit, or Debit)
  if (
    /(closingbalance|runningbalance|accountbalance|availablebalance|ledgerbalance|balance)/i.test(norm) ||
    /^(bal|balamt|balanceamount|netbalance)$/i.test(norm)
  ) {
    return 'balance';
  }

  // Debit / Withdrawal / Outflow
  if (
    /(withdrawal|withdrawals|debit|debits|paidout|spent|withdrawn|amountdebited|debitamount|withdrawalamount)/i.test(
      norm
    ) ||
    /^(dr|dramt|drval)$/i.test(norm)
  ) {
    return 'debit';
  }

  // Credit / Deposit / Inflow
  if (
    /(deposit|deposits|credit|credits|paidin|amountcredited|creditamount|depositamount)/i.test(norm) ||
    /^(cr|cramt|crval)$/i.test(norm)
  ) {
    return 'credit';
  }

  // Reference / Cheque / UTR
  if (
    /(chqno|chequeno|refno|referenceno|utr|txnid|transactionid|transid|refnum|referencenumber|chequenum|chqrefno)/i.test(
      norm
    ) ||
    /^(ref|chq|cheque)$/i.test(norm)
  ) {
    return 'ref';
  }

  // Description / Merchant / Narration
  if (
    /(particulars|narration|narrations|description|descriptions|details|detail|transactiondetails|remarks|remark|transactionnarration|particular|reference|desc|merchant|payee|beneficiary|note|notes|narrative|memo)/i.test(
      norm
    )
  ) {
    return 'description';
  }

  // Category
  if (/(category|expensecategory|spendingcategory|classification|subcat|subcategory)/i.test(norm)) {
    return 'category';
  }

  // Type
  if (/(transactiontype|txntype|crdr|drcr|paymentmode|typeoftransaction|trxtype|transmode)/i.test(norm) || /^(type|mode)$/i.test(norm)) {
    return 'txType';
  }

  // Currency
  if (/^(currency|curr|ccy)$/i.test(norm)) {
    return 'currency';
  }

  // Amount
  if (
    /(transactionamount|txnamount|netamount|totalamount|grossamount|transactionamt|amount)/i.test(
      norm
    ) ||
    /^(amt|sum|value|total)$/i.test(norm)
  ) {
    return 'amount';
  }

  return 'unknown';
}

const CATEGORY_KEYWORDS: Partial<Record<ExpenseCategory, RegExp>> = {
  Housing: /(rent|mortgage|lease|hoa|property\s*tax|realty|landlord|apartment|maintenance|housing|society\s*dues)/i,
  Food: /(grocery|groceries|supermarket|walmart|kroger|trader\s*joe|whole\s*foods|safeway|costco|aldi|restaurant|cafe|coffee|starbucks|uber\s*eats|doordash|grubhub|mcdonald|chipotle|burger|pizza|diner|food|dining|swiggy|zomato|blinkit|zepto|instamart|bakery)/i,
  Transport: /(uber|lyft|taxi|transit|subway|metro|bus|train|amtrak|gas|fuel|chevron|shell|exxon|mobil|bp|parking|toll|tollway|auto|car\s*wash|mechanic|oil\s*change|petrol|diesel|irctc|fastag|flight|airline|ola)/i,
  Utilities: /(electric|electricity|power|gas\s*bill|water|sewer|trash|internet|wifi|cable|comcast|verizon|at&t|t-mobile|phone\s*bill|utility|utilities|recharge|broadband|dth|cylinder)/i,
  Entertainment: /(netflix|spotify|hulu|disney|apple|prime|cinema|theatre|theater|concert|ticket|game|steam|playstation|xbox|nintendo|pub|bar|nightclub|hobby|gym|fitness|movie|youtube|bookmyshow)/i,
  Savings: /(savings|deposit|transfer|investment|vanguard|fidelity|schwab|robinhood|crypto|401k|ira|emergency\s*fund|salary|payroll|paycheck|direct\s*deposit|dividend|interest\s*credit|fixed\s*deposit|sip|mutual\s*fund|zerodha|groww)/i,
  Miscellany: /(amazon|target|shopping|clothing|zara|h&m|pharmacy|cvs|walgreens|doctor|dental|vet|pet|subscription|fee|miscellaneous|misc|general|cash|other)/i
};

export function autoCategorizeExpense(description: string): ExpenseCategory {
  if (!description) return 'Miscellany';
  const desc = description.toLowerCase();

  for (const [cat, regex] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, RegExp][]) {
    if (regex && regex.test(desc)) {
      return cat;
    }
  }

  return 'Miscellany';
}

export function normalizeCategory(
  sourceCategory: string | undefined,
  description: string,
  txType?: 'expense' | 'income'
): ExpenseCategory {
  const trimmed = sourceCategory?.trim();
  const isValidSourceCat =
    !!trimmed &&
    !/^[-–—\s.,?_]+$/.test(trimmed) &&
    !/^(n\/?a|none|null|undefined|unknown|\?)$/i.test(trimmed);

  if (isValidSourceCat) {
    const raw = trimmed.toLowerCase();
    if (/^(food|groceries|grocery|dining|restaurant|supermarket)$/i.test(raw)) return 'Food';
    if (/^(housing|rent|mortgage|apartment|lease|hoa)$/i.test(raw)) return 'Housing';
    if (/^(transport|transit|travel|fuel|gas|petrol|cab|taxi)$/i.test(raw)) return 'Transport';
    if (/^(utilities|utility|electric|electricity|power|water|phone|internet|mobile|bills?)$/i.test(raw)) return 'Utilities';
    if (/^(entertainment|fun|movies?|games?|streaming|subscriptions?)$/i.test(raw)) return 'Entertainment';
    if (/^(savings?|investments?|invest)$/i.test(raw)) return 'Savings';
    if (/^(miscellany|misc|general|other)$/i.test(raw)) return 'Miscellany';
    if (txType === 'income' && /^(income|salary|payroll|deposit|dividend|interest|freelance|other\s*income)$/i.test(raw)) {
      return 'Income';
    }
    // Respect explicitly provided category (e.g. "Health & Fitness", custom categories)
    return trimmed as ExpenseCategory;
  }

  if (txType === 'income') {
    return 'Income';
  }

  return autoCategorizeExpense(description);
}

// --- 2. Date Normalization & Parsing ---

export type DateConvention = 'DD/MM' | 'MM/DD';

export function detectDateConvention(rawDateStrings: string[]): DateConvention {
  let dmEvidence = 0;
  let mdEvidence = 0;

  for (const s of rawDateStrings) {
    const match = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      if (p1 > 12 && p2 <= 12) dmEvidence++;
      if (p2 > 12 && p1 <= 12) mdEvidence++;
    }
  }

  return mdEvidence > dmEvidence ? 'MM/DD' : 'DD/MM';
}

export const STATEMENT_DATE_REGEX =
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/i;

export function normalizeDate(dateStr: string, convention: DateConvention = 'DD/MM'): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();

  // 1. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Check DD-Mon-YYYY (e.g. 30 Sep 2026, 15-Sep-2026, 01/Sep/2026, 01 September 2026)
  const dMonYMatch = trimmed.match(/^(\d{1,2})[-/.\s]([a-zA-Z]{3,9})[-/.\s](\d{2,4})/i);
  if (dMonYMatch) {
    let d = parseInt(dMonYMatch[1], 10);
    const mon = dMonYMatch[2].toLowerCase().slice(0, 3);
    let y = parseInt(dMonYMatch[3], 10);
    if (y < 100) y += 2000;
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    if (months[mon] && d >= 1 && d <= 31) {
      return `${y}-${months[mon]}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. Check Mon DD, YYYY (e.g. Sep 30, 2026, September 15 2026)
  const monDYMatch = trimmed.match(/^([a-zA-Z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{2,4}))?/i);
  if (monDYMatch) {
    const mon = monDYMatch[1].toLowerCase().slice(0, 3);
    let d = parseInt(monDYMatch[2], 10);
    let y = monDYMatch[3] ? parseInt(monDYMatch[3], 10) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    if (months[mon] && d >= 1 && d <= 31) {
      return `${y}-${months[mon]}-${String(d).padStart(2, '0')}`;
    }
  }

  // 4. Check DD/MM/YYYY, DD-MM-YYYY, or MM/DD/YYYY depending on statement convention
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    let part1 = parseInt(dmyMatch[1], 10);
    let part2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;

    let d: number;
    let m: number;

    if (part1 > 12 && part2 <= 12) {
      d = part1;
      m = part2;
    } else if (part2 > 12 && part1 <= 12) {
      m = part1;
      d = part2;
    } else {
      // Ambiguous case (both <= 12): rely on contextual convention
      if (convention === 'MM/DD') {
        m = part1;
        d = part2;
      } else {
        d = part1;
        m = part2;
      }
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return trimmed.slice(0, 10);
}

export function parseFlexibleDate(val: any, convention: DateConvention = 'DD/MM'): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Handle Excel serial date numbers (e.g. 45565)
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  const match = str.match(STATEMENT_DATE_REGEX);
  if (match) {
    return normalizeDate(match[0], convention);
  }
  return null;
}

// --- 3. Monetary Number Parsing ---

export const AMOUNT_REGEX_GLOBAL =
  /(?:(?:₹|Rs\.?|INR|\$|€|£|CA\$|AU\$)\s*)?(?:-|\()?(\d+(?:,\d+)*(?:\.\d+)?)(?:\))?\s*(?:cr|dr)?\b/gi;

export function parseMonetaryAmount(
  raw: any
): { amount: number; isNegative: boolean; isCredit?: boolean; isDebit?: boolean } | null {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return { amount: Math.abs(raw), isNegative: raw < 0, isCredit: raw > 0, isDebit: raw < 0 };
  }

  let str = String(raw).trim();
  if (!str) return null;

  const isDr = /\b(dr|debit|paid\s*out|outflow)\b/i.test(str) || /^\(/.test(str) || str.includes('-');
  const isCr = /\b(cr|credit|deposit|paid\s*in|inflow)\b/i.test(str) || str.includes('+');

  // Handle European decimal notation: "1.250,50" -> "1250.50" or "1250,50" -> "1250.50"
  const digitsPunct = str.replace(/[^\d.,]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})$/.test(digitsPunct) || /^\d+,\d{1,2}$/.test(digitsPunct)) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  // Extract the primary numeric sequence (preserves full unformatted numbers, decimals, and comma-separated amounts)
  const numMatch = str.match(/\d+(?:,\d+)*(?:\.\d+)?/);
  if (!numMatch) return null;

  const cleanNumStr = numMatch[0].replace(/,/g, '');

  // Guardrail: Ignore pure large integers (9+ digits without decimal), which are account numbers, UTRs, or phone numbers
  if (!numMatch[0].includes('.') && /^\d{9,}$/.test(cleanNumStr)) {
    return null;
  }

  const val = parseFloat(cleanNumStr);
  if (isNaN(val) || val <= 0) return null;

  return {
    amount: Math.round(val * 100) / 100,
    isNegative: isDr && !isCr,
    isCredit: isCr,
    isDebit: isDr
  };
}

export function extractAmountsFromText(
  text: string,
  dateStr?: string
): { raw: string; value: number; index: number }[] {
  let cleanText = text;
  if (dateStr) {
    cleanText = cleanText.replace(dateStr, ' ');
  }

  const results: { raw: string; value: number; index: number }[] = [];
  const regex = new RegExp(AMOUNT_REGEX_GLOBAL.source, 'gi');
  let match;
  while ((match = regex.exec(cleanText)) !== null) {
    const raw = match[0].trim();
    const parsed = parseMonetaryAmount(raw);
    if (!parsed || parsed.amount <= 0) continue;
    if (parsed.amount > 10000000 && !/\.\d{2}/.test(raw)) continue;

    results.push({
      raw,
      value: parsed.isNegative ? -parsed.amount : parsed.amount,
      index: match.index
    });
  }
  return results;
}

export function classifyTransactionType(text: string): 'expense' | 'income' {
  const norm = text.toLowerCase();

  // Strong income signals
  if (
    /\b(salary|payroll|paycheck|freelance|client\s*payment|payment\s*received|received\s*from|dividend|interest\s*(credit|income|payout)?|cashback|stipend|bonus|refund|reimbursement|direct\s*deposit)\b/i.test(
      norm
    )
  ) {
    return 'income';
  }

  if (/\b(cr\b|credit\b)/i.test(norm) && !/\b(credit\s*card)\b/i.test(norm)) {
    return 'income';
  }

  // Strong expense signals
  if (
    /\b(debit|withdrawal|dr\b|pos|atm|purchase|fee|charge|bill|outflow|spent|expense|rent|grocery|groceries|restaurant|uber|fuel|petrol|shopping)\b/i.test(
      norm
    )
  ) {
    return 'expense';
  }

  if (/\b(income|inflow|deposit)\b/i.test(norm)) {
    return 'income';
  }

  return 'expense';
}

export function determineTransactionType(params: {
  explicitType?: string;
  sourceCategory?: string;
  hasCreditCol?: boolean;
  creditVal?: number;
  hasDebitCol?: boolean;
  debitVal?: number;
  amountIsNegative?: boolean;
  description?: string;
}): 'income' | 'expense' {
  // 1. Explicit transaction type / category indicating Income/Credit
  const typeStr = (params.explicitType || '').trim().toLowerCase();
  if (typeStr) {
    if (/\b(income|credit|deposit|cr\b|inflow|received)\b/i.test(typeStr)) return 'income';
    if (/\b(expense|debit|withdrawal|dr\b|outflow|spent|charge)\b/i.test(typeStr)) return 'expense';
  }

  const catStr = (params.sourceCategory || '').trim().toLowerCase();
  if (catStr) {
    if (
      /^(income|credit|deposit|cr|inflow|received|salary|freelance|dividend|interest)$/i.test(catStr) ||
      /\b(income|deposit|credit)\b/i.test(catStr)
    ) {
      return 'income';
    }
    if (/^(expense|debit|withdrawal|dr|outflow|charge)$/i.test(catStr)) {
      return 'expense';
    }
  }

  // 2. Explicit debit/credit column if present
  if (params.creditVal !== undefined && params.creditVal > 0) return 'income';
  if (params.debitVal !== undefined && params.debitVal > 0) return 'expense';

  // 3. Sign of amount if applicable
  if (params.amountIsNegative) return 'expense';

  // 4. Description-based inference only as a fallback
  if (params.description) {
    return classifyTransactionType(params.description);
  }

  return 'expense';
}

// --- 4. Description Cleaning & Non-Transaction Line Filtering ---

export function cleanTransactionDescription(raw: string): string {
  if (!raw) return '';
  let s = raw;
  s = s.replace(/[\r\n\t]+/g, ' ');
  s = s.replace(/^[-–—*#:|/\s]+/, '').replace(/[-–—*#:|/\s]+$/, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

export function isOpeningOrClosingBalanceLine(text: string): {
  isBalance: boolean;
  type?: 'opening' | 'closing';
  amount?: number;
} {
  const norm = text.toLowerCase();
  const isOpening = /\b(opening\s*bal(ance)?|b\/f|brought\s*forward|start(ing)?\s*bal(ance)?)\b/i.test(norm);
  const isClosing = /\b(closing\s*bal(ance)?|c\/f|carried\s*forward|end(ing)?\s*bal(ance)?|final\s*bal(ance)?)\b/i.test(norm);

  if (isOpening || isClosing) {
    const amounts = extractAmountsFromText(text);
    const amount = amounts.length > 0 ? Math.abs(amounts[amounts.length - 1].value) : undefined;
    return {
      isBalance: true,
      type: isOpening ? 'opening' : 'closing',
      amount
    };
  }
  return { isBalance: false };
}

export function isFooterOrSummaryLine(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return /(page\s*\d+\s*(of|\/)\s*\d+|page\s*\d+$|computer[- ]generated|confidential|all\s*rights\s*reserved|statement\s*period|opening\s*balance|closing\s*balance|total\s*inflow|total\s*outflow|total\s*income|total\s*expense|total\s*credits?|total\s*debits?|total\s*deposits?|total\s*withdrawals?|net\s*change|account\s*summary|statement\s*summary|registered\s*office|branch\s*(code|ifsc|micr|name)|toll[- ]free|customer\s*(care|service)|www\.|https?:\/\/|\.com|\.in\b|cin\s*:|gstin\s*:|pan\s*:|generated\s*on|statement\s*generated\s*on|disclaimer|terms\s*and\s*conditions|interest\s*rate\s*for|important\s*notice|nomination\s*registered|address\s*:|ifsc\s*code|micr\s*code|account\s*holder|account\s*number|joint\s*holder|grand\s*total|cleared\s*balance|end\s*of\s*statement|computer\s*output|does\s*not\s*require\s*signature|ombudsman|phishing|beware\s*of|discrepancy\/errors|constituent\s*for\s*all|atm\s*pin|otp\s*to\s*outsiders|test\s*expectation|sample\s*[\/-]\s*not\s*a\s*real)/i.test(
    t
  );
}

// --- 5. Validation & Deduplication Layers ---

export function validateTransaction(
  tx: Transaction,
  rawContext?: string
): { isValid: boolean; warning?: string } {
  // 1. Date check
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
    return { isValid: false, warning: 'Invalid or missing transaction date' };
  }
  const [y, m, d] = tx.date.split('-').map(Number);
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { isValid: false, warning: `Unrealistic date: ${tx.date}` };
  }

  // 2. Amount check
  if (typeof tx.amount !== 'number' || isNaN(tx.amount) || tx.amount <= 0) {
    return { isValid: false, warning: 'Amount must be a positive number' };
  }

  // 3. Day of month collision check:
  // If amount == day of month AND raw row text has another valid number, flag as suspicious
  if (tx.amount === d && rawContext) {
    const withoutDate = rawContext.replace(STATEMENT_DATE_REGEX, ' ');
    const otherAmounts = extractAmountsFromText(withoutDate);
    if (otherAmounts.some((a) => Math.abs(a.value) !== d)) {
      return { isValid: false, warning: 'Suspicious amount matching date day number' };
    }
  }

  // 4. Description check
  if (!tx.name || tx.name.trim().length === 0) {
    return { isValid: false, warning: 'Missing transaction description' };
  }
  if (isFooterOrSummaryLine(tx.name)) {
    return { isValid: false, warning: 'Description matches footer/summary text' };
  }

  return { isValid: true };
}

export function deduplicateTransactions(txs: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const deduped: Transaction[] = [];

  for (const t of txs) {
    const key = `${t.date}|${Math.round(t.amount * 100)}|${t.name.trim().toLowerCase()}|${t.type || 'expense'}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(t);
    }
  }

  return deduped;
}

// --- 6. Coordinate-Aware PDF Table Parser & Text Stream Engine ---

interface PdfCell {
  text: string;
  x: number;
  y: number;
  width: number;
}

export function parseTextStatementLines(
  rawText: string,
  fileName: string = 'statement.pdf',
  currencyCode: string = 'INR',
  sourceType: 'pdf' | 'image' = 'pdf'
): FileInterpretationResult | null {
  if (!rawText || rawText.trim().length === 0) return null;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  // Gather date candidates to detect date convention
  const allDateCandidates: string[] = [];
  for (const line of lines) {
    const m = line.match(STATEMENT_DATE_REGEX);
    if (m) allDateCandidates.push(m[0]);
  }
  if (allDateCandidates.length < 2) {
    return null; // Not enough dates to be a multi-row statement
  }

  const dateConvention = detectDateConvention(allDateCandidates);

  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (const line of lines) {
    const balCheck = isOpeningOrClosingBalanceLine(line);
    if (balCheck.isBalance && balCheck.amount !== undefined) {
      if (balCheck.type === 'opening' && openingBalance === undefined) {
        openingBalance = balCheck.amount;
      } else if (balCheck.type === 'closing' && closingBalance === undefined) {
        closingBalance = balCheck.amount;
      }
    }
  }

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];
  let runningBalTracker: number | undefined = openingBalance;
  let ambiguousRowCount = 0;
  const warnings: string[] = [];

  interface PendingTextRow {
    date: string;
    descParts: string[];
    amountCandidates: { raw: string; value: number; index: number }[];
    lineText: string;
  }

  let pending: PendingTextRow | null = null;

  const finalizeTextRow = (item: PendingTextRow) => {
    let validAmounts = item.amountCandidates.filter((a) => Math.abs(a.value) > 0);
    if (validAmounts.length === 0) return;

    const dayOfMonth = parseInt(item.date.slice(8, 10), 10);
    if (validAmounts.length > 1) {
      const nonDay = validAmounts.filter((a) => Math.abs(a.value) !== dayOfMonth);
      if (nonDay.length > 0) validAmounts = nonDay;
    }

    let txAmount = 0;
    let balanceVal: number | undefined;
    let isIncome = false;
    let isDebitExplicit = false;
    let isCreditExplicit = false;

    const fullRawLine = item.descParts.join(' ');
    if (/\b(cr\b|credit|deposit|paid\s*in|inflow|refund)\b/i.test(fullRawLine)) {
      isCreditExplicit = true;
    }
    if (/\b(dr\b|debit|withdrawal|paid\s*out|outflow|purchase|pos|atm)\b/i.test(fullRawLine)) {
      isDebitExplicit = true;
    }

    if (validAmounts.length >= 2) {
      balanceVal = Math.abs(validAmounts[validAmounts.length - 1].value);
      txAmount = Math.abs(validAmounts[validAmounts.length - 2].value);
    } else {
      txAmount = Math.abs(validAmounts[0].value);
    }

    // Infer from running balance movement if available
    if (balanceVal !== undefined && runningBalTracker !== undefined) {
      const balDiff = balanceVal - runningBalTracker;
      if (Math.abs(balDiff) > 0.05) {
        isIncome = balDiff > 0;
      }
    } else if (isCreditExplicit) {
      isIncome = true;
    } else if (isDebitExplicit) {
      isIncome = false;
    } else {
      isIncome = classifyTransactionType(fullRawLine) === 'income';
    }

    let cleanDesc = fullRawLine;
    for (const a of item.amountCandidates) {
      cleanDesc = cleanDesc.replace(a.raw, ' ');
    }
    cleanDesc = cleanDesc.replace(STATEMENT_DATE_REGEX, ' ');
    cleanDesc = cleanDesc.replace(/\b(cr|dr|credit|debit|deposit|withdrawal|bal|balance)\b/gi, ' ');
    cleanDesc = cleanTransactionDescription(cleanDesc);
    if (!cleanDesc) cleanDesc = `Transaction #${transactions.length + 1}`;

    let needsReview = false;
    let warningReason: string | undefined;

    if (balanceVal !== undefined && runningBalTracker !== undefined) {
      const expectedBal = runningBalTracker + (isIncome ? txAmount : -txAmount);
      if (Math.abs(expectedBal - balanceVal) > 0.05) {
        const reversedBal = runningBalTracker + (isIncome ? -txAmount : txAmount);
        if (Math.abs(reversedBal - balanceVal) <= 0.05) {
          isIncome = !isIncome;
        } else {
          needsReview = true;
          warningReason = `Running balance discrepancy`;
          ambiguousRowCount++;
        }
      }
    }

    if (balanceVal !== undefined) {
      runningBalTracker = balanceVal;
      if (closingBalance === undefined) closingBalance = balanceVal;
    }

    const category = isIncome ? 'Income' : autoCategorizeExpense(cleanDesc);

    const tx: Transaction = {
      id: `${sourceType}-txt-${Date.now()}-${transactions.length}`,
      date: item.date,
      name: cleanDesc,
      category,
      type: isIncome ? 'income' : 'expense',
      amount: txAmount,
      source: 'imported',
      sourceFile: fileName,
      sourceType: sourceType,
      needsReview: needsReview || undefined,
      warningReason
    };

    if (validateTransaction(tx).isValid) {
      transactions.push(tx);
      datesFound.push(item.date);
    }
  };

  for (const line of lines) {
    if (isFooterOrSummaryLine(line)) continue;

    const balCheck = isOpeningOrClosingBalanceLine(line);
    if (balCheck.isBalance) {
      if (balCheck.type === 'opening' && openingBalance === undefined && balCheck.amount !== undefined) {
        openingBalance = balCheck.amount;
        if (runningBalTracker === undefined) runningBalTracker = balCheck.amount;
      } else if (balCheck.type === 'closing' && balCheck.amount !== undefined) {
        closingBalance = balCheck.amount;
      }
      continue;
    }

    const dateMatch = line.match(STATEMENT_DATE_REGEX);
    if (dateMatch) {
      if (pending) {
        finalizeTextRow(pending);
        pending = null;
      }

      const dateStr = normalizeDate(dateMatch[0], dateConvention);
      const textWithoutDate = line.replace(dateMatch[0], ' ');
      const amounts = extractAmountsFromText(textWithoutDate);

      pending = {
        date: dateStr,
        descParts: [textWithoutDate],
        amountCandidates: amounts,
        lineText: line
      };
    } else {
      if (pending) {
        const continuationAmounts = extractAmountsFromText(line);
        if (continuationAmounts.length > 0) {
          pending.amountCandidates.push(...continuationAmounts);
        }
        pending.descParts.push(line);
      }
    }
  }

  if (pending) {
    finalizeTextRow(pending);
  }

  if (transactions.length === 0) return null;

  let totalDebits = 0;
  let totalCredits = 0;
  let debitsCount = 0;
  let creditsCount = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalCredits += t.amount;
      creditsCount++;
    } else {
      totalDebits += t.amount;
      debitsCount++;
    }
  }

  let reconciliation: StatementReconciliation | undefined;
  if (openingBalance !== undefined || closingBalance !== undefined) {
    const calcClosing = openingBalance !== undefined ? openingBalance + totalCredits - totalDebits : undefined;
    const diff = calcClosing !== undefined && closingBalance !== undefined
      ? Math.abs(calcClosing - closingBalance)
      : undefined;
    const reconciled = diff !== undefined ? diff <= 1.0 : false;

    reconciliation = {
      detected: true,
      openingBalance,
      closingBalance,
      calculatedClosingBalance: calcClosing !== undefined ? Math.round(calcClosing * 100) / 100 : undefined,
      difference: diff !== undefined ? Math.round(diff * 100) / 100 : undefined,
      reconciled,
      transactionsDetected: transactions.length,
      debitsCount,
      creditsCount,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100
    };
  }

  return aggregateInterpretationResult(
    transactions,
    datesFound,
    fileName,
    currencyCode,
    reconciliation,
    warnings.length > 0 ? warnings : undefined,
    ambiguousRowCount
  );
}

export async function parsePdfStatement(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

  interface PageData {
    pageNum: number;
    cells: PdfCell[];
    rows: { y: number; cells: PdfCell[]; rowText: string }[];
  }

  const pagesData: PageData[] = [];
  const allPageRows: { page: number; cells: PdfCell[]; rowText: string; y: number }[] = [];
  let fullDocText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageCells: PdfCell[] = [];

    for (const item of textContent.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const str = item.str.trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      pageCells.push({ text: str, x, y, width: item.width || 0 });
    }

    if (pageCells.length === 0) continue;

    pageCells.sort((a, b) => b.y - a.y);
    const pageRows: PdfCell[][] = [];

    for (const cell of pageCells) {
      const existing = pageRows.find((r) => Math.abs(r[0].y - cell.y) <= 6);
      if (existing) {
        existing.push(cell);
      } else {
        pageRows.push([cell]);
      }
    }

    pageRows.sort((a, b) => b[0].y - a[0].y);
    const structuredRows: { y: number; cells: PdfCell[]; rowText: string }[] = [];

    for (const r of pageRows) {
      r.sort((a, b) => a.x - b.x);
      const rowText = r.map((c) => c.text).join(' ');
      if (rowText.length > 0) {
        structuredRows.push({ y: r[0].y, cells: r, rowText });
        allPageRows.push({
          page: pageNum,
          rowText,
          cells: r,
          y: r[0].y
        });
        fullDocText += '\n' + rowText;
      }
    }

    pagesData.push({
      pageNum,
      cells: pageCells,
      rows: structuredRows
    });
  }

  // Scanned PDF check: if digital text is empty, fall back to OCR text parsing
  if (fullDocText.trim().length < 25) {
    const { scanReceiptImage } = await import('./receiptScanner');
    const scanned = await scanReceiptImage(file);

    // Try multi-line statement line extraction from OCR text
    if (scanned.rawText && scanned.rawText.length > 30) {
      const ocrResult = parseTextStatementLines(scanned.rawText, file.name, currencyCode, 'pdf');
      if (ocrResult && ocrResult.recordCount > 1) {
        return ocrResult;
      }
    }

    const tx: Transaction = {
      id: `pdf-ocr-${Date.now()}`,
      name: scanned.merchantName,
      amount: scanned.amount,
      category: scanned.category,
      date: scanned.date,
      source: 'imported',
      type: scanned.type || 'expense',
      sourceFile: file.name,
      sourceType: 'pdf'
    };

    const categoryTotals: Record<ExpenseCategory, number> = {
      Housing: 0, Food: 0, Transport: 0, Utilities: 0,
      Entertainment: 0, Savings: 0, Miscellany: 0, Income: 0
    };
    categoryTotals[scanned.category] = scanned.amount;

    const isIncome = scanned.type === 'income';
    return {
      recordCount: 1,
      totalAmount: isIncome ? 0 : scanned.amount,
      totalInflow: isIncome ? scanned.amount : 0,
      categoryBreakdown: categoryTotals,
      topCategory: { category: scanned.category, amount: scanned.amount, percentage: 100 },
      highestExpense: { name: scanned.merchantName, amount: scanned.amount, date: scanned.date },
      earliestDate: scanned.date,
      latestDate: scanned.date,
      insights: [
        `Processed scanned PDF document via optical recognition: "${scanned.merchantName}".`,
        `Extracted amount: ${formatCurrency(scanned.amount, currencyCode)} (${isIncome ? 'Income' : scanned.category}).`
      ],
      transactions: [tx]
    };
  }

  // Detect statement-wide date convention from all dates in PDF
  const allPdfDates: string[] = [];
  for (const { rowText } of allPageRows) {
    const m = rowText.match(STATEMENT_DATE_REGEX);
    if (m) allPdfDates.push(m[0]);
  }
  const dateConvention = detectDateConvention(allPdfDates);

  // Scan for opening balance and closing balance
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (const { rowText } of allPageRows) {
    const balCheck = isOpeningOrClosingBalanceLine(rowText);
    if (balCheck.isBalance && balCheck.amount !== undefined) {
      if (balCheck.type === 'opening' && openingBalance === undefined) {
        openingBalance = balCheck.amount;
      } else if (balCheck.type === 'closing' && closingBalance === undefined) {
        closingBalance = balCheck.amount;
      }
    }
  }

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];
  let runningBalTracker: number | undefined = openingBalance;
  let ambiguousRowCount = 0;
  const warnings: string[] = [];

  // --- TIER 1: Multi-line Column-Zone Anchor-Band PDF Table Parser ---
  let savedColumnZones: DetectedColumnZone[] = [];

  for (const page of pagesData) {
    const { cells, rows } = page;
    if (cells.length === 0) continue;

    // Detect header row on this page if present
    let headerY = -1;
    let pageZones = savedColumnZones;

    for (const r of rows) {
      const roles = r.cells.map((c) => ({ cell: c, role: matchHeaderRole(c.text) }));
      const hasDate = roles.some((x) => x.role === 'date');
      const hasFin = roles.some(
        (x) => x.role === 'credit' || x.role === 'debit' || x.role === 'amount' || x.role === 'balance'
      );

      if (hasDate && hasFin) {
        headerY = r.y;
        const validRoles = roles.filter((x) => x.role !== 'unknown').sort((a, b) => a.cell.x - b.cell.x);
        pageZones = validRoles.map((h, idx) => {
          const prev = validRoles[idx - 1];
          const next = validRoles[idx + 1];
          const xStart = prev ? (prev.cell.x + (prev.cell.width || 0) + h.cell.x) / 2 : 0;
          const xEnd = next ? (h.cell.x + (h.cell.width || 0) + next.cell.x) / 2 : 99999;
          return {
            role: h.role as ColumnRole,
            xStart,
            xEnd,
            centerX: h.cell.x + (h.cell.width || 0) / 2,
            name: h.cell.text
          };
        });
        savedColumnZones = pageZones;
        break;
      }
    }

    if (pageZones.length < 2) continue;

    const dateZone = pageZones.find((z) => z.role === 'date');
    const descZone = pageZones.find((z) => z.role === 'description');
    const creditZone = pageZones.find((z) => z.role === 'credit');
    const debitZone = pageZones.find((z) => z.role === 'debit');
    const amountZone = pageZones.find((z) => z.role === 'amount');
    const balanceZone = pageZones.find((z) => z.role === 'balance');
    const refZone = pageZones.find((z) => z.role === 'ref');
    const typeZone = pageZones.find((z) => z.role === 'txType');
    const catZone = pageZones.find((z) => z.role === 'category');

    // Determine vertical boundaries of table region on this page
    let topY = headerY !== -1 ? headerY - 5 : 9999;
    let bottomY = 32;

    for (const r of rows) {
      if (r.y < topY && isOpeningOrClosingBalanceLine(r.rowText).isBalance) {
        const bal = isOpeningOrClosingBalanceLine(r.rowText);
        if (bal.type === 'opening') {
          topY = Math.min(topY, r.y - 4);
          if (openingBalance === undefined && bal.amount !== undefined) {
            openingBalance = bal.amount;
            if (runningBalTracker === undefined) runningBalTracker = bal.amount;
          }
        } else if (bal.type === 'closing') {
          if (r.y > bottomY) bottomY = r.y;
          if (closingBalance === undefined && bal.amount !== undefined) {
            closingBalance = bal.amount;
          }
        }
      }
      if (
        r.y < topY &&
        (isFooterOrSummaryLine(r.rowText) ||
          /^(?:disclaimer|end of statement|details of ombudsman|computer output)/i.test(r.rowText))
      ) {
        if (r.y > bottomY) {
          bottomY = r.y;
        }
      }
    }

    // Filter items within active table boundaries
    const tableItems = cells.filter((c) => c.y < topY && c.y > bottomY);

    // Identify transaction anchor baselines
    interface Anchor {
      y: number;
      dateStr?: string;
      parsedDate?: string;
    }
    const anchors: Anchor[] = [];

    // Group active table items into rows to detect anchors
    const tableRows: { y: number; cells: PdfCell[] }[] = [];
    for (const c of tableItems) {
      const existing = tableRows.find((r) => Math.abs(r.y - c.y) <= 5);
      if (existing) existing.cells.push(c);
      else tableRows.push({ y: c.y, cells: [c] });
    }
    tableRows.sort((a, b) => b.y - a.y);

    for (const r of tableRows) {
      let rowDateStr: string | undefined;

      if (dateZone) {
        const dateCells = r.cells.filter((c) => {
          const cx = c.x + (c.width || 0) / 2;
          return cx >= dateZone.xStart && cx < dateZone.xEnd;
        });
        const dText = dateCells.map((c) => c.text).join(' ').trim();
        const m = dText.match(STATEMENT_DATE_REGEX);
        if (m) rowDateStr = m[0];
      } else {
        const fullRowText = r.cells.map((c) => c.text).join(' ');
        const m = fullRowText.match(STATEMENT_DATE_REGEX);
        if (m) rowDateStr = m[0];
      }

      if (rowDateStr) {
        const std = parseFlexibleDate(rowDateStr, dateConvention);
        if (std) {
          anchors.push({ y: r.y, dateStr: rowDateStr, parsedDate: std });
          continue;
        }
      }

      // Check continuation line with distinct financial amount + balance
      const hasAmt = r.cells.some((c) => {
        const cx = c.x + (c.width || 0) / 2;
        const inAmt =
          (creditZone && cx >= creditZone.xStart && cx < creditZone.xEnd) ||
          (debitZone && cx >= debitZone.xStart && cx < debitZone.xEnd) ||
          (amountZone && cx >= amountZone.xStart && cx < amountZone.xEnd);
        if (!inAmt) return false;
        const p = parseMonetaryAmount(c.text);
        return p !== null && p.amount > 0;
      });
      const hasBal = r.cells.some((c) => {
        const cx = c.x + (c.width || 0) / 2;
        if (!balanceZone || cx < balanceZone.xStart || cx >= balanceZone.xEnd) return false;
        const p = parseMonetaryAmount(c.text);
        return p !== null && p.amount > 0;
      });

      if (hasAmt && hasBal) {
        anchors.push({ y: r.y });
      }
    }

    if (anchors.length === 0) continue;

    // Segment items into bands around anchors
    for (let i = 0; i < anchors.length; i++) {
      const curr = anchors[i];
      const prev = anchors[i - 1];
      const next = anchors[i + 1];

      const yUpper = prev ? (prev.y + curr.y) / 2 : topY;
      const yLower = next ? (curr.y + next.y) / 2 : bottomY;

      const bandItems = tableItems.filter((c) => c.y <= yUpper && c.y > yLower);
      bandItems.sort((a, b) => b.y - a.y || a.x - b.x);

      const colMap: Record<ColumnRole, string[]> = {
        date: [], description: [], category: [], txType: [],
        amount: [], debit: [], credit: [], balance: [],
        ref: [], currency: [], unknown: []
      };

      for (const item of bandItems) {
        const cx = item.x + (item.width || 0) / 2;
        const matched = pageZones.find((z) => cx >= z.xStart && cx < z.xEnd);
        let role: ColumnRole = matched ? matched.role : 'unknown';

        if (role === 'unknown') {
          let closest = pageZones[0];
          let minDist = Math.abs(closest.centerX - cx);
          for (const z of pageZones) {
            const dist = Math.abs(z.centerX - cx);
            if (dist < minDist) {
              minDist = dist;
              closest = z;
            }
          }
          role = closest.role;
        }

        // If classified as date but does not match any date pattern, it belongs to description
        if (role === 'date' && !STATEMENT_DATE_REGEX.test(item.text)) {
          role = 'description';
        }

        colMap[role].push(item.text);
      }

      // Date resolution
      let txDate = curr.parsedDate;
      if (!txDate) {
        const dStr = colMap.date.join(' ').trim();
        txDate =
          parseFlexibleDate(dStr, dateConvention) ||
          (transactions.length > 0 ? transactions[transactions.length - 1].date : new Date().toISOString().split('T')[0]);
      }

      // Collect all numeric candidates in this band
      const bandNumbers: { amount: number; isNegative: boolean; raw: string; cx: number }[] = [];
      for (const item of bandItems) {
        if (STATEMENT_DATE_REGEX.test(item.text)) continue;
        const p = parseMonetaryAmount(item.text);
        if (p && p.amount > 0 && p.amount < 100000000) {
          const cx = item.x + (item.width || 0) / 2;
          bandNumbers.push({ amount: p.amount, isNegative: p.isNegative, raw: item.text, cx });
        }
      }

      // Amount resolution
      let txAmount = 0;
      let crVal: number | undefined;
      let drVal: number | undefined;
      let amtIsNegative = false;
      let balVal: number | undefined;
      let mathResolved = false;

      // 1. MATHEMATICAL RECONCILIATION SOLVER:
      // When a running balance exists, validate which numbers satisfy:
      // Previous Balance + Credit - Debit = Current Balance
      if (runningBalTracker !== undefined && bandNumbers.length >= 2) {
        for (let idxA = 0; idxA < bandNumbers.length; idxA++) {
          for (let idxB = 0; idxB < bandNumbers.length; idxB++) {
            if (idxA === idxB) continue;
            const amtCandidate = bandNumbers[idxA].amount;
            const balCandidate = bandNumbers[idxB].amount;

            // Credit test: runningBalTracker + amtCandidate = balCandidate
            if (Math.abs(runningBalTracker + amtCandidate - balCandidate) <= 0.05) {
              txAmount = amtCandidate;
              balVal = balCandidate;
              crVal = amtCandidate;
              drVal = undefined;
              amtIsNegative = false;
              mathResolved = true;
              break;
            }

            // Debit test: runningBalTracker - amtCandidate = balCandidate
            if (Math.abs(runningBalTracker - amtCandidate - balCandidate) <= 0.05) {
              txAmount = amtCandidate;
              balVal = balCandidate;
              drVal = amtCandidate;
              crVal = undefined;
              amtIsNegative = true;
              mathResolved = true;
              break;
            }
          }
          if (mathResolved) break;
        }
      }

      // 2. If not solved by math, use detected column zones:
      if (!mathResolved) {
        const creditParsed = parseMonetaryAmount(colMap.credit.join(' ').trim());
        if (creditParsed && creditParsed.amount > 0) {
          crVal = creditParsed.amount;
          txAmount = creditParsed.amount;
        }
        const debitParsed = parseMonetaryAmount(colMap.debit.join(' ').trim());
        if (debitParsed && debitParsed.amount > 0) {
          drVal = debitParsed.amount;
          if (txAmount === 0) txAmount = debitParsed.amount;
        }

        if (txAmount === 0 && colMap.amount.length > 0) {
          const amtParsed = parseMonetaryAmount(colMap.amount.join(' ').trim());
          if (amtParsed && amtParsed.amount > 0) {
            txAmount = amtParsed.amount;
            amtIsNegative = amtParsed.isNegative;
          }
        }

        if (colMap.balance.length > 0) {
          const balParsed = parseMonetaryAmount(colMap.balance.join(' ').trim());
          if (balParsed && balParsed.amount > 0) {
            balVal = balParsed.amount;
          }
        }

        // Safeguard: Never mistake running balance for transaction amount if balance changed
        if (balVal !== undefined && runningBalTracker !== undefined) {
          const balDiff = Math.abs(balVal - runningBalTracker);
          if (txAmount === balVal && balDiff > 0.001) {
            // Amount was mistakenly set to the balance itself!
            txAmount = Math.round(balDiff * 100) / 100;
            if (balVal > runningBalTracker) crVal = txAmount;
            else drVal = txAmount;
          } else if (txAmount === 0 && balDiff > 0.001) {
            txAmount = Math.round(balDiff * 100) / 100;
            if (balVal > runningBalTracker) crVal = txAmount;
            else drVal = txAmount;
          }
        }
      }

      if (txAmount <= 0) continue;

      // Description reconstruction: filter out raw numbers that matched amount or balance
      const descRawParts = colMap.description.filter((t) => {
        const p = parseMonetaryAmount(t);
        if (p && (p.amount === txAmount || p.amount === balVal)) return false;
        return true;
      });

      let fullDesc = cleanTransactionDescription(descRawParts.join(' ').trim());
      if (!fullDesc) {
        fullDesc = colMap.category.join(' ').trim() || `Transaction #${transactions.length + 1}`;
      }
      const refStr = colMap.ref.join(' ').trim();
      if (refStr && !fullDesc.includes(refStr)) {
        fullDesc = `${fullDesc} Ref:${refStr}`;
      }

      const rawCat = colMap.category.join(' ').trim();
      const typeStr = colMap.txType.join(' ').trim();

      let txType = determineTransactionType({
        explicitType: typeStr,
        sourceCategory: rawCat,
        hasCreditCol: creditZone !== undefined || crVal !== undefined,
        creditVal: crVal,
        hasDebitCol: debitZone !== undefined || drVal !== undefined,
        debitVal: drVal,
        amountIsNegative: amtIsNegative,
        description: fullDesc
      });

      // Running balance verification
      let needsReview = false;
      let warningReason: string | undefined;

      if (balVal !== undefined && runningBalTracker !== undefined) {
        const expectedBal = runningBalTracker + (txType === 'income' ? txAmount : -txAmount);
        if (Math.abs(expectedBal - balVal) > 0.05) {
          const reversedBal = runningBalTracker + (txType === 'income' ? -txAmount : txAmount);
          if (Math.abs(reversedBal - balVal) <= 0.05) {
            txType = txType === 'income' ? 'expense' : 'income';
          } else {
            needsReview = true;
            warningReason = 'Running balance discrepancy';
            ambiguousRowCount++;
          }
        }
      }

      if (balVal !== undefined) {
        runningBalTracker = balVal;
        if (closingBalance === undefined) closingBalance = balVal;
      }

      const category = normalizeCategory(rawCat, fullDesc, txType);

      transactions.push({
        id: `pdf-${Date.now()}-${transactions.length}`,
        date: txDate,
        name: fullDesc,
        category,
        type: txType,
        amount: txAmount,
        source: 'imported',
        sourceFile: file.name,
        sourceType: 'pdf',
        needsReview: needsReview || undefined,
        warningReason
      });
      datesFound.push(txDate);
    }
  }

  // --- TIER 2: Fallback Token-Stream Parsing (if Tier 1 produced no transactions) ---
  if (transactions.length === 0) {
    for (let i = 0; i < allPageRows.length; i++) {
      const { rowText } = allPageRows[i];
      if (isFooterOrSummaryLine(rowText)) continue;

      const dateMatch = rowText.match(STATEMENT_DATE_REGEX);
      if (!dateMatch) {
        if (transactions.length > 0 && rowText.length > 3 && !isFooterOrSummaryLine(rowText)) {
          const lastTx = transactions[transactions.length - 1];
          if (lastTx.name.length < 120 && !lastTx.name.includes(rowText.trim())) {
            lastTx.name = cleanTransactionDescription(`${lastTx.name} ${rowText.trim()}`);
          }
        }
        continue;
      }

      const rawDateStr = dateMatch[0];
      const stdDate = normalizeDate(rawDateStr, dateConvention);
      const dayOfMonth = parseInt(stdDate.slice(8, 10), 10);

      const textWithoutDate = rowText.replace(rawDateStr, ' ').trim();
      const candidateAmounts = extractAmountsFromText(textWithoutDate);
      if (candidateAmounts.length === 0) continue;

      let validCandidates = candidateAmounts;
      if (candidateAmounts.length > 1) {
        const nonDayCandidates = candidateAmounts.filter((c) => Math.abs(c.value) !== dayOfMonth);
        if (nonDayCandidates.length > 0) {
          validCandidates = nonDayCandidates;
        }
      }

      let txAmount = 0;
      let balVal: number | undefined;

      if (validCandidates.length >= 2) {
        balVal = Math.abs(validCandidates[validCandidates.length - 1].value);
        txAmount = Math.abs(validCandidates[validCandidates.length - 2].value);
      } else {
        const symbolCandidate = validCandidates.find((c) => /(?:₹|Rs\.?|INR|\$|€|£)/i.test(c.raw));
        const chosen = symbolCandidate || validCandidates[validCandidates.length - 1];
        txAmount = Math.abs(chosen.value);
      }

      if (txAmount <= 0) continue;

      let isIncome = false;
      if (balVal !== undefined && runningBalTracker !== undefined) {
        const diff = balVal - runningBalTracker;
        if (Math.abs(diff) > 0.05) {
          isIncome = diff > 0;
        }
      } else {
        isIncome = classifyTransactionType(textWithoutDate) === 'income';
      }

      let cleanDesc = textWithoutDate;
      for (const ca of candidateAmounts) {
        cleanDesc = cleanDesc.replace(ca.raw, ' ');
      }
      cleanDesc = cleanDesc.replace(/\b(income|expense|credit|debit|cr|dr|deposit|withdrawal|bal|balance)\b/gi, ' ');
      cleanDesc = cleanTransactionDescription(cleanDesc);
      if (!cleanDesc) cleanDesc = `Transaction #${transactions.length + 1}`;

      if (balVal !== undefined) {
        runningBalTracker = balVal;
        if (closingBalance === undefined) closingBalance = balVal;
      }

      const category = isIncome ? 'Income' : autoCategorizeExpense(cleanDesc);

      const tx: Transaction = {
        id: `pdf-${Date.now()}-${transactions.length}`,
        date: stdDate,
        name: cleanDesc,
        category,
        type: isIncome ? 'income' : 'expense',
        amount: txAmount,
        source: 'imported',
        sourceFile: file.name,
        sourceType: 'pdf'
      };

      if (validateTransaction(tx, rowText).isValid) {
        transactions.push(tx);
        datesFound.push(stdDate);
      }
    }
  }

  // --- TIER 3: Single Receipt / Invoice Fallback ---
  if (transactions.length === 0) {
    let docDate = new Date().toISOString().split('T')[0];
    const firstDate = fullDocText.match(STATEMENT_DATE_REGEX);
    if (firstDate) docDate = normalizeDate(firstDate[0], dateConvention);

    const isIncome = classifyTransactionType(fullDocText) === 'income';
    const txType: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    let docName = '';
    for (const { rowText } of allPageRows.slice(0, 8)) {
      if (isFooterOrSummaryLine(rowText)) continue;
      const clean = rowText.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3 && !/^(statement|account|page|invoice|receipt|date|total|summary)/i.test(clean)) {
        docName = clean;
        break;
      }
    }
    if (!docName) {
      docName = isIncome ? 'Income / Deposit Payment' : 'PDF Receipt / Invoice';
    }

    const allDocAmounts = extractAmountsFromText(fullDocText);
    let docAmount = 0;

    if (allDocAmounts.length > 0) {
      const totalMatch = fullDocText.match(
        /(?:total|amount\s*due|net\s*pay|grand\s*total|balance\s*due|deposit)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i
      );
      if (totalMatch) {
        const parsed = extractAmountsFromText(totalMatch[0]);
        if (parsed.length > 0) docAmount = Math.abs(parsed[0].value);
      }
      if (docAmount <= 0) {
        docAmount = Math.max(...allDocAmounts.map((a) => Math.abs(a.value)));
      }
    }

    if (docAmount > 0) {
      const category = isIncome ? 'Savings' : autoCategorizeExpense(`${docName} ${fullDocText}`);
      transactions.push({
        id: `pdf-doc-${Date.now()}`,
        name: docName,
        amount: Math.round(docAmount * 100) / 100,
        category,
        date: docDate,
        source: 'imported',
        type: txType,
        sourceFile: file.name,
        sourceType: 'pdf'
      });
      datesFound.push(docDate);
    }
  }

  // Deduplicate legitimate duplicate protections across page borders or overlap
  const dedupedTransactions = deduplicateTransactions(transactions);

  // Calculate reconciliation
  let totalDebits = 0;
  let totalCredits = 0;
  let debitsCount = 0;
  let creditsCount = 0;

  for (const t of dedupedTransactions) {
    if (t.type === 'income') {
      totalCredits += t.amount;
      creditsCount++;
    } else {
      totalDebits += t.amount;
      debitsCount++;
    }
  }

  let reconciliation: StatementReconciliation | undefined;
  if (openingBalance !== undefined || closingBalance !== undefined) {
    const calcClosing = openingBalance !== undefined ? openingBalance + totalCredits - totalDebits : undefined;
    const diff = calcClosing !== undefined && closingBalance !== undefined
      ? Math.abs(calcClosing - closingBalance)
      : undefined;
    const reconciled = diff !== undefined ? diff <= 1.0 : false;

    reconciliation = {
      detected: true,
      openingBalance,
      closingBalance,
      calculatedClosingBalance: calcClosing !== undefined ? Math.round(calcClosing * 100) / 100 : undefined,
      difference: diff !== undefined ? Math.round(diff * 100) / 100 : undefined,
      reconciled,
      transactionsDetected: dedupedTransactions.length,
      debitsCount,
      creditsCount,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100
    };
  }

  return aggregateInterpretationResult(
    dedupedTransactions,
    datesFound,
    file.name,
    currencyCode,
    reconciliation,
    warnings.length > 0 ? warnings : undefined,
    ambiguousRowCount
  );
}

// --- 7. Unified Tabular Statement Processor (CSV, XLSX, Sheets) ---

export function processTabularStatement(
  rawRows: any[][],
  fileName: string = 'statement.csv',
  currencyCode: string = 'INR',
  sourceType: 'csv' | 'excel' = 'csv'
): FileInterpretationResult {
  if (!rawRows || rawRows.length < 2) {
    throw new Error('Statement file has insufficient lines.');
  }

  // 1. Gather all date-like strings across file to detect statement date convention
  const allDateCandidates: string[] = [];
  for (const row of rawRows) {
    for (const cell of row) {
      const s = String(cell || '').trim();
      if (s && STATEMENT_DATE_REGEX.test(s)) {
        allDateCandidates.push(s);
      }
    }
  }
  const dateConvention = detectDateConvention(allDateCandidates);

  // 2. Scan for opening balance and closing balance in metadata lines (e.g. above or below table)
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (const row of rawRows) {
    const rowStr = row.map((c) => String(c || '').trim()).join(' ');
    const check = isOpeningOrClosingBalanceLine(rowStr);
    const hasOpening = check.type === 'opening' || row.some((c) => /\b(opening\s*bal(ance)?|b\/f|brought\s*forward|start(ing)?\s*bal(ance)?)\b/i.test(String(c)));
    const hasClosing = check.type === 'closing' || row.some((c) => /\b(closing\s*bal(ance)?|c\/f|carried\s*forward|end(ing)?\s*bal(ance)?|final\s*bal(ance)?)\b/i.test(String(c)));

    if (hasOpening || hasClosing) {
      let foundAmt = check.amount;
      if (foundAmt === undefined) {
        for (let c = row.length - 1; c >= 0; c--) {
          const p = parseMonetaryAmount(row[c]);
          if (p && p.amount > 0) {
            foundAmt = p.amount;
            break;
          }
        }
      }
      if (foundAmt !== undefined) {
        if (hasOpening && openingBalance === undefined) {
          openingBalance = foundAmt;
        } else if (hasClosing && closingBalance === undefined) {
          closingBalance = foundAmt;
        }
      }
    }
  }

  // 3. Find table header row semantically
  let headerRowIdx = -1;
  let colDate = -1;
  let colDesc = -1;
  let colCat = -1;
  let colType = -1;
  let colAmount = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colBalance = -1;
  let colRef = -1;

  for (let i = 0; i < Math.min(35, rawRows.length); i++) {
    const row = rawRows[i].map((c) => String(c || '').trim());
    const roles = row.map((cell) => matchHeaderRole(cell));

    const dIdx = roles.indexOf('date');
    const amtIdx = roles.indexOf('amount');
    const drIdx = roles.indexOf('debit');
    const crIdx = roles.indexOf('credit');
    const balIdx = roles.indexOf('balance');

    if (dIdx !== -1 && (amtIdx !== -1 || drIdx !== -1 || crIdx !== -1 || balIdx !== -1)) {
      headerRowIdx = i;
      colDate = dIdx;
      colDesc = roles.indexOf('description');
      colCat = roles.indexOf('category');
      colType = roles.indexOf('txType');
      colAmount = amtIdx;
      colDebit = drIdx;
      colCredit = crIdx;
      colBalance = balIdx;
      colRef = roles.indexOf('ref');
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    colDate = 0;
    colDesc = 1;
    colAmount = 2;
  }

  if (colDesc === -1) {
    const possibleCols = [0, 1, 2, 3, 4, 5].filter(
      (c) => c !== colDate && c !== colDebit && c !== colCredit && c !== colAmount && c !== colBalance
    );
    if (possibleCols.length > 0) colDesc = possibleCols[0];
  }

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];
  let runningBalTracker: number | undefined = openingBalance;
  let ambiguousRowCount = 0;
  const warnings: string[] = [];

  interface PendingRow {
    date: string;
    description: string;
    rawDescParts: string[];
    debitVal?: number;
    creditVal?: number;
    amountVal?: number;
    amountIsNegative?: boolean;
    balanceVal?: number;
    explicitType?: string;
    rawCat?: string;
    refVal?: string;
    rowIndex: number;
  }

  let pending: PendingRow | null = null;

  const finalizePending = (item: PendingRow) => {
    let txAmount = 0;
    let drVal = item.debitVal;
    let crVal = item.creditVal;
    let amtIsNegative = item.amountIsNegative || false;

    // Separate Debit/Credit columns
    if (colDebit !== -1 || colCredit !== -1) {
      if (crVal && crVal > 0) {
        txAmount = crVal;
      } else if (drVal && drVal > 0) {
        txAmount = drVal;
      }
    }

    // Amount column with Balance movement inference
    if (txAmount === 0 && item.amountVal && item.amountVal > 0) {
      txAmount = item.amountVal;
    }

    // Infer direction from balance movement if amount has no explicit type and running balance is present
    if (item.balanceVal !== undefined && runningBalTracker !== undefined && crVal === undefined && drVal === undefined) {
      const balDiff = item.balanceVal - runningBalTracker;
      if (Math.abs(balDiff) > 0.001) {
        if (txAmount === 0) {
          txAmount = Math.round(Math.abs(balDiff) * 100) / 100;
        }
        if (balDiff > 0) {
          crVal = txAmount;
          amtIsNegative = false;
        } else {
          drVal = txAmount;
          amtIsNegative = true;
        }
      }
    }

    if (txAmount <= 0) return;

    let fullDesc = cleanTransactionDescription(
      item.rawDescParts.join(' ') || item.description || `Transaction #${transactions.length + 1}`
    );
    if (item.refVal && !fullDesc.includes(item.refVal)) {
      fullDesc = `${fullDesc} Ref:${item.refVal}`;
    }

    let txType = determineTransactionType({
      explicitType: item.explicitType,
      sourceCategory: item.rawCat,
      hasCreditCol: colCredit !== -1,
      creditVal: crVal,
      hasDebitCol: colDebit !== -1,
      debitVal: drVal,
      amountIsNegative: amtIsNegative,
      description: fullDesc
    });

    let needsReview = false;
    let warningReason: string | undefined;

    if (item.balanceVal !== undefined && runningBalTracker !== undefined) {
      const expectedBal = runningBalTracker + (txType === 'income' ? txAmount : -txAmount);
      const diff = Math.abs(expectedBal - item.balanceVal);
      if (diff > 0.05) {
        const reversedBal = runningBalTracker + (txType === 'income' ? -txAmount : txAmount);
        if (Math.abs(reversedBal - item.balanceVal) <= 0.05) {
          txType = txType === 'income' ? 'expense' : 'income';
        } else {
          needsReview = true;
          warningReason = `Balance discrepancy: expected ${expectedBal.toFixed(2)}, statement balance was ${item.balanceVal.toFixed(2)}`;
          ambiguousRowCount++;
        }
      }
    }

    if (item.balanceVal !== undefined) {
      runningBalTracker = item.balanceVal;
      if (closingBalance === undefined) {
        closingBalance = item.balanceVal;
      }
    }

    const category = normalizeCategory(item.rawCat, fullDesc, txType);

    const tx: Transaction = {
      id: `${sourceType}-${Date.now()}-${transactions.length}`,
      date: item.date,
      name: fullDesc,
      category,
      type: txType,
      amount: txAmount,
      source: 'imported',
      sourceFile: fileName,
      sourceType: sourceType,
      needsReview: needsReview || undefined,
      warningReason
    };

    if (validateTransaction(tx).isValid) {
      transactions.push(tx);
      datesFound.push(item.date);
    }
  };

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rowStr = row.map((c) => String(c || '').trim()).join(' ');
    if (isFooterOrSummaryLine(rowStr)) continue;

    const balCheck = isOpeningOrClosingBalanceLine(rowStr);
    const hasOpening = balCheck.type === 'opening' || row.some((c) => /\b(opening\s*bal(ance)?|b\/f|brought\s*forward|start(ing)?\s*bal(ance)?)\b/i.test(String(c)));
    const hasClosing = balCheck.type === 'closing' || row.some((c) => /\b(closing\s*bal(ance)?|c\/f|carried\s*forward|end(ing)?\s*bal(ance)?|final\s*bal(ance)?)\b/i.test(String(c)));

    if (hasOpening || hasClosing) {
      let foundAmt = balCheck.amount;
      if (foundAmt === undefined) {
        for (let c = row.length - 1; c >= 0; c--) {
          const p = parseMonetaryAmount(row[c]);
          if (p && p.amount > 0) {
            foundAmt = p.amount;
            break;
          }
        }
      }
      if (foundAmt !== undefined) {
        if (hasOpening && openingBalance === undefined) {
          openingBalance = foundAmt;
          if (runningBalTracker === undefined) runningBalTracker = foundAmt;
        } else if (hasClosing && closingBalance === undefined) {
          closingBalance = foundAmt;
        }
      }
      continue;
    }

    const rawDateVal = colDate !== -1 ? row[colDate] : undefined;
    const dateVal = parseFlexibleDate(rawDateVal, dateConvention);

    if (dateVal) {
      if (pending) {
        finalizePending(pending);
        pending = null;
      }

      let drVal: number | undefined;
      let crVal: number | undefined;
      let amtVal: number | undefined;
      let amtIsNegative = false;
      let balVal: number | undefined;

      if (colDebit !== -1) {
        const p = parseMonetaryAmount(row[colDebit]);
        if (p && p.amount > 0) drVal = p.amount;
      }
      if (colCredit !== -1) {
        const p = parseMonetaryAmount(row[colCredit]);
        if (p && p.amount > 0) crVal = p.amount;
      }
      if (colAmount !== -1) {
        const p = parseMonetaryAmount(row[colAmount]);
        if (p && p.amount > 0) {
          amtVal = p.amount;
          amtIsNegative = p.isNegative;
        }
      }
      if (colBalance !== -1) {
        const p = parseMonetaryAmount(row[colBalance]);
        if (p && p.amount > 0) balVal = p.amount;
      }

      const descVal = colDesc !== -1 ? String(row[colDesc] || '').trim() : '';
      const rawType = colType !== -1 ? String(row[colType] || '').trim() : undefined;
      const rawCat = colCat !== -1 ? String(row[colCat] || '').trim() : undefined;
      const rawRef = colRef !== -1 ? String(row[colRef] || '').trim() : undefined;

      pending = {
        date: dateVal,
        description: descVal,
        rawDescParts: descVal ? [descVal] : [],
        debitVal: drVal,
        creditVal: crVal,
        amountVal: amtVal,
        amountIsNegative: amtIsNegative,
        balanceVal: balVal,
        explicitType: rawType,
        rawCat: rawCat,
        refVal: rawRef,
        rowIndex: r
      };
    } else {
      // Continuation row without date
      if (pending) {
        const continuationText = row
          .map((c) => String(c || '').trim())
          .filter((c) => c.length > 0)
          .join(' ');

        if (continuationText && !isFooterOrSummaryLine(continuationText)) {
          if (pending.amountVal === undefined && pending.debitVal === undefined && pending.creditVal === undefined) {
            const foundAmts = extractAmountsFromText(continuationText);
            if (foundAmts.length > 0) {
              pending.amountVal = Math.abs(foundAmts[0].value);
            }
          }
          if (pending.balanceVal === undefined && colBalance !== -1 && row[colBalance]) {
            const b = parseMonetaryAmount(row[colBalance]);
            if (b) pending.balanceVal = b.amount;
          }
          const descChunk = colDesc !== -1 && row[colDesc] ? String(row[colDesc]).trim() : continuationText;
          if (descChunk && !pending.rawDescParts.includes(descChunk)) {
            pending.rawDescParts.push(descChunk);
          }
        }
      }
    }
  }

  if (pending) {
    finalizePending(pending);
  }

  if (transactions.length === 0) {
    throw new Error('No valid financial transactions could be extracted from this statement.');
  }

  let totalDebits = 0;
  let totalCredits = 0;
  let debitsCount = 0;
  let creditsCount = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalCredits += t.amount;
      creditsCount++;
    } else {
      totalDebits += t.amount;
      debitsCount++;
    }
  }

  let reconciliation: StatementReconciliation | undefined;
  if (openingBalance !== undefined || closingBalance !== undefined) {
    const calcClosing = openingBalance !== undefined ? openingBalance + totalCredits - totalDebits : undefined;
    const diff = calcClosing !== undefined && closingBalance !== undefined
      ? Math.abs(calcClosing - closingBalance)
      : undefined;
    const reconciled = diff !== undefined ? diff <= 1.0 : false;

    if (diff !== undefined && !reconciled) {
      warnings.push(
        `Calculated closing balance (${(calcClosing || 0).toFixed(2)}) differs from statement closing balance (${(closingBalance || 0).toFixed(2)}) by ₹${diff.toFixed(2)}.`
      );
    }

    reconciliation = {
      detected: true,
      openingBalance,
      closingBalance,
      calculatedClosingBalance: calcClosing !== undefined ? Math.round(calcClosing * 100) / 100 : undefined,
      difference: diff !== undefined ? Math.round(diff * 100) / 100 : undefined,
      reconciled,
      transactionsDetected: transactions.length,
      debitsCount,
      creditsCount,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      warning: !reconciled && diff !== undefined ? `Reconciliation discrepancy of ${diff.toFixed(2)}` : undefined
    };
  }

  if (ambiguousRowCount > 0) {
    warnings.push(`${ambiguousRowCount} transaction(s) had potential balance discrepancies and were flagged for review.`);
  }

  return aggregateInterpretationResult(
    transactions,
    datesFound,
    fileName,
    currencyCode,
    reconciliation,
    warnings.length > 0 ? warnings : undefined,
    ambiguousRowCount
  );
}

// --- 8. Excel (.xlsx, .xls) Extractor ---

export async function parseExcelFile(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The Excel workbook contains no readable sheets.');
  }

  for (const sheetName of workbook.SheetNames) {
    if (/^(readme|instructions|notes|summary|help|overview)$/i.test(sheetName.trim())) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) continue;

    try {
      return processTabularStatement(rawRows, file.name, currencyCode, 'excel');
    } catch {
      // Continue to next sheet if parsing fails
    }
  }

  throw new Error('No valid financial transactions could be extracted from this Excel file.');
}

// --- 9. CSV Extractor ---

export function detectCsvDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 15);
  if (lines.length === 0) return ',';

  const delimiters = [',', ';', '\t', '|'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const d of delimiters) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const first = counts[0];
    if (first > 0) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const consistent = counts.every((c) => Math.abs(c - first) <= 1 && c > 0);
      if (consistent && avg > bestScore) {
        bestScore = avg;
        bestDelim = d;
      }
    }
  }

  return bestDelim;
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' || c === "'") {
      if (inQuotes && line[i + 1] === c) {
        current += c;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvContent(
  csvText: string,
  fileName: string = 'statement.csv',
  currencyCode: string = 'INR'
): FileInterpretationResult {
  const delimiter = detectCsvDelimiter(csvText);
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file has insufficient lines.');
  }

  const rawRows = lines.map((line) => parseCsvLine(line, delimiter));
  return processTabularStatement(rawRows, fileName, currencyCode, 'csv');
}

// --- 10. Google Sheets Import Fallback & Extractor ---

export function isGoogleSheetsUrl(url: string): boolean {
  return /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i.test(url.trim());
}

export function extractGoogleSpreadsheetId(url: string): { spreadsheetId: string; gid?: string } | null {
  const match = url.trim().match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (!match) return null;
  const spreadsheetId = match[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  return { spreadsheetId, gid: gidMatch ? gidMatch[1] : undefined };
}

export async function parseGoogleSheetsUrl(
  url: string,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const sheetMeta = extractGoogleSpreadsheetId(url);
  if (!sheetMeta) {
    throw new Error('Invalid Google Sheets URL. Please provide a URL in the format https://docs.google.com/spreadsheets/d/...');
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetMeta.spreadsheetId}/export?format=csv${
    sheetMeta.gid ? `&gid=${sheetMeta.gid}` : ''
  }`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(exportUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const text = await resp.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('accounts.google.com')) {
      throw new Error('Private sheet requires authentication');
    }

    return parseCsvContent(text, 'Google Sheet', currencyCode);
  } catch (err: any) {
    throw new Error(
      'This Google Sheet is private or requires authorization. To import it, open the sheet, click File → Download → Comma Separated Values (.csv) or Microsoft Excel (.xlsx), and drop the downloaded file here.'
    );
  }
}

// --- 11. Image & Receipt OCR Document Understanding ---

export async function parseImageDocument(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const { scanReceiptImage } = await import('./receiptScanner');
  const scanned = await scanReceiptImage(file);

  // If OCR text contains multiple statement lines, parse all rows
  if (scanned.rawText && scanned.rawText.length > 30) {
    const multiRowResult = parseTextStatementLines(scanned.rawText, file.name, currencyCode, 'image');
    if (multiRowResult && multiRowResult.recordCount > 1) {
      return multiRowResult;
    }
  }

  const tx: Transaction = {
    id: `img-${Date.now()}`,
    name: scanned.merchantName,
    amount: scanned.amount,
    category: scanned.category,
    date: scanned.date,
    source: 'imported',
    type: scanned.type || 'expense',
    sourceFile: file.name,
    sourceType: 'image',
    confidence: scanned.confidence
  };

  const isIncome = scanned.type === 'income';
  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0, Food: 0, Transport: 0, Utilities: 0,
    Entertainment: 0, Savings: 0, Miscellany: 0, Income: 0
  };
  categoryTotals[scanned.category] = scanned.amount;

  return {
    recordCount: 1,
    totalAmount: isIncome ? 0 : scanned.amount,
    totalInflow: isIncome ? scanned.amount : 0,
    categoryBreakdown: categoryTotals,
    topCategory: { category: scanned.category, amount: scanned.amount, percentage: 100 },
    highestExpense: { name: scanned.merchantName, amount: scanned.amount, date: scanned.date },
    earliestDate: scanned.date,
    latestDate: scanned.date,
    insights: [
      `Recognized receipt/document from "${scanned.merchantName}".`,
      `Extracted amount: ${formatCurrency(scanned.amount, currencyCode)} (${isIncome ? 'Income' : scanned.category}).`,
      scanned.confidence > 0 ? `Scan confidence: ${scanned.confidence}%.` : 'Image text processed.'
    ],
    transactions: [tx]
  };
}

// --- 11. Unified Dispatcher & Multi-File Batch Processor ---

function aggregateInterpretationResult(
  transactions: Transaction[],
  datesFound: string[],
  sourceName: string,
  currencyCode: string,
  reconciliation?: StatementReconciliation,
  warnings?: string[],
  needsReviewCount?: number
): FileInterpretationResult {
  // Sort descending by date
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0, Food: 0, Transport: 0, Utilities: 0,
    Entertainment: 0, Savings: 0, Miscellany: 0, Income: 0
  };

  let totalExpenseAmount = 0;
  let totalIncomeAmount = 0;
  let highestExpense: { name: string; amount: number; date: string } | null = null;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncomeAmount += t.amount;
    } else {
      totalExpenseAmount += t.amount;
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      if (!highestExpense || t.amount > highestExpense.amount) {
        highestExpense = { name: t.name, amount: t.amount, date: t.date };
      }
    }
  }

  let topCategory: FileInterpretationResult['topCategory'] = null;
  let maxCatAmount = 0;
  for (const [cat, amt] of Object.entries(categoryTotals) as [ExpenseCategory, number][]) {
    if (amt > maxCatAmount) {
      maxCatAmount = amt;
      topCategory = {
        category: cat,
        amount: Math.round(amt * 100) / 100,
        percentage: totalExpenseAmount > 0 ? Math.round((amt / totalExpenseAmount) * 100) : 0
      };
    }
  }

  datesFound.sort();
  const earliestDate = datesFound[0] || 'N/A';
  const latestDate = datesFound[datesFound.length - 1] || 'N/A';

  const insights = buildFileInterpretationInsights(
    {
      recordCount: transactions.length,
      totalAmount: totalExpenseAmount,
      totalInflow: totalIncomeAmount,
      topCategory,
      highestExpense,
      earliestDate,
      latestDate,
      transactions,
      reconciliation,
      needsReviewCount
    },
    currencyCode
  );

  return {
    recordCount: transactions.length,
    totalAmount: Math.round(totalExpenseAmount * 100) / 100,
    totalInflow: Math.round(totalIncomeAmount * 100) / 100,
    categoryBreakdown: categoryTotals,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    insights,
    transactions,
    warnings,
    needsReviewCount,
    reconciliation
  };
}

export async function parseAndInterpretFile(
  fileOrUrl: File | string,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  // If string URL (e.g. Google Sheets)
  if (typeof fileOrUrl === 'string') {
    if (isGoogleSheetsUrl(fileOrUrl)) {
      return await parseGoogleSheetsUrl(fileOrUrl, currencyCode);
    }
    throw new Error('Unsupported URL format. Please paste a valid Google Sheets URL or upload a file.');
  }

  const file = fileOrUrl;
  const fileName = file.name.toLowerCase();

  // 1. PDF
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    return await parsePdfStatement(file, currencyCode);
  }

  // 2. Images (PNG, JPG, WebP, HEIC, TIFF, BMP, GIF, AVIF, SVG)
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp|heic|heif|tiff?|gif|avif|svg|ico)$/i.test(fileName);
  if (isImage) {
    return await parseImageDocument(file, currencyCode);
  }

  // 3. CSV
  if (fileName.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    return parseCsvContent(text, file.name, currencyCode);
  }

  // 4. Excel (.xlsx, .xls)
  if (
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')
  ) {
    return await parseExcelFile(file, currencyCode);
  }

  // Fallback to Excel/CSV via SheetJS
  try {
    return await parseExcelFile(file, currencyCode);
  } catch {
    const text = await file.text();
    return parseCsvContent(text, file.name, currencyCode);
  }
}

export async function parseAndInterpretMultipleFiles(
  items: (File | string)[],
  onProgress?: (current: number, total: number, itemName: string) => void,
  currencyCode: string = 'INR'
): Promise<MultiFileInterpretationResult> {
  if (!items || items.length === 0) {
    throw new Error('Please select at least one file or Google Sheet URL to interpret.');
  }

  const allTransactions: Transaction[] = [];
  const fileSummaries: FileProcessingStatus[] = [];
  let successfulFiles = 0;
  let warningFiles = 0;
  let failedFiles = 0;

  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0, Food: 0, Transport: 0, Utilities: 0,
    Entertainment: 0, Savings: 0, Miscellany: 0, Income: 0
  };

  const allDates: string[] = [];
  let highestExpense: { name: string; amount: number; date: string } | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = typeof item === 'string' ? 'Google Sheet' : item.name;
    const itemType =
      typeof item === 'string'
        ? 'Google Sheet'
        : item.type || item.name.split('.').pop()?.toUpperCase() || 'File';

    let detectedSourceType: SupportedSourceType = 'excel';
    if (typeof item === 'string') {
      detectedSourceType = 'sheets';
    } else if (name.endsWith('.pdf')) {
      detectedSourceType = 'pdf';
    } else if (name.endsWith('.csv')) {
      detectedSourceType = 'csv';
    } else if (/\.(png|jpe?g|webp|bmp|heic|heif|tiff?|gif|avif|svg)$/i.test(name)) {
      detectedSourceType = 'image';
    }

    onProgress?.(i + 1, items.length, name);

    try {
      const res = await parseAndInterpretFile(item, currencyCode);
      successfulFiles++;

      fileSummaries.push({
        name,
        type: itemType,
        sourceType: detectedSourceType,
        recordCount: res.recordCount,
        outflowAmount: res.totalAmount,
        inflowAmount: res.totalInflow || 0,
        status: (res.warnings && res.warnings.length > 0) ? 'warning' : 'success',
        warnings: res.warnings
      });

      if (res.warnings && res.warnings.length > 0) {
        warningFiles++;
      }

      allTransactions.push(...res.transactions);

      for (const [cat, amt] of Object.entries(res.categoryBreakdown) as [ExpenseCategory, number][]) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }

      if (res.earliestDate && res.earliestDate !== 'N/A') allDates.push(res.earliestDate);
      if (res.latestDate && res.latestDate !== 'N/A') allDates.push(res.latestDate);

      if (res.highestExpense) {
        if (!highestExpense || res.highestExpense.amount > highestExpense.amount) {
          highestExpense = res.highestExpense;
        }
      }
    } catch (err: any) {
      failedFiles++;
      fileSummaries.push({
        name,
        type: itemType,
        sourceType: detectedSourceType,
        recordCount: 0,
        outflowAmount: 0,
        inflowAmount: 0,
        status: 'error',
        error: err?.message || 'Failed to parse file'
      });
    }
  }

  if (allTransactions.length === 0) {
    const firstError = fileSummaries.find((f) => f.error)?.error;
    throw new Error(firstError || 'No valid transactions could be extracted from the uploaded files.');
  }

  // Deduplicate identical transactions across multi-file batch
  const uniqueTransactions = deduplicateTransactions(allTransactions);

  // Sort descending by date
  uniqueTransactions.sort((a, b) => b.date.localeCompare(a.date));

  // Compute total outflow and total inflow
  let totalExpenseAmount = 0;
  let totalIncomeAmount = 0;
  for (const t of uniqueTransactions) {
    if (t.type === 'income') {
      totalIncomeAmount += t.amount;
    } else {
      totalExpenseAmount += t.amount;
    }
  }

  // Top category
  let topCategory: FileInterpretationResult['topCategory'] = null;
  let maxCatAmount = 0;
  for (const [cat, amt] of Object.entries(categoryTotals) as [ExpenseCategory, number][]) {
    if (amt > maxCatAmount) {
      maxCatAmount = amt;
      topCategory = {
        category: cat,
        amount: Math.round(amt * 100) / 100,
        percentage: totalExpenseAmount > 0 ? Math.round((amt / totalExpenseAmount) * 100) : 0
      };
    }
  }

  allDates.sort();
  const earliestDate = allDates[0] || 'N/A';
  const latestDate = allDates[allDates.length - 1] || 'N/A';

  const insights = buildMultiFileInsights(
    {
      successfulFiles,
      fileCount: items.length,
      recordCount: uniqueTransactions.length,
      totalAmount: totalExpenseAmount,
      totalInflow: totalIncomeAmount,
      topCategory,
      highestExpense,
      earliestDate,
      latestDate,
      transactions: uniqueTransactions
    },
    currencyCode
  );

  return {
    recordCount: uniqueTransactions.length,
    totalAmount: Math.round(totalExpenseAmount * 100) / 100,
    totalInflow: Math.round(totalIncomeAmount * 100) / 100,
    categoryBreakdown: categoryTotals,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    insights,
    transactions: uniqueTransactions,
    fileCount: items.length,
    successfulFiles,
    warningFiles,
    failedFiles,
    fileSummaries
  };
}

// --- 12. Automated Findings & Insights Builders ---

export function buildFileInterpretationInsights(
  result: {
    recordCount: number;
    totalAmount: number;
    totalInflow?: number;
    topCategory: { category: ExpenseCategory; amount: number; percentage: number } | null;
    highestExpense: { name: string; amount: number; date: string } | null;
    earliestDate: string;
    latestDate: string;
    transactions?: Transaction[];
    reconciliation?: StatementReconciliation;
    needsReviewCount?: number;
  },
  currencyCode: string = 'INR'
): string[] {
  const insights: string[] = [];
  const incomeTxCount = result.transactions?.filter((t) => t.type === 'income').length ?? 0;
  const expenseTxCount = result.transactions ? result.transactions.length - incomeTxCount : result.recordCount;

  if (result.transactions && result.transactions.length > 1) {
    insights.push(
      `Extracted ${result.recordCount} record(s) from statement (${expenseTxCount} expense(s), ${incomeTxCount} income / deposit(s)).`
    );
  } else {
    insights.push(`Successfully processed ${result.recordCount} transaction record(s).`);
  }

  if (result.totalAmount > 0) {
    insights.push(`Total expense outflows: ${formatCurrency(result.totalAmount, currencyCode)}.`);
  }
  if ((result.totalInflow || 0) > 0) {
    insights.push(`Total income inflows: ${formatCurrency(result.totalInflow || 0, currencyCode)}.`);
  }
  if (result.topCategory && result.topCategory.amount > 0) {
    insights.push(
      `Largest expense category: ${result.topCategory.category} (${result.topCategory.percentage}% of outflow, ${formatCurrency(result.topCategory.amount, currencyCode)}).`
    );
  }
  if (result.highestExpense && result.highestExpense.amount > 0) {
    insights.push(
      `Largest single outflow: "${result.highestExpense.name}" (${formatCurrency(result.highestExpense.amount, currencyCode)}) on ${result.highestExpense.date}.`
    );
  }
  if (result.earliestDate && result.earliestDate !== 'N/A' && result.latestDate && result.latestDate !== 'N/A') {
    insights.push(`Statement timeframe: ${result.earliestDate} through ${result.latestDate}.`);
  }

  // Reconciliation summary
  if (result.reconciliation?.detected) {
    if (result.reconciliation.reconciled) {
      insights.push(
        `Balance Reconciliation Verified: Opening balance (${formatCurrency(result.reconciliation.openingBalance || 0, currencyCode)}) + Credits (${formatCurrency(result.reconciliation.totalCredits, currencyCode)}) - Debits (${formatCurrency(result.reconciliation.totalDebits, currencyCode)}) matches statement Closing Balance (${formatCurrency(result.reconciliation.closingBalance || 0, currencyCode)}).`
      );
    } else if (result.reconciliation.difference !== undefined && result.reconciliation.difference > 0) {
      insights.push(
        `⚠️ Balance Reconciliation Notice: Calculated balance differs from statement balance by ${formatCurrency(result.reconciliation.difference, currencyCode)}.`
      );
    }
  }

  if (result.needsReviewCount && result.needsReviewCount > 0) {
    insights.push(
      `⚠️ Review Recommended: ${result.needsReviewCount} transaction(s) flagged with potential ambiguities.`
    );
  }

  return insights;
}

export function buildMultiFileInsights(
  result: {
    successfulFiles: number;
    fileCount: number;
    recordCount: number;
    totalAmount: number;
    totalInflow?: number;
    topCategory: { category: ExpenseCategory; amount: number; percentage: number } | null;
    highestExpense: { name: string; amount: number; date: string } | null;
    earliestDate?: string;
    latestDate?: string;
    transactions?: Transaction[];
  },
  currencyCode: string = 'INR'
): string[] {
  const insights: string[] = [
    `Successfully processed ${result.successfulFiles} of ${result.fileCount} file(s), extracting ${result.recordCount} transactions totaling ${formatCurrency(result.totalAmount, currencyCode)} in outflows.`
  ];

  if ((result.totalInflow || 0) > 0) {
    insights.push(`Total income / deposits detected: ${formatCurrency(result.totalInflow || 0, currencyCode)}.`);
  }

  if (result.topCategory && result.topCategory.percentage > 0) {
    insights.push(
      `Top spending category across all files: ${result.topCategory.category} (${result.topCategory.percentage}% of outflow, ${formatCurrency(result.topCategory.amount, currencyCode)}).`
    );
  }

  if (result.highestExpense) {
    insights.push(
      `Single largest outflow: "${result.highestExpense.name}" for ${formatCurrency(result.highestExpense.amount, currencyCode)} on ${result.highestExpense.date}.`
    );
  }

  if (result.earliestDate && result.earliestDate !== 'N/A' && result.latestDate && result.latestDate !== 'N/A') {
    insights.push(`Date range: ${result.earliestDate} to ${result.latestDate}.`);
  }

  return insights;
}
