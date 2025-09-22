import { createCard } from '../components/Card';
import { User, Contract, OperationType } from '../models';
import { ApiService } from '../services/api.service';
import { formatDate, formatAmount } from '../utils/formatters';

function getCommissionDescription(opType: OperationType, contract: Contract | null): string {
    if (contract) {
        const serviceException = contract.exceptions.find(ex => ex.targetType === 'service' && ex.targetId === opType.id);
        if (serviceException) {
            return `<span class="badge badge-purple" title="Source: ${serviceException.name}">Règle Spécifique</span>`;
        }

        if (opType.category) {
            const categoryException = contract.exceptions.find(ex => ex.targetType === 'category' && ex.targetId === opType.category);
            if (categoryException) {
                return `<span class="badge badge-info" title="Source: Catégorie ${categoryException.name}">Règle Catégorie</span>`;
            }
        }
        
        // S'il y a un contrat, la base est toujours la config par défaut du contrat
        return `<span class="badge badge-gray" title="Source: Configuration par défaut du contrat">Standard</span>`;

    }

    // S'il n'y a pas de contrat, on se base sur la config du service lui-même
    if (opType.commissionConfig && opType.commissionConfig.type !== 'none') {
        return `<span class="badge badge-success" title="Source: Configuration du service">Service</span>`;
    }
    
    return `<span class="badge badge-light" title="Aucune règle de commission applicable">Non défini</span>`;
}

export async function renderPartnerContractView(user: User): Promise<HTMLElement> {
    if (!user.partnerId) {
        return createCard('Erreur', '<p>Partenaire non identifié.</p>', 'fa-exclamation-triangle');
    }

    const api = ApiService.getInstance();
    const [contracts, opTypes] = await Promise.all([
        api.getContracts(),
        api.getAllOperationTypes()
    ]);
    const myContract = contracts.find(c => c.partnerId === user.partnerId && c.status === 'active') || null;
    
    const container = document.createElement('div');

    if (!myContract) {
        container.innerHTML = `<p class="text-center text-slate-500 p-4">Aucun contrat actif trouvé pour votre partenariat. Veuillez contacter l'administrateur.</p>`;
        return createCard('Mon Contrat', container, 'fa-file-signature');
    }

    // Display commission configuration
    let commissionDisplay = 'Non configuré';
    if (myContract.defaultCommissionConfig) {
        const config = myContract.defaultCommissionConfig;
        if (config.type === 'fixed') {
            commissionDisplay = `Montant fixe: ${formatAmount(config.amount || 0)}`;
        } else if (config.type === 'percentage') {
            commissionDisplay = `Pourcentage: ${config.rate}%`;
        } else if (config.type === 'tiers') {
            commissionDisplay = `Par paliers (${config.tiers?.length || 0} paliers)`;
        }
        commissionDisplay += ` - Part société: ${config.partageSociete || 100}%`;
    }

    const contractDetailsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <p class="text-sm text-slate-500">Nom du contrat</p>
                <p class="font-semibold text-slate-800">${myContract.name}</p>
            </div>
            <div>
                <p class="text-sm text-slate-500">Configuration de commission</p>
                <p class="font-semibold text-slate-800">${commissionDisplay}</p>
            </div>
            <div>
                <p class="text-sm text-slate-500">Période de validité</p>
                <p class="font-semibold text-slate-800">
                    ${formatDate(myContract.startDate).split(' ')[0]} - ${myContract.endDate ? formatDate(myContract.endDate).split(' ')[0] : 'Indéfinie'}
                </p>
            </div>
        </div>
        ${myContract.exceptions.length > 0 ? `
            <div class="mt-4 pt-4 border-t">
                 <p class="text-sm text-slate-500 mb-2">Avenants / Exceptions au contrat (${myContract.exceptions.length})</p>
                 <div class="flex flex-wrap gap-2">
                    ${myContract.exceptions.map(ex => `<span class="badge badge-purple">${ex.name}</span>`).join('')}
                 </div>
            </div>
        `: ''}
    `;
    container.appendChild(createCard('Détails de mon contrat', contractDetailsHtml, 'fa-file-signature', 'mb-6'));

    // --- Effective Commission Grid ---
    const gridContent = document.createElement('div');
    gridContent.className = 'table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'w-full table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Service</th>
                <th>Type de Règle</th>
                <th>Votre Part (Commission)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const commissionableOps = opTypes.filter(op => op.status === 'active');
        commissionableOps.sort((a,b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

        let currentCategory = '';
        for (const opType of commissionableOps) {
            // Add category headers
            if (opType.category && opType.category !== currentCategory) {
                currentCategory = opType.category;
                const tr = document.createElement('tr');
                tr.className = "bg-slate-100";
                tr.innerHTML = `<td colspan="3" class="font-bold text-slate-700 py-2 px-4">${currentCategory}</td>`;
                tbody.appendChild(tr);
            }

            const ruleSource = getCommissionDescription(opType, myContract);
            const { partnerShare } = await api.getFeePreview(user.id, opType.id, 10000); // Use a sample amount to get the share percentage

            let shareDescription = `${100 - (myContract.defaultCommissionConfig?.partageSociete || 100)}% des frais`;
            
            const exception = myContract.exceptions.find(ex => (ex.targetType === 'service' && ex.targetId === opType.id) || (ex.targetType === 'category' && ex.targetId === opType.category));
            // FIX: Add type assertion for exception to resolve potential 'unknown' type error.
            if (exception && (exception as any).commissionConfig.partageSociete !== undefined) {
                 shareDescription = `${100 - (exception as any).commissionConfig.partageSociete}% des frais`;
            } else if (opType.commissionConfig.partageSociete !== undefined) {
                 shareDescription = `${100 - opType.commissionConfig.partageSociete}% des frais`;
            }


            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Service">
                    <p class="font-medium text-slate-800">${opType.name}</p>
                    <p class="text-xs text-slate-500">${opType.description}</p>
                </td>
                <td data-label="Type de Règle">${ruleSource}</td>
                <td data-label="Votre Part">${shareDescription}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    gridContent.appendChild(table);
    container.appendChild(createCard('Ma Grille de Commission Effective', gridContent, 'fa-percentage'));

    return container;
}
