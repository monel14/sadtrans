import { BaseModal } from "./BaseModal";
import { Partner, User } from "../../models";
import { ApiService } from "../../services/api.service";
import { DataService } from "../../services/data.service";
import { $ } from "../../utils/dom";

export class AdminEditPartnerModal extends BaseModal {
    private form: HTMLFormElement;
    private editingPartner: Partner | null = null;
    private partnerUser: User | null = null;

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
                <input type="hidden" name="partnerId">
                <input type="hidden" name="userId">
                
                <h4 class="text-md font-semibold text-slate-600">Informations Personnelles</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="partnerFirstName">Prénom</label>
                        <input type="text" id="partnerFirstName" name="firstName" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="partnerLastName">Nom de famille</label>
                        <input type="text" id="partnerLastName" name="lastName" class="form-input" required>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="partnerEmail">Adresse Email</label>
                        <input type="email" id="partnerEmail" name="email" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="partnerPhone">Téléphone Personnel</label>
                        <input type="tel" id="partnerPhone" name="phone" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Informations Établissement</h4>
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
                        <label class="form-label" for="partnerIdCardNumber">Numéro de Carte d'Identité</label>
                        <input type="text" id="partnerIdCardNumber" name="idCardNumber" class="form-input">
                    </div>
                    <div>
                        <label class="form-label" for="partnerIfu">Numéro IFU</label>
                        <input type="text" id="partnerIfu" name="ifu" class="form-input">
                    </div>
                </div>
                <div>
                    <label class="form-label" for="partnerRccm">Numéro RCCM</label>
                    <input type="text" id="partnerRccm" name="rccm" class="form-input" autocomplete="organization">
                </div>
                <div>
                    <label class="form-label" for="partnerAddress">Adresse Complète</label>
                    <textarea id="partnerAddress" name="address" class="form-textarea" rows="3"></textarea>
                </div>
                <div>
                    <label class="form-label" for="partnerIdCardImage">Pièce d'Identité du Gérant</label>
                    <input type="file" id="partnerIdCardImage" name="idCardImage" class="form-input" accept="image/*">
                    <img id="idCardImagePreview" src="" alt="Aperçu" class="mt-2 rounded-md max-h-40 hidden w-full object-contain bg-slate-100 p-1">
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Statut du Compte</h4>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span id="statusLabel" class="font-medium text-slate-700">Actif</span>
                    <select id="partnerStatus" name="status" class="form-select w-36">
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                    </select>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Gestion du Mot de Passe</h4>
                <div class="bg-slate-50 p-4 rounded-lg">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="form-label" for="partnerPassword">Nouveau mot de passe</label>
                            <input type="password" id="partnerPassword" name="password" class="form-input" placeholder="Laisser vide pour ne pas changer" autocomplete="new-password">
                        </div>
                        <div>
                            <label class="form-label" for="partnerPasswordConfirm">Confirmer le mot de passe</label>
                            <input type="password" id="partnerPasswordConfirm" name="passwordConfirm" class="form-input" placeholder="Confirmer le nouveau mot de passe" autocomplete="new-password">
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        Laissez ces champs vides si vous ne souhaitez pas modifier le mot de passe du partenaire.
                    </p>
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

    public async show(partner: Partner) {
        this.editingPartner = partner;
        
        // Récupérer l'utilisateur correspondant au partenaire
        const dataService = DataService.getInstance();
        const users = await dataService.getUsers();
        this.partnerUser = users.find(u => u.partnerId === partner.id && u.role === 'partner') || null;
        
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

        // IDs cachés
        (this.form.querySelector('input[name="partnerId"]') as HTMLInputElement).value = this.editingPartner.id;
        (this.form.querySelector('input[name="userId"]') as HTMLInputElement).value = this.partnerUser?.id || '';

        // Informations personnelles (depuis la table users)
        if (this.partnerUser) {
            ($('#partnerFirstName', this.form) as HTMLInputElement).value = this.partnerUser.firstName || '';
            ($('#partnerLastName', this.form) as HTMLInputElement).value = this.partnerUser.lastName || '';
            ($('#partnerEmail', this.form) as HTMLInputElement).value = this.partnerUser.email || '';
            ($('#partnerPhone', this.form) as HTMLInputElement).value = this.partnerUser.phone || '';
            
            // Statut
            const statusSelect = $('#partnerStatus', this.form) as HTMLSelectElement;
            const initialStatus = this.partnerUser.status || 'active';
            statusSelect.value = initialStatus;
            this.updateStatusLabel(initialStatus === 'active');
        }

        // Informations établissement (depuis la table partners)
        ($('#partnerName', this.form) as HTMLInputElement).value = this.editingPartner.name || '';
        ($('#partnerAgencyName', this.form) as HTMLInputElement).value = this.editingPartner.agencyName || '';
        
        // Personne à contacter
        ($('#partnerContactName', this.form) as HTMLInputElement).value = this.editingPartner.contactPerson?.name || '';
        ($('#partnerContactPhone', this.form) as HTMLInputElement).value = this.editingPartner.contactPerson?.phone || '';
        
        // Informations légales
        ($('#partnerIdCardNumber', this.form) as HTMLInputElement).value = this.partnerUser?.idCardNumber || '';
        ($('#partnerIfu', this.form) as HTMLInputElement).value = this.editingPartner.ifu || '';
        ($('#partnerRccm', this.form) as HTMLInputElement).value = this.editingPartner.rccm || '';
        ($('#partnerAddress', this.form) as HTMLTextAreaElement).value = this.editingPartner.address || '';

        // Image de la pièce d'identité
        const preview = $('#idCardImagePreview', this.form) as HTMLImageElement;
        if (this.editingPartner.idCardImageUrl) {
            preview.src = this.editingPartner.idCardImageUrl;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
            preview.src = '';
        }
    }

