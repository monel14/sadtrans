export class SimpleCommissionModal {
    private modalElement: HTMLElement | null = null;

    public async show(): Promise<void> {
        // Créer le modal s'il n'existe pas
        if (!this.modalElement) {
            this.createModal();
        }

        // Afficher le modal
        this.modalElement!.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    public hide(): void {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    private createModal(): void {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        this.modalElement.style.display = 'none';

        this.modalElement.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Configuration par Défaut</h3>
                    <button class="text-gray-500 hover:text-gray-700" data-action="close">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <form id="simpleCommissionForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Type de Commission</label>
                        <select id="commissionType" name="type" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            <option value="fixed">Montant Fixe</option>
                            <option value="percentage">Pourcentage</option>
                            <option value="tiers">Par Paliers</option>
                        </select>
                    </div>

                    <div id="fixedConfig" style="display: none;">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Montant Fixe (FCFA)</label>
                        <input type="number" name="amount" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" step="1">
                    </div>

                    <div id="percentageConfig" style="display: none;">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Taux de Commission (%)</label>
                        <input type="number" name="rate" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" max="100" step="0.1">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Part Société (%)</label>
                        <input type="number" name="partageSociete" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="50" min="0" max="100" step="1" required>
                        <p class="text-xs text-gray-500 mt-1">Pourcentage de la commission qui revient à la société</p>
                    </div>
                </form>

                <div class="flex justify-end gap-3 mt-6">
                    <button type="button" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50" data-action="cancel">Annuler</button>
                    <button type="button" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" data-action="save">
                        <i class="fas fa-save mr-2"></i>Sauvegarder
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);
        this.attachEventListeners();
    }

    private attachEventListeners(): void {
        if (!this.modalElement) return;

        const typeSelect = this.modalElement.querySelector('#commissionType') as HTMLSelectElement;
        const fixedConfig = this.modalElement.querySelector('#fixedConfig') as HTMLElement;
        const percentageConfig = this.modalElement.querySelector('#percentageConfig') as HTMLElement;

        // Gestion du changement de type
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            fixedConfig.style.display = type === 'fixed' ? 'block' : 'none';
            percentageConfig.style.display = type === 'percentage' ? 'block' : 'none';
        });

        // Gestion des clics
        this.modalElement.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            if (target.closest('[data-action="close"]') || target.closest('[data-action="cancel"]')) {
                this.hide();
            } else if (target.closest('[data-action="save"]')) {
                this.saveConfig();
            } else if (target === this.modalElement) {
                this.hide();
            }
        });

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalElement?.style.display === 'flex') {
                this.hide();
            }
        });
    }

    private async saveConfig(): Promise<void> {
        const form = this.modalElement?.querySelector('#simpleCommissionForm') as HTMLFormElement;
        if (!form) return;

        const formData = new FormData(form);
        const config = {
            type: formData.get('type'),
            amount: formData.get('amount') ? Number(formData.get('amount')) : undefined,
            rate: formData.get('rate') ? Number(formData.get('rate')) : undefined,
            partageSociete: Number(formData.get('partageSociete'))
        };

        console.log('Saving config:', config);
        
        // Afficher un message de succès
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Configuration sauvegardée avec succès', type: 'success' }
        }));

        this.hide();
    }
}
