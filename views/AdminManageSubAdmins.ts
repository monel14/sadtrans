
import { DataService } from '../services/data.service';
import { createCard } from '../components/Card';
import { User } from '../models';

let currentContainer: HTMLElement | null = null;

async function loadSubAdminData() {
    const dataService = DataService.getInstance();
    const allUsers = await dataService.getUsers();
    return allUsers.filter(u => u.role === 'sous_admin');
}

async function refreshSubAdminView() {
    if (!currentContainer) return;
    
    // Afficher un indicateur de chargement
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'flex items-center justify-center p-8';
    loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mise à jour des données...';
    
    // Remplacer le contenu temporairement
    const originalContent = currentContainer.innerHTML;
    currentContainer.innerHTML = '';
    currentContainer.appendChild(loadingIndicator);

    try {
        const subAdmins = await loadSubAdminData();

        // Reconstruire le contenu
        currentContainer.innerHTML = '';
        
        if (subAdmins.length === 0) {
            currentContainer.innerHTML = `<p class="text-center text-slate-500 p-4">Aucun sous-administrateur trouvé.</p>`;
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
            currentContainer.appendChild(list);
        }

        // Afficher un message de succès
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Liste des sous-administrateurs mise à jour', type: 'success' }
        }));

    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        currentContainer.innerHTML = originalContent;
        
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Erreur lors de la mise à jour des données', type: 'error' }
        }));
    }
}

export async function renderAdminManageSubAdminsView(): Promise<HTMLElement> {
    const subAdmins = await loadSubAdminData();
    
    const container = document.createElement('div');
    currentContainer = container;
    
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

    // Ajouter les écouteurs d'événements pour la mise à jour automatique
    const refreshEventHandler = () => {
        refreshSubAdminView();
    };

    // Écouter les événements qui nécessitent une mise à jour
    document.body.addEventListener('userUpdated', refreshEventHandler);

    // Nettoyer les écouteurs quand la vue est détruite
    card.addEventListener('beforeunload', () => {
        document.body.removeEventListener('userUpdated', refreshEventHandler);
        currentContainer = null;
    });

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
            // Recharger les données pour avoir la version la plus récente
            loadSubAdminData().then(currentSubAdmins => {
                const user = currentSubAdmins.find(u => u.id === userId);
                if (user) {
                    document.body.dispatchEvent(new CustomEvent('openAdminEditUserModal', {
                        bubbles: true,
                        composed: true,
                        detail: { user }
                    }));
                }
            });
        }
    });

    return card;
}
