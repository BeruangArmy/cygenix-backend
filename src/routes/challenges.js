const express = require('express');
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { checkAndAwardBadges, bumpStreak } = require('../badges');
const { notify } = require('../notifications');
const { levelForXp } = require('../xpCurve');

const router = express.Router();

function stripAnswer(doc) {
  const { correctOption, ...rest } = doc.data();
  return { id: doc.id, ...rest };
}

// GET /challenges/today - one Scenario Challenge (Table 9).
//
// Picked per user per UTC day: the pick is a hash of (uid, day), so two
// people get different scenarios on the same day and the same person gets a
// different one tomorrow - but it is stable for the whole day, so reopening
// the app (or logging out and back in) cannot reroll a scenario someone does
// not fancy. Challenges already attempted are held back until the user has
// seen the rest of the pool.
//
// correctOption is stripped; grading happens server-side in
// POST /challenges/:challengeId/attempt.
function dailyPick(uid, dayKey, len) {
  let h = 2166136261;
  const s = `${uid}:${dayKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return len ? h % len : 0;
}

router.get('/challenges/today', verifyToken, async (req, res) => {
  try {
    const snap = await db.collectionGroup('scenarioChallenges').get();
    if (snap.empty) return res.status(404).json({ error: 'No scenario challenges have been authored yet.' });

    const uid = req.user.uid;
    const dayKey = new Date().toISOString().slice(0, 10);

    const attemptsSnap = await db.collection('users').doc(uid).collection('challengeAttempts').get();
    const seen = new Set(attemptsSnap.docs.map((d) => d.data().challengeId).filter(Boolean));

    // Prefer what they have not met yet; once the pool is exhausted, allow
    // repeats rather than running out of challenges entirely.
    const fresh = snap.docs.filter((d) => !seen.has(d.id));
    const pool = fresh.length ? fresh : snap.docs;

    const pick = pool[dailyPick(uid, dayKey, pool.length)];
    const moduleId = pick.ref.parent.parent.id;
    res.json({ moduleId, seenAll: fresh.length === 0, ...stripAnswer(pick) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load today s challenge.', detail: err.message });
  }
});

// GET /modules/:moduleId/challenges — all scenario challenges for a module
// (used by Admin preview / future module-scoped UI); answers stripped.
router.get('/modules/:moduleId/challenges', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('modules').doc(req.params.moduleId).collection('scenarioChallenges').orderBy('createdAt').get();
    res.json(snap.docs.map(stripAnswer));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load challenges.', detail: err.message });
  }
});

// POST /challenges/:challengeId/attempt  { moduleId, selectedOption }
// Grades against the stored correctOption, awards xpReward if correct,
// persists a Challenge_Attempts record (Table 10), logs XP_Log
// (source_type "challenge"), bumps the streak, and checks badges.
router.post('/challenges/:challengeId/attempt', verifyToken, async (req, res) => {
  const { moduleId, selectedOption } = req.body || {};
  const challengeId = req.params.challengeId;
  if (!moduleId || typeof selectedOption !== 'number') {
    return res.status(400).json({ error: 'Body must include moduleId and a numeric selectedOption.' });
  }

  try {
    const challengeRef = db.collection('modules').doc(moduleId).collection('scenarioChallenges').doc(challengeId);
    const challengeDoc = await challengeRef.get();
    if (!challengeDoc.exists) return res.status(404).json({ error: 'Scenario challenge not found.' });

    const challenge = challengeDoc.data();
    const isCorrect = selectedOption === challenge.correctOption;
    const xpEarned = isCorrect ? (challenge.xpReward || 0) : 0;

    const userRef = db.collection('users').doc(req.user.uid);
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = userSnap.data() || {};
      const newXp = (current.xpTotal || 0) + xpEarned;
      const newLevel = levelForXp(newXp);
      if (xpEarned > 0) tx.set(userRef, { xpTotal: newXp, level: newLevel }, { merge: true });
      tx.set(userRef.collection('challengeAttempts').doc(), {
        moduleId,
        challengeId,
        selectedOption,
        isCorrect,
        xpEarned,
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (xpEarned > 0) {
        tx.set(userRef.collection('xpLog').doc(), {
          sourceType: 'challenge',
          sourceId: challengeId,
          xpChange: xpEarned,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    const newStreak = await bumpStreak(req.user.uid);
    const badgesAwarded = await checkAndAwardBadges(req.user.uid, {});

    if (xpEarned > 0) {
      await notify(req.user.uid, {
        type: 'xp_gained',
        title: `+${xpEarned} XP`,
        body: `You earned ${xpEarned} XP completing today's Scenario Challenge.`,
        meta: { moduleId, challengeId, xpEarned },
      });
    }

    res.json({ isCorrect, correctOption: challenge.correctOption, xpEarned, streakDays: newStreak, badgesAwarded });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grade challenge attempt.', detail: err.message });
  }
});

module.exports = router;
