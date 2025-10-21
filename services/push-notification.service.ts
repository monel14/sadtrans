/**
 * Service de notifications push natives
 * Remplace OneSignal par une implémentation directe
 */

import { supabase } from './supabase.service';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private userId: string | null = null;

  // Configuration VAPID - clé publique unifiée (corrigée)
  private vapidPublicKey = 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo';

  private constructor() { }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialise le service de notifications push
   */
  public async init(userId?: string): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers non supportés');
      }

      if (!('PushManager' in window)) {
        throw new Error('Push API non supportée');
      }

      // Détecter l'environnement
      const isLocalDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isHTTPS = window.location.protocol === 'https:';

      console.log('🌍 Environnement détecté:', {
        localhost: isLocalDev,
        https: isHTTPS,
        url: window.location.href
      });

      // Enregistrer le service worker
      this.registration = await navigator.serviceWorker.register('/custom-sw.js');
      console.log('Service Worker enregistré:', this.registration);

      // Attendre que le service worker soit prêt
      await navigator.serviceWorker.ready;

      if (userId) {
        this.userId = userId;

        // En développement local, avertir l'utilisateur des limitations
        if (isLocalDev && isHTTPS) {
          console.warn('⚠️ Développement local HTTPS: Les notifications push peuvent échouer avec des certificats auto-signés');
          console.log('💡 Solutions: Utiliser mkcert, ngrok, ou tester sur un serveur de staging');
        }

        await this.subscribe();
      }

    } catch (error) {
      console.error('Erreur lors de l\'initialisation des notifications push:', error);
      throw error;
    }
  }

  /**
   * Demande la permission et s'abonne aux notifications
   */
  public async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker non enregistré');
      }

      // Demander la permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permission de notification refusée');
        return null;
      }

      // Vérifier s'il y a déjà un abonnement
      let subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Diagnostic avant tentative d'abonnement
        console.log('🔍 Diagnostic avant abonnement:');
        console.log('   - Protocole:', window.location.protocol);
        console.log('   - Host:', window.location.host);
        console.log('   - En ligne:', navigator.onLine);
        console.log('   - User Agent:', navigator.userAgent.substring(0, 50) + '...');

        // Créer un nouvel abonnement avec gestion d'erreur améliorée
        const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

        try {
          subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource
          });
        } catch (subscribeError: any) {
          console.error('❌ Erreur détaillée d\'abonnement:', {
            name: subscribeError.name,
            message: subscribeError.message,
            code: subscribeError.code
          });

          // Gestion spécifique des erreurs courantes
          if (subscribeError.name === 'AbortError') {
            // Tentative de solution pour AbortError
            console.log('🔧 Tentative de solution pour AbortError...');

            // Attendre un peu et réessayer
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
              subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource
              });
              console.log('✅ Abonnement réussi après retry');
            } catch (retryError) {
              console.error('❌ Échec après retry:', retryError);
              throw retryError;
            }
          } else {
            throw subscribeError;
          }
        }
      }

      this.subscription = subscription;

      // Envoyer l'abonnement au serveur
      await this.sendSubscriptionToServer(subscription);

      console.log('✅ Abonnement aux notifications push réussi');
      return subscription;

    } catch (error) {
      console.error('Erreur lors de l\'abonnement aux notifications:', error);
      throw error;
    }
  }

  /**
   * Se désabonne des notifications
   */
  public async unsubscribe(): Promise<void> {
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe();
        await this.removeSubscriptionFromServer();
        this.subscription = null;
        console.log('Désabonnement des notifications réussi');
      }
    } catch (error) {
      console.error('Erreur lors du désabonnement:', error);
      throw error;
    }
  }

  /**
   * Vérifie si l'utilisateur est abonné
   */
  public async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;

    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Obtient l'abonnement actuel
   */
  public async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;
    return await this.registration.pushManager.getSubscription();
  }

  /**
   * Envoie une notification locale (pour test)
   */
  public async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker non enregistré');
    }

    const notificationOptions: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: payload.data,
      requireInteraction: true,
      tag: 'sadtrans-notification'
    };

    // Add actions if supported and provided
    if (payload.actions && 'actions' in Notification.prototype) {
      (notificationOptions as any).actions = payload.actions;
    }

    await this.registration.showNotification(payload.title, notificationOptions);
  }

  /**
   * Associe un utilisateur à l'abonnement
   */
  public async login(userId: string): Promise<void> {
    this.userId = userId;
    if (this.subscription) {
      await this.sendSubscriptionToServer(this.subscription);
    }
  }

  /**
   * Dissocie l'utilisateur
   */
  public async logout(): Promise<void> {
    this.userId = null;
    if (this.subscription) {
      await this.removeSubscriptionFromServer();
    }
  }

  /**
   * Envoie l'abonnement au serveur via Supabase Edge Function
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      // Utiliser Supabase pour envoyer l'abonnement

      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        body: {
          userId: this.userId,
          subscription: subscriptionData
        }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error('Échec de l\'enregistrement de l\'abonnement');
      }

      console.log('Abonnement push enregistré avec succès');

    } catch (error) {
      console.error('Erreur lors de l\'envoi au serveur:', error);
      // Ne pas faire échouer l'abonnement si le serveur n'est pas disponible
    }
  }

  /**
   * Supprime l'abonnement du serveur via Supabase Edge Function
   */
  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      if (!this.subscription) return;

      // Utiliser Supabase Edge Function pour supprimer l'abonnement
      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        method: 'DELETE',
        body: {
          userId: this.userId,
          endpoint: this.subscription.endpoint
        }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error('Échec de la suppression de l\'abonnement');
      }

      console.log('Abonnement push supprimé avec succès');

    } catch (error) {
      console.error('Erreur lors de la suppression du serveur:', error);
    }
  }

  /**
   * Convertit une clé VAPID base64 en Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convertit un ArrayBuffer en base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }


}