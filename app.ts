


import { User, UserRole } from './models';
import { renderLoginPage } from './components/LoginPage';
import { renderSidebar } from './components/Sidebar';
import { renderHeader } from './components/Header';
import { renderFooter } from './components/Footer';
import { navigationLinks } from './config/navigation';
import { AgentRequestRechargeModal } from './components/modals/AgentRequestRechargeModal';
import { ViewProofModal } from './components/modals/ViewProofModal';
import { AssignToSubAdminModal } from './components/modals/AssignToSubAdminModal';
import { DataService } from './services/data.service';
import { PartnerEditAgentModal } from './components/modals/PartnerEditAgentModal';
import { AdminEditUserModal } from './components/modals/AdminEditUserModal';
import { ToastContainer, ToastType } from './components/ToastContainer';
import { AdminEditPartnerModal } from './components/modals/AdminEditPartnerModal';
import { AuthService } from './services/auth.service';
import { AdminRejectRechargeModal } from './components/modals/AdminRejectRechargeModal';
import { PartnerTransferRevenueModal } from './components/modals/PartnerTransferRevenueModal';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { AdminAdjustBalanceModal } from './components/modals/AdminAdjustBalanceModal';

export class App {
    private rootElement: HTMLElement;
    private currentUser: User | null = null;
    private mainLayout: {
        appContainer: HTMLElement,
        mainContentArea: HTMLElement,
        pageContent: HTMLElement,
        sidebar: HTMLElement,
        header: HTMLElement,
        footer: HTMLElement,
    } | null = null;

