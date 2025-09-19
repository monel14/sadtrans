/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    User, Partner, OperationType, Transaction, AgentRechargeRequest,
    RechargePaymentMethod, Card, Order, CardType, CommissionProfile, Contract, Agency
} from '../models';
import { ApiService } from './api.service';

/**
 * A singleton service responsible for fetching, caching, and providing application-wide data.
 * It acts as a single source of truth for views, lazy-loading data from the ApiService
 * on first request and caching it for the session duration.
 */
export class DataService {
    private static instance: DataService;
    private api: ApiService;

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
    private _commissionProfiles: CommissionProfile[] | null = null;
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
    private _commissionProfileMap: Map<string, CommissionProfile> | null = null;
    private _activeContractsMap: Map<string, Contract> | null = null;
    private _agencyMapByPartnerId: Map<string, Agency> | null = null;


    private constructor() {
        this.api = ApiService.getInstance();
    }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
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
    public invalidateCommissionProfilesCache() { this._commissionProfiles = null; this._commissionProfileMap = null; }
    public invalidateContractsCache() { this._contracts = null; this._activeContractsMap = null; }
    public invalidateAgenciesCache() { this._agencies = null; this._agencyMapByPartnerId = null; }


    // --- Getter Methods for Arrays ---

    public async getUsers(): Promise<User[]> {
        if (!this._users) {
            const users = await this.api.getUsers();
            const agencies = await this.getAgencies();
            const agencyMap = new Map(agencies.map(a => [a.id, a]));
            for (const user of users) {
                if (user.agencyId) {
                    user.agency = agencyMap.get(user.agencyId);
                }
            }
            this._users = users;
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
    }

    public async getTransactions(filters: { agentId?: string; limit?: number; status?: string } = {}): Promise<Transaction[]> {
        if (!this._transactions) {
            this._transactions = await this.api.getTransactions();
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

    public async getCommissionProfiles(): Promise<CommissionProfile[]> {
        if (!this._commissionProfiles) {
            this._commissionProfiles = await this.api.getCommissionProfiles();
        }
        return this._commissionProfiles;
    }

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

    public async getCommissionProfileMap(): Promise<Map<string, CommissionProfile>> {
        if (!this._commissionProfileMap) {
            const profiles = await this.getCommissionProfiles();
            this._commissionProfileMap = new Map(profiles.map(p => [p.id, p]));
        }
        return this._commissionProfileMap;
    }

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
}
