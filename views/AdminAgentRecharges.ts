
import { User, AgentRechargeRequest, Partner, RechargePaymentMethod } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
import { $ } from '../utils/dom';
import { createRefreshableView, addRefreshButton, invalidateCaches } from '../utils/refreshable-view';

// Variables pour la pagination
let ITEMS_PER_PAGE = 15;
let currentPage = 1;

function renderRequestItem(
    req: AgentRechargeRequest,
    data: { userMap: Map<string, User>, partnerMap: Map<string, Partner>, methodMap: Map<string, RechargePaymentMethod>, allUsers: User[] }
): HTMLElement {
    const { userMap, partnerMap, methodMap, allUsers } = data;
    
    // Utiliser les données enrichies de la pagination côté serveur
    const agentName = (req as any).agentName || userMap.get(req.agentId)?.name || 'N/A';
    const methodName = (req as any).methodName || methodMap.get(req.methodId)?.name || 'Inconnu';
    
    const agent = userMap.get(req.agentId);
    const partner = agent ? partnerMap.get(agent.partnerId!) : null;
    const method = methodMap.get(req.methodId);

    // Get the full user object to access agency data for the correct balance
    const fullAgent = allUsers.find(u => u.id === req.agentId);
    const agencyBalance = (fullAgent as any)?.agency?.solde_principal;

    // Pour le contexte historique, on utilise une approche simplifiée
    const rechargeCountText = 'Demande de recharge';

    // Calculate fees
    let feeInfoText = '(Aucun)';
    let calculatedFee = 0;
    if (method) {
        if (method.feeType === 'fixed') {
            calculatedFee = method.feeValue;
            feeInfoText = `(${formatAmount(method.feeValue)} Fixe)`;
        } else if (method.feeType === 'percentage') {
            calculatedFee = (req.montant * method.feeValue) / 100;
            feeInfoText = `(${method.feeValue}%)`;
        }
    }
    const amountToReceive = req.montant - calculatedFee;

    const isPending = req.statut === 'En attente';
    const statusBadge = req.statut === 'Approuvée'
        ? `<span class="badge badge-success">Approuvée</span>`
        : `<span class="badge badge-danger">Rejetée</span>`;

    const referenceDisplay = req.statut !== 'Rejetée' && req.notes
        ? `<p class="text-xs text-slate-600">Réf: <span class="font-mono bg-slate-100 p-1 rounded">${req.notes}</span></p>`
        : '';

    const li = document.createElement('li');
    li.className = 'bg-white border rounded-lg overflow-hidden';

    li.innerHTML = `
        <div class="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Agent & Context -->
            <div class="md:col-span-1 md:border-r md:pr-4">
                <p class="text-sm text-slate-500">Agent</p>
                <p class="font-bold text-lg text-slate-800">${agentName}</p>
                <p class="text-sm text-slate-600">${partner?.name || 'N/A'}</p>
                <p class="text-sm text-slate-500 mt-1"><i class="fas fa-phone-alt fa-xs mr-1"></i> ${agent?.phone || 'N/A'}</p>
                <hr class="my-2">
                <p class="text-sm text-slate-500">Solde agence actuel</p>
                <p class="font-bold text-lg text-slate-800">${agencyBalance !== undefined ? formatAmount(agencyBalance) : '-'}</p>
                <p class="text-xs text-slate-400 mt-2">${formatDate(req.date)} <span class="badge badge-purple ml-2">${rechargeCountText}</span></p>
            </div>

            <!-- Transaction Details -->
            <div class="md:col-span-1">
                 <p class="text-sm text-slate-500">Montant du dépôt</p>
                 <p class="font-bold text-3xl text-violet-600">${formatAmount(req.montant)}</p>
                 <p class="text-sm font-semibold text-slate-700 mt-2">${methodName}</p>
                 ${referenceDisplay}
                 <hr class="my-3">
                 
                 <div class="space-y-1 text-sm">
                    <div class="flex justify-between"><span>ID Transaction:</span> <span class="font-mono text-xs">${req.id}</span></div>
                    <div class="flex justify-between"><span>Frais appliqués ${feeInfoText}:</span> <span class="font-semibold text-red-600">-${formatAmount(calculatedFee)}</span></div>
                    <div class="flex justify-between border-t pt-1 mt-1"><strong>Montant à recevoir:</strong> <strong class="text-emerald-700">${formatAmount(amountToReceive)}</strong></div>
                </div>
            </div>

            <!-- Actions -->
            <div class="md:col-span-1 flex flex-col justify-center items-center md:items-end gap-3">
                 ${isPending ? `
                    <button class="btn btn-success w-full md:w-auto" data-request-id="${req.id}" data-action="approve" title="Approuver"><i class="fas fa-check mr-2"></i>Approuver</button>
                    <button class="btn btn-danger w-full md:w-auto" data-request-id="${req.id}" data-action="reject" title="Rejeter"><i class="fas fa-times mr-2"></i>Rejeter</button>
                ` : statusBadge}
            </div>
        </div>
    `;

    // Rejection reason if exists, appended at the bottom
    if (req.statut === 'Rejetée' && req.notes) {
        const reasonDiv = document.createElement('div');
        reasonDiv.className = 'bg-red-50 border-t p-3 text-sm';
        reasonDiv.innerHTML = `<strong class="text-red-700">Motif du rejet:</strong> <span class="text-red-800">${req.notes}</span>`;
        li.appendChild(reasonDiv);
    }

    return li;
}


