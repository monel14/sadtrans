/**
 * Script de réparation rapide pour OneSignal
 * Utilisable dans la console du navigateur
 */

export class OneSignalFix {
  /**
   * Nettoie tous les service workers et redémarre OneSignal
   */
  static async cleanAndRestart(): Promise<void> {
    console.log("🧹 Nettoyage et redémarrage OneSignal...");
    
    try {
      // 1. Nettoyer les service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`🗑️ Suppression de ${registrations.length} service worker(s)...`);
        
        for (const registration of registrations) {
          await registration.unregister();
          console.log("✅ SW supprimé:", registration.scope);
        }
      }
      
      // 2. Nettoyer le localStorage OneSignal
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('OneSignal')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log("🗑️ LocalStorage nettoyé:", key);
      });
      
      // 3. Nettoyer le sessionStorage
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('OneSignal')) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log("🗑️ SessionStorage nettoyé:", key);
      });
      
      console.log("✅ Nettoyage terminé");
      console.log("🔄 Rechargez la page pour redémarrer OneSignal");
      
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage:", error);
    }
  }
  
  /**
   * Force la reconnexion OneSignal
   */
  static async forceReconnect(userId?: string): Promise<void> {
    console.log("🔄 Reconnexion forcée OneSignal...");
    
    try {
      // Importer dynamiquement le service OneSignal
      const { OneSignalService } = await import('../services/onesignal.service');
      
      // Tenter une récupération
      await OneSignalService.attemptServiceWorkerRecovery();
      
      // Si un userId est fourni, tenter de se reconnecter
      if (userId) {
        await OneSignalService.login(userId);
        console.log("✅ Reconnexion utilisateur réussie");
      }
      
      // Vérifier l'état
      await OneSignalService.checkSubscription();
      
      console.log("✅ Reconnexion terminée");
      
    } catch (error) {
      console.error("❌ Erreur lors de la reconnexion:", error);
    }
  }
  
  /**
   * Diagnostic rapide
   */
  static async quickDiagnostic(): Promise<void> {
    console.group("🔍 Diagnostic Rapide OneSignal");
    
    // Environnement
    console.log("🌐 URL:", window.location.href);
    console.log("🔒 HTTPS:", window.location.protocol === 'https:');
    
    // Support navigateur
    console.log("🔧 Service Workers:", 'serviceWorker' in navigator);
    console.log("🔔 Notifications:", 'Notification' in window);
    console.log("📱 Permission:", 'Notification' in window ? Notification.permission : 'N/A');
    
    // Service Workers actifs
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`📋 Service Workers actifs: ${registrations.length}`);
        registrations.forEach((reg, i) => {
          console.log(`  SW ${i + 1}: ${reg.active?.scriptURL} (${reg.scope})`);
        });
      } catch (error) {
        console.error("❌ Erreur SW:", error);
      }
    }
    
    // État OneSignal
    try {
      const { OneSignalService } = await import('../services/onesignal.service');
      console.log("🔔 OneSignal initialisé:", OneSignalService.isReady());
      console.log("👤 Utilisateur actuel:", OneSignalService.getCurrentUserId());
    } catch (error) {
      console.error("❌ Erreur OneSignal:", error);
    }
    
    console.groupEnd();
  }
  
  /**
   * Test de notification simple
   */
  static async testNotification(): Promise<void> {
    console.log("🧪 Test de notification...");
    
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Test OneSignal Fix', {
            body: 'Notification de test fonctionnelle',
            icon: '/favicon.ico'
          });
          console.log("✅ Notification de test envoyée");
        } else {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification('Test OneSignal Fix', {
              body: 'Permission accordée, notification de test',
              icon: '/favicon.ico'
            });
            console.log("✅ Permission accordée et notification envoyée");
          } else {
            console.warn("⚠️ Permission refusée");
          }
        }
      } else {
        console.error("❌ API Notifications non supportée");
      }
    } catch (error) {
      console.error("❌ Erreur test notification:", error);
    }
  }
}

// Exposer globalement pour utilisation en console
if (typeof window !== 'undefined') {
  (window as any).OneSignalFix = OneSignalFix;
  
  // Raccourcis pratiques
  (window as any).osClean = () => OneSignalFix.cleanAndRestart();
  (window as any).osReconnect = (userId?: string) => OneSignalFix.forceReconnect(userId);
  (window as any).osQuickDiag = () => OneSignalFix.quickDiagnostic();
  (window as any).osTest = () => OneSignalFix.testNotification();
  
  console.log("🔧 OneSignal Fix tools loaded:");
  console.log("  osClean() - Nettoie et redémarre");
  console.log("  osReconnect(userId?) - Force la reconnexion");
  console.log("  osQuickDiag() - Diagnostic rapide");
  console.log("  osTest() - Test de notification");
}