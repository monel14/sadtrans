import { User } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatDate, formatNumber } from '../utils/formatters';
import { renderDeveloperManageOperationTypesView } from './DeveloperManageOperationTypes';
import { renderAdminCommissionConfigView } from './AdminCommissionConfig';
import { renderAuditLogView } from './shared/AuditLog';

// Helper function to create a KPI card
function createKpiCard(title: string, value: string, icon: string, color: string = 'violet'): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card flex-1';
    card.innerHTML = `
        <div class="flex items-center">
            <div class="p-3 rounded-full bg-${color}-100 text-${color}-600 mr-4">
                <i class="fas ${icon} fa-lg"></i>
            </div>
            <div>
                <p class="text-sm text-slate-500">${title}</p>
                <p class="text-2xl font-bold text-slate-800">${value}</p>
            </div>
        </div>
    `;
    return card;
}

export async function renderDeveloperDashboardView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const container = document.createElement('div');
    
    const [
        allUsers,
        allPartners,
        allTransactions,
        allOperationTypes,
        auditLogs
    ] = await Promise.all([
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getTransactions(),
        dataService.getAllOperationTypes(),
        dataService.getAuditLogs()
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    const transactionsToday = allTransactions.filter(t => t.date.startsWith(today)).length;
    
    container.innerHTML = `
        <!-- KPIs Row -->
        <div id="kpi-grid" class="flex flex-col lg:flex-row gap-4 mb-6"></div>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Column -->
            <div class="lg:col-span-2 space-y-6">
                <div id="quick-access-card-container"></div>
                <div id="recent-activity-card-container"></div>
            </div>
            
            <!-- Side Column -->
            <div class="lg:col-span-1 space-y-6">
                <!-- System Status Card Removed -->
            </div>
        </div>
    `;

    // --- Inject KPI Cards ---
    const kpiGrid = container.querySelector('#kpi-grid');
    if (kpiGrid) {
        kpiGrid.appendChild(createKpiCard('Total Users', formatNumber(allUsers.length), 'fa-users'));
        kpiGrid.appendChild(createKpiCard('Total Partners', formatNumber(allPartners.length), 'fa-building'));
        kpiGrid.appendChild(createKpiCard('Total Operation Types', formatNumber(allOperationTypes.length), 'fa-stream'));
        kpiGrid.appendChild(createKpiCard('Transactions (Today)', formatNumber(transactionsToday), 'fa-exchange-alt'));
    }

    // --- Inject Quick Access Card ---
    const quickAccessContent = document.createElement('div');
    quickAccessContent.className = 'grid grid-cols-2 md:grid-cols-3 gap-3';
    quickAccessContent.innerHTML = `
        <button data-nav-id="dev_manage_op_types" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-stream text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Operation Types</span>
        </button>
        <button data-nav-id="admin_commission_config" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-file-signature text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Commission Profiles</span>
        </button>
         <button data-nav-id="admin_audit_log" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-clipboard-list text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Audit Log</span>
        </button>
        <a href="https://supabase.com/dashboard/project/fmdefcgenhfesdxozvxz" target="_blank" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-external-link-alt text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Supabase Project</span>
        </a>
    `;
    const quickAccessCard = createCard('Developer Tools', quickAccessContent, 'fa-tools');
    container.querySelector('#quick-access-card-container')?.appendChild(quickAccessCard);

    // --- Inject Recent Activity Card ---
    const recentActivityContent = document.createElement('ul');
    recentActivityContent.className = 'space-y-3';
    const userMap = await dataService.getUserMap();
    auditLogs.slice(0, 5).forEach(log => {
        const user = userMap.get(log.user_id);
        const li = document.createElement('li');
        li.className = 'flex items-center text-sm p-2 bg-slate-50 rounded-md';
        li.innerHTML = `
            <i class="fas fa-history text-slate-400 w-8 text-center"></i>
            <div class="flex-grow">
                <p class="font-medium text-slate-700">${log.action.replace(/_/g, ' ')}</p>
                <p class="text-xs text-slate-500">By ${user?.name || 'System'} on entity ${log.entity_id || 'N/A'}</p>
            </div>
            <p class="text-xs text-slate-400">${formatDate(log.created_at)}</p>
        `;
        recentActivityContent.appendChild(li);
    });
    const recentActivityCard = createCard('Recent System Activity', recentActivityContent, 'fa-history');
    container.querySelector('#recent-activity-card-container')?.appendChild(recentActivityCard);
    
    // --- Event Listeners ---
    const navMap: { [key: string]: { viewFn: Function, label: string, navId: string } } = {
        'dev_manage_op_types': { viewFn: renderDeveloperManageOperationTypesView, label: 'Manage Operation Types', navId: 'dev_manage_op_types' },
        'admin_commission_config': { viewFn: renderAdminCommissionConfigView, label: 'Contrats & Commissions', navId: 'admin_commission_config' },
        'admin_audit_log': { viewFn: renderAuditLogView, label: 'Journal d\'Audit', navId: 'admin_audit_log' },
    };

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const navButton = target.closest<HTMLButtonElement>('[data-nav-id]');
        if (navButton) {
            e.preventDefault();
            const navId = navButton.dataset.navId;
            if (navId && navMap[navId]) {
                const navDetail = navMap[navId];
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: navDetail,
                    bubbles: true, composed: true
                }));
            }
        }
    });

    return container;
}