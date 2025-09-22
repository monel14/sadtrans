/**
 * Wrapper pour ajouter le rafraîchissement automatique aux vues existantes
 */

import { RefreshService } from '../services/refresh.service';
import { DataService } from '../services/data.service';

export interface AutoRefreshConfig {
    viewId: string;
    refreshIntervalMs?: number; // Intervalle de rafraîchissement automatique (optionnel)
    dataTypes: ('transactions' | 'users' | 'recharges' | 'operations' | 'partners')[];
    onRefresh?: () => Promise<void>; // Callback personnalisé de rafraîchissement
}

/**
 * Ajoute le rafraîchissement automatique à un élément HTML existant
 */
export function addAutoRefresh(element: HTMLElement, config: AutoRefreshConfig): void {
    const refreshService = RefreshService.getInstance();
    let refreshInterval: number | null = null;
    
    // Fonction de rafraîchissement
    const refresh = async () => {
        try {
            // Invalider les caches selon les types de données
            const dataService = DataService.getInstance();
            config.dataTypes.forEach(type => {
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
            
            // Appeler le callback personnalisé si fourni
            if (config.onRefresh) {
                await config.onRefresh();
            } else {
                // Déclencher un événement de rafraîchissement sur l'élément
                element.dispatchEvent(new CustomEvent('autoRefresh', {
                    detail: { dataTypes: config.dataTypes }
                }));
            }
        } catch (error) {
            console.error(`Error auto-refreshing view ${config.viewId}:`, error);
        }
    };
    
    // Créer la vue rafraîchissable
    const refreshableView = {
        refresh,
        cleanup: () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
            refreshService.unregisterView(config.viewId);
        }
    };
    
    // Enregistrer la vue
    refreshService.registerView(config.viewId, refreshableView);
    
    // Configurer le rafraîchissement automatique par intervalle si spécifié
    if (config.refreshIntervalMs) {
        refreshInterval = window.setInterval(refresh, config.refreshIntervalMs);
    }
    
    // Ajouter un bouton de rafraîchissement manuel si pas déjà présent
    addRefreshButtonIfNeeded(element, refresh);
    
    // Nettoyer quand l'élément est supprimé du DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === element || (node as Element).contains?.(element)) {
                    refreshableView.cleanup();
                    observer.disconnect();
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Stocker la fonction de nettoyage sur l'élément
    (element as any)._autoRefreshCleanup = refreshableView.cleanup;
}

/**
 * Ajoute un bouton de rafraîchissement si pas déjà présent
 */
function addRefreshButtonIfNeeded(element: HTMLElement, onRefresh: () => Promise<void>): void {
    // Chercher un header de carte existant
    const cardHeader = element.querySelector('.card-header');
    if (!cardHeader) return;
    
    // Vérifier si un bouton de rafraîchissement existe déjà
    if (cardHeader.querySelector('[data-auto-refresh-btn]')) return;
    
    // Créer le bouton de rafraîchissement
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-sm btn-primary';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Actualiser';
    refreshButton.setAttribute('data-auto-refresh-btn', 'true');
    
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
    
    cardHeader.appendChild(refreshButton);
}

/**
 * Supprime le rafraîchissement automatique d'un élément
 */
export function removeAutoRefresh(element: HTMLElement): void {
    if ((element as any)._autoRefreshCleanup) {
        const cleanup = (element as any)._autoRefreshCleanup;
        // Supprimer la référence avant d'appeler pour éviter les exécutions multiples
        delete (element as any)._autoRefreshCleanup;
        if (typeof cleanup === 'function') {
            cleanup();
        }
    }
}

/**
 * Wrapper simple pour les vues existantes
 */
export function wrapWithAutoRefresh<T extends any[]>(
    viewFunction: (...args: T) => Promise<HTMLElement>,
    config: AutoRefreshConfig
) {
    return async (...args: T): Promise<HTMLElement> => {
        const element = await viewFunction(...args);
        addAutoRefresh(element, config);
        return element;
    };
}