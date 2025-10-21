/**
 * Service serveur pour l'envoi de notifications push
 * Utilise la Web Push API standard
 */

import { PushSubscriptionData } from './push-notification.service';

export interface ServerNotificationPayload {
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
  url?: string; // URL à ouvrir lors du clic
}

export interface StoredSubscription {
  userId: string;
  subscription: PushSubscriptionData;
  createdAt: Date;
  lastUsed: Date;
}

export class PushServerService {
  private static instance: PushServerService;
  private subscriptions = new Map<string, StoredSubscription[]>(); // userId -> subscriptions[]

  // Clés VAPID - À configurer avec vos propres clés
  private readonly vapidKeys = {
    publicKey: 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo',
    privateKey: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgMeXtcNO_3acuun_vVQLC9tk0HGNV3aXB1iZ1R1crY_ehRANCAAROap01Vh-UF3O9LGVKjzpHilEXeokpst96kPpaZm0TcBgAk51CLm02fAhD7hgI4CCjYdBaqt5RNScaic0daUFq'
  };

  private constructor() {}

  public static getInstance(): PushServerService {
    if (!PushServerService.instance) {
      PushServerService.instance = new PushServerService();
    }
    return PushServerService.instance;
  }

  /**
   * Ajoute un abonnement pour un utilisateur
   */
  public addSubscription(userId: string, subscription: PushSubscriptionData): void {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, []);
    }

    const userSubscriptions = this.subscriptions.get(userId)!;
    
    // Vérifier si l'abonnement existe déjà
    const existingIndex = userSubscriptions.findIndex(
      sub => sub.subscription.endpoint === subscription.endpoint
    );

    const storedSubscription: StoredSubscription = {
      userId,
      subscription,
      createdAt: new Date(),
      lastUsed: new Date()
    };

    if (existingIndex >= 0) {
      // Mettre à jour l'abonnement existant
      userSubscriptions[existingIndex] = storedSubscription;
    } else {
      // Ajouter un nouvel abonnement
      userSubscriptions.push(storedSubscription);
    }

    console.log(`Abonnement ajouté pour l'utilisateur ${userId}`);
  }

  /**
   * Supprime un abonnement
   */
  public removeSubscription(userId: string, endpoint: string): void {
    const userSubscriptions = this.subscriptions.get(userId);
    if (!userSubscriptions) return;

    const filteredSubscriptions = userSubscriptions.filter(
      sub => sub.subscription.endpoint !== endpoint
    );

    if (filteredSubscriptions.length === 0) {
      this.subscriptions.delete(userId);
    } else {
      this.subscriptions.set(userId, filteredSubscriptions);
    }

    console.log(`Abonnement supprimé pour l'utilisateur ${userId}`);
  }

  /**
   * Obtient tous les abonnements d'un utilisateur
   */
  public getUserSubscriptions(userId: string): StoredSubscription[] {
    return this.subscriptions.get(userId) || [];
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  public async sendNotificationToUser(
    userId: string, 
    payload: ServerNotificationPayload
  ): Promise<{ success: number; failed: number }> {
    const userSubscriptions = this.getUserSubscriptions(userId);
    
    if (userSubscriptions.length === 0) {
      console.warn(`Aucun abonnement trouvé pour l'utilisateur ${userId}`);
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const storedSub of userSubscriptions) {
      try {
        await this.sendPushNotification(storedSub.subscription, payload);
        success++;
        
        // Mettre à jour la date de dernière utilisation
        storedSub.lastUsed = new Date();
        
      } catch (error) {
        console.error(`Erreur envoi notification à ${userId}:`, error);
        failed++;
        
        // Si l'abonnement est invalide, le supprimer
        if (this.isSubscriptionError(error)) {
          this.removeSubscription(userId, storedSub.subscription.endpoint);
        }
      }
    }

    console.log(`Notifications envoyées à ${userId}: ${success} succès, ${failed} échecs`);
    return { success, failed };
  }

  /**
   * Envoie une notification à plusieurs utilisateurs
   */
  public async sendNotificationToUsers(
    userIds: string[], 
    payload: ServerNotificationPayload
  ): Promise<{ [userId: string]: { success: number; failed: number } }> {
    const results: { [userId: string]: { success: number; failed: number } } = {};

    for (const userId of userIds) {
      results[userId] = await this.sendNotificationToUser(userId, payload);
    }

    return results;
  }

  /**
   * Envoie une notification à tous les utilisateurs abonnés
   */
  public async broadcastNotification(
    payload: ServerNotificationPayload
  ): Promise<{ totalSuccess: number; totalFailed: number; userResults: { [userId: string]: { success: number; failed: number } } }> {
    const userIds = Array.from(this.subscriptions.keys());
    const userResults = await this.sendNotificationToUsers(userIds, payload);
    
    const totalSuccess = Object.values(userResults).reduce((sum, result) => sum + result.success, 0);
    const totalFailed = Object.values(userResults).reduce((sum, result) => sum + result.failed, 0);

    return { totalSuccess, totalFailed, userResults };
  }

  /**
   * Envoie une notification push à un abonnement spécifique
   */
  private async sendPushNotification(
    subscription: PushSubscriptionData, 
    payload: ServerNotificationPayload
  ): Promise<void> {
    // Dans un environnement Node.js, vous utiliseriez la bibliothèque 'web-push'
    // Ici, nous simulons l'envoi pour l'environnement navigateur
    
    const notificationPayload = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: {
        ...payload.data,
        url: payload.url
      },
      actions: payload.actions
    };

    // Simulation de l'envoi - À remplacer par l'implémentation réelle
    console.log('Envoi notification push:', {
      endpoint: subscription.endpoint,
      payload: notificationPayload
    });

    // Dans un vrai serveur Node.js, vous feriez quelque chose comme :
    /*
    const webpush = require('web-push');
    
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      JSON.stringify(notificationPayload)
    );
    */
  }

  /**
   * Vérifie si l'erreur indique un abonnement invalide
   */
  private isSubscriptionError(error: any): boolean {
    // Codes d'erreur indiquant un abonnement invalide
    const invalidCodes = [410, 413, 400];
    return error.statusCode && invalidCodes.includes(error.statusCode);
  }

  /**
   * Nettoie les anciens abonnements (à exécuter périodiquement)
   */
  public cleanupOldSubscriptions(maxAgeInDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

    for (const [userId, subscriptions] of this.subscriptions.entries()) {
      const validSubscriptions = subscriptions.filter(
        sub => sub.lastUsed > cutoffDate
      );

      if (validSubscriptions.length === 0) {
        this.subscriptions.delete(userId);
      } else if (validSubscriptions.length !== subscriptions.length) {
        this.subscriptions.set(userId, validSubscriptions);
      }
    }

    console.log('Nettoyage des anciens abonnements terminé');
  }

  /**
   * Obtient les statistiques des abonnements
   */
  public getStats(): {
    totalUsers: number;
    totalSubscriptions: number;
    averageSubscriptionsPerUser: number;
  } {
    const totalUsers = this.subscriptions.size;
    const totalSubscriptions = Array.from(this.subscriptions.values())
      .reduce((sum, subs) => sum + subs.length, 0);
    
    return {
      totalUsers,
      totalSubscriptions,
      averageSubscriptionsPerUser: totalUsers > 0 ? totalSubscriptions / totalUsers : 0
    };
  }
}