import { User, OperationType, CommissionProfile, CommissionTier, CardType } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { $ } from '../utils/dom';
import { renderAgentDashboardView } from './AgentDashboard';
import { renderPartnerDashboardView } from './PartnerDashboard';
import { formatAmount } from '../utils/formatters';

// Helper to assign icons to categories
const categoryIcons: { [key: string]: string } = {
    'Dépôts': 'fa-money-bill-wave',
    'Cartes VISA': 'fa-credit-card',
    'Gestion des décodeurs (Canal +)': 'fa-satellite-dish',
    'Ecobank Xpress': 'fa-university',
    'Western Union': 'fa-globe-americas',
    'Ria': 'fa-comments-dollar',
    'MoneyGram': 'fa-dollar-sign',
    'Paiement de Factures': 'fa-file-invoice-dollar',
    'Autres Services': 'fa-cogs',
};

function createOperationSelectionModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'operationSelectionModal';
    modal.className = 'fixed inset-0 bg-slate-900 bg-opacity-70 backdrop-blur-sm z-40 flex justify-center items-center p-4';
    modal.classList.add('hidden'); // Start hidden
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div class="p-4 sm:p-5 border-b sticky top-0 bg-white rounded-t-xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-slate-800">Choisir une Opération</h3>
                    <button type="button" id="closeOpModalBtn" class="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
                </div>
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" id="opSearchInput" placeholder="Rechercher par nom, service, mot-clé..." class="form-input pl-10 w-full">
                </div>
            </div>
            <div id="opSelectionGrid" class="p-4 sm:p-5 overflow-y-auto space-y-6">
                <!-- Dynamic content will be injected here -->
            </div>
        </div>
    `;
    return modal;
}

function handleCancelNavigation(container: HTMLElement, user: User) {
    const dashboardViewFn = user.role === 'agent' ? renderAgentDashboardView : renderPartnerDashboardView;
    const dashboardLabel = user.role === 'agent' ? 'Tableau de Bord' : 'Dashboard Partenaire';
    const navId = user.role === 'agent' ? 'agent_dashboard' : 'partner_dashboard';
    container.dispatchEvent(new CustomEvent('navigateTo', {
        detail: { viewFn: dashboardViewFn, label: dashboardLabel, navId: navId },
        bubbles: true,
        composed: true
    }));
}

async function calculateFeeAndCommissionPreview(montant: number, user: User, opType: OperationType, api: ApiService): Promise<{ totalFee: number; partnerShare: number }> {
    const preview = await api.getFeePreview(user.id, opType.id, montant);
    return { totalFee: preview.totalFee, partnerShare: preview.partnerShare };
}


// Prices for Canal+ formulas (new subscriptions)
const canalPlusPrices: { [key: string]: number } = {
    'kwabo': 2500,
    'netflix_01_ecran': 3000,
    'access': 5000,
    'dstv_english_plus': 5000,
    'netflix_02_ecrans': 5500,
    'netflix_03_ecrans': 7000,
    'evasion': 10000,
    'access+': 15000,
    'tout_canal': 25000,
};

// Prices for Canal+ formulas (re-subscriptions)
const canalPlusReaboFormulaPrices: { [key: string]: number } = {
    'kwabo': 2500,
    'access': 5000,
    'evasion': 10000,
    'access+': 15000,
    'tout_canal': 25000,
};
const canalPlusReaboOptionPrices: { [key: string]: number } = {
    'aucune': 0,
    'netflix_01_ecran': 3000,
    'dstv_english_plus': 5000,
    'netflix_02_ecrans': 5500,
    'netflix_03_ecrans': 7000,
};


async function renderDynamicFields(opType: OperationType, container: HTMLElement, cardTypes: CardType[]) {
    container.innerHTML = '';
    opType.fields.forEach(field => {
        if (field.obsolete) return;

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'mb-4';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.htmlFor = `op_field_${field.id}`;
        label.textContent = field.label;
        if (field.required) {
            label.innerHTML += ' <span class="text-red-500">*</span>';
        }
        fieldWrapper.appendChild(label);

        let inputElement: HTMLElement;
        if (field.type === 'select') {
            const select = document.createElement('select');
            select.id = `op_field_${field.id}`;
            select.name = field.name;
            select.className = 'form-select mt-1';
            if (field.required) select.required = true;

            // Add a default placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = "";
            placeholderOption.textContent = field.placeholder || `Sélectionnez...`;
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            select.appendChild(placeholderOption);

            let options: string[] = [];
            if (field.dataSource === 'cardTypes') {
                options = cardTypes.filter(ct => ct.status === 'active').map(ct => ct.name);
            } else {
                options = field.options || [];
            }
            
            options.forEach(optionText => {
                select.add(new Option(optionText, optionText));
            });
            inputElement = select;
        } else {
            const input = document.createElement('input');
            input.id = `op_field_${field.id}`;
            input.name = field.name;
            input.className = 'form-input mt-1';
            input.type = field.type;
            if (field.required) input.required = true;
            if (field.placeholder) input.placeholder = field.placeholder;
            if (field.readonly) input.readOnly = true;
            if (field.defaultValue) input.defaultValue = String(field.defaultValue);
            inputElement = input;
        }

        fieldWrapper.appendChild(inputElement);
        container.appendChild(fieldWrapper);
    });

    container.classList.remove('hidden');
}

export async function renderNewOperationView(user: User, operationTypeId?: string): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const container = document.createElement('div');
    container.id = 'new-operation-view';

    // Store fetched operation types to avoid refetching
    let availableOpTypes: OperationType[] = [];
    let selectedOperationType: OperationType | null = null;
    
    // --- Get or create the modal on document.body to avoid stacking context issues ---
    let opSelectionModal = document.getElementById('operationSelectionModal');
    if (!opSelectionModal) {
        opSelectionModal = createOperationSelectionModal();
        document.body.appendChild(opSelectionModal);
    }

    const formContent = document.createElement('div');
    formContent.innerHTML = `
        <form id="newOperationForm" onsubmit="return false;">
            <div class="mb-6">
                <label class="form-label">Type d'Opération Sélectionné</label>
                <div id="selectedOpDisplay" class="p-4 border-2 border-dashed rounded-lg text-center text-slate-500 hover:border-violet-400 hover:text-violet-600 cursor-pointer bg-slate-50">
                    <div id="opPlaceholder">
                        <i class="fas fa-hand-pointer mr-2"></i> Cliquez ici pour choisir une opération
                    </div>
                    <div id="opSelectionInfo" class="hidden font-semibold"></div>
                </div>
            </div>

            <div id="opDynamicFields" class="mb-6 p-4 border rounded-lg bg-slate-50 min-h-[150px] hidden">
            </div>
            
            <div id="operation-summary" class="mb-8 p-4 border-l-4 border-violet-500 bg-violet-50 space-y-3 hidden">
                <!-- Balance Info (shown only if impactsBalance) -->
                <div id="summary-balance-info" class="hidden">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-600">Votre solde actuel :</span>
                        <span class="text-sm font-medium text-slate-800">${formatAmount((user as any).agency?.solde_principal ?? user.solde ?? 0)}</span>
                    </div>
                    <div class="border-t border-violet-200 my-3"></div>
                </div>

                <!-- Transaction Details (shown if fees > 0 or impactsBalance) -->
                <div id="summary-details"></div>

                <!-- Debit Info (shown only if impactsBalance) -->
                <div id="summary-debit-info" class="hidden">
                    <div class="flex justify-between items-center text-base mt-2 pt-2 border-t border-violet-200">
                        <span class="font-semibold text-slate-700">Total à débiter :</span>
                        <span id="summaryTotalDebit" class="font-bold text-lg text-red-600">--,-- XOF</span>
                    </div>
                    <div class="flex justify-between items-center text-base mt-2 pt-2 border-t border-violet-200">
                        <span class="font-semibold text-slate-700">Solde final estimé :</span>
                        <span id="summaryFinalBalance" class="font-bold text-lg text-emerald-700">--,-- XOF</span>
                    </div>
                </div>
            </div>


            <div class="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button type="button" id="cancelOperationBtn" class="btn btn-secondary w-full sm:w-auto">Annuler</button>
                <button type="submit" form="newOperationForm" class="btn btn-primary w-full sm:w-auto" disabled><i class="fas fa-paper-plane mr-2"></i>Soumettre pour Validation</button>
            </div>
        </form>
    `;

    const card = createCard('Nouvelle Opération', formContent, 'fa-plus-circle');
    container.appendChild(card);
    
    // Selectors for elements inside the view
    const opDisplay = $('#selectedOpDisplay', container);
    const opPlaceholder = $('#opPlaceholder', container);
    const opSelectionInfo = $('#opSelectionInfo', container);
    const opDynamicFields = $('#opDynamicFields', container);
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    
    // Selector for elements inside the modal, which is now on document.body
    const opSearchInput = $('#opSearchInput', opSelectionModal) as HTMLInputElement;

    const updateOperationSummary = async () => {
        const summaryContainer = $('#operation-summary', container);
        const summaryBalanceInfo = $('#summary-balance-info', container);
        const summaryDetails = $('#summary-details', container);
        const summaryDebitInfo = $('#summary-debit-info', container);
        const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

        if (!opDynamicFields || !summaryContainer || !selectedOperationType || !summaryBalanceInfo || !summaryDetails || !summaryDebitInfo) {
            summaryContainer?.classList.add('hidden');
            return;
        }

        const amountInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');
        const baseAmount = parseFloat(amountInput?.value || '0') || 0;

        let totalFee: number;
        let partnerShare: number;

        try {
            const preview = await calculateFeeAndCommissionPreview(baseAmount, user, selectedOperationType, api);
            totalFee = preview.totalFee;
            partnerShare = preview.partnerShare;
            if (submitBtn && selectedOperationType) submitBtn.disabled = false; // Re-enable on success
        } catch (error) {
            console.error("Failed to calculate fee preview:", error);
            summaryContainer.classList.remove('hidden');
            summaryBalanceInfo.classList.add('hidden');
            summaryDebitInfo.classList.add('hidden');
            summaryDetails.innerHTML = `<p class="text-sm font-medium text-red-700"><i class="fas fa-exclamation-triangle mr-2"></i>Impossible de calculer les frais. La soumission est désactivée.</p>`;
            if (submitBtn) submitBtn.disabled = true;
            return;
        }
        
        if (!selectedOperationType.impactsBalance && totalFee <= 0) {
            summaryContainer.classList.add('hidden');
            return;
        }
        
        summaryContainer.classList.remove('hidden');

        const feeApplication = selectedOperationType.feeApplication || 'additive';
        let totalDebit = 0;
        let summaryHtml = '';

        if (feeApplication === 'inclusive') {
            const netAmount = baseAmount - totalFee;
            totalDebit = baseAmount;
            summaryHtml = `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">Montant total (client) :</span>
                    <span class="font-medium text-slate-800">${formatAmount(baseAmount)}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">Frais de service (inclus) :</span>
                    <span class="font-medium text-slate-800">${formatAmount(totalFee)}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">Montant net du service :</span>
                    <span class="font-medium text-slate-800">${formatAmount(netAmount)}</span>
                </div>
            `;
        } else { // additive
            totalDebit = baseAmount + totalFee;
            summaryHtml = `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">Montant de l'opération :</span>
                    <span class="font-medium text-slate-800">${formatAmount(baseAmount)}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">Frais de service (en plus) :</span>
                    <span class="font-medium text-slate-800">${formatAmount(totalFee)}</span>
                </div>
            `;
        }
        
        if (partnerShare > 0) {
            summaryHtml += `
                 <div class="flex justify-between items-center text-sm mt-2 pt-2 border-t border-violet-200">
                    <span class="font-semibold text-emerald-700">Votre commission estimée :</span>
                    <span class="font-bold text-emerald-700">${formatAmount(partnerShare)}</span>
                </div>
            `;
        }

        summaryDetails.innerHTML = summaryHtml;
        
        summaryBalanceInfo.classList.toggle('hidden', !selectedOperationType.impactsBalance);
        summaryDebitInfo.classList.toggle('hidden', !selectedOperationType.impactsBalance);

        if (selectedOperationType.impactsBalance) {
            // Use agency balance if available, otherwise fall back to individual balance
            const currentBalance = (user as any).agency?.solde_principal ?? user.solde ?? 0;
            const finalBalance = currentBalance - totalDebit;
            
            const summaryTotalDebitEl = $('#summaryTotalDebit', summaryDebitInfo);
            const summaryFinalBalanceEl = $('#summaryFinalBalance', summaryDebitInfo);
            
            if(summaryTotalDebitEl) summaryTotalDebitEl.textContent = formatAmount(totalDebit);
            if(summaryFinalBalanceEl) summaryFinalBalanceEl.textContent = formatAmount(finalBalance);
        }
    };
    
    const updateCalculatedFields = () => {
        if (!selectedOperationType || !opDynamicFields) return;
    
        if (selectedOperationType.id === 'op_abo_decodeur_canal') {
            const formulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="decoder_concept_id"]');
            const nbrMonthInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="nbr_month"]');
            const conceptPriceInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="concept_price"]');
            const totalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');

            if (formulaSelect && nbrMonthInput && conceptPriceInput && totalInput) {
                const selectedFormula = formulaSelect.value;
                const formulaPrice = canalPlusPrices[selectedFormula] || 0;
                
                const numberOfMonths = parseInt(nbrMonthInput.value, 10);
                const finalNumberOfMonths = (isNaN(numberOfMonths) || numberOfMonths < 1) ? 1 : numberOfMonths;

                const total = formulaPrice * finalNumberOfMonths;

                conceptPriceInput.value = formulaPrice.toString();
                totalInput.value = total.toString();
            }
        } else if (selectedOperationType.id === 'op_reabo_canal') {
            const formulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="formule"]');
            const optionSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="option"]');
            const nbrMonthInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="nb_mois"]');
            const totalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');

            if (formulaSelect && optionSelect && nbrMonthInput && totalInput) {
                const selectedFormula = formulaSelect.value;
                const selectedOption = optionSelect.value;
                
                const formulaPrice = canalPlusReaboFormulaPrices[selectedFormula] || 0;
                const optionPrice = canalPlusReaboOptionPrices[selectedOption] || 0;
                
                const numberOfMonths = parseInt(nbrMonthInput.value, 10);
                const finalNumberOfMonths = (isNaN(numberOfMonths) || numberOfMonths < 1) ? 1 : numberOfMonths;

                const total = (formulaPrice + optionPrice) * finalNumberOfMonths;

                totalInput.value = total.toString();
            }
        } else if (selectedOperationType.id === 'op_complement_canal') {
            const oldFormulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="ancienne_formule"]');
            const oldFormulaPriceInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="prix_ancienne_formule"]');
            const newFormulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="nouvelle_formule"]');
            const newFormulaPriceInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="prix_nouvelle_formule"]');
            const optionSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="option"]');
            const optionPriceInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="prix_option"]');
            const totalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');

            if (oldFormulaSelect && oldFormulaPriceInput && newFormulaSelect && newFormulaPriceInput && optionSelect && optionPriceInput && totalInput) {
                const selectedOldFormula = oldFormulaSelect.value;
                const oldFormulaPrice = canalPlusReaboFormulaPrices[selectedOldFormula] || 0;
                oldFormulaPriceInput.value = oldFormulaPrice.toString();

                // Filter new formulas to only show upgrades
                const newFormulaOptions = newFormulaSelect.options;
                for (let i = 0; i < newFormulaOptions.length; i++) {
                    const option = newFormulaOptions[i];
                    const optionPrice = canalPlusReaboFormulaPrices[option.value] || 0;
                    const isDisabled = !option.value || optionPrice <= oldFormulaPrice;
                    option.disabled = isDisabled;
                    option.hidden = isDisabled;
                }
                if (newFormulaSelect.options[newFormulaSelect.selectedIndex]?.disabled) {
                    newFormulaSelect.value = '';
                }
                newFormulaSelect.disabled = !selectedOldFormula;

                const selectedNewFormula = newFormulaSelect.value;
                const newFormulaPrice = canalPlusReaboFormulaPrices[selectedNewFormula] || 0;
                newFormulaPriceInput.value = newFormulaPrice.toString();

                const selectedOption = optionSelect.value;
                const optionPrice = canalPlusReaboOptionPrices[selectedOption] || 0;
                optionPriceInput.value = optionPrice.toString();

                const total = (newFormulaPrice - oldFormulaPrice) + optionPrice;
                totalInput.value = total.toString();
            }
        }
        updateOperationSummary();
    };
    
    // Use event delegation for dynamic fields
    opDynamicFields?.addEventListener('input', updateCalculatedFields);
    opDynamicFields?.addEventListener('change', updateCalculatedFields);
    
    
    const selectOperationType = (opType: OperationType) => {
        selectedOperationType = opType;
        if (opPlaceholder && opSelectionInfo) {
            opPlaceholder.classList.add('hidden');
            opSelectionInfo.innerHTML = `<i class="fas ${categoryIcons[opType.category] || 'fa-cogs'} mr-3"></i> ${opType.name}`;
            opSelectionInfo.classList.remove('hidden');
        }
        if (opSelectionModal) {
            opSelectionModal.classList.add('hidden');
        }
        
        const dataService = DataService.getInstance();
        dataService.getCardTypes().then(cardTypes => {
            renderDynamicFields(opType, opDynamicFields as HTMLElement, cardTypes);
            updateCalculatedFields(); // Initial calculation
        });
        submitButton.disabled = false;
    };


    const openOpSelectionModal = async () => {
        if (!opSelectionModal) return;

        const opGrid = $('#opSelectionGrid', opSelectionModal);
        if (!opGrid) return;
        
        opGrid.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-slate-400"></i></div>';
        opSelectionModal.classList.remove('hidden');

        if (availableOpTypes.length === 0) {
            availableOpTypes = await DataService.getInstance().getAllOperationTypes();
        }
        
        const groupedOps = availableOpTypes.reduce((acc, op) => {
            if (op.status !== 'active') return acc;
            const category = op.category || 'Autres Services';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(op);
            return acc;
        }, {} as Record<string, OperationType[]>);

        opGrid.innerHTML = ''; // Clear spinner
        Object.keys(groupedOps).sort().forEach(category => {
            const categorySection = document.createElement('div');
            categorySection.innerHTML = `
                <h4 class="text-lg font-semibold text-slate-700 mb-3 flex items-center">
                   <i class="fas ${categoryIcons[category] || 'fa-cogs'} mr-3 text-violet-500"></i>
                   ${category}
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 category-grid">
                    <!-- Operation buttons go here -->
                </div>
            `;
            const gridContainer = categorySection.querySelector('.category-grid');
            groupedOps[category].forEach(op => {
                const button = document.createElement('button');
                button.className = 'operation-item text-left p-3 border rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors';
                button.dataset.opId = op.id;
                button.innerHTML = `
                    <p class="font-semibold text-slate-800">${op.name}</p>
                    <p class="text-xs text-slate-500 mt-1">${op.description}</p>
                `;
                gridContainer?.appendChild(button);
            });
            opGrid.appendChild(categorySection);
        });
    };
    
    opDisplay?.addEventListener('click', openOpSelectionModal);
    $('#closeOpModalBtn', opSelectionModal)?.addEventListener('click', () => opSelectionModal?.classList.add('hidden'));

    opSelectionModal?.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const opButton = target.closest<HTMLButtonElement>('.operation-item');
        if (opButton) {
            const opId = opButton.dataset.opId;
            const selectedOp = availableOpTypes.find(op => op.id === opId);
            if (selectedOp) {
                selectOperationType(selectedOp);
            }
        }
        // Close if clicking on the backdrop
        if (target.id === 'operationSelectionModal') {
            opSelectionModal?.classList.add('hidden');
        }
    });

    opSearchInput?.addEventListener('input', () => {
        const searchTerm = opSearchInput.value.toLowerCase().trim();
        opSelectionModal?.querySelectorAll('.operation-item').forEach(item => {
            const itemElement = item as HTMLElement;
            const itemText = itemElement.textContent?.toLowerCase() || '';
            itemElement.style.display = itemText.includes(searchTerm) ? '' : 'none';
        });

        opSelectionModal?.querySelectorAll('.category-grid').forEach(grid => {
            const gridElement = grid as HTMLElement;
            const hasVisibleItems = !!gridElement.querySelector('.operation-item[style*="display:"]');
            const section = gridElement.parentElement;
            if(section) {
                section.style.display = hasVisibleItems ? '' : 'none';
            }
        });
    });

    $('#cancelOperationBtn', container)?.addEventListener('click', () => handleCancelNavigation(container, user));

    container.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        if (!selectedOperationType) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "Veuillez d'abord sélectionner une opération.", type: 'warning' }
            }));
            return;
        }

        const formData = new FormData(form);
        const data: { [key: string]: any } = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        const originalBtnHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Soumission en cours...`;

        try {
            const newTransaction = await api.createTransaction(user.id, selectedOperationType.id, data);
             document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Opération #${newTransaction.id} soumise avec succès !`, type: 'success' }
            }));
            handleCancelNavigation(container, user);
        } catch (error) {
            console.error("Transaction creation failed:", error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "La soumission a échoué. Vérifiez votre solde et les informations.", type: 'error' }
            }));
            submitButton.disabled = false;
            submitButton.innerHTML = originalBtnHtml;
        }
    });

    const initializeView = async () => {
        if (operationTypeId) {
            const dataService = DataService.getInstance();
            const allOps = await dataService.getAllOperationTypes();
            const opToSelect = allOps.find(op => op.id === operationTypeId);
            if (opToSelect) {
                selectOperationType(opToSelect);
            }
        }
    };

    initializeView();

    return container;
}
