
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { User } from '../models';

export async function renderAdminManageSubAdminsView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const allUsers = await dataService.getUsers();
    const subAdmins = allUsers.filter(u => u.role === 'sous_admin');
    
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 class="text-xl md:text-2xl font-semibold text-gray-700">Gestion des Sous-Administrateurs</h2>
            <button id="create-subadmin-btn" class="btn btn-success w-full md:w-auto"><i class="fas fa-user-plus mr-2"></i>Créer Sous-Administrateur</button>
        </div>`;

    if (subAdmins.length === 0) {
        container.innerHTML += `<p class="text-center text-slate-500 p-4">Aucun sous-administrateur trouvé.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        subAdmins.forEach(sa => {
            const statusBadge = sa.status === 'active' 
                ? `<span class="badge badge-success">Actif</span>`
                : `<span class="badge badge-danger">Suspendu</span>`;

            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex items-center gap-3 flex-grow">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(sa.name)}&background=e0f2fe&color=0c4a6e" alt="Avatar" class="w-10 h-10 rounded-full">
                    <div>
                        <p class="font-semibold text-slate-800">${sa.name}</p>
                        <p class="text-sm text-slate-500">${sa.email}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4 w-full sm:w-auto">
                    ${statusBadge}
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-outline-secondary" data-action="edit-subadmin" data-user-id="${sa.id}">
                            <i class="fas fa-edit mr-2"></i>Modifier
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    const card = createCard('Liste des Sous-Administrateurs', container, 'fa-user-shield');

    card.addEventListener('click', e => {
        const target = e.target as HTMLElement;

        const createBtn = target.closest<HTMLButtonElement>('#create-subadmin-btn');
        if (createBtn) {
            document.body.dispatchEvent(new CustomEvent('openAdminEditUserModal', {
                bubbles: true,
                composed: true,
                detail: { user: null, roleToCreate: 'sous_admin' }
            }));
        }

        const editBtn = target.closest<HTMLButtonElement>('[data-action="edit-subadmin"]');
        if (editBtn) {
            const userId = editBtn.dataset.userId;
            const user = subAdmins.find(u => u.id === userId);
            if (user) {
                document.body.dispatchEvent(new CustomEvent('openAdminEditUserModal', {
                    bubbles: true,
                    composed: true,
                    detail: { user }
                }));
            }
        }
    });

    return card;
}
