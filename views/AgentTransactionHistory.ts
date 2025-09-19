
import { User, Transaction, OperationType } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { $ } from '../utils/dom';

// Helper function to show a details modal
function showDetailsModal(transaction: Transaction, opType: OperationType, userMap: Map<string, User>, container: HTMLElement) {
    const existingModal = $('#detailsModal', container.ownerDocument);
    existingModal?.remove();

    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal visible';
    
    const validator = transaction.validateurId ? userMap.get(transaction.validateurId) : null;
    const formattedStatus = formatTransactionStatus(transaction, userMap);

    let dataFields = '';
    opType.fields.forEach(field => {
        if (field.obsolete) return;
        const value = transaction.data[field.name];
        dataFields += `
            <div class="py-2 grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-slate-500">${field.label}</dt>
                <dd class="text-sm text-slate-900 col-span-2">${value || '<em>Non fourni</em>'}</dd>
            </div>
        `;
    });

    let proofSection = '';
    if (transaction.preuveUrl) {
        proofSection = `
            <h4 class="font-semibold mt-4 mb-2">Preuve de l'opération</h4>
            <div class="border-t pt-2">
                <button class="btn btn-sm btn-secondary" data-action="view-proof" data-proof-url="${transaction.preuveUrl}">
                    <i class="fas fa-camera mr-2"></i>Afficher la preuve
                </button>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content modal-lg">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-slate-800">Détails de l'Opération #${transaction.id}</h3>
                <button type="button" class="text-3xl text-slate-400 hover:text-slate-700" data-modal-close>&times;</button>
            </div>
            <div class="border-t border-b divide-y">
                <dl class="divide-y">
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Statut</dt><dd class="text-sm text-slate-900 col-span-2"><span class="badge ${transaction.statut === 'Validé' ? 'badge-success' : (transaction.statut.includes('En attente') || transaction.statut.includes('Assignée') ? 'badge-warning' : 'badge-danger')}">${formattedStatus}</span></dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Date</dt><dd class="text-sm text-slate-900 col-span-2">${formatDate(transaction.date)}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Validateur</dt><dd class="text-sm text-slate-900 col-span-2">${validator?.name || '-'}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Motif de Rejet</dt><dd class="text-sm text-slate-900 col-span-2">${transaction.motif_rejet || '-'}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Commission Partenaire</dt><dd class="text-sm text-slate-900 col-span-2">${formatAmount(transaction.commission_partenaire)}</dd></div>
                </dl>
            </div>
            <h4 class="font-semibold mt-4 mb-2">Données de l'opération</h4>
            <div class="border-t border-b divide-y">
                 <dl class="divide-y">${dataFields}</dl>
            </div>
            ${proofSection}
            <div class="mt-6 text-right">
                <button type="button" class="btn btn-secondary" data-modal-close>Fermer</button>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('modal') || target.closest('[data-modal-close]')) {
            modal.remove();
        }
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

    container.ownerDocument.body.appendChild(modal);
}

// Main render function
export async function renderAgentTransactionHistoryView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [agentTransactions, opTypeMap, userMap] = await Promise.all([
        dataService.getTransactions({ agentId: user.id }),
        dataService.getOpTypeMap(),
        dataService.getUserMap(),
    ]);

    // Create a map of transactions for quick lookup in the modal
    const transactionMap = new Map(agentTransactions.map(t => [t.id, t]));

    const container = document.createElement('div');

    const formHtml = `
        <form class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-md bg-slate-50">
            <div><label class="form-label form-label-sm">Plage de Dates</label><input type="date" class="form-input form-input-sm"></div>
            <div><label class="form-label form-label-sm">Type d'Opération</label><select class="form-select form-select-sm"><option>Tous</option></select></div>
            <div><label class="form-label form-label-sm">Statut</label><select class="form-select form-select-sm"><option>Tous</option><option>Validé</option><option>En attente</option><option>Rejeté</option></select></div>
            <div class="flex items-end"><button class="btn btn-sm btn-primary w-full">Filtrer</button></div>
        </form>
    `;
    container.innerHTML = formHtml;

    if (agentTransactions.length === 0) {
        container.innerHTML += '<p class="text-center text-slate-500 p-4">Aucune transaction trouvée.</p>';
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        
        agentTransactions.forEach(t => {
            const opType = opTypeMap.get(t.opTypeId);
            let benefDetails = '';
            if (opType && t.data) {
                if (t.data.nom_beneficiaire) benefDetails = `-> ${t.data.nom_beneficiaire}`;
                else if (t.data.num_decodeur_canal) benefDetails = `Décodeur: ${t.data.num_decodeur_canal}`;
            }

            const formattedStatus = formatTransactionStatus(t, userMap);
            const statusClass = t.statut === 'Validé' ? 'badge-success' : (t.statut.includes('En attente') || t.statut.includes('Assignée') ? 'badge-warning' : 'badge-danger');

            const li = document.createElement('li');
            li.className = 'card !p-0 overflow-hidden';
            li.innerHTML = `
                <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4">
                    <div class="flex-grow">
                        <div class="flex items-center gap-4">
                            <span class="badge ${statusClass}">${formattedStatus}</span>
                            <p class="font-semibold text-slate-800">${opType?.name || 'Opération Inconnue'}</p>
                        </div>
                        <p class="text-sm text-slate-500 mt-1">${t.id} <span class="mx-1 text-slate-300">•</span> ${benefDetails}</p>
                    </div>
                    <div class="text-left md:text-right w-full md:w-auto">
                        <p class="text-lg font-bold text-slate-900">${formatAmount(t.montant_principal)}</p>
                        <p class="text-xs text-slate-400">Total débité: ${formatAmount(t.montant_total)}</p>
                    </div>
                    <div class="flex-shrink-0 flex items-center gap-2">
                         ${t.preuveUrl ? `<button class="btn btn-sm btn-secondary" data-action="view-proof" data-proof-url="${t.preuveUrl}"><i class="fas fa-camera mr-1"></i>Preuve</button>` : ''}
                         <button class="btn btn-sm btn-outline-secondary" data-action="view-details" data-transaction-id="${t.id}">
                            <i class="fas fa-search-plus mr-1"></i>Détails
                        </button>
                    </div>
                </div>
                <div class="bg-slate-50 px-4 py-2 text-xs text-slate-500 flex justify-between">
                    <span>Date: <strong>${formatDate(t.date)}</strong></span>
                    <span>Commission Agence: <strong>${formatAmount(t.commission_partenaire)}</strong></span>
                </div>
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    const card = createCard('Historique des Opérations', container, 'fa-history');

    card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const detailsButton = target.closest<HTMLButtonElement>('[data-action="view-details"]');
        const proofButton = target.closest<HTMLButtonElement>('[data-action="view-proof"]');

        if (detailsButton) {
            const transactionId = detailsButton.dataset.transactionId;
            const transaction = transactionMap.get(transactionId!);
            const opType = transaction ? opTypeMap.get(transaction.opTypeId) : null;
            if (transaction && opType) {
                showDetailsModal(transaction, opType, userMap, card);
            }
        } else if (proofButton) {
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
}
