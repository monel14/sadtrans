import { BaseModal } from "./BaseModal";
import { User, RechargePaymentMethod } from "../../models";
import { ApiService } from "../../services/api.service";
import { $ } from "../../utils/dom";
import { formatAmount } from "../../utils/formatters";

export class PartnerRequestRechargeModal extends BaseModal {
    private form: HTMLFormElement | null = null;
    private currentUser: User | null = null;
    private paymentMethods: RechargePaymentMethod[] = [];

    constructor() {
        super('partnerRequestRechargeModal', { size: 'lg' });
        this.render();
        this.attachEventListeners();
    }

    private render() {
        const title = "Demande de Recharge de Solde";
        const body = document.createElement('div');
        body.innerHTML = `
            <p class="text-sm text-slate-600 mb-4">Votre demande sera envoyée à l'administrateur pour approbation. Veuillez spécifier comment vous avez effectué le versement correspondant.</p>
            <form id="partnerRechargeForm" class="opacity-50 pointer-events-none">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label class="form-label" for="rechargePaymentMethod">Liste des modes de paiement <span class="text-red-500">*</span></label>
                        <select id="rechargePaymentMethod" class="form-select mt-1" required>
                            <option value="">Chargement des options...</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="rechargeAmount">Montant du dépôt <span class="text-red-500">*</span></label>
                        <input type="number" id="rechargeAmount" class="form-input mt-1" min="1" required placeholder="Montant du dépôt">
                    </div>
                     <div>
                        <label class="form-label" for="rechargeReference">ID de Transaction / Référence</label>
                        <input type="text" id="rechargeReference" class="form-input mt-1" placeholder="Optionnel">
                    </div>
                    
                    <!-- New Calculation Summary -->
                    <div id="rechargeCalculationSummary" class="md:col-span-2 mt-2 p-4 border-l-4 border-violet-500 bg-violet-50 space-y-2 hidden">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">Montant du dépôt :</span>
                            <span id="summaryAmount" class="font-medium text-slate-800">0 XOF</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">Frais de transaction <span id="summaryFeeDetails" class="text-xs text-slate-500 font-mono"></span> :</span>
                            <span id="summaryFees" class="font-medium text-red-600">- 0 XOF</span>
                        </div>
                        <div class="border-t my-2 border-violet-200"></div>
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Total à recevoir :</span>
                            <span id="summaryTotal" class="font-bold text-lg text-emerald-700">0 XOF</span>
                        </div>
                    </div>
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="partnerRechargeForm" class="btn btn-primary">Enregistrer et Soumettre</button>
        `;

        this.setContent(title, body, footer);
        this.form = $('#partnerRechargeForm', this.modalElement) as HTMLFormElement;
    }

    public async show(user: User) {
        this.currentUser = user;
        this.form?.reset();
        // Reset submission state when opening modal
        this.isSubmitting = false;
        this.lastSubmissionTime = 0;
        await this.loadPaymentMethods();
        this.updateCalculations();
        // Ensure form is enabled after loading
        this.enableForm();
        super.show();
    }

    private async loadPaymentMethods() {
        if (!this.form) return;
        this.disableForm();
        const select = $('#rechargePaymentMethod', this.form) as HTMLSelectElement;
        select.innerHTML = '<option value="">Chargement...</option>';

        try {
            const api = ApiService.getInstance();
            this.paymentMethods = await api.getRechargePaymentMethods({ status: 'active' });

            select.innerHTML = '<option value="">Sélectionnez le mode de paiement</option>';
            this.paymentMethods.forEach(method => {
                select.add(new Option(method.name, method.id));
            });
            this.enableForm();
        } catch (error) {
            select.innerHTML = '<option value="">Erreur de chargement</option>';
            console.error("Failed to load payment methods:", error);
            this.enableForm(); // Ensure form is enabled even on error
        }
    }

    private updateCalculations() {
        if (!this.form) return;
        const amountInput = $('#rechargeAmount', this.form) as HTMLInputElement;
        const methodSelect = $('#rechargePaymentMethod', this.form) as HTMLSelectElement;

        // Summary elements
        const summaryContainer = $('#rechargeCalculationSummary', this.form) as HTMLElement;
        const summaryAmount = $('#summaryAmount', this.form) as HTMLElement;
        const summaryFeeDetails = $('#summaryFeeDetails', this.form) as HTMLElement;
        const summaryFees = $('#summaryFees', this.form) as HTMLElement;
        const summaryTotal = $('#summaryTotal', this.form) as HTMLElement;

        const amount = parseFloat(amountInput.value) || 0;
        const selectedMethod = this.paymentMethods.find(m => m.id === methodSelect.value);

        if (amount <= 0 || !selectedMethod) {
            summaryContainer.classList.add('hidden');
            return;
        }
        summaryContainer.classList.remove('hidden');

        let fees = 0;
        let feeDetailsText = '';

        if (selectedMethod) {
            if (selectedMethod.feeType === 'fixed') {
                fees = selectedMethod.feeValue;
                feeDetailsText = `(Fixe)`;
            } else if (selectedMethod.feeType === 'percentage') {
                fees = (amount * selectedMethod.feeValue) / 100;
                feeDetailsText = `(${selectedMethod.feeValue}%)`;
            }
        }

        fees = Math.round(fees);
        const amountToReceive = amount - fees;

        summaryAmount.textContent = formatAmount(amount);
        summaryFeeDetails.textContent = feeDetailsText;
        summaryFees.textContent = `- ${formatAmount(fees)}`;
        summaryTotal.textContent = formatAmount(amountToReceive);
    }

