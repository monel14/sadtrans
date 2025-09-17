/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../models';
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { formatAmount, formatDate } from '../utils/formatters';

export async function renderAgentRechargeHistoryView(user: User): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    
    const [allRechargeRequests, methodMap] = await Promise.all([
        dataService.getAgentRechargeRequests(),
        dataService.getMethodMap()
    ]);

    const rechargeRequests = allRechargeRequests.filter(req => req.agentId === user.id);

    const container = document.createElement('div');

    if (rechargeRequests.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 p-4">Vous n'avez aucune demande de recharge pour le moment.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';

        rechargeRequests.forEach(req => {
            const method = methodMap.get(req.methodId);
            const isApproved = req.statut === 'Approuvée';
            const isRejected = req.statut === 'Rejetée';

            let statusBadge = '';
            if (isApproved) {
                statusBadge = `<span class="badge badge-success">Approuvée</span>`;
            } else if (isRejected) {
                statusBadge = `<span class="badge badge-danger">Rejetée</span>`;
            } else {
                statusBadge = `<span class="badge badge-warning">En attente</span>`;
            }

            const li = document.createElement('li');
            li.className = 'card !p-0 overflow-hidden';
            li.innerHTML = `
                <div class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex-grow">
                        <div class="flex items-center gap-4">
                            ${statusBadge}
                            <p class="font-semibold text-slate-800">Demande de Recharge</p>
                        </div>
                        <p class="text-sm text-slate-500 mt-1">
                            Méthode: <strong>${method?.name || 'Inconnu'}</strong>
                            ${req.notes && !isRejected ? ` | Réf: <strong>${req.notes}</strong>` : ''}
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
                    <strong class="text-red-700">Motif du rejet:</strong> <span class="text-red-800">${req.notes}</span>
                </div>` : ''}
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }
    
    return createCard('Historique de mes Recharges', container, 'fa-history');
}