    private agentRequestRechargeModal: AgentRequestRechargeModal | null = null;
    private viewProofModal: ViewProofModal | null = null;
    private assignToSubAdminModal: AssignToSubAdminModal | null = null;
    private partnerEditAgentModal: PartnerEditAgentModal | null = null;
    private adminEditUserModal: AdminEditUserModal | null = null;
    private adminEditPartnerModal: AdminEditPartnerModal | null = null;
    private adminRejectRechargeModal: AdminRejectRechargeModal | null = null;
    private partnerTransferRevenueModal: PartnerTransferRevenueModal | null = null;
    private confirmationModal: ConfirmationModal | null = null;
    private adminAdjustBalanceModal: AdminAdjustBalanceModal | null = null;
    private toastContainer: ToastContainer | null = null;

    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement;
    }

    public async init() {
        // Create and append the toast container
        this.toastContainer = new ToastContainer();
        document.body.prepend(this.toastContainer.element);

        // Events dispatched from within the #app container
        this.rootElement.addEventListener('loginSuccess', this.handleLoginSuccess as EventListener);
        // FIX: Added 'as EventListener' for consistency and type safety.
        this.rootElement.addEventListener('logout', this.handleLogout as EventListener);
        this.rootElement.addEventListener('navigateTo', this.navigateTo as EventListener);
        this.rootElement.addEventListener('updateActiveNav', this.updateActiveNav as EventListener);
        this.rootElement.addEventListener('updateCurrentUser', this.handleUpdateCurrentUser as EventListener);

        // Global events that can be dispatched from anywhere, including modals attached to document.body
        document.body.addEventListener('openAgentRechargeModal', this.handleOpenAgentRechargeModal as EventListener);
        document.body.addEventListener('openAssignModal', this.handleOpenAssignModal as EventListener);
        document.body.addEventListener('openViewProofModal', this.handleOpenViewProofModal as EventListener);
        document.body.addEventListener('openPartnerEditAgentModal', this.handleOpenPartnerEditAgentModal as EventListener);
        document.body.addEventListener('openAdminEditUserModal', this.handleOpenAdminEditUserModal as EventListener);
        document.body.addEventListener('openAdminEditPartnerModal', this.handleOpenAdminEditPartnerModal as EventListener);
        document.body.addEventListener('openAdminRejectRechargeModal', this.handleOpenAdminRejectRechargeModal as EventListener);
        document.body.addEventListener('openPartnerTransferRevenueModal', this.handleOpenPartnerTransferRevenueModal as EventListener);
        document.body.addEventListener('openConfirmationModal', this.handleOpenConfirmationModal as EventListener);
        document.body.addEventListener('openAdminAdjustBalanceModal', this.handleOpenAdminAdjustBalanceModal as EventListener);
        document.body.addEventListener('showToast', this.handleShowToast as EventListener);
        
        // Check for an active session on startup
        const authService = AuthService.getInstance();
        const user = await authService.getCurrentUser();
        
        if (user) {
            this.currentUser = user;
            this.renderMainLayout();
            // FIX: Corrected invalid method name 'pre-fetchData' to 'preFetchData'.
            this.preFetchData(); // Pre-fetch data to warm up cache
            this.startUserStatusCheck();
        } else {
            this.showLoginPage();
        }

        this.registerServiceWorker();
    }

    private registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            });
        }
    }

    private showLoginPage() {
        this.rootElement.innerHTML = '';
        const loginPage = renderLoginPage();
        this.rootElement.appendChild(loginPage);
    }

    // FIX: Converted to arrow function to correctly bind `this` and handle CustomEvent details.
    private handleLoginSuccess = (event: Event) => {
        const customEvent = event as CustomEvent;
        this.currentUser = customEvent.detail.user;
        this.renderMainLayout();
        // FIX: Corrected invalid method name 'pre-fetchData' to 'preFetchData'.
        this.preFetchData(); // Pre-fetch data to warm up cache
    }

    // FIX: Corrected invalid method name 'pre-fetchData' to 'preFetchData'.
    private preFetchData = async () => {
        // This is a "fire and forget" call to warm up the cache.
        // We don't await the result here to avoid blocking the UI.
        // The DataService will cache the results for later use.
        const dataService = DataService.getInstance();
        console.log("Pre-fetching data to warm up cache...");
        dataService.getAllOperationTypes();
        dataService.getCardTypes();
        dataService.getUsers();
        dataService.getPartners();
        dataService.getCommissionProfiles();
        dataService.getContracts();
    }

    private statusCheckInterval: number | null = null;

    private startUserStatusCheck = () => {
        // Check user status every 30 seconds
        this.statusCheckInterval = window.setInterval(async () => {
            const authService = AuthService.getInstance();
            const user = await authService.getCurrentUser();
            
            if (!user) {
                // User was logged out (probably due to suspended status)
                this.handleLogout();
            }
        }, 30000); // 30 seconds
    }

    private stopUserStatusCheck = () => {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    // FIX: Converted to arrow function to correctly bind `this`.
    private handleLogout = async () => {
        this.stopUserStatusCheck();
        await AuthService.getInstance().logout();
        this.currentUser = null;
        this.mainLayout = null;
        
        // Clear saved navigation state on logout
        localStorage.removeItem('currentNavigation');
        
        this.showLoginPage();
    }
    
    // FIX: Converted to arrow function and added type safety for event.
    private handleUpdateCurrentUser = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail.user && this.currentUser && customEvent.detail.user.id === this.currentUser.id) {
            this.currentUser = customEvent.detail.user;
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private updateActiveNav = (event: Event) => {
        if (!this.mainLayout) return;
        const customEvent = event as CustomEvent;
        const { navId } = customEvent.detail;

        const sidebarLinks = this.mainLayout.sidebar.querySelectorAll('#appNavigation a');
        sidebarLinks.forEach(link => {
            const linkElement = link as HTMLElement;
            const isActive = linkElement.dataset.navId === navId;
            linkElement.classList.toggle('active', isActive);
            
            // Open parent <details> if active link is inside
            if (isActive) {
                const parentDetails = linkElement.closest('details');
                if (parentDetails && !parentDetails.open) {
                    parentDetails.open = true;
                }
            }
        });
    }

    // FIX: Converted to arrow function and added type safety for event.
    private navigateTo = async (event: Event) => {
        if (!this.mainLayout || !this.currentUser) return;
        const customEvent = event as CustomEvent;
        const { viewFn, label, action, navId, operationTypeId } = customEvent.detail;
        
        if (action) {
            action();
            return;
        }

        if (viewFn) {
            // Save current navigation state to localStorage
            const navigationState = {
                navId,
                label,
                operationTypeId,
                userRole: this.currentUser.role
            };
            localStorage.setItem('currentNavigation', JSON.stringify(navigationState));

            // Update page title
            const pageTitleEl = this.mainLayout.header.querySelector('#pageTitle') as HTMLElement;
            if (pageTitleEl) pageTitleEl.textContent = label;
            
            // Update active sidebar link
            this.updateActiveNav({ detail: { navId } } as CustomEvent);

            // Render view content
            this.mainLayout.pageContent.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
            try {
                const viewContent = await viewFn(this.currentUser, operationTypeId);
                this.mainLayout.pageContent.innerHTML = '';
                this.mainLayout.pageContent.appendChild(viewContent);
            } catch (error) {
                console.error("Error rendering view:", error);
                this.mainLayout.pageContent.innerHTML = '<div class="text-center p-8 text-red-500">Erreur lors du chargement de la page.</div>';
            }
        }
        
        // Close sidebar on navigation on mobile
        if (window.innerWidth < 768) {
            this.mainLayout.sidebar.classList.add('-translate-x-full');
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleShowToast = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { message, type } = customEvent.detail as { message: string, type: ToastType };
        if (this.toastContainer) {
            this.toastContainer.showToast(message, type);
        }
    }

    private initializeModals = async () => {
        if (this.agentRequestRechargeModal) return; // Already initialized

        this.agentRequestRechargeModal = new AgentRequestRechargeModal();
        this.viewProofModal = new ViewProofModal();
        this.partnerEditAgentModal = new PartnerEditAgentModal();
        this.adminEditUserModal = new AdminEditUserModal();
        this.adminEditPartnerModal = new AdminEditPartnerModal();
        this.adminRejectRechargeModal = new AdminRejectRechargeModal();
        this.partnerTransferRevenueModal = new PartnerTransferRevenueModal();
        this.confirmationModal = new ConfirmationModal();
        this.adminAdjustBalanceModal = new AdminAdjustBalanceModal();

        const dataService = DataService.getInstance();
        const allUsers = await dataService.getUsers();
        const subAdmins = allUsers.filter(u => u.role === 'sous_admin');
        this.assignToSubAdminModal = new AssignToSubAdminModal(subAdmins);

        const reloadCurrentView = () => {
             const activeLink = this.mainLayout?.sidebar.querySelector<HTMLElement>('#appNavigation a.active');
            if (activeLink) {
                activeLink.click();
            }
        };

        // Events dispatched from modals are on document.body
        document.body.addEventListener('taskAssigned', reloadCurrentView);
        document.body.addEventListener('agentUpdated', reloadCurrentView);
        document.body.addEventListener('userUpdated', reloadCurrentView);
        document.body.addEventListener('partnerUpdated', reloadCurrentView);
        document.body.addEventListener('operationTypeUpdated', reloadCurrentView);
        document.body.addEventListener('rechargeRequestUpdated', reloadCurrentView);
        document.body.addEventListener('agencyBalanceUpdated', reloadCurrentView);
        document.body.addEventListener('revenueTransferred', (event: Event) => {
            const customEvent = event as CustomEvent;
            this.rootElement.dispatchEvent(new CustomEvent('updateCurrentUser', {
                detail: { user: customEvent.detail.user },
                bubbles: true,
                composed: true
            }));
            reloadCurrentView();
        });
    }

    // FIX: Converted to arrow function to correctly bind `this`.
    private handleOpenAgentRechargeModal = () => {
        if (this.agentRequestRechargeModal && this.currentUser) {
            this.agentRequestRechargeModal.show(this.currentUser);
        }
    }
    
    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenPartnerEditAgentModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { agent, partnerId, agencyId } = customEvent.detail;
        if (this.partnerEditAgentModal) {
            this.partnerEditAgentModal.show(agent, partnerId, agencyId);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenAdminEditUserModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { user, roleToCreate } = customEvent.detail;
        if (this.adminEditUserModal) {
            this.adminEditUserModal.show(user, roleToCreate);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenAdminEditPartnerModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { partner } = customEvent.detail;
        if (this.adminEditPartnerModal) {
            this.adminEditPartnerModal.show(partner);
        }
    }
    
    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenAdminRejectRechargeModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { requestId } = customEvent.detail;
        if (this.adminRejectRechargeModal) {
            this.adminRejectRechargeModal.show(requestId);
        }
    }
    
    private handleOpenAdminAdjustBalanceModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { agency } = customEvent.detail;
        if (this.adminAdjustBalanceModal) {
            this.adminAdjustBalanceModal.show(agency);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenPartnerTransferRevenueModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { userId, amount } = customEvent.detail;
        if (this.partnerTransferRevenueModal && this.currentUser) {
            this.partnerTransferRevenueModal.show(userId, amount);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenConfirmationModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { title, message, onConfirm, options } = customEvent.detail;
        if (this.confirmationModal) {
            this.confirmationModal.show(title, message, onConfirm, options);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenAssignModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { taskId } = customEvent.detail;
        if (this.assignToSubAdminModal) {
            this.assignToSubAdminModal.show(taskId);
        }
    }

    // FIX: Converted to arrow function and added type safety for event.
    private handleOpenViewProofModal = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { imageUrl } = customEvent.detail;
        if (this.viewProofModal && imageUrl) {
            this.viewProofModal.show(imageUrl);
        }
    }

    private renderMainLayout = () => {
        if (!this.currentUser) return;
        this.rootElement.innerHTML = '';

        const appContainer = document.createElement('div');
        appContainer.id = 'appContainer';
        appContainer.className = 'flex flex-col min-h-screen';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'flex flex-grow';

        const sidebar = renderSidebar(this.currentUser);
        const header = renderHeader(this.currentUser);
        const mainContentArea = document.createElement('main');
        mainContentArea.id = 'mainContentArea';
        mainContentArea.className = 'main-content-area flex-1 p-4 md:p-6 md:ml-64 overflow-y-auto';

        const pageContent = document.createElement('div');
        pageContent.id = 'pageContent';

        const footer = renderFooter();

        mainContentArea.appendChild(header);
        mainContentArea.appendChild(pageContent);
        contentWrapper.appendChild(sidebar);
        contentWrapper.appendChild(mainContentArea);
        appContainer.appendChild(contentWrapper);
        appContainer.appendChild(footer);
        
        this.rootElement.appendChild(appContainer);

        this.mainLayout = {
            appContainer,
            mainContentArea,
            pageContent,
            sidebar,
            header,
            footer,
        };
        
        this.initializeModals();

        // Mobile menu toggle logic
        const menuToggle = header.querySelector('#menuToggle');
        menuToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        // Restore previous navigation state or load default view
        this.restoreNavigationState();
    }

    private restoreNavigationState = () => {
        if (!this.currentUser) return;

        try {
            const savedState = localStorage.getItem('currentNavigation');
            if (savedState) {
                const navigationState = JSON.parse(savedState);
                
                // Only restore if the saved state is for the same user role
                if (navigationState.userRole === this.currentUser.role) {
                    // Find the navigation item that matches the saved state
                    const navItem = this.findNavigationItem(navigationLinks[this.currentUser.role], navigationState.navId);
                    if (navItem) {
                        // Restore the navigation with the saved operationTypeId if it exists
                        const detail = { ...navItem };
                        if (navigationState.operationTypeId) {
                            detail.operationTypeId = navigationState.operationTypeId;
                        }
                        this.rootElement.dispatchEvent(new CustomEvent('navigateTo', { detail }));
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('Error restoring navigation state:', error);
        }

        // Fallback to default view if restoration fails
        const defaultNav = navigationLinks[this.currentUser.role][0];
        if (defaultNav) {
            this.rootElement.dispatchEvent(new CustomEvent('navigateTo', { detail: defaultNav }));
        }
    }

    private findNavigationItem = (navItems: any[], targetNavId: string): any | null => {
        for (const item of navItems) {
            if (item.navId === targetNavId) {
                return item;
            }
            if (item.children) {
                const found = this.findNavigationItem(item.children, targetNavId);
                if (found) return found;
            }
        }
        return null;
    }
}
