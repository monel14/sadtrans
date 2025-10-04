// Service Worker complet pour SadTrans
// Combine OneSignal, cache management, offline support, et background sync

// Importer OneSignal
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');

// Configuration du service worker
const CACHE_NAME = 'sadtrans-v1.0.0';
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'sadtrans-api-v1.0.0';

// Ressources à mettre en cache
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/index.css',
  '/app.js',
  '/offline.html',
  // Ajouter d'autres ressources statiques ici
];

// URLs d'API à mettre en cache
const API_URLS = [
  '/api/users',
  '/api/partners',
  '/api/operations',
  // Ajouter d'autres endpoints API ici
];

console.log('🚀 Service Worker SadTrans chargé');

// ========================================
// 1. INSTALLATION ET MISE À JOUR
// ========================================

self.addEventListener('install', (event) => {
  console.log('📦 Installation du Service Worker');
  
  event.waitUntil(
    (async () => {
      try {
        // Créer le cache principal
        const cache = await caches.open(CACHE_NAME);
        console.log('💾 Mise en cache des ressources statiques');
        await cache.addAll(STATIC_RESOURCES);
        
        // Forcer l'activation immédiate
        await self.skipWaiting();
        console.log('✅ Service Worker installé avec succès');
      } catch (error) {
        console.error('❌ Erreur lors de l\'installation:', error);
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('🔄 Activation du Service Worker');
  
  event.waitUntil(
    (async () => {
      try {
        // Nettoyer les anciens caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('sadtrans-') && name !== CACHE_NAME && name !== API_CACHE_NAME
        );
        
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log('🗑️ Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        
        // Prendre le contrôle de tous les clients
        await self.clients.claim();
        console.log('✅ Service Worker activé avec succès');
      } catch (error) {
        console.error('❌ Erreur lors de l\'activation:', error);
      }
    })()
  );
});

// ========================================
// 2. STRATÉGIES DE CACHE
// ========================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) return;
  
  // Stratégie pour les ressources statiques (Cache First)
  if (STATIC_RESOURCES.some(resource => url.pathname === resource)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Stratégie pour les API (Network First avec fallback)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }
  
  // Stratégie pour les pages HTML (Network First avec fallback offline)
  if (request.destination === 'document') {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }
  
  // Stratégie par défaut (Stale While Revalidate)
  event.respondWith(staleWhileRevalidate(request));
});

// Cache First - Pour les ressources statiques
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('❌ Erreur Cache First:', error);
    return new Response('Ressource non disponible', { status: 503 });
  }
}

// Network First - Pour les API
async function networkFirstWithCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('🌐 Réseau indisponible, utilisation du cache pour:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Données non disponibles hors ligne' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Network First avec page offline - Pour les pages HTML
async function networkFirstWithOffline(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('🌐 Affichage de la page hors ligne');
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_URL);
    return offlineResponse || new Response('Page non disponible hors ligne', { status: 503 });
  }
}

// Stale While Revalidate - Stratégie par défaut
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// ========================================
// 3. SYNCHRONISATION EN ARRIÈRE-PLAN
// ========================================

// Gestion des requêtes échouées
const failedRequests = [];

self.addEventListener('sync', (event) => {
  console.log('🔄 Synchronisation en arrière-plan:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  console.log('📤 Tentative de synchronisation des requêtes échouées');
  
  for (let i = failedRequests.length - 1; i >= 0; i--) {
    const request = failedRequests[i];
    try {
      await fetch(request);
      failedRequests.splice(i, 1);
      console.log('✅ Requête synchronisée:', request.url);
    } catch (error) {
      console.log('❌ Échec de synchronisation:', request.url);
    }
  }
}

// ========================================
// 4. GESTION DES MESSAGES
// ========================================

self.addEventListener('message', (event) => {
  console.log('📨 Message reçu dans le service worker:', event.data);
  
  // Laisser OneSignal gérer ses propres messages
  if (event.data && event.data.command === 'onesignal') {
    return;
  }
  
  // Commandes personnalisées
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
        
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        });
        break;
        
      case 'CACHE_URLS':
        cacheUrls(event.data.urls).then(() => {
          event.ports[0].postMessage({ success: true });
        });
        break;
    }
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('🗑️ Tous les caches supprimés');
}

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(urls);
  console.log('💾 URLs mises en cache:', urls);
}

// ========================================
// 5. NOTIFICATIONS PUSH (OneSignal + Custom)
// ========================================

self.addEventListener('push', (event) => {
  console.log('🔔 Notification push reçue:', event);
  
  // Laisser OneSignal gérer ses notifications
  if (event.data) {
    try {
      const data = event.data.json();
      if (data.custom && data.custom.i) {
        // C'est une notification OneSignal
        return;
      }
    } catch (e) {
      // Pas une notification OneSignal JSON
    }
  }
  
  // Gérer les notifications personnalisées
  const options = {
    body: 'Nouvelle notification SadTrans',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Voir',
        icon: '/icon-explore.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/icon-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('SadTrans', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification cliquée:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Fermer la notification (déjà fait ci-dessus)
  } else {
    // Clic sur la notification principale
    event.waitUntil(
      clients.matchAll().then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// ========================================
// 6. GESTION DES ERREURS
// ========================================

self.addEventListener('error', (event) => {
  console.error('❌ Erreur dans le Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rejetée dans le Service Worker:', event.reason);
});

console.log('✅ Service Worker SadTrans configuré avec succès');