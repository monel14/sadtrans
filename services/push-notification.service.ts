/**
 * Service de notifications push natives
 * Remplace OneSignal par une implémentation directe
 */

import { supabase } from './supabase.service';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private userId: string | null = null;

  // Configuration VAPID - clés URL-safe valides (65 bytes)
  private vapidPublicKey = 'BLA3lu547ai4lGW0Fqae-74YdwPkhmtTCiGw85PICS43nuKkQVrpE8kvi_1aLJ6yAn9FxOftcUKb4HzUyOKbj-Y';

  private constructor() { }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialise le service de notifications push
   */
  public async init(userId?: string): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers non supportés');
      }

      if (!('PushManager' in window)) {
        throw new Error('Push API non supportée');
      }

      // Détecter l'environnement
      const isLocalDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isHTTPS = window.location.protocol === 'https:';

      console.log('🌍 Environnement détecté:', {
        localhost: isLocalDev,
        https: isHTTPS,
        url: window.location.href
      });

      // Écouter les messages du Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message du SW:', event.data);

        if (event.data.type === 'SW_ACTIVATED') {
          console.log('✅ Service Worker activé, version:', event.data.version);
        }
      });

      // Enregistrer le service worker
      this.registration = await navigator.serviceWorker.register('/custom-sw.js', {
        updateViaCache: 'none' // Force la vérification des mises à jour
      });
      console.log('✅ Service Worker enregistré:', this.registration);

      // Gérer les mises à jour du SW
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        console.log('🔄 Nouvelle version du SW détectée');

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🆕 Nouvelle version disponible, activation...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Attendre que le service worker soit prêt
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker prêt');

      // Vérifier l'état du contrôleur
      if (!navigator.serviceWorker.controller) {
        console.warn('⚠️ SW pas encore en contrôle de la page');

        // Si le SW est actif mais ne contrôle pas la page
        if (this.registration.active) {
          console.log('🔄 SW actif mais pas en contrôle - rechargement nécessaire');

          // Vérifier si on a déjà rechargé récemment
          const lastReload = sessionStorage.getItem('sw-last-reload');
          const now = Date.now();

          if (!lastReload || (now - parseInt(lastReload)) > 5000) {
            // Pas de rechargement récent, on recharge
            sessionStorage.setItem('sw-last-reload', now.toString());
            console.log('🔄 Rechargement de la page pour activer le SW...');

            // Attendre un peu pour que les logs soient visibles
            setTimeout(() => {
              window.location.reload();
            }, 500);
            return;
          } else {
            console.warn('⚠️ Rechargement récent détecté, on continue sans contrôleur');
            console.warn('💡 Essayez de recharger manuellement la page (F5)');
          }
        } else if (this.registration.installing || this.registration.waiting) {
          console.log('⏳ SW en cours d\'installation/attente');

          // Attendre que le SW soit activé
          const waitForActive = new Promise<void>((resolve) => {
            const checkActive = () => {
              if (this.registration!.active) {
                console.log('✅ SW maintenant actif');
                resolve();
              } else {
                setTimeout(checkActive, 100);
              }
            };
            checkActive();

            // Timeout après 5 secondes
            setTimeout(() => resolve(), 5000);
          });

          await waitForActive;

          // Maintenant recharger
          console.log('🔄 Rechargement pour activer le SW...');
          setTimeout(() => window.location.reload(), 500);
          return;
        }
      } else {
        console.log('✅ SW contrôle la page');
        sessionStorage.removeItem('sw-last-reload');
      }

      console.log('🎮 État final - Controller:', navigator.serviceWorker.controller ? 'Actif ✅' : 'Null ❌');

      if (userId) {
        this.userId = userId;

        // En développement local, avertir l'utilisateur des limitations
        if (isLocalDev && isHTTPS) {
          console.warn('⚠️ Développement local HTTPS: Les notifications push peuvent échouer avec des certificats auto-signés');
          console.log('💡 Solutions: Utiliser mkcert, ngrok, ou tester sur un serveur de staging');
        }

        await this.subscribe();
      }

    } catch (error) {
      console.error('Erreur lors de l\'initialisation des notifications push:', error);
      throw error;
    }
  }

  /**
   * Demande la permission et s'abonne aux notifications
   */
  public async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker non enregistré');
      }

      // Demander la permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permission de notification refusée');
        return null;
      }

      // Vérifier s'il y a déjà un abonnement
      let subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Diagnostic avant tentative d'abonnement
        console.log('🔍 Diagnostic avant abonnement:');
        console.log('   - Protocole:', window.location.protocol);
        console.log('   - Host:', window.location.host);
        console.log('   - En ligne:', navigator.onLine);
        console.log('   - User Agent:', navigator.userAgent.substring(0, 50) + '...');

        // Créer un nouvel abonnement avec gestion d'erreur améliorée
        const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

        try {
          subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource
          });
        } catch (subscribeError: any) {
          console.error('❌ Erreur détaillée d\'abonnement:', {
            name: subscribeError.name,
            message: subscribeError.message,
            code: subscribeError.code
          });

          // Gestion spécifique des erreurs courantes
          if (subscribeError.name === 'AbortError') {
            // Tentative de solution pour AbortError
            console.log('🔧 Tentative de solution pour AbortError...');

            // Attendre un peu et réessayer
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
              subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource
              });
              console.log('✅ Abonnement réussi après retry');
            } catch (retryError) {
              console.error('❌ Échec après retry:', retryError);
              throw retryError;
            }
          } else {
            throw subscribeError;
          }
        }
      }

      this.subscription = subscription;

      // Envoyer l'abonnement au serveur
      await this.sendSubscriptionToServer(subscription);

      console.log('✅ Abonnement aux notifications push réussi');
      return subscription;

    } catch (error) {
      console.error('Erreur lors de l\'abonnement aux notifications:', error);
      throw error;
    }
  }

  /**
   * Se désabonne des notifications
   */
  public async unsubscribe(): Promise<void> {
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe();
        await this.removeSubscriptionFromServer();
        this.subscription = null;
        console.log('Désabonnement des notifications réussi');
      }
    } catch (error) {
      console.error('Erreur lors du désabonnement:', error);
      throw error;
    }
  }

  /**
   * Vérifie si l'utilisateur est abonné
   */
  public async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;

    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Obtient l'abonnement actuel
   */
  public async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;
    return await this.registration.pushManager.getSubscription();
  }

  /**
   * Envoie une notification locale (pour test)
   */
  public async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker non enregistré');
    }

    const notificationOptions: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      data: payload.data,
      requireInteraction: true,
      tag: 'sadtrans-notification'
    };

    // Add actions if supported and provided
    if (payload.actions && 'actions' in Notification.prototype) {
      (notificationOptions as any).actions = payload.actions;
    }

    await this.registration.showNotification(payload.title, notificationOptions);
  }

  /**
   * Associe un utilisateur à l'abonnement
   */
  public async login(userId: string): Promise<void> {
    // Récupérer le vrai user_id depuis la table users
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    this.userId = user?.id || userId;
    console.log('🔐 Push notification login with user_id:', this.userId);

    if (this.subscription) {
      await this.sendSubscriptionToServer(this.subscription);
    }
  }

  /**
   * Dissocie l'utilisateur
   */
  public async logout(): Promise<void> {
    this.userId = null;
    if (this.subscription) {
      await this.removeSubscriptionFromServer();
    }
  }

  /**
   * Envoie l'abonnement au serveur via Supabase Edge Function
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      console.log('📤 Envoi abonnement pour user_id:', this.userId);
      console.log('📦 Endpoint:', subscription.endpoint.substring(0, 50) + '...');

      // Vérifier si l'abonnement existe déjà (utiliser une requête RPC ou filter)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id, user_id')
        .filter('subscription->>endpoint', 'eq', subscriptionData.endpoint)
        .maybeSingle();

      let error;

      if (existing) {
        // Mettre à jour l'abonnement existant
        const result = await supabase
          .from('push_subscriptions')
          .update({
            subscription: subscriptionData,
            last_used: new Date().toISOString()
          })
          .eq('id', existing.id);

        error = result.error;
      } else {
        // Créer un nouvel abonnement
        const result = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: this.userId,
            subscription: subscriptionData,
            browser_info: {
              browserName: navigator.userAgent.includes('Chrome') ? 'Chrome' :
                navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Unknown',
              platform: navigator.platform,
              deviceType: 'desktop',
              timestamp: new Date().toISOString()
            },
            last_used: new Date().toISOString()
          });

        error = result.error;
      }

      if (error) {
        console.error('❌ Erreur lors de l\'enregistrement:', error);
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      console.log('✅ Abonnement push enregistré avec succès');

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi au serveur:', error);
      // Ne pas faire échouer l'abonnement si le serveur n'est pas disponible
    }
  }

  /**
   * Supprime l'abonnement du serveur via Supabase Edge Function
   */
  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      if (!this.subscription || !this.userId) return;

      // Supprimer directement de la base de données
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', this.userId)
        .eq('subscription->endpoint', this.subscription.endpoint);

      if (error) {
        console.warn('Erreur lors de la suppression de l\'abonnement:', error.message);
        return;
      }

      console.log('Abonnement push supprimé avec succès');

    } catch (error) {
      console.error('Erreur lors de la suppression du serveur:', error);
    }
  }

  /**
   * Convertit une clé VAPID base64 en Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convertit un ArrayBuffer en base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Diagnostic du Service Worker (pour debug)
   */
  public async diagnose(): Promise<void> {
    console.log('🔍 === DIAGNOSTIC SERVICE WORKER ===');
    console.log('');

    console.log('📋 Support:');
    console.log('  - Service Worker:', 'serviceWorker' in navigator ? '✅' : '❌');
    console.log('  - Push Manager:', 'PushManager' in window ? '✅' : '❌');
    console.log('  - Notifications:', 'Notification' in window ? '✅' : '❌');
    console.log('');

    console.log('🌐 Environnement:');
    console.log('  - Protocol:', window.location.protocol);
    console.log('  - Host:', window.location.host);
    console.log('  - En ligne:', navigator.onLine ? '✅' : '❌');
    console.log('');

    if ('serviceWorker' in navigator) {
      console.log('🎮 État du Service Worker:');
      console.log('  - Controller:', navigator.serviceWorker.controller ? '✅ Actif' : '❌ Null');

      if (this.registration) {
        console.log('  - Registration:', '✅ Présent');
        console.log('  - Installing:', this.registration.installing ? '⏳ Oui' : '✅ Non');
        console.log('  - Waiting:', this.registration.waiting ? '⏳ Oui' : '✅ Non');
        console.log('  - Active:', this.registration.active ? '✅ Oui' : '❌ Non');

        if (this.registration.active) {
          console.log('  - State:', this.registration.active.state);
        }
      } else {
        console.log('  - Registration:', '❌ Absent');
      }
      console.log('');

      console.log('🔔 Notifications:');
      console.log('  - Permission:', Notification.permission);

      if (this.registration) {
        const subscription = await this.registration.pushManager.getSubscription();
        console.log('  - Subscription:', subscription ? '✅ Actif' : '❌ Absent');

        if (subscription) {
          console.log('  - Endpoint:', subscription.endpoint.substring(0, 50) + '...');
        }
      }
      console.log('');

      console.log('👤 Utilisateur:');
      console.log('  - User ID:', this.userId || '❌ Non défini');
    }

    console.log('');
    console.log('💡 Actions disponibles:');
    console.log('  - Tester notification: await pushService.showLocalNotification({title: "Test", body: "Message"})');
    console.log('  - Forcer activation: navigator.serviceWorker.controller?.postMessage({type: "SKIP_WAITING"})');
    console.log('  - Recharger page: window.location.reload()');
    console.log('');
  }


}