/**
 * Utilitaire de pagination réutilisable
 */

export interface PaginationConfig {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    showFirstLast?: boolean;
    showItemsPerPageSelector?: boolean;
    itemsPerPageOptions?: number[];
    containerClass?: string;
}

export interface PaginationCallbacks {
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export function createPaginationElement(config: PaginationConfig, callbacks: PaginationCallbacks): HTMLElement {
    const {
        currentPage,
        totalItems,
        itemsPerPage,
        showFirstLast = true,
        showItemsPerPageSelector = true,
        itemsPerPageOptions = [10, 20, 50, 100],
        containerClass = 'pagination-container flex justify-between items-center mt-6 p-4 bg-slate-50 rounded-md'
    } = config;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    if (totalPages <= 1) {
        return document.createElement('div'); // Return empty div if no pagination needed
    }

    const paginationContainer = document.createElement('div');
    paginationContainer.className = containerClass;

    let leftSection = `
        <div class="text-sm text-slate-600">
            Affichage de ${startIndex + 1} à ${endIndex} sur ${totalItems} éléments
        </div>
    `;

    if (showItemsPerPageSelector && callbacks.onItemsPerPageChange) {
        leftSection = `
            <div class="flex items-center gap-4">
                <div class="text-sm text-slate-600">
                    Affichage de ${startIndex + 1} à ${endIndex} sur ${totalItems} éléments
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs text-slate-500">Par page:</label>
                    <select class="form-select form-select-xs pagination-items-per-page">
                        ${itemsPerPageOptions.map(option => 
                            `<option value="${option}" ${itemsPerPage === option ? 'selected' : ''}>${option}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    const navigationButtons = `
        <nav class="flex items-center gap-2">
            ${showFirstLast && totalPages > 3 ? `
                <button class="btn btn-sm btn-outline-secondary pagination-first ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                        ${currentPage === 1 ? 'disabled' : ''} title="Première page">
                    <i class="fas fa-angle-double-left"></i>
                </button>
            ` : ''}
            
            <button class="btn btn-sm btn-secondary pagination-prev ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left mr-1"></i>Précédent
            </button>
            
            <span class="text-sm text-slate-600 mx-3">
                Page ${currentPage} sur ${totalPages}
            </span>
            
            <button class="btn btn-sm btn-secondary pagination-next ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Suivant<i class="fas fa-chevron-right ml-1"></i>
            </button>
            
            ${showFirstLast && totalPages > 3 ? `
                <button class="btn btn-sm btn-outline-secondary pagination-last ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
                        ${currentPage === totalPages ? 'disabled' : ''} title="Dernière page">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            ` : ''}
        </nav>
    `;

    paginationContainer.innerHTML = `${leftSection}${navigationButtons}`;

    // Attacher les événements
    const firstButton = paginationContainer.querySelector('.pagination-first');
    const prevButton = paginationContainer.querySelector('.pagination-prev');
    const nextButton = paginationContainer.querySelector('.pagination-next');
    const lastButton = paginationContainer.querySelector('.pagination-last');
    const itemsPerPageSelect = paginationContainer.querySelector('.pagination-items-per-page') as HTMLSelectElement;

    firstButton?.addEventListener('click', () => {
        if (currentPage > 1) {
            callbacks.onPageChange(1);
        }
    });

    prevButton?.addEventListener('click', () => {
        if (currentPage > 1) {
            callbacks.onPageChange(currentPage - 1);
        }
    });

    nextButton?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            callbacks.onPageChange(currentPage + 1);
        }
    });

    lastButton?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            callbacks.onPageChange(totalPages);
        }
    });

    itemsPerPageSelect?.addEventListener('change', () => {
        if (callbacks.onItemsPerPageChange) {
            callbacks.onItemsPerPageChange(parseInt(itemsPerPageSelect.value));
        }
    });

    return paginationContainer;
}

/**
 * Calcule les éléments à afficher pour une page donnée
 */
export function getPaginatedItems<T>(items: T[], currentPage: number, itemsPerPage: number): T[] {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

/**
 * Crée un compteur de résultats
 */
export function createResultsCounter(totalItems: number, filteredItems?: number, icon: string = 'fa-list'): HTMLElement {
    const counter = document.createElement('div');
    counter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
    
    if (filteredItems !== undefined && filteredItems !== totalItems) {
        counter.innerHTML = `<i class="fas ${icon} mr-2"></i>${filteredItems} élément(s) trouvé(s) sur ${totalItems}`;
    } else {
        counter.innerHTML = `<i class="fas ${icon} mr-2"></i>${totalItems} élément(s) au total`;
    }
    
    return counter;
}