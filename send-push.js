const webpush = require('web-push');

// Clés VAPID par défaut - À remplacer par vos propres clés
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BE5qnTVWH5QXc70sZUqPOkeKURd6iSmy33qQ-lpmbRNwGACTnUIubTZ8CEPuGAjgIKNh0Fqq3lE1JxqJzR1pQWo',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgMeXtcNO_3acuun_vVQLC9tk0HGNV3aXB1iZ1R1crY_ehRANCAAROap01Vh-UF3O9LGVKjzpHilEXeokpst96kPpaZm0TcBgAk51CLm02fAhD7hgI4CCjYdBaqt5RNScaic0daUFq',
};

webpush.setVapidDetails(
  'mailto:sadibou@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Utilisation: node send-push.js '{"endpoint":"...","keys":{"p256dh":"...","auth":"..."}}' '{"title":"Test","body":"Message"}'
const subscription = JSON.parse(process.argv[2]);
const payload = process.argv[3];

console.log('Envoi de notification push...');
console.log('Endpoint:', subscription.endpoint);
console.log('Payload:', payload);

webpush.sendNotification(subscription, payload)
  .then(() => {
    console.log('✅ Notification push envoyée avec succès!');
  })
  .catch(err => {
    console.error('❌ Erreur lors de l\'envoi de la notification push:', err);

    if (err.statusCode) {
      console.error('Code de statut:', err.statusCode);
    }
    if (err.body) {
      console.error('Corps de la réponse:', err.body);
    }
  });