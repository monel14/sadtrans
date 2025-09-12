import { createCard } from '../components/Card';

interface HubLink {
    title: string;
    description: string;
    icon: string;
    target: {
        type: 'view';
        viewFn: Function;
        label: string;
        navId?: string;
        operationTypeId?: string;
    } | {
        type: 'list';
        listType: string;
    };
}

export function renderServiceHubView(title: string, icon: string, links: HubLink[]): (user: any) => Promise<HTMLElement> {
    return async (user: any) => {
        const container = document.createElement('div');
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

        links.forEach(link => {
            const cardButton = document.createElement('button');
            cardButton.className = 'text-left p-4 h-full border rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-all duration-200 flex items-start space-x-4';
            cardButton.innerHTML = `
                <i class="fas ${link.icon} fa-2x text-violet-500 mt-1 w-8 text-center"></i>
                <div>
                    <p class="font-semibold text-slate-800">${link.title}</p>
                    <p class="text-sm text-slate-500">${link.description}</p>
                </div>
            `;
            cardButton.addEventListener('click', () => {
                if (link.target.type === 'view') {
                     container.dispatchEvent(new CustomEvent('navigateTo', {
                        detail: { 
                            viewFn: link.target.viewFn, 
                            label: link.target.label, 
                            navId: link.target.navId,
                            operationTypeId: link.target.operationTypeId,
                        },
                        bubbles: true,
                        composed: true,
                    }));
                } else {
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `Fonctionnalité de liste "${link.target.listType}" à venir.`, type: 'info' }
                    }));
                }
            });
            grid.appendChild(cardButton);
        });

        const card = createCard(title, grid, icon);
        container.appendChild(card);
        return container;
    }
}