import assert from 'assert';
import {
  parseToMinorUnits,
  minorToMajorUnits,
  distributeEvenly,
  distributeProportionally,
  calculatePercentage,
  getCurrencyMeta
} from '../../src/utils/bill-splitter/money.js';
import {
  formatMoney,
  formatPercent
} from '../../src/utils/bill-splitter/formatting.js';
import {
  calculateEvenSplit,
  calculateItemizedSplit
} from '../../src/utils/bill-splitter/calculations.js';
import {
  calculateTripSplit,
  computeGreedySettlement
} from '../../src/utils/bill-splitter/settlements.js';
import {
  getDefaultState,
  loadStoredState,
  saveStoredState,
  resetStoredState
} from '../../src/utils/bill-splitter/storage.js';
import {
  generateEvenSplitShareText,
  generateItemizedSplitShareText,
  generateTripSplitShareText,
  getWhatsAppShareUrl
} from '../../src/utils/bill-splitter/sharing.js';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(err);
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING BILL SPLITTER FINANCIAL ENGINE TESTS');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// 1. MONEY & PRECISION TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Money & Precision Engine ---');

it('parses standard decimal monetary inputs without float error', () => {
  assert.strictEqual(parseToMinorUnits('10.50', 'USD'), 1050);
  assert.strictEqual(parseToMinorUnits('1.14', 'USD'), 114);
  assert.strictEqual(parseToMinorUnits('₹2,400.00', 'INR'), 240000);
  assert.strictEqual(parseToMinorUnits('2400', 'INR'), 240000);
});

it('parses European comma decimal inputs correctly', () => {
  assert.strictEqual(parseToMinorUnits('1.250,50', 'EUR'), 125050);
  assert.strictEqual(parseToMinorUnits('12,50', 'EUR'), 1250);
});

it('handles zero-decimal currencies like JPY correctly', () => {
  assert.strictEqual(parseToMinorUnits('1500', 'JPY'), 1500);
  assert.strictEqual(parseToMinorUnits('1500.80', 'JPY'), 1500);
  assert.strictEqual(getCurrencyMeta('JPY').decimals, 0);
});

it('rejects negative, empty, or invalid inputs safely', () => {
  assert.strictEqual(parseToMinorUnits('-50.00', 'USD'), 0);
  assert.strictEqual(parseToMinorUnits('', 'USD'), 0);
  assert.strictEqual(parseToMinorUnits(null, 'USD'), 0);
  assert.strictEqual(parseToMinorUnits('abc', 'USD'), 0);
});

it('converts minor units back to major units accurately', () => {
  assert.strictEqual(minorToMajorUnits(1050, 'USD'), 10.5);
  assert.strictEqual(minorToMajorUnits(240000, 'INR'), 2400);
  assert.strictEqual(minorToMajorUnits(1500, 'JPY'), 1500);
});

it('distributes remainder deterministically for ₹1,000 between 3 people', () => {
  // ₹1,000 = 100,000 paise. 100,000 / 3 = 33,333.333...
  // Person 1 gets 33334, Person 2 gets 33333, Person 3 gets 33333
  const shares = distributeEvenly(100000, 3);
  assert.deepStrictEqual(shares, [33334, 33333, 33333]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 100000);
});

it('distributes minimal amount ₹0.01 between 3 people without loss', () => {
  // 1 minor unit among 3: [1, 0, 0]
  const shares = distributeEvenly(1, 3);
  assert.deepStrictEqual(shares, [1, 0, 0]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 1);
});

it('handles 1 participant and 0 amount in distributeEvenly', () => {
  assert.deepStrictEqual(distributeEvenly(5000, 1), [5000]);
  assert.deepStrictEqual(distributeEvenly(0, 3), [0, 0, 0]);
});

it('distributes proportionally using Largest Remainder Method without drift', () => {
  // Allocate 100 minor units to weights [500, 300] (sum 800)
  // Person A: 500/800 * 100 = 62.5 -> floor 62, frac 0.5
  // Person B: 300/800 * 100 = 37.5 -> floor 37, frac 0.5
  // Person A gets tie-break +1 -> [63, 37]. Sum = 100!
  const allocated = distributeProportionally(100, [500, 300]);
  assert.deepStrictEqual(allocated, [63, 37]);
  assert.strictEqual(allocated.reduce((a, b) => a + b, 0), 100);
});

