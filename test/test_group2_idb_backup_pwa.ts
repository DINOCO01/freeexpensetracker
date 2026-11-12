/**
 * Free Expense Tracker — Group 2 Automated Verification Suite
 * Tests:
 * 1. PWA Manifests & Service Worker Configuration
 * 2. UI Integration (Backup & Restore buttons, File selector, Storage wrappers)
 * 3. Schema Validation & Backup/Restore Logic
 * 4. In-Memory Mock IndexedDB & Idempotent Migration
 * 5. Data Integrity & Rollback Protection
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  validateBackupPayload,
  exportFullBackupPayload,
  restoreFromBackupPayload,
  migrateLocalStorageToIndexedDB,
  clearAllIndexedDBAndStorage,
  STORES,
  DB_NAME,
  DB_VERSION,
  type BackupPayload,
  type ProfileState,
  type DebtItem,
  type GoalItem
} from '../src/utils/idb';
import type { Transaction } from '../src/utils/calculations';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    process.exit(1);
  }
}

console.log('=================================================================');
console.log('🧪 RUNNING GROUP 2: PWA + BACKUP/RESTORE + INDEXEDDB TEST SUITE');
console.log('=================================================================\n');

// ============================================================================
// 1. PWA MANIFEST & SERVICE WORKER VERIFICATION
// ============================================================================
console.log('--- 1. Testing PWA Manifests and Service Worker ---');

const manifestPaths = [
  path.resolve('public/site.webmanifest'),
  path.resolve('public/manifest.webmanifest')
];

for (const p of manifestPaths) {
  const filename = path.basename(p);
  assert(fs.existsSync(p), `Manifest exists at ${filename}`);
  const content = fs.readFileSync(p, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    parsed = null;
  }
  assert(parsed !== null, `${filename} is valid JSON`);
  assert(parsed.name === 'Free Expense Tracker', `${filename} has correct name`);
  assert(parsed.short_name === 'ExpenseTracker', `${filename} has correct short_name`);
  assert(parsed.start_url === '/', `${filename} has start_url: "/"`);
  assert(parsed.display === 'standalone', `${filename} has display: "standalone"`);
  assert(parsed.theme_color === '#059669', `${filename} has theme_color: "#059669"`);
  assert(parsed.background_color === '#ffffff', `${filename} has background_color: "#ffffff"`);
  assert(Array.isArray(parsed.icons) && parsed.icons.length >= 3, `${filename} contains sufficient icons`);
  const has192 = parsed.icons.some((i: any) => i.sizes === '192x192');
  const has512 = parsed.icons.some((i: any) => i.sizes === '512x512');
  const hasMaskable = parsed.icons.some((i: any) => i.purpose && i.purpose.includes('maskable'));
  assert(has192 && has512 && hasMaskable, `${filename} has 192, 512, and maskable icons`);
}

// Service Worker verification
const swPath = path.resolve('public/sw.js');
assert(fs.existsSync(swPath), 'public/sw.js exists');
const swContent = fs.readFileSync(swPath, 'utf-8');

assert(swContent.includes("CACHE_NAME = 'fet-pwa-v1'"), 'Service worker has versioned CACHE_NAME');
assert(swContent.includes("PRECACHE_ASSETS = ["), 'Service worker defines PRECACHE_ASSETS');
assert(swContent.includes("'/site.webmanifest'"), 'Precache includes /site.webmanifest');
assert(swContent.includes("'/favicon.svg'"), 'Precache includes /favicon.svg');
assert(swContent.includes("self.skipWaiting()"), 'Service worker calls skipWaiting()');
assert(swContent.includes("self.clients.claim()"), 'Service worker calls clients.claim()');
assert(swContent.includes("req.method !== 'GET'"), 'Service worker ignores non-GET requests');
assert(swContent.includes("googletagmanager.com") && swContent.includes("google-analytics.com"), 'Service worker explicitly skips caching analytics requests');
assert(swContent.includes("caches.delete"), 'Service worker purges outdated caches on activate');
assert(swContent.includes("caches.match('/')"), 'Service worker has offline fallback navigation to cached root');

// Layout registration verification
const layoutPath = path.resolve('src/layouts/Layout.astro');
const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
assert(layoutContent.includes("'serviceWorker' in navigator"), 'Layout.astro checks serviceWorker in navigator');
assert(layoutContent.includes("navigator.serviceWorker.register('/sw.js'"), 'Layout.astro registers /sw.js');
assert(layoutContent.includes('rel="manifest" href="/site.webmanifest"'), 'Layout.astro links site.webmanifest');

// ============================================================================
// 2. UI INTEGRATION VERIFICATION
// ============================================================================
console.log('\n--- 2. Testing UI Integration (Backup & Restore buttons, file selector) ---');

const ledgerPath = path.resolve('src/components/TransactionLedger.astro');
const ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
assert(ledgerContent.includes('id="btn-backup-json"'), 'TransactionLedger includes #btn-backup-json');
assert(ledgerContent.includes('id="btn-restore-json"'), 'TransactionLedger includes #btn-restore-json');
assert(ledgerContent.includes('id="input-restore-json"'), 'TransactionLedger includes hidden #input-restore-json file input');
assert(ledgerContent.includes('accept=".json,application/json"'), 'Restore file input accepts JSON');

const mainAppPath = path.resolve('src/components/MainApp.astro');
const mainAppContent = fs.readFileSync(mainAppPath, 'utf-8');
assert(mainAppContent.includes('downloadBackupFile'), 'MainApp imports downloadBackupFile');
assert(mainAppContent.includes('restoreFromBackupPayload'), 'MainApp imports restoreFromBackupPayload');
assert(mainAppContent.includes('saveDebtsStorage'), 'MainApp uses saveDebtsStorage wrapper');
assert(mainAppContent.includes('saveGoalsStorage'), 'MainApp uses saveGoalsStorage wrapper');
assert(mainAppContent.includes("document.getElementById('btn-backup-json')"), 'MainApp attaches click listener to backup button');
assert(mainAppContent.includes("document.getElementById('btn-restore-json')"), 'MainApp attaches click listener to restore button');
assert(mainAppContent.includes("document.getElementById('input-restore-json')"), 'MainApp attaches change listener to file input');
assert(mainAppContent.includes("confirm("), 'MainApp presents confirmation dialog with record counts before restore');

// ============================================================================
// 3. BACKUP PAYLOAD SCHEMA VALIDATION TESTS
// ============================================================================
console.log('\n--- 3. Testing Backup Schema Validation Engine ---');

const validMockPayload: BackupPayload = {
  $schema: 'https://freexpensetracker.com/schemas/backup-v1.json',
  app: 'FreeExpenseTracker',
  version: 1,
  exportedAt: new Date().toISOString(),
  data: {
    profile: {
      income: 5000,
      frequency: 'monthly',
      model: '50-30-20',
      currency: 'USD'
    },
    transactions: [
      { id: 'tx-1', date: '2027-01-15', name: 'Grocery Store', amount: 120.50, category: 'Groceries', type: 'expense' },
      { id: 'tx-2', date: '2027-01-20', name: 'Freelance Design', amount: 800, category: 'Side Hustle', type: 'income' }
    ],
    debts: [
      {
        id: 'debt-1',
        name: 'Auto Loan',
        originalPrincipal: 15000,
        currentOutstandingPrincipal: 8500,
        balance: 8500,
        interestRate: 4.5,
        rate: 4.5,
        monthlyEMI: 320,
        minimum: 320,
        paymentHistory: [],
        active: true,
        paidOff: false
      }
    ],
    goals: [
      {
        id: 'goal-1',
        name: 'Emergency Fund',
        target: 10000,
        current: 4500,
        monthly: 300,
        contributions: []
      }
    ]
  },
  summary: {
    transactionCount: 2,
    debtCount: 1,
    goalCount: 1,
    income: 5000,
    currency: 'USD'
  }
};

const validResult = validateBackupPayload(validMockPayload);
assert(validResult.valid === true, 'Valid payload passes validation');
assert(validResult.summary?.transactionCount === 2, 'Summary reports 2 transactions');
assert(validResult.summary?.debtCount === 1, 'Summary reports 1 debt');
assert(validResult.summary?.goalCount === 1, 'Summary reports 1 goal');

// Test rejections:
assert(validateBackupPayload(null).valid === false, 'Rejects null payload');
assert(validateBackupPayload('string').valid === false, 'Rejects string payload');
assert(validateBackupPayload({ app: 'OtherApp', version: 1, data: {} }).valid === false, 'Rejects wrong app identifier');
assert(validateBackupPayload({ app: 'FreeExpenseTracker', version: 2, data: {} }).valid === false, 'Rejects unsupported version 2');
assert(validateBackupPayload({ app: 'FreeExpenseTracker', version: 1 }).valid === false, 'Rejects payload missing data object');

// Malformed transactions
const invalidTxPayload1 = JSON.parse(JSON.stringify(validMockPayload));
invalidTxPayload1.data.transactions = 'not an array';
assert(validateBackupPayload(invalidTxPayload1).valid === false, 'Rejects non-array transactions');

const invalidTxPayload2 = JSON.parse(JSON.stringify(validMockPayload));
invalidTxPayload2.data.transactions[0].id = '';
assert(validateBackupPayload(invalidTxPayload2).valid === false, 'Rejects transaction with empty id');

const invalidTxPayload3 = JSON.parse(JSON.stringify(validMockPayload));
invalidTxPayload3.data.transactions[0].amount = 'invalid';
assert(validateBackupPayload(invalidTxPayload3).valid === false, 'Rejects transaction with non-numerical amount');

// Duplicate transaction ID rejection
const duplicateTxPayload = JSON.parse(JSON.stringify(validMockPayload));
duplicateTxPayload.data.transactions.push({
  id: 'tx-1', // DUPLICATE ID
  date: '2027-01-22',
  name: 'Duplicate Item',
  amount: 45,
  category: 'Other',
  type: 'expense'
});
const dupResult = validateBackupPayload(duplicateTxPayload);
assert(dupResult.valid === false, 'Rejects payload with duplicate transaction IDs');
assert(dupResult.error?.includes('Duplicate transaction ID') === true, 'Error message mentions duplicate transaction ID');

// Malformed debts / Duplicate debt ID
const dupDebtPayload = JSON.parse(JSON.stringify(validMockPayload));
dupDebtPayload.data.debts.push({
  id: 'debt-1', // DUPLICATE ID
  name: 'Duplicate Debt',
  originalPrincipal: 1000,
  currentOutstandingPrincipal: 1000,
  balance: 1000,
  interestRate: 5,
  rate: 5,
  monthlyEMI: 50,
  minimum: 50,
  paymentHistory: [],
  active: true,
  paidOff: false
});
assert(validateBackupPayload(dupDebtPayload).valid === false, 'Rejects payload with duplicate debt IDs');

// Malformed goals / Duplicate goal ID
const dupGoalPayload = JSON.parse(JSON.stringify(validMockPayload));
dupGoalPayload.data.goals.push({
  id: 'goal-1', // DUPLICATE ID
  name: 'Duplicate Goal',
  target: 5000,
  current: 1000,
  monthly: 100
});
assert(validateBackupPayload(dupGoalPayload).valid === false, 'Rejects payload with duplicate goal IDs');

// ============================================================================
// 4. IN-MEMORY INDEXEDDB & LOCALSTORAGE MOCK
// ============================================================================
console.log('\n--- 4. Setting Up In-Memory IndexedDB & localStorage Harness ---');

class MockLocalStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

class MockIDBRequest<T> {
  result: T = undefined as any;
  error: DOMException | null = null;
  onsuccess: ((ev: any) => any) | null = null;
  onerror: ((ev: any) => any) | null = null;
}

class MockIDBObjectStore {
  name: string;
  keyPath: string;
  indexes: Map<string, any> = new Map();
  private data: Map<any, any>;

  constructor(name: string, keyPath: string, storeData: Map<any, any>) {
    this.name = name;
    this.keyPath = keyPath;
    this.data = storeData;
  }

  createIndex(indexName: string, keyPath: string, options?: any) {
    this.indexes.set(indexName, { keyPath, options });
  }

  put(value: any): MockIDBRequest<any> {
    const req = new MockIDBRequest<any>();
    const key = value[this.keyPath];
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    req.result = key;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  get(key: any): MockIDBRequest<any> {
    const req = new MockIDBRequest<any>();
    const item = this.data.get(key);
    req.result = item !== undefined ? JSON.parse(JSON.stringify(item)) : undefined;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  getAll(): MockIDBRequest<any[]> {
    const req = new MockIDBRequest<any[]>();
    const all = Array.from(this.data.values()).map(v => JSON.parse(JSON.stringify(v)));
    req.result = all;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  count(): MockIDBRequest<number> {
    const req = new MockIDBRequest<number>();
    req.result = this.data.size;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  clear(): MockIDBRequest<undefined> {
    const req = new MockIDBRequest<undefined>();
    this.data.clear();
    req.result = undefined;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }
}

class MockIDBTransaction {
  stores: string[];
  mode: string;
  db: MockIDBDatabase;
  oncomplete: ((ev: any) => any) | null = null;
  onerror: ((ev: any) => any) | null = null;
  onabort: ((ev: any) => any) | null = null;
  error: any = null;

  constructor(db: MockIDBDatabase, storeNames: string | string[], mode: string) {
    this.db = db;
    this.stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    this.mode = mode;
    queueMicrotask(() => {
      this.oncomplete?.({ target: this });
    });
  }

  objectStore(name: string): MockIDBObjectStore {
    return this.db.getObjectStore(name);
  }
}

class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: { contains: (s: string) => boolean };
  private stores: Map<string, { keyPath: string; data: Map<any, any> }> = new Map();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = {
      contains: (s: string) => this.stores.has(s)
    };
  }

  createObjectStore(name: string, options: { keyPath: string }): MockIDBObjectStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, { keyPath: options.keyPath, data: new Map() });
    }
    return this.getObjectStore(name);
  }

  getObjectStore(name: string): MockIDBObjectStore {
    const s = this.stores.get(name);
    if (!s) throw new Error(`ObjectStore "${name}" not found`);
    return new MockIDBObjectStore(name, s.keyPath, s.data);
  }

  transaction(storeNames: string | string[], mode: string): MockIDBTransaction {
    return new MockIDBTransaction(this, storeNames, mode);
  }
}

class MockIDBFactory {
  databases: Map<string, MockIDBDatabase> = new Map();

  open(name: string, version: number) {
    const req = new MockIDBRequest<MockIDBDatabase>();
    let db = this.databases.get(name);
    const isNew = !db;
    if (!db) {
      db = new MockIDBDatabase(name, version);
      this.databases.set(name, db);
    }

    queueMicrotask(() => {
      if (isNew && typeof (req as any).onupgradeneeded === 'function') {
        (req as any).result = db;
        (req as any).onupgradeneeded({ target: req });
      }
      req.result = db!;
      req.onsuccess?.({ target: req });
    });
    return req;
  }
}

// Attach mocks to global environment
const mockStorage = new MockLocalStorage();
const mockIDB = new MockIDBFactory();

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = mockStorage;
(globalThis as any).indexedDB = mockIDB;

assert(typeof window !== 'undefined', 'window mock attached to globalThis');
assert(typeof localStorage !== 'undefined', 'localStorage mock attached to globalThis');
assert(typeof indexedDB !== 'undefined', 'indexedDB mock attached to globalThis');

// ============================================================================
// 5. MIGRATION & DATA INTEGRITY TESTS
// ============================================================================
console.log('\n--- 5. Testing Idempotent Migration from localStorage to IndexedDB ---');

async function runMigrationTests() {
  // Test A: Empty localStorage migration
  mockStorage.clear();
  const emptyRes = await migrateLocalStorageToIndexedDB();
  assert(emptyRes.migrated === true, 'Empty localStorage migration succeeds');
  assert(emptyRes.counts.transactions === 0, 'Empty migration: 0 transactions');
  assert(emptyRes.counts.debts === 0, 'Empty migration: 0 debts');
  assert(emptyRes.counts.goals === 0, 'Empty migration: 0 goals');
  assert(mockStorage.getItem('fet_migrated_to_idb') === 'true', 'Sets fet_migrated_to_idb in localStorage');

  // Test B: Idempotency check: Running again should report alreadyMigrated = true and not overwrite
  const secondRun = await migrateLocalStorageToIndexedDB();
  assert(secondRun.migrated === false, 'Second migration skips execution');
  assert(secondRun.alreadyMigrated === true, 'Second migration reports alreadyMigrated: true');

  // Clear mock database to test data migration with actual records
  mockIDB.databases.clear();
  mockStorage.clear();

  // Populate legacy localStorage keys
  const testTransactions: Transaction[] = [
    { id: 'tx-101', date: '2027-01-05', name: 'Supermarket Groceries', amount: 85.20, category: 'Groceries', type: 'expense' },
    { id: 'tx-102', date: '2027-01-10', name: 'Monthly Salary', amount: 3500, category: 'Salary', type: 'income' },
    { id: 'tx-103', date: '2027-01-14', name: 'Electric Bill', amount: 110, category: 'Utilities', type: 'expense' }
  ];
  const testDebts: DebtItem[] = [
    {
      id: 'debt-201',
      name: 'Credit Card',
      originalPrincipal: 3000,
      currentOutstandingPrincipal: 1500,
      balance: 1500,
      interestRate: 18.99,
      rate: 18.99,
      monthlyEMI: 120,
      minimum: 120,
      paymentHistory: [],
      active: true,
      paidOff: false
    }
  ];
  const testGoals: GoalItem[] = [
    {
      id: 'goal-301',
      name: 'Vacation',
      target: 2500,
      current: 1200,
      monthly: 150,
      contributions: []
    }
  ];

  mockStorage.setItem('fet_income_v4', '4800');
  mockStorage.setItem('fet_frequency_v4', 'biweekly');
  mockStorage.setItem('fet_model_v4', '80-20');
  mockStorage.setItem('fet_currency_v4', 'EUR');
  mockStorage.setItem('fet_transactions_v4', JSON.stringify(testTransactions));
  mockStorage.setItem('fet_debts_v4', JSON.stringify(testDebts));
  mockStorage.setItem('fet_goals_v4', JSON.stringify(testGoals));
  mockStorage.setItem('theme', 'dark');
  mockStorage.setItem('user_language', 'es');

  const populatedMigration = await migrateLocalStorageToIndexedDB();
  assert(populatedMigration.migrated === true, 'Populated migration succeeds');
  assert(populatedMigration.counts.transactions === 3, 'Migrated exactly 3 transactions');
  assert(populatedMigration.counts.debts === 1, 'Migrated exactly 1 debt');
  assert(populatedMigration.counts.goals === 1, 'Migrated exactly 1 goal');

  // Verify exported backup payload matches migrated data 100%
  const backup = await exportFullBackupPayload();
  assert(backup.app === 'FreeExpenseTracker', 'Export app is FreeExpenseTracker');
  assert(backup.version === 1, 'Export version is 1');
  assert(backup.summary.transactionCount === 3, 'Export summary transaction count is 3');
  assert(backup.summary.debtCount === 1, 'Export summary debt count is 1');
  assert(backup.summary.goalCount === 1, 'Export summary goal count is 1');
  assert(backup.summary.income === 4800, 'Export income matches 4800');
  assert(backup.summary.currency === 'EUR', 'Export currency matches EUR');
  assert(backup.data.transactions[0].name === 'Supermarket Groceries', 'Transaction contents preserved');
  assert(backup.data.debts[0].name === 'Credit Card', 'Debt contents preserved');
  assert(backup.data.goals[0].name === 'Vacation', 'Goal contents preserved');

  // Test C: Idempotency with populated data: re-running migration preserves data without duplicate records
  const reMigrate = await migrateLocalStorageToIndexedDB();
  assert(reMigrate.migrated === false && reMigrate.alreadyMigrated === true, 'Populated re-migration skips safely');
  assert(reMigrate.counts.transactions === 3, 'Transaction count remained 3');
  assert(reMigrate.counts.debts === 1, 'Debt count remained 1');
  assert(reMigrate.counts.goals === 1, 'Goal count remained 1');

  // ============================================================================
  // 6. ATOMIC RESTORE & ROLLBACK TESTS
  // ============================================================================
  console.log('\n--- 6. Testing Atomic Restore & Rollback Protection ---');

  // Create new dataset to restore
  const restorePayload: BackupPayload = {
    $schema: 'https://freexpensetracker.com/schemas/backup-v1.json',
    app: 'FreeExpenseTracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      profile: {
        income: 6200,
        frequency: 'monthly',
        model: '70-20-10',
        currency: 'GBP'
      },
      transactions: [
        { id: 'tx-new-1', date: '2027-02-01', name: 'Train Pass', amount: 145, category: 'Transport', type: 'expense' },
        { id: 'tx-new-2', date: '2027-02-05', name: 'Consulting Income', amount: 2500, category: 'Income', type: 'income' },
        { id: 'tx-new-3', date: '2027-02-08', name: 'Internet Fiber', amount: 55, category: 'Utilities', type: 'expense' },
        { id: 'tx-new-4', date: '2027-02-12', name: 'Dinner', amount: 72, category: 'Dining Out', type: 'expense' }
      ],
      debts: [
        {
          id: 'debt-new-1',
          name: 'Student Loan',
          originalPrincipal: 20000,
          currentOutstandingPrincipal: 12000,
          balance: 12000,
          interestRate: 3.5,
          rate: 3.5,
          monthlyEMI: 250,
          minimum: 250,
          paymentHistory: [],
          active: true,
          paidOff: false
        },
        {
          id: 'debt-new-2',
          name: 'Medical Bill',
          originalPrincipal: 1500,
          currentOutstandingPrincipal: 400,
          balance: 400,
          interestRate: 0,
          rate: 0,
          monthlyEMI: 100,
          minimum: 100,
          paymentHistory: [],
          active: true,
          paidOff: false
        }
      ],
      goals: [
        {
          id: 'goal-new-1',
          name: 'Home Down Payment',
          target: 50000,
          current: 18000,
          monthly: 800,
          contributions: []
        }
      ]
    },
    summary: {
      transactionCount: 4,
      debtCount: 2,
      goalCount: 1,
      income: 6200,
      currency: 'GBP'
    }
  };

  const restoreResult = await restoreFromBackupPayload(restorePayload);
  assert(restoreResult.success === true, 'Atomic restore returns success');

  // Verify IDB stores were atomically updated
  const updatedBackup = await exportFullBackupPayload();
  assert(updatedBackup.summary.transactionCount === 4, 'Restored 4 transactions in IDB');
  assert(updatedBackup.summary.debtCount === 2, 'Restored 2 debts in IDB');
  assert(updatedBackup.summary.goalCount === 1, 'Restored 1 goal in IDB');
  assert(updatedBackup.summary.income === 6200, 'Restored income is 6200');
  assert(updatedBackup.summary.currency === 'GBP', 'Restored currency is GBP');

  // Verify localStorage mirror is updated synchronously
  assert(mockStorage.getItem('fet_income_v4') === '6200', 'localStorage mirror income is 6200');
  assert(mockStorage.getItem('fet_currency_v4') === 'GBP', 'localStorage mirror currency is GBP');
  const mirroredTx = JSON.parse(mockStorage.getItem('fet_transactions_v4') || '[]');
  assert(mirroredTx.length === 4, 'localStorage mirror has 4 transactions');

  // Test Rollback: attempt restoring a corrupt payload with duplicate IDs
  const corruptPayload = JSON.parse(JSON.stringify(restorePayload));
  corruptPayload.data.transactions[1].id = 'tx-new-1'; // Intentional duplicate ID

  const corruptResult = await restoreFromBackupPayload(corruptPayload);
  assert(corruptResult.success === false, 'Corrupt restore is rejected');
  assert(corruptResult.error?.includes('Duplicate') === true, 'Rejection explains duplicate ID');

  // Check that existing state was NOT corrupted or altered
  const protectedBackup = await exportFullBackupPayload();
  assert(protectedBackup.summary.transactionCount === 4, 'Data protected: transaction count remains 4');
  assert(protectedBackup.summary.income === 6200, 'Data protected: income remains 6200');
  assert(protectedBackup.data.transactions[0].id === 'tx-new-1', 'First transaction still tx-new-1');
  assert(protectedBackup.data.transactions[1].id === 'tx-new-2', 'Second transaction unchanged');

  // ============================================================================
  // 7. FACTORY RESET TESTS
  // ============================================================================
  console.log('\n--- 7. Testing Factory Reset (clearAllIndexedDBAndStorage) ---');
  await clearAllIndexedDBAndStorage();

  const resetBackup = await exportFullBackupPayload();
  assert(resetBackup.summary.transactionCount === 0, 'Transactions store cleared');
  assert(resetBackup.summary.debtCount === 0, 'Debts store cleared');
  assert(resetBackup.summary.goalCount === 0, 'Goals store cleared');
  assert(mockStorage.getItem('fet_transactions_v4') === null, 'localStorage transactions removed');
  assert(mockStorage.getItem('fet_debts_v4') === null, 'localStorage debts removed');
  assert(mockStorage.getItem('fet_goals_v4') === null, 'localStorage goals removed');

  console.log('\n=================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests} / ${totalTests} ASSERTIONS VERIFIED!`);
  console.log('=================================================================\n');
}

runMigrationTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
