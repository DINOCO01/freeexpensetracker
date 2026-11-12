/**
 * Phase C — Localized Currency and Number Formatting Unit Tests
 *
 * Verifies:
 * 1. Formatter output for all eight locales: en, hi, es, de, fr, pt, ja, ko.
 * 2. Major currencies: USD, INR, EUR, JPY, KRW (plus other supported currencies).
 * 3. Zero-decimal precision strictly enforced for JPY and KRW.
 * 4. Standard 2-decimal precision for fractional amounts in other currencies.
 * 5. Clean integer display for whole-number amounts.
 * 6. Indian number grouping (1,000 | 10,000 | 1,00,000 | 10,00,000 | 1,00,00,000) for INR and hi locale.
 * 7. Negative numbers, zero, large numbers, and edge case inputs (NaN, null, undefined).
 * 8. Currency independence: currency follows explicit selection, not tied to active locale.
 */

import { formatCurrency, SUPPORTED_CURRENCIES } from '../src/utils/calculations';

let passedCount = 0;
let failedCount = 0;

function assert(description: string, condition: boolean, detail: string = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${description}${detail ? ` (${detail})` : ''}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${description}${detail ? ` (${detail})` : ''}`);
  }
}

console.log('=================================================================');
console.log('🧪 RUNNING PHASE C: LOCALIZED NUMBER & CURRENCY FORMATTING TESTS');
console.log('=================================================================\n');

// 1. All 8 Locales with Standard Amounts
console.log('--- 1. Testing Standard Amounts Across All 8 Locales ---');
const locales = ['en', 'hi', 'es', 'de', 'fr', 'pt', 'ja', 'ko'];
for (const loc of locales) {
  const formatted = formatCurrency(1234.56, 'USD', loc);
  assert(`Locale '${loc}' formats USD 1234.56 cleanly`, formatted.includes('$') && !formatted.includes('NaN'), formatted);
}

// 2. Indian Number Grouping (Lakh / Crore)
console.log('\n--- 2. Testing Indian Number Grouping (INR and hi locale) ---');
const inrValues = [
  { val: 1000, expected: '1,000' },
  { val: 10000, expected: '10,000' },
  { val: 100000, expected: '1,00,000' },
  { val: 1000000, expected: '10,00,000' },
  { val: 10000000, expected: '1,00,00,000' }
];

for (const { val, expected } of inrValues) {
  // Check with INR in English
  const resEnInr = formatCurrency(val, 'INR', 'en');
  assert(`INR in 'en' locale groups ${val} as ${expected}`, resEnInr.includes(expected), resEnInr);

  // Check with INR in Hindi
  const resHiInr = formatCurrency(val, 'INR', 'hi');
  assert(`INR in 'hi' locale groups ${val} as ${expected}`, resHiInr.includes(expected), resHiInr);

  // Check with USD in Hindi locale (should apply Indian grouping for 'hi')
  const resHiUsd = formatCurrency(val, 'USD', 'hi');
  assert(`USD in 'hi' locale groups ${val} as ${expected}`, resHiUsd.includes(expected), resHiUsd);
}

// 3. JPY and KRW Zero-Decimal Precision
console.log('\n--- 3. Testing JPY and KRW Zero-Decimal Precision ---');
const jpyWhole = formatCurrency(1234, 'JPY', 'ja');
assert('JPY whole number has no decimals', jpyWhole === '¥1,234', jpyWhole);

const jpyFractional = formatCurrency(1234.56, 'JPY', 'ja');
assert('JPY fractional rounds to zero decimals', jpyFractional === '¥1,235', jpyFractional);

const krwWhole = formatCurrency(1234, 'KRW', 'ko');
assert('KRW whole number has no decimals', krwWhole === '₩1,234', krwWhole);

const krwFractional = formatCurrency(1234.56, 'KRW', 'ko');
assert('KRW fractional rounds to zero decimals', krwFractional === '₩1,235', krwFractional);

// JPY and KRW selected in other locales (e.g. en) must still enforce 0 decimals
const jpyInEn = formatCurrency(1234.56, 'JPY', 'en');
assert('JPY selected on English locale has 0 decimals', jpyInEn === '¥1,235', jpyInEn);

const krwInFr = formatCurrency(1234.56, 'KRW', 'fr');
assert('KRW selected on French locale has 0 decimals', krwInFr.includes('1') && !krwInFr.includes(','), krwInFr);

// 4. Other Currencies Preserve Decimal Precision
console.log('\n--- 4. Testing Precision for USD, EUR, GBP ---');
const usdFractional = formatCurrency(1234.56, 'USD', 'en');
assert('USD fractional retains 2 decimals in en', usdFractional === '$1,234.56', usdFractional);

const usdWhole = formatCurrency(4200, 'USD', 'en');
assert('USD whole number displays cleanly without trailing .00', usdWhole === '$4,200', usdWhole);

const eurFractionalDe = formatCurrency(1234.56, 'EUR', 'de');
assert('EUR fractional in de has comma decimal separator', eurFractionalDe === '€1.234,56', eurFractionalDe);

const eurFractionalFr = formatCurrency(1234.56, 'EUR', 'fr');
// fr-FR uses narrow non-breaking space (or standard space) and comma
assert('EUR fractional in fr uses comma decimal separator', eurFractionalFr.includes(',56') && eurFractionalFr.startsWith('€'), eurFractionalFr);

const gbpFractional = formatCurrency(1234.56, 'GBP', 'en');
assert('GBP fractional has 2 decimals', gbpFractional === '£1,234.56', gbpFractional);

// 5. Zero and Negative Amounts
console.log('\n--- 5. Testing Zero and Negative Values ---');
const zeroUsd = formatCurrency(0, 'USD', 'en');
assert('Zero USD displays as $0', zeroUsd === '$0', zeroUsd);

const zeroInr = formatCurrency(0, 'INR', 'hi');
assert('Zero INR displays as ₹0', zeroInr === '₹0', zeroInr);

const zeroJpy = formatCurrency(0, 'JPY', 'ja');
assert('Zero JPY displays as ¥0', zeroJpy === '¥0', zeroJpy);

const negUsdWhole = formatCurrency(-50, 'USD', 'en');
assert('Negative whole USD displays as -$50', negUsdWhole === '-$50', negUsdWhole);

const negUsdFractional = formatCurrency(-50.25, 'USD', 'en');
assert('Negative fractional USD displays as -$50.25', negUsdFractional === '-$50.25', negUsdFractional);

const negInr = formatCurrency(-150000, 'INR', 'hi');
assert('Negative INR displays as -₹1,50,000', negInr === '-₹1,50,000', negInr);

const negEurDe = formatCurrency(-1234.56, 'EUR', 'de');
assert('Negative EUR in de displays as -€1.234,56', negEurDe === '-€1.234,56', negEurDe);

const negJpy = formatCurrency(-5000, 'JPY', 'ja');
assert('Negative JPY displays as -¥5,000', negJpy === '-¥5,000', negJpy);

// 6. Large Amounts (Millions / Crores)
console.log('\n--- 6. Testing Large Amounts ---');
const largeUsd = formatCurrency(50000000, 'USD', 'en');
assert('Fifty million USD formatted with commas', largeUsd === '$50,000,000', largeUsd);

const largeInr = formatCurrency(50000000, 'INR', 'hi');
assert('Five crore INR formatted with Indian grouping', largeInr === '₹5,00,00,000', largeInr);

// 7. Edge Cases and Defensive Input Handling
console.log('\n--- 7. Testing Defensive Input Handling (No NaN or undefined) ---');
const nanVal = formatCurrency(NaN as any, 'USD', 'en');
assert('NaN amount falls back safely to $0', nanVal === '$0', nanVal);

const nullVal = formatCurrency(null as any, 'USD', 'en');
assert('null amount falls back safely to $0', nullVal === '$0', nullVal);

const undefVal = formatCurrency(undefined as any, 'USD', 'en');
assert('undefined amount falls back safely to $0', undefVal === '$0', undefVal);

const strVal = formatCurrency('1250' as any, 'USD', 'en');
assert('Numeric string amount parsed correctly', strVal === '$1,250', strVal);

const unkCurrency = formatCurrency(100, 'UNKNOWN' as any, 'en');
assert('Unknown currency falls back safely to USD', unkCurrency === '$100', unkCurrency);

// 8. Currency and Locale Independence
console.log('\n--- 8. Testing Currency and Locale Independence ---');
// Currency must not switch when locale changes
const inrInDe = formatCurrency(250000, 'INR', 'de');
assert('INR in de retains Indian Rupee symbol and Indian grouping', inrInDe === '₹2,50,000', inrInDe);

const jpyInEs = formatCurrency(10000, 'JPY', 'es');
assert('JPY in es retains Yen symbol and zero decimals', jpyInEs === '¥10.000' || jpyInEs === '¥10,000', jpyInEs);

console.log('\n=================================================================');
console.log(`TOTAL PHASE C UNIT TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('=================================================================');

if (failedCount > 0) {
  process.exit(1);
}

