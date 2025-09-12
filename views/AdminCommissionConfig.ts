import { createCard } from '../components/Card';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { CommissionProfile, Partner, Contract } from '../models';
import { AdminEditCommissionProfileModal } from '../components/modals/AdminEditCommissionProfileModal';
import { AdminEditContractModal } from '../components/modals/AdminEditContractModal';
import { formatAmount, formatNumber, formatDate } from '../utils/formatters';
import { $ } from '../utils/dom';

// --- Tab: Profils de Commission ---
async function renderProfilesTabContent(container: HTMLElement, dataService: DataService, editModal: AdminEditCommissionProfileModal) {
    const profiles = await dataService.getCommissionProfiles();
    
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Profils de Commission de Base</h3>
                <p class="text-sm text-gray-500">Gérez les grilles de frais génériques qui servent de modèle pour les contrats partenaires.</p>
            </div>
            <button id="createNewProfileBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Profil</button>
        </div>
    `;

    if (profiles.length === 0) {
        container.innerHTML += `<div class="card text-center"><p class="text-slate-500 p-4">Aucun profil de commission configuré.</p></div>`;
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';
        
        profiles.forEach(profile => {
            const profileCard = document.createElement('div');
            profileCard.className = 'card !p-0 flex flex-col';
            
            let tiersTableHtml = `
                <div class="px-4 py-6 text-center text-sm text-slate-400">
                    Ce profil n'a pas de paliers de frais de service définis.
                </div>
            `;

            if (profile.tiers && profile.tiers.length > 0) {
                tiersTableHtml = `
                    <div class="table-wrapper !border-0 !rounded-none">
                        <table class="w-full text-sm">
                            <thead>
                                <tr>
                                    <th class="!px-4 !py-2">Tranche</th>
                                    <th class="!px-4 !py-2">Type</th>
                                    <th class="!px-4 !py-2 text-right">Frais</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${profile.tiers.map(tier => `
                                    <tr>
                                        <td class="!px-4 !py-2">${formatNumber(tier.from)} - ${tier.to === Infinity ? 'et plus' : formatNumber(tier.to)}</td>
                                        <td class="!px-4 !py-2">${tier.type === 'fixed' ? 'Fixe' : 'Pourcentage'}</td>
                                        <td class="!px-4 !py-2 text-right font-semibold">${tier.type === 'fixed' ? formatAmount(tier.value) : `${tier.value}%`}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            profileCard.innerHTML = `
                <div class="p-4 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-bold text-slate-800">${profile.name}</h3>
                        <button class="btn btn-sm btn-outline-secondary" data-profile-id="${profile.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                    </div>
                    <p class="text-sm text-slate-500">Part de la Société: <span class="font-semibold text-slate-700">${profile.partageSociete}%</span></p>
                </div>
                ${tiersTableHtml}
            `;
            grid.appendChild(profileCard);
        });
        container.appendChild(grid);
    }
    
    container.querySelector('#createNewProfileBtn')?.addEventListener('click', () => {
        editModal.show();
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-profile-id]');
        if (editButton) {
            const profileId = editButton.dataset.profileId;
            const profileToEdit = profiles.find(p => p.id === profileId);
            if (profileToEdit) {
                editModal.show(profileToEdit);
            }
        }
    });
}

// --- Tab: Contrats Partenaires ---
async function renderContractsTabContent(container: HTMLElement, dataService: DataService, editModal: AdminEditContractModal) {
    const [contracts, partners, profiles] = await Promise.all([
        dataService.getContracts(),
        dataService.getPartners(),
        dataService.getCommissionProfiles()
    ]);

    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Contrats Partenaires</h3>
                <p class="text-sm text-gray-500">Gérez les contrats commerciaux qui définissent les commissions pour chaque partenaire.</p>
            </div>
            <button id="createNewContractBtn" class="btn btn-primary w-full md:w-auto"><i class="fas fa-file-signature mr-2"></i>Nouveau Contrat</button>
        </div>
        <div id="contracts-list" class="space-y-4"></div>
    `;

    const listContainer = $('#contracts-list', container);
    if (!listContainer) return;

    if (contracts.length === 0) {
        listContainer.innerHTML = '<div class="card text-center"><p class="text-slate-500 p-4">Aucun contrat trouvé.</p></div>';
        return;
    }

    contracts.forEach(contract => {
        const partner = partners.find(p => p.id === contract.partnerId);
        const profile = profiles.find(p => p.id === contract.baseCommissionProfileId);
        
        const statusMap = {
            active: { text: 'Actif', badge: 'badge-success' },
            draft: { text: 'Brouillon', badge: 'badge-gray' },
            expired: { text: 'Expiré', badge: 'badge-danger' }
        };
        const statusInfo = statusMap[contract.status] || statusMap.draft;

        const contractCard = document.createElement('div');
        contractCard.className = 'card !p-4';
        contractCard.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div class="md:col-span-2">
                    <p class="font-bold text-lg text-slate-800">${contract.name}</p>
                    <p class="text-sm text-slate-600">Partenaire: <strong>${partner?.name || 'N/A'}</strong></p>
                </div>
                <div>
                    <p class="text-xs text-slate-500">Statut</p>
                    <p><span class="badge ${statusInfo.badge}">${statusInfo.text}</span></p>
                </div>
                <div class="flex items-center justify-end gap-2">
                     <button class="btn btn-sm btn-outline-secondary" data-contract-id="${contract.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                </div>
                <div class="md:col-span-4 mt-2 pt-2 border-t text-sm text-slate-500 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <span>Profil de base: <strong>${profile?.name || 'N/A'}</strong></span>
                    <span>Début: <strong>${formatDate(contract.startDate).split(' ')[0]}</strong></span>
                    <span>Fin: <strong>${contract.endDate ? formatDate(contract.endDate).split(' ')[0] : 'Indéfinie'}</strong></span>
                    <span>Avenants: <strong>${contract.exceptions.length}</strong></span>
                </div>
            </div>
        `;
        listContainer.appendChild(contractCard);
    });

    container.querySelector('#createNewContractBtn')?.addEventListener('click', () => {
        editModal.show();
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-contract-id]');
        if (editButton) {
            const contractId = editButton.dataset.contractId;
            const contractToEdit = contracts.find(c => c.id === contractId);
            if (contractToEdit) {
                editModal.show(contractToEdit);
            }
        }
    });
}

// --- Main View ---
export async function renderAdminCommissionConfigView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [partners, commissionProfiles, operationTypes] = await Promise.all([
        dataService.getPartners(),
        dataService.getCommissionProfiles(),
        dataService.getAllOperationTypes()
    ]);

    const viewContainer = document.createElement('div');
    const editProfileModal = new AdminEditCommissionProfileModal();
    const editContractModal = new AdminEditContractModal(partners, commissionProfiles, operationTypes);

    viewContainer.innerHTML = `
        <div class="tabs mb-6">
            <button data-tab="contracts" class="active">Contrats Partenaires</button>
            <button data-tab="profiles">Profils de Commission</button>
        </div>
        <div id="commission-config-content"></div>
    `;

    const card = createCard('Contrats & Commissions', viewContainer, 'fa-file-signature');
    card.id = 'admin-commission-config-view-wrapper';

    const contentContainer = $('#commission-config-content', card) as HTMLElement;
    
    async function switchTab(tabName: 'contracts' | 'profiles') {
        contentContainer.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
        if (tabName === 'profiles') {
            await renderProfilesTabContent(contentContainer, dataService, editProfileModal);
        } else if (tabName === 'contracts') {
            await renderContractsTabContent(contentContainer, dataService, editContractModal);
        }
    }
    
    card.querySelector('.tabs')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            const tabName = target.dataset.tab as 'contracts' | 'profiles';
            if (tabName) switchTab(tabName);
        }
    });

    const refreshActiveTab = async () => {
        const activeTab = card.querySelector<HTMLButtonElement>('.tabs button.active')?.dataset.tab as 'contracts' | 'profiles' | undefined;
        if (activeTab) {
            await switchTab(activeTab);
        }
    };
    
    document.body.addEventListener('commissionProfilesUpdated', refreshActiveTab);
    document.body.addEventListener('contractsUpdated', refreshActiveTab);

    // Initial load
    await switchTab('contracts');
    
    return card;
}