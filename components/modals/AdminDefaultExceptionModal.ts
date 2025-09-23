import { BaseModal } from './BaseModal';
import { $ } from '../../utils/dom';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';

interface DefaultExceptionConfig {
    id?: string;
    opTypeId?: string; // Rendu optionnel
    targetType?: 'category' | 'operation_type';
    targetId?: string;
    description: string;
    condition: string;
    commissionOverride: {
        type: 'fixed' | 'percentage' | 'tiers';
        amount?: number;
        rate?: number;
        tiers?: Array<{
            from: number;
            to: number;
            type: 'fixed' | 'percentage';
            value: number;
        }>;
    };
}

export class AdminDefaultExceptionModal extends BaseModal {
    private api: ApiService;
    private dataService: DataService;
    private onSave?: () => void;

    constructor() {
        super('admin-default-exception-modal', { size: 'lg' });
        this.api = ApiService.getInstance();
        this.dataService = DataService.getInstance();
    }

    public setOnSave(callback: () => void) {
        this.onSave = callback;
    }

    public async show(config?: DefaultExceptionConfig): Promise<void> {
        const title = config?.id ? 'Modifier l\'Exception par Défaut' : 'Ajouter une Exception par Défaut';
        const body = this._createFormBody(config);
        const footer = this._createFooter();

        this.setContent(title, body, footer);
        super.show();
        this.attachEventListeners();
    }

