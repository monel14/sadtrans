
import { User } from '../models';
import { ApiService } from '../services/api.service';
import { createCard } from '../components/Card';
import { renderAdminTransactionValidationView } from './AdminTransactionValidation';

export async function renderSubAdminDashboardView(user: User): Promise<HTMLElement> {
    const api = ApiService.getInstance();
    const container = document.createElement('div');

    const [allPendingTransactions] = await Promise.all([
        api.getTransactions({ status: 'pending' }),
    ]);

    const myAssignedTransactions = allPendingTransactions.filter(t => t.assignedTo === user.id).length;
    const unassignedTransactions = allPendingTransactions.filter(t => !t.assignedTo).length;

    const welcomeCard = createCard(`Bienvenue ${user.name}`, '<p>Vos tâches principales : validation des transactions qui vous sont assignées, ou que vous vous assignez depuis les files d\'attente.</p>', 'fa-user-check');
    
    const quickAccessContent = document.createElement('div');
    quickAccessContent.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    quickAccessContent.innerHTML = `
        <button data-nav-target="assigned_to_me" class="text-left p-4 h-full border rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-all duration-200 flex items-start space-x-4">
            <i class="fas fa-user-check fa-2x text-amber-500 mt-1 w-8 text-center"></i>
            <div>
                <p class="font-semibold text-slate-800">Mes Validations</p>
                <p class="text-xs text-slate-500">Voir les tâches qui vous sont assignées.</p>
                <p class="text-2xl font-bold text-amber-500 mt-1">${myAssignedTransactions}</p>
            </div>
        </button>
        <button data-nav-target="unassigned" class="text-left p-4 h-full border rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-all duration-200 flex items-start space-x-4">
            <i class="fas fa-tasks fa-2x text-sky-500 mt-1 w-8 text-center"></i>
            <div>
                <p class="font-semibold text-slate-800">File d'attente</p>
                <p class="text-xs text-slate-500">Voir les tâches non assignées et s'assigner.</p>
                <p class="text-2xl font-bold text-sky-500 mt-1">${unassignedTransactions}</p>
            </div>
        </button>
    `;

    const quickAccessCard = createCard('Accès Rapides', quickAccessContent, 'fa-rocket', 'mt-6');

    container.appendChild(welcomeCard);
    container.appendChild(quickAccessCard);

    quickAccessCard.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const navButton = target.closest<HTMLButtonElement>('[data-nav-target]');
        if (navButton) {
            const targetTab = navButton.dataset.navTarget as 'unassigned' | 'assigned_to_me';
            container.dispatchEvent(new CustomEvent('navigateTo', {
                detail: {
                    viewFn: (user: User) => renderAdminTransactionValidationView(user, targetTab),
                    label: 'Validation Transactions',
                    navId: 'subadmin_validate_tx'
                },
                bubbles: true,
                composed: true
            }));
        }
    });
    
    return container;
}
