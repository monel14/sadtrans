import { createCard } from '../components/Card';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { CardType, Partner, Order } from '../models';
import { AdminEditCardTypeModal } from '../components/modals/AdminEditCardTypeModal';
import { AdminCreateOrderModal } from '../components/modals/AdminCreateOrderModal';
import { $ } from '../utils/dom';
import { formatAmount, formatDate, formatNumber } from '../utils/formatters';

// --- Card Types Tab ---
async function renderCardTypesTabContent(container: HTMLElement, api: ApiService, dataService: DataService, editModal: AdminEditCardTypeModal) {
    const cardTypes = await dataService.getCardTypes();
    
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Types de Cartes Prépayées</h3>
                <p class="text-sm text-gray-500">Gérez les types de cartes disponibles pour les opérations de recharge.</p>
            </div>
            <button id="createNewCardTypeBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Type</button>
        </div>
        <ul id="card-types-list" class="space-y-3"></ul>
    `;

    const list = $('#card-types-list', container) as HTMLUListElement;

    if (cardTypes.length === 0) {
        list.innerHTML = `<li class="text-center text-slate-500 p-4">Aucun type de carte configuré.</li>`;
    } else {
        cardTypes.forEach(cardType => {
            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold text-slate-800">${cardType.name}</p>
                </div>
                <div class="flex items-center gap-4 w-full sm:w-auto">
                     <span class="badge ${cardType.status === 'active' ? 'badge-success' : 'badge-gray'}">${cardType.status === 'active' ? 'Actif' : 'Inactif'}</span>
                     <button class="btn btn-sm btn-outline-secondary" data-action="edit-card-type" data-card-type-id="${cardType.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    // Attach listeners specific to this tab
    container.querySelector('#createNewCardTypeBtn')?.addEventListener('click', () => {
        editModal.show(); 
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-action="edit-card-type"]');
        if (editButton) {
            const typeId = editButton.dataset.cardTypeId;
            const typeToEdit = cardTypes.find(m => m.id === typeId);
            if (typeToEdit) {
                editModal.show(typeToEdit);
            }
        }
    });
}

// --- Orders Tab ---
async function renderOrdersTabContent(container: HTMLElement, api: ApiService, dataService: DataService, createOrderModal: AdminCreateOrderModal, cardTypes: CardType[]) {
    const [orders, partnerMap, cardTypeMap] = await Promise.all([
        dataService.getOrders(),
        dataService.getPartnerMap(),
        dataService.getCardTypeMap()
    ]);
    
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Bons de Commande des Partenaires</h3>
                <p class="text-sm text-gray-500">Enregistrez et suivez les commandes de cartes des agences.</p>
            </div>
            <button id="createNewOrderBtn" class="btn btn-primary w-full md:w-auto"><i class="fas fa-receipt mr-2"></i>Enregistrer une commande</button>
        </div>
        <ul id="orders-list" class="space-y-3"></ul>
    `;

    const list = $('#orders-list', container) as HTMLUListElement;

    if (orders.length === 0) {
        list.innerHTML = `<li class="text-center text-slate-500 p-4">Aucune commande enregistrée.</li>`;
    } else {
        orders.forEach(order => {
            const partner = partnerMap.get(order.partnerId);
            const li = document.createElement('li');
            li.className = 'card !p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center';
            li.innerHTML = `
                <div class="sm:col-span-2">
                    <p class="font-semibold text-slate-800">${order.id}</p>
                    <p class="text-sm text-slate-600">Partenaire: <strong>${partner?.name || 'Inconnu'}</strong></p>
                    <p class="text-xs text-slate-400">Date: ${formatDate(order.date)}</p>
                </div>
                <div class="text-left sm:text-right">
                    <p class="font-semibold text-slate-700">${formatNumber(order.totalCards)} cartes</p>
                    <p class="text-sm text-slate-500">Total: <strong>${formatAmount(order.totalAmount)}</strong></p>
                </div>
                <div class="flex items-center gap-2 justify-self-end">
                    <span class="badge ${order.status === 'livré' ? 'badge-success' : 'badge-warning'}">${order.status}</span>
                    <button class="btn btn-xs btn-outline-secondary" data-action="toggle-details" data-order-id="${order.id}">
                        Détails <i class="fas fa-chevron-down ml-1 text-xs transition-transform"></i>
                    </button>
                    <button class="btn btn-xs btn-outline-secondary" title="Marquer comme livré"><i class="fas fa-check"></i></button>
                </div>
                <div id="details-${order.id}" class="hidden mt-4 pt-4 border-t col-span-full">
                    <h5 class="font-semibold text-sm mb-2">Détail de la commande</h5>
                    <ul class="space-y-1 text-sm">
                        ${order.items.map(item => {
                            const cardType = cardTypeMap.get(item.cardTypeId);
                            return `<li class="flex justify-between p-1 bg-slate-50 rounded">
                                        <span>${item.quantity} x ${cardType?.name || 'Inconnu'}</span>
                                        <div class="flex gap-4">
                                            <span>@ ${formatAmount(item.unitPrice)}</span>
                                            <span class="font-semibold w-28 text-right">${formatAmount(item.quantity * item.unitPrice)}</span>
                                        </div>
                                    </li>`;
                        }).join('')}
                    </ul>
                </div>
            `;
            list.appendChild(li);
        });
    }

    container.querySelector('#createNewOrderBtn')?.addEventListener('click', () => {
        createOrderModal.show();
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const toggleBtn = target.closest<HTMLButtonElement>('[data-action="toggle-details"]');
        if (toggleBtn) {
            const orderId = toggleBtn.dataset.orderId;
            const detailsDiv = container.querySelector(`#details-${orderId}`);
            detailsDiv?.classList.toggle('hidden');
            toggleBtn.querySelector('i')?.classList.toggle('rotate-180');
        }
    });
}


