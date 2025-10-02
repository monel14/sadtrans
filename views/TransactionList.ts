import { User } from '../models';
import { ApiService } from '../services/api.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { DataService } from '../services/data.service';
import { createPaginationElement, getPaginatedItems, createResultsCounter } from '../utils/pagination';

export interface TransactionListViewFilters {
    title: string;
    opTypeIds: string[];
}

export function renderTransactionListView(filters: TransactionListViewFilters): (user: User) => Promise<HTMLElement> {
    return async (user: User): Promise<HTMLElement> => {
        const dataService = DataService.getInstance();
        
        const [allTransactions, opTypes, allUsers, partners, userMap] = await Promise.all([
            dataService.getTransactions({ agentId: user.role === 'agent' ? user.id : undefined }),
            dataService.getAllOperationTypes(),
            dataService.getUsers(),
            dataService.getPartners(),
            dataService.getUserMap()
        ]);
        
        const filteredTransactions = allTransactions.filter(t => 
            filters.opTypeIds.includes(t.opTypeId) &&
            (user.role !== 'partner' || allUsers.find(u => u.id === t.agentId)?.partnerId === user.partnerId)
        );

        const container = document.createElement('div');
        
        if (filteredTransactions.length === 0) {
            container.innerHTML = `<p class="text-center text-slate-500 p-4">Aucune transaction de ce type trouvée.</p>`;
        } else {
            // Ajouter le compteur de résultats
            const counter = createResultsCounter(filteredTransactions.length, undefined, 'fa-receipt');
            container.appendChild(counter);

            // Pagination simple (première page seulement pour cette vue)
            const ITEMS_PER_PAGE = 20;
            const transactionsToDisplay = getPaginatedItems(filteredTransactions, 1, ITEMS_PER_PAGE);

            const list = document.createElement('ul');
            list.className = 'space-y-3';
            
            transactionsToDisplay.forEach(t => {
                const initiator = allUsers.find(u => u.id === t.agentId);
                const partner = partners.find(p => p.id === initiator?.partnerId)
                const opType = opTypes.find(ot => ot.id === t.opTypeId);

                const formattedStatus = formatTransactionStatus(t, userMap);
                const statusClass = t.statut === 'Validé' ? 'badge-success' : (t.statut === 'En attente de validation' || t.statut === 'Assignée' ? 'badge-warning' : 'badge-danger');

                const li = document.createElement('li');
                li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
                li.innerHTML = `
                    <div class="flex-grow">
                        <div class="flex items-center gap-3">
                            <span class="badge ${statusClass}">${formattedStatus}</span>
                             <p class="text-sm text-slate-500">${formatDate(t.date)}</p>
                        </div>
                        <p class="font-semibold text-slate-800 mt-1">${initiator?.name || 'N/A'}</p>
                        <p class="text-xs text-slate-500">${partner?.name || 'Partenaire Indépendant'}</p>
                    </div>
                    <div class="text-left md:text-right w-full sm:w-auto">
                        <div class="flex items-center justify-end gap-2">
                            <p class="text-lg font-bold text-slate-900">${formatAmount(t.montant_principal)}</p>
                            ${t.preuveUrl ? `<button class="btn btn-xs btn-outline-secondary !py-1 !px-2" data-action="view-proof" data-proof-url="${t.preuveUrl}" title="Voir la preuve"><i class="fas fa-camera"></i></button>` : ''}
                        </div>
                        <p class="text-xs text-slate-400">Op: ${t.id}</p>
                    </div>
                `;
                list.appendChild(li);
            });
            container.appendChild(list);
        }

        const card = createCard(filters.title, container, 'fa-list-alt');
        
        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const proofButton = target.closest<HTMLButtonElement>('[data-action="view-proof"]');
            if (proofButton) {
                const imageUrl = proofButton.dataset.proofUrl;
                if (imageUrl) {
                    document.body.dispatchEvent(new CustomEvent('openViewProofModal', {
                        detail: { imageUrl },
                        bubbles: true,
                        composed: true
                    }));
                }
            }
        });

        return card;
    };
}
