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
                <div id="notificationsDropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-md shadow-xl z-20 border border-slate-200 md:right-0 md:left-auto md:top-auto md:bottom-auto md:transform-none sm:w-96 md:w-80" style="left: 50%; transform: translateX(-50%); max-width: calc(100vw - 2rem);">
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
    // Ajout d'un Set pour suivre les IDs de notifications déjà reçues
    let receivedNotificationIds = new Set<number | string>();
    // Ajout d'un Map pour suivre les messages de notification et éviter les doublons
    let recentNotificationMessages = new Map<string, number>(); // message -> timestamp

    const updateNotifications = async (refreshFromServer = false) => {
        console.log('Mise à jour des notifications, refreshFromServer:', refreshFromServer);
        if (refreshFromServer) {
            try {
                const state = await notificationService.getNotificationState(user.id);
                notifications = state.notifications;
                unreadCount = state.unreadCount;
                console.log('Notifications récupérées du serveur:', { notifications, unreadCount });
                // Réinitialiser le Set quand on recharge depuis le serveur
                receivedNotificationIds.clear();
                // Réinitialiser le Map des messages
                recentNotificationMessages.clear();
                // Ajouter toutes les notifications existantes au Set pour éviter les duplications
                notifications.forEach(notif => {
                    receivedNotificationIds.add(notif.id);
                    // Ajouter le message au Map avec le timestamp actuel
                    recentNotificationMessages.set(notif.text, Date.now());
                });
                
                // Nettoyer les anciens messages (plus de 5 minutes)
                const now = Date.now();
                for (const [message, timestamp] of recentNotificationMessages.entries()) {
                    if (now - timestamp > 300000) { // 5 minutes
                        recentNotificationMessages.delete(message);
                    }
                }
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

    // Fonction pour vérifier si une notification est un doublon
    const isDuplicateNotification = (notification: any): boolean => {
        const now = Date.now();
        const tenSecondsAgo = now - 10000; // 10 secondes
        const fiveMinutesAgo = now - 300000; // 5 minutes
        
        // Vérifier d'abord par ID
        if (receivedNotificationIds.has(notification.id)) {
            console.log('Notification déjà reçue par ID:', notification.id);
            return true;
        }
        
        // Nettoyer les anciens messages
        for (const [message, timestamp] of recentNotificationMessages.entries()) {
            if (timestamp < fiveMinutesAgo) {
                recentNotificationMessages.delete(message);
            }
        }
        
        // Nettoyer les anciens IDs (plus de 5 minutes)
        // Note: Comme les IDs sont des strings, nous devons les gérer différemment
        // Pour simplifier, nous nous appuyons principalement sur le message
        
        // Vérifier si un message similaire a été reçu récemment
        if (recentNotificationMessages.has(notification.text || notification.message)) {
            const lastReceived = recentNotificationMessages.get(notification.text || notification.message);
            if (lastReceived && lastReceived > tenSecondsAgo) {
                console.log('Notification en double par message similaire:', notification.text || notification.message);
                return true;
            }
        }
        
        // Ajouter cette notification aux Sets
        receivedNotificationIds.add(notification.id);
        recentNotificationMessages.set(notification.text || notification.message, now);
        
        return false;
    };

    // Listen for new notifications via realtime
    const handleNewNotification = (event: Event) => {
        const customEvent = event as CustomEvent;
        const newNotif = customEvent.detail.notification;
        console.log('Nouvelle notification reçue:', newNotif);
        
        // Vérifier si la notification est un doublon
        if (isDuplicateNotification(newNotif)) {
            console.log('Notification en double, ignorée:', newNotif.id);
            return;
        }
        
        // Vérifier si la notification est pour l'utilisateur courant ou pour tous
        if (newNotif.userId === user.id || newNotif.userId === 'all') {
            notifications.unshift(newNotif);
            if (!newNotif.read) unreadCount++;
            updateNotifications();
            
            // Show toast only for the recipient and only if added
            document.body.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                    message: newNotif.text || newNotif.message || 'Nouvelle notification',
                    type: 'info'
                }
            }));
        }
    };

    // Écouter également les événements de mise à jour des notifications
    const handleNotificationUpdate = () => {
        console.log('Mise à jour des notifications en temps réel');
        // Ne pas forcer le rafraîchissement depuis le serveur pour éviter les duplications
        // updateNotifications(true);
        // Juste mettre à jour l'affichage avec les données actuelles
        updateNotifications(false);
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
        // Nettoyer le Set lors du nettoyage
        receivedNotificationIds.clear();
    };
    (header as any)._cleanup = cleanup;

    return header;
}