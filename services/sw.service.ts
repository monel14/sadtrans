/**
 * Service Worker Manager Complet
 * Gère l'interaction avec le service worker pour une PWA complète
 */

interface CacheStrategy {
    name: string;
    pattern: RegExp;
    strategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate';
    maxAge?: number;
    maxEntries?: number;
}

interface SyncData {
    id: string;
    url: string;
    method: string;
    body?: any;
    headers?: Record<string, string>;
    timestamp: number;
}

export class ServiceWorkerManager {
    private static instance: ServiceWorkerManager;
    private registration: ServiceWorkerRegistration | null = null;
    private isOnline: boolean = navigator.onLine;
    private pendingSyncs: SyncData[] = [];
    private cacheStrategies: CacheStrategy[] = [
        {
            name: 'static-resources',
            pattern: /\.(js|css|html|png|jpg|jpeg|svg|ico|woff2?)$/,
            strategy: 'cacheFirst',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
            maxEntries: 100
        },
        {
            name: 'api-calls',
            pattern: /\/api\/|supabase\.co/,
            strategy: 'networkFirst',
            maxAge: 5 * 60 * 1000, // 5 minutes
            maxEntries: 50
        },
        {
            name: 'images',
            pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
            strategy: 'cacheFirst',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
            maxEntries: 200
        }
    ];

    private constructor() {
        this.setupEventListeners();
        this.loadPendingSyncs();
    }

    public static getInstance(): ServiceWorkerManager {
        if (!ServiceWorkerManager.instance) {
            ServiceWorkerManager.instance = new ServiceWorkerManager();
        }
        return ServiceWorkerManager.instance;
    }

    /**
     * Initialise le service worker complet
     */
    public async init(): Promise<void> {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker non supporté par ce navigateur');
            return;
        }

