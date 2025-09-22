/**
 * Utilitaires pour créer des vues rafraîchissables
 */

import { RefreshService, RefreshableView } from '../services/refresh.service';
import { DataService } from '../services/data.service';

export interface RefreshableViewConfig {
    viewId: string;
    refreshData: () => Promise<void>;
    renderContent: () => Promise<void>;
    dataTypes?: ('transactions' | 'users' | 'recharges' | 'operations' | 'partners')[];
}

/**
 * Crée une vue rafraîchissable avec gestion automatique des événements
 */
export function createRefreshableView(config: RefreshableViewConfig): RefreshableView {
    const refreshService = RefreshService.getInstance();
    
    const view: RefreshableView = {
        async refresh() {
            try {
                await config.refreshData();
                await config.renderContent();
            } catch (error) {
                console.error(`Error refreshing view ${config.viewId}:`, error);
                // Afficher un toast d'erreur
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Erreur lors de la mise à jour des données', type: 'error' }
                }));
            }
        },

        cleanup() {
            refreshService.unregisterView(config.viewId);
        }
    };

    // Enregistrer la vue
    refreshService.registerView(config.viewId, view);

    return view;
}

/**
 * Ajoute un bouton de rafraîchissement à un conteneur
 */
export function addRefreshButton(container: HTMLElement, onRefresh: () => Promise<void>): HTMLButtonElement {
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-sm btn-primary';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Actualiser';
    
    refreshButton.addEventListener('click', async () => {
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Actualisation...';
        
        try {
            await onRefresh();
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Données mises à jour avec succès', type: 'success' }
            }));
        } catch (error) {
            console.error('Error refreshing:', error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Erreur lors de la mise à jour', type: 'error' }
            }));
        } finally {
            refreshButton.disabled = false;
            refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Actualiser';
        }
    });

    return refreshButton;
}

/**
 * Invalide les caches selon les types de données
 */
export function invalidateCaches(dataTypes: ('transactions' | 'users' | 'recharges' | 'operations' | 'partners')[]): void {
    const dataService = DataService.getInstance();
    
    dataTypes.forEach(type => {
        switch (type) {
            case 'transactions':
                dataService.invalidateTransactionsCache();
                break;
            case 'users':
                dataService.invalidateUsersCache();
                break;
            case 'recharges':
                dataService.invalidateAgentRechargeRequestsCache();
                dataService.invalidateRechargePaymentMethodsCache();
                break;
            case 'operations':
                dataService.invalidateOperationTypesCache();
                break;
            case 'partners':
                dataService.invalidatePartnersCache();
                break;
        }
    });
}

/**
 * Crée un conteneur avec rafraîchissement automatique
 */
export function createAutoRefreshContainer(
    title: string,
    icon: string,
    config: RefreshableViewConfig
): { container: HTMLElement; refreshableView: RefreshableView } {
    const container = document.createElement('div');
    container.className = 'card';
    
    const header = document.createElement('div');
    header.className = 'card-header flex justify-between items-center';
    
    const titleElement = document.createElement('h3');
    titleElement.className = 'card-title';
    titleElement.innerHTML = `<i class="fas ${icon} mr-2"></i>${title}`;
    
    const refreshButton = addRefreshButton(container, async () => {
        invalidateCaches(config.dataTypes || []);
        await config.refreshData();
        await config.renderContent();
    });
    
    header.appendChild(titleElement);
    header.appendChild(refreshButton);
    
    const content = document.createElement('div');
    content.className = 'card-content';
    content.id = `${config.viewId}-content`;
    
    container.appendChild(header);
    container.appendChild(content);
    
    const refreshableView = createRefreshableView(config);
    
    return { container, refreshableView };
}