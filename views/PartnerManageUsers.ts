
import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { formatAmount, formatDate } from '../utils/formatters';
import { $ } from '../utils/dom';

// Variables pour la pagination
let ITEMS_PER_PAGE = 20;
let currentPage = 1;

// Structure for calculated stats per agent
interface AgentStats {
    volume: number;
    commissions: number;
    transactionCount: number;
    lastActivity: string | null;
}

export async function renderPartnerManageUsersView(partnerUser: User): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();

    // --- 1. DATA FETCHING ---
    // Invalidate cache to get fresh data
    dataService.invalidateUsersCache();
    
    // Pour les statistiques, nous avons encore besoin de toutes les transactions
    const allTransactions = await dataService.getTransactions();

    // Utiliser la pagination côté serveur pour les utilisateurs
    let paginatedUsers: User[] = [];
    let totalUsersCount = 0;
    let myAgentIds: string[] = [];

    async function loadPaginatedUsers(searchTerm = '', statusFilter = 'all') {
        const result = await api.getUsersPaginated({
            role: 'agent',
            partnerId: partnerUser.partnerId,
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: searchTerm || undefined,
            page: currentPage,
            limit: ITEMS_PER_PAGE
        });
        
        paginatedUsers = result.users;
        totalUsersCount = result.totalCount;
        myAgentIds = paginatedUsers.map(a => a.id);
        
        return result;
    }

    // Chargement initial
    await loadPaginatedUsers();

    // --- 2. STATS CALCULATION ---
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const agentStats: Map<string, AgentStats> = new Map(myAgentIds.map(id => [id, {
        volume: 0,
        commissions: 0,
        transactionCount: 0,
        lastActivity: null
    }]));

    function calculateStats() {
        // Reset stats for current page users
        const currentAgentStats: Map<string, AgentStats> = new Map(myAgentIds.map(id => [id, {
            volume: 0,
            commissions: 0,
            transactionCount: 0,
            lastActivity: null
        }]));

        // Calculate stats per agent for current page
        allTransactions.forEach(tx => {
            if (myAgentIds.includes(tx.agentId)) {
                const txDate = new Date(tx.date);
                const stats = currentAgentStats.get(tx.agentId)!;

                // Update last activity
                if (!stats.lastActivity || txDate > new Date(stats.lastActivity)) {
                    stats.lastActivity = tx.date;
                }

                // Aggregate stats for last 30 days
                if (txDate >= thirtyDaysAgo && tx.statut === 'Validé') {
                    stats.volume += tx.montant_principal;
                    stats.commissions += tx.commission_partenaire;
                    stats.transactionCount++;
                }
            }
        });

        return currentAgentStats;
    }

    // Calculate overall agency KPIs for the last 30 days (pour tous les agents de l'agence)
    const allAgencyTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= thirtyDaysAgo && tx.statut === 'Validé';
    });
    
    const totalVolume30d = allAgencyTransactions.reduce((sum, tx) => sum + tx.montant_principal, 0);
    const totalCommissions30d = allAgencyTransactions.reduce((sum, tx) => sum + tx.commission_partenaire, 0);
    const activeAgents = totalUsersCount; // Approximation basée sur le total paginé

    // --- 3. UI RENDERING ---
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Gestion des Utilisateurs de l'Agence</h2>
                <p class="text-sm text-gray-500">Supervisez, gérez et analysez la performance de vos agents.</p>
            </div>
            <button id="create-agent-btn" class="btn btn-success w-full md:w-auto"><i class="fas fa-user-plus mr-2"></i>Créer un Utilisateur</button>
        </div>

        <!-- KPIs -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="card p-4">
                <p class="text-sm text-slate-500">Total Agents</p>
                <p class="text-3xl font-bold text-slate-800">${totalUsersCount}</p>
            </div>
            <div class="card p-4">
                <p class="text-sm text-slate-500">Volume d'Affaires (30j)</p>
                <p class="text-3xl font-bold text-slate-800">${formatAmount(totalVolume30d)}</p>
            </div>
            <div class="card p-4">
                <p class="text-sm text-slate-500">Commissions Agence (30j)</p>
                <p class="text-3xl font-bold text-emerald-600">${formatAmount(totalCommissions30d)}</p>
            </div>
        </div>

        <!-- Filter/Search Bar -->
        <div class="card !p-4 mb-4 flex flex-col md:flex-row gap-4">
            <div class="relative flex-grow">
                <input type="text" id="user-search-input" placeholder="Rechercher par nom ou email..." class="form-input pl-10 w-full">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
            <div class="flex items-center space-x-2" id="status-filter-buttons">
                <span class="text-sm font-medium text-slate-500 mr-2">Statut:</span>
                <button data-status="all" class="btn btn-sm btn-secondary">Tous</button>
                <button data-status="active" class="btn btn-sm btn-outline-secondary">Actifs</button>
                <button data-status="suspended" class="btn btn-sm btn-outline-secondary">Suspendus</button>
            </div>
        </div>

        <!-- User List Container -->
        <ul id="user-list-container" class="space-y-3"></ul>
    `;

    const userListContainer = $('#user-list-container', container) as HTMLUListElement;

    async function renderUserList(searchTerm = '', statusFilter = 'all') {
        // Charger les données paginées
        await loadPaginatedUsers(searchTerm, statusFilter);
        
        // Calculer les statistiques pour les utilisateurs de la page courante
        const agentStats = calculateStats();
        
        const totalPages = Math.ceil(totalUsersCount / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalUsersCount);

        userListContainer.innerHTML = '';

        // Ajouter le compteur de résultats
        const counter = document.createElement('div');
        counter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
        counter.innerHTML = `<i class="fas fa-users mr-2"></i>${totalUsersCount} utilisateur(s) trouvé(s)`;
        userListContainer.appendChild(counter);

        if (paginatedUsers.length === 0) {
            const noResults = document.createElement('li');
            noResults.className = 'card text-center text-slate-500 p-8';
            noResults.textContent = currentPage === 1 ? 'Aucun utilisateur ne correspond à vos critères.' : 'Aucun utilisateur sur cette page.';
            userListContainer.appendChild(noResults);
            return;
        }

        paginatedUsers.forEach(agent => {
            const stats = agentStats.get(agent.id) || { volume: 0, commissions: 0, transactionCount: 0, lastActivity: null };
            const statusBadge = agent.status === 'active'
                ? `<span class="badge badge-success">Actif</span>`
                : `<span class="badge badge-danger">Suspendu</span>`;

            const toggleStatusBtnClass = agent.status === 'active' ? 'btn-warning' : 'btn-success';
            const toggleStatusIcon = agent.status === 'active' ? 'fa-user-slash' : 'fa-user-check';
            const toggleStatusText = agent.status === 'active' ? 'Suspendre' : 'Activer';

            const li = document.createElement('li');
            li.className = 'card !p-4';
            li.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <!-- User Info -->
                    <div class="md:col-span-4 flex items-center gap-3">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=f5f3ff&color=5b21b6" alt="Avatar" class="w-10 h-10 rounded-full">
                        <div>
                            <p class="font-semibold text-slate-800">${agent.name}</p>
                            <p class="text-sm text-slate-500">${agent.email}</p>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="md:col-span-5 grid grid-cols-3 gap-2 text-center border-t md:border-t-0 md:border-x pt-4 md:pt-0 md:px-4">
                        <div>
                            <p class="text-xs text-slate-500">Volume (30j)</p>
                            <p class="font-semibold text-slate-700">${formatAmount(stats.volume)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500">Commissions (30j)</p>
                            <p class="font-semibold text-emerald-600">${formatAmount(stats.commissions)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500">Opérations (30j)</p>
                            <p class="font-semibold text-slate-700">${stats.transactionCount}</p>
                        </div>
                    </div>

                    <!-- Status & Actions -->
                    <div class="md:col-span-3 flex flex-col items-start md:items-end gap-2 w-full border-t md:border-t-0 pt-4 md:pt-0">
                        <div class="flex items-center gap-2">
                            ${statusBadge}
                            <div class="flex items-center gap-1">
                                <button class="btn btn-xs btn-outline-secondary" data-action="edit-agent" data-agent-id="${agent.id}" title="Modifier"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-xs ${toggleStatusBtnClass}" data-action="toggle-status" data-agent-id="${agent.id}" data-current-status="${agent.status}" title="${toggleStatusText}"><i class="fas ${toggleStatusIcon}"></i></button>
                            </div>
                        </div>
                        <p class="text-xs text-slate-500">
                            Dernière activité: ${stats.lastActivity ? formatDate(stats.lastActivity) : 'N/A'}
                        </p>
                    </div>
                </div>
            `;
            userListContainer.appendChild(li);
        });

        // Ajouter la pagination si nécessaire
        if (totalPages > 1) {
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-container flex justify-between items-center mt-6 p-4 bg-slate-50 rounded-md';
            
            paginationContainer.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="text-sm text-slate-600">
                        Affichage de ${startIndex + 1} à ${endIndex} sur ${totalUsersCount} utilisateurs
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-slate-500">Par page:</label>
                        <select id="items-per-page" class="form-select form-select-xs">
                            <option value="10" ${ITEMS_PER_PAGE === 10 ? 'selected' : ''}>10</option>
                            <option value="20" ${ITEMS_PER_PAGE === 20 ? 'selected' : ''}>20</option>
                            <option value="50" ${ITEMS_PER_PAGE === 50 ? 'selected' : ''}>50</option>
                        </select>
                    </div>
                </div>
                <nav class="flex items-center gap-2">
                    ${totalPages > 3 ? `<button id="first-page" class="btn btn-sm btn-outline-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''} title="Première page">
                        <i class="fas fa-angle-double-left"></i>
                    </button>` : ''}
                    
                    <button id="prev-page" class="btn btn-sm btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left mr-1"></i>Précédent
                    </button>
                    
                    <span class="text-sm text-slate-600 mx-3">
                        Page ${currentPage} sur ${totalPages}
                    </span>
                    
                    <button id="next-page" class="btn btn-sm btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
                        Suivant<i class="fas fa-chevron-right ml-1"></i>
                    </button>
                    
                    ${totalPages > 3 ? `<button id="last-page" class="btn btn-sm btn-outline-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''} title="Dernière page">
                        <i class="fas fa-angle-double-right"></i>
                    </button>` : ''}
                </nav>
            `;
            
            userListContainer.appendChild(paginationContainer);

            // Attacher les événements de pagination
            const firstButton = $('#first-page', userListContainer);
            const prevButton = $('#prev-page', userListContainer);
            const nextButton = $('#next-page', userListContainer);
            const lastButton = $('#last-page', userListContainer);
            const itemsPerPageSelect = $('#items-per-page', userListContainer) as HTMLSelectElement;
            
            firstButton?.addEventListener('click', async () => {
                if (currentPage > 1) {
                    currentPage = 1;
                    await renderUserList(currentSearchTerm, currentStatusFilter);
                    userListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            prevButton?.addEventListener('click', async () => {
                if (currentPage > 1) {
                    currentPage--;
                    await renderUserList(currentSearchTerm, currentStatusFilter);
                    userListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            nextButton?.addEventListener('click', async () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    await renderUserList(currentSearchTerm, currentStatusFilter);
                    userListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            lastButton?.addEventListener('click', async () => {
                if (currentPage < totalPages) {
                    currentPage = totalPages;
                    await renderUserList(currentSearchTerm, currentStatusFilter);
                    userListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            itemsPerPageSelect?.addEventListener('change', async () => {
                ITEMS_PER_PAGE = parseInt(itemsPerPageSelect.value);
                currentPage = 1; // Réinitialiser à la première page
                await renderUserList(currentSearchTerm, currentStatusFilter);
                userListContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    // --- 4. EVENT LISTENERS & DYNAMIC BEHAVIOR ---
    let currentSearchTerm = '';
    let currentStatusFilter = 'all';

    async function filterAndRender() {
        // Réinitialiser la pagination lors du filtrage
        currentPage = 1;
        await renderUserList(currentSearchTerm, currentStatusFilter);
    }

    // Initial render
    await renderUserList();

    // Filter Listeners
    const searchInput = $('#user-search-input', container) as HTMLInputElement;
    searchInput.addEventListener('input', async () => {
        currentSearchTerm = searchInput.value.toLowerCase();
        await filterAndRender();
    });

    const filterButtonsContainer = $('#status-filter-buttons', container);
    filterButtonsContainer?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('[data-status]');
        if (button) {
            currentStatusFilter = button.dataset.status!;

            // Update button styles
            filterButtonsContainer.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-outline-secondary');
            });
            button.classList.add('btn-secondary');
            button.classList.remove('btn-outline-secondary');

            await filterAndRender();
        }
    });

    // Action listeners (delegated to main container)
    container.addEventListener('click', async (e: Event) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button) return;

        // Create button
        if (button.id === 'create-agent-btn') {
            document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                bubbles: true, composed: true,
                detail: { agent: null, partnerId: partnerUser.partnerId, agencyId: partnerUser.agencyId }
            }));
            return;
        }

        const action = button.dataset.action;
        const agentId = button.dataset.agentId;
        if (!action || !agentId) return;

        // Edit button
        if (action === 'edit-agent') {
            const agent = paginatedUsers.find(a => a.id === agentId);
            if (agent) {
                document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                    bubbles: true, composed: true,
                    detail: { agent: agent, partnerId: partnerUser.partnerId, agencyId: partnerUser.agencyId }
                }));
            }
        }

        // Toggle status button
        if (action === 'toggle-status') {
            const currentStatus = button.dataset.currentStatus;
            const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

            try {
                await api.updateUserStatus(agentId, newStatus);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: `Utilisateur ${newStatus === 'active' ? 'activé' : 'suspendu'}.`, type: 'success' }
                }));
                // Reload view by dispatching event, this is better than re-rendering manually
                document.body.dispatchEvent(new CustomEvent('agentUpdated', { bubbles: true, composed: true }));
            } catch (error) {
                console.error('Failed to update agent status:', error);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'La mise à jour du statut a échoué.', type: 'error' }
                }));
                // Restore button on failure
                const toggleStatusIcon = newStatus === 'suspended' ? 'fa-user-slash' : 'fa-user-check';
                button.innerHTML = `<i class="fas ${toggleStatusIcon}"></i>`;
                button.disabled = false;
            }
        }
    });

    return container;
}
