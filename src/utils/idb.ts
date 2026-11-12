/**
 * Free Expense Tracker — IndexedDB Architecture & Migration Layer
 * Database: FreeExpenseTrackerDB (Version 1)
 *
 * Object Stores:
 *  - 'transactions' (keyPath: 'id') [Indexes: 'date', 'category', 'type']
 *  - 'debts'        (keyPath: 'id') [Indexes: 'name', 'active']
 *  - 'goals'        (keyPath: 'id') [Indexes: 'name']
 *  - 'profile'      (keyPath: 'key')
 *  - 'meta'         (keyPath: 'key')
 *
 * Privacy rule: 100% Client-Side on the user device. Zero server transmission.
 */

import type { Frequency, BudgetModel, Transaction } from './calculations';

export interface DebtPaymentRecord {
  id: string;
  date: string;
  month: string;
  totalPayment: number;
  principalPaid: number;
  interestPaid: number;
  extraPrepayment: number;
  notes?: string;
}

export interface DebtItem {
  id: string;
  name: string;
  debtName?: string;
  originalPrincipal: number;
  currentOutstandingPrincipal: number;
  balance: number;
  interestRate: number;
  rate: number;
  monthlyEMI: number;
  minimum: number;
  paymentHistory: DebtPaymentRecord[];
  active: boolean;
  paidOff: boolean;
}

export interface GoalContribution {
  id: string;
  date: string;
  month: string;
  planned: number;
  actual: number;
}

export interface GoalItem {
  id: string;
  name: string;
  target: number;
  current: number;
  initialAmount?: number;
  monthly: number;
  contributions?: GoalContribution[];
}

export interface ProfileState {
  income: number;
  frequency: Frequency;
  model: BudgetModel;
  currency: string;
  debtSettings?: {
    strategy: 'avalanche' | 'snowball' | 'foir';
    extraMonthlyPayment: number;
  };
  settings?: {
    theme?: 'light' | 'dark';
    language?: string;
  };
}

export interface BackupPayload {
  $schema: string;
  app: string;
  version: number;
  exportedAt: string;
  data: {
    profile: ProfileState;
    transactions: Transaction[];
    debts: DebtItem[];
    goals: GoalItem[];
  };
  summary: {
    transactionCount: number;
    debtCount: number;
    goalCount: number;
    income: number;
    currency: string;
  };
}

export const DB_NAME = 'FreeExpenseTrackerDB';
export const DB_VERSION = 1;

export const STORES = {
  TRANSACTIONS: 'transactions',
  DEBTS: 'debts',
  GOALS: 'goals',
  PROFILE: 'profile',
  META: 'meta'
} as const;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Open (or create) the FreeExpenseTrackerDB IndexedDB instance.
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not supported or accessible in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Transactions Store
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('category', 'category', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
      }

      // 2. Debts Store
      if (!db.objectStoreNames.contains(STORES.DEBTS)) {
        const debtStore = db.createObjectStore(STORES.DEBTS, { keyPath: 'id' });
        debtStore.createIndex('name', 'name', { unique: false });
        debtStore.createIndex('active', 'active', { unique: false });
      }

      // 3. Goals Store
      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goalStore = db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
        goalStore.createIndex('name', 'name', { unique: false });
      }

      // 4. Profile Store
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'key' });
      }

      // 5. Metadata Store
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open FreeExpenseTrackerDB.'));
  });
}

/**
 * Generic promise wrapper for an IDBRequest
 */
function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// DATA ACCESS METHODS
// ---------------------------------------------------------------------------

export async function getAllTransactionsIDB(): Promise<Transaction[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.TRANSACTIONS, 'readonly');
  const store = tx.objectStore(STORES.TRANSACTIONS);
  return idbReq(store.getAll());
}

export async function saveAllTransactionsIDB(transactions: Transaction[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSACTIONS);

    store.clear();
    for (const t of transactions) {
      store.put(t);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function getAllDebtsIDB(): Promise<DebtItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.DEBTS, 'readonly');
  const store = tx.objectStore(STORES.DEBTS);
  return idbReq(store.getAll());
}

export async function saveAllDebtsIDB(debts: DebtItem[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.DEBTS, 'readwrite');
    const store = tx.objectStore(STORES.DEBTS);

    store.clear();
    for (const d of debts) {
      store.put(d);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Debts save aborted'));
  });
}

