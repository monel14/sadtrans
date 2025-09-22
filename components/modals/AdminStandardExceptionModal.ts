import { BaseModal } from './BaseModal';
import { $ } from '../../utils/dom';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';

interface StandardException {
    name: string;
    targetId: string;
    targetType: 'category' | 'service';
    commissionConfig: {
        type: 'fixed' | 'percentage' | 'tiers';
        amount?: number;
        rate?: number;
        tiers?: Array<{
            from: number;
            to?: number;
            type: 'fixed' | 'percentage';
            value: number;
        }>;
        partageSociete: number;
    };
}

export class AdminStandardExceptionModal extends BaseModal {
    private api: ApiService;
    private dataService: DataService;
    private onSave?: () => void;
    private operationTypes: any[] = [];

    constructor() {
        super('admin-standard-exception-modal', { size: 'lg' });
        this.api = ApiService.getInstance();
        this.dataService = DataService.getInstance();
    }

    public setOnSave(callback: () => void) {
        this.onSave = callback;
    }

    public async show(exception?: StandardException, exceptionIndex?: number): Promise<void> {
        await this.loadOperationTypes();
        
        const title = exception ? 'Modifier Exception Standard' : 'Nouvelle Exception Standard';
        
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="standardExceptionForm" class="space-y-6">
                <input type="hidden" name="exceptionIndex" value="${exceptionIndex || ''}">
                
                <div>
                    <label class="form-label" for="exceptionName">Nom de l'Exception</label>
                    <input type="text" id="exceptionName" name="name" class="form-input" 
                           value="${exception?.name || ''}" required>
                </div>

                <div>
                    <label class="form-label" for="targetType">Type de Cible</label>
                    <select id="targetType" name="targetType" class="form-input" required>
                        <option value="category" ${exception?.targetType === 'category' ? 'selected' : ''}>Catégorie</option>
                        <option value="service" ${exception?.targetType === 'service' ? 'selected' : ''}>Service</option>
                    </select>
                </div>

                <div>
                    <label class="form-label" for="targetId">Cible</label>
                    <select id="targetId" name="targetId" class="form-input" required>
                        <option value="">Sélectionner une cible...</option>
                        ${this.renderTargetOptions(exception?.targetType || 'category')}
                    </select>
                </div>

                <div class="border-t pt-4">
                    <h4 class="text-lg font-medium text-gray-800 mb-4">Configuration de Commission</h4>
                    
                    <div>
                        <label class="form-label" for="commissionType">Type de Commission</label>
                        <select id="commissionType" name="commissionType" class="form-input" required>
                            <option value="fixed" ${exception?.commissionConfig?.type === 'fixed' ? 'selected' : ''}>Montant Fixe</option>
                            <option value="percentage" ${exception?.commissionConfig?.type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
                            <option value="tiers" ${exception?.commissionConfig?.type === 'tiers' ? 'selected' : ''}>Par Paliers</option>
                        </select>
                    </div>

                    <div id="fixedConfig" class="space-y-4 mt-4" style="display: ${exception?.commissionConfig?.type === 'fixed' ? 'block' : 'none'}">
                        <div>
                            <label class="form-label" for="fixedAmount">Montant Fixe (FCFA)</label>
                            <input type="number" id="fixedAmount" name="amount" class="form-input" 
                                   value="${exception?.commissionConfig?.amount || ''}" min="0" step="1">
                        </div>
                    </div>

                    <div id="percentageConfig" class="space-y-4 mt-4" style="display: ${exception?.commissionConfig?.type === 'percentage' ? 'block' : 'none'}">
                        <div>
                            <label class="form-label" for="percentageRate">Taux de Commission (%)</label>
                            <input type="number" id="percentageRate" name="rate" class="form-input" 
                                   value="${exception?.commissionConfig?.rate || ''}" min="0" max="100" step="0.1">
                        </div>
                    </div>

                    <div id="tiersConfig" class="space-y-4 mt-4" style="display: ${exception?.commissionConfig?.type === 'tiers' ? 'block' : 'none'}">
                        <div class="flex justify-between items-center">
                            <label class="form-label">Configuration par Paliers</label>
                            <button type="button" id="addTierBtn" class="btn btn-sm btn-primary">
                                <i class="fas fa-plus mr-1"></i>Ajouter Palier
                            </button>
                        </div>
                        <div id="tiersList" class="space-y-3">
                            ${this.renderTiersList(exception?.commissionConfig?.tiers || [])}
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="form-label" for="partageSociete">Part Société (%)</label>
                        <input type="number" id="partageSociete" name="partageSociete" class="form-input" 
                               value="${exception?.commissionConfig?.partageSociete || 50}" min="0" max="100" step="1" required>
                        <p class="text-xs text-gray-500 mt-1">Pourcentage de la commission qui revient à la société</p>
                    </div>
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-action="cancel">Annuler</button>
            <button type="button" class="btn btn-primary" data-action="save">
                <i class="fas fa-save mr-2"></i>Sauvegarder
            </button>
        `;

        this.setContent(title, body, footer);
        this.show();
        this.attachEventListeners();
    }

    private async loadOperationTypes(): Promise<void> {
        this.operationTypes = await this.dataService.getAllOperationTypes();
    }

    private renderTargetOptions(targetType: string): string {
        if (targetType === 'category') {
            const categories = [...new Set(this.operationTypes.map(op => op.category).filter(Boolean))];
            return categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        } else {
            return this.operationTypes.map(op => `<option value="${op.id}">${op.name}</option>`).join('');
        }
    }

    private renderTiersList(tiers: Array<{from: number, to?: number, type: 'fixed' | 'percentage', value: number}>): string {
        if (tiers.length === 0) {
            return '<p class="text-gray-500 text-sm">Aucun palier configuré</p>';
        }

        return tiers.map((tier, index) => `
            <div class="tier-item border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-medium text-gray-700">Palier ${index + 1}</span>
                    <button type="button" class="btn btn-sm btn-danger remove-tier" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="form-label text-xs">De (FCFA)</label>
                        <input type="number" class="form-input text-sm" name="tier_from_${index}" 
                               value="${tier.from}" min="0" step="1" required>
                    </div>
                    <div>
                        <label class="form-label text-xs">À (FCFA)</label>
                        <input type="number" class="form-input text-sm" name="tier_to_${index}" 
                               value="${tier.to || ''}" min="0" step="1" placeholder="Illimité">
                    </div>
                    <div>
                        <label class="form-label text-xs">Type</label>
                        <select class="form-input text-sm" name="tier_type_${index}" required>
                            <option value="fixed" ${tier.type === 'fixed' ? 'selected' : ''}>Fixe</option>
                            <option value="percentage" ${tier.type === 'percentage' ? 'selected' : ''}>%</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label text-xs">Valeur</label>
                        <input type="number" class="form-input text-sm" name="tier_value_${index}" 
                               value="${tier.value}" min="0" step="0.01" required>
                    </div>
                </div>
            </div>
        `).join('');
    }

    private attachEventListeners(): void {
        const form = $('#standardExceptionForm', this.modalElement) as HTMLFormElement;
        const targetTypeSelect = $('#targetType', form) as HTMLSelectElement;
        const targetIdSelect = $('#targetId', form) as HTMLSelectElement;
        const commissionTypeSelect = $('#commissionType', form) as HTMLSelectElement;
        const addTierBtn = $('#addTierBtn', form) as HTMLButtonElement;
        const tiersList = $('#tiersList', form) as HTMLElement;

        // Gestion du changement de type de cible
        targetTypeSelect.addEventListener('change', () => {
            this.updateTargetOptions(targetIdSelect, targetTypeSelect.value);
        });

        // Gestion du changement de type de commission
        commissionTypeSelect.addEventListener('change', () => {
            this.toggleCommissionConfigSections(commissionTypeSelect.value);
        });

        // Gestion de l'ajout de palier
        addTierBtn.addEventListener('click', () => {
            this.addTier(tiersList);
        });

        // Gestion de la suppression de palier
        tiersList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest('.remove-tier') as HTMLButtonElement;
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.index!);
                this.removeTier(tiersList, index);
            }
        });

        // Gestion des boutons du footer
        this.modalElement.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('[data-action]') as HTMLButtonElement;
            if (!button) return;

            const action = button.dataset.action;
            if (action === 'save') {
                await this.saveException(form);
            } else if (action === 'cancel') {
                this.hide();
            }
        });
    }

    private updateTargetOptions(targetSelect: HTMLSelectElement, targetType: string): void {
        const firstOption = targetSelect.querySelector('option[value=""]') as HTMLOptionElement;
        targetSelect.innerHTML = '';
        targetSelect.appendChild(firstOption);
        
        const options = this.renderTargetOptions(targetType);
        targetSelect.insertAdjacentHTML('beforeend', options);
    }

    private toggleCommissionConfigSections(type: string): void {
        const fixedConfig = $('#fixedConfig', this.modalElement) as HTMLElement;
        const percentageConfig = $('#percentageConfig', this.modalElement) as HTMLElement;
        const tiersConfig = $('#tiersConfig', this.modalElement) as HTMLElement;

        // Masquer toutes les sections
        fixedConfig.style.display = 'none';
        percentageConfig.style.display = 'none';
        tiersConfig.style.display = 'none';

        // Afficher la section appropriée
        switch (type) {
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
        const currentTiers = tiersList.querySelectorAll('.tier-item').length;
        const tierHtml = `
            <div class="tier-item border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-medium text-gray-700">Palier ${currentTiers + 1}</span>
                    <button type="button" class="btn btn-sm btn-danger remove-tier" data-index="${currentTiers}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="form-label text-xs">De (FCFA)</label>
                        <input type="number" class="form-input text-sm" name="tier_from_${currentTiers}" 
                               value="0" min="0" step="1" required>
                    </div>
                    <div>
                        <label class="form-label text-xs">À (FCFA)</label>
                        <input type="number" class="form-input text-sm" name="tier_to_${currentTiers}" 
                               value="" min="0" step="1" placeholder="Illimité">
                    </div>
                    <div>
                        <label class="form-label text-xs">Type</label>
                        <select class="form-input text-sm" name="tier_type_${currentTiers}" required>
                            <option value="fixed">Fixe</option>
                            <option value="percentage">%</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label text-xs">Valeur</label>
                        <input type="number" class="form-input text-sm" name="tier_value_${currentTiers}" 
                               value="0" min="0" step="0.01" required>
                    </div>
                </div>
            </div>
        `;
        tiersList.insertAdjacentHTML('beforeend', tierHtml);
    }

    private removeTier(tiersList: HTMLElement, index: number): void {
        const tierItem = tiersList.querySelector(`[data-index="${index}"]`)?.closest('.tier-item') as HTMLElement;
        if (tierItem) {
            tierItem.remove();
            this.reindexTiers(tiersList);
        }
    }

    private reindexTiers(tiersList: HTMLElement): void {
        const tierItems = tiersList.querySelectorAll('.tier-item');
        tierItems.forEach((item, index) => {
            const title = item.querySelector('.font-medium') as HTMLElement;
            const removeBtn = item.querySelector('.remove-tier') as HTMLButtonElement;
            if (title) title.textContent = `Palier ${index + 1}`;
            if (removeBtn) removeBtn.dataset.index = index.toString();
        });
    }

    private async saveException(form: HTMLFormElement): Promise<void> {
        try {
            const formData = new FormData(form);
            const exceptionIndex = formData.get('exceptionIndex') as string;
            
            const exception: StandardException = {
                name: formData.get('name') as string,
                targetId: formData.get('targetId') as string,
                targetType: formData.get('targetType') as 'category' | 'service',
                commissionConfig: {
                    type: formData.get('commissionType') as 'fixed' | 'percentage' | 'tiers',
                    partageSociete: Number(formData.get('partageSociete'))
                }
            };

            // Ajouter les détails de la commission selon le type
            const commissionType = exception.commissionConfig.type;
            switch (commissionType) {
                case 'fixed':
                    exception.commissionConfig.amount = Number(formData.get('amount'));
                    break;
                case 'percentage':
                    exception.commissionConfig.rate = Number(formData.get('rate'));
                    break;
                case 'tiers':
                    exception.commissionConfig.tiers = this.extractTiersFromForm(form);
                    break;
            }

            // Sauvegarder via l'API
            const templates = await this.api.getCommissionTemplates();
            if (templates.length > 0) {
                const template = templates[0];
                const exceptions = [...(template.standard_exceptions || [])];
                
                if (exceptionIndex !== '') {
                    // Modifier une exception existante
                    const index = parseInt(exceptionIndex);
                    exceptions[index] = exception;
                } else {
                    // Ajouter une nouvelle exception
                    exceptions.push(exception);
                }
                
                await this.api.updateCommissionTemplate(template.id, {
                    standard_exceptions: exceptions
                });
            }

            // Afficher un message de succès
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Exception standard sauvegardée avec succès', type: 'success' }
            }));

            this.hide();
            if (this.onSave) {
                this.onSave();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Erreur lors de la sauvegarde', type: 'error' }
            }));
        }
    }

    private extractTiersFromForm(form: HTMLFormElement): Array<{from: number, to?: number, type: 'fixed' | 'percentage', value: number}> {
        const tiers: Array<{from: number, to?: number, type: 'fixed' | 'percentage', value: number}> = [];
        const tierItems = form.querySelectorAll('.tier-item');
        
        tierItems.forEach((item) => {
            const fromInput = item.querySelector('[name^="tier_from_"]') as HTMLInputElement;
            const toInput = item.querySelector('[name^="tier_to_"]') as HTMLInputElement;
            const typeSelect = item.querySelector('[name^="tier_type_"]') as HTMLSelectElement;
            const valueInput = item.querySelector('[name^="tier_value_"]') as HTMLInputElement;

            if (fromInput && typeSelect && valueInput) {
                tiers.push({
                    from: Number(fromInput.value),
                    to: toInput.value ? Number(toInput.value) : undefined,
                    type: typeSelect.value as 'fixed' | 'percentage',
                    value: Number(valueInput.value)
                });
            }
        });

        return tiers;
    }
}
