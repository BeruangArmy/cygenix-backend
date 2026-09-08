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

// GET /challenges/today — one Scenario Challenge (Table 9), picked
// deterministically per calendar day (UTC) across every published
// module's scenarioChallenges, so everyone sees the same "Today's
// Challenge" and it changes daily. correctOption is stripped; grading
// happens server-side in POST /challenges/:challengeId/attempt.
router.get('/challenges/today', verifyToken, async (req, res) => {
  try {
    const snap = await db.collectionGroup('scenarioChallenges').get();
    if (snap.empty) return res.status(404).json({ error: 'No scenario challenges have been authored yet.' });

    const dayIndex = Math.floor(Date.now() / 86400000); // days since epoch, UTC
    const pick = snap.docs[dayIndex % snap.docs.length];
    const moduleId = pick.ref.parent.parent.id;
    res.json({ moduleId, ...stripAnswer(pick) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load today\'s challenge.', detail: err.message });
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
