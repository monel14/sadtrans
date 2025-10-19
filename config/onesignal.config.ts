/**
 * Configuration OneSignal pour différents environnements
 */

export interface OneSignalEnvironmentConfig {
  appId: string;
  allowedDomains: string[];
  serviceWorkerPath?: string;
  serviceWorkerScope?: string;
  autoRegister?: boolean;
  allowLocalhostAsSecureOrigin?: boolean;
}

export const ONESIGNAL_CONFIG: Record<string, OneSignalEnvironmentConfig> = {
  production: {
    appId: "aa956232-9277-40b3-b0f0-44c2b67f7a7b",
    allowedDomains: [
      "sadtrans.netlify.app",
      "sadtrans.com", // Si vous avez un domaine personnalisé
    ],
    serviceWorkerPath: "OneSignalSDKWorker.js",
    serviceWorkerScope: "/OneSignalSDKWorker/",
    autoRegister: false, // Éviter les conflits avec Workbox
    allowLocalhostAsSecureOrigin: false,
  },
  development: {
    appId: "aa956232-9277-40b3-b0f0-44c2b67f7a7b",
    allowedDomains: [
      "localhost",
      "127.0.0.1",
      "*.ngrok.io",
      "*.ngrok-free.app",
      "*.ngrok.app",
    ],
    serviceWorkerPath: "OneSignalSDKWorker.js",
    serviceWorkerScope: "/OneSignalSDKWorker/",
    autoRegister: false,
    allowLocalhostAsSecureOrigin: true,
  },
};

/**
 * Détecte l'environnement actuel
 */
export function getCurrentEnvironment(): 'production' | 'development' {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname.includes('ngrok')) {
    return 'development';
  }
  
  return 'production';
}

/**
 * Obtient la configuration OneSignal pour l'environnement actuel
 */
export function getOneSignalConfig(): OneSignalEnvironmentConfig {
  const env = getCurrentEnvironment();
  return ONESIGNAL_CONFIG[env];
}

/**
 * Vérifie si le domaine actuel est autorisé
 */
export function isDomainAllowed(): boolean {
  const config = getOneSignalConfig();
  const hostname = window.location.hostname;
  
  return config.allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      // Wildcard domain
      const baseDomain = domain.substring(2);
      return hostname.endsWith(baseDomain);
    }
    return hostname === domain;
  });
}

/**
 * Obtient les suggestions de configuration pour le domaine actuel
 */
export function getDomainSuggestions(): string[] {
  const config = getOneSignalConfig();
  const currentDomain = window.location.origin;
  const suggestions: string[] = [];
  
  if (!isDomainAllowed()) {
    suggestions.push(`Ajoutez ${currentDomain} aux domaines autorisés dans OneSignal`);
    suggestions.push("Vérifiez Settings > Platforms > Web Push dans OneSignal Dashboard");
    
    if (getCurrentEnvironment() === 'development') {
      suggestions.push("Utilisez localhost ou un tunnel ngrok pour le développement");
    } else {
      suggestions.push(`Utilisez un des domaines configurés: ${config.allowedDomains.join(', ')}`);
    }
  }
  
  return suggestions;
}