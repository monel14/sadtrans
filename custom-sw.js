// Ajout du listener 'message' au début pour éviter le warning
// Déclarer tous les addEventListener au plus haut niveau.
self.addEventListener("message", (event) => {
  console.log("Message reçu dans le SW :", event.data);
  
  // Gérer les messages OneSignal spécifiquement
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'ONESIGNAL_SESSION_UPDATE':
        console.log("OneSignal session update reçu");
        // Répondre à OneSignal pour confirmer la réception
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
        break;
      case 'ONESIGNAL_NOTIFICATION_CLICKED':
        console.log("OneSignal notification clicked");
        break;
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

// Service Worker personnalisé - version modifiée pour éviter les conflits avec OneSignal
// Ne pas charger le SDK OneSignal dans ce Service Worker pour éviter les conflits
// OneSignal utilise son propre service worker séparé

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
  
  // Exclure les ressources OneSignal du caching
  workbox.routing.registerRoute(
    /^https:\/\/cdn\.onesignal\.com/,
    new workbox.strategies.NetworkOnly()
  );
  
  workbox.routing.registerRoute(
    /^https:\/\/onesignal\.com/,
    new workbox.strategies.NetworkOnly()
  );
  
  workbox.routing.registerRoute(
    /^https:\/\/api\.onesignal\.com/,
    new workbox.strategies.NetworkOnly()
  );
  
  // Exclure le service worker OneSignal lui-même
  workbox.routing.registerRoute(
    /OneSignalSDKWorker\.js/,
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