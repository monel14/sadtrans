importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'sadtrans-b2b-v6';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE)
          .catch(error => {
            console.error('Failed to cache some URLs:', error);
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Suppression des gestionnaires de notifications push puisque nous utilisons OneSignal

self.addEventListener('fetch', event => {
  if (!event) return;
  
  const requestUrl = new URL(event.request.url);

  // If the request is for the Supabase API, bypass the service worker entirely.
  if (requestUrl.hostname.endsWith('supabase.co')) {
    return;
  }

  // Gérer les fichiers CSS avec une stratégie network-first
  if (requestUrl.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).catch(error => {
          console.error('Fetch failed:', error);
          return new Response('Offline content', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});