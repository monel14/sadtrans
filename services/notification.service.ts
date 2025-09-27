import { Notification } from '../models';
import { ApiService } from './api.service';

export interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
}

export class NotificationService {
    private api: ApiService;
    private static instance: NotificationService;
    // Ajout d'un cache pour éviter les duplications
    private notificationCache: Map<number | string, number> = new Map(); // id -> timestamp
    // Ajout d'un cache pour les messages de notification
    private messageCache: Map<string, number> = new Map(); // message -> timestamp

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
            
            // Nettoyer le cache des anciennes notifications (plus de 5 minutes)
            const now = Date.now();
            for (const [id, timestamp] of this.notificationCache.entries()) {
                if (now - timestamp > 300000) { // 5 minutes
                    this.notificationCache.delete(id);
                }
            }
            
            // Nettoyer le cache des messages (plus de 5 minutes)
            for (const [message, timestamp] of this.messageCache.entries()) {
                if (now - timestamp > 300000) { // 5 minutes
                    this.messageCache.delete(message);
                }
            }
            
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
    
    // Méthode pour vérifier si une notification est un doublon
    public isDuplicate(notification: Notification): boolean {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000; // 5 minutes
        const tenSecondsAgo = now - 10000; // 10 secondes
        
        // Nettoyer le cache des anciennes entrées
        for (const [id, timestamp] of this.notificationCache.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this.notificationCache.delete(id);
            }
        }
        
        // Nettoyer le cache des messages
        for (const [message, timestamp] of this.messageCache.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this.messageCache.delete(message);
            }
        }
        
        // Vérifier si cette notification a déjà été vue récemment par ID
        if (this.notificationCache.has(notification.id)) {
            console.log('Notification en double par ID:', notification.id);
            return true;
        }
        
        // Vérifier si un message similaire a été vu récemment (dans les 10 secondes)
        if (this.messageCache.has(notification.text)) {
            const lastSeen = this.messageCache.get(notification.text);
            if (lastSeen && lastSeen > tenSecondsAgo) {
                console.log('Notification en double par message:', notification.text);
                return true;
            }
        }
        
        // Ajouter cette notification au cache
        this.notificationCache.set(notification.id, now);
        this.messageCache.set(notification.text, now);
        return false;
    }
}