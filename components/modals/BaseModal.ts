export class BaseModal {
    protected modalElement: HTMLElement;
    protected modalId: string;

    constructor(id: string, options: { size?: 'sm' | 'md' | 'lg' | 'xl' } = {}) {
        this.modalId = id;
        this.modalElement = this.createModalStructure(id, options.size);
        document.body.appendChild(this.modalElement);

        this.attachCloseEvents();
    }

    private createModalStructure(id: string, size?: 'sm' | 'md' | 'lg' | 'xl'): HTMLElement {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.setAttribute('aria-hidden', 'true');

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        if (size) {
            modalContent.classList.add(`modal-${size}`);
        }
        
        modal.appendChild(modalContent);
        return modal;
    }

    protected setContent(title: string, body: HTMLElement, footer?: HTMLElement) {
        const modalContent = this.modalElement.querySelector('.modal-content');
        if (!modalContent) return;

        modalContent.innerHTML = ''; // Clear previous content

        const titleEl = document.createElement('h3');
        titleEl.className = 'text-xl font-semibold mb-4';
        titleEl.textContent = title;

        modalContent.appendChild(titleEl);
        modalContent.appendChild(body);
        if (footer) {
            modalContent.appendChild(footer);
        }
    }

    private attachCloseEvents() {
        // Close on click outside
        this.modalElement.addEventListener('click', (event) => {
            if (event.target === this.modalElement) {
                this.hide();
            }
        });

        // Close on buttons with data-modal-close attribute
        this.modalElement.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-modal-close]')) {
                this.hide();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modalElement.classList.contains('visible')) {
                this.hide();
            }
        });
    }

    // Fix: Allow arguments in the show method signature to support overriding in child classes with parameters.
    public show(..._args: any[]) {
        this.modalElement.classList.add('visible');
        this.modalElement.setAttribute('aria-hidden', 'false');
    }

    public hide() {
        this.modalElement.classList.remove('visible');
        this.modalElement.setAttribute('aria-hidden', 'true');
    }
}