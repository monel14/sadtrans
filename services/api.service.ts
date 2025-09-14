/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    User, Partner, OperationType, Transaction, AgentRechargeRequest,
    RechargePaymentMethod, Notification, Card, Order, CommissionConfig, CardType, OrderItem, CommissionProfile, Contract
} from '../models';
import { DataService } from './data.service';
import { supabase } from './supabase.service';

export class ApiService {
    private static instance: ApiService;

    private constructor() { }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    private delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    private async getAuthHeader() {
        const { data: { session } } = await supabase.auth.getSession();
        return { 'Authorization': `Bearer ${session?.access_token}` };
    }

    public async getFeePreview(agentId: string, opTypeId: string, amount: number): Promise<{ totalFee: number; partnerShare: number; ruleSource: string }> {
        const { data, error } = await supabase.functions.invoke('get-fee-preview', {
            body: { agentId, opTypeId, amount },
            headers: await this.getAuthHeader()
        });
        if (error) throw error;
        return data;
    }

    public async getUsers(): Promise<User[]> {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data;
    }

    public async getUserById(id: string): Promise<User | undefined> {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error; // Ignore "exact one row" error for not found
        return data || undefined;
    }

    public async getTransactions(filters: {} = {}): Promise<Transaction[]> {
        const { data, error } = await supabase.from('transactions').select('*');
        if (error) throw error;
        return data;
    }
    
    public async getAllOperationTypes(): Promise<OperationType[]> {
        const { data, error } = await supabase.from('operation_types').select('*');
        if (error) throw error;
        return data;
    }

    public async getOperationTypes(filters: { partnerId: string }): Promise<OperationType[]> {
        return this.getAllOperationTypes(); // RLS will handle filtering on the backend
    }
    
    public async getPartners(): Promise<Partner[]> {
        const { data, error } = await supabase.from('partners').select('*');
        if (error) throw error;
        return data;
    }
    
    public async getPartnerById(id: string): Promise<Partner | undefined> {
        const { data, error } = await supabase.from('partners').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || undefined;
    }
    
    public async getCards(filters: {} = {}): Promise<Card[]> {
        const { data, error } = await supabase.from('cards').select('*');
        if (error) throw error;
        return data;
    }
    
    public async getAgentRechargeRequests(filters: {} = {}): Promise<AgentRechargeRequest[]> {
        const { data, error } = await supabase.from('agent_recharge_requests').select('*');
        if (error) throw error;
        return data;
    }

    public async getRechargePaymentMethods(filters: {} = {}): Promise<RechargePaymentMethod[]> {
         const { data, error } = await supabase.from('recharge_payment_methods').select('*');
        if (error) throw error;
        return data;
    }

    public async assignTask(taskId: string, type: 'transaction', userId: string | null): Promise<boolean> {
        const statut = userId ? 'Assignée' : 'En attente de validation';
        
        const { error } = await supabase
            .from('transactions')
            .update({ assigned_to: userId, statut: statut })
            .eq('id', taskId);

        if (error) {
            console.error('Error assigning task:', error);
            return false;
        }
        DataService.getInstance().invalidateTransactionsCache();
        return true;
    }

    public async updateAgentRechargeRequestStatus(requestId: string, status: 'Approuvée' | 'Rejetée', motif?: string): Promise<boolean> {
        const functionName = status === 'Approuvée' ? 'approve-recharge' : 'reject-recharge';
        const { error } = await supabase.functions.invoke(functionName, {
            body: { requestId, motif },
            headers: await this.getAuthHeader()
        });

        if (error) {
            console.error(`Error calling ${functionName} function:`, error);
            return false;
        }
        const dataService = DataService.getInstance();
        dataService.invalidateAgentRechargeRequestsCache();
        dataService.invalidateUsersCache();
        return true;
    }

    public async getNotifications(userId: string): Promise<Notification[]> {
        // This would be replaced with a real notifications table query
        return []; 
    }

    public async transferRevenueToMainBalance(userId: string): Promise<User | null> {
        const { data, error } = await supabase.functions.invoke('transfer-revenue', {
            body: { userId },
            headers: await this.getAuthHeader()
        });

        if (error) {
            console.error('Error calling transfer-revenue function:', error);
            return null;
        }
        DataService.getInstance().invalidateUsersCache();
        return data.updatedUser;
    }

    public async getCardTypes(): Promise<CardType[]> {
        const { data, error } = await supabase.from('card_types').select('*');
        if (error) throw error;
        return data;
    }

