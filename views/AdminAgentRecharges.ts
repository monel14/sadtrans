import { User, AgentRechargeRequest, Partner, RechargePaymentMethod } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
import { $ } from '../utils/dom';

function renderRequestItem(
    req: AgentRechargeRequest, 
    data: { userMap: Map<string, User>, partnerMap: Map<string, Partner>, methodMap: Map<string, RechargePaymentMethod>, allRecharges: AgentRechargeRequest[] }
): HTMLElement {
    const { userMap, partnerMap, methodMap, allRecharges } = data;
    const agent = userMap.get(req.agentId);
    const partner = agent ? partnerMap.get(agent.partnerId!) : null;
    const method = methodMap.get(req.methodId);

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

    const isPending = req.statut === 'En attente Admin';
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
                <p class="text-sm text-slate-500">Solde actuel</p>
                <p class="font-bold text-lg text-slate-800">${agent ? formatAmount(agent.solde) : '-'}</p>
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


export async function renderAdminAgentRechargesView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    const cardContent = document.createElement('div');
    
    const [allRecharges, userMap, partnerMap, methodMap] = await Promise.all([
        dataService.getAgentRechargeRequests(),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getMethodMap(),
    ]);

    const pendingRecharges = allRecharges.filter(r => r.statut === 'En attente Admin');
    const historyRecharges = allRecharges.filter(r => r.statut !== 'En attente Admin').slice(0, 20);

    cardContent.innerHTML = `
        <div class="tabs">
            <button data-tab="pending" class="active">En attente (${pendingRecharges.length})</button>
            <button data-tab="history">Historique récent (${historyRecharges.length})</button>
        </div>
        <div id="recharge-list-container" class="tab-content mt-4">
            <!-- List will be rendered here -->
        </div>
    `;

    const listContainer = $('#recharge-list-container', cardContent) as HTMLElement;

    function renderList(tab: 'pending' | 'history') {
        const itemsToRender = tab === 'pending' ? pendingRecharges : historyRecharges;
        
        listContainer.innerHTML = '';
        if (itemsToRender.length === 0) {
            listContainer.innerHTML = `<p class="text-center text-slate-500 p-8">Aucune demande dans cette catégorie.</p>`;
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-4';
        itemsToRender.forEach(req => {
            list.appendChild(renderRequestItem(req, { userMap, partnerMap, methodMap, allRecharges }));
        });
        listContainer.appendChild(list);
    }
    
    const card = createCard('Demandes de Recharge des Agents', cardContent, 'fa-wallet');
    
    card.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;

        const tabButton = target.closest<HTMLButtonElement>('.tabs button');
        if (tabButton) {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            tabButton.classList.add('active');
            renderList(tabButton.dataset.tab as 'pending' | 'history');
            return;
        }

        const actionButton = target.closest<HTMLButtonElement>('[data-request-id]');
        if (!actionButton) return;

        const requestId = actionButton.dataset.requestId;
        const action = actionButton.dataset.action as 'approve' | 'reject';

        if (!requestId || !action) return;
        
        const originalHtml = actionButton.innerHTML;
        actionButton.disabled = true;
        actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

        let success = false;
        if (action === 'approve') {
            success = await api.updateAgentRechargeRequestStatus(requestId, 'Approuvée');
        } else if (action === 'reject') {
            const reason = prompt("Veuillez entrer le motif du rejet :");
            if (reason && reason.trim()) {
                success = await api.updateAgentRechargeRequestStatus(requestId, 'Rejetée', reason.trim());
            } else {
                actionButton.disabled = false;
                actionButton.innerHTML = originalHtml;
                return;
            }
        }
        
        if (success) {
            const newView = await renderAdminAgentRechargesView();
            card.parentElement?.replaceChild(newView, card);
        } else {
            document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            actionButton.disabled = false;
            actionButton.innerHTML = originalHtml;
        }
    });

    renderList('pending');
    return card;
}
