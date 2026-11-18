import { getCurrencyMeta, minorToMajorUnits } from './money';

/**
 * Formats minor currency units into a localized display string using Intl.NumberFormat.
 * Supports JPY (0 decimals), INR (lakhs/crores), USD, EUR, etc.
 */
export function formatMoney(
  minorUnits: number,
  currencyCode: string = 'INR',
  localeCode?: string
): string {
  const meta = getCurrencyMeta(currencyCode);
  const isNegative = minorUnits < 0;
  const absMinor = Math.abs(minorUnits);
  const major = minorToMajorUnits(absMinor, currencyCode);

  let locale = 'en-US';
  if (currencyCode === 'INR') {
    locale = 'en-IN';
  } else if (localeCode) {
    const norm = localeCode.split('-')[0].toLowerCase();
    const map: Record<string, string> = {
      hi: 'en-IN',
      de: 'de-DE',
      fr: 'fr-FR',
      es: 'es-ES',
      pt: 'pt-PT',
      ja: 'ja-JP',
      ko: 'ko-KR',
      en: 'en-US'
    };
    locale = map[norm] || 'en-US';
  }

  const isZeroDecimal = meta.decimals === 0;

  const formatted = new Intl.NumberFormat(locale, {
    useGrouping: 'always',
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2
  }).format(major);

  const prefix = isNegative ? '-' : '';
  return `${prefix}${meta.symbol}${formatted}`;
}

/**
 * Formats a percentage value for display.
 */
export function formatPercent(ratePct: number): string {
  if (isNaN(ratePct) || !isFinite(ratePct)) return '0%';
  return `${parseFloat(ratePct.toFixed(2))}%`;
}
