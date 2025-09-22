import { BaseModal } from './BaseModal';
import { $ } from '../../utils/dom';
import { ApiService } from '../../services/api.service';

interface CommissionConfig {
    type: 'fixed' | 'percentage' | 'tiers';
    amount?: number;
    rate?: number;
    tiers?: Array<{
        from: number;
        to: number;
        type: 'fixed' | 'percentage';
        value: number;
    }>;
    partageSociete: number;
}

export class AdminDefaultCommissionModal extends BaseModal {
    private api: ApiService;
    private onSave?: () => void;

    constructor() {
        super('admin-default-commission-modal', { size: 'lg' });
        this.api = ApiService.getInstance();
    }

    public setOnSave(callback: () => void) {
        this.onSave = callback;
    }

    public async show(config?: CommissionConfig): Promise<void> {
        const title = 'Configuration Globale des Commissions';
        const body = this._createFormBody(config);
        const footer = this._createFooter();

        this.setContent(title, body, footer);
        super.show();
        this.attachEventListeners();
        this.initializeTooltips();
    }

    private _createFormBody(config?: CommissionConfig): HTMLElement {
        const form = document.createElement('form');
        form.id = 'defaultCommissionForm';
        form.className = 'space-y-6';

        form.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle mr-2"></i>
                Cette configuration s'applique par défaut à tous les nouveaux contrats.
            </div>

            <div>
                <label class="form-label" for="commissionType">
                    Type de Commission
                    <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Choisissez le mode de calcul de la commission."></i>
                </label>
                <select id="commissionType" name="type" class="form-select w-full" required>
                    <option value="fixed" ${config?.type === 'fixed' ? 'selected' : ''}>Montant Fixe</option>
                    <option value="percentage" ${config?.type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
                    <option value="tiers" ${config?.type === 'tiers' ? 'selected' : ''}>Par Paliers</option>
                </select>
            </div>

            <div id="fixedConfig" class="p-4 border rounded-md" style="display: ${config?.type === 'fixed' ? 'block' : 'none'}">
                <h3 class="font-semibold mb-2">Configuration du Montant Fixe</h3>
                <div>
                    <label class="form-label" for="fixedAmount">Montant de la commission (FCFA)</label>
                    <input type="number" id="fixedAmount" name="amount" class="form-input w-full" 
                           value="${config?.amount || ''}" min="0" step="1">
                </div>
            </div>

            <div id="percentageConfig" class="p-4 border rounded-md" style="display: ${config?.type === 'percentage' ? 'block' : 'none'}">
                <h3 class="font-semibold mb-2">Configuration du Pourcentage</h3>
                <div>
                    <label class="form-label" for="percentageRate">Taux de commission (%)</label>
                    <input type="number" id="percentageRate" name="rate" class="form-input w-full" 
                           value="${config?.rate || ''}" min="0" max="100" step="0.1">
                </div>
            </div>

            <div id="tiersConfig" class="p-4 border rounded-md" style="display: ${config?.type === 'tiers' ? 'block' : 'none'}">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold">Configuration par Paliers</h3>
                    <button type="button" id="addTierBtn" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus mr-1"></i>Ajouter un palier
                    </button>
                </div>
                <div id="tiersList" class="space-y-3">
                    ${this.renderTiersList(config?.tiers || [])}
                </div>
            </div>

            <div class="p-4 border rounded-md bg-gray-50">
                <label class="form-label" for="partageSociete">
                    Part de la Société (%)
                    <i class="fas fa-question-circle text-gray-400 ml-1" data-tooltip="Le pourcentage de la commission totale qui revient à la société. Le reste va au partenaire."></i>
                </label>
                <input type="number" id="partageSociete" name="partageSociete" class="form-input w-full" 
                       value="${config?.partageSociete || 50}" min="0" max="100" step="1" required>
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
                <i class="fas fa-save mr-2"></i>Enregistrer les modifications
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

    private attachEventListeners(): void {
        const form = $('#defaultCommissionForm', this.modalElement) as HTMLFormElement;
        const typeSelect = $('#commissionType', form) as HTMLSelectElement;
        const addTierBtn = $('#addTierBtn', form) as HTMLButtonElement;
        const tiersList = $('#tiersList', form) as HTMLElement;

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
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Enregistrer les modifications';
            }
        });

