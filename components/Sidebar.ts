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

export function renderSidebar(user: User): HTMLElement {
    const sidebar = document.createElement('aside');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar w-64 p-4 space-y-2 flex flex-col fixed inset-y-0 left-0 transform -translate-x-full md:translate-x-0 z-30';

    const logo = `
        <div class="text-2xl font-semibold text-center py-4 flex items-center justify-center">
            <i class="fas fa-shield-alt mr-3 text-violet-400"></i>
            <span class="text-slate-100">SadTrans</span>
        </div>
    `;

    const nav = document.createElement('nav');
    nav.id = 'appNavigation';
    nav.className = 'flex-grow overflow-y-auto space-y-1 pr-2';

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
    logoutButton.className = 'w-full flex items-center p-2 rounded-md text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors';
    logoutButton.innerHTML = `<i class="fas fa-sign-out-alt w-10 text-center mr-1"></i><span class="text-sm">Déconnexion</span>`;
    logoutButton.addEventListener('click', () => {
        sidebar.dispatchEvent(new CustomEvent('logout', { bubbles: true, composed: true }));
    });
    footer.appendChild(logoutButton);
    
    sidebar.innerHTML = logo;
    sidebar.appendChild(nav);
    sidebar.appendChild(footer);

    return sidebar;
}