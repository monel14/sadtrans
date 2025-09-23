import { BaseModal } from './BaseModal';

export class ConfirmationModal extends BaseModal {
    private onConfirm?: () => void;
    private onCancel?: () => void;

    constructor() {
        super('confirmation-modal', { size: 'sm' });
    }

    public async show(title: string, message: string, onConfirm: () => void, onCancel?: () => void): Promise<void> {
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        const body = this.createBody(message);
        const footer = this.createFooter();

        this.setContent(title, body, footer);
        super.show();
        this.attachEventListeners();
    }

    private createBody(message: string): HTMLElement {
        const body = document.createElement('div');
        body.className = 'confirmation-body';
        body.innerHTML = `
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
                <i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>
            </div>
            <p class="text-center text-gray-700">${message}</p>
        `;
        return body;
    }

    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-3';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-action="cancel">
                <i class="fas fa-times mr-2"></i>Annuler
            </button>
            <button type="button" class="btn btn-danger" data-action="confirm">
                <i class="fas fa-check mr-2"></i>Confirmer
            </button>
        `;
        return footer;
    }

    private attachEventListeners(): void {
        const cancelBtn = this.modalElement.querySelector('[data-action="cancel"]') as HTMLButtonElement;
        const confirmBtn = this.modalElement.querySelector('[data-action="confirm"]') as HTMLButtonElement;

        cancelBtn.addEventListener('click', () => {
            if (this.onCancel) {
                this.onCancel();
            }
            this.hide();
        });

        confirmBtn.addEventListener('click', () => {
            if (this.onConfirm) {
                this.onConfirm();
            }
            this.hide();
        });
    }
}