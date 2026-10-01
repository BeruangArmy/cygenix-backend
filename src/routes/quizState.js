const express = require('express');
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { checkAndAwardBadges, bumpStreak } = require('../badges');
const { notify } = require('../notifications');
const { levelForXp } = require('../xpCurve');

const router = express.Router();

const LEVELS = ['easy', 'medium', 'hard'];

// Per-user, per-module quiz progression. Every module's quizQuestions now
// require a `level` field (easy/medium/hard, 5 each) and are taken in that
// fixed order. Missing even 1 question in a level gates advancement: the
// user must re-answer only the missed questions (options reshuffled) until
// all are correct, at half XP, before moving on. After
// clearing Hard, the module is "completed"; retrying it afterward re-runs
// the same leveled flow at half XP throughout, and completing *that* retry
// locks further retries for 7 days (the clock resets on each retry
// completion, not on the original completion — the very first retry is
// always available immediately after finishing).
async function getOrCreateState(uid, moduleId) {
  const ref = db.collection('users').doc(uid).collection('moduleQuizState').doc(moduleId);
  const snap = await ref.get();
  if (snap.exists) return { ref, data: snap.data() };
  const initial = {
    phase: 'in_progress',
    currentLevel: 'easy',
    missedQuestionIds: [],
    isModuleRetryPass: false,
    hadAnyMiss: false,
    completedAt: null,
    lockedUntil: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(initial);
  return { ref, data: initial };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /modules/:moduleId/quiz-state
router.get('/modules/:moduleId/quiz-state', verifyToken, async (req, res) => {
  try {
    const moduleId = req.params.moduleId;
    const { data: state } = await getOrCreateState(req.user.uid, moduleId);

    if (state.phase === 'completed') {
      const now = Date.now();
      const lockedUntilMs = state.lockedUntil ? state.lockedUntil.toMillis() : null;
      return res.json({
        phase: 'completed',
        completedAt: state.completedAt ? state.completedAt.toMillis() : null,
        lockedUntil: lockedUntilMs,
        canRetryNow: lockedUntilMs == null || now >= lockedUntilMs,
      });
    }

    const isRetry = (state.missedQuestionIds || []).length > 0;
    const questionsRef = db.collection('modules').doc(moduleId).collection('quizQuestions');
    const snap = isRetry
      ? await questionsRef.where(admin.firestore.FieldPath.documentId(), 'in', state.missedQuestionIds).get()
      : await questionsRef.where('level', '==', state.currentLevel).get();

    // Sorted here rather than with orderBy() so the admin-set order applies
    // without needing a level+sequenceOrder composite index. Questions authored
    // before sequenceOrder existed default to 0 and keep their relative order.
    const questions = snap.docs
      .slice()
      .sort((a, b) => ((a.data().sequenceOrder || 0) - (b.data().sequenceOrder || 0)))
      .map((d) => {
        const q = d.data();
        return {
          id: d.id,
          questionText: q.questionText,
          // Shuffled on every serve, not only on a retry round.
          //
          // Questions are served in the admin's sequenceOrder, which is
          // deliberate and stays. But the options were handed back in their
          // stored order every single time, so repeating a level — after a
          // fail, or through the module retry that replays Easy/Medium/Hard
          // — served the same five questions with the correct answer in the
          // same position each time. The second run could be cleared by
          // remembering "it was C" without reading a word, which is what
          // "the quiz is too easy" actually describes.
          //
          // Safe because grading never uses the index: /check and /submit
          // both compare selectedText against the correct option's text, so
          // order is presentation only.
          options: shuffle(q.options || []),
          xpValue: q.xpValue || 0,
        };
      });

    res.json({
      phase: 'in_progress',
      currentLevel: state.currentLevel,
      isRetry,
      isModuleRetryPass: !!state.isModuleRetryPass,
      levelsOrder: LEVELS,
      questions,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load quiz state.', detail: err.message });
  }
});

// POST /modules/:moduleId/quiz-state/check  { questionId, selectedText }
// Grades a single question immediately, purely for interactive per-question
// feedback (green/red flash + sound) as the user answers — it does not
// write anything or affect the level outcome. The real XP/streak/attempt
// record is still decided once by .../submit after all questions in the
// level (or retry round) have been answered, exactly as before. Only a
// question that's actually part of the user's current level/retry round
// can be checked, so this can't be used to probe the answer key early.
router.post('/modules/:moduleId/quiz-state/check', verifyToken, async (req, res) => {
  const { questionId, selectedText } = req.body || {};
  if (!questionId || typeof selectedText !== 'string') {
    return res.status(400).json({ error: 'Body must include questionId and selectedText.' });
  }
  try {
    const moduleId = req.params.moduleId;
    const { data: state } = await getOrCreateState(req.user.uid, moduleId);
    const isRetry = (state.missedQuestionIds || []).length > 0;
    if (isRetry && !(state.missedQuestionIds || []).includes(questionId)) {
      return res.status(403).json({ error: 'That question is not part of your current round.' });
    }

    const qDoc = await db.collection('modules').doc(moduleId).collection('quizQuestions').doc(questionId).get();
    if (!qDoc.exists) return res.status(404).json({ error: 'Question not found.' });
    const q = qDoc.data();
    if (!isRetry && q.level !== state.currentLevel) {
      return res.status(403).json({ error: 'That question is not part of your current level.' });
    }

    const correctText = (q.options || [])[q.correctOption];
    // feedback is the admin-authored "why" for this question. It only goes out
    // once the answer has been checked, so it still can't be used to probe the
    // key early — and it's what the answer sheet shows after each question.
    res.json({ correct: selectedText === correctText, correctText, feedback: q.feedback || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check answer.', detail: err.message });
  }
});

// POST /modules/:moduleId/quiz-state/submit  { answers: { questionId: selectedOptionText } }
// Grading is by option TEXT, not index — retry rounds reshuffle option
// order, so the client can't rely on a stable index.
router.post('/modules/:moduleId/quiz-state/submit', verifyToken, async (req, res) => {
  const { answers } = req.body || {};
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Body must include an "answers" object of {questionId: selectedOptionText}.' });
  }

  try {
    const moduleId = req.params.moduleId;
    const { ref: stateRef, data: state } = await getOrCreateState(req.user.uid, moduleId);
    if (state.phase === 'completed') {
      return res.status(400).json({ error: 'This module is already completed. Call retry-module to start a new pass.' });
    }

    const isRetry = (state.missedQuestionIds || []).length > 0;
    const questionsRef = db.collection('modules').doc(moduleId).collection('quizQuestions');
    const questionsSnap = isRetry
      ? await questionsRef.where(admin.firestore.FieldPath.documentId(), 'in', state.missedQuestionIds).get()
      : await questionsRef.where('level', '==', state.currentLevel).get();
    if (questionsSnap.empty) return res.status(404).json({ error: 'No questions found for this level.' });

    // Retry-round answers are always worth half XP. A first-attempt answer
    // is also worth half XP if this whole pass is a post-completion module
    // retry (isModuleRetryPass) — the two discounts don't stack.
    const xpRatio = isRetry || state.isModuleRetryPass ? 0.5 : 1;

    let xpEarned = 0;
    const wrongIds = [];
    const feedback = questionsSnap.docs.map((d) => {
      const q = d.data();
      const correctText = (q.options || [])[q.correctOption];
      const selectedText = answers[d.id];
      const correct = selectedText != null && selectedText === correctText;
      if (correct) xpEarned += Math.round((q.xpValue || 0) * xpRatio);
      else wrongIds.push(d.id);
      return { questionId: d.id, correct, correctOption: correctText, feedback: q.feedback || '' };
    });

    const userRef = db.collection('users').doc(req.user.uid);
    // Carried out of the transaction so the response can state the resulting
    // total rather than only the delta. The client has a live listener on
    // this same user document, so a delta it has to add is a race it loses:
    // the listener pushes the already-updated total, the response then adds
    // the award a second time, and the player sees inflated XP and a level
    // they have not reached until the next push corrects it.
    let xpTotalAfter = 0;
    let playerLevelAfter = 0;
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = userSnap.data() || {};
      const newXp = (current.xpTotal || 0) + xpEarned;
      const newLevel = levelForXp(newXp);
      xpTotalAfter = newXp;
      playerLevelAfter = newLevel;
      tx.set(userRef, { xpTotal: newXp, level: newLevel }, { merge: true });
      tx.set(userRef.collection('xpLog').doc(), {
        sourceType: 'quiz',
        sourceId: `${moduleId}:${state.currentLevel}`,
        xpChange: xpEarned,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Table 8 (Quiz_Attempts) — one record per level/retry-round
      // submission, so Admin > Employees > Quiz History has real data.
      tx.set(userRef.collection('quizAttempts').doc(), {
        moduleId,
        level: state.currentLevel,
        isRetry,
        score: questionsSnap.size - wrongIds.length,
        total: questionsSnap.size,
        xpEarned,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Advancement is driven by the module's own passMark (a percentage set in
    // Admin > Content > Modules), so different modules can demand different
    // standards. Scoring at or above it clears the level even with a wrong
    // answer; falling short queues exactly the missed questions for a
    // half-XP retry round, as before.
    //
    // passMark 100 reproduces the previous fixed "every answer correct"
    // behaviour, and is what a module gets if the field was never set.
    const moduleSnap = await db.collection('modules').doc(moduleId).get();
    const passMark = (moduleSnap.data() || {}).passMark ?? 100;
    const scorePct = ((questionsSnap.size - wrongIds.length) / questionsSnap.size) * 100;
    const clearedGate = scorePct >= passMark;
    const hadAnyMiss = (state.hadAnyMiss || false) || wrongIds.length > 0;
    let advanced = false;
    let moduleCompleted = false;
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), hadAnyMiss };

    if (clearedGate) {
      update.missedQuestionIds = [];
      const levelIdx = LEVELS.indexOf(state.currentLevel);
      if (levelIdx < LEVELS.length - 1) {
        update.currentLevel = LEVELS[levelIdx + 1];
        advanced = true;
      } else {
        update.phase = 'completed';
        // Sticky: phase is rewound by the optional retry, this is not.
        // See quizLevels.js levelsCleared().
        update.completedOnce = true;
        update.completedAt = admin.firestore.FieldValue.serverTimestamp();
        if (state.isModuleRetryPass) {
          update.lockedUntil = new Date(Date.now() + 7 * 86400000);
        }
        moduleCompleted = true;
      }
    } else {
      update.missedQuestionIds = wrongIds;
    }

    await stateRef.set(update, { merge: true });

    const newStreak = await bumpStreak(req.user.uid);
    const badgesAwarded = await checkAndAwardBadges(req.user.uid, {
      perfectScoreJustAchieved: moduleCompleted && !hadAnyMiss,
      moduleCompletedId: moduleCompleted ? moduleId : null,
    });

    if (xpEarned > 0) {
      const levelLabel = state.currentLevel.charAt(0).toUpperCase() + state.currentLevel.slice(1);
      await notify(req.user.uid, {
        type: 'xp_gained',
        title: `+${xpEarned} XP`,
        body: moduleCompleted
          ? `You earned ${xpEarned} XP completing the ${levelLabel} level and finished the module!`
          : `You earned ${xpEarned} XP in the ${levelLabel} level.`,
        meta: { moduleId, xpEarned, level: state.currentLevel },
      });
    }

    res.json({
      xpEarned,
      // Authoritative, post-award. "newLevel" below is the quiz difficulty,
      // not the player level — hence the distinct name.
      xpTotal: xpTotalAfter,
      playerLevel: playerLevelAfter,
      wrongCount: wrongIds.length,
      advanced,
      moduleCompleted,
      newLevel: update.currentLevel || state.currentLevel,
      missedCount: (update.missedQuestionIds || []).length,
      streakDays: newStreak,
      badgesAwarded,
      feedback,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grade quiz level.', detail: err.message });
  }
});

// POST /modules/:moduleId/quiz-state/retry-module
router.post('/modules/:moduleId/quiz-state/retry-module', verifyToken, async (req, res) => {
  try {
    const moduleId = req.params.moduleId;
    const { ref: stateRef, data: state } = await getOrCreateState(req.user.uid, moduleId);
    if (state.phase !== 'completed') {
      return res.status(400).json({ error: 'Module is not completed yet — nothing to retry.' });
    }
    const now = Date.now();
    const lockedUntilMs = state.lockedUntil ? state.lockedUntil.toMillis() : null;
    if (lockedUntilMs != null && now < lockedUntilMs) {
      return res.status(403).json({ error: 'Module is locked for retry.', lockedUntil: lockedUntilMs });
    }
    await stateRef.set({
      phase: 'in_progress',
      currentLevel: 'easy',
      missedQuestionIds: [],
      isModuleRetryPass: true,
      hadAnyMiss: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start module retry.', detail: err.message });
  }
});

module.exports = router;
