const express = require('express');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { levelsCleared } = require('../quizLevels');

const router = express.Router();

// GET /modules — list modules with this user's per-module lesson progress
// (Data Dictionary Table 5) and quiz-level progress (moduleQuizState).
router.get('/modules', verifyToken, async (req, res) => {
  try {
    const [progressSnap, quizStateSnap] = await Promise.all([
      db.collection('users').doc(req.user.uid).collection('lessonProgress').get(),
      db.collection('users').doc(req.user.uid).collection('moduleQuizState').get(),
    ]);
    const completedByModule = {};
    progressSnap.docs.forEach((d) => {
      const { moduleId } = d.data();
      completedByModule[moduleId] = (completedByModule[moduleId] || 0) + 1;
    });
    const quizLevelsByModule = {};
    quizStateSnap.docs.forEach((d) => {
      quizLevelsByModule[d.id] = levelsCleared(d.data());
    });

    const snap = await db.collection('modules').orderBy('order').get();
    const modules = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        lessonsCount: data.totalLessons || 0,
        completedCount: completedByModule[doc.id] || 0,
        quizLevelsCleared: quizLevelsByModule[doc.id] || 0,
      };
    });

    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load modules.', detail: err.message });
  }
});

// GET /modules/:id/lessons
router.get('/modules/:id/lessons', verifyToken, async (req, res) => {
  try {
    const moduleId = req.params.id;
    const progressSnap = await db.collection('users').doc(req.user.uid).collection('lessonProgress')
      .where('moduleId', '==', moduleId).get();
    const completedLessonIds = new Set(progressSnap.docs.map((d) => d.data().lessonId));

    const snap = await db.collection('modules').doc(moduleId).collection('lessons').orderBy('sequenceOrder').get();
    const lessons = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      completed: completedLessonIds.has(d.id),
    }));
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load lessons.', detail: err.message });
  }
});

module.exports = router;
