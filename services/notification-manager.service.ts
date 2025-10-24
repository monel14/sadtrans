/**
 * Gestionnaire de notifications unifié
 * Interface simple pour envoyer des notifications dans l'application
 * Utilise Supabase Edge Functions pour l'envoi côté serveur
 */

import { PushNotificationService, NotificationPayload } from './push-notification.service';
import { supabase } from './supabase.service';

export interface ServerNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export interface NotificationTemplate {
  transactionValidated: (amount: string, agentName: string) => ServerNotificationPayload;
  transactionAssigned: (transactionId: string, amount: string) => ServerNotificationPayload;
  agentRechargeApproved: (amount: string) => ServerNotificationPayload;
  agentRechargeRejected: (amount: string, reason?: string) => ServerNotificationPayload;
  systemMaintenance: (startTime: string, duration: string) => ServerNotificationPayload;
  newPartnerRegistered: (partnerName: string) => ServerNotificationPayload;
}

export class NotificationManagerService {
  private static instance: NotificationManagerService;
  private pushService: PushNotificationService;

  private constructor() {
    this.pushService = PushNotificationService.getInstance();
  }

  public static getInstance(): NotificationManagerService {
    if (!NotificationManagerService.instance) {
      NotificationManagerService.instance = new NotificationManagerService();
    }
    return NotificationManagerService.instance;
  }

  /**
   * Initialise le gestionnaire de notifications
   */
  public async init(userId?: string): Promise<void> {
    try {
      await this.pushService.init(userId);
      console.log('Gestionnaire de notifications initialisé');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des notifications:', error);
    }
  }

  /**
   * S'abonne aux notifications pour l'utilisateur actuel
   */
  public async subscribe(): Promise<boolean> {
    try {
      const subscription = await this.pushService.subscribe();
      return subscription !== null;
    } catch (error) {
      console.error('Erreur lors de l\'abonnement aux notifications:', error);
      return false;
    }
  }

  /**
   * Se désabonne des notifications
   */
  public async unsubscribe(): Promise<void> {
    await this.pushService.unsubscribe();
  }

  /**
   * Vérifie si l'utilisateur est abonné
   */
  public async isSubscribed(): Promise<boolean> {
    return await this.pushService.isSubscribed();
  }

  /**
   * Associe un utilisateur aux notifications
   */
  public async login(userId: string): Promise<void> {
    await this.pushService.login(userId);
  }

  /**
   * Dissocie l'utilisateur des notifications
   */
  public async logout(): Promise<void> {
    await this.pushService.logout();
  }

  /**
   * Envoie une notification locale (pour test)
   */
  public async showLocalNotification(payload: NotificationPayload): Promise<void> {
    await this.pushService.showLocalNotification(payload);
  }