    public async validateTransaction(taskId: string, proofFile: File): Promise<boolean> {
        // 1. Upload file to Supabase Storage
        const fileExt = proofFile.name.split('.').pop();
        const filePath = `proofs/${taskId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('transaction-proofs')
            .upload(filePath, proofFile);
        
        if (uploadError) {
            console.error('Error uploading proof:', uploadError);
            return false;
        }

        // 2. Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('transaction-proofs')
            .getPublicUrl(filePath);
        
        // 3. Update transaction in DB
        const { data: { user } } = await supabase.auth.getUser();
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ statut: 'Validé', preuve_url: publicUrl, validateur_id: user?.id })
            .eq('id', taskId);

        if (updateError) {
            console.error('Error validating transaction:', updateError);
            return false;
        }

        DataService.getInstance().invalidateTransactionsCache();
        return true;
    }

    public async rejectTransaction(taskId: string, reason: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('transactions')
            .update({ statut: 'Rejeté', motif_rejet: reason, validateur_id: user?.id })
            .eq('id', taskId);
        
        if (error) {
            console.error('Error rejecting transaction:', error);
            return false;
        }
        DataService.getInstance().invalidateTransactionsCache();
        return true;
    }

    public async createTransaction(agentId: string, opTypeId: string, data: { [key: string]: any }): Promise<Transaction> {
        const { data: transaction, error } = await supabase.functions.invoke('create-transaction', {
            body: { agentId, opTypeId, formData: data },
            headers: await this.getAuthHeader()
        });

        if (error) throw error;
        
        DataService.getInstance().invalidateTransactionsCache();
        DataService.getInstance().invalidateUsersCache();
        return transaction;
    }

    public async createAgentRechargeRequest(agentId: string, montant: number, paymentMethodId: string, reference?: string): Promise<AgentRechargeRequest> {
        const { data, error } = await supabase
            .from('agent_recharge_requests')
            .insert({ agent_id: agentId, montant, payment_method_id: paymentMethodId, reference, statut: 'En attente Admin' })
            .select()
            .single();

        if (error) throw error;
        DataService.getInstance().invalidateAgentRechargeRequestsCache();
        return data;
    }
    
    public async updateCurrentUserProfile(userData: Partial<User>): Promise<User | null> {
       const { data: { user: authUser } } = await supabase.auth.getUser();
       if (!authUser) return null;
       
       if (userData.password) {
           const { error: passwordError } = await supabase.auth.updateUser({ password: userData.password });
           if (passwordError) throw passwordError;
       }

       const profileData = { ...userData };
       delete profileData.password;
       
       const { data, error } = await supabase.from('users').update(profileData).eq('id', userData.id).select().single();
       if (error) throw error;

       DataService.getInstance().invalidateUsersCache();
       return data;
    }

    public async getOrders(filters: {} = {}): Promise<Order[]> {
        const { data, error } = await supabase.from('orders').select('*');
        if (error) throw error;
        return data;
    }
    
    public async updateRechargePaymentMethod(methodData: RechargePaymentMethod): Promise<RechargePaymentMethod> {
        const { data, error } = await supabase.from('recharge_payment_methods').upsert(methodData).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateRechargePaymentMethodsCache();
        return data;
    }

    public async updateAgent(agentData: Partial<User>): Promise<User> {
       const { data, error } = await supabase.from('users').upsert(agentData).select().single();
       if (error) throw error;
       DataService.getInstance().invalidateUsersCache();
       return data;
   }

    public async adminUpdateUser(userData: Partial<User>): Promise<User> {
        const { data, error } = await supabase.from('users').upsert(userData).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateUsersCache();
        return data;
    }

    public async updatePartnerDetails(partnerData: Partial<Partner>): Promise<Partner> {
       const { data, error } = await supabase.from('partners').update(partnerData).eq('id', partnerData.id).select().single();
       if (error) throw error;
       DataService.getInstance().invalidatePartnersCache();
       return data;
    }
    
    public async getCompanyRevenueStats(): Promise<any> {
        // This complex query should be moved to a database function (RPC) for performance and security.
        // For now, fetching all and processing client-side as a placeholder.
        await this.delay(400);
        const { data: transactions } = await supabase.from('transactions').select('commission_societe, agent_id, op_type_id, date, statut');
        const { data: users } = await supabase.from('users').select('id, partner_id');
        const { data: partners } = await supabase.from('partners').select('id, name');
        const { data: opTypes } = await supabase.from('operation_types').select('id, category');

        const validated = (transactions || []).filter(t => t.statut === 'Validé');
        const totalRevenue = validated.reduce((sum, t) => sum + t.commission_societe, 0);
        
        return { totalRevenue, revenueByPartner: [], revenueByCategory: {}, revenueTrend: {}, latestCommissions: validated.slice(0, 10) };
    }

    public async updateCardType(cardTypeData: CardType): Promise<CardType> {
        const { data, error } = await supabase.from('card_types').upsert(cardTypeData).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateCardTypesCache();
        return data;
    }

    public async createOrder(orderData: { partnerId: string, items: OrderItem[] }): Promise<Order> {
         const { data, error } = await supabase.functions.invoke('create-order', {
            body: orderData,
            headers: await this.getAuthHeader()
        });
        if (error) throw error;

        DataService.getInstance().invalidateOrdersCache();
        return data;
    }
    
    public async updateCommissionProfile(profileData: CommissionProfile): Promise<CommissionProfile> {
        const { data, error } = await supabase.from('commission_profiles').upsert(profileData).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateCommissionProfilesCache();
        return data;
    }

    public async updateOperationType(opData: OperationType): Promise<OperationType> {
        const { data, error } = await supabase.from('operation_types').update(opData).eq('id', opData.id).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateOperationTypesCache();
        return data;
    }
    
    public async getContracts(): Promise<Contract[]> {
        const { data, error } = await supabase.from('contracts').select('*');
        if (error) throw error;
        return data;
    }
    
    public async getCommissionProfiles(): Promise<CommissionProfile[]> {
        const { data, error } = await supabase.from('commission_profiles').select('*');
        if (error) throw error;
        return data;
    }
    
    public async updateContract(contractData: Contract): Promise<Contract> {
        const { data, error } = await supabase.from('contracts').upsert(contractData).select().single();
        if (error) throw error;
        DataService.getInstance().invalidateContractsCache();
        return data;
    }
}
