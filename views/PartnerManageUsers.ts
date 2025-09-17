import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount } from '../utils/formatters';

export async function renderPartnerManageUsersView(partnerUser: User): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();

    // Invalidate cache to ensure the latest user list is fetched, including any new agents.
    dataService.invalidateUsersCache();

    // 1. Fetch all necessary data
    const [allUsers, allTransactions] = await Promise.all([
        dataService.getUsers(),
        dataService.getTransactions()
    ]);

    const myAgents = allUsers.filter(u => u.role === 'agent' && u.partnerId === partnerUser.partnerId);
    const myAgentIds = myAgents.map(a => a.id);

    // 2. Calculate performance stats for each agent for the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

    const agentStats = myAgentIds.reduce((acc, agentId) => {
        acc[agentId] = { volume: 0, commissions: 0 };
        return acc;
    }, {} as Record<string, { volume: number; commissions: number }>);

    allTransactions.forEach(tx => {
        if (myAgentIds.includes(tx.agentId) && new Date(tx.date) >= thirtyDaysAgo && tx.statut === 'Validé') {
            agentStats[tx.agentId].volume += tx.montant_principal;
            agentStats[tx.agentId].commissions += tx.commission_partenaire;
        }
    });

    const container = document.createElement('div');
    // 3. Render the header with title and create button
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Gestion des Utilisateurs de l'Agence</h2>
            <button id="create-agent-btn" class="btn btn-success w-full md:w-auto"><i class="fas fa-user-plus mr-2"></i>Créer un Compte Utilisateur</button>
        </div>
    `;

    // 4. Render the responsive table or an empty state message
    if (myAgents.length === 0) {
        container.innerHTML += `<div class="card text-center text-slate-500 p-4">Aucun utilisateur trouvé pour votre organisation.</div>`;
    } else {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        const table = document.createElement('table');
        table.className = 'w-full table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Utilisateur</th>
                    <th>Contact</th>
                    <th>Volume (30j)</th>
                    <th>Commissions (30j)</th>
                    <th>Statut</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody') as HTMLTableSectionElement;

        myAgents.sort((a,b) => a.name.localeCompare(b.name)).forEach(agent => {
            const stats = agentStats[agent.id] || { volume: 0, commissions: 0 };
            const statusBadge = agent.status === 'active'
                ? `<span class="badge badge-success">Actif</span>`
                : `<span class="badge badge-danger">Suspendu</span>`;

            const toggleStatusBtnClass = agent.status === 'active' ? 'btn-warning' : 'btn-success';
            const toggleStatusIcon = agent.status === 'active' ? 'fa-user-slash' : 'fa-user-check';
            const toggleStatusText = agent.status === 'active' ? 'Suspendre' : 'Activer';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Utilisateur">
                    <div class="flex items-center gap-3">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=f5f3ff&color=5b21b6" alt="Avatar" class="w-10 h-10 rounded-full hidden sm:block">
                        <div>
                            <p class="font-semibold text-slate-800">${agent.name}</p>
                            <p class="text-sm text-slate-500">${agent.email}</p>
                        </div>
                    </div>
                </td>
                <td data-label="Contact">
                    <p class="text-slate-700">${agent.phone || '-'}</p>
                </td>
                <td data-label="Volume (30j)">
                    <p class="font-semibold text-slate-700">${formatAmount(stats.volume)}</p>
                </td>
                <td data-label="Commissions (30j)">
                    <p class="font-semibold text-emerald-600">${formatAmount(stats.commissions)}</p>
                </td>
                <td data-label="Statut">${statusBadge}</td>
                <td data-label="Actions" class="actions-cell">
                    <div class="flex items-center justify-end md:justify-start gap-1 flex-wrap">
                        <button class="btn btn-xs btn-outline-secondary" data-action="edit-agent" data-agent-id="${agent.id}" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-xs ${toggleStatusBtnClass}" data-action="toggle-status" data-agent-id="${agent.id}" data-current-status="${agent.status}" title="${toggleStatusText}">
                            <i class="fas ${toggleStatusIcon}"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);
    }

    const card = createCard('Liste des Utilisateurs de mon Organisation', container, 'fa-users-cog');
    
    // 5. Setup event listeners using delegation
    card.addEventListener('click', async (e: Event) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const agentId = button.dataset.agentId;

        if (button.id === 'create-agent-btn') {
            document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                bubbles: true,
                composed: true,
                detail: { agent: null, partnerId: partnerUser.partnerId }
            }));
        }

        if (action === 'edit-agent' && agentId) {
            const agent = myAgents.find(a => a.id === agentId);
            if (agent) {
                document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                    bubbles: true,
                    composed: true,
                    detail: { agent: agent, partnerId: partnerUser.partnerId }
                }));
            }
        }
        
        if (action === 'toggle-status' && agentId) {
            const currentStatus = button.dataset.currentStatus;
            const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
            
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

            try {
                await api.updateAgent({ id: agentId, status: newStatus });
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: `Utilisateur ${newStatus === 'active' ? 'activé' : 'suspendu'}.`, type: 'success' }
                }));
                // Dispatch event for the app to reload the view, ensuring data consistency
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

    return card;
}