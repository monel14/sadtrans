/**
 * Service global de rafraîchissement automatique
 * Gère les mises à jour en temps réel de l'interface utilisateur
 */

export interface RefreshableView {
    refresh(): Promise<void>;
    cleanup?(): void;
}

export class RefreshService {
    private static instance: RefreshService;
    private registeredViews: Map<string, RefreshableView> = new Map();
    private eventListeners: Map<string, EventListener[]> = new Map();

    private constructor() {
        this.setupGlobalEventListeners();
    }

    public static getInstance(): RefreshService {
        if (!RefreshService.instance) {
            RefreshService.instance = new RefreshService();
        }
        return RefreshService.instance;
    }

    /**
     * Enregistre une vue pour le rafraîchissement automatique
     */
    public registerView(viewId: string, view: RefreshableView): void {
        this.registeredViews.set(viewId, view);
    }

    /**
     * Désenregistre une vue
     */
    public unregisterView(viewId: string): void {
        const view = this.registeredViews.get(viewId);
        if (view) {
            // Supprimer d'abord pour éviter les boucles de nettoyage récursives
            this.registeredViews.delete(viewId);
            if (view.cleanup) {
                view.cleanup();
            }
        }
    }

    /**
     * Rafraîchit toutes les vues enregistrées
     */
    public async refreshAllViews(): Promise<void> {
        const refreshPromises = Array.from(this.registeredViews.values()).map(view => 
            view.refresh().catch(error => console.error('Error refreshing view:', error))
        );
        await Promise.all(refreshPromises);
    }

    /**
     * Rafraîchit une vue spécifique
     */
    public async refreshView(viewId: string): Promise<void> {
        const view = this.registeredViews.get(viewId);
        if (view) {
            await view.refresh();
        }
    }

    /**
     * Rafraîchit les vues qui dépendent d'un type de données spécifique
     */
    public async refreshViewsByDataType(dataType: 'transactions' | 'users' | 'recharges' | 'operations' | 'partners'): Promise<void> {
        // Mapping des types de données vers les vues concernées
        const dataTypeViewMap: Record<string, string[]> = {
            'transactions': ['admin-transaction-validation', 'all-transactions', 'agent-transaction-history', 'admin-dashboard', 'partner-dashboard'],
            'users': ['admin-manage-users', 'partner-manage-users', 'admin-dashboard'],
            'recharges': ['admin-agent-recharges', 'agent-recharge-history', 'partner-user-recharges'],
            'operations': ['admin-manage-operation-types', 'developer-manage-operation-types'],
            'partners': ['admin-manage-partners', 'admin-dashboard']
        };

        const viewsToRefresh = dataTypeViewMap[dataType] || [];
        const refreshPromises = viewsToRefresh.map(viewId => this.refreshView(viewId));
        await Promise.all(refreshPromises);
    }

    /**
     * Configure les listeners d'événements globaux
     */
    private setupGlobalEventListeners(): void {
        // Événements de transaction
        this.addGlobalListener('transactionValidated', () => {
            this.refreshViewsByDataType('transactions');
        });

        this.addGlobalListener('transactionRejected', () => {
            this.refreshViewsByDataType('transactions');
        });

        this.addGlobalListener('transactionCreated', () => {
            this.refreshViewsByDataType('transactions');
        });

        this.addGlobalListener('transactionAssigned', () => {
            this.refreshViewsByDataType('transactions');
        });

        // Événements de recharge
        this.addGlobalListener('rechargeApproved', () => {
            this.refreshViewsByDataType('recharges');
            this.refreshViewsByDataType('users'); // Les soldes peuvent changer
        });

        this.addGlobalListener('rechargeRejected', () => {
            this.refreshViewsByDataType('recharges');
        });

        this.addGlobalListener('rechargeCreated', () => {
            this.refreshViewsByDataType('recharges');
        });

        // Événements d'utilisateur
        this.addGlobalListener('userUpdated', () => {
            this.refreshViewsByDataType('users');
        });

        this.addGlobalListener('userCreated', () => {
            this.refreshViewsByDataType('users');
        });

        this.addGlobalListener('userStatusChanged', () => {
            this.refreshViewsByDataType('users');
        });

        // Événements de partenaire
        this.addGlobalListener('partnerUpdated', () => {
            this.refreshViewsByDataType('partners');
        });

        // Événements d'opération
        this.addGlobalListener('operationTypeUpdated', () => {
            this.refreshViewsByDataType('operations');
        });

        this.addGlobalListener('operationTypeCreated', () => {
            this.refreshViewsByDataType('operations');
        });

        this.addGlobalListener('operationTypeDeleted', () => {
            this.refreshViewsByDataType('operations');
        });
    }

    /**
     * Ajoute un listener d'événement global
     */
    private addGlobalListener(eventName: string, handler: EventListener): void {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        
        this.eventListeners.get(eventName)!.push(handler);
        document.body.addEventListener(eventName, handler);
    }

    /**
     * Nettoie tous les listeners
     */
    public cleanup(): void {
        this.eventListeners.forEach((listeners, eventName) => {
            listeners.forEach(listener => {
                document.body.removeEventListener(eventName, listener);
            });
        });
        this.eventListeners.clear();
        this.registeredViews.clear();
    }

    /**
     * Déclenche un rafraîchissement manuel de toutes les vues
     */
    public triggerGlobalRefresh(): void {
        document.body.dispatchEvent(new CustomEvent('globalRefreshRequested'));
        this.refreshAllViews();
    }
}