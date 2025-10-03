// Service Worker unifié pour OneSignal + Workbox
// Ce fichier combine OneSignal et votre service worker personnalisé

// Importer OneSignal
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');

// Importer Workbox si nécessaire
// importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Configuration OneSignal
console.log('Service Worker unifié chargé avec OneSignal');

// Gestionnaire pour les messages entre OneSignal et la page
self.addEventListener('message', (event) => {
  console.log('Message reçu dans le service worker:', event.data);
  
  // Laisser OneSignal gérer ses propres messages
  if (event.data && event.data.command === 'onesignal') {
    // OneSignal gère automatiquement ses messages
    return;
  }
  
  // Gérer vos propres messages ici si nécessaire
});

// Gestionnaire pour les notifications push
self.addEventListener('push', (event) => {
  console.log('Notification push reçue:', event);
  // OneSignal gère automatiquement les notifications push
});

// Gestionnaire pour les clics sur notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Notification cliquée:', event);
  // OneSignal gère automatiquement les clics
});

console.log('Service Worker unifié configuré avec succès');