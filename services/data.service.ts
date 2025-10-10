/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    User, Partner, OperationType, Transaction, AgentRechargeRequest,
    RechargePaymentMethod, Card, Order, CardType, Contract, Agency
} from '../models';
import { ApiService } from './api.service';
import { supabase } from './supabase.service';
import { NotificationService } from './notification.service';

/**
 * A singleton service responsible for fetching, caching, and providing application-wide data.
 * It acts as a single source of truth for views, lazy-loading data from the ApiService
 * on first request and caching it for the session duration.
 */
export class DataService {
    private static instance: DataService;
    private api: ApiService;
    private channels: Map<string, any> = new Map();

    // Private cache properties for data arrays
    private _users: User[] | null = null;
    private _partners: Partner[] | null = null;
    private _operationTypes: OperationType[] | null = null;
    private _transactions: Transaction[] | null = null;
    private _agentRechargeRequests: AgentRechargeRequest[] | null = null;
    private _rechargePaymentMethods: RechargePaymentMethod[] | null = null;
    private _cards: Card[] | null = null;
    private _orders: Order[] | null = null;
    private _cardTypes: CardType[] | null = null;
    // Commission profiles have been removed - commissions are now configured directly in contracts
    private _contracts: Contract[] | null = null;
    private _agencies: Agency[] | null = null;
    // FIX: Add cache property for audit logs.
    private _auditLogs: any[] | null = null;

    // Private cache properties for Maps for efficient lookups
    private _userMap: Map<string, User> | null = null;
    private _partnerMap: Map<string, Partner> | null = null;
    private _opTypeMap: Map<string, OperationType> | null = null;
    private _methodMap: Map<string, RechargePaymentMethod> | null = null;
    private _cardTypeMap: Map<string, CardType> | null = null;
    // Commission profile map has been removed - commissions are now configured directly in contracts
    private _activeContractsMap: Map<string, Contract> | null = null;
    private _agencyMapByPartnerId: Map<string, Agency> | null = null;


    private constructor() {
        this.api = ApiService.getInstance();
        // Subscriptions will be set up after authentication
    }

