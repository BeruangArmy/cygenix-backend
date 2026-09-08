const express = require('express');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

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
      db.collection('users').doc(userId).collection('quizAttempts').orderBy('submittedAt', 'desc').get(),
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
      quizAttempts: attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      challengeAttempts: challengeAttemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      badges: badgesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load progress.', detail: err.message });
  }
});

module.exports = router;
