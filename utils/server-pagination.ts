/**
 * Utilitaires pour la pagination côté serveur
 */

export interface PaginationOptions {
    page: number;
    limit: number;
    search?: string;
    filters?: Record<string, any>;
}

export interface PaginationResult<T> {
    items: T[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface PaginationState {
    currentPage: number;
    itemsPerPage: number;
    totalCount: number;
    searchTerm: string;
    filters: Record<string, any>;
}

/**
 * Crée un état de pagination initial
 */
export function createPaginationState(itemsPerPage = 20): PaginationState {
    return {
        currentPage: 1,
        itemsPerPage,
        totalCount: 0,
        searchTerm: '',
        filters: {}
    };
}

/**
 * Met à jour l'état de pagination
 */
export function updatePaginationState(
    state: PaginationState,
    updates: Partial<PaginationState>
): PaginationState {
    const newState = { ...state, ...updates };
    
    // Si on change les filtres ou la recherche, revenir à la page 1
    if (updates.searchTerm !== undefined || updates.filters !== undefined) {
        newState.currentPage = 1;
    }
    
    return newState;
}

/**
 * Calcule les informations de pagination
 */
export function calculatePaginationInfo(state: PaginationState): {
    totalPages: number;
    startIndex: number;
    endIndex: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
} {
    const totalPages = Math.ceil(state.totalCount / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = Math.min(startIndex + state.itemsPerPage, state.totalCount);
    
    return {
        totalPages,
        startIndex,
        endIndex,
        hasNextPage: state.currentPage < totalPages,
        hasPreviousPage: state.currentPage > 1
    };
}

/**
 * Génère les options de pagination pour l'API
 */
export function getPaginationOptions(state: PaginationState): PaginationOptions {
    return {
        page: state.currentPage,
        limit: state.itemsPerPage,
        search: state.searchTerm || undefined,
        filters: Object.keys(state.filters).length > 0 ? state.filters : undefined
    };
}

/**
 * Crée les contrôles de pagination HTML
 */
export function createPaginationControls(
    state: PaginationState,
    onPageChange: (page: number) => void,
    onItemsPerPageChange: (itemsPerPage: number) => void
): HTMLElement {
    const info = calculatePaginationInfo(state);
    
    const container = document.createElement('div');
    container.className = 'pagination-container flex justify-between items-center mt-6 p-4 bg-slate-50 rounded-md';
    
    container.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="text-sm text-slate-600">
                Affichage de ${info.startIndex + 1} à ${info.endIndex} sur ${state.totalCount} éléments
            </div>
            <div class="flex items-center gap-2">
                <label class="text-xs text-slate-500">Par page:</label>
                <select class="form-select form-select-xs items-per-page-select">
                    <option value="10" ${state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="20" ${state.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${state.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
        </div>
        <nav class="flex items-center gap-2">
            ${info.totalPages > 3 ? `
                <button class="btn btn-sm btn-outline-secondary first-page-btn ${!info.hasPreviousPage ? 'opacity-50 cursor-not-allowed' : ''}" 
                        ${!info.hasPreviousPage ? 'disabled' : ''} title="Première page">
                    <i class="fas fa-angle-double-left"></i>
                </button>
            ` : ''}
            
            <button class="btn btn-sm btn-secondary prev-page-btn ${!info.hasPreviousPage ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${!info.hasPreviousPage ? 'disabled' : ''}>
                <i class="fas fa-chevron-left mr-1"></i>Précédent
            </button>
            
            <span class="text-sm text-slate-600 mx-3">
                Page ${state.currentPage} sur ${info.totalPages}
            </span>
            
            <button class="btn btn-sm btn-secondary next-page-btn ${!info.hasNextPage ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${!info.hasNextPage ? 'disabled' : ''}>
                Suivant<i class="fas fa-chevron-right ml-1"></i>
            </button>
            
            ${info.totalPages > 3 ? `
                <button class="btn btn-sm btn-outline-secondary last-page-btn ${!info.hasNextPage ? 'opacity-50 cursor-not-allowed' : ''}" 
                        ${!info.hasNextPage ? 'disabled' : ''} title="Dernière page">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            ` : ''}
        </nav>
    `;
    
    // Attacher les événements
    const firstBtn = container.querySelector('.first-page-btn');
    const prevBtn = container.querySelector('.prev-page-btn');
    const nextBtn = container.querySelector('.next-page-btn');
    const lastBtn = container.querySelector('.last-page-btn');
    const itemsSelect = container.querySelector('.items-per-page-select') as HTMLSelectElement;
    
    firstBtn?.addEventListener('click', () => {
        if (info.hasPreviousPage) onPageChange(1);
    });
    
    prevBtn?.addEventListener('click', () => {
        if (info.hasPreviousPage) onPageChange(state.currentPage - 1);
    });
    
    nextBtn?.addEventListener('click', () => {
        if (info.hasNextPage) onPageChange(state.currentPage + 1);
    });
    
    lastBtn?.addEventListener('click', () => {
        if (info.hasNextPage) onPageChange(info.totalPages);
    });
    
    itemsSelect?.addEventListener('change', () => {
        onItemsPerPageChange(parseInt(itemsSelect.value));
    });
    
    return container;
}

/**
 * Crée un compteur de résultats
 */
export function createResultsCounter(totalCount: number, itemName = 'éléments'): HTMLElement {
    const counter = document.createElement('div');
    counter.className = 'results-counter text-sm text-slate-600 mb-3 px-4';
    counter.innerHTML = `<i class="fas fa-list mr-2"></i>${totalCount} ${itemName} au total`;
    return counter;
}

/**
 * Crée un message "aucun résultat"
 */
export function createNoResultsMessage(isFirstPage: boolean, message?: string): HTMLElement {
    const noResults = document.createElement('div');
    noResults.className = 'text-center text-slate-500 p-8';
    noResults.textContent = message || (isFirstPage ? 'Aucun élément trouvé.' : 'Aucun élément sur cette page.');
    return noResults;
}