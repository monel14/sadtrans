

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
    private toastContainer: ToastContainer | null = null;

    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement;

        // Bind event handlers
        this.handleLoginSuccess = this.handleLoginSuccess.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.navigateTo = this.navigateTo.bind(this);
        this.updateActiveNav = this.updateActiveNav.bind(this);
        this.handleOpenAgentRechargeModal = this.handleOpenAgentRechargeModal.bind(this);
        this.handleOpenAssignModal = this.handleOpenAssignModal.bind(this);
        this.handleOpenViewProofModal = this.handleOpenViewProofModal.bind(this);
        this.handleOpenPartnerEditAgentModal = this.handleOpenPartnerEditAgentModal.bind(this);
        this.handleOpenAdminEditUserModal = this.handleOpenAdminEditUserModal.bind(this);
        this.handleOpenAdminEditPartnerModal = this.handleOpenAdminEditPartnerModal.bind(this);
        this.handleShowToast = this.handleShowToast.bind(this);
        this.handleUpdateCurrentUser = this.handleUpdateCurrentUser.bind(this);
    }

    public init() {
        // Create and append the toast container
        this.toastContainer = new ToastContainer();
        document.body.prepend(this.toastContainer.element);

        // Events dispatched from within the #app container
        this.rootElement.addEventListener('loginSuccess', this.handleLoginSuccess as EventListener);
        this.rootElement.addEventListener('logout', this.handleLogout);
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
        document.body.addEventListener('showToast', this.handleShowToast as EventListener);
        
        // Render the initial view based on authentication state
        if (!this.currentUser) {
            this.showLoginPage();
        } else {
            this.renderMainLayout();
        }
    }

    private showLoginPage() {
        this.rootElement.innerHTML = '';
        const loginPage = renderLoginPage();
        this.rootElement.appendChild(loginPage);
    }

    private handleLoginSuccess(event: CustomEvent) {
        this.currentUser = event.detail.user;
        this.renderMainLayout();
    }

    private async handleLogout() {
        await AuthService.getInstance().logout();
        this.currentUser = null;
        this.mainLayout = null;
        this.showLoginPage();
    }
    
    private handleUpdateCurrentUser(event: CustomEvent) {
        if (event.detail.user && this.currentUser && event.detail.user.id === this.currentUser.id) {
            this.currentUser = event.detail.user;
        }
    }

    private updateActiveNav(event: CustomEvent) {
        if (!this.mainLayout) return;
        const { navId } = event.detail;

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

    private async navigateTo(event: CustomEvent) {
        if (!this.mainLayout || !this.currentUser) return;

        const { viewFn, label, action, navId, operationTypeId } = event.detail;
        
        if (action) {
            action();
            return;
        }

        if (viewFn) {
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

    private handleShowToast(event: CustomEvent) {
        const { message, type } = event.detail as { message: string, type: ToastType };
        if (this.toastContainer) {
            this.toastContainer.showToast(message, type);
        }
    }

    private async initializeModals() {
        if (this.agentRequestRechargeModal) return; // Already initialized

        this.agentRequestRechargeModal = new AgentRequestRechargeModal();
        this.viewProofModal = new ViewProofModal();
        this.partnerEditAgentModal = new PartnerEditAgentModal();
        this.adminEditUserModal = new AdminEditUserModal();
        this.adminEditPartnerModal = new AdminEditPartnerModal();

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
    }

    private handleOpenAgentRechargeModal() {
        if (this.agentRequestRechargeModal && this.currentUser) {
            this.agentRequestRechargeModal.show(this.currentUser);
        }
    }
    
    private handleOpenPartnerEditAgentModal(event: CustomEvent) {
        const { agent, partnerId } = event.detail;
        if (this.partnerEditAgentModal) {
            this.partnerEditAgentModal.show(agent, partnerId);
        }
    }

    private handleOpenAdminEditUserModal(event: CustomEvent) {
        const { user, roleToCreate } = event.detail;
        if (this.adminEditUserModal) {
            this.adminEditUserModal.show(user, roleToCreate);
        }
    }

    private handleOpenAdminEditPartnerModal(event: CustomEvent) {
        const { partner } = event.detail;
        if (this.adminEditPartnerModal) {
            this.adminEditPartnerModal.show(partner);
        }
    }

    private handleOpenAssignModal(event: CustomEvent) {
        const { taskId } = event.detail;
        if (this.assignToSubAdminModal) {
            this.assignToSubAdminModal.show(taskId);
        }
    }

    private handleOpenViewProofModal(event: CustomEvent) {
        const { imageUrl } = event.detail;
        if (this.viewProofModal && imageUrl) {
            this.viewProofModal.show(imageUrl);
        }
    }

    private renderMainLayout() {
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

        // Load default view
        const defaultNav = navigationLinks[this.currentUser.role][0];
        if (defaultNav) {
            this.rootElement.dispatchEvent(new CustomEvent('navigateTo', { detail: defaultNav }));
        }
    }
}
