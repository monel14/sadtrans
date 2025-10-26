/**
 * Configuration pour les notifications push directes
 */

export interface PushNotificationConfig {
  vapidPublicKey: string;
  vapidPrivateKey?: string; // Seulement côté serveur
  vapidEmail: string;
  applicationServerKey: string;
}

// Clés VAPID générées pour l'application
export const PUSH_CONFIG: PushNotificationConfig = {
  // Clé publique VAPID (utilisée côté client)
  vapidPublicKey: 'BCK1nQf97ynrMgC-rUoQfKCiBoEiqTzw5urUQXijWk9cSOQEIsyCiwZ2tceqC-f86c6x6KsIeHL2UAeNQGOgnJ8',
  
  // Email de contact pour VAPID
  vapidEmail: 'mailto:admin@sadtrans.com',
  
  // Clé d'application (même que la clé publique pour la compatibilité)
  applicationServerKey: 'BCK1nQf97ynrMgC-rUoQfKCiBoEiqTzw5urUQXijWk9cSOQEIsyCiwZ2tceqC-f86c6x6KsIeHL2UAeNQGOgnJ8'
};

/**
 * Configuration pour différents environnements
 */
export const PUSH_ENVIRONMENT_CONFIG = {
  development: {
    ...PUSH_CONFIG,
    debug: true,
    allowLocalhostAsSecureOrigin: true
  },
  production: {
    ...PUSH_CONFIG,
    debug: false,
    allowLocalhostAsSecureOrigin: false
  }
};

/**
 * Détecte l'environnement actuel
 */
export function getCurrentEnvironment(): 'production' | 'development' {
  if (typeof window === 'undefined') return 'development';
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('ngrok')) {
    return 'development';
  }
  
  return 'production';
}

/**
 * Obtient la configuration pour l'environnement actuel
 */
export function getPushConfig(): PushNotificationConfig & { debug?: boolean; allowLocalhostAsSecureOrigin?: boolean } {
  const env = getCurrentEnvironment();
  return PUSH_ENVIRONMENT_CONFIG[env];
}

/**
 * Vérifie si les notifications push sont supportées
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

/**
 * Vérifie si l'environnement est sécurisé (HTTPS ou localhost)
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  return window.isSecureContext || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}

/**
 * Obtient des suggestions de configuration pour l'environnement actuel
 */
export function getConfigSuggestions(): string[] {
  const suggestions: string[] = [];
  
  if (!isPushNotificationSupported()) {
    suggestions.push('Les notifications push ne sont pas supportées par ce navigateur');
  }
  
  if (!isSecureContext()) {
    suggestions.push('Les notifications push nécessitent HTTPS ou localhost');
  }
  
  const env = getCurrentEnvironment();
  if (env === 'development') {
    suggestions.push('Mode développement détecté - debug activé');
  }
  
  return suggestions;
}