export async function getAllGoalsIDB(): Promise<GoalItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.GOALS, 'readonly');
  const store = tx.objectStore(STORES.GOALS);
  return idbReq(store.getAll());
}

export async function saveAllGoalsIDB(goals: GoalItem[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GOALS, 'readwrite');
    const store = tx.objectStore(STORES.GOALS);

    store.clear();
    for (const g of goals) {
      store.put(g);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Goals save aborted'));
  });
}

export async function getProfileIDB(): Promise<ProfileState> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.PROFILE, 'readonly');
  const store = tx.objectStore(STORES.PROFILE);
  const records: { key: string; value: any }[] = await idbReq(store.getAll());

  const profileMap: Record<string, any> = {};
  for (const r of records) {
    profileMap[r.key] = r.value;
  }

  return {
    income: typeof profileMap['income'] === 'number' ? profileMap['income'] : 4200,
    frequency: profileMap['frequency'] || 'monthly',
    model: profileMap['model'] || '50-30-20',
    currency: profileMap['currency'] || 'USD',
    debtSettings: profileMap['debtSettings'],
    settings: profileMap['settings']
  };
}

export async function saveProfileIDB(profile: Partial<ProfileState>): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROFILE, 'readwrite');
    const store = tx.objectStore(STORES.PROFILE);

    if (profile.income !== undefined) store.put({ key: 'income', value: profile.income });
    if (profile.frequency !== undefined) store.put({ key: 'frequency', value: profile.frequency });
    if (profile.model !== undefined) store.put({ key: 'model', value: profile.model });
    if (profile.currency !== undefined) store.put({ key: 'currency', value: profile.currency });
    if (profile.debtSettings !== undefined) store.put({ key: 'debtSettings', value: profile.debtSettings });
    if (profile.settings !== undefined) store.put({ key: 'settings', value: profile.settings });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMetaIDB(key: string): Promise<any> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.META, 'readonly');
  const store = tx.objectStore(STORES.META);
  const record = await idbReq(store.get(key));
  return record ? record.value : undefined;
}

export async function setMetaIDB(key: string, value: any): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.META, 'readwrite');
  const store = tx.objectStore(STORES.META);
  await idbReq(store.put({ key, value }));
}

// ---------------------------------------------------------------------------
// IDEMPOTENT MIGRATION FROM LOCALSTORAGE TO INDEXEDDB
// ---------------------------------------------------------------------------

export interface MigrationReport {
  migrated: boolean;
  alreadyMigrated?: boolean;
  counts: {
    transactions: number;
    debts: number;
    goals: number;
  };
  error?: string;
}

/**
 * Migrate all user data from legacy localStorage keys to IndexedDB.
 * Completely idempotent: if migration was previously performed and verified,
 * it safely skips to avoid duplicate overwrites.
 */
