import { BaseModal } from './BaseModal';
import { $ } from '../../utils/dom';
import { ApiService } from '../../services/api.service';
import { DataService } from '../../services/data.service';
import { ConfirmationModal } from './ConfirmationModal';
import { Contract, Partner, OperationType, ContractException, CommissionConfig, CommissionTier } from "../../models";

export class AdminEditContractModal extends BaseModal {
    private api: ApiService;
    private dataService: DataService;
    private partners: Partner[] = [];
    private operationTypes: OperationType[] = [];
    public onSave?: () => void;
    private editingContract: Contract | null = null;
    private tierCounter = 0;
    private exceptionCounter = 0;
    private form: HTMLFormElement;
    private confirmationModal: ConfirmationModal;

    constructor(partners: Partner[], operationTypes: OperationType[]) {
        super('admin-edit-contract-modal', { size: 'xl' });
        this.api = ApiService.getInstance();
        this.dataService = DataService.getInstance();
        this.partners = partners;
        this.operationTypes = operationTypes;
        this.confirmationModal = new ConfirmationModal();
        
        // Create form element
        this.form = document.createElement('form');
        this.form.id = 'editContractForm';  // Utiliser le même ID que dans render()
        this.form.className = 'space-y-6';
        
        // Render the modal content
        this.render();
        this.attachListeners();
    }

