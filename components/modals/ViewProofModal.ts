import { BaseModal } from "./BaseModal";
import { $ } from "../../utils/dom";

export class ViewProofModal extends BaseModal {
    private proofImage: HTMLImageElement | null = null;

    constructor() {
        super('viewProofModal', { size: 'lg' });
        this.render();
    }

    private render() {
        const title = "Preuve de Transaction / Pièce d'Identité";
        const body = document.createElement('div');
        body.innerHTML = `<img id="proofImage" src="https://placehold.co/600x400/cccccc/969696?text=Preuve+Transaction" alt="Preuve de transaction" class="w-full h-auto rounded-md">`;
        
        const footer = document.createElement('div');
        footer.className = 'mt-4 text-right';
        footer.innerHTML = `<button type="button" class="btn btn-secondary" data-modal-close>Fermer</button>`;

        this.setContent(title, body, footer);
        this.proofImage = $('#proofImage', this.modalElement) as HTMLImageElement;
    }

    public show(imageUrl: string) {
        if (this.proofImage) {
            this.proofImage.src = imageUrl;
        }
        super.show();
    }
}
