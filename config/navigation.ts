import { User, UserRole, NavLink } from "../models";
import { renderAgentDashboardView } from "../views/AgentDashboard";
import { renderAgentTransactionHistoryView } from "../views/AgentTransactionHistory";
import { renderPartnerDashboardView } from "../views/PartnerDashboard";
import { renderPartnerManageUsersView } from "../views/PartnerManageUsers";
import { renderPartnerCommissionsView } from "../views/PartnerCommissions";
import { renderAdminDashboardView } from "../views/AdminDashboard";
import { renderAdminTransactionValidationView } from "../views/AdminTransactionValidation";
import { renderAdminManagePartnersView } from "../views/AdminManagePartners";
import { renderAdminManageSubAdminsView } from "../views/AdminManageSubAdmins";
import { renderSubAdminDashboardView } from "../views/SubAdminDashboard";
import { renderAdminCardManagementView } from "../views/AdminCardInventory";
import { renderNewOperationView } from "../views/NewOperation";
import { renderTransactionListView } from "../views/TransactionList";
import { renderPartnerCardStockView } from "../views/PartnerCardStock";
import { renderAdminAgentRechargesView } from "../views/AdminAgentRecharges";
import { renderAdminManageRechargeMethodsView } from "../views/AdminManageRechargeMethods";
import { renderAdminManageUsersView } from "../views/AdminManageUsers";
import { renderAdminRevenueDashboardView } from "../views/AdminRevenueDashboard";
import { renderAdminCommissionConfigView } from "../views/AdminCommissionConfig";
import { renderAllTransactionsView } from "../views/AllTransactions";
import { renderDeveloperDashboardView } from "../views/DeveloperDashboard";
import { renderDeveloperManageOperationTypesView } from "../views/DeveloperManageOperationTypes";

// Import new, refactored views
import { renderProfileView } from '../views/Profile';
import { renderOrderListView } from '../views/OrderList';
import { renderServiceHubView } from '../views/ServiceHub';
import { renderPartnerContractView } from "../views/PartnerContractView";
import { renderAgentRechargeHistoryView } from "../views/AgentRechargeHistory";

