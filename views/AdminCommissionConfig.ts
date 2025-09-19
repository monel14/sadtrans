
import { createCard } from '../components/Card';
import { User, CommissionProfile, Contract, Partner, OperationType } from '../models';
import { DataService } from '../services/data.service';
import { $ } from '../utils/dom';
import { formatAmount, formatDate } from '../utils/formatters';
import { AdminEditCommissionProfileModal } from '../components/modals/AdminEditCommissionProfileModal';
import { AdminEditContractModal } from '../components/modals/AdminEditContractModal';
import { ApiService } from '../services/api.service';

// --- Profiles Tab ---
async function renderProfilesTabContent(
    container: HTMLElement,
    profiles: CommissionProfile[],
    contracts: Contract[],
    editModal: AdminEditCommissionProfileModal
) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Profils de Commission</h3>
                <p class="text-sm text-gray-500">Gérez les grilles de frais et de partage des revenus.</p>
            </div>
            <button id="createNewProfileBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Profil</button>
        </div>
        <ul id="profiles-list" class="space-y-3"></ul>
    `;
    
    const list = $('#profiles-list', container) as HTMLUListElement;
    if (profiles.length === 0) {
        list.innerHTML = `<li class="text-center text-slate-500 p-4">Aucun profil de commission configuré.</li>`;
    } else {
        profiles.forEach(profile => {
            const isInUse = contracts.some(c => c.baseCommissionProfileId === profile.id);
            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold text-slate-800">${profile.name}</p>
                    <p class="text-sm text-slate-500">Part Société: <strong>${profile.partageSociete}%</strong> | Paliers: <strong>${profile.tiers.length}</strong></p>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                     <button class="btn btn-sm btn-outline-secondary" data-action="edit-profile" data-profile-id="${profile.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                     <button class="btn btn-sm btn-danger" data-action="delete-profile" data-profile-id="${profile.id}" data-profile-name="${profile.name}" ${isInUse ? 'disabled' : ''} title="${isInUse ? 'Profil utilisé par un contrat.' : 'Supprimer'}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    container.querySelector('#createNewProfileBtn')?.addEventListener('click', () => {
        editModal.show();
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-action="edit-profile"]');
        if (editButton) {
            const profileId = editButton.dataset.profileId;
            const profileToEdit = profiles.find(p => p.id === profileId);
            if (profileToEdit) {
                editModal.show(profileToEdit);
            }
        }
    });
}

// --- Contracts Tab ---
async function renderContractsTabContent(
    container: HTMLElement,
    contracts: Contract[],
    partners: Partner[],
    profiles: CommissionProfile[],
    editModal: AdminEditContractModal
) {
    const partnerMap = new Map(partners.map(p => [p.id, p]));
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Contrats Partenaires</h3>
                <p class="text-sm text-gray-500">Liez les partenaires à des profils de commission pour une période donnée.</p>
            </div>
            <button id="createNewContractBtn" class="btn btn-primary w-full md:w-auto"><i class="fas fa-file-signature mr-2"></i>Nouveau Contrat</button>
        </div>
        <ul id="contracts-list" class="space-y-3"></ul>
    `;

    const list = $('#contracts-list', container) as HTMLUListElement;
    if (contracts.length === 0) {
        list.innerHTML = `<li class="text-center text-slate-500 p-4">Aucun contrat trouvé.</li>`;
    } else {
        contracts.forEach(contract => {
            const partner = partnerMap.get(contract.partnerId);
            const profile = profileMap.get(contract.baseCommissionProfileId);
            const statusColors = { active: 'badge-success', draft: 'badge-warning', expired: 'badge-danger' };

            const li = document.createElement('li');
            li.className = 'card !p-4';
            li.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <div class="sm:col-span-2">
                        <p class="font-semibold text-slate-800">${contract.name}</p>
                        <p class="text-sm text-slate-600">Partenaire: <strong>${partner?.name || 'Inconnu'}</strong></p>
                        <p class="text-xs text-slate-400">Profil de base: ${profile?.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-slate-600">Exceptions: <strong>${contract.exceptions.length}</strong></p>
                        <p class="text-xs text-slate-400">
                            ${formatDate(contract.startDate).split(' ')[0]} - 
                            ${contract.endDate ? formatDate(contract.endDate).split(' ')[0] : '...'}
                        </p>
                    </div>
                    <div class="flex items-center gap-2 justify-self-end">
                        <span class="badge ${statusColors[contract.status] || 'badge-gray'}">${contract.status}</span>
                        <button class="btn btn-sm btn-outline-secondary" data-action="edit-contract" data-contract-id="${contract.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="delete-contract" data-contract-id="${contract.id}" data-contract-name="${contract.name}" title="Supprimer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
    }

    container.querySelector('#createNewContractBtn')?.addEventListener('click', () => {
        editModal.show();
    });

    container.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editButton = target.closest<HTMLButtonElement>('[data-action="edit-contract"]');
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
export async function renderAdminCommissionConfigView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    
    // Fetch all data needed for modals and tabs upfront
    const [partners, profiles, opTypes, contracts] = await Promise.all([
        dataService.getPartners(),
        dataService.getCommissionProfiles(),
        dataService.getAllOperationTypes(),
        dataService.getContracts(),
    ]);
    
    // Initialize modals with the fetched data
    const profileModal = new AdminEditCommissionProfileModal();
    const contractModal = new AdminEditContractModal(partners, profiles, opTypes);

    const viewContainer = document.createElement('div');
    viewContainer.innerHTML = `
        <div class="tabs mb-6">
            <button data-tab="contracts" class="active">Contrats Partenaires</button>
            <button data-tab="profiles">Profils de Commission</button>
        </div>
        <div id="commission-config-content">
            <!-- Tab content will be rendered here -->
        </div>
    `;

    const card = createCard('Contrats & Commissions', viewContainer, 'fa-file-signature');
    card.id = 'admin-commission-config-view-wrapper';
    
    const contentContainer = $('#commission-config-content', card) as HTMLElement;
    
    async function switchTab(tabName: 'profiles' | 'contracts') {
        contentContainer.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
        if (tabName === 'profiles') {
            const freshProfiles = await dataService.getCommissionProfiles(); // Re-fetch on tab switch
            const freshContracts = await dataService.getContracts(); // Needed for dependency check
            await renderProfilesTabContent(contentContainer, freshProfiles, freshContracts, profileModal);
        } else if (tabName === 'contracts') {
            const freshContracts = await dataService.getContracts(); // Re-fetch
            await renderContractsTabContent(contentContainer, freshContracts, partners, profiles, contractModal);
        }
    }

    card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Tab switching
        const tabButton = target.closest<HTMLButtonElement>('.tabs button');
        if (tabButton) {
            card.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            tabButton.classList.add('active');
            const tabName = tabButton.dataset.tab as 'profiles' | 'contracts';
            if (tabName) switchTab(tabName);
            return;
        }

        // Delete profile
        const deleteProfileBtn = target.closest<HTMLButtonElement>('[data-action="delete-profile"]');
        if (deleteProfileBtn) {
            const profileId = deleteProfileBtn.dataset.profileId!;
            const profileName = deleteProfileBtn.dataset.profileName!;
            document.body.dispatchEvent(new CustomEvent('openConfirmationModal', {
                detail: {
                    title: 'Confirmer la Suppression',
                    message: `Voulez-vous vraiment supprimer le profil "<strong>${profileName}</strong>" ? Cette action est irréversible.`,
                    onConfirm: async () => {
                        const api = ApiService.getInstance();
                        await api.deleteCommissionProfile(profileId);
                        document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Profil supprimé.', type: 'success' } }));
                        document.body.dispatchEvent(new CustomEvent('commissionProfilesUpdated'));
                    },
                    options: { confirmButtonClass: 'btn-danger', confirmButtonText: 'Oui, Supprimer' }
                },
                bubbles: true, composed: true
            }));
        }

        // Delete contract
        const deleteContractBtn = target.closest<HTMLButtonElement>('[data-action="delete-contract"]');
        if (deleteContractBtn) {
            const contractId = deleteContractBtn.dataset.contractId!;
            const contractName = deleteContractBtn.dataset.contractName!;
            document.body.dispatchEvent(new CustomEvent('openConfirmationModal', {
                detail: {
                    title: 'Confirmer la Suppression',
                    message: `Voulez-vous vraiment supprimer le contrat "<strong>${contractName}</strong>" ? Cette action est irréversible.`,
                    onConfirm: async () => {
                        const api = ApiService.getInstance();
                        await api.deleteContract(contractId);
                        document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Contrat supprimé.', type: 'success' } }));
                        document.body.dispatchEvent(new CustomEvent('contractsUpdated'));
                    },
                    options: { confirmButtonClass: 'btn-danger', confirmButtonText: 'Oui, Supprimer' }
                },
                bubbles: true, composed: true
            }));
        }
    });

    const rerenderActiveTab = async () => {
        const activeTab = card.querySelector<HTMLButtonElement>('.tabs button.active')?.dataset.tab as 'profiles' | 'contracts' | undefined;
        if(activeTab) {
            // Invalidate cache before re-rendering
            if (activeTab === 'profiles') dataService.invalidateCommissionProfilesCache();
            if (activeTab === 'contracts') dataService.invalidateContractsCache();
            await switchTab(activeTab);
        }
    };
    
    document.body.addEventListener('commissionProfilesUpdated', rerenderActiveTab);
    document.body.addEventListener('contractsUpdated', rerenderActiveTab);
    
    // Initial load
    switchTab('contracts');
    
    return card;
}
