import assert from 'node:assert';

interface DebtPaymentRecord {
  id: string;
  date: string;
  month?: string;
  totalPayment: number;
  principalPaid: number;
  interestPaid: number;
  extraPrepayment: number;
  notes?: string;
}

interface DebtItem {
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
  paymentHistory?: DebtPaymentRecord[];
  active?: boolean;
  paidOff?: boolean;
}

function sortDebts(debts: DebtItem[], strategy: 'avalanche' | 'snowball' | 'foir'): DebtItem[] {
  const activeDebts = debts.filter((d) => !d.paidOff && d.currentOutstandingPrincipal > 0);
  return [...activeDebts].sort((a, b) => {
    if (strategy === 'avalanche') {
      return b.interestRate - a.interestRate;
    } else if (strategy === 'snowball') {
      return a.currentOutstandingPrincipal - b.currentOutstandingPrincipal;
    } else {
      return b.monthlyEMI - a.monthlyEMI;
    }
  });
}

function recordPayment(
  debt: DebtItem,
  date: string,
  totalPayment: number,
  principalPaid: number,
  interestPaid: number,
  extraPrepayment: number = 0,
  notes?: string
) {
  assert(totalPayment >= 0, 'Total payment must be >= 0');
  assert(principalPaid >= 0, 'Principal paid must be >= 0');
  assert(interestPaid >= 0, 'Interest paid must be >= 0');
  assert(extraPrepayment >= 0, 'Extra prepayment must be >= 0');
  const totalReduction = principalPaid + extraPrepayment;
  assert(totalReduction > 0, 'Principal reduction must be > 0');
  assert(totalReduction <= debt.currentOutstandingPrincipal, 'Principal reduction cannot exceed outstanding principal');

  const newPrincipal = Math.max(0, debt.currentOutstandingPrincipal - totalReduction);
  const record: DebtPaymentRecord = {
    id: `pay-${debt.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    month: date.slice(0, 7),
    totalPayment,
    principalPaid,
    interestPaid,
    extraPrepayment,
    notes
  };

  debt.paymentHistory = debt.paymentHistory || [];
  debt.paymentHistory.push(record);
  debt.currentOutstandingPrincipal = newPrincipal;
  debt.balance = newPrincipal;

  if (newPrincipal <= 0) {
    debt.currentOutstandingPrincipal = 0;
    debt.balance = 0;
    debt.paidOff = true;
    debt.active = false;
  }
}

function getFreedMonthlyPayment(debts: DebtItem[]): number {
  return debts
    .filter((d) => d.paidOff || d.currentOutstandingPrincipal <= 0)
    .reduce((sum, d) => sum + d.monthlyEMI, 0);
}

console.log('=== TEST 1: DATASET 1 SORTING ===');
const dataset1: DebtItem[] = [
  {
    id: 'debt-1',
    name: 'Credit Card',
    originalPrincipal: 50000,
    currentOutstandingPrincipal: 50000,
    balance: 50000,
    interestRate: 24,
    rate: 24,
    monthlyEMI: 3000,
    minimum: 3000,
    active: true,
    paidOff: false
  },
  {
    id: 'debt-2',
    name: 'Personal Loan',
    originalPrincipal: 100000,
    currentOutstandingPrincipal: 100000,
    balance: 100000,
    interestRate: 15,
    rate: 15,
    monthlyEMI: 5000,
    minimum: 5000,
    active: true,
    paidOff: false
  },
  {
    id: 'debt-3',
    name: 'Car Loan',
    originalPrincipal: 300000,
    currentOutstandingPrincipal: 300000,
    balance: 300000,
    interestRate: 9,
    rate: 9,
    monthlyEMI: 8000,
    minimum: 8000,
    active: true,
    paidOff: false
  }
];

const d1Avalanche = sortDebts(dataset1, 'avalanche').map((d) => d.name);
console.log('Dataset 1 Avalanche:', d1Avalanche);
assert.deepStrictEqual(d1Avalanche, ['Credit Card', 'Personal Loan', 'Car Loan']);

const d1Snowball = sortDebts(dataset1, 'snowball').map((d) => d.name);
console.log('Dataset 1 Snowball:', d1Snowball);
assert.deepStrictEqual(d1Snowball, ['Credit Card', 'Personal Loan', 'Car Loan']);

console.log('✓ Test 1 Passed!');

console.log('\n=== TEST 2: DATASET 2 SORTING ===');
const dataset2: DebtItem[] = [
  {
    id: 'debt-a',
    name: 'Debt A',
    originalPrincipal: 50000,
    currentOutstandingPrincipal: 50000,
    balance: 50000,
    interestRate: 8,
    rate: 8,
    monthlyEMI: 2000,
    minimum: 2000,
    active: true,
    paidOff: false
  },
  {
    id: 'debt-b',
    name: 'Debt B',
    originalPrincipal: 200000,
    currentOutstandingPrincipal: 200000,
    balance: 200000,
    interestRate: 20,
    rate: 20,
    monthlyEMI: 8000,
    minimum: 8000,
    active: true,
    paidOff: false
  },
  {
    id: 'debt-c',
    name: 'Debt C',
    originalPrincipal: 100000,
    currentOutstandingPrincipal: 100000,
    balance: 100000,
    interestRate: 12,
    rate: 12,
    monthlyEMI: 4000,
    minimum: 4000,
    active: true,
    paidOff: false
  }
];

const d2Avalanche = sortDebts(dataset2, 'avalanche').map((d) => d.name);
console.log('Dataset 2 Avalanche:', d2Avalanche);
assert.deepStrictEqual(d2Avalanche, ['Debt B', 'Debt C', 'Debt A']);

const d2Snowball = sortDebts(dataset2, 'snowball').map((d) => d.name);
console.log('Dataset 2 Snowball:', d2Snowball);
assert.deepStrictEqual(d2Snowball, ['Debt A', 'Debt C', 'Debt B']);

console.log('✓ Test 2 Passed!');

console.log('\n=== TEST 3: RECORD PAYMENTS ON DEBT B ===');
const debtB = dataset2.find((d) => d.name === 'Debt B')!;
console.log('Debt B Initial Principal:', debtB.currentOutstandingPrincipal);
assert.strictEqual(debtB.currentOutstandingPrincipal, 200000);

// Payment 1: Total ₹8,000, Principal ₹5,000, Interest ₹3,000, Extra ₹0
recordPayment(debtB, '2026-09-10', 8000, 5000, 3000, 0, 'EMI Payment 1');
console.log('Debt B Principal after Payment 1:', debtB.currentOutstandingPrincipal);
assert.strictEqual(debtB.currentOutstandingPrincipal, 195000);
assert.strictEqual(debtB.originalPrincipal, 200000); // Original principal preserved

// Payment 2: Total ₹13,000, Principal ₹10,000, Interest ₹3,000, Extra ₹0
recordPayment(debtB, '2026-09-25', 13000, 10000, 3000, 0, 'Payment 2 with principal top-up');
console.log('Debt B Principal after Payment 2:', debtB.currentOutstandingPrincipal);
assert.strictEqual(debtB.currentOutstandingPrincipal, 185000);
assert.strictEqual(debtB.paymentHistory?.length, 2);
assert.strictEqual(debtB.paymentHistory[0].principalPaid, 5000);
assert.strictEqual(debtB.paymentHistory[1].principalPaid, 10000);
console.log('✓ Test 3 Passed: Two payments recorded accurately without double deduction, balance is ₹1,85,000!');

console.log('\n=== TEST 4: DYNAMIC CURRENT PRINCIPAL COMPARISON IN SNOWBALL ===');
// Test prompt requirement 9:
// Debt A: Original ₹1,00,000, Current ₹20,000
// Debt B: Original ₹50,000, Current ₹40,000
// Snowball must compare ₹20,000 vs ₹40,000, NOT the original amounts!
const dynamicDebtA: DebtItem = {
  id: 'd-a',
  name: 'Debt A',
  originalPrincipal: 100000,
  currentOutstandingPrincipal: 20000,
  balance: 20000,
  interestRate: 10,
  rate: 10,
  monthlyEMI: 3000,
  minimum: 3000,
  active: true,
  paidOff: false
};
const dynamicDebtB: DebtItem = {
  id: 'd-b',
  name: 'Debt B',
  originalPrincipal: 50000,
  currentOutstandingPrincipal: 40000,
  balance: 40000,
  interestRate: 10,
  rate: 10,
  monthlyEMI: 3000,
  minimum: 3000,
  active: true,
  paidOff: false
};

const dynamicSnowball = sortDebts([dynamicDebtB, dynamicDebtA], 'snowball').map((d) => d.name);
console.log('Dynamic Snowball (Current ₹20k vs ₹40k):', dynamicSnowball);
assert.deepStrictEqual(dynamicSnowball, ['Debt A', 'Debt B']);
console.log('✓ Test 4 Passed: Snowball correctly uses current balance, placing Debt A first!');

console.log('\n=== TEST 5: FULL PAYOFF & ROLLOVER PLANNING ===');
// Pay off Debt A completely
console.log('Paying off Debt A (remaining ₹20,000)...');
recordPayment(dynamicDebtA, '2026-09-28', 20000, 20000, 0, 0, 'Final clearance');
assert.strictEqual(dynamicDebtA.currentOutstandingPrincipal, 0);
assert.strictEqual(dynamicDebtA.paidOff, true);
assert.strictEqual(dynamicDebtA.active, false);

// Active debts should now only have Debt B
const remainingActive = sortDebts([dynamicDebtA, dynamicDebtB], 'avalanche').map((d) => d.name);
console.log('Remaining Active Debts after clearance:', remainingActive);
assert.deepStrictEqual(remainingActive, ['Debt B']);

// Freed rollover calculation
const freedEMI = getFreedMonthlyPayment([dynamicDebtA, dynamicDebtB]);
console.log('Freed Monthly EMI for Rollover from Debt A:', freedEMI);
assert.strictEqual(freedEMI, 3000); // Debt A EMI was ₹3,000
const debtBTotalCapacity = dynamicDebtB.monthlyEMI + freedEMI;
console.log('Debt B new payment capacity with rollover: ₹' + debtBTotalCapacity + '/mo');
assert.strictEqual(debtBTotalCapacity, 6000); // ₹3,000 regular + ₹3,000 freed

console.log('✓ Test 5 Passed: Full payoff marks debt as paid off, removes from active, and rolls over EMI!');

console.log('\n====================================');
console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
console.log('====================================');
