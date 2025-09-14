import { createCard } from '../../components/Card';
import { DataService } from '../../services/data.service';
import { formatDate } from '../../utils/formatters';

// Map action types to icons and colors for consistent display
const actionDisplayMap: { [key: string]: { icon: string; color: string; } } = {
    'VALIDATE_TRANSACTION': { icon: 'fa-check-circle', color: 'text-green-500' },
    'REJECT_TRANSACTION': { icon: 'fa-times-circle', color: 'text-red-500' },
    'ASSIGN_TRANSACTION': { icon: 'fa-user-tag', color: 'text-blue-500' },
    'CREATE_USER': { icon: 'fa-user-plus', color: 'text-sky-500' },
    'UPDATE_USER': { icon: 'fa-user-edit', color: 'text-sky-500' },
    'CREATE_PARTNER': { icon: 'fa-building', color: 'text-indigo-500' },
    'UPDATE_PARTNER': { icon: 'fa-building', color: 'text-indigo-500' },
    'APPROVE_RECHARGE': { icon: 'fa-wallet', color: 'text-emerald-500' },
    'REJECT_RECHARGE': { icon: 'fa-hand-holding-usd', color: 'text-orange-500' },
    'UPDATE_OPERATION_TYPE': { icon: 'fa-cogs', color: 'text-purple-500' },
    'LOGIN_SUCCESS': { icon: 'fa-sign-in-alt', color: 'text-gray-500' },
    'LOGIN_FAILURE': { icon: 'fa-exclamation-triangle', color: 'text-yellow-500' },
    'DEFAULT': { icon: 'fa-info-circle', color: 'text-gray-500' }
};

function formatAction(action: string): string {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export async function renderAuditLogView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [auditLogs, userMap] = await Promise.all([
        dataService.getAuditLogs(),
        dataService.getUserMap()
    ]);
    
    const container = document.createElement('div');
    
    if (auditLogs.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 p-4">Aucune action n'a encore été enregistrée dans le journal d'audit.</p>`;
        return createCard('Journal d\'Audit des Actions Système', container, 'fa-clipboard-list');
    }
    
    const list = document.createElement('ul');
    list.className = 'space-y-3';
    
    auditLogs.forEach(log => {
        const user = userMap.get(log.user_id);
        const displayInfo = actionDisplayMap[log.action] || actionDisplayMap['DEFAULT'];

        const li = document.createElement('li');
        li.className = 'p-4 border rounded-lg bg-white flex items-start gap-4';
        li.innerHTML = `
            <div>
                <i class="fas ${displayInfo.icon} ${displayInfo.color} fa-lg mt-1"></i>
            </div>
            <div class="flex-grow">
                 <p class="font-semibold text-slate-800">${formatAction(log.action)}: 
                    ${log.entity_id ? `<span class="font-bold text-violet-600">${log.entity_id}</span>` : ''}
                 </p>
                 <p class="text-sm text-slate-600">Par <strong>${user?.name || 'Système'}</strong> ${user ? `(${user.role})` : ''}</p>
                 <p class="text-xs text-slate-400 mt-1">${formatDate(log.created_at)}</p>
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