// --- Main View ---
export async function renderAdminCardManagementView(): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    const [partners, cardTypes] = await Promise.all([
        dataService.getPartners(),
        dataService.getCardTypes(),
    ]);
    const editModal = new AdminEditCardTypeModal();
    const createOrderModal = new AdminCreateOrderModal(partners, cardTypes);
    
    const viewContainer = document.createElement('div');
    viewContainer.innerHTML = `
        <div class="tabs mb-6">
            <button data-tab="orders" class="active">Commandes</button>
            <button data-tab="types">Types de Cartes</button>
        </div>
        <div id="card-management-content">
            <!-- Tab content will be rendered here -->
        </div>
    `;

    const card = createCard('Gestion des Cartes Prépayées', viewContainer, 'fa-credit-card');
    card.id = 'admin-card-management-view-wrapper';
    
    const contentContainer = $('#card-management-content', card) as HTMLElement;
    
    async function switchTab(tabName: 'types' | 'orders') {
        contentContainer.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
        if (tabName === 'types') {
            await renderCardTypesTabContent(contentContainer, api, dataService, editModal);
        } else if (tabName === 'orders') {
            await renderOrdersTabContent(contentContainer, api, dataService, createOrderModal, cardTypes);
        }
    }

    card.querySelector('.tabs')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            const tabName = target.dataset.tab as 'types' | 'orders';
            if (tabName) switchTab(tabName);
        }
    });

    document.body.addEventListener('cardTypesUpdated', async () => {
        const activeTab = card.querySelector<HTMLButtonElement>('.tabs button.active')?.dataset.tab;
        if(activeTab === 'types') {
            await switchTab('types');
        }
    });
    
    document.body.addEventListener('orderCreated', async () => {
        const activeTab = card.querySelector<HTMLButtonElement>('.tabs button.active')?.dataset.tab;
        if(activeTab === 'orders') {
            const newCardTypes = await dataService.getCardTypes(); // Re-fetch in case they changed
            await renderOrdersTabContent(contentContainer, api, dataService, createOrderModal, newCardTypes);
        }
    });

    // Initial load
    await switchTab('orders');
    
    return card;
}