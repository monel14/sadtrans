import { createCard } from '../components/Card';
import { DataService } from '../services/data.service';
import { User, OperationType, OperationTypeField, CommissionTier, OperationTypeFieldOption } from '../models';
import { ApiService } from '../services/api.service';
import { $ } from '../utils/dom';

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


function showConfirmationModal(title: string, message: string, onConfirm: () => Promise<void>) {
    // Remove any existing modal
    document.getElementById('confirmation-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.className = 'modal visible';
    modal.innerHTML = `
        <div class="modal-content modal-sm">
            <h3 class="text-xl font-semibold mb-4">${title}</h3>
            <p class="text-slate-600 mb-6">${message}</p>
            <div class="flex justify-end space-x-2">
                <button id="confirm-cancel" class="btn btn-secondary">Annuler</button>
                <button id="confirm-action" class="btn btn-danger">Confirmer la suppression</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    const confirmBtn = modal.querySelector('#confirm-action') as HTMLButtonElement;
    
    modal.querySelector('#confirm-cancel')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    confirmBtn.addEventListener('click', async () => {
        const originalText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Suppression...`;

        try {
            await onConfirm();
            closeModal();
        } catch (e) {
            // Error toast is handled by the caller
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    });
}


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
                        <input type="text" name="category" class="form-input" value="${opTypeForEditing.category}" required>
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
    };

    const renderFormTab = () => {
        tabContent.innerHTML = `
            <div class="p-4 border rounded-b-lg">
                <p class="text-sm text-slate-500 mb-4">Définissez les champs que l'agent devra remplir. Utilisez les flèches pour réorganiser.</p>
                <div id="fields-list-container" class="space-y-2"></div>
                <button id="add-field-btn" class="btn btn-sm btn-outline-secondary mt-4"><i class="fas fa-plus mr-2"></i>Ajouter un champ</button>
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
                    <h4 class="font-semibold text-slate-700 mb-2">Paliers de Frais de Service</h4>
                    <div id="tiers-list-container" class="space-y-2"></div>
                    <button id="add-tier-btn" class="btn btn-sm btn-outline-secondary mt-4"><i class="fas fa-plus mr-2"></i>Ajouter un palier</button>
                </div>
            </form>
        `;
        const tiersContainer = $('#tiers-list-container', tabContent) as HTMLElement;
        if(config.type === 'tiers' && config.tiers) {
            config.tiers.forEach((tier: CommissionTier) => tiersContainer.appendChild(createTierEditor(tier)));
        } else {
             tiersContainer.innerHTML = `<p class="text-sm text-slate-500 p-2 bg-slate-100 rounded">Ce service utilise une commission simple (fixe/pourcentage), non éditable ici.</p>`;
             (tiersContainer.nextElementSibling as HTMLButtonElement).style.display = 'none';
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

        switch(target.dataset.tab) {
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
                        <option value="select" ${field.type === 'select' ? 'selected' : ''}>Liste</option>
                    </select>
                </div>
                <div><label class="form-label form-label-sm">Options (séparées par ,)</label><input type="text" class="form-input form-input-sm" data-prop="options" value="${getOptionsDisplayValue(field.options)}"></div>
            </div>
            <div class="flex gap-4 mt-3">
                <div class="flex items-center"><input type="checkbox" data-prop="required" class="mr-2" ${field.required ? 'checked' : ''}><label class="form-label form-label-sm">Requis</label></div>
                <div class="flex items-center"><input type="checkbox" data-prop="readonly" class="mr-2" ${field.readonly ? 'checked' : ''}><label class="form-label form-label-sm">Lecture seule</label></div>
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
        groupedOpTypes[category].sort((a,b) => a.name.localeCompare(b.name)).forEach(op => {
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
    allOpTypes = await dataService.getAllOperationTypes();
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

        const deleteBtn = target.closest<HTMLButtonElement>('[data-action="delete-op"]');
        if (deleteBtn) {
            e.stopPropagation(); // Prevent selecting the item when clicking delete
            const opId = deleteBtn.dataset.id!;
            const opName = deleteBtn.dataset.name!;

            showConfirmationModal(
                'Confirmer la Suppression',
                `Êtes-vous sûr de vouloir supprimer le service "<strong>${opName}</strong>" ? Les transactions existantes ne seront pas affectées, mais il ne sera plus possible d'en créer de nouvelles. Cette action est irréversible.`,
                async () => {
                    try {
                        const api = ApiService.getInstance();
                        const success = await api.deleteOperationType(opId);
                        if (success) {
                            document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Service "${opName}" supprimé.`, type: 'success' } }));
                            
                            // Update local state
                            allOpTypes = allOpTypes.filter(op => op.id !== opId);
                            if (selectedOpType?.id === opId) {
                                selectedOpType = null;
                            }
                            
                            // Re-render UI
                            renderMasterList();
                            renderDetailView();
                        } else {
                            throw new Error("API call to delete operation type failed.");
                        }
                    } catch (error) {
                        console.error("Delete failed", error);
                        document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `La suppression a échoué. Vérifiez s'il existe des transactions liées.`, type: 'error' } }));
                        throw error; // Re-throw to keep the modal's confirm button in its loading state, indicating failure.
                    }
                }
            );
            return;
        }

        // Master list item selection
        const masterItem = target.closest<HTMLButtonElement>('#master-list button[data-id]');
        if (masterItem) {
            selectedOpType = allOpTypes.find(op => op.id === masterItem.dataset.id) || null;
            renderMasterList(); // Re-render to update active state
            renderDetailView();
            return;
        }
        
        // Save button
        const saveBtn = target.closest('#save-op-type-btn');
        if(saveBtn) {
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
            detailView.querySelectorAll<HTMLElement>('.field-editor').forEach(editor => {
                const id = editor.dataset.id!;
                const optionsInput = (editor.querySelector('[data-prop="options"]') as HTMLInputElement).value;
                const newOptionsArray = optionsInput.split(',').map(s=>s.trim()).filter(Boolean);
                
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
                    obsolete: false
                });
            });

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
                }
            };
            
            try {
                const api = ApiService.getInstance();
                const savedOp = await api.updateOperationType(updatedOpType);
                // Update local state
                const index = allOpTypes.findIndex(op => op.id === savedOp.id);
                if (index > -1) allOpTypes[index] = savedOp; else allOpTypes.push(savedOp);
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

    return viewContainer;
}