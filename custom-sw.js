// Gestionnaire de messages pour le service worker
self.addEventListener("message", (event) => {
  console.log("Message reçu dans le SW :", event.data);

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      default:
        console.log("Message SW non géré:", event.data.type);
    }
  }

  // Répondre toujours pour éviter les timeouts
  try {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ received: true, timestamp: Date.now() });
    }
  } catch (error) {
    console.warn("Erreur lors de la réponse au message:", error);
  }
});

// Gestionnaire pour les notifications push
self.addEventListener('push', (event) => {
  console.log('Notification push reçue:', event);

  let notificationData = {
    title: 'SadTrans',
    body: 'Nouvelle notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (error) {
      console.error('Erreur parsing notification payload:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: true,
      tag: 'sadtrans-notification'
    }
  );

  event.waitUntil(promiseChain);
});

// Gestionnaire pour les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Notification cliquée:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // Chercher une fenêtre existante avec l'URL
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }

    // Si aucune fenêtre n'est trouvée, en ouvrir une nouvelle
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});

// Gestionnaire pour la fermeture des notifications
self.addEventListener('notificationclose', (event) => {
  console.log('Notification fermée:', event);
  // Optionnel: envoyer des analytics sur la fermeture
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Supprimer les anciens caches
          if (cacheName !== 'workbox-precache-v2') {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendre le contrôle immédiatement
      return self.clients.claim();
    }).then(() => {
      // Notifier tous les clients que le SW est prêt
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            timestamp: Date.now()
          });
        });
      });
    })
  );
});

// Service Worker personnalisé avec support des notifications push natives
importScripts('/workbox-sw.js');

if (workbox) {
  console.log(`Workbox est chargé`);

  // Configuration améliorée pour ignorer les URLs externes
  workbox.setConfig({
    debug: false
  });

  // Le manifeste de pré-cache est injecté ici par vite-plugin-pwa
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [], {
    // Ignorer les paramètres de requête pour le pré-caching
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/]
  });

  // Routes pour les API de notifications (si nécessaire)
  workbox.routing.registerRoute(
    /^\/api\/push-subscriptions/,
    new workbox.strategies.NetworkOnly()
  );

  // Gestion des routes pour les ressources statiques
  workbox.routing.registerRoute(
    /\.(?:png|gif|jpg|jpeg|webp|svg)$/,
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    /\.(?:css|js)$/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );
} else {
  console.log(`Workbox n'a pas pu être chargé.`);
}