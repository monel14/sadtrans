import { User, Card, CardType } from '../models';
import { ApiService } from '../services/api.service';
import { createCard } from '../components/Card';
import { renderOrderListView } from './OrderList';
import { DataService } from '../services/data.service';

interface StockInfo {
    cardType: CardType;
    total: number;
    available: number;
    pendingActivation: number;
    activated: number;
}

export async function renderPartnerCardStockView(partnerUser: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    if (!partnerUser.partnerId) {
        return createCard('Erreur', '<p>Partenaire non identifié.</p>', 'fa-exclamation-triangle');
    }

    const [myCards, allCardTypes] = await Promise.all([
        dataService.getCards({ partnerId: partnerUser.partnerId }),
        dataService.getCardTypes()
    ]);

    const cardTypeMap = new Map(allCardTypes.map(ct => [ct.id, ct]));

    const stockData = myCards.reduce((acc: Record<string, StockInfo>, card) => {
        if (!acc[card.cardTypeId]) {
            const cardType = cardTypeMap.get(card.cardTypeId);
            if (cardType) {
                acc[card.cardTypeId] = {
                    cardType: cardType,
                    total: 0,
                    available: 0,
                    pendingActivation: 0,
                    activated: 0,
                };
            }
        }

        const stock = acc[card.cardTypeId];
        if (stock) {
            stock.total++;
            switch (card.status) {
                case 'Assigné':
                    stock.available++;
                    break;
                case 'En attente d\'activation':
                    stock.pendingActivation++;
                    break;

                case 'Activée':
                    stock.activated++;
                    break;
            }
        }

        return acc;
    }, {});
    
    const stockArray: StockInfo[] = Object.values(stockData).sort((a, b) => a.cardType.name.localeCompare(b.cardType.name));

    const container = document.createElement('div');
    const header = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h2 class="text-xl md:text-2xl font-semibold text-gray-700">État de Mon Stock de Cartes</h2>
                <p class="text-sm text-gray-500">Vue d'ensemble de vos cartes prépayées groupées par type.</p>
            </div>
            <button id="go-to-orders-btn" class="btn btn-primary w-full md:w-auto">
                <i class="fas fa-receipt mr-2"></i>Voir mes commandes
            </button>
        </div>
    `;
    container.innerHTML = header;

    if (stockArray.length === 0) {
        container.innerHTML += `
            <div class="text-center bg-slate-50 p-8 rounded-lg">
                <i class="fas fa-box-open fa-3x text-slate-400 mb-4"></i>
                <h3 class="text-lg font-semibold text-slate-700">Votre stock est vide.</h3>
                <p class="text-slate-500">Passez une commande pour commencer à recevoir des cartes.</p>
            </div>
        `;
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

        stockArray.forEach(stock => {
            const isLowStock = stock.available < 10 && stock.available > 0;
            const isOutOfStock = stock.available === 0;

            const card = document.createElement('div');
            card.className = `card flex flex-col justify-between ${isLowStock ? 'bg-amber-50 border-amber-300' : ''} ${isOutOfStock ? 'bg-red-50 border-red-200' : ''}`;
            
            const lowStockIndicator = isLowStock ? `<span class="badge badge-warning">Stock Faible</span>` : '';
            const outOfStockIndicator = isOutOfStock ? `<span class="badge badge-danger">Épuisé</span>` : '';
            
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-bold text-lg text-slate-800">${stock.cardType.name}</h4>
                        ${lowStockIndicator}${outOfStockIndicator}
                    </div>
                    
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">Disponible à la vente :</span>
                            <span class="font-bold text-lg text-emerald-600">${stock.available}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">En attente d'activation :</span>
                            <span class="font-semibold text-slate-700">${stock.pendingActivation}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">Déjà activées :</span>
                            <span class="font-semibold text-slate-700">${stock.activated}</span>
                        </div>
                    </div>
                </div>

                <div class="border-t mt-4 pt-3 flex justify-between items-center">
                     <span class="text-sm font-semibold text-slate-600">Total en stock: ${stock.total}</span>
                     <button class="btn btn-sm btn-outline-secondary" data-action="order-more" data-card-type-name="${stock.cardType.name}">
                        <i class="fas fa-plus mr-1"></i> Commander
                     </button>
                </div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }
    
    const wrapperCard = createCard('Mon Stock de Cartes Prépayées', container, 'fa-layer-group');

    wrapperCard.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');

        if (!button) return;

        if (button.id === 'go-to-orders-btn' || button.dataset.action === 'order-more') {
            wrapperCard.dispatchEvent(new CustomEvent('navigateTo', {
                detail: {
                    viewFn: renderOrderListView,
                    label: 'Bons de Commande',
                    navId: 'partner_orders'
                },
                bubbles: true,
                composed: true,
            }));

            if (button.dataset.action === 'order-more') {
                 document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: `Redirection pour commander plus de cartes ${button.dataset.cardTypeName}.`, type: 'info' }
                }));
            }
        }
    });

    return wrapperCard;
}