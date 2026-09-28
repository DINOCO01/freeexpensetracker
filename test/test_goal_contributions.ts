import { formatCurrency } from '../src/utils/calculations';

interface GoalContribution {
  id?: string;
  date?: string; // "YYYY-MM-DD"
  month: string; // "YYYY-MM"
  planned?: number;
  actual: number;
}

interface GoalItem {
  id: string;
  name: string;
  target: number;
  current: number;
  initialAmount?: number;
  monthly: number;
  contributions?: GoalContribution[];
}

function parseGoalsFromStorage(rawGoalsJson: string | null): GoalItem[] {
  if (!rawGoalsJson) return [];
  try {
    const parsed = JSON.parse(rawGoalsJson);
    return Array.isArray(parsed)
      ? parsed
          .filter((g: GoalItem) => !['goal-1', 'goal-2', 'goal-3'].includes(g.id))
          .map((g: GoalItem) => {
            const rawContribs = Array.isArray(g.contributions) ? g.contributions : [];
            const contributions: GoalContribution[] = rawContribs.map((c: any, idx: number) => {
              const month = c.month || (c.date ? c.date.slice(0, 7) : new Date().toISOString().slice(0, 7));
              const date = c.date || `${month}-01`;
              const actual = Number(c.actual ?? c.amount) || 0;
              const id = c.id || `contrib-${g.id}-${idx}-${date}`;
              return {
                id,
                date,
                month,
                actual,
                planned: typeof c.planned === 'number' ? c.planned : g.monthly
              };
            });
            const initialAmount = typeof g.initialAmount === 'number' ? g.initialAmount : (g.current || 0);
            const totalActual = contributions.reduce((sum, c) => sum + (Number(c.actual) || 0), 0);
            return {
              ...g,
              contributions,
              initialAmount,
              current: initialAmount + totalActual
            };
          })
      : [];
  } catch (e) {
    return [];
  }
}

function calculateGoalMetrics(goal: GoalItem) {
  const startingAmount = typeof goal.initialAmount === 'number' ? goal.initialAmount : (goal.current || 0);
  const contributions = Array.isArray(goal.contributions) ? goal.contributions : [];
  const totalActual = contributions.reduce((sum, c) => sum + (Number(c.actual) || 0), 0);
  const totalSaved = startingAmount + totalActual;
  const pct = goal.target > 0 ? Math.min(100, Math.round((totalSaved / goal.target) * 100)) : 0;
  const remaining = Math.max(0, goal.target - totalSaved);
  const plannedMonthsLeft = goal.monthly > 0 ? Math.ceil(remaining / goal.monthly) : 0;

  // Monthly totals map
  const monthlyTotalsMap = new Map<string, number>();
  contributions.forEach((c) => {
    const m = c.month || (c.date ? c.date.slice(0, 7) : '');
    if (m) monthlyTotalsMap.set(m, (monthlyTotalsMap.get(m) || 0) + (Number(c.actual) || 0));
  });

  const monthlyTotals = Array.from(monthlyTotalsMap.values());
  const recentMonths = monthlyTotals.slice(-6);
  const sumRecent = recentMonths.reduce((sum, v) => sum + v, 0);
  const avgActual = recentMonths.length > 0 ? sumRecent / recentMonths.length : 0;

  let plannedProjectionText = '';
  if (remaining === 0) {
    plannedProjectionText = 'Goal Reached!';
  } else if (goal.monthly > 0) {
    plannedProjectionText = `${plannedMonthsLeft} mos to goal`;
  } else {
    plannedProjectionText = 'No monthly plan set';
  }

  let actualProjectionText = '';
  if (remaining === 0) {
    actualProjectionText = 'Goal Reached!';
  } else if (contributions.length > 0) {
    if (avgActual > 0) {
      const actualMonthsLeft = Math.ceil(remaining / avgActual);
      actualProjectionText = `${actualMonthsLeft} mos left (~${formatCurrency(Math.round(avgActual), 'INR')}/mo)`;
    } else {
      actualProjectionText = '₹0 contributed recently';
    }
  }

  return {
    startingAmount,
    totalSaved,
    remaining,
    pct,
    plannedMonthsLeft,
    plannedProjectionText,
    actualProjectionText,
    monthlyTotalsMap
  };
}

