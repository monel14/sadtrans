import { User } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount } from '../utils/formatters';
import { navigationLinks } from '../config/navigation';
import { NavLink } from '../models';
import { RechargePaymentMethod } from '../models';

export async function renderPartnerDashboardView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const api = ApiService.getInstance(); // Keep for the transfer function
    
    // Variables pour la gestion du formulaire de recharge
    let paymentMethods: RechargePaymentMethod[] = [];
    let isSubmitting = false;
    let lastSubmissionTime = 0;

    // Force cache invalidation to get fresh data with agency information
    dataService.invalidateUsersCache();
    dataService.invalidateTransactionsCache();
    dataService.invalidateCardsCache();
    dataService.invalidateAgentRechargeRequestsCache();

    // Fetch fresh, complete user data to ensure agency balances are included.
    const allUsers = await dataService.getUsers(); // This fetches users with agency data
    const fullUser = allUsers.find(u => u.id === user.id || u.email === user.email);

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
                    <p class="text-4xl font-bold text-emerald-600" id="main-balance">${formatAmount(mainBalance)}</p>
                </div>
                <div class="flex space-x-2 mt-4">
                    <button id="toggle-recharge-form-btn" class="btn btn-primary flex-1">
                        <i class="fas fa-plus-circle mr-2"></i> Demander Recharge
                    </button>
                </div>
                <p class="text-xs text-slate-400 mt-2">Utilisé pour toutes les transactions de vos agents.</p>
            </div>

            <!-- Revenue Balance Card -->
            <div class="card p-6 flex flex-col justify-between bg-violet-50 border-violet-200">
                <div>
                    <p class="text-sm text-violet-700">Solde Secondaire (Revenus Agence)</p>
                    <p class="text-4xl font-bold text-violet-600" id="revenue-balance">${formatAmount(revenueBalance)}</p>
                    <p class="text-xs text-violet-500 mt-2">Total des commissions perçues par votre agence.</p>
                </div>
                <button id="transfer-revenue-btn" class="btn btn-primary mt-4 w-full" ${!revenueBalance || revenueBalance === 0 ? 'disabled' : ''}>
                    <i class="fas fa-exchange-alt mr-2"></i> Transférer vers le Solde Principal
                </button>
            </div>
        </div>
    `;
    container.innerHTML = balancesGrid;

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
            
            <form id="partnerRechargeForm" class="opacity-50 pointer-events-none">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label class="form-label" for="rechargePaymentMethod">Liste des modes de paiement <span class="text-red-500">*</span></label>
                        <select id="rechargePaymentMethod" class="form-select mt-1" required>
                            <option value="">Chargement des options...</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="rechargeAmount">Montant du dépôt <span class="text-red-500">*</span></label>
                        <input type="number" id="rechargeAmount" class="form-input mt-1" min="1" required placeholder="Montant du dépôt">
                    </div>
                     <div>
                        <label class="form-label" for="rechargeReference">ID de Transaction / Référence</label>
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
    container.appendChild(rechargeSection);

    // --- Fonctions utilitaires pour le formulaire de recharge ---
    const enableRechargeForm = () => {
        const form = container.querySelector('#partnerRechargeForm') as HTMLFormElement;
        if (form) {
            form.classList.remove('opacity-50', 'pointer-events-none');
        }
    };

    const disableRechargeForm = () => {
        const form = container.querySelector('#partnerRechargeForm') as HTMLFormElement;
        if (form) {
            form.classList.add('opacity-50', 'pointer-events-none');
        }
    };

    const loadPaymentMethods = async () => {
        const form = container.querySelector('#partnerRechargeForm') as HTMLFormElement;
        if (!form) return;
        
        disableRechargeForm();
        const select = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        select.innerHTML = '<option value="">Chargement...</option>';

        try {
            paymentMethods = await api.getRechargePaymentMethods({ status: 'active' });
            select.innerHTML = '<option value="">Sélectionnez le mode de paiement</option>';
            paymentMethods.forEach(method => {
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
        const form = container.querySelector('#partnerRechargeForm') as HTMLFormElement;
        if (!form) return;
        
        const amountInput = form.querySelector('#rechargeAmount') as HTMLInputElement;
        const methodSelect = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        const summaryContainer = form.querySelector('#rechargeCalculationSummary') as HTMLElement;
        const summaryAmount = form.querySelector('#summaryAmount') as HTMLElement;
        const summaryFeeDetails = form.querySelector('#summaryFeeDetails') as HTMLElement;
        const summaryFees = form.querySelector('#summaryFees') as HTMLElement;
        const summaryTotal = form.querySelector('#summaryTotal') as HTMLElement;

        const amount = parseFloat(amountInput.value) || 0;
        const selectedMethod = paymentMethods.find(m => m.id === methodSelect.value);

        if (amount <= 0 || !selectedMethod) {
            summaryContainer.classList.add('hidden');
            return;
        }
        summaryContainer.classList.remove('hidden');

        let fees = 0;
        let feeDetailsText = '';

        if (selectedMethod) {
            if (selectedMethod.feeType === 'fixed') {
                fees = selectedMethod.feeValue;
                feeDetailsText = `(Fixe)`;
            } else if (selectedMethod.feeType === 'percentage') {
                fees = (amount * selectedMethod.feeValue) / 100;
                feeDetailsText = `(${selectedMethod.feeValue}%)`;
            }
        }

        fees = Math.round(fees);
        const amountToReceive = amount - fees;

        summaryAmount.textContent = formatAmount(amount);
        summaryFeeDetails.textContent = feeDetailsText;
        summaryFees.textContent = `- ${formatAmount(fees)}`;
        summaryTotal.textContent = formatAmount(amountToReceive);
    };

    const resetRechargeForm = () => {
        const form = container.querySelector('#partnerRechargeForm') as HTMLFormElement;
        if (!form) return;

        const amountInput = form.querySelector('#rechargeAmount') as HTMLInputElement;
        const referenceInput = form.querySelector('#rechargeReference') as HTMLInputElement;
        const paymentMethodSelect = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        const summaryContainer = form.querySelector('#rechargeCalculationSummary') as HTMLElement;

        if (amountInput) amountInput.value = '';
        if (referenceInput) referenceInput.value = '';
        if (paymentMethodSelect) paymentMethodSelect.selectedIndex = 0;
        if (summaryContainer) summaryContainer.classList.add('hidden');
    };

    const showRechargeSection = async () => {
        const section = container.querySelector('#recharge-section') as HTMLElement;
        section.classList.remove('hidden');
        await loadPaymentMethods();
        updateCalculations();
    };

    const hideRechargeSection = () => {
        const section = container.querySelector('#recharge-section') as HTMLElement;
        section.classList.add('hidden');
        resetRechargeForm();
    };

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
         <button data-nav-id="partner_contract" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-file-signature text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Mon Contrat</span>
        </button>
        <button data-nav-id="partner_all_transactions" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-list-ul text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Opérations</span>
        </button>
        <button data-nav-id="partner_recharge_history" class="flex flex-col items-center justify-center p-3 bg-slate-100 hover:bg-violet-100 rounded-lg transition-colors text-center">
            <i class="fas fa-history text-xl text-slate-500 mb-2"></i>
            <span class="text-xs font-semibold text-slate-700">Historique Recharges</span>
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

    // --- Realtime Balance Update Listener ---
    const handleBalanceUpdate = (event: CustomEvent) => {
        const { change } = event.detail;
        const updatedAgency = change.new;
        
        // Update main balance display
        const mainBalanceElement = container.querySelector('#main-balance');
        if (mainBalanceElement) {
            mainBalanceElement.textContent = formatAmount(updatedAgency.solde_principal);
        }
        
        // Update revenue balance display
        const revenueBalanceElement = container.querySelector('#revenue-balance');
        if (revenueBalanceElement) {
            revenueBalanceElement.textContent = formatAmount(updatedAgency.solde_revenus);
        }
        
        // Update transfer button state
        const transferBtn = container.querySelector('#transfer-revenue-btn') as HTMLButtonElement;
        if (transferBtn) {
            transferBtn.disabled = !updatedAgency.solde_revenus || updatedAgency.solde_revenus === 0;
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

    container.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const transferBtn = target.closest('#transfer-revenue-btn');
        const requestRechargeBtn = target.closest('#request-recharge-btn');
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

        if (target.closest('#toggle-recharge-form-btn')) {
            showRechargeSection();
        }

        if (target.closest('#close-recharge-form-btn') || target.closest('#cancel-recharge-btn')) {
            hideRechargeSection();
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

    // --- Event listeners pour le formulaire de recharge ---
    container.addEventListener('input', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'rechargeAmount' || target.id === 'rechargePaymentMethod') {
            updateCalculations();
        }
    });

    container.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'rechargePaymentMethod') {
            updateCalculations();
        }
    });

    container.addEventListener('submit', async (e) => {
        const form = e.target as HTMLFormElement;
        if (form.id !== 'partnerRechargeForm') return;
        
        e.preventDefault();
        e.stopPropagation();

        // Prévenir les soumissions multiples
        const now = Date.now();
        if (isSubmitting) {
            console.log('Recharge submission already in progress, ignoring duplicate click');
            return;
        }

        if (now - lastSubmissionTime < 2000) {
            console.log('Too soon after last recharge submission, ignoring click');
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Veuillez patienter avant de soumettre à nouveau.', type: 'warning' }
            }));
            return;
        }

        lastSubmissionTime = now;

        if (!fullUser || !form) {
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: "Erreur: Utilisateur non identifié.", type: 'error' } 
            }));
            return;
        }

        enableRechargeForm();

        const amountInput = form.querySelector('#rechargeAmount') as HTMLInputElement;
        const paymentMethodInput = form.querySelector('#rechargePaymentMethod') as HTMLSelectElement;
        const referenceInput = form.querySelector('#rechargeReference') as HTMLInputElement;
        const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

        // Nettoyer les états de validation précédents
        if (amountInput) amountInput.setCustomValidity('');
        if (paymentMethodInput) paymentMethodInput.setCustomValidity('');
        if (referenceInput) referenceInput.setCustomValidity('');

        const montant = parseFloat(amountInput.value);
        const methodId = paymentMethodInput.value;
        const reference = referenceInput.value.trim();

        console.log('Form values at submission:', { montant, methodId, reference });

        if (!methodId) {
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: "Veuillez sélectionner un mode de paiement.", type: 'warning' } 
            }));
            paymentMethodInput.focus();
            isSubmitting = false;
            enableRechargeForm();
            return;
        }

        if (isNaN(montant) || montant <= 0) {
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: "Veuillez entrer un montant valide.", type: 'warning' } 
            }));
            amountInput.focus();
            isSubmitting = false;
            enableRechargeForm();
            return;
        }

        // Définir l'état de soumission et désactiver le bouton
        isSubmitting = true;
        const originalButtonHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.style.pointerEvents = 'none';
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Envoi...`;

        try {
            await api.createPartnerRechargeRequest(
                fullUser.id,
                montant,
                methodId,
                reference
            );
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: "Votre demande de recharge a été soumise avec succès !", type: 'success' } 
            }));

            // Réinitialiser le formulaire et le cacher
            resetRechargeForm();
            hideRechargeSection();
            isSubmitting = false;
        } catch (error) {
            console.error("Failed to create recharge request:", (error as Error).message || error);
            document.body.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: "Une erreur est survenue lors de la soumission de votre demande.", type: 'error' } 
            }));
        } finally {
            // Restaurer l'état du bouton
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHtml;
            submitButton.style.pointerEvents = 'auto';
            enableRechargeForm();
            isSubmitting = false;
        }
    });

    return container;
}