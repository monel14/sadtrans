import { createCard } from '../components/Card';
import { User, Partner } from '../models';
import { DataService } from '../services/data.service';

export async function renderAdminManageUsersView(): Promise<HTMLElement> {
    const dataService = DataService.getInstance();
    const [allUsers, partnerMap] = await Promise.all([
        dataService.getUsers(),
        dataService.getPartnerMap()
    ]);

    const container = document.createElement('div');

    const userTypes: { role: User['role'], title: string }[] = [
        { role: 'admin_general', title: 'Administrateurs Généraux' },
        { role: 'sous_admin', title: 'Sous-Administrateurs' },
        { role: 'partner', title: 'Partenaires (Chefs d\'Agence)' },
        { role: 'agent', title: 'Agents (Utilisateurs Partenaires)' },
    ];

    userTypes.forEach(userType => {
        const usersOfType = allUsers.filter(u => u.role === userType.role).sort((a,b) => a.name.localeCompare(b.name));
        if (usersOfType.length === 0) return;

        const section = document.createElement('div');
        section.className = 'mb-8';
        section.innerHTML = `<h3 class="text-xl font-semibold text-slate-700 mb-4 border-b pb-2">${userType.title}</h3>`;

        const list = document.createElement('ul');
        list.className = 'space-y-3';

        usersOfType.forEach(user => {
            let partnerInfo = '';
            // Specifically add partner name for agents, as requested
            if (user.role === 'agent' && user.partnerId) {
                const partner = partnerMap.get(user.partnerId);
                partnerInfo = `<p class="text-sm text-slate-500">Partenaire: <strong>${partner?.name || 'Inconnu'}</strong></p>`;
            }

            const statusBadge = user.status 
                ? (user.status === 'active' 
                    ? `<span class="badge badge-success">Actif</span>`
                    : `<span class="badge badge-danger">Suspendu</span>`)
                : '';
            
            let editButtonHtml = '';
            if (user.role === 'agent' || user.role === 'partner') {
                editButtonHtml = `
                    <button class="btn btn-sm btn-outline-secondary" title="Modifier" data-action="edit-user" data-user-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
            }

            const li = document.createElement('li');
            li.className = 'card !p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3';
            li.innerHTML = `
                <div class="flex items-center gap-3 flex-grow">
                     <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f3f4f6&color=4b5563" alt="Avatar" class="w-10 h-10 rounded-full">
                     <div>
                        <p class="font-semibold text-slate-800">${user.name}</p>
                        <p class="text-sm text-slate-500">${user.email}</p>
                        ${partnerInfo}
                     </div>
                </div>
                <div class="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                    ${statusBadge}
                    <div class="flex gap-1">
                        ${editButtonHtml}
                    </div>
                 </div>
            `;
            list.appendChild(li);
        });

        section.appendChild(list);
        container.appendChild(section);
    });

    const card = createCard('Gestion de Tous les Utilisateurs', container, 'fa-users-cog');
    
    card.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest<HTMLButtonElement>('[data-action="edit-user"]');
        
        if (editBtn) {
            const userId = editBtn.dataset.userId;
            const user = allUsers.find(u => u.id === userId);
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