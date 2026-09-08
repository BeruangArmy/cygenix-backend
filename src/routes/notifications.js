const express = require('express');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { notify } = require('../notifications');

const router = express.Router();

function utcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

// POST /notifications/daily-rank
// Idempotent per UTC calendar day: if today's daily_rank notification
// already exists for this user, does nothing. Otherwise computes their
// rank from XP earned since UTC midnight today (same collectionGroup
// xpLog aggregation as the weekly/monthly leaderboard) and creates one.
// Meant to be called once per app session/login — see AppState.restoreSession/login.
router.post('/notifications/daily-rank', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const todayKey = utcDateKey(new Date());

    const existing = await db.collection('users').doc(uid).collection('notifications')
      .where('type', '==', 'daily_rank')
      .where('meta.dateKey', '==', todayKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.json({ created: false });
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const logSnap = await db.collectionGroup('xpLog').where('createdAt', '>=', todayStart).get();

    const xpByUser = {};
    logSnap.docs.forEach((d) => {
      const u = d.ref.parent.parent.id;
      xpByUser[u] = (xpByUser[u] || 0) + (d.data().xpChange || 0);
    });

    const myXpToday = xpByUser[uid] || 0;
    if (myXpToday <= 0) {
      // Nothing earned today — no meaningful rank to report yet.
      return res.json({ created: false, reason: 'no_xp_today' });
    }

    const rank = Object.values(xpByUser).filter((xp) => xp > myXpToday).length + 1;

    await notify(uid, {
      type: 'daily_rank',
      title: "Today's rank",
      body: `You're #${rank} on today's leaderboard with ${myXpToday} XP earned so far.`,
      meta: { dateKey: todayKey, rank, xpToday: myXpToday },
    });

    res.json({ created: true, rank, xpToday: myXpToday });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute daily rank.', detail: err.message });
  }
});

module.exports = router;
