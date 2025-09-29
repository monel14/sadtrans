// OneSignal Service Worker avec fallback local
(function() {
  const CDN_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js";
  
  // Tentative de chargement du SDK depuis le CDN
  importScripts(CDN_URL);
})();