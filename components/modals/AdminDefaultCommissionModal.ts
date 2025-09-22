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
        console.log('AdminDefaultCommissionModal constructor called');
        super('admin-default-commission-modal', { size: 'lg' });
        console.log('Modal created with ID:', this.modalId);
        this.api = ApiService.getInstance();
    }

    public setOnSave(callback: () => void) {
        this.onSave = callback;
    }

    public async show(config?: CommissionConfig): Promise<void> {
        const title = config ? 'Modifier la Configuration par Défaut' : 'Configuration par Défaut';
        
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="defaultCommissionForm" class="space-y-6">
                <div>
                    <label class="form-label" for="commissionType">Type de Commission</label>
                    <select id="commissionType" name="type" class="form-input" required>
                        <option value="fixed" ${config?.type === 'fixed' ? 'selected' : ''}>Montant Fixe</option>
                        <option value="percentage" ${config?.type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
                        <option value="tiers" ${config?.type === 'tiers' ? 'selected' : ''}>Par Paliers</option>
                    </select>
                </div>

                <div id="fixedConfig" class="space-y-4" style="display: ${config?.type === 'fixed' ? 'block' : 'none'}">
                    <div>
                        <label class="form-label" for="fixedAmount">Montant Fixe (FCFA)</label>
                        <input type="number" id="fixedAmount" name="amount" class="form-input" 
                               value="${config?.amount || ''}" min="0" step="1">
                    </div>
                </div>

                <div id="percentageConfig" class="space-y-4" style="display: ${config?.type === 'percentage' ? 'block' : 'none'}">
                    <div>
                        <label class="form-label" for="percentageRate">Taux de Commission (%)</label>
                        <input type="number" id="percentageRate" name="rate" class="form-input" 
                               value="${config?.rate || ''}" min="0" max="100" step="0.1">
                    </div>
                </div>

                <div id="tiersConfig" class="space-y-4" style="display: ${config?.type === 'tiers' ? 'block' : 'none'}">
                    <div class="flex justify-between items-center">
                        <label class="form-label">Configuration par Paliers</label>
                        <button type="button" id="addTierBtn" class="btn btn-sm btn-primary">
                            <i class="fas fa-plus mr-1"></i>Ajouter Palier
                        </button>
                    </div>
                    <div id="tiersList" class="space-y-3">
                        ${this.renderTiersList(config?.tiers || [])}
                    </div>
                </div>

                <div>
                    <label class="form-label" for="partageSociete">Part Société (%)</label>
                    <input type="number" id="partageSociete" name="partageSociete" class="form-input" 
                           value="${config?.partageSociete || 50}" min="0" max="100" step="1" required>
                    <p class="text-xs text-gray-500 mt-1">Pourcentage de la commission qui revient à la société</p>
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
        super.show();
        this.attachEventListeners();
    }

    private renderTiersList(tiers: Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}>): string {
        if (tiers.length === 0) {
            return '<p class="text-gray-500 text-sm">Aucun palier configuré</p>';
        }

        return tiers.map((tier, index) => `
            <div class="grid grid-cols-5 gap-3 items-center p-3 bg-gray-50 rounded-lg border">
                <div>
                    <input type="number" name="tier_${index}_from" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="1000" min="0" step="1" value="${tier.from}" required>
                </div>
                <div>
                    <input type="number" name="tier_${index}_to" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="5000" min="0" step="1" value="${tier.to || ''}" required>
                </div>
                <div>
                    <select name="tier_${index}_type" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="fixed" ${tier.type === 'fixed' ? 'selected' : ''}>Fixe (XOF)</option>
                        <option value="percentage" ${tier.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
                    </select>
                </div>
                <div>
                    <input type="number" name="tier_${index}_value" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="300" min="0" step="0.01" value="${tier.value}" required>
                </div>
                <div class="flex justify-center">
                    <button type="button" class="p-2 text-white bg-red-500 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 remove-tier" data-index="${index}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    private attachEventListeners(): void {
        const form = $('#defaultCommissionForm', this.modalElement) as HTMLFormElement;
        const typeSelect = $('#commissionType', form) as HTMLSelectElement;
        const addTierBtn = $('#addTierBtn', form) as HTMLButtonElement;
        const tiersList = $('#tiersList', form) as HTMLElement;

        console.log('Attaching event listeners for commission form');

        // Gestion du changement de type de commission
        typeSelect.addEventListener('change', () => {
            console.log('Commission type changed to:', typeSelect.value);
            this.toggleConfigSections(typeSelect.value);
        });

        // Gestion de l'ajout de palier
        addTierBtn.addEventListener('click', () => {
            console.log('Add tier button clicked');
            this.addTier(tiersList);
        });

        // Gestion de la suppression de palier
        tiersList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest('.remove-tier') as HTMLButtonElement;
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.index!);
                console.log('Remove tier button clicked for index:', index);
                this.removeTier(tiersList, index);
            }
        });

        // Gestion des boutons du footer
        this.modalElement.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('[data-action]') as HTMLButtonElement;
            if (!button) return;

            const action = button.dataset.action;
            console.log('Modal action button clicked:', action);
            
            if (action === 'save') {
                await this.saveConfig(form);
            } else if (action === 'cancel') {
                this.hide();
            }
        });
    }

    private toggleConfigSections(type: string): void {
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
        const currentTiers = tiersList.querySelectorAll('.grid.grid-cols-5').length;
        const tierHtml = `
            <div class="grid grid-cols-5 gap-3 items-center p-3 bg-gray-50 rounded-lg border">
                <div>
                    <input type="number" name="tier_${currentTiers}_from" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="1000" min="0" step="1" value="0" required>
                </div>
                <div>
                    <input type="number" name="tier_${currentTiers}_to" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="5000" min="0" step="1" value="" required>
                </div>
                <div>
                    <select name="tier_${currentTiers}_type" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="fixed" selected>Fixe (XOF)</option>
                        <option value="percentage">Pourcentage (%)</option>
                    </select>
                </div>
                <div>
                    <input type="number" name="tier_${currentTiers}_value" class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="300" min="0" step="0.01" value="0" required>
                </div>
                <div class="flex justify-center">
                    <button type="button" class="p-2 text-white bg-red-500 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 remove-tier" data-index="${currentTiers}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        tiersList.insertAdjacentHTML('beforeend', tierHtml);
    }

    private removeTier(tiersList: HTMLElement, index: number): void {
        const tierItem = tiersList.querySelector(`[data-index="${index}"]`)?.closest('.grid.grid-cols-5') as HTMLElement;
        if (tierItem) {
            tierItem.remove();
            // Réindexer les paliers restants
            this.reindexTiers(tiersList);
        }
    }

    private reindexTiers(tiersList: HTMLElement): void {
        const tierItems = tiersList.querySelectorAll('.grid.grid-cols-5');
        tierItems.forEach((item, index) => {
            // Mettre à jour le data-index du bouton de suppression
            const removeBtn = item.querySelector('.remove-tier') as HTMLButtonElement;
            if (removeBtn) {
                removeBtn.dataset.index = index.toString();
            }

            // Mettre à jour les attributs 'name' de tous les champs du palier
            const fromInput = item.querySelector('[name$="_from"]') as HTMLInputElement;
            if (fromInput) fromInput.name = `tier_${index}_from`;

            const toInput = item.querySelector('[name$="_to"]') as HTMLInputElement;
            if (toInput) toInput.name = `tier_${index}_to`;

            const typeSelect = item.querySelector('[name$="_type"]') as HTMLSelectElement;
            if (typeSelect) typeSelect.name = `tier_${index}_type`;

            const valueInput = item.querySelector('[name$="_value"]') as HTMLInputElement;
            if (valueInput) valueInput.name = `tier_${index}_value`;
        });
    }

    private async saveConfig(form: HTMLFormElement): Promise<void> {
        console.log('Save config initiated');
        
        const confirmed = confirm(
            'Attention : La modification de la configuration de commission par défaut entraînera la mise à jour de TOUS les contrats existants pour utiliser ces nouvelles valeurs.\n\nCette action est irréversible. Continuer ?'
        );

        if (!confirmed) {
            console.log('User cancelled the save operation');
            return;
        }

        try {
            console.log('Preparing to save commission configuration');
            const formData = new FormData(form);
            const type = formData.get('type') as string;
            
            let config: CommissionConfig = {
                type: type as 'fixed' | 'percentage' | 'tiers',
                partageSociete: Number(formData.get('partageSociete'))
            };

            console.log('Commission type selected:', type);
            
            switch (type) {
                case 'fixed':
                    config.amount = Number(formData.get('amount'));
                    console.log('Fixed amount set to:', config.amount);
                    break;
                case 'percentage':
                    config.rate = Number(formData.get('rate'));
                    console.log('Percentage rate set to:', config.rate);
                    break;
                case 'tiers':
                    config.tiers = this.extractTiersFromForm(form);
                    console.log('Tiers configuration extracted:', config.tiers);
                    break;
            }

            console.log('Sending configuration to API:', config);
            
            // Sauvegarder via la nouvelle fonction Edge
            const result = await this.api.updateAllContractsDefaultCommission(config);
            console.log('API response received:', result);

            // Afficher un message de succès
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: result.message || 'Configuration par défaut mise à jour pour tous les contrats.', type: 'success' }
            }));

            this.hide();
            if (this.onSave) {
                console.log('Calling onSave callback');
                this.onSave();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la config par défaut:', error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Erreur: ${(error as Error).message}`, type: 'error' }
            }));
        }
    }

    private extractTiersFromForm(form: HTMLFormElement): Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}> {
        console.log('Extracting tiers from form');
        const tiers: Array<{from: number, to: number, type: 'fixed' | 'percentage', value: number}> = [];
        const tierItems = form.querySelectorAll('.grid.grid-cols-5');
        
        console.log('Number of tier items found:', tierItems.length);
        
        tierItems.forEach((item, index) => {
            const fromInput = item.querySelector(`[name="tier_${index}_from"]`) as HTMLInputElement;
            const toInput = item.querySelector(`[name="tier_${index}_to"]`) as HTMLInputElement;
            const typeSelect = item.querySelector(`[name="tier_${index}_type"]`) as HTMLSelectElement;
            const valueInput = item.querySelector(`[name="tier_${index}_value"]`) as HTMLInputElement;

            if (fromInput && typeSelect && valueInput) {
                const tierData = {
                    from: Number(fromInput.value),
                    to: toInput.value ? Number(toInput.value) : 999999999,
                    type: typeSelect.value as 'fixed' | 'percentage',
                    value: Number(valueInput.value)
                };
                
                console.log(`Tier ${index} data:`, tierData);
                tiers.push(tierData);
            } else {
                console.warn(`Missing elements for tier ${index}`);
            }
        });

        console.log('Extracted tiers:', tiers);
        return tiers;
    }
}
