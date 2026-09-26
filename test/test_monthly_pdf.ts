import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  matchHeaderRole,
  parseMonetaryAmount,
  parseFlexibleDate,
  normalizeCategory,
  validateTransaction,
  isFooterOrSummaryLine,
  STATEMENT_DATE_REGEX,
  type ColumnRole
} from '../src/utils/fileImporter';
import { formatCurrency, type ExpenseCategory, type Transaction } from '../src/utils/calculations';

async function testMonthlyPdf() {
  const filePath = 'C:\\Users\\princ\\Downloads\\monthly_income_expense_statement.pdf';
  console.log(`Loading: ${filePath}`);
  const buffer = fs.readFileSync(filePath);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  console.log(`Number of Pages: ${pdfDoc.numPages}`);

  const allPageRows: { page: number; cells: any[]; rowText: string; y: number }[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageCells: any[] = [];

    for (const item of textContent.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const str = item.str.trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      pageCells.push({ text: str, x, y, width: item.width || 0 });
    }

    pageCells.sort((a, b) => b.y - a.y);
    const pageRows: any[][] = [];

    for (const cell of pageCells) {
      const existing = pageRows.find((r) => Math.abs(r[0].y - cell.y) <= 7);
      if (existing) {
        existing.push(cell);
      } else {
        pageRows.push([cell]);
      }
    }

    for (const row of pageRows) {
      row.sort((a, b) => a.x - b.x);
      allPageRows.push({
        page: pageNum,
        cells: row,
        rowText: row.map((c) => c.text).join(' '),
        y: row[0].y
      });
    }
  }

  console.log(`Total PDF visual rows extracted: ${allPageRows.length}`);
  console.log('--- ALL ROWS DUMP ---');
  allPageRows.forEach((r, idx) => console.log(`Row ${idx}: ${r.rowText}`));

  // Now run the exact Column Zone logic from parsePdfStatement:
  let headerRowIndex = -1;
  let columnZones: any[] = [];

  for (let i = 0; i < Math.min(25, allPageRows.length); i++) {
    const { cells } = allPageRows[i];
    const roles = cells.map((cell) => ({
      cell,
      role: matchHeaderRole(cell.text)
    }));

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

  console.log(`Header row index: ${headerRowIndex}`);
  console.log('Column Zones detected:', columnZones);

  const transactions: Transaction[] = [];

  for (let i = headerRowIndex + 1; i < allPageRows.length; i++) {
    const { rowText, cells } = allPageRows[i];
    if (isFooterOrSummaryLine(rowText)) continue;

    if (columnZones.length >= 2) {
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

        const amtStr = colCells.amount.join(' ').trim();
        const parsed = parseMonetaryAmount(amtStr);
        if (parsed && parsed.amount > 0) {
          txAmount = parsed.amount;
          const typeStr = colCells.txType.join(' ').trim();
          if (typeStr) {
            isIncome = /(income|credit|deposit|cr|inflow)/i.test(typeStr);
          } else if (parsed.isNegative) {
            isIncome = false;
          }
        }

        if (txAmount > 0) {
          let desc = colCells.description.join(' ').trim();
          if (!desc) {
            desc = colCells.category.join(' ').trim() || `Transaction #${transactions.length + 1}`;
          }

          const rawCat = colCells.category.join(' ').trim();
          const category = normalizeCategory(rawCat, desc);

          const tx: Transaction = {
            id: `pdf-${i}`,
            date: parsedDate,
            name: desc,
            category,
            type: isIncome ? 'income' : 'expense',
            amount: txAmount,
            source: 'imported',
            sourceFile: 'monthly_income_expense_statement.pdf',
            sourceType: 'pdf'
          };

          if (validateTransaction(tx, rowText).isValid) {
            transactions.push(tx);
          }
        }
      }
    }
  }

  console.log('\n==========================================');
  console.log('RESULTS ON MONTHLY_INCOME_EXPENSE_STATEMENT.PDF:');
  console.log(`Total Extracted Transactions: ${transactions.length}`);

  const incomeTxs = transactions.filter(t => t.type === 'income');
  const expenseTxs = transactions.filter(t => t.type === 'expense');
  console.log(`Income Count: ${incomeTxs.length}`);
  console.log(`Expense Count: ${expenseTxs.length}`);

  const totalInflow = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  console.log(`Total Inflow (Income): ₹${totalInflow.toLocaleString('en-IN')}`);
  console.log(`Total Outflow (Expenses): ₹${totalOutflow.toLocaleString('en-IN')}`);

  const categoryTotals: Record<string, number> = {};
  for (const t of expenseTxs) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  }
  console.log('Expense Category Breakdown:', categoryTotals);

  const misc = transactions.find(t => t.name.toLowerCase().includes('miscellaneous'));
  if (misc) {
    console.log(`Row "Miscellaneous": Date=${misc.date}, Amount=₹${misc.amount}, Type=${misc.type}, Category=${misc.category}`);
  }
  console.log('==========================================\n');
}

testMonthlyPdf();
