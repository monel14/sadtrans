import { createCard } from '../components/Card';
import { DataService } from '../services/data.service';
import { User, OperationType, OperationTypeField, CommissionTier, OperationTypeFieldOption } from '../models';
import { ApiService } from '../services/api.service';
import { $ } from '../utils/dom';
import { hasAmountField, getAmountField } from '../utils/operation-type-helpers';

// Helper function to display options in the form (supports both string[] and OperationTypeFieldOption[])
function getOptionsDisplayValue(options: string[] | OperationTypeFieldOption[] | undefined): string {
    if (!options || options.length === 0) return '';

    // Check if it's the new enriched format
    if (typeof options[0] === 'object' && 'valeur' in options[0]) {
        return (options as OperationTypeFieldOption[]).map(opt => opt.valeur).join(',');
    }

    // Old format: simple string array
    return (options as string[]).join(',');
}



// Store component state locally
let allOpTypes: OperationType[] = [];
let selectedOpType: OperationType | null = null;
let detailView: HTMLElement | null = null;
let masterList: HTMLElement | null = null;
let tierCounter = 0;
let cardTypes: any[] = [];


/**
 * Renders the main detail view for a selected operation type.
 */
function renderDetailView() {
    if (!detailView || !selectedOpType) {
        if (detailView) {
            detailView.innerHTML = `
                <div class="h-full flex items-center justify-center text-center text-slate-500 p-8">
                    <div>
                        <i class="fas fa-arrow-left fa-2x mb-4"></i>
                        <h3 class="text-lg font-semibold">Sélectionnez un service</h3>
                        <p>Choisissez un service dans la liste de gauche pour voir et modifier sa configuration.</p>
                    </div>
                </div>
            `;
        }
        return;
    }

    // Deep copy for editing, allowing cancellation
    const opTypeForEditing = JSON.parse(JSON.stringify(selectedOpType));
    tierCounter = 0;

    detailView.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-slate-800">${opTypeForEditing.name}</h3>
            <button id="save-op-type-btn" class="btn btn-primary"><i class="fas fa-save mr-2"></i>Enregistrer les modifications</button>
        </div>
        <div class="tabs">
            <button data-tab="settings" class="active">Paramètres Généraux</button>
            <button data-tab="form">Éditeur de Formulaire</button>
            <button data-tab="fees">Frais & Commissions</button>
        </div>
        <div id="detail-tab-content" class="mt-4"></div>
    `;

    const tabContent = $('#detail-tab-content', detailView) as HTMLElement;

    // --- Tab rendering functions ---
    const renderSettingsTab = () => {
        tabContent.innerHTML = `
            <form id="settingsForm" class="space-y-4 p-4 border rounded-b-lg">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Nom du service</label>
                        <input type="text" name="name" class="form-input" value="${opTypeForEditing.name}" required>
                    </div>
                    <div>
                        <label class="form-label">Catégorie</label>
                        <input type="text" name="category" id="category-input" class="form-input" value="${opTypeForEditing.category}" required>
                        <small class="text-xs text-slate-500">Utilisez "Cartes VISA" pour auto-configurer les champs de type de carte</small>
                    </div>
                </div>
                <div>
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-textarea" rows="2">${opTypeForEditing.description}</textarea>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                     <div>
                        <label class="form-label">Statut</label>
                        <select name="status" class="form-select">
                            <option value="active" ${opTypeForEditing.status === 'active' ? 'selected' : ''}>Actif</option>
                            <option value="inactive" ${opTypeForEditing.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                        </select>
                    </div>
                     <div>
                        <label class="form-label">Impacte le Solde</label>
                        <select name="impactsBalance" class="form-select">
                            <option value="true" ${opTypeForEditing.impactsBalance ? 'selected' : ''}>Oui</option>
                            <option value="false" ${!opTypeForEditing.impactsBalance ? 'selected' : ''}>Non</option>
                        </select>
                    </div>
                </div>
            </form>
        `;
        
        // Add event listener for category changes
        const categoryInput = tabContent.querySelector('#category-input') as HTMLInputElement;
        if (categoryInput) {
            categoryInput.addEventListener('blur', () => {
                const newCategory = categoryInput.value.trim();
                if (newCategory === 'Cartes VISA' && opTypeForEditing.category !== 'Cartes VISA') {
                    // Category changed to Cartes VISA, add card type field if not exists
                    const hasCardTypeField = opTypeForEditing.fields.some(f => f.name === 'card_type');
                    if (!hasCardTypeField && cardTypes.length > 0) {
                        opTypeForEditing.fields.unshift({
                            id: 'f_card_type_' + Date.now(),
                            name: 'card_type',
                            type: 'select',
                            label: 'Type de carte',
                            options: cardTypes.map(ct => ct.name),
                            required: true,
                            readonly: false,
                            obsolete: false
                        });
                        document.body.dispatchEvent(new CustomEvent('showToast', { 
                            detail: { message: 'Champ "Type de carte" ajouté automatiquement', type: 'info' } 
                        }));
                    }
                }
                opTypeForEditing.category = newCategory;
            });
        }
    };

    const renderFormTab = () => {
        const isCartesVisa = opTypeForEditing.category === 'Cartes VISA';
        const hasCardTypeField = opTypeForEditing.fields.some(f => f.name === 'card_type');
        
        const amountField = getAmountField(opTypeForEditing);
        const amountFieldInfo = amountField 
            ? `<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>Champ de montant: "${amountField.label}"</span>`
            : opTypeForEditing.impactsBalance 
                ? `<span class="text-orange-600"><i class="fas fa-exclamation-triangle mr-1"></i>Aucun champ de montant défini (requis pour les services qui impactent le solde)</span>`
                : `<span class="text-slate-500"><i class="fas fa-info-circle mr-1"></i>Aucun champ de montant défini</span>`;
        
        tabContent.innerHTML = `
            <div class="p-4 border rounded-b-lg">
                <div class="flex justify-between items-center mb-4">
                    <p class="text-sm text-slate-500">Définissez les champs que l'agent devra remplir. Utilisez les flèches pour réorganiser.</p>
                    <div class="text-sm">${amountFieldInfo}</div>
                </div>
                <div id="fields-list-container" class="space-y-2"></div>
                <div class="flex gap-2 mt-4">
                    <button id="add-field-btn" class="btn btn-sm btn-outline-secondary"><i class="fas fa-plus mr-2"></i>Ajouter un champ</button>
                    ${!amountField ? `<button id="add-amount-field-btn" class="btn btn-sm btn-outline-success"><i class="fas fa-calculator mr-2"></i>Ajouter champ de montant</button>` : ''}
                    ${isCartesVisa && !hasCardTypeField ? `<button id="add-card-type-btn" class="btn btn-sm btn-outline-primary"><i class="fas fa-credit-card mr-2"></i>Ajouter Type de carte</button>` : ''}
                </div>
            </div>
        `;
        const fieldsContainer = $('#fields-list-container', tabContent) as HTMLElement;
        opTypeForEditing.fields.forEach((field: OperationTypeField, index: number) => {
            fieldsContainer.appendChild(createFieldEditor(field, index, opTypeForEditing.fields.length));
        });
    };

    const renderFeesTab = () => {
        const config = opTypeForEditing.commissionConfig;
        tabContent.innerHTML = `
            <form id="feesForm" class="space-y-4 p-4 border rounded-b-lg">
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Part de la Société (%)</label>
                        <input type="number" min="0" max="100" name="partageSociete" class="form-input" value="${config.partageSociete || 40}">
                    </div>
                     <div>
                        <label class="form-label">Logique des Frais</label>
                        <select name="feeApplication" class="form-select">
                            <option value="additive" ${opTypeForEditing.feeApplication !== 'inclusive' ? 'selected' : ''}>Additive (Frais en plus)</option>
                            <option value="inclusive" ${opTypeForEditing.feeApplication === 'inclusive' ? 'selected' : ''}>Inclusive (Frais inclus)</option>
                        </select>
                    </div>
                </div>
                <div class="pt-4 border-t">
                    <h4 class="font-semibold text-slate-700 mb-2">Frais Supplémentaires</h4>
                    <p class="text-sm text-slate-500 mb-3">Configurez des frais supplémentaires qui s'ajoutent au montant principal selon des conditions spécifiques.</p>
                    <div id="additional-fees-container" class="space-y-2"></div>
                    <button id="add-additional-fee-btn" class="btn btn-sm btn-outline-secondary mt-4"><i class="fas fa-plus mr-2"></i>Ajouter un frais supplémentaire</button>
                </div>
            </form>
        `;
        const additionalFeesContainer = $('#additional-fees-container', tabContent) as HTMLElement;
        if (config.additionalFees && config.additionalFees.length > 0) {
            config.additionalFees.forEach((fee: any) => additionalFeesContainer.appendChild(createAdditionalFeeEditor(fee)));
        } else {
            additionalFeesContainer.innerHTML = `<p class="text-sm text-slate-500 p-2 bg-slate-100 rounded">Aucun frais supplémentaire configuré. Cliquez sur "Ajouter un frais supplémentaire" pour en créer un.</p>`;
        }
        
        // Garder aussi les paliers de commission existants pour la rétrocompatibilité
        if (config.type === 'tiers' && config.tiers && config.tiers.length > 0) {
            const tiersSection = document.createElement('div');
            tiersSection.className = 'pt-4 border-t';
            tiersSection.innerHTML = `
                <h4 class="font-semibold text-slate-700 mb-2">Paliers de Commission (Legacy)</h4>
                <p class="text-sm text-slate-500 mb-3">Configuration héritée des paliers de commission.</p>
                <div id="tiers-list-container" class="space-y-2"></div>
                <button id="add-tier-btn" class="btn btn-sm btn-outline-secondary mt-4"><i class="fas fa-plus mr-2"></i>Ajouter un palier</button>
            `;
            tabContent.appendChild(tiersSection);
            
            const tiersContainer = $('#tiers-list-container', tiersSection) as HTMLElement;
            config.tiers.forEach((tier: any) => tiersContainer.appendChild(createTierEditor(tier)));
        }
    };

    // Initial tab load
    renderSettingsTab();

    // Tab switching logic
    detailView.querySelector('.tabs')?.addEventListener('click', e => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName !== 'BUTTON') return;

        detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        switch (target.dataset.tab) {
            case 'form': renderFormTab(); break;
            case 'fees': renderFeesTab(); break;
            default: renderSettingsTab(); break;
        }
    });
}

/**
 * Creates an HTML element for editing a single form field.
 */
function createFieldEditor(field: OperationTypeField, index: number, total: number): HTMLElement {
    const editor = document.createElement('div');
    editor.className = 'field-editor p-2 border rounded-md bg-slate-50';
    editor.dataset.id = field.id;
    
    // Check if this is a card type field and auto-populate options
    const isCardTypeField = field.name === 'card_type' || field.label?.toLowerCase().includes('type de carte');
    let optionsValue = getOptionsDisplayValue(field.options);
    
    // If it's a card type field in Cartes VISA category, auto-populate with card types
    if (isCardTypeField && selectedOpType?.category === 'Cartes VISA' && cardTypes.length > 0) {
        optionsValue = cardTypes.map(ct => ct.name).join(',');
    }
    
    editor.innerHTML = `
         <div class="flex justify-between items-center">
            <div class="flex items-center flex-grow">
                <i class="fas fa-grip-vertical text-slate-400 mr-3 cursor-move"></i>
                <input type="text" class="form-input form-input-sm font-semibold !p-1 !border-transparent bg-transparent" data-prop="label" value="${field.label || ''}">
            </div>
            <div class="flex items-center gap-2">
                <button type="button" class="btn btn-xs btn-secondary" data-action="move-up" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                <button type="button" class="btn btn-xs btn-secondary" data-action="move-down" ${index === total - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                <button type="button" class="btn btn-xs btn-danger" data-action="remove-field"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
        <div class="pl-6 pt-2 mt-2 border-t">
             <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label class="form-label form-label-sm">Nom (clé)</label><input type="text" class="form-input form-input-sm" data-prop="name" value="${field.name || ''}"></div>
                <div><label class="form-label form-label-sm">Type</label>
                    <select class="form-select form-select-sm" data-prop="type">
                        <option value="text" ${field.type === 'text' ? 'selected' : ''}>Texte</option>
                        <option value="number" ${field.type === 'number' ? 'selected' : ''}>Nombre</option>
                        <option value="tel" ${field.type === 'tel' ? 'selected' : ''}>Téléphone</option>
                        <option value="date" ${field.type === 'date' ? 'selected' : ''}>Date</option>
                        <option value="select" ${field.type === 'select' || isCardTypeField ? 'selected' : ''}>Liste</option>
                        <option value="image" ${field.type === 'image' ? 'selected' : ''}>Image</option>
                    </select>
                </div>
                <div class="field-options-container" ${field.type === 'image' ? 'style="display: none;"' : ''}>
                    <label class="form-label form-label-sm">Options (séparées par ,)</label>
                    <input type="text" class="form-input form-input-sm" data-prop="options" value="${optionsValue}" ${isCardTypeField ? 'readonly title="Options automatiquement générées depuis les types de cartes"' : ''}>
                    ${isCardTypeField ? '<small class="text-xs text-blue-600">🔗 Synchronisé avec les types de cartes</small>' : ''}
                </div>
            </div>
            <div class="flex gap-4 mt-3">
                <div class="flex items-center"><input type="checkbox" data-prop="required" class="mr-2" ${field.required ? 'checked' : ''}><label class="form-label form-label-sm">Requis</label></div>
                <div class="flex items-center"><input type="checkbox" data-prop="readonly" class="mr-2" ${field.readonly ? 'checked' : ''}><label class="form-label form-label-sm">Lecture seule</label></div>
                <div class="flex items-center ${field.type !== 'number' ? 'opacity-50' : ''}"><input type="checkbox" data-prop="isAmountField" class="mr-2" ${field.isAmountField ? 'checked' : ''} ${field.type !== 'number' ? 'disabled' : ''}><label class="form-label form-label-sm">Champ de montant</label></div>
            </div>
        </div>
    `;
    return editor;
}

/**
 * Creates an HTML element for editing a single commission tier.
 */
function createTierEditor(tier: CommissionTier): HTMLElement {
    tierCounter++;
    const editor = document.createElement('div');
    editor.className = 'tier-editor grid grid-cols-12 gap-2 items-center';
    editor.dataset.id = String(tierCounter);
    editor.innerHTML = `
        <div class="col-span-3"><input type="number" class="form-input form-input-sm" data-prop="from" value="${tier.from}" placeholder="De (XOF)"></div>
        <div class="col-span-3"><input type="number" class="form-input form-input-sm" data-prop="to" value="${tier.to === Infinity ? '' : tier.to}" placeholder="À (XOF)"></div>
        <div class="col-span-3">
            <select class="form-select form-select-sm" data-prop="type">
                <option value="fixed" ${tier.type === 'fixed' ? 'selected' : ''}>Fixe (XOF)</option>
                <option value="percentage" ${tier.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
            </select>
        </div>
        <div class="col-span-2"><input type="number" step="0.01" class="form-input form-input-sm" data-prop="value" value="${tier.value}" placeholder="Valeur"></div>
        <div class="col-span-1 text-right"><button type="button" class="btn btn-xs btn-danger" data-action="remove-tier"><i class="fas fa-trash-alt"></i></button></div>
    `;
    return editor;
}

/**
 * Creates an HTML element for editing a single additional fee.
 */
function createAdditionalFeeEditor(fee: any): HTMLElement {
    const editor = document.createElement('div');
    editor.className = 'additional-fee-editor p-4 border rounded-md bg-slate-50';
    editor.dataset.id = fee.id || 'fee_' + Date.now();
    
    editor.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-2">
                <input type="checkbox" data-prop="active" class="mr-2" ${fee.active !== false ? 'checked' : ''}>
                <input type="text" class="form-input form-input-sm font-semibold !p-1 !border-transparent bg-transparent" data-prop="name" value="${fee.name || 'Nouveau frais'}" placeholder="Nom du frais">
            </div>
            <button type="button" class="btn btn-xs btn-danger" data-action="remove-additional-fee"><i class="fas fa-trash-alt"></i></button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
                <label class="form-label form-label-sm">Description</label>
                <input type="text" class="form-input form-input-sm" data-prop="description" value="${fee.description || ''}" placeholder="Description optionnelle">
            </div>
            <div>
                <label class="form-label form-label-sm">Type</label>
                <select class="form-select form-select-sm" data-prop="type">
                    <option value="fixed" ${fee.type === 'fixed' ? 'selected' : ''}>Montant fixe (XOF)</option>
                    <option value="percentage" ${fee.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
                </select>
            </div>
            <div>
                <label class="form-label form-label-sm">Valeur</label>
                <input type="number" step="0.01" class="form-input form-input-sm" data-prop="value" value="${fee.value || 0}" placeholder="Montant ou %">
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label class="form-label form-label-sm">Condition d'application</label>
                <select class="form-select form-select-sm" data-prop="condition" onchange="toggleConditionConfig(this)">
                    <option value="always" ${fee.condition === 'always' || !fee.condition ? 'selected' : ''}>Toujours</option>
                    <option value="amount_range" ${fee.condition === 'amount_range' ? 'selected' : ''}>Plage de montant</option>
                    <option value="field_value" ${fee.condition === 'field_value' ? 'selected' : ''}>Valeur de champ</option>
                </select>
            </div>
            <div class="condition-config" style="display: ${fee.condition && fee.condition !== 'always' ? 'block' : 'none'}">
                <div class="amount-range-config" style="display: ${fee.condition === 'amount_range' ? 'block' : 'none'}">
                    <label class="form-label form-label-sm">Montant min - max (XOF)</label>
                    <div class="flex gap-2">
                        <input type="number" class="form-input form-input-sm" data-prop="minAmount" value="${fee.conditionConfig?.minAmount || ''}" placeholder="Min">
                        <input type="number" class="form-input form-input-sm" data-prop="maxAmount" value="${fee.conditionConfig?.maxAmount || ''}" placeholder="Max">
                    </div>
                </div>
                <div class="field-value-config" style="display: ${fee.condition === 'field_value' ? 'block' : 'none'}">
                    <label class="form-label form-label-sm">Champ et valeur</label>
                    <div class="flex gap-2">
                        <input type="text" class="form-input form-input-sm" data-prop="fieldName" value="${fee.conditionConfig?.fieldName || ''}" placeholder="Nom du champ">
                        <input type="text" class="form-input form-input-sm" data-prop="fieldValue" value="${fee.conditionConfig?.fieldValue || ''}" placeholder="Valeur attendue">
                    </div>
                </div>
            </div>
        </div>
    `;
    return editor;
}

// Fonction globale pour gérer l'affichage conditionnel des configurations de frais
(window as any).toggleConditionConfig = function(selectElement: HTMLSelectElement) {
    const feeEditor = selectElement.closest('.additional-fee-editor');
    if (!feeEditor) return;
    
    const conditionConfig = feeEditor.querySelector('.condition-config') as HTMLElement;
    const amountRangeConfig = feeEditor.querySelector('.amount-range-config') as HTMLElement;
    const fieldValueConfig = feeEditor.querySelector('.field-value-config') as HTMLElement;
    
    const condition = selectElement.value;
    
    if (condition === 'always') {
        conditionConfig.style.display = 'none';
    } else {
        conditionConfig.style.display = 'block';
        amountRangeConfig.style.display = condition === 'amount_range' ? 'block' : 'none';
        fieldValueConfig.style.display = condition === 'field_value' ? 'block' : 'none';
    }
};

/**
 * Renders the master list of operation types.
 */
function renderMasterList() {
    if (!masterList) return;
    masterList.innerHTML = `
         <div class="p-2">
            <button id="create-new-op-type-btn" class="btn btn-success w-full"><i class="fas fa-plus-circle mr-2"></i>Nouveau Service</button>
        </div>
    `;

    const groupedOpTypes = allOpTypes.reduce((acc, opType) => {
        const category = opType.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(opType);
        return acc;
    }, {} as Record<string, OperationType[]>);

    Object.keys(groupedOpTypes).sort().forEach(category => {
        const categoryHeader = document.createElement('h4');
        categoryHeader.className = 'text-xs uppercase text-slate-400 font-semibold p-2 mt-2';
        categoryHeader.textContent = category;
        masterList?.appendChild(categoryHeader);

        const list = document.createElement('div');
        list.className = 'space-y-1';
        groupedOpTypes[category].sort((a, b) => a.name.localeCompare(b.name)).forEach(op => {
            const item = document.createElement('button');
            item.className = `group w-full text-left p-2 rounded-md text-sm flex items-center justify-between ${selectedOpType?.id === op.id ? 'bg-violet-100 text-violet-800 font-semibold' : 'hover:bg-slate-100'}`;
            item.dataset.id = op.id;
            item.innerHTML = `
                <span class="flex-grow truncate pr-2">${op.name}</span>
                <div class="flex-shrink-0 flex items-center">
                    <button data-action="delete-op" data-id="${op.id}" data-name="${op.name}" title="Supprimer ce service" class="btn btn-xs !p-1 h-5 w-5 text-red-400 hover:bg-red-100 hover:text-red-600 hidden group-hover:inline-flex opacity-75 hover:opacity-100">
                        <i class="fas fa-trash-alt fa-sm"></i>
                    </button>
                    <i class="fas fa-circle text-xs ${op.status === 'active' ? 'text-green-500' : 'text-slate-300'} ml-2"></i>
                </div>
            `;
            list.appendChild(item);
        });
        masterList?.appendChild(list);
    });
}

export async function renderDeveloperManageOperationTypesView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const apiService = ApiService.getInstance();
    
    // Load operation types and card types
    allOpTypes = await dataService.getAllOperationTypes();
    cardTypes = await apiService.getAllCardTypes();
    selectedOpType = null;

    const viewContainer = document.createElement('div');
    viewContainer.className = 'grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 h-full';

    viewContainer.innerHTML = `
        <div class="lg:col-span-1 xl:col-span-1 card !p-2 h-full overflow-y-auto">
            <div id="master-list"></div>
        </div>
        <div class="lg:col-span-2 xl:col-span-3 card h-full overflow-y-auto">
            <div id="detail-view"></div>
        </div>
    `;

    masterList = $('#master-list', viewContainer);
    detailView = $('#detail-view', viewContainer);

    renderMasterList();
    renderDetailView(); // Renders the placeholder initially

    // --- Main Event Listener Delegation ---
    viewContainer.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        console.log('Click detected on:', target, 'ID:', target.id, 'Classes:', target.className);

        // Check for delete button first and handle it completely
        console.log('Looking for delete button from target:', target);
        console.log('Target dataset:', target.dataset);
        console.log('Target parent dataset:', target.parentElement?.dataset);
        
        // More robust check for delete button
        let deleteBtn: HTMLButtonElement | null = null;
        
        // Check if target itself is the delete button
        if (target.dataset.action === 'delete-op') {
            deleteBtn = target as HTMLButtonElement;
        }
        // Check if target's parent is the delete button (for the icon case)
        else if (target.parentElement?.dataset.action === 'delete-op') {
            deleteBtn = target.parentElement as HTMLButtonElement;
        }
        // Fallback to closest search
        else {
            deleteBtn = target.closest<HTMLButtonElement>('[data-action="delete-op"]');
        }
        
        console.log('Delete button found:', deleteBtn);
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation(); // Prevent selecting the item when clicking delete
            console.log('Delete button found, handling delete action');
            
            const opId = deleteBtn.dataset.id!;
            const opName = deleteBtn.dataset.name!;
            const message = `Êtes-vous sûr de vouloir supprimer le service "<strong>${opName}</strong>" ?<br><br><small>Note: Les transactions existantes seront conservées mais ne seront plus liées à un type d'opération valide. Cette action est irréversible.</small>`;

            const onConfirmDelete = async () => {
                try {
                    const api = ApiService.getInstance();
                    const success = await api.deleteOperationType(opId);
                    if (!success) {
                         throw new Error("API call to delete operation type failed.");
                    }
                    document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Service "${opName}" supprimé.`, type: 'success' } }));
                    // Update local state
                    allOpTypes = allOpTypes.filter(op => op.id !== opId);
                    if (selectedOpType?.id === opId) {
                        selectedOpType = null;
                    }
                    // Re-render UI
                    renderMasterList();
                    renderDetailView();
                } catch (error) {
                    console.error("Delete failed", error);
                    document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `La suppression a échoué.`, type: 'error' } }));
                    // Re-throw to signal failure to the modal
                    throw error;
                }
            };
            
            document.body.dispatchEvent(new CustomEvent('openConfirmationModal', {
                bubbles: true,
                composed: true,
                detail: {
                    title: 'Confirmer la Suppression',
                    message: message,
                    onConfirm: onConfirmDelete,
                    options: {
                        confirmButtonText: 'Oui, Supprimer',
                        confirmButtonClass: 'btn-danger'
                    }
                }
            }));
            return; // Exit early to prevent other handlers from running
        }

        // Check for remove-field button (for removing form fields)
        let removeFieldBtn: HTMLButtonElement | null = null;
        if (target.dataset.action === 'remove-field') {
            removeFieldBtn = target as HTMLButtonElement;
        } else if (target.parentElement?.dataset.action === 'remove-field') {
            removeFieldBtn = target.parentElement as HTMLButtonElement;
        } else {
            removeFieldBtn = target.closest<HTMLButtonElement>('[data-action="remove-field"]');
        }

        if (removeFieldBtn && selectedOpType) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Remove field button clicked');
            
            // Find the field editor container
            const fieldEditor = removeFieldBtn.closest('.field-editor');
            if (fieldEditor) {
                const fieldId = fieldEditor.dataset.id;
                // Remove the field from selectedOpType
                selectedOpType.fields = selectedOpType.fields.filter(f => f.id !== fieldId);
                
                // Re-render the form tab
                const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
                const activeTabName = activeTab?.dataset.tab || 'form';
                renderDetailView();
                
                // Restore the active tab
                setTimeout(() => {
                    const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                    if (tabToActivate) {
                        detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                        tabToActivate.classList.add('active');
                        tabToActivate.click();
                    }
                }, 10);
                
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Champ supprimé', type: 'success' } 
                }));
            }
            return;
        }

        // Check for remove-tier button (for removing commission tiers)
        let removeTierBtn: HTMLButtonElement | null = null;
        if (target.dataset.action === 'remove-tier') {
            removeTierBtn = target as HTMLButtonElement;
        } else if (target.parentElement?.dataset.action === 'remove-tier') {
            removeTierBtn = target.parentElement as HTMLButtonElement;
        } else {
            removeTierBtn = target.closest<HTMLButtonElement>('[data-action="remove-tier"]');
        }

        if (removeTierBtn && selectedOpType) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Remove tier button clicked');
            
            // Find the tier editor container
            const tierEditor = removeTierBtn.closest('.tier-editor');
            if (tierEditor && selectedOpType.commissionConfig.type === 'tiers' && selectedOpType.commissionConfig.tiers) {
                const tierId = tierEditor.dataset.id;
                // Remove the tier (we'll need to match by index since tiers don't have unique IDs)
                const tierIndex = Array.from(tierEditor.parentElement!.children).indexOf(tierEditor);
                selectedOpType.commissionConfig.tiers.splice(tierIndex, 1);
                
                // Re-render the fees tab
                const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
                const activeTabName = activeTab?.dataset.tab || 'fees';
                renderDetailView();
                
                // Restore the active tab
                setTimeout(() => {
                    const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                    if (tabToActivate) {
                        detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                        tabToActivate.classList.add('active');
                        tabToActivate.click();
                    }
                }, 10);
                
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Palier supprimé', type: 'success' } 
                }));
            }
            return;
        }

        // Check for remove-additional-fee button
        let removeAdditionalFeeBtn: HTMLButtonElement | null = null;
        if (target.dataset.action === 'remove-additional-fee') {
            removeAdditionalFeeBtn = target as HTMLButtonElement;
        } else if (target.parentElement?.dataset.action === 'remove-additional-fee') {
            removeAdditionalFeeBtn = target.parentElement as HTMLButtonElement;
        } else {
            removeAdditionalFeeBtn = target.closest<HTMLButtonElement>('[data-action="remove-additional-fee"]');
        }

        if (removeAdditionalFeeBtn && selectedOpType) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Remove additional fee button clicked');
            
            // Find the additional fee editor container
            const feeEditor = removeAdditionalFeeBtn.closest('.additional-fee-editor');
            if (feeEditor && selectedOpType.commissionConfig.additionalFees) {
                const feeId = feeEditor.dataset.id;
                // Remove the fee by ID
                selectedOpType.commissionConfig.additionalFees = selectedOpType.commissionConfig.additionalFees.filter(f => f.id !== feeId);
                
                // Re-render the fees tab
                const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
                const activeTabName = activeTab?.dataset.tab || 'fees';
                renderDetailView();
                
                // Restore the active tab
                setTimeout(() => {
                    const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                    if (tabToActivate) {
                        detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                        tabToActivate.classList.add('active');
                        tabToActivate.click();
                    }
                }, 10);
                
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Frais supplémentaire supprimé', type: 'success' } 
                }));
            }
            return;
        }

        // Check for move-up button (for reordering form fields)
        let moveUpBtn: HTMLButtonElement | null = null;
        if (target.dataset.action === 'move-up') {
            moveUpBtn = target as HTMLButtonElement;
        } else if (target.parentElement?.dataset.action === 'move-up') {
            moveUpBtn = target.parentElement as HTMLButtonElement;
        } else {
            moveUpBtn = target.closest<HTMLButtonElement>('[data-action="move-up"]');
        }

        if (moveUpBtn && selectedOpType) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Move up button clicked');
            
            const fieldEditor = moveUpBtn.closest('.field-editor');
            if (fieldEditor) {
                const fieldId = fieldEditor.dataset.id;
                const fieldIndex = selectedOpType.fields.findIndex(f => f.id === fieldId);
                
                if (fieldIndex > 0) {
                    // Swap with previous field
                    [selectedOpType.fields[fieldIndex - 1], selectedOpType.fields[fieldIndex]] = 
                    [selectedOpType.fields[fieldIndex], selectedOpType.fields[fieldIndex - 1]];
                    
                    // Re-render the form tab
                    const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
                    const activeTabName = activeTab?.dataset.tab || 'form';
                    renderDetailView();
                    
                    // Restore the active tab
                    setTimeout(() => {
                        const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                        if (tabToActivate) {
                            detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                            tabToActivate.classList.add('active');
                            tabToActivate.click();
                        }
                    }, 10);
                }
            }
            return;
        }

        // Check for move-down button (for reordering form fields)
        let moveDownBtn: HTMLButtonElement | null = null;
        if (target.dataset.action === 'move-down') {
            moveDownBtn = target as HTMLButtonElement;
        } else if (target.parentElement?.dataset.action === 'move-down') {
            moveDownBtn = target.parentElement as HTMLButtonElement;
        } else {
            moveDownBtn = target.closest<HTMLButtonElement>('[data-action="move-down"]');
        }

        if (moveDownBtn && selectedOpType) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Move down button clicked');
            
            const fieldEditor = moveDownBtn.closest('.field-editor');
            if (fieldEditor) {
                const fieldId = fieldEditor.dataset.id;
                const fieldIndex = selectedOpType.fields.findIndex(f => f.id === fieldId);
                
                if (fieldIndex < selectedOpType.fields.length - 1) {
                    // Swap with next field
                    [selectedOpType.fields[fieldIndex], selectedOpType.fields[fieldIndex + 1]] = 
                    [selectedOpType.fields[fieldIndex + 1], selectedOpType.fields[fieldIndex]];
                    
                    // Re-render the form tab
                    const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
                    const activeTabName = activeTab?.dataset.tab || 'form';
                    renderDetailView();
                    
                    // Restore the active tab
                    setTimeout(() => {
                        const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                        if (tabToActivate) {
                            detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                            tabToActivate.classList.add('active');
                            tabToActivate.click();
                        }
                    }, 10);
                }
            }
            return;
        }

        // Handle field type changes to show/hide options field
        if (target.matches('select[data-prop="type"]')) {
            const fieldEditor = target.closest('.field-editor');
            const optionsContainer = fieldEditor?.querySelector('.field-options-container') as HTMLElement;
            
            if (optionsContainer) {
                if (target.value === 'image') {
                    optionsContainer.style.display = 'none';
                } else {
                    optionsContainer.style.display = '';
                }
            }
            return;
        }

        // Create new operation type button
        const createNewBtn = target.id === 'create-new-op-type-btn' ? target : target.closest('#create-new-op-type-btn');
        console.log('Checking for create button:', createNewBtn);
        if (createNewBtn) {
            console.log('Create new button clicked!');
            try {
                // Create a new operation type with default values
                const newOpType: OperationType = {
                    id: '', // Empty ID for new items - will be generated by the database
                    name: 'Nouveau Service',
                    description: 'Description du nouveau service',
                    category: 'Cartes VISA',
                    status: 'active',
                    impactsBalance: true,
                    feeApplication: 'additive',
                    fields: [
                        // Auto-add card type field for Cartes VISA category
                        {
                            id: 'f_card_type_' + Date.now(),
                            name: 'card_type',
                            type: 'select',
                            label: 'Type de carte',
                            options: cardTypes.map(ct => ct.name),
                            required: true,
                            readonly: false,
                            obsolete: false
                        },
                        // Auto-add amount field for services that impact balance
                        {
                            id: 'f_montant_principal_' + Date.now(),
                            name: 'montant_principal',
                            type: 'number',
                            label: 'Montant (XOF)',
                            required: true,
                            readonly: false,
                            obsolete: false,
                            isAmountField: true
                        }
                    ],
                    commissionConfig: {
                        type: 'tiers',
                        partageSociete: 40,
                        tiers: []
                    }
                };
                console.log('New operation type created:', newOpType);
                
                // Select the new operation type for editing
                selectedOpType = newOpType;
                console.log('Selected operation type set to:', selectedOpType);
                
                // Re-render UI to show the detail view for editing
                console.log('About to render detail view...');
                console.log('detailView element:', detailView);
                console.log('detailView innerHTML before:', detailView?.innerHTML);
                renderDetailView();
                console.log('detailView innerHTML after:', detailView?.innerHTML);
                
                // Force scroll to detail view to make sure it's visible
                if (detailView) {
                    detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Also try to focus on the first input
                    const firstInput = detailView.querySelector('input') as HTMLInputElement;
                    if (firstInput) {
                        setTimeout(() => firstInput.focus(), 100);
                    }
                }
                console.log('Detail view rendered successfully');
                return;
            } catch (error) {
                console.error('Error in create new button handler:', error);
            }
        }

        // Add field button
        const addFieldBtn = target.id === 'add-field-btn' ? target : target.closest('#add-field-btn');
        if (addFieldBtn && selectedOpType) {
            // Préserver l'onglet actif
            const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
            const activeTabName = activeTab?.dataset.tab || 'form';
            
            const newField: OperationTypeField = {
                id: 'f_new_field_' + Date.now(),
                name: 'new_field',
                type: 'text',
                label: 'Nouveau champ',
                options: [],
                required: false,
                readonly: false,
                obsolete: false
            };
            selectedOpType.fields = selectedOpType.fields || [];
            selectedOpType.fields.push(newField);
            renderDetailView();
            
            // Restaurer l'onglet actif après le re-rendu
            setTimeout(() => {
                const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                if (tabToActivate) {
                    detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                    tabToActivate.classList.add('active');
                    tabToActivate.click(); // Déclencher l'affichage du contenu de l'onglet
                }
            }, 10);
            
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Nouveau champ ajouté', type: 'success' } 
            }));
            return;
        }

        // Add amount field button
        const addAmountFieldBtn = target.id === 'add-amount-field-btn' ? target : target.closest('#add-amount-field-btn');
        if (addAmountFieldBtn && selectedOpType) {
            // Préserver l'onglet actif
            const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
            const activeTabName = activeTab?.dataset.tab || 'form';
            
            const newAmountField: OperationTypeField = {
                id: 'f_montant_principal_' + Date.now(),
                name: 'montant_principal',
                type: 'number',
                label: 'Montant (XOF)',
                options: [],
                required: true,
                readonly: false,
                obsolete: false,
                isAmountField: true
            };
            
            // Désélectionner tous les autres champs de montant existants
            selectedOpType.fields.forEach(field => {
                if (field.isAmountField) {
                    field.isAmountField = false;
                }
            });
            
            selectedOpType.fields = selectedOpType.fields || [];
            selectedOpType.fields.push(newAmountField);
            renderDetailView();
            
            // Restaurer l'onglet actif après le re-rendu
            setTimeout(() => {
                const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                if (tabToActivate) {
                    detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                    tabToActivate.classList.add('active');
                    tabToActivate.click();
                }
            }, 10);
            
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Champ de montant ajouté avec le nom standardisé "montant_principal"', type: 'success' } 
            }));
            return;
        }

        // Add card type field button
        const addCardTypeBtn = target.closest('#add-card-type-btn');
        if (addCardTypeBtn && selectedOpType && cardTypes.length > 0) {
            const newCardTypeField: OperationTypeField = {
                id: 'f_card_type_' + Date.now(),
                name: 'card_type',
                type: 'select',
                label: 'Type de carte',
                options: cardTypes.map(ct => ct.name),
                required: true,
                readonly: false,
                obsolete: false
            };
            selectedOpType.fields.unshift(newCardTypeField);
            renderDetailView(); // Re-render to show the new field
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Champ "Type de carte" ajouté', type: 'success' } 
            }));
            return;
        }

        // Master list item selection - but not if we clicked on a delete button
        const masterItem = target.closest<HTMLButtonElement>('#master-list button[data-id]');
        if (masterItem && !target.closest('[data-action="delete-op"]')) {
            selectedOpType = allOpTypes.find(op => op.id === masterItem.dataset.id) || null;
            renderMasterList(); // Re-render to update active state
            renderDetailView();
            return;
        }

        // Add additional fee button
        const addAdditionalFeeBtn = target.id === 'add-additional-fee-btn' ? target : target.closest('#add-additional-fee-btn');
        if (addAdditionalFeeBtn && selectedOpType) {
            // Préserver l'onglet actif
            const activeTab = detailView?.querySelector('.tabs button.active') as HTMLButtonElement;
            const activeTabName = activeTab?.dataset.tab || 'fees';
            
            const newAdditionalFee = {
                id: 'fee_' + Date.now(),
                name: 'Nouveau frais',
                description: '',
                type: 'fixed',
                value: 0,
                condition: 'always',
                conditionConfig: {},
                active: true
            };
            
            // Initialiser additionalFees si nécessaire
            if (!selectedOpType.commissionConfig.additionalFees) {
                selectedOpType.commissionConfig.additionalFees = [];
            }
            
            selectedOpType.commissionConfig.additionalFees.push(newAdditionalFee);
            renderDetailView();
            
            // Restaurer l'onglet actif après le re-rendu
            setTimeout(() => {
                const tabToActivate = detailView?.querySelector(`[data-tab="${activeTabName}"]`) as HTMLButtonElement;
                if (tabToActivate) {
                    detailView?.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                    tabToActivate.classList.add('active');
                    tabToActivate.click();
                }
            }, 10);
            
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: 'Nouveau frais supplémentaire ajouté', type: 'success' } 
            }));
            return;
        }

        // Save button
        const saveBtn = target.closest('#save-op-type-btn');
        if (saveBtn) {
            if (!selectedOpType || !detailView) return;
            saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Sauvegarde...`;
            (saveBtn as HTMLButtonElement).disabled = true;

            // Ensure all forms exist by temporarily rendering them if needed
            let settingsFormElement = detailView.querySelector('#settingsForm') as HTMLFormElement;
            let feesFormElement = detailView.querySelector('#feesForm') as HTMLFormElement;

            // Create temporary container to render missing forms
            const tempContainer = document.createElement('div');
            tempContainer.style.display = 'none';
            detailView.appendChild(tempContainer);

            if (!settingsFormElement) {
                tempContainer.innerHTML = `
                    <form id="settingsForm" class="space-y-4 p-4 border rounded-b-lg">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">Nom</label>
                                <input type="text" name="name" class="form-input" value="${selectedOpType.name}" required>
                            </div>
                            <div>
                                <label class="form-label">Catégorie</label>
                                <input type="text" name="category" class="form-input" value="${selectedOpType.category}" required>
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Description</label>
                            <textarea name="description" class="form-input" rows="3">${selectedOpType.description}</textarea>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">Statut</label>
                                <select name="status" class="form-select">
                                    <option value="active" ${selectedOpType.status === 'active' ? 'selected' : ''}>Actif</option>
                                    <option value="inactive" ${selectedOpType.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Impact sur le solde</label>
                                <select name="impactsBalance" class="form-select">
                                    <option value="true" ${selectedOpType.impactsBalance ? 'selected' : ''}>Oui</option>
                                    <option value="false" ${!selectedOpType.impactsBalance ? 'selected' : ''}>Non</option>
                                </select>
                            </div>
                        </div>
                    </form>
                `;
                settingsFormElement = tempContainer.querySelector('#settingsForm') as HTMLFormElement;
            }

            if (!feesFormElement) {
                const config = selectedOpType.commissionConfig;
                tempContainer.innerHTML += `
                    <form id="feesForm" class="space-y-4 p-4 border rounded-b-lg">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">Application des frais</label>
                                <select name="feeApplication" class="form-select">
                                    <option value="additive" ${selectedOpType.feeApplication === 'additive' ? 'selected' : ''}>Additifs (ajoutés au montant)</option>
                                    <option value="inclusive" ${selectedOpType.feeApplication === 'inclusive' ? 'selected' : ''}>Inclusifs (inclus dans le montant)</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Part société (%)</label>
                                <input type="number" name="partageSociete" class="form-input" value="${config.partageSociete || 0}" min="0" max="100">
                            </div>
                        </div>
                    </form>
                `;
                feesFormElement = tempContainer.querySelector('#feesForm') as HTMLFormElement;
            }

            const settingsForm = new FormData(settingsFormElement);
            const feesForm = new FormData(feesFormElement);

            const fields: OperationTypeField[] = [];
            const fieldEditors = detailView.querySelectorAll<HTMLElement>('.field-editor');

            if (fieldEditors.length > 0) {
                // If field editors are visible (user is on the Fields tab), collect from UI
                fieldEditors.forEach(editor => {
                    const id = editor.dataset.id!;
                    const optionsInput = (editor.querySelector('[data-prop="options"]') as HTMLInputElement).value;
                    const newOptionsArray = optionsInput.split(',').map(s => s.trim()).filter(Boolean);

                    // Find the original field to preserve enriched options if they exist
                    const originalField = selectedOpType?.fields.find(f => f.id === id);
                    let finalOptions: string[] | OperationTypeFieldOption[] = newOptionsArray;

                    // If original field had enriched options and the values match, preserve the enriched format
                    if (originalField?.options && typeof originalField.options[0] === 'object') {
                        const originalEnrichedOptions = originalField.options as OperationTypeFieldOption[];
                        const originalValues = originalEnrichedOptions.map(opt => opt.valeur);

                        // Check if the new options match the original values (same order and content)
                        if (JSON.stringify(newOptionsArray) === JSON.stringify(originalValues)) {
                            finalOptions = originalEnrichedOptions; // Preserve enriched options
                        }
                        // If values changed, create new simple options (developer is modifying)
                    }

                    fields.push({
                        id: id,
                        label: (editor.querySelector('[data-prop="label"]') as HTMLInputElement).value,
                        name: (editor.querySelector('[data-prop="name"]') as HTMLInputElement).value,
                        type: (editor.querySelector('[data-prop="type"]') as HTMLSelectElement).value as any,
                        options: finalOptions,
                        required: (editor.querySelector('[data-prop="required"]') as HTMLInputElement).checked,
                        readonly: (editor.querySelector('[data-prop="readonly"]') as HTMLInputElement).checked,
                        isAmountField: (editor.querySelector('[data-prop="isAmountField"]') as HTMLInputElement).checked,
                        obsolete: false
                    });
                });
            } else {
                // If field editors are not visible, preserve existing fields
                console.log('Field editors not visible, preserving existing fields');
                fields.push(...(selectedOpType.fields || []));
            }

            const tiers: CommissionTier[] = [];
            detailView.querySelectorAll<HTMLElement>('.tier-editor').forEach(editor => {
                const toVal = (editor.querySelector('[data-prop="to"]') as HTMLInputElement).value;
                tiers.push({
                    from: parseFloat((editor.querySelector('[data-prop="from"]') as HTMLInputElement).value),
                    to: toVal ? parseFloat(toVal) : Infinity,
                    type: (editor.querySelector('[data-prop="type"]') as HTMLSelectElement).value as any,
                    value: parseFloat((editor.querySelector('[data-prop="value"]') as HTMLInputElement).value)
                });
            });

            // Collecter les frais supplémentaires
            const additionalFees: any[] = [];
            detailView.querySelectorAll<HTMLElement>('.additional-fee-editor').forEach(editor => {
                const conditionSelect = editor.querySelector('[data-prop="condition"]') as HTMLSelectElement;
                const condition = conditionSelect.value;
                
                let conditionConfig = {};
                if (condition === 'amount_range') {
                    const minAmount = (editor.querySelector('[data-prop="minAmount"]') as HTMLInputElement).value;
                    const maxAmount = (editor.querySelector('[data-prop="maxAmount"]') as HTMLInputElement).value;
                    conditionConfig = {
                        minAmount: minAmount ? parseFloat(minAmount) : undefined,
                        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined
                    };
                } else if (condition === 'field_value') {
                    const fieldName = (editor.querySelector('[data-prop="fieldName"]') as HTMLInputElement).value;
                    const fieldValue = (editor.querySelector('[data-prop="fieldValue"]') as HTMLInputElement).value;
                    conditionConfig = {
                        fieldName: fieldName || undefined,
                        fieldValue: fieldValue || undefined
                    };
                }
                
                additionalFees.push({
                    id: editor.dataset.id,
                    name: (editor.querySelector('[data-prop="name"]') as HTMLInputElement).value,
                    description: (editor.querySelector('[data-prop="description"]') as HTMLInputElement).value,
                    type: (editor.querySelector('[data-prop="type"]') as HTMLSelectElement).value,
                    value: parseFloat((editor.querySelector('[data-prop="value"]') as HTMLInputElement).value) || 0,
                    condition: condition,
                    conditionConfig: conditionConfig,
                    active: (editor.querySelector('[data-prop="active"]') as HTMLInputElement).checked
                });
            });

            const updatedOpType: OperationType = {
                ...selectedOpType,
                name: settingsForm.get('name') as string,
                category: settingsForm.get('category') as string,
                description: settingsForm.get('description') as string,
                status: settingsForm.get('status') as 'active' | 'inactive',
                impactsBalance: settingsForm.get('impactsBalance') === 'true',
                feeApplication: feesForm.get('feeApplication') as 'additive' | 'inclusive',
                fields: fields,
                commissionConfig: {
                    ...selectedOpType.commissionConfig,
                    partageSociete: parseInt(feesForm.get('partageSociete') as string),
                    tiers: tiers,
                    additionalFees: additionalFees
                }
            };

            // Validation: Vérifier qu'un champ de montant est défini si le service impacte le solde
            if (updatedOpType.impactsBalance && !hasAmountField(updatedOpType)) {
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { 
                        message: 'Un champ de montant doit être défini pour les services qui impactent le solde. Veuillez cocher "Champ de montant" sur un champ de type "Nombre".', 
                        type: 'error' 
                    } 
                }));
                saveBtn.innerHTML = `<i class="fas fa-save mr-2"></i>Enregistrer les modifications`;
                (saveBtn as HTMLButtonElement).disabled = false;
                return;
            }

            try {
                const api = ApiService.getInstance();
                const savedOp = await api.updateOperationType(updatedOpType);
                
                // Update local state
                if (selectedOpType.id === '') {
                    // This was a new operation type, add it to the list
                    allOpTypes.push(savedOp);
                } else {
                    // This was an existing operation type, update it
                    const index = allOpTypes.findIndex(op => op.id === selectedOpType!.id);
                    if (index > -1) {
                        allOpTypes[index] = savedOp;
                    }
                }
                selectedOpType = savedOp;

                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Service "${savedOp.name}" enregistré.`, type: 'success' } }));
                renderMasterList();
                renderDetailView();
            } catch (error) {
                console.error("Save failed", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `La sauvegarde a échoué.`, type: 'error' } }));
                saveBtn.innerHTML = `<i class="fas fa-save mr-2"></i>Enregistrer les modifications`;
                (saveBtn as HTMLButtonElement).disabled = false;
            } finally {
                // Clean up temporary container
                const tempContainer = detailView.querySelector('div[style*="display: none"]');
                if (tempContainer) {
                    tempContainer.remove();
                }
            }
        }
    });

    // --- Event Listener for Input Changes ---
    viewContainer.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        
        // Handle field type changes to enable/disable amount field checkbox
        if (target.matches('[data-prop="type"]')) {
            const fieldEditor = target.closest('.field-editor');
            if (fieldEditor) {
                const typeSelect = target as HTMLSelectElement;
                const isAmountCheckbox = fieldEditor.querySelector('[data-prop="isAmountField"]') as HTMLInputElement;
                const amountFieldContainer = isAmountCheckbox.closest('.flex');
                
                if (typeSelect.value === 'number') {
                    // Enable amount field option for number fields
                    isAmountCheckbox.disabled = false;
                    amountFieldContainer?.classList.remove('opacity-50');
                } else {
                    // Disable and uncheck amount field option for non-number fields
                    isAmountCheckbox.disabled = true;
                    isAmountCheckbox.checked = false;
                    amountFieldContainer?.classList.add('opacity-50');
                }
            }
        }
        
        // Handle amount field checkbox changes to ensure only one is selected
        if (target.matches('[data-prop="isAmountField"]')) {
            const checkbox = target as HTMLInputElement;
            const fieldEditor = checkbox.closest('.field-editor');
            
            if (checkbox.checked) {
                // Uncheck all other amount field checkboxes
                const allAmountCheckboxes = viewContainer.querySelectorAll('[data-prop="isAmountField"]');
                allAmountCheckboxes.forEach(cb => {
                    if (cb !== checkbox) {
                        (cb as HTMLInputElement).checked = false;
                    }
                });
                
                // Définir automatiquement le nom (clé) à "montant_principal"
                if (fieldEditor) {
                    const nameInput = fieldEditor.querySelector('[data-prop="name"]') as HTMLInputElement;
                    if (nameInput) {
                        const oldName = nameInput.value;
                        nameInput.value = 'montant_principal';
                        
                        // Mettre à jour aussi le libellé si c'est un nouveau champ ou s'il n'a pas été personnalisé
                        const labelInput = fieldEditor.querySelector('[data-prop="label"]') as HTMLInputElement;
                        if (labelInput && (labelInput.value === '' || labelInput.value.toLowerCase().includes('montant') || labelInput.value === oldName)) {
                            labelInput.value = 'Montant (XOF)';
                        }
                    }
                }
                
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Champ de montant défini. Nom standardisé à "montant_principal".', type: 'success' } 
                }));
            }
        }
    });

    return viewContainer;
}