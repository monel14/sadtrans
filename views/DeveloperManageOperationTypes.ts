import { createCard } from '../components/Card';
import { DataService } from '../services/data.service';
import { User, OperationType, OperationTypeField, CommissionTier } from '../models';
import { ApiService } from '../services/api.service';
import { $ } from '../utils/dom';

// Store component state locally
let allOpTypes: OperationType[] = [];
let selectedOpType: OperationType | null = null;
let detailView: HTMLElement | null = null;
let masterList: HTMLElement | null = null;
let tierCounter = 0;

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
                <div><label class="form-label form-label-sm">Options (séparées par ,)</label><input type="text" class="form-input form-input-sm" data-prop="options" value="${(field.options || []).join(',')}"></div>
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
            item.className = `w-full text-left p-2 rounded-md text-sm flex items-center justify-between ${selectedOpType?.id === op.id ? 'bg-violet-100 text-violet-800 font-semibold' : 'hover:bg-slate-100'}`;
            item.dataset.id = op.id;
            item.innerHTML = `
                <span>${op.name}</span>
                <i class="fas fa-circle text-xs ${op.status === 'active' ? 'text-green-500' : 'text-slate-300'}"></i>
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

            // Gather data from all forms
            const settingsForm = new FormData(detailView.querySelector('#settingsForm') as HTMLFormElement);
            const feesForm = new FormData(detailView.querySelector('#feesForm') as HTMLFormElement);
            
            const fields: OperationTypeField[] = [];
            detailView.querySelectorAll<HTMLElement>('.field-editor').forEach(editor => {
                const id = editor.dataset.id!;
                fields.push({
                    id: id,
                    label: (editor.querySelector('[data-prop="label"]') as HTMLInputElement).value,
                    name: (editor.querySelector('[data-prop="name"]') as HTMLInputElement).value,
                    type: (editor.querySelector('[data-prop="type"]') as HTMLSelectElement).value as any,
                    options: (editor.querySelector('[data-prop="options"]') as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean),
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
            }
        }
    });

    return viewContainer;
}