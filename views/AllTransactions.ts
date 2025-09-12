import { User, Transaction, OperationType, Partner } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';
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

        return [
            escapeCSV(t.id),
            escapeCSV(formatDate(t.date)),
            escapeCSV(t.statut),
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
    const listElement = $('#transactions-list', container);
    if (!listElement) return;

    listElement.innerHTML = '';

    if (transactions.length === 0) {
        listElement.innerHTML = '<li class="text-center text-slate-500 p-8">Aucune transaction ne correspond à vos critères de recherche.</li>';
        return;
    }

    transactions.forEach(t => {
        const agent = userMap.get(t.agentId);
        const partner = agent ? partnerMap.get(agent.partnerId!) : null;
        const opType = opTypeMap.get(t.opTypeId);

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
                        <span class="badge ${statusClass}">${t.statut}</span>
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
}

// Helper function to apply filters and re-render the list
function applyFilters(container: HTMLElement) {
    const form = $('#transaction-filters-form', container);
    if (!form) return;

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
            filtered = filtered.filter(t => t.statut.includes('En attente') || t.statut.includes('Assignée'));
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
    renderTransactionList(container, filteredTransactions);
}

// Main render function for the view
export async function renderAllTransactionsView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    
    // Fetch all necessary data once
    [allTransactions, allUsers, allPartners, allOpTypes, userMap, partnerMap, opTypeMap] = await Promise.all([
        dataService.getTransactions(),
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getAllOperationTypes(),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getOpTypeMap(),
    ]);

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
        <div class="flex justify-end mb-4">
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
    
    // Event listener for details/proof/export buttons (delegated to card)
    card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const proofButton = target.closest<HTMLButtonElement>('[data-action="view-proof"]');
        const exportButton = target.closest<HTMLButtonElement>('#export-csv-btn');

        if (proofButton) {
            const imageUrl = proofButton.dataset.proofUrl;
            if (imageUrl) {
                document.body.dispatchEvent(new CustomEvent('openViewProofModal', {
                    detail: { imageUrl },
                    bubbles: true, composed: true
                }));
            }
        } else if (exportButton) {
            exportTransactionsToCSV(filteredTransactions);
        }
        // Details button logic could be added here if a details modal is implemented for this view
    });

    return card;
}
