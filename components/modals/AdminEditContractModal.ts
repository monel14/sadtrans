import { BaseModal } from "./BaseModal";
import { Contract, Partner, CommissionProfile, OperationType, ContractException, CommissionConfig, CommissionTier } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminEditContractModal extends BaseModal {
    private form: HTMLFormElement;
    private editingContract: Contract | null = null;
    private partners: Partner[];
    private commissionProfiles: CommissionProfile[];
    private operationTypes: OperationType[];
    private exceptionCounter = 0;

    constructor(partners: Partner[], commissionProfiles: CommissionProfile[], operationTypes: OperationType[]) {
        super('adminEditContractModal', { size: 'xl' });
        this.partners = partners;
        this.commissionProfiles = commissionProfiles;
        this.operationTypes = operationTypes;
        
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Éditer le Contrat Partenaire";
        
        const partnerOptions = this.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        const profileOptions = this.commissionProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        const body = document.createElement('div');
        body.innerHTML = `
            <form id="editContractForm" novalidate>
                <input type="hidden" name="id">
                
                <h4 class="text-lg font-semibold text-slate-700 mb-2">Informations Générales</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-slate-50">
                    <div>
                        <label class="form-label" for="contractName">Nom du contrat</label>
                        <input type="text" id="contractName" name="name" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="contractPartnerId">Partenaire</label>
                        <select id="contractPartnerId" name="partnerId" class="form-select" required>
                            <option value="">-- Sélectionner --</option>
                            ${partnerOptions}
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="contractBaseProfileId">Profil de commission de base</label>
                        <select id="contractBaseProfileId" name="baseCommissionProfileId" class="form-select" required>
                            <option value="">-- Sélectionner --</option>
                            ${profileOptions}
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="contractStartDate">Date de début</label>
                        <input type="date" id="contractStartDate" name="startDate" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="contractEndDate">Date de fin (optionnel)</label>
                        <input type="date" id="contractEndDate" name="endDate" class="form-input">
                    </div>
                    <div>
                        <label class="form-label" for="contractStatus">Statut</label>
                        <select id="contractStatus" name="status" class="form-select" required>
                            <option value="draft">Brouillon</option>
                            <option value="active">Actif</option>
                            <option value="expired">Expiré</option>
                        </select>
                    </div>
                </div>

                <h4 class="font-semibold text-slate-700 mt-6 mb-2">Avenants & Exceptions</h4>
                <div id="exceptions-container" class="space-y-3">
                    <!-- Dynamic exception rows -->
                </div>
                <button type="button" id="add-exception-btn" class="btn btn-sm btn-outline-secondary mt-3"><i class="fas fa-plus mr-2"></i>Ajouter une exception</button>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="editContractForm" class="btn btn-primary"><i class="fas fa-save mr-2"></i>Enregistrer le Contrat</button>
        `;

        this.setContent(title, body, footer);
    }
    
    public show(contract?: Contract) {
        this.editingContract = contract || null;
        this.updateTitle();
        this.populateForm();
        super.show();
    }
    
    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = this.editingContract ? `Éditer: ${this.editingContract.name}` : "Créer un Nouveau Contrat Partenaire";
        }
    }
    
    private populateForm() {
        this.form.reset();
        const exceptionsContainer = $('#exceptions-container', this.form) as HTMLElement;
        exceptionsContainer.innerHTML = '';
        this.exceptionCounter = 0;

        if (!this.editingContract) {
            // Set defaults for a new contract
            ($('#contractStatus', this.form) as HTMLSelectElement).value = 'draft';
            return;
        }

        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = this.editingContract.id;
        ($('#contractName', this.form) as HTMLInputElement).value = this.editingContract.name;
        ($('#contractPartnerId', this.form) as HTMLSelectElement).value = this.editingContract.partnerId;
        ($('#contractBaseProfileId', this.form) as HTMLSelectElement).value = this.editingContract.baseCommissionProfileId;
        ($('#contractStatus', this.form) as HTMLSelectElement).value = this.editingContract.status;
        
        // Safely handle startDate
        if (this.editingContract.startDate) {
            ($('#contractStartDate', this.form) as HTMLInputElement).value = this.editingContract.startDate.split('T')[0];
        }
        
        // Safely handle endDate
        if (this.editingContract.endDate) {
            ($('#contractEndDate', this.form) as HTMLInputElement).value = this.editingContract.endDate.split('T')[0];
        }

        this.editingContract.exceptions.forEach(ex => this.addExceptionRow(ex));
    }
    
    private addExceptionRow(exception?: ContractException) {
        this.exceptionCounter++;
        const exId = this.exceptionCounter;
        const exRow = document.createElement('div');
        exRow.className = 'exception-row border p-3 rounded-lg bg-white';
        exRow.dataset.exId = String(exId);

        exRow.innerHTML = `
            <div class="grid grid-cols-12 gap-x-4 gap-y-2">
                <!-- Row 1: Type and Target Selection -->
                <div class="col-span-12 md:col-span-3">
                    <label class="form-label form-label-sm">Type d'exception</label>
                    <select name="exType_${exId}" class="form-select form-select-sm" required>
                        <option value="service" ${exception?.targetType === 'service' ? 'selected' : ''}>Service Spécifique</option>
                        <option value="category" ${exception?.targetType === 'category' ? 'selected' : ''}>Catégorie de Services</option>
                    </select>
                </div>
                <div class="col-span-12 md:col-span-8">
                    <label class="form-label form-label-sm">Service / Catégorie Cible</label>
                    <select name="exTargetId_${exId}" class="form-select form-select-sm" required></select>
                </div>
                <div class="col-span-12 md:col-span-1 flex items-end">
                    <button type="button" class="btn btn-sm btn-danger w-full" data-action="remove-exception"><i class="fas fa-trash-alt"></i></button>
                </div>

                <!-- Row 2: Commission Config -->
                <div class="col-span-12"><hr class="my-2"></div>
                <div class="col-span-12 md:col-span-3">
                    <label class="form-label form-label-sm">Part Société (%)</label>
                    <input type="number" min="0" max="100" name="exPartage_${exId}" class="form-input form-input-sm" value="${exception?.commissionConfig.partageSociete || 50}">
                </div>
                <div class="col-span-12 md:col-span-9">
                    <p class="form-label form-label-sm mb-1">Frais Spécifiques (laisser vide pour ne pas surcharger)</p>
                    <div class="grid grid-cols-3 gap-2">
                        <input type="number" step="0.01" name="exTierFrom_${exId}" class="form-input form-input-sm" placeholder="De (XOF)">
                        <input type="number" step="0.01" name="exTierTo_${exId}" class="form-input form-input-sm" placeholder="À (XOF)">
                        <input type="number" step="0.01" name="exTierValue_${exId}" class="form-input form-input-sm" placeholder="Frais Fixe (XOF)">
                    </div>
                </div>
            </div>
        `;

        const typeSelect = exRow.querySelector(`select[name="exType_${exId}"]`) as HTMLSelectElement;
        const targetSelect = exRow.querySelector(`select[name="exTargetId_${exId}"]`) as HTMLSelectElement;

        const updateTargetOptions = () => {
            targetSelect.innerHTML = '';
            const type = typeSelect.value;
            if (type === 'service') {
                this.operationTypes
                    .filter(o => o.status === 'active')
                    .sort((a,b) => a.name.localeCompare(b.name))
                    .forEach(o => targetSelect.add(new Option(o.name, o.id)));
            } else if (type === 'category') {
                const categories = [...new Set(this.operationTypes.map(o => o.category).filter(Boolean))] as string[];
                categories.sort().forEach(c => targetSelect.add(new Option(c, c)));
            }
             if (exception) {
                targetSelect.value = exception.targetId;
            }
        };

        typeSelect.addEventListener('change', updateTargetOptions);
        updateTargetOptions();

        $('#exceptions-container', this.form)?.appendChild(exRow);
    }
    
    private attachListeners() {
        $('#add-exception-btn', this.form)?.addEventListener('click', () => this.addExceptionRow());

        $('#exceptions-container', this.form)?.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest<HTMLButtonElement>('[data-action="remove-exception"]');
            if (removeBtn) {
                removeBtn.closest('.exception-row')?.remove();
            }
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.form.checkValidity()) {
                this.form.reportValidity();
                return;
            }
            
            const exceptions: ContractException[] = [];
            this.form.querySelectorAll('.exception-row').forEach(row => {
                 const exId = (row as HTMLElement).dataset.exId;
                 const targetType = (row.querySelector(`select[name="exType_${exId}"]`) as HTMLSelectElement).value as 'service' | 'category';
                 const targetSelect = (row.querySelector(`select[name="exTargetId_${exId}"]`) as HTMLSelectElement);
                 const targetId = targetSelect.value;
                 const name = targetSelect.options[targetSelect.selectedIndex].text;

                 const from = (row.querySelector(`input[name="exTierFrom_${exId}"]`) as HTMLInputElement).value;
                 const to = (row.querySelector(`input[name="exTierTo_${exId}"]`) as HTMLInputElement).value;
                 const val = (row.querySelector(`input[name="exTierValue_${exId}"]`) as HTMLInputElement).value;
                
                 let commissionConfig: CommissionConfig = {
                     type: 'tiers',
                     partageSociete: parseInt((row.querySelector(`input[name="exPartage_${exId}"]`) as HTMLInputElement).value, 10),
                     tiers: []
                 };

                 // For simplicity, this example only handles one tier override per exception
                 if(from && val) {
                     commissionConfig.tiers?.push({
                         from: parseFloat(from),
                         to: to ? parseFloat(to) : Infinity,
                         type: 'fixed',
                         value: parseFloat(val)
                     });
                 }

                exceptions.push({ targetType, targetId, name, commissionConfig });
            });

            const formData = new FormData(this.form);
            const contractData: Contract = {
                id: formData.get('id') as string,
                name: formData.get('name') as string,
                partnerId: formData.get('partnerId') as string,
                baseCommissionProfileId: formData.get('baseCommissionProfileId') as string,
                status: formData.get('status') as 'active' | 'draft' | 'expired',
                startDate: new Date(formData.get('startDate') as string).toISOString(),
                endDate: formData.get('endDate') ? new Date(formData.get('endDate') as string).toISOString() : null,
                exceptions: exceptions,
            };

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                await api.updateContract(contractData);
                document.body.dispatchEvent(new CustomEvent('contractsUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Contrat enregistré avec succès !", type: 'success' } }));
                this.hide();
            } catch (error) {
                 console.error("Failed to save contract", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}