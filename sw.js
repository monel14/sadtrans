importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'sadtrans-b2b-v6'; // Incrémenter le numéro pour forcer la mise à jour
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
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Forcer l'activation du nouveau SW
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
    }).then(() => self.clients.claim()) // Prendre le contrôle des clients ouverts
  );
});

self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  let pushData = {};
  try {
    pushData = event.data.json();
    console.log('[Service Worker] Push data is JSON:', pushData);
  } catch (e) {
    pushData = { body: event.data.text() };
    console.log('[Service Worker] Push data is plain text:', pushData.body);
  }

  const title = pushData.title || 'Sadtrans Notification';
  const options = {
    body: pushData.body || 'You have a new notification.',
    icon: pushData.icon || '/images/icon-192x192.png',
    badge: pushData.badge || '/images/icon-192x192.png',
    data: {
      url: pushData.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  // Vérifier que l'événement existe
  if (!event) return;
  
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Nouvelle stratégie pour le CSS - network first avec fallback sur le cache
function handleCSSRequest(request) {
  // Pour les fichiers CSS, utiliser une stratégie network-first
  return fetch(request)
    .then(response => {
      // Si la requête réussit, mettre en cache la réponse
      if (response.ok) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
      }
      return response;
    })
    .catch(() => {
      // En cas d'échec, essayer de récupérer depuis le cache
      return caches.match(request);
    });
}

self.addEventListener('fetch', event => {
  // Vérifier que l'événement existe
  if (!event) return;
  
  const requestUrl = new URL(event.request.url);

  // If the request is for the Supabase API, bypass the service worker entirely.
  // This ensures that authentication requests and API calls are handled directly by the browser.
  if (requestUrl.hostname.endsWith('supabase.co')) {
    return; // Let the browser handle the request, bypassing the cache.
  }

  // Gérer les fichiers CSS avec une stratégie spéciale
  if (requestUrl.pathname.endsWith('.css')) {
    event.respondWith(handleCSSRequest(event.request));
    return;
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
        return fetch(event.request).catch(error => {
          console.error('Fetch failed:', error);
          // Retourner une réponse par défaut en cas d'erreur
          return new Response('Offline content', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});