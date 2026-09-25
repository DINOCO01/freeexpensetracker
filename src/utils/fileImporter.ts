import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { formatCurrency, type ExpenseCategory, type Transaction } from './calculations';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
  }
}

export interface FileInterpretationResult {
  recordCount: number;
  totalAmount: number; // Total outflow (expenses)
  totalInflow?: number; // Total inflow (deposits/income)
  categoryBreakdown: Record<ExpenseCategory, number>;
  topCategory: { category: ExpenseCategory; amount: number; percentage: number } | null;
  highestExpense: { name: string; amount: number; date: string } | null;
  earliestDate: string;
  latestDate: string;
  insights: string[];
  transactions: Transaction[];
}

const CATEGORY_KEYWORDS: Record<ExpenseCategory, RegExp> = {
  Housing: /(rent|mortgage|lease|hoa|property\s*tax|realty|landlord|apartment|maintenance)/i,
  Food: /(grocery|groceries|supermarket|walmart|kroger|trader\s*joe|whole\s*foods|safeway|costco|aldi|restaurant|cafe|coffee|starbucks|uber\s*eats|doordash|grubhub|mcdonald|chipotle|burger|pizza|diner|food)/i,
  Transport: /(uber|lyft|taxi|transit|subway|metro|bus|train|amtrak|gas|fuel|chevron|shell|exxon|mobil|bp|parking|toll|tollway|auto|car\s*wash|mechanic|oil\s*change)/i,
  Utilities: /(electric|electricity|power|gas\s*bill|water|sewer|trash|internet|wifi|cable|comcast|verizon|at&t|t-mobile|phone\s*bill|utility)/i,
  Entertainment: /(netflix|spotify|hulu|disney|apple|prime|cinema|theatre|theater|concert|ticket|game|steam|playstation|xbox|nintendo|pub|bar|nightclub|hobby|gym|fitness)/i,
  Savings: /(savings|deposit|transfer|investment|vanguard|fidelity|schwab|robinhood|crypto|401k|ira|emergency\s*fund)/i,
  Miscellany: /(amazon|target|shopping|clothing|zara|h&m|pharmacy|cvs|walgreens|doctor|dental|vet|pet|subscription|fee)/i
};

export function autoCategorizeExpense(description: string): ExpenseCategory {
  if (!description) return 'Miscellany';
  const desc = description.toLowerCase();

  for (const [cat, regex] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, RegExp][]) {
    if (regex.test(desc)) {
      return cat;
    }
  }

  return 'Miscellany';
}

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
    insights.push(
      `Successfully processed ${result.recordCount} transaction record(s).`
    );
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

export const STATEMENT_DATE_REGEX = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/.\s]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?)\b/i;

