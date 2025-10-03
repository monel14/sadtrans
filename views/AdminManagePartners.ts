
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { User } from '../models';
import { formatAmount } from '../utils/formatters';
import { renderAllTransactionsView } from './AllTransactions';
import { renderAdminCommissionConfigView } from './AdminCommissionConfig';

export async function renderAdminManagePartnersView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [
        allUsers,
        allPartners,
        allTransactions,
        userMap,
        // Commission profile map removed - commissions are now configured directly in contracts
        activeContractsMap,
        agencyMap
    ] = await Promise.all([
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getTransactions(),
        dataService.getUserMap(),
        // Commission profile map loading removed - commissions are now configured directly in contracts
        dataService.getActiveContractsMap(),
        dataService.getAgencyMapByPartnerId()
    ]);

    const container = document.createElement('div');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Supervision des Partenaires</h2>
            <button id="create-partner-btn" class="btn btn-success w-full md:w-auto"><i class="fas fa-building mr-2"></i>Créer un Partenaire</button>
        </div>
    `;

    if (allPartners.length === 0) {
        container.innerHTML += `<p class="text-center text-slate-500 p-4">Aucun partenaire trouvé.</p>`;
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6';

        allPartners.forEach(partner => {
            const manager = userMap.get(partner.partnerManagerId);
            const agency = agencyMap.get(partner.id);
            const agencyBalance = agency?.solde_principal;
            
            const agents = allUsers.filter(u => u.role === 'agent' && u.partnerId === partner.id);
            
            const partnerContract = activeContractsMap.get(partner.id);
            // Commission profile lookup removed - using contract's default commission config instead
            const commissionConfig = partnerContract?.defaultCommissionConfig;
            
            const agentIds = agents.map(a => a.id);
            const partnerTransactions = allTransactions.filter(t => agentIds.includes(t.agentId));
            const pendingTransactions = partnerTransactions.filter(t => t.statut === 'En attente de validation' || t.statut === 'Assignée');
            
            const partnerCard = document.createElement('div');
            partnerCard.className = 'card flex flex-col';

            partnerCard.innerHTML = `
                <!-- Visible Header -->
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="font-bold text-lg text-slate-800">${partner.name}</p>
                        <p class="text-sm text-slate-500">Manager: ${manager?.name || 'Non assigné'}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${partner.idCardImageUrl ? `
                            <button class="btn btn-sm btn-outline-secondary" data-action="view-id-card" data-image-url="${partner.idCardImageUrl}" title="Voir la pièce d'identité">
                                <i class="fas fa-id-card"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-secondary" data-action="edit-partner" data-partner-id="${partner.id}" title="Modifier le Partenaire">
                            <i class="fas fa-building"></i>
                        </button>
                    </div>
                </div>

                <!-- KPIs -->
                <div class="grid grid-cols-3 gap-4 my-4 text-center border-t border-b py-4">
                    <div>
                        <p class="text-xs text-slate-500">Solde Agence</p>
                        <div class="flex items-center justify-center gap-2">
                            <p class="text-xl font-bold text-emerald-600">${formatAmount(agencyBalance)}</p>
                            <button class="btn btn-xs btn-outline-secondary" data-action="adjust-balance" data-agency-id="${agency?.id || ''}" title="Ajuster le solde" ${!agency ? 'disabled' : ''}>
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">Agents Actifs</p>
                        <p class="text-xl font-bold text-slate-700">${agents.length}</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">Op. en Attente</p>
                        <p class="text-xl font-bold text-amber-500">${pendingTransactions.length}</p>
                    </div>
                </div>
                 <div class="text-center text-sm text-slate-500 -mt-2 mb-4">
                    Commission: <span class="font-semibold text-slate-700">${commissionConfig ? `${commissionConfig.type} (${commissionConfig.partageSociete || 100}% société)` : 'N/A'}</span>
                 </div>

                <!-- Footer with Action Buttons -->
                <div class="mt-auto pt-4 border-t flex justify-end gap-2">
                    <button data-action="view-transactions" data-partner-id="${partner.id}" class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-list-ul mr-2"></i>Opérations
                    </button>
                    <button data-action="manage-contract" data-partner-id="${partner.id}" class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-file-signature mr-2"></i>Contrat
                    </button>
                </div>
            `;
            grid.appendChild(partnerCard);
        });
        container.appendChild(grid);
    }
    
    const wrapperCard = createCard('Supervision des Partenaires', container, 'fa-building');

    wrapperCard.addEventListener('click', e => {
        const target = e.target as HTMLElement;

        const createBtn = target.closest<HTMLButtonElement>('#create-partner-btn');
        if (createBtn) {
            document.body.dispatchEvent(new CustomEvent('openAdminCreatePartnerModal', {
                bubbles: true,
                composed: true
            }));
            return;
        }

        const viewIdBtn = target.closest<HTMLButtonElement>('[data-action="view-id-card"]');
        if (viewIdBtn) {
            const imageUrl = viewIdBtn.dataset.imageUrl;
            if (imageUrl) {
                document.body.dispatchEvent(new CustomEvent('openViewProofModal', {
                    detail: { imageUrl },
                    bubbles: true,
                    composed: true
                }));
            }
            return;
        }

        const editPartnerBtn = target.closest<HTMLButtonElement>('[data-action="edit-partner"]');
        if (editPartnerBtn) {
            const partnerId = editPartnerBtn.dataset.partnerId;
            const partner = allPartners.find(p => p.id === partnerId);
            if(partner) {
                 document.body.dispatchEvent(new CustomEvent('openAdminEditPartnerModal', {
                    bubbles: true, composed: true, detail: { partner }
                }));
            }
            return;
        }
        
        const adjustBalanceBtn = target.closest<HTMLButtonElement>('[data-action="adjust-balance"]');
        if (adjustBalanceBtn) {
            const agencyId = adjustBalanceBtn.dataset.agencyId;
            if (agencyId) {
                const agency = Array.from(agencyMap.values()).find(a => a.id === agencyId);
                if (agency) {
                    document.body.dispatchEvent(new CustomEvent('openAdminAdjustBalanceModal', {
                        bubbles: true,
                        composed: true,
                        detail: { agency }
                    }));
                }
            }
            return;
        }

        const viewTransactionsBtn = target.closest<HTMLButtonElement>('[data-action="view-transactions"]');
        if (viewTransactionsBtn) {
            wrapperCard.dispatchEvent(new CustomEvent('navigateTo', {
                detail: {
                    viewFn: renderAllTransactionsView,
                    label: 'Toutes les Opérations',
                    navId: 'admin_all_transactions'
                },
                bubbles: true,
                composed: true,
            }));
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "Utilisez le filtre 'Partenaire' pour voir les opérations spécifiques.", type: 'info' }
            }));
            return;
        }

        const manageContractBtn = target.closest<HTMLButtonElement>('[data-action="manage-contract"]');
        if (manageContractBtn) {
            wrapperCard.dispatchEvent(new CustomEvent('navigateTo', {
                detail: {
                    viewFn: renderAdminCommissionConfigView,
                    label: 'Contrats & Commissions',
                    navId: 'admin_commission_config'
                },
                bubbles: true,
                composed: true,
            }));
            return;
        }
    });
    
    return wrapperCard;
}
