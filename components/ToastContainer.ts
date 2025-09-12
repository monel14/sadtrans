export type ToastType = 'success' | 'error' | 'warning' | 'info';

export class ToastContainer {
    public element: HTMLElement;
    private icons: Record<ToastType, string> = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
    };
    private colors: Record<ToastType, string> = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500',
    };

    constructor() {
        this.element = document.createElement('div');
        this.element.id = 'toast-container';
        this.element.className = 'fixed top-4 right-4 z-[100] w-full max-w-xs space-y-3';
    }

    public showToast(message: string, type: ToastType = 'info', duration: number = 5000) {
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.className = `
            flex items-start p-4 rounded-lg shadow-lg text-white ${this.colors[type]}
            transform translate-x-full opacity-0 animate-slide-in
        `;

        toast.innerHTML = `
            <div class="flex-shrink-0 pt-0.5">
                <i class="fas ${this.icons[type]} fa-lg"></i>
            </div>
            <div class="ml-3 flex-1">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
                <button type="button" class="inline-flex rounded-md text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white">
                    <span class="sr-only">Close</span>
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        this.element.appendChild(toast);

        const closeToast = () => {
            toast.classList.remove('animate-slide-in');
            toast.classList.add('animate-fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            }, { once: true });
        };

        const timer = setTimeout(closeToast, duration);

        toast.querySelector('button')?.addEventListener('click', () => {
            clearTimeout(timer);
            closeToast();
        });
    }
}