export async function migrateLocalStorageToIndexedDB(): Promise<MigrationReport> {
  if (!isIndexedDBAvailable()) {
    return {
      migrated: false,
      counts: { transactions: 0, debts: 0, goals: 0 },
      error: 'IndexedDB not available in current environment'
    };
  }

  try {
    const db = await openDatabase();

    // Check if migration has already been completed in metadata
    const metaTx = db.transaction(STORES.META, 'readonly');
    const metaStore = metaTx.objectStore(STORES.META);
    const existingMeta = await idbReq(metaStore.get('migration_completed'));

    if (existingMeta && existingMeta.value === true) {
      // Check existing counts
      const txCount = await idbReq(db.transaction(STORES.TRANSACTIONS, 'readonly').objectStore(STORES.TRANSACTIONS).count());
      const debtCount = await idbReq(db.transaction(STORES.DEBTS, 'readonly').objectStore(STORES.DEBTS).count());
      const goalCount = await idbReq(db.transaction(STORES.GOALS, 'readonly').objectStore(STORES.GOALS).count());

      return {
        migrated: false,
        alreadyMigrated: true,
        counts: { transactions: txCount, debts: debtCount, goals: goalCount }
      };
    }

    // Read legacy localStorage keys
    const rawIncome = localStorage.getItem('fet_income_v4');
    const rawFreq = localStorage.getItem('fet_frequency_v4');
    const rawModel = localStorage.getItem('fet_model_v4');
    const rawCur = localStorage.getItem('fet_currency_v4');
    const rawTx = localStorage.getItem('fet_transactions_v4');
    const rawDebts = localStorage.getItem('fet_debts_v4');
    const rawGoals = localStorage.getItem('fet_goals_v4');
    const rawTheme = localStorage.getItem('theme');
    const rawLang = localStorage.getItem('user_language');

    const transactions: Transaction[] = rawTx ? JSON.parse(rawTx) : [];
    const debts: DebtItem[] = rawDebts ? JSON.parse(rawDebts) : [];
    const goals: GoalItem[] = rawGoals ? JSON.parse(rawGoals) : [];
    const income = rawIncome !== null ? parseFloat(rawIncome) || 0 : 4200;
    const frequency = (rawFreq as Frequency) || 'monthly';
    const model = (rawModel as BudgetModel) || '50-30-20';
    const currency = rawCur || 'USD';

    // Perform atomic multi-store write
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.PROFILE, STORES.TRANSACTIONS, STORES.DEBTS, STORES.GOALS, STORES.META],
        'readwrite'
      );

      const profileStore = tx.objectStore(STORES.PROFILE);
      profileStore.put({ key: 'income', value: income });
      profileStore.put({ key: 'frequency', value: frequency });
      profileStore.put({ key: 'model', value: model });
      profileStore.put({ key: 'currency', value: currency });
      profileStore.put({
        key: 'settings',
        value: { theme: rawTheme || 'light', language: rawLang || 'en' }
      });

      const txStore = tx.objectStore(STORES.TRANSACTIONS);
      for (const t of transactions) {
        txStore.put(t);
      }

      const debtStore = tx.objectStore(STORES.DEBTS);
      for (const d of debts) {
        debtStore.put(d);
      }

      const goalStore = tx.objectStore(STORES.GOALS);
      for (const g of goals) {
        goalStore.put(g);
      }

      const metaStore = tx.objectStore(STORES.META);
      metaStore.put({ key: 'migration_completed', value: true });
      metaStore.put({ key: 'migrated_at', value: new Date().toISOString() });
      metaStore.put({ key: 'source', value: 'localStorage_v4' });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Migration transaction aborted'));
    });

    // Mark migration flag in localStorage as well (retaining original data for safety)
    try {
      localStorage.setItem('fet_migrated_to_idb', 'true');
    } catch (_) {}

    return {
      migrated: true,
      counts: {
        transactions: transactions.length,
        debts: debts.length,
        goals: goals.length
      }
    };
  } catch (err: any) {
    console.error('[IDB Migration Error]:', err);
    return {
      migrated: false,
      counts: { transactions: 0, debts: 0, goals: 0 },
      error: err?.message || String(err)
    };
  }
}

// ---------------------------------------------------------------------------
// BACKUP AND RESTORE ENGINE
// ---------------------------------------------------------------------------

/**
 * Generate full downloadable JSON backup payload of all user financial records.
 */
export async function exportFullBackupPayload(): Promise<BackupPayload> {
  let profile: ProfileState = {
    income: 4200,
    frequency: 'monthly',
    model: '50-30-20',
    currency: 'USD'
  };
  let transactions: Transaction[] = [];
  let debts: DebtItem[] = [];
  let goals: GoalItem[] = [];

  if (isIndexedDBAvailable()) {
    try {
      profile = await getProfileIDB();
      transactions = await getAllTransactionsIDB();
      debts = await getAllDebtsIDB();
      goals = await getAllGoalsIDB();
    } catch (e) {
      console.warn('[Backup] IDB read failed, falling back to localStorage:', e);
    }
  }

  // If IDB returned empty or failed, pull from localStorage
  if (transactions.length === 0 && typeof window !== 'undefined') {
    const rawTx = localStorage.getItem('fet_transactions_v4');
    if (rawTx) {
      try { transactions = JSON.parse(rawTx); } catch (_) {}
    }
    const rawDebts = localStorage.getItem('fet_debts_v4');
    if (rawDebts) {
      try { debts = JSON.parse(rawDebts); } catch (_) {}
    }
    const rawGoals = localStorage.getItem('fet_goals_v4');
    if (rawGoals) {
      try { goals = JSON.parse(rawGoals); } catch (_) {}
    }
    const rawIncome = localStorage.getItem('fet_income_v4');
    if (rawIncome) profile.income = parseFloat(rawIncome) || 4200;
    const rawCur = localStorage.getItem('fet_currency_v4');
    if (rawCur) profile.currency = rawCur;
  }

  return {
    $schema: 'https://freexpensetracker.com/schemas/backup-v1.json',
    app: 'FreeExpenseTracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      profile,
      transactions,
      debts,
      goals
    },
    summary: {
      transactionCount: transactions.length,
      debtCount: debts.length,
      goalCount: goals.length,
      income: profile.income,
      currency: profile.currency
    }
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  summary?: {
    transactionCount: number;
    debtCount: number;
    goalCount: number;
    exportedAt?: string;
  };
}

