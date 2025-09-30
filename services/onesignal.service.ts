import { AuthService } from './auth.service';

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
  private static operationQueue: (() => Promise<void>)[] = [];
  private static oneSignalInstance: any = null;

  private static async waitForOneSignalReady(timeout = 8000) {
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (typeof window.OneSignal?.setExternalUserId === "function") {
          clearInterval(interval);
          resolve();
        }
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        reject("Timeout: OneSignal pas prêt");
      }, timeout);
    });
  }

  private static async safeSetExternalUserId(OneSignal: any, userId: string): Promise<boolean> {
    try {
      await this.waitForOneSignalReady();
      await OneSignal.setExternalUserId(userId);
      this.currentUserId = userId;
      console.log(`OneSignal external user ID défini : ${userId}`);
      return true;
    } catch (error) {
      console.error("Impossible de setExternalUserId :", error);
      return false;
    }
  }

  public static async init(userId?: string) {
    if (this.isInitialized || this.isInitializing) {
      // Si un userId est fourni et qu'on est déjà initialisé, on le définit
      if (userId && this.isInitialized) {
        await this.login(userId);
      }
      return;
    }

    this.isInitializing = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    return new Promise<void>((resolve) => {
      this.pushToOneSignal(async (OneSignal) => {
        try {
          this.oneSignalInstance = OneSignal;
          
          await OneSignal.init({
            appId: ONE_SIGNAL_APP_ID,
            serviceWorkerPath: '/OneSignalSDKWorker.js',
            serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
            allowLocalhostAsSecureOrigin: true,
          });

          console.log("OneSignal initialisé avec succès");

          // Ajouter l'écouteur d'événements pour les clics sur les notifications
          OneSignal.Notifications.addEventListener('click', (event: any) => {
            console.log('Notification OneSignal cliquée:', event);
            if (event.url) window.open(event.url, '_blank');
          });

          // Si un userId est fourni, le mettre dans la file d'attente
          if (userId) {
            console.log("Ajout setExternalUserId dans la file d'attente");
            this.operationQueue.push(async () => {
              await this.safeSetExternalUserId(OneSignal, userId);
            });
          }

          this.isInitialized = true;
          this.isInitializing = false;

          // Exécuter les opérations en attente
          await this.processOperationQueue();

          this.checkSubscription();
          resolve();
        } catch (error) {
          console.error("Erreur lors de l'init OneSignal:", error);
          this.isInitializing = false;
          resolve();
        }
      });
    });
  }

  private static async processOperationQueue() {
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error("Erreur lors de l'exécution d'une opération en attente:", error);
        }
      }
    }
  }

  public static async login(userId: string) {
    if (!userId) return;

    const executeLogin = async () => {
      if (this.currentUserId === userId) {
        console.log(`OneSignal user déjà associé : ${userId}`);
        return;
      }
      await this.safeSetExternalUserId(this.oneSignalInstance, userId);
    };

    // Si OneSignal n'est pas encore initialisé, mettre l'opération en file d'attente
    if (!this.isInitialized) {
      console.log("OneSignal pas encore initialisé, mise en file d'attente de login");
      this.operationQueue.push(executeLogin);
    } else {
      await executeLogin();
    }
  }

  public static async logout() {
    const executeLogout = async () => {
      try {
        // Attendre que OneSignal soit prêt
        await this.waitForOneSignalReady();
        
        if (this.oneSignalInstance && typeof this.oneSignalInstance.removeExternalUserId === 'function') {
          await this.oneSignalInstance.removeExternalUserId();
          console.log("OneSignal external user ID removed");
        } else {
          console.warn("removeExternalUserId non disponible");
        }
      } catch (error) {
        console.error("Erreur lors de la suppression de l'ID utilisateur OneSignal :", error);
      }
      
      this.currentUserId = null;
      console.log("OneSignal user state cleared.");
    };

    // Si OneSignal n'est pas encore initialisé, mettre l'opération en file d'attente
    if (!this.isInitialized) {
      console.log("OneSignal pas encore initialisé, mise en file d'attente de logout");
      this.operationQueue.push(executeLogout);
    } else {
      await executeLogout();
    }
  }

  private static pushToOneSignal(callback: (OneSignal: any) => void) {
    window.OneSignalDeferred.push(callback);
  }

  public static checkSubscription() {
    const executeCheck = async () => {
      // Attendre que OneSignal soit prêt
      try {
        await this.waitForOneSignalReady();
      } catch (error) {
        console.error("Timeout lors de l'attente de OneSignal pour checkSubscription:", error);
        document.body.dispatchEvent(new CustomEvent('userNotSubscribedToPush'));
        return;
      }

      if (this.oneSignalInstance?.Notifications) {
        const permission = this.oneSignalInstance.Notifications.permission;
        if (permission === 'granted') {
          console.log('Utilisateur abonné aux notifications.');
          document.body.dispatchEvent(new CustomEvent('userSubscribedToPush'));
        } else {
          console.log('Utilisateur non abonné, permission :', permission);
          document.body.dispatchEvent(new CustomEvent('userNotSubscribedToPush'));
        }
      } else {
        console.error('API Notifications non disponible');
        document.body.dispatchEvent(new CustomEvent('userNotSubscribedToPush'));
      }
    };

    // Si OneSignal n'est pas encore initialisé, mettre l'opération en file d'attente
    if (!this.isInitialized) {
      console.log("OneSignal pas encore initialisé, mise en file d'attente de checkSubscription");
      this.operationQueue.push(executeCheck);
    } else {
      executeCheck();
    }
  }

  public static async requestPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      const executeRequest = async () => {
        // Attendre que OneSignal soit prêt
        try {
          await this.waitForOneSignalReady();
        } catch (error) {
          console.error("Timeout lors de l'attente de OneSignal pour requestPermission:", error);
          resolve(false);
          return;
        }

        if (this.oneSignalInstance?.Notifications?.requestPermission) {
          try {
            const permission = await this.oneSignalInstance.Notifications.requestPermission();
            resolve(permission === 'granted');
          } catch (error) {
            console.error('Erreur demande permission OneSignal :', error);
            resolve(false);
          }
        } else {
          console.error('requestPermission non disponible');
          resolve(false);
        }
      };

      // Si OneSignal n'est pas encore initialisé, mettre l'opération en file d'attente
      if (!this.isInitialized) {
        console.log("OneSignal pas encore initialisé, mise en file d'attente de requestPermission");
        this.operationQueue.push(executeRequest);
        resolve(false);
      } else {
        executeRequest();
      }
    });
  }

  public static async enablePushNotifications(): Promise<boolean> {
    const granted = await this.requestPermission();
    if (granted) this.checkSubscription();
    return granted;
  }
}