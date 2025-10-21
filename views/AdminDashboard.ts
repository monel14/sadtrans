import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { formatAmount, formatDate, formatNumber } from '../utils/formatters';
import { renderAdminTransactionValidationView } from './AdminTransactionValidation';
import { renderAdminAgentRechargesView } from './AdminAgentRecharges';
import { renderAdminManagePartnersView } from './AdminManagePartners';
// FIX: Corrected the import name to match the exported function from AdminCardInventory.ts.
import { renderAdminCardManagementView } from './AdminCardInventory';
import { createTable } from '../components/Table';
import { createCard } from '../components/Card';
import { NotificationIntegration } from '../utils/notification-integration';
import { createNotificationToggle } from '../components/NotificationSettings';

// Helper function to create a KPI card
function createKpiCard(title: string, value: string, icon: string): string {
    return `
        <div class="card flex-1">
            <div class="flex items-center">
                <div class="p-3 rounded-full bg-violet-100 text-violet-600 mr-4">
                    <i class="fas ${icon} fa-lg"></i>
                </div>
                <div>
                    <p class="text-sm text-slate-500">${title}</p>
                    <p class="text-2xl font-bold text-slate-800">${value}</p>
                </div>
            </div>
        </div>
    `;
}

// Helper to create an item list for a queue
function createQueueList(items: { html: string, actionNavId?: string }[]): HTMLElement {
    const container = document.createElement('div');
    if (items.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500 px-4 py-2">Aucun élément dans la file.</p>';
        return container;
    }

    const list = document.createElement('ul');
    list.className = 'divide-y divide-slate-200';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'p-3 text-sm text-slate-600';
        li.innerHTML = item.html;
        list.appendChild(li);
    });

    container.appendChild(list);
    return container;
}


// Helper to create a queue card
function createQueueCard(
    title: string,
    count: number,
    colorClass: string,
    icon: string,
    contentElement: HTMLElement,
    navId: string
): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-start mb-2';
    header.innerHTML = `
        <div>
            <h3 class="font-semibold text-slate-800">${title}</h3>
            <p class="text-2xl font-bold ${colorClass}">${count}</p>
        </div>
        <i class="fas ${icon} text-2xl text-slate-300"></i>
    `;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'flex-grow my-2 -mx-6';
    contentWrapper.appendChild(contentElement);

    const footer = document.createElement('div');
    footer.className = 'mt-auto text-right';
    footer.innerHTML = `
        <button data-nav-id="${navId}" class="btn btn-sm btn-outline-secondary">Tout Gérer <i class="fas fa-arrow-right ml-2 text-xs"></i></button>
    `;

    card.appendChild(header);
    card.appendChild(contentWrapper);
    card.appendChild(footer);

    return card;
}

