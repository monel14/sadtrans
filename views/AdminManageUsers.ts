import { createCard } from '../components/Card';
import { User, Partner } from '../models';
import { DataService } from '../services/data.service';

// Variables pour la pagination par section
const ITEMS_PER_PAGE = 20;
const currentPages: Map<string, number> = new Map();

let currentContainer: HTMLElement | null = null;

async function loadUserData() {
    const dataService = DataService.getInstance();
    return await Promise.all([
        dataService.getUsers(),
        dataService.getPartnerMap()
    ]);
}

async function refreshUserView() {
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
        const [allUsers, partnerMap] = await loadUserData();

        // Reconstruire le contenu
        currentContainer.innerHTML = '';
        
        const userTypes: { role: User['role'], title: string }[] = [
            { role: 'admin_general', title: 'Administrateurs Généraux' },
            { role: 'sous_admin', title: 'Sous-Administrateurs' },
            { role: 'partner', title: 'Partenaires (Chefs d\'Agence)' },
            { role: 'agent', title: 'Agents (Utilisateurs Partenaires)' },
        ];

        userTypes.forEach(userType => {
            const usersOfType = allUsers.filter(u => u.role === userType.role).sort((a,b) => a.name.localeCompare(b.name));
            if (usersOfType.length === 0) return;

            const section = renderUserSection(userType, usersOfType, partnerMap, allUsers);
            currentContainer!.appendChild(section);
        });

        // Afficher un message de succès
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Liste des utilisateurs mise à jour', type: 'success' }
        }));

    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        currentContainer.innerHTML = originalContent;
        
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { message: 'Erreur lors de la mise à jour des données', type: 'error' }
        }));
    }
}

// Fonction pour rendre une section d'utilisateurs avec pagination
function renderUserSection(userType: { role: User['role'], title: string }, usersOfType: User[], partnerMap: Map<string, Partner>, allUsers: User[]): HTMLElement {
    const sectionId = `section-${userType.role}`;
    if (!currentPages.has(sectionId)) {
        currentPages.set(sectionId, 1);
    }
    
    const currentPage = currentPages.get(sectionId)!;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const usersToDisplay = usersOfType.slice(startIndex, endIndex);
    const totalPages = Math.ceil(usersOfType.length / ITEMS_PER_PAGE);

    const section = document.createElement('div');
    section.className = 'mb-8';
    section.id = sectionId;
    
    // En-tête avec compteur
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4 border-b pb-2';
    header.innerHTML = `
        <h3 class="text-xl font-semibold text-slate-700">${userType.title}</h3>
        <span class="text-sm text-slate-500">${usersOfType.length} utilisateur(s)</span>
    `;
    section.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'space-y-3';

    usersToDisplay.forEach(user => {
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

    // Ajouter la pagination si nécessaire
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container flex justify-between items-center mt-4 p-3 bg-slate-50 rounded-md';
        
        paginationContainer.innerHTML = `
            <div class="text-sm text-slate-600">
                Affichage de ${startIndex + 1} à ${Math.min(endIndex, usersOfType.length)} sur ${usersOfType.length} utilisateurs
            </div>
            <nav class="flex items-center gap-2">
                <button class="btn btn-sm btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                        data-action="prev-page" data-section="${sectionId}" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left mr-1"></i>Précédent
                </button>
                
                <span class="text-sm text-slate-600 mx-3">
                    Page ${currentPage} sur ${totalPages}
                </span>
                
                <button class="btn btn-sm btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                        data-action="next-page" data-section="${sectionId}" ${currentPage === totalPages ? 'disabled' : ''}>
                    Suivant<i class="fas fa-chevron-right ml-1"></i>
                </button>
            </nav>
        `;
        
        section.appendChild(paginationContainer);
    }

    return section;
}

export async function renderAdminManageUsersView(): Promise<HTMLElement> {
    const [allUsers, partnerMap] = await loadUserData();

    const container = document.createElement('div');
    currentContainer = container;

    const userTypes: { role: User['role'], title: string }[] = [
        { role: 'admin_general', title: 'Administrateurs Généraux' },
        { role: 'sous_admin', title: 'Sous-Administrateurs' },
        { role: 'partner', title: 'Partenaires (Chefs d\'Agence)' },
        { role: 'agent', title: 'Agents (Utilisateurs Partenaires)' },
    ];

    userTypes.forEach(userType => {
        const usersOfType = allUsers.filter(u => u.role === userType.role).sort((a,b) => a.name.localeCompare(b.name));
        if (usersOfType.length === 0) return;

        const section = renderUserSection(userType, usersOfType, partnerMap, allUsers);
        container.appendChild(section);
    });

    const card = createCard('Gestion de Tous les Utilisateurs', container, 'fa-users-cog');
    
    // Ajouter les écouteurs d'événements pour la mise à jour automatique
    const refreshEventHandler = () => {
        refreshUserView();
    };

    // Écouter les événements qui nécessitent une mise à jour
    document.body.addEventListener('userUpdated', refreshEventHandler);
    document.body.addEventListener('partnerCreated', refreshEventHandler);
    document.body.addEventListener('partnerUpdated', refreshEventHandler);
    document.body.addEventListener('agentUpdated', refreshEventHandler);

    // Nettoyer les écouteurs quand la vue est détruite
    card.addEventListener('beforeunload', () => {
        document.body.removeEventListener('userUpdated', refreshEventHandler);
        document.body.removeEventListener('partnerCreated', refreshEventHandler);
        document.body.removeEventListener('partnerUpdated', refreshEventHandler);
        document.body.removeEventListener('agentUpdated', refreshEventHandler);
        currentContainer = null;
    });
    
    card.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('button');
        
        if (!button) return;
        
        const action = button.dataset.action;
        
        // Gestion de la pagination
        if (action === 'prev-page' || action === 'next-page') {
            const sectionId = button.dataset.section!;
            const currentPage = currentPages.get(sectionId)!;
            const userType = userTypes.find(ut => `section-${ut.role}` === sectionId)!;
            const usersOfType = allUsers.filter(u => u.role === userType.role).sort((a,b) => a.name.localeCompare(b.name));
            const totalPages = Math.ceil(usersOfType.length / ITEMS_PER_PAGE);
            
            if (action === 'prev-page' && currentPage > 1) {
                currentPages.set(sectionId, currentPage - 1);
            } else if (action === 'next-page' && currentPage < totalPages) {
                currentPages.set(sectionId, currentPage + 1);
            }
            
            // Re-rendre la section
            const oldSection = container.querySelector(`#${sectionId}`);
            const newSection = renderUserSection(userType, usersOfType, partnerMap, allUsers);
            if (oldSection) {
                container.replaceChild(newSection, oldSection);
                newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }
        
        // Gestion de l'édition d'utilisateur
        if (action === 'edit-user') {
            const userId = button.dataset.userId;
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