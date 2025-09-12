import { User, OperationType, CommissionProfile, CommissionTier } from '../models';
import { ApiService } from '../services/api.service';
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
                        <span class="text-sm font-medium text-slate-800">${formatAmount(user.solde)}</span>
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

        if (!opDynamicFields || !summaryContainer || !selectedOperationType || !summaryBalanceInfo || !summaryDetails || !summaryDebitInfo) {
            summaryContainer?.classList.add('hidden');
            return;
        }

        const amountInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');
        const baseAmount = parseFloat(amountInput?.value || '0') || 0;

        const { totalFee, partnerShare } = await calculateFeeAndCommissionPreview(baseAmount, user, selectedOperationType, api);
        
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
            const currentBalance = user.solde || 0;
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
                
                const priceDifference = Math.max(0, newFormulaPrice - oldFormulaPrice);
                const total = priceDifference + optionPrice;
                
                totalInput.value = total.toString();
            }
        } else if (selectedOperationType.id === 'op_paiement_facture') {
            const montantPrincipalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');
            const totalAmountInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="total_amount"]');
            
            if (montantPrincipalInput && totalAmountInput) {
                const montantPrincipal = parseFloat(montantPrincipalInput.value) || 0;
                const frais = 0; // Fees are calculated in summary now
                const totalAmount = montantPrincipal + frais;
                
                totalAmountInput.value = totalAmount.toString();
            }
        } else if (selectedOperationType.id === 'op_envoi_wu' || selectedOperationType.id === 'op_envoi_ria' || selectedOperationType.id === 'op_envoi_mg') {
            const montantPrincipalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');
            const fraisInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="cost"]');
            const totalAmountInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="total_amount"]');
            const amountToReceiveInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="amount_to_receive"]');
    
            if (montantPrincipalInput && fraisInput && totalAmountInput && amountToReceiveInput) {
                const montantPrincipal = parseFloat(montantPrincipalInput.value) || 0;
                const frais = parseFloat(fraisInput.value) || 0;
                const totalAmount = montantPrincipal + frais;
                
                totalAmountInput.value = totalAmount.toString();
                amountToReceiveInput.value = montantPrincipal.toString();
            }
        }
        
        // This will update the summary box with the new calculated values
        updateOperationSummary();
    };

    const renderDynamicFields = async (opTypeId: string) => {
        if (!opDynamicFields || !opPlaceholder || !opSelectionInfo) return;
        
        opDynamicFields.innerHTML = '';

        if (!opTypeId) {
            selectedOperationType = null;
            opDynamicFields.classList.add('hidden');
            opPlaceholder.style.display = 'block';
            opSelectionInfo.classList.add('hidden');
            submitButton.disabled = true;
            return;
        }

        selectedOperationType = availableOpTypes.find(ot => ot.id === opTypeId) || null;
        
        if (selectedOperationType) {
            document.body.dispatchEvent(new CustomEvent('updateActiveNav', { detail: { navId: `op_${opTypeId}` } }));

            opPlaceholder.style.display = 'none';
            opSelectionInfo.innerHTML = `${selectedOperationType.name} <span class="text-xs font-normal text-slate-500 ml-2">(Changer)</span>`;
            opSelectionInfo.classList.remove('hidden');
            opDynamicFields.classList.remove('hidden');
            submitButton.disabled = false;

            if (selectedOperationType.impactsBalance) {
                submitButton.innerHTML = `<i class="fas fa-paper-plane mr-2"></i>Soumettre pour Validation`;
            } else {
                submitButton.innerHTML = `<i class="fas fa-concierge-bell mr-2"></i>Soumettre la Demande`;
            }
            
            for (const field of selectedOperationType.fields) {
                if (field.obsolete) continue;
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'mb-3';
                let fieldHtml = `<label class="form-label form-label-sm" for="${field.id}">${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}</label>`;
                
                const readonlyAttr = field.readonly ? ' readonly' : '';
                const readonlyClasses = field.readonly ? ' bg-slate-200 cursor-not-allowed' : '';

                if (field.type === 'select') {
                    let optionsHtml = `<option value="">-- Choisir --</option>`;
                    if (field.dataSource === 'cardTypes') {
                        const cardTypes = await api.getCardTypes();
                        cardTypes.filter(ct => ct.status === 'active').forEach(ct => {
                            optionsHtml += `<option value="${ct.name}">${ct.name}</option>`;
                        });
                    } else {
                        (field.options || []).forEach(opt => optionsHtml += `<option value="${opt.toLowerCase().replace(/\s+/g, '_').replace('+', '')}">${opt}</option>`);
                    }
                    fieldHtml += `<select id="${field.id}" name="${field.name}" class="form-select form-select-sm${readonlyClasses}"${field.required ? ' required' : ''}${readonlyAttr}>${optionsHtml}</select>`;
                } else if (field.type === 'file') {
                     fieldHtml += `<input type="file" id="${field.id}" name="${field.name}" class="form-input form-input-sm"${field.required ? ' required' : ''}>`;
                } else {
                    fieldHtml += `<input type="${field.type}" id="${field.id}" name="${field.name}" class="form-input form-input-sm${readonlyClasses}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}${field.defaultValue ? ` value="${field.defaultValue}"` : ''}${readonlyAttr}>`;
                }
                fieldDiv.innerHTML = fieldHtml;
                opDynamicFields.appendChild(fieldDiv);
            }

            if (selectedOperationType.id === 'op_abo_decodeur_canal') {
                opDynamicFields.querySelector('select[name="decoder_concept_id"]')?.addEventListener('change', updateCalculatedFields);
                opDynamicFields.querySelector('input[name="nbr_month"]')?.addEventListener('input', updateCalculatedFields);
                updateCalculatedFields();
            } else if (selectedOperationType.id === 'op_reabo_canal') {
                opDynamicFields.querySelector('select[name="formule"]')?.addEventListener('change', updateCalculatedFields);
                opDynamicFields.querySelector('select[name="option"]')?.addEventListener('change', updateCalculatedFields);
                opDynamicFields.querySelector('input[name="nb_mois"]')?.addEventListener('input', updateCalculatedFields);
                updateCalculatedFields();
            } else if (selectedOperationType.id === 'op_complement_canal') {
                const oldFormulaSelect = opDynamicFields.querySelector('select[name="ancienne_formule"]');
                const newFormulaSelect = opDynamicFields.querySelector('select[name="nouvelle_formule"]');
                const optionSelect = opDynamicFields.querySelector('select[name="option"]');

                if (oldFormulaSelect) oldFormulaSelect.addEventListener('change', updateCalculatedFields);
                if (newFormulaSelect) newFormulaSelect.addEventListener('change', updateCalculatedFields);
                if (optionSelect) optionSelect.addEventListener('change', updateCalculatedFields);
                
                updateCalculatedFields();
            } else if (selectedOperationType.id === 'op_paiement_facture') {
                opDynamicFields.querySelector('input[name="montant_principal"]')?.addEventListener('input', updateCalculatedFields);
                
                const warningDiv = document.createElement('div');
                warningDiv.className = 'mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-sm';
                warningDiv.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i><strong>Attention :</strong> En cas de délai de paiement dépassé, notre responsabilité n'est pas engagée.`;
                opDynamicFields.appendChild(warningDiv);
            
                updateCalculatedFields();
            } else if (selectedOperationType.id === 'op_envoi_wu' || selectedOperationType.id === 'op_envoi_ria' || selectedOperationType.id === 'op_envoi_mg') {
                opDynamicFields.querySelector('input[name="montant_principal"]')?.addEventListener('input', updateCalculatedFields);
                opDynamicFields.querySelector('input[name="cost"]')?.addEventListener('input', updateCalculatedFields);
                updateCalculatedFields();
            }

        } else {
             opDynamicFields.innerHTML = `<p class="text-red-500">Erreur: impossible de charger les champs pour ce type d'opération.</p>`;
             opDynamicFields.classList.remove('hidden');
        }
        updateOperationSummary();
    };

    const populateSelectionModal = () => {
        if (!opSelectionModal) return;
        const grid = $('#opSelectionGrid', opSelectionModal);
        if (!grid) return;
        grid.innerHTML = '';

        const groupedOps = availableOpTypes.reduce((acc, op) => {
            const category = op.category || 'Autres Services';
            if (!acc[category]) acc[category] = [];
            acc[category].push(op);
            return acc;
        }, {} as Record<string, OperationType[]>);

        for (const category in groupedOps) {
            const categoryWrapper = document.createElement('div');
            const categoryIcon = categoryIcons[category] || 'fa-concierge-bell';
            categoryWrapper.innerHTML = `<h4 class="text-lg font-semibold text-slate-700 mb-3"><i class="fas ${categoryIcon} mr-2 text-violet-500"></i>${category}</h4>`;

            const opsGrid = document.createElement('div');
            opsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';
            
            groupedOps[category].forEach(op => {
                const opCard = document.createElement('button');
                opCard.type = 'button';
                opCard.dataset.opId = op.id;
                opCard.dataset.opName = op.name;
                opCard.dataset.opCategory = category;
                opCard.className = 'operation-card text-left p-3 border rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-all duration-200';
                opCard.innerHTML = `
                    <p class="font-semibold text-slate-800">${op.name}</p>
                    <p class="text-xs text-slate-500">${op.description}</p>
                `;
                opCard.addEventListener('click', async () => {
                    await renderDynamicFields(op.id);
                    opSelectionModal?.classList.add('hidden');
                });
                opsGrid.appendChild(opCard);
            });
            categoryWrapper.appendChild(opsGrid);
            grid.appendChild(categoryWrapper);
        }
    };
    
    (async () => {
        if (!user.partnerId) return;
        try {
            availableOpTypes = await api.getOperationTypes({ partnerId: user.partnerId });
            populateSelectionModal();
            if (operationTypeId) {
                await renderDynamicFields(operationTypeId);
            }
        } catch (error) {
            console.error("Failed to load operation types", error);
        }
    })();

    const attachEventListeners = () => {
        if (!opSelectionModal) return;
        const form = $('#newOperationForm', container) as HTMLFormElement;
        const cancelBtn = $('#cancelOperationBtn', container);
        const closeOpModalBtn = $('#closeOpModalBtn', opSelectionModal);
        
        opDisplay?.addEventListener('click', () => opSelectionModal?.classList.remove('hidden'));
        closeOpModalBtn?.addEventListener('click', () => opSelectionModal?.classList.add('hidden'));

        opSearchInput?.addEventListener('input', () => {
            const searchTerm = opSearchInput.value.toLowerCase().trim();
            opSelectionModal?.querySelectorAll('.operation-card').forEach(cardEl => {
                const card = cardEl as HTMLElement;
                const name = card.dataset.opName?.toLowerCase() || '';
                const category = card.dataset.opCategory?.toLowerCase() || '';
                const isVisible = name.includes(searchTerm) || category.includes(searchTerm);
                card.style.display = isVisible ? 'block' : 'none';
            });
        });

        opDynamicFields?.addEventListener('input', updateOperationSummary);

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!selectedOperationType) {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Veuillez sélectionner un type d\'opération.', type: 'warning' }
                }));
                return;
            }
        
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Soumission...`;
        
            const formData = new FormData(form);
            const data: { [key: string]: any } = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
        
            try {
                await api.createTransaction(user.id, selectedOperationType.id, data);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Opération soumise pour validation !', type: 'success' }
                }));
                handleCancelNavigation(container, user);
            } catch (error) {
                console.error("Failed to create transaction", error);
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { message: 'Erreur lors de la soumission.', type: 'error' }
                }));
                submitButton.disabled = false;
                submitButton.innerHTML = `<i class="fas fa-paper-plane mr-2"></i>Soumettre pour Validation`;
            }
        });
        
        cancelBtn?.addEventListener('click', () => {
             handleCancelNavigation(container, user);
        });
    };

    attachEventListeners();

    // Hide modal if user navigates away using browser back/forward
    const navigationHandler = () => {
        opSelectionModal?.classList.add('hidden');
        window.removeEventListener('popstate', navigationHandler);
    };
    window.addEventListener('popstate', navigationHandler);

    return container;
}