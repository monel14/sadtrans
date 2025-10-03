import { User, NavLink } from '../models';
import { navigationLinks } from '../config/navigation';

function createNavLink(link: NavLink, parentDispatchElement: HTMLElement): HTMLElement {
    if (link.children && link.children.length > 0) {
        const details = document.createElement('details');
        details.className = 'group';
        const summary = document.createElement('summary');
        summary.className = 'flex items-center space-x-3';
        summary.innerHTML = `
            <i class="fas ${link.icon} w-5 text-center"></i>
            <span class="flex-grow">${link.label}</span>
            <i class="fas fa-chevron-down transform transition-transform duration-200 text-slate-500 group-open:rotate-180"></i>`;
        details.appendChild(summary);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'links-container pl-4';
        const linksList = document.createElement('div');
        linksList.className = 'pt-1 pb-1 space-y-1';
        link.children.forEach(childLink => {
            linksList.appendChild(createNavLink(childLink, parentDispatchElement));
        });
        linksContainer.appendChild(linksList);
        details.appendChild(linksContainer);
        return details;

    } else {
        const linkElement = document.createElement('a');
        linkElement.href = '#';
        linkElement.innerHTML = `<i class="fas ${link.icon} w-5 text-center"></i><span>${link.label}</span>`;
        linkElement.dataset.navId = link.navId;
        
        linkElement.addEventListener('click', (e) => {
            e.preventDefault();
            parentDispatchElement.dispatchEvent(new CustomEvent('navigateTo', {
                detail: { 
                    viewFn: link.viewFn, 
                    label: link.label, 
                    action: link.action, 
                    navId: link.navId,
                    operationTypeId: link.operationTypeId
                },
                bubbles: true,
                composed: true,
            }));
        });
        return linkElement;
    }
}

// Fonction pour mettre à jour la sidebar avec les liens de navigation
function updateSidebar(sidebar: HTMLElement, user: User): void {
    const nav = sidebar.querySelector('#appNavigation');
    if (nav) {
        // Effacer le contenu actuel
        nav.innerHTML = '';
        
        // Ajouter les liens de navigation
        const links = navigationLinks[user.role];
        if (links) {
            links.forEach(link => {
                nav.appendChild(createNavLink(link, sidebar));
            });
        }
    }
}

// Fonction pour vérifier si les services sont chargés
function areServicesLoaded(user: User): boolean {
    const servicesLink = navigationLinks[user.role].find(link => 
        link.navId === 'agent_services' || link.navId === 'partner_services'
    );
    
    // Vérifier si les services ont des enfants et qu'ils ne sont pas les services statiques
    return servicesLink !== undefined && 
           servicesLink.children !== undefined && 
           servicesLink.children.length > 0 && 
           servicesLink.children !== (window as any).partnerAndAgentServicesStatic;
}

export function renderSidebar(user: User): HTMLElement {
    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar w-64 p-4 space-y-2 flex flex-col fixed inset-y-0 left-0 transform -translate-x-full md:translate-x-0 z-30';

    const logo = `
        <div class="sidebar-logo text-2xl font-bold text-center py-6 flex items-center justify-center mb-2">
            <div class="logo-icon-wrapper">
                <i class="fas fa-shield-alt text-violet-400"></i>
            </div>
            <span class="text-white ml-3 tracking-wide">SadTrans</span>
        </div>
        <div class="sidebar-divider"></div>
    `;

    const nav = document.createElement('nav');
    nav.id = 'appNavigation';
    nav.className = 'flex-grow overflow-y-auto space-y-1 pr-2 py-4';

    // Initialiser avec les liens statiques
    const links = navigationLinks[user.role];
    if (links) {
        links.forEach(link => {
            nav.appendChild(createNavLink(link, sidebar));
        });
    }

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';

    const logoutButton = document.createElement('button');
    logoutButton.id = 'logoutButton';
    logoutButton.className = 'w-full flex items-center justify-center p-3 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 group';
    logoutButton.innerHTML = `
        <i class="fas fa-sign-out-alt mr-2 group-hover:scale-110 transition-transform"></i>
        <span class="font-medium">Déconnexion</span>
    `;
    logoutButton.addEventListener('click', () => {
        sidebar.dispatchEvent(new CustomEvent('logout', { bubbles: true, composed: true }));
    });
    footer.appendChild(logoutButton);
    
    sidebar.innerHTML = logo;
    sidebar.appendChild(nav);
    sidebar.appendChild(footer);

    // Mettre à jour la sidebar après un court délai pour permettre le chargement asynchrone
    // Amélioration : vérifier périodiquement si les services sont chargés
    let updateAttempts = 0;
    const maxAttempts = 10; // Maximum 10 tentatives (5 secondes)
    
    const tryUpdateSidebar = () => {
        updateAttempts++;
        
        // Si les services sont chargés ou si nous avons atteint le maximum de tentatives, mettre à jour
        if (areServicesLoaded(user) || updateAttempts >= maxAttempts) {
            updateSidebar(sidebar, user);
            return;
        }
        
        // Continuer à vérifier périodiquement
        setTimeout(tryUpdateSidebar, 500);
    };
    
    setTimeout(tryUpdateSidebar, 500);

    return sidebar;
}