/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { 
    User, Partner, OperationType, Transaction, AgentRechargeRequest, 
    RechargePaymentMethod, Card, Order, CardType, CommissionProfile, Contract, Agency, Notification, 
    // FIX: Import 'CommissionConfig' to resolve type error.
    CommissionConfig 
} from '../models';
import { supabase } from './supabase.service';
import { DataService } from './data.service';


/**
 * A singleton service that interacts with the Supabase backend.
 * It provides methods to fetch and manipulate data, replacing the previous mock implementation.
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

    // --- Mappers ---
    // These helpers convert between the camelCase JS models and snake_case Supabase table columns.
    
    private mapSupabaseToUser = (item: any): User => item ? ({
        id: item.id, name: item.name, firstName: item.first_name, lastName: item.last_name, email: item.email, role: item.role,
        avatarSeed: item.avatar_seed, status: item.status, partnerId: item.partner_id, agencyId: item.agency_id,
        commissions_mois_estimees: item.commissions_mois_estimees, commissions_dues: item.commissions_dues,
        volume_partner_mois: item.volume_partner_mois, commissions_partner_mois: item.commissions_partner_mois,
        agents_actifs: item.agents_actifs, phone: item.phone, contactPerson: item.contact_person, agencyName: item.agency_name,
        idCardNumber: item.id_card_number, ifu: item.ifu, rccm: item.rccm, address: item.address,
        idCardImageUrl: item.id_card_image_url, agency: item.agency ? this.mapSupabaseToAgency(item.agency) : undefined,
    }) : {} as User;

    private mapUserToSupabase = (user: Partial<User>): any => ({
        id: user.id, name: user.name || `${user.firstName} ${user.lastName}`, first_name: user.firstName, last_name: user.lastName, email: user.email, role: user.role,
        avatar_seed: user.avatarSeed, status: user.status, partner_id: user.partnerId, agency_id: user.agencyId, phone: user.phone,
        agency_name: user.agencyName, contact_person: user.contactPerson, id_card_number: user.idCardNumber, ifu: user.ifu, rccm: user.rccm, address: user.address,
        id_card_image_url: user.idCardImageUrl
    });
    
    private mapSupabaseToAgency = (item: any): Agency => item ? ({
        id: item.id, name: item.name, partnerId: item.partner_id, solde_principal: item.solde_principal, solde_revenus: item.solde_revenus,
        address: item.address, phone: item.phone, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at,
    }) : {} as Agency;

    // --- AUDIT LOGGING ---
    private async getCurrentAppUserId(): Promise<string | null> {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.email) return null;
        const { data, error } = await supabase.from('users').select('id').eq('email', authUser.email).single();
        return error ? null : data.id;
    }

    private async logAction(action: string, details: { entity_type?: string, entity_id?: string, [key: string]: any }) {
        const userId = await this.getCurrentAppUserId();
        const { error } = await supabase.from('audit_logs').insert({
            user_id: userId, action, entity_type: details.entity_type, entity_id: details.entity_id, details
        });
        if (error) console.error("Failed to log action:", error);
    }
    
    // --- DATA FETCHING ---

    public async getUsers(): Promise<User[]> {
        const { data, error } = await supabase.from('users').select('*, agency:agencies(*)');
        if (error) { console.error('Error fetching users:', error); throw error; }
        return (data || []).map(this.mapSupabaseToUser);
    }
    
    public async getUserWithAgency(userId: string): Promise<User | null> {
        const { data, error } = await supabase.from('users').select('*, agency:agencies(*)').eq('id', userId).single();
        if (error) { console.error(`Error fetching user ${userId}:`, error); return null; }
        return this.mapSupabaseToUser(data);
    }

    public async getPartners(): Promise<Partner[]> {
        const { data, error } = await supabase.from('partners').select('*');
        if (error) { console.error('Error fetching partners:', error); throw error; }
        return (data || []).map(item => ({...item, partnerManagerId: item.partner_manager_id, contactPerson: item.contact_person, idCardImageUrl: item.id_card_image_url, agencyName: item.agency_name}));
    }
    
    public async getAllOperationTypes(): Promise<OperationType[]> {
        const { data, error } = await supabase.from('operation_types').select('*');
        if (error) { console.error('Error fetching operation types:', error); throw error; }
        return (data || []).map(item => ({ ...item, impactsBalance: item.impacts_balance, feeApplication: item.fee_application, commissionConfig: item.commission_config }));
    }
    
    public async getTransactions(filters: any = {}): Promise<Transaction[]> {
        let query = supabase.from('transactions').select('*');
        if(filters.agentId) query = query.eq('agent_id', filters.agentId);
        const { data, error } = await query;
        if (error) { console.error('Error fetching transactions:', error); throw error; }
        return (data || []).map(item => ({
            ...item, date: item.created_at, agentId: item.agent_id, opTypeId: item.op_type_id,
            montant_principal: item.montant_principal, montant_total: item.montant_total, preuveUrl: item.preuve_url,
            commission_societe: item.commission_societe, commission_partenaire: item.commission_partenaire,
            validateurId: item.validateur_id, motif_rejet: item.motif_rejet, assignedTo: item.assigned_to
        }));
    }
    
    public async getAgentRechargeRequests(): Promise<AgentRechargeRequest[]> {
        const { data, error } = await supabase.from('agent_recharge_requests').select('*');
        if (error) { console.error('Error fetching recharge requests:', error); throw error; }
        return (data || []).map(item => ({...item, date: item.created_at, agentId: item.agent_id, methodId: item.method_id, processedBy: item.processed_by, processedAt: item.processed_at}));
    }
    
    public async getRechargePaymentMethods(filters: any = {}): Promise<RechargePaymentMethod[]> {
        let query = supabase.from('recharge_payment_methods').select('*');
        if(filters.status) query = query.eq('status', filters.status);
        const { data, error } = await query;
        if (error) { console.error('Error fetching payment methods:', error); throw error; }
        return (data || []).map(item => ({...item, feeType: item.fee_type, feeValue: item.fee_value}));
    }
    
    public async getOrders(): Promise<Order[]> {
        const { data, error } = await supabase.from('orders').select('*');
        if (error) { console.error('Error fetching orders:', error); throw error; }
        return (data || []).map(item => ({...item, partnerId: item.partner_id, deliveredBy: item.delivered_by, totalAmount: item.total_amount, totalCards: item.total_cards}));
    }
    
    public async getCards(): Promise<Card[]> {
        const { data, error } = await supabase.from('cards').select('*');
        if (error) { console.error('Error fetching cards:', error); throw error; }
        return (data || []).map(item => ({...item, cardNumber: item.card_number, fullCardNumber: item.full_card_number, assignedPartnerId: item.assigned_partner_id, activationDate: item.activation_date, clientId: item.client_id, cardTypeId: item.card_type_id}));
    }
    
    public async getCardTypes(): Promise<CardType[]> {
        const { data, error } = await supabase.from('card_types').select('*');
        if (error) { console.error('Error fetching card types:', error); throw error; }
        return data || [];
    }
    
    public async getCommissionProfiles(): Promise<CommissionProfile[]> {
        const { data, error } = await supabase.from('commission_profiles').select('*');
        if (error) { console.error('Error fetching commission profiles:', error); throw error; }
        return (data || []).map(item => ({...item, partageSociete: item.partage_societe}));
    }
    
    public async getContracts(): Promise<Contract[]> {
        const { data, error } = await supabase.from('contracts').select('*');
        if (error) { console.error('Error fetching contracts:', error); throw error; }
        return (data || []).map(item => ({...item, partnerId: item.partner_id, baseCommissionProfileId: item.base_commission_profile_id, startDate: item.start_date, endDate: item.end_date}));
    }
    
    public async getAgencies(): Promise<Agency[]> {
        const { data, error } = await supabase.from('agencies').select('*');
        if (error) { console.error('Error fetching agencies:', error); throw error; }
        return (data || []).map(this.mapSupabaseToAgency);
    }

    public async getNotifications(userId: string): Promise<Notification[]> {
        const { data, error } = await supabase.from('notifications').select('*').or(`user_id.eq.${userId},user_id.eq.all`);
        if (error) { console.error('Error fetching notifications:', error); return []; }
        return (data || []).map((item): Notification => ({
            id: item.id,
            text: item.content || 'Notification sans contenu.',
            time: item.created_at,
            read: item.read || false,
            icon: item.icon || 'fa-bell',
            userId: item.user_id,
            target: item.target,
        }));
    }

    public async getAuditLogs(): Promise<any[]> {
        const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) { console.error('Error fetching audit logs:', error); return []; }
        return data || [];
    }

    // --- DATA MUTATION ---

    public async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<boolean> {
        const { error } = await supabase.from('users').update({ status }).eq('id', userId);
        if (error) { console.error('Error updating user status:', error); return false; }
        await this.logAction('UPDATE_USER_STATUS', { entity_id: userId, status });
        return true;
    }

    public async assignTask(taskId: string, type: string, userId: string | null): Promise<boolean> {
        const { error } = await supabase.from('transactions').update({ assigned_to: userId, statut: userId ? 'Assignée' : 'En attente de validation' }).eq('id', taskId);
        if (error) { console.error('Error assigning task:', error); return false; }
        await this.logAction('ASSIGN_TRANSACTION', { entity_id: taskId, assigned_to: userId });
        return true;
    }

    public async validateTransaction(taskId: string, proofFile: File): Promise<boolean> {
        const filePath = `proofs/${taskId}-${Date.now()}-${proofFile.name}`;
        const { error: uploadError } = await supabase.storage.from('transaction-proofs').upload(filePath, proofFile);
        if (uploadError) { console.error('Error uploading proof:', uploadError); return false; }
        
        const { data: { publicUrl } } = supabase.storage.from('transaction-proofs').getPublicUrl(filePath);
        
        const validateur_id = await this.getCurrentAppUserId();
        const { error: updateError } = await supabase.from('transactions').update({ statut: 'Validé', preuve_url: publicUrl, validateur_id }).eq('id', taskId);
        if (updateError) { console.error('Error validating transaction:', updateError); return false; }
        await this.logAction('VALIDATE_TRANSACTION', { entity_id: taskId });
        return true;
    }

    public async rejectTransaction(taskId: string, reason: string): Promise<boolean> {
        const validateur_id = await this.getCurrentAppUserId();
        const { error } = await supabase.from('transactions').update({ statut: 'Rejeté', motif_rejet: reason, validateur_id }).eq('id', taskId);
        if (error) { console.error('Error rejecting transaction:', error); return false; }
        await this.logAction('REJECT_TRANSACTION', { entity_id: taskId, reason });
        return true;
    }

    public async updateAgentRechargeRequestStatus(requestId: string, status: 'Approuvée' | 'Rejetée', reason?: string): Promise<boolean> {
        const processorId = await this.getCurrentAppUserId();
        const { error } = await supabase.from('agent_recharge_requests').update({ statut: status, notes: reason, processed_by: processorId, processed_at: new Date().toISOString() }).eq('id', requestId);
        if (error) { console.error('Error updating recharge request:', error); return false; }

        if (status === 'Approuvée') {
            await this.logAction('APPROVE_RECHARGE', { entity_id: requestId });
            // This should be a database transaction/function, but for now:
            const { data: req } = await supabase.from('agent_recharge_requests').select('agent_id, montant').eq('id', requestId).single();
            const { data: agent } = await supabase.from('users').select('agency_id').eq('id', req.agent_id).single();
            if (agent.agency_id) {
                const { error: balanceError } = await supabase.rpc('adjust_agency_balance', {
                    p_agency_id: agent.agency_id,
                    p_amount: req.montant,
                    p_adjustment_type: 'credit'
                });
                if(balanceError) { console.error("Balance adjustment failed:", balanceError); return false; }
            }
        } else {
            await this.logAction('REJECT_RECHARGE', { entity_id: requestId, reason });
        }
        return true;
    }
    
    public async getCompanyRevenueStats(): Promise<any> {
        // This is a simplified client-side aggregation. For performance, this should be a DB function (RPC).
        const { data: transactions, error } = await supabase.from('transactions').select('commission_societe, agent_id, op_type_id, date').eq('statut', 'Validé');
        if (error) throw error;

        const dataService = DataService.getInstance();
        const [userMap, partnerMap, opTypeMap] = await Promise.all([dataService.getUserMap(), dataService.getPartnerMap(), dataService.getOpTypeMap()]);
        
        const totalRevenue = transactions.reduce((sum, t) => sum + t.commission_societe, 0);
        
        const revenueByPartner = transactions.reduce((acc, t) => {
            const agent = userMap.get(t.agent_id);
            if (agent?.partnerId) {
                const partner = partnerMap.get(agent.partnerId);
                if (partner) {
                    acc[partner.name] = (acc[partner.name] || 0) + t.commission_societe;
                }
            }
            return acc;
        }, {} as Record<string, number>);

        const revenueByCategory = transactions.reduce((acc, t) => {
            const opType = opTypeMap.get(t.op_type_id);
            if(opType?.category) {
                acc[opType.category] = (acc[opType.category] || 0) + t.commission_societe;
            }
            return acc;
        }, {} as Record<string, number>);
        
        return {
            totalRevenue,
            revenueByPartner: Object.entries(revenueByPartner).map(([name, total]) => ({name, total})).sort((a,b) => Number(b.total) - Number(a.total)),
            revenueByCategory,
            revenueTrend: {}, // Complex to calculate on client, returning empty.
            latestCommissions: [] // This would require another query.
        };
    }

    public async deleteOperationType(opId: string): Promise<boolean> {
        const { error } = await supabase.from('operation_types').delete().eq('id', opId);
        if (error) { console.error('Error deleting operation type:', error); return false; }
        await this.logAction('DELETE_OPERATION_TYPE', { entity_id: opId });
        return true;
    }

    public async updateOperationType(opType: OperationType): Promise<OperationType> {
        const supabaseOpType = { ...opType, impacts_balance: opType.impactsBalance, fee_application: opType.feeApplication, commission_config: opType.commissionConfig };
        const { data, error } = await supabase.from('operation_types').upsert(supabaseOpType).select().single();
        if (error) { console.error('Error updating operation type:', error); throw error; }
        await this.logAction('UPDATE_OPERATION_TYPE', { entity_id: data.id });
        const dataService = DataService.getInstance();
        dataService.invalidateOperationTypesCache();
        const opTypeMap = await dataService.getOpTypeMap();
        return opTypeMap.get(data.id)!;
    }

    public async createTransaction(userId: string, opTypeId: string, data: any): Promise<Transaction> {
        // This is a simplified version. A real implementation should use an Edge Function for security and atomicity.
        const opType = (await DataService.getInstance().getOpTypeMap()).get(opTypeId);
        if (!opType) throw new Error("Operation Type not found");
        const amount = parseFloat(data.montant_principal) || 0;
        const { totalFee, partnerShare } = await this.getFeePreview(userId, opTypeId, amount);
        const companyShare = totalFee - partnerShare;

        const newTx = {
            agent_id: userId, op_type_id: opTypeId, data: data,
            montant_principal: amount, frais: totalFee, montant_total: amount + (opType.feeApplication === 'additive' ? totalFee : 0),
            statut: 'En attente de validation', commission_societe: companyShare, commission_partenaire: partnerShare
        };
        
        const { data: createdTx, error } = await supabase.from('transactions').insert(newTx).select().single();
        if (error) {
            console.error('Error creating transaction:', (error as Error).message || error);
            throw error;
        }
        
        DataService.getInstance().invalidateTransactionsCache();

        // Map the returned snake_case object to the camelCase Transaction model
        return {
            id: createdTx.id,
            date: createdTx.created_at,
            agentId: createdTx.agent_id,
            opTypeId: createdTx.op_type_id,
            data: createdTx.data,
            montant_principal: createdTx.montant_principal,
            frais: createdTx.frais,
            montant_total: createdTx.montant_total,
            statut: createdTx.statut,
            preuveUrl: createdTx.preuve_url,
            commission_societe: createdTx.commission_societe,
            commission_partenaire: createdTx.commission_partenaire,
            validateurId: createdTx.validateur_id,
            motif_rejet: createdTx.motif_rejet,
            assignedTo: createdTx.assigned_to,
        };
    }
    
    public async createAgentRechargeRequest(agentId: string, montant: number, methodId: string, notes: string): Promise<AgentRechargeRequest> {
        const { data, error } = await supabase
            .from('agent_recharge_requests')
            .insert({ 
                agent_id: agentId, 
                montant, 
                method_id: methodId, 
                notes,
                statut: 'En attente'
            })
            .select()
            .single();

        if (error) { 
            console.error('Error creating recharge request:', (error as Error).message || error); 
            throw error; 
        }
        
        DataService.getInstance().invalidateAgentRechargeRequestsCache();
        
        // Map supabase response (snake_case) to our model (camelCase)
        const mappedData = {
            ...data, 
            date: data.created_at, 
            agentId: data.agent_id, 
            methodId: data.method_id, 
            processedBy: data.processed_by, 
            processedAt: data.processed_at
        };
        return mappedData as AgentRechargeRequest;
    }

    public async updateCurrentUserProfile(data: Partial<User>): Promise<User | null> {
        const { password, ...profileData } = data;
    
        if (password) {
            const { error: authError } = await supabase.auth.updateUser({ password });
            if (authError) {
                console.error('Error updating password:', authError);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: `Erreur mot de passe: ${authError.message}`, type: 'error' }
                }));
                return null;
            }
        }
    
        const supabaseUser = this.mapUserToSupabase(profileData);
        delete supabaseUser.role;
        delete supabaseUser.email;
        
        const { data: updatedUserData, error: profileError } = await supabase
            .from('users')
            .update(supabaseUser)
            .eq('id', data.id)
            .select()
            .single();
        
        if (profileError) {
            console.error('Error updating user profile:', profileError);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Erreur profil: ${profileError.message}`, type: 'error' }
            }));
            return null;
        }
    
        await this.logAction('UPDATE_OWN_PROFILE', { entity_id: data.id });
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Profil mis à jour avec succès.', type: 'success' }
        }));
    
        DataService.getInstance().invalidateUsersCache();
        
        return this.mapSupabaseToUser(updatedUserData);
    }
    
    public async transferRevenueToMainBalance(userId: string): Promise<User | null> {
        const user = await DataService.getInstance().getUserById(userId);
        if (!user?.agencyId) {
            console.error('User or agency not found for revenue transfer.');
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Agence non trouvée pour ce partenaire.', type: 'error' }
            }));
            return null;
        }
        
        const agencyId = user.agencyId;

        // --- Client-Side Transfer Logic ---
        // NOTE: This logic should ideally be an atomic transaction in a database function (RPC) or an Edge Function.
        // It is implemented here on the client-side as a workaround for the missing 'transfer_revenue_to_main' RPC.
        
        // 1. Fetch the agency record to get current balances
        const { data: agency, error: fetchError } = await supabase
            .from('agencies')
            .select('solde_principal, solde_revenus')
            .eq('id', agencyId)
            .single();

        if (fetchError || !agency) {
            console.error('Error fetching agency for transfer:', fetchError);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Impossible de récupérer les informations de l'agence.`, type: 'error' }
            }));
            return null;
        }
        
        const amountToTransfer = agency.solde_revenus;

        if (amountToTransfer <= 0) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Aucun revenu à transférer.', type: 'info' }
            }));
            return this.getUserWithAgency(userId);
        }

        // 2. Perform the update
        const { error: updateError } = await supabase
            .from('agencies')
            .update({ 
                solde_principal: agency.solde_principal + amountToTransfer, 
                solde_revenus: 0 
            })
            .eq('id', agencyId);

        if (updateError) {
            console.error('Error in client-side balance transfer:', updateError);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Le transfert a échoué: ${updateError.message}`, type: 'error' }
            }));
            return null;
        }
        // --- End of Client-Side Logic ---
        
        await this.logAction('TRANSFER_REVENUE', { entity_id: user.agencyId, user_id: userId, amount: amountToTransfer });
    
        DataService.getInstance().invalidateUsersCache();
        DataService.getInstance().invalidateAgenciesCache();
        
        const updatedUser = await this.getUserWithAgency(userId);
        
        if (updatedUser) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Revenus transférés avec succès.', type: 'success' }
            }));
            return updatedUser;
        }
        
        return null;
    }

    public async updateOrderStatus(orderId: string, status: 'livré' | 'en attente'): Promise<boolean> {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) { console.error('Error updating order status:', error); return false; }
        await this.logAction('UPDATE_ORDER_STATUS', { entity_id: orderId, status });
        return true;
    }

    public async updateRechargePaymentMethod(method: RechargePaymentMethod): Promise<RechargePaymentMethod> {
        const { data, error } = await supabase.from('recharge_payment_methods').upsert({ ...method, fee_type: method.feeType, fee_value: method.feeValue }).select().single();
        if (error) throw error;
        return data as RechargePaymentMethod;
    }
    
    public async updateCardType(cardType: CardType): Promise<CardType> {
        const { data, error } = await supabase.from('card_types').upsert(cardType).select().single();
        if (error) throw error;
        return data as CardType;
    }

    public async createOrder(orderData: { partnerId: string, items: any[] }): Promise<Order> {
        const orderToInsert = {
            partner_id: orderData.partnerId, items: orderData.items,
            total_amount: orderData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
            total_cards: orderData.items.reduce((sum, item) => sum + item.quantity, 0),
            status: 'en attente'
        };
        const { data, error } = await supabase.from('orders').insert(orderToInsert).select().single();
        if (error) throw error;
        return data as Order;
    }

    public async updateCommissionProfile(profile: CommissionProfile): Promise<CommissionProfile> {
        const { data, error } = await supabase.from('commission_profiles').upsert({ ...profile, partage_societe: profile.partageSociete }).select().single();
        if (error) throw error;
        return data as CommissionProfile;
    }
    
    public async getFeePreview(userId: string, opTypeId: string, amount: number): Promise<{ totalFee: number; partnerShare: number; companyShare: number }> {
        const dataService = DataService.getInstance();
        try {
            const [user, opType, activeContractsMap, commissionProfileMap] = await Promise.all([
                dataService.getUserById(userId),
                dataService.getOpTypeMap().then(m => m.get(opTypeId)),
                dataService.getActiveContractsMap(),
                dataService.getCommissionProfileMap()
            ]);
    
            if (!user || !opType) throw new Error("User or Operation Type not found");
    
            let totalFee = 0;
            let companySharePercent = 40;
    
            let relevantConfig: CommissionConfig | null = null;
            let relevantProfile: CommissionProfile | undefined;
            const contract = user.partnerId ? activeContractsMap.get(user.partnerId) : undefined;
            
            if (contract) {
                const serviceException = contract.exceptions.find(ex => ex.targetType === 'service' && ex.targetId === opType.id);
                if (serviceException) {
                    relevantConfig = serviceException.commissionConfig;
                } else {
                    const categoryException = contract.exceptions.find(ex => ex.targetType === 'category' && ex.targetId === opType.category);
                    if (categoryException) {
                        relevantConfig = categoryException.commissionConfig;
                    }
                }
                if (!relevantConfig && opType.commissionConfig.type !== 'none') {
                     relevantConfig = opType.commissionConfig;
                }
                if (!relevantConfig && contract.baseCommissionProfileId) {
                    relevantProfile = commissionProfileMap.get(contract.baseCommissionProfileId);
                }
            } else if (opType.commissionConfig.type !== 'none') {
                 relevantConfig = opType.commissionConfig;
            }
            
            if (relevantConfig) {
                companySharePercent = relevantConfig.partageSociete ?? companySharePercent;
                switch(relevantConfig.type) {
                    case 'fixed': totalFee = relevantConfig.amount ?? 0; break;
                    case 'percentage': totalFee = amount * (relevantConfig.rate ?? 0) / 100; break;
                    case 'tiers':
                         const tier = relevantConfig.tiers?.find(t => amount >= t.from && amount <= t.to);
                         if (tier) totalFee = tier.type === 'fixed' ? tier.value : amount * tier.value / 100;
                        break;
                }
            } else if (relevantProfile) {
                companySharePercent = relevantProfile.partageSociete;
                const tier = relevantProfile.tiers.find(t => amount >= t.from && amount <= t.to);
                if (tier) totalFee = tier.type === 'fixed' ? tier.value : amount * tier.value / 100;
            }
    
            totalFee = Math.round(totalFee);
            const companyShare = Math.round(totalFee * (companySharePercent / 100));
            const partnerShare = totalFee - companyShare;
    
            return { totalFee, partnerShare, companyShare };
    
        } catch (error) {
            console.error("Error calculating fee preview:", error);
            return { totalFee: 0, partnerShare: 0, companyShare: 0 };
        }
    }

    public async updateContract(contract: Contract): Promise<Contract> {
        const { data, error } = await supabase.from('contracts').upsert({ ...contract, partner_id: contract.partnerId, base_commission_profile_id: contract.baseCommissionProfileId, start_date: contract.startDate, end_date: contract.endDate }).select().single();
        if (error) throw error;
        return data as Contract;
    }

    public async updatePartnerDetails(partnerData: Partial<Partner>): Promise<Partner> {
        const supabasePartner = { ...partnerData, partner_manager_id: partnerData.partnerManagerId, contact_person: partnerData.contactPerson, id_card_image_url: partnerData.idCardImageUrl, agency_name: partnerData.agencyName };
        const { data, error } = await supabase.from('partners').update(supabasePartner).eq('id', partnerData.id).select().single();
        if (error) throw error;
        return data as Partner;
    }
    
    public async adjustAgencyBalance(agencyId: string, type: 'credit' | 'debit', amount: number, reason: string): Promise<boolean> {
        const { error } = await supabase.rpc('adjust_agency_balance', { p_agency_id: agencyId, p_amount: amount, p_adjustment_type: type });
        if (error) { console.error('Error adjusting balance:', error); return false; }
        await this.logAction('ADJUST_AGENCY_BALANCE', { entity_id: agencyId, type, amount, reason });
        return true;
    }
    
    public async adminUpdateUser(userData: Partial<User>): Promise<User> {
        // NOTE: This implementation only handles updating existing users or creating users in the 'users' table.
        // It does NOT create a corresponding Supabase Auth user, so newly created users cannot log in.
        // A full implementation requires Admin privileges and `supabase.auth.admin.createUser`.
        const { password, ...profileData } = userData;
        
        // This simulates a secure password reset flow. The actual implementation requires a backend function.
        if (password && profileData.id) {
            console.log(`Simulating password reset for user ${profileData.id}. In a real app, this would trigger a secure email flow.`);
             document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Lien de réinitialisation envoyé à l'utilisateur ${profileData.email}. (Simulation)`, type: 'info' }
            }));
        }
        
        const supabaseUser = this.mapUserToSupabase(profileData);
        const { data, error } = await supabase.from('users').upsert(supabaseUser).select().single();
        if (error) { console.error('Error in adminUpdateUser:', error); throw error; }
        
        // Log action but don't log the password itself
        await this.logAction(userData.id ? 'UPDATE_USER' : 'CREATE_USER', { entity_id: data.id, password_changed: !!password });
        return this.mapSupabaseToUser(data);
    }
    
    public async requestAgentPasswordReset(agent: User) {
        // This is a simulation as client-side password reset is insecure.
        // In a real app, this would call a backend function that generates a secure token and sends an email.
        console.log(`Simulating password reset email for ${agent.email}`);
        document.body.dispatchEvent(new CustomEvent('showToast', { 
            detail: { 
                message: `Un lien de réinitialisation a été envoyé à ${agent.email}. (Simulation)`, 
                type: 'info' 
            } 
        }));
        return Promise.resolve(true);
    }

    public async updateAgent(agentData: Partial<User>): Promise<User> {
        return this.adminUpdateUser(agentData);
    }
    
    public async deleteCommissionProfile(profileId: string): Promise<boolean> {
        const { error } = await supabase.from('commission_profiles').delete().eq('id', profileId);
        return !error;
    }

    public async deleteContract(contractId: string): Promise<boolean> {
        const { error } = await supabase.from('contracts').delete().eq('id', contractId);
        return !error;
    }

    public async deleteRechargePaymentMethod(methodId: string): Promise<boolean> {
        const { error } = await supabase.from('recharge_payment_methods').delete().eq('id', methodId);
        return !error;
    }

    public async deleteCardType(cardTypeId: string): Promise<boolean> {
        const { error } = await supabase.from('card_types').delete().eq('id', cardTypeId);
        return !error;
    }
}