/**
 * Thoroughly validate an imported backup JSON payload before writing anything to disk.
 */
export function validateBackupPayload(parsed: any): ValidationResult {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Backup file does not contain a valid JSON object.' };
  }

  if (parsed.app !== 'FreeExpenseTracker') {
    return { valid: false, error: 'Unrecognized backup file. Missing "app": "FreeExpenseTracker".' };
  }

  if (parsed.version !== 1) {
    return { valid: false, error: `Unsupported backup schema version: ${parsed.version}. Expected version 1.` };
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    return { valid: false, error: 'Corrupt backup file: missing required "data" section.' };
  }

  const { transactions, debts, goals, profile } = parsed.data;

  // Validate transactions
  if (transactions !== undefined) {
    if (!Array.isArray(transactions)) {
      return { valid: false, error: 'Malformed backup: "transactions" must be an array.' };
    }
    const seenTxIds = new Set<string>();
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t || typeof t !== 'object') {
        return { valid: false, error: `Malformed transaction at index ${i}.` };
      }
      if (!t.id || typeof t.id !== 'string') {
        return { valid: false, error: `Transaction at index ${i} is missing a valid string "id".` };
      }
      if (seenTxIds.has(t.id)) {
        return { valid: false, error: `Duplicate transaction ID found: "${t.id}".` };
      }
      seenTxIds.add(t.id);

      if (typeof t.name !== 'string') {
        return { valid: false, error: `Transaction "${t.id}" has invalid description/merchant name.` };
      }
      if (typeof t.amount !== 'number' || isNaN(t.amount)) {
        return { valid: false, error: `Transaction "${t.id}" has invalid numerical amount.` };
      }
    }
  }

  // Validate debts
  if (debts !== undefined) {
    if (!Array.isArray(debts)) {
      return { valid: false, error: 'Malformed backup: "debts" must be an array.' };
    }
    const seenDebtIds = new Set<string>();
    for (let i = 0; i < debts.length; i++) {
      const d = debts[i];
      if (!d || typeof d !== 'object') {
        return { valid: false, error: `Malformed debt at index ${i}.` };
      }
      if (!d.id || typeof d.id !== 'string') {
        return { valid: false, error: `Debt at index ${i} is missing a valid string "id".` };
      }
      if (seenDebtIds.has(d.id)) {
        return { valid: false, error: `Duplicate debt ID found: "${d.id}".` };
      }
      seenDebtIds.add(d.id);
    }
  }

  // Validate goals
  if (goals !== undefined) {
    if (!Array.isArray(goals)) {
      return { valid: false, error: 'Malformed backup: "goals" must be an array.' };
    }
    const seenGoalIds = new Set<string>();
    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      if (!g || typeof g !== 'object') {
        return { valid: false, error: `Malformed goal at index ${i}.` };
      }
      if (!g.id || typeof g.id !== 'string') {
        return { valid: false, error: `Goal at index ${i} is missing a valid string "id".` };
      }
      if (seenGoalIds.has(g.id)) {
        return { valid: false, error: `Duplicate goal ID found: "${g.id}".` };
      }
      seenGoalIds.add(g.id);
    }
  }

  // Validate profile
  if (profile !== undefined) {
    if (typeof profile !== 'object') {
      return { valid: false, error: 'Malformed backup: "profile" must be an object.' };
    }
    if (profile.income !== undefined && (typeof profile.income !== 'number' || isNaN(profile.income))) {
      return { valid: false, error: 'Malformed profile: "income" must be a valid number.' };
    }
  }

  return {
    valid: true,
    summary: {
      transactionCount: Array.isArray(transactions) ? transactions.length : 0,
      debtCount: Array.isArray(debts) ? debts.length : 0,
      goalCount: Array.isArray(goals) ? goals.length : 0,
      exportedAt: parsed.exportedAt
    }
  };
}