        try {
            this.registration = await navigator.serviceWorker.register('/unified-sw.js', {
                scope: '/',
                updateViaCache: 'none' // Toujours vérifier les mises à jour
            });

            console.log('✅ Service Worker enregistré:', this.registration.scope);

            // Configuration des stratégies de cache
            await this.configureCacheStrategies();

            // Écouter les mises à jour
            this.registration.addEventListener('updatefound', () => {
                this.handleUpdateFound();
            });

            // Vérifier s'il y a une mise à jour en attente
            if (this.registration.waiting) {
                this.showUpdateAvailable();
            }

            // Vérifier les mises à jour périodiquement
            this.scheduleUpdateCheck();

            // Initialiser le mode hors ligne
            await this.initOfflineMode();

        } catch (error) {
            console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
        }
    }

    /**
     * Configure les stratégies de cache
     */
    private async configureCacheStrategies(): Promise<void> {
        if (!this.registration) return;

        const message = {
            type: 'CONFIGURE_CACHE_STRATEGIES',
            strategies: this.cacheStrategies
        };

        await this.sendMessageToSW(message);
    }

    /**
     * Initialise le mode hors ligne
     */
    private async initOfflineMode(): Promise<void> {
        // Pré-cacher les ressources critiques
        const criticalResources = [
            '/',
            '/index.html',
            '/index.css',
            '/app.js',
            '/offline.html'
        ];

        await this.precacheResources(criticalResources);
        console.log('💾 Ressources critiques mises en cache');
    }

    /**
     * Pré-cache des ressources
     */
    public async precacheResources(urls: string[]): Promise<void> {
        if (!this.registration) return;

        const message = {
            type: 'PRECACHE_RESOURCES',
            urls
        };

        await this.sendMessageToSW(message);
    }

    /**
     * Configure les écouteurs d'événements
     */
    private setupEventListeners(): void {
        // Écouter les changements de connexion
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnlineStatusChange(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOnlineStatusChange(false);
        });

        // Écouter les messages du service worker
        navigator.serviceWorker?.addEventListener('message', (event) => {
            this.handleServiceWorkerMessage(event);
        });

        // Écouter les erreurs de réseau pour la synchronisation
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason?.name === 'NetworkError') {
                this.handleNetworkError(event.reason);
            }
        });
    }

    /**
     * Gère les changements de statut de connexion
     */
    private handleOnlineStatusChange(isOnline: boolean): void {
        console.log(isOnline ? '🌐 Connexion rétablie' : '📴 Connexion perdue');

        // Émettre un événement personnalisé
        window.dispatchEvent(new CustomEvent('connectionchange', {
            detail: { isOnline }
        }));

        // Afficher une notification
        if (isOnline) {
            this.showToast('Connexion rétablie', 'success');
            // Déclencher la synchronisation en arrière-plan
            this.triggerBackgroundSync();
        } else {
            this.showToast('Mode hors ligne activé', 'info');
        }
    }

    /**
     * Gère les messages du service worker
     */
    private handleServiceWorkerMessage(event: MessageEvent): void {
        const { data } = event;

        switch (data.type) {
            case 'CACHE_UPDATED':
                console.log('💾 Cache mis à jour:', data.cacheName);
                break;

            case 'OFFLINE_READY':
                console.log('📴 Mode hors ligne prêt');
                this.showToast('Application prête pour le mode hors ligne', 'info');
                break;

            case 'UPDATE_AVAILABLE':
                this.showUpdateAvailable();
                break;

            case 'SYNC_COMPLETED':
                console.log('🔄 Synchronisation terminée:', data.results);
                this.handleSyncCompleted(data.results);
                break;

            case 'CACHE_ERROR':
                console.error('❌ Erreur de cache:', data.error);
                break;
        }
    }

    /**
     * Gère les erreurs réseau
     */
    private handleNetworkError(error: any): void {
        console.log('🌐 Erreur réseau détectée, ajout à la file de synchronisation');
        // Logique pour ajouter les requêtes échouées à la synchronisation
    }

    /**
     * Ajoute une requête à la synchronisation en arrière-plan
     */
    public async addToBackgroundSync(url: string, method: string, body?: any, headers?: Record<string, string>): Promise<void> {
        const syncData: SyncData = {
            id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url,
            method,
            body,
            headers,
            timestamp: Date.now()
        };

        this.pendingSyncs.push(syncData);
        this.savePendingSyncs();

        if (this.isOnline) {
            await this.triggerBackgroundSync();
        }
    }

    /**
     * Déclenche la synchronisation en arrière-plan
     */
    public async triggerBackgroundSync(): Promise<void> {
        if (!this.registration) return;

        try {
            // Utiliser l'API Background Sync si disponible
            if ('sync' in this.registration) {
                await (this.registration as any).sync.register('background-sync');
                console.log('🔄 Synchronisation en arrière-plan déclenchée');
            } else {
                // Fallback : synchronisation immédiate
                await this.performSync();
            }
        } catch (error) {
            console.error('❌ Erreur lors de la synchronisation:', error);
            // Fallback : synchronisation immédiate
            await this.performSync();
        }
    }

    /**
     * Effectue la synchronisation
     */
    private async performSync(): Promise<void> {
        if (this.pendingSyncs.length === 0) return;

        const results = [];
        for (const syncData of this.pendingSyncs) {
            try {
                const response = await fetch(syncData.url, {
                    method: syncData.method,
                    body: syncData.body ? JSON.stringify(syncData.body) : undefined,
                    headers: {
                        'Content-Type': 'application/json',
                        ...syncData.headers
                    }
                });

                if (response.ok) {
                    results.push({ id: syncData.id, success: true });
                } else {
                    results.push({ id: syncData.id, success: false, error: response.statusText });
                }
            } catch (error) {
                results.push({ id: syncData.id, success: false, error: (error as Error).message });
            }
        }

        // Supprimer les synchronisations réussies
        this.pendingSyncs = this.pendingSyncs.filter(sync =>
            !results.some(result => result.id === sync.id && result.success)
        );
        this.savePendingSyncs();

        console.log('🔄 Résultats de synchronisation:', results);
    }

    /**
     * Gère la fin de synchronisation
     */
    private handleSyncCompleted(results: any[]): void {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        if (successful > 0) {
            this.showToast(`${successful} élément(s) synchronisé(s)`, 'success');
        }
        if (failed > 0) {
            this.showToast(`${failed} élément(s) en échec`, 'warning');
        }
    }

    /**
     * Sauvegarde les synchronisations en attente
     */
    private savePendingSyncs(): void {
        localStorage.setItem('pendingSyncs', JSON.stringify(this.pendingSyncs));
    }

    /**
     * Charge les synchronisations en attente
     */
    private loadPendingSyncs(): void {
        const saved = localStorage.getItem('pendingSyncs');
        if (saved) {
            this.pendingSyncs = JSON.parse(saved);
        }
    }

    /**
     * Planifie la vérification des mises à jour
     */
    private scheduleUpdateCheck(): void {
        // Vérifier les mises à jour toutes les heures
        setInterval(() => {
            this.checkForUpdates();
        }, 60 * 60 * 1000);
    }

    /**
     * Vérifie les mises à jour
     */
    public async checkForUpdates(): Promise<void> {
        if (!this.registration) return;

        try {
            await this.registration.update();
            console.log('🔄 Vérification des mises à jour effectuée');
        } catch (error) {
            console.error('❌ Erreur lors de la vérification des mises à jour:', error);
        }
    }

    /**
     * Gère la découverte d'une mise à jour
     */
    private handleUpdateFound(): void {
        if (!this.registration) return;

        const newWorker = this.registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateAvailable();
            }
        });
    }

    /**
     * Affiche une notification de mise à jour disponible
     */
    private showUpdateAvailable(): void {
        // Éviter les doublons
        if (document.querySelector('.update-banner')) return;

        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-content">
                <i class="fas fa-download"></i>
                <span>Une nouvelle version est disponible</span>
                <button onclick="window.swManager.applyUpdate()" class="update-btn">
                    Mettre à jour
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Ajouter les styles si pas déjà présents
        if (!document.querySelector('#update-banner-styles')) {
            const style = document.createElement('style');
            style.id = 'update-banner-styles';
            style.textContent = `
                .update-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
                    color: white;
                    padding: 1rem;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    animation: slideDown 0.3s ease-out;
                }
                
                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                
                .update-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .update-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: 500;
                }
                
                .update-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-1px);
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.5rem;
                    opacity: 0.7;
                    transition: opacity 0.2s ease;
                }
                
                .close-btn:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(updateBanner);

        // Exposer la méthode globalement
        (window as any).swManager = this;
    }

    /**
     * Applique la mise à jour
     */
    public async applyUpdate(): Promise<void> {
        if (!this.registration?.waiting) return;

        // Supprimer la bannière
        const banner = document.querySelector('.update-banner');
        if (banner) {
            banner.remove();
        }

        // Envoyer un message au service worker pour qu'il s'active
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Recharger la page une fois le nouveau service worker activé
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

    /**
     * Envoie un message au service worker
     */
    private async sendMessageToSW(message: any): Promise<any> {
        if (!this.registration) return;

        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
            };

            this.registration!.active?.postMessage(message, [messageChannel.port2]);
        });
    }

    /**
     * Affiche un toast (doit être implémenté selon votre système de notifications)
     */
    private showToast(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        // Émettre un événement pour le système de toast existant
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message, type }
        }));
    }

    /**
     * Nettoie tous les caches
     */
    public async clearAllCaches(): Promise<void> {
        const message = { type: 'CLEAR_ALL_CACHES' };
        await this.sendMessageToSW(message);
        console.log('🗑️ Tous les caches supprimés');
    }

    /**
     * Obtient les statistiques du cache
     */
    public async getCacheStats(): Promise<any> {
        const message = { type: 'GET_CACHE_STATS' };
        return await this.sendMessageToSW(message);
    }

    /**
     * Active/désactive le mode hors ligne
     */
    public async toggleOfflineMode(enabled: boolean): Promise<void> {
        const message = { type: 'TOGGLE_OFFLINE_MODE', enabled };
        await this.sendMessageToSW(message);
    }

    /**
     * Obtient le statut du service worker
     */
    public getStatus(): {
        isRegistered: boolean;
        isOnline: boolean;
        pendingSyncs: number;
        hasUpdate: boolean;
    } {
        return {
            isRegistered: !!this.registration,
            isOnline: this.isOnline,
            pendingSyncs: this.pendingSyncs.length,
            hasUpdate: !!this.registration?.waiting
        };
    }
}