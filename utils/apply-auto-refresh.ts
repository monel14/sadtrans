/**
 * Application du rafraîchissement automatique à toutes les vues importantes
 */

import { wrapWithAutoRefresh } from './auto-refresh-wrapper';

// Import des vues à wrapper
import { renderAdminTransactionValidationView } from '../views/AdminTransactionValidation';
import { renderAdminAgentRechargesView } from '../views/AdminAgentRecharges';
import { renderAllTransactionsView } from '../views/AllTransactions';
import { renderAgentTransactionHistoryView } from '../views/AgentTransactionHistory';
import { renderAgentRechargeHistoryView } from '../views/AgentRechargeHistory';
import { renderPartnerDashboardView } from '../views/PartnerDashboard';
import { renderAdminDashboardView } from '../views/AdminDashboard';
import { renderPartnerManageUsersView } from '../views/PartnerManageUsers';
import { renderAdminManageUsersView } from '../views/AdminManageUsers';

// Wrapper les vues avec rafraîchissement automatique
export const renderAdminTransactionValidationViewWithRefresh = wrapWithAutoRefresh(
    renderAdminTransactionValidationView,
    {
        viewId: 'admin-transaction-validation',
        dataTypes: ['transactions', 'users'],
        refreshIntervalMs: 30000 // Rafraîchir toutes les 30 secondes
    }
);

export const renderAdminAgentRechargesViewWithRefresh = wrapWithAutoRefresh(
    renderAdminAgentRechargesView,
    {
        viewId: 'admin-agent-recharges',
        dataTypes: ['recharges', 'users'],
        refreshIntervalMs: 30000
    }
);

export const renderAllTransactionsViewWithRefresh = wrapWithAutoRefresh(
    renderAllTransactionsView,
    {
        viewId: 'all-transactions',
        dataTypes: ['transactions', 'users', 'partners', 'operations'],
        refreshIntervalMs: 60000 // Rafraîchir toutes les minutes
    }
);

export const renderAgentTransactionHistoryViewWithRefresh = wrapWithAutoRefresh(
    renderAgentTransactionHistoryView,
    {
        viewId: 'agent-transaction-history',
        dataTypes: ['transactions', 'operations'],
        refreshIntervalMs: 60000
    }
);

export const renderAgentRechargeHistoryViewWithRefresh = wrapWithAutoRefresh(
    renderAgentRechargeHistoryView,
    {
        viewId: 'agent-recharge-history',
        dataTypes: ['recharges'],
        refreshIntervalMs: 60000
    }
);

export const renderPartnerDashboardViewWithRefresh = wrapWithAutoRefresh(
    renderPartnerDashboardView,
    {
        viewId: 'partner-dashboard',
        dataTypes: ['transactions', 'users', 'recharges'],
        refreshIntervalMs: 60000
    }
);

export const renderAdminDashboardViewWithRefresh = wrapWithAutoRefresh(
    renderAdminDashboardView,
    {
        viewId: 'admin-dashboard',
        dataTypes: ['transactions', 'users', 'recharges', 'partners'],
        refreshIntervalMs: 60000
    }
);

export const renderPartnerManageUsersViewWithRefresh = wrapWithAutoRefresh(
    renderPartnerManageUsersView,
    {
        viewId: 'partner-manage-users',
        dataTypes: ['users'],
        refreshIntervalMs: 120000 // Rafraîchir toutes les 2 minutes
    }
);

export const renderAdminManageUsersViewWithRefresh = wrapWithAutoRefresh(
    renderAdminManageUsersView,
    {
        viewId: 'admin-manage-users',
        dataTypes: ['users', 'partners'],
        refreshIntervalMs: 120000
    }
);

/**
 * Fonction utilitaire pour obtenir la vue avec rafraîchissement selon le nom
 */
export function getRefreshableView(viewName: string): any {
    const viewMap: Record<string, any> = {
        'renderAdminTransactionValidationView': renderAdminTransactionValidationViewWithRefresh,
        'renderAdminAgentRechargesView': renderAdminAgentRechargesViewWithRefresh,
        'renderAllTransactionsView': renderAllTransactionsViewWithRefresh,
        'renderAgentTransactionHistoryView': renderAgentTransactionHistoryViewWithRefresh,
        'renderAgentRechargeHistoryView': renderAgentRechargeHistoryViewWithRefresh,
        'renderPartnerDashboardView': renderPartnerDashboardViewWithRefresh,
        'renderAdminDashboardView': renderAdminDashboardViewWithRefresh,
        'renderPartnerManageUsersView': renderPartnerManageUsersViewWithRefresh,
        'renderAdminManageUsersView': renderAdminManageUsersViewWithRefresh,
    };
    
    return viewMap[viewName];
}