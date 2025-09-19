
import { createCard } from '../components/Card';
import { ApiService } from '../services/api.service';
import { RechargePaymentMethod } from '../models';
import { AdminEditRechargeMethodModal } from '../components/modals/AdminEditRechargeMethodModal';
import { DataService } from '../services/data.service';

export async function renderAdminManageRechargeMethodsView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    const container = document.createElement('div');
    const editModal = new AdminEditRechargeMethodModal();

    async function renderContent() {
        const [methods, allRechargeRequests] = await Promise.all([
            api.getRechargePaymentMethods(),
            dataService.getAgentRechargeRequests()
        ]);
        
        container.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Modes de Paiement pour Recharge Agent</h2>
                    <p class="text-sm text-gray-500">Configurez les options et frais pour les demandes de recharge des agents.</p>
                </div>
                <button id="createNewMethodBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Nouveau Mode</button>
            </div>
        `;

        if (methods.length === 0) {
            container.innerHTML += `<p class="text-center text-slate-500 p-4">Aucun mode de paiement configuré.</p>`;
        } else {
            const list = document.createElement('ul');
            list.className = 'space-y-3';
            methods.forEach(method => {
                const isInUse = allRechargeRequests.some(r => r.methodId === method.id);
                let feeValueDisplay = 'Aucun';
                if (method.feeType === 'fixed') {
                    feeValueDisplay = `${method.feeValue} XOF (Fixe)`;
                } else if (method.feeType === 'percentage') {
                    feeValueDisplay = `${method.feeValue}%`;
                }

                const li = document.createElement('li');
                li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
                li.innerHTML = `
                    <div class="flex-grow">
                        <p class="font-semibold text-slate-800">${method.name}</p>
                        <p class="text-sm text-slate-500">Frais: <strong>${feeValueDisplay}</strong></p>
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                         <span class="badge ${method.status === 'active' ? 'badge-success' : 'badge-gray'}">${method.status === 'active' ? 'Actif' : 'Inactif'}</span>
                         <button class="btn btn-sm btn-outline-secondary" data-action="edit-method" data-method-id="${method.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                         <button class="btn btn-sm btn-danger" data-action="delete-method" data-method-id="${method.id}" data-method-name="${method.name}" ${isInUse ? 'disabled' : ''} title="${isInUse ? 'Méthode utilisée, ne peut être supprimée.' : 'Supprimer'}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;
                list.appendChild(li);
            });
            container.appendChild(list);
        }
        
        attachEventListeners(methods);
    }
    
    function attachEventListeners(methods: RechargePaymentMethod[]) {
        container.querySelector('#createNewMethodBtn')?.addEventListener('click', () => {
            editModal.show(); // Show modal for creation
        });

        container.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const editButton = target.closest<HTMLButtonElement>('[data-action="edit-method"]');
            if (editButton) {
                const methodId = editButton.dataset.methodId;
                const methodToEdit = methods.find(m => m.id === methodId);
                if (methodToEdit) {
                    editModal.show(methodToEdit);
                }
            }
            
            const deleteButton = target.closest<HTMLButtonElement>('[data-action="delete-method"]');
            if (deleteButton) {
                const methodId = deleteButton.dataset.methodId!;
                const methodName = deleteButton.dataset.methodName!;
                document.body.dispatchEvent(new CustomEvent('openConfirmationModal', {
                    detail: {
                        title: 'Confirmer la Suppression',
                        message: `Voulez-vous vraiment supprimer le mode de paiement "<strong>${methodName}</strong>" ? Cette action est irréversible.`,
                        onConfirm: async () => {
                            await api.deleteRechargePaymentMethod(methodId);
                            document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Mode de paiement supprimé.', type: 'success' } }));
                            document.body.dispatchEvent(new CustomEvent('rechargeMethodsUpdated'));
                        },
                        options: { confirmButtonClass: 'btn-danger', confirmButtonText: 'Oui, Supprimer' }
                    },
                    bubbles: true, composed: true
                }));
            }
        });
    }

    // Listen for the custom event to re-render
    document.body.addEventListener('rechargeMethodsUpdated', async () => {
        // Find the wrapper card and replace its content to re-render
        const cardWrapper = document.getElementById('admin-recharge-methods-card');
        if (cardWrapper) {
            const newContent = await renderAdminManageRechargeMethodsView();
            cardWrapper.parentElement?.replaceChild(newContent, cardWrapper);
        }
    });

    await renderContent();
    const card = createCard('Configuration des Modes de Paiement', container, 'fa-cash-register');
    card.id = 'admin-recharge-methods-card';
    return card;
}
