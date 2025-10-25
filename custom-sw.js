// 🚀 Service Worker SadTrans - Version Améliorée 2.1.0
// Corrections: Résilience, Sécurité, Offline, Validation

const SW_VERSION = '2.1.0';
const CACHE_PREFIX = `sadtrans-v${SW_VERSION}`;

// 🔧 Configuration
const CONFIG = {
  PUSH_TIMEOUT: 10000, // 10 secondes
  MAX_NOTIFICATION_TITLE: 100,
  MAX_NOTIFICATION_BODY: 300,
  OFFLINE_PAGE: '/offline.html',
  DEFAULT_ICON: '/favicon.ico'
};

// ==========================================
// CHARGEMENT WORKBOX AVEC FALLBACK
// ==========================================
let workboxAvailable = false;

try {
  importScripts('/workbox-sw.js');

  if (workbox) {
    console.log('✅ Workbox chargé avec succès');
    workboxAvailable = true;

    // Configuration Workbox
    workbox.setConfig({ debug: false });

    // Le manifeste de pré-cache est injecté ici par vite-plugin-pwa
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [], {
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/]
    });

    // Routes pour les API de notifications
    workbox.routing.registerRoute(
      /^\/api\/push-subscriptions/,
      new workbox.strategies.NetworkOnly()
    );

    // Gestion des images avec cache
    workbox.routing.registerRoute(
      /\.(?:png|gif|jpg|jpeg|webp|svg)$/i,
      new workbox.strategies.CacheFirst({
        cacheName: `${CACHE_PREFIX}-images`,
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
        ],
      })
    );

    // Ressources statiques
    workbox.routing.registerRoute(
      /\.(?:css|js)$/i,
      new workbox.strategies.StaleWhileRevalidate({
        cacheName: `${CACHE_PREFIX}-static-resources`,
      })
    );
  }
} catch (error) {
  console.error('❌ Workbox non disponible, mode dégradé activé:', error);
  workboxAvailable = false;
}

// ==========================================
// GESTIONNAIRE FETCH (MODE DÉGRADÉ SI PAS WORKBOX)
// ==========================================
if (!workboxAvailable) {
  self.addEventListener('fetch', (event) => {
    // Ignorer les requêtes non-GET
    if (event.request.method !== 'GET') {
      return;
    }

    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request)
            .then(response => {
              // Mettre en cache les ressources statiques
              if (response.ok && event.request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|webp)$/i)) {
                const responseToCache = response.clone();
                caches.open(`${CACHE_PREFIX}-static`)
                  .then(cache => cache.put(event.request, responseToCache))
                  .catch(err => console.warn('Cache put failed:', err));
              }
              return response;
            });
        })
        .catch(error => {
          console.error('Fetch failed:', error);

          // Retourner une page offline pour les navigations
          if (event.request.mode === 'navigate') {
            return caches.match(CONFIG.OFFLINE_PAGE)
              .then(offlinePage => {
                if (offlinePage) return offlinePage;

                // Fallback HTML minimal si pas de page offline
                return new Response(
                  '<html><body><h1>Offline</h1><p>Pas de connexion Internet</p></body></html>',
                  { headers: { 'Content-Type': 'text/html' } }
                );
              });
          }

          return new Response('Offline', { status: 503 });
        })
    );
  });
}

// ==========================================
// VALIDATION DES DONNÉES
// ==========================================
function sanitizeString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  return str.substring(0, maxLength).trim();
}

function validateNotificationData(data) {
  return {
    title: sanitizeString(data.title || 'SadTrans', CONFIG.MAX_NOTIFICATION_TITLE),
    body: sanitizeString(data.body || 'Nouvelle notification', CONFIG.MAX_NOTIFICATION_BODY),
    icon: data.icon || CONFIG.DEFAULT_ICON,
    badge: data.badge || CONFIG.DEFAULT_ICON,
    image: data.image || null,
    data: data.data || {},
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
    silent: Boolean(data.silent),
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
    tag: sanitizeString(data.tag || 'sadtrans-notification', 50),
    requireInteraction: data.requireInteraction !== false,
    url: data.url || '/'
  };
}

function validateURL(urlString, baseURL) {
  try {
    const url = new URL(urlString, baseURL || self.location.origin);
    // Vérifier que c'est la même origine pour la sécurité
    if (url.origin === self.location.origin) {
      return url.href;
    }
    console.warn('URL différente origine, fallback sur /', urlString);
    return self.location.origin + '/';
  } catch (error) {
    console.error('URL invalide:', urlString, error);
    return self.location.origin + '/';
  }
}

