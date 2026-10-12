import en from './en';
import hi from './hi';
import es from './es';
import de from './de';
import fr from './fr';
import pt from './pt';
import ja from './ja';
import ko from './ko';

export type SupportedLocale = 'en' | 'hi' | 'es' | 'de' | 'fr' | 'pt' | 'ja' | 'ko';

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;        // Native name displayed in selector e.g. "हिन्दी"
  englishName: string; // English descriptor e.g. "Hindi"
  flag: string;        // Icon or flag
  dir: 'ltr' | 'rtl';  // Text direction (RTL readiness)
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleInfo> = {
  en: { code: 'en', name: 'English', englishName: 'English', flag: '🌐', dir: 'ltr' },
  hi: { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', dir: 'ltr' },
  es: { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸', dir: 'ltr' },
  de: { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪', dir: 'ltr' },
  fr: { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷', dir: 'ltr' },
  pt: { code: 'pt', name: 'Português', englishName: 'Portuguese', flag: '🇵🇹', dir: 'ltr' },
  ja: { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵', dir: 'ltr' },
  ko: { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷', dir: 'ltr' }
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALES_LIST: SupportedLocale[] = ['en', 'hi', 'es', 'de', 'fr', 'pt', 'ja', 'ko'];

export const ALL_DICTS: Record<SupportedLocale, typeof en> = {
  en,
  hi,
  es,
  de,
  fr,
  pt,
  ja,
  ko
};

/**
 * Validates and normalizes any locale string to a supported locale code.
 */
export function getLocale(locale?: string | null): SupportedLocale {
  if (!locale) return DEFAULT_LOCALE;
  const clean = locale.toLowerCase().split('-')[0].trim();
  if (clean in SUPPORTED_LOCALES) {
    return clean as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

/**
 * Returns text direction ('ltr' or 'rtl') for RTL-readiness.
 */
export function getDir(locale?: string | null): 'ltr' | 'rtl' {
  const loc = getLocale(locale);
  return SUPPORTED_LOCALES[loc]?.dir || 'ltr';
}

/**
 * Helper to traverse nested object keys with dot notation, e.g. "nav.home" or "dashboard.income"
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) return obj[path];
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Central translation lookup function.
 * If translation key is missing:
 *   1. Falls back to English.
 *   2. Does not display undefined translation keys.
 *   3. Logs missing translation keys in development.
 */
export function t(
  key: string,
  locale?: string | null,
  params?: Record<string, string | number>
): string {
  const activeLocale = getLocale(locale);
  const activeDict = ALL_DICTS[activeLocale];
  const fallbackDict = ALL_DICTS[DEFAULT_LOCALE];

  let value = getNestedValue(activeDict, key);

  if (value === undefined || value === null) {
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] Missing translation key "${key}" for locale "${activeLocale}"`);
    }
    value = getNestedValue(fallbackDict, key);
  }

  if (value === undefined || value === null) {
    return key;
  }

  let text = String(value);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

/**
 * Computes localized URL paths.
 * English root remains "/" or "/en/".
 * Other languages use "/[locale]/" or "/[locale]/path/".
 */
export function getLocaleUrl(path: string = '/', locale?: string | null): string {
  const loc = getLocale(locale);
  let cleanPath = path.startsWith('/') ? path : '/' + path;
  if (!cleanPath.endsWith('/') && !/\.[a-zA-Z0-9]+$/.test(cleanPath)) {
    cleanPath += '/';
  }
  
  if (loc === DEFAULT_LOCALE) {
    // English default uses canonical root
    return cleanPath;
  }

  if (cleanPath === '/' || cleanPath === '') {
    return `/${loc}/`;
  }

  // Remove leading slash for joining
  const trimmed = cleanPath.replace(/^\/+|\/+$/g, '');
  return `/${loc}/${trimmed}/`;
}

/**
 * Generates alternate hreflang tags for SEO.
 */
export function getAllHreflangLinks(currentPath: string = '/', siteUrl: string = 'https://freexpensetracker.com') {
  // Strip existing locale prefix from currentPath if present
  let purePath = currentPath;
  for (const loc of LOCALES_LIST) {
    if (purePath.startsWith(`/${loc}/`)) {
      purePath = purePath.replace(`/${loc}/`, '/');
      break;
    } else if (purePath === `/${loc}`) {
      purePath = '/';
      break;
    }
  }

  let cleanPure = purePath.startsWith('/') ? purePath : '/' + purePath;
  if (!cleanPure.endsWith('/') && !/\.[a-zA-Z0-9]+$/.test(cleanPure)) {
    cleanPure += '/';
  }

  // Legal, info, and single-language pages only exist in English.
  // Output only canonical English and x-default pointing to the English URL to avoid 404s.
  if (cleanPure !== '/') {
    return [
      {
        hreflang: 'x-default',
        href: `${siteUrl}${cleanPure}`
      },
      {
        hreflang: 'en',
        href: `${siteUrl}${cleanPure}`
      }
    ];
  }

  const links = [
    {
      hreflang: 'x-default',
      href: `${siteUrl}/`
    }
  ];

  for (const loc of LOCALES_LIST) {
    const locUrl = getLocaleUrl('/', loc);
    links.push({
      hreflang: loc,
      href: `${siteUrl}${locUrl}`
    });
  }

  return links;
}

/**
 * Localized Category name helper
 */
export function getLocalizedCategory(category: string, locale?: string | null): string {
  const translated = t(`categories.${category}`, locale);
  return translated !== `categories.${category}` ? translated : category;
}

/**
 * Lazy loads a locale dictionary asynchronously for optimal performance.
 */
export async function loadLocaleDict(locale: string) {
  const loc = getLocale(locale);
  return ALL_DICTS[loc];
}
