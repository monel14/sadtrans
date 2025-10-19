import { User, Transaction, OperationType, Partner } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { $ } from '../utils/dom';

// Module-level variables to hold data and state
let allTransactions: Transaction[] = [];
let filteredTransactions: Transaction[] = []; // Store the currently filtered list for export
let allUsers: User[] = [];
let allPartners: Partner[] = [];
let allOpTypes: OperationType[] = [];
let userMap: Map<string, User> = new Map();
let partnerMap: Map<string, Partner> = new Map();
let opTypeMap: Map<string, OperationType> = new Map();
let lastLoadTime: number = 0;

// Variables pour la pagination
const ITEMS_PER_PAGE = 20;
let currentPage = 1;

// Helper to show image in fullscreen
function showImageFullscreen(img: HTMLImageElement) {
    const fullscreenModal = document.createElement('div');
    fullscreenModal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 cursor-pointer';
    fullscreenModal.innerHTML = `
        <div class="relative max-w-full max-h-full p-4">
            <img src="${img.src}" alt="${img.alt}" class="max-w-full max-h-full object-contain">
            <button class="absolute top-2 right-2 text-white text-3xl hover:text-gray-300 bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center" title="Fermer">
                &times;
            </button>
            <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
                ${img.alt} - Cliquez n'importe où pour fermer
            </div>
        </div>
    `;
    
    fullscreenModal.addEventListener('click', () => {
        fullscreenModal.remove();
    });
    
    document.body.appendChild(fullscreenModal);
}

// Make the function globally accessible for onclick handlers
(window as any).showImageFullscreen = showImageFullscreen;

