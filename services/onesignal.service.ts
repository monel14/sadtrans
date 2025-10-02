// Types pour OneSignal (SDK moderne)
interface OneSignalConfig {
  appId: string;
  allowLocalhostAsSecureOrigin?: boolean;
}



interface OneSignalInstance {
  init: (config: OneSignalConfig) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User?: {
    PushSubscription?: {
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener: (
        event: string,
        callback: (change: any) => void,
      ) => void;
    };
  };
  Notifications?: {
    requestPermission: () => Promise<boolean>;
    permission: boolean;
    addEventListener: (event: string, callback: (event: any) => void) => void;
  };
}

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

const ONE_SIGNAL_APP_ID = "aa956232-9277-40b3-b0f0-44c2b67f7a7b";

export class OneSignalService {
  private static isInitialized = false;
  private static isInitializing = false;
  private static currentUserId: string | null = null;
  private static subscriptionId: string | null = null;
  private static operationQueue: (() => Promise<void>)[] = [];
  private static oneSignalInstance: OneSignalInstance | null = null;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialise OneSignal et associe optionnellement un userId
   */
  public static async init(userId?: string): Promise<void> {
    if (this.isInitialized) {
      console.log("OneSignal déjà initialisé");
      if (userId && userId !== this.currentUserId) {
        await this.login(userId);
      }
      return;
    }

    if (this.isInitializing) {
      console.log("OneSignal en cours d'initialisation, attente...");
      if (this.initPromise) {
        await this.initPromise;
        if (userId && userId !== this.currentUserId) {
          await this.login(userId);
        }
      }
      return;
    }

    this.isInitializing = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    this.initPromise = new Promise<void>((resolve, reject) => {
      // Add timeout to prevent infinite waiting
      const timeout = setTimeout(() => {
        console.warn(
          "OneSignal initialization timeout - continuing without push notifications",
        );
        this.isInitializing = false;
        this.initPromise = null;
        resolve();
      }, 10000); // 10 second timeout

      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          clearTimeout(timeout);
          this.oneSignalInstance = OneSignal;

          // Configuration pour éviter les conflits de service workers
          const config: any = {
            appId: ONE_SIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
          };

          // Configuration pour éviter les conflits avec Workbox
          if ('serviceWorker' in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              const hasWorkbox = registrations.some(reg =>
                reg.active?.scriptURL?.includes('workbox') ||
                reg.active?.scriptURL?.includes('sw.js') ||
                reg.scope === window.location.origin + '/'
              );

              if (hasWorkbox) {
                console.log("🔧 Workbox détecté, configuration OneSignal avec scope séparé");
                // Utiliser un scope différent pour éviter les conflits
                config.serviceWorkerParam = { scope: "/OneSignalSDKWorker/" };
                config.serviceWorkerPath = "OneSignalSDKWorker.js";
                config.allowLocalhostAsSecureOrigin = true;
              } else {
                // Configuration normale
                config.serviceWorkerParam = { scope: "/" };
                config.serviceWorkerPath = "OneSignalSDKWorker.js";
              }
            } catch (error) {
              console.warn("Impossible de vérifier les service workers existants:", error);
              // Configuration par défaut avec scope séparé pour éviter les conflits
              config.serviceWorkerParam = { scope: "/OneSignalSDKWorker/" };
              config.serviceWorkerPath = "OneSignalSDKWorker.js";
            }
          }

          await OneSignal.init(config);

          // Configuration spéciale pour localhost
          const isLocalhost =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

          if (isLocalhost) {
            console.log(
              "🔧 Mode localhost détecté - configuration spéciale OneSignal",
            );
          }

          console.log("OneSignal initialisé avec succès");

          // Attacher les événements (SDK moderne)
          this.attachEventListeners(OneSignal);

          // Définir l'userId si fourni
          if (userId) {
            await this.safeLogin(OneSignal, userId);
          }

          this.currentUserId = userId || null;
          this.isInitialized = true;
          this.isInitializing = false;

          // Traiter les opérations en file d'attente
          this.processOperationQueue();

          resolve();
        } catch (error) {
          clearTimeout(timeout);
          console.error("Erreur lors de l'init OneSignal:", error);

          // Check if it's a domain restriction error
          if (
            error instanceof Error &&
            error.message.includes("Can only be used on:")
          ) {
            console.error("🚫 OneSignal Domain Restriction Error");
            console.error("Cette app OneSignal est configurée pour un domaine spécifique");

            // Extraire le domaine autorisé du message d'erreur
            const allowedDomainMatch = error.message.match(/Can only be used on: (.+)/);
            if (allowedDomainMatch) {
              const allowedDomain = allowedDomainMatch[1];
              console.error(`✅ Domaine autorisé: ${allowedDomain}`);
              console.error(`❌ Domaine actuel: ${window.location.origin}`);

              console.group("💡 Solutions:");
              console.log("1. 🌐 Utilisez le domaine autorisé:", allowedDomain);
              console.log("2. ⚙️ Configurez OneSignal pour autoriser ce domaine:");
              console.log("   - Allez sur onesignal.com");
              console.log("   - Settings → Platforms → Web Push");
              console.log(`   - Ajoutez: ${window.location.origin}`);
              console.log("3. 🔧 Créez une app OneSignal séparée pour le développement");
              console.groupEnd();
            }

            this.isInitialized = false;
            this.isInitializing = false;
            this.initPromise = null;
            resolve(); // Continue without OneSignal
            return;
          }

          // Check if it's a service worker error
          if (
            error instanceof Error &&
            (error.message.includes("MIME type") ||
              error.message.includes("ServiceWorker") ||
              error.message.includes("importScripts"))
          ) {
            console.warn(
              "Service worker error detected - continuing in fallback mode",
            );
            this.isInitialized = false; // Keep as false to prevent further attempts
            this.isInitializing = false;
            this.initPromise = null;
            resolve(); // Don't reject, just continue without push notifications
          } else {
            this.isInitializing = false;
            this.initPromise = null;
            reject(error);
          }
        }
      });
    });

    // Attendre l'initialisation
    try {
      await this.initPromise;
    } catch (error) {
      console.error("Failed to initialize OneSignal:", error);
      // Continue execution even if OneSignal fails to initialize
    }
  }

  /**
   * Attache les écouteurs d'événements OneSignal (SDK moderne)
   */
  private static attachEventListeners(OneSignal: OneSignalInstance): void {
    try {
      // SDK moderne : utiliser Notifications.addEventListener
      if (OneSignal.Notifications?.addEventListener) {
        OneSignal.Notifications.addEventListener("click", (event: any) => {
          console.log("Notification OneSignal cliquée:", event);
          if (event?.notification?.url) {
            window.open(event.notification.url, "_blank");
          }
        });

        // Écouter les changements de permission
        OneSignal.Notifications.addEventListener(
          "permissionChange",
          (permission: boolean) => {
            console.log("Permission de notification changée:", permission);
            this.dispatchSubscriptionEvent(permission);
          },
        );

        console.log("Écouteurs OneSignal attachés");
      } else {
        console.warn("OneSignal.Notifications.addEventListener non disponible");
      }

      // Écouter les changements de souscription push avec gestion d'erreur améliorée
      if (OneSignal.User?.PushSubscription?.addEventListener) {
        OneSignal.User.PushSubscription.addEventListener(
          "change",
          (change: any) => {
            console.log("Changement de souscription push:", change);
            if (change.to?.id) {
              this.subscriptionId = change.to.id;
              console.log("Nouvel ID de souscription:", this.subscriptionId);
            }

            // Vérifier s'il y a des erreurs de service worker
            if (change.error) {
              console.warn("Erreur dans le changement de souscription:", change.error);
              this.handleServiceWorkerError(change.error);
            }
          }
        );
      }
    } catch (error) {
      console.error("Erreur lors de l'attachement des événements:", error);
      this.handleServiceWorkerError(error);
    }
  }

  /**
   * Gère les erreurs de service worker
   */
  private static handleServiceWorkerError(error: any): void {
    console.group("🚨 Erreur Service Worker OneSignal");
    console.error("Détails de l'erreur:", error);

    if (error && typeof error === 'object') {
      if (error.message && error.message.includes('postMessage')) {
        console.warn("💡 Problème de communication entre service workers détecté");
        console.warn("Cela peut être causé par un conflit avec Workbox ou un autre SW");
        console.warn("Solutions:");
        console.warn("1. Redémarrer le navigateur");
        console.warn("2. Vider le cache et les données du site");
        console.warn("3. Utiliser un service worker unifié");

        // Tentative de récupération automatique
        this.attemptServiceWorkerRecovery();
      }
    }

    console.groupEnd();
  }

  /**
   * Tentative de récupération automatique des erreurs de service worker
   */
  public static async attemptServiceWorkerRecovery(): Promise<void> {
    try {
      console.log("🔄 Tentative de récupération du service worker...");

      // Attendre un peu avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Réinitialiser l'état si nécessaire
      if (this.oneSignalInstance && this.currentUserId) {
        console.log("🔄 Reconnexion de l'utilisateur après erreur SW...");
        await this.safeLogin(this.oneSignalInstance, this.currentUserId);
      }

      // Vérifier l'état des notifications
      await this.checkSubscription();

      console.log("✅ Récupération du service worker terminée");
    } catch (error) {
      console.error("❌ Échec de la récupération du service worker:", error);
    }
  }

  /**
   * Login avec le SDK moderne (OneSignal.login)
   */
  private static async safeLogin(
    OneSignal: OneSignalInstance,
    userId: string,
  ): Promise<boolean> {
    try {
      if (typeof OneSignal.login === "function") {
        await OneSignal.login(userId);
        this.currentUserId = userId;
        console.log(`OneSignal user logged in : ${userId}`);
        return true;
      } else {
        console.error("OneSignal.login n'est pas disponible");
        return false;
      }
    } catch (error) {
      // Gérer spécifiquement l'erreur 409 (conflit d'identité)
      if (error && typeof error === 'object' &&
        (error.message?.includes('409') || error.status === 409)) {
        console.warn("⚠️ Conflit d'identité OneSignal (409) - utilisateur déjà associé");
        console.warn("Cela peut arriver si l'utilisateur est déjà connecté sur un autre appareil");

        // Marquer comme connecté malgré l'erreur 409
        this.currentUserId = userId;
        return true;
      }

      console.error("Impossible de login l'utilisateur :", error);
      return false;
    }
  }

  /**
   * Traite toutes les opérations en file d'attente
   */
  private static async processOperationQueue(): Promise<void> {
    const queue = [...this.operationQueue];
    this.operationQueue = [];

    for (const operation of queue) {
      try {
        await operation();
      } catch (error) {
        console.error(
          "Erreur lors de l'exécution d'une opération en attente:",
          error,
        );
      }
    }
  }

  /**
   * Associe un userId à l'instance OneSignal (SDK moderne)
   */
  public static async login(userId: string): Promise<void> {
    if (!userId) {
      console.warn("userId vide fourni à login()");
      return;
    }

    const executeLogin = async () => {
      if (this.currentUserId === userId) {
        console.log(`OneSignal user déjà associé : ${userId}`);
        return;
      }

      if (this.oneSignalInstance) {
        await this.safeLogin(this.oneSignalInstance, userId);
      } else {
        console.error("OneSignal instance non disponible pour login");
      }
    };

    if (!this.isInitialized) {
      console.log(
        "OneSignal pas encore initialisé, mise en file d'attente de login",
      );
      return new Promise<void>((resolve) => {
        this.operationQueue.push(async () => {
          await executeLogin();
          resolve();
        });
      });
    }

    await executeLogin();
  }

  /**
   * Dissocie l'utilisateur de OneSignal (SDK moderne)
   */
  public static async logout(): Promise<void> {
    const executeLogout = async () => {
      try {
        if (
          this.oneSignalInstance &&
          typeof this.oneSignalInstance.logout === "function"
        ) {
          await this.oneSignalInstance.logout();
          console.log("OneSignal user logged out");
        } else {
          console.warn("OneSignal.logout non disponible");
        }
      } catch (error) {
        console.error("Erreur lors du logout OneSignal :", error);
      }

      this.currentUserId = null;
      console.log("OneSignal user state effacé.");
    };

    if (!this.isInitialized) {
      console.log(
        "OneSignal pas encore initialisé, mise en file d'attente de logout",
      );
      return new Promise<void>((resolve) => {
        this.operationQueue.push(async () => {
          await executeLogout();
          resolve();
        });
      });
    }

    await executeLogout();
  }

  /**
   * Vérifie le statut d'abonnement aux notifications (SDK moderne)
   */
  public static async checkSubscription(): Promise<void> {
    const executeCheck = async () => {
      try {
        if (!this.oneSignalInstance) {
          console.error("OneSignal instance non disponible");
          this.dispatchSubscriptionEvent(false);
          return;
        }

        // SDK moderne : vérifier via Notifications.permission
        if (this.oneSignalInstance.Notifications) {
          const isEnabled = this.oneSignalInstance.Notifications.permission;
          console.log(
            `Statut des notifications: ${isEnabled ? "activées" : "désactivées"}`,
          );
          this.dispatchSubscriptionEvent(isEnabled);
        } else {
          console.warn("Impossible de vérifier le statut des notifications");
          this.dispatchSubscriptionEvent(false);
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'abonnement:", error);
        this.dispatchSubscriptionEvent(false);
      }
    };

    if (!this.isInitialized) {
      console.log(
        "OneSignal pas encore initialisé, mise en file d'attente de checkSubscription",
      );
      this.operationQueue.push(executeCheck);
      return;
    }

    await executeCheck();
  }

  /**
   * Envoie un événement personnalisé sur le statut d'abonnement
   */
  private static dispatchSubscriptionEvent(isSubscribed: boolean): void {
    const eventName = isSubscribed
      ? "userSubscribedToPush"
      : "userNotSubscribedToPush";
    document.body.dispatchEvent(
      new CustomEvent(eventName, { detail: { subscribed: isSubscribed } }),
    );
  }

  /**
   * Demande la permission pour les notifications push (SDK moderne)
   */
  public static async requestPermission(): Promise<boolean> {
    const executeRequest = async (): Promise<boolean> => {
      try {
        if (!this.oneSignalInstance) {
          console.error("OneSignal instance non disponible");
          return false;
        }

        // SDK moderne : utiliser Notifications.requestPermission
        if (this.oneSignalInstance.Notifications?.requestPermission) {
          const result =
            await this.oneSignalInstance.Notifications.requestPermission();
          console.log(`Permission demandée, résultat: ${result}`);
          // Vérifier l'état après la demande
          await this.checkSubscription();
          return result;
        } else {
          console.error(
            "Aucune méthode disponible pour demander la permission",
          );
          return false;
        }
      } catch (error) {
        console.error("Erreur lors de la demande de permission:", error);
        return false;
      }
    };

    if (!this.isInitialized) {
      console.log(
        "OneSignal pas encore initialisé, mise en file d'attente de requestPermission",
      );
      return new Promise<boolean>((resolve) => {
        this.operationQueue.push(async () => {
          const result = await executeRequest();
          resolve(result);
        });
      });
    }

    return executeRequest();
  }

  /**
   * Active les notifications push (demande permission + vérifie abonnement)
   */
  public static async enablePushNotifications(): Promise<boolean> {
    try {
      const granted = await this.requestPermission();
      if (granted) {
        await this.checkSubscription();
      }
      return granted;
    } catch (error) {
      console.error("Erreur lors de l'activation des notifications:", error);
      return false;
    }
  }

  /**
   * Debug: Obtient des informations détaillées sur l'abonnement OneSignal
   */
  public static async getSubscriptionDebugInfo(): Promise<any> {
    try {
      if (!this.isInitialized || !this.oneSignalInstance) {
        return {
          error: "OneSignal not initialized",
          isInitialized: this.isInitialized,
          hasInstance: !!this.oneSignalInstance,
        };
      }

      const debugInfo: any = {
        isInitialized: this.isInitialized,
        currentUserId: this.currentUserId,
        hasInstance: !!this.oneSignalInstance,
        browserPermission: "unknown",
        oneSignalPermission: "unknown",
        subscriptionId: this.subscriptionId || "unknown",
        isSubscribed: false,
      };

      // Vérifier les permissions du navigateur
      if ("Notification" in window) {
        debugInfo.browserPermission = Notification.permission;
      }

      // Vérifier les permissions OneSignal
      if (this.oneSignalInstance.Notifications) {
        debugInfo.oneSignalPermission =
          this.oneSignalInstance.Notifications.permission;
        debugInfo.isSubscribed = this.oneSignalInstance.Notifications.permission;
      }

      // Vérifier l'ID de souscription
      if (this.subscriptionId) {
        debugInfo.subscriptionId = this.subscriptionId;
        debugInfo.isSubscribed = true;
      }

      return debugInfo;
    } catch (error) {
      return {
        error: "Failed to get debug info",
        message: error.message,
      };
    }
  }

  /**
   * Test spécial localhost - Affiche une notification directe
   */
  public static async sendLocalhostTestNotification(): Promise<boolean> {
    try {
      if (!("serviceWorker" in navigator)) {
        console.error("Service Worker non supporté");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Test de notification directe pour localhost
      await registration.showNotification("Test OneSignal Localhost", {
        body: "Notification de test pour environnement de développement",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "onesignal-localhost-test",
        requireInteraction: true,
        data: {
          url: "/",
          source: "onesignal-test",
        }
      });

      console.log("✅ Notification localhost envoyée directement");
      return true;
    } catch (error) {
      console.error("❌ Erreur notification localhost:", error);
      return false;
    }
  }

  /**
   * Fallback notification pour localhost - utilise les notifications directes du navigateur
   */
  public static async sendLocalhostFallbackNotification(
    title: string,
    body: string,
    url?: string,
  ): Promise<boolean> {
    try {
      // Vérifier si on est sur localhost
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      if (!isLocalhost) {
        console.log("Not localhost, skipping fallback notification");
        return false;
      }

      if (!("serviceWorker" in navigator)) {
        console.error("Service Worker non supporté pour fallback");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Envoyer notification directe pour localhost
      await registration.showNotification(title, {
        body: body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `localhost-fallback-${Date.now()}`,
        requireInteraction: false,
        data: {
          url: url || "/",
          source: "localhost-fallback",
          timestamp: Date.now(),
        }
      });

      console.log("✅ Notification localhost fallback envoyée:", {
        title,
        body,
      });
      return true;
    } catch (error) {
      console.error("❌ Erreur notification localhost fallback:", error);
      return false;
    }
  }

  /**
   * Test manuel - Envoie une notification de test
   */
  public static async sendTestNotification(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.oneSignalInstance) {
        console.error("OneSignal not initialized for test notification");
        return false;
      }

      // Vérifier si l'utilisateur est abonné
      const debugInfo = await this.getSubscriptionDebugInfo();
      console.log("🧪 Debug info avant test:", debugInfo);

      if (!debugInfo.isSubscribed) {
        console.warn("User not subscribed to notifications");
        return false;
      }

      // Utiliser l'API OneSignal pour envoyer une notification de test
      if (this.oneSignalInstance.Notifications) {
        try {
          // Méthode alternative: utiliser l'API REST OneSignal
          const testData = {
            app_id: "aa956232-9277-40b3-b0f0-44c2b67f7a7b",
            contents: { en: "Ceci est une notification de test!" },
            headings: { en: "Test OneSignal" },
            include_external_user_ids: [this.currentUserId],
          };

          console.log("🚀 Envoi de notification de test:", testData);

          const response = await fetch(
            "https://onesignal.com/api/v1/notifications",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Basic YOUR_REST_API_KEY", // Note: devrait être configuré côté serveur
              },
              body: JSON.stringify(testData),
            },
          );

          if (response.ok) {
            const result = await response.json();
            console.log("✅ Notification de test envoyée:", result);
            return true;
          } else {
            console.error(
              "❌ Échec envoi notification de test:",
              await response.text(),
            );
            return false;
          }
        } catch (error) {
          console.error(
            "Erreur lors de l'envoi de la notification de test:",
            error,
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("Erreur dans sendTestNotification:", error);
      return false;
    }
  }

  /**
   * Force une vérification complète de l'état de OneSignal
   */
  public static async forcePermissionCheck(): Promise<void> {
    try {
      console.log("🔄 Vérification forcée des permissions...");

      // 1. Vérifier les permissions du navigateur
      if ("Notification" in window) {
        console.log("📱 Permission navigateur:", Notification.permission);

        if (Notification.permission === "default") {
          console.log("⚠️  Permission non demandée, demande en cours...");
          const permission = await Notification.requestPermission();
          console.log("✅ Nouvelle permission:", permission);
        }
      }

      // 2. Vérifier l'état OneSignal
      await this.checkSubscription();

      // 3. Afficher les informations de debug
      const debugInfo = await this.getSubscriptionDebugInfo();
      console.log("🔍 État complet OneSignal:", debugInfo);
    } catch (error) {
      console.error("Erreur lors de la vérification forcée:", error);
    }
  }

  /**
   * Diagnostic des service workers
   */
  public static async diagnoseServiceWorkers(): Promise<void> {
    console.group("🔧 Diagnostic Service Workers");

    if (!('serviceWorker' in navigator)) {
      console.error("❌ Service Workers non supportés");
      console.groupEnd();
      return;
    }

    try {
      // Lister tous les service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 ${registrations.length} service worker(s) trouvé(s):`);

      registrations.forEach((reg, index) => {
        console.log(`SW ${index + 1}:`, {
          scope: reg.scope,
          state: reg.active?.state,
          scriptURL: reg.active?.scriptURL,
          hasUpdateHandler: !!reg.onupdatefound
        });
      });

      // Vérifier le service worker actuel
      const currentReg = await navigator.serviceWorker.getRegistration();
      if (currentReg) {
        console.log("🎯 Service Worker actuel:", {
          scope: currentReg.scope,
          scriptURL: currentReg.active?.scriptURL,
          isOneSignal: currentReg.active?.scriptURL?.includes('OneSignal') || false,
          isWorkbox: currentReg.active?.scriptURL?.includes('workbox') || currentReg.active?.scriptURL?.includes('sw') || false
        });
      }

      // Suggestions
      if (registrations.length > 1) {
        console.warn("⚠️ Plusieurs service workers détectés - risque de conflit");
        console.warn("💡 Considérez utiliser un service worker unifié");
      }

    } catch (error) {
      console.error("❌ Erreur lors du diagnostic SW:", error);
    }

    console.groupEnd();
  }

  /**
   * Diagnostic complet de OneSignal
   */
  public static async runFullDiagnostic(): Promise<void> {
    console.group("🔍 Diagnostic OneSignal Complet");

    // 1. Environnement
    console.log("🌐 Environnement:", {
      url: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port
    });

    // 2. Support navigateur
    console.log("📱 Support navigateur:", {
      serviceWorker: "serviceWorker" in navigator,
      notifications: "Notification" in window,
      notificationPermission: "Notification" in window ? Notification.permission : "non supporté"
    });

    // 3. État OneSignal
    console.log("🔔 État OneSignal:", {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      currentUserId: this.currentUserId,
      hasInstance: !!this.oneSignalInstance,
      operationQueueLength: this.operationQueue.length
    });

    // 4. Vérification domaine
    const domainCheck = this.checkDomainCompatibility();
    console.log("🌐 Compatibilité domaine:", domainCheck);

    // 5. Diagnostic service workers
    await this.diagnoseServiceWorkers();

    console.groupEnd();
  }

  /**
   * Vérifie si le domaine actuel est probablement autorisé pour OneSignal
   */
  public static checkDomainCompatibility(): {
    isLikelyAllowed: boolean;
    currentDomain: string;
    suggestions: string[];
  } {
    const currentDomain = window.location.origin;
    const hostname = window.location.hostname;
    const suggestions: string[] = [];

    // Domaines probablement autorisés pour cette app OneSignal
    const isLikelyAllowed =
      hostname === 'sadtrans.netlify.app' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('.ngrok.io') ||
      hostname.includes('.ngrok-free.app') ||
      hostname.includes('.ngrok.app');

    if (!isLikelyAllowed) {
      suggestions.push("🌐 Utilisez https://sadtrans.netlify.app (domaine configuré)");
      suggestions.push("⚙️ Configurez OneSignal pour autoriser ce domaine");
      suggestions.push("🚀 Utilisez ngrok pour un tunnel HTTPS");
      suggestions.push("🔧 Créez une app OneSignal de développement");
    }

    return {
      isLikelyAllowed,
      currentDomain,
      suggestions
    };
  }

  /**
   * Retourne l'userId actuellement associé
   */
  public static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Retourne si OneSignal est initialisé
   */
  public static isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Obtient l'instance OneSignal (pour usage avancé)
   */
  public static getInstance(): OneSignalInstance | null {
    return this.oneSignalInstance;
  }
}

// Exposer OneSignalService globalement pour le debug
declare global {
  interface Window {
    OneSignalServiceDebug: typeof OneSignalService;
  }
}

// Ajouter le service au window pour accès global
if (typeof window !== "undefined") {
  window.OneSignalServiceDebug = OneSignalService;

  // Ajouter des raccourcis de diagnostic
  (window as any).osDebug = () => OneSignalService.runFullDiagnostic();
  (window as any).osSW = () => OneSignalService.diagnoseServiceWorkers();
  (window as any).osDomain = () => {
    const check = OneSignalService.checkDomainCompatibility();
    console.group("🌐 Vérification domaine OneSignal");
    console.log("Domaine actuel:", check.currentDomain);
    console.log("Probablement autorisé:", check.isLikelyAllowed);
    if (check.suggestions.length > 0) {
      console.log("Suggestions:", check.suggestions);
    }
    console.groupEnd();
  };

  // Commandes de récupération d'erreur
  (window as any).osRecover = async () => {
    console.log("🔄 Récupération manuelle OneSignal...");
    await OneSignalService.attemptServiceWorkerRecovery();
  };

  // Commandes de récupération d'erreur (utilisant des méthodes publiques)
  (window as any).osRecover = async () => {
    console.log("🔄 Récupération manuelle OneSignal...");
    try {
      // Réinitialiser et reconnecter
      const currentUser = OneSignalService.getCurrentUserId();
      if (currentUser) {
        await OneSignalService.init(currentUser);
      }
      await OneSignalService.checkSubscription();
      console.log("✅ Récupération terminée");
    } catch (error) {
      console.error("❌ Erreur lors de la récupération:", error);
    }
  };

  // Raccourci pour nettoyer les service workers
  (window as any).osCleanSW = async () => {
    console.log("🧹 Nettoyage des service workers...");
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log("✅ Service worker supprimé:", registration.scope);
      }
      console.log("🔄 Rechargez la page pour réinitialiser OneSignal");
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage:", error);
    }
  };
}
