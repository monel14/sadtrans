import { AuthService } from './auth.service';

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
            OneSignal.User.addAlias("user_id", user.id);
            console.log(`OneSignal user ID alias set to: ${user.id}`);
        });
    }
  }

  public static async logout() {
    window.OneSignalDeferred.push(function(OneSignal) {
        // Suppression de l'alias utilisateur lors de la déconnexion
        OneSignal.User.removeAlias("user_id");
        console.log("OneSignal user ID alias removed.");
    });
  }
}