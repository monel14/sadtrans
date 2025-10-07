/**
 * Service PWA pour gérer l'installation et les fonctionnalités PWA
 */
export class PWAService {
    private deferredPrompt: any = null;
    private installButton: HTMLElement | null = null;

    constructor() {
        this.init();
    }

    private init() {
        // Écouter l'événement beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: beforeinstallprompt event fired');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Écouter l'installation
        window.addEventListener('appinstalled', () => {
            console.log('PWA: App installed successfully');
            this.hideInstallButton();
            this.deferredPrompt = null;
            
            // Afficher un toast de succès
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: 'Application installée avec succès !', type: 'success' }
            }));
        });

        // Vérifier si l'app est déjà installée
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA: App is running in standalone mode');
        }
    }

    public createInstallButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'pwa-install-btn';
        button.className = 'hidden fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 z-50';
        button.innerHTML = `
            <i class="fas fa-download mr-2"></i>
            Installer l'app
        `;
        
        button.addEventListener('click', () => {
            this.installApp();
        });

        document.body.appendChild(button);
        this.installButton = button;
        
        return button;
    }

    private showInstallButton() {
        if (!this.installButton) {
            this.createInstallButton();
        }
        
        if (this.installButton) {
            this.installButton.classList.remove('hidden');
            this.installButton.classList.add('animate-bounce');
            
            // Retirer l'animation après 2 secondes
            setTimeout(() => {
                this.installButton?.classList.remove('animate-bounce');
            }, 2000);
        }
    }

    private hideInstallButton() {
        if (this.installButton) {
            this.installButton.classList.add('hidden');
        }
    }

    public async installApp() {
        if (!this.deferredPrompt) {
            console.log('PWA: No deferred prompt available');
            return;
        }

        try {
            // Afficher le prompt d'installation
            this.deferredPrompt.prompt();
            
            // Attendre la réponse de l'utilisateur
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA: User accepted the install prompt');
            } else {
                console.log('PWA: User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
            
        } catch (error) {
            console.error('PWA: Error during installation:', error);
        }
    }

    public isInstallable(): boolean {
        return this.deferredPrompt !== null;
    }

    public isInstalled(): boolean {
        return window.matchMedia('(display-mode: standalone)').matches ||
               (window.navigator as any).standalone === true;
    }
}

// Instance globale
export const pwaService = new PWAService();