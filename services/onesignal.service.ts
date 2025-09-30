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

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                await OneSignal.init({
                    appId: ONE_SIGNAL_APP_ID,
                    serviceWorkerPath: '/OneSignalSDKWorker.js',
                    serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
                    allowLocalhostAsSecureOrigin: true,
                });
                
                // Ajouter l'écouteur d'événements pour les clics sur les notifications
                OneSignal.Notifications.addEventListener('click', function(event) {
                    console.log('Notification OneSignal cliquée:', event);
                    // Optionnel: naviguer vers une URL si fournie
                    if (event.url) {
                        window.open(event.url, '_blank');
                    }
                });
                
                // Attendre un peu pour que l'initialisation soit complète
                setTimeout(() => {
                    OneSignalService.checkSubscription();
                }, 1000);
            } catch (error) {
                console.error("Erreur lors de l'initialisation de OneSignal:", error);
            }
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
          // Vérifier si la méthode getAliases existe
          if (typeof OneSignal.User !== 'undefined' && typeof OneSignal.User.getAliases === 'function') {
            // Vérifier les alias existants (approche originale)
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
          } else {
            console.warn("OneSignal.User.getAliases is not available, using alternative approach");
            // Vérifier si l'alias existe déjà en utilisant une autre méthode si possible
          }

          // Ajouter le nouvel alias
          if (typeof OneSignal.User !== 'undefined' && typeof OneSignal.User.addAlias === 'function') {
            try {
              await OneSignal.User.addAlias("user_id", user.id);
              OneSignalService.currentUserId = user.id;
              console.log(`OneSignal user ID alias set to: ${user.id}`);
            } catch (aliasError) {
              if (aliasError.status === 409) {
                console.log(`OneSignal user ID alias already exists for: ${user.id} (ignoring 409 conflict)`);
                OneSignalService.currentUserId = user.id;
              } else {
                console.error("Error setting OneSignal user alias:", aliasError);
              }
            }
          } else {
            console.error("OneSignal.User.addAlias is not available");
          }
        } catch (error) {
          console.error("Error setting OneSignal user alias:", error);
        }
      });
    }
  }

    /**
     * Vérifie l'état de l'abonnement aux notifications push et envoie des événements en conséquence.
     */
    public static checkSubscription() {
        window.OneSignalDeferred.push(function(OneSignal) {
            // Utiliser une approche plus robuste pour vérifier l'abonnement
            OneSignal.Notifications.getPermissionStatus().then(function(status) {
                if (status === 'granted') {
                    console.log('Utilisateur abonné aux notifications push.');
                    document.body.dispatchEvent(new CustomEvent('userSubscribedToPush'));
                } else {
                    console.log('Utilisateur non abonné aux notifications push. Statut:', status);
                    document.body.dispatchEvent(new CustomEvent('userNotSubscribedToPush'));
                }
            }).catch(function(error) {
                console.error('Erreur lors de la vérification du statut de notification:', error);
                // En cas d'erreur, considérer comme non abonné
                document.body.dispatchEvent(new CustomEvent('userNotSubscribedToPush'));
            });
        });
    }

  /**
   * Demande la permission pour les notifications push OneSignal et s'abonne l'utilisateur.
   * @returns {Promise<boolean>} true si l'abonnement réussit, false sinon.
   */
  public static async subscribeToNotifications(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window.OneSignal !== 'undefined') {
        window.OneSignalDeferred.push(function(OneSignal) {
          // Vérifier l'état actuel de la permission
          if (typeof OneSignal.Notifications !== 'undefined') {
            OneSignal.Notifications.getPermissionStatus().then(function(status) {
              if (status === 'granted') {
                console.log('Permission OneSignal déjà accordée');
                resolve(true);
              } else if (status === 'denied') {
                console.log('Permission OneSignal refusée par l\'utilisateur');
                resolve(false);
              } else {
                console.log('Permission OneSignal non demandée (default)');
                resolve(false);
              }
            }).catch(function(error) {
              console.error('Erreur lors de la vérification de la permission OneSignal:', error);
              resolve(false);
            });
          } else {
            console.error('API OneSignal.Notifications non disponible');
            resolve(false);
          }
        });
      } else {
        console.error('OneSignal non chargé');
        resolve(false);
      }
    });
  }

  /**
   * Demande explicitement la permission pour les notifications push OneSignal.
   * Cette méthode doit être appelée uniquement après une action utilisateur.
   * @returns {Promise<boolean>} true si la permission est accordée, false sinon.
   */
  public static async requestPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window.OneSignal !== 'undefined') {
        window.OneSignalDeferred.push(function(OneSignal) {
          // Utiliser l'API de la version 16 du SDK OneSignal
          if (typeof OneSignal.Notifications !== 'undefined' && typeof OneSignal.Notifications.requestPermission === 'function') {
            OneSignal.Notifications.requestPermission().then(function(permission) {
              if (permission === 'granted') {
                console.log('Permission OneSignal accordée');
                // OneSignal gère automatiquement l'abonnement une fois la permission accordée
                // Mettre à jour l'état de l'abonnement
                OneSignalService.checkSubscription();
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
          } else {
            console.error('API OneSignal.Notifications.requestPermission non disponible');
            resolve(false);
          }
        });
      } else {
        console.error('OneSignal non chargé');
        resolve(false);
      }
    });
  }

  /**
   * Vérifie si les notifications push sont activées et les active si nécessaire.
   * @returns {Promise<boolean>} true si les notifications sont activées, false sinon.
   */
  public static async enablePushNotifications(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window.OneSignal !== 'undefined') {
        window.OneSignalDeferred.push(function(OneSignal) {
          // Vérifier si les notifications push sont déjà activées
          if (typeof OneSignal.Notifications !== 'undefined') {
            OneSignal.Notifications.getPermissionStatus().then(function(status) {
              if (status === 'granted') {
                console.log('Les notifications push sont déjà activées');
                OneSignalService.checkSubscription();
                resolve(true);
              } else if (status === 'denied') {
                console.log('Les notifications push ont été refusées précédemment');
                // Afficher un message à l'utilisateur pour qu'il active les notifications dans les paramètres du navigateur
                document.body.dispatchEvent(new CustomEvent('showToast', {
                  detail: {
                    message: 'Les notifications push sont bloquées. Veuillez les activer dans les paramètres de votre navigateur.',
                    type: 'warning'
                  }
                }));
                resolve(false);
              } else {
                // Demander l'activation des notifications push
                OneSignal.Notifications.requestPermission().then(function(permission) {
                  if (permission === 'granted') {
                    console.log('Notifications push activées avec succès');
                    OneSignalService.checkSubscription();
                    resolve(true);
                  } else {
                    console.log('L\'utilisateur a refusé les notifications push');
                    resolve(false);
                  }
                }).catch(function(error) {
                  console.error('Erreur lors de l\'activation des notifications push:', error);
                  resolve(false);
                });
              }
            }).catch(function(error) {
              console.error('Erreur lors de la vérification du statut de notification:', error);
              resolve(false);
            });
          } else {
            console.error('API OneSignal.Notifications non disponible');
            resolve(false);
          }
        });
      } else {
        console.error('OneSignal non chargé');
        resolve(false);
      }
    });
  }

  public static async getSubscription(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window.OneSignal !== 'undefined') {
            window.OneSignalDeferred.push(function(OneSignal) {
                OneSignal.Notifications.getPermissionStatus().then(function(status) {
                    resolve(status === 'granted');
                }).catch(function(error) {
                    console.error('Erreur lors de la vérification du statut de notification:', error);
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