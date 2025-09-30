import { User } from './models';
import { renderLoginPage } from './components/LoginPage';
import { renderSidebar } from './components/Sidebar';
import { ToastContainer, ToastType } from './components/ToastContainer';
import { AuthService } from './services/auth.service';
import { DataService } from './services/data.service';
import { RefreshService } from './services/refresh.service';
import { OneSignalService } from './services/onesignal.service';
import { renderHeader } from './components/Header';
import { renderFooter } from './components/Footer';
import { navigationLinks } from './config/navigation';
import {
    AgentRequestRechargeModal,
    ViewProofModal,
    AssignToSubAdminModal,
    PartnerEditAgentModal,
    AdminEditUserModal,
    AdminEditPartnerModal,
    AdminRejectRechargeModal,
    PartnerTransferRevenueModal,
    ConfirmationModal,
    AdminAdjustBalanceModal
} from './components/modals';

export class App {
    private rootElement: HTMLElement;
    private currentUser: User | null = null;
    private mainLayout: any = null;
    private toastContainer: ToastContainer | null = null;
    private statusCheckInterval: number | null = null;

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

    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement;
    }

    public async init() {
        RefreshService.getInstance();
        await DataService.getInstance().initialize();

        this.toastContainer = new ToastContainer();
        document.body.prepend(this.toastContainer.element);

        this.addGlobalEventListeners();

        const authService = AuthService.getInstance();
        const user = await authService.getCurrentUser();

        await OneSignalService.init(user?.id || undefined);

        if (user) {
            this.currentUser = user;
            await OneSignalService.login(user.id);

            DataService.getInstance().reSubscribe();
            this.renderMainLayout();
            this.preFetchData();
            this.startUserStatusCheck();

            console.log("OneSignal initialisé et utilisateur connecté");
        } else {
            this.showLoginPage();
        }
    }

    private addGlobalEventListeners() {
        this.rootElement.addEventListener('loginSuccess', this.handleLoginSuccess as EventListener);
        this.rootElement.addEventListener('logout', this.handleLogout as EventListener);
        this.rootElement.addEventListener('navigateTo', this.navigateTo as EventListener);
        this.rootElement.addEventListener('updateActiveNav', this.updateActiveNav as EventListener);
        this.rootElement.addEventListener('updateCurrentUser', this.handleUpdateCurrentUser as EventListener);

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
        document.body.addEventListener('servicesLoaded', this.handleServicesLoaded as EventListener);
    }

    private showLoginPage() {
        this.rootElement.innerHTML = '';
        const loginPage = renderLoginPage();
        this.rootElement.appendChild(loginPage);
    }

    private handleLoginSuccess = async (event: Event) => {
        const customEvent = event as CustomEvent;
        this.currentUser = customEvent.detail.user;
        DataService.getInstance().reSubscribe();

        if (this.currentUser) {
            await OneSignalService.login(this.currentUser.id);
        }

        this.renderMainLayout();
        this.preFetchData();

        console.log("Utilisateur connecté et OneSignal mis à jour");
    }

    private preFetchData = async () => {
        const dataService = DataService.getInstance();
        dataService.getAllOperationTypes();
        dataService.getCardTypes();
        dataService.getUsers();
        dataService.getPartners();
        dataService.getContracts();
    }

    private startUserStatusCheck = () => {
        this.statusCheckInterval = window.setInterval(async () => {
            const authService = AuthService.getInstance();
            const user = await authService.getCurrentUser();
            if (!user) this.handleLogout();
        }, 30000);
    }

    private stopUserStatusCheck = () => {
        if (this.statusCheckInterval) clearInterval(this.statusCheckInterval);
    }

    private handleLogout = async () => {
        this.stopUserStatusCheck();
        await OneSignalService.logout();

        await AuthService.getInstance().logout();
        this.currentUser = null;
        this.mainLayout = null;
        localStorage.removeItem('currentNavigation');
        this.showLoginPage();

        console.log("Utilisateur déconnecté et OneSignal nettoyé");
    }

    private handleUpdateCurrentUser = (event: CustomEvent) => {
        if (event.detail.user && this.currentUser && event.detail.user.id === this.currentUser.id) {
            this.currentUser = event.detail.user;
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
            footer
        };

        this.initializeModals();

        const menuToggle = header.querySelector('#menuToggle');
        menuToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        this.restoreNavigationState();

        // Bouton pour activer les notifications
        const enablePushBtn = document.createElement('button');
        enablePushBtn.id = "enablePushBtn";
        enablePushBtn.textContent = "Activer les notifications";
        enablePushBtn.className = "btn-notifications";
        header.appendChild(enablePushBtn);

        enablePushBtn.addEventListener("click", () => {
            if (this.currentUser) {
                OneSignalService.enablePushNotifications();
            }
        });
    }

    private restoreNavigationState = () => {
        if (!this.currentUser) return;
        const savedState = localStorage.getItem('currentNavigation');
        if (savedState) {
            const navigationState = JSON.parse(savedState);
            if (navigationState.userRole === this.currentUser.role) {
                const navItem = this.findNavigationItem(navigationLinks[this.currentUser.role], navigationState.navId);
                if (navItem) {
                    const detail = { ...navItem, operationTypeId: navigationState.operationTypeId };
                    this.rootElement.dispatchEvent(new CustomEvent('navigateTo', { detail }));
                    return;
                }
            }
        }
        const defaultNav = navigationLinks[this.currentUser.role][0];
        if (defaultNav) {
            this.rootElement.dispatchEvent(new CustomEvent('navigateTo', { detail: defaultNav }));
        }
    }

    private findNavigationItem = (navItems: any[], targetNavId: string): any | null => {
        for (const item of navItems) {
            if (item.navId === targetNavId) return item;
            if (item.children) {
                const found = this.findNavigationItem(item.children, targetNavId);
                if (found) return found;
            }
        }
        return null;
    }

    private updateActiveNav = (event: CustomEvent) => {
        if (!this.mainLayout) return;
        const { navId } = event.detail;
        const sidebarLinks = this.mainLayout.sidebar.querySelectorAll('#appNavigation a');
        sidebarLinks.forEach(link => {
            const linkElement = link as HTMLElement;
            const isActive = linkElement.dataset.navId === navId;
            linkElement.classList.toggle('active', isActive);
            if (isActive) {
                const parentDetails = linkElement.closest('details');
                if (parentDetails && !parentDetails.open) parentDetails.open = true;
            }
        });
    }

    private navigateTo = async (event: Event) => {
        const customEvent = event as CustomEvent;
        if (!this.mainLayout || !this.currentUser) return;
        const { viewFn, label, action, navId, operationTypeId } = customEvent.detail;
        if (action) return action();

        if (viewFn) {
            localStorage.setItem('currentNavigation', JSON.stringify({ navId, label, operationTypeId, userRole: this.currentUser.role }));
            const pageTitleEl = this.mainLayout.header.querySelector('#pageTitle') as HTMLElement;
            if (pageTitleEl) pageTitleEl.textContent = label;
            this.updateActiveNav({ detail: { navId } } as CustomEvent);
            const currentPageContent = this.mainLayout.pageContent;
            currentPageContent.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
            try {
                const viewContent = await viewFn(this.currentUser, operationTypeId);
                currentPageContent.innerHTML = '';
                currentPageContent.appendChild(viewContent);
            } catch {
                currentPageContent.innerHTML = '<div class="text-center p-8 text-red-500">Erreur lors du chargement de la page.</div>';
            }
        }
        if (window.innerWidth < 768) this.mainLayout.sidebar.classList.add('-translate-x-full');
    }

    private handleShowToast = (event: CustomEvent) => {
        const { message, type } = event.detail as { message: string, type: ToastType };
        if (this.toastContainer) this.toastContainer.showToast(message, type);
    }

    private handleServicesLoaded = () => {
        if (this.mainLayout && this.currentUser) {
            const newSidebar = renderSidebar(this.currentUser);
            this.mainLayout.appContainer.replaceChild(newSidebar, this.mainLayout.sidebar);
            this.mainLayout.sidebar = newSidebar;
        }
    }

    private initializeModals = async () => {
        if (this.agentRequestRechargeModal) return;
        this.agentRequestRechargeModal = new AgentRequestRechargeModal();
        this.viewProofModal = new ViewProofModal();
        this.partnerEditAgentModal = new PartnerEditAgentModal();
        this.adminEditUserModal = new AdminEditUserModal();
        this.adminEditPartnerModal = new AdminEditPartnerModal();
        this.adminRejectRechargeModal = new AdminRejectRechargeModal();
        this.partnerTransferRevenueModal = new PartnerTransferRevenueModal();
        this.confirmationModal = new ConfirmationModal();
        this.adminAdjustBalanceModal = new AdminAdjustBalanceModal();

        const allUsers = await DataService.getInstance().getUsers();
        const subAdmins = allUsers.filter(u => u.role === 'sous_admin');
        this.assignToSubAdminModal = new AssignToSubAdminModal(subAdmins);
    }

    private handleOpenAgentRechargeModal = () => { this.agentRequestRechargeModal?.show(this.currentUser!); }
    private handleOpenPartnerEditAgentModal = (event: CustomEvent) => this.partnerEditAgentModal?.show(event.detail.agent, event.detail.partnerId, event.detail.agencyId);
    private handleOpenAdminEditUserModal = (event: CustomEvent) => this.adminEditUserModal?.show(event.detail.user, event.detail.roleToCreate);
    private handleOpenAdminEditPartnerModal = (event: CustomEvent) => this.adminEditPartnerModal?.show(event.detail.partner);
    private handleOpenAdminRejectRechargeModal = (event: CustomEvent) => this.adminRejectRechargeModal?.show(event.detail.requestId);
    private handleOpenAdminAdjustBalanceModal = (event: CustomEvent) => this.adminAdjustBalanceModal?.show(event.detail.agency);
    private handleOpenPartnerTransferRevenueModal = (event: CustomEvent) => this.partnerTransferRevenueModal?.show(event.detail.userId, event.detail.amount);
    private handleOpenConfirmationModal = (event: CustomEvent) => this.confirmationModal?.show(event.detail.title, event.detail.message, event.detail.onConfirm, event.detail.options);
    private handleOpenAssignModal = (event: CustomEvent) => this.assignToSubAdminModal?.show(event.detail.taskId);
    private handleOpenViewProofModal = (event: CustomEvent) => this.viewProofModal?.show(event.detail.imageUrl);
}
