import { createCard } from '../components/Card';
import { ApiService } from '../services/api.service';
import { RechargePaymentMethod } from '../models';
import { AdminEditRechargeMethodModal } from '../components/modals/AdminEditRechargeMethodModal';

export async function renderAdminManageRechargeMethodsView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const container = document.createElement('div');
    const editModal = new AdminEditRechargeMethodModal();

    async function renderContent() {
        const methods = await api.getRechargePaymentMethods();
        
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
                    <div class="flex items-center gap-4 w-full sm:w-auto">
                         <span class="badge ${method.status === 'active' ? 'badge-success' : 'badge-gray'}">${method.status === 'active' ? 'Actif' : 'Inactif'}</span>
                         <button class="btn btn-sm btn-outline-secondary" data-method-id="${method.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
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
            const editButton = target.closest<HTMLButtonElement>('[data-method-id]');
            if (editButton) {
                const methodId = editButton.dataset.methodId;
                const methodToEdit = methods.find(m => m.id === methodId);
                if (methodToEdit) {
                    editModal.show(methodToEdit);
                }
            }
        });
    }

    // Listen for the custom event to re-render
    document.body.addEventListener('rechargeMethodsUpdated', async () => {
        const newContent = await renderAdminManageRechargeMethodsView();
        container.parentElement?.replaceChild(newContent, container);
    });

    await renderContent();
    const card = createCard('Configuration des Modes de Paiement', container, 'fa-cash-register');
    return card;
}
