// Auto-generated precache list at build time
self.__PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./assets/index-DdsFJdfi.css",
  "./assets/index-DQ8Ywmw1.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./manifest.json"
];

const CACHE_NAME = 'tonight-feed-ghost-v2.1';
const CACHE_PREFIX = 'tonight-feed-ghost-';

// self.__PRECACHE_ASSETS will be prepended by Vite plugin during production build.
const DEFAULT_FALLBACK_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const ASSETS_TO_CACHE = typeof self.__PRECACHE_ASSETS !== 'undefined'
  ? self.__PRECACHE_ASSETS
  : DEFAULT_FALLBACK_ASSETS;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching all assets for offline play:', ASSETS_TO_CACHE.length);
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Strictly delete only previous versions belonging to this specific game,
          // never delete other projects on the same origin (e.g. other GitHub Pages).
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            console.log('[SW] Purging old version cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Handle navigation requests (loading index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return caches.match('./index.html').then((indexCached) => {
          if (indexCached) return indexCached;
          return fetch(event.request).catch(() => caches.match('./index.html'));
        });
      })
    );
    return;
  }

  // Handle static assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
      // Important: do NOT fallback to index.html for assets, to prevent MIME type mismatches
    })
  );
});
