const webpush = require('web-push');

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webpush.setVapidDetails(
  'mailto:sadibou@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const subscription = JSON.parse(process.argv[2]);
const payload = process.argv[3];

webpush.sendNotification(subscription, payload)
  .then(() => console.log('Push notification sent successfully.'))
  .catch(err => console.error('Error sending push notification:', err));