    // Variables to prevent double submission
    private isSubmitting = false;
    private lastSubmissionTime = 0;

    private enableForm() {
        if (this.form) {
            this.form.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    private disableForm() {
        if (this.form) {
            this.form.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    private resetFormAfterSuccess() {
        if (!this.form) return;

        // Clear form inputs
        const amountInput = $('#rechargeAmount', this.form) as HTMLInputElement;
        const referenceInput = $('#rechargeReference', this.form) as HTMLInputElement;

        if (amountInput) amountInput.value = '';
        if (referenceInput) referenceInput.value = '';

        // Hide calculation summary
        const summaryContainer = $('#rechargeCalculationSummary', this.form) as HTMLElement;
        if (summaryContainer) summaryContainer.classList.add('hidden');

        // Reset payment method selection to default
        const paymentMethodSelect = $('#rechargePaymentMethod', this.form) as HTMLSelectElement;
        if (paymentMethodSelect) paymentMethodSelect.selectedIndex = 0;

        console.log('Form reset after successful submission');
    }

    private attachEventListeners() {
        if (this.form) {
            $('#rechargeAmount', this.form)?.addEventListener('input', () => this.updateCalculations());
            $('#rechargePaymentMethod', this.form)?.addEventListener('change', () => this.updateCalculations());
        }

        this.form?.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Prevent double submission
            const now = Date.now();
            if (this.isSubmitting) {
                console.log('Recharge submission already in progress, ignoring duplicate click');
                return;
            }

            // Prevent rapid successive clicks (minimum 2 seconds between submissions)
            if (now - this.lastSubmissionTime < 2000) {
                console.log('Too soon after last recharge submission, ignoring click');
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Veuillez patienter avant de soumettre à nouveau.', type: 'warning' }
                }));
                return;
            }

            this.lastSubmissionTime = now;

            if (!this.currentUser || !this.form) {
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Erreur: Utilisateur non identifié.", type: 'error' } }));
                return;
            }

            // Ensure form is enabled before reading values
            this.enableForm();

            // Get fresh references to form elements and read their current values
            const amountInput = $('#rechargeAmount', this.form) as HTMLInputElement;
            const paymentMethodInput = $('#rechargePaymentMethod', this.form) as HTMLSelectElement;
            const referenceInput = $('#rechargeReference', this.form) as HTMLInputElement;
            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;

            // Read values immediately after ensuring form is enabled
            const montant = parseFloat(amountInput.value);
            const methodId = paymentMethodInput.value;
            const reference = referenceInput.value.trim();

            console.log('Form values at submission:', { montant, methodId, reference }); // Debug log

            if (!methodId) {
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Veuillez sélectionner un mode de paiement.", type: 'warning' } }));
                paymentMethodInput.focus();
                this.isSubmitting = false; // Reset submission flag
                this.enableForm(); // Ensure form remains interactive
                return;
            }

            if (isNaN(montant) || montant <= 0) {
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Veuillez entrer un montant valide.", type: 'warning' } }));
                amountInput.focus();
                this.isSubmitting = false; // Reset submission flag
                this.enableForm(); // Ensure form remains interactive
                return;
            }

            // Set submission flag and disable button immediately
            this.isSubmitting = true;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.style.pointerEvents = 'none'; // Prevent any clicks
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Envoi...`;

            try {
                const api = ApiService.getInstance();
                // Utiliser la même méthode que pour les agents mais avec un type différent
                await api.createPartnerRechargeRequest(
                    this.currentUser.id,
                    montant,
                    methodId,
                    reference
                );
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Votre demande de recharge a été soumise avec succès !", type: 'success' } }));

                // Reset the form for potential next submission
                this.resetFormAfterSuccess();

                // Reset submission flag on success
                this.isSubmitting = false;
            } catch (error) {
                console.error("Failed to create recharge request:", (error as Error).message || error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur est survenue lors de la soumission de votre demande.", type: 'error' } }));
            } finally {
                // Restore button state
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHtml;
                submitButton.style.pointerEvents = 'auto'; // Re-enable clicks

                // Ensure form is fully interactive
                this.enableForm();

                // Reset submission flag in finally block
                this.isSubmitting = false;
            }
        });
    }
}