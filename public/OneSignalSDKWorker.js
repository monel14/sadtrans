// OneSignal Service Worker - Configuration améliorée
// Évite les conflits avec d'autres gestionnaires de message

// Importer le SDK OneSignal
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Ajouter un gestionnaire d'événements pour les messages, mais uniquement si OneSignal l'a déjà ajouté
self.addEventListener('message', function(event) {
    // Laisser OneSignal gérer ses propres messages
    if (event.data && event.data.onesignal) {
        // Ne pas empêcher le comportement par défaut, OneSignal s'en occupera
        return;
    }
    
    // Gérer d'autres messages si nécessaire
    console.log('Message reçu dans le Service Worker:', event.data);
}, false);