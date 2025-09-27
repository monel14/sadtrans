import { User } from '../models';
import { NotificationService } from '../services/notification.service';
import { $ } from '../utils/dom';
import { formatRelativeTime } from '../utils/formatters';
import { Notification } from '../models';

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
                <button class="text-slate-500 hover:text-slate-700 focus:outline-none" aria-label="Notifications">
                    <i class="fas fa-bell text-xl"></i>
                    <span id="notificationBadge" class="hidden absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">0</span>
                </button>
                <div id="notificationsDropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-md shadow-xl z-20 border border-slate-200">
                    <div class="p-3 border-b border-slate-200 font-semibold text-sm text-slate-700">Notifications Récentes</div>
                    <div class="py-1 max-h-64 overflow-y-auto" id="notificationsList">
                        <p class="p-4 text-sm text-slate-500">Chargement des notifications...</p>
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

    let notifications: Notification[] = [];
    let unreadCount = 0;

    const updateNotifications = async (refreshFromServer = false) => {
        console.log('Mise à jour des notifications, refreshFromServer:', refreshFromServer);
        if (refreshFromServer) {
            try {
                const state = await notificationService.getNotificationState(user.id);
                notifications = state.notifications;
                unreadCount = state.unreadCount;
                console.log('Notifications récupérées du serveur:', { notifications, unreadCount });
            } catch (error) {
                console.error('Erreur lors de la récupération des notifications:', error);
                list.innerHTML = `<p class="p-4 text-sm text-red-500">Erreur lors du chargement des notifications.</p>`;
                return;
            }
        }

        if (!badge || !list) {
            console.error('Éléments de badge ou de liste non trouvés');
            return;
        }
        
        // Mettre à jour le badge
        badge.textContent = String(unreadCount);
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        console.log('Badge mis à jour:', unreadCount);

        const displayNotifications = notifications.slice(0, 5);
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
                    <i class="fas ${notif.icon || 'fa-bell'} mr-3 mt-1"></i>
                    <div>
                        <p class="${!notif.read ? 'text-slate-800' : 'text-slate-600'}">${notif.text}</p>
                        <p class="text-xs text-slate-400">${formatRelativeTime(notif.time)}</p>
                    </div>
                </div>`;
            item.onclick = (e) => {
                e.preventDefault();
                if (!notif.read) {
                    notif.read = true;
                    unreadCount--;
                    updateNotifications();
                    // TODO: Call API to mark as read server-side
                }
                
                // If the notification has a target, navigate to it
                if (notif.target) {
                    header.dispatchEvent(new CustomEvent('navigateTo', {
                        detail: notif.target,
                        bubbles: true,
                        composed: true,
                    }));
                    dropdown?.classList.add('hidden'); // Close dropdown on navigation
                }
            };
            list.appendChild(item);
        });
    };

    // Initial load
    updateNotifications(true);

    // Listen for new notifications via realtime
    const handleNewNotification = (event: Event) => {
        const customEvent = event as CustomEvent;
        const newNotif = customEvent.detail.notification;
        console.log('Nouvelle notification reçue:', newNotif);
        
        // Vérifier si la notification est pour l'utilisateur courant ou pour tous
        if (newNotif.userId === user.id || newNotif.userId === 'all') {
            notifications.unshift(newNotif);
            if (!newNotif.read) unreadCount++;
            updateNotifications();
        }
    };

    // Écouter également les événements de mise à jour des notifications
    const handleNotificationUpdate = () => {
        console.log('Mise à jour des notifications en temps réel');
        updateNotifications(true); // Forcer le rafraîchissement depuis le serveur
    };
    
    // Ajouter les écouteurs pour les différents événements qui peuvent déclencher une mise à jour
    document.body.addEventListener('newNotification', handleNewNotification);
    document.body.addEventListener('notificationUpdated', handleNotificationUpdate);
    document.body.addEventListener('transactionValidated', handleNotificationUpdate);
    document.body.addEventListener('transactionRejected', handleNotificationUpdate);
    document.body.addEventListener('rechargeApproved', handleNotificationUpdate);
    document.body.addEventListener('rechargeRejected', handleNotificationUpdate);

    notificationContainer?.querySelector('button')?.addEventListener('click', () => {
        console.log('Clic sur l\'icône de notification');
        dropdown?.classList.toggle('hidden');
        // Si le dropdown est ouvert, marquer toutes les notifications comme lues
        if (!dropdown?.classList.contains('hidden')) {
            // Marquer visuellement comme lues (pas de mise à jour serveur dans cette version)
            unreadCount = 0;
            updateNotifications();
            
            // Marquer toutes les notifications comme lues côté serveur
            notificationService.markAllAsRead(user.id).then(success => {
                if (success) {
                    console.log('Toutes les notifications ont été marquées comme lues');
                } else {
                    console.error('Erreur lors du marquage des notifications comme lues');
                }
            });
        }
    });

    document.addEventListener('click', (event) => {
        if (notificationContainer && !notificationContainer.contains(event.target as Node)) {
            dropdown?.classList.add('hidden');
        }
    });

    // Cleanup listener when header is destroyed (called from app.ts if needed)
    const cleanup = () => {
        document.body.removeEventListener('newNotification', handleNewNotification);
        document.body.removeEventListener('notificationUpdated', handleNotificationUpdate);
        document.body.removeEventListener('transactionValidated', handleNotificationUpdate);
        document.body.removeEventListener('transactionRejected', handleNotificationUpdate);
        document.body.removeEventListener('rechargeApproved', handleNotificationUpdate);
        document.body.removeEventListener('rechargeRejected', handleNotificationUpdate);
    };
    (header as any)._cleanup = cleanup;

    return header;
}