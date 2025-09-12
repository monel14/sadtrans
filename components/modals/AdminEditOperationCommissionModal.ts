
import { BaseModal } from "./BaseModal";
import { OperationType, CommissionTier } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminEditOperationCommissionModal extends BaseModal {
    private form: HTMLFormElement;
    private editingOperation: OperationType | null = null;
    private tierCounter = 0;

    constructor() {
        super('adminEditOperationCommissionModal', { size: 'lg' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Éditer les Frais du Service";
        const body = document.createElement('div');
        body.innerHTML = `
            <h4 id="opCommOpName" class="text-lg font-semibold text-slate-800 mb-4"></h4>
            <form id="editOpCommForm" novalidate>
                <input type="hidden" name="id">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="opCommPartageSociete">Part de la Société (%)</label>
                        <input type="number" id="opCommPartageSociete" name="partageSociete" class="form-input" required min="0" max="100" placeholder="Ex: 40">
                    </div>
                    <div>
                        <label class="form-label" for="opCommFeeApplication">Logique des Frais</label>
                        <select id="opCommFeeApplication" name="feeApplication" class="form-select">
                            <option value="additive">Additive (Frais ajoutés au montant)</option>
                            <option value="inclusive">Inclusive (Frais déduits du montant)</option>
                        </select>
                        <p class="text-xs text-slate-500 mt-1">Additive: Total = Montant + Frais. Inclusive: Total = Montant (frais inclus).</p>
                    </div>
                </div>
                
                <div id="opCommTiersWrapper">
                    <h4 class="font-semibold text-slate-700 mt-6 mb-2">Paliers de Frais de Service</h4>
                    <p class="text-xs text-slate-500 mb-3">Définit les frais de service basés sur des tranches de montant pour cette opération.</p>
                    <div id="opComm-tiers-container" class="space-y-2 border-b pb-3">
                        <!-- Dynamic tier rows -->
                    </div>
                    <button type="button" id="opComm-add-tier-btn" class="btn btn-sm btn-outline-secondary mt-3"><i class="fas fa-plus mr-2"></i>Ajouter un palier</button>
                </div>
                 <div id="opCommNonTiersNote" class="hidden mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-800 text-sm">
                    <i class="fas fa-info-circle mr-2"></i>Pour ce service, les frais sont un <strong>pourcentage</strong> ou un <strong>montant fixe</strong>. Ces valeurs sont gérées directement dans la configuration avancée du service et ne sont pas modifiables ici. Seule la part de la société peut être ajustée.
                </div>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="editOpCommForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(operation: OperationType) {
        this.editingOperation = operation;
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const opNameEl = $('#opCommOpName', this.modalElement);
        if (opNameEl) {
            opNameEl.textContent = this.editingOperation?.name || "Service Inconnu";
        }
    }

    private addTierRow(tier?: CommissionTier) {
        this.tierCounter++;
        const tierRow = document.createElement('div');
        tierRow.className = 'tier-row grid grid-cols-12 gap-2 items-center';
        tierRow.dataset.tierId = String(this.tierCounter);

        tierRow.innerHTML = `
            <div class="col-span-3">
                <input type="number" name="from_${this.tierCounter}" class="form-input form-input-sm" placeholder="De (XOF)" value="${tier?.from || ''}" required>
            </div>
            <div class="col-span-3">
                <input type="number" name="to_${this.tierCounter}" class="form-input form-input-sm" placeholder="À (XOF)" value="${tier?.to === Infinity ? '' : tier?.to || ''}">
            </div>
            <div class="col-span-3">
                <select name="type_${this.tierCounter}" class="form-select form-select-sm" required>
                    <option value="fixed" ${tier?.type === 'fixed' ? 'selected' : ''}>Fixe (XOF)</option>
                    <option value="percentage" ${tier?.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
                </select>
            </div>
            <div class="col-span-2">
                <input type="number" step="0.01" name="value_${this.tierCounter}" class="form-input form-input-sm" placeholder="Valeur" value="${tier?.value || ''}" required>
            </div>
            <div class="col-span-1 text-right">
                 <button type="button" class="btn btn-xs btn-danger" data-action="remove-tier"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        $('#opComm-tiers-container', this.form)?.appendChild(tierRow);
    }

    private populateForm() {
        this.form.reset();
        const tiersContainer = $('#opComm-tiers-container', this.form) as HTMLElement;
        tiersContainer.innerHTML = '';
        this.tierCounter = 0;

        if (!this.editingOperation) return;

        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = this.editingOperation.id;
        ($('#opCommPartageSociete', this.form) as HTMLInputElement).value = String(this.editingOperation.commissionConfig?.partageSociete || 40);
        ($('#opCommFeeApplication', this.form) as HTMLSelectElement).value = this.editingOperation.feeApplication || 'additive';
        
        const isTiersType = this.editingOperation.commissionConfig.type === 'tiers';
        $('#opCommTiersWrapper', this.form)?.classList.toggle('hidden', !isTiersType);
        $('#opCommNonTiersNote', this.form)?.classList.toggle('hidden', isTiersType);
        
        if (isTiersType) {
            const tiers = this.editingOperation.commissionConfig.tiers || [];
            if (tiers.length > 0) {
                tiers.forEach(tier => this.addTierRow(tier));
            } else {
                this.addTierRow();
            }
        }
    }

    private attachListeners() {
        $('#opComm-add-tier-btn', this.form)?.addEventListener('click', () => this.addTierRow());

        $('#opComm-tiers-container', this.form)?.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest<HTMLButtonElement>('[data-action="remove-tier"]');
            if (removeBtn) {
                removeBtn.closest('.tier-row')?.remove();
            }
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.editingOperation) return;

            const newTiers: CommissionTier[] = [];
            if(this.editingOperation.commissionConfig.type === 'tiers') {
                this.form.querySelectorAll('.tier-row').forEach(row => {
                    const id = (row as HTMLElement).dataset.tierId;
                    const from = parseInt((row.querySelector(`input[name="from_${id}"]`) as HTMLInputElement).value, 10);
                    const toStr = (row.querySelector(`input[name="to_${id}"]`) as HTMLInputElement).value;
                    const to = toStr ? parseInt(toStr, 10) : Infinity;
                    
                    newTiers.push({
                        from: from,
                        to: to,
                        type: (row.querySelector(`select[name="type_${id}"]`) as HTMLSelectElement).value as 'fixed' | 'percentage',
                        value: parseFloat((row.querySelector(`input[name="value_${id}"]`) as HTMLInputElement).value)
                    });
                });
            }

            const updatedOperation: OperationType = {
                ...this.editingOperation,
                feeApplication: ($('#opCommFeeApplication', this.form) as HTMLSelectElement).value as 'additive' | 'inclusive',
                commissionConfig: {
                    ...this.editingOperation.commissionConfig,
                    partageSociete: parseInt(($('#opCommPartageSociete', this.form) as HTMLInputElement).value, 10),
                    tiers: this.editingOperation.commissionConfig.type === 'tiers' ? newTiers : this.editingOperation.commissionConfig.tiers,
                }
            };
            
            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                await api.updateOperationType(updatedOperation);
                document.body.dispatchEvent(new CustomEvent('operationTypeUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Frais du service mis à jour !", type: 'success' } }));
                this.hide();
            } catch (error) {
                console.error("Failed to save operation type commission", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}