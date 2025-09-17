import { BaseModal } from "./BaseModal";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminRejectRechargeModal extends BaseModal {
    private form: HTMLFormElement;
    private requestId: string | null = null;

    constructor() {
        super('adminRejectRechargeModal');
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Rejeter la Demande de Recharge";
        const body = document.createElement('div');
        body.innerHTML = `
            <p class="text-sm text-slate-600 mb-4">Veuillez fournir une raison claire pour le rejet. Cette note sera enregistrée et pourra être consultée par l'agent.</p>
            <form id="rejectRechargeForm">
                <div>
                    <label class="form-label" for="rejectionReason">Motif du rejet (obligatoire)</label>
                    <textarea id="rejectionReason" name="reason" class="form-textarea" rows="3" required placeholder="Ex: Le montant ne correspond pas au versement, référence de transaction invalide..."></textarea>
                </div>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="rejectRechargeForm" class="btn btn-danger"><i class="fas fa-times-circle mr-2"></i>Confirmer le Rejet</button>
        `;
        this.setContent(title, body, footer);
    }

    public show(requestId: string) {
        this.requestId = requestId;
        this.form.reset();
        super.show();
        (this.form.querySelector('#rejectionReason') as HTMLTextAreaElement)?.focus();
    }

    private attachListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reason = (this.form.querySelector('#rejectionReason') as HTMLTextAreaElement).value.trim();
            if (!this.requestId || !reason) {
                return;
            }

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Rejet en cours...`;

            try {
                const api = ApiService.getInstance();
                const success = await api.updateAgentRechargeRequestStatus(this.requestId, 'Rejetée', reason);

                if (success) {
                    document.body.dispatchEvent(new CustomEvent('rechargeRequestUpdated', { bubbles: true, composed: true }));
                    document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Demande de recharge rejetée.", type: 'success' } }));
                    this.hide();
                } else {
                    throw new Error("API call failed");
                }
            } catch (error) {
                console.error("Failed to reject recharge request:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur est survenue.", type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalHtml;
            }
        });
    }
}
