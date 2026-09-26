import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
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
  | 'currency'
  | 'unknown';

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
  if (/^(date|txndate|transactiondate|postingdate|valuedate|bookingdate|transdate|entrydate|dt)$/i.test(norm)) {
    return 'date';
  }

  // Debit / Withdrawal / Outflow
  if (
    /^(debit|withdrawal|dr|expense|spent|paidout|debitamount|withdrawalamount|charges|payments|outflow|drval)$/i.test(
      norm
    )
  ) {
    return 'debit';
  }

  // Credit / Deposit / Inflow
  if (
    /^(credit|deposit|cr|income|received|creditamount|depositamount|refunds|inflow|crval|deposits)$/i.test(
      norm
    )
  ) {
    return 'credit';
  }

  // Balance (must check before generic Amount)
  if (
    /^(balance|runningbalance|closingbalance|availablebalance|accountbalance|netbalance|bal)$/i.test(
      norm
    )
  ) {
    return 'balance';
  }

  // Category
  if (/^(category|expensecategory|spendingcategory|classification|subcat|subcategory|grp)$/i.test(norm)) {
    return 'category';
  }

  // Type
  if (/^(type|transactiontype|txntype|crdr|mode|paymentmode|typeoftransaction|trxtype)$/i.test(norm)) {
    return 'txType';
  }

  // Currency
  if (/^(currency|curr|ccy)$/i.test(norm)) {
    return 'currency';
  }

  // Amount
  if (
    /^(amount|transactionamount|txnamount|netamount|total|sum|value|totalamount|grossamount|amt)/i.test(
      norm
    ) ||
    norm.includes('amount')
  ) {
    return 'amount';
  }

  // Description / Merchant / Narration
  if (
    /^(description|desc|particulars|narration|details|transactiondetails|merchant|payee|name|remarks|memo|item|note|narrative)$/i.test(
      norm
    )
  ) {
    return 'description';
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

export const STATEMENT_DATE_REGEX =
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/i;

export function normalizeDate(dateStr: string): string {
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

  // 2. Check DD-Mon-YYYY (e.g. 30 Sep 2026, 15-Sep-2026, 01/Sep/2026)
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

  // 4. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    let part1 = parseInt(dmyMatch[1], 10);
    let part2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;

    let d = part1;
    let m = part2;
    if (part2 > 12 && part1 <= 12) {
      m = part1;
      d = part2;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return trimmed.slice(0, 10);
}

export function parseFlexibleDate(val: any): string | null {
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
    return normalizeDate(match[0]);
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

  const isDr = /\bdr\b/i.test(str) || /^\(/.test(str) || str.includes('-');
  const isCr = /\bcr\b/i.test(str) || str.includes('+');

  // Handle European decimal notation: "1.250,50" -> "1250.50" or "1250,50" -> "1250.50"
  const digitsPunct = str.replace(/[^\d.,]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})$/.test(digitsPunct) || /^\d+,\d{1,2}$/.test(digitsPunct)) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  // Extract the primary numeric sequence (preserves full unformatted numbers, decimals, and comma-separated amounts)
  const numMatch = str.match(/\d+(?:,\d+)*(?:\.\d+)?/);
  if (!numMatch) return null;

  const cleanNumStr = numMatch[0].replace(/,/g, '');
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

// --- 4. Footer & Summary Line Filtering ---

export function isFooterOrSummaryLine(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return /(page\s*\d+\s*(of|\/)\s*\d+|computer[- ]generated|confidential|all\s*rights\s*reserved|statement\s*period|opening\s*balance|closing\s*balance|total\s*inflow|total\s*outflow|total\s*income|total\s*expense|account\s*summary|registered\s*office|branch\s*(code|ifsc|micr)|toll[- ]free|customer\s*care|www\.|https?:\/\/|\.com|\.in\b|cin\s*:|gstin\s*:|pan\s*:|generated\s*on)/i.test(
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

// --- 6. Coordinate-Aware PDF Table Parser ---

interface PdfCell {
  text: string;
  x: number;
  y: number;
  width: number;
}

export async function parsePdfStatement(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

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

    // Cluster items into rows by vertical baseline proximity (within 7 points)
    pageCells.sort((a, b) => b.y - a.y);
    const pageRows: PdfCell[][] = [];

    for (const cell of pageCells) {
      const existing = pageRows.find((r) => Math.abs(r[0].y - cell.y) <= 7);
      if (existing) {
        existing.push(cell);
      } else {
        pageRows.push([cell]);
      }
    }

    // Sort rows top-to-bottom
    pageRows.sort((a, b) => b[0].y - a[0].y);

    // Sort cells in each row left-to-right
    for (const r of pageRows) {
      r.sort((a, b) => a.x - b.x);
      const rowText = r.map((c) => c.text).join(' ');
      if (rowText.length > 1) {
        allPageRows.push({
          page: pageNum,
          rowText,
          cells: r,
          y: r[0].y
        });
        fullDocText += '\n' + rowText;
      }
    }
  }

  // Scanned PDF check: if digital text is empty, fall back to canvas OCR
  if (fullDocText.trim().length < 25) {
    const { scanReceiptImage } = await import('./receiptScanner');
    const scanned = await scanReceiptImage(file);
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
        `Processed scanned PDF receipt via optical recognition: "${scanned.merchantName}".`,
        `Extracted amount: ${formatCurrency(scanned.amount, currencyCode)} (${isIncome ? 'Income' : scanned.category}).`
      ],
      transactions: [tx]
    };
  }

  // Detect table header columns by searching the first 25 rows
  let columnZones: DetectedColumnZone[] = [];
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(25, allPageRows.length); i++) {
    const row = allPageRows[i];
    const roles = row.cells.map((c) => ({ cell: c, role: matchHeaderRole(c.text) }));
    const hasDate = roles.some((r) => r.role === 'date');
    const hasAmountOrDebitCredit = roles.some(
      (r) => r.role === 'amount' || r.role === 'debit' || r.role === 'credit'
    );

    if (hasDate && hasAmountOrDebitCredit) {
      headerRowIndex = i;
      const sortedHeaders = roles
        .filter((r) => r.role !== 'unknown')
        .sort((a, b) => a.cell.x - b.cell.x);

      columnZones = sortedHeaders.map((h, idx) => {
        const prev = sortedHeaders[idx - 1];
        const next = sortedHeaders[idx + 1];
        const xStart = prev ? (prev.cell.x + (prev.cell.width || 0) + h.cell.x) / 2 : 0;
        const xEnd = next ? (h.cell.x + (h.cell.width || 0) + next.cell.x) / 2 : 99999;
        return {
          role: h.role,
          name: h.cell.text,
          xStart,
          xEnd,
          centerX: h.cell.x + (h.cell.width || 0) / 2
        };
      });
      break;
    }
  }

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];
  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  for (let i = startRow; i < allPageRows.length; i++) {
    const { rowText, cells } = allPageRows[i];
    if (isFooterOrSummaryLine(rowText)) continue;

    // --- TIER 1: Use detected column zones if available ---
    if (columnZones.length >= 2) {
      // Map cells to column zones
      const colCells: Record<ColumnRole, string[]> = {
        date: [], description: [], category: [], txType: [],
        amount: [], debit: [], credit: [], balance: [],
        currency: [], unknown: []
      };

      for (const cell of cells) {
        const cx = cell.x + (cell.width || 0) / 2;
        const matchedZone = columnZones.find((z) => cx >= z.xStart && cx < z.xEnd);
        if (matchedZone) {
          colCells[matchedZone.role].push(cell.text);
        } else {
          // Closest zone by center distance
          let closest = columnZones[0];
          let minDist = Math.abs(closest.centerX - cx);
          for (const z of columnZones) {
            const dist = Math.abs(z.centerX - cx);
            if (dist < minDist) {
              minDist = dist;
              closest = z;
            }
          }
          colCells[closest.role].push(cell.text);
        }
      }

      const rawDateStr = colCells.date.join(' ').trim();
      const parsedDate = parseFlexibleDate(rawDateStr);

      if (parsedDate) {
        let txAmount = 0;
        let isIncome = false;

        // Check if separate debit and credit columns exist
        const hasDebitCol = columnZones.some((z) => z.role === 'debit');
        const hasCreditCol = columnZones.some((z) => z.role === 'credit');

        let drVal: number | undefined;
        let crVal: number | undefined;
        let amtIsNegative = false;

        if (hasDebitCol || hasCreditCol) {
          const debitStr = colCells.debit.join(' ').trim();
          const creditStr = colCells.credit.join(' ').trim();
          const parsedDebit = parseMonetaryAmount(debitStr);
          const parsedCredit = parseMonetaryAmount(creditStr);

          if (parsedCredit && parsedCredit.amount > 0) {
            txAmount = parsedCredit.amount;
            crVal = parsedCredit.amount;
          } else if (parsedDebit && parsedDebit.amount > 0) {
            txAmount = parsedDebit.amount;
            drVal = parsedDebit.amount;
          }
        }

        // Single amount column with Type column or sign
        if (txAmount === 0 && colCells.amount.length > 0) {
          const amtStr = colCells.amount.join(' ').trim();
          const parsed = parseMonetaryAmount(amtStr);
          if (parsed && parsed.amount > 0) {
            txAmount = parsed.amount;
            amtIsNegative = parsed.isNegative;
          }
        }

        if (txAmount > 0) {
          let desc = colCells.description.join(' ').trim();
          if (!desc) {
            desc = colCells.category.join(' ').trim() || `Transaction #${transactions.length + 1}`;
          }

          const typeStr = colCells.txType.join(' ').trim();
          const rawCat = colCells.category.join(' ').trim();

          const txType = determineTransactionType({
            explicitType: typeStr,
            sourceCategory: rawCat,
            hasCreditCol: hasCreditCol,
            creditVal: crVal,
            hasDebitCol: hasDebitCol,
            debitVal: drVal,
            amountIsNegative: amtIsNegative,
            description: desc
          });

          const category = normalizeCategory(rawCat, desc, txType);

          const tx: Transaction = {
            id: `pdf-${Date.now()}-${transactions.length}`,
            date: parsedDate,
            name: desc,
            category,
            type: txType,
            amount: txAmount,
            source: 'imported',
            sourceFile: file.name,
            sourceType: 'pdf'
          };

          const validation = validateTransaction(tx, rowText);
          if (validation.isValid) {
            transactions.push(tx);
            datesFound.push(parsedDate);
            continue;
          }
        }
      }
    }

    // --- TIER 2: Fallback Token-Stream Parsing ---
    const dateMatch = rowText.match(STATEMENT_DATE_REGEX);
    if (!dateMatch) {
      // Continuation line for previous transaction description
      if (transactions.length > 0 && rowText.length > 3 && !isFooterOrSummaryLine(rowText)) {
        const lastTx = transactions[transactions.length - 1];
        if (lastTx.name.length < 80) {
          lastTx.name = `${lastTx.name} ${rowText.trim()}`.replace(/\s+/g, ' ');
        }
      }
      continue;
    }

    const rawDateStr = dateMatch[0];
    const stdDate = normalizeDate(rawDateStr);
    const dayOfMonth = parseInt(stdDate.slice(8, 10), 10);

    // Strip entire matched date string to prevent day from becoming amount
    const textWithoutDate = rowText.replace(rawDateStr, ' ').trim();
    const candidateAmounts = extractAmountsFromText(textWithoutDate);
    if (candidateAmounts.length === 0) continue;

    // Filter out candidates that equal the day of month if another candidate exists
    let validCandidates = candidateAmounts;
    if (candidateAmounts.length > 1) {
      const nonDayCandidates = candidateAmounts.filter((c) => Math.abs(c.value) !== dayOfMonth);
      if (nonDayCandidates.length > 0) {
        validCandidates = nonDayCandidates;
      }
    }

    // Prioritize candidates with currency symbols
    const symbolCandidate = validCandidates.find((c) => /(?:₹|Rs\.?|INR|\$|€|£)/i.test(c.raw));
    const chosenCandidate = symbolCandidate || validCandidates[validCandidates.length - 1];
    const txAmount = Math.abs(chosenCandidate.value);

    if (txAmount <= 0) continue;

    // Check Type
    const isIncome = classifyTransactionType(textWithoutDate) === 'income';

    // Build clean description
    let cleanDesc = textWithoutDate.replace(chosenCandidate.raw, ' ');
    for (const ca of candidateAmounts) {
      cleanDesc = cleanDesc.replace(ca.raw, ' ');
    }
    // Remove standalone Type keywords from description
    cleanDesc = cleanDesc.replace(/\b(income|expense|credit|debit|cr|dr|deposit|withdrawal)\b/gi, ' ');
    cleanDesc = cleanDesc.replace(/[#*$\t\r]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanDesc) cleanDesc = `Transaction #${transactions.length + 1}`;

    const category = autoCategorizeExpense(cleanDesc);

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

    transactions.push(tx);
    datesFound.push(stdDate);
  }

  // --- TIER 3: Single Receipt / Invoice Document Parser ---
  if (transactions.length === 0) {
    let docDate = new Date().toISOString().split('T')[0];
    const firstDate = fullDocText.match(STATEMENT_DATE_REGEX);
    if (firstDate) docDate = normalizeDate(firstDate[0]);

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

  return aggregateInterpretationResult(transactions, datesFound, file.name, currencyCode);
}

// --- 7. Excel (.xlsx, .xls) Extractor ---

export async function parseExcelFile(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The Excel workbook contains no readable sheets.');
  }

  const allTransactions: Transaction[] = [];
  const datesFound: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    // Ignore metadata or readme sheets
    if (/^(readme|instructions|notes|summary|help|overview)$/i.test(sheetName.trim())) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) continue;

    // Find header row semantically
    let headerRowIdx = -1;
    let colDate = -1;
    let colDesc = -1;
    let colCat = -1;
    let colType = -1;
    let colAmount = -1;
    let colDebit = -1;
    let colCredit = -1;

    for (let i = 0; i < Math.min(25, rawRows.length); i++) {
      const row = rawRows[i].map((c) => String(c || '').trim());
      const roles = row.map((cell) => matchHeaderRole(cell));

      const dIdx = roles.indexOf('date');
      const amtIdx = roles.indexOf('amount');
      const drIdx = roles.indexOf('debit');
      const crIdx = roles.indexOf('credit');

      if (dIdx !== -1 && (amtIdx !== -1 || drIdx !== -1 || crIdx !== -1)) {
        headerRowIdx = i;
        colDate = dIdx;
        colDesc = roles.indexOf('description');
        colCat = roles.indexOf('category');
        colType = roles.indexOf('txType');
        colAmount = amtIdx;
        colDebit = drIdx;
        colCredit = crIdx;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const dateVal = parseFlexibleDate(row[colDate]);
      if (!dateVal) continue;

      let txAmount = 0;
      let drVal: number | undefined;
      let crVal: number | undefined;
      let amtIsNegative = false;

      // Check separate Debit / Credit columns
      if (colDebit !== -1 || colCredit !== -1) {
        const drParsed = colDebit !== -1 ? parseMonetaryAmount(row[colDebit]) : null;
        const crParsed = colCredit !== -1 ? parseMonetaryAmount(row[colCredit]) : null;

        if (crParsed && crParsed.amount > 0) {
          txAmount = crParsed.amount;
          crVal = crParsed.amount;
        } else if (drParsed && drParsed.amount > 0) {
          txAmount = drParsed.amount;
          drVal = drParsed.amount;
        }
      }

      // Single Amount column
      if (txAmount === 0 && colAmount !== -1) {
        const amtParsed = parseMonetaryAmount(row[colAmount]);
        if (amtParsed && amtParsed.amount > 0) {
          txAmount = amtParsed.amount;
          amtIsNegative = amtParsed.isNegative;
        }
      }

      if (txAmount <= 0) continue;

      let desc = colDesc !== -1 ? String(row[colDesc] || '').trim() : '';
      if (!desc) desc = `Transaction #${allTransactions.length + 1}`;

      const rawType = colType !== -1 ? String(row[colType] || '').trim() : undefined;
      const rawCat = colCat !== -1 ? String(row[colCat] || '').trim() : undefined;

      const txType = determineTransactionType({
        explicitType: rawType,
        sourceCategory: rawCat,
        hasCreditCol: colCredit !== -1,
        creditVal: crVal,
        hasDebitCol: colDebit !== -1,
        debitVal: drVal,
        amountIsNegative: amtIsNegative,
        description: desc
      });

      const category = normalizeCategory(rawCat, desc, txType);

      const tx: Transaction = {
        id: `xls-${Date.now()}-${allTransactions.length}`,
        date: dateVal,
        name: desc,
        category,
        type: txType,
        amount: txAmount,
        source: 'imported',
        sourceFile: file.name,
        sourceType: 'excel'
      };

      if (validateTransaction(tx).isValid) {
        allTransactions.push(tx);
        datesFound.push(dateVal);
      }
    }
  }

  if (allTransactions.length === 0) {
    throw new Error('No valid financial transactions could be extracted from this Excel file.');
  }

  return aggregateInterpretationResult(allTransactions, datesFound, file.name, currencyCode);
}

