
import { User, AgentRechargeRequest, Partner, RechargePaymentMethod } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
import { $ } from '../utils/dom';
import { createRefreshableView, addRefreshButton, invalidateCaches } from '../utils/refreshable-view';

function renderRequestItem(
    req: AgentRechargeRequest,
    data: { userMap: Map<string, User>, partnerMap: Map<string, Partner>, methodMap: Map<string, RechargePaymentMethod>, allRecharges: AgentRechargeRequest[], allUsers: User[] }
): HTMLElement {
    const { userMap, partnerMap, methodMap, allRecharges, allUsers } = data;
    const agent = userMap.get(req.agentId);
    const partner = agent ? partnerMap.get(agent.partnerId!) : null;
    const method = methodMap.get(req.methodId);

    // Get the full user object to access agency data for the correct balance
    const fullAgent = allUsers.find(u => u.id === req.agentId);
    const agencyBalance = (fullAgent as any)?.agency?.solde_principal;


    // Calculate historical context
    const agentRecharges = allRecharges.filter(r => r.agentId === req.agentId);
    const rechargeCountText = agentRecharges.length > 1 ? `${agentRecharges.length}ème demande` : '1ère demande';

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
                <p class="font-bold text-lg text-slate-800">${agent?.name || 'N/A'}</p>
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
                 <p class="text-sm font-semibold text-slate-700 mt-2">${method?.name || 'Inconnu'}</p>
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
let allRecharges: AgentRechargeRequest[] = [];
let userMap: Map<string, User> = new Map();
let partnerMap: Map<string, Partner> = new Map();
let methodMap: Map<string, RechargePaymentMethod> = new Map();
let allUsers: User[] = [];
let cardContent: HTMLElement;
let currentTab: 'pending' | 'history' = 'pending';

async function loadData(): Promise<void> {
    const dataService = DataService.getInstance();
    
    [allRecharges, userMap, partnerMap, methodMap, allUsers] = await Promise.all([
        dataService.getAgentRechargeRequests(),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getMethodMap(),
        dataService.getUsers(),
    ]);
}

function renderContent(): void {
    if (!cardContent) return;
    
    const pendingRecharges = allRecharges.filter(r => r.statut === 'En attente');
    const historyRecharges = allRecharges.filter(r => r.statut !== 'En attente').slice(0, 20);

    cardContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="tabs">
                <button data-tab="pending" class="${currentTab === 'pending' ? 'active' : ''}">En attente (${pendingRecharges.length})</button>
                <button data-tab="history" class="${currentTab === 'history' ? 'active' : ''}">Historique récent (${historyRecharges.length})</button>
            </div>
        </div>
        <div id="recharge-list-container" class="tab-content mt-4">
            <!-- List will be rendered here -->
        </div>
    `;

    const listContainer = $('#recharge-list-container', cardContent) as HTMLElement;
    renderList(currentTab, listContainer);
}

function renderList(tab: 'pending' | 'history', listContainer: HTMLElement): void {
    const pendingRecharges = allRecharges.filter(r => r.statut === 'En attente');
    const historyRecharges = allRecharges.filter(r => r.statut !== 'En attente').slice(0, 20);
    const itemsToRender = tab === 'pending' ? pendingRecharges : historyRecharges;

    listContainer.innerHTML = '';
    if (itemsToRender.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-slate-500 p-8">Aucune demande dans cette catégorie.</p>`;
        return;
    }

    const list = document.createElement('ul');
    list.className = 'space-y-4';
    itemsToRender.forEach(req => {
        list.appendChild(renderRequestItem(req, { userMap, partnerMap, methodMap, allRecharges, allUsers }));
    });
    listContainer.appendChild(list);
}

export async function renderAdminAgentRechargesView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    
    // Initialiser le contenu
    cardContent = document.createElement('div');
    
    // Charger les données initiales
    await loadData();
    
    // Créer la vue rafraîchissable
    const refreshableView = createRefreshableView({
        viewId: 'admin-agent-recharges',
        refreshData: async () => {
            invalidateCaches(['recharges', 'users']);
            await loadData();
        },
        renderContent: () => {
            renderContent();
            return Promise.resolve();
        },
        dataTypes: ['recharges', 'users']
    });
    
    // Rendu initial
    renderContent();

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
                renderList(tabButton.dataset.tab as 'pending' | 'history', listContainer);
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
        renderList('pending', initialListContainer);
    }
    return card;
}