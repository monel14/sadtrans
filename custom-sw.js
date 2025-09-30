// Ajout du listener 'message' au début pour éviter le warning
// Déclarer tous les addEventListener au plus haut niveau.
self.addEventListener("message", (event) => {
  console.log("Message reçu dans le SW :", event.data);
  // Ajoutez ici la logique de traitement des messages si nécessaire
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Service Worker personnalisé - version modifiée pour éviter les conflits avec OneSignal
(function() {
  const CDN_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js';
  
  // Charger le SDK OneSignal en dehors du scope de notre Service Worker
  // pour éviter les conflits
  try {
    importScripts(CDN_URL);
  } catch (e) {
    console.warn('Impossible de charger le SDK OneSignal dans ce Service Worker:', e);
  }
})();

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox est chargé`);
  
  // Le manifeste de pré-cache est injecté ici par vite-plugin-pwa
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
} else {
  console.log(`Workbox n'a pas pu être chargé.`);
}