export function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();

  // 1. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Check DD-Mon-YYYY (e.g. 15-Sep-2026, 01 Sep 2026, 15/Sep/2026)
  const dMonYMatch = trimmed.match(/^(\d{1,2})[-/.\s]([a-zA-Z]{3,9})[-/.\s](\d{2,4})$/i);
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

  // 3. Check Mon DD, YYYY (e.g. Sep 15, 2026, September 15 2026)
  const monDYMatch = trimmed.match(/^([a-zA-Z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/i);
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
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
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

export const AMOUNT_REGEX_GLOBAL = /(?:(?:₹|Rs\.?|INR|\$|€|£|CA\$|AU\$)\s*)?(?:-|\()?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{2,}(?:\.\d{1,2})?|\d+\.\d{1,2})(?:\))?\s*(?:cr|dr)?\b/gi;

export function extractAmountsFromText(text: string, dateStr?: string): { raw: string; value: number; index: number }[] {
  let cleanText = text;
  if (dateStr) {
    cleanText = cleanText.replace(dateStr, ' ');
  }

  const results: { raw: string; value: number; index: number }[] = [];
  const regex = new RegExp(AMOUNT_REGEX_GLOBAL.source, 'gi');
  let match;
  while ((match = regex.exec(cleanText)) !== null) {
    const raw = match[0].trim();
    const numPart = match[1].replace(/,/g, '');
    const val = parseFloat(numPart);
    if (isNaN(val) || val <= 0) continue;
    if (val > 10000000 && !/\.\d{2}/.test(raw)) continue;

    const isDr = /dr\b/i.test(raw) || /^\(/.test(raw) || raw.includes('-');
    results.push({
      raw,
      value: isDr ? -val : val,
      index: match.index
    });
  }
  return results;
}

export function classifyTransactionType(text: string): 'expense' | 'income' {
  const isIncome = /\b(salary|payroll|paycheck|direct\s*deposit|deposit|dividend|interest|refund|cashback|bonus|stipend|freelance|client\s*payment|payment\s*received|received\s*from|credit\s*memo|net\s*pay|inflow|cr\b|credit)\b/i.test(text);
  const isExpense = /\b(debit|withdrawal|dr\b|payment|pos|atm|purchase|fee|charge|outflow|spent)\b/i.test(text);

  if (isIncome && !isExpense) return 'income';
  if (isExpense && !isIncome) return 'expense';
  if (/\b(salary|payroll|paycheck|dividend|refund|cashback|bonus)\b/i.test(text)) return 'income';
  if (/\b(cr\b|credit\b)/i.test(text) && !/\b(credit\s*card)\b/i.test(text)) return 'income';
  return 'expense';
}

/**
 * Robust Multi-Tier Statement & Receipt PDF Parser:
 * Tier 1: Coordinate-aware Row & Column Table Parser
 * Tier 2: Date-Delimited Segment Fallback (handles imperfect table layout)
 * Tier 3: Single Receipt / Invoice Parser
 * Tier 4: Scanned Image PDF OCR fallback
 */
async function parsePdfStatement(file: File, currencyCode: string = 'INR'): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

  interface PdfCell {
    text: string;
    x: number;
    y: number;
    width: number;
  }

  const allPageRows: { page: number; rowText: string; cells: PdfCell[]; y: number }[] = [];
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

    // Cluster items into rows by vertical proximity (within 7 points)
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
      type: scanned.type || 'expense'
    };

    const categoryTotals: Record<ExpenseCategory, number> = {
      Housing: 0, Food: 0, Transport: 0, Utilities: 0,
      Entertainment: 0, Savings: 0, Miscellany: 0
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

  const transactions: Transaction[] = [];
  const datesFound: string[] = [];
  const ignorePatterns = /(balance\s*forward|account\s*summary|statement\s*period|page\s*\d+\s*of|minimum\s*payment|payment\s*due|interest\s*charge|annual\s*percentage|total\s*fees|credit\s*limit)/i;

  // Detect column header X coordinates if table headers are present
  let creditColX: number | null = null;
  let debitColX: number | null = null;
  let balanceColX: number | null = null;

  for (const { cells } of allPageRows.slice(0, 20)) {
    for (const cell of cells) {
      const lower = cell.text.toLowerCase();
      if (/(credit|deposit|inflow|income)/i.test(lower) && !/(card|limit)/i.test(lower)) {
        creditColX = cell.x;
      }
      if (/(debit|withdrawal|outflow|expense)/i.test(lower)) {
        debitColX = cell.x;
      }
      if (/balance/i.test(lower)) {
        balanceColX = cell.x;
      }
    }
    if (debitColX !== null || creditColX !== null) break;
  }

  // --- TIER 1: Row-by-Row Table Parsing ---
  for (const { rowText, cells } of allPageRows) {
    if (ignorePatterns.test(rowText)) continue;

    const dateMatch = rowText.match(STATEMENT_DATE_REGEX);
    if (!dateMatch) {
      // Continuation line for previous transaction description
      if (transactions.length > 0 && rowText.length > 3 && !/page\s*\d+/i.test(rowText)) {
        const lastTx = transactions[transactions.length - 1];
        if (lastTx.name.length < 90) {
          lastTx.name = `${lastTx.name} ${rowText.trim()}`.replace(/\s+/g, ' ');
        }
      }
      continue;
    }

    const rawDateStr = dateMatch[0];
    const stdDate = normalizeDate(rawDateStr);
    const dateYear = parseInt(stdDate.slice(0, 4), 10) || undefined;

    // Find all amounts in this row
    const foundAmounts = extractAmountsFromText(rowText, dateYear);
    if (foundAmounts.length === 0) continue;

    let txAmount = 0;
    let isIncome = false;

    if (foundAmounts.length === 1) {
      txAmount = Math.abs(foundAmounts[0].value);
      isIncome = foundAmounts[0].value > 0 && classifyTransactionType(rowText) === 'income';
    } else {
      // Multiple amounts on the row (e.g. [Debit, Credit, Balance] or [Amount, Balance])
      if (creditColX !== null || debitColX !== null) {
        for (const fa of foundAmounts) {
          const matchingCell = cells.find((c) => c.text.includes(fa.raw.replace(/[^0-9.]/g, '')));
          const cellX = matchingCell ? matchingCell.x : 0;

          if (balanceColX !== null && Math.abs(cellX - balanceColX) < 40) {
            continue;
          }
          if (creditColX !== null && Math.abs(cellX - creditColX) < 50) {
            txAmount = Math.abs(fa.value);
            isIncome = true;
            break;
          }
          if (debitColX !== null && Math.abs(cellX - debitColX) < 50) {
            txAmount = Math.abs(fa.value);
            isIncome = false;
            break;
          }
        }
      }

      if (txAmount === 0) {
        // The last amount is running balance; the first amount is the transaction amount
        const candidate = foundAmounts[0];
        txAmount = Math.abs(candidate.value);
        isIncome = candidate.value > 0 && classifyTransactionType(rowText) === 'income';
      }
    }

    if (txAmount <= 0) continue;

    // Clean description: remove date, amounts, and extra symbols
    let desc = rowText.replace(rawDateStr, '');
    for (const fa of foundAmounts) {
      desc = desc.replace(fa.raw, '');
    }
    desc = desc.replace(/[#*$\t\r]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!desc || desc.length < 2) {
      desc = isIncome ? 'Income / Deposit' : `Transaction #${transactions.length + 1}`;
    }

    const txType: 'expense' | 'income' = isIncome ? 'income' : 'expense';
    const category: ExpenseCategory = isIncome ? 'Savings' : autoCategorizeExpense(desc);

    transactions.push({
      id: `pdf-${Date.now()}-${transactions.length}`,
      name: desc,
      amount: Math.round(txAmount * 100) / 100,
      category,
      date: stdDate,
      source: 'imported',
      type: txType
    });
    datesFound.push(stdDate);
  }

  // --- TIER 2: Date-Delimited Segment Fallback (if Tier 1 extracted fewer than 2 transactions) ---
  if (transactions.length < 2) {
    const dateMatches: { text: string; index: number }[] = [];
    const dateRegexGlobal = new RegExp(STATEMENT_DATE_REGEX.source, 'gi');
    let m;
    while ((m = dateRegexGlobal.exec(fullDocText)) !== null) {
      dateMatches.push({ text: m[0], index: m.index });
    }

    if (dateMatches.length >= 2) {
      transactions.length = 0;
      datesFound.length = 0;

      for (let i = 0; i < dateMatches.length; i++) {
        const curDate = dateMatches[i];
        const nextIndex = i + 1 < dateMatches.length ? dateMatches[i + 1].index : fullDocText.length;
        const segment = fullDocText.slice(curDate.index, nextIndex).trim();

        const stdDate = normalizeDate(curDate.text);
        const dateYear = parseInt(stdDate.slice(0, 4), 10) || undefined;
        const segAmounts = extractAmountsFromText(segment, dateYear);

        if (segAmounts.length === 0) continue;

        const chosenAmt = segAmounts[0];
        const txAmount = Math.abs(chosenAmt.value);
        if (txAmount <= 0) continue;

        const isIncome = chosenAmt.value > 0 && classifyTransactionType(segment) === 'income';

        let desc = segment.replace(curDate.text, '');
        for (const fa of segAmounts) {
          desc = desc.replace(fa.raw, '');
        }
        desc = desc.split('\n')[0].replace(/[#*$\t\r]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!desc || desc.length < 2) {
          desc = isIncome ? 'Income / Deposit' : `Transaction #${transactions.length + 1}`;
        }

        const txType: 'expense' | 'income' = isIncome ? 'income' : 'expense';
        const category: ExpenseCategory = isIncome ? 'Savings' : autoCategorizeExpense(desc);

        transactions.push({
          id: `pdf-seg-${Date.now()}-${transactions.length}`,
          name: desc,
          amount: Math.round(txAmount * 100) / 100,
          category,
          date: stdDate,
          source: 'imported',
          type: txType
        });
        datesFound.push(stdDate);
      }
    }
  }

  // --- TIER 3: Single Receipt / Invoice / Document Parser (if still 0 transactions) ---
  if (transactions.length === 0) {
    const dateMatch = fullDocText.match(STATEMENT_DATE_REGEX);
    const docDate = dateMatch ? normalizeDate(dateMatch[0]) : new Date().toISOString().split('T')[0];
    const isIncome = classifyTransactionType(fullDocText) === 'income';
    const txType: 'expense' | 'income' = isIncome ? 'income' : 'expense';

    let docName = '';
    for (const { rowText } of allPageRows.slice(0, 6)) {
      const clean = rowText.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3 && !/^(statement|account|page|invoice|receipt|date|total)/i.test(clean)) {
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
      const totalMatch = fullDocText.match(/(?:total|amount\s*due|net\s*pay|grand\s*total|balance\s*due|deposit)\s*[:$]?\s*([$€£₹¥]?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
      if (totalMatch) {
        const parsed = extractAmountsFromText(totalMatch[0]);
        if (parsed.length > 0) docAmount = Math.abs(parsed[0].value);
      }
      if (docAmount <= 0) {
        docAmount = Math.max(...allDocAmounts.map((a) => Math.abs(a.value)));
      }
    }

    if (docAmount > 0) {
      const category: ExpenseCategory = isIncome ? 'Savings' : autoCategorizeExpense(`${docName} ${fullDocText}`);
      transactions.push({
        id: `pdf-doc-${Date.now()}`,
        name: docName,
        amount: Math.round(docAmount * 100) / 100,
        category,
        date: docDate,
        source: 'imported',
        type: txType
      });
      datesFound.push(docDate);
    } else {
      const { scanReceiptImage } = await import('./receiptScanner');
      const scanned = await scanReceiptImage(file);
      transactions.push({
        id: `pdf-ocr-${Date.now()}`,
        name: scanned.merchantName,
        amount: scanned.amount,
        category: scanned.category,
        date: scanned.date,
        source: 'imported',
        type: scanned.type || 'expense'
      });
      datesFound.push(scanned.date);
    }
  }

  datesFound.sort();
  const earliestDate = datesFound[0] || 'N/A';
  const latestDate = datesFound[datesFound.length - 1] || 'N/A';

  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0, Food: 0, Transport: 0, Utilities: 0,
    Entertainment: 0, Savings: 0, Miscellany: 0
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

  const incomeTxCount = transactions.filter((t) => t.type === 'income').length;
  const expenseTxCount = transactions.filter((t) => t.type !== 'income').length;

  const insights = buildFileInterpretationInsights({
    recordCount: transactions.length,
    totalAmount: totalExpenseAmount,
    totalInflow: totalIncomeAmount,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    transactions
  }, currencyCode);

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

/**
 * Universal Parser supporting Excel (.xlsx, .xls), CSV, PDF statements, and Receipt photos.
 */
export async function parseAndInterpretFile(file: File, currencyCode: string = 'INR'): Promise<FileInterpretationResult> {
  const fileName = file.name.toLowerCase();

  // If Photo / Image receipt (any image format: PNG, JPG, WebP, HEIC, HEIF, BMP, TIFF, GIF, AVIF, SVG, etc.)
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|heic|heif|tiff?|gif|avif|svg|ico)$/i.test(fileName);
  if (isImage) {
    const { scanReceiptImage } = await import('./receiptScanner');
    const receipt = await scanReceiptImage(file);

    const tx: Transaction = {
      id: `rcpt-${Date.now()}`,
      name: receipt.merchantName,
      amount: receipt.amount,
      category: receipt.category,
      date: receipt.date,
      source: 'imported',
      type: receipt.type || 'expense'
    };

    const categoryTotals: Record<ExpenseCategory, number> = {
      Housing: 0,
      Food: 0,
      Transport: 0,
      Utilities: 0,
      Entertainment: 0,
      Savings: 0,
      Miscellany: 0
    };
    categoryTotals[receipt.category] = receipt.amount;

    const isIncome = receipt.type === 'income';
    return {
      recordCount: 1,
      totalAmount: isIncome ? 0 : receipt.amount,
      totalInflow: isIncome ? receipt.amount : 0,
      categoryBreakdown: categoryTotals,
      topCategory: { category: receipt.category, amount: receipt.amount, percentage: 100 },
      highestExpense: { name: receipt.merchantName, amount: receipt.amount, date: receipt.date },
      earliestDate: receipt.date,
      latestDate: receipt.date,
      insights: [
        `Recognized receipt/document from "${receipt.merchantName}".`,
        `Extracted amount: ${formatCurrency(receipt.amount, currencyCode)} (${isIncome ? 'Income' : receipt.category}).`,
        receipt.confidence > 0 ? `Scan confidence: ${receipt.confidence}%.` : 'Image text processed.'
      ],
      transactions: [tx]
    };
  }

  // If PDF statement
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    return await parsePdfStatement(file, currencyCode);
  }

  // Otherwise, handle Excel / CSV via SheetJS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no readable worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('The file does not contain sufficient data rows. Please ensure it has a header row and transaction records.');
  }

  let headerRowIndex = -1;
  let colIndexDate = -1;
  let colIndexName = -1;
  let colIndexAmount = -1;

  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map((cell: any) => String(cell || '').trim().toLowerCase());
    const dateIdx = row.findIndex((c: string) => /date|time|timestamp|transaction\s*date/i.test(c));
    const nameIdx = row.findIndex((c: string) => /desc|description|merchant|payee|name|memo|details|item/i.test(c));
    const amtIdx = row.findIndex((c: string) => /amount|debit|cost|price|total|value|spent/i.test(c));

    if (dateIdx !== -1 && amtIdx !== -1) {
      headerRowIndex = i;
      colIndexDate = dateIdx;
      colIndexAmount = amtIdx;
      colIndexName = nameIdx !== -1 ? nameIdx : (dateIdx === 0 ? 1 : 0);
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colIndexDate = 0;
    colIndexName = 1;
    colIndexAmount = 2;
  }

  const transactions: Transaction[] = [];
  let totalAmount = 0;
  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0,
    Food: 0,
    Transport: 0,
    Utilities: 0,
    Entertainment: 0,
    Savings: 0,
    Miscellany: 0
  };

  let highestExpense: { name: string; amount: number; date: string } | null = null;
  const datesFound: string[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    let rawAmount = row[colIndexAmount];
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') continue;

    let cleanAmount = 0;
    if (typeof rawAmount === 'number') {
      cleanAmount = Math.abs(rawAmount);
    } else {
      const cleanedStr = String(rawAmount).replace(/[^0-9.-]+/g, '');
      const parsed = parseFloat(cleanedStr);
      if (!isNaN(parsed)) {
        cleanAmount = Math.abs(parsed);
      }
    }

    if (cleanAmount <= 0) continue;

    let rawName = String(row[colIndexName] || '').trim();
    if (!rawName) rawName = `Expense #${transactions.length + 1}`;

    let dateStr = new Date().toISOString().split('T')[0];
    const rawDate = row[colIndexDate];
    if (rawDate instanceof Date) {
      dateStr = rawDate.toISOString().split('T')[0];
    } else if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        dateStr = parsedDate.toISOString().split('T')[0];
      } else {
        dateStr = String(rawDate).trim().slice(0, 10);
      }
    }

    datesFound.push(dateStr);

    const isIncome = /\b(salary|payroll|paycheck|direct\s*deposit|deposit|dividend|interest\s*credit|interest\s*earned|refund|cashback|bonus|stipend|freelance|client\s*payment|payment\s*received|received\s*from|credit\s*memo|net\s*pay)\b/i.test(rawName);
    const txType: 'expense' | 'income' = isIncome ? 'income' : 'expense';
    const category = isIncome ? 'Savings' : autoCategorizeExpense(rawName);

    transactions.push({
      id: `imp-${Date.now()}-${transactions.length}`,
      name: rawName,
      amount: Math.round(cleanAmount * 100) / 100,
      category,
      date: dateStr,
      source: 'imported',
      type: txType
    });

    totalAmount += cleanAmount;
    categoryTotals[category] += cleanAmount;

    if (!highestExpense || cleanAmount > highestExpense.amount) {
      highestExpense = {
        name: rawName,
        amount: Math.round(cleanAmount * 100) / 100,
        date: dateStr
      };
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions could be extracted. Please check that amount cells contain numeric values.');
  }

  datesFound.sort();
  const earliestDate = datesFound[0] || 'N/A';
  const latestDate = datesFound[datesFound.length - 1] || 'N/A';

  let topCategory: FileInterpretationResult['topCategory'] = null;
  let maxCatAmount = 0;
  for (const [cat, amt] of Object.entries(categoryTotals) as [ExpenseCategory, number][]) {
    if (amt > maxCatAmount) {
      maxCatAmount = amt;
      topCategory = {
        category: cat,
        amount: Math.round(amt * 100) / 100,
        percentage: totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0
      };
    }
  }

  let totalExpenseAmount = 0;
  let totalIncomeAmount = 0;
  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncomeAmount += t.amount;
    } else {
      totalExpenseAmount += t.amount;
    }
  }

  const insights = buildFileInterpretationInsights({
    recordCount: transactions.length,
    totalAmount: totalExpenseAmount,
    totalInflow: totalIncomeAmount,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    transactions
  }, currencyCode);

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

