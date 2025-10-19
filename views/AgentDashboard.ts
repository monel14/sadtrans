import { User } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate, formatTransactionStatus } from '../utils/formatters';
import { renderAgentTransactionHistoryView } from './AgentTransactionHistory';
import { renderNewOperationView } from './NewOperation';
import { renderProfileView } from './Profile';
import { ApiService } from '../services/api.service';

export async function renderAgentDashboardView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const api = ApiService.getInstance();
    const container = document.createElement('div');

    // Variables pour la gestion du formulaire de recharge
    let paymentMethods: any[] = [];
    let isSubmitting = false;
    let lastSubmissionTime = 0;

    // Fetch the full user object with agency data to get the correct shared balance
    const fullUserResponse = await api.getUserWithAgency(user.id);
    const agency = fullUserResponse?.agency;
    // FIX: Property 'solde' does not exist on type 'User'. Balances are managed at the agency level.
    const mainBalance = agency?.solde_principal ?? 0;

    const [agentTransactions, opTypes, userMap] = await Promise.all([
        dataService.getTransactions({ agentId: user.id, limit: 3 }),
        dataService.getAllOperationTypes(),
        dataService.getUserMap()
    ]);

    container.innerHTML = `
        <div class="grid grid-cols-1 gap-6 mb-6"></div>
        <div class="mb-6"></div>
        <div class="mb-6"></div>
        <div class="mb-6"></div>
    `;

    const gridContainer = container.querySelector('.grid') as HTMLElement;
    
    // Créer la carte de solde avec bouton de recharge intégré
    const balanceCardContent = document.createElement('div');
    balanceCardContent.innerHTML = `
        <div class="flex flex-col justify-between h-full">
            <div>
                <p class="text-sm text-slate-500">Solde Partagé Agence</p>
                <p class="text-3xl font-bold text-emerald-600">${formatAmount(mainBalance)}</p>
                <p class="text-xs text-slate-400 mt-2">Solde partagé avec les autres agents de votre agence.</p>
            </div>
            <div class="mt-4">
                <button id="toggle-recharge-form-btn" class="btn btn-primary w-full">
                    <i class="fas fa-plus-circle mr-2"></i> Demander Recharge
                </button>
            </div>
        </div>
    `;
    const balanceCard = createCard('', balanceCardContent, 'fa-wallet', '');
    gridContainer.appendChild(balanceCard);
    
    const quickAccessContent = document.createElement('div');
    quickAccessContent.className = 'grid grid-cols-3 gap-3';
    quickAccessContent.innerHTML = `
        <button data-nav-action="new-op" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-plus-circle text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Nouvelle Opération</span>
        </button>
         <button data-nav-action="history" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-history text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Historique</span>
        </button>
        <button data-nav-action="profile" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-user-circle text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Mon Profil</span>
        </button>
    `;
    const quickAccessCard = createCard('Accès Rapides', quickAccessContent, 'fa-rocket', '');
    container.children[1].appendChild(quickAccessCard);

    // --- Section de recharge intégrée ---
    const rechargeSection = document.createElement('div');
    rechargeSection.id = 'recharge-section';
    rechargeSection.className = 'mb-6 hidden'; // Cachée par défaut
    rechargeSection.innerHTML = `
        <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-slate-800">
                    <i class="fas fa-plus-circle mr-2 text-violet-600"></i>
                    Demande de Recharge de Solde
                </h3>
                <button id="close-recharge-form-btn" class="text-slate-400 hover:text-slate-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-slate-600 mb-4">Votre demande sera envoyée à l'administrateur pour approbation. Veuillez spécifier comment vous avez effectué le versement correspondant.</p>
            
            <form id="agentRechargeForm" class="opacity-50 pointer-events-none">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label class="form-label" for="rechargePaymentMethod">Mode de paiement <span class="text-red-500">*</span></label>
                        <select id="rechargePaymentMethod" class="form-select mt-1" required>
                            <option value="">Chargement des options...</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="rechargeAmount">Montant du dépôt <span class="text-red-500">*</span></label>
                        <input type="number" id="rechargeAmount" class="form-input mt-1" min="1" required placeholder="Montant du dépôt">
                    </div>
                    <div>
                        <label class="form-label" for="rechargeReference">Référence de transaction</label>
                        <input type="text" id="rechargeReference" class="form-input mt-1" placeholder="Optionnel">
                    </div>
                    
                    <!-- Résumé des calculs -->
                    <div id="rechargeCalculationSummary" class="md:col-span-2 mt-2 p-4 border-l-4 border-violet-500 bg-violet-50 space-y-2 hidden">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">Montant du dépôt :</span>
                            <span id="summaryAmount" class="font-medium text-slate-800">0 XOF</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">Frais de transaction <span id="summaryFeeDetails" class="text-xs text-slate-500 font-mono"></span> :</span>
                            <span id="summaryFees" class="font-medium text-red-600">- 0 XOF</span>
                        </div>
                        <div class="border-t my-2 border-violet-200"></div>
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Total à recevoir :</span>
                            <span id="summaryTotal" class="font-bold text-lg text-emerald-700">0 XOF</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-2 mt-6 pt-4 border-t">
                    <button type="button" id="cancel-recharge-btn" class="btn btn-secondary">Annuler</button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-paper-plane mr-2"></i>Enregistrer et Soumettre
                    </button>
                </div>
            </form>
        </div>
    `;
    container.children[2].appendChild(rechargeSection);

    // --- New list for latest operations ---
    const latestOpsContent = document.createElement('div');
    const latestOpsList = document.createElement('ul');
    latestOpsList.className = 'space-y-2';

    if (agentTransactions.length === 0) {
        latestOpsList.innerHTML = `<li class="text-center text-slate-500 p-4">Aucune opération récente.</li>`;
    } else {
        const opTypeMap = new Map(opTypes.map(ot => [ot.id, ot]));
        agentTransactions.forEach(op => {
            const opType = opTypeMap.get(op.opTypeId);
            const statusClass = op.statut === 'Validé' ? 'badge-success' : (op.statut === 'En attente de validation' || op.statut.startsWith('Assignée') ? 'badge-warning' : 'badge-danger');
            const formattedStatus = formatTransactionStatus(op, userMap);
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 rounded-md bg-slate-50 transition-colors hover:bg-slate-100';
            li.innerHTML = `
                <div>
                    <p class="font-semibold text-slate-800">${opType?.name || 'N/A'}</p>
                    <p class="text-sm text-slate-500">${formatDate(op.date)}</p>
                </div>
                <div class="text-right">
                    <p class="font-semibold text-slate-900">${formatAmount(op.montant_principal)}</p>
                    <span class="badge ${statusClass} mt-1">${formattedStatus}</span>
                </div>
            `;
            latestOpsList.appendChild(li);
        });
    }
    latestOpsContent.appendChild(latestOpsList);

    const seeAllLink = document.createElement('div');
    seeAllLink.className = 'mt-4 text-right';
    seeAllLink.innerHTML = `<a href="#" class="text-violet-600 hover:underline text-sm font-medium">Voir tout l'historique <i class="fas fa-arrow-right text-xs"></i></a>`;
    latestOpsContent.appendChild(seeAllLink);

    const latestOpsCard = createCard('Dernières Opérations', latestOpsContent, 'fa-receipt', '');
    container.children[3].appendChild(latestOpsCard);

    // --- Fonctions utilitaires pour le formulaire de recharge ---
    const enableRechargeForm = () => {
        const form = container.querySelector('#agentRechargeForm') as HTMLFormElement;
        if (form) {
            form.classList.remove('opacity-50', 'pointer-events-none');
        }
    };

    const disableRechargeForm = () => {
        const form = container.querySelector('#agentRechargeForm') as HTMLFormElement;
        if (form) {
            form.classList.add('opacity-50', 'pointer-events-none');
        }
    };

    const loadPaymentMethods = async () => {
        const form = container.querySelector('#agentRechargeForm') as HTMLFormElement;
        if (!form) return;
        
        disableRechargeForm();
        const select = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        select.innerHTML = '<option value="">Chargement...</option>';

        try {
            paymentMethods = await api.getRechargePaymentMethods({ status: 'active' });
            select.innerHTML = '<option value="">Sélectionnez le mode de paiement</option>';
            paymentMethods.forEach((method: any) => {
                select.add(new Option(method.name, method.id));
            });
            enableRechargeForm();
        } catch (error) {
            select.innerHTML = '<option value="">Erreur de chargement</option>';
            console.error("Failed to load payment methods:", error);
            enableRechargeForm();
        }
    };

    const updateCalculations = () => {
        const form = container.querySelector('#agentRechargeForm') as HTMLFormElement;
        if (!form) return;
        
        const amountInput = form.querySelector('#rechargeAmount') as HTMLInputElement;
        const methodSelect = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        const summaryContainer = form.querySelector('#rechargeCalculationSummary') as HTMLElement;
        const summaryAmount = form.querySelector('#summaryAmount') as HTMLElement;
        const summaryFeeDetails = form.querySelector('#summaryFeeDetails') as HTMLElement;
        const summaryFees = form.querySelector('#summaryFees') as HTMLElement;
        const summaryTotal = form.querySelector('#summaryTotal') as HTMLElement;

        const amount = parseFloat(amountInput.value) || 0;
        const selectedMethod = paymentMethods.find((m: any) => m.id === methodSelect.value);

        if (amount > 0 && selectedMethod) {
            const config = selectedMethod.config || {};
            const feeType = config.feeType || 'none';
            let fees = 0;
            let feeDetails = '';

            if (feeType === 'fixed') {
                fees = config.fixedFee || 0;
                feeDetails = `(${formatAmount(fees)} fixe)`;
            } else if (feeType === 'percentage') {
                const rate = config.percentageFee || 0;
                fees = Math.round(amount * rate / 100);
                feeDetails = `(${rate}%)`;
            }

            const total = Math.max(0, amount - fees);

            summaryAmount.textContent = formatAmount(amount);
            summaryFeeDetails.textContent = feeDetails;
            summaryFees.textContent = `- ${formatAmount(fees)}`;
            summaryTotal.textContent = formatAmount(total);
            summaryContainer.classList.remove('hidden');
        } else {
            summaryContainer.classList.add('hidden');
        }
    };

    const toggleRechargeForm = () => {
        const section = container.querySelector('#recharge-section') as HTMLElement;
        if (section.classList.contains('hidden')) {
            section.classList.remove('hidden');
            loadPaymentMethods();
        } else {
            section.classList.add('hidden');
        }
    };

    const closeRechargeForm = () => {
        const section = container.querySelector('#recharge-section') as HTMLElement;
        section.classList.add('hidden');
        // Reset form
        const form = container.querySelector('#agentRechargeForm') as HTMLFormElement;
        if (form) {
            form.reset();
            const summaryContainer = form.querySelector('#rechargeCalculationSummary') as HTMLElement;
            summaryContainer.classList.add('hidden');
        }
    };
    
    // --- Realtime Balance Update Listener ---
    const handleBalanceUpdate = (event: CustomEvent) => {
        const { change } = event.detail;
        const updatedAgency = change.new;
        
        // Update main balance display
        const mainBalanceElement = container.querySelector('.text-3xl.font-bold.text-emerald-600');
        if (mainBalanceElement) {
            mainBalanceElement.textContent = formatAmount(updatedAgency.solde_principal);
        }
    };

    // Add realtime event listeners
    document.body.addEventListener('agencyBalanceChanged', handleBalanceUpdate as EventListener);
    
    // Clean up event listeners when the view is removed
    const cleanup = () => {
        document.body.removeEventListener('agencyBalanceChanged', handleBalanceUpdate as EventListener);
    };

    // Store cleanup function on the container for later use
    (container as any).cleanup = cleanup;
    
    // Delegated event listener for the entire dashboard
    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        const link = target.closest('a');

        if (button) {
            const navAction = button.dataset.navAction;
            const action = button.dataset.action;
            const buttonId = button.id;

            if (navAction === 'new-op') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { 
                        viewFn: (user: User) => renderNewOperationView(user, undefined, { openModal: true }), 
                        label: 'Nouvelle Opération', 
                        navId: 'agent_services' 
                    },
                    bubbles: true, composed: true
                }));
            } else if (action === 'recharge' || buttonId === 'toggle-recharge-form-btn') {
                toggleRechargeForm();
            } else if (buttonId === 'close-recharge-form-btn' || buttonId === 'cancel-recharge-btn') {
                closeRechargeForm();
            } else if (navAction === 'history') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn: renderAgentTransactionHistoryView, label: 'Historique des Opérations', navId: 'agent_history_ops' },
                    bubbles: true, composed: true
                }));
            } else if (navAction === 'profile') {
                container.dispatchEvent(new CustomEvent('navigateTo', {
                    detail: { viewFn: renderProfileView, label: 'Mon Profil', navId: 'agent_profile' },
                    bubbles: true, composed: true
                }));
            }
        }

        if (link && seeAllLink.contains(link)) {
            e.preventDefault();
            container.dispatchEvent(new CustomEvent('navigateTo', {
                detail: { viewFn: renderAgentTransactionHistoryView, label: 'Historique Opérations', navId: 'agent_history_ops' },
                bubbles: true, composed: true
            }));
        }
    });

    // Gestion des événements pour le formulaire de recharge
    container.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'rechargeAmount' || target.id === 'rechargePaymentMethod') {
            updateCalculations();
        }
    });

    container.addEventListener('input', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'rechargeAmount') {
            updateCalculations();
        }
    });

    // Gestion de la soumission du formulaire de recharge
    container.addEventListener('submit', async (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'agentRechargeForm') {
            e.preventDefault();
            
            if (isSubmitting) return;
            
            const now = Date.now();
            if (now - lastSubmissionTime < 3000) {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Veuillez patienter avant de soumettre une nouvelle demande.', type: 'warning' }
                }));
                return;
            }

            const form = target as HTMLFormElement;
            const formData = new FormData(form);
            const amount = parseFloat((form.querySelector('#rechargeAmount') as HTMLInputElement).value);
            const methodId = (form.querySelector('#rechargePaymentMethod') as HTMLSelectElement).value;
            const reference = (form.querySelector('#rechargeReference') as HTMLInputElement).value;

            if (!amount || amount <= 0) {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Veuillez saisir un montant valide.', type: 'error' }
                }));
                return;
            }

            if (!methodId) {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Veuillez sélectionner un mode de paiement.', type: 'error' }
                }));
                return;
            }

            isSubmitting = true;
            lastSubmissionTime = now;
            
            const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Envoi en cours...';
            submitButton.disabled = true;

            try {
                await api.createAgentRechargeRequest(
                    user.id,
                    amount,
                    methodId,
                    reference ? `Référence: ${reference}` : ''
                );

                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Demande de recharge envoyée avec succès !', type: 'success' }
                }));

                closeRechargeForm();
            } catch (error) {
                console.error('Error submitting recharge request:', error);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Erreur lors de l\'envoi de la demande. Veuillez réessayer.', type: 'error' }
                }));
            } finally {
                isSubmitting = false;
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        }
    });

    return container;
}