export async function renderAdminDashboardView(user: User): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    const container = document.createElement('div');
    container.id = 'admin-dashboard-container';

    const [
        allUsers,
        allPartners,
        allTransactions,
        allPendingAgentRecharges,
        userMap,
        partnerMap,
        opTypeMap,
        methodMap,
    ] = await Promise.all([
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getTransactions(),
        dataService.getAgentRechargeRequests({ status: 'En attente' }),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getOpTypeMap(),
        dataService.getMethodMap(),
    ]);

    const allPendingTransactions = allTransactions.filter(t => t.statut.includes('En attente') || t.statut.includes('Assignée'));
    const unassignedTransactions = allPendingTransactions.filter(t => !t.assignedTo);
    const pendingTransactionsForQueue = unassignedTransactions.slice(0, 4);

    const pendingAgentRecharges = allPendingAgentRecharges.slice(0, 3);

    const pendingTransactionsCount = unassignedTransactions.length;
    const pendingAgentRechargesCount = allPendingAgentRecharges.length;

    // --- Dynamic KPI Calculations ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions = allTransactions.filter(t => new Date(t.date) >= startOfMonth && t.statut === 'Validé');
    const monthlyVolume = monthlyTransactions.reduce((sum, tx) => sum + tx.montant_principal, 0);
    const monthlyOperationsCount = monthlyTransactions.length;

    // --- Prepare data for queues ---
    const transactionItems = pendingTransactionsForQueue.map(t => {
        const agent = userMap.get(t.agentId);
        const opType = opTypeMap.get(t.opTypeId);

        let assignOtherButton = '';
        // Bouton d'assignation à un sous-admin retiré

        const amountDisplay = opType?.impactsBalance
            ? `<p class="font-semibold">${formatAmount(t.montant_principal)} <span class="font-normal text-slate-500">- ${opType?.name || 'Opération'}</span></p>`
            : `<p class="font-semibold text-blue-600">Demande de Service <span class="font-normal text-slate-500">- ${opType?.name || 'Opération'}</span></p>`;

        return {
            html: `
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex-grow">
                        ${amountDisplay}
                        <p class="text-xs">par ${agent?.name || 'Inconnu'}</p>
                    </div>
                    <div class="flex items-center gap-1 self-end sm:self-center">
                        <button class="btn btn-xs btn-success !py-1 !px-2" data-task-id="${t.id}" data-action="assign-self" title="S'assigner"><i class="fas fa-user-plus mr-1"></i>S'assigner</button>
                        ${assignOtherButton}
                    </div>
                </div>
            `
        };
    });

    const rechargeItems = pendingAgentRecharges.map(r => {
        const agent = userMap.get(r.agentId);
        // FIX: Use `methodId` and `notes` to match the AgentRechargeRequest model.
        const method = methodMap.get(r.methodId);
        const referenceText = r.notes ? ` (${r.notes})` : '';
        return {
            html: `
            <div class="leading-tight">
                <div class="flex justify-between items-center">
                    <span><strong>${formatAmount(r.montant)}</strong> par ${agent?.name || 'Inconnu'}</span>
                    <span class="text-xs text-slate-400">${formatDate(r.date).split(' ')[0]}</span>
                </div>
                <div class="text-xs text-slate-500 mt-1">
                    Via: ${method?.name || 'Inconnu'}${referenceText}
                </div>
            </div>
        `};
    });

    // --- Prepare data for Partner Performance table ---
    const partnerPerformanceData = allPartners.map(partner => {
        const agents = allUsers.filter(u => u.role === 'agent' && u.partnerId === partner.id);
        const agentIds = agents.map(a => a.id);
        const partnerTransactions = allTransactions.filter(t => agentIds.includes(t.agentId) && t.statut === 'Validé');

        const volume = partnerTransactions.reduce((sum, t) => sum + t.montant_principal, 0);
        const partnerCommission = partnerTransactions.reduce((sum, t) => sum + t.commission_partenaire, 0);
        const companyCommission = partnerTransactions.reduce((sum, t) => sum + t.commission_societe, 0);

        return [
            `<span class="font-semibold">${partner.name}</span>`,
            formatAmount(volume),
            partnerTransactions.length,
            `<span class="font-semibold text-blue-600">${formatAmount(partnerCommission)}</span>`,
            `<span class="font-semibold text-emerald-600">${formatAmount(companyCommission)}</span>`,
        ];
    });

    // --- Prepare data for Recent Validated Transactions list ---
    const recentValidatedTransactions = allTransactions
        .filter(t => t.statut === 'Validé')
        .slice(0, 5);

    const recentActivityHtml = recentValidatedTransactions.length > 0
        ? `<ul class="space-y-3">
            ${recentValidatedTransactions.map(t => {
            const agent = userMap.get(t.agentId);
            const partner = agent ? partnerMap.get(agent.partnerId!) : null;
            const opType = opTypeMap.get(t.opTypeId);
            return `
                    <li class="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                        <div>
                            <p class="font-medium text-slate-700">${opType?.name || 'Opération'}</p>
                            <p class="text-xs text-slate-500">Par ${agent?.name || '?'} (${partner?.name || '?'})</p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold">${formatAmount(t.montant_principal)}</p>
                            <p class="text-xs text-slate-400">${formatDate(t.date)}</p>
                        </div>
                    </li>
                `;
        }).join('')}
           </ul>`
        : '<p class="text-sm text-slate-500 text-center py-4">Aucune opération validée récemment.</p>';

    container.innerHTML = `
        <!-- KPIs Row -->
        <div class="flex flex-col lg:flex-row gap-4 mb-6">
            ${createKpiCard('Volume Total (Mois)', formatAmount(monthlyVolume), 'fa-chart-line')}
            ${createKpiCard('Opérations (Mois)', formatNumber(monthlyOperationsCount), 'fa-exchange-alt')}
            ${createKpiCard('Partenaires Actifs', String(allPartners.length), 'fa-building')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Column -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Queues Section -->
                <div id="queues-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Cards will be injected here -->
                </div>
                
                <!-- New Platform Activity Section -->
                <div id="platform-activity-card-container"></div>
            </div>
            
            <!-- Side Column -->
            <div class="lg:col-span-1 space-y-6">
                 <div class="card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                        <i class="fas fa-rocket mr-3 text-violet-500"></i>Accès Rapides
                    </h3>
                    <div class="grid grid-cols-2 gap-3">
                        <button data-nav-id="admin_manage_partners" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
                            <i class="fas fa-building text-xl text-slate-500 mb-2"></i>
                            <span class="text-xs font-semibold text-slate-700">Partenaires</span>
                        </button>
                        <button data-nav-id="admin_manage_cards" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
                            <i class="fas fa-credit-card text-xl text-slate-500 mb-2"></i>
                            <span class="text-xs font-semibold text-slate-700">Cartes</span>
                        </button>
                         <button data-nav-id="admin_manage_users" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
                            <i class="fas fa-users text-xl text-slate-500 mb-2"></i>
                            <span class="text-xs font-semibold text-slate-700">Utilisateurs</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Inject queue cards
    const queuesGrid = container.querySelector('#queues-grid');
    if (queuesGrid) {
        queuesGrid.appendChild(createQueueCard(
            'Validations en Attente',
            pendingTransactionsCount,
            'text-amber-500',
            'fa-tasks',
            createQueueList(transactionItems),
            'admin_validate_tx'
        ));
        queuesGrid.appendChild(createQueueCard(
            'Recharges Agents',
            pendingAgentRechargesCount,
            'text-purple-500',
            'fa-wallet',
            createQueueList(rechargeItems),
            'admin_agent_recharges'
        ));
    }

    // Create and inject Platform Activity Card
    const activityCardContent = document.createElement('div');
    activityCardContent.innerHTML = `
        <h4 class="text-md font-semibold text-slate-700 mb-3">Performance des Partenaires</h4>
    `;
    const partnerTable = createTable(
        ['Partenaire', 'Volume d\'Affaires', 'Nb. Trans.', 'Commission Partenaire', 'Commission Société'],
        partnerPerformanceData
    );
    activityCardContent.appendChild(partnerTable);
    activityCardContent.innerHTML += `
        <h4 class="text-md font-semibold text-slate-700 mb-3 mt-6">Dernières Opérations Validées</h4>
        ${recentActivityHtml}
    `;
    const activityCard = createCard('Activité de la Plateforme', activityCardContent, 'fa-analytics');
    container.querySelector('#platform-activity-card-container')?.appendChild(activityCard);


    const navMap: { [key: string]: { viewFn: Function, label: string, navId: string } } = {
        'admin_validate_tx': { viewFn: (user: User) => renderAdminTransactionValidationView(user, 'unassigned'), label: 'Validation Transactions', navId: 'admin_validate_tx' },
        'admin_agent_recharges': { viewFn: renderAdminAgentRechargesView, label: 'Recharges Agents', navId: 'admin_agent_recharges' },
        'admin_manage_partners': { viewFn: renderAdminManagePartnersView, label: 'Gestion des Partenaires', navId: 'admin_manage_partners' },
        // FIX: Use the correct function name for rendering the card management view.
        'admin_manage_cards': { viewFn: renderAdminCardManagementView, label: 'Gestion des Cartes', navId: 'admin_manage_cards' },
        'admin_manage_users': { viewFn: (user: User) => import('../views/AdminManageUsers').then(m => m.renderAdminManageUsersView()), label: 'Tous les Utilisateurs', navId: 'admin_manage_users' },
    };

    // Écouter les événements de mise à jour des données avec debouncing
    let refreshTimeout: number | null = null;

    const handleDataUpdate = async (event: Event) => {
        const customEvent = event as CustomEvent;
        console.log('🔄 Dashboard received data update:', customEvent.detail);

        // Debouncing pour éviter les rechargements multiples
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }

        refreshTimeout = window.setTimeout(async () => {
            try {
                // Vérifier que le container est toujours dans le DOM
                if (!container.parentElement) {
                    console.log('Dashboard container no longer in DOM, skipping refresh');
                    return;
                }

                console.log('🔄 Refreshing dashboard...');
                const newDashboard = await renderAdminDashboardView(user);
                const parent = container.parentElement;
                if (parent) {
                    parent.replaceChild(newDashboard, container);
                }
            } catch (error) {
                console.error('Erreur lors du rechargement du dashboard:', error);
            }
        }, 500); // Attendre 500ms avant de rafraîchir
    };

    // Écouter uniquement l'événement unifié dataUpdated
    container.addEventListener('forceRefresh', handleDataUpdate);
    document.body.addEventListener('dataUpdated', handleDataUpdate);

    // Main event listener for the entire dashboard
    container.addEventListener('click', async e => {
        const target = e.target as HTMLElement;
        const navButton = target.closest<HTMLButtonElement>('[data-nav-id]');
        const actionButton = target.closest<HTMLButtonElement>('[data-action]');

        // Handle navigation buttons
        if (navButton) {
            e.preventDefault();
            const navId = navButton.dataset.navId;
            if (navId && navMap[navId]) {
                const { viewFn, label, navId: detailNavId } = navMap[navId];
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn, label, navId: detailNavId },
                    bubbles: true, composed: true
                }));
            }
            return;
        }

        // Handle action buttons within queues
        if (actionButton) {
            const taskId = actionButton.dataset.taskId;
            const action = actionButton.dataset.action;

            if (!taskId) return;

            const reloadDashboard = async () => {
                const newDashboard = await renderAdminDashboardView(user);
                const parent = container.parentElement;
                if (parent) {
                    parent.replaceChild(newDashboard, container);
                }
            };

            if (action === 'assign-self') {
                actionButton.disabled = true;
                actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                await api.assignTask(taskId, 'transaction', user.id);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Tâche ${taskId} assignée.`, type: 'success' } }));
                await reloadDashboard();
            }
            // Action d'assignation à un sous-admin retirée
        }
    });

    return container;
}