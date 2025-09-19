import { BaseModal } from "./BaseModal";
import { User } from "../../models";
import { ApiService } from "../../services/api.service";
import { $ } from "../../utils/dom";

export class PartnerEditAgentModal extends BaseModal {
    private form: HTMLFormElement;
    private editingAgent: User | null = null;
    private partnerId: string | null = null;

    constructor() {
        super('partnerEditAgentModal', { size: 'md' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Créer / Modifier un Utilisateur"; // Will be updated in show()
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="partnerEditAgentForm" class="space-y-4">
                <input type="hidden" name="id">
                <div>
                    <label class="form-label" for="agentName">Nom Complet</label>
                    <input type="text" id="agentName" name="name" class="form-input" required>
                </div>
                <div>
                    <label class="form-label" for="agentEmail">Adresse Email</label>
                    <input type="email" id="agentEmail" name="email" class="form-input" required>
                </div>
                <div>
                    <label class="form-label" for="agentPhone">Téléphone</label>
                    <input type="tel" id="agentPhone" name="phone" class="form-input" autocomplete="tel">
                </div>

                <div id="password-section">
                    <!-- Password fields will be rendered dynamically -->
                </div>

                <div class="border-t pt-4">
                    <label class="form-label">Statut du Compte</label>
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span id="statusLabel" class="font-medium text-slate-700">Actif</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="agentStatus" name="status" value="active" class="sr-only peer">
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
            <button type="submit" form="partnerEditAgentForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    private agencyId: string | null = null;

    public show(agent: User | null, partnerId: string, agencyId?: string) {
        this.editingAgent = agent;
        this.partnerId = partnerId;
        this.agencyId = agencyId || null;
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = this.editingAgent ? `Modifier: ${this.editingAgent.name}` : "Créer un Nouveau Compte Utilisateur";
        }
    }

    private populateForm() {
        this.form.reset();
        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = this.editingAgent?.id || '';
        ($('#agentName', this.form) as HTMLInputElement).value = this.editingAgent?.name || '';
        ($('#agentEmail', this.form) as HTMLInputElement).value = this.editingAgent?.email || '';
        ($('#agentPhone', this.form) as HTMLInputElement).value = this.editingAgent?.phone || '';

        const passwordSection = $('#password-section', this.form) as HTMLElement;
        if (this.editingAgent) {
            passwordSection.innerHTML = `
                <div class="border-t pt-4">
                    <label class="form-label">Réinitialiser le mot de passe</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <input type="password" name="password" class="form-input" placeholder="Nouveau mot de passe" autocomplete="new-password">
                        </div>
                        <div>
                            <input type="password" name="passwordConfirm" class="form-input" placeholder="Confirmer le mot de passe" autocomplete="new-password">
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Laissez vide pour ne pas changer le mot de passe.</p>
                </div>
            `;
        } else {
            passwordSection.innerHTML = `
                <div class="border-t pt-4">
                    <label class="form-label text-slate-400">Mot de passe</label>
                    <input type="password" class="form-input bg-slate-100" placeholder="Sera défini par un admin" disabled>
                    <p class="text-xs text-slate-500 mt-1">Un mot de passe par défaut sera assigné. L'agent devra le changer à la première connexion.</p>
                </div>
            `;
        }


        const statusToggle = $('#agentStatus', this.form) as HTMLInputElement;
        statusToggle.checked = !this.editingAgent || this.editingAgent.status === 'active';
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
        const statusToggle = $('#agentStatus', this.form) as HTMLInputElement;
        statusToggle?.addEventListener('change', () => {
            this.updateStatusLabel(statusToggle.checked);
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.partnerId) return;

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const formData = new FormData(this.form);
                const statusToggle = $('#agentStatus', this.form) as HTMLInputElement;

                const newPassword = formData.get('password') as string;
                const confirmPassword = formData.get('passwordConfirm') as string;

                if (this.editingAgent && newPassword && newPassword !== confirmPassword) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: "Les mots de passe ne correspondent pas.", type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHtml;
                    return;
                }

                const agentData: Partial<User> = {
                    id: this.editingAgent?.id,
                    name: formData.get('name') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                    status: statusToggle.checked ? 'active' : 'suspended',
                };
                
                if (!this.editingAgent) {
                    agentData.role = 'agent';
                    agentData.partnerId = this.partnerId;
                    agentData.agencyId = this.agencyId;
                }
                
                if (this.editingAgent && newPassword) {
                    agentData.password = newPassword;
                }

                const api = ApiService.getInstance();
                await api.updateAgent(agentData);

                let toastMessage = this.editingAgent ? "Agent mis à jour avec succès." : "Agent créé avec succès.";
                if (this.editingAgent && newPassword) {
                    toastMessage = "Agent mis à jour et mot de passe changé avec succès.";
                }

                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: toastMessage, type: 'success' } }));
                document.body.dispatchEvent(new CustomEvent('agentUpdated', { bubbles: true, composed: true }));
                this.hide();

            } catch (error) {
                const errorMessage = (error instanceof Error) ? error.message : "Une erreur s'est produite lors de la sauvegarde.";
                console.error("Failed to update agent:", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: errorMessage, type: 'error' } }));
            } finally {
                if (submitButton.disabled) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHtml;
                }
            }
        });
    }
}