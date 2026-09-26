import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  matchHeaderRole,
  parseMonetaryAmount,
  parseFlexibleDate,
  normalizeCategory,
  determineTransactionType,
  validateTransaction,
  isFooterOrSummaryLine,
  type ColumnRole
} from '../src/utils/fileImporter';
import { type Transaction } from '../src/utils/calculations';

async function testExactPdf() {
  const filePath = 'C:\\Users\\princ\\Desktop\\test files\\test_statement_september_2026.pdf';
  console.log(`Loading PDF from: ${filePath}`);
  const buffer = fs.readFileSync(filePath);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;

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

  // Header detection
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

  console.log(`Detected header row index: ${headerRowIndex}`);
  console.log('Detected column zones:', columnZones.map(z => `${z.role} [${z.xStart.toFixed(1)} - ${z.xEnd.toFixed(1)}]`));

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
        let drVal: number | undefined;
        let crVal: number | undefined;
        let amtIsNegative = false;

        const hasDebitCol = columnZones.some((z) => z.role === 'debit');
        const hasCreditCol = columnZones.some((z) => z.role === 'credit');

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

        if (txAmount === 0 && colCells.amount.length > 0) {
          const amtStr = colCells.amount.join(' ').trim();
          const parsed = parseMonetaryAmount(amtStr);
          if (parsed && parsed.amount > 0) {
            txAmount = parsed.amount;
            amtIsNegative = parsed.isNegative;
          } else {
            console.log(`Row ${i}: parseMonetaryAmount("${amtStr}") returned:`, parsed);
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
            sourceFile: 'test_statement_september_2026.pdf',
            sourceType: 'pdf'
          };

          const validation = validateTransaction(tx, rowText);
          if (validation.isValid) {
            transactions.push(tx);
          } else {
            console.log(`Row ${i}: validateTransaction failed:`, validation.warning);
          }
        } else {
          console.log(`Row ${i}: txAmount is 0. colCells.amount was:`, colCells.amount);
        }
      } else {
        console.log(`Row ${i}: parseFlexibleDate failed for: "${rawDateStr}"`);
      }
    }
  }

  console.log('\n==========================================');
  console.log('ACTUAL PDF PARSE RESULTS:');
  console.log(`Total Extracted Transactions: ${transactions.length}`);

  const incomeTxs = transactions.filter((t) => t.type === 'income');
  const expenseTxs = transactions.filter((t) => t.type === 'expense');

  console.log(`Income Count: ${incomeTxs.length}`);
  console.log(`Expense Count: ${expenseTxs.length}`);

  const totalInflow = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const netCashflow = totalInflow - totalOutflow;

  console.log(`Total Inflow (Income): ₹${totalInflow.toLocaleString('en-IN')}`);
  console.log(`Total Outflow (Expenses): ₹${totalOutflow.toLocaleString('en-IN')}`);
  console.log(`Net Cashflow: ₹${netCashflow.toLocaleString('en-IN')}`);

  console.log('\nALL EXTRACTED TRANSACTIONS:');
  transactions.forEach((t, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. [${t.date}] ${t.name.padEnd(25)} | ${t.category.padEnd(14)} | ${t.type.padEnd(7)} | ₹${t.amount}`);
  });

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`❌ FAILED: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ ${msg}`);
    }
  };

  console.log('\n--- VERIFYING USER REQUIREMENTS ---');
  assert(transactions.length === 15, `Expected 15 transactions, got ${transactions.length}`);
  assert(totalInflow === 66925, `Expected Income = ₹66,925, got ₹${totalInflow}`);
  assert(totalOutflow === 29168, `Expected Expenses = ₹29,168, got ₹${totalOutflow}`);
  assert(netCashflow === 37757, `Expected Net = ₹37,757, got ₹${netCashflow}`);

  // Check no descriptions have pollution
  const polluted = transactions.filter(t => /[-+]|\b(Miscellany|Housing|Transport|Utilities)\b/i.test(t.name));
  assert(polluted.length === 0, `Expected 0 polluted descriptions, found: ${polluted.map(p => p.name).join(', ')}`);

  console.log('\n🎉 ALL CHECKS PASSED PERFECTLY!');
  console.log('==========================================\n');
}

testExactPdf();
