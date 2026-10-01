const { db } = require('./firebaseAdmin');
const { QUIZ_LEVELS, levelsCleared, highestLevelCleared } = require('./quizLevels');

const RANK_WINDOWS = { weekly: 7, monthly: 30 };

// Precomputes rank-by-uid maps for all three leaderboard windows in one
// pass over the data, uncapped (unlike GET /leaderboard, which stops at
// 50) so every employee gets an accurate rank on their report — not just
// "unranked" once they fall outside the top 50. Shared across a bulk
// report run so it's computed once, not once per employee.
async function computeAllRankMaps() {
  const allUsersSnap = await db.collection('users').orderBy('xpTotal', 'desc').get();
  const alltimeRankByUid = {};
  allUsersSnap.docs.forEach((d, i) => { alltimeRankByUid[d.id] = i + 1; });

  const windowRankMaps = {};
  for (const [window, days] of Object.entries(RANK_WINDOWS)) {
    const cutoff = new Date(Date.now() - days * 86400000);
    const logSnap = await db.collectionGroup('xpLog').where('createdAt', '>=', cutoff).get();
    const xpByUser = {};
    logSnap.docs.forEach((d) => {
      const uid = d.ref.parent.parent.id;
      xpByUser[uid] = (xpByUser[uid] || 0) + (d.data().xpChange || 0);
    });
    const ranked = Object.entries(xpByUser).map(([id, xp]) => ({ id, xp })).sort((a, b) => b.xp - a.xp);
    const rankByUid = {};
    ranked.forEach((r, i) => { rankByUid[r.id] = i + 1; });
    windowRankMaps[window] = rankByUid;
  }
  return { alltimeRankByUid, windowRankMaps };
}

function ranksFor(uid, rankMaps) {
  return {
    alltime: rankMaps.alltimeRankByUid[uid] || null,
    weekly: rankMaps.windowRankMaps.weekly[uid] || null,
    monthly: rankMaps.windowRankMaps.monthly[uid] || null,
  };
}

// Gathers everything an employee KPI report needs: level/XP, badges,
// per-module quiz-level progress, overall quiz accuracy, streak, and
// leaderboard rank on all three windows. `rankMaps`/`modulesSnap` can be
// passed in (precomputed once) when building a bulk report so they aren't
// refetched per employee.
async function buildEmployeeReportData(uid, { rankMaps, modulesSnap } = {}) {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return null;
  const user = userSnap.data();

  const [badgesSnap, quizStateSnap, quizAttemptsSnap, resolvedModulesSnap, resolvedRankMaps] = await Promise.all([
    db.collection('users').doc(uid).collection('badges').get(),
    db.collection('users').doc(uid).collection('moduleQuizState').get(),
    db.collection('users').doc(uid).collection('quizAttempts').get(),
    modulesSnap ? Promise.resolve(modulesSnap) : db.collection('modules').orderBy('order').get(),
    rankMaps ? Promise.resolve(rankMaps) : computeAllRankMaps(),
  ]);

  const quizStateByModule = {};
  quizStateSnap.docs.forEach((d) => { quizStateByModule[d.id] = d.data(); });

  const modules = resolvedModulesSnap.docs.map((d) => {
    const state = quizStateByModule[d.id];
    return {
      id: d.id,
      title: d.data().title || '(untitled)',
      levelsCleared: levelsCleared(state),
      highestLevel: highestLevelCleared(state),
      // Via levelsCleared, not phase. Taking the optional module retry rewinds
      // phase to 'in_progress', so reading it directly reported a finished
      // module as unfinished for as long as the retry was open — the same bug
      // that was dropping modules out of the employee's secured count.
      completed: levelsCleared(state) >= QUIZ_LEVELS.length,
    };
  });

  // Accuracy counts first serves only — a retry round is practice, not
  // assessment. Counting it meant the app's own "Retry Missed" button lowered
  // the score it was offered to improve, and one stubborn question was
  // counted against the user every time it came back round.
  //
  // It also makes the figure stable: a first serve is always the level's five
  // questions, so pooling (sum/sum) and averaging per attempt give the same
  // answer. Retry rounds serve 1-4 questions, and it was that uneven size
  // that had the app showing 62% here and 67% in the client for one account.
  let correctTotal = 0;
  let questionsTotal = 0;
  let attemptsCounted = 0;
  quizAttemptsSnap.docs.forEach((d) => {
    const a = d.data();
    if (a.isRetry) return;
    attemptsCounted += 1;
    correctTotal += a.score || 0;
    questionsTotal += a.total || 0;
  });

  return {
    uid,
    fullName: user.fullName || 'Unknown',
    email: user.email || '',
    employeeId: user.employeeId || '',
    departmentName: user.departmentName || '',
    level: user.level || 1,
    xpTotal: user.xpTotal || 0,
    streakDays: user.streakDays || 0,
    highestStreak: user.highestStreak || 0,
    // Stored as a plain 'YYYY-MM-DD' string and as a Timestamp respectively;
    // handed over as Date objects so a spreadsheet can treat them as dates
    // rather than text that happens to look like one.
    lastActiveAt: user.lastActivityDate ? new Date(`${user.lastActivityDate}T00:00:00Z`) : null,
    joinedAt: user.createdAt && user.createdAt.toDate ? user.createdAt.toDate() : null,
    badges: badgesSnap.docs.map((d) => ({ id: d.id, badgeName: d.data().badgeName || d.id })),
    modules,
    accuracy: {
      correct: correctTotal,
      total: questionsTotal,
      pct: questionsTotal > 0 ? (correctTotal / questionsTotal) * 100 : null,
      // Every submission, retries included — this one is "how much work has
      // this person done", which is a different question from how accurate
      // they are, and the retries are real work.
      attemptCount: quizAttemptsSnap.size,
      gradedAttemptCount: attemptsCounted,
    },
    ranks: ranksFor(uid, resolvedRankMaps),
  };
}

module.exports = { buildEmployeeReportData, computeAllRankMaps };
