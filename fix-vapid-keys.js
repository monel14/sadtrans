#!/usr/bin/env node

/**
 * Script pour corriger et unifier les clés VAPID dans tout le système
 */

import fs from 'fs';

console.log('🔧 Correction des clés VAPID...');

// Clés VAPID correctes (depuis send-push.js)
const CORRECT_VAPID_KEYS = {
  publicKey: 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo',
  privateKey: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgMeXtcNO_3acuun_vVQLC9tk0HGNV3aXB1iZ1R1crY_ehRANCAAROap01Vh-UF3O9LGVKjzpHilEXeokpst96kPpaZm0TcBgAk51CLm02fAhD7hgI4CCjYdBaqt5RNScaic0daUFq',
  email: 'mailto:sadibou@gmail.com'
};

console.log('📋 Clés VAPID de référence:');
console.log('Public Key:', CORRECT_VAPID_KEYS.publicKey);
console.log('Email:', CORRECT_VAPID_KEYS.email);

// Vérifier les fichiers qui contiennent des clés VAPID
const filesToCheck = [
  'services/push-notification.service.ts',
  'improved-push-notification.service.ts',
  'send-push.js'
];

let corrections = 0;
let errors = 0;

filesToCheck.forEach(file => {
  try {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  Fichier ${file} non trouvé`);
      return;
    }

    console.log(`\n🔍 Vérification de ${file}...`);
    
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Rechercher et corriger les clés VAPID incorrectes
    const incorrectKeys = [
      'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKEmXKxOSrWlFXYnSQTqz_Q4YOYFpn6RYTzHkMiZGf1A-E',
      // Ajouter d'autres clés incorrectes si trouvées
    ];
    
    // Clé VAPID correcte unifiée
    const correctVapidKey = 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo';

    incorrectKeys.forEach(incorrectKey => {
      if (content.includes(incorrectKey)) {
        content = content.replace(incorrectKey, CORRECT_VAPID_KEYS.publicKey);
        modified = true;
        console.log(`   ✅ Clé VAPID corrigée`);
      }
    });

    // Vérifier que la clé correcte est présente
    if (content.includes(CORRECT_VAPID_KEYS.publicKey)) {
      console.log(`   ✅ Clé VAPID correcte trouvée`);
    } else {
      console.log(`   ⚠️  Clé VAPID correcte non trouvée`);
    }

    // Sauvegarder les modifications
    if (modified) {
      fs.writeFileSync(file, content);
      corrections++;
      console.log(`   💾 Fichier ${file} mis à jour`);
    } else {
      console.log(`   ℹ️  Aucune modification nécessaire`);
    }

  } catch (error) {
    console.error(`   ❌ Erreur avec ${file}:`, error.message);
    errors++;
  }
});

// Créer un fichier de configuration centralisé
console.log('\n📄 Création du fichier de configuration VAPID...');

const configContent = `/**
 * Configuration centralisée des clés VAPID
 * Généré automatiquement le ${new Date().toLocaleString()}
 */

export const VAPID_CONFIG = {
  publicKey: '${CORRECT_VAPID_KEYS.publicKey}',
  email: '${CORRECT_VAPID_KEYS.email}',
  
  // Variables d'environnement recommandées
  env: {
    publicKey: 'VAPID_PUBLIC_KEY',
    privateKey: 'VAPID_PRIVATE_KEY',
    email: 'VAPID_EMAIL'
  },
  
  // Instructions pour les variables d'environnement
  instructions: {
    development: 'Créer un fichier .env avec les clés VAPID',
    production: 'Configurer les variables dans Supabase Dashboard > Settings > Environment Variables'
  }
};

// Fonction utilitaire pour valider une clé VAPID publique
export function isValidVapidPublicKey(key: string): boolean {
  try {
    // Une clé VAPID publique doit:
    // 1. Commencer par 'B' (format base64url)
    // 2. Faire exactement 88 caractères
    // 3. Être en base64url valide
    return key.startsWith('B') && 
           key.length === 88 && 
           /^[A-Za-z0-9_-]+$/.test(key);
  } catch {
    return false;
  }
}

// Fonction pour convertir base64url vers Uint8Array
export function vapidKeyToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

console.log('Configuration VAPID centralisée créée');
console.log('Clé publique validée:', isValidVapidPublicKey(VAPID_CONFIG.publicKey));
`;

try {
  fs.writeFileSync('config/vapid-config.ts', configContent);
  console.log('   ✅ Fichier config/vapid-config.ts créé');
  corrections++;
} catch (error) {
  console.error('   ❌ Erreur création config:', error.message);
  errors++;
}

// Résumé
console.log('\n' + '='.repeat(50));
console.log('📊 RÉSUMÉ DE LA CORRECTION VAPID');
console.log('='.repeat(50));
console.log(`✅ Corrections effectuées: ${corrections}`);
console.log(`❌ Erreurs rencontrées: ${errors}`);

if (errors === 0) {
  console.log('\n🎉 Correction VAPID terminée avec succès !');
  console.log('\n📋 Prochaines étapes:');
  console.log('1. Redémarrer l\'application pour appliquer les changements');
  console.log('2. Tester l\'abonnement aux notifications');
  console.log('3. Vérifier que l\'erreur "push service error" est résolue');
  console.log('4. Utiliser config/vapid-config.ts pour centraliser la configuration');
} else {
  console.log('\n⚠️  Correction terminée avec des erreurs');
  console.log('Vérifiez les messages ci-dessus pour plus de détails');
}

console.log('\n🔗 Ressources:');
console.log('- Configuration centralisée: config/vapid-config.ts');
console.log('- Documentation VAPID: https://web.dev/push-notifications-web-push-protocol/');
console.log('- Test des clés: https://web-push-codelab.glitch.me/');