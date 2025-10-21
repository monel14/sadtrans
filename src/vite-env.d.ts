/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY: string;
  
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

 

 
declare global {
  interface Window {
    // Types pour les notifications push natives
    PushManager: any;
    Notification: any;
  }
}

export {};