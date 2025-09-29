import { AuthService } from './auth.service';

// Type declaration for OneSignal global object
declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

const ONE_SIGNAL_APP_ID = "aa956232-9277-40b3-b0f0-44c2b67f7a7b";

export class OneSignalService {
  private static isInitialized = false;

  public static async init() {
    if (this.isInitialized) {
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      OneSignal.init({
        appId: ONE_SIGNAL_APP_ID,
      });
    });
    this.isInitialized = true;
    console.log("OneSignal Service Initialized.");
  }

  public static async login() {
    const authService = AuthService.getInstance();
    const user = await authService.getCurrentUser();
    if (user && user.id) {
        window.OneSignalDeferred.push(function(OneSignal) {
            // Utilisation d'un alias personnalisé au lieu de l'alias réservé "external_id"
            try {
                OneSignal.User.addAlias("user_id", user.id);
                console.log(`OneSignal user ID alias set to: ${user.id}`);
            } catch (error) {
                console.error("Erreur lors de la définition de l'alias OneSignal:", error);
                // En cas d'erreur, on tente de supprimer l'alias existant puis de le recréer
                try {
                    OneSignal.User.removeAlias("user_id");
                    OneSignal.User.addAlias("user_id", user.id);
                    console.log(`OneSignal user ID alias recreated for: ${user.id}`);
                } catch (retryError) {
                    console.error("Erreur lors de la tentative de recréation de l'alias:", retryError);
                }
            }
        });
    }
  }

  /**
   * Demande la permission pour les notifications push OneSignal et s'abonne l'utilisateur.
   * @returns {Promise<boolean>} true si l'abonnement réussit, false sinon.
   */
  public static async subscribeToNotifications(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window.OneSignal !== 'undefined') {
        window.OneSignalDeferred.push(function(OneSignal) {
          OneSignal.Notifications.requestPermission().then(function(permission) {
            if (permission === 'granted') {
              console.log('Permission OneSignal accordée');
              // OneSignal gère automatiquement l'abonnement une fois la permission accordée
              OneSignal.Notifications.addEventListener('click', function(event) {
                console.log('Notification OneSignal cliquée:', event);
                // Optionnel: naviguer vers une URL si fournie
                if (event.url) {
                  window.open(event.url);
                }
              });
              resolve(true);
            } else {
              console.log('Permission OneSignal refusée');
              resolve(false);
            }
          }).catch(function(error) {
            console.error('Erreur lors de la demande de permission OneSignal:', error);
            resolve(false);
          });
        });
      } else {
        console.error('OneSignal non chargé');
        resolve(false);
      }
    });
  }

  public static async logout() {
    window.OneSignalDeferred.push(function(OneSignal) {
        try {
            // Suppression de l'alias utilisateur lors de la déconnexion
            OneSignal.User.removeAlias("user_id");
            console.log("OneSignal user ID alias removed.");
        } catch (error) {
            console.error("Erreur lors de la suppression de l'alias OneSignal:", error);
        }
    });
  }
}