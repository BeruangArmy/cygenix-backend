const { db, admin } = require('./firebaseAdmin');

// Writes one notification doc to users/{uid}/notifications. Always
// backend-side (see firestore.rules — clients can't create these, only
// flip `read`). type is one of: badge_earned, xp_gained, module_unlocked,
// daily_rank.
async function notify(uid, { type, title, body, meta = {} }) {
  await db.collection('users').doc(uid).collection('notifications').add({
    type,
    title,
    body,
    meta,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = { notify };
