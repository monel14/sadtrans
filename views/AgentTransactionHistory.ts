
import { User, Transaction, OperationType } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { $ } from '../utils/dom';

// Variables pour la pagination
let ITEMS_PER_PAGE = 20;
let currentPage = 1;

// Helper to get the most relevant transaction details for display
function getTransactionKeyDetails(transaction: Transaction, opType: OperationType | undefined): string {
    if (!opType) return `ID: ${transaction.id}`;
    const data = transaction.data;
    if (!data) return `ID: ${transaction.id}`;

    let details = '';
    switch (opType.id) {
        case 'op_transfert_nat':
            details = `Bénéficiaire: <strong>${data.nom_beneficiaire || '?'}</strong> (${data.tel_beneficiaire || '?'})`;
            break;
        case 'op_paiement_sde':
        case 'op_paiement_facture':
            details = `Réf. Facture: <strong>${data.ref_client_sde || data.ref_facture || '?'}</strong>`;
            break;
        case 'op_reabo_canal':
        case 'op_abo_decodeur_canal':
        case 'op_complement_canal':
            details = `Décodeur: <strong>${data.num_decodeur_canal || data.id_decodeur || '?'}</strong>`;
            break;
        case 'op_activation_carte':
        case 'op_deactivate_carte':
            details = `Carte: <strong>${data.numero_carte || '?'}</strong> pour <strong>${data.nom_client || '?'}</strong>`;
            break;
        case 'op_recharge_carte_prepayee':
            details = `Carte: <strong>${data.id_carte || '?'}</strong>`;
            break;
        case 'op_depot_ecobank_xpress':
        case 'op_rapid_transfert_eco':
            details = `Compte Xpress: <strong>${data.compte_xpress || '?'}</strong>`;
            break;
        case 'op_retrait_ecobank_xpress':
            details = `Code Retrait: <strong>${data.code_retrait || '?'}</strong>`;
            break;
        case 'op_envoi_wu':
        case 'op_envoi_ria':
        case 'op_envoi_mg':
            details = `Vers: <strong>${data.nom_beneficiaire || '?'}</strong>, ${data.pays_destination || '?'}`;
            break;
        case 'op_retrait_wu':
            details = `MTCN: <strong>${data.code_mtcn || '?'}</strong>`;
            break;
        case 'op_retrait_ria':
            details = `PIN: <strong>${data.code_pin || '?'}</strong>`;
            break;
        case 'op_retrait_mg':
            details = `Réf: <strong>${data.code_reference || '?'}</strong>`;
            break;
        default:
            details = `ID: ${transaction.id}`;
            break;
    }
    return details;
}


