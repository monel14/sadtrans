/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- USER & AUTH ---

export type UserRole = 'agent' | 'partner' | 'admin_general' | 'sous_admin' | 'developer';

export interface User {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    avatarSeed: string;
    status: 'active' | 'suspended' | 'inactive';
    password?: string;

    // Role-specific properties
    partnerId?: string; // For Agent & Partner Manager
    agencyId?: string; // Reference to shared agency balance

    // Agent specific
    commissions_mois_estimees?: number;
    commissions_dues?: number;

    // Partner specific (all balances are now managed at agency level)
    volume_partner_mois?: number;
    commissions_partner_mois?: number;
    agents_actifs?: number;
    phone?: string;
    contactPerson?: { name: string; phone: string };
    agencyName?: string;
    idCardNumber?: string;
    ifu?: string;
    rccm?: string;
    address?: string;
    idCardImageUrl?: string | null;
    // Fix: Added optional agency property to hold joined agency data.
    agency?: Agency;
}

// --- AGENCY (NEW) ---

export interface Agency {
    id: string;
    name: string;
    partnerId?: string;
    solde_principal: number; // Shared balance for all agents/partners in this agency
    solde_revenus: number; // Shared revenue balance
    address?: string;
    phone?: string;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: string;
    updatedAt: string;
}

// --- PARTNER & CONTRACTS ---

export interface Partner {
    id: string;
    name: string;
    partnerManagerId: string; // User ID of the partner manager
    agencyName: string;
    contactPerson: { name: string; phone: string };
    idCardImageUrl: string | null;
    ifu: string;
    rccm: string;
    address: string;
}

export interface Contract {
    id: string;
    name: string;
    partnerId: string;
    defaultCommissionConfig: CommissionConfig;
    status: 'active' | 'inactive' | 'expired';
    startDate: string; // ISO 8601
    endDate: string | null; // ISO 8601
    exceptions: ContractException[];
}

export interface ContractException {
    targetType: 'service' | 'category';
    targetId: string; // OperationType ID or category name
    name: string;
    commissionConfig: CommissionConfig;
}

// --- OPERATIONS & COMMISSIONS ---

export interface OperationTypeFieldOption {
    valeur: string;
    libelle: string;
    prix?: number; // Prix associé à cette option (optionnel)
}

export interface OperationTypeField {
    id: string;
    name: string; // key in the `data` object of a transaction
    label: string;
    type: 'text' | 'number' | 'select' | 'tel' | 'date' | 'file';
    required: boolean;
    obsolete: boolean;
    options?: string[] | OperationTypeFieldOption[]; // Support des deux formats
    placeholder?: string;
    readonly?: boolean;
    defaultValue?: string | number;
    dataSource?: 'cardTypes';
}

export interface OperationType {
    id: string;
    name: string;
    description: string;
    impactsBalance: boolean;
    status: 'active' | 'inactive';
    category: string;
    feeApplication: 'additive' | 'inclusive'; // How fees affect the total amount
    fields: OperationTypeField[];
    commissionConfig: CommissionConfig;
}

export interface CommissionConfig {
    type: 'none' | 'fixed' | 'percentage' | 'tiers';
    amount?: number; // for 'fixed'
    rate?: number; // for 'percentage'
    tiers?: CommissionTier[]; // for 'tiers'
    partageSociete?: number; // Percentage share for the company (0-100)
}

export interface CommissionTier {
    from: number;
    to: number;
    type: 'fixed' | 'percentage';
    value: number;
}

// Commission profiles have been removed - commissions are now configured directly in contracts

// --- TRANSACTIONS & REQUESTS ---

export interface Transaction {
    id: string;
    date: string; // ISO 8601
    agentId: string;
    opTypeId: string;
    data: { [key: string]: any }; // Form data for the operation
    form_data?: any; // Direct mapping from database for backward compatibility
    montant_principal: number;
    frais: number;
    montant_total: number;
    statut: string; // 'Validé', 'Rejeté', 'En attente de validation', 'Assignée à ...'
    preuveUrl: string | null;
    commission_societe: number;
    commission_partenaire: number;
    validateurId: string | null;
    motif_rejet: string | null;
    assignedTo: string | null;
}

export interface AgentRechargeRequest {
    id: string;
    date: string; // ISO 8601
    agentId: string;
    montant: number;
    methodId: string;
    statut: 'En attente' | 'Approuvée' | 'Rejetée';
    notes?: string;
    processedBy?: string;
    processedAt?: string;
}

export interface RechargePaymentMethod {
    id: string;
    name: string;
    feeType: 'none' | 'fixed' | 'percentage';
    feeValue: number;
    status: 'active' | 'inactive';
}

// --- CARDS & ORDERS ---

export interface CardType {
    id: string;
    name: string;
    status: 'active' | 'inactive';
}

export interface Card {
    cardNumber: string; // Masked number for display, e.g., '5555 44** **** 1111'
    fullCardNumber: string; // Full number, should be handled securely
    status: 'Assigné' | 'En attente d\'activation' | 'Activée' | 'En Stock (Société)';
    assignedPartnerId: string | null;
    activationDate: string | null; // ISO 8601
    clientId: string | null;
    cardTypeId: string;
}

export interface OrderItem {
    cardTypeId: string;
    quantity: number;
    unitPrice: number;
}

export interface Order {
    id: string;
    partnerId: string;
    date: string; // ISO 8601
    status: 'pending' | 'delivered';
    deliveredBy: string;
    items: OrderItem[];
    totalAmount: number;
    totalCards: number;
}


// --- UI & NAVIGATION ---

export interface NavLink {
    label: string;
    navId: string;
    icon: string;
    viewFn?: (user: User, operationTypeId?: string) => Promise<HTMLElement>;
    action?: () => void;
    children?: NavLink[];
    operationTypeId?: string;
    target?: any; // For notifications
}

export interface Notification {
    id: number;
    text: string;
    time: string;
    read: boolean;
    icon: string;
    userId: string; // Can be a specific userId or 'all' for admins
    target?: NavLink;
}
