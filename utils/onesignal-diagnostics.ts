/**
 * Utilitaires de diagnostic OneSignal
 */

export class OneSignalDiagnostics {
  /**
   * Vérifie la configuration du domaine OneSignal
   */
  static async checkDomainConfiguration(): Promise<{
    isConfigured: boolean;
    currentDomain: string;
    suggestions: string[];
    errors: string[];
  }> {
    const currentDomain = window.location.origin;
    const hostname = window.location.hostname;
    const suggestions: string[] = [];
    const errors: string[] = [];

    // Domaines probablement configurés pour cette app OneSignal
    const knownConfiguredDomains = [
      'sadtrans.netlify.app',
      'localhost',
      '127.0.0.1'
    ];

    const isConfigured = knownConfiguredDomains.some(domain => 
      hostname === domain || hostname.includes(domain)
    );

    if (!isConfigured) {
      errors.push(`Domaine ${currentDomain} possiblement non configuré dans OneSignal`);
      suggestions.push("Vérifiez la configuration des domaines dans OneSignal Dashboard");
      suggestions.push("Ajoutez ce domaine dans Settings > Platforms > Web Push");
    }

    // Vérifier HTTPS
    if (window.location.protocol !== 'https:' && hostname !== 'localhost') {
      errors.push("OneSignal nécessite HTTPS en production");
      suggestions.push("Utilisez HTTPS pour ce domaine");
    }

    return {
      isConfigured,
      currentDomain,
      suggestions,
      errors
    };
  }

  /**
   * Diagnostic complet OneSignal
   */
  static async runCompleteDiagnostic(): Promise<void> {
    console.group("🔍 Diagnostic OneSignal Complet");

    // 1. Vérification du domaine
    const domainCheck = await this.checkDomainConfiguration();
    console.log("🌐 Configuration domaine:", domainCheck);

    // 2. Vérification des service workers
    await this.checkServiceWorkers();

    // 3. Vérification des permissions
    this.checkPermissions();

    // 4. Vérification de l'environnement
    this.checkEnvironment();

    console.groupEnd();
  }

  /**
   * Vérifie les service workers
   */
  static async checkServiceWorkers(): Promise<void> {
    console.group("🔧 Service Workers");

    if (!('serviceWorker' in navigator)) {
      console.error("❌ Service Workers non supportés");
      console.groupEnd();
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 ${registrations.length} service worker(s) trouvé(s)`);

      const conflicts: string[] = [];
      let hasOneSignal = false;
      let hasWorkbox = false;

      registrations.forEach((reg, index) => {
        const scriptURL = reg.active?.scriptURL || '';
        const scope = reg.scope;

        console.log(`SW ${index + 1}:`, {
          scope,
          scriptURL,
          state: reg.active?.state
        });

        if (scriptURL.includes('OneSignal')) {
          hasOneSignal = true;
        }
        if (scriptURL.includes('workbox') || scriptURL.includes('sw.js')) {
          hasWorkbox = true;
        }

        // Détecter les conflits de scope
        if (scope === window.location.origin + '/' && registrations.length > 1) {
          conflicts.push(`Conflit potentiel: scope racine partagé`);
        }
      });

      if (hasOneSignal && hasWorkbox) {
        console.warn("⚠️ OneSignal et Workbox détectés - risque de conflit");
      }

      if (conflicts.length > 0) {
        console.warn("🚨 Conflits détectés:", conflicts);
      }

    } catch (error) {
      console.error("❌ Erreur lors de la vérification SW:", error);
    }

    console.groupEnd();
  }

  /**
   * Vérifie les permissions
   */
  static checkPermissions(): void {
    console.group("🔔 Permissions");

    if ('Notification' in window) {
      console.log("Permission navigateur:", Notification.permission);
      
      if (Notification.permission === 'denied') {
        console.error("❌ Notifications bloquées par l'utilisateur");
      } else if (Notification.permission === 'default') {
        console.warn("⚠️ Permission non demandée");
      } else {
        console.log("✅ Notifications autorisées");
      }
    } else {
      console.error("❌ API Notifications non supportée");
    }

    console.groupEnd();
  }

  /**
   * Vérifie l'environnement
   */
  static checkEnvironment(): void {
    console.group("🌐 Environnement");

    console.log("URL:", window.location.href);
    console.log("Protocol:", window.location.protocol);
    console.log("Hostname:", window.location.hostname);
    console.log("User Agent:", navigator.userAgent);

    // Vérifications spécifiques
    const checks = {
      "HTTPS ou localhost": window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      "Service Workers supportés": 'serviceWorker' in navigator,
      "Notifications supportées": 'Notification' in window,
      "Push API supportée": 'PushManager' in window
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });

    console.groupEnd();
  }
}

// Exposer globalement pour debug
if (typeof window !== 'undefined') {
  (window as any).OneSignalDiagnostics = OneSignalDiagnostics;
  (window as any).osDiag = () => OneSignalDiagnostics.runCompleteDiagnostic();
}