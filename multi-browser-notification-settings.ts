/**
 * Composant pour gérer les notifications push multi-navigateurs
 */

import { ImprovedPushNotificationService } from '../services/improved-push-notification.service';

export async function createMultiBrowserNotificationSettings(): Promise<HTMLElement> {
  const pushService = ImprovedPushNotificationService.getInstance();
  
  const container = document.createElement('div');
  container.className = 'multi-browser-notifications card p-6';

  // Charger les statistiques
  const stats = await pushService.getSubscriptionStats();
  const isCurrentBrowserSubscribed = await pushService.isSubscribed();

  container.innerHTML = `
    <div class="mb-6">
      <h3 class="text-xl font-semibold text-slate-800 mb-2">Notifications Push</h3>
      <p class="text-sm text-slate-600">
        Gérez vos notifications sur tous vos navigateurs et appareils
      </p>
    </div>

    <!-- Statut du navigateur actuel -->
    <div class="bg-slate-50 rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-medium text-slate-800">Ce navigateur</h4>
          <p class="text-sm text-slate-600">
            ${isCurrentBrowserSubscribed ? '✅ Notifications activées' : '❌ Notifications désactivées'}
          </p>
        </div>
        <button 
          id="toggle-current-browser" 
          class="btn ${isCurrentBrowserSubscribed ? 'btn-outline-danger' : 'btn-primary'}"
        >
          ${isCurrentBrowserSubscribed ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>

    <!-- Statistiques globales -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-blue-50 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-blue-600">${stats.totalBrowsers}</div>
        <div class="text-sm text-blue-700">Navigateurs connectés</div>
      </div>
      <div class="bg-green-50 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-green-600">${stats.browsers.filter(b => b.isCurrent).length}</div>
        <div class="text-sm text-green-700">Navigateur actuel</div>
      </div>
    </div>

    <!-- Liste des navigateurs -->
    <div class="mb-6">
      <h4 class="font-medium text-slate-800 mb-3">Navigateurs avec notifications</h4>
      <div id="browsers-list" class="space-y-3">
        ${stats.browsers.length === 0 ? `
          <div class="text-center py-8 text-slate-500">
            <i class="fas fa-browser text-3xl mb-3"></i>
            <p>Aucun navigateur avec notifications activées</p>
          </div>
        ` : stats.browsers.map(browser => `
          <div class="flex items-center justify-between p-3 border rounded-lg ${browser.isCurrent ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}">
            <div class="flex items-center">
              <i class="fas ${getBrowserIcon(browser.browserName)} text-lg mr-3 text-slate-600"></i>
              <div>
                <div class="font-medium text-slate-800">
                  ${browser.browserName} ${browser.isCurrent ? '(Actuel)' : ''}
                </div>
                <div class="text-sm text-slate-600">
                  ${browser.platform} • Dernière utilisation: ${formatDate(browser.lastUsed)}
                </div>
              </div>
            </div>
            ${browser.isCurrent ? `
              <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                Actuel
              </span>
            ` : `
              <button 
                class="btn btn-sm btn-outline-danger remove-browser-btn" 
                data-endpoint="${browser.browserName}"
              >
                Supprimer
              </button>
            `}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Actions globales -->
    <div class="border-t pt-4">
      <div class="flex gap-3">
        <button id="test-notification" class="btn btn-outline-secondary btn-sm">
          <i class="fas fa-bell mr-2"></i>Tester les notifications
        </button>
        ${stats.totalBrowsers > 1 ? `
          <button id="remove-all-browsers" class="btn btn-outline-danger btn-sm">
            <i class="fas fa-trash mr-2"></i>Désactiver partout
          </button>
        ` : ''}
        <button id="refresh-list" class="btn btn-outline-primary btn-sm">
          <i class="fas fa-sync mr-2"></i>Actualiser
        </button>
      </div>
    </div>

    <!-- Zone de statut -->
    <div id="status-area" class="mt-4"></div>
  `;

  // Gestionnaires d'événements
  setupEventHandlers(container, pushService);

  return container;
}

function setupEventHandlers(container: HTMLElement, pushService: ImprovedPushNotificationService) {
  const statusArea = container.querySelector('#status-area') as HTMLElement;

  // Toggle navigateur actuel
  const toggleCurrentBtn = container.querySelector('#toggle-current-browser') as HTMLButtonElement;
  toggleCurrentBtn?.addEventListener('click', async () => {
    try {
      toggleCurrentBtn.disabled = true;
      toggleCurrentBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Traitement...';

      const isSubscribed = await pushService.isSubscribed();
      
      if (isSubscribed) {
        await pushService.unsubscribe();
        showStatus('Notifications désactivées sur ce navigateur', 'success');
      } else {
        await pushService.subscribe();
        showStatus('Notifications activées sur ce navigateur', 'success');
      }

      // Recharger le composant
      const newComponent = await createMultiBrowserNotificationSettings();
      container.parentNode?.replaceChild(newComponent, container);

    } catch (error) {
      console.error('Erreur toggle:', error);
      showStatus('Erreur lors de la modification', 'error');
      toggleCurrentBtn.disabled = false;
    }
  });

  // Test de notification
  const testBtn = container.querySelector('#test-notification') as HTMLButtonElement;
  testBtn?.addEventListener('click', async () => {
    try {
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Envoi...';

      // Envoyer une notification de test locale
      if ('serviceWorker' in navigator && 'Notification' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🧪 Test Multi-Navigateur', {
          body: 'Cette notification confirme que vos notifications fonctionnent sur ce navigateur!',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });
      }

      showStatus('Notification de test envoyée!', 'success');
      
    } catch (error) {
      console.error('Erreur test:', error);
      showStatus('Erreur lors de l\'envoi du test', 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="fas fa-bell mr-2"></i>Tester les notifications';
    }
  });

  // Supprimer tous les navigateurs
  const removeAllBtn = container.querySelector('#remove-all-browsers') as HTMLButtonElement;
  removeAllBtn?.addEventListener('click', async () => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver les notifications sur tous vos navigateurs ?')) {
      return;
    }

    try {
      removeAllBtn.disabled = true;
      removeAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Suppression...';

      await pushService.unsubscribeAll();
      showStatus('Notifications désactivées sur tous les navigateurs', 'success');

      // Recharger le composant
      const newComponent = await createMultiBrowserNotificationSettings();
      container.parentNode?.replaceChild(newComponent, container);

    } catch (error) {
      console.error('Erreur suppression globale:', error);
      showStatus('Erreur lors de la suppression', 'error');
      removeAllBtn.disabled = false;
    }
  });

  // Actualiser la liste
  const refreshBtn = container.querySelector('#refresh-list') as HTMLButtonElement;
  refreshBtn?.addEventListener('click', async () => {
    try {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Actualisation...';

      // Recharger le composant
      const newComponent = await createMultiBrowserNotificationSettings();
      container.parentNode?.replaceChild(newComponent, container);

    } catch (error) {
      console.error('Erreur actualisation:', error);
      showStatus('Erreur lors de l\'actualisation', 'error');
      refreshBtn.disabled = false;
    }
  });

  function showStatus(message: string, type: 'success' | 'error' | 'info') {
    const alertClass = type === 'success' ? 'alert-success' : 
                     type === 'error' ? 'alert-danger' : 'alert-info';
    
    statusArea.innerHTML = `
      <div class="alert ${alertClass}">
        <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-times' : 'fa-info'} mr-2"></i>
        ${message}
      </div>
    `;

    setTimeout(() => {
      statusArea.innerHTML = '';
    }, 5000);
  }
}

function getBrowserIcon(browserName: string): string {
  const icons: { [key: string]: string } = {
    'Chrome': 'fa-chrome',
    'Firefox': 'fa-firefox',
    'Safari': 'fa-safari',
    'Edge': 'fa-edge',
    'Opera': 'fa-opera'
  };
  return icons[browserName] || 'fa-globe';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Aujourd\'hui';
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jours`;
  } else {
    return date.toLocaleDateString('fr-FR');
  }
}