// Helper function to show a details modal for a transaction
function showDetailsModal(transaction: Transaction) {
    const opType = opTypeMap.get(transaction.opTypeId);
    if (!opType) return;

    const existingModal = $('#detailsModal', document);
    existingModal?.remove();

    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal visible';
    
    const validator = transaction.validateurId ? userMap.get(transaction.validateurId) : null;
    const formattedStatus = formatTransactionStatus(transaction, userMap);
    const statusClass = transaction.statut === 'Validé' 
        ? 'badge-success' 
        : (transaction.statut.includes('En attente') || transaction.statut.includes('Assignée') 
            ? 'badge-warning' 
            : 'badge-danger');

    let dataFields = '';
    opType.fields.forEach(field => {
        if (field.obsolete) return;
        const value = transaction.data[field.name];
        
        // Handle image fields specially
        if (field.type === 'image') {
            if (value && typeof value === 'string' && value.trim() !== '') {
                dataFields += `
                    <div class="py-2 grid grid-cols-3 gap-4">
                        <dt class="text-sm font-medium text-slate-500">${field.label}</dt>
                        <dd class="text-sm text-slate-900 col-span-2">
                            <div class="image-preview-container">
                                <img src="${value}" alt="${field.label}" 
                                     class="max-w-full max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                     onclick="showImageFullscreen(this);"
                                     title="Cliquez pour agrandir/réduire">
                                <p class="text-xs text-slate-400 mt-1">Cliquez sur l'image pour l'agrandir</p>
                            </div>
                        </dd>
                    </div>
                `;
            } else {
                dataFields += `
                    <div class="py-2 grid grid-cols-3 gap-4">
                        <dt class="text-sm font-medium text-slate-500">${field.label}</dt>
                        <dd class="text-sm text-slate-900 col-span-2">
                            <div class="empty-image-field">
                                <i class="fas fa-image"></i>
                                <span>Aucune image fournie</span>
                            </div>
                        </dd>
                    </div>
                `;
            }
        } else {
            dataFields += `
                <div class="py-2 grid grid-cols-3 gap-4">
                    <dt class="text-sm font-medium text-slate-500">${field.label}</dt>
                    <dd class="text-sm text-slate-900 col-span-2">${value || '<em>Non fourni</em>'}</dd>
                </div>
            `;
        }
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
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Statut</dt><dd class="text-sm text-slate-900 col-span-2"><span class="badge ${statusClass}">${formattedStatus}</span></dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Date</dt><dd class="text-sm text-slate-900 col-span-2">${formatDate(transaction.date)}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Validateur</dt><dd class="text-sm text-slate-900 col-span-2">${validator?.name || '-'}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Motif de Rejet</dt><dd class="text-sm text-slate-900 col-span-2">${transaction.motif_rejet || '-'}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Commission Société</dt><dd class="text-sm font-bold text-emerald-600 col-span-2">${formatAmount(transaction.commission_societe)}</dd></div>
                    <div class="py-2 grid grid-cols-3 gap-4"><dt class="text-sm font-medium text-slate-500">Commission Partenaire</dt><dd class="text-sm font-bold text-blue-600 col-span-2">${formatAmount(transaction.commission_partenaire)}</dd></div>
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

    document.body.appendChild(modal);
}


// Helper function to export transactions to a CSV file
function exportTransactionsToCSV(transactions: Transaction[]) {
    const headers = [
        'ID Transaction', 'Date', 'Statut', 'Type Operation',
        'Agent', 'Partenaire', 'Montant Principal', 'Frais',
        'Montant Total', 'Commission Societe', 'Commission Partenaire'
    ];

    // Helper to escape commas and quotes in CSV fields
    const escapeCSV = (str: string | number | null | undefined): string => {
        if (str === null || str === undefined) return '';
        let s = String(str);
        // If the string contains a comma, double quote, or newline, wrap it in double quotes.
        if (s.search(/("|,|\n)/g) >= 0) {
            s = `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const rows = transactions.map(t => {
        const agent = userMap.get(t.agentId);
        const partner = agent ? partnerMap.get(agent.partnerId!) : null;
        const opType = opTypeMap.get(t.opTypeId);
        const formattedStatus = formatTransactionStatus(t, userMap);

        return [
            escapeCSV(t.id),
            escapeCSV(formatDate(t.date)),
            escapeCSV(formattedStatus),
            escapeCSV(opType?.name),
            escapeCSV(agent?.name),
            escapeCSV(partner?.name),
            t.montant_principal,
            t.frais,
            t.montant_total,
            t.commission_societe,
            t.commission_partenaire
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `export_transactions_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Helper function to render the list of transactions
function renderTransactionList(container: HTMLElement, transactions: Transaction[]) {
    console.log('DEBUG: renderTransactionList appelée. Page actuelle:', currentPage, 'Transactions à afficher:', transactions.length);
    
    const listElement = $('#transactions-list', container);
    if (!listElement) return;

    // Calculer les éléments à afficher pour la page courante
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const transactionsToDisplay = transactions.slice(startIndex, endIndex);
    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);

    listElement.innerHTML = '';

    if (transactions.length === 0) {
        listElement.innerHTML = '<li class="text-center text-slate-500 p-8">Aucune transaction ne correspond à vos critères de recherche.</li>';
        return;
    }

    transactionsToDisplay.forEach(t => {
        const agent = userMap.get(t.agentId);
        const partner = agent ? partnerMap.get(agent.partnerId!) : null;
        const opType = opTypeMap.get(t.opTypeId);
        
        const formattedStatus = formatTransactionStatus(t, userMap);
        const statusClass = t.statut === 'Validé'
            ? 'badge-success'
            : (t.statut.includes('En attente') || t.statut.includes('Assignée')
                ? 'badge-warning'
                : 'badge-danger');

        const li = document.createElement('li');
        li.className = 'card !p-0 overflow-hidden';
        li.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4">
                <div class="flex-grow">
                    <div class="flex items-center gap-4">
                        <span class="badge ${statusClass}">${formattedStatus}</span>
                        <p class="font-semibold text-slate-800">${opType?.name || 'Opération Inconnue'}</p>
                    </div>
                    <p class="text-sm text-slate-500 mt-1">
                        Initié par : <strong>${agent?.name || 'Inconnu'}</strong>
                        ${partner ? `(${partner.name})` : ''}
                    </p>
                </div>
                <div class="text-left md:text-right w-full md:w-auto">
                    <p class="text-lg font-bold text-slate-900">${formatAmount(t.montant_principal)}</p>
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
                <span>ID: <strong>${t.id}</strong></span>
            </div>
        `;
        listElement.appendChild(li);
    });

    // Nettoyer les anciennes paginations avant d'en ajouter une nouvelle
    const existingPaginations = container.querySelectorAll('div.flex.justify-center.mt-6');
    console.log('DEBUG: Paginations existantes avant nettoyage:', existingPaginations.length);
    existingPaginations.forEach(el => el.remove());

    // Ajouter la pagination
    const paginationElement = document.createElement('div');
    paginationElement.className = 'flex justify-center mt-6';
    paginationElement.innerHTML = `
        <nav class="flex items-center gap-2">
            <button id="prev-page" class="btn btn-sm btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            
            <span class="text-sm text-slate-600 mx-2">
                Page ${currentPage} sur ${totalPages}
            </span>
            
            <button id="next-page" class="btn btn-sm btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
            
            <span class="text-sm text-slate-600 mx-4">
                ${transactions.length} transactions au total
            </span>
        </nav>
    `;
    
    console.log('DEBUG: Insertion de nouvelle pagination. Total après insertion devrait être 1.');
    listElement.parentNode?.insertBefore(paginationElement, listElement.nextSibling);

    // Attacher les événements de pagination
    const prevButton = $('#prev-page', container);
    const nextButton = $('#next-page', container);
    
    prevButton?.addEventListener('click', () => {
        console.log('DEBUG: Clic sur bouton précédent. Page actuelle:', currentPage);
        if (currentPage > 1) {
            currentPage--;
            renderTransactionList(container, transactions);
        }
    });
    
    nextButton?.addEventListener('click', () => {
        console.log('DEBUG: Clic sur bouton suivant. Page actuelle:', currentPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTransactionList(container, transactions);
        }
    });
    
    console.log('DEBUG: Événements de pagination attachés.');
}

// Helper function to apply filters and re-render the list
function applyFilters(container: HTMLElement) {
    console.log('DEBUG: applyFilters appelée.');
    const form = $('#transaction-filters-form', container);
    if (!form) return;

    // Réinitialiser la page courante lorsqu'on applique des filtres
    currentPage = 1;

    const filters = {
        dateFrom: (form.querySelector('[name="date_from"]') as HTMLInputElement).value,
        dateTo: (form.querySelector('[name="date_to"]') as HTMLInputElement).value,
        opTypeId: (form.querySelector('[name="op_type_id"]') as HTMLSelectElement).value,
        status: (form.querySelector('[name="status"]') as HTMLSelectElement).value,
        agentId: (form.querySelector('[name="agent_id"]') as HTMLSelectElement).value,
        partnerId: (form.querySelector('[name="partner_id"]') as HTMLSelectElement)?.value,
    };
    
    let filtered = [...allTransactions];

    if (filters.dateFrom) {
        filtered = filtered.filter(t => new Date(t.date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
        filtered = filtered.filter(t => new Date(t.date) <= new Date(filters.dateTo + 'T23:59:59'));
    }
    if (filters.opTypeId) {
        filtered = filtered.filter(t => t.opTypeId === filters.opTypeId);
    }
    if (filters.status) {
        if (filters.status === 'pending') {
            filtered = filtered.filter(t => t.statut === 'En attente de validation' || t.statut === 'Assignée');
        } else {
            filtered = filtered.filter(t => t.statut === filters.status);
        }
    }
    if (filters.agentId) {
        filtered = filtered.filter(t => t.agentId === filters.agentId);
    }
     if (filters.partnerId) {
        const agentIdsForPartner = allUsers.filter(u => u.partnerId === filters.partnerId).map(u => u.id);
        filtered = filtered.filter(t => agentIdsForPartner.includes(t.agentId));
    }

    filteredTransactions = filtered; // Update the shared state for the export function
    console.log('DEBUG: Appel de renderTransactionList depuis applyFilters avec', filtered.length, 'transactions filtrées.');
    renderTransactionList(container, filteredTransactions);
}

// Function to reload all data
async function reloadAllData(): Promise<void> {
    const dataService = DataService.getInstance();
    
    // Force reload by invalidating caches
    dataService.invalidateTransactionsCache();
    dataService.invalidateUsersCache();
    dataService.invalidatePartnersCache();
    dataService.invalidateOperationTypesCache();
    
    // Fetch fresh data
    [allTransactions, allUsers, allPartners, allOpTypes, userMap, partnerMap, opTypeMap] = await Promise.all([
        dataService.getTransactions(),
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getAllOperationTypes(),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getOpTypeMap(),
    ]);
}

// Main render function for the view
export async function renderAllTransactionsView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    
    // Réinitialiser la page courante lors du chargement initial
    currentPage = 1;
    
    // Check if we need to reload data (if it's been more than 30 seconds or first load)
    const now = Date.now();
    const shouldReload = now - lastLoadTime > 30000 || allTransactions.length === 0;
    
    if (shouldReload) {
        await reloadAllData();
        lastLoadTime = now;
    }

    // Pre-filter transactions based on user role
    if (user.role === 'partner') {
        const agentIdsForPartner = allUsers.filter(u => u.partnerId === user.partnerId).map(u => u.id);
        allTransactions = allTransactions.filter(t => agentIdsForPartner.includes(t.agentId));
    }
    
    // Initialize the filtered list with all relevant transactions
    filteredTransactions = [...allTransactions];

    const agents = user.role === 'admin_general'
        ? allUsers.filter(u => u.role === 'agent')
        : allUsers.filter(u => u.role === 'agent' && u.partnerId === user.partnerId);

    // Create filter options HTML
    const partnerFilter = user.role === 'admin_general' ? `
        <div>
            <label class="form-label form-label-sm">Partenaire</label>
            <select name="partner_id" class="form-select form-select-sm">
                <option value="">Tous</option>
                ${allPartners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
        </div>` : '';

    const agentOptions = agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    const opTypeOptions = allOpTypes.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

    const container = document.createElement('div');
    container.innerHTML = `
        <form id="transaction-filters-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-md bg-slate-50">
            <div>
                <label class="form-label form-label-sm">De</label>
                <input type="date" name="date_from" class="form-input form-input-sm">
            </div>
            <div>
                <label class="form-label form-label-sm">À</label>
                <input type="date" name="date_to" class="form-input form-input-sm">
            </div>
            <div>
                <label class="form-label form-label-sm">Statut</label>
                <select name="status" class="form-select form-select-sm">
                    <option value="">Tous</option>
                    <option value="Validé">Validé</option>
                    <option value="pending">En attente</option>
                    <option value="Rejeté">Rejeté</option>
                </select>
            </div>
            <div>
                <label class="form-label form-label-sm">Type d'Opération</label>
                <select name="op_type_id" class="form-select form-select-sm">
                    <option value="">Tous</option>
                    ${opTypeOptions}
                </select>
            </div>
            ${partnerFilter}
            <div>
                <label class="form-label form-label-sm">Agent</label>
                <select name="agent_id" class="form-select form-select-sm">
                    <option value="">Tous</option>
                    ${agentOptions}
                </select>
            </div>
        </form>
        <div class="flex justify-between items-center mb-4">
            <button id="refresh-btn" class="btn btn-sm btn-primary">
                <i class="fas fa-sync-alt mr-2"></i>Actualiser
            </button>
            <button id="export-csv-btn" class="btn btn-sm btn-secondary">
                <i class="fas fa-file-csv mr-2"></i>Exporter en CSV
            </button>
        </div>
        <ul id="transactions-list" class="space-y-3"></ul>
    `;
    
    // Initial render
    renderTransactionList(container, allTransactions);

    const card = createCard('Toutes les Opérations', container, 'fa-list-ul');

    // Attach event listener for filtering
    const form = $('#transaction-filters-form', card);
    form?.addEventListener('change', () => applyFilters(card));

    // Handle partner filter changing agent options for admins
    if (user.role === 'admin_general') {
        const partnerSelect = form?.querySelector<HTMLSelectElement>('[name="partner_id"]');
        const agentSelect = form?.querySelector<HTMLSelectElement>('[name="agent_id"]');
        partnerSelect?.addEventListener('change', () => {
            const selectedPartnerId = partnerSelect.value;
            if (agentSelect) {
                const agentsForPartner = allUsers.filter(u => u.role === 'agent' && (selectedPartnerId === '' || u.partnerId === selectedPartnerId));
                agentSelect.innerHTML = `<option value="">Tous</option>` + agentsForPartner.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
            }
            applyFilters(card); // Re-apply filters when partner changes
        });
    }
    
    // Event listener for details/proof/export/refresh buttons (delegated to card)
    card.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const proofButton = target.closest<HTMLButtonElement>('[data-action="view-proof"]');
        const detailsButton = target.closest<HTMLButtonElement>('[data-action="view-details"]');
        const exportButton = target.closest<HTMLButtonElement>('#export-csv-btn');
        const refreshButton = target.closest<HTMLButtonElement>('#refresh-btn');

        if (proofButton) {
            const imageUrl = proofButton.dataset.proofUrl;
            if (imageUrl) {
                document.body.dispatchEvent(new CustomEvent('openViewProofModal', {
                    detail: { imageUrl },
                    bubbles: true, composed: true
                }));
            }
        } else if (detailsButton) {
            const transactionId = detailsButton.dataset.transactionId;
            const transaction = allTransactions.find(t => t.id === transactionId);
            if (transaction) {
                showDetailsModal(transaction);
            }
        } else if (exportButton) {
            exportTransactionsToCSV(filteredTransactions);
        } else if (refreshButton) {
            // Show loading state
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Actualisation...';
            
            try {
                // Reload data
                await reloadAllData();
                
                // Re-filter based on user role
                if (user.role === 'partner') {
                    const agentIdsForPartner = allUsers.filter(u => u.partnerId === user.partnerId).map(u => u.id);
                    allTransactions = allTransactions.filter(t => agentIdsForPartner.includes(t.agentId));
                }
                
                // Re-apply current filters
                applyFilters(card);
                
                // Show success message
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Historique mis à jour avec succès', type: 'success' }
                }));
            } catch (error) {
                console.error('Error refreshing data:', error);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Erreur lors de la mise à jour', type: 'error' }
                }));
            } finally {
                // Restore button state
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Actualiser';
            }
        }
    });

    // Listen for global transaction updates
    const handleTransactionUpdate = async () => {
        await reloadAllData();
        
        // Re-filter based on user role
        if (user.role === 'partner') {
            const agentIdsForPartner = allUsers.filter(u => u.partnerId === user.partnerId).map(u => u.id);
            allTransactions = allTransactions.filter(t => agentIdsForPartner.includes(t.agentId));
        }
        
        // Re-apply current filters
        applyFilters(card);
    };
    
    // Listen for transaction validation/rejection events
    document.body.addEventListener('transactionValidated', handleTransactionUpdate);
    document.body.addEventListener('transactionRejected', handleTransactionUpdate);
    document.body.addEventListener('transactionCreated', handleTransactionUpdate);
    
    // Listen for realtime transaction changes from Supabase
    document.body.addEventListener('transactionChanged', handleTransactionUpdate);
    
    // Cleanup listeners when the view is destroyed
    const cleanup = () => {
        document.body.removeEventListener('transactionValidated', handleTransactionUpdate);
        document.body.removeEventListener('transactionRejected', handleTransactionUpdate);
        document.body.removeEventListener('transactionCreated', handleTransactionUpdate);
        document.body.removeEventListener('transactionChanged', handleTransactionUpdate);
    };
    
    // Store cleanup function on the card element for later use
    (card as any)._cleanup = cleanup;

    return card;
}
