const CACHE_NAME = 'sadtrans-b2b-v5'; // Forcer la mise à jour
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'index.css',
  'index.tsx',
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
  let data = {};
  // Vérifier si des données sont présentes dans l'événement push
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Erreur de parsing JSON pour les données push:', e);
      data = { body: event.data.text() }; // Fallback au texte brut si le JSON échoue
    }
  } else {
    console.log('Événement push reçu sans données (test depuis DevTools).');
  }

  const title = data.title || 'Notification de Test';
  const options = {
    body: data.body || 'Ceci est un message de test envoyé depuis les outils de développement.',
    icon: data.icon || '/images/icon-192x192.png',
    badge: data.badge || '/images/icon-192x192.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
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
