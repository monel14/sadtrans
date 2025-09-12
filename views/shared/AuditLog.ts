import { createCard } from '../../components/Card';
import { formatDate } from '../../utils/formatters';

export async function renderAuditLogView(): Promise<HTMLElement> {
    const auditLogs = [
        { timestamp: '2025-05-09 10:30:15', user: 'Adam Ba', role: 'Admin Général', action: 'Validation Transaction', entity: 'TRN001', details: 'Montant: 25,000 XOF', ip: '192.168.1.10', icon: 'fa-check-circle', color: 'text-green-500' },
        { timestamp: '2025-05-09 09:15:00', user: 'Charles Mendy', role: 'Partenaire', action: 'Approbation Recharge', entity: 'ARR002 (Agent Bob)', details: 'Montant: 30,000 XOF', ip: '10.0.5.23', icon: 'fa-wallet', color: 'text-blue-500' },
        { timestamp: '2025-05-08 16:00:00', user: 'David Moreau', role: 'Développeur', action: 'Modification Op. Type', entity: 'op_paiement_sde', details: 'Commission: 100 XOF', ip: '127.0.0.1', icon: 'fa-cogs', color: 'text-purple-500' },
        { timestamp: '2025-05-08 15:00:00', user: 'Adam Ba', role: 'Admin Général', action: 'Rejet Transaction', entity: 'TRN004', details: 'Motif: Preuve illisible', ip: '192.168.1.10', icon: 'fa-times-circle', color: 'text-red-500' },
    ];
    
    const container = document.createElement('div');
    const list = document.createElement('ul');
    list.className = 'space-y-3';
    
    auditLogs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'p-4 border rounded-lg bg-white flex items-start gap-4';
        li.innerHTML = `
            <div>
                <i class="fas ${log.icon} ${log.color} fa-lg mt-1"></i>
            </div>
            <div class="flex-grow">
                 <p class="font-semibold text-slate-800">${log.action}: <span class="font-bold text-violet-600">${log.entity}</span></p>
                 <p class="text-sm text-slate-600">Par <strong>${log.user}</strong> (${log.role})</p>
                 <p class="text-xs text-slate-400 mt-1">${formatDate(log.timestamp)} <span class="mx-1">•</span> IP: ${log.ip}</p>
            </div>
            <div class="text-right flex-shrink-0">
                <button class="btn btn-xs btn-outline-secondary">Détails</button>
            </div>
        `;
        list.appendChild(li);
    });
    
    container.appendChild(list);

    return createCard('Journal d\'Audit des Actions Système', container, 'fa-clipboard-list');
}