// ==========================================
// FORMATAGE PAR TYPE DE NOTIFICATION
// ==========================================
function formatNotificationByType(type, data) {
  const formatters = {
    'transaction': {
      title: `💰 ${data.title}`,
      vibrate: [300, 100, 300, 100, 300],
      actions: [
        {
          action: 'view',
          title: '👁️ Voir',
          icon: CONFIG.DEFAULT_ICON
        },
        {
          action: 'approve',
          title: '✅ Approuver',
          icon: CONFIG.DEFAULT_ICON
        }
      ],
      requireInteraction: true
    },
    'recharge': {
      title: `🔋 ${data.title}`,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'view',
          title: '👁️ Voir',
          icon: CONFIG.DEFAULT_ICON
        }
      ]
    },
    'system': {
      title: `⚙️ ${data.title}`,
      vibrate: [100, 50, 100],
      silent: data.silent || false
    },
    'urgent': {
      title: `🚨 ${data.title}`,
      vibrate: [500, 200, 500, 200, 500],
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: '🚨 Voir maintenant',
          icon: CONFIG.DEFAULT_ICON
        }
      ]
    }
  };

  const formatter = formatters[type];
  if (formatter) {
    return {
      ...data,
      ...formatter,
      title: formatter.title // Assurer que le titre formaté est appliqué
    };
  }

  return data;
}

// ==========================================
// GESTIONNAIRE DE MESSAGES
// ==========================================
self.addEventListener("message", (event) => {
  console.log("Message reçu dans le SW :", event.data);

  // Validation de l'origine pour la sécurité
  if (event.origin && event.origin !== self.location.origin) {
    console.warn('⚠️ Message de source non autorisée:', event.origin);
    return;
  }

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        console.log('⏭️ Skip waiting demandé');
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        // Répondre avec la version actuelle
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            version: SW_VERSION,
            timestamp: Date.now()
          });
        }
        break;
      default:
        console.log("Message SW non géré:", event.data.type);
    }
  }

  // Répondre toujours pour éviter les timeouts
  try {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        received: true,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.warn("Erreur lors de la réponse au message:", error);
  }
});

// ==========================================
// GESTIONNAIRE PUSH POUR FCM DATA MESSAGES
// ==========================================
self.addEventListener('push', (event) => {
  console.log('🔔 [PUSH] Notification FCM data message reçue');
  console.log('🔔 [PUSH] event.data exists:', !!event.data);

  const promiseChain = (async () => {
    try {
      if (!self.registration?.showNotification) {
        console.error('❌ [PUSH] showNotification non disponible');
        throw new Error('Notifications non disponibles');
      }

      // Configuration par défaut
      let notificationData = {
        title: 'SadTrans',
        body: 'Nouvelle notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        url: '/',
        timestamp: Date.now()
      };

      // ✅ PARSING DES DATA MESSAGES FCM
      if (event.data) {
        console.log('📦 [PUSH] Parsing FCM data message...');

        try {
          // FCM data messages arrivent en JSON
          const payload = event.data.json();
          console.log('✅ [PUSH] Payload FCM reçu:', JSON.stringify(payload));

          // Les data messages FCM ont leurs données dans la propriété racine
          if (payload) {
            notificationData = {
              title: payload.title || notificationData.title,
              body: payload.body || notificationData.body,
              icon: payload.icon || notificationData.icon,
              badge: payload.badge || notificationData.badge,
              url: payload.url || notificationData.url,
              userId: payload.userId,
              timestamp: payload.timestamp ? parseInt(payload.timestamp) : Date.now(),
              type: payload.type
            };

            // Formatage spécial selon le type
            if (payload.type) {
              notificationData = formatNotificationByType(payload.type, notificationData);
            }
          }
        } catch (error) {
          console.error('❌ [PUSH] Erreur parsing FCM data:', error);
        }
      } else {
        console.warn('⚠️ [PUSH] Aucun payload - notification par défaut');
      }

      // Validation finale
      notificationData = validateNotificationData(notificationData);
      console.log('📋 [PUSH] Données validées:', {
        title: notificationData.title,
        body: notificationData.body,
        icon: notificationData.icon,
        url: notificationData.url
      });

      // Options de notification
      const notificationOptions = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        data: {
          url: validateURL(notificationData.url),
          userId: notificationData.userId,
          timestamp: notificationData.timestamp,
          version: SW_VERSION
        },
        actions: notificationData.actions || [
          {
            action: 'open',
            title: '👁️ Voir',
            icon: '/favicon.ico'
          }
        ],
        requireInteraction: true,
        tag: 'sadtrans-notification',
        renotify: true,
        vibrate: notificationData.vibrate || [200, 100, 200],
        timestamp: notificationData.timestamp
      };

      console.log('🚀 [PUSH] Affichage de la notification...');

      // Afficher la notification manuellement
      await self.registration.showNotification(
        notificationData.title,
        notificationOptions
      );

      console.log('✅ [PUSH] Notification affichée avec succès!');

      // Notifier les clients
      const clients = await self.clients.matchAll({
        includeUncontrolled: true
      });

      console.log(`📱 [PUSH] Notification de ${clients.length} client(s)`);

      for (const client of clients) {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          data: notificationData,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ [PUSH] Erreur critique:', error);

      // Notification de fallback
      try {
        console.log('🔄 [PUSH] Tentative de notification fallback...');
        await self.registration.showNotification('SadTrans', {
          body: 'Nouvelle notification',
          icon: '/favicon.ico',
          tag: 'sadtrans-fallback',
          requireInteraction: true,
          data: { url: '/' }
        });
        console.log('✅ [PUSH] Notification fallback affichée');
      } catch (fallbackError) {
        console.error('❌ [PUSH] Échec total:', fallbackError);
      }
    }
  })();

  event.waitUntil(promiseChain);
});

