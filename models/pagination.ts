/**
 * Interfaces pour la pagination côté serveur
 */

export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export interface NotificationFilters {
    userId?: string;
    type?: string;
    read?: boolean;
    dateFrom?: string;
    dateTo?: string;
}

export interface TransactionFilters {
    agentId?: string;
    partnerId?: string;
    opTypeId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
}

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
}