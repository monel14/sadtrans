
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { User } from '../models';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';

export async function renderAdminManagePartnersView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [
        allUsers,
        allPartners,
        allTransactions,
        userMap,
        opTypeMap,
        commissionProfileMap,
        activeContractsMap
    ] = await Promise.all([
        dataService.getUsers(),
        dataService.getPartners(),
        dataService.getTransactions(),
        dataService.getUserMap(),
        dataService.getOpTypeMap(),
        dataService.getCommissionProfileMap(),
        dataService.getActiveContractsMap()
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
            // Get the full manager user object which includes the nested agency
            const fullManager = allUsers.find(u => u.id === partner.partnerManagerId);
            const agencyBalance = (fullManager as any)?.agency?.solde_principal;

            const agents = allUsers.filter(u => u.role === 'agent' && u.partnerId === partner.id);
            
            const partnerContract = activeContractsMap.get(partner.id);
            const commissionProfile = partnerContract ? commissionProfileMap.get(partnerContract.baseCommissionProfileId) : undefined;
            
            const agentIds = agents.map(a => a.id);
            const partnerTransactions = allTransactions.filter(t => agentIds.includes(t.agentId));
            const pendingTransactions = partnerTransactions.filter(t => t.statut === 'En attente de validation' || t.statut === 'Assignée');
            const recentTransactions = partnerTransactions.slice(0, 5);
            
            const partnerCard = document.createElement('div');
            partnerCard.className = 'card flex flex-col';

            let recentTransactionsHtml = '<p class="text-sm text-slate-500 text-center py-2">Aucune transaction récente.</p>';
            if(recentTransactions.length > 0) {
                recentTransactionsHtml = `
                    <ul class="space-y-2">
                        ${recentTransactions.map(t => {
                            const opType = opTypeMap.get(t.opTypeId);
                            const formattedStatus = formatTransactionStatus(t, userMap);
                            const statusClass = t.statut === 'Validé' ? 'badge-success' : (t.statut === 'En attente de validation' || t.statut === 'Assignée' ? 'badge-warning' : 'badge-danger');
                            return `
                                <li class="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
                                    <div>
                                        <p class="font-medium text-slate-700">${opType?.name || 'Opération'}</p>
                                        <p class="text-xs text-slate-400">${formatDate(t.date).split(' ')[0]}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-semibold">${formatAmount(t.montant_principal)}</p>
                                        <span class="badge ${statusClass} mt-1">${formattedStatus}</span>
                                    </div>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                `;
            }

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
                        <p class="text-xl font-bold text-emerald-600">${formatAmount(agencyBalance)}</p>
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
                 <div class="text-center text-sm text-slate-500 -mt-2 mb-2">
                    Profil de frais: <span class="font-semibold text-slate-700">${commissionProfile?.name || 'N/A'}</span>
                 </div>

                <!-- Collapsible Details Section -->
                <div id="details-${partner.id}" class="hidden transition-all duration-300 ease-in-out">
                    <h4 class="font-semibold text-sm mb-2 text-slate-600">Historique Récent des Opérations</h4>
                    ${recentTransactionsHtml}
                </div>

                <!-- Footer with Toggle Button -->
                <div class="mt-auto pt-4 text-center">
                    <button data-action="toggle-details" data-target="details-${partner.id}" class="btn btn-sm btn-outline-secondary w-full">
                        <span class="toggle-text">Afficher plus</span> <i class="fas fa-chevron-down toggle-icon text-xs ml-2 transition-transform"></i>
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
            document.body.dispatchEvent(new CustomEvent('openAdminEditUserModal', {
                bubbles: true,
                composed: true,
                detail: { user: null, roleToCreate: 'partner' }
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

        const toggleBtn = target.closest<HTMLButtonElement>('[data-action="toggle-details"]');
        if (toggleBtn) {
            const targetId = toggleBtn.dataset.target;
            const detailsDiv = wrapperCard.querySelector<HTMLElement>(`#${targetId}`);
            const textSpan = toggleBtn.querySelector<HTMLElement>('.toggle-text');
            const icon = toggleBtn.querySelector<HTMLElement>('.toggle-icon');

            if (detailsDiv) {
                const isHidden = detailsDiv.classList.contains('hidden');
                detailsDiv.classList.toggle('hidden');
                
                if (textSpan) textSpan.textContent = isHidden ? 'Afficher moins' : 'Afficher plus';
                if (icon) icon.classList.toggle('rotate-180', isHidden);
            }
        }
    });
    
    return wrapperCard;
}
