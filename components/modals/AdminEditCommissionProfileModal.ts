import { BaseModal } from "./BaseModal";
import { CommissionProfile, CommissionTier } from "../../models";
import { $ } from "../../utils/dom";
import { ApiService } from "../../services/api.service";

export class AdminEditCommissionProfileModal extends BaseModal {
    private form: HTMLFormElement;
    private editingProfile: CommissionProfile | null = null;
    private tierCounter = 0;

    constructor() {
        super('adminEditCommissionProfileModal', { size: 'lg' });
        this.render();
        this.form = this.modalElement.querySelector('form') as HTMLFormElement;
        this.attachListeners();
    }

    private render() {
        const title = "Éditer le Profil de Commission";
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="editCommissionProfileForm" novalidate>
                <input type="hidden" name="id">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label" for="profileName">Nom du profil</label>
                        <input type="text" id="profileName" name="name" class="form-input" required placeholder="Ex: Grille Standard">
                    </div>
                     <div>
                        <label class="form-label" for="partageSociete">Part de la Société (%)</label>
                        <input type="number" id="partageSociete" name="partageSociete" class="form-input" required min="0" max="100" placeholder="Ex: 40">
                    </div>
                </div>
                
                <h4 class="font-semibold text-slate-700 mt-6 mb-2">Paliers de Frais de Service</h4>
                <div id="tiers-container" class="space-y-2 border-b pb-3">
                    <!-- Dynamic tier rows -->
                </div>
                <button type="button" id="add-tier-btn" class="btn btn-sm btn-outline-secondary mt-3"><i class="fas fa-plus mr-2"></i>Ajouter un palier</button>
            </form>
        `;
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2 mt-6 pt-4 border-t';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="editCommissionProfileForm" class="btn btn-success"><i class="fas fa-save mr-2"></i>Enregistrer</button>
        `;

        this.setContent(title, body, footer);
    }

    public show(profile?: CommissionProfile) {
        this.editingProfile = profile || null;
        this.updateTitle();
        this.populateForm();
        super.show();
    }

    private updateTitle() {
        const titleEl = this.modalElement.querySelector('h3');
        if (titleEl) {
            titleEl.textContent = this.editingProfile ? `Éditer: ${this.editingProfile.name}` : "Créer un Nouveau Profil de Commission";
        }
    }

    private addTierRow(tier?: CommissionTier) {
        this.tierCounter++;
        const tierRow = document.createElement('div');
        tierRow.className = 'tier-row grid grid-cols-12 gap-2 items-center';
        tierRow.dataset.tierId = String(this.tierCounter);

        tierRow.innerHTML = `
            <div class="col-span-3">
                <input type="number" name="from_${this.tierCounter}" class="form-input form-input-sm" placeholder="De (XOF)" value="${tier?.from || ''}" required>
            </div>
            <div class="col-span-3">
                <input type="number" name="to_${this.tierCounter}" class="form-input form-input-sm" placeholder="À (XOF)" value="${tier?.to === Infinity ? '' : tier?.to || ''}">
            </div>
            <div class="col-span-3">
                <select name="type_${this.tierCounter}" class="form-select form-select-sm" required>
                    <option value="fixed" ${tier?.type === 'fixed' ? 'selected' : ''}>Fixe (XOF)</option>
                    <option value="percentage" ${tier?.type === 'percentage' ? 'selected' : ''}>Pourcentage (%)</option>
                </select>
            </div>
            <div class="col-span-2">
                <input type="number" step="0.01" name="value_${this.tierCounter}" class="form-input form-input-sm" placeholder="Valeur" value="${tier?.value || ''}" required>
            </div>
            <div class="col-span-1 text-right">
                 <button type="button" class="btn btn-xs btn-danger" data-action="remove-tier"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        $('#tiers-container', this.form)?.appendChild(tierRow);
    }

    private populateForm() {
        this.form.reset();
        ($('#tiers-container', this.form) as HTMLElement).innerHTML = '';
        this.tierCounter = 0;

        (this.form.querySelector('input[name="id"]') as HTMLInputElement).value = this.editingProfile?.id || '';
        ($('#profileName', this.form) as HTMLInputElement).value = this.editingProfile?.name || '';
        ($('#partageSociete', this.form) as HTMLInputElement).value = String(this.editingProfile?.partageSociete || 40);

        if (this.editingProfile && this.editingProfile.tiers.length > 0) {
            this.editingProfile.tiers.forEach(tier => this.addTierRow(tier));
        } else {
            this.addTierRow(); // Add one empty row for new profiles
        }
    }

    private attachListeners() {
        $('#add-tier-btn', this.form)?.addEventListener('click', () => this.addTierRow());

        $('#tiers-container', this.form)?.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const removeBtn = target.closest<HTMLButtonElement>('[data-action="remove-tier"]');
            if (removeBtn) {
                removeBtn.closest('.tier-row')?.remove();
            }
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.form.checkValidity()) {
                this.form.reportValidity();
                return;
            }

            const tiers: CommissionTier[] = [];
            this.form.querySelectorAll('.tier-row').forEach(row => {
                const id = (row as HTMLElement).dataset.tierId;
                const from = parseInt((row.querySelector(`input[name="from_${id}"]`) as HTMLInputElement).value, 10);
                const toStr = (row.querySelector(`input[name="to_${id}"]`) as HTMLInputElement).value;
                const to = toStr ? parseInt(toStr, 10) : Infinity;
                
                tiers.push({
                    from: from,
                    to: to,
                    type: (row.querySelector(`select[name="type_${id}"]`) as HTMLSelectElement).value as 'fixed' | 'percentage',
                    value: parseFloat((row.querySelector(`input[name="value_${id}"]`) as HTMLInputElement).value)
                });
            });

            const formData = new FormData(this.form);
            const profileData: CommissionProfile = {
                id: formData.get('id') as string,
                name: formData.get('name') as string,
                partageSociete: parseInt(formData.get('partageSociete') as string, 10),
                tiers: tiers
            };

            const submitButton = this.modalElement.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalHtml = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Enregistrement...`;

            try {
                const api = ApiService.getInstance();
                await api.updateCommissionProfile(profileData);
                document.body.dispatchEvent(new CustomEvent('commissionProfilesUpdated'));
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Profil de commission enregistré !", type: 'success' } }));
                this.hide();
            } catch (error) {
                 console.error("Failed to save commission profile", error);
                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Une erreur s'est produite.", type: 'error' } }));
            } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = originalHtml;
            }
        });
    }
}