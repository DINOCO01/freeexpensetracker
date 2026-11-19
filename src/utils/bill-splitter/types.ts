export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface Participant {
  id: string;
  name: string;
}

// --- Mode 1: Even Split Types ---
export interface EvenSplitInput {
  billAmountMinor: number;
  participants: Participant[];
  taxRatePct: number;
  tipRatePct: number;
  tipOnBillAndTax: boolean;
  currencyCode: string;
}

export interface ParticipantShare {
  participantId: string;
  name: string;
  shareMinor: number;
}

export interface EvenSplitResult {
  billAmountMinor: number;
  taxAmountMinor: number;
  tipAmountMinor: number;
  finalTotalMinor: number;
  baseShareMinor: number;
  hasRoundingDifference: boolean;
  shares: ParticipantShare[];
}

// --- Mode 2: Itemized Split Types ---
export interface ItemizedItem {
  id: string;
  name: string;
  priceMinor: number;
  participantIds: string[];
}

export interface ItemizedSplitInput {
  items: ItemizedItem[];
  participants: Participant[];
  taxType: 'percentage' | 'fixed';
  taxValue: number; // percentage (e.g. 8.5) or fixed minor units
  tipType: 'percentage' | 'fixed';
  tipValue: number; // percentage (e.g. 15) or fixed minor units
  tipOnTax: boolean;
  currencyCode: string;
}

export interface ParticipantItemBreakdown {
  participantId: string;
  name: string;
  itemsSubtotalMinor: number;
  allocatedTaxMinor: number;
  allocatedTipMinor: number;
  totalMinor: number;
  assignedItemCount: number;
}

export interface ItemizedSplitResult {
  itemsTotalMinor: number;
  taxAmountMinor: number;
  tipAmountMinor: number;
  grandTotalMinor: number;
  assignedItemsTotalMinor: number;
  assignedTaxAmountMinor: number;
  assignedTipAmountMinor: number;
  assignedGrandTotalMinor: number;
  participantBreakdowns: ParticipantItemBreakdown[];
  unassignedItemsCount: number;
  unassignedItemsTotalMinor: number;
  unassignedGrandTotalMinor: number;
}

// --- Mode 3: Trip Split Types ---
export interface TripExpense {
  id: string;
  description: string;
  amountMinor: number;
  payerId: string;
  sharedWithIds: string[];
  date?: string;
}

export interface TripSplitInput {
  participants: Participant[];
  expenses: TripExpense[];
  currencyCode: string;
}

export interface ParticipantBalance {
  participantId: string;
  name: string;
  totalPaidMinor: number;
  totalOwedMinor: number;
  netBalanceMinor: number; // positive = creditor (receives), negative = debtor (pays)
}

export interface SettlementPayment {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountMinor: number;
}

export interface TripSplitResult {
  totalGroupSpendingMinor: number;
  balances: ParticipantBalance[];
  settlements: SettlementPayment[];
}
