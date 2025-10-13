
import { createCard } from '../components/Card';
import { ApiService } from '../services/api.service';
import { RechargePaymentMethod } from '../models';
import { AdminEditRechargeMethodModal } from '../components/modals/AdminEditRechargeMethodModal';
import { DataService } from '../services/data.service';

let currentContainer: HTMLElement | null = null;
let editModal: AdminEditRechargeMethodModal | null = null;

async function loadRechargeMethodData() {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    return await Promise.all([
        api.getRechargePaymentMethods(),
        dataService.getAgentRechargeRequests()
    ]);
}

async function refreshRechargeMethodView() {
    if (!currentContainer) return;
    
    // Afficher un indicateur de chargement
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'flex items-center justify-center p-8';
    loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mise à jour des données...';
    
    // Remplacer le contenu temporairement
    const originalContent = currentContainer.innerHTML;
    currentContainer.innerHTML = '';
    currentContainer.appendChild(loadingIndicator);

    try {
        const [methods, allRechargeRequests] = await loadRechargeMethodData();

        // Reconstruire le contenu
        currentContainer.innerHTML = '';
        await renderContent(methods, allRechargeRequests);

        // Afficher un message de succès
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Modes de recharge mis à jour', type: 'success' }
        }));

    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        currentContainer.innerHTML = originalContent;
        
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Erreur lors de la mise à jour des données', type: 'error' }
        }));
    }
}

async function renderContent(methods: RechargePaymentMethod[], allRechargeRequests: any[]) {
    if (!currentContainer) return;
    
    currentContainer.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Modes de Paiement pour Recharge Agent</h2>
                <p class="text-sm text-gray-500">Configurez les options et frais pour les demandes de recharge des agents.</p>
            </div>
            <button id="createNewMethodBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Nouveau Mode</button>
        </div>
    `;

    if (methods.length === 0) {
        currentContainer.innerHTML += `<p class="text-center text-slate-500 p-4">Aucun mode de paiement configuré.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        methods.forEach(method => {
            // Compter les demandes qui utilisent cette méthode (pour information)
            const usageCount = allRechargeRequests.filter(r => r.methodId === method.id).length;
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
                     <button class="btn btn-sm btn-danger" data-action="delete-method" data-method-id="${method.id}" data-method-name="${method.name}" data-usage-count="${usageCount}" title="${usageCount > 0 ? `Supprimer cette méthode et ses ${usageCount} demandes associées` : 'Supprimer cette méthode'}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
        currentContainer.appendChild(list);
    }
    
    attachEventListeners(methods);
}

function attachEventListeners(methods: RechargePaymentMethod[]) {
    if (!currentContainer || !editModal) return;
    
    currentContainer.querySelector('#createNewMethodBtn')?.addEventListener('click', () => {
        editModal!.show(); // Show modal for creation
    });

    currentContainer.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-action="edit-method"]');
        if (editButton) {
            const methodId = editButton.dataset.methodId;
            const methodToEdit = methods.find(m => m.id === methodId);
            if (methodToEdit) {
                editModal!.show(methodToEdit);
            }
        }
        
        const deleteButton = target.closest<HTMLButtonElement>('[data-action="delete-method"]');
        if (deleteButton) {
            const methodId = deleteButton.dataset.methodId!;
            const methodName = deleteButton.dataset.methodName!;
            const usageCount = parseInt(deleteButton.dataset.usageCount || '0');
            
            const title = 'Confirmer la Suppression';
            const message = usageCount > 0
                ? `Attention ! Le mode de paiement "<strong>${methodName}</strong>" est utilisé dans <strong>${usageCount}</strong> demande(s) de recharge. Supprimer cette méthode supprimera également toutes les demandes associées. Cette action est irréversible.`
                : `Voulez-vous vraiment supprimer le mode de paiement "<strong>${methodName}</strong>" ? Cette action est irréversible.`;
            
            document.body.dispatchEvent(new CustomEvent('openConfirmationModal', {
                detail: {
                    title,
                    message,
                    onConfirm: async () => {
                        try {
                            const api = ApiService.getInstance();
                            const success = await api.deleteRechargePaymentMethod(methodId);
                            
                            if (success) {
                                const successMessage = usageCount > 0 
                                    ? `Mode de paiement et ${usageCount} demande(s) associée(s) supprimé(s).`
                                    : 'Mode de paiement supprimé.';
                                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: successMessage, type: 'success' } }));
                                document.body.dispatchEvent(new CustomEvent('rechargeMethodDeleted', { bubbles: true, composed: true }));
                            } else {
                                document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Erreur lors de la suppression du mode de paiement.', type: 'error' } }));
                            }
                        } catch (error) {
                            console.error('Erreur lors de la suppression:', error);
                            document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Erreur lors de la suppression du mode de paiement.', type: 'error' } }));
                        }
                    },
                    options: { 
                        confirmButtonClass: 'btn-danger', 
                        confirmButtonText: usageCount > 0 ? 'Oui, Supprimer Tout' : 'Oui, Supprimer' 
                    }
                },
                bubbles: true, composed: true
            }));
        }
    });
}

export async function renderAdminManageRechargeMethodsView(): Promise<HTMLElement> {
    const [methods, allRechargeRequests] = await loadRechargeMethodData();
    
    const container = document.createElement('div');
    currentContainer = container;
    editModal = new AdminEditRechargeMethodModal();

    await renderContent(methods, allRechargeRequests);
    
    const card = createCard('Configuration des Modes de Paiement', container, 'fa-cash-register');
    card.id = 'admin-recharge-methods-card';

    // Ajouter les écouteurs d'événements pour la mise à jour automatique
    const refreshEventHandler = () => {
        refreshRechargeMethodView();
    };

    // Écouter les événements qui nécessitent une mise à jour
    document.body.addEventListener('rechargeMethodCreated', refreshEventHandler);
    document.body.addEventListener('rechargeMethodUpdated', refreshEventHandler);
    document.body.addEventListener('rechargeMethodDeleted', refreshEventHandler);
    document.body.addEventListener('rechargeMethodsUpdated', refreshEventHandler); // Garder pour compatibilité

    // Nettoyer les écouteurs quand la vue est détruite
    card.addEventListener('beforeunload', () => {
        document.body.removeEventListener('rechargeMethodCreated', refreshEventHandler);
        document.body.removeEventListener('rechargeMethodUpdated', refreshEventHandler);
        document.body.removeEventListener('rechargeMethodDeleted', refreshEventHandler);
        document.body.removeEventListener('rechargeMethodsUpdated', refreshEventHandler);
        currentContainer = null;
        editModal = null;
    });

    return card;
}
