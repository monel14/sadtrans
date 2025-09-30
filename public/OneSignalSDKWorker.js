// Ajout du listener 'message' au début pour éviter le warning
self.addEventListener("message", (event) => {
  console.log("Message reçu dans le SW OneSignal :", event.data);
  // Ajoutez ici la logique de traitement des messages si nécessaire
});

// OneSignal Service Worker avec fallback local
(function() {
  const CDN_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js";
  
  // Tentative de chargement du SDK depuis le CDN avec gestion d'erreur
  try {
    importScripts(CDN_URL);
  } catch (e) {
    console.warn('Impossible de charger le SDK OneSignal depuis le CDN:', e);
    // En dernier recours, on continue sans le SDK
  }
})();