  /**
   * Envoie une notification à un utilisateur spécifique via Supabase Edge Function
   */
  public async sendToUser(userId: string, payload: ServerNotificationPayload): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          url: payload.url,
          data: payload.data
        }
      });

      if (error) {
        console.error('Erreur Supabase lors de l\'envoi de notification:', error);
        return false;
      }

      return data?.success === true;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de notification:', error);
      return false;
    }
  }

  /**
   * Envoie une notification à plusieurs utilisateurs
   */
  public async sendToUsers(userIds: string[], payload: ServerNotificationPayload): Promise<{ [userId: string]: boolean }> {
    const results: { [userId: string]: boolean } = {};

    try {
      // Envoyer les notifications en parallèle
      const promises = userIds.map(async (userId) => {
        const success = await this.sendToUser(userId, payload);
        return { userId, success };
      });

      const responses = await Promise.all(promises);

      for (const response of responses) {
        results[response.userId] = response.success;
      }

      return results;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de notifications multiples:', error);
      return results;
    }
  }

  /**
   * Diffuse une notification à tous les utilisateurs abonnés
   */
  public async broadcast(payload: ServerNotificationPayload): Promise<{ success: number; failed: number }> {
    try {
      // Récupérer tous les utilisateurs avec des abonnements push
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('user_id');

      if (error || !subscriptions) {
        console.error('Erreur lors de la récupération des abonnements:', error);
        return { success: 0, failed: 0 };
      }

      // Extraire les user_ids uniques
      const userIds = [...new Set(subscriptions.map(sub => sub.user_id))];

      // Envoyer à tous les utilisateurs
      const results = await this.sendToUsers(userIds, payload);

      const success = Object.values(results).filter(r => r === true).length;
      const failed = Object.values(results).filter(r => r === false).length;

      return { success, failed };
    } catch (error) {
      console.error('Erreur lors de la diffusion:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Templates de notifications prédéfinis
   */
  public get templates(): NotificationTemplate {
    return {
      transactionValidated: (amount: string, agentName: string) => ({
        title: '✅ Transaction Validée',
        body: `Transaction de ${amount} validée pour ${agentName}`,
        icon: '/favicon.ico',
        data: { type: 'transaction_validated', amount, agentName },
        url: '/admin/transactions'
      }),

      transactionAssigned: (transactionId: string, amount: string) => ({
        title: '📋 Nouvelle Tâche Assignée',
        body: `Transaction de ${amount} vous a été assignée`,
        icon: '/favicon.ico',
        data: { type: 'transaction_assigned', transactionId, amount },
        url: `/admin/transactions/${transactionId}`
      }),

      agentRechargeApproved: (amount: string) => ({
        title: '💰 Recharge Approuvée',
        body: `Votre demande de recharge de ${amount} a été approuvée`,
        icon: '/favicon.ico',
        data: { type: 'recharge_approved', amount },
        url: '/agent/balance'
      }),

      agentRechargeRejected: (amount: string, reason?: string) => ({
        title: '❌ Recharge Rejetée',
        body: `Votre demande de recharge de ${amount} a été rejetée${reason ? `: ${reason}` : ''}`,
        icon: '/favicon.ico',
        data: { type: 'recharge_rejected', amount, reason },
        url: '/agent/recharges'
      }),

      systemMaintenance: (startTime: string, duration: string) => ({
        title: '🔧 Maintenance Programmée',
        body: `Maintenance système prévue le ${startTime} (durée: ${duration})`,
        icon: '/favicon.ico',
        data: { type: 'maintenance', startTime, duration },
        url: '/maintenance'
      }),

      newPartnerRegistered: (partnerName: string) => ({
        title: '🏢 Nouveau Partenaire',
        body: `${partnerName} s'est inscrit sur la plateforme`,
        icon: '/favicon.ico',
        data: { type: 'new_partner', partnerName },
        url: '/admin/partners'
      })
    };
  }

  /**
   * Méthodes de convenance pour les notifications courantes
   */
  public async notifyTransactionValidated(userId: string, amount: string, agentName: string): Promise<boolean> {
    return await this.sendToUser(userId, this.templates.transactionValidated(amount, agentName));
  }

  public async notifyTransactionAssigned(userId: string, transactionId: string, amount: string): Promise<boolean> {
    return await this.sendToUser(userId, this.templates.transactionAssigned(transactionId, amount));
  }

  public async notifyAgentRechargeApproved(userId: string, amount: string): Promise<boolean> {
    return await this.sendToUser(userId, this.templates.agentRechargeApproved(amount));
  }

  public async notifyAgentRechargeRejected(userId: string, amount: string, reason?: string): Promise<boolean> {
    return await this.sendToUser(userId, this.templates.agentRechargeRejected(amount, reason));
  }

  public async notifySystemMaintenance(startTime: string, duration: string): Promise<{ success: number; failed: number }> {
    return await this.broadcast(this.templates.systemMaintenance(startTime, duration));
  }

  public async notifyNewPartnerRegistered(adminUserIds: string[], partnerName: string): Promise<{ [userId: string]: boolean }> {
    return await this.sendToUsers(adminUserIds, this.templates.newPartnerRegistered(partnerName));
  }

  /**
   * Obtient les statistiques des notifications depuis Supabase
   */
  public async getStats(): Promise<{
    totalUsers: number;
    totalSubscriptions: number;
    averageSubscriptionsPerUser: number;
  }> {
    try {
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('user_id');

      if (error || !subscriptions) {
        return { totalUsers: 0, totalSubscriptions: 0, averageSubscriptionsPerUser: 0 };
      }

      const totalSubscriptions = subscriptions.length;
      const uniqueUsers = new Set(subscriptions.map(sub => sub.user_id));
      const totalUsers = uniqueUsers.size;
      const averageSubscriptionsPerUser = totalUsers > 0 ? totalSubscriptions / totalUsers : 0;

      return { totalUsers, totalSubscriptions, averageSubscriptionsPerUser };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return { totalUsers: 0, totalSubscriptions: 0, averageSubscriptionsPerUser: 0 };
    }
  }

  /**
   * Nettoie les anciens abonnements via Supabase Edge Function
   */
  public async cleanupOldSubscriptions(maxAgeInDays: number = 30): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('cleanup-push-subscriptions', {
        body: { maxAgeInDays }
      });

      if (error) {
        console.error('Erreur lors du nettoyage des abonnements:', error);
      } else {
        console.log('Nettoyage des anciens abonnements terminé');
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  }
}
