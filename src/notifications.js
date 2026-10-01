const { db, admin } = require('./firebaseAdmin');

// Writes one notification doc to users/{uid}/notifications. Always
// backend-side (see firestore.rules — clients can't create these, only
// flip `read`). type is one of: badge_earned, xp_gained, module_unlocked,
// daily_rank.
async function notify(uid, { type, title, body, meta = {} }) {
  // The Notifications switch in the app is honoured here, which is the only
  // place notifications are ever created. Until now it set a field nothing
  // read: the toggle moved, the preference was not even persisted, and every
  // notification was written regardless — a control that did nothing.
  //
  // Absent means on, so existing accounts keep their notifications.
  const prefs = await db.collection('users').doc(uid).get();
  if (prefs.exists && prefs.data().notifOn === false) return;

  const col = db.collection('users').doc(uid).collection('notifications');
  await col.add({
    type,
    title,
    body,
    meta,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // Notifications are a daily feed, not an archive: anything from before
  // today goes when the next one is written. Doing it here rather than on a
  // schedule keeps it free — there is no cron on the free tier, and the
  // clean-up only needs to happen when the list actually changes.
  await pruneOldNotifications(uid);
}

/** Deletes notifications created before today (UTC). */
async function pruneOldNotifications(uid) {
  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const stale = await db.collection('users').doc(uid).collection('notifications')
      .where('createdAt', '<', startOfToday)
      .limit(300)
      .get();
    if (stale.empty) return;
    const batch = db.batch();
    stale.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    // Never let housekeeping break the notification that triggered it.
    console.warn('pruneOldNotifications failed:', e.message);
  }
}

module.exports = { notify, pruneOldNotifications };
