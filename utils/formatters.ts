
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
    // Handle legacy format for backward compatibility if needed, though clean data is preferred.
    if (transaction.statut.startsWith('Assignée à')) {
        return transaction.statut;
    }
    return transaction.statut;
}

export function formatRelativeTime(dateString?: string): string {
    if (!dateString) return 'un instant';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

        if (seconds < 2) return `à l'instant`;
        if (seconds < 60) return `il y a ${seconds} secondes`;
        
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
        
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;

        const days = Math.round(hours / 24);
        if (days < 7) return `il y a ${days} jour${days > 1 ? 's' : ''}`;

        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch (e) {
        return dateString;
    }
}