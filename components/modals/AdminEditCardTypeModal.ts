import { BaseModal } from "./BaseModal";
import { CardType } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminEditCardTypeModal extends BaseModal {
    private form: HTMLFormElement;
    private editingCardType: CardType | null = null;

    constructor() {
        super('adminEditCardTypeModal');
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;

        this.attachListeners();
    }

    private render() {
        const title = "Éditer le Type de Carte"; // Title will be updated in show()
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="editCardTypeForm">
                <input type="hidden" id="cardTypeId" name="id">
                <div class="space-y-4">
                    <div>
                        <label class="form-label" for="cardTypeName">Nom du type de carte</label>
                        <input type="text" id="cardTypeName" name="name" class="form-input" required>
                    </div>
                     <div>
                        <label class="form-label" for="cardTypeStatus">Statut</label>
                        <select id="cardTypeStatus" name="status" class="form-select" required>
                            <option value="active">Actif</option>
                            <option value="inactive">Inactif</option>
                        </select>
                    </div>
                </div>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="editCardTypeForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(cardType?: CardType) {
        this.editingCardType = cardType || null;
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = this.editingCardType ? `Éditer: ${this.editingCardType.name}` : "Créer un Nouveau Type de Carte";
        }
    }

    private populateForm() {
        this.form.reset();
        ($('#cardTypeId', this.form) as HTMLInputElement).value = this.editingCardType?.id || '';
        ($('#cardTypeName', this.form) as HTMLInputElement).value = this.editingCardType?.name || '';
        ($('#cardTypeStatus', this.form) as HTMLSelectElement).value = this.editingCardType?.status || 'active';
    }

    private attachListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(this.form);
            const data: CardType = {
                id: formData.get('id') as string,
                name: formData.get('name') as string,
                status: formData.get('status') as 'active' | 'inactive',
            };

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                await api.updateCardType(data);
                document.body.dispatchEvent(new CustomEvent('cardTypesUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Type de carte enregistré avec succès !", type: 'success' } }));
                this.hide();
            } catch (error) {
                console.error("Failed to save card type", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}