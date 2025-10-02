import { BaseModal } from "./BaseModal";
import { RechargePaymentMethod } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminEditRechargeMethodModal extends BaseModal {
    private form: HTMLFormElement;
    private feeValueContainer: HTMLElement;
    private editingMethod: RechargePaymentMethod | null = null;

    constructor() {
        super('adminEditRechargeMethodModal');
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.feeValueContainer = $('#feeValueContainer', this.modalElement) as HTMLElement;

        this.attachListeners();
    }

    private render() {
        const title = "Éditer le Mode de Paiement"; // Title will be updated in show()
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="editRechargeMethodForm">
                <input type="hidden" id="methodId" name="id">
                <div class="space-y-4">
                    <div>
                        <label class="form-label" for="methodName">Nom du mode de paiement</label>
                        <input type="text" id="methodName" name="name" class="form-input" required>
                    </div>
                     <div>
                        <label class="form-label" for="methodStatus">Statut</label>
                        <select id="methodStatus" name="status" class="form-select" required>
                            <option value="active">Actif</option>
                            <option value="inactive">Inactif</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="methodFeeType">Type de Frais</label>
                        <select id="methodFeeType" name="feeType" class="form-select" required>
                            <option value="none">Aucun</option>
                            <option value="fixed">Fixe</option>
                            <option value="percentage">Pourcentage</option>
                        </select>
                    </div>
                    <div id="feeValueContainer" class="hidden">
                        <label class="form-label" for="methodFeeValue">Valeur du Frais</label>
                        <input type="number" step="0.01" id="methodFeeValue" name="feeValue" class="form-input">
                    </div>
                </div>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="editRechargeMethodForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(method?: RechargePaymentMethod) {
        this.editingMethod = method || null;
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = this.editingMethod ? `Éditer: ${this.editingMethod.name}` : "Créer un Nouveau Mode de Paiement";
        }
    }

    private populateForm() {
        this.form.reset();
        ($('#methodId', this.form) as HTMLInputElement).value = this.editingMethod?.id || '';
        ($('#methodName', this.form) as HTMLInputElement).value = this.editingMethod?.name || '';
        ($('#methodStatus', this.form) as HTMLSelectElement).value = this.editingMethod?.status || 'active';
        ($('#methodFeeType', this.form) as HTMLSelectElement).value = this.editingMethod?.feeType || 'none';
        ($('#methodFeeValue', this.form) as HTMLInputElement).value = String(this.editingMethod?.feeValue || 0);
        
        // Trigger change event to show/hide the fee value input
        $('#methodFeeType', this.form)?.dispatchEvent(new Event('change'));
    }

    private attachListeners() {
        $('#methodFeeType', this.form)?.addEventListener('change', (e) => {
            const type = (e.target as HTMLSelectElement).value;
            this.feeValueContainer.classList.toggle('hidden', type === 'none');
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(this.form);
            const data: Partial<RechargePaymentMethod> = {
                id: formData.get('id') as string || '', // Empty string for new items
                name: formData.get('name') as string,
                status: formData.get('status') as 'active' | 'inactive',
                feeType: formData.get('feeType') as 'none' | 'fixed' | 'percentage',
                feeValue: parseFloat(formData.get('feeValue') as string) || 0
            };

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                
                // Check for duplicates only when creating new items
                if (!data.id || data.id === '') {
                    const existingMethods = await api.getRechargePaymentMethods();
                    const duplicate = existingMethods.find(method => 
                        method.name.toLowerCase().trim() === data.name!.toLowerCase().trim()
                    );
                    
                    if (duplicate) {
                        document.body.dispatchEvent(new CustomEvent('showToast', { 
                            detail: { message: `Une méthode avec le nom "${data.name}" existe déjà.`, type: 'warning' } 
                        }));
                        return;
                    }
                }
                
                await api.updateRechargePaymentMethod(data as RechargePaymentMethod);
                // Dispatch a global event to notify the view to re-render
                document.body.dispatchEvent(new CustomEvent('rechargeMethodsUpdated'));
                this.hide();
                
                document.body.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: 'Méthode de recharge sauvegardée avec succès.', type: 'success' } 
                }));
            } catch (error) {
                console.error("Failed to save recharge method", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}