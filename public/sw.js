/**
 * Free Expense Tracker Service Worker
 * Scope: /
 * Provides offline application shell and essential asset caching.
 * Privacy rule: NEVER caches user financial data, transaction payloads, or analytics.
 */

const CACHE_NAME = 'fet-pwa-v1';

// Essential application shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/site.webmanifest',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/favicon.svg',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png'
];

// Domains and endpoints that must NEVER be cached
const NEVER_CACHE_HOSTS = [
  'www.googletagmanager.com',
  'googletagmanager.com',
  'www.google-analytics.com',
  'google-analytics.com',
  'analytics.google.com'
];

self.addEventListener('install', (event) => {
  // Activate worker immediately once downloaded
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up any outdated caches from previous versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting legacy cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  // 2. Never cache third-party analytics or tracker endpoints
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // 3. For HTML navigation requests (Page visits): Network-First with Offline Fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, attempt exact page match in cache
          const cachedPage = await caches.match(req);
          if (cachedPage) {
            return cachedPage;
          }
          // Fall back to cached app shell root
          const cachedRoot = await caches.match('/');
          if (cachedRoot) {
            return cachedRoot;
          }
          // Generic offline text fallback if root not found
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Free Expense Tracker (Offline)</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h1>You are offline</h1><p>Please connect to the internet to load new pages, or visit previously opened pages.</p><a href="/">Return to Home</a></body></html>',
            { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 4. For same-origin static assets (_astro chunks, images, manifests, fonts): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // If network fails, stick to cached response

        return cachedResponse || fetchPromise;
      })
    );
  }
});