/**
 * Atomically restore user financial records from validated backup payload.
 */
export async function restoreFromBackupPayload(payload: BackupPayload): Promise<{ success: boolean; error?: string }> {
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { data } = payload;
  const transactions = data.transactions || [];
  const debts = data.debts || [];
  const goals = data.goals || [];
  const profile = data.profile || {
    income: 4200,
    frequency: 'monthly',
    model: '50-30-20',
    currency: 'USD'
  };

  // 1. Restore to IndexedDB (if supported)
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          [STORES.PROFILE, STORES.TRANSACTIONS, STORES.DEBTS, STORES.GOALS, STORES.META],
          'readwrite'
        );

        // Clear existing stores
        tx.objectStore(STORES.TRANSACTIONS).clear();
        tx.objectStore(STORES.DEBTS).clear();
        tx.objectStore(STORES.GOALS).clear();
        tx.objectStore(STORES.PROFILE).clear();

        // Populate profile
        const profileStore = tx.objectStore(STORES.PROFILE);
        profileStore.put({ key: 'income', value: profile.income });
        profileStore.put({ key: 'frequency', value: profile.frequency });
        profileStore.put({ key: 'model', value: profile.model });
        profileStore.put({ key: 'currency', value: profile.currency });
        if (profile.debtSettings) profileStore.put({ key: 'debtSettings', value: profile.debtSettings });
        if (profile.settings) profileStore.put({ key: 'settings', value: profile.settings });

        // Populate transactions
        const txStore = tx.objectStore(STORES.TRANSACTIONS);
        for (const t of transactions) {
          txStore.put(t);
        }

        // Populate debts
        const debtStore = tx.objectStore(STORES.DEBTS);
        for (const d of debts) {
          debtStore.put(d);
        }

        // Populate goals
        const goalStore = tx.objectStore(STORES.GOALS);
        for (const g of goals) {
          goalStore.put(g);
        }

        // Record restore meta
        const metaStore = tx.objectStore(STORES.META);
        metaStore.put({ key: 'last_restored_at', value: new Date().toISOString() });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Restore transaction aborted'));
      });
    } catch (err: any) {
      console.error('[Restore IDB Error]:', err);
      return { success: false, error: `Failed restoring to IndexedDB: ${err?.message || err}` };
    }
  }

  // 2. Mirror into localStorage cache
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('fet_income_v4', String(profile.income ?? 4200));
      localStorage.setItem('fet_frequency_v4', profile.frequency || 'monthly');
      localStorage.setItem('fet_model_v4', profile.model || '50-30-20');
      localStorage.setItem('fet_currency_v4', profile.currency || 'USD');
      localStorage.setItem('fet_transactions_v4', JSON.stringify(transactions));
      localStorage.setItem('fet_debts_v4', JSON.stringify(debts));
      localStorage.setItem('fet_goals_v4', JSON.stringify(goals));
      if (profile.settings?.theme) localStorage.setItem('theme', profile.settings.theme);
      if (profile.settings?.language) localStorage.setItem('user_language', profile.settings.language);
    } catch (e) {
      console.warn('[Restore LocalStorage Mirror Warning]:', e);
    }
  }

  return { success: true };
}

/**
 * Wipe all user data from both IndexedDB and localStorage (for factory reset)
 */
export async function clearAllIndexedDBAndStorage(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          [STORES.PROFILE, STORES.TRANSACTIONS, STORES.DEBTS, STORES.GOALS, STORES.META],
          'readwrite'
        );
        tx.objectStore(STORES.TRANSACTIONS).clear();
        tx.objectStore(STORES.DEBTS).clear();
        tx.objectStore(STORES.GOALS).clear();
        tx.objectStore(STORES.PROFILE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[Clear IDB Warning]:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const keys = [
      'fet_income_v4',
      'fet_frequency_v4',
      'fet_model_v4',
      'fet_currency_v4',
      'fet_transactions_v4',
      'fet_debts_v4',
      'fet_goals_v4',
      'fet_migrated_to_idb'
    ];
    keys.forEach((k) => localStorage.removeItem(k));
  }
}

