import { createCard } from '../components/Card';
import { User, OperationType } from '../models';
import { DataService } from '../services/data.service';
import { ApiService } from '../services/api.service';
import { $ } from '../utils/dom';
import { formatAmount } from '../utils/formatters';
import { AdminDefaultCommissionModal } from '../components/modals/AdminDefaultCommissionModal';
import { AdminDefaultExceptionModal } from '../components/modals/AdminDefaultExceptionModal';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';

interface DefaultCommissionConfig {
    id?: string;
    opTypeId: string;
    type: 'fixed' | 'percentage' | 'tiers';
    amount?: number;
    rate?: number;
    tiers?: Array<{
        min: number;
        max?: number;
        amount?: number;
        rate?: number;
    }>;
    partageSociete: number;
    isActive: boolean;
}

interface DefaultException {
    id?: string;
    opTypeId: string;
    condition: string;
    commissionOverride: DefaultCommissionConfig;
    description: string;
    isActive: boolean;
}

export class AdminDefaultCommissionsView {
    private container: HTMLElement | null = null;
    private defaultCommissions: DefaultCommissionConfig[] = [];
    private defaultExceptions: DefaultException[] = [];
    private operationTypes: OperationType[] = [];
    private defaultCommissionModal: AdminDefaultCommissionModal;
    private defaultExceptionModal: AdminDefaultExceptionModal;
    private confirmationModal: ConfirmationModal;

    constructor() {
        this.defaultCommissionModal = new AdminDefaultCommissionModal();
        this.defaultExceptionModal = new AdminDefaultExceptionModal();
        this.confirmationModal = new ConfirmationModal();
    }

    async render(): Promise<HTMLElement> {
        await this.loadData();
        
        this.container = document.createElement('div');
        this.container.className = 'admin-default-commissions-view';
        this.container.innerHTML = this.getHTML();
        this.attachEventListeners();
        
        return this.container;
    }

    private getHTML(): string {
        return `
            <div class="admin-default-commissions-view">
                <div class="page-header mb-6">
                    <h2 class="text-xl font-semibold text-gray-700">Commissions et Exceptions par Défaut</h2>
                    <p class="text-sm text-gray-500 mt-1">
                        Configurez les commissions et exceptions qui seront automatiquement appliquées aux nouveaux contrats.
                    </p>
                </div>

                <!-- Tabs Navigation -->
                <div class="tabs-nav mb-6">
                    <button class="tab-btn active" data-tab="commissions">
                        <i class="fas fa-percentage mr-2"></i>
                        Commissions par Défaut
                    </button>
                    <button class="tab-btn" data-tab="exceptions">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Exceptions par Défaut
                    </button>
                </div>

                <!-- Commissions Tab -->
                <div id="commissions-tab" class="tab-content active">
                    <div class="section-header mb-4">
                        <h3 class="text-lg font-medium text-gray-800">Commissions par Type d'Opération</h3>
                    </div>
                    
                    <div class="commissions-grid">
                        ${this.renderCommissionsGrid()}
                    </div>
                </div>

                <!-- Exceptions Tab -->
                <div id="exceptions-tab" class="tab-content">
                    <div class="section-header mb-4">
                        <h3 class="text-lg font-medium text-gray-800">Exceptions par Défaut</h3>
                        <button data-action="add-exception" class="btn btn-primary">
                            <i class="fas fa-plus mr-2"></i>
                            Ajouter Exception
                        </button>
                    </div>
                    
                    <div class="exceptions-list">
                        ${this.renderExceptionsList()}
                    </div>
                </div>
            </div>

            <style>
                .admin-default-commissions-view {
                    padding: 0;
                }

                .tabs-nav {
                    display: flex;
                    border-bottom: 2px solid #e5e7eb;
                    gap: 4px;
                }

                .tab-btn {
                    padding: 12px 24px;
                    border: none;
                    background: transparent;
                    color: #6b7280;
                    font-weight: 500;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s;
                }

                .tab-btn:hover {
                    color: #374151;
                    background: #f9fafb;
                }

                .tab-btn.active {
                    color: #3b82f6;
                    border-bottom-color: #3b82f6;
                    background: #eff6ff;
                }

                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .commissions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                    gap: 20px;
                }

                .commission-card {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .commission-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .commission-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                }

                .commission-status {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .status-active {
                    background: #dcfce7;
                    color: #166534;
                }

                .status-inactive {
                    background: #f3f4f6;
                    color: #6b7280;
                }

                .commission-details {
                    margin-bottom: 16px;
                }

                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 14px;
                }

                .detail-label {
                    color: #6b7280;
                }

                .detail-value {
                    font-weight: 500;
                    color: #1f2937;
                }

                .commission-actions {
                    display: flex;
                    gap: 8px;
                }

                .exceptions-list {
                    space-y: 16px;
                }

                .exception-card {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    margin-bottom: 16px;
                }

                .exception-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }

                .exception-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                }

                .exception-description {
                    color: #6b7280;
                    font-size: 14px;
                    margin-bottom: 12px;
                }

                .exception-condition {
                    background: #f3f4f6;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 13px;
                    margin-bottom: 12px;
                }

                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .btn-primary {
                    background: #3b82f6;
                    color: white;
                }

                .btn-primary:hover {
                    background: #2563eb;
                }

                .btn-secondary {
                    background: #6b7280;
                    color: white;
                }

                .btn-secondary:hover {
                    background: #4b5563;
                }

                .btn-success {
                    background: #10b981;
                    color: white;
                }

                .btn-success:hover {
                    background: #059669;
                }

                .btn-danger {
                    background: #ef4444;
                    color: white;
                }

                .btn-danger:hover {
                    background: #dc2626;
                }

                .btn-sm {
                    padding: 6px 12px;
                    font-size: 12px;
                }

            </style>
        `;
    }

