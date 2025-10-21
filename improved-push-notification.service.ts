/**
 * Service de notifications push amélioré - Support multi-navigateurs
 */

import { supabase } from './supabase.service';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface BrowserInfo {
  userAgent: string;
  platform: string;
  browserName: string;
  browserVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  timestamp: string;
}

export class ImprovedPushNotificationService {
  private static instance: ImprovedPushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private userId: string | null = null;

  private vapidPublicKey = 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo';

  private constructor() { }

  public static getInstance(): ImprovedPushNotificationService {
    if (!ImprovedPushNotificationService.instance) {
      ImprovedPushNotificationService.instance = new ImprovedPushNotificationService();
    }
    return ImprovedPushNotificationService.instance;
  }

  /**
   * Initialise le service de notifications push
   */
  public async init(userId?: string): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications not supported');
      }

      this.registration = await navigator.serviceWorker.register('/custom-sw.js');
      await navigator.serviceWorker.ready;

      if (userId) {
        this.userId = userId;
        await this.subscribe();
      }

    } catch (error) {
      console.error('Erreur lors de l\'initialisation des notifications push:', error);
      throw error;
    }
  }

  /**
   * S'abonne aux notifications (support multi-navigateurs)
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

      // Vérifier s'il y a déjà un abonnement pour ce navigateur
      let subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Créer un nouvel abonnement
        const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource
        });
      }

      this.subscription = subscription;

      // Envoyer l'abonnement au serveur avec les infos du navigateur
      await this.sendSubscriptionToServer(subscription);

      console.log('Abonnement aux notifications push réussi pour ce navigateur');
      return subscription;

    } catch (error) {
      console.error('Erreur lors de l\'abonnement aux notifications:', error);
      throw error;
    }
  }

  /**
   * Se désabonne des notifications (seulement ce navigateur)
   */
  public async unsubscribe(): Promise<void> {
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe();
        await this.removeSubscriptionFromServer(this.subscription.endpoint);
        this.subscription = null;
        console.log('Désabonnement des notifications réussi pour ce navigateur');
      }
    } catch (error) {
      console.error('Erreur lors du désabonnement:', error);
      throw error;
    }
  }

  /**
   * Se désabonne de tous les navigateurs
   */
  public async unsubscribeAll(): Promise<void> {
    try {
      // Désabonner ce navigateur localement
      if (this.subscription) {
        await this.subscription.unsubscribe();
        this.subscription = null;
      }

      // Supprimer tous les abonnements du serveur
      await this.removeAllSubscriptionsFromServer();
      console.log('Désabonnement de tous les navigateurs réussi');
    } catch (error) {
      console.error('Erreur lors du désabonnement complet:', error);
      throw error;
    }
  }

  /**
   * Obtient tous les abonnements de l'utilisateur
   */
  public async getAllSubscriptions(): Promise<any[]> {
    try {
      if (!this.userId) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        method: 'GET',
        body: { userId: this.userId }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      return data?.subscriptions || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des abonnements:', error);
      return [];
    }
  }

  /**
   * Vérifie si ce navigateur est abonné
   */
  public async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;
    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Obtient des statistiques sur les abonnements
   */
  public async getSubscriptionStats(): Promise<{
    totalBrowsers: number;
    currentBrowser: boolean;
    browsers: Array<{
      browserName: string;
      platform: string;
      lastUsed: string;
      isCurrent: boolean;
    }>;
  }> {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const currentSubscription = await this.registration?.pushManager.getSubscription();
      const currentEndpoint = currentSubscription?.endpoint;

      const browsers = subscriptions.map(sub => ({
        browserName: sub.browser_info?.browserName || 'Navigateur inconnu',
        platform: sub.browser_info?.platform || 'Plateforme inconnue',
        lastUsed: sub.last_used || sub.created_at,
        isCurrent: sub.subscription.endpoint === currentEndpoint
      }));

      return {
        totalBrowsers: subscriptions.length,
        currentBrowser: browsers.some(b => b.isCurrent),
        browsers: browsers
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return {
        totalBrowsers: 0,
        currentBrowser: false,
        browsers: []
      };
    }
  }

  /**
   * Envoie l'abonnement au serveur avec les infos du navigateur
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

      const browserInfo = this.getBrowserInfo();

      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        body: {
          userId: this.userId,
          subscription: subscriptionData,
          browserInfo: browserInfo
        }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error('Échec de l\'enregistrement de l\'abonnement');
      }

      console.log('Abonnement push enregistré avec succès pour ce navigateur');

    } catch (error) {
      console.error('Erreur lors de l\'envoi au serveur:', error);
    }
  }

  /**
   * Supprime l'abonnement de ce navigateur du serveur
   */
  private async removeSubscriptionFromServer(endpoint: string): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        method: 'DELETE',
        body: {
          userId: this.userId,
          endpoint: endpoint,
          deleteAll: false
        }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      console.log('Abonnement push supprimé avec succès pour ce navigateur');

    } catch (error) {
      console.error('Erreur lors de la suppression du serveur:', error);
    }
  }

  /**
   * Supprime tous les abonnements de l'utilisateur du serveur
   */
  private async removeAllSubscriptionsFromServer(): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-push-subscription', {
        method: 'DELETE',
        body: {
          userId: this.userId,
          deleteAll: true
        }
      });

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      console.log('Tous les abonnements push supprimés avec succès');

    } catch (error) {
      console.error('Erreur lors de la suppression complète:', error);
    }
  }

  /**
   * Obtient les informations du navigateur actuel
   */
  private getBrowserInfo(): BrowserInfo {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Détection simple du navigateur
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    
    if (userAgent.includes('Chrome')) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
      const match = userAgent.match(/Firefox\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Safari')) {
      browserName = 'Safari';
      const match = userAgent.match(/Version\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Edge')) {
      browserName = 'Edge';
      const match = userAgent.match(/Edge\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    // Détection du type d'appareil
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/Mobi|Android/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    return {
      userAgent,
      platform,
      browserName,
      browserVersion,
      deviceType,
      timestamp: new Date().toISOString()
    };
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

  // Méthodes de compatibilité avec l'ancien service
  public async login(userId: string): Promise<void> {
    this.userId = userId;
    if (this.subscription) {
      await this.sendSubscriptionToServer(this.subscription);
    }
  }

  public async logout(): Promise<void> {
    this.userId = null;
    // Ne pas supprimer l'abonnement lors de la déconnexion
    // L'utilisateur peut vouloir continuer à recevoir des notifications
  }
}