import { BaseModal } from "./BaseModal";
import { Partner, CardType, OrderItem } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";
import { formatAmount, formatNumber } from "../../utils/formatters";

export class AdminCreateOrderModal extends BaseModal {
    private form: HTMLFormElement;
    private partners: Partner[];
    private cardTypes: CardType[];
    private itemCounter = 0;

    constructor(partners: Partner[], cardTypes: CardType[]) {
        super('adminCreateOrderModal', { size: 'lg' });
        this.partners = partners;
        this.cardTypes = cardTypes.filter(ct => ct.status === 'active');
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Enregistrer une Nouvelle Commande";
        const body = document.createElement('div');
        
        let partnerOptions = this.partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        body.innerHTML = `
            <form id="createOrderForm" novalidate>
                <div class="mb-4">
                    <label class="form-label" for="orderPartnerId">Partenaire</label>
                    <select id="orderPartnerId" name="partnerId" class="form-select" required>
                        <option value="">-- Sélectionner un partenaire --</option>
                        ${partnerOptions}
                    </select>
                </div>
                
                <h4 class="font-semibold text-slate-700 mt-6 mb-2">Articles de la commande</h4>
                <div id="order-items-container" class="space-y-3 border-b pb-4">
                    <!-- Dynamic item rows will be injected here -->
                </div>
                <button type="button" id="add-order-item-btn" class="btn btn-sm btn-outline-secondary mt-3"><i class="fas fa-plus mr-2"></i>Ajouter un autre type de carte</button>

                <div id="order-summary" class="mt-6 p-4 border-l-4 border-violet-500 bg-violet-50 space-y-2">
                     <div class="flex justify-between items-center">
                        <span class="font-semibold text-slate-700">Total Cartes :</span>
                        <span id="summaryTotalCards" class="font-bold text-lg text-slate-800">0</span>
                    </div>
                     <div class="flex justify-between items-center">
                        <span class="font-semibold text-slate-700">Montant Total :</span>
                        <span id="summaryTotalAmount" class="font-bold text-lg text-violet-700">0 XOF</span>
                    </div>
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="createOrderForm" class="btn btn-primary"><i class="fas fa-save mr-2"></i>Enregistrer la commande</button>
        `;

        this.setContent(title, body, footer);
    }

    public show() {
        this.form.reset();
        const itemsContainer = $('#order-items-container', this.form);
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            this.itemCounter = 0;
            this.addOrderItemRow();
        }
        this.updateOrderSummary();
        super.show();
    }

    private addOrderItemRow() {
        this.itemCounter++;
        const itemRow = document.createElement('div');
        itemRow.className = 'order-item-row grid grid-cols-12 gap-2 items-center p-2 rounded-md bg-slate-50';
        itemRow.dataset.itemId = String(this.itemCounter);

        const cardTypeOptions = this.cardTypes.map(ct => `<option value="${ct.id}">${ct.name}</option>`).join('');

        itemRow.innerHTML = `
            <div class="col-span-5">
                <select name="cardTypeId_${this.itemCounter}" class="form-select form-select-sm" required>
                    <option value="">-- Type de carte --</option>
                    ${cardTypeOptions}
                </select>
            </div>
            <div class="col-span-3">
                <input type="number" name="quantity_${this.itemCounter}" class="form-input form-input-sm" placeholder="Qté" required min="1">
            </div>
            <div class="col-span-3">
                <input type="number" name="unitPrice_${this.itemCounter}" class="form-input form-input-sm" placeholder="Prix Unitaire" required min="0">
            </div>
            <div class="col-span-1 text-right">
                <button type="button" class="btn btn-xs btn-danger" data-action="remove-item"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        $('#order-items-container', this.form)?.appendChild(itemRow);
    }

    private updateOrderSummary() {
        const itemRows = this.form.querySelectorAll('.order-item-row');
        let totalCards = 0;
        let totalAmount = 0;

        itemRows.forEach(row => {
            const quantity = parseFloat((row.querySelector('input[name^="quantity"]') as HTMLInputElement)?.value) || 0;
            const unitPrice = parseFloat((row.querySelector('input[name^="unitPrice"]') as HTMLInputElement)?.value) || 0;
            totalCards += quantity;
            totalAmount += quantity * unitPrice;
        });

        ($('#summaryTotalCards', this.form) as HTMLElement).textContent = formatNumber(totalCards);
        ($('#summaryTotalAmount', this.form) as HTMLElement).textContent = formatAmount(totalAmount);
    }

    private attachListeners() {
        $('#add-order-item-btn', this.form)?.addEventListener('click', () => {
            this.addOrderItemRow();
        });

        $('#order-items-container', this.form)?.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest<HTMLButtonElement>('[data-action="remove-item"]');
            if (removeBtn) {
                removeBtn.closest('.order-item-row')?.remove();
                this.updateOrderSummary();
            }
        });

        $('#order-items-container', this.form)?.addEventListener('input', e => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT') {
                this.updateOrderSummary();
            }
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.form.checkValidity()) {
                this.form.reportValidity();
                return;
            }

            const items: OrderItem[] = [];
            const itemRows = this.form.querySelectorAll('.order-item-row');
            itemRows.forEach(row => {
                items.push({
                    cardTypeId: (row.querySelector('select[name^="cardTypeId"]') as HTMLSelectElement).value,
                    quantity: parseInt((row.querySelector('input[name^="quantity"]') as HTMLInputElement).value, 10),
                    unitPrice: parseFloat((row.querySelector('input[name^="unitPrice"]') as HTMLInputElement).value)
                });
            });

            const partnerId = ($('#orderPartnerId', this.form) as HTMLSelectElement).value;

            if (items.length === 0) {
                 document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Veuillez ajouter au moins un article à la commande.", type: 'warning' } }));
                return;
            }

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                await api.createOrder({ partnerId, items });
                document.body.dispatchEvent(new CustomEvent('orderCreated', { bubbles: true, composed: true }));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Commande enregistrée avec succès !", type: 'success' } }));
                this.hide();
            } catch (error) {
                console.error("Failed to create order", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}