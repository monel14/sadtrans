import { BaseModal } from "./BaseModal";
import { User } from "../../models";
import { $ } from "../../utils/dom";
import { supabase } from "../../services/supabase.service";

export class AdminCreatePartnerModal extends BaseModal {
    private form: HTMLFormElement;

    constructor() {
        super('adminCreatePartnerModal', { size: 'lg' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Créer un Nouveau Partenaire";
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="adminCreatePartnerForm" class="space-y-4">
                <h4 class="text-md font-semibold text-slate-600">Informations Personnelles</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="createPartnerFirstName">Prénom *</label>
                        <input type="text" id="createPartnerFirstName" name="firstName" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="createPartnerLastName">Nom de famille *</label>
                        <input type="text" id="createPartnerLastName" name="lastName" class="form-input" required>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="createPartnerEmail">Adresse Email *</label>
                        <input type="email" id="createPartnerEmail" name="email" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="createPartnerPhone">Téléphone Personnel</label>
                        <input type="tel" id="createPartnerPhone" name="phone" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Informations Établissement</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="createPartnerName">Nom de l'établissement *</label>
                        <input type="text" id="createPartnerName" name="name" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="createPartnerAgencyName">Raison sociale (si différent)</label>
                        <input type="text" id="createPartnerAgencyName" name="agencyName" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Personne à Contacter</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label class="form-label" for="createPartnerContactName">Nom du Contact</label>
                        <input type="text" id="createPartnerContactName" name="contactPersonName" class="form-input">
                    </div>
                     <div>
                        <label class="form-label" for="createPartnerContactPhone">Téléphone du Contact</label>
                        <input type="tel" id="createPartnerContactPhone" name="contactPersonPhone" class="form-input">
                    </div>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Informations Légales & KYC</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="createPartnerIdCardNumber">Numéro de Carte d'Identité</label>
                        <input type="text" id="createPartnerIdCardNumber" name="idCardNumber" class="form-input">
                    </div>
                    <div>
                        <label class="form-label" for="createPartnerIfu">Numéro IFU</label>
                        <input type="text" id="createPartnerIfu" name="ifu" class="form-input">
                    </div>
                </div>
                <div>
                    <label class="form-label" for="createPartnerRccm">Numéro RCCM</label>
                    <input type="text" id="createPartnerRccm" name="rccm" class="form-input">
                </div>
                <div>
                    <label class="form-label" for="createPartnerAddress">Adresse Complète</label>
                    <textarea id="createPartnerAddress" name="address" class="form-textarea" rows="3"></textarea>
                </div>
                <div>
                    <label class="form-label" for="createPartnerIdCardImage">Pièce d'Identité du Gérant</label>
                    <input type="file" id="createPartnerIdCardImage" name="idCardImage" class="form-input" accept="image/*">
                    <img id="createIdCardImagePreview" src="" alt="Aperçu" class="mt-2 rounded-md max-h-40 hidden w-full object-contain bg-slate-100 p-1">
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Mot de Passe de Connexion</h4>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="form-label" for="createPartnerPassword">Mot de passe *</label>
                            <input type="password" id="createPartnerPassword" name="password" class="form-input" placeholder="Mot de passe" autocomplete="new-password" required>
                        </div>
                        <div>
                            <label class="form-label" for="createPartnerPasswordConfirm">Confirmer le mot de passe *</label>
                            <input type="password" id="createPartnerPasswordConfirm" name="passwordConfirm" class="form-input" placeholder="Confirmer le mot de passe" autocomplete="new-password" required>
                        </div>
                    </div>
                    <p class="text-xs text-slate-600 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        Le mot de passe doit contenir au moins 6 caractères. Le partenaire pourra se connecter avec son email et ce mot de passe.
                    </p>
                </div>

                <h4 class="text-md font-semibold text-slate-600 pt-4 border-t">Statut Initial</h4>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span id="createStatusLabel" class="font-medium text-slate-700">Actif</span>
                    <select id="createPartnerStatus" name="status" class="form-select w-36">
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                    </select>
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="adminCreatePartnerForm" class="btn btn-success"><i class="fas fa-plus mr-2"></i>Créer le Partenaire</button>
        `;

        this.setContent(title, body, footer);
    }

    public show() {
        this.form.reset();
        this.updateStatusLabel(true); // Par défaut actif
        super.show();
    }

    private updateStatusLabel(isActive: boolean) {
        const statusLabel = $('#createStatusLabel', this.form);
        if (statusLabel) {
            statusLabel.textContent = isActive ? 'Actif' : 'Suspendu';
            statusLabel.className = `font-medium ${isActive ? 'text-slate-700' : 'text-red-600'}`;
        }
    }

    private attachListeners() {
        // Gestion du changement de statut
        const statusSelect = $('#createPartnerStatus', this.form) as HTMLSelectElement;
        statusSelect?.addEventListener('change', () => {
            this.updateStatusLabel(statusSelect.value === 'active');
        });

        // Gestion du changement d'image
        this.form.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            if (target.id === 'createPartnerIdCardImage' && target.type === 'file') {
                const preview = $('#createIdCardImagePreview', this.form) as HTMLImageElement;
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

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Création...`;

            try {
                const formData = new FormData(this.form);
                const fileInput = $('#createPartnerIdCardImage', this.form) as HTMLInputElement;
                const file = fileInput.files?.[0];
                const statusSelect = $('#createPartnerStatus', this.form) as HTMLSelectElement;

                // Validation des champs requis
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;
                const email = formData.get('email') as string;
                const name = formData.get('name') as string;
                const password = formData.get('password') as string;
                const passwordConfirm = formData.get('passwordConfirm') as string;

                if (!firstName || !lastName || !email || !name || !password || !passwordConfirm) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: "Veuillez remplir tous les champs obligatoires.", type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHtml;
                    return;
                }

                // Validation du mot de passe
                if (password !== passwordConfirm) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: "Les mots de passe ne correspondent pas.", type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHtml;
                    return;
                }

                if (password.length < 6) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: "Le mot de passe doit contenir au moins 6 caractères.", type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHtml;
                    return;
                }

                // Traitement de l'image
                let idCardImageUrl: string | null = null;
                if (file) {
                    idCardImageUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                // Préparer les données utilisateur pour la création
                const userData: Partial<User> = {
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    phone: formData.get('phone') as string,
                    role: 'partner',
                    status: statusSelect.value === 'active' ? 'active' : 'suspended',
                    password: password,
                    // Informations partenaire
                    agencyName: formData.get('agencyName') as string,
                    contactPerson: {
                        name: formData.get('contactPersonName') as string,
                        phone: formData.get('contactPersonPhone') as string,
                    },
                    idCardNumber: formData.get('idCardNumber') as string,
                    ifu: formData.get('ifu') as string,
                    rccm: formData.get('rccm') as string,
                    address: formData.get('address') as string,
                    idCardImageUrl: idCardImageUrl,
                };

                // Ajouter les données spécifiques au partenaire
                (userData as any).partnerName = name;

                // Appeler directement la fonction Edge create-partner
                const { data, error } = await supabase.functions.invoke('create-partner', {
                    body: {
                        userData: userData,
                        password: password
                    }
                });

                if (error) {
                    console.error('Error calling create-partner Edge function:', error);
                    throw new Error('Failed to create partner');
                }

                if (data.error) {
                    console.error('Error in create-partner function:', data.error);
                    console.log('Debug info:', data.debug);
                    throw new Error(data.error);
                }

                // Log debug info for successful calls too
                if (data.debug) {
                    console.log('Debug info:', data.debug);
                }

                document.body.dispatchEvent(new CustomEvent('partnerCreated', { bubbles: true, composed: true }));
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: {
                        message: "Partenaire créé avec succès ! Un compte de connexion a été configuré.",
                        type: 'success'
                    }
                }));
                this.hide();

            } catch (error) {
                const errorMessage = (error instanceof Error) ? error.message : "Une erreur s'est produite lors de la création du partenaire.";
                console.error("Failed to create partner:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: errorMessage, type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHtml;
            }
        });
    }
}