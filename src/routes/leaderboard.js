const express = require('express');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const WINDOWS = { weekly: 7, monthly: 30 };

function utcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

// Attaches rankDelta (previousRank - currentRank; positive = moved up,
// negative = moved down, null = no prior snapshot yet) to each row, then —
// once per UTC calendar day, per window — rolls the "previous" snapshot
// forward to today's ranking. Idempotent per day like the existing
// daily-rank notification (see notifications.js): the first /leaderboard
// call of the day locks in the comparison point, so a user's up/down arrow
// stays stable across repeat calls that same day instead of drifting to
// zero on every request.
async function applyRankDeltas(window, rows) {
  const snapRef = db.collection('leaderboardSnapshots').doc(window);
  const snap = await snapRef.get();
  const todayKey = utcDateKey(new Date());
  const data = snap.exists ? snap.data() : null;
  const previousRanks = (data && data.ranks) || {};

  rows.forEach((row) => {
    const prevRank = previousRanks[row.id];
    row.rankDelta = prevRank != null ? prevRank - row.rank : null;
  });

  if (!data || data.dateKey !== todayKey) {
    const newRanks = {};
    rows.forEach((row) => { newRanks[row.id] = row.rank; });
    await snapRef.set({ dateKey: todayKey, ranks: newRanks });
  }
  return rows;
}

// GET /leaderboard?window=alltime|weekly|monthly
// alltime ranks by the running xpTotal on each user doc (Table 2).
// weekly/monthly rank by summing xpLog.xpChange (Table 13) within the
// window, via a collectionGroup query — needs the xpLog/createdAt
// collection-group index declared in firestore.indexes.json.

// Accuracy from the running first-serve tallies on the user document, so a
// board of 50 people costs 50 fields rather than 50 subcollection queries.
// null until someone has actually sat a first serve — a board row showing 0%
// for a new joiner reads as "scored nothing", which is not what it means.
function accuracyPctOf(data) {
  const total = data.firstServeTotal || 0;
  if (total <= 0) return null;
  return Math.round(((data.firstServeCorrect || 0) / total) * 1000) / 10;
}

router.get('/leaderboard', verifyToken, async (req, res) => {
  const window = (req.query.window || 'alltime').toString();

  try {
    if (window === 'alltime') {
      const snap = await db.collection('users').orderBy('xpTotal', 'desc').limit(50).get();
      const rows = snap.docs.map((d, i) => {
        const data = d.data();
        return {
          rank: i + 1,
          id: d.id,
          name: data.nickname || data.fullName || 'Unknown',
          xp: data.xpTotal || 0,
          level: data.level || 1,
          accuracyPct: accuracyPctOf(data),
          avatarId: data.avatarId || 'assets/mascot_neutral.png',
          me: d.id === req.user.uid,
        };
      });
      return res.json(await applyRankDeltas(window, rows));
    }

    const days = WINDOWS[window];
    if (!days) return res.status(400).json({ error: 'window must be one of: alltime, weekly, monthly.' });

    const cutoff = new Date(Date.now() - days * 86400000);
    const logSnap = await db.collectionGroup('xpLog').where('createdAt', '>=', cutoff).get();

    const xpByUser = {};
    logSnap.docs.forEach((d) => {
      const uid = d.ref.parent.parent.id;
      xpByUser[uid] = (xpByUser[uid] || 0) + (d.data().xpChange || 0);
    });

    const ranked = Object.entries(xpByUser)
      .map(([id, xp]) => ({ id, xp }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);

    const userDocs = await Promise.all(ranked.map((r) => db.collection('users').doc(r.id).get()));
    const rows = ranked.map((r, i) => {
      const data = userDocs[i].data() || {};
      return {
        rank: i + 1,
        id: r.id,
        name: data.nickname || data.fullName || 'Unknown',
        xp: r.xp,
        level: data.level || 1,
        accuracyPct: accuracyPctOf(data),
        avatarId: data.avatarId || 'assets/mascot_neutral.png',
        me: r.id === req.user.uid,
      };
    });

    res.json(await applyRankDeltas(window, rows));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard.', detail: err.message });
  }
});

module.exports = router;
