import { createCard } from '../components/Card';
import { User, Contract, Partner, OperationType } from '../models';
import { DataService } from '../services/data.service';
import { $ } from '../utils/dom';
import { formatAmount, formatDate } from '../utils/formatters';
import { AdminEditContractModal } from '../components/modals/AdminEditContractModal';
import { ApiService } from '../services/api.service';
import { showAdminDefaultCommissionsView } from './AdminDefaultCommissions';

// --- Contracts Tab ---
async function renderContractsTabContent(
    container: HTMLElement,
    contracts: Contract[],
    partners: Partner[],
    contractModal: AdminEditContractModal
) {
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <div>
                <h3 class="text-xl font-semibold text-gray-700">Contrats Partenaires</h3>
                <p class="text-sm text-gray-500">Gérez les contrats et leurs configurations de commission.</p>
            </div>
            <button id="createNewContractBtn" class="btn btn-success w-full md:w-auto"><i class="fas fa-plus-circle mr-2"></i>Créer un Contrat</button>
        </div>
        <ul id="contracts-list" class="space-y-3"></ul>
    `;
    
    const list = $('#contracts-list', container) as HTMLUListElement;
    if (contracts.length === 0) {
        list.innerHTML = `<li class="text-center text-slate-500 p-4">Aucun contrat configuré.</li>`;
    } else {
        contracts.forEach(contract => {
            const partner = partners.find(p => p.id === contract.partnerId);
            const partnerName = partner ? partner.name : 'Partenaire inconnu';
            
            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            
            // Determine commission config display
            let commissionDisplay = 'Non configuré';
            if (contract.defaultCommissionConfig) {
                const config = contract.defaultCommissionConfig;
                if (config.type === 'fixed') {
                    commissionDisplay = `Fixe: ${formatAmount(config.amount || 0)}`;
                } else if (config.type === 'percentage') {
                    commissionDisplay = `Pourcentage: ${config.rate}%`;
                } else if (config.type === 'tiers') {
                    commissionDisplay = `Par paliers (${config.tiers?.length || 0} paliers)`;
                }
                commissionDisplay += ` - Part société: ${config.partageSociete || 100}%`;
            }
            
            li.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold text-slate-800">${contract.name}</p>
                    <p class="text-sm text-slate-500">Partenaire: <strong>${partnerName}</strong></p>
                    <p class="text-sm text-slate-500">Commission: <strong>${commissionDisplay}</strong></p>
                    <p class="text-sm text-slate-500">Statut: <span class="badge ${contract.status === 'active' ? 'badge-success' : 'badge-warning'}">${contract.status}</span> ${contract.status === 'active' ? '<i class="fas fa-star text-yellow-500 ml-1" title="Contrat actif"></i>' : ''}</p>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit-contract" data-contract-id="${contract.id}"><i class="fas fa-edit mr-2"></i>Éditer</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-contract" data-contract-id="${contract.id}" data-contract-name="${contract.name}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    // Event listeners for contract actions
    container.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        
        if (action === 'edit-contract') {
            const contractId = button.dataset.contractId;
            const contract = contracts.find(c => c.id === contractId);
            if (contract) {
                await contractModal.show(contract);
            }
        } else if (action === 'delete-contract') {
            const contractId = button.dataset.contractId!;
            const contractName = button.dataset.contractName!;
            
            if (confirm(`Êtes-vous sûr de vouloir supprimer le contrat "${contractName}" ?`)) {
                try {
                    const api = ApiService.getInstance();
                    const success = await api.deleteContract(contractId);
                    if (success) {
                        // Refresh the view
                        const dataService = DataService.getInstance();
                        dataService.invalidateContractsCache();
                        const freshContracts = await dataService.getContracts();
                        await renderContractsTabContent(container, freshContracts, partners, contractModal);
                    } else {
                        alert('Erreur lors de la suppression du contrat.');
                    }
                } catch (error) {
                    console.error('Error deleting contract:', error);
                    alert('Erreur lors de la suppression du contrat.');
                }
            }
        } else if (action === 'create-contract' || button.id === 'createNewContractBtn') {
            await contractModal.show();
        }
    });
}

export async function renderAdminCommissionConfigView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    // Fetch all data needed for contract management
    const [partners, opTypes, contracts] = await Promise.all([
        dataService.getPartners(),
        dataService.getAllOperationTypes(),
        dataService.getContracts(),
    ]);
    // Initialize contract modal with the fetched data
    const contractModal = new AdminEditContractModal(partners, opTypes);

    const viewContainer = document.createElement('div');
    viewContainer.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Configuration des Commissions</h2>
            <p class="text-gray-600 mt-2">Gérez les configurations de commission directement dans les contrats des partenaires ou définissez les valeurs par défaut.</p>
        </div>
        <div class="border-b border-gray-200 mb-4">
            <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                <button id="tab-contracts" class="tab-btn text-gray-600 py-2 px-4 border-b-2 font-medium text-sm border-transparent focus:outline-none focus:text-blue-600 focus:border-blue-500">Contrats</button>
                <button id="tab-defaults" class="tab-btn text-gray-600 py-2 px-4 border-b-2 font-medium text-sm border-transparent focus:outline-none focus:text-blue-600 focus:border-blue-500">Commissions par défaut</button>
            </nav>
        </div>
        <div id="commission-config-content" class="mt-6"></div>
    `;

    const card = createCard('Configuration des Commissions', viewContainer, 'fa-file-signature');
    card.id = 'admin-commission-config-view-wrapper';

    const contentContainer = $('#commission-config-content', card) as HTMLElement;
    const tabContracts = viewContainer.querySelector('#tab-contracts') as HTMLButtonElement;
    const tabDefaults = viewContainer.querySelector('#tab-defaults') as HTMLButtonElement;

    // Helper to switch tabs
    async function showTab(tab: 'contracts' | 'defaults') {
        // Reset tab styles
        tabContracts.classList.remove('border-blue-500', 'text-blue-600');
        tabDefaults.classList.remove('border-blue-500', 'text-blue-600');
        tabContracts.classList.add('text-gray-600', 'border-transparent');
        tabDefaults.classList.add('text-gray-600', 'border-transparent');
        // Show correct content
        if (tab === 'contracts') {
            tabContracts.classList.add('border-blue-500', 'text-blue-600');
            contentContainer.innerHTML = '';
            await renderContractsTabContent(contentContainer, contracts, partners, contractModal);
        } else {
            tabDefaults.classList.add('border-blue-500', 'text-blue-600');
            contentContainer.innerHTML = '';
            const defaultCommissionsView = new (await import('./AdminDefaultCommissions')).AdminDefaultCommissionsView();
            const el = await defaultCommissionsView.render();
            contentContainer.appendChild(el);
        }
    }

    // Initial tab
    await showTab('contracts');

    tabContracts.addEventListener('click', () => showTab('contracts'));
    tabDefaults.addEventListener('click', () => showTab('defaults'));

    // Listen for modal events to refresh data
    contractModal.onSave = async () => {
        dataService.invalidateContractsCache();
        const freshContracts = await dataService.getContracts();
        await renderContractsTabContent(contentContainer, freshContracts, partners, contractModal);
    };

    return card;
}