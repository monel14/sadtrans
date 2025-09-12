
import { User } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
import { renderAgentTransactionHistoryView } from './AgentTransactionHistory';
import { renderNewOperationView } from './NewOperation';
import { renderProfileView } from './Profile';

export async function renderAgentDashboardView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const container = document.createElement('div');

    const [agentTransactions, opTypes] = await Promise.all([
        dataService.getTransactions({ agentId: user.id, limit: 3 }),
        dataService.getAllOperationTypes()
    ]);

    container.innerHTML = `
        <div class="grid grid-cols-1 gap-6 mb-6"></div>
        <div class="mb-6"></div>
        <div class="mb-6"></div>
    `;

    const gridContainer = container.querySelector('.grid') as HTMLElement;
    gridContainer.appendChild(createCard('Solde Actuel', `<p class="text-3xl font-bold text-emerald-600">${formatAmount(user.solde)}</p>`, 'fa-wallet', ''));
    
    const quickAccessContent = document.createElement('div');
    quickAccessContent.className = 'grid grid-cols-2 gap-3';
    quickAccessContent.innerHTML = `
        <button data-nav-action="new-op" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-plus-circle text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Nouvelle Opération</span>
        </button>
        <button data-action="recharge" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-hand-holding-usd text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Demander Recharge</span>
        </button>
         <button data-nav-action="history" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-history text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Historique</span>
        </button>
        <button data-nav-action="profile" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-user-circle text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Mon Profil</span>
        </button>
    `;
    const quickAccessCard = createCard('Accès Rapides', quickAccessContent, 'fa-rocket', '');
    container.children[1].appendChild(quickAccessCard);

    // --- New list for latest operations ---
    const latestOpsContent = document.createElement('div');
    const latestOpsList = document.createElement('ul');
    latestOpsList.className = 'space-y-2';

    if (agentTransactions.length === 0) {
        latestOpsList.innerHTML = `<li class="text-center text-slate-500 p-4">Aucune opération récente.</li>`;
    } else {
        const opTypeMap = new Map(opTypes.map(ot => [ot.id, ot]));
        agentTransactions.forEach(op => {
            const opType = opTypeMap.get(op.opTypeId);
            const statusClass = op.statut === 'Validé' ? 'badge-success' : (op.statut.includes('En attente') ? 'badge-warning' : 'badge-danger');
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 rounded-md bg-slate-50 transition-colors hover:bg-slate-100';
            li.innerHTML = `
                <div>
                    <p class="font-semibold text-slate-800">${opType?.name || 'N/A'}</p>
                    <p class="text-sm text-slate-500">${formatDate(op.date)}</p>
                </div>
                <div class="text-right">
                    <p class="font-semibold text-slate-900">${formatAmount(op.montant_principal)}</p>
                    <span class="badge ${statusClass} mt-1">${op.statut}</span>
                </div>
            `;
            latestOpsList.appendChild(li);
        });
    }
    latestOpsContent.appendChild(latestOpsList);

    const seeAllLink = document.createElement('div');
    seeAllLink.className = 'mt-4 text-right';
    seeAllLink.innerHTML = `<a href="#" class="text-violet-600 hover:underline text-sm font-medium">Voir tout l'historique <i class="fas fa-arrow-right text-xs"></i></a>`;
    latestOpsContent.appendChild(seeAllLink);

    const latestOpsCard = createCard('Dernières Opérations', latestOpsContent, 'fa-receipt', '');
    container.children[2].appendChild(latestOpsCard);
    
    // Delegated event listener for the entire dashboard
    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        const link = target.closest('a');

        if (button) {
            const navAction = button.dataset.navAction;
            const action = button.dataset.action;

            if (navAction === 'new-op') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn: renderNewOperationView, label: 'Nouvelle Opération', navId: 'agent_services' },
                    bubbles: true, composed: true
                }));
            } else if (action === 'recharge') {
                document.body.dispatchEvent(new CustomEvent('openAgentRechargeModal'));
            } else if (navAction === 'history') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn: renderAgentTransactionHistoryView, label: 'Historique des Opérations', navId: 'agent_history' },
                    bubbles: true, composed: true
                }));
            } else if (navAction === 'profile') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn: renderProfileView, label: 'Mon Profil', navId: 'agent_profile' },
                    bubbles: true, composed: true
                }));
            }
        }

        if (link && seeAllLink.contains(link)) {
            e.preventDefault();
            container.dispatchEvent(new CustomEvent('navigateTo', {
                detail: { viewFn: renderAgentTransactionHistoryView, label: 'Historique Opérations', navId: 'agent_history' },
                bubbles: true, composed: true
            }));
        }
    });

    return container;
}
