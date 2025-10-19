/**
 * Fix pour les erreurs de communication Service Worker OneSignal
 */

export class OneSignalServiceWorkerFix {
  private static isPatched = false;
  private static originalConsoleError: typeof console.error;

  /**
   * Applique le patch pour masquer les erreurs de communication SW
   */
  static applyPatch(): void {
    if (this.isPatched) return;

    console.log("🔧 Application du patch OneSignal SW...");

    // Sauvegarder la fonction console.error originale
    this.originalConsoleError = console.error;

    // Intercepter les erreurs de console
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Filtrer les erreurs de communication SW OneSignal
      if (this.shouldSuppressError(message)) {
        console.warn("🔇 Erreur OneSignal SW supprimée:", message);
        return;
      }
      
      // Laisser passer les autres erreurs
      this.originalConsoleError.apply(console, args);
    };

    // Intercepter les erreurs globales
    window.addEventListener('error', (event) => {
      if (this.shouldSuppressError(event.message)) {
        console.warn("🔇 Erreur globale OneSignal SW supprimée:", event.message);
        event.preventDefault();
        return false;
      }
    });

    // Intercepter les promesses rejetées
    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || event.reason?.toString() || '';
      if (this.shouldSuppressError(message)) {
        console.warn("🔇 Promise rejetée OneSignal SW supprimée:", message);
        event.preventDefault();
        return false;
      }
    });

    this.isPatched = true;
    console.log("✅ Patch OneSignal SW appliqué");
  }

  /**
   * Détermine si une erreur doit être supprimée
   */
  private static shouldSuppressError(message: string): boolean {
    const suppressPatterns = [
      'Could not get ServiceWorkerRegistration to postMessage',
      'ServiceWorkerRegistration to postMessage',
      'Worker Messenger',
      'Page -> SW',
      'directPostMessageToSW',
      'notifySWToUpsertSession',
      'notifySWToDeactivateSession',
      'SessionManager'
    ];

    return suppressPatterns.some(pattern => 
      message.includes(pattern)
    );
  }

  /**
   * Retire le patch et restaure le comportement normal
   */
  static removePatch(): void {
    if (!this.isPatched) return;

    console.log("🔧 Suppression du patch OneSignal SW...");
    
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
    }

    this.isPatched = false;
    console.log("✅ Patch OneSignal SW supprimé");
  }

  /**
   * Diagnostic des erreurs de communication SW
   */
  static async diagnoseServiceWorkerCommunication(): Promise<void> {
    console.group("🔍 Diagnostic Communication Service Worker");

    try {
      if (!('serviceWorker' in navigator)) {
        console.error("❌ Service Workers non supportés");
        console.groupEnd();
        return;
      }

      // Vérifier les registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 ${registrations.length} service worker(s) actif(s)`);

      let workboxSW = null;
      let oneSignalSW = null;

      registrations.forEach((reg, index) => {
        const scriptURL = reg.active?.scriptURL || '';
        const scope = reg.scope;
        const state = reg.active?.state;

        console.log(`SW ${index + 1}:`, {
          scriptURL,
          scope,
          state,
          isWorkbox: scriptURL.includes('workbox') || scriptURL.includes('sw.js'),
          isOneSignal: scriptURL.includes('OneSignal')
        });

        if (scriptURL.includes('workbox') || scriptURL.includes('sw.js')) {
          workboxSW = reg;
        }
        if (scriptURL.includes('OneSignal')) {
          oneSignalSW = reg;
        }
      });

      // Test de communication avec chaque SW
      if (workboxSW) {
        console.log("🧪 Test communication Workbox...");
        await this.testServiceWorkerCommunication(workboxSW, 'Workbox');
      }

      if (oneSignalSW) {
        console.log("🧪 Test communication OneSignal...");
        await this.testServiceWorkerCommunication(oneSignalSW, 'OneSignal');
      }

      // Vérifier l'état du contrôleur
      if (navigator.serviceWorker.controller) {
        console.log("🎯 SW Contrôleur actuel:", {
          scriptURL: navigator.serviceWorker.controller.scriptURL,
          state: navigator.serviceWorker.controller.state
        });
      } else {
        console.warn("⚠️ Aucun SW contrôleur actif");
      }

    } catch (error) {
      console.error("❌ Erreur lors du diagnostic:", error);
    }

    console.groupEnd();
  }

  /**
   * Test de communication avec un service worker
   */
  private static async testServiceWorkerCommunication(
    registration: ServiceWorkerRegistration, 
    name: string
  ): Promise<void> {
    try {
      const channel = new MessageChannel();
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 5000);

        channel.port2.onmessage = (event) => {
          clearTimeout(timeout);
          resolve(event.data);
        };
      });

      // Envoyer un message de test
      registration.active?.postMessage({
        type: 'TEST_COMMUNICATION',
        timestamp: Date.now()
      }, [channel.port1]);

      const response = await responsePromise;
      console.log(`✅ ${name} communication OK:`, response);

    } catch (error) {
      console.warn(`⚠️ ${name} communication échouée:`, error.message);
    }
  }

  /**
   * Force la réinitialisation des service workers
   */
  static async forceServiceWorkerReset(): Promise<void> {
    console.log("🔄 Réinitialisation forcée des service workers...");

    try {
      // Désenregistrer tous les SW
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        console.log("🗑️ Désenregistrement SW:", registration.scope);
        await registration.unregister();
      }

      // Nettoyer les caches
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        console.log("🗑️ Suppression cache:", cacheName);
        await caches.delete(cacheName);
      }

      console.log("✅ Réinitialisation terminée");
      console.log("🔄 Rechargez la page pour redémarrer les service workers");

    } catch (error) {
      console.error("❌ Erreur lors de la réinitialisation:", error);
    }
  }
}

// Auto-application du patch au chargement
if (typeof window !== 'undefined') {
  // Appliquer le patch automatiquement
  OneSignalServiceWorkerFix.applyPatch();

  // Exposer pour debug
  (window as any).OneSignalSWFix = OneSignalServiceWorkerFix;
  (window as any).osSWDiag = () => OneSignalServiceWorkerFix.diagnoseServiceWorkerCommunication();
  (window as any).osSWReset = () => OneSignalServiceWorkerFix.forceServiceWorkerReset();

  console.log("🔧 OneSignal SW Fix chargé - Erreurs de communication supprimées");
}