    private render() {
        const title = "Éditer: Configuration du Contrat";
        
        const partnerOptions = this.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        // Utiliser this.form au lieu de créer un nouveau formulaire
        this.form.innerHTML = `
            <input type="hidden" name="id">
            
            <!-- Informations de base -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Nom du contrat</label>
                    <input type="text" name="name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Partenaire</label>
                    <select name="partnerId" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                        <option value="">-- Sélectionner --</option>
                        ${partnerOptions}
                    </select>
                </div>
            </div>

            <!-- Configuration principale -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Part de la Société (%)</label>
                    <input type="number" name="partageSociete" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" max="100" value="60" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                    <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                        <option value="active">Actif</option>
                        <option value="inactive">Inactif</option>
                        <option value="expired">Expiré</option>
                    </select>
                </div>
            </div>

            <!-- Paliers de Frais de Service (Read-only) -->
            <div>
                <h3 class="text-lg font-medium text-gray-700 mb-4">Commission par Défaut (Non modifiable)</h3>
                <div id="tiersContainer" class="space-y-3 p-4 bg-gray-100 rounded-md border">
                    <!-- Les paliers par défaut seront affichés ici -->
                </div>
                <p class="text-sm text-gray-500 mt-2">La commission par défaut est basée sur un modèle standard et ne peut pas être modifiée ici. Seules les exceptions peuvent être ajoutées.</p>
            </div>

            <!-- Exceptions -->
            <div>
                <h3 class="text-lg font-medium text-gray-700 mb-4">Exceptions</h3>
                <p class="text-sm text-gray-600 mb-4">Configurez des commissions spécifiques pour certains services ou catégories.</p>
                <div id="exceptionsContainer" class="space-y-4">
                    <!-- Les exceptions seront ajoutées ici -->
                </div>
                <button type="button" id="addExceptionBtn" class="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Ajouter une exception
                </button>
            </div>
        `;

        const body = document.createElement('div');
        body.appendChild(this.form);

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-3 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" data-dismiss="modal">
                Annuler
            </button>
            <button type="submit" form="editContractForm" class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Enregistrer
            </button>
        `;

        this.setContent(title, body, footer);
    }

    private attachListeners() {

        // Add exception button
        const addExceptionBtn = $('#addExceptionBtn', this.modalElement) as HTMLButtonElement;
        addExceptionBtn.addEventListener('click', () => {
            this.addException();
        });

        // Form submission
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });

        // Add some default tiers for new contracts
        this.addDefaultTiers();
    }

    private addDefaultTiers() {
        // Ajouter les paliers par défaut comme dans l'image
        this.addTier(1000, 5000, 'fixed', 300);
        this.addTier(5001, 100000, 'fixed', 500);
        this.addTier(100001, 999999999, 'percentage', 1);
    }

    private addTier(fromValue?: number, toValue?: number, typeValue?: string, valueAmount?: number) {
        const tiersContainer = $('#tiersContainer', this.modalElement) as HTMLElement;
        const tierIndex = this.tierCounter++;
    
        const tierDiv = document.createElement('div');
        tierDiv.className = 'grid grid-cols-4 gap-3 items-center p-3 bg-white rounded-lg border';
        tierDiv.innerHTML = `
            <div class="text-sm">De: <span class="font-semibold">${fromValue || 'N/A'}</span></div>
            <div class="text-sm">À: <span class="font-semibold">${toValue || 'N/A'}</span></div>
            <div class="text-sm">Type: <span class="font-semibold">${typeValue === 'fixed' ? 'Fixe' : 'Pourcentage'}</span></div>
            <div class="text-sm">Valeur: <span class="font-semibold">${valueAmount || 'N/A'}</span></div>
        `;
    
        tiersContainer.appendChild(tierDiv);
    }

    private addException(exceptionData?: ContractException) {
        const exceptionsContainer = $('#exceptionsContainer', this.modalElement) as HTMLElement;
        const exceptionIndex = this.exceptionCounter++;
        
        // Préparer les options pour les catégories et services
        const categoryOptions = [...new Set(this.operationTypes.map(ot => ot.category))]
            .filter(cat => cat) // Remove empty categories
            .map(cat => `<option value="${cat}">${cat}</option>`).join('');
        const serviceOptions = this.operationTypes
            .map(ot => `<option value="${ot.id}">${ot.name}</option>`).join('');
        
        const exceptionDiv = document.createElement('div');
        exceptionDiv.className = 'p-4 border border-gray-200 rounded-lg bg-gray-50';
        exceptionDiv.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-medium text-gray-700">Exception ${exceptionIndex + 1}</h4>
                <button type="button" 
                        class="p-1 text-red-600 hover:text-red-800 focus:outline-none"
                        onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
            
            <!-- Informations de base de l'exception -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nom de l'exception</label>
                    <input type="text" 
                           name="exception_${exceptionIndex}_name" 
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="Ex: Services Canal+"
                           value="${exceptionData?.name || ''}"
                           required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Part société (%)</label>
                    <input type="number" 
                           name="exception_${exceptionIndex}_partageSociete" 
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           min="0" 
                           max="100" 
                           value="${exceptionData?.commissionConfig.partageSociete || 50}"
                           required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Type de commission</label>
                    <select name="exception_${exceptionIndex}_commissionType" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 exception-commission-type">
                        <option value="fixed" ${exceptionData?.commissionConfig.type === 'fixed' ? 'selected' : ''}>Montant fixe</option>
                        <option value="percentage" ${exceptionData?.commissionConfig.type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
                        <option value="tiers" ${exceptionData?.commissionConfig.type === 'tiers' ? 'selected' : ''}>Par paliers</option>
                    </select>
                </div>
            </div>
            
            <!-- Ciblage de l'exception -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Type de cible</label>
                    <select name="exception_${exceptionIndex}_targetType" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 exception-target-type" 
                            required>
                        <option value="">-- Sélectionner --</option>
                        <option value="category" ${exceptionData?.targetType === 'category' ? 'selected' : ''}>Catégorie complète</option>
                        <option value="service" ${exceptionData?.targetType === 'service' ? 'selected' : ''}>Service spécifique</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Cible</label>
                    <select name="exception_${exceptionIndex}_targetId" 
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 exception-target-id" 
                            required>
                        <option value="">-- Sélectionner d'abord le type --</option>
                    </select>
                </div>
            </div>
            
            <!-- Détails de commission selon le type -->
            <div class="border-t pt-4">
                <h5 class="font-medium text-gray-600 mb-3">Détails de commission</h5>
                <div class="exception-commission-details" data-exception-index="${exceptionIndex}">
                    <!-- Les détails seront rendus ici selon le type -->
                </div>
            </div>
        `;
        
        exceptionsContainer.appendChild(exceptionDiv);
        
        // Add listeners for dynamic behavior
        const targetTypeSelect = exceptionDiv.querySelector('.exception-target-type') as HTMLSelectElement;
        const targetIdSelect = exceptionDiv.querySelector('.exception-target-id') as HTMLSelectElement;
        const commissionTypeSelect = exceptionDiv.querySelector('.exception-commission-type') as HTMLSelectElement;
        
        targetTypeSelect.addEventListener('change', () => {
            if (targetTypeSelect.value === 'category') {
                targetIdSelect.innerHTML = '<option value="">-- Sélectionner une catégorie --</option>' + categoryOptions;
            } else if (targetTypeSelect.value === 'service') {
                targetIdSelect.innerHTML = '<option value="">-- Sélectionner un service --</option>' + serviceOptions;
            } else {
                targetIdSelect.innerHTML = '<option value="">-- Sélectionner d\'abord le type --</option>';
            }
            
            // Set the value if we're editing
            if (exceptionData) {
                setTimeout(() => {
                    targetIdSelect.value = exceptionData.targetId;
                }, 10);
            }
        });
        
        // Add listener for commission type change
        commissionTypeSelect.addEventListener('change', () => {
            this.renderExceptionCommissionDetails(exceptionIndex, exceptionData);
        });
        
        // Trigger initial population if editing
        if (exceptionData) {
            targetTypeSelect.dispatchEvent(new Event('change'));
        }
        
        // Render initial commission details
        this.renderExceptionCommissionDetails(exceptionIndex, exceptionData);
    }