// -----------------------------------------------------------------------------
// 2. MODE 1: EVEN SPLIT TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Mode 1: Even Split ---');

it('calculates prompt example: ₹2,400 with 5% tax and 10% tip among 4 people', () => {
  const result = calculateEvenSplit({
    billAmountMinor: 240000, // ₹2,400
    participants: [
      { id: '1', name: 'Rahul' },
      { id: '2', name: 'Neha' },
      { id: '3', name: 'Aman' },
      { id: '4', name: 'Priya' }
    ],
    taxRatePct: 5,
    tipRatePct: 10,
    tipOnBillAndTax: false,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.taxAmountMinor, 12000); // ₹120
  assert.strictEqual(result.tipAmountMinor, 24000); // ₹240
  assert.strictEqual(result.finalTotalMinor, 276000); // ₹2,760
  assert.strictEqual(result.baseShareMinor, 69000); // ₹690
  assert.strictEqual(result.hasRoundingDifference, false);
  assert.strictEqual(result.shares.length, 4);
  result.shares.forEach(s => assert.strictEqual(s.shareMinor, 69000));
  assert.strictEqual(result.shares.reduce((sum, s) => sum + s.shareMinor, 0), result.finalTotalMinor);
});

it('calculates tip on bill + tax when toggle is enabled', () => {
  const result = calculateEvenSplit({
    billAmountMinor: 240000, // ₹2,400
    participants: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
    taxRatePct: 5, // Tax = ₹120 (12000 minor)
    tipRatePct: 10, // Tip on (2400 + 120) = 10% of 2520 = ₹252 (25200 minor)
    tipOnBillAndTax: true,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.taxAmountMinor, 12000);
  assert.strictEqual(result.tipAmountMinor, 25200);
  assert.strictEqual(result.finalTotalMinor, 277200);
  assert.strictEqual(result.shares[0].shareMinor, 138600);
  assert.strictEqual(result.shares[1].shareMinor, 138600);
});

it('handles zero tax, zero tip, and single participant', () => {
  const result = calculateEvenSplit({
    billAmountMinor: 150000,
    participants: [{ id: '1', name: 'Solo' }],
    taxRatePct: 0,
    tipRatePct: 0,
    tipOnBillAndTax: false,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.finalTotalMinor, 150000);
  assert.strictEqual(result.shares[0].shareMinor, 150000);
});

it('calculates JPY zero-decimal even split accurately', () => {
  const result = calculateEvenSplit({
    billAmountMinor: 10000, // ¥10,000
    participants: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }],
    taxRatePct: 10, // ¥1,000
    tipRatePct: 0,
    tipOnBillAndTax: false,
    currencyCode: 'JPY'
  });

  // Total: ¥11,000 / 3 = ¥3667, ¥3667, ¥3666
  assert.strictEqual(result.finalTotalMinor, 11000);
  assert.strictEqual(result.shares[0].shareMinor, 3667);
  assert.strictEqual(result.shares[1].shareMinor, 3667);
  assert.strictEqual(result.shares[2].shareMinor, 3666);
  assert.strictEqual(result.shares.reduce((sum, s) => sum + s.shareMinor, 0), 11000);
});

// -----------------------------------------------------------------------------
// 3. MODE 2: ITEMIZED SPLIT TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Mode 2: Itemized Split ---');

it('calculates prompt example: Person A (₹500), Person B (₹300) with proportional tax ₹80', () => {
  const result = calculateItemizedSplit({
    items: [
      { id: 'i1', name: 'Pizza', priceMinor: 50000, participantIds: ['p1'] },
      { id: 'i2', name: 'Burger', priceMinor: 30000, participantIds: ['p2'] }
    ],
    participants: [
      { id: 'p1', name: 'Person A' },
      { id: 'p2', name: 'Person B' }
    ],
    taxType: 'fixed',
    taxValue: 8000, // ₹80 fixed tax
    tipType: 'percentage',
    tipValue: 0,
    tipOnTax: false,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.itemsTotalMinor, 80000); // ₹800
  assert.strictEqual(result.taxAmountMinor, 8000); // ₹80
  assert.strictEqual(result.grandTotalMinor, 88000); // ₹880

  const pA = result.participantBreakdowns.find(p => p.participantId === 'p1');
  const pB = result.participantBreakdowns.find(p => p.participantId === 'p2');

  assert.strictEqual(pA.itemsSubtotalMinor, 50000);
  assert.strictEqual(pA.allocatedTaxMinor, 5000); // exactly ₹50
  assert.strictEqual(pA.totalMinor, 55000); // ₹550

  assert.strictEqual(pB.itemsSubtotalMinor, 30000);
  assert.strictEqual(pB.allocatedTaxMinor, 3000); // exactly ₹30
  assert.strictEqual(pB.totalMinor, 33000); // ₹330

  // Exact reconciliation
  const sumTotals = result.participantBreakdowns.reduce((sum, p) => sum + p.totalMinor, 0);
  assert.strictEqual(sumTotals, result.grandTotalMinor);
});

it('correctly splits shared item among all participants', () => {
  const result = calculateItemizedSplit({
    items: [
      { id: 'i1', name: 'Shared Nachos', priceMinor: 30000, participantIds: ['p1', 'p2', 'p3'] }
    ],
    participants: [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
      { id: 'p3', name: 'C' }
    ],
    taxType: 'percentage',
    taxValue: 10, // 3000 minor
    tipType: 'percentage',
    tipValue: 0,
    tipOnTax: false,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.itemsTotalMinor, 30000);
  assert.strictEqual(result.taxAmountMinor, 3000);
  assert.strictEqual(result.grandTotalMinor, 33000);

  result.participantBreakdowns.forEach(p => {
    assert.strictEqual(p.itemsSubtotalMinor, 10000);
    assert.strictEqual(p.allocatedTaxMinor, 1000);
    assert.strictEqual(p.totalMinor, 11000);
  });
});

it('detects and flags unassigned items without crashing', () => {
  const result = calculateItemizedSplit({
    items: [
      { id: 'i1', name: 'Unassigned Drink', priceMinor: 15000, participantIds: [] }
    ],
    participants: [{ id: 'p1', name: 'A' }],
    taxType: 'percentage',
    taxValue: 0,
    tipType: 'percentage',
    tipValue: 0,
    tipOnTax: false,
    currencyCode: 'INR'
  });

  assert.strictEqual(result.unassignedItemsCount, 1);
  assert.strictEqual(result.unassignedItemsTotalMinor, 15000);
});

it('excludes unassigned items and allocates tax/tip only to assigned items (Critical C)', () => {
  const result = calculateItemizedSplit({
    items: [
      { id: 'i1', name: 'Burger', priceMinor: 30000, participantIds: ['p1'] },
      { id: 'i2', name: 'Unassigned Champagne', priceMinor: 70000, participantIds: [] }
    ],
    participants: [{ id: 'p1', name: 'Person A' }],
    taxType: 'percentage',
    taxValue: 10, // 10%
    tipType: 'percentage',
    tipValue: 10, // 10% on bill + tax
    tipOnTax: true,
    currencyCode: 'INR'
  });

  // Total bill before exclusions: 1000 + 100 tax + 110 tip = 1210
  assert.strictEqual(result.itemsTotalMinor, 100000);
  assert.strictEqual(result.taxAmountMinor, 10000);
  assert.strictEqual(result.tipAmountMinor, 11000);
  assert.strictEqual(result.grandTotalMinor, 121000);

  // Assigned portion (Burger ₹300 only): 300 + 30 tax + 33 tip = 363
  assert.strictEqual(result.assignedItemsTotalMinor, 30000);
  assert.strictEqual(result.assignedTaxAmountMinor, 3000);
  assert.strictEqual(result.assignedTipAmountMinor, 3300);
  assert.strictEqual(result.assignedGrandTotalMinor, 36300);

  // Unassigned portion (Champagne ₹700 + tax & tip): 700 + 70 tax + 77 tip = 847
  assert.strictEqual(result.unassignedGrandTotalMinor, 84700);

  // Person A only pays for assigned items + assigned tax/tip
  const pA = result.participantBreakdowns[0];
  assert.strictEqual(pA.itemsSubtotalMinor, 30000);
  assert.strictEqual(pA.allocatedTaxMinor, 3000);
  assert.strictEqual(pA.allocatedTipMinor, 3300);
  assert.strictEqual(pA.totalMinor, 36300);

  // Exact reconciliation: Assigned + Unassigned = Grand Total
  assert.strictEqual(pA.totalMinor + result.unassignedGrandTotalMinor, result.grandTotalMinor);
});

// -----------------------------------------------------------------------------
// 4. MODE 3: TRIP EXPENSE SPLIT & SETTLEMENTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Mode 3: Trip Split & Settlement Engine ---');

it('calculates trip net balances and settles debts greedily', () => {
  // Goa Trip test:
  // Rahul pays ₹14,300 for Hotel (shared by all 5: Rahul, Neha, Aman, Priya, Rohit)
  // Each person owes 14300 / 5 = ₹2,860
  // Rahul: paid 14300, owes 2860 -> net +11440
  // Neha: paid 0, owes 2860 -> net -2860
  // Aman: paid 0, owes 2860 -> net -2860
  // Priya: paid 0, owes 2860 -> net -2860
  // Rohit: paid 0, owes 2860 -> net -2860
  const result = calculateTripSplit({
    participants: [
      { id: 'p1', name: 'Rahul' },
      { id: 'p2', name: 'Neha' },
      { id: 'p3', name: 'Aman' },
      { id: 'p4', name: 'Priya' },
      { id: 'p5', name: 'Rohit' }
    ],
    expenses: [
      { id: 'e1', description: 'Goa Villa', amountMinor: 1430000, payerId: 'p1', sharedWithIds: ['p1', 'p2', 'p3', 'p4', 'p5'] }
    ],
    currencyCode: 'INR'
  });

  assert.strictEqual(result.totalGroupSpendingMinor, 1430000);
  const rahul = result.balances.find(b => b.participantId === 'p1');
  assert.strictEqual(rahul.totalPaidMinor, 1430000);
  assert.strictEqual(rahul.totalOwedMinor, 286000);
  assert.strictEqual(rahul.netBalanceMinor, 1144000);

  // Invariant: sum of net balances is strictly 0
  const netSum = result.balances.reduce((sum, b) => sum + b.netBalanceMinor, 0);
  assert.strictEqual(netSum, 0);

  // Settlements: 4 debtors each pay Rahul 2860
  assert.strictEqual(result.settlements.length, 4);
  result.settlements.forEach(s => {
    assert.strictEqual(s.toId, 'p1');
    assert.strictEqual(s.amountMinor, 286000);
  });
});

it('reconciles multi-payer complex group trip with multiple creditors and debtors', () => {
  // Alice pays 60 for dinner (Alice, Bob, Charlie) -> 20 each
  // Bob pays 90 for gas (Alice, Bob, Charlie) -> 30 each
  // Alice: paid 60, owes 50 -> net +10
  // Bob: paid 90, owes 50 -> net +40
  // Charlie: paid 0, owes 50 -> net -50
  const result = calculateTripSplit({
    participants: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' }
    ],
    expenses: [
      { id: 'e1', description: 'Dinner', amountMinor: 6000, payerId: 'p1', sharedWithIds: ['p1', 'p2', 'p3'] },
      { id: 'e2', description: 'Gas', amountMinor: 9000, payerId: 'p2', sharedWithIds: ['p1', 'p2', 'p3'] }
    ],
    currencyCode: 'USD'
  });

  assert.strictEqual(result.totalGroupSpendingMinor, 15000);
  const alice = result.balances.find(b => b.participantId === 'p1');
  const bob = result.balances.find(b => b.participantId === 'p2');
  const charlie = result.balances.find(b => b.participantId === 'p3');

  assert.strictEqual(alice.netBalanceMinor, 1000);
  assert.strictEqual(bob.netBalanceMinor, 4000);
  assert.strictEqual(charlie.netBalanceMinor, -5000);

  // Charlie pays Bob 40, Charlie pays Alice 10
  assert.strictEqual(result.settlements.length, 2);
  const totalSettled = result.settlements.reduce((sum, s) => sum + s.amountMinor, 0);
  assert.strictEqual(totalSettled, 5000);
});

// -----------------------------------------------------------------------------
// 5. STORAGE & SHARING TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Storage & Sharing Engine ---');

it('generates valid default state with empty trip expenses (Minor 2.3)', () => {
  const def = getDefaultState();
  assert.strictEqual(def.version, 1);
  assert.strictEqual(def.mode, 'even');
  assert.strictEqual(def.participants.length, 3);
  assert.deepStrictEqual(def.tripSplit.expenses, []);
});

it('resolves payer and shared member names to stable IDs on reload (Critical A)', () => {
  // Simulate mock localStorage
  const mockStorage = {
    bs_v1: JSON.stringify({
      version: 1,
      mode: 'trip',
      currency: 'INR',
      participants: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' }
      ],
      tripSplit: {
        expenses: [
          {
            id: 'e1',
            description: 'Lunch',
            amount: '500',
            payerId: 'Alice', // legacy name instead of ID
            sharedWithIds: ['Alice', 'Bob'] // legacy names instead of IDs
          }
        ]
      }
    })
  };

  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStorage[key] || null,
      setItem: () => {},
      removeItem: () => {}
    }
  };

  try {
    const loaded = loadStoredState();
    assert.strictEqual(loaded.tripSplit.expenses.length, 1);
    // Payer 'Alice' must be resolved to stable ID 'p1'
    assert.strictEqual(loaded.tripSplit.expenses[0].payerId, 'p1');
    // Shared with names ['Alice', 'Bob'] must be resolved to ['p1', 'p2']
    assert.deepStrictEqual(loaded.tripSplit.expenses[0].sharedWithIds, ['p1', 'p2']);
  } finally {
    globalThis.window = originalWindow;
  }
});

