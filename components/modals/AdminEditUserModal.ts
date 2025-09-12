

import { BaseModal } from "./BaseModal";
import { User, Partner, UserRole } from "../../models";
import { ApiService } from "../../services/api.service";
import { DataService } from "../../services/data.service";
import { $ } from "../../utils/dom";

export class AdminEditUserModal extends BaseModal {
    private form: HTMLFormElement;
    private editingUser: User | null = null;
    private partners: Partner[] = [];
    private roleToCreate: UserRole | null = null;

    constructor() {
        super('adminEditUserModal', { size: 'md' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Modifier l'Utilisateur";
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="adminEditUserForm" class="space-y-4">
                <input type="hidden" name="id">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="adminEditUserFirstName">Prénom</label>
                        <input type="text" id="adminEditUserFirstName" name="firstName" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label" for="adminEditUserLastName">Nom</label>
                        <input type="text" id="adminEditUserLastName" name="lastName" class="form-input" required>
                    </div>
                </div>
                <div>
                    <label class="form-label" for="adminEditUserEmail">Adresse Email</label>
                    <input type="email" id="adminEditUserEmail" name="email" class="form-input" required>
                </div>
                <div>
                    <label class="form-label" for="adminEditUserPhone">Téléphone</label>
                    <input type="tel" id="adminEditUserPhone" name="phone" class="form-input">
                </div>

                <div id="role-specific-fields" class="space-y-4 pt-4 border-t"></div>
                
                <div class="border-t pt-4">
                    <label class="form-label" for="adminEditUserPassword">Réinitialiser le mot de passe</label>
                    <input type="password" id="adminEditUserPassword" name="password" class="form-input" placeholder="Laisser vide pour ne pas changer">
                    <p class="text-xs text-slate-500 mt-1">Le mot de passe actuel ne sera pas modifié si ce champ est laissé vide.</p>
                </div>
                <div class="border-t pt-4">
                    <label class="form-label">Statut du Compte</label>
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span id="statusLabel" class="font-medium text-slate-700">Actif</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="userStatus" name="status" value="active" class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                </div>
            </form>
        `;

        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="adminEditUserForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public async show(user: User | null, roleToCreate: UserRole = 'agent') {
        this.editingUser = user;
        this.roleToCreate = user ? null : roleToCreate;
        const dataService = DataService.getInstance();
        this.partners = await dataService.getPartners();
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            if (this.editingUser) {
                titleEl.textContent = `Modifier: ${this.editingUser.name || 'Utilisateur'}`;
            } else {
                const roleNameMap: Partial<Record<UserRole, string>> = {
                    'partner': 'Partenaire',
                    'agent': 'Agent',
                    'sous_admin': 'Sous-Admin',
                    'admin_general': 'Administrateur'
                };
                const roleName = roleNameMap[this.roleToCreate || 'agent'] || 'Utilisateur';
                titleEl.textContent = `Créer un Nouveau ${roleName}`;
            }
        }
    }

    private populateForm() {
        this.form.reset();
        const userToDisplay = this.editingUser;
        const role = userToDisplay ? userToDisplay.role : this.roleToCreate;

        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = userToDisplay?.id || '';
        
        // Populate first and last name
        const firstName = userToDisplay?.firstName || (userToDisplay?.name || '').split(' ')[0] || '';
        const lastName = userToDisplay?.lastName || (userToDisplay?.name || '').split(' ').slice(1).join(' ') || '';
        ($('#adminEditUserFirstName', this.form) as HTMLInputElement).value = firstName;
        ($('#adminEditUserLastName', this.form) as HTMLInputElement).value = lastName;
        
        ($('#adminEditUserEmail', this.form) as HTMLInputElement).value = userToDisplay?.email || '';
        ($('#adminEditUserPhone', this.form) as HTMLInputElement).value = userToDisplay?.phone || '';

        const passwordInput = $('#adminEditUserPassword', this.form) as HTMLInputElement;
        passwordInput.placeholder = userToDisplay ? "Laisser vide pour ne pas changer" : "Mot de passe initial (requis)";
        passwordInput.required = !userToDisplay;
        
        const roleFieldsContainer = $('#role-specific-fields', this.form) as HTMLElement;
        roleFieldsContainer.innerHTML = '';
        
        if (role === 'agent') {
            const partnerOptions = this.partners.map(p => 
                `<option value="${p.id}" ${userToDisplay?.partnerId === p.id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

            roleFieldsContainer.innerHTML = `
                <div>
                    <label class="form-label" for="adminEditAgentPartner">Partenaire d'Affiliation</label>
                    <select id="adminEditAgentPartner" name="partnerId" class="form-select" required>
                        <option value="">-- Sélectionner --</option>
                        ${partnerOptions}
                    </select>
                </div>
            `;
        } else if (role === 'partner') {
             roleFieldsContainer.innerHTML = `
                <h4 class="text-md font-semibold text-slate-600">Informations Agence & KYC</h4>
                <div>
                    <label class="form-label" for="adminEditPartnerAgencyName">Nom d’établissement</label>
                    <input type="text" id="adminEditPartnerAgencyName" name="agencyName" class="form-input" value="${userToDisplay?.agencyName || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                     <div>
                        <label class="form-label" for="adminEditPartnerContactName">Nom du Contact</label>
                        <input type="text" id="adminEditPartnerContactName" name="contactPersonName" class="form-input" value="${userToDisplay?.contactPerson?.name || ''}">
                    </div>
                     <div>
                        <label class="form-label" for="adminEditPartnerContactPhone">Téléphone du Contact</label>
                        <input type="tel" id="adminEditPartnerContactPhone" name="contactPersonPhone" class="form-input" value="${userToDisplay?.contactPerson?.phone || ''}">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label class="form-label" for="adminEditUserIdCardNumber">Numéro de la carte d’identité</label>
                        <input type="text" id="adminEditUserIdCardNumber" name="idCardNumber" class="form-input" value="${userToDisplay?.idCardNumber || ''}">
                    </div>
                    <div>
                        <label class="form-label" for="adminEditUserIfu">Numéro IFU</label>
                        <input type="text" id="adminEditUserIfu" name="ifu" class="form-input" value="${userToDisplay?.ifu || ''}">
                    </div>
                </div>
                 <div>
                    <label class="form-label" for="adminEditUserAddress">Adresse</label>
                    <textarea id="adminEditUserAddress" name="address" class="form-textarea" rows="2">${userToDisplay?.address || ''}</textarea>
                </div>
                <div>
                    <label class="form-label" for="adminEditUserIdCardImage">Image de la carte d’identité</label>
                    <input type="file" id="adminEditUserIdCardImage" name="idCardImage" class="form-input" accept="image/*">
                    <img id="idCardImagePreview" src="" alt="Aperçu" class="mt-2 rounded-md max-h-40 hidden w-full object-contain bg-slate-100 p-1">
                </div>
            `;
             const preview = $('#idCardImagePreview', this.form) as HTMLImageElement;
             if (userToDisplay?.idCardImageUrl) {
                 preview.src = userToDisplay.idCardImageUrl;
                 preview.classList.remove('hidden');
             } else {
                 preview.classList.add('hidden');
                 preview.src = '';
             }
        }

        const statusToggle = $('#userStatus', this.form) as HTMLInputElement;
        statusToggle.checked = !userToDisplay || userToDisplay.status === 'active';
        this.updateStatusLabel(statusToggle.checked);
    }

    private updateStatusLabel(isActive: boolean) {
        const statusLabel = $('#statusLabel', this.form);
        if (statusLabel) {
            statusLabel.textContent = isActive ? 'Actif' : 'Suspendu';
            statusLabel.className = `font-medium ${isActive ? 'text-slate-700' : 'text-red-600'}`;
        }
    }

    private attachListeners() {
        const statusToggle = $('#userStatus', this.form) as HTMLInputElement;
        statusToggle?.addEventListener('change', () => {
            this.updateStatusLabel(statusToggle.checked);
        });

        // Use event delegation for the file input which might not exist on initial render
        this.form.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            if (target.id === 'adminEditUserIdCardImage' && target.type === 'file') {
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

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;
            
            try {
                const formData = new FormData(this.form);
                const statusToggleInput = $('#userStatus', this.form) as HTMLInputElement;

                const userData: Partial<User> = {
                    id: this.editingUser?.id,
                    firstName: formData.get('firstName') as string,
                    lastName: formData.get('lastName') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                    status: statusToggleInput.checked ? 'active' : 'suspended'
                };

                if (!this.editingUser && this.roleToCreate) {
                    userData.role = this.roleToCreate;
                }

                const password = formData.get('password') as string;
                if (password) {
                    userData.password = password;
                }

                const userRole = this.editingUser?.role || this.roleToCreate;
                if (userRole === 'agent') {
                    userData.partnerId = formData.get('partnerId') as string;
                } else if (userRole === 'partner') {
                    userData.agencyName = formData.get('agencyName') as string;
                    userData.contactPerson = {
                        name: formData.get('contactPersonName') as string,
                        phone: formData.get('contactPersonPhone') as string,
                    };
                    userData.idCardNumber = formData.get('idCardNumber') as string;
                    userData.ifu = formData.get('ifu') as string;
                    userData.address = formData.get('address') as string;
                    
                    const fileInput = $('#adminEditUserIdCardImage', this.form) as HTMLInputElement;
                    const file = fileInput.files?.[0];

                    if (file) {
                        userData.idCardImageUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                    } else if (this.editingUser?.idCardImageUrl) {
                        userData.idCardImageUrl = this.editingUser.idCardImageUrl;
                    }
                }

                const api = ApiService.getInstance();
                await api.adminUpdateUser(userData);
                
                document.body.dispatchEvent(new CustomEvent('userUpdated', { bubbles: true, composed: true }));
                this.hide();

            } catch (error) {
                console.error("Failed to update user:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite lors de la sauvegarde.", type: 'error' } }));
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHtml;
            }
        });
    }
}