    private getExceptionValue(exceptionData?: ContractException): string {
        if (!exceptionData) return '';
        
        const config = exceptionData.commissionConfig;
        if (config.type === 'fixed') {
            return config.amount?.toString() || '';
        } else if (config.type === 'percentage') {
            return config.rate?.toString() || '';
        }
        return '';
    }

    private renderExceptionCommissionDetails(exceptionIndex: number, exceptionData?: ContractException) {
        const detailsContainer = this.modalElement.querySelector(`[data-exception-index="${exceptionIndex}"]`) as HTMLElement;
        const commissionTypeSelect = this.modalElement.querySelector(`[name="exception_${exceptionIndex}_commissionType"]`) as HTMLSelectElement;
        
        if (!detailsContainer || !commissionTypeSelect) return;
        
        const commissionType = commissionTypeSelect.value;
        
        if (commissionType === 'fixed') {
            detailsContainer.innerHTML = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Montant fixe (FCFA)</label>
                    <input type="number" 
                           name="exception_${exceptionIndex}_value" 
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           min="0" 
                           step="1" 
                           placeholder="Ex: 500"
                           value="${exceptionData?.commissionConfig.type === 'fixed' ? exceptionData.commissionConfig.amount || '' : ''}"
                           required>
                </div>
            `;
        } else if (commissionType === 'percentage') {
            detailsContainer.innerHTML = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Taux (%)</label>
                    <input type="number" 
                           name="exception_${exceptionIndex}_value" 
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           min="0" 
                           max="100" 
                           step="0.01" 
                           placeholder="Ex: 4"
                           value="${exceptionData?.commissionConfig.type === 'percentage' ? exceptionData.commissionConfig.rate || '' : ''}"
                           required>
                </div>
            `;
        } else if (commissionType === 'tiers') {
            detailsContainer.innerHTML = `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Paliers de commission</label>
                    <div class="exception-tiers-container" data-exception="${exceptionIndex}">
                        <!-- Les paliers seront ajoutés ici -->
                    </div>
                    <button type="button" 
                            class="mt-2 inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 add-exception-tier" 
                            data-exception="${exceptionIndex}">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                        Ajouter un palier
                    </button>
                </div>
            `;
            
            // Add tier button listener
            const addTierBtn = detailsContainer.querySelector('.add-exception-tier') as HTMLButtonElement;
            addTierBtn.addEventListener('click', () => {
                this.addExceptionTier(exceptionIndex);
            });
            
            // Add existing tiers if editing
            if (exceptionData?.commissionConfig.type === 'tiers' && exceptionData.commissionConfig.tiers) {
                exceptionData.commissionConfig.tiers.forEach((tier) => {
                    this.addExceptionTier(exceptionIndex, tier);
                });
            }
        }
    }