it('formats Even Split share text properly', () => {
  const result = calculateEvenSplit({
    billAmountMinor: 240000,
    participants: [
      { id: '1', name: 'Rahul' },
      { id: '2', name: 'Neha' }
    ],
    taxRatePct: 5,
    tipRatePct: 10,
    tipOnBillAndTax: false,
    currencyCode: 'INR'
  });
  const text = generateEvenSplitShareText(result, 'INR');
  assert(text.includes('Original Bill: ₹2,400.00'));
  assert(text.includes('Final Total: ₹2,760.00'));
  assert(text.includes('Rahul: ₹1,380.00'));
  assert(text.includes('freexpensetracker.com/bill-splitter/'));
});

it('formats Trip Split share text matching prompt format', () => {
  const result = calculateTripSplit({
    participants: [
      { id: 'p1', name: 'Aman' },
      { id: 'p2', name: 'Rahul' },
      { id: 'p3', name: 'Neha' }
    ],
    expenses: [
      { id: 'e1', description: 'Goa', amountMinor: 1430000, payerId: 'p1', sharedWithIds: ['p1', 'p2', 'p3'] }
    ],
    currencyCode: 'INR'
  });
  const text = generateTripSplitShareText(result, 'INR', 'Goa trip');
  assert(text.includes('*Goa trip expense split: who pays whom*'));
  assert(text.includes('Rahul → Aman:'));
  assert(text.includes('Neha → Aman:'));
  assert(text.includes('freexpensetracker.com/bill-splitter/'));
});

it('generates encoded WhatsApp share URL', () => {
  const url = getWhatsAppShareUrl('Hello world & test');
  assert(url.startsWith('https://api.whatsapp.com/send?text='));
  assert(url.includes('Hello%20world%20%26%20test'));
});

console.log('\n======================================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
}
