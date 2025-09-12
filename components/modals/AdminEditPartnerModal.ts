import { BaseModal } from "./BaseModal";
import { Partner } from "../../models";
import { ApiService } from "../../services/api.service";
import { $ } from "../../utils/dom";

export class AdminEditPartnerModal extends BaseModal {
    private form: HTMLFormElement;
    private editingPartner: Partner | null = null;

    constructor() {
        super('adminEditPartnerModal', { size: 'lg' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Modifier le Partenaire";
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="adminEditPartnerForm" class="space-y-4">
                <input type="hidden" name="id">
                
                <h4 class="text-md font-semibold text-slate-600">Informations Générales</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="partnerName">Nom de l'établissement</label>
                        <input type="text" id="partnerName" name="name" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="partnerAgencyName">Raison sociale (si différent)</label>
                        <input type="text" id="partnerAgencyName" name="agencyName" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Personne à Contacter</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label class="form-label" for="partnerContactName">Nom du Contact</label>
                        <input type="text" id="partnerContactName" name="contactPersonName" class="form-input">
                    </div>
                     <div>
                        <label class="form-label" for="partnerContactPhone">Téléphone du Contact</label>
                        <input type="tel" id="partnerContactPhone" name="contactPersonPhone" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Informations Légales & KYC</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="partnerIfu">Numéro IFU</label>
                        <input type="text" id="partnerIfu" name="ifu" class="form-input">
                    </div>
                    <div>
                        <label class="form-label" for="partnerRccm">Numéro RCCM</label>
                        <input type="text" id="partnerRccm" name="rccm" class="form-input">
                    </div>
                </div>
                 <div>
                    <label class="form-label" for="partnerAddress">Adresse</label>
                    <textarea id="partnerAddress" name="address" class="form-textarea" rows="2"></textarea>
                </div>
                <div>
                    <label class="form-label" for="partnerIdCardImage">Pièce d'Identité du Gérant</label>
                    <input type="file" id="partnerIdCardImage" name="idCardImage" class="form-input" accept="image/*">
                    <img id="idCardImagePreview" src="" alt="Aperçu" class="mt-2 rounded-md max-h-40 hidden w-full object-contain bg-slate-100 p-1">
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="adminEditPartnerForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(partner: Partner) {
        this.editingPartner = partner;
        this.updateTitle();
        this.populateForm();
        super.show();
    }
    
    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = `Modifier le Partenaire: ${this.editingPartner?.name || ''}`;
        }
    }

    private populateForm() {
        this.form.reset();
        if (!this.editingPartner) return;

        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = this.editingPartner.id;
        ($('#partnerName', this.form) as HTMLInputElement).value = this.editingPartner.name || '';
        ($('#partnerAgencyName', this.form) as HTMLInputElement).value = this.editingPartner.agencyName || '';
        ($('#partnerContactName', this.form) as HTMLInputElement).value = this.editingPartner.contactPerson?.name || '';
        ($('#partnerContactPhone', this.form) as HTMLInputElement).value = this.editingPartner.contactPerson?.phone || '';
        ($('#partnerIfu', this.form) as HTMLInputElement).value = this.editingPartner.ifu || '';
        ($('#partnerRccm', this.form) as HTMLInputElement).value = this.editingPartner.rccm || '';
        ($('#partnerAddress', this.form) as HTMLTextAreaElement).value = this.editingPartner.address || '';

        const preview = $('#idCardImagePreview', this.form) as HTMLImageElement;
        if (this.editingPartner.idCardImageUrl) {
            preview.src = this.editingPartner.idCardImageUrl;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
            preview.src = '';
        }
    }

    private attachListeners() {
        this.form.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            if (target.id === 'partnerIdCardImage' && target.type === 'file') {
                const preview = $('#idCardImagePreview', this.form) as HTMLImageElement;
                const file = target.files?.[0];
                if (file && preview) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        preview.src = event.target?.result as string;
                        preview.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            }
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.editingPartner) return;

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;
            
            try {
                const formData = new FormData(this.form);
                const fileInput = $('#partnerIdCardImage', this.form) as HTMLInputElement;
                const file = fileInput.files?.[0];

                let idCardImageUrl = this.editingPartner.idCardImageUrl;
                if (file) {
                    idCardImageUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
                
                const partnerData: Partial<Partner> = {
                    id: this.editingPartner.id,
                    name: formData.get('name') as string,
                    agencyName: formData.get('agencyName') as string,
                    contactPerson: {
                        name: formData.get('contactPersonName') as string,
                        phone: formData.get('contactPersonPhone') as string,
                    },
                    ifu: formData.get('ifu') as string,
                    rccm: formData.get('rccm') as string,
                    address: formData.get('address') as string,
                    idCardImageUrl: idCardImageUrl,
                };
                
                const api = ApiService.getInstance();
                await api.updatePartnerDetails(partnerData);
                
                document.body.dispatchEvent(new CustomEvent('partnerUpdated', { bubbles: true, composed: true }));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Informations du partenaire mises à jour.", type: 'success' } }));
                this.hide();

            } catch (error) {
                console.error("Failed to update partner:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHtml;
            }
        });
    }
}