export interface MultiFileInterpretationResult extends FileInterpretationResult {
  fileCount: number;
  successfulFiles: number;
  fileSummaries: {
    name: string;
    type: string;
    recordCount: number;
    amount: number;
    status: 'success' | 'error';
    error?: string;
  }[];
}

/**
 * Batch processes multiple files (receipt images, PDF statements, Excel, CSV)
 * and aggregates their results into a unified interpretation.
 */
export async function parseAndInterpretMultipleFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void,
  currencyCode: string = 'INR'
): Promise<MultiFileInterpretationResult> {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one file to interpret.');
  }

  const allTransactions: Transaction[] = [];
  const fileSummaries: MultiFileInterpretationResult['fileSummaries'] = [];
  let successfulFiles = 0;

  const categoryTotals: Record<ExpenseCategory, number> = {
    Housing: 0,
    Food: 0,
    Transport: 0,
    Utilities: 0,
    Entertainment: 0,
    Savings: 0,
    Miscellany: 0
  };

  const allDates: string[] = [];
  let highestExpense: { name: string; amount: number; date: string } | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length, file.name);

    try {
      const res = await parseAndInterpretFile(file, currencyCode);
      successfulFiles++;
      fileSummaries.push({
        name: file.name,
        type: file.type || file.name.split('.').pop()?.toUpperCase() || 'File',
        recordCount: res.recordCount,
        amount: res.totalAmount,
        status: 'success'
      });

      // Merge transactions
      allTransactions.push(...res.transactions);

      // Merge category totals
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
      fileSummaries.push({
        name: file.name,
        type: file.type || file.name.split('.').pop()?.toUpperCase() || 'File',
        recordCount: 0,
        amount: 0,
        status: 'error',
        error: err?.message || 'Failed to parse file'
      });
    }
  }

  if (allTransactions.length === 0) {
    const firstError = fileSummaries.find((f) => f.error)?.error;
    throw new Error(firstError || 'No transactions could be extracted from the uploaded files.');
  }

  // Sort transactions by date descending
  allTransactions.sort((a, b) => b.date.localeCompare(a.date));

  // Compute total outflow and total inflow
  let totalExpenseAmount = 0;
  let totalIncomeAmount = 0;
  for (const t of allTransactions) {
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

  const insights = buildMultiFileInsights({
    successfulFiles,
    fileCount: files.length,
    recordCount: allTransactions.length,
    totalAmount: totalExpenseAmount,
    totalInflow: totalIncomeAmount,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    transactions: allTransactions
  }, currencyCode);

  return {
    recordCount: allTransactions.length,
    totalAmount: Math.round(totalExpenseAmount * 100) / 100,
    totalInflow: Math.round(totalIncomeAmount * 100) / 100,
    categoryBreakdown: categoryTotals,
    topCategory,
    highestExpense,
    earliestDate,
    latestDate,
    insights,
    transactions: allTransactions,
    fileCount: files.length,
    successfulFiles,
    fileSummaries
  };
}
