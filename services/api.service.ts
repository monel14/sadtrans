/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { 
    User, Partner, OperationType, Transaction, AgentRechargeRequest, 
    RechargePaymentMethod, Card, Order, CardType, CommissionProfile, Contract, Agency, Notification 
} from '../models';

// --- MOCK DATA ---
// Data moved from the missing 'mock-data.ts' file to make this service self-contained.

let mockAgencies: Agency[] = [
    { id: 'agency_rotary', name: 'Agence Rotary', partnerId: 'partner_rotary', solde_principal: 84638, solde_revenus: 12500, status: 'active', createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z' },
    { id: 'agency_yombo', name: 'Agence Yombo', partnerId: 'partner_yombo', solde_principal: 150000, solde_revenus: 25000, status: 'active', createdAt: '2023-01-02T11:00:00Z', updatedAt: '2023-01-02T11:00:00Z' },
];

let mockUsers: User[] = [
    // Admins
    { id: 'usr_admin', name: 'Adam Admin', firstName: 'Adam', lastName: 'Admin', email: 'admin.adam@example.com', role: 'admin_general', avatarSeed: 'adam', status: 'active' },
    { id: 'usr_subadmin', name: 'Sam SubAdmin', firstName: 'Sam', lastName: 'SubAdmin', email: 'subadmin.sam@example.com', role: 'sous_admin', avatarSeed: 'sam', status: 'active' },
    { id: 'usr_dev', name: 'Dev D.', firstName: 'Dev', lastName: 'D.', email: 'dev@example.com', role: 'developer', avatarSeed: 'dev', status: 'active' },

    // Partners
    { id: 'usr_partner_rotary', name: 'Jean Dupont', firstName: 'Jean', lastName: 'Dupont', email: 'partner.patrice@example.com', role: 'partner', avatarSeed: 'patrice', status: 'active', partnerId: 'partner_rotary', agencyId: 'agency_rotary', agencyName: 'Rotary', contactPerson: { name: 'Jean Dupont', phone: '+221771234567' } },
    { id: 'usr_partner_yombo', name: 'Awa Gueye', firstName: 'Awa', lastName: 'Gueye', email: 'partner.awa@example.com', role: 'partner', avatarSeed: 'awa', status: 'active', partnerId: 'partner_yombo', agencyId: 'agency_yombo', agencyName: 'Yombo Finance', contactPerson: { name: 'Awa Gueye', phone: '+221777654321' } },

    // Agents
    { id: 'usr_agent_alice', name: 'Alice Agent', firstName: 'Alice', lastName: 'Agent', email: 'agent.alice@example.com', role: 'agent', avatarSeed: 'alice', status: 'active', partnerId: 'partner_rotary', agencyId: 'agency_rotary', phone: '+221772345678' },
    { id: 'usr_agent_bob', name: 'Bob Fall', firstName: 'Bob', lastName: 'Fall', email: 'agent.bob@example.com', role: 'agent', avatarSeed: 'bob', status: 'suspended', partnerId: 'partner_rotary', agencyId: 'agency_rotary', phone: '+221773456789' },
    { id: 'usr_agent_carla', name: 'Carla Ndiaye', firstName: 'Carla', lastName: 'Ndiaye', email: 'agent.carla@example.com', role: 'agent', avatarSeed: 'carla', status: 'active', partnerId: 'partner_yombo', agencyId: 'agency_yombo', phone: '+221774567890' },
];

let mockPartners: Partner[] = [
    { id: 'partner_rotary', name: 'Rotary', partnerManagerId: 'usr_partner_rotary', agencyName: 'Rotary Finance', contactPerson: { name: 'Jean Dupont', phone: '+221771234567' }, idCardImageUrl: 'https://placehold.co/600x400/cccccc/969696?text=ID+Card', ifu: '123456789', rccm: 'SN.DKR.2023.A.123', address: '123 Rue de Dakar' },
    { id: 'partner_yombo', name: 'Yombo', partnerManagerId: 'usr_partner_yombo', agencyName: 'Yombo Finance', contactPerson: { name: 'Awa Gueye', phone: '+221777654321' }, idCardImageUrl: null, ifu: '987654321', rccm: 'SN.DKR.2023.B.456', address: '456 Avenue de Thies' },
];

let mockCommissionProfiles: CommissionProfile[] = [
    {
        id: 'cp_default', name: 'Grille par Défaut', partageSociete: 40,
        tiers: [
            { from: 1000, to: 5000, type: 'fixed', value: 300 },
            { from: 5001, to: 100000, type: 'fixed', value: 500 },
            { from: 100001, to: 999999999, type: 'percentage', value: 1 },
        ]
    },
];

let mockContracts: Contract[] = [
    { id: 'ctr_rotary_2023', name: 'Contrat Standard Rotary 2023', partnerId: 'partner_rotary', baseCommissionProfileId: 'cp_default', status: 'active', startDate: '2023-01-01T00:00:00Z', endDate: null, exceptions: [] },
    { id: 'ctr_yombo_2023', name: 'Contrat Standard Yombo 2023', partnerId: 'partner_yombo', baseCommissionProfileId: 'cp_default', status: 'active', startDate: '2023-01-01T00:00:00Z', endDate: null, exceptions: [] },
];

let mockOperationTypes: OperationType[] = [
    { id: 'op_reabo_canal', name: 'Réabonnement Canal+', description: 'Renouveler un abonnement existant.', impactsBalance: true, status: 'active', category: 'Gestion des décodeurs (Canal +)', feeApplication: 'inclusive', fields: [], commissionConfig: { type: 'tiers', partageSociete: 40 } },
    { id: 'op_abo_decodeur_canal', name: 'Abonnement CANAL+', description: 'Nouvel abonnement sur décodeur.', impactsBalance: true, status: 'active', category: 'Gestion des décodeurs (Canal +)', feeApplication: 'inclusive', fields: [], commissionConfig: { type: 'tiers', partageSociete: 40 } },
];

let mockTransactions: Transaction[] = [
    { id: 'TRN001', date: '2025-09-18T10:30:00Z', agentId: 'usr_agent_alice', opTypeId: 'op_reabo_canal', data: { num_decodeur_canal: '123456789', formule: 'Evasion+' }, montant_principal: 8000, frais: 500, montant_total: 8500, statut: 'En attente de validation', preuveUrl: null, commission_societe: 200, commission_partenaire: 300, validateurId: null, motif_rejet: null, assignedTo: null },
    { id: 'TRN002', date: '2025-09-18T09:00:00Z', agentId: 'usr_agent_alice', opTypeId: 'op_abo_decodeur_canal', data: { num_decodeur_canal: '987654321', formule: 'Tout Canal' }, montant_principal: 7000, frais: 500, montant_total: 7500, statut: 'Validé', preuveUrl: 'https://placehold.co/600x400/a7f3d0/047857?text=Preuve+TRN002', commission_societe: 200, commission_partenaire: 300, validateurId: 'usr_admin', motif_rejet: null, assignedTo: 'usr_admin' },
];

let mockAgentRechargeRequests: AgentRechargeRequest[] = [
    { id: 'ARR001', date: '2023-09-17T14:00:00Z', agentId: 'usr_agent_alice', montant: 50000, methodId: 'rpm_wave', statut: 'Approuvée', notes: 'TXN12345' },
    { id: 'ARR002', date: '2023-09-18T11:00:00Z', agentId: 'usr_agent_bob', montant: 30000, methodId: 'rpm_orange_money', statut: 'En attente', notes: 'OM-98765' },
];

let mockRechargePaymentMethods: RechargePaymentMethod[] = [
    { id: 'rpm_wave', name: 'Dépôt Wave', feeType: 'percentage', feeValue: 1, status: 'active' },
    { id: 'rpm_orange_money', name: 'Dépôt Orange Money', feeType: 'fixed', feeValue: 100, status: 'active' },
    { id: 'rpm_cash', name: 'Dépôt Espèces Agence', feeType: 'none', feeValue: 0, status: 'active' },
];

let mockCardTypes: CardType[] = [ { id: 'ct_visa_classic', name: 'VISA Classic', status: 'active' } ];
let mockCards: Card[] = [];
let mockOrders: Order[] = [];
let mockNotifications: Notification[] = [];
// FIX: Add mock data for audit logs.
let mockAuditLogs: any[] = [
    { id: 'log1', user_id: 'usr_admin', action: 'VALIDATE_TRANSACTION', entity_id: 'TRN002', created_at: '2025-09-18T09:00:10Z', details: { validatorId: 'usr_admin' } },
    { id: 'log2', user_id: 'usr_subadmin', action: 'ASSIGN_TRANSACTION', entity_id: 'TRN001', created_at: '2025-09-18T10:30:05Z', details: { assignedTo: 'usr_subadmin' } },
    { id: 'log3', user_id: 'usr_admin', action: 'CREATE_USER', entity_id: 'usr_agent_carla', created_at: '2025-09-17T11:00:00Z', details: { role: 'agent' } },
    { id: 'log4', user_id: 'usr_partner_rotary', action: 'UPDATE_USER', entity_id: 'usr_agent_bob', created_at: '2025-09-16T15:20:00Z', details: { status: 'suspended' } },
    { id: 'log5', user_id: 'usr_admin', action: 'APPROVE_RECHARGE', entity_id: 'ARR001', created_at: '2023-09-17T14:05:00Z', details: {} },
    { id: 'log6', user_id: 'usr_dev', action: 'UPDATE_OPERATION_TYPE', entity_id: 'op_reabo_canal', created_at: '2023-09-15T10:00:00Z', details: { changed: ['description'] } },
    { id: 'log7', user_id: 'usr_agent_alice', action: 'LOGIN_SUCCESS', entity_id: null, created_at: '2025-09-18T10:25:00Z', details: { ip: '127.0.0.1' } },
].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


/**
 * A singleton service that simulates a backend API.
 * It provides methods to fetch and manipulate data, returning mock data for demonstration purposes.
 * In a real application, this service would make HTTP requests to a backend server (e.g., using fetch or a library like Axios).
 */
export class ApiService {
    private static instance: ApiService;

    private constructor() {}

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    private async simulateDelay<T>(data: T): Promise<T> {
        return new Promise(resolve => setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), 150));
    }

    // --- DATA FETCHING ---

    public async getUsers(): Promise<User[]> {
        return this.simulateDelay(mockUsers);
    }
    
    public async getUserWithAgency(userId: string): Promise<User | null> {
        const user = mockUsers.find(u => u.id === userId);
        if (user && user.agencyId) {
            const agency = mockAgencies.find(a => a.id === user.agencyId);
            (user as any).agency = agency;
        }
        return this.simulateDelay(user || null);
    }

    public async getPartners(): Promise<Partner[]> {
        return this.simulateDelay(mockPartners);
    }
    
    public async getAllOperationTypes(): Promise<OperationType[]> {
        return this.simulateDelay(mockOperationTypes);
    }
    
    public async getTransactions(filters: any = {}): Promise<Transaction[]> {
        return this.simulateDelay(mockTransactions);
    }
    
    public async getAgentRechargeRequests(): Promise<AgentRechargeRequest[]> {
        return this.simulateDelay(mockAgentRechargeRequests);
    }
    
    public async getRechargePaymentMethods(filters: any = {}): Promise<RechargePaymentMethod[]> {
         const allMethods = await this.simulateDelay(mockRechargePaymentMethods);
        if (filters.status) {
            return allMethods.filter(m => m.status === filters.status);
        }
        return allMethods;
    }
    
    public async getOrders(): Promise<Order[]> {
        return this.simulateDelay(mockOrders);
    }
    
    public async getCards(): Promise<Card[]> {
        return this.simulateDelay(mockCards);
    }
    
    public async getCardTypes(): Promise<CardType[]> {
        return this.simulateDelay(mockCardTypes);
    }
    
    public async getCommissionProfiles(): Promise<CommissionProfile[]> {
        return this.simulateDelay(mockCommissionProfiles);
    }
    
    public async getContracts(): Promise<Contract[]> {
        return this.simulateDelay(mockContracts);
    }
    
    public async getAgencies(): Promise<Agency[]> {
        return this.simulateDelay(mockAgencies);
    }

    public async getNotifications(userId: string): Promise<Notification[]> {
        return this.simulateDelay(mockNotifications.filter(n => n.userId === userId || n.userId === 'all'));
    }

    // FIX: Add getAuditLogs method to provide audit log data.
    public async getAuditLogs(): Promise<any[]> {
        return this.simulateDelay(mockAuditLogs);
    }

    // --- DATA MUTATION ---

    public async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<boolean> {
        console.log(`API: Setting status for user ${userId} to ${status}`);
        const user = mockUsers.find(u => u.id === userId);
        if (user) {
            user.status = status;
        }
        return this.simulateDelay(true);
    }

    public async assignTask(taskId: string, type: string, userId: string | null): Promise<boolean> {
        console.log(`API: Assigning ${type} task ${taskId} to user ${userId}`);
        const transaction = mockTransactions.find(t => t.id === taskId);
        if (transaction) {
            transaction.assignedTo = userId;
            transaction.statut = userId ? `Assignée` : 'En attente de validation';
        }
        return this.simulateDelay(true);
    }

    public async validateTransaction(taskId: string, proofFile: File): Promise<boolean> {
        console.log(`API: Validating transaction ${taskId} with file ${proofFile.name}`);
        const transaction = mockTransactions.find(t => t.id === taskId);
        if (transaction) {
            transaction.statut = 'Validé';
            transaction.validateurId = 'usr_admin'; 
            transaction.preuveUrl = URL.createObjectURL(proofFile);
        }
        return this.simulateDelay(true);
    }

    public async rejectTransaction(taskId: string, reason: string): Promise<boolean> {
        console.log(`API: Rejecting transaction ${taskId} for reason: ${reason}`);
        const transaction = mockTransactions.find(t => t.id === taskId);
        if (transaction) {
            transaction.statut = 'Rejeté';
            transaction.validateurId = 'usr_admin';
            transaction.motif_rejet = reason;
        }
        return this.simulateDelay(true);
    }

    public async updateAgentRechargeRequestStatus(requestId: string, status: 'Approuvée' | 'Rejetée', reason?: string): Promise<boolean> {
        console.log(`API: Updating recharge request ${requestId} to ${status}`);
        const request = mockAgentRechargeRequests.find(r => r.id === requestId);
        if (request) {
            request.statut = status;
            if (status === 'Rejetée') {
                request.notes = reason; // Overwrite notes with rejection reason
            }
        }
        return this.simulateDelay(true);
    }
    
    public async getCompanyRevenueStats(): Promise<any> {
        return this.simulateDelay({
            totalRevenue: 1250340,
            revenueByPartner: [{ name: 'Partenaire A', total: 650120 }, { name: 'Partenaire B', total: 450210 }, { name: 'Partenaire C', total: 150010 }],
            revenueByCategory: { 'Cartes VISA': 500000, 'Ecobank Xpress': 400000, 'Canal+': 350340 },
            revenueTrend: { '2023-08-01': 30000, '2023-08-02': 45000, '2023-08-03': 42000 },
            latestCommissions: mockTransactions.slice(0, 5)
        });
    }

    public async deleteOperationType(opId: string): Promise<boolean> {
        console.log(`API: Deleting operation type ${opId}`);
        const index = mockOperationTypes.findIndex(op => op.id === opId);
        if (index > -1) {
            mockOperationTypes.splice(index, 1);
        }
        return this.simulateDelay(true);
    }

    public async updateOperationType(opType: OperationType): Promise<OperationType> {
        if (opType.id) {
            console.log(`API: Updating operation type ${opType.id}`);
            const index = mockOperationTypes.findIndex(op => op.id === opType.id);
            if (index > -1) {
                mockOperationTypes[index] = opType;
                return this.simulateDelay(opType);
            }
        }
        console.log(`API: Creating new operation type`);
        opType.id = `op_${Date.now()}`;
        mockOperationTypes.push(opType);
        return this.simulateDelay(opType);
    }

    public async createTransaction(userId: string, opTypeId: string, data: any): Promise<Transaction> {
        console.log(`API: Creating transaction for user ${userId}`);
        const newTx: Transaction = {
            id: `TRN_${Date.now()}`,
            date: new Date().toISOString(),
            agentId: userId,
            opTypeId: opTypeId,
            data: data,
            montant_principal: parseFloat(data.montant_principal) || 0,
            frais: 500, // mock
            montant_total: (parseFloat(data.montant_principal) || 0) + 500,
            statut: 'En attente de validation',
            preuveUrl: null,
            commission_societe: 100,
            commission_partenaire: 400,
            validateurId: null,
            motif_rejet: null,
            assignedTo: null
        };
        mockTransactions.unshift(newTx);
        return this.simulateDelay(newTx);
    }
    
    public async createAgentRechargeRequest(agentId: string, montant: number, methodId: string, notes: string): Promise<AgentRechargeRequest> {
         const newReq: AgentRechargeRequest = {
            id: `ARR_${Date.now()}`,
            date: new Date().toISOString(),
            agentId: agentId,
            montant: montant,
            methodId: methodId,
            statut: 'En attente',
            notes: notes
        };
        mockAgentRechargeRequests.unshift(newReq);
        return this.simulateDelay(newReq);
    }

    public async updateCurrentUserProfile(data: Partial<User>): Promise<User | null> {
        const user = mockUsers.find(u => u.id === data.id);
        if (user) {
            Object.assign(user, data);
            if(data.firstName && data.lastName) {
                user.name = `${data.firstName} ${data.lastName}`;
            }
        }
        return this.simulateDelay(user || null);
    }

    public async updateOrderStatus(orderId: string, status: 'livré' | 'en attente'): Promise<boolean> {
        const order = mockOrders.find(o => o.id === orderId);
        if(order) order.status = status;
        return this.simulateDelay(true);
    }

    public async updateRechargePaymentMethod(method: RechargePaymentMethod): Promise<RechargePaymentMethod> {
        if(method.id) {
            const index = mockRechargePaymentMethods.findIndex(m => m.id === method.id);
            if (index > -1) mockRechargePaymentMethods[index] = method;
        } else {
            method.id = `rpm_${Date.now()}`;
            mockRechargePaymentMethods.push(method);
        }
        return this.simulateDelay(method);
    }
    
    public async updateCardType(cardType: CardType): Promise<CardType> {
         if(cardType.id) {
            const index = mockCardTypes.findIndex(m => m.id === cardType.id);
            if (index > -1) mockCardTypes[index] = cardType;
        } else {
            cardType.id = `ct_${Date.now()}`;
            mockCardTypes.push(cardType);
        }
        return this.simulateDelay(cardType);
    }

    public async createOrder(orderData: { partnerId: string, items: any[] }): Promise<Order> {
        const newOrder: Order = {
            id: `BC_${Date.now()}`,
            partnerId: orderData.partnerId,
            date: new Date().toISOString(),
            status: 'en attente',
            deliveredBy: 'N/A',
            items: orderData.items,
            totalAmount: orderData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
            totalCards: orderData.items.reduce((sum, item) => sum + item.quantity, 0)
        }
        mockOrders.unshift(newOrder);
        return this.simulateDelay(newOrder);
    }

    public async updateCommissionProfile(profile: CommissionProfile): Promise<CommissionProfile> {
        if(profile.id) {
            const index = mockCommissionProfiles.findIndex(p => p.id === profile.id);
            if (index > -1) mockCommissionProfiles[index] = profile;
        } else {
            profile.id = `cp_${Date.now()}`;
            mockCommissionProfiles.push(profile);
        }
        return this.simulateDelay(profile);
    }
    
    public async getFeePreview(userId: string, opTypeId: string, amount: number): Promise<{ totalFee: number; partnerShare: number; companyShare: number }> {
        return this.simulateDelay({ totalFee: 500, partnerShare: 400, companyShare: 100 });
    }

    public async updateContract(contract: Contract): Promise<Contract> {
        if(contract.id) {
            const index = mockContracts.findIndex(c => c.id === contract.id);
            if (index > -1) mockContracts[index] = contract;
        } else {
            contract.id = `ctr_${Date.now()}`;
            mockContracts.push(contract);
        }
        return this.simulateDelay(contract);
    }

    public async updatePartnerDetails(partnerData: Partial<Partner>): Promise<Partner> {
        const partner = mockPartners.find(p => p.id === partnerData.id);
        if(partner) Object.assign(partner, partnerData);
        return this.simulateDelay(partner!);
    }
    
    public async transferRevenueToMainBalance(userId: string): Promise<User | null> {
        const user = mockUsers.find(u => u.id === userId);
        if(user && user.agencyId) {
            const agency = mockAgencies.find(a => a.id === user.agencyId);
            if (agency) {
                agency.solde_principal += agency.solde_revenus;
                agency.solde_revenus = 0;
            }
        }
        return this.simulateDelay(user || null);
    }

    public async adjustAgencyBalance(agencyId: string, type: 'credit' | 'debit', amount: number, reason: string): Promise<boolean> {
        const agency = mockAgencies.find(a => a.id === agencyId);
        if(agency) {
            if(type === 'credit') agency.solde_principal += amount;
            else agency.solde_principal -= amount;
        }
        console.log(`API: Adjusting balance for agency ${agencyId} by ${type === 'credit' ? '+' : '-'}${amount}. Reason: ${reason}`);
        return this.simulateDelay(true);
    }
    
    public async adminUpdateUser(userData: Partial<User>): Promise<User> {
         if(userData.id) {
            const index = mockUsers.findIndex(u => u.id === userData.id);
            if (index > -1) {
                mockUsers[index] = { ...mockUsers[index], ...userData };
                if (userData.firstName && userData.lastName) {
                    mockUsers[index].name = `${userData.firstName} ${userData.lastName}`;
                }
                return this.simulateDelay(mockUsers[index]);
            }
        }
        const newUser: User = {
            id: `usr_${Date.now()}`,
            name: `${userData.firstName} ${userData.lastName}`,
            firstName: userData.firstName!,
            lastName: userData.lastName!,
            email: userData.email!,
            role: userData.role!,
            avatarSeed: userData.email!,
            status: 'active',
            ...userData
        };
        mockUsers.push(newUser);
        return this.simulateDelay(newUser);
    }

    public async updateAgent(agentData: Partial<User>): Promise<User> {
        // This is essentially the same as adminUpdateUser for mock purposes
        return this.adminUpdateUser(agentData);
    }
    
    public async deleteCommissionProfile(profileId: string): Promise<boolean> {
        console.log(`API: Deleting commission profile ${profileId}`);
        const index = mockCommissionProfiles.findIndex(p => p.id === profileId);
        if (index > -1) {
            mockCommissionProfiles.splice(index, 1);
        }
        return this.simulateDelay(true);
    }

    public async deleteContract(contractId: string): Promise<boolean> {
        console.log(`API: Deleting contract ${contractId}`);
        const index = mockContracts.findIndex(c => c.id === contractId);
        if (index > -1) {
            mockContracts.splice(index, 1);
        }
        return this.simulateDelay(true);
    }

    public async deleteRechargePaymentMethod(methodId: string): Promise<boolean> {
        console.log(`API: Deleting recharge payment method ${methodId}`);
        const index = mockRechargePaymentMethods.findIndex(m => m.id === methodId);
        if (index > -1) {
            mockRechargePaymentMethods.splice(index, 1);
        }
        return this.simulateDelay(true);
    }

    public async deleteCardType(cardTypeId: string): Promise<boolean> {
        console.log(`API: Deleting card type ${cardTypeId}`);
        const index = mockCardTypes.findIndex(ct => ct.id === cardTypeId);
        if (index > -1) {
            mockCardTypes.splice(index, 1);
        }
        return this.simulateDelay(true);
    }
}