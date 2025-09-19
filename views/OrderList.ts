
import { createCard } from '../components/Card';
import { User } from '../models';
import { ApiService } from '../services/api.service';
import { formatDate, formatAmount } from '../utils/formatters';
import { DataService } from '../services/data.service';

export async function renderOrderListView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const orders = await dataService.getOrders({ partnerId: user.partnerId });

    const container = document.createElement('div');

    if (orders.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 p-4">Aucun bon de commande trouvé.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        orders.forEach(order => {
            const li = document.createElement('li');
            li.className = 'card !p-4';
            li.innerHTML = `
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div class="flex-grow">
                        <p class="font-semibold text-slate-800">${order.id}</p>
                        <p class="text-sm text-slate-500">Commandé le: ${formatDate(order.date)}</p>
                        <p class="text-sm text-slate-500">Livré par: ${order.deliveredBy}</p>
                    </div>
                     <div class="flex items-center gap-4 w-full sm:w-auto">
                        <span class="badge ${order.status === 'livré' ? 'badge-success' : 'badge-warning'}">${order.status}</span>
                        <p class="font-bold text-slate-800 text-lg">${formatAmount(order.totalAmount)}</p>
                        <button class="btn btn-sm btn-outline-secondary" data-action="toggle-details" data-order-id="${order.id}">
                            <i class="fas fa-eye mr-2"></i>Voir
                            <i class="fas fa-chevron-down ml-2 text-xs transition-transform"></i>
                        </button>
                     </div>
                </div>
                <div id="details-${order.id}" class="hidden mt-4 pt-4 border-t">
                    <!-- Details will be loaded here -->
                </div>
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }
    
    const card = createCard('Liste des Bons de Commande', container, 'fa-receipt');

    card.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const toggleBtn = target.closest<HTMLButtonElement>('[data-action="toggle-details"]');
        if (toggleBtn) {
            const orderId = toggleBtn.dataset.orderId;
            const detailsDiv = card.querySelector(`#details-${orderId}`);
            const icon = toggleBtn.querySelector('i.fa-chevron-down');

            if (detailsDiv) {
                const isHidden = detailsDiv.classList.contains('hidden');
                if (isHidden && detailsDiv.innerHTML.includes('<!--')) {
                    const order = orders.find(o => o.id === orderId);
                    const cardTypeMap = await dataService.getCardTypeMap();
                    if (order) {
                        detailsDiv.innerHTML = `
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
                        `;
                    }
                }
                detailsDiv.classList.toggle('hidden');
                icon?.classList.toggle('rotate-180', !isHidden);
            }
        }
    });

    return card;
}
