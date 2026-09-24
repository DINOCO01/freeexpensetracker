import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import type { ExpenseCategory, Transaction } from './calculations';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export interface FileInterpretationResult {
  recordCount: number;
  totalAmount: number;
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

/**
 * Parses Bank Statements in PDF format by extracting text coordinates,
 * reconstructing transaction line items, and extracting dates, descriptions, and debits.
 */
async function parsePdfStatement(file: File): Promise<FileInterpretationResult> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

  const rawLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by vertical Y position (within 4px threshold)
    const lineMap: Map<number, { x: number; text: string }[]> = new Map();

    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] / 4) * 4; // snap to nearest 4px

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({ x, text: item.str.trim() });
    }

    // Sort lines from top of page to bottom (descending Y coordinate)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const itemsOnLine = lineMap.get(y)!;
      // Sort items horizontally from left to right
      itemsOnLine.sort((a, b) => a.x - b.x);
      const lineText = itemsOnLine.map((i) => i.text).join(' ');
      if (lineText.length > 5) {
        rawLines.push(lineText);
      }
    }
  }

  if (rawLines.length === 0) {
    throw new Error('Could not extract readable text layers from this PDF. Please ensure it is a digital statement, not a scanned image.');
  }

  // Regex patterns for Date, Amount, and Non-transaction lines
  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i;
  const amountRegex = /(?:[$€£₹¥]|CA\$|AU\$)?\s*(-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2})\b/;
  const ignorePatterns = /(balance\s*forward|account\s*summary|statement\s*period|page\s*\d+\s*of|minimum\s*payment|payment\s*due|interest\s*charge|annual\s*percentage|total\s*fees|credit\s*limit)/i;

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

  for (const line of rawLines) {
    if (ignorePatterns.test(line)) continue;

    const dateMatch = line.match(dateRegex);
    const amountMatch = line.match(amountRegex);

    if (dateMatch && amountMatch) {
      const rawAmtStr = amountMatch[1].replace(/,/g, '');
      const parsedAmt = Math.abs(parseFloat(rawAmtStr));

      if (isNaN(parsedAmt) || parsedAmt <= 0) continue;

      // Extract description: remove date and amount strings from line
      let desc = line
        .replace(dateMatch[0], '')
        .replace(amountMatch[0], '')
        .replace(/[#*$\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!desc || desc.length < 2) {
        desc = `Transaction #${transactions.length + 1}`;
      }

      // Format date
      let dateStr = new Date().toISOString().split('T')[0];
      const parsedDate = new Date(dateMatch[0]);
      if (!isNaN(parsedDate.getTime())) {
        dateStr = parsedDate.toISOString().split('T')[0];
      } else {
        dateStr = dateMatch[0].trim();
      }
      datesFound.push(dateStr);

      const category = autoCategorizeExpense(desc);

      transactions.push({
        id: `pdf-${Date.now()}-${transactions.length}`,
        name: desc,
        amount: Math.round(parsedAmt * 100) / 100,
        category,
        date: dateStr,
        source: 'imported'
      });

      totalAmount += parsedAmt;
      categoryTotals[category] += parsedAmt;

      if (!highestExpense || parsedAmt > highestExpense.amount) {
        highestExpense = {
          name: desc,
          amount: Math.round(parsedAmt * 100) / 100,
          date: dateStr
        };
      }
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transaction line items could be parsed from the PDF. Please check the PDF format or upload an Excel/CSV export.');
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

  const insights: string[] = [
    `Extracted ${transactions.length} records totaling $${totalAmount.toFixed(2)} from PDF statement.`
  ];

  if (topCategory && topCategory.percentage > 0) {
    insights.push(
      `Your largest expense category is ${topCategory.category} (${topCategory.percentage}% of outflows, $${topCategory.amount.toFixed(2)}).`
    );
  }

  if (highestExpense) {
    insights.push(
      `Largest individual transaction: "${highestExpense.name}" for $${highestExpense.amount.toFixed(2)}.`
    );
  }

  return {
    recordCount: transactions.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
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
export async function parseAndInterpretFile(file: File): Promise<FileInterpretationResult> {
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
      source: 'imported'
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

    return {
      recordCount: 1,
      totalAmount: receipt.amount,
      categoryBreakdown: categoryTotals,
      topCategory: { category: receipt.category, amount: receipt.amount, percentage: 100 },
      highestExpense: { name: receipt.merchantName, amount: receipt.amount, date: receipt.date },
      earliestDate: receipt.date,
      latestDate: receipt.date,
      insights: [
        `OCR successfully recognized receipt bill from "${receipt.merchantName}".`,
        `Extracted total amount: $${receipt.amount.toFixed(2)} auto-classified as "${receipt.category}".`,
        receipt.confidence > 0 ? `Scan confidence: ${receipt.confidence}%.` : 'Image text processed.'
      ],
      transactions: [tx]
    };
  }

  // If PDF statement
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    return await parsePdfStatement(file);
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

    const category = autoCategorizeExpense(rawName);

    transactions.push({
      id: `imp-${Date.now()}-${transactions.length}`,
      name: rawName,
      amount: Math.round(cleanAmount * 100) / 100,
      category,
      date: dateStr,
      source: 'imported'
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

  const insights: string[] = [];
  insights.push(`Successfully interpreted ${transactions.length} spending records totaling $${totalAmount.toFixed(2)}.`);

  if (topCategory && topCategory.percentage > 0) {
    insights.push(
      `Your largest expense category is ${topCategory.category}, accounting for ${topCategory.percentage}% ($${topCategory.amount.toFixed(2)}) of total outflow.`
    );
  }

  if (highestExpense) {
    insights.push(
      `Largest individual transaction recorded: "${highestExpense.name}" for $${highestExpense.amount.toFixed(2)} on ${highestExpense.date}.`
    );
  }

  if (earliestDate !== 'N/A' && latestDate !== 'N/A') {
    insights.push(`Statement timeframe spans from ${earliestDate} through ${latestDate}.`);
  }

  return {
    recordCount: transactions.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
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
  onProgress?: (current: number, total: number, fileName: string) => void
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
      const res = await parseAndInterpretFile(file);
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

  // Compute total amount
  const totalAmount = allTransactions.reduce((acc, t) => acc + t.amount, 0);

  // Top category
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

  allDates.sort();
  const earliestDate = allDates[0] || 'N/A';
  const latestDate = allDates[allDates.length - 1] || 'N/A';

  const insights: string[] = [
    `Successfully processed ${successfulFiles} of ${files.length} file(s), extracting ${allTransactions.length} transactions totaling $${totalAmount.toFixed(2)}.`
  ];

  if (topCategory && topCategory.percentage > 0) {
    insights.push(
      `Top spending category across all files: ${topCategory.category} (${topCategory.percentage}% of total, $${topCategory.amount.toFixed(2)}).`
    );
  }

  if (highestExpense) {
    insights.push(`Single largest transaction: "${highestExpense.name}" for $${highestExpense.amount.toFixed(2)} on ${highestExpense.date}.`);
  }

  return {
    recordCount: allTransactions.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
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