// ==========================================
// FONCTIONS UTILITAIRES (déjà définies plus haut)
// ==========================================

// ==========================================
// TEST DE DÉBOGAGE
// ==========================================

// Fonction pour tester manuellement une notification
self.testNotification = async (title = 'Test SadTrans', body = 'Ceci est un test') => {
  console.log('🧪 [TEST] Démarrage du test de notification...');

  try {
    if (!self.registration?.showNotification) {
      throw new Error('showNotification non disponible');
    }

    await self.registration.showNotification(title, {
      body: body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: '/',
        test: true,
        timestamp: Date.now()
      }
    });

    console.log('✅ [TEST] Notification de test affichée avec succès!');
    return { success: true, message: 'Notification affichée' };
  } catch (error) {
    console.error('❌ [TEST] Erreur:', error);
    return { success: false, error: error.message };
  }
};

// Fonction pour simuler un événement push
self.simulatePush = async (payload = { title: 'Test Push', body: 'Message de test' }) => {
  console.log('🧪 [SIMULATE] Simulation d\'un événement push...');
  console.log('📦 [SIMULATE] Payload:', JSON.stringify(payload));

  try {
    const mockEvent = {
      data: {
        json: () => payload,
        text: () => JSON.stringify(payload)
      }
    };

    // Simuler le traitement
    let notificationData = validateNotificationData({
      title: payload.title || 'Test',
      body: payload.body || 'Message de test',
      icon: payload.icon || '/favicon.ico',
      data: payload.data || {}
    });

    await self.registration.showNotification(
      notificationData.title,
      {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: '/favicon.ico',
        tag: 'simulated-push',
        requireInteraction: true,
        data: notificationData.data
      }
    );

    console.log('✅ [SIMULATE] Push simulé avec succès!');
    return { success: true, data: notificationData };
  } catch (error) {
    console.error('❌ [SIMULATE] Erreur:', error);
    return { success: false, error: error.message };
  }
};

console.log('🔔 Service Worker chargé avec fonctions de test:');
console.log('   - self.testNotification(title, body)');
console.log('   - self.simulatePush(payload)');

