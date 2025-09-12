
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
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold text-slate-800">${order.id}</p>
                    <p class="text-sm text-slate-500">Commandé le: ${formatDate(order.date)}</p>
                    <p class="text-sm text-slate-500">Livré par: ${order.deliveredBy}</p>
                </div>
                 <div class="flex items-center gap-4 w-full sm:w-auto">
                    <span class="badge ${order.status === 'livré' ? 'badge-success' : 'badge-warning'}">${order.status}</span>
                    <p class="font-bold text-slate-800 text-lg">${formatAmount(order.totalAmount)}</p>
                    <button class="btn btn-sm btn-outline-secondary"><i class="fas fa-eye mr-2"></i>Voir</button>
                 </div>
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }
    
    return createCard('Liste des Bons de Commande', container, 'fa-receipt');
}