export const SITE_URL = 'https://freexpensetracker.com';

/**
 * Standardized helper to generate canonical URLs ending with a trailing slash.
 * Works consistently across all pages, languages, and canonical tags.
 */
export function getCanonicalUrl(pathOrUrl?: string, locale?: string): string {
  // If no path is provided and locale is non-default, return localized root
  if (!pathOrUrl || pathOrUrl === '/' || pathOrUrl === '/en' || pathOrUrl === '/en/') {
    if (locale && locale !== 'en') {
      return `${SITE_URL}/${locale}/`;
    }
    return `${SITE_URL}/`;
  }

  let path = pathOrUrl;

  // Extract pathname if a full URL was passed
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname;
    } catch {
      // keep path as is
    }
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Replace multiple slashes with a single slash
  path = path.replace(/\/+/g, '/');

  // /en/ or /en is an alias for root English homepage
  if (path === '/en/' || path === '/en') {
    return `${SITE_URL}/`;
  }

  // If path does not have a file extension (e.g. .xml, .html), guarantee trailing slash
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
  if (!hasExtension && !path.endsWith('/')) {
    path = path + '/';
  }

  return `${SITE_URL}${path}`;
}
