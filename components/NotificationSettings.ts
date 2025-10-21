/**
 * Composant pour gérer les paramètres de notifications push
 */

import { NotificationManagerService } from '../services/notification-manager.service';

export interface NotificationSettingsOptions {
  showTestButton?: boolean;
  showStats?: boolean;
  onSubscriptionChange?: (isSubscribed: boolean) => void;
}

export async function createNotificationSettings(
  options: NotificationSettingsOptions = {}
): Promise<HTMLElement> {
  const notificationManager = NotificationManagerService.getInstance();
  
  const container = document.createElement('div');
  container.className = 'notification-settings card p-4';

  // Vérifier le statut actuel
  const isSubscribed = await notificationManager.isSubscribed();
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-semibold text-slate-800">Notifications Push</h3>
        <p class="text-sm text-slate-600">Recevez des notifications en temps réel</p>
      </div>
      <div class="flex items-center">
        <span class="mr-3 text-sm ${isSubscribed ? 'text-green-600' : 'text-slate-500'}">
          ${isSubscribed ? '✓ Activées' : '○ Désactivées'}
        </span>
        <button 
          id="toggle-notifications" 
          class="btn ${isSubscribed ? 'btn-outline-danger' : 'btn-primary'}"
          ${!isSupported ? 'disabled' : ''}
        >
          ${isSubscribed ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>

    ${!isSupported ? `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Les notifications push ne sont pas supportées par votre navigateur.
      </div>
    ` : ''}

    ${options.showTestButton && isSubscribed ? `
      <div class="border-t pt-4 mt-4">
        <button id="test-notification" class="btn btn-outline-secondary btn-sm">
          <i class="fas fa-bell mr-2"></i>Tester les notifications
        </button>
      </div>
    ` : ''}

    ${options.showStats ? `
      <div id="notification-stats" class="border-t pt-4 mt-4">
        <!-- Les statistiques seront chargées ici -->
      </div>
    ` : ''}

    <div id="notification-status" class="mt-4"></div>
  `;

  // Gestionnaires d'événements
  const toggleButton = container.querySelector('#toggle-notifications') as HTMLButtonElement;
  const testButton = container.querySelector('#test-notification') as HTMLButtonElement;
  const statusDiv = container.querySelector('#notification-status') as HTMLDivElement;

  if (toggleButton) {
    toggleButton.addEventListener('click', async () => {
      try {
        toggleButton.disabled = true;
        toggleButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Traitement...';

        const currentlySubscribed = await notificationManager.isSubscribed();
        
        if (currentlySubscribed) {
          await notificationManager.unsubscribe();
          showStatus('Notifications désactivées', 'success');
          
          // Recharger le composant
          const newComponent = await createNotificationSettings(options);
          container.parentNode?.replaceChild(newComponent, container);
          
        } else {
          const success = await notificationManager.subscribe();
          
          if (success) {
            showStatus('Notifications activées avec succès!', 'success');
            
            // Recharger le composant
            const newComponent = await createNotificationSettings(options);
            container.parentNode?.replaceChild(newComponent, container);
            
          } else {
            showStatus('Erreur lors de l\'activation des notifications', 'error');
            toggleButton.disabled = false;
            toggleButton.innerHTML = 'Activer';
          }
        }

        // Notifier le changement
        if (options.onSubscriptionChange) {
          const newStatus = await notificationManager.isSubscribed();
          options.onSubscriptionChange(newStatus);
        }

      } catch (error) {
        console.error('Erreur toggle notifications:', error);
        showStatus('Erreur lors de la modification des notifications', 'error');
        toggleButton.disabled = false;
        toggleButton.innerHTML = isSubscribed ? 'Désactiver' : 'Activer';
      }
    });
  }

  if (testButton) {
    testButton.addEventListener('click', async () => {
      try {
        testButton.disabled = true;
        testButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Envoi...';

        await notificationManager.showLocalNotification({
          title: '🧪 Test SadTrans',
          body: 'Ceci est une notification de test. Vos notifications fonctionnent correctement!',
          icon: '/favicon.ico',
          data: { type: 'test' }
        });

        showStatus('Notification de test envoyée!', 'success');
        
      } catch (error) {
        console.error('Erreur test notification:', error);
        showStatus('Erreur lors de l\'envoi du test', 'error');
      } finally {
        testButton.disabled = false;
        testButton.innerHTML = '<i class="fas fa-bell mr-2"></i>Tester les notifications';
      }
    });
  }

  // Charger les statistiques si demandées
  if (options.showStats) {
    loadStats();
  }

  function showStatus(message: string, type: 'success' | 'error' | 'info') {
    const alertClass = type === 'success' ? 'alert-success' : 
                     type === 'error' ? 'alert-danger' : 'alert-info';
    
    statusDiv.innerHTML = `
      <div class="alert ${alertClass}">
        <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-times' : 'fa-info'} mr-2"></i>
        ${message}
      </div>
    `;

    // Effacer le message après 5 secondes
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 5000);
  }

  function loadStats() {
    const statsContainer = container.querySelector('#notification-stats');
    if (!statsContainer) return;

    try {
      const stats = notificationManager.getStats();
      
      statsContainer.innerHTML = `
        <h4 class="text-md font-semibold text-slate-700 mb-3">Statistiques</h4>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-slate-50 p-3 rounded">
            <div class="text-2xl font-bold text-blue-600">${stats.totalUsers}</div>
            <div class="text-xs text-slate-500">Utilisateurs</div>
          </div>
          <div class="bg-slate-50 p-3 rounded">
            <div class="text-2xl font-bold text-green-600">${stats.totalSubscriptions}</div>
            <div class="text-xs text-slate-500">Abonnements</div>
          </div>
          <div class="bg-slate-50 p-3 rounded">
            <div class="text-2xl font-bold text-purple-600">${stats.averageSubscriptionsPerUser.toFixed(1)}</div>
            <div class="text-xs text-slate-500">Moy./Utilisateur</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      statsContainer.innerHTML = `
        <div class="text-sm text-slate-500">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          Impossible de charger les statistiques
        </div>
      `;
    }
  }

  return container;
}

/**
 * Fonction utilitaire pour créer un bouton de notification simple
 */
export async function createNotificationToggle(): Promise<HTMLElement> {
  const notificationManager = NotificationManagerService.getInstance();
  const isSubscribed = await notificationManager.isSubscribed();
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  const button = document.createElement('button');
  button.className = `btn btn-sm ${isSubscribed ? 'btn-outline-secondary' : 'btn-outline-primary'}`;
  button.disabled = !isSupported;
  
  const updateButton = (subscribed: boolean) => {
    button.innerHTML = `
      <i class="fas ${subscribed ? 'fa-bell-slash' : 'fa-bell'} mr-2"></i>
      ${subscribed ? 'Désactiver' : 'Activer'} notifications
    `;
  };

  updateButton(isSubscribed);

  button.addEventListener('click', async () => {
    try {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Traitement...';

      const currentlySubscribed = await notificationManager.isSubscribed();
      
      if (currentlySubscribed) {
        await notificationManager.unsubscribe();
      } else {
        await notificationManager.subscribe();
      }

      const newStatus = await notificationManager.isSubscribed();
      updateButton(newStatus);
      
    } catch (error) {
      console.error('Erreur toggle notifications:', error);
      updateButton(isSubscribed);
    } finally {
      button.disabled = false;
    }
  });

  return button;
}