    private addExceptionTier(exceptionIndex: number, tierData?: CommissionTier) {
        const tiersContainer = this.modalElement.querySelector(`[data-exception="${exceptionIndex}"]`) as HTMLElement;
        if (!tiersContainer) return;
        
        const tierIndex = tiersContainer.children.length;
        
        const tierDiv = document.createElement('div');
        tierDiv.className = 'grid grid-cols-5 gap-2 items-center p-2 bg-white border rounded mb-2';
        tierDiv.innerHTML = `
            <div>
                <input type="number" 
                       name="exception_${exceptionIndex}_tier_${tierIndex}_from" 
                       class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                       placeholder="1000"
                       min="0" 
                       step="1"
                       value="${tierData?.from || ''}"
                       required>
            </div>
            <div>
                <input type="number" 
                       name="exception_${exceptionIndex}_tier_${tierIndex}_to" 
                       class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                       placeholder="5000"
                       min="0" 
                       step="1"
                       value="${tierData?.to || ''}"
                       required>
            </div>
            <div>
                <select name="exception_${exceptionIndex}_tier_${tierIndex}_type" 
                        class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="fixed" ${tierData?.type === 'fixed' ? 'selected' : ''}>Fixe</option>
                    <option value="percentage" ${tierData?.type === 'percentage' ? 'selected' : ''}>%</option>
                </select>
            </div>
            <div>
                <input type="number" 
                       name="exception_${exceptionIndex}_tier_${tierIndex}_value" 
                       class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                       placeholder="300"
                       min="0" 
                       step="0.01"
                       value="${tierData?.value || ''}"
                       required>
            </div>
            <div class="flex justify-center">
                <button type="button" 
                        class="p-1 text-red-600 hover:text-red-800 focus:outline-none"
                        onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
        
        tiersContainer.appendChild(tierDiv);
    }

    private async handleSubmit() {
        const formData = new FormData(this.form);
        const api = ApiService.getInstance();
        
        try {
            // Build contract object
            const contract: Contract = {
                id: formData.get('id') as string || `contract_${Date.now()}`,
                name: formData.get('name') as string,
                partnerId: formData.get('partnerId') as string,
                status: formData.get('status') as 'active' | 'inactive' | 'expired',
                startDate: new Date().toISOString(),
                endDate: null,
                defaultCommissionConfig: this.buildCommissionConfig(formData),
                exceptions: this.buildExceptions(formData)
            };
            
            // Avertir l'utilisateur si on active un contrat
            if (contract.status === 'active' && (!this.editingContract || this.editingContract.status !== 'active')) {
                // Remplacer la boîte de confirmation par un modal
                this.confirmationModal.show(
                    'Activer le contrat',
                    'Attention : Activer ce contrat désactivera automatiquement tous les autres contrats de ce partenaire.\n\nContinuer ?',
                    async () => {
                        // Si l'utilisateur confirme, continuer avec la sauvegarde
                        await this.saveContract(contract);
                    }
                );
                return;
            }
            
            // Si pas de confirmation nécessaire, sauvegarder directement
            await this.saveContract(contract);
        } catch (error) {
            console.error('Error saving contract:', error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Erreur lors de la sauvegarde du contrat.', type: 'error' }
            }));
        }
    }

    private async saveContract(contract: Contract): Promise<void> {
        await this.api.updateContract(contract);
        this.hide();
        
        if (this.onSave) {
            this.onSave();
        }
    }

    private buildCommissionConfig(formData: FormData): CommissionConfig {
        const partageSociete = parseInt(formData.get('partageSociete') as string) || 60;
        const tiers = this.buildTiers(formData);
        
        return {
            type: 'tiers',
            partageSociete,
            tiers
        };
    }

    private buildTiers(formData: FormData): CommissionTier[] {
        // Renvoie les paliers par défaut car ils ne sont plus modifiables
        return [
            { from: 1000, to: 5000, type: 'fixed', value: 300 },
            { from: 5001, to: 100000, type: 'fixed', value: 500 },
            { from: 100001, to: 999999999, type: 'percentage', value: 1 }
        ];
    }

    private buildExceptions(formData: FormData): ContractException[] {
        const exceptions: ContractException[] = [];
        
        for (let i = 0; i < this.exceptionCounter; i++) {
            const name = formData.get(`exception_${i}_name`) as string;
            const targetType = formData.get(`exception_${i}_targetType`) as 'service' | 'category';
            const targetId = formData.get(`exception_${i}_targetId`) as string;
            const commissionType = formData.get(`exception_${i}_commissionType`) as 'fixed' | 'percentage' | 'tiers';
            const partageSociete = parseInt(formData.get(`exception_${i}_partageSociete`) as string);
            
            if (name && targetType && targetId && commissionType) {
                const commissionConfig: CommissionConfig = {
                    type: commissionType,
                    partageSociete: partageSociete || 50
                };
                
                if (commissionType === 'fixed') {
                    const value = parseFloat(formData.get(`exception_${i}_value`) as string);
                    if (!isNaN(value)) {
                        commissionConfig.amount = value;
                    }
                } else if (commissionType === 'percentage') {
                    const value = parseFloat(formData.get(`exception_${i}_value`) as string);
                    if (!isNaN(value)) {
                        commissionConfig.rate = value;
                    }
                } else if (commissionType === 'tiers') {
                    commissionConfig.tiers = this.buildExceptionTiers(formData, i);
                }
                
                // Only add if we have valid configuration
                if ((commissionType === 'fixed' && commissionConfig.amount !== undefined) ||
                    (commissionType === 'percentage' && commissionConfig.rate !== undefined) ||
                    (commissionType === 'tiers' && commissionConfig.tiers && commissionConfig.tiers.length > 0)) {
                    
                    exceptions.push({
                        name,
                        targetType,
                        targetId,
                        commissionConfig
                    });
                }
            }
        }
        
        return exceptions;
    }

    private buildExceptionTiers(formData: FormData, exceptionIndex: number): CommissionTier[] {
        const tiers: CommissionTier[] = [];
        const tiersContainer = this.modalElement.querySelector(`[data-exception="${exceptionIndex}"]`) as HTMLElement;
        
        if (tiersContainer) {
            for (let i = 0; i < tiersContainer.children.length; i++) {
                const from = parseFloat(formData.get(`exception_${exceptionIndex}_tier_${i}_from`) as string);
                const to = parseFloat(formData.get(`exception_${exceptionIndex}_tier_${i}_to`) as string);
                const type = formData.get(`exception_${exceptionIndex}_tier_${i}_type`) as 'fixed' | 'percentage';
                const value = parseFloat(formData.get(`exception_${exceptionIndex}_tier_${i}_value`) as string);
                
                if (!isNaN(from) && !isNaN(to) && !isNaN(value)) {
                    tiers.push({ from, to, type, value });
                }
            }
        }
        
        return tiers;
    }

    public async show(contract?: Contract) {
        this.editingContract = contract || null;
        this.tierCounter = 0;
        this.exceptionCounter = 0;
        
        // Clear existing tiers and exceptions
        const tiersContainer = $('#tiersContainer', this.modalElement) as HTMLElement;
        const exceptionsContainer = $('#exceptionsContainer', this.modalElement) as HTMLElement;
        
        // Vérifier que les éléments existent avant de tenter de les vider
        if (tiersContainer) {
            tiersContainer.innerHTML = '';
        }
        if (exceptionsContainer) {
            exceptionsContainer.innerHTML = '';
        }
        
        if (contract) {
            // Populate form with contract data
            (this.form.elements.namedItem('id') as HTMLInputElement).value = contract.id;
            (this.form.elements.namedItem('name') as HTMLInputElement).value = contract.name;
            (this.form.elements.namedItem('partnerId') as HTMLSelectElement).value = contract.partnerId;
            (this.form.elements.namedItem('status') as HTMLSelectElement).value = contract.status;
            
            // Populate commission config
            if (contract.defaultCommissionConfig) {
                const config = contract.defaultCommissionConfig;
                (this.form.elements.namedItem('partageSociete') as HTMLInputElement).value = (config.partageSociete || 60).toString();
                
                // Populate tiers
                if (config.tiers && config.tiers.length > 0) {
                    config.tiers.forEach((tier) => {
                        this.addTier(tier.from, tier.to, tier.type, tier.value);
                    });
                } else {
                    this.addDefaultTiers();
                }
            } else {
                this.addDefaultTiers();
            }
            
            // Populate exceptions
            if (contract.exceptions && contract.exceptions.length > 0) {
                contract.exceptions.forEach((exception) => {
                    this.addException(exception);
                });
            }
        } else {
            // Reset form for new contract
            this.form.reset();
            (this.form.elements.namedItem('status') as HTMLSelectElement).value = 'active';
            (this.form.elements.namedItem('partageSociete') as HTMLInputElement).value = '60';
            this.addDefaultTiers();
        }
        
        super.show();
    }
}