    /**
     * Initialize the data service and ensure all partners have contracts
     */
    public async initialize(): Promise<void> {
        try {
            const result = await this.api.ensureAllPartnersHaveContracts();
            if (result.created > 0) {
                console.log(`✅ ${result.created} contrat(s) par défaut créé(s) pour les partenaires`);
            }
            if (result.errors > 0) {
                console.warn(`⚠️ ${result.errors} erreur(s) lors de la création de contrats par défaut`);
            }
        } catch (error) {
            console.error('Failed to initialize DataService:', error);
        }
    }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    // --- Realtime Subscriptions ---
    private setupRealtimeSubscriptions() {
        // Subscribe to transactions changes
        const transactionsChannel = supabase
            .channel('transactions-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions'
                },
                (payload: any) => {
                    console.log('Transaction change received:', payload);
                    this.invalidateTransactionsCache();
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('transactionChanged', {
                        detail: { change: payload }
                    }));
                    
                    // Les notifications push sont maintenant gérées par les triggers PostgreSQL
                    // qui fonctionnent même quand l'interface est fermée
                    
                    // Les notifications sont maintenant gérées par le trigger PostgreSQL
                    // Plus besoin de créer des notifications manuellement ici
                    /*
                    // Créer une notification automatiquement quand une transaction est validée
                    if (payload.new.statut === 'Validé') {
                        this.createTransactionNotification(payload.new);
                    }
                    */
                }
            )
            .subscribe();

        this.channels.set('transactions', transactionsChannel);

        // Subscribe to users changes
        const usersChannel = supabase
            .channel('users-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'users'
                },
                (payload) => {
                    console.log('User change received:', payload);
                    this.invalidateUsersCache();
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('userChanged', {
                        detail: { change: payload }
                    }));
                }
            )
            .subscribe();

        this.channels.set('users', usersChannel);

        // Subscribe to partners changes
        const partnersChannel = supabase
            .channel('partners-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'partners'
                },
                (payload) => {
                    console.log('Partner change received:', payload);
                    this.invalidatePartnersCache();
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('partnerChanged', {
                        detail: { change: payload }
                    }));
                }
            )
            .subscribe();

        this.channels.set('partners', partnersChannel);

        // Subscribe to agencies changes (pour les soldes)
        const agenciesChannel = supabase
            .channel('agencies-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'agencies'
                },
                (payload) => {
                    console.log('Agency balance change received:', payload);
                    this.invalidateAgenciesCache();
                    this.invalidateUsersCache(); // Also invalidate users as they are linked to agencies
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('agencyBalanceChanged', {
                        detail: { change: payload }
                    }));
                }
            )
            .subscribe();

        this.channels.set('agencies', agenciesChannel);

        // Subscribe to agent recharge requests changes
        const rechargeRequestsChannel = supabase
            .channel('agent-recharge-requests-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'agent_recharge_requests'
                },
                (payload: any) => {
                    console.log('Agent recharge request change received:', payload);
                    this.invalidateAgentRechargeRequestsCache();
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('agentRechargeRequestChanged', {
                        detail: { change: payload }
                    }));
                    
                    // Les notifications push pour les demandes de recharge sont maintenant 
                    // gérées par les triggers PostgreSQL
                }
            )
            .subscribe();

        this.channels.set('agent-recharge-requests', rechargeRequestsChannel);

        // Subscribe to notifications changes
        const notificationsChannel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    console.log('New notification received:', payload);
                    
                    // Dispatch a custom event for UI updates
                    document.body.dispatchEvent(new CustomEvent('newNotification', {
                        detail: { 
                            notification: {
                                id: payload.new.id,
                                text: payload.new.message || 'Notification sans contenu.',
                                time: payload.new.created_at,
                                read: payload.new.read || false,
                                icon: 'fa-bell',
                                userId: payload.new.user_id
                            }
                        }
                    }));
                    
                    // Suppression de l'événement notificationUpdated pour éviter les doublons
                    // L'événement newNotification suffit à mettre à jour l'interface
                }
            )
            .subscribe();

        this.channels.set('notifications', notificationsChannel);
    }

    public unsubscribeAll() {
        this.channels.forEach((channel, key) => {
            supabase.removeChannel(channel);
            console.log(`Unsubscribed from channel: ${key}`);
        });
        this.channels.clear();
    }

    /**
     * Re-subscribe to all realtime channels (call after authentication)
     */
    public reSubscribe(): void {
        console.log('Re-subscribing to realtime channels after authentication');
        this.unsubscribeAll();
        this.setupRealtimeSubscriptions();
    }


    
    /**
     * Envoie une notification push à tous les administrateurs
     */
    private async sendPushToAdmins(title: string, message: string): Promise<void> {
        try {
            console.log('Envoi de notifications push aux administrateurs:', { title, message });
            
            // Récupérer tous les administrateurs
            const { data: admins, error } = await supabase
                .from('users')
                .select('id')
                .or('role.eq.admin_general,role.eq.sous_admin');
                
            if (error) {
                console.error('Erreur lors de la récupération des administrateurs:', error);
                return;
            }
            
            console.log('Administrateurs trouvés:', admins);
            
            // Envoyer une notification push à chaque administrateur
            if (admins && admins.length > 0) {
                const notificationService = NotificationService.getInstance();
                for (const admin of admins) {
                    console.log('Envoi de notification push à l\'administrateur:', admin.id);
                    const result = await notificationService.sendPushNotification(
                        admin.id,
                        title,
                        message
                    );
                    console.log('Résultat de l\'envoi de notification push:', { adminId: admin.id, success: result });
                }
            } else {
                console.log('Aucun administrateur trouvé');
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi des notifications push aux administrateurs:', error);
        }
    }

    /**
     * Méthode pour forcer une mise à jour des notifications
     */
    public async refreshNotifications(): Promise<void> {
        console.log('Forcing notifications refresh');
        document.body.dispatchEvent(new CustomEvent('notificationUpdated'));
    }

    // --- Invalidation Methods ---
    public invalidateUsersCache() { this._users = null; this._userMap = null; }
    public invalidateTransactionsCache() { this._transactions = null; }
    public invalidatePartnersCache() { this._partners = null; this._partnerMap = null; }
    public invalidateOperationTypesCache() { this._operationTypes = null; this._opTypeMap = null; }
    public invalidateAgentRechargeRequestsCache() { this._agentRechargeRequests = null; }
    public invalidateRechargePaymentMethodsCache() { this._rechargePaymentMethods = null; this._methodMap = null; }
    public invalidateOrdersCache() { this._orders = null; }
    public invalidateCardsCache() { this._cards = null; }
    public invalidateCardTypesCache() { this._cardTypes = null; this._cardTypeMap = null; }
    // Commission profiles cache invalidation removed - commissions are now configured directly in contracts
    public invalidateContractsCache() { this._contracts = null; this._activeContractsMap = null; }
    public invalidateAgenciesCache() { this._agencies = null; this._agencyMapByPartnerId = null; }
    public invalidateAuditLogsCache() { this._auditLogs = null; }


    // --- Getter Methods for Arrays ---

    public async getUsers(): Promise<User[]> {
        if (!this._users) {
            try {
                const users = await this.api.getUsers();
                const agencies = await this.getAgencies();
                const agencyMap = new Map(agencies.map(a => [a.id, a]));
                for (const user of users) {
                    if (user.agencyId) {
                        user.agency = agencyMap.get(user.agencyId);
                    }
                }
                this._users = users;
            } catch (error) {
                console.error('Error loading users in DataService:', error);
                this._users = [];
            }
        }
        return this._users;
    }

    public async getPartners(): Promise<Partner[]> {
        if (!this._partners) {
            this._partners = await this.api.getPartners();
        }
        return this._partners;
    }

    public async getAllOperationTypes(): Promise<OperationType[]> {
        if (!this._operationTypes) {
            console.log('Debug - Loading operation types from API (cache miss)');
            this._operationTypes = await this.api.getAllOperationTypes();
        } else {
            console.log('Debug - Using cached operation types');
        }
        return this._operationTypes;
    }

    public clearOperationTypesCache(): void {
        this._operationTypes = null;
        this._opTypeMap = null;
    }

    public async forceReloadOperationTypes(): Promise<OperationType[]> {
        console.log('Debug - Force reloading operation types');
        this.clearOperationTypesCache();
        return this.getAllOperationTypes();
    }

    // Temporary method to force cache clear on page load
    public debugClearAllCaches(): void {
        console.log('Debug - Clearing all caches');
        this._operationTypes = null;
        this._opTypeMap = null;
        this._transactions = null;
        this._users = null;
        this._partners = null;
        this._partnerMap = null;
        this._userMap = null;
        this._agentRechargeRequests = null;
        this._rechargePaymentMethods = null;
        this._methodMap = null;
        this._cards = null;
        this._orders = null;
        this._cardTypes = null;
        this._cardTypeMap = null;
        // Commission profiles cache removed - commissions are now configured directly in contracts
        this._contracts = null;
        this._activeContractsMap = null;
        this._agencies = null;
        this._agencyMapByPartnerId = null;
        this._auditLogs = null;
    }

    // Method to clear all caches (useful for data refresh)
    public clearAllCaches(): void {
        this.debugClearAllCaches();
    }

    public async getTransactions(filters: { agentId?: string; limit?: number; status?: string } = {}): Promise<Transaction[]> {
        if (!this._transactions) {
            try {
                this._transactions = await this.api.getTransactions();
            } catch (error) {
                console.error('Error loading transactions in DataService:', error);
                this._transactions = [];
            }
        }

        let results = this._transactions;
        if (filters.agentId) {
            results = results.filter(t => t.agentId === filters.agentId);
        }
        if (filters.status === 'pending') {
            results = results.filter(t => t.statut.includes('En attente') || t.statut.includes('Assignée'));
        }
        results = results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (filters.limit) {
            results = results.slice(0, filters.limit);
        }
        return results;
    }

    public async getAgentRechargeRequests(filters: { status?: string } = {}): Promise<AgentRechargeRequest[]> {
        if (!this._agentRechargeRequests) {
            this._agentRechargeRequests = await this.api.getAgentRechargeRequests();
        }
        let results = this._agentRechargeRequests;
        if (filters.status) {
            results = results.filter(r => r.statut === filters.status);
        }
        return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    public async getRechargePaymentMethods(filters: { status?: 'active' | 'inactive' } = {}): Promise<RechargePaymentMethod[]> {
        if (!this._rechargePaymentMethods) {
            this._rechargePaymentMethods = await this.api.getRechargePaymentMethods();
        }
        let results = this._rechargePaymentMethods!;
        if (filters.status) {
            results = results.filter(m => m.status === filters.status);
        }
        return results;
    }

    public async getOrders(filters: { partnerId?: string } = {}): Promise<Order[]> {
        if (!this._orders) {
            this._orders = await this.api.getOrders();
        }
        let results = this._orders;
        if (filters.partnerId) {
            results = results.filter(o => o.partnerId === filters.partnerId);
        }
        return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    public async getCards(filters: { partnerId?: string; status?: string } = {}): Promise<Card[]> {
        if (!this._cards) {
            this._cards = await this.api.getCards();
        }
        let results = this._cards;
        if (filters.partnerId) {
            results = results.filter(c => c.assignedPartnerId === filters.partnerId);
        }
        if (filters.status) {
            results = results.filter(c => c.status === filters.status);
        }
        return results;
    }

    public async getCardTypes(): Promise<CardType[]> {
        if (!this._cardTypes) {
            this._cardTypes = await this.api.getCardTypes();
        }
        return this._cardTypes;
    }

    // Commission profiles getter removed - commissions are now configured directly in contracts

    public async getContracts(): Promise<Contract[]> {
        if (!this._contracts) {
            this._contracts = await this.api.getContracts();
        }
        return this._contracts;
    }

    public async getAgencies(): Promise<Agency[]> {
        if (!this._agencies) {
            this._agencies = await this.api.getAgencies();
        }
        return this._agencies;
    }

    // FIX: Add getAuditLogs method to provide audit log data.
    public async getAuditLogs(): Promise<any[]> {
        if (!this._auditLogs) {
            this._auditLogs = await this.api.getAuditLogs();
        }
        return this._auditLogs;
    }

    public async getCommissionTemplates(): Promise<any[]> {
        const api = ApiService.getInstance();
        return await api.getCommissionTemplates();
    }

    public async getDefaultCommissionConfig(): Promise<any> {
        try {
            const templates = await this.getCommissionTemplates();
            if (templates && templates.length > 0) {
                // Retourner la configuration de commission par défaut du premier template
                return templates[0].default_commission_config || null;
            }
            return null;
        } catch (error) {
            console.error('Error loading default commission config:', error);
            return null;
        }
    }

    public async getDefaultExceptions(): Promise<any[]> {
        try {
            const templates = await this.getCommissionTemplates();
            const exceptions: any[] = [];
            
            templates.forEach((template: any) => {
                if (template.standard_exceptions && Array.isArray(template.standard_exceptions)) {
                    template.standard_exceptions.forEach((exception: any) => {
                        exceptions.push({
                            ...exception,
                            templateId: template.id
                        });
                    });
                }
            });
            
            return exceptions;
        } catch (error) {
            console.error('Error loading default exceptions:', error);
            return [];
        }
    }


    // --- Getter Methods for Maps ---

    public async getUserMap(): Promise<Map<string, User>> {
        if (!this._userMap) {
            const users = await this.getUsers();
            this._userMap = new Map(users.map(u => [u.id, u]));
        }
        return this._userMap;
    }

    public async getPartnerMap(): Promise<Map<string, Partner>> {
        if (!this._partnerMap) {
            const partners = await this.getPartners();
            this._partnerMap = new Map(partners.map(p => [p.id, p]));
        }
        return this._partnerMap;
    }

    public async getOpTypeMap(): Promise<Map<string, OperationType>> {
        if (!this._opTypeMap) {
            const opTypes = await this.getAllOperationTypes();
            this._opTypeMap = new Map(opTypes.map(o => [o.id, o]));
        }
        return this._opTypeMap;
    }

    public async getMethodMap(): Promise<Map<string, RechargePaymentMethod>> {
        if (!this._methodMap) {
            const methods = await this.getRechargePaymentMethods();
            this._methodMap = new Map(methods.map(m => [m.id, m]));
        }
        return this._methodMap;
    }

    public async getCardTypeMap(): Promise<Map<string, CardType>> {
        if (!this._cardTypeMap) {
            const cardTypes = await this.getCardTypes();
            this._cardTypeMap = new Map(cardTypes.map(ct => [ct.id, ct]));
        }
        return this._cardTypeMap;
    }

    // Commission profile map getter removed - commissions are now configured directly in contracts

    public async getActiveContractsMap(): Promise<Map<string, Contract>> {
        if (!this._activeContractsMap) {
            const contracts = await this.getContracts();
            this._activeContractsMap = new Map(contracts.filter(c => c.status === 'active').map(c => [c.partnerId, c]));
        }
        return this._activeContractsMap;
    }

    public async getAgencyMapByPartnerId(): Promise<Map<string, Agency>> {
        if (!this._agencyMapByPartnerId) {
            const agencies = await this.getAgencies();
            this._agencyMapByPartnerId = new Map(
                agencies
                    .filter(a => a.partnerId)
                    .map(a => [a.partnerId!, a])
            );
        }
        return this._agencyMapByPartnerId;
    }

    // --- Getters for single items (for convenience, still use cache) ---
    public async getUserById(id: string): Promise<User | undefined> {
        const userMap = await this.getUserMap();
        return userMap.get(id);
    }

    public async getPartnerById(id: string): Promise<Partner | undefined> {
        const partnerMap = await this.getPartnerMap();
        return partnerMap.get(id);
    }

    public async getAgencyById(id: string): Promise<Agency | undefined> {
        const agencies = await this.getAgencies();
        return agencies.find(agency => agency.id === id);
    }

    public async getActiveContractForPartner(partnerId: string): Promise<Contract | null> {
        return await this.api.getActiveContractForPartner(partnerId);
    }

    /*
    private async createTransactionNotification(transaction: any) {
        try {
            // Notification for the agent
            const agent = await this.getUserById(transaction.agent_id);
            if (agent) {
                const agentMessage = `Votre transaction de ${transaction.montant_principal} FCFA a été validée.`;
                // Vérifier si une notification similaire existe déjà
                const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString(); // 5 minutes
                const { data: existingAgentNotifications, error: checkAgentError } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', transaction.agent_id)
                    .eq('title', 'Transaction validée')
                    .ilike('message', `%${transaction.montant_principal} FCFA%`)
                    .gte('created_at', fiveMinutesAgo);
                
                if (checkAgentError) {
                    console.error('Erreur lors de la vérification des notifications existantes pour l\'agent:', checkAgentError);
                } else if (!existingAgentNotifications || existingAgentNotifications.length === 0) {
                    // Créer la notification seulement si elle n'existe pas
                    const { error: agentError } = await supabase
                        .from('notifications')
                        .insert({
                            user_id: transaction.agent_id,
                            title: 'Transaction validée',
                            message: agentMessage,
                            type: 'success',
                            read: false,
                            created_at: new Date().toISOString()
                        });
                    
                    if (agentError) {
                        console.error('Erreur lors de la création de la notification pour l\'agent:', agentError);
                    } else {
                        console.log('Notification créée pour l\'agent:', transaction.id);
                    }
                } else {
                    console.log('Notification déjà existante pour l\'agent, ignorée:', transaction.id);
                }
            }
    
            // Notification for the validator/admin
            if (transaction.validateur_id) {
                const validator = await this.getUserById(transaction.validateur_id);
                if (validator) {
                    const validatorMessage = `Vous avez validé une transaction de ${transaction.montant_principal} FCFA pour l\'agent ${agent?.name || transaction.agent_id}.`;
                    // Vérifier si une notification similaire existe déjà
                    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString(); // 5 minutes
                    const { data: existingValidatorNotifications, error: checkValidatorError } = await supabase
                        .from('notifications')
                        .select('id')
                        .eq('user_id', transaction.validateur_id)
                        .eq('title', 'Transaction validée')
                        .ilike('message', `%${transaction.montant_principal} FCFA%`)
                        .gte('created_at', fiveMinutesAgo);
                    
                    if (checkValidatorError) {
                        console.error('Erreur lors de la vérification des notifications existantes pour le validateur:', checkValidatorError);
                    } else if (!existingValidatorNotifications || existingValidatorNotifications.length === 0) {
                        // Créer la notification seulement si elle n'existe pas
                        const { error: validatorError } = await supabase
                            .from('notifications')
                            .insert({
                                user_id: transaction.validateur_id,
                                title: 'Transaction validée',
                                message: validatorMessage,
                                type: 'success',
                                read: false,
                                created_at: new Date().toISOString()
                            });
                        
                        if (validatorError) {
                            console.error('Erreur lors de la création de la notification pour le validateur:', validatorError);
                        } else {
                            console.log('Notification créée pour le validateur:', transaction.id);
                        }
                    } else {
                        console.log('Notification déjà existante pour le validateur, ignorée:', transaction.id);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors de la création des notifications de transaction:', error);
        }
    }
    */

    /**
     * Calcule le montant principal d'une transaction basé sur le champ de montant défini
     * dans le type d'opération
     * @param operationTypeId L'ID du type d'opération
     * @param formData Les données du formulaire de transaction
     * @returns Le montant principal calculé
     */
    public async calculateTransactionAmount(operationTypeId: string, formData: any): Promise<number> {
        const operationType = await this.getOperationTypeById(operationTypeId);
        if (!operationType) {
            console.warn(`Type d'opération non trouvé: ${operationTypeId}`);
            return 0;
        }

        // Utiliser les utilitaires pour extraire le montant
        const { extractAmountFromTransactionData } = await import('../utils/operation-type-helpers');
        return extractAmountFromTransactionData(operationType, formData);
    }

    /**
     * Valide qu'un type d'opération a un champ de montant configuré
     * @param operationTypeId L'ID du type d'opération
     * @returns true si un champ de montant est configuré
     */
    public async validateOperationTypeAmountField(operationTypeId: string): Promise<boolean> {
        const operationType = await this.getOperationTypeById(operationTypeId);
        if (!operationType) {
            return false;
        }

        const { hasAmountField } = await import('../utils/operation-type-helpers');
        return hasAmountField(operationType);
    }

    /**
     * Obtient le nom du champ de montant pour un type d'opération
     * @param operationTypeId L'ID du type d'opération
     * @returns Le nom du champ de montant ou null
     */
    public async getAmountFieldName(operationTypeId: string): Promise<string | null> {
        const operationType = await this.getOperationTypeById(operationTypeId);
        if (!operationType) {
            return null;
        }

        const { getAmountFieldName } = await import('../utils/operation-type-helpers');
        return getAmountFieldName(operationType);
    }

}
