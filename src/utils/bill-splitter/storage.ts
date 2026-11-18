import type { Participant } from './types';
import { DEFAULT_CURRENCY, BILL_SPLITTER_CURRENCIES } from './money';

export const BILL_SPLITTER_STORAGE_KEY = 'bs_v1';

export interface StoredItem {
  id: string;
  name: string;
  price: string;
  participantIds: string[];
}

export interface StoredTripExpense {
  id: string;
  description: string;
  amount: string;
  payerId: string;
  sharedWithIds: string[];
  date: string;
}

export interface StoredBillSplitterState {
  version: 1;
  mode: 'even' | 'itemized' | 'trip';
  currency: string;
  participants: Participant[];
  evenSplit: {
    billAmount: string;
    taxRate: string;
    tipRate: string;
    tipOnBillAndTax: boolean;
  };
  itemizedSplit: {
    items: StoredItem[];
    taxType: 'percentage' | 'fixed';
    taxValue: string;
    tipType: 'percentage' | 'fixed';
    tipValue: string;
    tipOnTax: boolean;
  };
  tripSplit: {
    expenses: StoredTripExpense[];
  };
}

export function getDefaultState(): StoredBillSplitterState {
  return {
    version: 1,
    mode: 'even',
    currency: DEFAULT_CURRENCY,
    participants: [
      { id: 'p1', name: 'Person 1' },
      { id: 'p2', name: 'Person 2' },
      { id: 'p3', name: 'Person 3' }
    ],
    evenSplit: {
      billAmount: '',
      taxRate: '',
      tipRate: '',
      tipOnBillAndTax: false
    },
    itemizedSplit: {
      items: [
        { id: 'i1', name: 'Appetizers', price: '', participantIds: ['p1', 'p2', 'p3'] },
        { id: 'i2', name: 'Main Course', price: '', participantIds: ['p1', 'p2'] }
      ],
      taxType: 'percentage',
      taxValue: '',
      tipType: 'percentage',
      tipValue: '',
      tipOnTax: false
    },
    tripSplit: {
      expenses: [
        { id: 'e1', description: 'Airbnb / Hotel', amount: '', payerId: 'p1', sharedWithIds: ['p1', 'p2', 'p3'], date: '' }
      ]
    }
  };
}

/**
 * Validates and restores stored bill splitter state from localStorage.
 * Falls back to default state safely if storage is disabled, blocked, or corrupt.
 */
export function loadStoredState(): StoredBillSplitterState {
  const defaultState = getDefaultState();

  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultState;
  }

  try {
    const raw = window.localStorage.getItem(BILL_SPLITTER_STORAGE_KEY);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return defaultState;
    }

    const mode = ['even', 'itemized', 'trip'].includes(parsed.mode) ? parsed.mode : 'even';
    const currency = BILL_SPLITTER_CURRENCIES[parsed.currency] ? parsed.currency : DEFAULT_CURRENCY;

    const participants: Participant[] = Array.isArray(parsed.participants) && parsed.participants.length > 0
      ? parsed.participants.map((p: any, idx: number) => ({
          id: typeof p.id === 'string' && p.id ? p.id : `p${idx + 1}`,
          name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : `Person ${idx + 1}`
        }))
      : defaultState.participants;

    const evenSplit = {
      billAmount: typeof parsed.evenSplit?.billAmount === 'string' ? parsed.evenSplit.billAmount : '',
      taxRate: typeof parsed.evenSplit?.taxRate === 'string' ? parsed.evenSplit.taxRate : '',
      tipRate: typeof parsed.evenSplit?.tipRate === 'string' ? parsed.evenSplit.tipRate : '',
      tipOnBillAndTax: Boolean(parsed.evenSplit?.tipOnBillAndTax)
    };

    const itemizedSplit = {
      items: Array.isArray(parsed.itemizedSplit?.items)
        ? parsed.itemizedSplit.items.map((it: any, idx: number) => ({
            id: typeof it.id === 'string' && it.id ? it.id : `i${idx + 1}`,
            name: typeof it.name === 'string' ? it.name : `Item ${idx + 1}`,
            price: typeof it.price === 'string' ? it.price : '',
            participantIds: Array.isArray(it.participantIds) ? it.participantIds : []
          }))
        : defaultState.itemizedSplit.items,
      taxType: parsed.itemizedSplit?.taxType === 'fixed' ? 'fixed' : 'percentage',
      taxValue: typeof parsed.itemizedSplit?.taxValue === 'string' ? parsed.itemizedSplit.taxValue : '',
      tipType: parsed.itemizedSplit?.tipType === 'fixed' ? 'fixed' : 'percentage',
      tipValue: typeof parsed.itemizedSplit?.tipValue === 'string' ? parsed.itemizedSplit.tipValue : '',
      tipOnTax: Boolean(parsed.itemizedSplit?.tipOnTax)
    };

    const tripSplit = {
      expenses: Array.isArray(parsed.tripSplit?.expenses)
        ? parsed.tripSplit.expenses.map((e: any, idx: number) => ({
            id: typeof e.id === 'string' && e.id ? e.id : `e${idx + 1}`,
            description: typeof e.description === 'string' ? e.description : `Expense ${idx + 1}`,
            amount: typeof e.amount === 'string' ? e.amount : '',
            payerId: typeof e.payerId === 'string' ? e.payerId : (participants[0]?.id || 'p1'),
            sharedWithIds: Array.isArray(e.sharedWithIds) ? e.sharedWithIds : participants.map(p => p.id),
            date: typeof e.date === 'string' ? e.date : ''
          }))
        : defaultState.tripSplit.expenses
    };

    return {
      version: 1,
      mode,
      currency,
      participants,
      evenSplit,
      itemizedSplit,
      tripSplit
    };
  } catch (_) {
    return defaultState;
  }
}

/**
 * Saves state to localStorage safely with error trapping.
 */
export function saveStoredState(state: StoredBillSplitterState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.setItem(BILL_SPLITTER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Clears stored state from localStorage and returns fresh default state.
 */
export function resetStoredState(): StoredBillSplitterState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(BILL_SPLITTER_STORAGE_KEY);
    } catch (_) {}
  }
  return getDefaultState();
}
