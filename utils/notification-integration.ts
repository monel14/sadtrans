/**
 * Utilitaires d'intégration des notifications dans l'application
 */

import { NotificationManagerService } from '../services/notification-manager.service';
import { User } from '../models';

export class NotificationIntegration {
  private static notificationManager = NotificationManagerService.getInstance();

  /**
   * Initialise les notifications pour un utilisateur
   */
  public static async initializeForUser(user: User): Promise<void> {
    try {
      await this.notificationManager.init(user.id);
      
      // Auto-abonnement pour les admins et sous-admins
      if (user.role === 'admin' || user.role === 'subadmin') {
        const isSubscribed = await this.notificationManager.isSubscribed();
        if (!isSubscribed) {
          // Proposer l'abonnement automatiquement
          this.showSubscriptionPrompt();
        }
      }
      
      console.log(`Notifications initialisées pour ${user.name} (${user.role})`);
    } catch (error) {
      console.error('Erreur initialisation notifications:', error);
    }
  }

  /**
   * Gère la connexion utilisateur
   */
  public static async handleUserLogin(user: User): Promise<void> {
    await this.notificationManager.login(user.id);
    await this.initializeForUser(user);
  }

  /**
   * Gère la déconnexion utilisateur
   */
  public static async handleUserLogout(): Promise<void> {
    await this.notificationManager.logout();
  }

  /**
   * Envoie des notifications pour les événements de transaction
   */
  public static async handleTransactionEvents(eventType: string, data: any): Promise<void> {
    try {
      switch (eventType) {
        case 'transaction_validated':
          await this.notificationManager.notifyTransactionValidated(
            data.agentId,
            data.amount,
            data.agentName
          );
          break;

        case 'transaction_assigned':
          await this.notificationManager.notifyTransactionAssigned(
            data.assignedToId,
            data.transactionId,
            data.amount
          );
          break;

        case 'agent_recharge_approved':
          await this.notificationManager.notifyAgentRechargeApproved(
            data.agentId,
            data.amount
          );
          break;

        case 'agent_recharge_rejected':
          await this.notificationManager.notifyAgentRechargeRejected(
            data.agentId,
            data.amount,
            data.reason
          );
          break;

        default:
          console.warn('Type d\'événement de notification non géré:', eventType);
      }
    } catch (error) {
      console.error('Erreur envoi notification événement:', error);
    }
  }

  /**
   * Envoie des notifications système
   */
  public static async sendSystemNotification(
    type: 'maintenance' | 'new_partner' | 'custom',
    data: any,
    targetUsers?: string[]
  ): Promise<void> {
    try {
      switch (type) {
        case 'maintenance':
          await this.notificationManager.notifySystemMaintenance(
            data.startTime,
            data.duration
          );
          break;

        case 'new_partner':
          // Envoyer aux admins uniquement
          const adminIds = targetUsers || await this.getAdminUserIds();
          await this.notificationManager.notifyNewPartnerRegistered(
            adminIds,
            data.partnerName
          );
          break;

        case 'custom':
          if (targetUsers && targetUsers.length > 0) {
            await this.notificationManager.sendToUsers(targetUsers, data.payload);
          } else {
            await this.notificationManager.broadcast(data.payload);
          }
          break;
      }
    } catch (error) {
      console.error('Erreur envoi notification système:', error);
    }
  }

  /**
   * Affiche une invite d'abonnement aux notifications
   */
  private static showSubscriptionPrompt(): void {
    // Créer une notification toast pour proposer l'abonnement
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-white border border-slate-200 rounded-lg shadow-lg p-4 max-w-sm z-50';
    toast.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <i class="fas fa-bell text-blue-500 text-lg"></i>
        </div>
        <div class="ml-3 flex-1">
          <h4 class="text-sm font-semibold text-slate-800">Notifications Push</h4>
          <p class="text-xs text-slate-600 mt-1">
            Activez les notifications pour être informé en temps réel des nouvelles tâches et événements.
          </p>
          <div class="mt-3 flex gap-2">
            <button id="enable-notifications" class="btn btn-xs btn-primary">
              Activer
            </button>
            <button id="dismiss-prompt" class="btn btn-xs btn-outline-secondary">
              Plus tard
            </button>
          </div>
        </div>
        <button id="close-prompt" class="ml-2 text-slate-400 hover:text-slate-600">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Gestionnaires d'événements
    const enableBtn = toast.querySelector('#enable-notifications');
    const dismissBtn = toast.querySelector('#dismiss-prompt');
    const closeBtn = toast.querySelector('#close-prompt');

    const removeToast = () => {
      toast.remove();
    };

    enableBtn?.addEventListener('click', async () => {
      try {
        const success = await this.notificationManager.subscribe();
        if (success) {
          // Afficher un message de succès
          document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Notifications activées avec succès!', type: 'success' }
          }));
        }
      } catch (error) {
        console.error('Erreur activation notifications:', error);
        document.body.dispatchEvent(new CustomEvent('showToast', {
          detail: { message: 'Erreur lors de l\'activation des notifications', type: 'error' }
        }));
      }
      removeToast();
    });

    dismissBtn?.addEventListener('click', removeToast);
    closeBtn?.addEventListener('click', removeToast);

    // Auto-suppression après 10 secondes
    setTimeout(removeToast, 10000);
  }

  /**
   * Obtient les IDs des utilisateurs admin (à adapter selon votre système)
   */
  private static async getAdminUserIds(): Promise<string[]> {
    // TODO: Implémenter selon votre système de gestion des utilisateurs
    // Exemple: récupérer depuis votre API ou service de données
    try {
      // const adminUsers = await DataService.getInstance().getUsers({ role: 'admin' });
      // return adminUsers.map(user => user.id);
      return []; // Placeholder
    } catch (error) {
      console.error('Erreur récupération admins:', error);
      return [];
    }
  }

  private static cleanupInterval: number | null = null;

  /**
   * Vérifie et nettoie périodiquement les abonnements
   */
  public static startPeriodicCleanup(): void {
    // Nettoyer les anciens abonnements toutes les 24 heures
    this.cleanupInterval = window.setInterval(() => {
      this.notificationManager.cleanupOldSubscriptions(30); // 30 jours
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Arrête le nettoyage périodique
   */
  public static stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("✅ Periodic cleanup stopped");
    }
  }

  /**
   * Obtient le statut des notifications pour l'interface
   */
  public static async getNotificationStatus(): Promise<{
    isSupported: boolean;
    isSubscribed: boolean;
    stats: any;
  }> {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    const isSubscribed = isSupported ? await this.notificationManager.isSubscribed() : false;
    const stats = this.notificationManager.getStats();

    return { isSupported, isSubscribed, stats };
  }
}