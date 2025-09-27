import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { User } from '../models';
import { supabase } from './supabase.service';

// Configuration Firebase (à remplacer par vos propres clés)
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyAl_pEuUd7ssVwMbFQ4O5EAGPw2Yfu9sEY",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "strans-5a095.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "strans-5a095",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "strans-5a095.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "904244709908",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:904244709908:web:0b4bce2ae17ff52c233501",
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID || "G-24PZ4ZV6ZC"
};

export class PushNotificationService {
  private static instance: PushNotificationService;
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private isSupportedBrowser: boolean = false;

  private constructor() {
    // Initialize Firebase only if supported
    isSupported().then((supported) => {
      this.isSupportedBrowser = supported;
      if (supported) {
        this.app = initializeApp(firebaseConfig);
        this.messaging = getMessaging(this.app);
        this.setupForegroundMessageHandler();
      }
    }).catch((error) => {
      console.error("Error checking Firebase support:", error);
    });
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Demande la permission à l'utilisateur pour les notifications push
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupportedBrowser) {
      console.warn("Firebase not supported in this browser");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        return true;
      } else {
        console.log('Unable to get permission to notify.');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Récupère le token FCM pour l'utilisateur
   */
  public async getFCMToken(): Promise<string | null> {
    if (!this.isSupportedBrowser || !this.messaging) {
      return null;
    }

    try {
      // Vérifier si le service worker est enregistré
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.error('Service worker not ready');
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: (import.meta as any).env.VITE_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY",
        serviceWorkerRegistration: registration
      });

      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Enregistre le token FCM de l'utilisateur dans la base de données
   */
  public async registerUserToken(userId: string, token: string): Promise<boolean> {
    try {
      const deviceInfo = {
        browser: navigator.userAgent,
        deviceType: 'web'
      };

      const { data, error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_id: userId,
          fcm_token: token,
          device_info: deviceInfo,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error registering user token:', error);
        return false;
      }

      console.log('User token registered successfully:', data);
      return true;
    } catch (error) {
      console.error('Error registering user token:', error);
      return false;
    }
  }

  /**
   * Configure le gestionnaire de messages en premier plan
   */
  private setupForegroundMessageHandler(): void {
    if (!this.isSupportedBrowser || !this.messaging) {
      return;
    }

    onMessage(this.messaging, (payload) => {
      // Extraire les données du message
      const { title, body, icon, data } = payload.notification || {} as any;
      
      // Afficher une notification système si le navigateur le supporte
      if (Notification.permission === 'granted') {
        new Notification(title || 'Nouvelle notification', {
          body: body || 'Vous avez une nouvelle notification',
          icon: icon || '/images/icon-192x192.png',
          data: data
        });
      }
      
      // Déclencher un événement personnalisé pour que l'application puisse réagir
      document.body.dispatchEvent(new CustomEvent('pushNotificationReceived', {
        detail: { title, body, data }
      }));
    });
  }

  /**
   * Envoie une notification push à un utilisateur spécifique
   */
  public async sendNotificationToUser(userId: string, title: string, body: string, data?: any): Promise<boolean> {
    // Cette méthode doit être implémentée côté serveur
    // Elle enverrait une requête à votre backend qui utiliserait l'API FCM
    try {
      // Exemple d'implémentation avec un appel à votre backend:
      /*
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title,
          body,
          data
        })
      });
      
      const result = await response.json();
      return result.success;
      */
      
      // Pour le moment, on simule l'envoi
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Envoie une notification push à tous les utilisateurs
   */
  public async sendNotificationToAll(title: string, body: string, data?: any): Promise<boolean> {
    // Cette méthode doit être implémentée côté serveur
    try {
      // Exemple d'implémentation avec un appel à votre backend:
      /*
      const response = await fetch('/api/send-push-notification-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          data
        })
      });
      
      const result = await response.json();
      return result.success;
      */
      
      // Pour le moment, on simule l'envoi
      return true;
    } catch (error) {
      console.error('Error sending notification to all users:', error);
      return false;
    }
  }
}