const partnerAndAgentServices: NavLink[] = [
    { label: 'Cartes VISA', navId: 'hub_visa', icon: 'fa-credit-card', viewFn: renderServiceHubView('Gestion des Cartes VISA', 'fa-credit-card', [
        { title: 'Lancer une activation', description: 'Activer une nouvelle carte pour un client.', icon: 'fa-check-circle', target: { type: 'view', viewFn: renderNewOperationView, label: 'Activation Carte Prépayée', operationTypeId: 'op_activation_carte', navId: 'op_op_activation_carte' } },
        { title: 'Lancer un rechargement', description: 'Recharger une carte prépayée existante.', icon: 'fa-wallet', target: { type: 'view', viewFn: renderNewOperationView, label: 'Recharge de Carte Prépayée', operationTypeId: 'op_recharge_carte_prepayee', navId: 'op_op_recharge_carte_prepayee' } },
        { title: 'Lancer une désactivation', description: 'Désactiver une carte à la demande.', icon: 'fa-user-slash', target: { type: 'view', viewFn: renderNewOperationView, label: 'Désactivation de Carte', operationTypeId: 'op_deactivate_carte', navId: 'op_op_deactivate_carte' } },
        { title: 'Liste des activations', description: 'Voir l\'historique des activations.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Activations de Cartes', opTypeIds: ['op_activation_carte']}), label: 'Liste des Activations', navId: 'list_visa_activations' } },
        { title: 'Liste des rechargements', description: 'Voir l\'historique des recharges.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Recharges de Cartes', opTypeIds: ['op_recharge_carte_prepayee']}), label: 'Liste des Rechargements', navId: 'list_visa_recharges' } },
    ]) },
    { label: 'Canal+', navId: 'hub_canal', icon: 'fa-satellite-dish', viewFn: renderServiceHubView('Gestion des décodeurs (Canal +)', 'fa-satellite-dish', [
        { title: 'Lancer un recrutement', description: 'Nouvel abonnement sur décodeur.', icon: 'fa-user-plus', target: { type: 'view', viewFn: renderNewOperationView, label: 'Abonnement CANAL+', operationTypeId: 'op_abo_decodeur_canal', navId: 'op_op_abo_decodeur_canal' } },
        { title: 'Lancer un réabonnement', description: 'Renouveler un abonnement existant.', icon: 'fa-redo', target: { type: 'view', viewFn: renderNewOperationView, label: 'Réabonnement Canal+', operationTypeId: 'op_reabo_canal', navId: 'op_op_reabo_canal' } },
        { title: 'Lancer un complément', description: 'Ajouter des options à un abonnement.', icon: 'fa-plus-square', target: { type: 'view', viewFn: renderNewOperationView, label: 'Complément Canal+', operationTypeId: 'op_complement_canal', navId: 'op_op_complement_canal' } },
        { title: 'Liste des recrutements', description: 'Historique des nouveaux abonnements.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Recrutements Canal+', opTypeIds: ['op_abo_decodeur_canal']}), label: 'Liste des Recrutements', navId: 'list_canal_recruitments' } },
        { title: 'Liste des réabonnements', description: 'Historique des renouvellements.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Réabonnements Canal+', opTypeIds: ['op_reabo_canal']}), label: 'Liste des Réabonnements', navId: 'list_canal_resubs' } },
    ]) },
    { label: 'Ecobank Xpress', navId: 'hub_ecobank', icon: 'fa-university', viewFn: renderServiceHubView('Ecobank Xpress', 'fa-university', [
        { title: 'Lancer un dépôt xpress', description: 'Dépôt d\'argent sur un compte Xpress.', icon: 'fa-arrow-down', target: { type: 'view', viewFn: renderNewOperationView, label: 'Dépôt Ecobank Xpress', operationTypeId: 'op_depot_ecobank_xpress', navId: 'op_op_depot_ecobank_xpress' } },
        { title: 'Lancer un retrait xpress', description: 'Retrait d\'argent depuis un compte Xpress.', icon: 'fa-arrow-up', target: { type: 'view', viewFn: renderNewOperationView, label: 'Retrait Ecobank Xpress', operationTypeId: 'op_retrait_ecobank_xpress', navId: 'op_op_retrait_ecobank_xpress' } },
        { title: 'Lancer un rapid transfert', description: 'Transfert rapide vers la sous-région.', icon: 'fa-shipping-fast', target: { type: 'view', viewFn: renderNewOperationView, label: 'Rapid Transfert (Dépôt Régional)', operationTypeId: 'op_rapid_transfert_eco', navId: 'op_op_rapid_transfert_eco' } },
        { title: 'Liste des dépôts', description: 'Historique des dépôts.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Dépôts Xpress', opTypeIds: ['op_depot_ecobank_xpress']}), label: 'Liste des Dépôts', navId: 'list_eco_deposits' } },
        { title: 'Liste des retraits', description: 'Historique des retraits.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Retraits Xpress', opTypeIds: ['op_retrait_ecobank_xpress']}), label: 'Liste des Retraits', navId: 'list_eco_withdrawals' } },
    ]) },
    { label: 'Western Union', navId: 'hub_wu', icon: 'fa-globe-americas', viewFn: renderServiceHubView('Western Union', 'fa-globe-americas', [
        { title: 'Lancer un envoi', description: 'Envoyer de l\'argent via Western Union.', icon: 'fa-paper-plane', target: { type: 'view', viewFn: renderNewOperationView, label: 'Envoi Western Union', operationTypeId: 'op_envoi_wu', navId: 'op_op_envoi_wu' } },
        { title: 'Lancer un retrait', description: 'Recevoir de l\'argent via Western Union.', icon: 'fa-hand-holding-usd', target: { type: 'view', viewFn: renderNewOperationView, label: 'Retrait Western Union', operationTypeId: 'op_retrait_wu', navId: 'op_op_retrait_wu' } },
        { title: 'Liste des envois', description: 'Historique des envois Western Union.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Envois Western Union', opTypeIds: ['op_envoi_wu']}), label: 'Liste des Envois WU', navId: 'list_wu_sends' } },
        { title: 'Liste des retraits', description: 'Historique des retraits Western Union.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Retraits Western Union', opTypeIds: ['op_retrait_wu']}), label: 'Liste des Retraits WU', navId: 'list_wu_receives' } },
    ]) },
    { label: 'Ria', navId: 'hub_ria', icon: 'fa-comments-dollar', viewFn: renderServiceHubView('Ria', 'fa-comments-dollar', [
        { title: 'Lancer un envoi', description: 'Envoyer de l\'argent via Ria.', icon: 'fa-paper-plane', target: { type: 'view', viewFn: renderNewOperationView, label: 'Envoi Ria', operationTypeId: 'op_envoi_ria', navId: 'op_op_envoi_ria' } },
        { title: 'Lancer un retrait', description: 'Recevoir de l\'argent via Ria.', icon: 'fa-hand-holding-usd', target: { type: 'view', viewFn: renderNewOperationView, label: 'Retrait Ria', operationTypeId: 'op_retrait_ria', navId: 'op_op_retrait_ria' } },
        { title: 'Liste des envois', description: 'Historique des envois Ria.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Envois Ria', opTypeIds: ['op_envoi_ria']}), label: 'Liste des Envois Ria', navId: 'list_ria_sends' } },
        { title: 'Liste des retraits', description: 'Historique des retraits Ria.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Retraits Ria', opTypeIds: ['op_retrait_ria']}), label: 'Liste des Retraits Ria', navId: 'list_ria_receives' } },
    ]) },
    { label: 'MoneyGram', navId: 'hub_mg', icon: 'fa-dollar-sign', viewFn: renderServiceHubView('MoneyGram', 'fa-dollar-sign', [
        { title: 'Lancer un envoi', description: 'Envoyer de l\'argent via MoneyGram.', icon: 'fa-paper-plane', target: { type: 'view', viewFn: renderNewOperationView, label: 'Envoi MoneyGram', operationTypeId: 'op_envoi_mg', navId: 'op_op_envoi_mg' } },
        { title: 'Lancer un retrait', description: 'Recevoir de l\'argent via MoneyGram.', icon: 'fa-hand-holding-usd', target: { type: 'view', viewFn: renderNewOperationView, label: 'Retrait MoneyGram', operationTypeId: 'op_retrait_mg', navId: 'op_op_retrait_mg' } },
        { title: 'Liste des envois', description: 'Historique des envois MoneyGram.', icon: 'fa-list-alt', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Envois MoneyGram', opTypeIds: ['op_envoi_mg']}), label: 'Liste des Envois MG', navId: 'list_mg_sends' } },
        { title: 'Liste des retraits', description: 'Historique des retraits MoneyGram.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Retraits MoneyGram', opTypeIds: ['op_retrait_mg']}), label: 'Liste des Retraits MG', navId: 'list_mg_receives' } },
    ]) },
    { label: 'Paiement de Factures', navId: 'hub_bills', icon: 'fa-file-invoice-dollar', viewFn: renderServiceHubView('Paiement de Factures', 'fa-file-invoice-dollar', [
        { title: 'Paiement de Facture', description: 'Payer une facture (SDE, Senelec, etc).', icon: 'fa-bolt', target: { type: 'view', viewFn: renderNewOperationView, label: 'Paiement de Facture', operationTypeId: 'op_paiement_facture', navId: 'op_op_paiement_facture' } },
        { title: 'Liste des factures', description: 'Historique des paiements.', icon: 'fa-history', target: { type: 'view', viewFn: renderTransactionListView({ title: 'Historique des Paiements de Factures', opTypeIds: ['op_paiement_facture', 'op_paiement_sde']}), label: 'Liste des Factures', navId: 'list_bill_payments' } },
    ]) },
];


