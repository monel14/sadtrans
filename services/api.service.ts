/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    User, Partner, OperationType, Transaction, AgentRechargeRequest,
    RechargePaymentMethod, Notification, Card, Order, CommissionConfig, OperationTypeField, CommissionTier, CardType, OrderItem, CommissionProfile, Contract, UserRole
} from '../models';
import { DataService } from './data.service';
import { renderAdminAgentRechargesView } from '../views/AdminAgentRecharges';
import { renderAgentTransactionHistoryView } from '../views/AgentTransactionHistory';

// --- EMBEDDED MOCK DATA ---

const MOCK_USERS: User[] = [
  { id: 'user_agent_1', name: 'Alice Agent', firstName: 'Alice', lastName: 'Agent', email: 'agent.alice@example.com', role: 'agent', avatarSeed: 'Alice', partnerId: 'partner_1', solde: 50000, commissions_mois_estimees: 12000, commissions_dues: 25000, status: 'active', phone: '771234567' },
  { id: 'user_agent_2', name: 'Bob Agent', firstName: 'Bob', lastName: 'Agent', email: 'agent.bob@example.com', role: 'agent', avatarSeed: 'Bob', partnerId: 'partner_1', solde: 150000, commissions_mois_estimees: 22000, commissions_dues: 45000, status: 'active', phone: '772345678' },
  { id: 'user_agent_3', name: 'Charlie Agent', firstName: 'Charlie', lastName: 'Agent', email: 'agent.charlie@example.com', role: 'agent', avatarSeed: 'Charlie', partnerId: 'partner_2', solde: 25000, commissions_mois_estimees: 5000, commissions_dues: 8000, status: 'suspended', phone: '773456789' },
  { id: 'user_partner_1', name: 'Patrice Partenaire', firstName: 'Patrice', lastName: 'Partenaire', email: 'partner.patrice@example.com', role: 'partner', avatarSeed: 'Patrice', partnerId: 'partner_1', solde: 1500000, solde_revenus: 125000, volume_partner_mois: 2500000, commissions_partner_mois: 75000, agents_actifs: 2, status: 'active', phone: '761234567' },
  { id: 'user_partner_2', name: 'Penda Partenaire', firstName: 'Penda', lastName: 'Partenaire', email: 'partner.penda@example.com', role: 'partner', avatarSeed: 'Penda', partnerId: 'partner_2', solde: 500000, solde_revenus: 48000, volume_partner_mois: 800000, commissions_partner_mois: 25000, agents_actifs: 1, status: 'active', phone: '762345678' },
  { id: 'user_admin_1', name: 'Adam Admin', firstName: 'Adam', lastName: 'Admin', email: 'admin.adam@example.com', role: 'admin_general', avatarSeed: 'Adam', status: 'active' },
  { id: 'user_subadmin_1', name: 'Sam SubAdmin', firstName: 'Sam', lastName: 'SubAdmin', email: 'sub.sam@example.com', role: 'sous_admin', avatarSeed: 'Sam', status: 'active' },
  { id: 'user_subadmin_2', name: 'Suzanne SubAdmin', firstName: 'Suzanne', lastName: 'SubAdmin', email: 'sub.suzanne@example.com', role: 'sous_admin', avatarSeed: 'Suzanne', status: 'active' },
];

const MOCK_COMMISSION_PROFILES: CommissionProfile[] = [
    {
        id: 'cp_default',
        name: 'Grille par Défaut',
        partageSociete: 40,
        tiers: [
            { from: 1000, to: 5000, type: 'fixed', value: 300 },
            { from: 5001, to: 100000, type: 'fixed', value: 500 },
            { from: 100001, to: Infinity, type: 'percentage', value: 1 }
        ]
    },
    {
        id: 'cp_special',
        name: 'Grille Agence Spéciale',
        partageSociete: 30,
        tiers: [
            { from: 1, to: 10000, type: 'fixed', value: 250 },
            { from: 10001, to: Infinity, type: 'percentage', value: 0.8 }
        ]
    }
];

const MOCK_PARTNERS: Partner[] = [
    { 
        id: 'partner_1', 
        name: 'Presta-Services SARL', 
        partnerManagerId: 'user_partner_1', 
        agencyName: 'Presta-Services SARL',
        contactPerson: { name: 'Patrice P.', phone: '761234567' },
        idCardImageUrl: 'https://placehold.co/600x400/22c55e/ffffff?text=CNI_Patrice',
        ifu: 'IFU123456789',
        rccm: 'RCCM/DKR/2022/A/12345',
        address: '123 Avenue de la République, Dakar'
    },
    { 
        id: 'partner_2', 
        name: 'Penda Corp', 
        partnerManagerId: 'user_partner_2', 
        agencyName: 'Penda Corp',
        contactPerson: { name: 'Penda P.', phone: '762345678' },
        idCardImageUrl: null,
        ifu: 'IFU987654321',
        rccm: 'RCCM/TH/2023/B/54321',
        address: '456 Boulevard de la Liberté, Thiès'
    },
];

const MOCK_CONTRACTS: Contract[] = [
    {
        id: 'contract_1',
        name: 'Contrat Standard 2025',
        partnerId: 'partner_1',
        baseCommissionProfileId: 'cp_default',
        status: 'active',
        startDate: '2025-01-01T00:00:00Z',
        endDate: null,
        exceptions: [
            {
                targetType: 'service',
                targetId: 'op_reabo_canal',
                name: 'Réabonnement Canal+',
                commissionConfig: {
                    type: 'percentage',
                    rate: 5, // Special rate of 5% instead of 4%
                    partageSociete: 60, // Company takes more share
                }
            }
        ]
    },
    {
        id: 'contract_2',
        name: 'Contrat Agence Spéciale Q1 2025',
        partnerId: 'partner_2',
        baseCommissionProfileId: 'cp_special',
        status: 'active',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-31T23:59:59Z',
        exceptions: []
    }
];

const MOCK_CARD_TYPES: CardType[] = [
    { id: 'ct_1', name: 'UBA LOW', status: 'active' },
    { id: 'ct_2', name: 'UBA MID', status: 'active' },
    { id: 'ct_3', name: 'UBA HIGH', status: 'active' },
    { id: 'ct_4', name: 'ECOBANK HIGH', status: 'active' },
    { id: 'ct_5', name: 'ECOBANK MID', status: 'active' },
    { id: 'ct_6', name: 'ECOBANK LOW', status: 'active' },
    { id: 'ct_7', name: 'BSIC LOW', status: 'active' },
    { id: 'ct_8', name: 'BSIC MID', status: 'active' },
    { id: 'ct_9', name: 'BSIC HIGH', status: 'active' },
    { id: 'ct_10', name: 'ORABANK', status: 'inactive' },
];

