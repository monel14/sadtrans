import { BaseModal } from "./BaseModal";
import { $ } from "../../utils/dom";

interface ConfirmationModalOptions {
    confirmButtonText?: string;
    confirmButtonClass?: 'btn-primary' | 'btn-danger' | 'btn-success';
}

export class ConfirmationModal extends BaseModal {
    private titleElement: HTMLElement | null;
    private messageElement: HTMLElement | null;
    private confirmButton: HTMLButtonElement | null;
    private onConfirmCallback: (() => Promise<void>) | null = null;

    constructor() {
        super('confirmationModal', { size: 'sm' });
        this.render();
        this.titleElement = $('#confirmationModalTitle', this.modalElement);
        this.messageElement = $('#confirmationModalMessage', this.modalElement);
        this.confirmButton = $('#confirmationModalConfirmBtn', this.modalElement);
        this.attachListeners();
    }

    private render() {
        const title = "Confirmation";
        const body = document.createElement('div');
        body.innerHTML = `<p id="confirmationModalMessage" class="text-slate-600 mb-6"></p>`;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button id="confirmationModalConfirmBtn" class="btn btn-primary">Confirmer</button>
        `;

        this.setContent(title, body, footer);
        // Rename title element to be unique
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.id = 'confirmationModalTitle';
        }
    }

    public show(
        title: string,
        message: string,
        onConfirm: () => Promise<void>,
        options: ConfirmationModalOptions = {}
    ) {
        if (this.titleElement) this.titleElement.textContent = title;
        if (this.messageElement) this.messageElement.innerHTML = message.replace(/\n/g, '<br>'); // Support newlines in message
        this.onConfirmCallback = onConfirm;

        if (this.confirmButton) {
            this.confirmButton.innerHTML = options.confirmButtonText || 'Confirmer';
            this.confirmButton.className = 'btn'; // Reset classes
            this.confirmButton.classList.add(options.confirmButtonClass || 'btn-primary');
        }
        
        super.show();
    }

    private attachListeners() {
        this.confirmButton?.addEventListener('click', async () => {
            if (!this.onConfirmCallback || !this.confirmButton) return;

            const originalButtonHtml = this.confirmButton.innerHTML;
            this.confirmButton.disabled = true;
            this.confirmButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Chargement...`;

            try {
                await this.onConfirmCallback();
                this.hide(); // Hide only on success
            } catch (error) {
                // The calling function should show the toast error.
                // The button will be restored in the finally block.
                // The modal stays open for the user to see the error and retry.
            } finally {
                if(this.confirmButton.disabled){ // Only restore if it was disabled by this function
                    this.confirmButton.disabled = false;
                    this.confirmButton.innerHTML = originalButtonHtml;
                }
            }
        });
    }
}