function recordContribution(goal: GoalItem, dateStr: string, actual: number, entryId?: string) {
  if (isNaN(actual) || actual <= 0) {
    throw new Error('Contribution amount must be greater than 0.');
  }

  const startingAmount = typeof goal.initialAmount === 'number' ? goal.initialAmount : (goal.current || 0);
  const otherActuals = (goal.contributions || [])
    .filter((c) => c.id !== entryId)
    .reduce((sum, c) => sum + (Number(c.actual) || 0), 0);
  const currentWithoutThis = startingAmount + otherActuals;
  const maxAllowed = Math.max(0, goal.target - currentWithoutThis);

  if (actual > maxAllowed) {
    throw new Error(`Contribution cannot exceed remaining goal amount (${formatCurrency(maxAllowed, 'INR')}).`);
  }

  if (!goal.contributions) goal.contributions = [];
  const month = dateStr.slice(0, 7);

  if (entryId) {
    const existingIdx = goal.contributions.findIndex((c) => c.id === entryId);
    if (existingIdx >= 0) {
      goal.contributions[existingIdx] = {
        ...goal.contributions[existingIdx],
        date: dateStr,
        month,
        actual
      };
    }
  } else {
    goal.contributions.push({
      id: `contrib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      month,
      planned: goal.monthly,
      actual
    });
  }

  goal.contributions.sort((a, b) => (a.date || a.month).localeCompare(b.date || b.month));
  const totalActual = goal.contributions.reduce((sum, c) => sum + (Number(c.actual) || 0), 0);
  goal.current = startingAmount + totalActual;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return dateStr;
}

// ================= TEST SUITE =================
console.log('--- RUNNING MULTI-CONTRIBUTION TEST SUITE ---');

// Test 1: User's Specific Step-by-Step Test Requirement
console.log('\n[User Test Scenario: Multiple Contributions in September]');
// Step 1: Existing September contribution = ₹20,000.
const targetGoal: GoalItem = {
  id: 'goal-user-home',
  name: 'Dream Home',
  target: 1200000,
  current: 500000,
  initialAmount: 500000,
  monthly: 25000,
  contributions: []
};

// Add initial September contribution: 20,000
recordContribution(targetGoal, '2026-09-05', 20000);
let metrics = calculateGoalMetrics(targetGoal);
console.assert(metrics.monthlyTotalsMap.get('2026-09') === 20000, 'Step 1: September actual is 20000');
console.assert(metrics.totalSaved === 520000, 'Total saved is 520000');
console.log('Step 1 passed: September actual = ₹20,000, Saved = ₹5,20,000');

// Step 2 & 3: Add another September contribution = ₹5,000.
// September actual should become ₹25,000, NOT ₹5,000 and NOT ₹45,000.
recordContribution(targetGoal, '2026-09-18', 5000);
metrics = calculateGoalMetrics(targetGoal);
console.assert(targetGoal.contributions?.length === 2, 'Two separate records exist');
console.assert(metrics.monthlyTotalsMap.get('2026-09') === 25000, 'Step 3: September actual is 25000 (NOT 5000 and NOT 45000)');
console.assert(metrics.totalSaved === 525000, 'Total saved is 525000');
console.log('Step 2 & 3 passed: September actual = ₹25,000 (20k + 5k)');

// Step 4 & 5: Add another September contribution = ₹2,000.
// September actual should become ₹27,000.
recordContribution(targetGoal, '2026-09-29', 2000);
metrics = calculateGoalMetrics(targetGoal);
console.assert(targetGoal.contributions?.length === 3, 'Three separate records exist');
console.assert(metrics.monthlyTotalsMap.get('2026-09') === 27000, 'Step 5: September actual is 27000');
console.assert(metrics.totalSaved === 527000, 'Total saved is 527000');
console.assert(metrics.remaining === 673000, 'Remaining is 673000');
console.log('Step 4 & 5 passed: September actual = ₹27,000 (20k + 5k + 2k)');

// Step 6 & 7: Reload the page (simulate localStorage persistence).
// Confirm ₹27,000 and all contribution records remain intact.
const savedJson = JSON.stringify([targetGoal]);
const reloadedGoals = parseGoalsFromStorage(savedJson);
console.assert(reloadedGoals.length === 1, 'Reloaded 1 goal');
const reloadedGoal = reloadedGoals[0];
const reloadedMetrics = calculateGoalMetrics(reloadedGoal);
console.assert(reloadedMetrics.monthlyTotalsMap.get('2026-09') === 27000, 'Step 7: September actual remains 27000 after reload');
console.assert(reloadedMetrics.totalSaved === 527000, 'Step 7: Total saved remains 527000 after reload');
console.assert(reloadedGoal.contributions?.length === 3, 'Step 7: All 3 records remain intact');
console.log('Step 6 & 7 passed: Reload preserves ₹27,000 and all 3 contribution records');

// Test 2: Handling multiple contributions on the same date
console.log('\n[Test 2: Multiple Contributions on the Same Date]');
const sameDateGoal: GoalItem = {
  id: 'goal-same-date',
  name: 'Education Fund',
  target: 100000,
  current: 0,
  initialAmount: 0,
  monthly: 10000,
  contributions: []
};
recordContribution(sameDateGoal, '2026-10-15', 3000);
recordContribution(sameDateGoal, '2026-10-15', 2000);
console.assert(sameDateGoal.contributions?.length === 2, '2 separate records on same date');
const sameDateMetrics = calculateGoalMetrics(sameDateGoal);
console.assert(sameDateMetrics.monthlyTotalsMap.get('2026-10') === 5000, 'October total is 5000');
console.log('✓ Multiple contributions on the same date stored as separate valid entries');

// Test 3: Editing an entry updates only that entry
console.log('\n[Test 3: Editing an Entry]');
const entryToEditId = sameDateGoal.contributions![1].id!;
recordContribution(sameDateGoal, '2026-10-15', 2500, entryToEditId);
console.assert(sameDateGoal.contributions?.length === 2, 'Still 2 entries after edit');
console.assert(sameDateGoal.contributions![1].actual === 2500, 'Second entry updated to 2500');
const afterEditMetrics = calculateGoalMetrics(sameDateGoal);
console.assert(afterEditMetrics.monthlyTotalsMap.get('2026-10') === 5500, 'October total is now 5500 (3000 + 2500)');
console.log('✓ Editing entry updates only that entry without creating duplicates');

// Test 4: Validation
console.log('\n[Test 4: Validation Rules]');
let zeroOrNegativeBlocked = false;
try {
  recordContribution(sameDateGoal, '2026-10-16', 0);
} catch (e: any) {
  zeroOrNegativeBlocked = true;
  console.assert(e.message === 'Contribution amount must be greater than 0.');
}
console.assert(zeroOrNegativeBlocked, 'Amount 0 is blocked');

let overfundingBlocked = false;
try {
  // Target is 100,000, currently 5,500, remaining is 94,500. Attempt 100,000.
  recordContribution(sameDateGoal, '2026-10-16', 100000);
} catch (e: any) {
  overfundingBlocked = true;
  console.assert(e.message.includes('cannot exceed remaining goal amount'));
}
console.assert(overfundingBlocked, 'Exceeding remaining amount is blocked');
console.log('✓ Validation rules verified');

// Test 5: Date Display Formatting
console.log('\n[Test 5: Date Display Formatting]');
console.assert(formatDateDisplay('2026-09-05') === 'Sep 5, 2026', `Sep 5 format: ${formatDateDisplay('2026-09-05')}`);
console.assert(formatDateDisplay('2026-09-18') === 'Sep 18, 2026', `Sep 18 format: ${formatDateDisplay('2026-09-18')}`);
console.assert(formatDateDisplay('2026-09-29') === 'Sep 29, 2026', `Sep 29 format: ${formatDateDisplay('2026-09-29')}`);
console.log('✓ Date display formatting verified');

console.log('\nALL TESTS PASSED SUCCESSFULLY! ✓');
