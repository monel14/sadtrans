/**
 * Service de surveillance des connexions en temps réel
 * Détecte les problèmes de connexion et tente de les résoudre automatiquement
 */

import { DataService } from './data.service';

export class ConnectionMonitorService {
    private static instance: ConnectionMonitorService;
    private monitoringInterval: number | null = null;
    private lastDataUpdate: number = Date.now();
    private isMonitoring: boolean = false;

    // Seuil de détection de problème (5 minutes sans mise à jour)
    private readonly STALE_DATA_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    public static getInstance(): ConnectionMonitorService {
        if (!ConnectionMonitorService.instance) {
            ConnectionMonitorService.instance = new ConnectionMonitorService();
        }
        return ConnectionMonitorService.instance;
    }

    /**
     * Démarre la surveillance des connexions
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            console.log('📡 Connection monitoring already active');
            return;
        }

        console.log('📡 Starting connection monitoring...');
        this.isMonitoring = true;
        this.lastDataUpdate = Date.now();

        // Écouter les événements de mise à jour des données
        document.body.addEventListener('dataUpdated', this.handleDataUpdate);
        document.body.addEventListener('transactionChanged', this.handleDataUpdate);
        document.body.addEventListener('agentRechargeRequestChanged', this.handleDataUpdate);

        // Vérifier périodiquement l'état des connexions
        this.monitoringInterval = window.setInterval(async () => {
            await this.checkConnectionHealth();
        }, 60000); // Vérifier toutes les minutes

        console.log('📡 Connection monitoring started');
    }

    /**
     * Arrête la surveillance des connexions
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        console.log('📡 Stopping connection monitoring...');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Retirer les écouteurs d'événements
        document.body.removeEventListener('dataUpdated', this.handleDataUpdate);
        document.body.removeEventListener('transactionChanged', this.handleDataUpdate);
        document.body.removeEventListener('agentRechargeRequestChanged', this.handleDataUpdate);

        console.log('📡 Connection monitoring stopped');
    }

    /**
     * Gestionnaire d'événements de mise à jour des données
     */
    private handleDataUpdate = (event: Event) => {
        console.log('📡 Data update detected, resetting timer');
        this.lastDataUpdate = Date.now();
    };

    /**
     * Vérifie l'état de santé des connexions
     */
    private async checkConnectionHealth(): Promise<void> {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastDataUpdate;

        console.log(`📡 Connection health check - Time since last update: ${Math.round(timeSinceLastUpdate / 1000)}s`);

        // Vérifier si les données sont obsolètes
        if (timeSinceLastUpdate > this.STALE_DATA_THRESHOLD) {
            console.warn('⚠️ Stale data detected, attempting to reconnect...');
            this.attemptReconnection();
        }

        // Vérifier l'état de la connexion WebSocket Supabase
        await this.checkSupabaseConnection();

        // Vérifier si l'utilisateur est toujours en ligne
        if (!navigator.onLine) {
            console.warn('⚠️ User is offline');
            return;
        }

        // Test de connectivité simple
        try {
            const response = await fetch(window.location.origin + '/favicon.ico', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            if (!response.ok) {
                console.warn('⚠️ Network connectivity issue detected');
            }
        } catch (error) {
            console.warn('⚠️ Network test failed:', error);
        }
    }

    /**
     * Vérifie l'état de la connexion Supabase Realtime
     */
    private async checkSupabaseConnection(): Promise<void> {
        try {
            const { supabase } = await import('./supabase.service');

            // Check if realtime is connected by trying to get channels
            const channels = supabase.realtime.channels;
            console.log(`📡 Supabase Realtime channels: ${channels.length}`);

            // Try to perform a simple database query to test connectivity
            const { error } = await supabase.from('users').select('count').limit(1);

            if (error) {
                console.warn('⚠️ Supabase database connectivity issue:', error.message);
                this.attemptReconnection();
            } else {
                console.log('📡 Supabase connection healthy');
            }

        } catch (error) {
            console.error('Error checking Supabase connection:', error);
            this.attemptReconnection();
        }
    }

    /**
     * Tente de reconnecter les services
     */
    private attemptReconnection(): void {
        console.log('🔄 Attempting to reconnect services...');

        try {
            const dataService = DataService.getInstance();

            // Forcer la reconnexion
            dataService.forceReconnect();

            // Réinitialiser le timer
            this.lastDataUpdate = Date.now();

            // Notifier l'utilisateur
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: 'Reconnexion automatique en cours...',
                    type: 'info'
                }
            }));

            console.log('🔄 Reconnection attempt completed');

        } catch (error) {
            console.error('Error during reconnection attempt:', error);

            // Notifier l'utilisateur de l'erreur
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: 'Problème de connexion détecté. Veuillez rafraîchir la page.',
                    type: 'warning'
                }
            }));
        }
    }

    /**
     * Force une vérification immédiate de la santé des connexions
     */
    public async forceHealthCheck(): Promise<void> {
        console.log('📡 Forcing connection health check...');
        await this.checkConnectionHealth();
    }

    /**
     * Marque manuellement qu'une mise à jour des données a eu lieu
     */
    public markDataUpdate(): void {
        this.lastDataUpdate = Date.now();
    }
}