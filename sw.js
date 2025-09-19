const CACHE_NAME = 'sadtrans-b2b-v1';
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'index.css',
  'index.tsx',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // If the request is for the Supabase API, bypass the service worker entirely.
  // This ensures that authentication requests and API calls are handled directly by the browser.
  if (requestUrl.hostname.endsWith('supabase.co')) {
    return; // Let the browser handle the request, bypassing the cache.
  }

  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache.
        if (response) {
          return response;
        }

        // Not in cache - fetch from network.
        return fetch(event.request);
      }
    )
  );
});