const MOCK_OPERATION_TYPES: OperationType[] = [
    // ... (All operation types with fields and commissions)
    { 
        id: 'op_activation_carte', 
        name: 'Activation Carte Prépayée', 
        description: 'Activer une carte VISA prépayée en collectant les informations KYC du client.', 
        impactsBalance: false, 
        status: 'active', 
        category: 'Cartes VISA', 
        feeApplication: 'additive',
        fields: [
            // --- card_info ---
            { id: 'f_act_card_product_id', name: 'product_id', label: 'Identification de la carte', type: 'text', required: true, obsolete: false, placeholder: 'Numéro unique de la carte' },
            { id: 'f_act_card_first_6', name: 'first_6_numbers', label: 'Les 6 premiers chiffres', type: 'number', required: false, obsolete: false },
            { id: 'f_act_card_last_4', name: 'last_4_numbers', label: 'Les 4 derniers chiffres', type: 'number', required: false, obsolete: false },
            { id: 'f_act_card_type', name: 'card_type', label: 'Type de carte', type: 'text', required: false, obsolete: false, readonly: true, placeholder: 'Rempli automatiquement' },
            { id: 'f_act_card_product_number', name: 'product_number', label: 'Numéro du produit', type: 'text', required: false, obsolete: false, readonly: true, placeholder: 'Rempli automatiquement' },

            // --- client_info ---
            { id: 'f_act_client_name', name: 'name', label: 'Nom', type: 'text', required: true, obsolete: false },
            { id: 'f_act_client_first_name', name: 'first_name', label: 'Prénom(s)', type: 'text', required: true, obsolete: false },
            { id: 'f_act_client_id_type', name: 'id_card_type', label: 'Nature de la pièce', type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_act_client_id_number', name: 'id_card_number', label: 'Numéro de la pièce', type: 'text', required: false, obsolete: false },
            { id: 'f_act_client_ifu', name: 'ifu', label: 'IFU (Identification Fiscal Unique)', type: 'text', required: false, obsolete: false },
            { id: 'f_act_client_phone', name: 'phone_number', label: 'Téléphone mobile', type: 'tel', required: true, obsolete: false },
            { id: 'f_act_client_email', name: 'email', label: 'Email', type: 'text', required: true, obsolete: false },
            { id: 'f_act_client_profession', name: 'profession', label: 'Profession/occupation', type: 'text', required: true, obsolete: false },
            { id: 'f_act_client_birth_date', name: 'birth_date', label: 'Date de naissance', type: 'date', required: true, obsolete: false },
            { id: 'f_act_client_id_expiry', name: 'id_card_expiry_date', label: 'Date d\'expiration de la pièce', type: 'date', required: true, obsolete: false },

            // --- client_address ---
            { id: 'f_act_addr_commune', name: 'commune', label: 'Commune', type: 'text', required: false, obsolete: false },
            { id: 'f_act_addr_arrondissement', name: 'arrondissement', label: 'Arrondissement', type: 'text', required: false, obsolete: false },
            { id: 'f_act_addr_quarter', name: 'quarter_village', label: 'Quartier/Village', type: 'text', required: false, obsolete: false },
            { id: 'f_act_addr_house', name: 'house', label: 'Maison', type: 'text', required: false, obsolete: false },
            { id: 'f_act_addr_landmark', name: 'landmark', label: 'Repère', type: 'text', required: false, obsolete: false },

            // --- documents ---
            { id: 'f_act_doc_id_face1', name: 'id_card_first_face_picture', label: 'Pièce d\'identité (face A)', type: 'file', required: true, obsolete: false },
            { id: 'f_act_doc_id_face2', name: 'id_card_second_face_picture', label: 'Pièce d\'identité (face B)', type: 'file', required: true, obsolete: false },
            { id: 'f_act_doc_form_face1', name: 'first_face_form_picture', label: 'Formulaire de souscription (face A)', type: 'file', required: true, obsolete: false },
            { id: 'f_act_doc_form_face2', name: 'second_face_form_picture', label: 'Formulaire de souscription (face B)', type: 'file', required: true, obsolete: false },
            { id: 'f_act_doc_kyc', name: 'kyc_picture', label: 'Fiche KYC', type: 'file', required: true, obsolete: false },
        ], 
        commissionConfig: { type: 'none' } 
    },
    { 
        id: 'op_recharge_carte_prepayee', 
        name: 'Recharge de Carte Prépayée', 
        description: 'Recharger une carte VISA prépayée existante.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Cartes VISA', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_recharge_product_id', label: 'Identification de la carte', name: 'product_id', type: 'text', required: true, obsolete: false },
            { id: 'f_recharge_card_type', label: 'Type de carte', name: 'card_type', type: 'select', required: true, obsolete: false, dataSource: 'cardTypes' },
            { id: 'f_recharge_amount', label: 'Montant à recharger', name: 'montant_principal', type: 'number', required: true, obsolete: false },
            { id: 'f_recharge_name', label: 'Nom du client', name: 'name', type: 'text', required: true, obsolete: false },
            { id: 'f_recharge_first_name', label: 'Prénom(s) du client', name: 'first_name', type: 'text', required: true, obsolete: false },
            { id: 'f_recharge_phone_number', label: 'Téléphone du client', name: 'phone_number', type: 'tel', required: true, obsolete: false },
            { id: 'f_recharge_id_card', label: "Photo de la pièce d'identité", name: 'id_card_picture', type: 'file', required: false, obsolete: false },
            { id: 'f_recharge_kyc_pic', label: 'Photo KYC', name: 'kyc_picture', type: 'file', required: false, obsolete: false },
        ], 
        commissionConfig: { type: 'tiers', tiers: [] } // Fees will be determined by partner's profile
    },
    { 
        id: 'op_deactivate_carte', 
        name: 'Désactivation de Carte', 
        description: 'Désactiver une carte à la demande.', 
        impactsBalance: false, 
        status: 'active', 
        category: 'Cartes VISA', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_deact_visa_card_id', label: 'Identifiant de la carte', name: 'visa_card_id', type: 'text', required: true, obsolete: false },
            { id: 'f_deact_code_web', label: 'Code web de la carte', name: 'code_web', type: 'number', required: true, obsolete: false }
        ], 
        commissionConfig: { type: 'none' } 
    },
    { 
        id: 'op_abo_decodeur_canal', 
        name: 'Abonnement CANAL+', 
        description: 'Effectuer un nouvel abonnement à une formule Canal+.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Gestion des décodeurs (Canal +)', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_abo_canal_product_id', label: 'Identifiant du décodeur', name: 'product_id', type: 'text', required: true, obsolete: false, placeholder: 'Numéro unique du décodeur' },
            { id: 'f_abo_canal_product_type', label: 'Type de décodeur', name: 'product_type', type: 'text', required: false, obsolete: false, placeholder: 'Rempli automatiquement' },
            { id: 'f_abo_canal_product_number', label: 'Numéro d\'abonné', name: 'product_number', type: 'text', required: false, obsolete: false, placeholder: 'Rempli automatiquement' },
            { id: 'f_abo_canal_concept_id', label: 'Formule choisie', name: 'decoder_concept_id', type: 'select', required: true, obsolete: false, options: ["KWABO", "NETFLIX 01 ECRAN", "ACCESS", "DSTV ENGLISH PLUS", "NETFLIX 02 ECRANS", "NETFLIX 03 ECRANS", "EVASION", "ACCESS+", "TOUT CANAL"] },
            { id: 'f_abo_canal_concept_price', label: 'Prix de la formule', name: 'concept_price', type: 'number', required: false, obsolete: false, placeholder: 'Rempli automatiquement', readonly: true },
            { id: 'f_abo_canal_nbr_month', label: 'Nombre de mois', name: 'nbr_month', type: 'number', required: true, obsolete: false, defaultValue: 1 },
            { id: 'f_abo_canal_total', label: 'Total de l\'opération', name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Calculé automatiquement', readonly: true },
            { id: 'f_abo_canal_person_type', label: 'Civilité du client', name: 'person_type', type: 'select', required: true, obsolete: false, options: ["Mr", "Mme", "Mlle"] },
            { id: 'f_abo_canal_name', label: 'Nom du client', name: 'name', type: 'text', required: true, obsolete: false },
            { id: 'f_abo_canal_first_name', label: 'Prénom(s) du client', name: 'first_name', type: 'text', required: true, obsolete: false },
            { id: 'f_abo_canal_phone_number', label: 'Téléphone mobile du client', name: 'phone_number', type: 'tel', required: true, obsolete: false }
        ], 
        commissionConfig: { type: 'percentage', rate: 4, partageSociete: 50 } 
    },
    { 
        id: 'op_reabo_canal', 
        name: 'Réabonnement Canal+', 
        description: 'Renouveler un abonnement existant à une formule Canal+ avec options.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Gestion des décodeurs (Canal +)', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_reabo_num_decodeur', label: 'Numéro décodeur', name: 'num_decodeur', type: 'text', required: false, obsolete: false, placeholder: 'Numéro unique du décodeur' },
            { id: 'f_reabo_type_carte', label: 'Type de décodeur', name: 'type_decodeur', type: 'select', required: true, obsolete: false, options: ["CANAL+", "CANAL+ INSERTION"] },
            { id: 'f_reabo_num_abonne', label: 'Numéro abonné', name: 'num_abonne', type: 'text', required: false, obsolete: false, placeholder: "Numéro d'abonné du décodeur" },
            { id: 'f_reabo_tel_achat', label: "Téléphone lors de l'achat", name: 'tel_achat', type: 'tel', required: false, obsolete: false, placeholder: "Numéro utilisé à l'achat" },
            { id: 'f_reabo_nom_client', label: 'Nom du client', name: 'nom_client', type: 'text', required: true, obsolete: false },
            { id: 'f_reabo_prenom_client', label: 'Prénom(s) du client', name: 'prenom_client', type: 'text', required: true, obsolete: false },
            { id: 'f_reabo_tel_client', label: 'Téléphone du client', name: 'tel_client', type: 'tel', required: true, obsolete: false },
            { id: 'f_reabo_formule', label: 'Formule', name: 'formule', type: 'select', required: true, obsolete: false, options: ["KWABO", "ACCESS", "EVASION", "ACCESS+", "TOUT CANAL"] },
            { id: 'f_reabo_option', label: 'Option', name: 'option', type: 'select', required: true, obsolete: false, options: ["Aucune", "NETFLIX 01 ECRAN", "DSTV ENGLISH PLUS", "NETFLIX 02 ECRANS", "NETFLIX 03 ECRANS"] },
            { id: 'f_reabo_nb_mois', label: 'Nombre de mois', name: 'nb_mois', type: 'number', required: true, obsolete: false, defaultValue: 1 },
            { id: 'f_reabo_montant', label: "Montant de l'opération", name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Calculé automatiquement', readonly: true }
        ], 
        commissionConfig: { type: 'percentage', rate: 4, partageSociete: 50 } 
    },
    { 
        id: 'op_complement_canal', 
        name: 'Complément Canal+', 
        description: 'Ajouter des options ou changer de formule pour un abonnement Canal+ existant.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Gestion des décodeurs (Canal +)', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_comp_num_decodeur', label: 'Numéro décodeur', name: 'num_decodeur', type: 'text', required: false, obsolete: false, placeholder: 'Numéro unique du décodeur' },
            { id: 'f_comp_type_carte', label: 'Type de décodeur', name: 'type_decodeur', type: 'select', required: true, obsolete: false, options: ["CANAL+", "CANAL+ INSERTION"] },
            { id: 'f_comp_num_abonne', label: 'Numéro abonné', name: 'num_abonne', type: 'text', required: false, obsolete: false, placeholder: "Numéro d'abonné du décodeur" },
            { id: 'f_comp_tel_achat', label: "Téléphone lors de l'achat", name: 'tel_achat', type: 'tel', required: false, obsolete: false, placeholder: "Numéro utilisé à l'achat" },
            { id: 'f_comp_nom_client', label: 'Nom du client', name: 'nom_client', type: 'text', required: true, obsolete: false },
            { id: 'f_comp_prenom_client', label: 'Prénom(s) du client', name: 'prenom_client', type: 'text', required: true, obsolete: false },
            { id: 'f_comp_tel_client', label: 'Téléphone du client', name: 'tel_client', type: 'tel', required: true, obsolete: false },
            { id: 'f_comp_ancienne_formule', label: 'Ancienne Formule', name: 'ancienne_formule', type: 'select', required: true, obsolete: false, options: ["KWABO", "ACCESS", "EVASION", "ACCESS+", "TOUT CANAL"] },
            { id: 'f_comp_prix_ancienne', label: 'Prix Ancienne Formule', name: 'prix_ancienne_formule', type: 'number', required: false, obsolete: false, readonly: true, placeholder: 'Calculé' },
            { id: 'f_comp_nouvelle_formule', label: 'Nouvelle Formule (Mise à niveau)', name: 'nouvelle_formule', type: 'select', required: true, obsolete: false, options: ["KWABO", "ACCESS", "EVASION", "ACCESS+", "TOUT CANAL"] },
            { id: 'f_comp_prix_nouvelle', label: 'Prix Nouvelle Formule', name: 'prix_nouvelle_formule', type: 'number', required: false, obsolete: false, readonly: true, placeholder: 'Calculé' },
            { id: 'f_comp_option', label: 'Option Supplémentaire', name: 'option', type: 'select', required: false, obsolete: false, options: ["Aucune", "NETFLIX 01 ECRAN", "DSTV ENGLISH PLUS", "NETFLIX 02 ECRANS", "NETFLIX 03 ECRANS"] },
            { id: 'f_comp_prix_option', label: 'Prix de l\'option', name: 'prix_option', type: 'number', required: false, obsolete: false, readonly: true, placeholder: 'Calculé' },
            { id: 'f_comp_nb_mois', label: 'Nombre de mois', name: 'nb_mois', type: 'number', required: true, obsolete: false, defaultValue: 1, readonly: true },
            { id: 'f_comp_montant', label: "Montant de l'opération", name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Calculé automatiquement', readonly: true },
        ], 
        commissionConfig: { type: 'percentage', rate: 4, partageSociete: 50 } 
    },
    { 
        id: 'op_depot_ecobank_xpress', 
        name: 'Dépôt Ecobank Xpress', 
        description: "Dépôt d'argent sur un compte Xpress.", 
        impactsBalance: true, 
        status: 'active', 
        category: 'Ecobank Xpress', 
        feeApplication: 'inclusive',
        fields: [
            { id: 'f_depo_eco_xpress_account_number', label: 'Compte xpress ou code', name: 'account_number', type: 'text', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_receiver_name', label: 'Nom du titulaire', name: 'receiver_name', type: 'text', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_depo_eco_xpress_receiver_surname', label: 'Prénom du titulaire', name: 'receiver_surname', type: 'text', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_depo_eco_xpress_receiver_phone', label: 'Téléphone du titulaire', name: 'receiver_phone', type: 'tel', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_depo_eco_xpress_sender_name', label: 'Nom de l\'expéditeur', name: 'sender_name', type: 'text', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_sender_surname', label: 'Prénom de l\'expéditeur', name: 'sender_surname', type: 'text', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_customer_phone', label: 'Téléphone de l\'expéditeur', name: 'customer_phone_number', type: 'tel', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_id_card_type', label: 'Type de pièce d\'identité', name: 'id_card_type', type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_depo_eco_xpress_id_card_number', label: 'Numéro de pièce d\'identité', name: 'id_card_number', type: 'text', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_id_card_expiry', label: 'Date d\'expiration de la pièce', name: 'id_card_expiry_date', type: 'date', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_amount', label: 'Montant total versé par le client', name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Montant doit être un multiple de 5' },
            { id: 'f_depo_eco_xpress_id_card_pic', label: 'Photo de la pièce d\'identité', name: 'id_card_picture', type: 'file', required: true, obsolete: false },
            { id: 'f_depo_eco_xpress_receipt_pic', label: 'Photo du bordereau', name: 'receipt_picture', type: 'file', required: true, obsolete: false }
        ], 
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    { 
        id: 'op_retrait_ecobank_xpress', 
        name: 'Retrait Ecobank Xpress', 
        description: "Retrait d'argent depuis un compte Xpress.", 
        impactsBalance: true, 
        status: 'active', 
        category: 'Ecobank Xpress', 
        feeApplication: 'additive',
        fields: [
            { id: 'f_ret_eco_token', label: 'Code de retrait ou jeton', name: 'token', type: 'text', required: true, obsolete: false },
            { id: 'f_ret_eco_receiver_name', label: 'Nom du titulaire', name: 'receiver_name', type: 'text', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_ret_eco_receiver_surname', label: 'Prénom du titulaire', name: 'receiver_surname', type: 'text', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_ret_eco_receiver_phone', label: 'Téléphone du titulaire', name: 'receiver_phone', type: 'tel', required: false, obsolete: false, placeholder: "Rempli automatiquement si possible" },
            { id: 'f_ret_eco_sender_name', label: 'Nom de l\'expéditeur', name: 'sender_name', type: 'text', required: true, obsolete: false },
            { id: 'f_ret_eco_sender_surname', label: 'Prénom de l\'expéditeur', name: 'sender_surname', type: 'text', required: true, obsolete: false },
            { id: 'f_ret_eco_customer_phone', label: 'Téléphone de l\'expéditeur', name: 'customer_phone_number', type: 'tel', required: true, obsolete: false },
            { id: 'f_ret_eco_id_card_type', label: 'Type de pièce d\'identité', name: 'id_card_type', type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_ret_eco_id_card_number', label: 'Numéro de pièce d\'identité', name: 'id_card_number', type: 'text', required: true, obsolete: false },
            { id: 'f_ret_eco_id_card_expiry', label: 'Date d\'expiration de la pièce', name: 'id_card_expiry_date', type: 'date', required: true, obsolete: false },
            { id: 'f_ret_eco_amount', label: 'Montant à retirer', name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Montant doit être un multiple de 5' },
            { id: 'f_ret_eco_id_card_pic', label: 'Photo de la pièce d\'identité', name: 'id_card_picture', type: 'file', required: false, obsolete: false }
        ], 
        commissionConfig: { type: 'tiers', tiers: [] } 
    },
    { 
        id: 'op_rapid_transfert_eco', 
        name: 'Rapid Transfert (Dépôt Régional)', 
        description: 'Transfert rapide vers la sous-région.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Ecobank Xpress', 
        feeApplication: 'inclusive',
        fields: [
            { id: 'f_rt_type', label: "Type d'opération", name: 'type', type: 'select', required: true, obsolete: false, options: ["Dépôt", "Retrait"] },
            { id: 'f_rt_destination', label: 'Destination', name: 'destination', type: 'select', required: true, obsolete: false, options: ["BURKINA-FASO", "BURUNDI", "BENIN", "CAMEROON", "CAP-VERT", "CENTRAFRIQUE", "CONGO", "COTE D'IVOIRE", "GABON", "GAMBIE", "GHANA", "GUINEE-BISSAU", "GUINEE-CONAKRY", "GUINEE-EQUATORIALE", "LIBERIA", "MALI", "NIGER", "NIGERIA", "SIERRA-LEONE", "TCHAD", "TOGO"] },
            { id: 'f_rt_delivery_method', label: 'Mode de livraison', name: 'delivery_method', type: 'select', required: true, obsolete: false, options: ["En espèces", "Compte"] },
            { id: 'f_rt_amount', label: 'Montant', name: 'montant_principal', type: 'number', required: true, obsolete: false, placeholder: 'Montant du transfert' },
            { id: 'f_rt_receiver_name', label: 'Nom du bénéficiaire', name: 'receiver_name', type: 'text', required: false, obsolete: false },
            { id: 'f_rt_receiver_surname', label: 'Prénom du bénéficiaire', name: 'receiver_surname', type: 'text', required: false, obsolete: false },
            { id: 'f_rt_receiver_phone', label: 'Téléphone du bénéficiaire', name: 'receiver_phone', type: 'tel', required: false, obsolete: false },
            { id: 'f_rt_sender_name', label: "Nom de l'expéditeur", name: 'sender_name', type: 'text', required: true, obsolete: false },
            { id: 'f_rt_sender_surname', label: "Prénom de l'expéditeur", name: 'sender_surname', type: 'text', required: true, obsolete: false },
            { id: 'f_rt_sender_phone', label: "Téléphone de l'expéditeur", name: 'sender_phone', type: 'tel', required: true, obsolete: false },
            { id: 'f_rt_sender_mail', label: "Email de l'expéditeur", name: 'sender_mail', type: 'text', required: false, obsolete: false, placeholder: 'email@example.com' },
            { id: 'f_rt_sender_birth', label: "Date de naissance de l'expéditeur", name: 'sender_birth', type: 'date', required: true, obsolete: false },
            { id: 'f_rt_third_phone', label: 'Téléphone tiers', name: 'third_phone', type: 'tel', required: true, obsolete: false },
            { id: 'f_rt_adresse', label: "Adresse de l'expéditeur", name: 'adresse', type: 'text', required: true, obsolete: false },
            { id: 'f_rt_id_card_type', label: "Type de pièce d'identité", name: 'id_card_type', type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_rt_id_card_number', label: "Numéro de pièce d'identité", name: 'id_card_number', type: 'text', required: true, obsolete: false },
            { id: 'f_rt_id_card_expiry_date', label: "Date d'expiration de la pièce", name: 'id_card_expiry_date', type: 'date', required: true, obsolete: false },
            { id: 'f_rt_question', label: 'Question de sécurité', name: 'question', type: 'select', required: false, obsolete: false, options: ["Quel est le nom de jeune fille de votre mère ?", "Quel est le nom de votre premier animal de compagnie ?", "Dans quelle ville êtes-vous né(e) ?", "Quel est le nom de votre école primaire ?", "Quel était votre surnom d'enfance ?"] },
            { id: 'f_rt_response', label: 'Réponse à la question de sécurité', name: 'response', type: 'text', required: false, obsolete: false },
            { id: 'f_rt_transfer_reason', label: 'Motif de transfert', name: 'transfer_reason', type: 'select', required: true, obsolete: false, options: ["Ticket money", "Accommodation fees", "School fees", "Car purchase", "Personal Allowance"] },
            { id: 'f_rt_id_card_picture', label: "Photo de la pièce d'identité", name: 'id_card_picture', type: 'file', required: false, obsolete: false },
            { id: 'f_rt_receipt_picture', label: 'Photo du bordereau', name: 'receipt_picture', type: 'file', required: false, obsolete: false }
        ], 
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    { 
        id: 'op_envoi_wu', 
        name: 'Envoi Western Union', 
        description: "Envoyer de l'argent via le réseau Western Union.", 
        impactsBalance: true, 
        status: 'active', 
        category: 'Western Union', 
        feeApplication: 'additive',
        fields: [
            // --- Expéditeur ---
            { id: 'f_wu_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_wu_s_surname', name: 'sender_surname', label: "Prénom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_wu_s_phone', name: 'customer_phone_number', label: "Téléphone de l'expéditeur", type: 'tel', required: true, obsolete: false },
            { id: 'f_wu_s_profession', name: 'profession', label: "Profession", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_s_address', name: 'address', label: "Adresse de l'expéditeur", type: 'text', required: false, obsolete: false, placeholder: "Pays, ville, numéro/ rue" },
            { id: 'f_wu_s_email', name: 'email', label: "Email de l'expéditeur", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_s_birth_date', name: 'birth_date', label: "Date de naissance de l'expéditeur", type: 'date', required: false, obsolete: false },
            { id: 'f_wu_s_id_type', name: 'id_card_type', label: "Type de pièce d'identité", type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_wu_s_id_number', name: 'id_card_number', label: "Numéro de pièce d'identité", type: 'text', required: true, obsolete: false },
            { id: 'f_wu_s_id_delivery_date', name: 'id_card_delivery_date', label: "Date d'émission de la pièce", type: 'date', required: true, obsolete: false },
            { id: 'f_wu_s_id_expiry', name: 'id_card_expiry_date', label: "Date d'expiration de la pièce", type: 'date', required: true, obsolete: false },
            
            // --- Bénéficiaire ---
            { id: 'f_wu_r_name', name: 'receiver_name', label: "Nom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_r_surname', name: 'receiver_surname', label: "Prénom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_r_country', name: 'destination', label: "Pays de destination", type: 'select', required: false, obsolete: false, options: ["SENEGAL", "COTE D'IVOIRE", "MALI", "GUINEE-CONAKRY", "NIGERIA", "FRANCE", "USA", "CANADA", "ITALIE", "ESPAGNE", "BURKINA-FASO", "BURUNDI", "BENIN", "CAMEROON", "CAP-VERT", "CENTRAFRIQUE", "CONGO", "GABON", "GAMBIE", "GHANA", "GUINEE-BISSAU", "GUINEE-EQUATORIALE", "LIBERIA", "NIGER", "SIERRA-LEONE", "TCHAD", "TOGO"] },
            { id: 'f_wu_r_phone', name: 'receiver_phone', label: "Téléphone du bénéficiaire", type: 'tel', required: false, obsolete: false },

            // --- Transaction ---
            { id: 'f_wu_t_reason', name: 'reason', label: "Motif du transfert", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_t_amount_sent', name: 'montant_principal', label: "Montant à envoyer", type: 'number', required: true, obsolete: false },
            { id: 'f_wu_t_transfer_fees', name: 'cost', label: "Frais bancaire", type: 'number', required: true, obsolete: false },
            { id: 'f_wu_t_amount_to_receive', name: 'amount_to_receive', label: "Montant à recevoir", type: 'number', required: false, obsolete: false, readonly: true },
            { id: 'f_wu_t_total_amount', name: 'total_amount', label: "Montant total", type: 'number', required: false, obsolete: false, readonly: true },
            
            // --- Documents ---
            { id: 'f_wu_doc_id_card', name: 'id_card_picture', label: "Photo de la pièce d'identité", type: 'file', required: false, obsolete: false },
            { id: 'f_wu_doc_subscription_form', name: 'subscription_form_picture', label: "Photo du formulaire de souscription", type: 'file', required: false, obsolete: false },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    { 
        id: 'op_retrait_wu', 
        name: 'Retrait Western Union', 
        description: "Recevoir de l'argent via WU.", 
        impactsBalance: true, 
        status: 'active', 
        category: 'Western Union', 
        feeApplication: 'additive',
        fields: [
            // --- withdrawal_info ---
            { id: 'f_wu_ret_t_token', name: 'token', label: 'Code de retrait (référence)', type: 'text', required: true, obsolete: false },
            
            // --- sender_info ---
            { id: 'f_wu_ret_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_wu_ret_s_surname', name: 'sender_surname', label: "Prénom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_wu_ret_s_phone', name: 'customer_phone_number', label: "Téléphone de l'expéditeur", type: 'tel', required: true, obsolete: false },
    
            // --- receiver_info ---
            { id: 'f_wu_ret_r_name', name: 'receiver_name', label: "Nom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_ret_r_surname', name: 'receiver_surname', label: "Prénom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_ret_r_phone', name: 'receiver_phone', label: "Téléphone du bénéficiaire", type: 'tel', required: false, obsolete: false },
            { id: 'f_wu_ret_r_address', name: 'address', label: "Adresse du bénéficiaire", type: 'text', required: false, obsolete: false, placeholder: "Pays, ville, numéro/ rue" },
            { id: 'f_wu_ret_r_profession', name: 'profession', label: "Profession du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_ret_r_id_type', name: 'id_card_type', label: "Type de pièce d'identité", type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_wu_ret_r_id_number', name: 'id_card_number', label: "Numéro de pièce d'identité", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_ret_r_id_expiry', name: 'id_card_expiry_date', label: "Date d'expiration de la pièce", type: 'date', required: true, obsolete: false },
    
            // --- transfer_info ---
            { id: 'f_wu_ret_t_source', name: 'source', label: "Pays de provenance", type: 'select', required: false, obsolete: false, options: ["FRANCE", "USA", "CANADA", "ITALIE", "ESPAGNE", "SENEGAL", "COTE D'IVOIRE", "MALI", "GUINEE-CONAKRY", "NIGERIA", "BURKINA-FASO", "BURUNDI", "BENIN", "CAMEROON", "CAP-VERT", "CENTRAFRIQUE", "CONGO", "GABON", "GAMBIE", "GHANA", "GUINEE-BISSAU", "GUINEE-EQUATORIALE", "LIBERIA", "NIGER", "SIERRA-LEONE", "TCHAD", "TOGO"] },
            { id: 'f_wu_ret_t_reason', name: 'reason', label: "Motif du transfert", type: 'text', required: false, obsolete: false },
            { id: 'f_wu_ret_t_amount', name: 'montant_principal', label: "Montant", type: 'number', required: true, obsolete: false },
    
            // --- documents ---
            { id: 'f_wu_ret_d_id_card_pic', name: 'id_card_picture', label: "Photo de la pièce d'identité", type: 'file', required: true, obsolete: false },
            { id: 'f_wu_ret_d_subscription_form', name: 'subscription_form_picture', label: "Photo du formulaire de souscription", type: 'file', required: true, obsolete: false },
        ], 
        commissionConfig: { type: 'tiers', tiers: [] } 
    },
    { 
        id: 'op_envoi_ria', 
        name: 'Envoi Ria', 
        description: 'Envoyer de l\'argent via Ria.', 
        impactsBalance: true, 
        status: 'active', 
        category: 'Ria', 
        feeApplication: 'additive',
        fields: [
            // --- Expéditeur ---
            { id: 'f_ria_envoi_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_envoi_s_surname', name: 'sender_surname', label: "Prénom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_envoi_s_phone', name: 'customer_phone_number', label: "Téléphone de l'expéditeur", type: 'tel', required: true, obsolete: false },
            { id: 'f_ria_envoi_s_profession', name: 'profession', label: "Profession", type: 'text', required: false, obsolete: false },
            { id: 'f_ria_envoi_s_address', name: 'address', label: "Adresse de l'expéditeur", type: 'text', required: false, obsolete: false, placeholder: "Pays, ville, numéro/ rue" },
            { id: 'f_ria_envoi_s_email', name: 'email', label: "Email de l'expéditeur", type: 'text', required: false, obsolete: false },
            { id: 'f_ria_envoi_s_birth_date', name: 'birth_date', label: "Date de naissance de l'expéditeur", type: 'date', required: false, obsolete: false },
            { id: 'f_ria_envoi_s_id_type', name: 'id_card_type', label: "Type de pièce d'identité", type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_ria_envoi_s_id_number', name: 'id_card_number', label: "Numéro de pièce d'identité", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_envoi_s_id_delivery_date', name: 'id_card_delivery_date', label: "Date d'émission de la pièce", type: 'date', required: true, obsolete: false },
            { id: 'f_ria_envoi_s_id_expiry', name: 'id_card_expiry_date', label: "Date d'expiration de la pièce", type: 'date', required: true, obsolete: false },
            
            // --- Bénéficiaire ---
            { id: 'f_ria_envoi_r_name', name: 'receiver_name', label: "Nom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_ria_envoi_r_surname', name: 'receiver_surname', label: "Prénom du bénéficiaire", type: 'text', required: false, obsolete: false },
            { id: 'f_ria_envoi_r_country', name: 'destination', label: "Pays de destination", type: 'select', required: false, obsolete: false, options: ["SENEGAL", "COTE D'IVOIRE", "MALI", "GUINEE-CONAKRY", "NIGERIA", "FRANCE", "USA", "CANADA", "ITALIE", "ESPAGNE", "BURKINA-FASO", "BURUNDI", "BENIN", "CAMEROON", "CAP-VERT", "CENTRAFRIQUE", "CONGO", "GABON", "GAMBIE", "GHANA", "GUINEE-BISSAU", "GUINEE-EQUATORIALE", "LIBERIA", "NIGER", "SIERRA-LEONE", "TCHAD", "TOGO"] },
            { id: 'f_ria_envoi_r_phone', name: 'receiver_phone', label: "Téléphone du bénéficiaire", type: 'tel', required: false, obsolete: false },

            // --- Transaction ---
            { id: 'f_ria_t_reason', name: 'reason', label: "Motif du transfert", type: 'text', required: false, obsolete: false },
            { id: 'f_ria_t_amount_sent', name: 'montant_principal', label: "Montant à envoyer", type: 'number', required: true, obsolete: false },
            { id: 'f_ria_t_transfer_fees', name: 'cost', label: "Frais bancaire", type: 'number', required: true, obsolete: false },
            { id: 'f_ria_t_total_amount', name: 'total_amount', label: "Montant total", type: 'number', required: false, obsolete: false, readonly: true },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    {
        id: 'op_retrait_ria',
        name: 'Retrait Ria',
        description: "Recevoir de l'argent via Ria.",
        impactsBalance: true,
        status: 'active',
        category: 'Ria',
        feeApplication: 'additive',
        fields: [
            { id: 'f_ria_ret_pin', name: 'code_pin', label: 'Code PIN', type: 'text', required: true, obsolete: false },
            { id: 'f_ria_ret_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_ret_s_surname', name: 'sender_surname', label: "Prénom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_ret_r_name', name: 'receiver_name', label: 'Nom du bénéficiaire', type: 'text', required: true, obsolete: false },
            { id: 'f_ria_ret_r_id_type', name: 'id_card_type', label: "Type de pièce d'identité", type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_ria_ret_r_id_number', name: 'id_card_number', label: "Numéro de pièce d'identité", type: 'text', required: true, obsolete: false },
            { id: 'f_ria_ret_t_amount', name: 'montant_principal', label: "Montant à recevoir", type: 'number', required: true, obsolete: false },
            { id: 'f_ria_ret_d_id_card_pic', name: 'id_card_picture', label: "Photo de la pièce d'identité", type: 'file', required: true, obsolete: false },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    {
        id: 'op_envoi_mg',
        name: 'Envoi MoneyGram',
        description: "Envoyer de l'argent via MoneyGram.",
        impactsBalance: true,
        status: 'active',
        category: 'MoneyGram',
        feeApplication: 'additive',
        fields: [
            { id: 'f_mg_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_mg_s_phone', name: 'customer_phone_number', label: "Téléphone de l'expéditeur", type: 'tel', required: true, obsolete: false },
            { id: 'f_mg_r_name', name: 'receiver_name', label: "Nom du bénéficiaire", type: 'text', required: true, obsolete: false },
            { id: 'f_mg_r_country', name: 'destination', label: "Pays de destination", type: 'text', required: true, obsolete: false },
            { id: 'f_mg_t_amount_sent', name: 'montant_principal', label: "Montant à envoyer", type: 'number', required: true, obsolete: false },
            { id: 'f_mg_t_transfer_fees', name: 'cost', label: "Frais de transfert", type: 'number', required: true, obsolete: false },
            { id: 'f_mg_t_total_amount', name: 'total_amount', label: "Montant total", type: 'number', required: true, obsolete: false, readonly: true },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    {
        id: 'op_retrait_mg',
        name: 'Retrait MoneyGram',
        description: "Recevoir de l'argent via MoneyGram.",
        impactsBalance: true,
        status: 'active',
        category: 'MoneyGram',
        feeApplication: 'additive',
        fields: [
            { id: 'f_mg_ret_ref', name: 'code_reference', label: 'Numéro de référence', type: 'text', required: true, obsolete: false },
            { id: 'f_mg_ret_s_name', name: 'sender_name', label: "Nom de l'expéditeur", type: 'text', required: true, obsolete: false },
            { id: 'f_mg_ret_r_name', name: 'receiver_name', label: 'Nom du bénéficiaire', type: 'text', required: true, obsolete: false },
            { id: 'f_mg_ret_r_id_type', name: 'id_card_type', label: "Type de pièce d'identité", type: 'select', required: true, obsolete: false, options: ["CIP", "CNI", "CEDEAO", "PASSEPORT"] },
            { id: 'f_mg_ret_r_id_number', name: 'id_card_number', label: "Numéro de pièce d'identité", type: 'text', required: true, obsolete: false },
            { id: 'f_mg_ret_t_amount', name: 'montant_principal', label: "Montant à recevoir", type: 'number', required: true, obsolete: false },
            { id: 'f_mg_ret_d_id_card_pic', name: 'id_card_picture', label: "Photo de la pièce d'identité", type: 'file', required: true, obsolete: false },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    {
        id: 'op_paiement_facture',
        name: 'Paiement de Facture',
        description: 'Payer une facture (Senelec, SDE, etc).',
        impactsBalance: true,
        status: 'active',
        category: 'Paiement de Factures',
        feeApplication: 'additive',
        fields: [
            { id: 'f_facture_type', name: 'type_facture', label: "Type de facture", type: 'select', required: true, obsolete: false, options: ["Senelec", "SDE", "Woyofal"] },
            { id: 'f_facture_ref', name: 'reference_client', label: "Référence client / Numéro police", type: 'text', required: true, obsolete: false },
            { id: 'f_facture_amount', name: 'montant_principal', label: "Montant de la facture", type: 'number', required: true, obsolete: false },
            { id: 'f_facture_total', name: 'total_amount', label: "Montant total (avec frais)", type: 'number', required: true, obsolete: false, readonly: true },
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    },
    {
        id: 'op_paiement_sde',
        name: 'Paiement Facture SDE',
        description: 'Payer une facture SDE.',
        impactsBalance: true,
        status: 'active',
        category: 'Paiement de Factures',
        feeApplication: 'additive',
        fields: [
            { id: 'f_sde_ref_client', name: 'ref_client_sde', label: 'Référence Client SDE', type: 'text', required: true, obsolete: false },
            { id: 'f_sde_amount', name: 'montant_principal', label: 'Montant', type: 'number', required: true, obsolete: false }
        ],
        commissionConfig: { type: 'tiers', tiers: [] }
    }
];

const MOCK_RECHARGE_PAYMENT_METHODS: RechargePaymentMethod[] = [
    { id: 'method_1', name: 'Virement Bancaire - Ecobank', feeType: 'none', feeValue: 0, status: 'active' },
    { id: 'method_2', name: 'Dépôt Mobile Money - Wave', feeType: 'percentage', feeValue: 1, status: 'active' },
    { id: 'method_3', name: 'Dépôt Mobile Money - Orange Money', feeType: 'percentage', feeValue: 1.5, status: 'active' },
    { id: 'method_4', name: 'Dépôt Espèces - Agence Principale', feeType: 'none', feeValue: 0, status: 'inactive' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TRN001', date: '2025-09-01T10:00:00Z', agentId: 'user_agent_1', opTypeId: 'op_reabo_canal', data: { num_decodeur_canal: '123456789' }, montant_principal: 5000, frais: 250, montant_total: 5250, statut: 'Validé', preuveUrl: 'https://placehold.co/600x400/22c55e/ffffff?text=Preuve_TRN001', commission_societe: 125, commission_partenaire: 125, validateurId: 'user_admin_1', motif_rejet: null, assignedTo: 'user_admin_1' },
  { id: 'TRN002', date: '2025-09-02T11:30:00Z', agentId: 'user_agent_2', opTypeId: 'op_depot_ecobank_xpress', data: { compte_xpress: '221771234567' }, montant_principal: 100000, frais: 500, montant_total: 100500, statut: 'En attente de validation', preuveUrl: null, commission_societe: 150, commission_partenaire: 350, validateurId: null, motif_rejet: null, assignedTo: null },
  { id: 'TRN003', date: '2025-09-02T14:00:00Z', agentId: 'user_agent_1', opTypeId: 'op_activation_carte', data: { numero_carte: '5555...1234', nom_client: 'Moussa Diop' }, montant_principal: 0, frais: 0, montant_total: 0, statut: 'Assignée à Sam SubAdmin', preuveUrl: null, commission_societe: 0, commission_partenaire: 0, validateurId: null, motif_rejet: null, assignedTo: 'user_subadmin_1' },
  { id: 'TRN004', date: '2025-09-03T09:00:00Z', agentId: 'user_agent_3', opTypeId: 'op_recharge_carte_prepayee', data: { id_carte: 'C123' }, montant_principal: 25000, frais: 500, montant_total: 25500, statut: 'Rejeté', preuveUrl: null, commission_societe: 200, commission_partenaire: 300, validateurId: 'user_admin_1', motif_rejet: 'Preuve de paiement illisible.', assignedTo: 'user_admin_1' },
  { id: 'TRN005', date: '2025-09-04T16:00:00Z', agentId: 'user_agent_2', opTypeId: 'op_envoi_wu', data: { nom_beneficiaire: 'Awa Fall', pays_destination: "COTE D'IVOIRE" }, montant_principal: 50000, frais: 500, montant_total: 50500, statut: 'En attente de validation', preuveUrl: null, commission_societe: 100, commission_partenaire: 400, validateurId: null, motif_rejet: null, assignedTo: null },
];

const MOCK_AGENT_RECHARGE_REQUESTS: AgentRechargeRequest[] = [
    { id: 'ARR001', date: '2025-09-05T09:00:00Z', agentId: 'user_agent_1', montant: 50000, paymentMethodId: 'method_2', reference: 'WAVE-TX-123', statut: 'En attente Admin' },
    { id: 'ARR002', date: '2025-09-04T15:00:00Z', agentId: 'user_agent_2', montant: 100000, paymentMethodId: 'method_1', statut: 'Approuvée' },
    { id: 'ARR003', date: '2025-09-03T11:00:00Z', agentId: 'user_agent_3', montant: 25000, paymentMethodId: 'method_3', reference: 'OM-TX-456', statut: 'Rejetée', motif_rejet: 'Référence de transaction invalide.' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: 1, text: 'Votre demande de recharge ARR002 a été approuvée.', time: 'Hier', read: false, icon: 'fa-check-circle', userId: 'user_agent_2'
    },
    {
        id: 2, text: 'La transaction TRN004 a été rejetée.', time: 'Il y a 2 jours', read: true, icon: 'fa-times-circle', userId: 'user_agent_3',
        target: { viewFn: renderAgentTransactionHistoryView, label: 'Historique des Opérations', navId: 'agent_history', icon: 'fa-history' }
    },
    {
        id: 3, text: 'Nouvelle demande de recharge de 50,000 XOF par Alice Agent.', time: 'Aujourd\'hui', read: false, icon: 'fa-wallet', userId: 'all',
        target: { viewFn: renderAdminAgentRechargesView, label: 'Recharges Agents', navId: 'admin_agent_recharges', icon: 'fa-wallet' }
    },
];

const MOCK_CARDS: Card[] = [
    { cardNumber: '5555 44** **** 1111', fullCardNumber: '5555443322111111', status: 'Assigné', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_1' },
    { cardNumber: '5555 44** **** 2222', fullCardNumber: '5555443322112222', status: 'En attente d\'activation', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_1' },
    { cardNumber: '5555 44** **** 3333', fullCardNumber: '5555443322113333', status: 'Activée', assignedPartnerId: 'partner_2', activationDate: '2025-08-15T00:00:00Z', clientId: 'client_1', cardTypeId: 'ct_3' },
    { cardNumber: '5555 44** **** 4444', fullCardNumber: '5555443322114444', status: 'En Stock (Société)', assignedPartnerId: null, activationDate: null, clientId: null, cardTypeId: 'ct_2' },
    { cardNumber: '5555 44** **** 5555', fullCardNumber: '5555443322115555', status: 'Assigné', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_1' },
    { cardNumber: '5555 44** **** 6666', fullCardNumber: '5555443322116666', status: 'Assigné', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_1' },
    { cardNumber: '5555 44** **** 7777', fullCardNumber: '5555443322117777', status: 'Activée', assignedPartnerId: 'partner_1', activationDate: '2025-09-01T00:00:00Z', clientId: 'client_2', cardTypeId: 'ct_1' },
    { cardNumber: '6666 55** **** 1111', fullCardNumber: '6666554433221111', status: 'Assigné', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_2' },
    { cardNumber: '6666 55** **** 2222', fullCardNumber: '6666554433222222', status: 'Assigné', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_2' },
    { cardNumber: '6666 55** **** 3333', fullCardNumber: '6666554433223333', status: 'En attente d\'activation', assignedPartnerId: 'partner_1', activationDate: null, clientId: null, cardTypeId: 'ct_2' },
];

const MOCK_ORDERS: Order[] = [
    {
        id: 'BC-25-09-000001', partnerId: 'partner_1', date: '2025-09-01T00:00:00Z', status: 'livré', deliveredBy: 'Adam Admin',
        items: [
            { cardTypeId: 'ct_1', quantity: 50, unitPrice: 5000 },
            { cardTypeId: 'ct_2', quantity: 50, unitPrice: 5000 }
        ],
        totalAmount: 500000,
        totalCards: 100
    },
    {
        id: 'BC-25-09-000002', partnerId: 'partner_2', date: '2025-09-05T00:00:00Z', status: 'en attente', deliveredBy: '',
        items: [
            { cardTypeId: 'ct_3', quantity: 50, unitPrice: 5000 }
        ],
        totalAmount: 250000,
        totalCards: 50
    },
];

export class ApiService {
    private static instance: ApiService;

    private constructor() {
        // The constructor is now empty to break the circular dependency.
    }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }
    
    // --- MOCK API METHODS ---
    private delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    private async calculateFeesForTx(amount: number, agentId: string, opType: OperationType): Promise<{ totalFee: number, companyShare: number, partnerShare: number, ruleSource: string }> {
        const dataService = DataService.getInstance();
        const userMap = await dataService.getUserMap();
        const activeContractsMap = await dataService.getActiveContractsMap();
        const commissionProfileMap = await dataService.getCommissionProfileMap();

        const agent = userMap.get(agentId);
        if (!agent || !agent.partnerId) return { totalFee: 0, companyShare: 0, partnerShare: 0, ruleSource: 'No Agent/Partner' };

        const contract = activeContractsMap.get(agent.partnerId);
        if (!contract) return { totalFee: 0, companyShare: 0, partnerShare: 0, ruleSource: 'No Active Contract' };

        let feeConfig: CommissionConfig | null = null;
        let profileTiers: CommissionTier[] | null = null;
        let ruleSource = '';

        // 1. Check for service-specific exception
        const serviceException = contract.exceptions.find(ex => ex.targetType === 'service' && ex.targetId === opType.id);
        if (serviceException) {
            feeConfig = serviceException.commissionConfig;
            ruleSource = `Exception: ${serviceException.name}`;
        }

        // 2. Check for category-specific exception if no service exception found
        if (!feeConfig && opType.category) {
            const categoryException = contract.exceptions.find(ex => ex.targetType === 'category' && ex.targetId === opType.category);
            if (categoryException) {
                feeConfig = categoryException.commissionConfig;
                ruleSource = `Exception: Catégorie ${categoryException.name}`;
            }
        }
        
        // 3. Fallback to base profile from contract
        if (!feeConfig) {
            const baseProfile = commissionProfileMap.get(contract.baseCommissionProfileId);
            if (baseProfile) {
                profileTiers = baseProfile.tiers;
                feeConfig = { type: 'tiers', tiers: profileTiers, partageSociete: baseProfile.partageSociete };
                ruleSource = `Profil: ${baseProfile.name}`;
            }
        }

        if (!feeConfig) return { totalFee: 0, companyShare: 0, partnerShare: 0, ruleSource: 'No Fee Configuration Found' };
        
        const calculateTieredFee = (tiers: CommissionTier[]): number => {
            const tier = tiers.find(t => amount >= t.from && amount <= t.to);
            if (tier) {
                if (tier.type === 'fixed') return tier.value;
                if (tier.type === 'percentage') return (amount * tier.value) / 100;
            }
            return 0;
        };

        let totalFee = 0;
        switch (feeConfig.type) {
            case 'fixed':
                totalFee = feeConfig.amount || 0;
                break;
            case 'percentage':
                totalFee = (amount * (feeConfig.rate || 0)) / 100;
                break;
            case 'tiers':
                totalFee = calculateTieredFee(feeConfig.tiers || []);
                break;
        }
        
        totalFee = Math.round(totalFee);

        const companySharePercent = feeConfig.partageSociete ?? 0;
        
        const companyShare = Math.round(totalFee * (companySharePercent / 100));
        const partnerShare = totalFee - companyShare;

        return { totalFee, companyShare, partnerShare, ruleSource };
    }

    public async getFeePreview(agentId: string, opTypeId: string, amount: number): Promise<{ totalFee: number; partnerShare: number; ruleSource: string }> {
        await this.delay(20);
        const opTypeMap = await DataService.getInstance().getOpTypeMap();
        const opType = opTypeMap.get(opTypeId);
        if (!opType) return { totalFee: 0, partnerShare: 0, ruleSource: 'Unknown Operation Type' };
        
        const result = await this.calculateFeesForTx(amount, agentId, opType);
        return { totalFee: result.totalFee, partnerShare: result.partnerShare, ruleSource: result.ruleSource };
    }

    public async getUsers(): Promise<User[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_USERS));
    }

    public async getUserById(id: string): Promise<User | undefined> {
        await this.delay(10);
        const user = MOCK_USERS.find(u => u.id === id)
        return user ? JSON.parse(JSON.stringify(user)) : undefined;
    }
    
    public async getTransactions(filters: {} = {}): Promise<Transaction[]> {
        await this.delay(200);
        return JSON.parse(JSON.stringify(MOCK_TRANSACTIONS));
    }
    
    public async getAllOperationTypes(): Promise<OperationType[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_OPERATION_TYPES));
    }

    public async getOperationTypes(filters: { partnerId: string }): Promise<OperationType[]> {
        return this.getAllOperationTypes();
    }
    
    public async getPartners(): Promise<Partner[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_PARTNERS));
    }
    
    public async getPartnerById(id: string): Promise<Partner | undefined> {
        await this.delay(10);
        const partner = MOCK_PARTNERS.find(p => p.id === id);
        return partner ? JSON.parse(JSON.stringify(partner)) : undefined;
    }
    
    public async getCards(filters: {} = {}): Promise<Card[]> {
        await this.delay(100);
        return JSON.parse(JSON.stringify(MOCK_CARDS));
    }
    
    public async getAgentRechargeRequests(filters: {} = {}): Promise<AgentRechargeRequest[]> {
        await this.delay(150);
        return JSON.parse(JSON.stringify(MOCK_AGENT_RECHARGE_REQUESTS));
    }

    public async getRechargePaymentMethods(filters: {} = {}): Promise<RechargePaymentMethod[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_RECHARGE_PAYMENT_METHODS));
    }

    public async assignTask(taskId: string, type: 'transaction', userId: string | null): Promise<boolean> {
        await this.delay(300);
        const transaction = MOCK_TRANSACTIONS.find(t => t.id === taskId);
        if (transaction) {
            transaction.assignedTo = userId;
            if(userId) {
                const user = MOCK_USERS.find(u => u.id === userId);
                transaction.statut = `Assignée à ${user?.name || 'Inconnu'}`;
            } else {
                transaction.statut = 'En attente de validation';
            }
            DataService.getInstance().invalidateTransactionsCache();
            return true;
        }
        return false;
    }

    public async updateAgentRechargeRequestStatus(requestId: string, status: 'Approuvée' | 'Rejetée', motif?: string): Promise<boolean> {
        await this.delay(400);
        const request = MOCK_AGENT_RECHARGE_REQUESTS.find(r => r.id === requestId);
        if (request) {
            request.statut = status;
            if (status === 'Rejetée') {
                request.motif_rejet = motif || 'Raison non spécifiée.';
            }
            if (status === 'Approuvée') {
                const agent = MOCK_USERS.find(u => u.id === request.agentId);
                if (agent) {
                    agent.solde = (agent.solde || 0) + request.montant;
                }
            }
            const dataService = DataService.getInstance();
            dataService.invalidateAgentRechargeRequestsCache();
            dataService.invalidateUsersCache();
            return true;
        }
        return false;
    }

    public async getNotifications(userId: string): Promise<Notification[]> {
        await this.delay(100);
        const userNotifications = MOCK_NOTIFICATIONS.filter(n => n.userId === userId || (n.userId === 'all' && MOCK_USERS.find(u => u.id === userId)?.role.startsWith('admin')));
        return JSON.parse(JSON.stringify(userNotifications));
    }

    public async transferRevenueToMainBalance(userId: string): Promise<User | null> {
        await this.delay(500);
        const user = MOCK_USERS.find(u => u.id === userId && u.role === 'partner');
        if (user && user.solde_revenus) {
            user.solde = (user.solde || 0) + user.solde_revenus;
            user.solde_revenus = 0;
            DataService.getInstance().invalidateUsersCache();
            return JSON.parse(JSON.stringify(user));
        }
        return null;
    }

    public async getCardTypes(): Promise<CardType[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_CARD_TYPES));
    }

    public async validateTransaction(taskId: string, proofUrl: string): Promise<boolean> {
        await this.delay(500);
        const transaction = MOCK_TRANSACTIONS.find(t => t.id === taskId);
        if (transaction) {
            transaction.statut = 'Validé';
            transaction.preuveUrl = proofUrl;
            transaction.validateurId = 'user_admin_1'; // Mock validator
            DataService.getInstance().invalidateTransactionsCache();
            return true;
        }
        return false;
    }

    public async rejectTransaction(taskId: string, reason: string): Promise<boolean> {
        await this.delay(500);
        const transaction = MOCK_TRANSACTIONS.find(t => t.id === taskId);
        if (transaction) {
            transaction.statut = 'Rejeté';
            transaction.motif_rejet = reason;
            transaction.validateurId = 'user_admin_1'; // Mock validator
            DataService.getInstance().invalidateTransactionsCache();
            return true;
        }
        return false;
    }

    public async createTransaction(agentId: string, opTypeId: string, data: { [key: string]: any }): Promise<Transaction> {
        await this.delay(600);
        const opType = MOCK_OPERATION_TYPES.find(o => o.id === opTypeId);
        if (!opType) throw new Error("Operation Type not found");

        const amount = parseFloat(data.montant_principal) || 0;
        const fees = await this.calculateFeesForTx(amount, agentId, opType);

        const newTransaction: Transaction = {
            id: `TRN${Date.now()}`,
            date: new Date().toISOString(),
            agentId,
            opTypeId,
            data,
            montant_principal: amount,
            frais: fees.totalFee,
            montant_total: amount + (opType.feeApplication === 'additive' ? fees.totalFee : 0),
            statut: opType.impactsBalance ? 'En attente de validation' : 'Validé',
            preuveUrl: null,
            commission_societe: fees.companyShare,
            commission_partenaire: fees.partnerShare,
            validateurId: null,
            motif_rejet: null,
            assignedTo: null,
        };

        MOCK_TRANSACTIONS.unshift(newTransaction);
        DataService.getInstance().invalidateTransactionsCache();
        return JSON.parse(JSON.stringify(newTransaction));
    }

    public async createAgentRechargeRequest(agentId: string, montant: number, paymentMethodId: string, reference?: string): Promise<AgentRechargeRequest> {
        await this.delay(400);
        const newRequest: AgentRechargeRequest = {
            id: `ARR${Date.now()}`,
            date: new Date().toISOString(),
            agentId,
            montant,
            paymentMethodId,
            reference,
            statut: 'En attente Admin',
        };
        MOCK_AGENT_RECHARGE_REQUESTS.unshift(newRequest);
        DataService.getInstance().invalidateAgentRechargeRequestsCache();
        return JSON.parse(JSON.stringify(newRequest));
    }
    
    public async updateCurrentUserProfile(userData: Partial<User>): Promise<User | null> {
        await this.delay(300);
        const userIndex = MOCK_USERS.findIndex(u => u.id === userData.id);
        if (userIndex > -1) {
            MOCK_USERS[userIndex] = { ...MOCK_USERS[userIndex], ...userData };
            if (userData.firstName || userData.lastName) {
                 MOCK_USERS[userIndex].name = `${userData.firstName || MOCK_USERS[userIndex].firstName} ${userData.lastName || MOCK_USERS[userIndex].lastName}`;
            }
            DataService.getInstance().invalidateUsersCache();
            return JSON.parse(JSON.stringify(MOCK_USERS[userIndex]));
        }
        return null;
    }

    public async getOrders(filters: {} = {}): Promise<Order[]> {
        await this.delay(100);
        return JSON.parse(JSON.stringify(MOCK_ORDERS));
    }
    
    public async updateRechargePaymentMethod(methodData: RechargePaymentMethod): Promise<RechargePaymentMethod> {
        await this.delay(300);
        if (methodData.id) {
            const index = MOCK_RECHARGE_PAYMENT_METHODS.findIndex(m => m.id === methodData.id);
            if (index > -1) {
                MOCK_RECHARGE_PAYMENT_METHODS[index] = methodData;
            }
        } else {
            methodData.id = `method_${Date.now()}`;
            MOCK_RECHARGE_PAYMENT_METHODS.push(methodData);
        }
        DataService.getInstance().invalidateRechargePaymentMethodsCache();
        return JSON.parse(JSON.stringify(methodData));
    }

    public async updateAgent(agentData: Partial<User>): Promise<User> {
        await this.delay(300);
        let userToReturn: User;
        if (agentData.id) {
            const index = MOCK_USERS.findIndex(u => u.id === agentData.id);
            if (index > -1) {
                MOCK_USERS[index] = { ...MOCK_USERS[index], ...agentData };
                userToReturn = MOCK_USERS[index];
            } else {
                throw new Error("Agent not found for update");
            }
        } else {
            const nameParts = (agentData.name || '').split(' ');
            const newAgent: User = {
                id: `user_agent_${Date.now()}`,
                name: agentData.name!,
                firstName: agentData.firstName || nameParts[0] || '',
                lastName: agentData.lastName || nameParts.slice(1).join(' ') || '',
                email: agentData.email!,
                role: 'agent',
                avatarSeed: agentData.name!,
                status: 'active',
                ...agentData,
            };
            MOCK_USERS.push(newAgent);
            userToReturn = newAgent;
        }
       DataService.getInstance().invalidateUsersCache();
       return JSON.parse(JSON.stringify(userToReturn));
   }

    public async adminUpdateUser(userData: Partial<User>): Promise<User> {
        await this.delay(400);
        let userToReturn: User;
        if (userData.id) {
            const index = MOCK_USERS.findIndex(u => u.id === userData.id);
            if (index > -1) {
                const updatedUser = { ...MOCK_USERS[index], ...userData };
                if (userData.firstName || userData.lastName) {
                    updatedUser.name = `${updatedUser.firstName} ${updatedUser.lastName}`;
                }
                MOCK_USERS[index] = updatedUser;
                userToReturn = updatedUser;
            } else {
                 throw new Error("User not found for update");
            }
        } else {
             const newUser: User = {
                id: `user_${userData.role}_${Date.now()}`,
                name: `${userData.firstName} ${userData.lastName}`,
                email: userData.email!,
                role: userData.role!,
                firstName: userData.firstName!,
                lastName: userData.lastName!,
                avatarSeed: userData.firstName!,
                status: userData.status || 'active',
                ...userData,
             };
             MOCK_USERS.push(newUser);
             userToReturn = newUser;
        }
        DataService.getInstance().invalidateUsersCache();
        return JSON.parse(JSON.stringify(userToReturn));
    }

    public async updatePartnerDetails(partnerData: Partial<Partner>): Promise<Partner> {
        await this.delay(400);
        if (!partnerData.id) throw new Error("Partner ID is required for updates.");
        
        const index = MOCK_PARTNERS.findIndex(p => p.id === partnerData.id);
        if (index > -1) {
            MOCK_PARTNERS[index] = { ...MOCK_PARTNERS[index], ...partnerData };
            DataService.getInstance().invalidatePartnersCache();
            return JSON.parse(JSON.stringify(MOCK_PARTNERS[index]));
        }
        throw new Error("Partner not found.");
    }
    
    public async getCompanyRevenueStats(): Promise<any> {
        await this.delay(400);
        const validated = MOCK_TRANSACTIONS.filter(t => t.statut === 'Validé');
        const totalRevenue = validated.reduce((sum, t) => sum + t.commission_societe, 0);

        const revenueByPartner = MOCK_PARTNERS.map(p => {
            const agentIds = MOCK_USERS.filter(u => u.partnerId === p.id).map(u => u.id);
            const partnerRevenue = validated.filter(t => agentIds.includes(t.agentId)).reduce((sum, t) => sum + t.commission_societe, 0);
            return { name: p.name, total: partnerRevenue };
        }).sort((a, b) => b.total - a.total);
        
        const revenueByCategory = validated.reduce((acc, t) => {
            const opType = MOCK_OPERATION_TYPES.find(o => o.id === t.opTypeId);
            const category = opType?.category || 'Non Catégorisé';
            acc[category] = (acc[category] || 0) + t.commission_societe;
            return acc;
        }, {} as Record<string, number>);
        
        const revenueTrend: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            revenueTrend[dateString] = 0;
        }
        validated.forEach(t => {
            const dateString = t.date.split('T')[0];
            if (revenueTrend[dateString] !== undefined) {
                revenueTrend[dateString] += t.commission_societe;
            }
        });
        
        return { totalRevenue, revenueByPartner, revenueByCategory, revenueTrend, latestCommissions: validated.slice(0, 10) };
    }

    public async updateCardType(cardTypeData: CardType): Promise<CardType> {
        await this.delay(250);
        if (cardTypeData.id) {
            const index = MOCK_CARD_TYPES.findIndex(ct => ct.id === cardTypeData.id);
            if (index > -1) MOCK_CARD_TYPES[index] = cardTypeData;
        } else {
            cardTypeData.id = `ct_${Date.now()}`;
            MOCK_CARD_TYPES.push(cardTypeData);
        }
        DataService.getInstance().invalidateCardTypesCache();
        return JSON.parse(JSON.stringify(cardTypeData));
    }

    public async createOrder(orderData: { partnerId: string, items: OrderItem[] }): Promise<Order> {
        await this.delay(400);
        const totalCards = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = orderData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        const newOrder: Order = {
            id: `BC-${new Date().getFullYear().toString().slice(-2)}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${String(MOCK_ORDERS.length + 1).padStart(6, '0')}`,
            date: new Date().toISOString(),
            status: 'en attente',
            deliveredBy: '',
            partnerId: orderData.partnerId,
            items: orderData.items,
            totalAmount,
            totalCards,
        };
        MOCK_ORDERS.unshift(newOrder);
        DataService.getInstance().invalidateOrdersCache();
        return JSON.parse(JSON.stringify(newOrder));
    }
    
    public async updateCommissionProfile(profileData: CommissionProfile): Promise<CommissionProfile> {
        await this.delay(350);
        if (profileData.id) {
            const index = MOCK_COMMISSION_PROFILES.findIndex(p => p.id === profileData.id);
            if (index > -1) MOCK_COMMISSION_PROFILES[index] = profileData;
        } else {
            profileData.id = `cp_${Date.now()}`;
            MOCK_COMMISSION_PROFILES.push(profileData);
        }
        DataService.getInstance().invalidateCommissionProfilesCache();
        return JSON.parse(JSON.stringify(profileData));
    }

    public async updateOperationType(opData: OperationType): Promise<OperationType> {
        await this.delay(300);
        const index = MOCK_OPERATION_TYPES.findIndex(o => o.id === opData.id);
        if (index > -1) {
            MOCK_OPERATION_TYPES[index] = opData;
            DataService.getInstance().invalidateOperationTypesCache();
        }
        return JSON.parse(JSON.stringify(opData));
    }
    
    public async getContracts(): Promise<Contract[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_CONTRACTS));
    }
    
    public async getCommissionProfiles(): Promise<CommissionProfile[]> {
        await this.delay(50);
        return JSON.parse(JSON.stringify(MOCK_COMMISSION_PROFILES));
    }
    
    public async updateContract(contractData: Contract): Promise<Contract> {
        await this.delay(400);
        if (contractData.id) {
            const index = MOCK_CONTRACTS.findIndex(c => c.id === contractData.id);
            if (index > -1) MOCK_CONTRACTS[index] = contractData;
        } else {
            contractData.id = `contract_${Date.now()}`;
            MOCK_CONTRACTS.push(contractData);
        }
        DataService.getInstance().invalidateContractsCache();
        return JSON.parse(JSON.stringify(contractData));
    }
}