// Types pour OneSignal (SDK moderne)
interface OneSignalConfig {
  appId: string;
  serviceWorkerPath?: string;
  serviceWorkerUpdaterPath?: string;
  allowLocalhostAsSecureOrigin?: boolean;
}

interface OneSignalNotification {
  notificationId: string;
  url?: string;
}

interface OneSignalInstance {
  init: (config: OneSignalConfig) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User?: {
    PushSubscription?: {
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener: (event: string, callback: (change: any) => void) => void;
    };
  };
  Notifications?: {
    requestPermission: () => Promise<boolean>;
    permission: boolean;
    addEventListener: (event: string, callback: (event: any) => void) => void;
  };
  isPushNotificationsEnabled?: () => Promise<boolean>;
}

// Ne pas redéclarer Window.OneSignalDeferred ici si déjà déclaré dans vite-env.d.ts

const ONE_SIGNAL_APP_ID = "aa956232-9277-40b3-b0f0-44c2b67f7a7b";

export class OneSignalService {
  private static isInitialized = false;
  private static isInitializing = false;
  private static currentUserId: string | null = null;
  private static operationQueue: (() => Promise<void>)[] = [];
  private static oneSignalInstance: OneSignalInstance | null = null;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialise OneSignal et associe optionnellement un userId
   */
  public static async init(userId?: string): Promise<void> {
    // Si déjà initialisé, on login si userId fourni
    if (this.isInitialized) {
      if (userId) {
        await this.login(userId);
      }
      return;
    }

    // Si initialisation en cours, attendre la fin
    if (this.isInitializing && this.initPromise) {
      await this.initPromise;
      if (userId && this.isInitialized) {
        await this.login(userId);
      }
      return;
    }

    this.isInitializing = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    this.initPromise = new Promise<void>((resolve, reject) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          this.oneSignalInstance = OneSignal;

          await OneSignal.init({
            appId: ONE_SIGNAL_APP_ID,
            serviceWorkerPath: '/OneSignalSDKWorker.js',
            serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
            allowLocalhostAsSecureOrigin: true,
          });

          console.log("OneSignal initialisé avec succès");

          // Attacher les événements (SDK moderne)
          this.attachEventListeners(OneSignal);

          // Définir l'userId si fourni
          if (userId) {
            await this.safeLogin(OneSignal, userId);
          }

          this.isInitialized = true;
          this.isInitializing = false;

          // Traiter la file d'attente
          await this.processOperationQueue();
          
          // Vérifier l'abonnement
          await this.checkSubscription();

          resolve();
        } catch (error) {
          console.error("Erreur lors de l'init OneSignal:", error);
          this.isInitializing = false;
          this.initPromise = null;
          reject(error);
        }
      });
    });

    return this.initPromise;
  }

  /**
   * Attache les écouteurs d'événements OneSignal (SDK moderne)
   */
  private static attachEventListeners(OneSignal: OneSignalInstance): void {
    try {
      // SDK moderne : utiliser Notifications.addEventListener
      if (OneSignal.Notifications?.addEventListener) {
        OneSignal.Notifications.addEventListener('click', (event: any) => {
          console.log('Notification OneSignal cliquée:', event);
          if (event?.notification?.url) {
            window.open(event.notification.url, '_blank');
          }
        });
        console.log('Écouteur de clic OneSignal attaché');
      } else {
        console.warn('OneSignal.Notifications.addEventListener non disponible');
      }
    } catch (error) {
      console.error("Erreur lors de l'attachement des événements:", error);
    }
  }

  /**
   * Login avec le SDK moderne (OneSignal.login)
   */
  private static async safeLogin(
    OneSignal: OneSignalInstance,
    userId: string
  ): Promise<boolean> {
    try {
      if (typeof OneSignal.login === 'function') {
        await OneSignal.login(userId);
        this.currentUserId = userId;
        console.log(`OneSignal user logged in : ${userId}`);
        return true;
      } else {
        console.error("OneSignal.login n'est pas disponible");
        return false;
      }
    } catch (error) {
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
        console.error("Erreur lors de l'exécution d'une opération en attente:", error);
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
      console.log("OneSignal pas encore initialisé, mise en file d'attente de login");
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
        if (this.oneSignalInstance && typeof this.oneSignalInstance.logout === 'function') {
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
      console.log("OneSignal pas encore initialisé, mise en file d'attente de logout");
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
          console.error('OneSignal instance non disponible');
          this.dispatchSubscriptionEvent(false);
          return;
        }

        // SDK moderne : vérifier via Notifications.permission
        if (this.oneSignalInstance.Notifications) {
          const isEnabled = this.oneSignalInstance.Notifications.permission;
          console.log(`Statut des notifications: ${isEnabled ? 'activées' : 'désactivées'}`);
          this.dispatchSubscriptionEvent(isEnabled);
        } 
        // Fallback pour anciennes versions
        else if (typeof this.oneSignalInstance.isPushNotificationsEnabled === 'function') {
          const isEnabled = await this.oneSignalInstance.isPushNotificationsEnabled();
          console.log(`Statut des notifications: ${isEnabled ? 'activées' : 'désactivées'}`);
          this.dispatchSubscriptionEvent(isEnabled);
        } 
        else {
          console.warn('Impossible de vérifier le statut des notifications');
          this.dispatchSubscriptionEvent(false);
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'abonnement:", error);
        this.dispatchSubscriptionEvent(false);
      }
    };

    if (!this.isInitialized) {
      console.log("OneSignal pas encore initialisé, mise en file d'attente de checkSubscription");
      this.operationQueue.push(executeCheck);
      return;
    }

    await executeCheck();
  }

  /**
   * Envoie un événement personnalisé sur le statut d'abonnement
   */
  private static dispatchSubscriptionEvent(isSubscribed: boolean): void {
    const eventName = isSubscribed ? 'userSubscribedToPush' : 'userNotSubscribedToPush';
    document.body.dispatchEvent(new CustomEvent(eventName));
  }

  /**
   * Demande la permission pour les notifications push (SDK moderne)
   */
  public static async requestPermission(): Promise<boolean> {
    const executeRequest = async (): Promise<boolean> => {
      try {
        if (!this.oneSignalInstance) {
          console.error('OneSignal instance non disponible');
          return false;
        }

        // SDK moderne : utiliser Notifications.requestPermission
        if (this.oneSignalInstance.Notifications?.requestPermission) {
          const result = await this.oneSignalInstance.Notifications.requestPermission();
          console.log(`Permission demandée, résultat: ${result}`);
          return result;
        } 
        // Fallback : utiliser User.PushSubscription.optIn
        else if (this.oneSignalInstance.User?.PushSubscription?.optIn) {
          await this.oneSignalInstance.User.PushSubscription.optIn();
          console.log('Push notifications opt-in réussi');
          return true;
        } 
        else {
          console.error('Aucune méthode disponible pour demander la permission');
          return false;
        }
      } catch (error) {
        console.error('Erreur lors de la demande de permission:', error);
        return false;
      }
    };

    if (!this.isInitialized) {
      console.log("OneSignal pas encore initialisé, mise en file d'attente de requestPermission");
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
      console.error('Erreur lors de l\'activation des notifications:', error);
      return false;
    }
  }

  /**
   * Désactive les notifications push (SDK moderne)
   */
  public static async disablePushNotifications(): Promise<boolean> {
    try {
      if (!this.oneSignalInstance?.User?.PushSubscription?.optOut) {
        console.error('optOut non disponible');
        return false;
      }

      await this.oneSignalInstance.User.PushSubscription.optOut();
      console.log('Push notifications opt-out réussi');
      await this.checkSubscription();
      return true;
    } catch (error) {
      console.error('Erreur lors de la désactivation des notifications:', error);
      return false;
    }
  }

  /**
   * Retourne l'userId actuellement associé
   */
  public static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Vérifie si OneSignal est initialisé
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