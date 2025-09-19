

import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount } from '../utils/formatters';
import { navigationLinks } from '../config/navigation';
import { NavLink } from '../models';

export async function renderPartnerDashboardView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const api = ApiService.getInstance(); // Keep for the transfer function

    // Force cache invalidation to get fresh data with agency information
    dataService.invalidateUsersCache();
    dataService.invalidateTransactionsCache();
    dataService.invalidateCardsCache();
    dataService.invalidateAgentRechargeRequestsCache();

    // Fetch fresh, complete user data to ensure agency balances are included.
    const allUsers = await dataService.getUsers(); // This fetches users with agency data
    const fullUser = allUsers.find(u => u.email === user.email);

    console.log('PartnerDashboard Debug:', {
        originalUser: user,
        allUsersCount: allUsers.length,
        fullUser: fullUser,
        fullUserAgency: fullUser?.agency
    });

    // If for some reason the logged-in user isn't found or isn't a partner, show an error.
    if (!fullUser || fullUser.role !== 'partner') {
        const errorEl = document.createElement('div');
        errorEl.innerHTML = `<div class="card"><p class="text-red-500 p-4">Erreur: Impossible de charger les données du partenaire. Utilisateur: ${fullUser?.name || 'Non trouvé'}, Rôle: ${fullUser?.role || 'Non défini'}</p></div>`;
        return errorEl;
    }

    const agency = fullUser?.agency;

    // Use agency balance only (no individual balance fallback)
    const mainBalance = agency?.solde_principal ?? 0;
    const revenueBalance = agency?.solde_revenus ?? 0;

    const container = document.createElement('div');

    // Use DataService to get filtered cards, not ApiService
    const [unactivatedCards] = await Promise.all([
        dataService.getCards({ partnerId: fullUser.partnerId, status: "En attente d'activation" }),
    ]);

    const balancesGrid = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Main Balance Card -->
            <div class="card p-6 flex flex-col justify-between">
                <div>
                    <p class="text-sm text-slate-500">Solde Principal (Opérations)</p>
                    <p class="text-4xl font-bold text-emerald-600">${formatAmount(mainBalance)}</p>
                </div>
                <p class="text-xs text-slate-400 mt-2">Utilisé pour toutes les transactions de vos agents.</p>
            </div>

            <!-- Revenue Balance Card -->
            <div class="card p-6 flex flex-col justify-between bg-violet-50 border-violet-200">
                <div>
                    <p class="text-sm text-violet-700">Solde Secondaire (Revenus Agence)</p>
                    <p class="text-4xl font-bold text-violet-600">${formatAmount(revenueBalance)}</p>
                    <p class="text-xs text-violet-500 mt-2">Total des commissions perçues par votre agence.</p>
                </div>
                <button id="transfer-revenue-btn" class="btn btn-primary mt-4 w-full" ${!revenueBalance || revenueBalance === 0 ? 'disabled' : ''}>
                    <i class="fas fa-exchange-alt mr-2"></i> Transférer vers le Solde Principal
                </button>
            </div>
        </div>
    `;
    container.innerHTML = balancesGrid;

    // --- Quick Access Card ---
    const quickAccessCard = document.createElement('div');
    quickAccessCard.className = 'mb-6';
    const quickAccessContent = document.createElement('div');
    quickAccessContent.className = 'grid grid-cols-2 lg:grid-cols-4 gap-3';
    quickAccessContent.innerHTML = `
        <button data-nav-id="partner_manage_users" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-users-cog text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Gérer Utilisateurs</span>
        </button>
        <button data-nav-id="partner_card_stock" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-layer-group text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Stock de Cartes</span>
        </button>
         <button data-nav-id="partner_contract" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-file-signature text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Mon Contrat</span>
        </button>
        <button data-nav-id="partner_all_transactions" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-list-ul text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Opérations</span>
        </button>
    `;
    quickAccessCard.appendChild(createCard('Accès Rapides', quickAccessContent, 'fa-rocket', ''));
    container.appendChild(quickAccessCard);

    // --- Grid for info cards ---
    const infoGrid = document.createElement('div');
    infoGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6';
    container.appendChild(infoGrid);

    // --- Card for Partner Info ---
    const partnerInfoContent = document.createElement('div');
    partnerInfoContent.className = 'space-y-3';
    partnerInfoContent.innerHTML = `
        <div>
            <p class="text-xs text-slate-500">Personne à contacter</p>
            <p class="font-semibold text-slate-800">${fullUser.contactPerson?.name || 'Non renseigné'}</p>
        </div>
         <div>
            <p class="text-xs text-slate-500">Téléphone Contact</p>
            <p class="font-semibold text-slate-800">${fullUser.contactPerson?.phone || 'Non renseigné'}</p>
        </div>
         <div>
            <p class="text-xs text-slate-500">Adresse</p>
            <p class="font-semibold text-slate-800">${fullUser.agencyName || 'Non renseignée'}</p>
        </div>
    `;
    const partnerInfoCard = createCard('Informations de Contact', partnerInfoContent, 'fa-address-card', '');
    infoGrid.appendChild(partnerInfoCard);

    // --- List for unactivated cards ---
    const unactivatedCardsContent = document.createElement('div');
    if (unactivatedCards.length === 0) {
        unactivatedCardsContent.innerHTML = `<p class="text-sm text-slate-500">Aucune carte en attente d'activation.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-2';
        unactivatedCards.slice(0, 4).forEach(card => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-2 rounded-md bg-slate-50';
            li.innerHTML = `
                <div>
                    <p class="font-mono font-semibold text-slate-700">${card.cardNumber}</p>
                    <p class="text-xs text-slate-500">ECOBANK LOW (Exemple)</p>
                </div>
                <span class="text-xs text-slate-500">Commande BC-25-09-000001</span>
            `;
            list.appendChild(li);
        });
        unactivatedCardsContent.appendChild(list);
    }
    const unactivatedCardsCard = createCard('Cartes non activées disponibles', unactivatedCardsContent, 'fa-credit-card', '');
    infoGrid.appendChild(unactivatedCardsCard);

    // --- New list for account statement ---
    const statementContent = document.createElement('div');
    const statementList = document.createElement('ul');
    statementList.className = 'space-y-1';
    const statementItems = [
        { date: '01-09-2025 11:00', description: 'Recharge de solde par Admin', debit: null, credit: 500000, balance: 513819 },
        { date: '01-09-2025 09:30', description: 'Approbation recharge Agent Bob Fall (ARR002)', debit: 30000, credit: null, balance: 13819 },
        { date: '31-08-2025 15:00', description: 'Commission perçue (TRN001)', debit: null, credit: 250, balance: 43819 },
        { date: '31-08-2025 10:00', description: 'Recharge de solde par Admin', debit: null, credit: 50000, balance: 43569 },
    ];

    statementItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-3 rounded-md hover:bg-slate-50';
        li.innerHTML = `
            <div class="flex-grow">
                <p class="font-medium text-slate-800">${item.description}</p>
                <p class="text-xs text-slate-500">${item.date}</p>
            </div>
            <div class="w-1/4 text-right">
                ${item.debit ? `<p class="font-semibold text-red-600">-${formatAmount(item.debit)}</p>` : ''}
                ${item.credit ? `<p class="font-semibold text-green-600">+${formatAmount(item.credit)}</p>` : ''}
            </div>
            <div class="w-1/4 text-right">
                <p class="font-bold text-slate-900">${formatAmount(item.balance)}</p>
                <p class="text-xs text-slate-400">Solde</p>
            </div>
        `;
        statementList.appendChild(li);
    });

    statementContent.appendChild(statementList);
    const statementCard = createCard('Relevé de compte', statementContent, 'fa-book', 'mb-6');
    container.appendChild(statementCard);

    // --- Event Listeners ---
    const navMap = new Map<string, NavLink>();
    const flattenNavs = (links: NavLink[]) => {
        links.forEach(link => {
            if (link.navId) navMap.set(link.navId, link);
            if (link.children) flattenNavs(link.children);
        });
    };
    flattenNavs(navigationLinks.partner);

    container.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const transferBtn = target.closest('#transfer-revenue-btn');
        const navButton = target.closest<HTMLButtonElement>('[data-nav-id]');

        if (transferBtn) {
            const amountToTransfer = revenueBalance;
            if (amountToTransfer <= 0) return;

            document.body.dispatchEvent(new CustomEvent('openPartnerTransferRevenueModal', {
                detail: { userId: fullUser.id, amount: amountToTransfer },
                bubbles: true,
                composed: true
            }));
        }

        if (navButton) {
            const navId = navButton.dataset.navId;
            const navDetail = navMap.get(navId!);
            if (navDetail) {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: navDetail,
                    bubbles: true,
                    composed: true
                }));
            }
        }
    });

    return container;
}
