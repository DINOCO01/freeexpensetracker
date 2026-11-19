import type {
  EvenSplitInput,
  EvenSplitResult,
  ItemizedSplitInput,
  ItemizedSplitResult,
  ParticipantItemBreakdown,
  ParticipantShare
} from './types';
import {
  calculatePercentage,
  distributeEvenly,
  distributeProportionally
} from './money';

/**
 * Calculates Mode 1: Even Split
 */
export function calculateEvenSplit(input: EvenSplitInput): EvenSplitResult {
  const {
    billAmountMinor,
    participants,
    taxRatePct,
    tipRatePct,
    tipOnBillAndTax
  } = input;

  const validBillMinor = Math.max(0, Math.round(billAmountMinor));
  const validTaxPct = Math.max(0, taxRatePct || 0);
  const validTipPct = Math.max(0, tipRatePct || 0);

  // Tax = Bill * Tax Rate
  const taxAmountMinor = calculatePercentage(validBillMinor, validTaxPct);

  // Tip base
  const tipBaseMinor = tipOnBillAndTax ? (validBillMinor + taxAmountMinor) : validBillMinor;
  const tipAmountMinor = calculatePercentage(tipBaseMinor, validTipPct);

  // Final Total
  const finalTotalMinor = validBillMinor + taxAmountMinor + tipAmountMinor;

  const count = Math.max(1, participants.length);
  const rawShares = distributeEvenly(finalTotalMinor, count);

  const baseShareMinor = Math.floor(finalTotalMinor / count);
  const hasRoundingDifference = rawShares.some(s => s !== baseShareMinor);

  const shares: ParticipantShare[] = participants.map((p, idx) => ({
    participantId: p.id,
    name: p.name || `Person ${idx + 1}`,
    shareMinor: rawShares[idx] || 0
  }));

  return {
    billAmountMinor: validBillMinor,
    taxAmountMinor,
    tipAmountMinor,
    finalTotalMinor,
    baseShareMinor,
    hasRoundingDifference,
    shares
  };
}

/**
 * Calculates Mode 2: Itemized Split
 */
export function calculateItemizedSplit(input: ItemizedSplitInput): ItemizedSplitResult {
  const {
    items,
    participants,
    taxType,
    taxValue,
    tipType,
    tipValue,
    tipOnTax
  } = input;

  const participantMap = new Map<string, ParticipantItemBreakdown>();
  for (const p of participants) {
    participantMap.set(p.id, {
      participantId: p.id,
      name: p.name,
      itemsSubtotalMinor: 0,
      allocatedTaxMinor: 0,
      allocatedTipMinor: 0,
      totalMinor: 0,
      assignedItemCount: 0
    });
  }

  let unassignedItemsCount = 0;
  let unassignedItemsTotalMinor = 0;
  let itemsTotalMinor = 0;

  // 1. Process items and divide among assigned participants
  for (const item of items) {
    const priceMinor = Math.max(0, Math.round(item.priceMinor || 0));
    itemsTotalMinor += priceMinor;

    const assignedIds = (item.participantIds || []).filter(id => participantMap.has(id));

    if (assignedIds.length === 0) {
      unassignedItemsCount++;
      unassignedItemsTotalMinor += priceMinor;
      continue;
    }

    const itemShares = distributeEvenly(priceMinor, assignedIds.length);
    assignedIds.forEach((pId, idx) => {
      const breakdown = participantMap.get(pId)!;
      breakdown.itemsSubtotalMinor += itemShares[idx];
      breakdown.assignedItemCount += 1;
    });
  }

  // 2. Calculate Total Tax & Assigned Tax
  const assignedItemsTotalMinor = Math.max(0, itemsTotalMinor - unassignedItemsTotalMinor);

  let taxAmountMinor = 0;
  let assignedTaxAmountMinor = 0;
  if (taxType === 'percentage') {
    const validTaxPct = Math.max(0, taxValue || 0);
    taxAmountMinor = calculatePercentage(itemsTotalMinor, validTaxPct);
    assignedTaxAmountMinor = calculatePercentage(assignedItemsTotalMinor, validTaxPct);
  } else {
    taxAmountMinor = Math.max(0, Math.round(taxValue || 0));
    if (itemsTotalMinor > 0 && assignedItemsTotalMinor > 0) {
      const taxShares = distributeProportionally(taxAmountMinor, [assignedItemsTotalMinor, unassignedItemsTotalMinor]);
      assignedTaxAmountMinor = taxShares[0] || 0;
    } else {
      assignedTaxAmountMinor = 0;
    }
  }

  // 3. Calculate Total Tip & Assigned Tip
  let tipAmountMinor = 0;
  let assignedTipAmountMinor = 0;
  const tipBaseMinor = tipOnTax ? (itemsTotalMinor + taxAmountMinor) : itemsTotalMinor;
  const assignedTipBaseMinor = tipOnTax ? (assignedItemsTotalMinor + assignedTaxAmountMinor) : assignedItemsTotalMinor;

  if (tipType === 'percentage') {
    const validTipPct = Math.max(0, tipValue || 0);
    tipAmountMinor = calculatePercentage(tipBaseMinor, validTipPct);
    assignedTipAmountMinor = calculatePercentage(assignedTipBaseMinor, validTipPct);
  } else {
    tipAmountMinor = Math.max(0, Math.round(tipValue || 0));
    if (itemsTotalMinor > 0 && assignedItemsTotalMinor > 0) {
      const tipShares = distributeProportionally(tipAmountMinor, [assignedItemsTotalMinor, unassignedItemsTotalMinor]);
      assignedTipAmountMinor = tipShares[0] || 0;
    } else {
      assignedTipAmountMinor = 0;
    }
  }

  // 4. Grand Total
  const grandTotalMinor = itemsTotalMinor + taxAmountMinor + tipAmountMinor;
  const assignedGrandTotalMinor = assignedItemsTotalMinor + assignedTaxAmountMinor + assignedTipAmountMinor;
  const unassignedGrandTotalMinor = Math.max(0, grandTotalMinor - assignedGrandTotalMinor);

  // 5. Allocate Tax and Tip proportionally according to each participant's subtotal
  const participantList = participants.map(p => participantMap.get(p.id)!);
  const subtotals = participantList.map(p => p.itemsSubtotalMinor);

  const allocatedTaxes = distributeProportionally(assignedTaxAmountMinor, subtotals);
  const allocatedTips = distributeProportionally(assignedTipAmountMinor, subtotals);

  participantList.forEach((breakdown, idx) => {
    breakdown.allocatedTaxMinor = allocatedTaxes[idx] || 0;
    breakdown.allocatedTipMinor = allocatedTips[idx] || 0;
    breakdown.totalMinor = breakdown.itemsSubtotalMinor + breakdown.allocatedTaxMinor + breakdown.allocatedTipMinor;
  });

  return {
    itemsTotalMinor,
    taxAmountMinor,
    tipAmountMinor,
    grandTotalMinor,
    assignedItemsTotalMinor,
    assignedTaxAmountMinor,
    assignedTipAmountMinor,
    assignedGrandTotalMinor,
    participantBreakdowns: participantList,
    unassignedItemsCount,
    unassignedItemsTotalMinor,
    unassignedGrandTotalMinor
  };
}