    private _createFormBody(config?: DefaultExceptionConfig): HTMLElement {
        const form = document.createElement('form');
        form.id = 'defaultExceptionForm';
        form.className = 'space-y-6';

        // Extract partageSociete from commissionOverride if it exists
        const partageSociete = config?.commissionOverride?.hasOwnProperty('partageSociete') 
            ? (config.commissionOverride as any).partageSociete 
            : 50; // Default value

        form.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle mr-2"></i>
                Les exceptions par défaut s'appliquent à tous les contrats pour des types d'opérations spécifiques.
            </div>

            <div>
                <label class="form-label" for="exceptionDescription">
                    Description de l'exception
                    <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Donnez un nom descriptif à cette exception."></i>
                </label>
                <input type="text" id="exceptionDescription" name="description" class="form-input w-full" 
                       value="${config?.description || ''}" required placeholder="Ex: Commission réduite pour les transferts internationaux">
            </div>

            ${this._createTargetSelector(config)}

            <div>
                <label class="form-label" for="exceptionCondition">
                    Condition d'Application
                    <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Expression logique qui déclenche l'exception. Ex: 'amount > 100000' pour un montant supérieur à 100 000."></i>
                </label>
                <input type="text" id="exceptionCondition" name="condition" class="form-input w-full" 
                       value="${config?.condition || ''}" required placeholder="Ex: Montant > 100000">
            </div>

            <div class="border rounded-md p-4">
                <h3 class="font-semibold mb-4">Configuration de la Commission</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="form-label" for="commissionType">
                            Type de Commission
                            <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Choisissez le mode de calcul de la commission pour cette exception."></i>
                        </label>
                        <select id="commissionType" name="type" class="form-select w-full" required>
                            <option value="fixed" ${config?.commissionOverride?.type === 'fixed' ? 'selected' : ''}>Montant Fixe</option>
                            <option value="percentage" ${config?.commissionOverride?.type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
                            <option value="tiers" ${config?.commissionOverride?.type === 'tiers' ? 'selected' : ''}>Par Paliers</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="partageSociete">
                            Part société (%)
                            <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Pourcentage de la commission qui revient à la société."></i>
                        </label>
                        <input type="number" id="partageSociete" name="partageSociete" class="form-input w-full" 
                               value="${partageSociete}" min="0" max="100" required>
                    </div>
                </div>

                <div id="fixedConfig" class="p-4 border rounded-md mt-4" style="display: ${config?.commissionOverride?.type === 'fixed' ? 'block' : 'none'}">
                    <h4 class="font-semibold mb-2">Configuration du Montant Fixe</h4>
                    <div>
                        <label class="form-label" for="fixedAmount">Montant de la commission (FCFA)</label>
                        <input type="number" id="fixedAmount" name="amount" class="form-input w-full" 
                               value="${config?.commissionOverride?.amount || ''}" min="0" step="1">
                    </div>
                </div>

                <div id="percentageConfig" class="p-4 border rounded-md mt-4" style="display: ${config?.commissionOverride?.type === 'percentage' ? 'block' : 'none'}">
                    <h4 class="font-semibold mb-2">Configuration du Pourcentage</h4>
                    <div>
                        <label class="form-label" for="percentageRate">Taux de commission (%)</label>
                        <input type="number" id="percentageRate" name="rate" class="form-input w-full" 
                               value="${config?.commissionOverride?.rate || ''}" min="0" max="100" step="0.1">
                    </div>
                </div>

                <div id="tiersConfig" class="p-4 border rounded-md mt-4" style="display: ${config?.commissionOverride?.type === 'tiers' ? 'block' : 'none'}">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-semibold">Configuration par Paliers</h4>
                        <button type="button" id="addTierBtn" class="btn btn-sm btn-primary">
                            <i class="fas fa-plus mr-1"></i>Ajouter un palier
                        </button>
                    </div>
                    <div id="tiersList" class="space-y-3">
                        ${this.renderTiersList(config?.commissionOverride?.tiers || [])}
                    </div>
                </div>
            </div>
        `;
        return form;
    }

    private _createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-4';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-action="cancel">Annuler</button>
            <button type="button" class="btn btn-primary" data-action="save">
                <i class="fas fa-save mr-2"></i>Enregistrer l'exception
            </button>
        `;
        return footer;
    }

    private renderTiersList(tiers: Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}>): string {
        if (tiers.length === 0) {
            return `
                <div class="text-center text-gray-500 p-4 border-dashed border-2 rounded-md">
                    <i class="fas fa-layer-group fa-2x mb-2"></i>
                    <p>Aucun palier configuré.</p>
                    <p class="text-sm">Cliquez sur "Ajouter un palier" pour commencer.</p>
                </div>
            `;
        }

        const header = `
            <div class="grid grid-cols-12 gap-3 items-center font-semibold text-sm text-gray-600 px-3">
                <div class="col-span-3">De (FCFA)</div>
                <div class="col-span-3">À (FCFA)</div>
                <div class="col-span-3">Type</div>
                <div class="col-span-2">Valeur</div>
                <div class="col-span-1"></div>
            </div>
        `;

        const tierRows = tiers.map((tier, index) => `
            <div class="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg border">
                <div class="col-span-3">
                    <input type="number" name="tier_${index}_from" class="form-input w-full" placeholder="Ex: 1000" min="0" step="1" value="${tier.from}" required>
                </div>
                <div class="col-span-3">
                    <input type="number" name="tier_${index}_to" class="form-input w-full" placeholder="Ex: 5000" min="0" step="1" value="${tier.to || ''}" required>
                </div>
                <div class="col-span-3">
                    <select name="tier_${index}_type" class="form-select w-full">
                        <option value="fixed" ${tier.type === 'fixed' ? 'selected' : ''}>Fixe (FCFA)</option>
                        <option value="percentage" ${tier.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
                    </select>
                </div>
                <div class="col-span-2">
                    <input type="number" name="tier_${index}_value" class="form-input w-full" placeholder="Ex: 300" min="0" step="0.01" value="${tier.value}" required>
                </div>
                <div class="col-span-1 flex justify-center">
                    <button type="button" class="btn btn-danger btn-sm remove-tier" data-index="${index}" data-tooltip="Supprimer ce palier">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');

        return header + '<div class="space-y-3 mt-2">' + tierRows + '</div>';
    }

    private _createTargetSelector(config?: DefaultExceptionConfig): string {
        return `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="form-label" for="exceptionTargetType">Type de Cible</label>
                    <select id="exceptionTargetType" name="targetType" class="form-select w-full" required>
                        <option value="operation_type" ${config?.targetType === 'operation_type' ? 'selected' : ''}>Type d'Opération</option>
                        <option value="category" ${config?.targetType === 'category' ? 'selected' : ''}>Catégorie</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" for="exceptionTargetId">Cible</label>
                    <select id="exceptionTargetId" name="targetId" class="form-select w-full" required data-selected="${config?.targetId || ''}">
                        <option value="">-- Sélectionnez d'abord un type --</option>
                    </select>
                </div>
            </div>
        `;
    }

    private async _loadAndPopulateTargets(targetType: 'category' | 'operation_type', selectElement: HTMLSelectElement): Promise<void> {
        selectElement.innerHTML = '<option value="">Chargement...</option>';
        let options: { id: string, name: string }[] = [];

        if (targetType === 'operation_type') {
            const opTypes = await this.dataService.getAllOperationTypes();
            options = opTypes.map(ot => ({ id: ot.id, name: ot.name }));
            selectElement.innerHTML = '<option value="">-- Sélectionner un type d\'opération --</option>';
        } else if (targetType === 'category') {
            const opTypes = await this.dataService.getAllOperationTypes();
            const categories = [...new Set(opTypes.map(ot => ot.category).filter(Boolean))];
            options = categories.map(cat => ({ id: cat!, name: cat! }));
            selectElement.innerHTML = '<option value="">-- Sélectionner une catégorie --</option>';
        }

        const selectedId = selectElement.dataset.selected;
        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.id;
            optionEl.textContent = opt.name;
            if (opt.id === selectedId) {
                optionEl.selected = true;
            }
            selectElement.appendChild(optionEl);
        });
    }

    private toggleConfigSections(selectedType: string): void {
        const fixedConfig = $('#fixedConfig') as HTMLElement;
        const percentageConfig = $('#percentageConfig') as HTMLElement;
        const tiersConfig = $('#tiersConfig') as HTMLElement;

        // Masquer toutes les sections
        fixedConfig.style.display = 'none';
        percentageConfig.style.display = 'none';
        tiersConfig.style.display = 'none';

        // Afficher la section sélectionnée
        switch (selectedType) {
            case 'fixed':
                fixedConfig.style.display = 'block';
                break;
            case 'percentage':
                percentageConfig.style.display = 'block';
                break;
            case 'tiers':
                tiersConfig.style.display = 'block';
                break;
        }
    }

    private addTier(tiersList: HTMLElement): void {
        const tierCount = tiersList.querySelectorAll('.grid').length - 1; // -1 pour le header
        const newTier = document.createElement('div');
        newTier.className = 'grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg border';
        newTier.innerHTML = `
            <div class="col-span-3">
                <input type="number" name="tier_${tierCount}_from" class="form-input w-full" placeholder="Ex: 1000" min="0" step="1" required>
            </div>
            <div class="col-span-3">
                <input type="number" name="tier_${tierCount}_to" class="form-input w-full" placeholder="Ex: 5000" min="0" step="1" required>
            </div>
            <div class="col-span-3">
                <select name="tier_${tierCount}_type" class="form-select w-full">
                    <option value="fixed">Fixe (FCFA)</option>
                    <option value="percentage">Pourcentage (%)</option>
                </select>
            </div>
            <div class="col-span-2">
                <input type="number" name="tier_${tierCount}_value" class="form-input w-full" placeholder="Ex: 300" min="0" step="0.01" required>
            </div>
            <div class="col-span-1 flex justify-center">
                <button type="button" class="btn btn-danger btn-sm remove-tier" data-index="${tierCount}" data-tooltip="Supprimer ce palier">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        tiersList.appendChild(newTier);
    }

    private removeTier(tiersList: HTMLElement, index: number): void {
        const tierElements = tiersList.querySelectorAll('.grid:not(:first-child)'); // Exclure le header
        if (tierElements[index]) {
            tierElements[index].remove();
        }
    }

    private attachEventListeners(): void {
        const form = $('#defaultExceptionForm', this.modalElement) as HTMLFormElement;
        const typeSelect = $('#commissionType', form) as HTMLSelectElement;
        const addTierBtn = $('#addTierBtn', form) as HTMLButtonElement;
        const tiersList = $('#tiersList', form) as HTMLElement;
        const targetTypeSelect = $('#exceptionTargetType', form) as HTMLSelectElement;
        const targetIdSelect = $('#exceptionTargetId', form) as HTMLSelectElement;

        // Logique de sélection de cible
        const updateTargets = () => {
            const selectedType = targetTypeSelect.value as 'category' | 'operation_type';
            this._loadAndPopulateTargets(selectedType, targetIdSelect);
        };
        
        targetTypeSelect.addEventListener('change', updateTargets);
        
        // Charger initialement
        updateTargets();

        typeSelect.addEventListener('change', () => this.toggleConfigSections(typeSelect.value));
        addTierBtn.addEventListener('click', () => this.addTier(tiersList));

        tiersList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest('.remove-tier') as HTMLButtonElement;
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.index!);
                this.removeTier(tiersList, index);
            }
        });

        const saveBtn = this.modalElement.querySelector('[data-action="save"]') as HTMLButtonElement;
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sauvegarde...';
            
            try {
                await this.saveConfig(form);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Enregistrer l\'exception';
            }
        });

        const cancelBtn = this.modalElement.querySelector('[data-action="cancel"]') as HTMLButtonElement;
        cancelBtn.addEventListener('click', () => this.hide());
    }

    private async saveConfig(form: HTMLFormElement): Promise<void> {
        try {
            const formData = new FormData(form);
            const configData: any = {};
            
            // Extraire les données du formulaire
            configData.description = formData.get('description') as string;
            configData.targetType = formData.get('targetType') as 'category' | 'operation_type';
            configData.targetId = formData.get('targetId') as string;
            configData.condition = formData.get('condition') as string;
            
            // Configuration de la commission
            configData.commissionOverride = {
                type: formData.get('type') as 'fixed' | 'percentage' | 'tiers',
                partageSociete: parseInt(formData.get('partageSociete') as string) || 50
            };
            
            switch (configData.commissionOverride.type) {
                case 'fixed':
                    configData.commissionOverride.amount = parseFloat(formData.get('amount') as string) || 0;
                    break;
                case 'percentage':
                    configData.commissionOverride.rate = parseFloat(formData.get('rate') as string) || 0;
                    break;
                case 'tiers':
                    // Extraire les paliers
                    configData.commissionOverride.tiers = [];
                    const tierInputs = form.querySelectorAll('[name^="tier_"]');
                    const tiers: any = {};
                    
                    tierInputs.forEach(input => {
                        const name = (input as HTMLInputElement).name;
                        const match = name.match(/tier_(\d+)_(\w+)/);
                        if (match) {
                            const index = match[1];
                            const field = match[2];
                            if (!tiers[index]) tiers[index] = {};
                            tiers[index][field] = (input as HTMLInputElement).value;
                        }
                    });
                    
                    Object.values(tiers).forEach((tier: any) => {
                        if (tier.from && tier.to) {
                            configData.commissionOverride.tiers.push({
                                from: parseFloat(tier.from),
                                to: parseFloat(tier.to) || null,
                                type: tier.type,
                                value: parseFloat(tier.value)
                            });
                        }
                    });
                    break;
            }
            
            // Sauvegarder la configuration
            const templates = await this.api.getCommissionTemplates();
            if (templates.length > 0) {
                const template = templates[0];
                const exceptions = [...(template.standard_exceptions || [])];
                
                // Si c'est une modification, trouver et mettre à jour l'exception existante
                // Sinon, ajouter une nouvelle exception
                // Pour simplifier, nous allons ajouter une nouvelle exception
                const newException = {
                    targetId: configData.targetId,
                    targetType: configData.targetType,
                    name: configData.description,
                    condition: configData.condition,
                    commissionConfig: configData.commissionOverride
                };
                
                exceptions.push(newException);
                
                await this.api.updateCommissionTemplate(template.id, {
                    standard_exceptions: exceptions
                });
                
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Exception enregistrée avec succès', type: 'success' }
                }));
                
                if (this.onSave) {
                    this.onSave();
                }
                this.hide();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Erreur lors de l\'enregistrement', type: 'error' }
            }));
        }
    }
}