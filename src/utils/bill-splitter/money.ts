import type { CurrencyMeta } from './types';

export const BILL_SPLITTER_CURRENCIES: Record<string, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', decimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AU$)', decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', decimals: 0 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)', decimals: 2 }
};

export const DEFAULT_CURRENCY = 'INR';

export function getCurrencyMeta(currencyCode: string = DEFAULT_CURRENCY): CurrencyMeta {
  const upper = (currencyCode || '').toUpperCase().trim();
  return BILL_SPLITTER_CURRENCIES[upper] || BILL_SPLITTER_CURRENCIES.USD;
}

export function getCurrencyDecimals(currencyCode: string = DEFAULT_CURRENCY): number {
  return getCurrencyMeta(currencyCode).decimals;
}

/**
 * Parses user input into minor units (e.g. cents/paise for USD/INR, whole yen for JPY).
 * Uses string manipulation to avoid floating-point inaccuracies like 1.14 * 100 = 113.99999999999999.
 * Disallows negative amounts; returns 0 for invalid inputs.
 */
export function parseToMinorUnits(input: string | number | null | undefined, currencyCode: string = DEFAULT_CURRENCY): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input <= 0) return 0;
    input = input.toString();
  }

  const decimals = getCurrencyDecimals(currencyCode);
  let str = input.trim();
  if (str.startsWith('-') || str.includes('-')) return 0;

  // Strip non-numeric characters except separators and decimal points
  // e.g. remove currency symbols (₹, $, €, etc.)
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  // Handle European comma format vs English period format
  // If there's a comma and no period, or if comma is after period, treat comma as decimal
  const lastComma = str.lastIndexOf(',');
  const lastPeriod = str.lastIndexOf('.');

  if (lastComma > -1 && lastPeriod > -1) {
    if (lastComma > lastPeriod) {
      // e.g. "1.250,50" -> remove periods, replace comma with period
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. "1,250.50" -> remove commas
      str = str.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Single comma, e.g. "12,50" -> replace with "."
    str = str.replace(',', '.');
  }

  // At this stage, str has at most one '.'
  const parts = str.split('.');
  const integerPart = parts[0].replace(/^0+/, '') || '0';
  let fractionPart = parts[1] || '';

  if (decimals === 0) {
    // For zero-decimal currencies like JPY, ignore fraction or round
    const intVal = parseInt(integerPart, 10);
    return isNaN(intVal) ? 0 : Math.max(0, intVal);
  }

  // Pad or truncate fraction to match exact decimals
  if (fractionPart.length > decimals) {
    // Round to nearest minor unit
    const truncated = fractionPart.slice(0, decimals);
    const nextDigit = parseInt(fractionPart[decimals], 10);
    let minor = parseInt(integerPart + truncated, 10);
    if (!isNaN(nextDigit) && nextDigit >= 5) {
      minor += 1;
    }
    return isNaN(minor) ? 0 : Math.max(0, minor);
  }

  fractionPart = fractionPart.padEnd(decimals, '0');
  const combined = integerPart + fractionPart;
  const minor = parseInt(combined, 10);
  return isNaN(minor) ? 0 : Math.max(0, minor);
}

/**
 * Converts integer minor units back to floating major units for calculation/display.
 */
export function minorToMajorUnits(minor: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const decimals = getCurrencyDecimals(currencyCode);
  return minor / Math.pow(10, decimals);
}

/**
 * Deterministically distributes an integer amount among N participants.
 * Guarantees that: sum(shares) === totalMinor exactly.
 * The remainder is assigned 1 minor unit at a time to the first remainder participants.
 */
export function distributeEvenly(totalMinor: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.max(0, totalMinor)];
  if (totalMinor <= 0) return new Array(count).fill(0);

  const baseShare = Math.floor(totalMinor / count);
  const remainder = totalMinor - (baseShare * count);

  const result: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = i < remainder ? baseShare + 1 : baseShare;
  }
  return result;
}

/**
 * Proportional allocation using the Largest Remainder Method (Hare-Niemeyer method).
 * Guarantees that: sum(allocated) === totalMinor exactly.
 * If totalWeight is 0, falls back to even distribution.
 */
export function distributeProportionally(totalMinor: number, weights: number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  if (count === 1) return [Math.max(0, totalMinor)];
  if (totalMinor <= 0) return new Array(count).fill(0);

  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (totalWeight <= 0) {
    return distributeEvenly(totalMinor, count);
  }

  const rawShares: number[] = new Array(count);
  const floorShares: number[] = new Array(count);
  const remainders: { index: number; frac: number }[] = new Array(count);
  let allocatedSum = 0;

  for (let i = 0; i < count; i++) {
    const w = Math.max(0, weights[i]);
    const raw = (totalMinor * w) / totalWeight;
    const floor = Math.floor(raw);
    rawShares[i] = raw;
    floorShares[i] = floor;
    allocatedSum += floor;
    remainders[i] = { index: i, frac: raw - floor };
  }

  let remainderToDistribute = totalMinor - allocatedSum;

  // Sort indices by largest fractional remainder descending
  remainders.sort((a, b) => b.frac - a.frac || a.index - b.index);

  const finalShares = [...floorShares];
  for (let i = 0; i < remainderToDistribute && i < count; i++) {
    finalShares[remainders[i].index] += 1;
  }

  return finalShares;
}

/**
 * Calculates a percentage of minor units, rounded to nearest integer minor unit.
 */
export function calculatePercentage(baseMinor: number, percentage: number): number {
  if (baseMinor <= 0 || percentage <= 0) return 0;
  return Math.round((baseMinor * percentage) / 100);
}
