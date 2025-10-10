

// Fix: Import 'OperationTypeField' and 'OperationTypeFieldOption' to resolve type errors.
import { User, OperationType, CommissionTier, CardType, OperationTypeField, OperationTypeFieldOption } from '../models';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { $ } from '../utils/dom';
import { renderAgentDashboardView } from './AgentDashboard';
import { renderPartnerDashboardView } from './PartnerDashboard';
import { formatAmount } from '../utils/formatters';
import { hasAmountField, extractAmountFromTransactionData } from '../utils/operation-type-helpers';

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


// Helper function to get price from a select option
function getPriceFromSelectOption(selectElement: HTMLSelectElement): number {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption && selectedOption.hasAttribute('data-prix')) {
        return parseInt(selectedOption.getAttribute('data-prix') || '0', 10);
    }
    return 0;
}

// Helper function to get price from field options by value
function getPriceFromFieldOptions(field: OperationTypeField, value: string): number {
    if (!field.options || !value) return 0;

    for (const option of field.options) {
        if (typeof option === 'object' && option.valeur === value && option.prix !== undefined) {
            return option.prix;
        }
    }
    return 0;
}


async function renderDynamicFields(opType: OperationType, container: HTMLElement, cardTypes: CardType[], updateCallback?: () => void) {
    container.innerHTML = '';
    
    if (!opType.fields || opType.fields.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-4">Aucun champ défini pour cette opération.</p>';
        container.classList.remove('hidden');
        return;
    }
    
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

            if (field.dataSource === 'cardTypes') {
                // Utiliser les types de cartes depuis l'API
                const options = cardTypes.filter(ct => ct.status === 'active').map(ct => ct.name);
                options.forEach(optionText => {
                    select.add(new Option(optionText, optionText));
                });
            } else if (field.options) {
                // Supporter les deux formats : string[] et OperationTypeFieldOption[]
                field.options.forEach(option => {
                    if (typeof option === 'string') {
                        // Format simple : string[]
                        select.add(new Option(option, option));
                    } else {
                        // Format enrichi : OperationTypeFieldOption[]
                        const optionElement = new Option(option.libelle, option.valeur);
                        // Stocker le prix dans un attribut data pour récupération ultérieure
                        if (option.prix !== undefined) {
                            optionElement.setAttribute('data-prix', option.prix.toString());
                        }
                        select.appendChild(optionElement);
                    }
                });
            }

            // Ajouter les événements directement sur le select
            if (updateCallback) {
                select.addEventListener('change', updateCallback);
                select.addEventListener('input', updateCallback);
            }
            // Fix: Missing assignment for 'select' element.
            inputElement = select;
        } else {
            const input = document.createElement('input');
            input.id = `op_field_${field.id}`;
            input.name = field.name;
            input.className = 'form-input mt-1';
            
            // Handle image type specially
            if (field.type === 'image') {
                input.type = 'file';
                input.accept = 'image/*';
                input.className += ' file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100';
                
                // Add image preview functionality
                input.addEventListener('change', (e) => {
                    const fileInput = e.target as HTMLInputElement;
                    const file = fileInput.files?.[0];
                    
                    // Remove existing preview
                    const existingPreview = fieldWrapper.querySelector('.image-preview');
                    existingPreview?.remove();
                    
                    if (file) {
                        // Validate file size
                        const maxSize = 5 * 1024 * 1024; // 5MB
                        if (file.size > maxSize) {
                            document.body.dispatchEvent(new CustomEvent('showToast', {
                                detail: { message: `Image trop volumineuse (max 5MB). Taille: ${(file.size / 1024 / 1024).toFixed(1)}MB`, type: 'warning' }
                            }));
                            fileInput.value = '';
                            return;
                        }
                        
                        // Create preview
                        const preview = document.createElement('div');
                        preview.className = 'image-preview mt-2 p-2 border rounded-lg bg-slate-50';
                        
                        const img = document.createElement('img');
                        img.className = 'max-w-full max-h-32 rounded object-contain mx-auto block';
                        
                        const fileName = document.createElement('p');
                        fileName.className = 'text-xs text-slate-500 mt-1 text-center';
                        fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        
                        preview.appendChild(img);
                        preview.appendChild(fileName);
                        fieldWrapper.appendChild(preview);
                        
                        // Load image preview
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            img.src = e.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            } else {
                input.type = field.type;
            }
            
            if (field.required) input.required = true;
            if (field.placeholder && field.type !== 'image') input.placeholder = field.placeholder;
            if (field.readonly) input.readOnly = true;
            if (field.defaultValue && field.type !== 'image') input.defaultValue = String(field.defaultValue);

            // Ajouter les événements directement sur l'input
            if (updateCallback) {
                input.addEventListener('input', updateCallback);
                input.addEventListener('change', updateCallback);
                input.addEventListener('keyup', updateCallback);
                input.addEventListener('blur', updateCallback);
            }

            inputElement = input;

            // Autocomplétion: Identification carte/décodeur depuis l’historique
            try {
                const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                const labelNorm = norm(field.label);
                const nameNorm = norm(field.name);

                // Détecter si ce champ est l'identifiant de carte
                const isCardIdField = (() => {
                    const candidates = [
                        'identification de la carte',
                        'id carte',
                        'identification carte',
                        'identifiant carte',
                        'numero carte',
                        'num carte'
                    ];
                    return candidates.some(c => labelNorm.includes(norm(c)))
                        || (nameNorm.includes('identification') && nameNorm.includes('carte'))
                        || nameNorm === 'id_carte'
                        || nameNorm === 'numero_carte'
                        || nameNorm === 'num_carte';
                })();

                // Détecter si ce champ est l'identifiant du décodeur
                const isDecoderIdField = (() => {
                    const candidates = [
                        'identifiant du decodeur',
                        'identifiant decodeur',
                        'id decodeur',
                        'decoder id',
                        'numero decodeur',
                        'num decodeur',
                        'identifiant du décodeur',
                        'identifiant décodeur'
                    ];
                    return candidates.some(c => labelNorm.includes(norm(c)))
                        || (nameNorm.includes('identifiant') && (nameNorm.includes('decodeur') || nameNorm.includes('décodeur')))
                        || nameNorm === 'decoder_id'
                        || nameNorm === 'id_decodeur'
                        || nameNorm === 'numero_decodeur'
                        || nameNorm === 'num_decodeur'
                        || nameNorm === 'identifiant_decodeur';
                })();

                const registerAutocomplete = (
                    categoryFilter: (cat: string) => boolean,
                    candidateKeys: string[],
                    datalistIdPrefix: string,
                    hintText: string
                ) => {
                    const datalistId = `${datalistIdPrefix}${opType.id}`;
                    const dl = document.createElement('datalist');
                    dl.id = datalistId;
                    input.setAttribute('list', datalistId);
                    fieldWrapper.appendChild(dl);

                    const hint = document.createElement('small');
                    hint.className = 'block mt-1 text-xs text-slate-500';
                    hint.textContent = hintText;
                    fieldWrapper.appendChild(hint);

                    (async () => {
                        try {
                            const ds = DataService.getInstance();
                            const [txs, opMap] = await Promise.all([
                                ds.getTransactions({ limit: 500 }),
                                ds.getOpTypeMap()
                            ]);

                            const idToData = new Map<string, any>();

                            for (const t of txs) {
                                const tOp = opMap.get(t.opTypeId);
                                const cat = norm(tOp?.category || '');
                                if (!tOp || !categoryFilter(cat)) continue;

                                const d = (t.data || (t as any).form_data || {}) as Record<string, any>;
                                let idVal: any = null;
                                for (const k of candidateKeys) {
                                    if (d[k] !== undefined && d[k] !== null && String(d[k]).trim() !== '') { idVal = d[k]; break; }
                                }
                                if (idVal !== null) {
                                    idToData.set(String(idVal), d);
                                }
                            }

                            // Peupler le datalist avec des identifiants uniques (max 50)
                            dl.innerHTML = '';
                            Array.from(idToData.keys()).slice(0, 50).forEach(val => {
                                const opt = document.createElement('option');
                                opt.value = val;
                                dl.appendChild(opt);
                            });

                            const fillFromHistory = () => {
                                const val = input.value.trim();
                                if (!val) return;
                                const d = idToData.get(val);
                                if (!d) return;

                                Object.entries(d).forEach(([key, value]) => {
                                    // Ignorer les fichiers / images
                                    const selector = `[name="${key.replace(/"/g, '\\"')}"]`;
                                    const target = (container.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null);
                                    if (!target) return;
                                    if ((target as HTMLInputElement).type === 'file' || (target as any).type === 'image') return;

                                    if (target instanceof HTMLSelectElement) {
                                        const match = Array.from(target.options).find(o => o.value == String(value));
                                        if (match) {
                                            target.value = match.value;
                                            target.dispatchEvent(new Event('change', { bubbles: true }));
                                        }
                                    } else {
                                        target.value = String(value ?? '');
                                        target.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                });

                                if (updateCallback) updateCallback();
                            };

                            input.addEventListener('change', fillFromHistory);
                            input.addEventListener('blur', fillFromHistory);
                        } catch (e) {
                            console.error('Erreur autocomplétion:', e);
                        }
                    })();
                };

                if (isCardIdField && input.type !== 'file' && input.type !== 'image') {
                    registerAutocomplete(
                        (cat) => cat === norm('Cartes VISA'),
                        [field.name, 'identification_carte', 'identification_de_la_carte', 'identification', 'id_carte', 'numero_carte', 'num_carte', 'identifiant_carte'],
                        'cardIdSuggestions_',
                        'Suggestions basées sur l’historique des opérations Cartes VISA'
                    );
                } else if (isDecoderIdField && input.type !== 'file' && input.type !== 'image') {
                    registerAutocomplete(
                        (cat) => cat.includes('decodeur') || cat.includes('décodeur') || cat.includes('decoder') || cat.includes('canal'),
                        [field.name, 'identifiant_decodeur', 'identifiant_du_decodeur', 'decoder_id', 'id_decodeur', 'numero_decodeur', 'num_decodeur', 'identifiant décodeur'],
                        'decoderIdSuggestions_',
                        'Suggestions basées sur l’historique des opérations Décodeurs'
                    );
                }
            } catch {}
        }

        fieldWrapper.appendChild(inputElement);
        container.appendChild(fieldWrapper);
    });

    container.classList.remove('hidden');
}

export async function renderNewOperationView(user: User, operationTypeId?: string, options: { openModal?: boolean } = {}): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const dataService = DataService.getInstance();
    
    // Get complete user data with agency information
    const allUsers = await dataService.getUsers();
    const fullUser = allUsers.find(u => u.id === user.id) || user;
    // console.log('Full user data:', fullUser);
    
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
                        <span class="text-sm font-medium text-slate-800">${formatAmount((fullUser as any).agency?.solde_principal ?? 0)}</span>
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

        // On affiche toujours la commission, même si elle est nulle.
        summaryHtml += `
             <div class="flex justify-between items-center text-sm mt-2 pt-2 border-t border-violet-200">
                <span class="font-semibold text-emerald-700">Votre commission estimée :</span>
                <span class="font-bold text-emerald-700">${formatAmount(partnerShare)}</span>
            </div>
        `;

        summaryDetails.innerHTML = summaryHtml;

        summaryBalanceInfo.classList.toggle('hidden', !selectedOperationType.impactsBalance);
        summaryDebitInfo.classList.toggle('hidden', !selectedOperationType.impactsBalance);

        if (selectedOperationType.impactsBalance) {
            // Use agency balance only (no individual balance fallback)
            // console.log('User data:', fullUser);
            // console.log('Agency data:', (fullUser as any).agency);
            const currentBalance = (fullUser as any).agency?.solde_principal ?? 0;
            // console.log('Current balance:', currentBalance);
            const finalBalance = currentBalance - totalDebit;

            const summaryTotalDebitEl = $('#summaryTotalDebit', summaryDebitInfo);
            const summaryFinalBalanceEl = $('#summaryFinalBalance', summaryDebitInfo);

            if (summaryTotalDebitEl) summaryTotalDebitEl.textContent = formatAmount(totalDebit);
            if (summaryFinalBalanceEl) summaryFinalBalanceEl.textContent = formatAmount(finalBalance);
        }
    };

    const updateCalculatedFields = () => {
        // console.log('updateCalculatedFields called', selectedOperationType?.id);
        if (!selectedOperationType || !opDynamicFields) return;

        if (selectedOperationType.id === 'op_abo_decodeur_canal') {
            const formulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="decoder_concept_id"]');
            const nbrMonthInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="nbr_month"]');
            const conceptPriceInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="concept_price"]');
            const totalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');

            if (formulaSelect && nbrMonthInput && conceptPriceInput && totalInput) {
                const selectedFormula = formulaSelect.value;
                // Récupérer le prix depuis l'option sélectionnée
                const formulaPrice = getPriceFromSelectOption(formulaSelect);
                console.log('Canal+ nouveau abo:', selectedFormula, 'price:', formulaPrice);

                // Toujours remplir le prix unitaire dès qu'une formule est sélectionnée
                if (selectedFormula && formulaPrice > 0) {
                    conceptPriceInput.value = formulaPrice.toString();
                    console.log('Prix unitaire rempli:', formulaPrice);
                }

                const numberOfMonths = parseInt(nbrMonthInput.value, 10);
                const finalNumberOfMonths = (isNaN(numberOfMonths) || numberOfMonths < 1) ? 1 : numberOfMonths;

                // Calculer le total seulement si on a une formule et un nombre de mois valide
                if (selectedFormula && formulaPrice > 0) {
                    const total = formulaPrice * finalNumberOfMonths;
                    totalInput.value = total.toString();
                    console.log('Total calculé:', total);
                }
            }
        } else if (selectedOperationType.id === 'op_reabo_canal') {
            const formulaSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="formule"]');
            const optionSelect = opDynamicFields.querySelector<HTMLSelectElement>('select[name="option"]');
            const nbrMonthInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="nb_mois"]');
            const totalInput = opDynamicFields.querySelector<HTMLInputElement>('input[name="montant_principal"]');

            if (formulaSelect && optionSelect && nbrMonthInput && totalInput) {
                const selectedFormula = formulaSelect.value;
                const selectedOption = optionSelect.value;

                // Récupérer les prix depuis les options sélectionnées
                const formulaPrice = getPriceFromSelectOption(formulaSelect);
                const optionPrice = getPriceFromSelectOption(optionSelect);

                const numberOfMonths = parseInt(nbrMonthInput.value, 10);
                const finalNumberOfMonths = (isNaN(numberOfMonths) || numberOfMonths < 1) ? 1 : numberOfMonths;

                // Calculer le total si on a au moins une formule
                if (selectedFormula && formulaPrice > 0) {
                    const total = (formulaPrice + optionPrice) * finalNumberOfMonths;
                    totalInput.value = total.toString();
                    console.log('Canal+ réabo - Formule:', formulaPrice, 'Option:', optionPrice, 'Total:', total);
                }
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
                // Récupérer le prix depuis l'option sélectionnée
                const oldFormulaPrice = getPriceFromSelectOption(oldFormulaSelect);

                // Remplir automatiquement le prix de l'ancienne formule
                if (selectedOldFormula && oldFormulaPrice > 0) {
                    oldFormulaPriceInput.value = oldFormulaPrice.toString();
                }

                // Filter new formulas to only show upgrades
                const newFormulaOptions = newFormulaSelect.options;
                for (let i = 0; i < newFormulaOptions.length; i++) {
                    const option = newFormulaOptions[i];
                    const optionPrice = parseInt(option.getAttribute('data-prix') || '0', 10);
                    const isDisabled = !option.value || optionPrice <= oldFormulaPrice;
                    option.disabled = isDisabled;
                    option.hidden = isDisabled;
                }
                if (newFormulaSelect.options[newFormulaSelect.selectedIndex]?.disabled) {
                    newFormulaSelect.value = '';
                    newFormulaPriceInput.value = '0';
                }
                newFormulaSelect.disabled = !selectedOldFormula;

                const selectedNewFormula = newFormulaSelect.value;
                // Récupérer le prix depuis l'option sélectionnée
                const newFormulaPrice = getPriceFromSelectOption(newFormulaSelect);

                // Remplir automatiquement le prix de la nouvelle formule
                if (selectedNewFormula && newFormulaPrice > 0) {
                    newFormulaPriceInput.value = newFormulaPrice.toString();
                }

                const selectedOption = optionSelect.value;
                // Récupérer le prix depuis l'option sélectionnée
                const optionPrice = getPriceFromSelectOption(optionSelect);

                // Remplir automatiquement le prix de l'option
                optionPriceInput.value = optionPrice.toString();

                // Calculer le total seulement si on a les deux formules
                if (selectedOldFormula && selectedNewFormula && oldFormulaPrice > 0 && newFormulaPrice > 0) {
                    const total = Math.max(0, (newFormulaPrice - oldFormulaPrice) + optionPrice);
                    totalInput.value = total.toString();
                }
            }
        }
        updateOperationSummary();
    };

    // Use event delegation for dynamic fields - écouter tous les changements
    opDynamicFields?.addEventListener('input', updateCalculatedFields);
    opDynamicFields?.addEventListener('change', updateCalculatedFields);
    opDynamicFields?.addEventListener('keyup', updateCalculatedFields);
    opDynamicFields?.addEventListener('blur', updateCalculatedFields);


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
            renderDynamicFields(opType, opDynamicFields as HTMLElement, cardTypes, updateCalculatedFields);
            // Attendre que les champs soient rendus avant le calcul initial
            setTimeout(() => {
                updateCalculatedFields(); // Initial calculation
            }, 100);
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
            // For agents and partners, only show active operation types.
            // Other roles (like developer, admin) can see all statuses.
            if ((user.role === 'agent' || user.role === 'partner') && op.status !== 'active') {
                return acc;
            }
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

                const inactiveBadge = op.status !== 'active' ? '<span class="badge badge-gray">Inactif</span>' : '';

                button.innerHTML = `
                    <div class="flex justify-between items-start">
                        <p class="font-semibold text-slate-800 pr-2">${op.name}</p>
                        ${inactiveBadge}
                    </div>
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
            if (section) {
                section.style.display = hasVisibleItems ? '' : 'none';
            }
        });
    });

    $('#cancelOperationBtn', container)?.addEventListener('click', () => handleCancelNavigation(container, user));

    // Variables to prevent double submission
    let isSubmitting = false;
    let lastSubmissionTime = 0;

    container.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        
        // Prevent double submission
        const now = Date.now();
        if (isSubmitting) {
            console.log('Submission already in progress, ignoring duplicate click');
            return;
        }
        
        // Prevent rapid successive clicks (minimum 2 seconds between submissions)
        if (now - lastSubmissionTime < 2000) {
            console.log('Too soon after last submission, ignoring click');
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Veuillez patienter avant de soumettre à nouveau.', type: 'warning' }
            }));
            return;
        }
        
        lastSubmissionTime = now;
        
        if (!selectedOperationType) {
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "Veuillez d'abord sélectionner une opération.", type: 'warning' }
            }));
            return;
        }
        
        // Set submission flag and disable button immediately
        isSubmitting = true;
        submitButton.disabled = true;
        submitButton.style.pointerEvents = 'none'; // Prevent any clicks

        const formData = new FormData(form);
        const data: { [key: string]: any } = {};
        
        // Store original button state for error recovery
        const originalBtnHtml = submitButton.innerHTML;
        
        // Handle files separately - upload them first and store URLs
        for (let [key, value] of formData.entries()) {
            if (value instanceof File && value.size > 0) {
                // Validate file size (max 5MB)
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (value.size > maxSize) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `L'image est trop volumineuse (max 5MB). Taille actuelle: ${(value.size / 1024 / 1024).toFixed(1)}MB`, type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalBtnHtml;
                    submitButton.style.pointerEvents = 'auto'; // Re-enable clicks
                    isSubmitting = false; // Reset submission flag
                    return;
                }

                // Validate file type
                if (!value.type.startsWith('image/')) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `Le fichier doit être une image. Type détecté: ${value.type}`, type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalBtnHtml;
                    submitButton.style.pointerEvents = 'auto'; // Re-enable clicks
                    isSubmitting = false; // Reset submission flag
                    return;
                }

                // This is a file (image), we need to upload it first
                try {
                    const uploadedUrl = await api.uploadImage(value);
                    data[key] = uploadedUrl;
                } catch (error) {
                    console.error(`Failed to upload image for field ${key}:`, error);
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `Échec de l'upload de l'image: ${(error as Error).message}`, type: 'error' }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalBtnHtml;
                    submitButton.style.pointerEvents = 'auto'; // Re-enable clicks
                    isSubmitting = false; // Reset submission flag
                    return;
                }
            } else {
                data[key] = value;
            }
        }

        // Update button state
        submitButton.disabled = true;
        
        // Check if there are any image files to upload
        const hasImages = Array.from(formData.entries()).some(([key, value]) => value instanceof File && value.size > 0);
        if (hasImages) {
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Upload des images...`;
        } else {
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Soumission en cours...`;
        }
        
        // Update button text after image uploads are complete
        if (hasImages) {
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Soumission en cours...`;
        }

        try {
            // Validation du champ de montant
            if (selectedOperationType.impactsBalance && !hasAmountField(selectedOperationType)) {
                document.body.dispatchEvent(new CustomEvent('showToast', {
                    detail: { 
                        message: 'Ce service nécessite un champ de montant configuré. Contactez l\'administrateur.', 
                        type: 'error' 
                    }
                }));
                submitButton.disabled = false;
                submitButton.innerHTML = originalBtnHtml;
                submitButton.style.pointerEvents = 'auto';
                isSubmitting = false;
                return;
            }

            // Validation du montant saisi
            if (selectedOperationType.impactsBalance) {
                const amount = extractAmountFromTransactionData(selectedOperationType, data);
                if (amount <= 0) {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { 
                            message: 'Le montant doit être supérieur à zéro.', 
                            type: 'error' 
                        }
                    }));
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalBtnHtml;
                    submitButton.style.pointerEvents = 'auto';
                    isSubmitting = false;
                    return;
                }
            }

            const newTransaction = await api.createTransaction(user.id, selectedOperationType.id, data);
            // Reset submission flag on success
            isSubmitting = false;
            handleCancelNavigation(container, user);
        } catch (error) {
            console.error("Transaction creation failed:", (error as Error).message || error);
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: "La soumission a échoué. Vérifiez votre solde et les informations.", type: 'error' }
            }));
            submitButton.disabled = false;
            submitButton.innerHTML = originalBtnHtml;
            submitButton.style.pointerEvents = 'auto'; // Re-enable clicks
            // Reset submission flag on error
            isSubmitting = false;
        }
    });

    const initializeView = async () => {
        if (operationTypeId) {
            const dataService = DataService.getInstance();
            const allOps = await dataService.getAllOperationTypes();
            const opToSelect = allOps.find(op => op.id === operationTypeId);
            if (opToSelect) {
                // For agents and partners, prevent selecting an inactive service directly.
                if ((user.role === 'agent' || user.role === 'partner') && opToSelect.status !== 'active') {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: "Ce service est actuellement indisponible.", type: 'warning' }
                    }));
                    // Clear operationTypeId to prevent re-selection on view reload
                    operationTypeId = undefined;
                    return;
                }
                selectOperationType(opToSelect);
            }
        }
        if (options.openModal) {
            setTimeout(() => openOpSelectionModal(), 50);
        }
    };

    initializeView();

    return container;
}
