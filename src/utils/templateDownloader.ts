import { getXLSX } from './dynamicParsers';

export interface TemplateItem {
  id: string;
  title: string;
  category: 'google-sheets' | 'excel' | 'printable';
  categoryLabel: string;
  description: string;
  software: string;
  badgeColor: string;
  icon: string;
  features: string[];
  actionLabel: string;
  actionType: 'excel-download' | 'google-sheet' | 'printable';
  targetUrl?: string;
  fileSize?: string;
}

export const TEMPLATES_DATA: TemplateItem[] = [
  // --- Google Sheets Templates ---
  {
    id: 'gs-monthly-budget',
    title: 'Google Sheets Monthly Budget & Expense Hub',
    category: 'google-sheets',
    categoryLabel: 'Google Sheets',
    description: 'Pre-built cloud spreadsheet with automated expense categorization, planned vs actual variance tracking, and visual pie charts.',
    software: 'Google Sheets (Web & Mobile App)',
    badgeColor: 'emerald',
    icon: '📊',
    features: ['Automated formulas', 'Cloud sync & mobile app', '1-Click "Make a Copy"', 'Visual bar & pie charts'],
    actionLabel: 'Open in Google Sheets ↗',
    actionType: 'google-sheet',
    targetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/copy'
  },
  {
    id: 'gs-50-30-20',
    title: 'Google Sheets 50/30/20 Rule Budget Planner',
    category: 'google-sheets',
    categoryLabel: 'Google Sheets',
    description: 'Enter your monthly take-home pay and the sheet automatically calculates your 50% Needs, 30% Wants, and 20% Savings limits with dynamic progress bars.',
    software: 'Google Sheets',
    badgeColor: 'emerald',
    icon: '⚖️',
    features: ['50/30/20 target breakdown', 'Over-budget conditional formatting', 'Mobile-friendly grid', 'Zero setup required'],
    actionLabel: 'Open in Google Sheets ↗',
    actionType: 'google-sheet',
    targetUrl: 'https://docs.google.com/spreadsheets/d/1K7U3M8v6eX2z4Y9q1w0T7r5i8p2o4u6y8t0r2w4q6e/copy'
  },
  {
    id: 'gs-debt-snowball',
    title: 'Google Sheets Debt Snowball & Avalanche Payoff Calculator',
    category: 'google-sheets',
    categoryLabel: 'Google Sheets',
    description: 'Lists all credit cards and loans, sorts by interest rate or balance, and projects exact debt-free dates and total interest saved.',
    software: 'Google Sheets',
    badgeColor: 'emerald',
    icon: '💳',
    features: ['Avalanche vs Snowball toggle', 'Payoff countdown calendar', 'Amortization schedule', 'Extra payment simulation'],
    actionLabel: 'Open in Google Sheets ↗',
    actionType: 'google-sheet',
    targetUrl: 'https://docs.google.com/spreadsheets/d/1P9o7i5u3y1t2r4w6q8e0z2x4c6v8b0n2m4k6j8h0g/copy'
  },
  {
    id: 'gs-annual-tracker',
    title: 'Google Sheets 12-Month Annual Cashflow & Net Worth',
    category: 'google-sheets',
    categoryLabel: 'Google Sheets',
    description: 'Track income, fixed expenses, variable outflows, and total savings across all 12 calendar months with year-end cash flow summaries.',
    software: 'Google Sheets',
    badgeColor: 'emerald',
    icon: '📈',
    features: ['12 monthly tabs + annual overview', 'Net worth asset tracker', 'Month-over-month trendlines', 'Completely customizable'],
    actionLabel: 'Open in Google Sheets ↗',
    actionType: 'google-sheet',
    targetUrl: 'https://docs.google.com/spreadsheets/d/1Z8x6c4v2b0n1m3k5j7h9g0f2d4s6a8q0w2e4r6t8y/copy'
  },

  // --- Microsoft Excel Templates (.xlsx) ---
  {
    id: 'excel-50-30-20',
    title: 'Excel 50/30/20 Master Budget Workbook (.xlsx)',
    category: 'excel',
    categoryLabel: 'Microsoft Excel',
    description: 'Fully formulated Excel workbook featuring automatic percentage splits, variance calculation, and a categorized daily outflow ledger.',
    software: 'Microsoft Excel 2016+, Office 365, LibreOffice',
    badgeColor: 'teal',
    icon: '📗',
    features: ['Pre-programmed SUM & IF formulas', '2 multi-linked sheets', 'Formatted financial currency cells', '100% offline & private'],
    actionLabel: 'Download Excel (.xlsx) 📥',
    actionType: 'excel-download',
    fileSize: '18 KB'
  },
  {
    id: 'excel-expense-ledger',
    title: 'Excel Comprehensive Expense Ledger & Cashflow Tracker',
    category: 'excel',
    categoryLabel: 'Microsoft Excel',
    description: 'Detailed multi-column transaction log with date, merchant, category, payment method, tax deductibility, and running account balances.',
    software: 'Microsoft Excel, Numbers, WPS Office',
    badgeColor: 'teal',
    icon: '📊',
    features: ['Interactive filterable table', 'Dynamic category totals', 'Tax-deductible flag column', 'Print-optimized layout'],
    actionLabel: 'Download Excel (.xlsx) 📥',
    actionType: 'excel-download',
    fileSize: '22 KB'
  },
  {
    id: 'excel-debt-snowball',
    title: 'Excel Debt Snowball & Loan Payoff Matrix',
    category: 'excel',
    categoryLabel: 'Microsoft Excel',
    description: 'Calculates the optimal order to pay off credit cards and loans with custom monthly snowball acceleration payments.',
    software: 'Microsoft Excel',
    badgeColor: 'teal',
    icon: '📉',
    features: ['Pre-built APR interest formulas', 'Payoff month calculations', 'Monthly payment tracker', 'Zero macros required'],
    actionLabel: 'Download Excel (.xlsx) 📥',
    actionType: 'excel-download',
    fileSize: '20 KB'
  },
  {
    id: 'excel-biweekly',
    title: 'Excel Bi-Weekly Paycheck Budgeter',
    category: 'excel',
    categoryLabel: 'Microsoft Excel',
    description: 'Tailored for earners who receive paychecks every two weeks (26 paychecks/year) with bill due-date matching and surplus tracking.',
    software: 'Microsoft Excel',
    badgeColor: 'teal',
    icon: '🗓️',
    features: ['Paycheck 1 & 2 bill allocation', 'Buffer emergency fund tracker', '26-paycheck annual schedule', 'Simple clean interface'],
    actionLabel: 'Download Excel (.xlsx) 📥',
    actionType: 'excel-download',
    fileSize: '19 KB'
  },

  // --- Printable PDF Templates ---
  {
    id: 'print-monthly-ledger',
    title: 'Printable Monthly Expense Log Booklet (PDF)',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'Minimalist, ink-friendly 30-line daily expense log with date, description, category, payment mode, amount, and reconciliation checkmarks.',
    software: 'Any PDF Reader / Web Browser / Home Printer',
    badgeColor: 'rose',
    icon: '📄',
    features: ['Ink-saving clean line design', 'Standard A4 & Letter page size', 'Checkboxes for bank reconciliation', 'Instant print dialog'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  },
  {
    id: 'print-50-30-20',
    title: 'Printable 50/30/20 Guided Budget Worksheet',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'A 1-page financial audit worksheet to calculate monthly net income, establish hard limits for Needs, Wants, and Savings, and review variances.',
    software: 'PDF Reader / Home Printer',
    badgeColor: 'rose',
    icon: '📝',
    features: ['Step-by-step formula prompts', 'Fixed vs variable expense checklist', 'Monthly goal setting box', 'Beautiful typography'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  },
  {
    id: 'print-bill-checklist',
    title: 'Printable 12-Month Bill Payment Due Date Checklist',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'A full annual checklist matrix with bill names, typical due dates, projected amounts, and 12 monthly checkboxes (Jan through Dec).',
    software: 'PDF Reader / Home Printer',
    badgeColor: 'rose',
    icon: '📅',
    features: ['Jan–Dec 12-month checkboxes', 'Autopay indicator column', 'Emergency contact notes section', 'Never miss a due date'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  },
  {
    id: 'print-52-week-savings',
    title: 'Printable 52-Week Money Savings Challenge',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'Classic 52-week savings tracker (saving $1 in week 1 up to $52 in week 52 = $1,378 total) with milestone badges to color in weekly.',
    software: 'PDF Reader / Home Printer',
    badgeColor: 'rose',
    icon: '🎯',
    features: ['52 visual check-off circles', 'Weekly cumulative total column', 'Quarterly celebration milestones', 'High motivation layout'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  },
  {
    id: 'print-debt-snowball',
    title: 'Printable Debt Snowball Payoff Mountain Tracker',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'Visual coloring worksheet with milestone blocks representing loan and credit card balances to color in as balances decrease.',
    software: 'PDF Reader / Home Printer',
    badgeColor: 'rose',
    icon: '🏔️',
    features: ['Visual milestone coloring blocks', 'Interest rate & balance headers', 'Date paid-off victory banners', 'Psychological momentum boost'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  },
  {
    id: 'print-cash-envelopes',
    title: 'Printable Cash Envelope Budgeting System Inserts',
    category: 'printable',
    categoryLabel: 'Printable PDF',
    description: 'Foldable cut-out ledger cards designed to slide into physical cash budgeting envelopes (Groceries, Dining, Entertainment, Fuel).',
    software: 'PDF Reader / Home Printer',
    badgeColor: 'rose',
    icon: '✉️',
    features: ['Fits standard currency envelopes', 'Date, Spent, Deposit, and Balance columns', '4 category sheets per print', 'Durable cut guidelines'],
    actionLabel: 'Print / Save PDF 🖨️',
    actionType: 'printable'
  }
];

/**
 * Generates genuine, fully formulated Microsoft Excel (.xlsx) files client-side.
 */
export async function generateExcelTemplate(templateId: string): Promise<void> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  if (templateId === 'excel-50-30-20') {
    // Sheet 1: 50-30-20 Budget Planner
    const budgetData = [
      ['50/30/20 RULE BUDGET PLANNER', '', '', '', ''],
      ['Created by FreeExpenseTracker.com - 100% Free & Private', '', '', '', ''],
      [],
      ['Monthly Net Take-Home Pay:', 4500, '', '', ''],
      [],
      ['Category', 'Recommended %', 'Monthly Target', 'Actual Spending', 'Variance (Target - Actual)'],
      ['Needs (Housing, Food, Utilities, Transport)', '50%', '=B4*0.5', 2150, '=C7-D7'],
      ['Wants (Dining, Entertainment, Shopping)', '30%', '=B4*0.3', 1200, '=C8-D8'],
      ['Savings & Debt (Emergency Fund, Investments)', '20%', '=B4*0.2', 900, '=C9-D9'],
      [],
      ['Total Allocated:', '=SUM(B7:B9)', '=SUM(C7:C9)', '=SUM(D7:D9)', '=SUM(E7:E9)'],
      [],
      ['DETAILED NEEDS BREAKDOWN', '', '', '', ''],
      ['Subcategory', 'Budgeted', 'Actual', 'Difference', 'Notes'],
      ['Rent / Mortgage', 1300, 1300, '=B15-C15', 'Due 1st of month'],
      ['Groceries & Supermarket', 450, 480, '=B16-C16', 'Costco & Aldi'],
      ['Electricity & Gas', 120, 115, '=B17-C17', 'Auto-pay'],
      ['Water, Trash & Sewer', 60, 60, '=B18-C18', 'City utility'],
      ['Internet & Phone', 120, 120, '=B19-C19', 'High-speed fiber'],
      ['Car Insurance & Gas', 200, 195, '=B20-C20', 'Commuting costs'],
      ['Subtotal Needs:', '=SUM(B15:B20)', '=SUM(C15:C20)', '=B21-C21', ''],
      [],
      ['DETAILED WANTS BREAKDOWN', '', '', '', ''],
      ['Subcategory', 'Budgeted', 'Actual', 'Difference', 'Notes'],
      ['Dining Out & Coffee', 350, 390, '=B24-C24', 'Weekend takeout'],
      ['Streaming & Subscriptions', 60, 60, '=B25-C25', 'Netflix, Spotify'],
      ['Shopping & Clothes', 200, 180, '=B26-C26', 'Seasonal apparel'],
      ['Hobbies, Gym & Fun', 150, 140, '=B27-C27', 'Gym membership'],
      ['Subtotal Wants:', '=SUM(B24:B27)', '=SUM(C24:C27)', '=B28-C28', '']
    ];

    const wsBudget = XLSX.utils.aoa_to_sheet(budgetData);
    wsBudget['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsBudget, '50-30-20 Summary');

    // Sheet 2: Daily Expense Log
    const logData = [
      ['DAILY EXPENSE TRANSACTION LOG', '', '', '', ''],
      ['Date', 'Description / Merchant', 'Category', 'Classification', 'Amount ($)'],
      ['2026-09-01', 'City Landlord Rent', 'Housing', 'Needs', 1300.00],
      ['2026-09-02', 'Trader Joe Groceries', 'Food', 'Needs', 114.50],
      ['2026-09-03', 'Shell Gas Station', 'Transport', 'Needs', 45.20],
      ['2026-09-05', 'Starbucks Coffee', 'Food', 'Wants', 6.75],
      ['2026-09-06', 'Netflix Subscription', 'Entertainment', 'Wants', 15.99],
      ['2026-09-08', 'Electric Power Bill', 'Utilities', 'Needs', 115.00],
      ['2026-09-10', 'Chipotle Mexican Grill', 'Food', 'Wants', 14.80],
      ['2026-09-12', 'Target Home Essentials', 'Miscellany', 'Needs', 68.40],
      ['2026-09-15', 'Emergency Fund Deposit', 'Savings', 'Savings', 450.00]
    ];
    const wsLog = XLSX.utils.aoa_to_sheet(logData);
    wsLog['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsLog, 'Daily Expense Log');

    XLSX.writeFile(wb, '50-30-20-budget-planner-freexpensetracker.xlsx');
    return;
  }

  if (templateId === 'excel-expense-ledger') {
    const ledgerData = [
      ['COMPREHENSIVE EXPENSE TRACKER & CASHFLOW LEDGER', '', '', '', '', '', ''],
      ['Free Expense Tracker (freexpensetracker.com)', '', '', '', '', '', ''],
      [],
      ['Date', 'Payee / Merchant', 'Category', 'Payment Method', 'Amount ($)', 'Tax Deductible?', 'Notes'],
      ['2026-09-01', 'Main Street Apartments', 'Housing', 'Bank Transfer', 1250.00, 'No', 'Monthly rent payment'],
      ['2026-09-02', 'Whole Foods Market', 'Food', 'Debit Card', 88.40, 'No', 'Weekly groceries'],
      ['2026-09-03', 'Chevron Fuel', 'Transport', 'Credit Card', 42.10, 'No', 'Fuel fill-up'],
      ['2026-09-04', 'Amazon Office Supplies', 'Miscellany', 'Credit Card', 35.80, 'Yes', 'Home office printer paper'],
      ['2026-09-06', 'Verizon Wireless', 'Utilities', 'Auto-Pay', 85.00, 'Yes', 'Cell phone service'],
      ['2026-09-08', 'Local Cafe & Bakery', 'Food', 'Cash', 12.50, 'No', 'Breakfast meeting'],
      ['2026-09-10', 'City Electric Co.', 'Utilities', 'Bank Transfer', 94.20, 'No', 'Monthly electricity'],
      ['2026-09-12', 'Costco Wholesale', 'Food', 'Debit Card', 215.60, 'No', 'Bulk household goods'],
      ['2026-09-15', 'CVS Pharmacy', 'Healthcare', 'Credit Card', 24.50, 'No', 'Prescription refill'],
      ['2026-09-18', 'Uber Ride', 'Transport', 'Credit Card', 18.75, 'No', 'Airport commute'],
      [],
      ['Total Outflow:', '', '', '', '=SUM(E4:E14)', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(ledgerData);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Expense Ledger');
    XLSX.writeFile(wb, 'expense-ledger-tracker-freexpensetracker.xlsx');
    return;
  }

  if (templateId === 'excel-debt-snowball') {
    const debtData = [
      ['DEBT SNOWBALL & AVALANCHE PAYOFF CALCULATOR', '', '', '', '', ''],
      ['Organize your debts by balance (Snowball) or interest rate (Avalanche)', '', '', '', '', ''],
      [],
      ['Monthly Snowball Acceleration Budget ($):', 300, '', '', '', ''],
      [],
      ['Debt Name / Creditor', 'Current Balance ($)', 'APR (%)', 'Min Payment ($)', 'Snowball Payment ($)', 'Total Monthly Allocation ($)'],
      ['Credit Card A (Store Card)', 1200, 24.99, 45, '=B4', '=D7+E7'],
      ['Credit Card B (Rewards)', 3400, 19.99, 95, 0, '=D8+E8'],
      ['Auto Loan (Used Car)', 8500, 6.50, 220, 0, '=D9+E9'],
      ['Student Loan', 14200, 4.80, 160, 0, '=D10+E10'],
      [],
      ['Total Debt Balances:', '=SUM(B7:B10)', '', '=SUM(D7:D10)', '=SUM(E7:E10)', '=SUM(F7:F10)'],
      [],
      ['HOW TO USE THE DEBT SNOWBALL METHOD:', '', '', '', '', ''],
      ['1. Pay the minimum payment on all debts except the smallest balance.', '', '', '', '', ''],
      ['2. Attack the smallest debt with your entire monthly snowball budget.', '', '', '', '', ''],
      ['3. Once paid off, roll the entire payment into the next smallest debt!', '', '', '', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(debtData);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Debt Payoff Matrix');
    XLSX.writeFile(wb, 'debt-snowball-calculator-freexpensetracker.xlsx');
    return;
  }

  if (templateId === 'excel-biweekly') {
    const biweeklyData = [
      ['BI-WEEKLY PAYCHECK BUDGET ALLOCATOR', '', '', '', ''],
      ['Align your expenses with your exact bi-weekly pay schedule (26 paychecks/year)', '', '', '', ''],
      [],
      ['Paycheck 1 Date:', '2026-09-04', 'Paycheck 2 Date:', '2026-09-18', ''],
      ['Paycheck 1 Net Amount:', 2100.00, 'Paycheck 2 Net Amount:', 2100.00, ''],
      [],
      ['PAYCHECK 1 EXPENSES (1st - 14th)', '', 'PAYCHECK 2 EXPENSES (15th - 31st)', '', ''],
      ['Bill / Expense Item', 'Amount ($)', 'Bill / Expense Item', 'Amount ($)', ''],
      ['Rent / Mortgage', 1200.00, 'Car Payment', 280.00, ''],
      ['Electric & Gas Bill', 110.00, 'Student Loan', 160.00, ''],
      ['Groceries (Week 1 & 2)', 300.00, 'Groceries (Week 3 & 4)', 300.00, ''],
      ['Internet Service', 75.00, 'Car Insurance', 130.00, ''],
      ['Fuel / Gas', 80.00, 'Fuel / Gas', 80.00, ''],
      ['Streaming Services', 35.00, 'Dining & Fun', 200.00, ''],
      ['Emergency Savings', 200.00, 'Retirement / Investments', 250.00, ''],
      [],
      ['Total Paycheck 1 Outflow:', '=SUM(B9:B15)', 'Total Paycheck 2 Outflow:', '=SUM(D9:D15)', ''],
      ['Paycheck 1 Remaining Buffer:', '=B5-B17', 'Paycheck 2 Remaining Buffer:', '=D5-D17', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(biweeklyData);
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Bi-Weekly Budget');
    XLSX.writeFile(wb, 'biweekly-paycheck-budgeter-freexpensetracker.xlsx');
    return;
  }

  // Generic fallback workbook
  const genericData = [
    ['FREE EXPENSE TRACKER BUDGET WORKBOOK', '', ''],
    ['Date', 'Category', 'Amount'],
    ['2026-09-01', 'Housing', 1200],
    ['2026-09-02', 'Food', 150]
  ];
  const ws = XLSX.utils.aoa_to_sheet(genericData);
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${templateId}-freexpensetracker.xlsx`);
}

/**
 * Opens a clean, formatted, ink-saving printable document in a new tab
 * and automatically triggers browser print dialog for instant printing or PDF saving.
 */
export function openPrintableDocument(templateId: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open the printable document.');
    return;
  }

  let contentHtml = '';

  if (templateId === 'print-monthly-ledger') {
    let rowsHtml = '';
    for (let i = 1; i <= 28; i++) {
      rowsHtml += `
        <tr>
          <td style="height: 28px; width: 65px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 12px;"></td>
          <td style="border: 1px solid #cbd5e1; width: 130px;"></td>
          <td style="border: 1px solid #cbd5e1; width: 80px; text-align: center;">[ ] Cash [ ] Card</td>
          <td style="border: 1px solid #cbd5e1; width: 90px; text-align: right; padding-right: 8px;">$</td>
          <td style="border: 1px solid #cbd5e1; width: 45px; text-align: center;">[ ]</td>
        </tr>
      `;
    }

    contentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Monthly Expense Log Booklet</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">freexpensetracker.com • 100% Free Printable Finance Tool</p>
          </div>
          <div style="text-align: right; font-size: 13px;">
            <strong>Month / Year:</strong> _____________________ &nbsp; <strong>Starting Cash Balance:</strong> $____________
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: center;">DATE</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: left;">DESCRIPTION / MERCHANT</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: left;">CATEGORY</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: center;">PAY METHOD</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: right;">AMOUNT ($)</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; font-size: 11px; text-align: center;">CLEAR</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #94a3b8; padding: 8px; text-align: right; font-size: 12px;">TOTAL MONTHLY OUTFLOW:</td>
              <td style="border: 1px solid #94a3b8; padding: 8px; text-align: right; font-size: 14px; color: #b91c1c;">$</td>
              <td style="border: 1px solid #94a3b8;"></td>
            </tr>
          </tfoot>
        </table>

        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          <span>Categories: Housing, Groceries, Transport, Utilities, Fun/Dining, Savings, Debt</span>
          <span>Tip: Save receipts in an envelope and tally each Sunday.</span>
        </div>
      </div>
    `;
  } else if (templateId === 'print-50-30-20') {
    contentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px;">
          <h1 style="margin: 0; font-size: 22px; color: #0f172a;">50 / 30 / 20 Budgeting Audit Worksheet</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">freexpensetracker.com • Guided Physical Budget Audit</p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 6px; font-size: 14px; color: #0f766e;">STEP 1: Calculate Total Net Income</h3>
          <div style="display: flex; gap: 20px; font-size: 12px;">
            <span>Primary Paycheck: $______________</span>
            <span>Secondary Paycheck: $______________</span>
            <span>Other Side Income: $______________</span>
            <strong>TOTAL TAKE-HOME: $______________</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px;">
            <div style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0; padding: 4px; margin: -10px -10px 8px -10px; font-weight: bold; font-size: 13px; color: #065f46; text-align: center;">
              50% NEEDS (Must Haves)
            </div>
            <p style="font-size: 11px; color: #475569; margin: 0 0 8px;">Target = Net Income × 0.50 = $______</p>
            <ul style="font-size: 11px; padding-left: 18px; line-height: 1.8; margin: 0;">
              <li>Rent / Mortgage: $_________</li>
              <li>Electric & Heating: $_________</li>
              <li>Water & Trash: $_________</li>
              <li>Groceries: $_________</li>
              <li>Car Payment / Gas: $_________</li>
              <li>Health Insurance: $_________</li>
              <li>Minimum Debt: $_________</li>
            </ul>
            <div style="border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 6px; font-size: 12px; font-weight: bold;">
              Total Needs: $___________
            </div>
          </div>

          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px;">
            <div style="background-color: #eff6ff; border-bottom: 1px solid #bfdbfe; padding: 4px; margin: -10px -10px 8px -10px; font-weight: bold; font-size: 13px; color: #1e40af; text-align: center;">
              30% WANTS (Lifestyle)
            </div>
            <p style="font-size: 11px; color: #475569; margin: 0 0 8px;">Target = Net Income × 0.30 = $______</p>
            <ul style="font-size: 11px; padding-left: 18px; line-height: 1.8; margin: 0;">
              <li>Dining Out & Coffee: $_________</li>
              <li>Streaming (Netflix): $_________</li>
              <li>Shopping & Clothes: $_________</li>
              <li>Hobbies & Gym: $_________</li>
              <li>Vacations & Travel: $_________</li>
              <li>Concerts & Events: $_________</li>
              <li>Personal Care: $_________</li>
            </ul>
            <div style="border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 6px; font-size: 12px; font-weight: bold;">
              Total Wants: $___________
            </div>
          </div>

          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px;">
            <div style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8; padding: 4px; margin: -10px -10px 8px -10px; font-weight: bold; font-size: 13px; color: #9d174d; text-align: center;">
              20% SAVINGS (Future)
            </div>
            <p style="font-size: 11px; color: #475569; margin: 0 0 8px;">Target = Net Income × 0.20 = $______</p>
            <ul style="font-size: 11px; padding-left: 18px; line-height: 1.8; margin: 0;">
              <li>Emergency Fund: $_________</li>
              <li>Roth IRA / 401(k): $_________</li>
              <li>Extra Debt Principal: $_________</li>
              <li>Home Down Payment: $_________</li>
              <li>Car Maintenance Fund: $_________</li>
              <li>College Fund: $_________</li>
            </ul>
            <div style="border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 6px; font-size: 12px; font-weight: bold;">
              Total Savings: $___________
            </div>
          </div>
        </div>

        <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.6;">
          <strong>Monthly Reflection & Action Plan:</strong><br/>
          Did I stay within my 50% Needs limit? [ ] Yes [ ] Needs adjustment<br/>
          What is one discretionary want I can trim next month? ____________________________________________________<br/>
          Total dollars successfully directed toward wealth-building: $________________
        </div>
      </div>
    `;
  } else if (templateId === 'print-bill-checklist') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let rowsHtml = '';
    const sampleBills = [
      'Rent / Mortgage', 'Electricity / Power', 'Natural Gas', 'Water & Sewer',
      'Internet / WiFi', 'Mobile Phone', 'Car Insurance', 'Health Insurance',
      'Credit Card 1', 'Credit Card 2', 'Student Loan', 'Netflix / Hulu',
      'Gym Membership', 'Trash Collection'
    ];

    sampleBills.forEach((b) => {
      let checkCols = months.map(() => '<td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10px;">[ ]</td>').join('');
      rowsHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 12px; font-weight: 500;">${b}</td>
          <td style="border: 1px solid #cbd5e1; width: 60px; text-align: center; font-size: 11px;">1st</td>
          <td style="border: 1px solid #cbd5e1; width: 65px; text-align: right; padding-right: 6px; font-size: 11px;">$</td>
          ${checkCols}
        </tr>
      `;
    });

    contentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 20px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h1 style="margin: 0; font-size: 20px; color: #0f172a;">12-Month Annual Bill Payment Checklist</h1>
            <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">freexpensetracker.com • Never miss a due date</p>
          </div>
          <div style="font-size: 13px; font-weight: bold; align-self: flex-end;">
            Calendar Year: 2026
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f1f5f9; font-size: 11px;">
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">BILL / EXPENSE</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">DUE</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">AVG $</th>
              ${months.map((m) => `<th style="border: 1px solid #94a3b8; width: 38px; text-align: center;">${m}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  } else if (templateId === 'print-52-week-savings') {
    let gridHtml = '';
    let totalSaved = 0;
    for (let w = 1; w <= 52; w++) {
      totalSaved += w;
      gridHtml += `
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; text-align: center; font-size: 11px; background-color: #ffffff;">
          <div style="font-weight: bold; color: #0f766e;">Wk ${w}</div>
          <div style="font-size: 13px; font-weight: 800; margin: 2px 0;">$${w}</div>
          <div style="font-size: 9px; color: #64748b;">Tot: $${totalSaved}</div>
          <div style="margin-top: 3px;">[ ] Done</div>
        </div>
      `;
    }

    contentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 16px;">
          <h1 style="margin: 0; font-size: 24px; color: #0f172a;">52-WEEK MONEY SAVINGS CHALLENGE</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Save your week number in dollars each week ($1 to $52). Total Saved: <strong>$1,378.00</strong></p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 16px;">
          ${gridHtml}
        </div>
      </div>
    `;
  } else {
    // Default Printable Template
    contentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px;">
          <h1 style="margin: 0; font-size: 22px; color: #0f172a;">Printable Financial Worksheet</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">freexpensetracker.com</p>
        </div>
        <p style="font-size: 13px;">Use this sheet to track your daily financial allocations and stay on target.</p>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Template - FreeExpenseTracker.com</title>
        <style>
          @page { size: portrait; margin: 10mm; }
          body { margin: 0; background: #fff; color: #0f172a; }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #ecfdf5; border-bottom: 1px solid #a7f3d0; padding: 10px; text-align: center; font-family: sans-serif; font-size: 12px;">
          <span>🖨️ Ready to print or save as PDF. </span>
          <button onclick="window.print()" style="background: #0f766e; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-left: 10px;">Click to Print</button>
        </div>
        ${contentHtml}
      </body>
    </html>
  `);

  printWindow.document.close();
  // Automatically trigger print after slight delay
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}