// ==========================================
// GESTIONNAIRE CLIC NOTIFICATION
// ==========================================
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification cliquée:', event);
  console.log('Action:', event.action);
  console.log('Data:', event.notification.data);

  event.notification.close();

  // Gestion des actions spécifiques
  let urlToOpen = '/';
  let shouldFocus = true;

  if (event.action) {
    // Actions personnalisées
    switch (event.action) {
      case 'view':
        urlToOpen = event.notification.data?.url || '/';
        break;
      case 'approve':
        urlToOpen = event.notification.data?.approveUrl || '/admin/transactions';
        break;
      case 'dismiss':
        shouldFocus = false;
        break;
      default:
        urlToOpen = event.notification.data?.url || '/';
    }
  } else {
    // Clic principal sur la notification
    urlToOpen = event.notification.data?.url || '/';
  }

  // Valider l'URL
  urlToOpen = validateURL(urlToOpen);

  if (!shouldFocus) {
    return;
  }

  const promiseChain = self.clients.claim()
    .then(() => {
      return self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
    })
    .then((windowClients) => {
      console.log('🔍 Recherche de fenêtres existantes...', windowClients.length, 'trouvées');

      // Envoyer le message à TOUS les clients actifs
      const messageData = {
        type: 'NOTIFICATION_CLICK',
        action: event.action || 'default',
        url: urlToOpen,
        data: event.notification.data,
        timestamp: Date.now()
      };

      for (const client of windowClients) {
        console.log('📤 Envoi message à client:', client.url);
        client.postMessage(messageData);
      }

      // Chercher une fenêtre existante de l'application
      let targetClient = null;
      const targetUrl = new URL(urlToOpen);

      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);

          // Vérifier si c'est la même origine
          if (clientUrl.origin === targetUrl.origin) {
            targetClient = client;
            break;
          }
        } catch (urlError) {
          console.warn('⚠️ Erreur parsing URL client:', urlError);
        }
      }

      if (targetClient && 'focus' in targetClient) {
        console.log('🎯 Fenêtre existante trouvée, focus...');
        return targetClient.focus();
      }

      // Si aucune fenêtre n'est trouvée, en ouvrir une nouvelle
      if (clients.openWindow) {
        console.log('🆕 Ouverture d\'une nouvelle fenêtre:', urlToOpen);
        return clients.openWindow(urlToOpen);
      }
    })
    .catch((error) => {
      console.error('❌ Erreur lors de la gestion du clic:', error);

      // Fallback: essayer d'ouvrir une nouvelle fenêtre quand même
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

// ==========================================
// GESTIONNAIRE FERMETURE NOTIFICATION
// ==========================================
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification fermée:', event.notification.tag);

  // Optionnel: envoyer des analytics
  self.clients.matchAll({ includeUncontrolled: true })
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          tag: event.notification.tag,
          timestamp: Date.now()
        });
      });
    })
    .catch(err => console.warn('Erreur notification close:', err));
});

// ==========================================
// INSTALLATION
// ==========================================
self.addEventListener('install', (event) => {
  console.log('📦 Installation du Service Worker v' + SW_VERSION);

  // Forcer l'activation immédiate
  self.skipWaiting();

  // Optionnel: Pré-cacher des ressources critiques
  event.waitUntil(
    caches.open(`${CACHE_PREFIX}-critical`)
      .then(cache => {
        return cache.addAll([
          '/',
          CONFIG.DEFAULT_ICON
        ]).catch(err => {
          console.warn('⚠️ Erreur pré-cache:', err);
          // Ne pas bloquer l'installation si le pré-cache échoue
        });
      })
  );
});

// ==========================================
// ACTIVATION
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('🔄 Activation du Service Worker v' + SW_VERSION);

  event.waitUntil(
    Promise.resolve()
      .then(() => {
        // Nettoyer les anciens caches
        console.log('🗑️ Nettoyage des anciens caches...');
        return caches.keys();
      })
      .then((cacheNames) => {
        // Lister les caches à garder
        const currentCaches = [
          `${CACHE_PREFIX}-images`,
          `${CACHE_PREFIX}-static-resources`,
          `${CACHE_PREFIX}-static`,
          `${CACHE_PREFIX}-critical`
        ];

        // Garder aussi les caches Workbox actuels
        const workboxCaches = cacheNames.filter(name =>
          name.startsWith('workbox-') &&
          !name.includes('temp')
        );

        const expectedCaches = [...currentCaches, ...workboxCaches];

        return Promise.all(
          cacheNames
            .filter(cacheName => !expectedCaches.includes(cacheName))
            .map((cacheName) => {
              console.log('🗑️ Suppression cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Prendre le contrôle immédiatement de tous les clients
        console.log('🎯 Prise de contrôle des clients...');
        return self.clients.claim();
      })
      .then(() => {
        // Notifier tous les clients que le SW est prêt
        console.log('📢 Notification des clients...');
        return self.clients.matchAll({ includeUncontrolled: true });
      })
      .then(clients => {
        console.log(`📱 ${clients.length} clients trouvés`);
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: SW_VERSION,
            timestamp: Date.now()
          });
        });
      })
      .then(() => {
        console.log('✅ Service Worker v' + SW_VERSION + ' activé avec succès');
      })
      .catch((error) => {
        console.error('❌ Erreur lors de l\'activation:', error);
      })
  );
});

// ==========================================
// GESTION DES ERREURS GLOBALES
// ==========================================
self.addEventListener('error', (event) => {
  console.error('❌ Erreur globale SW:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rejetée non gérée:', event.reason);
});

console.log('🚀 Service Worker v' + SW_VERSION + ' chargé');