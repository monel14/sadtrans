import { BaseModal } from "./BaseModal";
import { Agency } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";
import { formatAmount } from "../../utils/formatters";

export class AdminAdjustBalanceModal extends BaseModal {
    private form: HTMLFormElement;
    private agency: Agency | null = null;

    constructor() {
        super('adminAdjustBalanceModal');
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Ajuster le Solde de l'Agence";
        const body = document.createElement('div');
        body.innerHTML = `
            <div class="p-4 mb-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p class="text-sm text-slate-500">Agence</p>
                <p id="agencyNameDisplay" class="font-bold text-lg text-slate-800">-</p>
                <p class="text-sm text-slate-500 mt-2">Solde Actuel</p>
                <p id="currentBalanceDisplay" class="font-bold text-lg text-emerald-600">-</p>
            </div>
            <form id="adjustBalanceForm" novalidate>
                <div class="space-y-4">
                    <div>
                        <label class="form-label">Type d'opération</label>
                        <div class="flex gap-4">
                            <label class="flex items-center">
                                <input type="radio" name="adjustmentType" value="credit" class="mr-2" checked> Crédit (Ajouter au solde)
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="adjustmentType" value="debit" class="mr-2"> Débit (Retirer du solde)
                            </label>
                        </div>
                    </div>
                    <div>
                        <label class="form-label" for="adjustmentAmount">Montant</label>
                        <input type="number" id="adjustmentAmount" name="amount" class="form-input" required min="1" placeholder="Ex: 50000">
                    </div>
                    <div>
                        <label class="form-label" for="adjustmentReason">Motif (obligatoire)</label>
                        <textarea id="adjustmentReason" name="reason" class="form-textarea" rows="3" required placeholder="Ex: Correction d'erreur, Dépôt initial..."></textarea>
                    </div>
                </div>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="adjustBalanceForm" class="btn btn-primary"><i class="fas fa-check-circle mr-2"></i>Confirmer l'Ajustement</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(agency: Agency) {
        this.agency = agency;
        this.populateInfo();
        super.show();
    }

    private populateInfo() {
        this.form.reset();
        if (!this.agency) return;

        ($('#agencyNameDisplay', this.modalElement) as HTMLElement).textContent = this.agency.name;
        ($('#currentBalanceDisplay', this.modalElement) as HTMLElement).textContent = formatAmount(this.agency.solde_principal);
    }

    private attachListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.form.checkValidity() || !this.agency) {
                this.form.reportValidity();
                return;
            }

            const formData = new FormData(this.form);
            const type = formData.get('adjustmentType') as 'credit' | 'debit';
            const amount = parseFloat(formData.get('amount') as string);
            const reason = formData.get('reason') as string;

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Confirmation...`;

            try {
                const api = ApiService.getInstance();
                await api.adjustAgencyBalance(this.agency.id, type, amount, reason);
                document.body.dispatchEvent(new CustomEvent('agencyBalanceUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Solde de l'agence "${this.agency.name}" mis à jour.`, type: 'success' } }));
                this.hide();
            } catch (error) {
                console.error("Failed to adjust balance", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: `L'ajustement du solde a échoué.`, type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}