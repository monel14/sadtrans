// Import du client Supabase
import { supabase } from './supabase.service';
// Import du service d'authentification
import { AuthService } from './auth.service';

// Clé publique VAPID à récupérer depuis les variables d'environnement
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convertit une chaîne base64 URL-safe en Uint8Array.
 * @param {string} base64String La chaîne à convertir.
 * @returns {Uint8Array} Le tableau d'octets.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Demande la permission pour les notifications et abonne l'utilisateur.
 */
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Les notifications push ne sont pas supportées par ce navigateur.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('L\'utilisateur est déjà abonné.');
      // Idéalement, envoyez l'abonnement au serveur pour le maintenir à jour.
      return subscription;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('La clé publique VAPID n\'est pas définie. Veuillez l\'ajouter dans vos variables d\'environnement (VITE_VAPID_PUBLIC_KEY).');
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    console.log('Nouvel abonnement créé :', subscription);

    // Sauvegarder l'abonnement dans la base de données Supabase
    const authService = AuthService.getInstance();
    const user = await authService.getCurrentUser();
    if (user) {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          subscription: subscription
        });
      
      if (error) {
        console.error('Erreur lors de la sauvegarde de l\'abonnement :', error);
      } else {
        console.log('Abonnement sauvegardé avec succès dans Supabase.');
      }
    } else {
      console.warn('Aucun utilisateur connecté, abonnement non sauvegardé.');
    }

    return subscription;
  } catch (error) {
    console.error('Échec de l\'abonnement de l\'utilisateur : ', error);
  }
}
