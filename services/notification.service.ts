import { Notification } from '../models';
import { ApiService } from './api.service';

export interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
}

export class NotificationService {
    private api: ApiService;
    private static instance: NotificationService;

    private constructor() {
        this.api = ApiService.getInstance();
    }
    
    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public async getNotificationState(userId: string): Promise<NotificationState> {
        console.log('Récupération des notifications pour l\'utilisateur:', userId);
        try {
            const notifications = await this.api.getNotifications(userId);
            console.log('Notifications récupérées de l\'API:', notifications);
            const sortedNotifications = notifications.sort((a, b) => {
                // Trier par date de création (les plus récentes en premier)
                return new Date(b.time).getTime() - new Date(a.time).getTime();
            });
            const unreadCount = sortedNotifications.filter(n => !n.read).length;
            
            console.log('Notifications triées et comptage non lues:', {
                total: sortedNotifications.length,
                unread: unreadCount
            });
            
            return {
                notifications: sortedNotifications,
                unreadCount: unreadCount
            };
        } catch (error) {
            console.error('Erreur dans getNotificationState:', error);
            return {
                notifications: [],
                unreadCount: 0
            };
        }
    }

    // In a real app, this would make an API call
    public async markAsRead(notificationId: number): Promise<boolean> {
        console.log(`Marking notification ${notificationId} as read.`);
        // This part needs to be implemented if we modify the mock data source
        // For now, it's handled on the client side when rendering.
        return true;
    }
    
    // Méthode pour marquer toutes les notifications comme lues
    public async markAllAsRead(userId: string): Promise<boolean> {
        console.log(`Marking all notifications as read for user ${userId}`);
        try {
            const result = await this.api.markAllAsRead(userId);
            return result;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    }
}