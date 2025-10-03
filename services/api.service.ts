/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    User, Partner, OperationType, Transaction, AgentRechargeRequest,
    RechargePaymentMethod, Card, Order, CardType, Contract, Agency, Notification,
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
    private channels: Map<string, any> = new Map();

    private constructor() { }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    // --- Mappers ---
    // These helpers convert between the camelCase JS models and snake_case Supabase table columns.

    private mapSupabaseToUser = (item: any): User => item ? ({
        id: item.id,
        name: item.name,
        firstName: item.first_name,
        lastName: item.last_name,
        email: item.email,
        role: item.role,
        avatarSeed: item.avatar_seed,
        status: item.status,
        partnerId: item.partner_id,
        agencyId: item.agency_id,
        commissions_mois_estimees: item.commissions_mois_estimees,
        commissions_dues: item.commissions_dues,
        volume_partner_mois: item.volume_partner_mois,
        commissions_partner_mois: item.commissions_partner_mois,
        agents_actifs: item.agents_actifs,
        phone: item.phone,
        contactPerson: item.contact_person,
        agencyName: item.agency_name,
        idCardNumber: item.id_card_number,
        ifu: item.ifu,
        rccm: item.rccm,
        address: item.address,
        idCardImageUrl: item.id_card_image_url,
        agency: item.agency ? this.mapSupabaseToAgency(item.agency) : undefined,
    }) : {} as User;

    private mapUserToSupabase = (user: Partial<User>): any => {
        const mapped: any = {};
        
        // Inclure seulement les champs définis pour éviter les valeurs null non désirées
        if (user.id !== undefined) mapped.id = user.id;
        if (user.name !== undefined || (user.firstName && user.lastName)) {
            mapped.name = user.name || `${user.firstName} ${user.lastName}`;
        }
        if (user.firstName !== undefined) mapped.first_name = user.firstName;
        if (user.lastName !== undefined) mapped.last_name = user.lastName;
        if (user.email !== undefined) mapped.email = user.email;
        if (user.role !== undefined) mapped.role = user.role;
        if (user.avatarSeed !== undefined) mapped.avatar_seed = user.avatarSeed;
        if (user.status !== undefined) mapped.status = user.status;
        if (user.partnerId !== undefined) mapped.partner_id = user.partnerId;
        if (user.agencyId !== undefined) mapped.agency_id = user.agencyId;
        if (user.phone !== undefined) mapped.phone = user.phone;
        if (user.agencyName !== undefined) mapped.agency_name = user.agencyName;
        if (user.contactPerson !== undefined) mapped.contact_person = user.contactPerson;
        if (user.idCardNumber !== undefined) mapped.id_card_number = user.idCardNumber;
        if (user.ifu !== undefined) mapped.ifu = user.ifu;
        if (user.rccm !== undefined) mapped.rccm = user.rccm;
        if (user.address !== undefined) mapped.address = user.address;
        if (user.idCardImageUrl !== undefined) mapped.id_card_image_url = user.idCardImageUrl;
        
        return mapped;
    };

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

    // --- REST-LIKE METHODS ---

    public async get(endpoint: string): Promise<{ data: any }> {
        switch (endpoint) {
            case '/commission-templates':
                return { data: await this.getCommissionTemplates() };
            default:
                throw new Error(`GET endpoint not implemented: ${endpoint}`);
        }
    }

    public async post(endpoint: string, data: any): Promise<{ data: any }> {
        switch (endpoint) {
            case '/commission-templates':
                return { data: await this.createCommissionTemplate(data) };
            default:
                throw new Error(`POST endpoint not implemented: ${endpoint}`);
        }
    }

    public async put(endpoint: string, data: any): Promise<{ data: any }> {
        const templateMatch = endpoint.match(/^\/commission-templates\/(.+)$/);
        if (templateMatch) {
            return { data: await this.updateCommissionTemplate(templateMatch[1], data) };
        }
        throw new Error(`PUT endpoint not implemented: ${endpoint}`);
    }

    public async delete(endpoint: string): Promise<{ success: boolean }> {
        const templateMatch = endpoint.match(/^\/commission-templates\/(.+)$/);
        if (templateMatch) {
            return { success: await this.deleteCommissionTemplate(templateMatch[1]) };
        }
        throw new Error(`DELETE endpoint not implemented: ${endpoint}`);
    }

    // --- DATA FETCHING ---

    public async getUsers(): Promise<User[]> {
        const { data, error } = await supabase.from('users').select('*, agency:agencies(*)');
        if (error) { console.error('Error fetching users:', error); throw error; }
        return (data || []).map(this.mapSupabaseToUser);
    }

    public async getUsersPaginated(filters: {
        role?: string,
        partnerId?: string,
        status?: string,
        page?: number,
        limit?: number,
        search?: string
    } = {}): Promise<{ users: User[], totalCount: number }> {
        const { page = 1, limit = 20, role, partnerId, status, search } = filters;
        const offset = (page - 1) * limit;

        try {
            // Utiliser la fonction de pagination côté serveur
            const { data, error } = await supabase.rpc('get_users_paginated', {
                p_limit: limit,
                p_offset: offset,
                p_role: role,
                p_partner_id: partnerId,
                p_status: status,
                p_search: search
            });

            if (error) {
                console.error('Error fetching paginated users:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                return { users: [], totalCount: 0 };
            }

            const totalCount = data[0]?.total_count || 0;
            const users = data.map(item => ({
                id: item.id,
                name: item.name,
                firstName: item.first_name,
                lastName: item.last_name,
                email: item.email,
                role: item.role,
                partnerId: item.partner_id,
                partnerName: item.partner_name,
                agencyId: item.agency_id,
                phone: item.phone,
                status: item.status,
                createdAt: item.created_at,
                avatarSeed: null,
                commissions_mois_estimees: 0,
                commissions_dues: 0,
                volume_partner_mois: 0,
                commissions_partner_mois: 0,
                agents_actifs: 0
            }));

            return {
                users,
                totalCount
            };
        } catch (error) {
            console.error('Exception dans getUsersPaginated:', error);
            return { users: [], totalCount: 0 };
        }
    }

    public async getUserWithAgency(userId: string): Promise<User | null> {
        const { data, error } = await supabase.from('users').select('*, agency:agencies(*)').eq('id', userId).single();
        if (error) { console.error(`Error fetching user ${userId}:`, error); return null; }
        return this.mapSupabaseToUser(data);
    }

    public async getPartners(): Promise<Partner[]> {
        const { data, error } = await supabase.from('partners').select('*');
        if (error) { console.error('Error fetching partners:', error); throw error; }
        return (data || []).map(item => ({ ...item, partnerManagerId: item.partner_manager_id, contactPerson: item.contact_person, idCardImageUrl: item.id_card_image_url, agencyName: item.agency_name }));
    }

    public async getAllOperationTypes(): Promise<OperationType[]> {
        const { data, error } = await supabase.from('operation_types').select('*');
        if (error) { console.error('Error fetching operation types:', error); throw error; }
        return (data || []).map(item => ({ ...item, impactsBalance: item.impacts_balance, feeApplication: item.fee_application, commissionConfig: item.commission_config }));
    }

    public async getAllCardTypes(): Promise<any[]> {
        const { data, error } = await supabase.from('card_types').select('*').eq('status', 'active').order('name');
        if (error) { console.error('Error fetching card types:', error); throw error; }
        return data || [];
    }

    public async getTransactions(filters: any = {}): Promise<Transaction[]> {
        const { data, error } = await supabase.functions.invoke('get-transactions');

        if (error) {
            console.error('Error fetching transactions via Edge Function:', error);
            throw error;
        }

        return (data || []).map(item => ({
            id: item.id,
            date: item.created_at,
            agentId: item.agent_id,
            opTypeId: item.operation_type_id,
            data: item.form_data || {},
            montant_principal: item.montant_principal,
            frais: item.frais || 0,
            montant_total: item.montant_total, // Now provided by the function
            statut: item.statut,
            preuveUrl: item.preuve_url,
            // Note: Le nom du champ de la commission totale peut être 'commission'
            commission_societe: (item.commission || 0) - (item.commission_partenaire || 0),
            commission_partenaire: item.commission_partenaire || 0, // Now provided by the function
            validateurId: item.validateur_id,
            motif_rejet: item.motif_rejet,
            assignedTo: item.assigned_to
        }));
    }

    public async getTransactionsPaginated(filters: {
        agentId?: string,
        partnerId?: string,
        status?: string,
        page?: number,
        limit?: number,
        search?: string,
        userRole?: string,
        userId?: string
    } = {}): Promise<{ transactions: Transaction[], totalCount: number }> {
        const { page = 1, limit = 20, agentId, partnerId, status, search, userRole, userId } = filters;
        const offset = (page - 1) * limit;

        try {
            // Utiliser la fonction de pagination côté serveur
            const { data, error } = await supabase.rpc('get_transactions_paginated', {
                p_limit: limit,
                p_offset: offset,
                p_user_id: userId || agentId,
                p_role: userRole,
                p_partner_id: partnerId,
                p_status: status,
                p_search: search
            });

            if (error) {
                console.error('Error fetching paginated transactions:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                return { transactions: [], totalCount: 0 };
            }

            const totalCount = data[0]?.total_count || 0;
            const transactions = data.map(item => ({
                id: item.id,
                date: item.date,
                agentId: item.agent_id,
                agentName: item.agent_name,
                partnerId: item.partner_id,
                partnerName: item.partner_name,
                opTypeId: item.operation_type_id,
                opTypeName: item.operation_type_name,
                data: item.form_data || {},
                montant_principal: item.montant_principal,
                frais: item.frais || 0,
                montant_total: item.montant_principal + (item.frais || 0),
                statut: item.statut,
                preuveUrl: item.preuve_url,
                commission_societe: item.commission || 0,
                commission_partenaire: item.commission_partenaire || 0,
                validateurId: item.validateur_id,
                motif_rejet: item.motif_rejet,
                assignedTo: item.assigned_to,
                notes: item.notes
            }));

            return {
                transactions,
                totalCount
            };
        } catch (error) {
            console.error('Exception dans getTransactionsPaginated:', error);
            return { transactions: [], totalCount: 0 };
        }
    }

    public async getAgentRechargeRequests(): Promise<AgentRechargeRequest[]> {
        const { data, error } = await supabase.from('agent_recharge_requests').select('*');
        if (error) { console.error('Error fetching recharge requests:', error); throw error; }
        return (data || []).map(item => ({ ...item, date: item.created_at, agentId: item.agent_id, methodId: item.method_id, processedBy: item.processed_by, processedAt: item.processed_at }));
    }

    public async getAgentRechargeRequestsPaginated(filters: {
        agentId?: string,
        partnerId?: string,
        status?: string,
        page?: number,
        limit?: number,
        search?: string,
        userRole?: string,
        userId?: string
    } = {}): Promise<{ requests: AgentRechargeRequest[], totalCount: number }> {
        const { page = 1, limit = 15, agentId, partnerId, status, search, userRole, userId } = filters;
        const offset = (page - 1) * limit;

        try {
            // Utiliser la fonction de pagination côté serveur
            const { data, error } = await supabase.rpc('get_agent_recharge_requests_paginated', {
                p_limit: limit,
                p_offset: offset,
                p_user_id: userId || agentId,
                p_role: userRole,
                p_partner_id: partnerId,
                p_status: status,
                p_search: search
            });

            if (error) {
                console.error('Error fetching paginated recharge requests:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                return { requests: [], totalCount: 0 };
            }

            const totalCount = data[0]?.total_count || 0;
            const requests = data.map(item => ({
                id: item.id,
                agentId: item.agent_id,
                agentName: item.agent_name,
                methodId: item.method_id,
                methodName: item.method_name,
                montant: item.montant,
                statut: item.statut,
                date: item.date,
                notes: item.notes,
                processedBy: item.processed_by,
                processedByName: item.processed_by_name,
                processedAt: item.processed_at
            }));

            return {
                requests,
                totalCount
            };
        } catch (error) {
            console.error('Exception dans getAgentRechargeRequestsPaginated:', error);
            return { requests: [], totalCount: 0 };
        }
    }

    public async getRechargePaymentMethods(filters: any = {}): Promise<RechargePaymentMethod[]> {
        let query = supabase.from('recharge_payment_methods').select('*');
        if (filters.status) query = query.eq('status', filters.status);
        const { data, error } = await query;
        if (error) { console.error('Error fetching payment methods:', error); throw error; }
        return (data || []).map(item => ({
            ...item,
            // Handle both camelCase and snake_case formats in config
            feeType: item.config?.feeType || item.config?.fee_type || 'none',
            feeValue: item.config?.feeValue || item.config?.fee_value || 0
        }));
    }

    public async getOrders(): Promise<Order[]> {
        const { data, error } = await supabase.from('orders').select('*, items:order_items(*)');
        if (error) { console.error('Error fetching orders:', error); throw error; }
        return (data || []).map(item => ({
            id: item.id,
            partnerId: item.partner_id,
            date: item.date || item.created_at,
            status: item.status,
            deliveredBy: '', // Pas de colonne delivered_by dans la DB
            totalAmount: item.total_amount,
            totalCards: item.items ? item.items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0,
            items: item.items ? item.items.map(i => ({
                cardTypeId: i.card_type_id,
                quantity: i.quantity,
                unitPrice: i.unit_price
            })) : []
        }));
    }

    public async getCards(): Promise<Card[]> {
        const { data, error } = await supabase.from('cards').select('*');
        if (error) { console.error('Error fetching cards:', error); throw error; }
        return (data || []).map(item => {
            // Mapper les statuts de la DB vers les statuts du modèle
            let mappedStatus: 'Assigné' | 'En attente d\'activation' | 'Activée' | 'En Stock (Société)' = 'En Stock (Société)';
            switch (item.status) {
                case 'assigned':
                    mappedStatus = 'Assigné';
                    break;
                case 'used':
                    mappedStatus = 'Activée';
                    break;
                case 'available':
                    mappedStatus = 'En Stock (Société)';
                    break;
                case 'blocked':
                    mappedStatus = 'En attente d\'activation';
                    break;
                default:
                    mappedStatus = 'En Stock (Société)';
                    break;
            }

            return {
                cardNumber: item.serial_number || '',
                fullCardNumber: item.serial_number || '',
                status: mappedStatus,
                assignedPartnerId: item.assigned_partner_id,
                activationDate: item.used_at,
                clientId: null,
                cardTypeId: item.card_type_id
            } as Card;
        });
    }

    public async getCardTypes(): Promise<CardType[]> {
        const { data, error } = await supabase.from('card_types').select('*');
        if (error) { console.error('Error fetching card types:', error); throw error; }
        return data || [];
    }

    // Commission profiles method removed - commissions are now configured directly in contracts

    public async getContracts(): Promise<Contract[]> {
        const { data, error } = await supabase.from('contracts').select('*');
        if (error) { console.error('Error fetching contracts:', error); throw error; }
        return (data || []).map(item => ({
            ...item,
            partnerId: item.partner_id,
            defaultCommissionConfig: item.default_commission_config,
            startDate: item.start_date,
            endDate: item.end_date
        }));
    }

    public async getAgencies(): Promise<Agency[]> {
        const { data, error } = await supabase.from('agencies').select('*');
        if (error) { console.error('Error fetching agencies:', error); throw error; }
        return (data || []).map(this.mapSupabaseToAgency);
    }

    public async getNotifications(userId: string, options: { page?: number, limit?: number, readStatus?: boolean } = {}): Promise<{ notifications: Notification[], totalCount: number }> {
        console.log('getNotifications appelé pour userId:', userId, 'options:', options);

        const { page = 1, limit = 20, readStatus } = options;
        const offset = (page - 1) * limit;

        try {
            // Utiliser la fonction de pagination côté serveur
            const { data, error } = await supabase.rpc('get_notifications_paginated', {
                p_limit: limit,
                p_offset: offset,
                p_user_id: userId,
                p_read_status: readStatus
            });

            if (error) {
                console.error('Error fetching notifications:', error);
                return { notifications: [], totalCount: 0 };
            }

            if (!data || data.length === 0) {
                return { notifications: [], totalCount: 0 };
            }

            const totalCount = data[0]?.total_count || 0;
            console.log('Données de notifications récupérées:', data);
            
            const notifications = data.map((item): Notification => ({
                id: item.id,
                text: item.message || 'Notification sans contenu.',
                time: item.date,
                read: item.read || false,
                icon: 'fa-bell',
                userId: item.user_id,
                target: undefined,
            }));

            console.log('Notifications mappées:', notifications);
            return {
                notifications,
                totalCount
            };
        } catch (error) {
            console.error('Exception dans getNotifications:', error);
            return { notifications: [], totalCount: 0 };
        }
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

        // Trigger global event for UI updates
        document.body.dispatchEvent(new CustomEvent('transactionAssigned', {
            detail: { transactionId: taskId, assignedTo: userId }
        }));

        return true;
    }

    public async validateTransaction(taskId: string, proofFile: File | null): Promise<boolean> {
        const dataService = DataService.getInstance();
        const transaction = (await dataService.getTransactions()).find(t => t.id === taskId);
        if (!transaction) throw new Error('Transaction not found');

        const agent = await this.getUserWithAgency(transaction.agentId);
        if (!agent || !agent.agency) throw new Error('Agent or Agency not found for commission credit.');

        // 1. Créditer la commission sur le solde des revenus
        if (transaction.commission_partenaire > 0) {
            const newRevenueBalance = (agent.agency.solde_revenus || 0) + transaction.commission_partenaire;
            const { error: revenueError } = await supabase.from('agencies')
                .update({ solde_revenus: newRevenueBalance })
                .eq('id', agent.agency.id);

            if (revenueError) {
                console.error('CRITICAL: Failed to credit partner commission.', revenueError);
                // On ne bloque pas la validation, mais on logue une erreur critique
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: "Erreur critique: Le crédit de la commission a échoué.", type: 'error' }
                }));
            }
        }

        // 2. Mettre à jour la transaction (statut et preuve)
        let publicUrl: string | null = null;
        if (proofFile) {
            const filePath = `proofs/${taskId}-${Date.now()}-${proofFile.name}`;
            const { error: uploadError } = await supabase.storage.from('transaction-proofs').upload(filePath, proofFile);
            if (uploadError) {
                console.error('Error uploading proof:', uploadError);
                // Ne pas bloquer la validation si la preuve échoue, mais informer
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: "La validation a réussi, mais l'envoi de la preuve a échoué.", type: 'warning' }
                }));
            } else {
                const { data } = supabase.storage.from('transaction-proofs').getPublicUrl(filePath);
                publicUrl = data.publicUrl;
            }
        }

        const validateur_id = await this.getCurrentAppUserId();
        const updateData: any = { statut: 'Validé', validateur_id };
        if (publicUrl) {
            updateData.preuve_url = publicUrl;
        }

        const { error: updateError } = await supabase.from('transactions').update(updateData).eq('id', taskId);
        if (updateError) {
            console.error('Error validating transaction:', updateError);
            return false;
        }

        await this.logAction('VALIDATE_TRANSACTION', { entity_id: taskId, has_proof: !!proofFile });
        await dataService.invalidateTransactionsCache();
        await dataService.invalidateUsersCache();

        document.body.dispatchEvent(new CustomEvent('transactionValidated', { detail: { transactionId: taskId } }));
        return true;
    }

    public async rejectTransaction(taskId: string, reason: string): Promise<boolean> {
        const dataService = DataService.getInstance();
        const transaction = (await dataService.getTransactions()).find(t => t.id === taskId);
        if (!transaction) throw new Error('Transaction not found');

        const [opType, agent] = await Promise.all([
            dataService.getOpTypeMap().then(m => m.get(transaction.opTypeId)),
            this.getUserWithAgency(transaction.agentId)
        ]);

        if (!opType || !agent || !agent.agency) throw new Error('Operation Type, User, or Agency not found for refund.');

        // Rembourser le solde si l'opération avait un impact
        if (opType.impactsBalance) {
            let amountToRefund = 0;
            if (opType.feeApplication === 'inclusive') {
                amountToRefund = transaction.montant_principal;
            } else {
                amountToRefund = transaction.montant_principal + (transaction.frais || 0);
            }

            if (amountToRefund > 0) {
                const newBalance = agent.agency.solde_principal + amountToRefund;
                const { error: balanceError } = await supabase.from('agencies')
                    .update({ solde_principal: newBalance })
                    .eq('id', agent.agency.id);

                if (balanceError) {
                    console.error('CRITICAL: Transaction refund failed.', balanceError);
                    throw new Error('Le remboursement du solde a échoué. Veuillez contacter le support.');
                }
            }
        }

        // Mettre à jour le statut de la transaction
        const validateur_id = await this.getCurrentAppUserId();
        const { error } = await supabase.from('transactions').update({ statut: 'Rejeté', motif_rejet: reason, validateur_id }).eq('id', taskId);
        if (error) { console.error('Error rejecting transaction:', error); return false; }

        await this.logAction('REJECT_TRANSACTION', { entity_id: taskId, reason });
        await dataService.invalidateTransactionsCache();
        await dataService.invalidateUsersCache();

        document.body.dispatchEvent(new CustomEvent('transactionRejected', { detail: { transactionId: taskId, reason } }));
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
                if (balanceError) { console.error("Balance adjustment failed:", balanceError); return false; }
            }

            // Trigger global event for UI updates
            document.body.dispatchEvent(new CustomEvent('rechargeApproved', {
                detail: { requestId, agentId: req.agent_id, amount: req.montant }
            }));
        } else {
            await this.logAction('REJECT_RECHARGE', { entity_id: requestId, reason });

            // Trigger global event for UI updates
            document.body.dispatchEvent(new CustomEvent('rechargeRejected', {
                detail: { requestId, reason }
            }));
        }
        return true;
    }

    public async getCompanyRevenueStats(): Promise<any> {
        // This is a simplified client-side aggregation. For performance, this should be a DB function (RPC).
        const { data: transactions, error } = await supabase.from('transactions').select('commission, agent_id, operation_type_id, date').eq('statut', 'Validé');
        if (error) throw error;

        const dataService = DataService.getInstance();
        const [userMap, partnerMap, opTypeMap] = await Promise.all([dataService.getUserMap(), dataService.getPartnerMap(), dataService.getOpTypeMap()]);

        const totalRevenue = transactions.reduce((sum, t) => sum + (t.commission || 0), 0);

        const revenueByPartner = transactions.reduce((acc, t) => {
            const agent = userMap.get(t.agent_id);
            if (agent?.partnerId) {
                const partner = partnerMap.get(agent.partnerId);
                if (partner) {
                    acc[partner.name] = (acc[partner.name] || 0) + (t.commission || 0);
                }
            }
            return acc;
        }, {} as Record<string, number>);

        const revenueByCategory = transactions.reduce((acc, t) => {
            const opType = opTypeMap.get(t.operation_type_id);
            if (opType?.category) {
                acc[opType.category] = (acc[opType.category] || 0) + (t.commission || 0);
            }
            return acc;
        }, {} as Record<string, number>);

        return {
            totalRevenue,
            revenueByPartner: Object.entries(revenueByPartner).map(([name, total]) => ({ name, total })).sort((a, b) => Number(b.total) - Number(a.total)),
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
        const supabaseOpType = {
            ...opType,
            impacts_balance: opType.impactsBalance,
            fee_application: opType.feeApplication,
            commission_config: opType.commissionConfig
        };

        // Remove camelCase properties that don't exist in database
        delete supabaseOpType.impactsBalance;
        delete supabaseOpType.feeApplication;
        delete supabaseOpType.commissionConfig;

        // If id is empty string, remove it so database can generate a new UUID
        if (supabaseOpType.id === '') {
            delete supabaseOpType.id;
        }

        const { data, error } = await supabase.from('operation_types').upsert(supabaseOpType).select().single();
        if (error) { console.error('Error updating operation type:', error); throw error; }
        await this.logAction('UPDATE_OPERATION_TYPE', { entity_id: data.id });
        const dataService = DataService.getInstance();
        dataService.invalidateOperationTypesCache();
        const opTypeMap = await dataService.getOpTypeMap();
        return opTypeMap.get(data.id)!;
    }

    public async createTransaction(userId: string, opTypeId: string, data: any): Promise<Transaction> {
        const dataService = DataService.getInstance();

        const [opType, user] = await Promise.all([
            dataService.getOpTypeMap().then(m => m.get(opTypeId)),
            this.getUserWithAgency(userId)
        ]);

        if (!opType || !user || !user.agency) throw new Error("Operation Type, User, or Agency not found");

        const amount = parseFloat(data.montant_principal) || 0;
        const { totalFee, partnerShare } = await this.getFeePreview(userId, opTypeId, amount);
        const totalCommission = totalFee; // La commission totale est égale aux frais

        let totalDebit = 0;
        if (opType.impactsBalance) {
            totalDebit = opType.feeApplication === 'inclusive' ? amount : amount + totalFee;
        }

        // 1. Vérifier le solde AVANT toute opération
        if (opType.impactsBalance && user.agency.solde_principal < totalDebit) {
            throw new Error('Solde insuffisant pour effectuer cette opération.');
        }

        // 2. Insérer la transaction
        const { data: createdTx, error: createError } = await supabase.from('transactions').insert({
            agent_id: userId,
            operation_type_id: opTypeId,
            form_data: data,
            montant_principal: amount,
            frais: totalFee,
            commission: totalCommission,
            statut: 'En attente de validation'
        }).select().single();

        if (createError) {
            console.error('Error creating transaction:', createError);
            throw createError;
        }

        // 3. Débiter le solde
        if (opType.impactsBalance && totalDebit > 0) {
            const newBalance = user.agency.solde_principal - totalDebit;
            const { error: balanceError } = await supabase.from('agencies')
                .update({ solde_principal: newBalance })
                .eq('id', user.agency.id);

            if (balanceError) {
                // Si le débit échoue, on tente d'annuler la transaction (rollback)
                console.error('CRITICAL: Balance debit failed. Rolling back transaction...', balanceError);
                await supabase.from('transactions').delete().eq('id', createdTx.id);
                throw new Error('Le débit du solde a échoué. L\'opération a été annulée.');
            }
        }

        await dataService.invalidateTransactionsCache();
        await dataService.invalidateUsersCache(); // Pour rafraîchir le solde de l'utilisateur/agence

        document.body.dispatchEvent(new CustomEvent('transactionCreated', { detail: { transactionId: createdTx.id } }));

        return {
            id: createdTx.id,
            date: createdTx.created_at,
            agentId: createdTx.agent_id,
            opTypeId: createdTx.operation_type_id,
            data: createdTx.form_data || {},
            montant_principal: createdTx.montant_principal,
            frais: createdTx.frais,
            montant_total: createdTx.montant_principal + (createdTx.frais || 0),
            statut: createdTx.statut,
            preuveUrl: createdTx.preuve_url,
            commission_societe: totalCommission - partnerShare,
            commission_partenaire: partnerShare,
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

        // Trigger global event for UI updates
        document.body.dispatchEvent(new CustomEvent('rechargeCreated', {
            detail: { requestId: data.id, agentId, amount: montant }
        }));

        return mappedData as AgentRechargeRequest;
    }

    public async createPartnerRechargeRequest(partnerId: string, montant: number, methodId: string, notes: string): Promise<AgentRechargeRequest> {
        // Pour les partenaires, nous utilisons le même champ agent_id mais ajoutons un préfixe dans les notes
        // pour identifier qu'il s'agit d'une demande de partenaire
        const partnerNotes = `[PARTNER] ${notes}`;

        const { data, error } = await supabase
            .from('agent_recharge_requests')
            .insert({
                agent_id: partnerId,
                montant,
                method_id: methodId,
                notes: partnerNotes,
                statut: 'En attente'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating partner recharge request:', (error as Error).message || error);
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

        // Trigger global event for UI updates
        document.body.dispatchEvent(new CustomEvent('partnerRechargeCreated', {
            detail: { requestId: data.id, partnerId, amount: montant }
        }));

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

    // --- COMMISSION TEMPLATES ---

    public async getCommissionTemplates(): Promise<any[]> {
        const { data, error } = await supabase.from('commission_templates').select('*');
        if (error) { console.error('Error fetching commission templates:', error); throw error; }
        return data || [];
    }

    public async updateCommissionTemplate(templateId: string, updates: any): Promise<any> {
        const { data, error } = await supabase.from('commission_templates').update(updates).eq('id', templateId).select().single();
        if (error) { console.error('Error updating commission template:', error); throw error; }
        return data;
    }

    public async createCommissionTemplate(template: any): Promise<any> {
        const { data, error } = await supabase.from('commission_templates').insert(template).select().single();
        if (error) { console.error('Error creating commission template:', error); throw error; }
        return data;
    }

    public async deleteCommissionTemplate(templateId: string): Promise<boolean> {
        const { error } = await supabase.from('commission_templates').delete().eq('id', templateId);
        if (error) { console.error('Error deleting commission template:', error); return false; }
        return true;
    }

    public async applyCommissionTemplate(contractId: string, templateId: string = 'default'): Promise<boolean> {
        const { error } = await supabase.rpc('apply_commission_template', {
            contract_id: contractId,
            template_id: templateId
        });
        if (error) {
            console.error('Error applying commission template:', error);
            return false;
        }
        await this.logAction('APPLY_COMMISSION_TEMPLATE', {
            entity_id: contractId,
            template_id: templateId
        });
        return true;
    }

    public async updateAllContractsDefaultCommission(newConfig: CommissionConfig): Promise<{ message: string }> {
        console.log('updateAllContractsDefaultCommission called with config:', newConfig);

        // Call the Edge Function to update the default commission template and all contracts
        const { data, error } = await supabase.functions.invoke('update-all-contracts-commission', {
            body: { defaultCommissionConfig: newConfig }
        });

        if (error) {
            console.error('Error calling update-all-contracts-commission Edge function:', error);
            throw error;
        }

        if (data.error) {
            console.error('Error in update-all-contracts-commission Edge function:', data.error);
            throw new Error(data.error);
        }

        console.log('Successfully updated default commission template and all contracts, response data:', data);

        await this.logAction('UPDATE_ALL_CONTRACTS_DEFAULT_COMMISSION', { details: 'Updated default commission for all contracts' });
        DataService.getInstance().invalidateContractsCache();

        return { message: data.message || "Configuration par défaut mise à jour avec succès." };
    }

    public async createContractWithTemplate(name: string, partnerId: string, templateId: string = 'default'): Promise<string | null> {
        const { data, error } = await supabase.rpc('create_contract_with_template', {
            p_name: name,
            p_partner_id: partnerId,
            p_template_id: templateId
        });
        if (error) {
            console.error('Error creating contract with template:', error);
            return null;
        }
        await this.logAction('CREATE_CONTRACT_WITH_TEMPLATE', {
            entity_id: data,
            name,
            partner_id: partnerId,
            template_id: templateId
        });
        return data;
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
        const newPrincipalBalance = agency.solde_principal + amountToTransfer;
        const { error: updateError } = await supabase
            .from('agencies')
            .update({
                solde_principal: newPrincipalBalance,
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

        DataService.getInstance().invalidateAgenciesCache();
        DataService.getInstance().invalidateUsersCache();

        // Dispatch a custom event to notify UI about the balance transfer
        document.body.dispatchEvent(new CustomEvent('balanceTransferCompleted', {
            detail: {
                agencyId: agencyId,
                userId: userId,
                amountTransferred: amountToTransfer,
                newPrincipalBalance: newPrincipalBalance,
                newRevenueBalance: 0
            }
        }));

        // Dispatch the agencyBalanceChanged event to trigger realtime UI updates
        document.body.dispatchEvent(new CustomEvent('agencyBalanceChanged', {
            detail: {
                change: {
                    schema: 'public',
                    table: 'agencies',
                    commit_timestamp: new Date().toISOString(),
                    eventType: 'UPDATE',
                    new: {
                        id: agencyId,
                        solde_principal: newPrincipalBalance,
                        solde_revenus: 0
                    }
                }
            }
        }));

        const updatedUser = await this.getUserWithAgency(userId);

        if (updatedUser) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Revenus transférés avec succès.', type: 'success' }
            }));
            return updatedUser;
        }

        return null;
    }

    public async updateOrderStatus(orderId: string, status: 'delivered' | 'pending'): Promise<boolean> {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) { console.error('Error updating order status:', error); return false; }
        await this.logAction('UPDATE_ORDER_STATUS', { entity_id: orderId, status });
        return true;
    }

    public async updateRechargePaymentMethod(method: RechargePaymentMethod): Promise<RechargePaymentMethod> {
        const supabaseMethod = {
            id: method.id,
            name: method.name,
            status: method.status,
            config: {
                feeType: method.feeType,
                feeValue: method.feeValue
            }
        };

        let data, error;

        if (!method.id || method.id === '') {
            // Create new record
            delete supabaseMethod.id;
            const result = await supabase.from('recharge_payment_methods').insert(supabaseMethod).select().single();
            data = result.data;
            error = result.error;
        } else {
            // Update existing record
            const result = await supabase.from('recharge_payment_methods').update(supabaseMethod).eq('id', method.id).select().single();
            data = result.data;
            error = result.error;
        }

        if (error) throw error;
        return {
            ...data,
            feeType: data.config?.feeType || 'none',
            feeValue: data.config?.feeValue || 0
        } as RechargePaymentMethod;
    }

    public async updateCardType(cardType: CardType): Promise<CardType> {
        const { data, error } = await supabase.from('card_types').upsert(cardType).select().single();
        if (error) throw error;
        return data as CardType;
    }

    public async createOrder(orderData: { partnerId: string, items: any[] }): Promise<Order> {
        const orderToInsert = {
            partner_id: orderData.partnerId,
            total_amount: orderData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
            status: 'pending'
        };
        const { data, error } = await supabase.from('orders').insert(orderToInsert).select().single();
        if (error) throw error;

        // Insérer les items séparément dans order_items
        const orderItems = orderData.items.map(item => ({
            order_id: data.id,
            card_type_id: item.cardTypeId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice
        }));

        await supabase.from('order_items').insert(orderItems);

        return {
            ...data,
            partnerId: data.partner_id,
            deliveredBy: '',
            totalAmount: data.total_amount,
            totalCards: orderData.items.reduce((sum, item) => sum + item.quantity, 0),
            items: orderData.items
        } as Order;
    }

    // Commission profile update method removed - commissions are now configured directly in contracts

    public async getFeePreview(userId: string, opTypeId: string, amount: number): Promise<{ totalFee: number; partnerShare: number; companyShare: number }> {
        const dataService = DataService.getInstance();
        try {
            const [user, opType, activeContractsMap] = await Promise.all([
                dataService.getUserById(userId),
                dataService.getOpTypeMap().then(m => m.get(opTypeId)),
                dataService.getActiveContractsMap()
            ]);

            if (!user || !opType) throw new Error("User or Operation Type not found");

            let totalFee = 0;
            let companySharePercent = 40;

            let relevantConfig: CommissionConfig | null = null;
            const contract = user.partnerId ? activeContractsMap.get(user.partnerId) : undefined;

            if (contract) {
                // 1. Vérifier d'abord les exceptions spécifiques au service
                const serviceException = contract.exceptions.find(ex => ex.targetType === 'service' && ex.targetId === opType.id);
                if (serviceException) {
                    relevantConfig = serviceException.commissionConfig;
                } else {
                    // 2. Vérifier les exceptions par catégorie
                    const categoryException = contract.exceptions.find(ex => ex.targetType === 'category' && ex.targetId === opType.category);
                    if (categoryException) {
                        relevantConfig = categoryException.commissionConfig;
                    } else {
                        // 3. Utiliser la configuration par défaut du contrat (TOUJOURS)
                        relevantConfig = contract.defaultCommissionConfig;
                    }
                }
            } else {
                // Pas de contrat : utiliser la config du service si elle existe
                if (opType.commissionConfig.type !== 'none') {
                    relevantConfig = opType.commissionConfig;
                }
            }

            if (relevantConfig) {
                companySharePercent = relevantConfig.partageSociete ?? companySharePercent;
                switch (relevantConfig.type) {
                    case 'fixed':
                        totalFee = relevantConfig.amount ?? 0;
                        break;
                    case 'percentage':
                        totalFee = amount * (relevantConfig.rate ?? 0) / 100;
                        break;
                    case 'tiers':
                        const tier = relevantConfig.tiers?.find(t => amount >= t.from && amount <= t.to);
                        if (tier) totalFee = tier.type === 'fixed' ? tier.value : amount * tier.value / 100;
                        break;
                }
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
        // Si on active ce contrat, désactiver tous les autres contrats du même partenaire
        if (contract.status === 'active') {
            await this.deactivateOtherContractsForPartner(contract.partnerId, contract.id);
        }

        // Préparer les données du contrat pour l'insertion/upsert
        // Enlever les propriétés qui ne doivent pas être envoyées directement
        const { id, partnerId, defaultCommissionConfig, status, startDate, endDate, exceptions, ...rest } = contract;

        const contractData: any = {
            ...rest, // Inclure les autres propriétés du contrat
            id: id,
            partner_id: partnerId,
            default_commission_config: defaultCommissionConfig,
            status: status,
            exceptions: exceptions
        };

        // Ajouter les dates seulement si elles sont définies
        if (startDate) {
            contractData.start_date = startDate;
        }
        if (endDate !== undefined) {
            contractData.end_date = endDate;
        }

        // S'assurer que les champs requis sont présents
        if (!contractData.name) {
            throw new Error("Le nom du contrat est requis");
        }
        if (!contractData.partner_id) {
            throw new Error("Le partenaire est requis");
        }

        console.log('Sending contract data to Supabase:', contractData);

        const { data, error } = await supabase.from('contracts').upsert(contractData).select().single();

        if (error) {
            console.error('Error updating contract in Supabase:', error);
            throw error;
        }

        // Mapper les données retournées par Supabase vers notre modèle Contract
        return {
            ...data,
            partnerId: data.partner_id,
            defaultCommissionConfig: data.default_commission_config,
            startDate: data.start_date,
            endDate: data.end_date,
            status: data.status,
            exceptions: data.exceptions || []
        } as Contract;
    }

    private async deactivateOtherContractsForPartner(partnerId: string, excludeContractId?: string): Promise<void> {
        let query = supabase
            .from('contracts')
            .update({ status: 'inactive' })
            .eq('partner_id', partnerId)
            .eq('status', 'active');

        if (excludeContractId) {
            query = query.neq('id', excludeContractId);
        }

        const { error } = await query;
        if (error) {
            console.error('Error deactivating other contracts:', error);
            throw error;
        }
    }

    public async createDefaultContractForPartner(partnerId: string, partnerName: string): Promise<boolean> {
        try {
            // D'abord, désactiver tous les contrats existants pour ce partenaire
            await this.deactivateOtherContractsForPartner(partnerId);

            const defaultContract = {
                id: `contract_default_${partnerId}`,
                name: `Contrat par Défaut - ${partnerName}`,
                partner_id: partnerId,
                default_commission_config: {
                    type: 'tiers',
                    partageSociete: 60,
                    tiers: [
                        { from: 1000, to: 5000, type: 'fixed', value: 300 },
                        { from: 5001, to: 100000, type: 'fixed', value: 500 },
                        { from: 100001, to: 999999999, type: 'percentage', value: 1 }
                    ]
                },
                status: 'active',
                start_date: new Date().toISOString(),
                end_date: null,
                exceptions: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('contracts').insert(defaultContract);
            if (error) {
                console.error('Error creating default contract:', error);
                return false;
            }

            await this.logAction('CREATE_CONTRACT', { entity_id: defaultContract.id, partner_id: partnerId });
            return true;
        } catch (error) {
            console.error('Failed to create default contract:', error);
            return false;
        }
    }

    public async ensureAllPartnersHaveContracts(): Promise<{ created: number; errors: number }> {
        try {
            // Récupérer tous les partenaires
            const { data: allPartners, error: partnersError } = await supabase
                .from('partners')
                .select('id, name');

            if (partnersError) {
                console.error('Error fetching partners:', partnersError);
                return { created: 0, errors: 1 };
            }

            // Récupérer tous les contrats actifs
            const { data: activeContracts, error: contractsError } = await supabase
                .from('contracts')
                .select('partner_id')
                .eq('status', 'active');

            if (contractsError) {
                console.error('Error fetching active contracts:', contractsError);
                return { created: 0, errors: 1 };
            }

            // Identifier les partenaires sans contrat actif
            const activePartnerIds = new Set(activeContracts?.map(c => c.partner_id) || []);
            const partnersWithoutContract = allPartners?.filter(p => !activePartnerIds.has(p.id)) || [];

            let created = 0;
            let errors = 0;

            for (const partner of partnersWithoutContract) {
                const success = await this.createDefaultContractForPartner(partner.id, partner.name);
                if (success) {
                    created++;
                } else {
                    errors++;
                }
            }

            return { created, errors };
        } catch (error) {
            console.error('Failed to ensure all partners have contracts:', error);
            return { created: 0, errors: 1 };
        }
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
        const { password, ...profileData } = userData;
        const isNewUser = !userData.id;

        // Pour les nouveaux utilisateurs, utiliser la fonction Edge pour créer l'utilisateur dans l'authentification
        if (isNewUser && password) {
            try {
                // Appeler la fonction Edge pour créer l'utilisateur dans l'authentification et la base de données
                const { data, error } = await supabase.functions.invoke('create-user', {
                    body: {
                        userData: {
                            ...profileData,
                            email: profileData.email,
                            name: profileData.name,
                            role: profileData.role,
                            partnerId: profileData.partnerId,
                            agencyId: profileData.agencyId,
                            status: profileData.status
                        },
                        password: password
                    }
                });

                if (error) {
                    console.error('Error calling create-user Edge function:', error);
                    throw error;
                }

                if (data.error) {
                    console.error('Error in create-user Edge function:', data.error);
                    throw new Error(data.error);
                }

                // Log action
                await this.logAction('CREATE_USER', { entity_id: data.user.id, password_changed: true });

                // Retourner l'utilisateur créé
                return data.user;
            } catch (error) {
                console.error('Error in adminUpdateUser with Edge function:', error);
                throw error;
            }
        }

        // Pour les utilisateurs existants, ne pas gérer les mots de passe ici
        // Les mots de passe sont uniquement gérés lors de la création
        if (password && profileData.id && profileData.email) {
            console.log(`Password update skipped for existing user ${profileData.email} - passwords are managed separately`);
        }

        const supabaseUser = this.mapUserToSupabase(profileData);
        const { data, error } = await supabase.from('users').upsert(supabaseUser).select().single();
        if (error) { console.error('Error in adminUpdateUser:', error); throw error; }

        // Si c'est un nouveau partenaire, créer automatiquement un contrat par défaut
        if (isNewUser && userData.role === 'partner') {
            try {
                const defaultContract = {
                    id: `contract_default_${data.id}`,
                    name: `Contrat par Défaut - ${userData.firstName} ${userData.lastName}`,
                    partner_id: data.id,
                    base_commission_profile_id: 'cp_default', // Utilise le profil par défaut
                    status: 'active',
                    start_date: new Date().toISOString(),
                    end_date: null,
                    exceptions: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { error: contractError } = await supabase.from('contracts').insert(defaultContract);
                if (contractError) {
                    console.error('Error creating default contract for partner:', contractError);
                    // Ne pas bloquer la création du partenaire, mais logger l'erreur
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: 'Partenaire créé, mais erreur lors de la création du contrat par défaut.', type: 'warning' }
                    }));
                } else {
                    console.log(`Contrat par défaut créé pour le partenaire: ${data.id}`);
                }
            } catch (contractError) {
                console.error('Failed to create default contract:', contractError);
            }
        }

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

    public async createAuthForAgent(agentEmail: string, password: string): Promise<boolean> {
        try {
            console.log(`Creating auth account for ${agentEmail}`);
            
            // Utiliser la fonction Edge create-user existante
            const { data: agent, error: agentError } = await supabase
                .from('users')
                .select('*')
                .eq('email', agentEmail)
                .single();

            if (agentError || !agent) {
                console.error('Agent not found:', agentError);
                return false;
            }

            const { data, error } = await supabase.functions.invoke('create-user', {
                body: {
                    userData: {
                        id: agent.id,
                        email: agent.email,
                        name: agent.name,
                        role: agent.role,
                        partnerId: agent.partner_id,
                        agencyId: agent.agency_id,
                        status: agent.status,
                        phone: agent.phone
                    },
                    password: password
                }
            });

            if (error) {
                console.error('Error creating auth account:', error);
                return false;
            }

            if (data.error) {
                console.error('Error in create-user function:', data.error);
                return false;
            }

            console.log('Auth account created successfully');
            await this.logAction('CREATE_AUTH_FOR_AGENT', { email: agentEmail, user_id: agent.id });
            
            return true;
        } catch (error) {
            console.error('Error creating auth for agent:', error);
            return false;
        }
    }

    public async resetAgentPassword(agentEmail: string, newPassword: string): Promise<boolean> {
        try {
            console.log(`Password reset requested for ${agentEmail}`);
            
            // Pour l'instant, on simule le succès et on enregistre la demande
            // En production, cela déclencherait un processus sécurisé de réinitialisation
            
            // D'abord, récupérer l'ID de l'agent depuis la base de données
            const { data: agent, error: agentError } = await supabase
                .from('users')
                .select('id')
                .eq('email', agentEmail)
                .single();

            if (agentError || !agent) {
                console.error('Error finding agent:', agentError);
                return false;
            }
            
            // Enregistrer la demande dans une table de demandes de changement de mot de passe
            const { error } = await supabase.from('password_update_requests').insert({
                user_id: agent.id,
                user_email: agentEmail,
                new_password: newPassword, // En production, ceci devrait être hashé
                status: 'completed', // Marquer comme complété pour la démo
                requested_by: (await supabase.auth.getUser()).data.user?.id,
                processed_at: new Date().toISOString()
            });

            if (error) {
                console.error('Error saving password reset request:', error);
                return false;
            }

            await this.logAction('RESET_AGENT_PASSWORD_REQUEST', { email: agentEmail, user_id: agent.id });
            
            console.log('Password reset request completed successfully');
            return true;
        } catch (error) {
            console.error('Error resetting agent password:', error);
            return false;
        }
    }

    // Commission profile deletion method removed - commissions are now configured directly in contracts

    public async getActiveContractForPartner(partnerId: string): Promise<Contract | null> {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('partner_id', partnerId)
            .eq('status', 'active')
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                return null;
            }
            console.error('Error fetching active contract:', error);
            throw error;
        }

        return {
            ...data,
            partnerId: data.partner_id,
            defaultCommissionConfig: data.default_commission_config,
            startDate: data.start_date,
            endDate: data.end_date
        } as Contract;
    }

    public async ensureUniqueActiveContract(): Promise<{ fixed: number; errors: number }> {
        try {
            // Trouver les partenaires avec plusieurs contrats actifs
            const { data: duplicates, error } = await supabase.rpc('find_duplicate_active_contracts');

            if (error) {
                console.error('Error finding duplicate contracts:', error);
                return { fixed: 0, errors: 1 };
            }

            let fixed = 0;
            let errors = 0;

            for (const duplicate of duplicates || []) {
                try {
                    // Garder le contrat le plus récent actif, désactiver les autres
                    const { data: contracts } = await supabase
                        .from('contracts')
                        .select('id, created_at')
                        .eq('partner_id', duplicate.partner_id)
                        .eq('status', 'active')
                        .order('created_at', { ascending: false });

                    if (contracts && contracts.length > 1) {
                        // Garder le premier (plus récent), désactiver les autres
                        const contractsToDeactivate = contracts.slice(1);

                        for (const contract of contractsToDeactivate) {
                            await supabase
                                .from('contracts')
                                .update({ status: 'inactive' })
                                .eq('id', contract.id);
                            fixed++;
                        }
                    }
                } catch (err) {
                    console.error(`Error fixing contracts for partner ${duplicate.partner_id}:`, err);
                    errors++;
                }
            }

            return { fixed, errors };
        } catch (error) {
            console.error('Error in ensureUniqueActiveContract:', error);
            return { fixed: 0, errors: 1 };
        }
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

    public async markAsRead(notificationId: number): Promise<boolean> {
        console.log(`Marking notification ${notificationId} as read.`);
        // This part needs to be implemented if we modify the mock data source
        // For now, it's handled on the client side when rendering.
        return true;
    }

    // Méthode pour marquer toutes les notifications comme lues
    public async markAllAsRead(userId: string): Promise<boolean> {
        console.log(`Marking all notifications as read for user ${userId}`);
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('read', false);

            if (error) {
                console.error('Error marking all notifications as read:', error);
                return false;
            }

            // Déclencher un événement pour mettre à jour l'interface
            document.body.dispatchEvent(new CustomEvent('notificationUpdated'));
            return true;
        } catch (error) {
            console.error('Exception in markAllAsRead:', error);
            return false;
        }
    }
}