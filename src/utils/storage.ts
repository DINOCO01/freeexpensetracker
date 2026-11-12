import * as XLSX from 'xlsx';
import { SUPPORTED_CURRENCIES, type Frequency, type BudgetModel, type Transaction } from './calculations';
import { getLocaleDefaultCurrency } from '../locales';
import {
  openDatabase,
  isIndexedDBAvailable,
  getAllTransactionsIDB,
  saveAllTransactionsIDB,
  getAllDebtsIDB,
  saveAllDebtsIDB,
  getAllGoalsIDB,
  saveAllGoalsIDB,
  getProfileIDB,
  saveProfileIDB,
  migrateLocalStorageToIndexedDB,
  exportFullBackupPayload,
  validateBackupPayload,
  restoreFromBackupPayload,
  clearAllIndexedDBAndStorage,
  type DebtItem,
  type DebtPaymentRecord,
  type GoalItem,
  type GoalContribution,
  type ProfileState,
  type BackupPayload,
  type ValidationResult
} from './idb';

export {
  openDatabase,
  isIndexedDBAvailable,
  getAllTransactionsIDB,
  saveAllTransactionsIDB,
  getAllDebtsIDB,
  saveAllDebtsIDB,
  getAllGoalsIDB,
  saveAllGoalsIDB,
  getProfileIDB,
  saveProfileIDB,
  migrateLocalStorageToIndexedDB,
  exportFullBackupPayload,
  validateBackupPayload,
  restoreFromBackupPayload,
  clearAllIndexedDBAndStorage,
  type DebtItem,
  type DebtPaymentRecord,
  type GoalItem,
  type GoalContribution,
  type ProfileState,
  type BackupPayload,
  type ValidationResult
};

export const STORAGE_KEYS = {
  INCOME: 'fet_income_v4',
  FREQUENCY: 'fet_frequency_v4',
  MODEL: 'fet_model_v4',
  CURRENCY: 'fet_currency_v4',
  TRANSACTIONS: 'fet_transactions_v4',
  DEBTS: 'fet_debts_v4',
  GOALS: 'fet_goals_v4'
};

export interface AppState {
  income: number;
  frequency: Frequency;
  model: BudgetModel;
  currency: string;
  transactions: Transaction[];
}

/**
 * Synchronous initial state load for instant zero-flash DOM hydration.
 * Also initiates background IndexedDB synchronization and idempotent migration.
 */
export function loadStoredState(defaultLocale?: string | null): AppState {
  const getFallbackCurrency = () => {
    const activeLoc = defaultLocale || (typeof document !== 'undefined' ? document.documentElement?.dataset?.locale : null);
    return getLocaleDefaultCurrency(activeLoc);
  };

  if (typeof window === 'undefined') {
    return {
      income: 0,
      frequency: 'monthly',
      model: '50-30-20',
      currency: getFallbackCurrency(),
      transactions: []
    };
  }

  // Trigger background migration from localStorage to IndexedDB once per browser profile
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => {
      migrateLocalStorageToIndexedDB().catch((err) => {
        console.warn('[Storage] Background IDB migration warning:', err);
      });
    }, 100);
  }

  try {
    const rawIncome = localStorage.getItem(STORAGE_KEYS.INCOME);
    const rawFreq = localStorage.getItem(STORAGE_KEYS.FREQUENCY) as Frequency;
    const rawModel = localStorage.getItem(STORAGE_KEYS.MODEL) as BudgetModel;
    const rawCur = localStorage.getItem(STORAGE_KEYS.CURRENCY);
    const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

    // Preference Priority:
    // 1. Preserved saved preference if valid
    // 2. Fall back to locale-based default
    // 3. Fall back safely to USD
    let effectiveCurrency: string;
    if (rawCur && rawCur in SUPPORTED_CURRENCIES) {
      effectiveCurrency = rawCur;
    } else {
      effectiveCurrency = getFallbackCurrency();
    }

    return {
      income: rawIncome !== null ? parseFloat(rawIncome) || 0 : 4200,
      frequency: rawFreq || 'monthly',
      model: rawModel || '50-30-20',
      currency: effectiveCurrency,
      transactions: rawTx
        ? JSON.parse(rawTx)
        : [
            {
              id: 'tx-1',
              name: 'Apartment Rent',
              amount: 1350,
              category: 'Housing',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            },
            {
              id: 'tx-2',
              name: 'Weekly Supermarket Haul',
              amount: 380,
              category: 'Food',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            },
            {
              id: 'tx-3',
              name: 'Electric & High-Speed Internet',
              amount: 145,
              category: 'Utilities',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            },
            {
              id: 'tx-4',
              name: 'Car Gas & Metro Pass',
              amount: 160,
              category: 'Transport',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            },
            {
              id: 'tx-5',
              name: 'Streaming Subscriptions & Dining Out',
              amount: 120,
              category: 'Entertainment',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            },
            {
              id: 'tx-6',
              name: 'Emergency Fund Transfer',
              amount: 450,
              category: 'Savings',
              date: new Date().toISOString().split('T')[0],
              source: 'manual'
            }
          ]
    };
  } catch (e) {
    console.error('Failed to load state from localStorage:', e);
    return {
      income: 4200,
      frequency: 'monthly',
      model: '50-30-20',
      currency: getFallbackCurrency(),
      transactions: []
    };
  }
}

/**
 * Save profile and transaction state to synchronous localStorage cache
 * and asynchronously persist to IndexedDB.
 */
