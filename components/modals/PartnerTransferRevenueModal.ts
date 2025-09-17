import { BaseModal } from "./BaseModal";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";
import { formatAmount } from "../../utils/formatters";
import { User } from "../../models";

export class PartnerTransferRevenueModal extends BaseModal {
    private userId: string | null = null;
    private amount: number = 0;

    constructor() {
        super('partnerTransferRevenueModal');
        this.render();
        this.attachListeners();
    }

    private render() {
        const title = "Confirmer le Transfert de Revenus";
        const body = document.createElement('div');
        body.id = 'transferRevenueBody';
        body.innerHTML = `<p class="text-slate-600">Chargement...</p>`;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button id="confirmTransferBtn" class="btn btn-primary"><i class="fas fa-exchange-alt mr-2"></i>Confirmer le Transfert</button>
        `;
        this.setContent(title, body, footer);
    }

    public show(userId: string, amount: number) {
        this.userId = userId;
        this.amount = amount;
        
        const body = $('#transferRevenueBody', this.modalElement);
        if (body) {
            body.innerHTML = `
                <p class="text-slate-600 text-center">Voulez-vous vraiment transférer la totalité de votre solde de revenus vers votre solde principal ?</p>
                <div class="my-4 p-4 bg-violet-50 border border-violet-200 rounded-lg text-center">
                    <p class="text-sm text-violet-700">Montant à transférer</p>
                    <p class="text-3xl font-bold text-violet-600">${formatAmount(this.amount)}</p>
                </div>
                <p class="text-xs text-center text-amber-600 bg-amber-100 p-2 rounded-md"><i class="fas fa-exclamation-triangle mr-1"></i>Cette action est irréversible.</p>
            `;
        }

        super.show();
    }

    private attachListeners() {
        $('#confirmTransferBtn', this.modalElement)?.addEventListener('click', async () => {
            if (!this.userId) return;

            const submitButton = this.modalElement.querySelector('#confirmTransferBtn') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Transfert en cours...`;

            try {
                const api = ApiService.getInstance();
                const updatedUser = await api.transferRevenueToMainBalance(this.userId);

                if (updatedUser) {
                    document.body.dispatchEvent(new CustomEvent('revenueTransferred', {
                        detail: { user: updatedUser },
                        bubbles: true,
                        composed: true
                    }));
                    this.hide();
                } else {
                    throw new Error("API did not return updated user.");
                }

            } catch (error) {
                console.error("Transfer failed", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Le transfert a échoué. Veuillez réessayer.', type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalHtml;
            }
        });
    }
}
