const express = require('express');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Newest first, by the same field the query used to order on. Documents with
// no submittedAt (there should be none) sort last rather than disappearing,
// which is what orderBy() would have done to them.
function byNewest(field) {
  return (a, b) => {
    const at = a.data()[field];
    const bt = b.data()[field];
    const an = at && at.toMillis ? at.toMillis() : 0;
    const bn = bt && bt.toMillis ? bt.toMillis() : 0;
    return bn - an;
  };
}


// GET /progress/:userId — self or admin only.
router.get('/progress/:userId', verifyToken, async (req, res) => {
  const { userId } = req.params;
  if (req.user.uid !== userId && req.userDoc.role !== 'admin') {
    return res.status(403).json({ error: 'You can only view your own progress.' });
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });

    const [attemptsSnap, challengeAttemptsSnap, lessonProgressSnap, badgesSnap] = await Promise.all([
      // Sorted in memory, not with orderBy(). The fieldOverride that enables
      // the collection-group queries for quizAttempts.submittedAt replaced
      // this field's automatic single-collection index, so ordering one
      // user's own attempts failed with FAILED_PRECONDITION and took the
      // whole response down with it — this page showed zeros for an account
      // with 43 attempts. firestore.indexes.json now declares the COLLECTION
      // scope too, but one user's attempts are tens of documents, so sorting
      // them here costs nothing and keeps the page working regardless of
      // index state. Same reasoning as quizState.js's question ordering.
      db.collection('users').doc(userId).collection('quizAttempts').get(),
      db.collection('users').doc(userId).collection('challengeAttempts').orderBy('attemptedAt', 'desc').get(),
      db.collection('users').doc(userId).collection('lessonProgress').get(),
      db.collection('users').doc(userId).collection('badges').get(),
    ]);

    const data = userDoc.data();
    res.json({
      userId,
      fullName: data.fullName,
      xpTotal: data.xpTotal || 0,
      level: data.level || 1,
      streakDays: data.streakDays || 0,
      completedLessons: lessonProgressSnap.docs.map((d) => d.data()),
      quizAttempts: attemptsSnap.docs.slice().sort(byNewest('submittedAt')).map((d) => ({ id: d.id, ...d.data() })),
      challengeAttempts: challengeAttemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      badges: badgesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load progress.', detail: err.message });
  }
});

module.exports = router;