    private renderCommissionsGrid(): string {
        if (this.defaultCommissions.length === 0) {
            return `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <i class="fas fa-percentage text-4xl mb-4 text-gray-300"></i>
                    <p>Aucune commission par défaut configurée</p>
                    <p class="text-sm">Cliquez sur "Ajouter Commission" pour commencer</p>
                </div>
            `;
        }

        return this.defaultCommissions.map(commission => {
            let opTypeName = 'Type inconnu';
            
            if (commission.opTypeId === 'global') {
                opTypeName = 'Configuration Globale';
            } else {
                // Ne devrait pas arriver ici, mais par sécurité
                const opType = this.operationTypes.find(ot => ot.id === commission.opTypeId);
                opTypeName = opType?.name || 'Commission Inconnue';
            }

            let commissionDisplay = '';
            if (commission.type === 'fixed') {
                commissionDisplay = formatAmount(commission.amount || 0);
            } else if (commission.type === 'percentage') {
                commissionDisplay = `${commission.rate}%`;
            } else if (commission.type === 'tiers') {
                commissionDisplay = `${commission.tiers?.length || 0} paliers`;
            }

            return `
                <div class="commission-card">
                    <div class="commission-header">
                        <h4 class="commission-title">${opTypeName}</h4>
                        <span class="commission-status ${commission.isActive ? 'status-active' : 'status-inactive'}">
                            ${commission.isActive ? 'Actif' : 'Inactif'}
                        </span>
                    </div>
                    
                    <div class="commission-details">
                        <div class="detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${commission.type === 'fixed' ? 'Fixe' : commission.type === 'percentage' ? 'Pourcentage' : 'Par paliers'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Valeur:</span>
                            <span class="detail-value">${commissionDisplay}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Part société:</span>
                            <span class="detail-value">${commission.partageSociete}%</span>
                        </div>
                    </div>
                    
                    <div class="commission-actions">
                        <button data-action="edit-commission" data-commission-id="${commission.id}" class="btn btn-sm btn-secondary">
                            <i class="fas fa-edit"></i>
                            Modifier
                        </button>
                        <button data-action="delete-commission" data-commission-id="${commission.id}" class="btn btn-sm btn-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    private renderExceptionsList(): string {
        if (this.defaultExceptions.length === 0) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4 text-gray-300"></i>
                    <p>Aucune exception par défaut configurée</p>
                    <p class="text-sm">Cliquez sur "Ajouter Exception" pour commencer</p>
                </div>
            `;
        }

        return this.defaultExceptions.map(exception => {
            const opType = this.operationTypes.find(ot => ot.id === exception.opTypeId);
            const opTypeName = opType?.name || 'Type inconnu';

            return `
                <div class="exception-card">
                    <div class="exception-header">
                        <div>
                            <h4 class="exception-title">${opTypeName} - Exception</h4>
                            <p class="exception-description">${exception.description}</p>
                        </div>
                        <span class="commission-status ${exception.isActive ? 'status-active' : 'status-inactive'}">
                            ${exception.isActive ? 'Actif' : 'Inactif'}
                        </span>
                    </div>
                    
                    <div class="exception-condition">
                        Condition: ${exception.condition}
                    </div>
                    
                    <div class="commission-details">
                        <div class="detail-row">
                            <span class="detail-label">Commission de remplacement:</span>
                            <span class="detail-value">
                                ${exception.commissionOverride.type === 'fixed' 
                                    ? formatAmount(exception.commissionOverride.amount || 0)
                                    : exception.commissionOverride.type === 'percentage' 
                                    ? `${exception.commissionOverride.rate}%`
                                    : `${exception.commissionOverride.tiers?.length || 0} paliers`
                                }
                            </span>
                        </div>
                    </div>
                    
                    <div class="commission-actions">
                        <button data-action="edit-exception" data-exception-id="${exception.id}" class="btn btn-sm btn-secondary">
                            <i class="fas fa-edit"></i>
                            Modifier
                        </button>
                        <button data-action="delete-exception" data-exception-id="${exception.id}" class="btn btn-sm btn-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    private async loadData(): Promise<void> {
        try {
            const dataService = DataService.getInstance();
            const api = ApiService.getInstance();
            
            // Charger les types d'opération
            this.operationTypes = await dataService.getAllOperationTypes();
            
            // Charger les commissions par défaut (simulé pour l'instant)
            // TODO: Implémenter les endpoints API
            this.defaultCommissions = await this.loadDefaultCommissions();
            this.defaultExceptions = await this.loadDefaultExceptions();
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            this.defaultCommissions = [];
            this.defaultExceptions = [];
        }
    }

    private async loadDefaultCommissions(): Promise<DefaultCommissionConfig[]> {
        // Chargement réel depuis la BDD via ApiService
        const api = ApiService.getInstance();
        const templates = await api.getCommissionTemplates();
        
        const commissions: DefaultCommissionConfig[] = [];
        
        templates.forEach((tpl: any) => {
            // Charger uniquement la configuration par défaut globale
            if (tpl.default_commission_config) {
                commissions.push({
                    id: `${tpl.id}_default`,
                    opTypeId: 'global',
                    type: tpl.default_commission_config.type,
                    amount: tpl.default_commission_config.amount,
                    rate: tpl.default_commission_config.rate,
                    tiers: tpl.default_commission_config.tiers,
                    partageSociete: tpl.default_commission_config.partageSociete,
                    isActive: true, // On suppose qu'elle est toujours active
                });
            }
        });
        
        return commissions;
    }

    private async loadDefaultExceptions(): Promise<DefaultException[]> {
        // Les exceptions sont stockées dans standard_exceptions de commission_templates
        const api = ApiService.getInstance();
        const templates = await api.getCommissionTemplates();
        
        const exceptions: DefaultException[] = [];
        templates.forEach((tpl: any) => {
            if (tpl.standard_exceptions && Array.isArray(tpl.standard_exceptions)) {
                tpl.standard_exceptions.forEach((ex: any) => {
                    exceptions.push({
                        id: `${tpl.id}_${ex.targetId}`,
                        opTypeId: ex.targetId,
                        condition: `${ex.targetType}: ${ex.targetId}`,
                        commissionOverride: ex.commissionConfig,
                        description: ex.name,
                        isActive: true,
                    });
                });
            }
        });
        return exceptions;
    }

    private attachEventListeners(): void {
        if (!this.container) return;

        this.container.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('[data-action]') as HTMLElement;
            
            if (!button) return;
            
            const action = button.dataset.action;

            switch (action) {
                case 'edit-commission':
                    const commissionId = button.dataset.commissionId;
                    await this.showCommissionModal(commissionId);
                    break;
                case 'delete-commission':
                    const deleteCommissionId = button.dataset.commissionId;
                    await this.deleteCommission(deleteCommissionId!);
                    break;
                case 'add-exception':
                    await this.showExceptionModal();
                    break;
                case 'edit-exception':
                    const exceptionId = button.dataset.exceptionId;
                    await this.showExceptionModal(exceptionId);
                    break;
                case 'delete-exception':
                    const deleteExceptionId = button.dataset.exceptionId;
                    await this.deleteException(deleteExceptionId!);
                    break;
            }
        });

        // Gestion des onglets
        this.container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const tabBtn = target.closest('.tab-btn') as HTMLElement;
            
            if (tabBtn) {
                const tabId = tabBtn.dataset.tab;
                this.switchTab(tabId!);
            }
        });
    }

    private switchTab(tabId: string): void {
        if (!this.container) return;

        // Désactiver tous les onglets
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        this.container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Activer l'onglet sélectionné
        const selectedBtn = this.container.querySelector(`[data-tab="${tabId}"]`);
        const selectedContent = this.container.querySelector(`#${tabId}-tab`);
        
        if (selectedBtn && selectedContent) {
            selectedBtn.classList.add('active');
            selectedContent.classList.add('active');
        }
    }

    private async showCommissionModal(commissionId?: string): Promise<void> {
        const commissionToEdit = this.defaultCommissions.find(c => c.id === commissionId);
        this.defaultCommissionModal.setOnSave(() => this.refreshData());
        await this.defaultCommissionModal.show(commissionToEdit as any);
    }

    private async showExceptionModal(exceptionId?: string): Promise<void> {
        try {
            console.log('showExceptionModal called with exceptionId:', exceptionId);

            // Trouver l'exception existante si un id est fourni
            let config: any = undefined;
            if (exceptionId) {
                let exception = this.defaultExceptions.find(e => e.id === exceptionId);

                // Si non trouvé par égalité stricte, tenter de trouver par suffixe (sécurité)
                if (!exception) {
                    exception = this.defaultExceptions.find(e => e.id && exceptionId && e.id.endsWith(exceptionId));
                }

                if (exception) {
                    // Essayer d'extraire targetType/targetId depuis la condition ou tomber sur opTypeId
                    let targetType: 'category' | 'operation_type' | undefined;
                    let targetId: string | undefined;
                    const cond = exception.condition || '';
                    const match = cond.match(/^(operation_type|category)\s*:\s*(.+)$/);
                    if (match) {
                        targetType = match[1] as any;
                        targetId = match[2];
                    } else {
                        // fallback: si opTypeId est présent, on le considère comme targetId
                        targetType = 'operation_type';
                        targetId = exception.opTypeId;
                    }

                    config = {
                        id: exception.id,
                        opTypeId: exception.opTypeId,
                        targetType: targetType,
                        targetId: targetId,
                        description: exception.description,
                        condition: exception.condition,
                        commissionOverride: exception.commissionOverride
                    };
                }
            }

            this.defaultExceptionModal.setOnSave(() => this.refreshData());
            await this.defaultExceptionModal.show(config);
        } catch (err) {
            console.error('Erreur lors de l\'ouverture du modal d\'exception :', err);
            document.body.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Impossible d\'ouvrir le modal d\'exception', type: 'error' } }));
        }
    }

    private async deleteCommission(commissionId: string): Promise<void> {
        // Pour l'instant, on ne permet pas la suppression via l'interface
        // alert('La suppression des commissions par défaut nécessite une interface plus avancée.\n\nPour l\'instant, utilisez Supabase Studio pour modifier la table commission_templates.');
        
        // TODO: Implémenter la suppression via modification de standard_exceptions
        
        // Afficher un message plus élégant à la place de l'alerte
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { 
                message: 'La suppression des commissions par défaut nécessite une interface plus avancée. Utilisez Supabase Studio pour modifier la table commission_templates.', 
                type: 'info' 
            }
        }));
    }

    private async deleteException(exceptionId: string): Promise<void> {
        // Remplacer la boîte de confirmation par un modal
        this.confirmationModal.show(
            'Supprimer l\'exception',
            'Êtes-vous sûr de vouloir supprimer cette exception standard ?',
            async () => {
                try {
                    const api = ApiService.getInstance();
                    const templates = await api.getCommissionTemplates();
                    
                    if (templates.length > 0) {
                        const template = templates[0];
                        const exceptions = [...(template.standard_exceptions || [])];
                        
                        // Trouver l'exception à supprimer
                        // Correction: utiliser le même format d'ID que dans loadDefaultExceptions
                        const exceptionIndex = exceptions.findIndex((ex: any, index: number) => {
                            // Générer l'ID de la même manière que dans loadDefaultExceptions
                            const generatedId = `${template.id}_${ex.targetId}`;
                            // Comparer avec l'ID fourni
                            return generatedId === exceptionId;
                        });
                        
                        if (exceptionIndex !== -1) {
                            exceptions.splice(exceptionIndex, 1);
                            await api.updateCommissionTemplate(template.id, {
                                standard_exceptions: exceptions
                            });
                            
                            document.body.dispatchEvent(new CustomEvent('showToast', {
                                detail: { message: 'Exception supprimée avec succès', type: 'success' }
                            }));
                            
                            await this.refreshData();
                        } else {
                            // Si non trouvé, tenter de trouver par index (fallback)
                            const indexFromId = parseInt(exceptionId.split('_').pop() || '-1');
                            if (!isNaN(indexFromId) && indexFromId >= 0 && indexFromId < exceptions.length) {
                                exceptions.splice(indexFromId, 1);
                                await api.updateCommissionTemplate(template.id, {
                                    standard_exceptions: exceptions
                                });
                                
                                document.body.dispatchEvent(new CustomEvent('showToast', {
                                    detail: { message: 'Exception supprimée avec succès', type: 'success' }
                                }));
                                
                                await this.refreshData();
                            } else {
                                throw new Error('Exception non trouvée');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression:', error);
                    document.body.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: 'Erreur lors de la suppression', type: 'error' }
                    }));
                }
            }
        );
    }

    private async toggleCommission(commissionId: string, isActive: boolean): Promise<void> {
        // Pour l'instant, on ne permet pas l'activation/désactivation via l'interface
        // alert('L\'activation/désactivation des commissions par défaut nécessite une interface plus avancée.\n\nPour l\'instant, utilisez Supabase Studio pour modifier la table commission_templates.');
        
        // TODO: Implémenter le toggle via modification de standard_exceptions
        
        // Afficher un message plus élégant à la place de l'alerte
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { 
                message: 'L\'activation/désactivation des commissions par défaut nécessite une interface plus avancée. Utilisez Supabase Studio pour modifier la table commission_templates.', 
                type: 'info' 
            }
        }));
    }

    private async toggleException(exceptionId: string, isActive: boolean): Promise<void> {
        // Pour l'instant, on ne permet pas l'activation/désactivation via l'interface
        // alert('L\'activation/désactivation des exceptions par défaut nécessite une interface plus avancée.\n\nPour l\'instant, utilisez Supabase Studio pour modifier la table commission_templates.');
        
        // TODO: Implémenter le toggle via modification de standard_exceptions
        
        // Afficher un message plus élégant à la place de l'alerte
        document.body.dispatchEvent(new CustomEvent('showToast', {
            detail: { 
                message: 'L\'activation/désactivation des exceptions par défaut nécessite une interface plus avancée. Utilisez Supabase Studio pour modifier la table commission_templates.', 
                type: 'info' 
            }
        }));
    }

    private async refreshData(): Promise<void> {
        await this.loadData();
        if (this.container) {
            this.container.innerHTML = this.getHTML();
            this.attachEventListeners();
        }
    }
}

export function showAdminDefaultCommissionsView(): AdminDefaultCommissionsView {
    return new AdminDefaultCommissionsView();
}