export const navigationLinks: Record<UserRole, NavLink[]> = {
    agent: [
        { label: 'Tableau de Bord', navId: 'agent_dashboard', icon: 'fa-tachometer-alt', viewFn: renderAgentDashboardView },
        { 
            label: 'Services', 
            navId: 'agent_services', 
            icon: 'fa-concierge-bell',
            children: partnerAndAgentServices,
        },
        { 
            label: 'Mon Activité', 
            navId: 'agent_activity', 
            icon: 'fa-history',
            children: [
                { label: 'Historique des Opérations', navId: 'agent_history_ops', icon: 'fa-exchange-alt', viewFn: renderAgentTransactionHistoryView },
                { label: 'Historique des Recharges', navId: 'agent_history_recharges', icon: 'fa-wallet', viewFn: renderAgentRechargeHistoryView },
            ]
        },
        { label: 'Demander Recharge', navId: 'agent_request_recharge', icon: 'fa-hand-holding-usd', action: () => document.body.dispatchEvent(new CustomEvent('openAgentRechargeModal')) },
        { label: 'Mon Profil', navId: 'agent_profile', icon: 'fa-user-circle', viewFn: renderProfileView },
    ],
    partner: [
        { label: 'Dashboard Partenaire', navId: 'partner_dashboard', icon: 'fa-chart-line', viewFn: renderPartnerDashboardView },
        { 
            label: 'Gestion des Services', 
            navId: 'partner_services', 
            icon: 'fa-concierge-bell',
            children: partnerAndAgentServices,
        },
        {
            label: 'Gestion d\'Agence',
            navId: 'partner_agency_management',
            icon: 'fa-briefcase',
            children: [
                { label: 'Gérer mes Utilisateurs', navId: 'partner_manage_users', icon: 'fa-users-cog', viewFn: renderPartnerManageUsersView },
                { label: 'Mon Stock de Cartes', navId: 'partner_card_stock', icon: 'fa-layer-group', viewFn: renderPartnerCardStockView },
                { label: 'Bons de Commande', navId: 'partner_orders', icon: 'fa-receipt', viewFn: renderOrderListView },
            ]
        },
        { 
            label: 'Rapports & Suivi', 
            navId: 'partner_reports_parent', 
            icon: 'fa-chart-bar', 
            children: [
                { label: 'Mon Contrat & Commissions', navId: 'partner_contract', icon: 'fa-file-signature', viewFn: renderPartnerContractView },
                { label: 'Commissions (Ancien)', navId: 'partner_reports', icon: 'fa-coins', viewFn: renderPartnerCommissionsView },
                { label: 'Toutes les Opérations', navId: 'partner_all_transactions', icon: 'fa-list-ul', viewFn: renderAllTransactionsView },
            ]
        },
        { label: 'Mon Profil', navId: 'partner_profile', icon: 'fa-user-circle', viewFn: renderProfileView },
    ],
    admin_general: [
        { label: 'Dashboard Écosystème', navId: 'admin_dashboard', icon: 'fa-globe-americas', viewFn: renderAdminDashboardView },
        { 
            label: 'Pilotage Financier', 
            navId: 'admin_financials_parent', 
            icon: 'fa-chart-pie',
            children: [
                 { label: 'Dashboard Revenus', navId: 'admin_revenue', icon: 'fa-chart-pie', viewFn: renderAdminRevenueDashboardView },
                 { label: 'Toutes les Opérations', navId: 'admin_all_transactions', icon: 'fa-list-ul', viewFn: renderAllTransactionsView },
            ]
        },
        { label: 'Validation Transactions', navId: 'admin_validate_tx', icon: 'fa-check-double', viewFn: (user: User) => renderAdminTransactionValidationView(user, 'unassigned') },
        { label: 'Recharges Agents', navId: 'admin_agent_recharges', icon: 'fa-wallet', viewFn: renderAdminAgentRechargesView },
        {
            label: 'Gestion des Utilisateurs',
            navId: 'admin_user_management',
            icon: 'fa-users-cog',
            children: [
                { label: 'Gestion des Partenaires', navId: 'admin_manage_partners', icon: 'fa-building', viewFn: renderAdminManagePartnersView },
                { label: 'Tous les Utilisateurs', navId: 'admin_manage_users', icon: 'fa-users', viewFn: renderAdminManageUsersView },
                { label: 'Gestion Sous-Admins', navId: 'admin_manage_subadmins', icon: 'fa-user-shield', viewFn: renderAdminManageSubAdminsView },
            ]
        },
        {
            label: 'Outils Système',
            navId: 'admin_system_tools',
            icon: 'fa-tools',
            children: [
                { label: 'Gestion des Cartes', navId: 'admin_card_management', icon: 'fa-credit-card', viewFn: renderAdminCardManagementView },
                { label: 'Contrats & Commissions', navId: 'admin_commission_config', icon: 'fa-file-signature', viewFn: renderAdminCommissionConfigView },
                { label: 'Modes de Recharge Agent', navId: 'admin_config_recharge_methods', icon: 'fa-cash-register', viewFn: renderAdminManageRechargeMethodsView },
            ]
        }
    ],
    sous_admin: [
        { label: 'Tableau de Bord', navId: 'subadmin_dashboard', icon: 'fa-tachometer-alt', viewFn: renderSubAdminDashboardView },
        { label: 'Validation Transactions', navId: 'subadmin_validate_tx', icon: 'fa-check-square', viewFn: (user: User) => renderAdminTransactionValidationView(user, 'unassigned') },
    ],
    developer: [
        { label: 'Developer Dashboard', navId: 'dev_dashboard', icon: 'fa-code', viewFn: renderDeveloperDashboardView },
        {
            label: 'System Configuration',
            navId: 'dev_system_config',
            icon: 'fa-cogs',
            children: [
                { label: 'Operation Types', navId: 'dev_manage_op_types', icon: 'fa-stream', viewFn: renderDeveloperManageOperationTypesView },
                { label: 'Commission Profiles', navId: 'admin_commission_config', icon: 'fa-file-signature', viewFn: renderAdminCommissionConfigView },
                { label: 'Recharge Methods', navId: 'admin_config_recharge_methods', icon: 'fa-cash-register', viewFn: renderAdminManageRechargeMethodsView },
            ]
        },
        {
            label: 'Data Management',
            navId: 'dev_data_management',
            icon: 'fa-database',
            children: [
                { label: 'All Users', navId: 'admin_manage_users', icon: 'fa-users', viewFn: renderAdminManageUsersView },
                { label: 'Partners', navId: 'admin_manage_partners', icon: 'fa-building', viewFn: renderAdminManagePartnersView },
                { label: 'Card Inventory', navId: 'admin_card_management', icon: 'fa-credit-card', viewFn: renderAdminCardManagementView },
            ]
        },
    ],
};