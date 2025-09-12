
import { User } from '../models';
import { ApiService } from '../services/api.service';
import { createCard } from '../components/Card';
import { formatAmount } from '../utils/formatters';

export async function renderPartnerManageUsersView(partnerUser: User): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const allUsers = await api.getUsers();
    const myAgents = allUsers.filter(u => u.role === 'agent' && u.partnerId === partnerUser.partnerId);

    const container = document.createElement('div');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Gestion de Mes Utilisateurs</h2>
            <button id="create-agent-btn" class="btn btn-success w-full md:w-auto"><i class="fas fa-user-plus mr-2"></i>Créer un Compte Utilisateur</button>
        </div>
    `;

    if (myAgents.length === 0) {
        container.innerHTML += `<div class="card text-center text-slate-500 p-4">Aucun utilisateur trouvé pour votre organisation.</div>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        myAgents.forEach(agent => {
            const statusBadge = agent.status === 'active'
                ? `<span class="badge badge-success">Actif</span>`
                : `<span class="badge badge-danger">Suspendu</span>`;
            
            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex items-center gap-3 flex-grow">
                     <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=f5f3ff&color=5b21b6" alt="Avatar" class="w-10 h-10 rounded-full">
                     <div>
                        <p class="font-semibold text-slate-800">${agent.name}</p>
                        <p class="text-sm text-slate-500">${agent.email}</p>
                     </div>
                </div>
                <div class="text-left sm:text-right">
                    <p class="font-semibold text-slate-700">${formatAmount(agent.solde)}</p>
                    <p class="text-xs text-slate-400">Solde actuel (partagé)</p>
                </div>
                 <div class="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                    ${statusBadge}
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-outline-secondary" data-action="edit-agent" data-agent-id="${agent.id}">
                            <i class="fas fa-edit mr-1"></i>Modifier
                        </button>
                    </div>
                 </div>
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    const card = createCard('Liste des Utilisateurs de mon Organisation', container, 'fa-users-cog');
    
    card.addEventListener('click', e => {
        const target = e.target as HTMLElement;

        const createBtn = target.closest<HTMLButtonElement>('#create-agent-btn');
        if(createBtn) {
            document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                bubbles: true,
                composed: true,
                detail: { agent: null, partnerId: partnerUser.partnerId }
            }));
        }

        const editBtn = target.closest<HTMLButtonElement>('[data-action="edit-agent"]');
        if(editBtn) {
            const agentId = editBtn.dataset.agentId;
            const agent = myAgents.find(a => a.id === agentId);
            if(agent) {
                document.body.dispatchEvent(new CustomEvent('openPartnerEditAgentModal', {
                    bubbles: true,
                    composed: true,
                    detail: { agent: agent, partnerId: partnerUser.partnerId }
                }));
            }
        }
    });

    return card;
}
