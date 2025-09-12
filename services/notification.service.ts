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
        const notifications = await this.api.getNotifications(userId);
        const sortedNotifications = notifications.sort((a, b) => b.id - a.id);
        const unreadCount = sortedNotifications.filter(n => !n.read).length;
        
        return {
            notifications: sortedNotifications,
            unreadCount: unreadCount
        };
    }

    // In a real app, this would make an API call
    public async markAsRead(notificationId: number): Promise<boolean> {
        console.log(`Marking notification ${notificationId} as read.`);
        // This part needs to be implemented if we modify the mock data source
        // For now, it's handled on the client side when rendering.
        return true;
    }
}
