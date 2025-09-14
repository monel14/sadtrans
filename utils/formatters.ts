import { User, Transaction } from "../models";

export function formatDate(dateString?: string): string {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;
    } catch (e) {
        return dateString;
    }
}

export function formatAmount(amount?: number | null): string {
    if (amount == null) {
        return '-';
    }
    return Number(amount).toLocaleString('fr-FR') + ' XOF';
}

export function formatNumber(num?: number | null): string {
    if (num == null) {
        return '-';
    }
    return Number(num).toLocaleString('fr-FR');
}

export function formatTransactionStatus(transaction: Transaction, userMap: Map<string, User>): string {
    if (transaction.statut === 'Assignée' && transaction.assignedTo) {
        const user = userMap.get(transaction.assignedTo);
        return `Assignée à ${user?.name || 'Inconnu'}`;
    }
    return transaction.statut;
}