// Helper function to render the paginated transaction list
function renderTransactionList(container: HTMLElement, transactions: Transaction[], opTypeMap: Map<string, OperationType>, userMap: Map<string, User>, transactionMap: Map<string, Transaction>) {
    // Calculer les éléments à afficher pour la page courante
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const transactionsToDisplay = transactions.slice(startIndex, endIndex);
    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);

    // Supprimer l'ancienne liste et pagination
    const existingList = container.querySelector('ul');
    const existingNoResults = container.querySelector('p.text-center');
    const existingPagination = container.querySelector('.pagination-container');
    
    if (existingList) existingList.remove();
    if (existingNoResults) existingNoResults.remove();
    if (existingPagination) existingPagination.remove();

    if (transactionsToDisplay.length === 0) {
        const noResults = document.createElement('p');
        noResults.className = 'text-center text-slate-500 p-4';
        noResults.textContent = currentPage === 1 ? 'Aucune transaction trouvée avec ces filtres.' : 'Aucune transaction sur cette page.';
        container.appendChild(noResults);
        return;
    }

    // Créer la liste des transactions
    const list = document.createElement('ul');
    list.className = 'space-y-3';
    
    transactionsToDisplay.forEach(t => {
        const opType = opTypeMap.get(t.opTypeId);
        const keyDetails = getTransactionKeyDetails(t, opType);

        const formattedStatus = formatTransactionStatus(t, userMap);
        const statusClass = t.statut === 'Validé' ? 'badge-success' : (t.statut.includes('En attente') || t.statut.includes('Assignée') ? 'badge-warning' : 'badge-danger');
        
        const totalDebite = (t.montant_total != null && t.montant_total > 0) 
            ? t.montant_total 
            : t.montant_principal + (t.frais || 0);

        const li = document.createElement('li');
        li.className = 'card !p-0 overflow-hidden';
        li.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4">
                <div class="flex-grow">
                    <div class="flex items-center gap-4">
                        <span class="badge ${statusClass}">${formattedStatus}</span>
                        <p class="font-semibold text-slate-800">${opType?.name || 'Opération Inconnue'}</p>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">${keyDetails}</p>
                </div>
                <div class="text-left md:text-right w-full md:w-auto">
                    <p class="text-lg font-bold text-slate-900">${formatAmount(t.montant_principal)}</p>
                    <p class="text-xs text-slate-400">Total débité: ${formatAmount(totalDebite)}</p>
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

    // Ajouter la pagination si nécessaire
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container flex justify-between items-center mt-6 p-4 bg-slate-50 rounded-md';
        
        paginationContainer.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="text-sm text-slate-600">
                    Affichage de ${startIndex + 1} à ${Math.min(endIndex, transactions.length)} sur ${transactions.length} transactions
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs text-slate-500">Par page:</label>
                    <select id="items-per-page" class="form-select form-select-xs">
                        <option value="10" ${ITEMS_PER_PAGE === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${ITEMS_PER_PAGE === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${ITEMS_PER_PAGE === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${ITEMS_PER_PAGE === 100 ? 'selected' : ''}>100</option>
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
        
        container.appendChild(paginationContainer);

        // Attacher les événements de pagination
        const firstButton = $('#first-page', container);
        const prevButton = $('#prev-page', container);
        const nextButton = $('#next-page', container);
        const lastButton = $('#last-page', container);
        const itemsPerPageSelect = $('#items-per-page', container) as HTMLSelectElement;
        
        firstButton?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage = 1;
                renderTransactionList(container, transactions, opTypeMap, userMap, transactionMap);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        prevButton?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTransactionList(container, transactions, opTypeMap, userMap, transactionMap);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        nextButton?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTransactionList(container, transactions, opTypeMap, userMap, transactionMap);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        lastButton?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage = totalPages;
                renderTransactionList(container, transactions, opTypeMap, userMap, transactionMap);
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        itemsPerPageSelect?.addEventListener('change', () => {
            ITEMS_PER_PAGE = parseInt(itemsPerPageSelect.value);
            currentPage = 1; // Réinitialiser à la première page
            renderTransactionList(container, transactions, opTypeMap, userMap, transactionMap);
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

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

    // Generate operation type options
    const opTypeOptions = Array.from(opTypeMap.values())
        .filter(opType => opType.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(opType => `<option value="${opType.id}">${opType.name}</option>`)
        .join('');

    const formHtml = `
        <div class="mb-6 p-4 border rounded-md bg-slate-50">
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-medium text-slate-700"><i class="fas fa-filter mr-2"></i>Filtres</h4>
                <button type="button" class="btn btn-xs btn-outline-secondary" id="clearFiltersBtn">
                    <i class="fas fa-times mr-1"></i>Effacer
                </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label class="form-label form-label-sm">Plage de Dates</label><input type="date" class="form-input form-input-sm" id="dateFilter"></div>
                <div><label class="form-label form-label-sm">Type d'Opération</label><select class="form-select form-select-sm" id="operationTypeFilter"><option value="">Tous</option>${opTypeOptions}</select></div>
                <div><label class="form-label form-label-sm">Statut</label><select class="form-select form-select-sm" id="statusFilter"><option value="">Tous</option><option value="Validé">Validé</option><option value="En attente">En attente</option><option value="Rejeté">Rejeté</option></select></div>
            </div>
        </div>
    `;
    container.innerHTML = formHtml;

    // Réinitialiser la page courante lors du chargement initial
    currentPage = 1;

    // Ajouter le compteur de résultats initial
    const initialCounter = document.createElement('div');
    initialCounter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
    initialCounter.innerHTML = `<i class="fas fa-list mr-2"></i>${agentTransactions.length} transaction(s) au total`;
    container.appendChild(initialCounter);

    // Rendre la liste initiale avec pagination
    renderTransactionList(container, agentTransactions, opTypeMap, userMap, transactionMap);

    const card = createCard('Historique des Opérations', container, 'fa-history');

    // Function to filter and render transactions
    const filterAndRenderTransactions = () => {
        const dateFilter = ($('#dateFilter', card) as HTMLInputElement)?.value;
        const opTypeFilter = ($('#operationTypeFilter', card) as HTMLSelectElement)?.value;
        const statusFilter = ($('#statusFilter', card) as HTMLSelectElement)?.value;

        let filteredTransactions = agentTransactions;

        // Apply filters
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            filteredTransactions = filteredTransactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate.toDateString() === filterDate.toDateString();
            });
        }

        if (opTypeFilter) {
            filteredTransactions = filteredTransactions.filter(t => t.opTypeId === opTypeFilter);
        }

        if (statusFilter) {
            filteredTransactions = filteredTransactions.filter(t => {
                if (statusFilter === 'En attente') {
                    return t.statut.includes('En attente') || t.statut.includes('Assignée');
                } else if (statusFilter === 'Rejeté') {
                    return t.statut === 'Rejeté';
                }
                return t.statut === statusFilter;
            });
        }

        // Réinitialiser la page courante lors du filtrage
        currentPage = 1;

        // Supprimer l'ancien compteur de résultats
        const existingCounter = card.querySelector('.results-counter');
        if (existingCounter) existingCounter.remove();

        // Ajouter le compteur de résultats
        const counter = document.createElement('div');
        counter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
        counter.innerHTML = `<i class="fas fa-filter mr-2"></i>${filteredTransactions.length} transaction(s) trouvée(s)${filteredTransactions.length !== agentTransactions.length ? ` sur ${agentTransactions.length}` : ''}`;
        card.appendChild(counter);

        // Rendre la liste avec pagination
        renderTransactionList(card, filteredTransactions, opTypeMap, userMap, transactionMap);
    };

    // Add automatic filter event listeners
    const dateFilter = $('#dateFilter', card) as HTMLInputElement;
    const opTypeFilter = $('#operationTypeFilter', card) as HTMLSelectElement;
    const statusFilter = $('#statusFilter', card) as HTMLSelectElement;
    const clearFiltersBtn = $('#clearFiltersBtn', card) as HTMLButtonElement;

    // Function to clear all filters
    const clearAllFilters = () => {
        if (dateFilter) dateFilter.value = '';
        if (opTypeFilter) opTypeFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        currentPage = 1; // Réinitialiser la page
        filterAndRenderTransactions();
    };

    // Apply filters automatically on change
    if (dateFilter) {
        dateFilter.addEventListener('change', filterAndRenderTransactions);
    }
    if (opTypeFilter) {
        opTypeFilter.addEventListener('change', filterAndRenderTransactions);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', filterAndRenderTransactions);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Add event listeners for other actions
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
