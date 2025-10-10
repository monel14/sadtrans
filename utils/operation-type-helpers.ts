/**
 * Utilitaires pour les types d'opération
 */

import { OperationType, OperationTypeField } from '../models';

/**
 * Trouve le champ défini comme champ de montant dans un type d'opération
 * @param operationType Le type d'opération
 * @returns Le champ de montant ou null si aucun n'est défini
 */
export function getAmountField(operationType: OperationType): OperationTypeField | null {
    return operationType.fields.find(field => field.isAmountField === true) || null;
}

/**
 * Extrait la valeur du montant depuis les données d'une transaction
 * @param operationType Le type d'opération
 * @param transactionData Les données de la transaction
 * @returns Le montant principal ou 0 si non trouvé
 */
export function extractAmountFromTransactionData(operationType: OperationType, transactionData: any): number {
    const amountField = getAmountField(operationType);
    
    if (!amountField) {
        console.warn(`Aucun champ de montant défini pour le type d'opération "${operationType.name}"`);
        return 0;
    }
    
    const amount = transactionData[amountField.name];
    return typeof amount === 'number' ? amount : parseFloat(amount) || 0;
}

/**
 * Valide qu'un type d'opération a un champ de montant configuré
 * @param operationType Le type d'opération
 * @returns true si un champ de montant est configuré
 */
export function hasAmountField(operationType: OperationType): boolean {
    return getAmountField(operationType) !== null;
}

/**
 * Obtient le nom du champ de montant pour un type d'opération
 * @param operationType Le type d'opération
 * @returns Le nom du champ de montant ou null
 */
export function getAmountFieldName(operationType: OperationType): string | null {
    const amountField = getAmountField(operationType);
    return amountField ? amountField.name : null;
}