    private updateStatusLabel(isActive: boolean) {
        const statusLabel = $('#statusLabel', this.form);
        if (statusLabel) {
            statusLabel.textContent = isActive ? 'Actif' : 'Suspendu';
            statusLabel.className = `font-medium ${isActive ? 'text-slate-700' : 'text-red-600'}`;
        }
    }

    private attachListeners() {
        // Gestion du changement de statut
        const statusSelect = $('#partnerStatus', this.form) as HTMLSelectElement;
        statusSelect?.addEventListener('change', () => {
            this.updateStatusLabel(statusSelect.value === 'active');
        });

        // Gestion du changement d'image
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
            if (!this.editingPartner || !this.partnerUser) return;

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;
            
            try {
                const formData = new FormData(this.form);
                const fileInput = $('#partnerIdCardImage', this.form) as HTMLInputElement;
                const file = fileInput.files?.[0];
                const statusSelect = $('#partnerStatus', this.form) as HTMLSelectElement;

                // Validation du mot de passe
                const newPassword = formData.get('password') as string;
                const confirmPassword = formData.get('passwordConfirm') as string;

                if (newPassword || confirmPassword) {
                    if (newPassword !== confirmPassword) {
                        document.body.dispatchEvent(new CustomEvent('showToast', {
                            detail: { message: "Les mots de passe ne correspondent pas.", type: 'error' }
                        }));
                        submitButton.disabled = false;
                        submitButton.innerHTML = originalButtonHtml;
                        return;
                    }
                    if (newPassword.length < 6) {
                        document.body.dispatchEvent(new CustomEvent('showToast', {
                            detail: { message: "Le mot de passe doit contenir au moins 6 caractères.", type: 'error' }
                        }));
                        submitButton.disabled = false;
                        submitButton.innerHTML = originalButtonHtml;
                        return;
                    }
                }

                // Traitement de l'image
                let idCardImageUrl = this.editingPartner.idCardImageUrl;
                if (file) {
                    idCardImageUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                const api = ApiService.getInstance();

                // 1. Mettre à jour les données utilisateur (table users)
                const userData: Partial<User> = {
                    id: this.partnerUser.id,
                    firstName: formData.get('firstName') as string,
                    lastName: formData.get('lastName') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                    role: 'partner',
                    status: statusSelect.value === 'active' ? 'active' : 'suspended',
                    partnerId: this.editingPartner.id,
                    agencyId: this.partnerUser.agencyId,
                    idCardNumber: formData.get('idCardNumber') as string,
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

                // Ajouter le mot de passe s'il est fourni
                if (newPassword) {
                    userData.password = newPassword;
                }

                await api.adminUpdateUser(userData);

                // 2. Mettre à jour les données partenaire (table partners)
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

                await api.updatePartnerDetails(partnerData);
                
                let successMessage = "Informations du partenaire mises à jour avec succès.";
                if (newPassword) {
                    successMessage += " Le mot de passe a été modifié.";
                }
                
                document.body.dispatchEvent(new CustomEvent('partnerUpdated', { bubbles: true, composed: true }));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: successMessage, type: 'success' } }));
                this.hide();

            } catch (error) {
                const errorMessage = (error instanceof Error) ? error.message : "Une erreur s'est produite lors de la sauvegarde.";
                console.error("Failed to update partner:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: errorMessage, type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHtml;
            }
        });
    }
}