export function saveStoredState(state: Partial<AppState>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (state.income !== undefined) localStorage.setItem(STORAGE_KEYS.INCOME, state.income.toString());
    if (state.frequency !== undefined) localStorage.setItem(STORAGE_KEYS.FREQUENCY, state.frequency);
    if (state.model !== undefined) localStorage.setItem(STORAGE_KEYS.MODEL, state.model);
    if (state.currency !== undefined) localStorage.setItem(STORAGE_KEYS.CURRENCY, state.currency);
    if (state.transactions !== undefined) localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));

    // Asynchronously synchronize into IndexedDB
    if (isIndexedDBAvailable()) {
      if (state.transactions !== undefined) {
        saveAllTransactionsIDB(state.transactions).catch((err) => {
          console.warn('[Storage] Asynchronous IDB transactions sync warning:', err);
        });
      }
      if (state.income !== undefined || state.frequency !== undefined || state.model !== undefined || state.currency !== undefined) {
        saveProfileIDB({
          income: state.income,
          frequency: state.frequency,
          model: state.model,
          currency: state.currency
        }).catch((err) => {
          console.warn('[Storage] Asynchronous IDB profile sync warning:', err);
        });
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to save state to localStorage:', e);
    return false;
  }
}

/**
 * Persist debts to localStorage and IndexedDB
 */
export function saveDebtsStorage(debts: DebtItem[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
    if (isIndexedDBAvailable()) {
      saveAllDebtsIDB(debts).catch((err) => {
        console.warn('[Storage] Asynchronous IDB debts sync warning:', err);
      });
    }
    return true;
  } catch (e) {
    console.error('Failed to save debts to storage:', e);
    return false;
  }
}

/**
 * Persist goals to localStorage and IndexedDB
 */
export function saveGoalsStorage(goals: GoalItem[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    if (isIndexedDBAvailable()) {
      saveAllGoalsIDB(goals).catch((err) => {
        console.warn('[Storage] Asynchronous IDB goals sync warning:', err);
      });
    }
    return true;
  } catch (e) {
    console.error('Failed to save goals to storage:', e);
    return false;
  }
}

export function clearAllStoredData(): void {
  if (typeof window === 'undefined') return;
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    clearAllIndexedDBAndStorage().catch((err) => {
      console.warn('[Storage] Clear IDB warning:', err);
    });
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
}

/**
 * Trigger client-side download of complete financial backup (.json)
 */
export async function downloadBackupFile(): Promise<void> {
  const payload = await exportFullBackupPayload();
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `freexpensetracker-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToCSV(transactions: Transaction[], currencySymbol: string = '$'): void {
  const headers = ['Transaction ID', 'Date', 'Expense Description', 'Category', 'Type', `Amount (${currencySymbol})`, 'Source'];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    `"${t.name.replace(/"/g, '""')}"`,
    t.category,
    t.type || 'expense',
    t.amount.toFixed(2),
    t.source || 'manual'
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freexpensetracker-ledger-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBudgetToExcel(
  monthlyIncome: number,
  currencyCode: string,
  transactions: Transaction[],
  model: string = '50-30-20'
): void {
  try {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Monthly Summary
    const summaryRows = [
      ['FREE EXPENSE TRACKER - MONTHLY BUDGET WORKBOOK'],
      ['Domain: freexpensetracker.com | Generated on: ' + new Date().toLocaleDateString()],
      [],
      ['FINANCIAL OVERVIEW', 'AMOUNT (' + currencyCode + ')', 'NOTES'],
      ['Monthly Take-Home Income', monthlyIncome, 'Normalized monthly total'],
      ['Total Recorded Outflows', { f: 'SUM(Transactions!D2:D' + Math.max(2, transactions.length + 1) + ')' }, 'Auto calculated from ledger'],
      ['Net Monthly Cashflow', { f: 'B5-B6' }, 'Income remaining after expenses'],
      [],
      ['BUDGET FRAMEWORK: ' + model.toUpperCase()],
      ['Category Type', 'Target %', 'Target Amount', 'Actual Spent', 'Variance'],
      ['Needs / Essentials', '50%', { f: 'B5*0.5' }, { f: 'SUMIF(Transactions!C2:C500, "Housing", Transactions!D2:D500)+SUMIF(Transactions!C2:C500, "Food", Transactions!D2:D500)+SUMIF(Transactions!C2:C500, "Transport", Transactions!D2:D500)+SUMIF(Transactions!C2:C500, "Utilities", Transactions!D2:D500)' }, { f: 'C11-D11' }],
      ['Wants / Discretionary', '30%', { f: 'B5*0.3' }, { f: 'SUMIF(Transactions!C2:C500, "Entertainment", Transactions!D2:D500)+SUMIF(Transactions!C2:C500, "Miscellany", Transactions!D2:D500)' }, { f: 'C12-D12' }],
      ['Savings & Debt Acceleration', '20%', { f: 'B5*0.2' }, { f: 'SUMIF(Transactions!C2:C500, "Savings", Transactions!D2:D500)' }, { f: 'C13-D13' }]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Budget Summary');

    // Sheet 2: Transactions
    const txHeaders = ['Date', 'Description / Merchant', 'Category', 'Amount', 'Source'];
    const txDataRows = transactions.map((t) => [t.date, t.name, t.category, t.amount, t.source || 'manual']);

    const wsTransactions = XLSX.utils.aoa_to_sheet([txHeaders, ...txDataRows]);
    wsTransactions['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');

    XLSX.writeFile(wb, `freexpensetracker-workbook-${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Failed to generate Excel file:', err);
    exportTransactionsToCSV(transactions, '$');
  }
}