// Variables globales pour les données
let paginatedRecharges: AgentRechargeRequest[] = [];
let totalCount = 0;
let userMap: Map<string, User> = new Map();
let partnerMap: Map<string, Partner> = new Map();
let methodMap: Map<string, RechargePaymentMethod> = new Map();
let allUsers: User[] = [];
let cardContent: HTMLElement;
let currentTab: 'pending' | 'history' = 'pending';

async function loadPaginatedData(status?: string): Promise<void> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    
    // Charger les données de référence (maps)
    [userMap, partnerMap, methodMap, allUsers] = await Promise.all([
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getMethodMap(),
        dataService.getUsers(),
    ]);

    // Charger les demandes paginées
    const result = await api.getAgentRechargeRequestsPaginated({
        status: status,
        page: currentPage,
        limit: ITEMS_PER_PAGE
    });
    
    paginatedRecharges = result.requests;
    totalCount = result.totalCount;
}

async function renderContent(): Promise<void> {
    if (!cardContent) return;
    
    // Charger les données pour les deux onglets pour obtenir les compteurs
    const [pendingResult, historyResult] = await Promise.all([
        ApiService.getInstance().getAgentRechargeRequestsPaginated({ status: 'En attente', page: 1, limit: 1 }),
        ApiService.getInstance().getAgentRechargeRequestsPaginated({ status: currentTab === 'history' ? undefined : 'processed', page: 1, limit: 1 })
    ]);

    cardContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="tabs">
                <button data-tab="pending" class="${currentTab === 'pending' ? 'active' : ''}">En attente (${pendingResult.totalCount})</button>
                <button data-tab="history" class="${currentTab === 'history' ? 'active' : ''}">Historique récent</button>
            </div>
        </div>
        <div id="recharge-list-container" class="tab-content mt-4">
            <!-- List will be rendered here -->
        </div>
    `;

    const listContainer = $('#recharge-list-container', cardContent) as HTMLElement;
    await renderList(currentTab, listContainer);
}

async function renderList(tab: 'pending' | 'history', listContainer: HTMLElement): Promise<void> {
    // Charger les données paginées selon l'onglet
    const status = tab === 'pending' ? 'En attente' : undefined;
    await loadPaginatedData(status);

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalCount);

    // Supprimer l'ancien contenu
    listContainer.innerHTML = '';

    // Ajouter le compteur de résultats
    const counter = document.createElement('div');
    counter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
    counter.innerHTML = `<i class="fas fa-list mr-2"></i>${totalCount} demande(s) au total`;
    listContainer.appendChild(counter);

    if (paginatedRecharges.length === 0) {
        const noResults = document.createElement('p');
        noResults.className = 'text-center text-slate-500 p-8';
        noResults.textContent = currentPage === 1 ? 'Aucune demande dans cette catégorie.' : 'Aucune demande sur cette page.';
        listContainer.appendChild(noResults);
        return;
    }

    // Créer la liste des demandes
    const list = document.createElement('ul');
    list.className = 'space-y-4';
    paginatedRecharges.forEach(req => {
        list.appendChild(renderRequestItem(req, { userMap, partnerMap, methodMap, allUsers }));
    });
    listContainer.appendChild(list);

    // Ajouter la pagination si nécessaire
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container flex justify-between items-center mt-6 p-4 bg-slate-50 rounded-md';
        
        paginationContainer.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="text-sm text-slate-600">
                    Affichage de ${startIndex + 1} à ${endIndex} sur ${totalCount} demandes
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs text-slate-500">Par page:</label>
                    <select id="items-per-page" class="form-select form-select-xs">
                        <option value="10" ${ITEMS_PER_PAGE === 10 ? 'selected' : ''}>10</option>
                        <option value="15" ${ITEMS_PER_PAGE === 15 ? 'selected' : ''}>15</option>
                        <option value="25" ${ITEMS_PER_PAGE === 25 ? 'selected' : ''}>25</option>
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
        
        listContainer.appendChild(paginationContainer);

        // Attacher les événements de pagination
        const firstButton = $('#first-page', listContainer);
        const prevButton = $('#prev-page', listContainer);
        const nextButton = $('#next-page', listContainer);
        const lastButton = $('#last-page', listContainer);
        const itemsPerPageSelect = $('#items-per-page', listContainer) as HTMLSelectElement;
        
        firstButton?.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage = 1;
                await renderList(tab, listContainer);
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        prevButton?.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await renderList(tab, listContainer);
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        nextButton?.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await renderList(tab, listContainer);
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        lastButton?.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage = totalPages;
                await renderList(tab, listContainer);
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        itemsPerPageSelect?.addEventListener('change', async () => {
            ITEMS_PER_PAGE = parseInt(itemsPerPageSelect.value);
            currentPage = 1; // Réinitialiser à la première page
            await renderList(tab, listContainer);
            listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

export async function renderAdminAgentRechargesView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    
    // Initialiser le contenu
    cardContent = document.createElement('div');
    
    // Charger les données initiales
    await loadPaginatedData();
    
    // Créer la vue rafraîchissable
    const refreshableView = createRefreshableView({
        viewId: 'admin-agent-recharges',
        refreshData: async () => {
            invalidateCaches(['recharges', 'users']);
            currentPage = 1; // Réinitialiser la pagination
            await loadPaginatedData(currentTab === 'pending' ? 'En attente' : undefined);
        },
        renderContent: async () => {
            await renderContent();
        },
        dataTypes: ['recharges', 'users']
    });
    
    // Rendu initial
    await renderContent();

    const card = createCard('Demandes de Recharge des Agents', cardContent, 'fa-wallet');
    
    // Ajouter le bouton de rafraîchissement
    const cardHeader = card.querySelector('.card-header');
    if (cardHeader) {
        const refreshButton = addRefreshButton(card, async () => {
            await refreshableView.refresh();
        });
        cardHeader.appendChild(refreshButton);
    }
    
    // Gestion des onglets
    card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabButton = target.closest<HTMLButtonElement>('[data-tab]');
        
        if (tabButton) {
            const tab = tabButton.dataset.tab as 'pending' | 'history';
            currentTab = tab;
            currentPage = 1; // Réinitialiser la pagination lors du changement d'onglet
            
            // Mettre à jour les onglets actifs
            card.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'));
            tabButton.classList.add('active');
            
            // Re-rendre la liste
            const listContainer = $('#recharge-list-container', card) as HTMLElement;
            if (listContainer) {
                renderList(tab, listContainer);
            }
        }
    });



    card.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;

        const tabButton = target.closest<HTMLButtonElement>('.tabs button');
        if (tabButton) {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            tabButton.classList.add('active');
            const listContainer = $('#recharge-list-container', card) as HTMLElement;
            if (listContainer) {
                await renderList(tabButton.dataset.tab as 'pending' | 'history', listContainer);
            }
            return;
        }

        const actionButton = target.closest<HTMLButtonElement>('[data-request-id]');
        if (!actionButton) return;

        const requestId = actionButton.dataset.requestId;
        const action = actionButton.dataset.action as 'approve' | 'reject';

        if (!requestId || !action) return;

        if (action === 'approve') {
            const originalHtml = actionButton.innerHTML;
            actionButton.disabled = true;
            actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            const success = await api.updateAgentRechargeRequestStatus(requestId, 'Approuvée');
            if (success) {
                // Recharger les données et réinitialiser la pagination
                currentPage = 1;
                await renderContent();
                document.body.dispatchEvent(new CustomEvent('rechargeRequestUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Demande approuvée.", type: 'success' } }));
            } else {
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
                actionButton.disabled = false;
                actionButton.innerHTML = originalHtml;
            }
        } else if (action === 'reject') {
            document.body.dispatchEvent(new CustomEvent('openAdminRejectRechargeModal', {
                detail: { requestId },
                bubbles: true,
                composed: true
            }));
        }
    });

    const initialListContainer = $('#recharge-list-container', card) as HTMLElement;
    if (initialListContainer) {
        await renderList('pending', initialListContainer);
    }
    return card;
}