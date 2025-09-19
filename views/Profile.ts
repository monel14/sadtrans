

import { createCard } from '../components/Card';
import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { $ } from '../utils/dom';

// Module-level variables to hold the state for the profile view instance
let viewContent: HTMLElement;
let currentUserData: User;

// Render the read-only view
function renderDisplayView() {
    const dataService = DataService.getInstance();

    const roleDisplayMap: { [key: string]: string } = {
        agent: "Agent (Utilisateur Partenaire)",
        partner: "Partenaire (B2B)",
        admin_general: "Administrateur général",
        sous_admin: "Sous-administrateur",
    };

    const renderField = (label: string, value?: string) => `
        <div>
            <p class="text-sm text-slate-500">${label}</p>
            <p class="font-semibold text-slate-700">${value || '-'}</p>
        </div>
    `;

    // We need to fetch the partner name if it's an agent or partner
    let agencyNamePromise = Promise.resolve(currentUserData.agencyName || '');
    if ((currentUserData.role === 'agent' || currentUserData.role === 'partner') && currentUserData.partnerId) {
        agencyNamePromise = dataService.getPartnerById(currentUserData.partnerId).then(p => p?.name || 'N/A');
    }

    agencyNamePromise.then(agencyName => {
        viewContent.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    ${renderField('Nom complet', currentUserData.name)}
                    ${renderField('Rôle', roleDisplayMap[currentUserData.role] || currentUserData.role)}
                    ${renderField('Email', currentUserData.email)}
                    ${renderField('Téléphone', currentUserData.phone)}
                    ${renderField('Agence', agencyName)}
                    ${renderField("Pièce d'identité", currentUserData.idCardNumber)}
                    ${renderField('IFU', currentUserData.ifu)}
                    ${renderField('RCCM', currentUserData.rccm)}
                </div>
                <div class="border-t pt-4">
                    ${renderField('Personne à contacter (Affiliation)', `${currentUserData.contactPerson?.name || '-'} / ${currentUserData.contactPerson?.phone || '-'}`)}
                </div>
                <div class="text-right mt-6">
                    <button id="edit-profile-btn" class="btn btn-primary"><i class="fas fa-edit mr-2"></i>Modifier mes informations</button>
                </div>
            </div>
        `;

        $('#edit-profile-btn', viewContent)?.addEventListener('click', () => {
            renderEditForm();
        });
    });
}

// Render the editable form
function renderEditForm() {
    const roleDisplayMap: { [key: string]: string } = {
        agent: "Agent (Utilisateur Partenaire)",
        partner: "Partenaire (B2B)",
        admin_general: "Administrateur général",
        sous_admin: "Sous-administrateur",
    };

    viewContent.innerHTML = `
        <form id="profile-edit-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                    <label class="form-label" for="profileFirstName">Prénom</label>
                    <input type="text" id="profileFirstName" name="firstName" class="form-input" value="${currentUserData.firstName || ''}" required>
                </div>
                 <div>
                    <label class="form-label" for="profileLastName">Nom</label>
                    <input type="text" id="profileLastName" name="lastName" class="form-input" value="${currentUserData.lastName || ''}" required>
                </div>
                <div>
                    <label class="form-label">Rôle</label>
                    <input type="text" class="form-input bg-slate-100" value="${roleDisplayMap[currentUserData.role] || currentUserData.role}" disabled>
                </div>
                 <div>
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input bg-slate-100" value="${currentUserData.email || ''}" disabled>
                </div>
                <div>
                    <label class="form-label" for="profilePhone">Téléphone</label>
                    <input type="tel" id="profilePhone" name="phone" class="form-input" value="${currentUserData.phone || ''}" autocomplete="tel">
                </div>
            </div>
            <div class="border-t pt-4 space-y-4">
                <div>
                    <label class="form-label" for="profilePassword">Nouveau mot de passe</label>
                    <input type="password" id="profilePassword" name="password" class="form-input" placeholder="Nouveau mot de passe" autocomplete="new-password">
                </div>
                <div>
                    <label class="form-label" for="profilePasswordConfirm">Confirmer le mot de passe</label>
                    <input type="password" id="profilePasswordConfirm" name="passwordConfirm" class="form-input" placeholder="Confirmer le mot de passe" autocomplete="new-password">
                </div>
                <p class="text-xs text-slate-500 mt-1">Laissez les champs de mot de passe vides si vous ne souhaitez pas le changer.</p>
            </div>
            <div class="text-right mt-6 flex justify-end gap-3">
                <button id="cancel-edit-btn" type="button" class="btn btn-secondary">Annuler</button>
                <button id="save-profile-btn" type="submit" class="btn btn-success"><i class="fas fa-save mr-2"></i>Sauvegarder</button>
            </div>
        </form>
    `;

    $('#cancel-edit-btn', viewContent)?.addEventListener('click', () => {
        renderDisplayView();
    });

    $('#profile-edit-form', viewContent)?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const submitButton = $('#save-profile-btn', form) as HTMLButtonElement;

        const originalBtnHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Sauvegarde...`;

        const formData = new FormData(form);
        const newPassword = formData.get('password') as string;
        const confirmPassword = formData.get('passwordConfirm') as string;

        if (newPassword && newPassword !== confirmPassword) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "Les mots de passe ne correspondent pas.", type: 'error' }
            }));
            submitButton.disabled = false;
            submitButton.innerHTML = originalBtnHtml;
            return;
        }
        
        const updatedData: Partial<User> = {
            id: currentUserData.id,
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            phone: formData.get('phone') as string,
        };

        if (newPassword) {
            updatedData.password = newPassword;
        }

        try {
            const api = ApiService.getInstance();
            const updatedUser = await api.updateCurrentUserProfile(updatedData);

            if (updatedUser) {
                // Success case: API service showed success toast
                const dataService = DataService.getInstance();
                dataService.invalidateUsersCache(); // Invalidate cache

                currentUserData = updatedUser;
                
                // Dispatch event to update user info in other components like the header
                viewContent.dispatchEvent(new CustomEvent('updateCurrentUser', {
                    detail: { user: updatedUser },
                    bubbles: true,
                    composed: true
                }));
                
                renderDisplayView(); // This replaces the form, so no need to restore button
            } else {
                // Failure case: API service returned null and should have shown an error toast.
                // We just need to restore the button to allow another attempt.
                submitButton.disabled = false;
                submitButton.innerHTML = originalBtnHtml;
            }
        } catch (error) {
            // This would catch network errors or other unexpected issues not handled by the API service.
            console.error("Failed to update profile due to an exception:", error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "Une erreur réseau est survenue. Veuillez réessayer.", type: 'error' }
            }));
            submitButton.disabled = false;
            submitButton.innerHTML = originalBtnHtml;
        }
    });
}

// Main export function
export async function renderProfileView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const fullUser = await dataService.getUserById(user.id);
    if (!fullUser) {
        return createCard('Erreur', 'Utilisateur non trouvé.', 'fa-exclamation-triangle');
    }
    
    // De-structure name into firstName/lastName if not present
    if (!fullUser.firstName && !fullUser.lastName && fullUser.name) {
        const nameParts = fullUser.name.split(' ');
        fullUser.firstName = nameParts[0];
        fullUser.lastName = nameParts.slice(1).join(' ');
    }

    currentUserData = fullUser;

    viewContent = document.createElement('div');
    renderDisplayView();

    return createCard('Mon Profil', viewContent, 'fa-user-circle');
}