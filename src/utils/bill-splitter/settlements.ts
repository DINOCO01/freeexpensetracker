import type {
  ParticipantBalance,
  SettlementPayment,
  TripSplitInput,
  TripSplitResult
} from './types';
import { distributeEvenly } from './money';

/**
 * Calculates Mode 3: Trip / Group Expense Split and greedy debt settlements.
 */
export function calculateTripSplit(input: TripSplitInput): TripSplitResult {
  const { participants, expenses } = input;

  const participantMap = new Map<string, ParticipantBalance>();
  for (const p of participants) {
    participantMap.set(p.id, {
      participantId: p.id,
      name: p.name,
      totalPaidMinor: 0,
      totalOwedMinor: 0,
      netBalanceMinor: 0
    });
  }

  let totalGroupSpendingMinor = 0;

  // 1. Process each expense
  for (const exp of expenses) {
    const amountMinor = Math.max(0, Math.round(exp.amountMinor || 0));
    if (amountMinor === 0) continue;

    totalGroupSpendingMinor += amountMinor;

    // Payer credit
    if (participantMap.has(exp.payerId)) {
      participantMap.get(exp.payerId)!.totalPaidMinor += amountMinor;
    }

    // Shares
    const validSharedIds = (exp.sharedWithIds || []).filter(id => participantMap.has(id));
    const effectiveSharedIds = validSharedIds.length > 0
      ? validSharedIds
      : participants.map(p => p.id); // fallback to all participants if empty

    const shares = distributeEvenly(amountMinor, effectiveSharedIds.length);
    effectiveSharedIds.forEach((pId, idx) => {
      const balance = participantMap.get(pId);
      if (balance) {
        balance.totalOwedMinor += shares[idx];
      }
    });
  }

  // 2. Compute net balances: Net = Total Paid - Total Owed
  const balances: ParticipantBalance[] = participants.map(p => {
    const b = participantMap.get(p.id)!;
    b.netBalanceMinor = b.totalPaidMinor - b.totalOwedMinor;
    return b;
  });

  // 3. Greedy Debt Settlement Algorithm
  const settlements = computeGreedySettlement(balances);

  return {
    totalGroupSpendingMinor,
    balances,
    settlements
  };
}

/**
 * Greedy debt settlement algorithm.
 * Matches the largest debtor against the largest creditor repeatedly.
 */
export function computeGreedySettlement(balances: ParticipantBalance[]): SettlementPayment[] {
  // Separate into debtors (net < 0) and creditors (net > 0)
  const debtors: { id: string; name: string; amountMinor: number }[] = [];
  const creditors: { id: string; name: string; amountMinor: number }[] = [];

  for (const b of balances) {
    if (b.netBalanceMinor < 0) {
      debtors.push({
        id: b.participantId,
        name: b.name,
        amountMinor: -b.netBalanceMinor
      });
    } else if (b.netBalanceMinor > 0) {
      creditors.push({
        id: b.participantId,
        name: b.name,
        amountMinor: b.netBalanceMinor
      });
    }
  }

  const settlements: SettlementPayment[] = [];

  // Match until both sides are settled
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending by amount
    debtors.sort((a, b) => b.amountMinor - a.amountMinor);
    creditors.sort((a, b) => b.amountMinor - a.amountMinor);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const paymentAmount = Math.min(debtor.amountMinor, creditor.amountMinor);

    if (paymentAmount > 0) {
      settlements.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amountMinor: paymentAmount
      });
    }

    debtor.amountMinor -= paymentAmount;
    creditor.amountMinor -= paymentAmount;

    if (debtor.amountMinor === 0) {
      debtors.shift();
    }
    if (creditor.amountMinor === 0) {
      creditors.shift();
    }
  }

  return settlements;
}
