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
            passwordSection.innerHTML = ``;
        } else {
            passwordSection.innerHTML = `
                <div class="border-t pt-4">
                    <label class="form-label">Mot de passe</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <input type="password" name="password" class="form-input" placeholder="Mot de passe" autocomplete="new-password" required>
                        </div>
                        <div>
                            <input type="password" name="passwordConfirm" class="form-input" placeholder="Confirmer le mot de passe" autocomplete="new-password" required>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Veuillez définir un mot de passe pour le nouvel agent.</p>
                </div>
            `;
        }



    }



    private attachListeners() {

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.partnerId) return;

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalButtonHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const formData = new FormData(this.form);

                // Pour la création d'un nouvel agent, vérifier les mots de passe
                if (!this.editingAgent) {
                    const newPassword = formData.get('password') as string;
                    const confirmPassword = formData.get('passwordConfirm') as string;

                    if (!newPassword || !confirmPassword) {
                        document.body.dispatchEvent(new CustomEvent('showToast', {
                            detail: { message: "Veuillez saisir et confirmer un mot de passe.", type: 'error' }
                        }));
                        submitButton.disabled = false;
                        submitButton.innerHTML = originalButtonHtml;
                        return;
                    }

                    if (newPassword !== confirmPassword) {
                        document.body.dispatchEvent(new CustomEvent('showToast', {
                            detail: { message: "Les mots de passe ne correspondent pas.", type: 'error' }
                        }));
                        submitButton.disabled = false;
                        submitButton.innerHTML = originalButtonHtml;
                        return;
                    }
                }

                const agentData: Partial<User> = {
                    id: this.editingAgent?.id,
                    name: formData.get('name') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                     status: this.editingAgent ? this.editingAgent.status : 'active',
                };

                if (!this.editingAgent) {
                    agentData.role = 'agent';
                    agentData.partnerId = this.partnerId;
                    agentData.agencyId = this.agencyId || undefined;
                } else {
                    // Pour les agents existants, conserver le rôle existant
                    agentData.role = this.editingAgent.role;
                    agentData.partnerId = this.editingAgent.partnerId;
                    agentData.agencyId = this.editingAgent.agencyId;
                }

                // Pour un nouvel agent, inclure le mot de passe
                if (!this.editingAgent) {
                    const newPassword = formData.get('password') as string;
                    agentData.password = newPassword;
                }

                const api = ApiService.getInstance();

                // Mettre à jour les données de l'agent (inclut maintenant la gestion du mot de passe)
                await api.updateAgent(agentData);

                let toastMessage;
                if (this.editingAgent) {
                    toastMessage = "Agent mis à jour avec succès.";
                } else {
                    toastMessage = "Agent créé avec succès et mot de passe défini.";
                }

                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: toastMessage, type: 'success' } }));
                document.body.dispatchEvent(new CustomEvent('agentUpdated', { bubbles: true, composed: true }));
                
                // Déclencher aussi l'événement de mise à jour des partenaires
                document.body.dispatchEvent(new CustomEvent('partnerUpdated', { bubbles: true, composed: true }));
                
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