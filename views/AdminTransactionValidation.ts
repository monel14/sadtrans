import { User, Transaction, Partner, OperationType } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { $ } from '../utils/dom';

// Helper for category icons
const categoryIcons: { [key: string]: string } = {
    'Dépôts': 'fa-money-bill-wave',
    'Cartes VISA': 'fa-credit-card',
    'Gestion des décodeurs (Canal +)': 'fa-satellite-dish',
    'Ecobank Xpress': 'fa-university',
    'Western Union': 'fa-globe-americas',
    'Ria': 'fa-comments-dollar',
    'MoneyGram': 'fa-dollar-sign',
    'Gestion des factures': 'fa-file-invoice-dollar',
    'Services Divers': 'fa-cogs',
    'Non Catégorisé': 'fa-question-circle'
};
function getCategoryIcon(category: string): string {
    return categoryIcons[category] || 'fa-concierge-bell';
}

// Helper for transaction key details
function renderTransactionKeyDetails(transaction: Transaction, opType: OperationType): string {
    const data = transaction.data;
    if (!data) return '';

    let details = '';
    switch (opType.id) {
        case 'op_transfert_nat':
            details = `Bénéficiaire: <strong>${data.nom_beneficiaire || '?'}</strong> (${data.tel_beneficiaire || '?'})`;
            break;
        case 'op_paiement_sde':
            details = `Réf. Client SDE: <strong>${data.ref_client_sde || '?'}</strong>`;
            break;
        case 'op_reabo_canal':
        case 'op_abo_decodeur_canal':
            details = `Décodeur: <strong>${data.num_decodeur_canal || data.id_decodeur || '?'}</strong>`;
            break;
        case 'op_activation_carte':
            details = `Carte: <strong>${data.numero_carte || '?'}</strong> pour <strong>${data.nom_client || '?'}</strong>`;
            break;
        case 'op_recharge_carte_prepayee':
            details = `Carte: <strong>${data.id_carte || '?'}</strong>`;
            break;
        case 'op_depot_ecobank_xpress':
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

    return `<p class="text-sm text-slate-500 mt-1">${details}</p>`;
}

// Helper to render the new transaction list for a category
function renderTransactionList(
    items: Transaction[], 
    user: User, 
    data: { userMap: Map<string, User>, partnerMap: Map<string, Partner>, opTypeMap: Map<string, OperationType> }
): HTMLElement {
    const { userMap, partnerMap, opTypeMap } = data;
    
    if (items.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-center text-slate-500 p-4';
        p.textContent = 'Aucune transaction dans cette catégorie.';
        return p;
    }

    const list = document.createElement('ul');
    list.className = 'divide-y divide-slate-100';

    items.forEach(item => {
        const agent = userMap.get(item.agentId);
        const partner = agent ? partnerMap.get(agent.partnerId!) : null;
        const opType = opTypeMap.get(item.opTypeId);
        const assignedUser = item.assignedTo ? userMap.get(item.assignedTo) : null;

        const li = document.createElement('li');
        li.className = 'flex flex-col md:flex-row items-start justify-between p-3 gap-4 hover:bg-slate-50 transition-colors';

        // Left section: Initiator
        const initiatorDiv = document.createElement('div');
        initiatorDiv.className = 'w-full md:w-1/4';
        initiatorDiv.innerHTML = `
            <p class="font-semibold text-slate-800">${agent?.name || 'Inconnu'}</p>
            <p class="text-xs text-slate-500">${partner?.name || 'Partenaire Inconnu'}</p>
            <p class="text-xs text-slate-400 mt-1">${formatDate(item.date)}</p>
        `;

        // Center section: Operation Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'flex-grow w-full md:w-auto';
        if (opType) {
            detailsDiv.innerHTML = `
                <p class="font-medium text-slate-700">${opType.name}</p>
                ${renderTransactionKeyDetails(item, opType)}
            `;
        } else {
            detailsDiv.innerHTML = `<p class="font-medium text-red-500">Type d'opération inconnu</p>`;
        }
        
        // Right section: Amount & Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex flex-col items-end gap-2 w-full md:w-1/3';

        const amountDisplay = opType?.impactsBalance 
            ? `<p class="font-bold text-lg text-slate-900 text-right">${formatAmount(item.montant_principal)}</p>`
            : `<p class="font-semibold text-md text-right"><span class="badge badge-info">Service</span></p>`;

        actionsDiv.innerHTML = `
            ${amountDisplay}
            
            <div data-buttons-for="${item.id}" class="flex items-center justify-end gap-1 flex-wrap">
                <!-- Action buttons will be injected here -->
            </div>
        
            <div class="inline-validation-form w-full hidden" data-form-for="${item.id}">
                <!-- Inline form will be injected here -->
            </div>
            
            <p class="text-xs text-slate-500 mt-1 text-right" data-assigned-text-for="${item.id}">
                <!-- Assigned text goes here -->
            </p>
        `;
        
        const buttonsWrapper = actionsDiv.querySelector(`[data-buttons-for="${item.id}"]`);
        if (buttonsWrapper) {
            let actions = '';
            const validateButtonText = opType?.impactsBalance ? 'Valider' : 'Traiter';
            
            if (!item.assignedTo) {
                actions += `<button class="btn btn-xs btn-success !py-1 !px-2" data-task-id="${item.id}" data-action="assign-self" title="S'assigner"><i class="fas fa-user-plus mr-1"></i>S'assigner</button>`;
                if (user.role === 'admin_general') {
                    actions += `<button class="btn btn-xs btn-info text-white !py-1 !px-2" data-task-id="${item.id}" data-action="assign-other" title="Assigner à Sous-Admin"><i class="fas fa-user-tag"></i></button>`;
                }
            } else if (item.assignedTo === user.id) {
                actions += `<button class="btn btn-xs btn-success !py-1 !px-2" data-task-id="${item.id}" data-action="validate" title="${validateButtonText}"><i class="fas fa-check"></i> ${validateButtonText}</button>
                            <button class="btn btn-xs btn-danger !py-1 !px-2" data-task-id="${item.id}" data-action="reject" title="Rejeter"><i class="fas fa-times"></i> Rejeter</button>
                            <button class="btn btn-xs btn-outline-secondary !py-1 !px-2" data-task-id="${item.id}" data-action="unassign" title="Libérer"><i class="fas fa-undo"></i></button>`;
            } else if (user.role === 'admin_general') {
                 actions += `<button class="btn btn-xs btn-info text-white !py-1 !px-2" data-task-id="${item.id}" data-action="assign-other" title="Réassigner"><i class="fas fa-user-edit"></i></button>`;
            }
            actions += `<button class="btn btn-xs btn-outline-secondary !py-1 !px-2" data-task-id="${item.id}" data-action="view-details" title="Voir Détails"><i class="fas fa-search-plus"></i></button>`;
            buttonsWrapper.innerHTML = actions;
        }
        
        const assignedText = actionsDiv.querySelector(`[data-assigned-text-for="${item.id}"]`);
        if (assignedText) {
            assignedText.innerHTML = assignedUser ? `Assigné à: <strong>${assignedUser.name}</strong>` : '<span class="badge badge-gray">Non assignée</span>';
        }

        li.appendChild(initiatorDiv);
        li.appendChild(detailsDiv);
        li.appendChild(actionsDiv);
        list.appendChild(li);
    });

    return list;
}


export async function renderAdminTransactionValidationView(user: User, defaultFilter: 'unassigned' | 'assigned_to_me' | 'all' = 'unassigned'): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    
    const [allPending, userMap, partnerMap, opTypeMap] = await Promise.all([
        dataService.getTransactions({ status: 'pending' }),
        dataService.getUserMap(),
        dataService.getPartnerMap(),
        dataService.getOpTypeMap()
    ]);
    
    const unassignedItems = allPending.filter(item => !item.assignedTo);
    const myItems = allPending.filter(item => item.assignedTo === user.id);

    const showDetailsModal = (transaction: Transaction) => {
        const opType = opTypeMap.get(transaction.opTypeId);
        if (!opType) return;

        const existingModal = document.getElementById('transactionDetailsModal');
        existingModal?.remove();

        const modal = document.createElement('div');
        modal.id = 'transactionDetailsModal';
        modal.className = 'modal visible';
        
        let fieldsHtml = '';
        opType.fields.forEach(field => {
            if (field.obsolete) return;
            const value = transaction.data[field.name];
            fieldsHtml += `
                <div class="py-2 grid grid-cols-3 gap-4">
                    <dt class="text-sm font-medium text-slate-500">${field.label}</dt>
                    <dd class="text-sm text-slate-900 col-span-2">${value || '<em>Non fourni</em>'}</dd>
                </div>
            `;
        });
        
        modal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-slate-800">Détails de l'Opération #${transaction.id}</h3>
                    <button type="button" class="text-3xl text-slate-400 hover:text-slate-700" data-modal-close>&times;</button>
                </div>
                <div class="border-t border-b divide-y">
                    <dl class="divide-y">
                        ${fieldsHtml}
                        <div class="py-2 grid grid-cols-3 gap-4">
                            <dt class="text-sm font-medium text-slate-500">Commission Société</dt>
                            <dd class="text-sm font-bold text-emerald-600 col-span-2">${formatAmount(transaction.commission_societe)}</dd>
                        </div>
                         <div class="py-2 grid grid-cols-3 gap-4">
                            <dt class="text-sm font-medium text-slate-500">Commission Partenaire</dt>
                            <dd class="text-sm font-bold text-blue-600 col-span-2">${formatAmount(transaction.commission_partenaire)}</dd>
                        </div>
                    </dl>
                </div>
                <div class="mt-6 text-right">
                    <button type="button" class="btn btn-secondary" data-modal-close>Fermer</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target === modal || target.closest('[data-modal-close]')) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    };

    const tabsContent = document.createElement('div');
    tabsContent.innerHTML = `
        <div class="tabs">
            <button data-tab="unassigned" class="${defaultFilter === 'unassigned' ? 'active' : ''}">Non Assignées (${unassignedItems.length})</button>
            <button data-tab="assigned_to_me" class="${defaultFilter === 'assigned_to_me' ? 'active' : ''}">Mes Transactions (${myItems.length})</button>
            ${user.role === 'admin_general' ? `<button data-tab="all" class="${defaultFilter === 'all' ? 'active' : ''}">Toutes en Attente (${allPending.length})</button>` : ''}
        </div>
        <div id="transaction-table-container" class="tab-content pt-4">
        </div>
    `;

    const card = createCard('Validation des Transactions', tabsContent, 'fa-check-double');
    const tableContainer = $('#transaction-table-container', card) as HTMLElement;

    async function renderContentForTab(tabName: string) {
        let items: Transaction[] = [];
        if (tabName === 'unassigned') items = unassignedItems;
        else if (tabName === 'assigned_to_me') items = myItems;
        else if (tabName === 'all') items = allPending;

        tableContainer.innerHTML = '';
        if (items.length === 0) {
            tableContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">Aucune transaction à afficher.</p>';
            return;
        }

        const groupedTransactions = items.reduce((acc, transaction) => {
            const opType = opTypeMap.get(transaction.opTypeId);
            const category = opType?.category || 'Non Catégorisé';
            if (!acc[category]) acc[category] = [];
            acc[category].push(transaction);
            return acc;
        }, {} as Record<string, Transaction[]>);
        
        const sortedCategories = Object.keys(groupedTransactions).sort();

        for (const category of sortedCategories) {
            const transactionsInCategory = groupedTransactions[category];
            const categoryIcon = getCategoryIcon(category);

            const details = document.createElement('details');
            details.open = true;
            details.className = 'group mb-4 border bg-white rounded-lg shadow-sm overflow-hidden';

            const summary = document.createElement('summary');
            summary.className = 'p-3 font-semibold text-slate-700 bg-slate-50 cursor-pointer flex justify-between items-center list-none';
            summary.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${categoryIcon} text-violet-500 w-5 text-center mr-3"></i>
                    <span>${category}</span>
                </div>
                <div class="flex items-center">
                    <span class="badge badge-purple mr-4">${transactionsInCategory.length}</span>
                    <i class="fas fa-chevron-down transform transition-transform duration-200 text-slate-400 group-open:rotate-180"></i>
                </div>
            `;
            
            const listWrapper = renderTransactionList(transactionsInCategory, user, { userMap, partnerMap, opTypeMap });
            
            details.appendChild(summary);
            details.appendChild(listWrapper);
            tableContainer.appendChild(details);
        }
    }

    card.querySelector('.tabs')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            const tabName = target.dataset.tab;
            if (tabName) renderContentForTab(tabName);
        }
    });

    card.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.dataset.action === 'file-input' && target.type === 'file') {
            const preview = target.nextElementSibling as HTMLImageElement;
            const file = target.files?.[0];
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target?.result as string;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }
    });
    
    card.addEventListener('click', async e => {
        const target = e.target as HTMLElement;
        const actionButton = target.closest<HTMLButtonElement>('[data-action]');
        if (!actionButton) return;

        const taskId = actionButton.dataset.taskId;
        const action = actionButton.dataset.action;
        if (!taskId) return;
        
        const reloadView = async () => {
            const activeTab = card.querySelector('.tabs button.active')?.getAttribute('data-tab') || defaultFilter;
            const newCardContent = await renderAdminTransactionValidationView(user, activeTab as any);
            card.parentElement?.replaceChild(newCardContent, card);
        };

        const listItem = actionButton.closest('li');
        if (!listItem) return;

        const actionsContainer = listItem.querySelector<HTMLElement>(`[data-buttons-for="${taskId}"]`);
        const formContainer = listItem.querySelector<HTMLElement>(`[data-form-for="${taskId}"]`);
        const assignedText = listItem.querySelector<HTMLElement>(`[data-assigned-text-for="${taskId}"]`);
        
        const transaction = allPending.find(t => t.id === taskId);
        
        switch(action) {
            case 'assign-self':
                await api.assignTask(taskId, 'transaction', user.id);
                await reloadView();
                break;
            case 'unassign':
                await api.assignTask(taskId, 'transaction', null);
                await reloadView();
                break;
            case 'view-details':
                if (transaction) showDetailsModal(transaction);
                return;
            case 'assign-other':
                document.body.dispatchEvent(new CustomEvent('openAssignModal', { detail: { taskId } }));
                return;
            case 'validate':
                if (actionsContainer) actionsContainer.classList.add('hidden');
                if (assignedText) assignedText.classList.add('hidden');
                if (formContainer) {
                    formContainer.innerHTML = `
                        <h4 class="text-sm font-semibold mb-2 text-slate-700 text-left">Joindre la preuve de l'opération</h4>
                        <input type="file" class="form-input form-input-sm" accept="image/*" data-action="file-input" required>
                        <img src="" alt="Aperçu" class="mt-2 rounded-md max-h-40 hidden w-full object-contain bg-slate-200" data-action="image-preview">
                        <div class="flex gap-2 mt-3 justify-end">
                            <button class="btn btn-xs btn-secondary" data-action="cancel-validation" data-task-id="${taskId}">Annuler</button>
                            <button class="btn btn-xs btn-success" data-action="validate-confirm" data-task-id="${taskId}">Confirmer</button>
                        </div>`;
                    formContainer.classList.remove('hidden');
                }
                break;
            case 'reject':
                if (actionsContainer) actionsContainer.classList.add('hidden');
                if (assignedText) assignedText.classList.add('hidden');
                if (formContainer) {
                    formContainer.innerHTML = `
                        <h4 class="text-sm font-semibold mb-2 text-slate-700 text-left">Motif du rejet (obligatoire)</h4>
                        <textarea class="form-textarea form-input-sm w-full" rows="2" data-action="rejection-reason" placeholder="Expliquez pourquoi..."></textarea>
                        <div class="flex gap-2 mt-3 justify-end">
                            <button class="btn btn-xs btn-secondary" data-action="cancel-validation" data-task-id="${taskId}">Annuler</button>
                            <button class="btn btn-xs btn-danger" data-action="reject-confirm" data-task-id="${taskId}">Confirmer Rejet</button>
                        </div>`;
                    formContainer.classList.remove('hidden');
                }
                break;
            case 'cancel-validation':
                if (actionsContainer) actionsContainer.classList.remove('hidden');
                if (assignedText) assignedText.classList.remove('hidden');
                if (formContainer) {
                    formContainer.classList.add('hidden');
                    formContainer.innerHTML = '';
                }
                break;
            case 'validate-confirm':
                const fileInput = formContainer?.querySelector<HTMLInputElement>('input[type="file"]');
                const file = fileInput?.files?.[0];
                if (!file) {
                    document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Veuillez sélectionner une image comme preuve.", type: 'warning' } }));
                    return;
                }
                actionButton.disabled = true;
                actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                
                await api.validateTransaction(taskId, file);
                await reloadView();
                break;
            case 'reject-confirm':
                const reason = formContainer?.querySelector<HTMLTextAreaElement>('textarea')?.value.trim();
                if (!reason) {
                    document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Veuillez fournir un motif de rejet.", type: 'warning' } }));
                    return;
                }
                actionButton.disabled = true;
                actionButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
                await api.rejectTransaction(taskId, reason);
                await reloadView();
                break;
        }
    });

    await renderContentForTab(defaultFilter);
    return card;
}