// --- 8. CSV Extractor ---

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

  // Find header row semantically
  let headerRowIdx = -1;
  let colDate = -1;
  let colDesc = -1;
  let colCat = -1;
  let colType = -1;
  let colAmount = -1;
  let colDebit = -1;
  let colCredit = -1;

  for (let i = 0; i < Math.min(25, rawRows.length); i++) {
    const row = rawRows[i];
    const roles = row.map((cell) => matchHeaderRole(cell));

    const dIdx = roles.indexOf('date');
    const amtIdx = roles.indexOf('amount');
    const drIdx = roles.indexOf('debit');
    const crIdx = roles.indexOf('credit');

    if (dIdx !== -1 && (amtIdx !== -1 || drIdx !== -1 || crIdx !== -1)) {
      headerRowIdx = i;
      colDate = dIdx;
      colDesc = roles.indexOf('description');
      colCat = roles.indexOf('category');
      colType = roles.indexOf('txType');
      colAmount = amtIdx;
      colDebit = drIdx;
      colCredit = crIdx;
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    colDate = 0;
    colDesc = 1;
    colAmount = 2;
  }

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const dateVal = parseFlexibleDate(row[colDate]);
    if (!dateVal) continue;

    let txAmount = 0;
    let drVal: number | undefined;
    let crVal: number | undefined;
    let amtIsNegative = false;

    if (colDebit !== -1 || colCredit !== -1) {
      const drParsed = colDebit !== -1 ? parseMonetaryAmount(row[colDebit]) : null;
      const crParsed = colCredit !== -1 ? parseMonetaryAmount(row[colCredit]) : null;

      if (crParsed && crParsed.amount > 0) {
        txAmount = crParsed.amount;
        crVal = crParsed.amount;
      } else if (drParsed && drParsed.amount > 0) {
        txAmount = drParsed.amount;
        drVal = drParsed.amount;
      }
    }

    if (txAmount === 0 && colAmount !== -1) {
      const amtParsed = parseMonetaryAmount(row[colAmount]);
      if (amtParsed && amtParsed.amount > 0) {
        txAmount = amtParsed.amount;
        amtIsNegative = amtParsed.isNegative;
      }
    }

    if (txAmount <= 0) continue;

    let desc = colDesc !== -1 ? String(row[colDesc] || '').trim() : '';
    if (!desc) desc = `Transaction #${transactions.length + 1}`;

    const rawType = colType !== -1 ? String(row[colType] || '').trim() : undefined;
    const rawCat = colCat !== -1 ? String(row[colCat] || '').trim() : undefined;

    const txType = determineTransactionType({
      explicitType: rawType,
      sourceCategory: rawCat,
      hasCreditCol: colCredit !== -1,
      creditVal: crVal,
      hasDebitCol: colDebit !== -1,
      debitVal: drVal,
      amountIsNegative: amtIsNegative,
      description: desc
    });

    const category = normalizeCategory(rawCat, desc, txType);

    const tx: Transaction = {
      id: `csv-${Date.now()}-${transactions.length}`,
      date: dateVal,
      name: desc,
      category,
      type: txType,
      amount: txAmount,
      source: 'imported',
      sourceFile: fileName,
      sourceType: 'csv'
    };

    if (validateTransaction(tx).isValid) {
      transactions.push(tx);
      datesFound.push(dateVal);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid financial transactions could be extracted from this CSV file.');
  }

  return aggregateInterpretationResult(transactions, datesFound, fileName, currencyCode);
}

// --- 9. Google Sheets Import Fallback & Extractor ---

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
    // Check if redirected to Google sign-in page
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

// --- 10. Image & Receipt OCR Document Understanding ---

export async function parseImageDocument(
  file: File,
  currencyCode: string = 'INR'
): Promise<FileInterpretationResult> {
  const { scanReceiptImage } = await import('./receiptScanner');
  const scanned = await scanReceiptImage(file);

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
  currencyCode: string
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
      transactions
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
    transactions
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
