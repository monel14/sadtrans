/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';

export async function renderPartnerUserRechargesView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    
    // Fetch fresh, complete user data to ensure agency information is included
    const allUsers = await dataService.getUsers();
    const fullUser = allUsers.find(u => u.id === user.id || u.email === user.email);
    
    if (!fullUser || !fullUser.partnerId) {
        const errorEl = document.createElement('div');
        errorEl.innerHTML = `<div class="card"><p class="text-red-500 p-4">Erreur: Impossible de charger les données de l'agence.</p></div>`;
        return errorEl;
    }
    
    const [allRechargeRequests, methodMap] = await Promise.all([
        dataService.getAgentRechargeRequests(),
        dataService.getMethodMap()
    ]);

    // Filtrer pour n'afficher que les demandes de recharge de l'agence
    // Les demandes partenaires sont identifiées par la note contenant "[PARTNER]"
    // et l'agentId doit correspondre à un utilisateur de la même agence
    const agencyUsers = allUsers.filter(u => u.partnerId === fullUser.partnerId);
    const agencyUserIds = new Set(agencyUsers.map(u => u.id));
    
    const rechargeRequests = allRechargeRequests.filter(req => 
        agencyUserIds.has(req.agentId) && req.notes?.includes('[PARTNER]')
    );

    const container = document.createElement('div');

    if (rechargeRequests.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 p-4">Aucune demande de recharge pour l'agence pour le moment.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';

        rechargeRequests.forEach(req => {
            const method = methodMap.get(req.methodId);
            const isApproved = req.statut === 'Approuvée';
            const isRejected = req.statut === 'Rejetée';
            
            // Trouver l'utilisateur associé à cette demande
            const requestUser = agencyUsers.find(u => u.id === req.agentId);
            const userName = requestUser ? requestUser.name : 'Utilisateur inconnu';

            let statusBadge = '';
            if (isApproved) {
                statusBadge = `<span class="badge badge-success">Approuvée</span>`;
            } else if (isRejected) {
                statusBadge = `<span class="badge badge-danger">Rejetée</span>`;
            } else {
                statusBadge = `<span class="badge badge-warning">En attente</span>`;
            }

            // Nettoyer la référence en supprimant le préfixe [PARTNER]
            const cleanReference = req.notes?.replace('[PARTNER]', '').trim() || '';

            const li = document.createElement('li');
            li.className = 'card !p-0 overflow-hidden';
            li.innerHTML = `
                <div class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex-grow">
                        <div class="flex items-center gap-4">
                            ${statusBadge}
                            <p class="font-semibold text-slate-800">Demande de Recharge - ${userName}</p>
                        </div>
                        <p class="text-sm text-slate-500 mt-1">
                            Méthode: <strong>${method?.name || 'Inconnu'}</strong>
                            ${cleanReference ? ` | Réf: <strong>${cleanReference}</strong>` : ''}
                        </p>
                    </div>
                    <div class="text-left sm:text-right w-full sm:w-auto">
                        <p class="text-lg font-bold ${isApproved ? 'text-emerald-600' : 'text-slate-900'}">${formatAmount(req.montant)}</p>
                    </div>
                </div>
                <div class="bg-slate-50 px-4 py-2 text-xs text-slate-500 flex justify-between">
                    <span>Date: <strong>${formatDate(req.date)}</strong></span>
                    <span>ID: <strong>${req.id}</strong></span>
                </div>
                ${isRejected && req.notes ? `
                <div class="bg-red-50 border-t p-3 text-sm">
                    <strong class="text-red-700">Motif du rejet:</strong> <span class="text-red-800">${req.notes.replace('[PARTNER]', '').trim()}</span>
                </div>` : ''}
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }
    
    return createCard('Historique des Recharges de l\'Agence', container, 'fa-history');
}