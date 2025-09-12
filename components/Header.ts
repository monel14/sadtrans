


import { User } from '../models';
import { NotificationService } from '../services/notification.service';
import { $ } from '../utils/dom';

export function renderHeader(user: User): HTMLElement {
    const header = document.createElement('header');
    header.className = 'flex justify-between items-center mb-6 pb-4 bg-slate-50/80 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 sticky top-0 z-20 md:bg-transparent md:backdrop-blur-none md:static md:pt-0 md:-mt-0 md:-mx-0 md:px-0 md:border-b md:border-slate-200';

    const roleDisplayMap: { [key: string]: string } = {
        agent: "Agent (Utilisateur Partenaire)",
        partner: "Partenaire (B2B)",
        admin_general: "Administrateur général",
        sous_admin: "Sous-administrateur",
    };

    header.innerHTML = `
        <div class="flex items-center">
            <button id="menuToggle" class="md:hidden text-slate-600 hover:text-slate-900 mr-3">
                <i class="fas fa-bars text-2xl"></i>
            </button>
            <h2 id="pageTitle" class="text-xl sm:text-2xl font-semibold text-slate-800">Tableau de Bord</h2>
        </div>
        <div class="flex items-center space-x-4">
            <div class="relative" id="notificationsContainer">
                <button class="text-slate-500 hover:text-slate-700 focus:outline-none">
                    <i class="fas fa-bell text-xl"></i>
                    <span id="notificationBadge" class="hidden absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white"></span>
                </button>
                <div id="notificationsDropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-md shadow-xl z-20 border border-slate-200">
                    <div class="p-3 border-b border-slate-200 font-semibold text-sm text-slate-700">Notifications Récentes</div>
                    <div class="py-1 max-h-64 overflow-y-auto" id="notificationsList">
                        <p class="p-4 text-sm text-slate-500">Aucune notification.</p>
                    </div>
                    <a href="#" class="block text-center p-2 text-sm text-violet-600 hover:bg-slate-100">Voir toutes les notifications</a>
                </div>
            </div>
            <div class="flex items-center">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e9d5ff&color=5b21b6&bold=true" alt="Avatar utilisateur" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full mr-3 object-cover">
                <div>
                    <p id="userName" class="font-semibold text-sm sm:text-base text-slate-700">${user.name}</p>
                    <p id="userRoleDisplay" class="text-xs text-slate-500 hidden sm:block">${roleDisplayMap[user.role] || user.role}</p>
                </div>
            </div>
        </div>
    `;

    // Notifications Logic
    const notificationService = NotificationService.getInstance();
    const notificationContainer = $('#notificationsContainer', header);
    const dropdown = $('#notificationsDropdown', header);
    const badge = $('#notificationBadge', header);
    const list = $('#notificationsList', header);

    const updateNotifications = async () => {
        if (!badge || !list) return;
        const state = await notificationService.getNotificationState(user.id);
        badge.textContent = String(state.unreadCount);
        badge.classList.toggle('hidden', state.unreadCount === 0);

        const displayNotifications = state.notifications.slice(0, 5);
        list.innerHTML = '';
        if (displayNotifications.length === 0) {
            list.innerHTML = `<p class="p-4 text-sm text-slate-500">Aucune notification récente.</p>`;
            return;
        }

        displayNotifications.forEach(notif => {
            const item = document.createElement('a');
            item.href = "#";
            item.className = `block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 ${!notif.read ? 'font-semibold bg-violet-50' : ''}`;
            item.innerHTML = `
                <div class="flex items-start">
                    <i class="fas ${notif.icon} mr-3 mt-1"></i>
                    <div>
                        <p class="${!notif.read ? 'text-slate-800' : 'text-slate-600'}">${notif.text}</p>
                        <p class="text-xs text-slate-400">${notif.time}</p>
                    </div>
                </div>`;
            item.onclick = (e) => {
                e.preventDefault();
                notif.read = true; // Simulate marking as read
                
                // If the notification has a target, navigate to it
                if (notif.target) {
                    header.dispatchEvent(new CustomEvent('navigateTo', {
                        detail: notif.target,
                        bubbles: true,
                        composed: true,
                    }));
                    dropdown?.classList.add('hidden'); // Close dropdown on navigation
                }

                updateNotifications();
            };
            list.appendChild(item);
        });
    };

    notificationContainer?.querySelector('button')?.addEventListener('click', () => {
        dropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
        if (notificationContainer && !notificationContainer.contains(event.target as Node)) {
            dropdown?.classList.add('hidden');
        }
    });

    updateNotifications();

    return header;
}