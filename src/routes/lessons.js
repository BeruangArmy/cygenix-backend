const express = require('express');
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const LESSON_COMPLETE_XP = 5;

// POST /lessons/:id/complete  { moduleId }
// Writes a Lesson_Progress record (Data Dictionary Table 5) at
// users/{uid}/lessonProgress, awards a small XP amount, and logs it to
// xpLog (Table 13, source_type "lesson"). Idempotent: completing the same
// lesson twice does not double-award XP.
router.post('/lessons/:id/complete', verifyToken, async (req, res) => {
  const { moduleId } = req.body || {};
  const lessonId = req.params.id;
  if (!moduleId) return res.status(400).json({ error: 'moduleId is required in the request body.' });

  try {
    const lessonRef = db.collection('modules').doc(moduleId).collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) return res.status(404).json({ error: 'Lesson not found.' });

    const progressRef = db.collection('users').doc(req.user.uid).collection('lessonProgress').doc(`${moduleId}_${lessonId}`);
    const existing = await progressRef.get();
    if (existing.exists) {
      return res.json({ ok: true, alreadyCompleted: true, lessonId, moduleId, xpEarned: 0 });
    }

    const userRef = db.collection('users').doc(req.user.uid);
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = userSnap.data() || {};
      const newXp = (current.xpTotal || 0) + LESSON_COMPLETE_XP;
      const newLevel = 1 + Math.floor(newXp / 500);
      tx.set(progressRef, {
        moduleId,
        lessonId,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(userRef, { xpTotal: newXp, level: newLevel }, { merge: true });
      tx.set(userRef.collection('xpLog').doc(), {
        sourceType: 'lesson',
        sourceId: lessonId,
        xpChange: LESSON_COMPLETE_XP,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ ok: true, alreadyCompleted: false, lessonId, moduleId, xpEarned: LESSON_COMPLETE_XP });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark lesson complete.', detail: err.message });
  }
});

module.exports = router;
