// Firebase Cloud Messaging, used for one thing: telling someone their account
// was decided while the app is closed.
//
// Everything else in this app notifies in-app, because the user is holding the
// phone when it happens — a badge, a level, a rank. An approval is the one
// event that lands while nobody is looking, which is what a push is for.
//
// Best-effort by design. A missing or stale token must never fail the decision
// that triggered it: the account is already approved in Firestore, and the
// in-app notification is the durable record. Every failure here is logged and
// swallowed.
const { db, admin } = require('./firebaseAdmin');

/**
 * Sends one push to a user's registered device, if it has one.
 * Returns true if a message was accepted by FCM.
 */
async function sendPush(uid, { title, body, data = {} }) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const token = snap.exists ? snap.data().fcmToken : null;
    if (!token) return false;

    await admin.messaging().send({
      token,
      notification: { title, body },
      // Values must be strings; FCM rejects the message otherwise.
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: 'high',
        notification: {
          // Matches the channel the Flutter app creates. Without a channel
          // that already exists, Android 8+ silently drops the notification.
          channelId: 'cygenix_account',
          // The app's mint accent, so the status-bar icon is tinted like the
          // rest of the product rather than system grey.
          color: '#2BFFB5',
        },
      },
    });
    return true;
  } catch (e) {
    // A token goes stale when the app is reinstalled or data is cleared.
    // Drop it so the next decision does not retry a dead address.
    const dead = e.code === 'messaging/registration-token-not-registered'
      || e.code === 'messaging/invalid-registration-token'
      || e.code === 'messaging/invalid-argument';
    if (dead) {
      try {
        await db.collection('users').doc(uid).set(
          { fcmToken: admin.firestore.FieldValue.delete() }, { merge: true });
      } catch (_) { /* not worth a second failure */ }
    }
    console.warn(`sendPush to ${uid} failed:`, e.message);
    return false;
  }
}

module.exports = { sendPush };