        const cancelBtn = this.modalElement.querySelector('[data-action="cancel"]') as HTMLButtonElement;
        cancelBtn.addEventListener('click', () => this.hide());
    }

    private toggleConfigSections(type: string): void {
        const fixedConfig = $('#fixedConfig', this.modalElement) as HTMLElement;
        const percentageConfig = $('#percentageConfig', this.modalElement) as HTMLElement;
        const tiersConfig = $('#tiersConfig', this.modalElement) as HTMLElement;

        fixedConfig.style.display = 'none';
        percentageConfig.style.display = 'none';
        tiersConfig.style.display = 'none';

        if (type === 'fixed') fixedConfig.style.display = 'block';
        if (type === 'percentage') percentageConfig.style.display = 'block';
        if (type === 'tiers') tiersConfig.style.display = 'block';
    }

    private addTier(tiersList: HTMLElement): void {
        const currentTiers = tiersList.querySelectorAll('.space-y-3 .grid.grid-cols-12').length;
        const newTier = document.createElement('div');
        newTier.className = 'grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg border';
        newTier.innerHTML = `
            <div class="col-span-3">
                <input type="number" name="tier_${currentTiers}_from" class="form-input w-full" placeholder="Ex: 1000" min="0" step="1" value="0" required>
            </div>
            <div class="col-span-3">
                <input type="number" name="tier_${currentTiers}_to" class="form-input w-full" placeholder="Ex: 5000" min="0" step="1" value="" required>
            </div>
            <div class="col-span-3">
                <select name="tier_${currentTiers}_type" class="form-select w-full">
                    <option value="fixed" selected>Fixe (FCFA)</option>
                    <option value="percentage">Pourcentage (%)</option>
                </select>
            </div>
            <div class="col-span-2">
                <input type="number" name="tier_${currentTiers}_value" class="form-input w-full" placeholder="Ex: 300" min="0" step="0.01" value="0" required>
            </div>
            <div class="col-span-1 flex justify-center">
                <button type="button" class="btn btn-danger btn-sm remove-tier" data-index="${currentTiers}" data-tooltip="Supprimer ce palier">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        const tierContainer = tiersList.querySelector('.space-y-3');
        if (tierContainer) {
            tierContainer.appendChild(newTier);
        } else {
            tiersList.innerHTML = ''; // Clear placeholder
            const header = `
                <div class="grid grid-cols-12 gap-3 items-center font-semibold text-sm text-gray-600 px-3">
                    <div class="col-span-3">De (FCFA)</div>
                    <div class="col-span-3">À (FCFA)</div>
                    <div class="col-span-3">Type</div>
                    <div class="col-span-2">Valeur</div>
                    <div class="col-span-1"></div>
                </div>
            `;
            tiersList.innerHTML = header + '<div class="space-y-3 mt-2"></div>';
            tiersList.querySelector('.space-y-3')!.appendChild(newTier);
        }
        this.reindexTiers(tiersList);
    }

    private removeTier(tiersList: HTMLElement, index: number): void {
        const tierItem = tiersList.querySelector(`[data-index="${index}"]`)?.closest('.grid.grid-cols-12');
        if (tierItem) {
            tierItem.remove();
            this.reindexTiers(tiersList);
        }
    }

    private reindexTiers(tiersList: HTMLElement): void {
        const tierItems = tiersList.querySelectorAll('.space-y-3 .grid.grid-cols-12');
        tierItems.forEach((item, index) => {
            const removeBtn = item.querySelector('.remove-tier') as HTMLButtonElement;
            if (removeBtn) removeBtn.dataset.index = index.toString();

            const fromInput = item.querySelector('[name$="_from"]') as HTMLInputElement;
            if (fromInput) fromInput.name = `tier_${index}_from`;

            const toInput = item.querySelector('[name$="_to"]') as HTMLInputElement;
            if (toInput) toInput.name = `tier_${index}_to`;

            const typeSelect = item.querySelector('[name$="_type"]') as HTMLSelectElement;
            if (typeSelect) typeSelect.name = `tier_${index}_type`;

            const valueInput = item.querySelector('[name$="_value"]') as HTMLInputElement;
            if (valueInput) valueInput.name = `tier_${index}_value`;
        });

        if (tierItems.length === 0) {
            tiersList.innerHTML = this.renderTiersList([]);
        }
    }

    private async saveConfig(form: HTMLFormElement): Promise<void> {
        try {
            console.log('Form innerHTML:', form.innerHTML);
            const formData = new FormData(form);
            const type = formData.get('type') as string;
            
            const config: CommissionConfig = {
                type: type as 'fixed' | 'percentage' | 'tiers',
                partageSociete: Number(formData.get('partageSociete'))
            };

            console.log('Saving config:', config);

            switch (type) {
                case 'fixed':
                    config.amount = Number(formData.get('amount'));
                    break;
                case 'percentage':
                    config.rate = Number(formData.get('rate'));
                    break;
                case 'tiers':
                    config.tiers = this.extractTiersFromForm(form);
                    break;
            }

            const result = await this.api.updateAllContractsDefaultCommission(config);

            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: result.message || 'Configuration par défaut mise à jour.', type: 'success' }
            }));

            this.hide();
            if (this.onSave) {
                this.onSave();
            }
        } catch (error) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Erreur: ${(error as Error).message}`, type: 'error' }
            }));
        }
    }

    private extractTiersFromForm(form: HTMLFormElement): Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}> {
        console.log('Extracting tiers from form');
        const tiers: Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}> = [];
        
        // Trouver tous les éléments de palier en cherchant par nom de champ
        const tierItems = form.querySelectorAll('[name$="_from"]');
        console.log('Found tier items with _from fields:', tierItems.length);
        
        tierItems.forEach((fromInput: Element) => {
            const fromInputElement = fromInput as HTMLInputElement;
            const name = fromInputElement.name;
            // Extraire l'index du nom du champ (ex: tier_1_from -> index 1)
            const match = name.match(/tier_(\d+)_from/);
            if (match) {
                const index = match[1];
                console.log(`Processing tier item with index ${index}`);
                
                // Trouver les autres champs du même palier
                const toInput = form.querySelector(`[name="tier_${index}_to"]`) as HTMLInputElement;
                const typeSelect = form.querySelector(`[name="tier_${index}_type"]`) as HTMLSelectElement;
                const valueInput = form.querySelector(`[name="tier_${index}_value"]`) as HTMLInputElement;
                
                if (fromInputElement && toInput && typeSelect && valueInput) {
                    const tierData = {
                        from: Number(fromInputElement.value) || 0,
                        to: toInput.value ? Number(toInput.value) : 999999999,
                        type: typeSelect.value as 'fixed' | 'percentage',
                        value: Number(valueInput.value) || 0
                    };
                    
                    console.log(`Tier ${index} data:`, tierData);
                    tiers.push(tierData);
                } else {
                    console.warn(`Missing elements for tier ${index}`);
                }
            }
        });

        console.log('Extracted tiers:', tiers);
        return tiers;
    }

    private initializeTooltips(): void {
        // Basic tooltip implementation
        this.modalElement.querySelectorAll('[data-tooltip]').forEach(el => {
            const tooltipText = el.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            document.body.appendChild(tooltip);

            el.addEventListener('mouseenter', () => {
                const rect = el.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 10}px`;
                tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
                tooltip.classList.add('visible');
            });

            el.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }
}
