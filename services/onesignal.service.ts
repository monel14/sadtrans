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
  private static currentUserId: string | null = null;

  public static async init() {
    if (this.isInitialized) {
      return;
    }

    // Utiliser OneSignalDeferred pour l'initialisation différée
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    // Configuration de OneSignal avec des paramètres plus robustes
    window.OneSignalDeferred.push(function(OneSignal) {
      OneSignal.init({
        appId: ONE_SIGNAL_APP_ID,
        // Spécifier uniquement les Service Workers requis par OneSignal
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
        allowLocalhostAsSecureOrigin: true, // Autoriser localhost pour le développement
      });
    });
    
    this.isInitialized = true;
    console.log("OneSignal Service Initialized.");
  }

  public static async login() {
    const authService = AuthService.getInstance();
    const user = await authService.getCurrentUser();
    if (user && user.id) {
      // Vérifier si l'utilisateur est déjà associé pour éviter les conflits
      if (this.currentUserId === user.id) {
        console.log(`OneSignal user already associated with: ${user.id}`);
        return;
      }

      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          // Vérifier les alias existants
          const existingAliases = await OneSignal.User.getAliases();
          
          // Si l'alias est déjà correct, ne rien faire
          if (existingAliases?.user_id === user.id) {
            console.log(`OneSignal user ID alias already set to: ${user.id}`);
            OneSignalService.currentUserId = user.id;
            return;
          }
          
          // Si un autre alias existe, le supprimer (gestion côté client uniquement)
          if (existingAliases?.user_id && existingAliases.user_id !== user.id) {
            console.log(`Removing existing alias for ${existingAliases.user_id}`);
            // Note: La suppression côté client peut échouer avec 403, on continue quand même
            try {
              await OneSignal.User.removeAlias("user_id");
            } catch (removeError) {
              console.warn("Could not remove existing alias (may not have permission):", removeError);
            }
          }

          // Ajouter le nouvel alias
          await OneSignal.User.addAlias("user_id", user.id);
          OneSignalService.currentUserId = user.id;
          console.log(`OneSignal user ID alias set to: ${user.id}`);
        } catch (error) {
          console.error("Error setting OneSignal user alias:", error);
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
            } else if (permission === 'denied') {
              console.log('Permission OneSignal refusée par l\'utilisateur');
              resolve(false);
            } else {
              console.log('Permission OneSignal non accordée (default)');
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
    // Ne pas tenter de supprimer l'alias côté client (permission refusée)
    // On se contente de nettoyer l'état local
    this.currentUserId = null;
    console.log("OneSignal user state cleared (alias not removed due to permissions).");
  }
}