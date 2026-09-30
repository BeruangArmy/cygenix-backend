// Turn 5 — "the loop around the lessons" (design panels 5a-5e).
//
//   5a daily drill        one 30-second real-or-fake call, every day
//   5b live report        report a real suspicious message, XP once triaged
//   5c near-miss rematch  questions you got wrong, re-served later
//   5d boss encounter     a branching module boss, one attempt a day
//   5e phish-back         write the bait, scored against a stated rubric
//
// Every XP award lives here rather than on the client: firestore.rules make
// users/{uid} employee-writable only for their own non-role fields, and the
// whole gamification model depends on XP being server-authoritative.
const express = require('express');
const { db, admin } = require('../firebaseAdmin');
const { verifyToken, adminOnly } = require('../middleware/auth');
const { checkAndAwardBadges, bumpStreak } = require('../badges');
const { levelForXp } = require('../xpCurve');

const router = express.Router();

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/** Adds XP and keeps the derived level in step. Returns the new total. */
async function awardXp(uid, amount, reason, meta = {}) {
  if (!amount) return null;
  const userRef = db.collection('users').doc(uid);
  const total = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const cur = snap.data() || {};
    const next = (cur.xpTotal || 0) + amount;
    tx.set(userRef, { xpTotal: next, level: levelForXp(next) }, { merge: true });
    return next;
  });
  await userRef.collection('xpLog').add({
    amount, reason, meta, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return total;
}

// ============================================================ 5a daily drill

/** Deterministic per user per day, so reopening the app cannot reroll it. */
function pickIndex(uid, key, len) {
  let h = 2166136261;
  const s = `${uid}:${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return len ? h % len : 0;
}

/**
 * Today's drill for this user.
 *
 * Random-looking per (user, day) but stable within the day — reopening the
 * app, or logging out and back in, cannot reroll a message someone does not
 * fancy. Items already answered are held back until the pool is exhausted,
 * so the drill works through the set rather than repeating early.
 */
async function drillForToday(uid, key) {
  const poolSnap = await db.collection('drillItems').get();
  const pool = poolSnap.docs.filter((d) => d.data().active !== false);
  if (!pool.length) return null;

  const doneSnap = await db.collection('users').doc(uid).collection('drills').get();
  const seen = new Set(doneSnap.docs.map((d) => d.data().itemId).filter(Boolean));
  const fresh = pool.filter((d) => !seen.has(d.id));
  const from = fresh.length ? fresh : pool;
  return from[pickIndex(uid, key, from.length)];
}

async function weekOf(uid) {
  const out = [];
  const now = new Date();
  // Monday-first strip, matching the design's M T W T F S S.
  const dow = (now.getUTCDay() + 6) % 7;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - dow + i);
    out.push(dayKey(d));
  }
  const snaps = await Promise.all(
    out.map((k) => db.collection('users').doc(uid).collection('drills').doc(k).get()),
  );
  return out.map((k, i) => ({
    date: k,
    done: snaps[i].exists,
    correct: snaps[i].exists ? snaps[i].data().correct === true : null,
    future: k > dayKey(),
  }));
}

router.get('/drill/today', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const key = dayKey();
    const stateSnap = await db.collection('users').doc(uid).collection('drills').doc(key).get();
    const state = stateSnap.exists ? stateSnap.data() : null;

    // Once answered, today's item is pinned to the one that was answered.
    // Re-picking would filter it out as "seen" and hand back a different
    // message, leaving the card and the verdict beneath it describing two
    // different emails.
    let chosen = null;
    if (state && state.itemId) {
      const pinned = await db.collection('drillItems').doc(state.itemId).get();
      if (pinned.exists) chosen = pinned;
    }
    chosen = chosen || (await drillForToday(uid, key));
    if (!chosen) return res.json({ item: null, reason: 'No drill items have been set up yet.' });
    const item = chosen.data();

    const week = await weekOf(uid);
    const answered = week.filter((d) => d.done);
    const correct = answered.filter((d) => d.correct);
    const times = [];
    let weekXp = 0;
    for (const d of week.filter((x) => x.done)) {
      const s = await db.collection('users').doc(uid).collection('drills').doc(d.date).get();
      if (!s.exists) continue;
      if (s.data().tookMs) times.push(s.data().tookMs);
      weekXp += s.data().xp || 0;
    }
    const userSnap = await db.collection('users').doc(uid).get();

    res.json({
      // The verdict and the tell are withheld until the drill is answered.
      item: {
        id: chosen.id,
        sender: item.sender || '',
        senderEmail: item.senderEmail || '',
        subject: item.subject || '',
        body: item.body || '',
      },
      answered: !!state,
      result: state ? { correct: state.correct, choice: state.choice, xp: state.xp, tell: state.tell || '' } : null,
      week,
      stats: {
        answered: answered.length,
        correct: correct.length,
        avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
        xp: weekXp,
      },
      insurance: (userSnap.data() || {}).streakInsurance || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load the daily drill.', detail: err.message });
  }
});

router.post('/drill/answer', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const key = dayKey();
    const { choice, tookMs } = req.body || {};
    if (choice !== 'legit' && choice !== 'phish') {
      return res.status(400).json({ error: 'choice must be "legit" or "phish".' });
    }
    const ref = db.collection('users').doc(uid).collection('drills').doc(key);
    if ((await ref.get()).exists) return res.status(409).json({ error: 'Already answered today.' });

    const chosen = await drillForToday(uid, key);
    if (!chosen) return res.status(404).json({ error: 'No drill items.' });
    const item = chosen.data();

    const correct = (choice === 'phish') === (item.isPhish === true);
    // Full marks inside 30s, still worth something after — the design's rule.
    const inTime = typeof tookMs === 'number' && tookMs <= 30000;
    const xp = correct ? (inTime ? 5 : 2) : 0;

    await ref.set({
      itemId: chosen.id, choice, correct, tookMs: tookMs || null, xp,
      tell: item.tell || '',
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (xp) await awardXp(uid, xp, 'daily_drill', { itemId: chosen.id });
    await bumpStreak(uid);
    const badges = await checkAndAwardBadges(uid, {});

    res.json({ correct, xp, inTime, tell: item.tell || '', isPhish: item.isPhish === true, badgesAwarded: badges });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grade the drill.', detail: err.message });
  }
});

const INSURANCE_COST = 40;
router.post('/drill/insurance', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection('users').doc(uid);
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};
      if ((data.xpTotal || 0) < INSURANCE_COST) return { error: 'Not enough XP.' };
      if ((data.streakInsurance || 0) >= 1) return { error: 'You already hold one.' };
      const next = (data.xpTotal || 0) - INSURANCE_COST;
      tx.set(userRef, { xpTotal: next, level: levelForXp(next), streakInsurance: 1 }, { merge: true });
      return { xpTotal: next, streakInsurance: 1 };
    });
    if (out.error) return res.status(400).json(out);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Purchase failed.', detail: err.message });
  }
});

// ============================================================ 5c rematch
//
// The design's rematch is built on real-attack telemetry ("you hovered the
// link"). This app has no mail gateway, but it does know exactly which quiz
// questions a user got wrong and when — so a rematch here is a question you
// missed, re-served after a cooling-off period, for reduced XP.

const REMATCH_DELAY_DAYS = 2;
const REMATCH_XP = 30;

router.get('/rematch', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const statesSnap = await db.collection('users').doc(uid).collection('moduleQuizState').get();
    const beatenSnap = await db.collection('users').doc(uid).collection('rematches').get();
    const beaten = new Map(beatenSnap.docs.map((d) => [d.id, d.data()]));

    const pending = [];
    for (const st of statesSnap.docs) {
      const data = st.data();
      const missed = data.missedHistory || data.missedQuestionIds || [];
      if (!missed.length) continue;
      const modSnap = await db.collection('modules').doc(st.id).get();
      const modTitle = (modSnap.data() || {}).title || '';
      for (const qid of missed) {
        const already = beaten.get(`${st.id}_${qid}`);
        if (already && already.beaten) continue;
        const qSnap = await db.collection('modules').doc(st.id).collection('quizQuestions').doc(qid).get();
        if (!qSnap.exists) continue;
        const q = qSnap.data();
        const missedAt = (already && already.missedAt) || data.updatedAt || null;
        const dueAt = missedAt && missedAt.toDate
          ? new Date(missedAt.toDate().getTime() + REMATCH_DELAY_DAYS * 864e5)
          : new Date();
        pending.push({
          id: `${st.id}_${qid}`,
          moduleId: st.id,
          moduleTitle: modTitle,
          questionId: qid,
          questionText: q.questionText || q.question || '',
          options: q.options || [],
          // The design shows "the tell you missed" — this is the question's
          // own authored feedback, which is exactly that.
          tell: q.feedback || '',
          dueAt: dueAt.toISOString(),
          ready: dueAt <= new Date(),
          xp: REMATCH_XP,
        });
      }
    }

    const record = {
      beaten: beatenSnap.docs.filter((d) => d.data().beaten).length,
      pending: pending.length,
      repeat: beatenSnap.docs.filter((d) => (d.data().attempts || 0) > 1 && !d.data().beaten).length,
    };
    res.json({ pending, record });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load rematches.', detail: err.message });
  }
});

router.post('/rematch/answer', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { moduleId, questionId, answer } = req.body || {};
    if (!moduleId || !questionId) return res.status(400).json({ error: 'moduleId and questionId are required.' });

    const qSnap = await db.collection('modules').doc(moduleId).collection('quizQuestions').doc(questionId).get();
    if (!qSnap.exists) return res.status(404).json({ error: 'Question not found.' });
    const q = qSnap.data();
    const correctText = (q.options || [])[q.correctOption];
    const correct = answer != null && answer === correctText;

    const ref = db.collection('users').doc(uid).collection('rematches').doc(`${moduleId}_${questionId}`);
    const prev = await ref.get();
    await ref.set({
      moduleId, questionId, beaten: correct,
      attempts: ((prev.exists && prev.data().attempts) || 0) + 1,
      lastAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    let xp = 0;
    if (correct && !(prev.exists && prev.data().beaten)) {
      xp = REMATCH_XP;
      await awardXp(uid, xp, 'rematch', { moduleId, questionId });
    }
    res.json({ correct, xp, correctOption: correctText, tell: q.feedback || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grade the rematch.', detail: err.message });
  }
});

// ============================================================ 5d boss

const BOSS_XP = 250;

router.get('/boss/:moduleId', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { moduleId } = req.params;
    const bossSnap = await db.collection('modules').doc(moduleId).collection('boss').doc('main').get();
    if (!bossSnap.exists) return res.json({ boss: null });
    const boss = bossSnap.data();
    const runRef = db.collection('users').doc(uid).collection('bossRuns').doc(moduleId);
    const run = await runRef.get();
    const data = run.exists ? run.data() : {};
    // A counter on the boss doc rather than a collection-group query: the
    // query form needs a composite index, which would make this feature
    // depend on someone clicking a Firebase console link before it worked.
    const clearedCount = boss.clearedCount || 0;

    res.json({
      boss: {
        name: boss.name || 'Module boss',
        intro: boss.intro || '',
        howItPlays: boss.howItPlays || [],
        turnCount: (boss.turns || []).length,
        rewardXp: BOSS_XP,
      },
      state: {
        attemptedToday: data.lastAttemptDate === dayKey(),
        cleared: data.cleared === true,
        bestTurns: data.bestTurns || 0,
        squadCleared: clearedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load the boss.', detail: err.message });
  }
});

/** Starts a run (returns turn 0) or plays a choice and returns what follows. */
router.post('/boss/:moduleId/play', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { moduleId } = req.params;
    const { turnIndex, choiceIndex, start } = req.body || {};
    const bossSnap = await db.collection('modules').doc(moduleId).collection('boss').doc('main').get();
    if (!bossSnap.exists) return res.status(404).json({ error: 'No boss for this module.' });
    const turns = bossSnap.data().turns || [];
    const runRef = db.collection('users').doc(uid).collection('bossRuns').doc(moduleId);
    const run = await runRef.get();
    const data = run.exists ? run.data() : {};

    if (start) {
      if (data.lastAttemptDate === dayKey() && !data.cleared) {
        return res.status(429).json({ error: 'One attempt a day. Come back tomorrow.' });
      }
      await runRef.set({
        moduleId, lastAttemptDate: dayKey(),
        attempts: (data.attempts || 0) + 1,
      }, { merge: true });
      return res.json({ turn: publicTurn(turns[0], 0), index: 0, total: turns.length });
    }

    const t = turns[turnIndex];
    if (!t) return res.status(400).json({ error: 'Bad turn.' });
    const choice = (t.options || [])[choiceIndex];
    if (!choice) return res.status(400).json({ error: 'Bad choice.' });

    const outcome = choice.outcome || 'advance';
    const survived = turnIndex + (outcome === 'fail' ? 0 : 1);
    const best = Math.max(data.bestTurns || 0, survived);

    if (outcome === 'fail') {
      await runRef.set({ bestTurns: best }, { merge: true });
      return res.json({ outcome: 'fail', reply: choice.reply || '', survived, total: turns.length, xp: 0 });
    }
    // "Hanging up early is a pass" — an explicit safe exit ends the run well.
    // A safe exit ("pass") survives the turn, it does not end the encounter.
    // Previously any pass cleared the boss outright, so taking the correct
    // option on turn 1 finished the whole thing for full XP after a single
    // question. The caller is persistent by design: refuse, and they escalate.
    // Only surviving the last turn clears it.
    const done = turnIndex + 1 >= turns.length;
    if (done) {
      const firstClear = !data.cleared;
      await runRef.set({ cleared: true, bestTurns: Math.max(best, turns.length) }, { merge: true });
      let xp = 0;
      if (firstClear) {
        xp = BOSS_XP;
        await awardXp(uid, xp, 'boss', { moduleId });
        await db.collection('modules').doc(moduleId).collection('boss').doc('main')
          .set({ clearedCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
      }
      const badges = await checkAndAwardBadges(uid, {});
      return res.json({ outcome: 'cleared', reply: choice.reply || '', survived: turns.length, total: turns.length, xp, badgesAwarded: badges });
    }
    await runRef.set({ bestTurns: best }, { merge: true });
    res.json({
      outcome: 'advance', reply: choice.reply || '',
      turn: publicTurn(turns[turnIndex + 1], turnIndex + 1), index: turnIndex + 1, total: turns.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Boss turn failed.', detail: err.message });
  }
});

/** Strips the outcome so the client cannot see which reply is fatal. */
function publicTurn(t, i) {
  if (!t) return null;
  return {
    index: i,
    speaker: t.speaker || '',
    line: t.line || '',
    note: t.note || '',
    options: (t.options || []).map((o) => ({ text: o.text || '' })),
  };
}

// ============================================================ 5b live report

router.get('/reports', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).collection('reports')
      .orderBy('reportedAt', 'desc').limit(30).get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load your reports.', detail: err.message });
  }
});

router.post('/reports', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { sender, subject, note } = req.body || {};
    if (!sender || !subject) return res.status(400).json({ error: 'sender and subject are required.' });

    // "First to flag" is real: the same sender+subject reported by anyone
    // earlier means you were not first.
    const fingerprint = `${sender}`.trim().toLowerCase() + '|' + `${subject}`.trim().toLowerCase();
    const globalRef = db.collection('threatReports').doc(Buffer.from(fingerprint).toString('base64url').slice(0, 200));
    const first = await db.runTransaction(async (tx) => {
      const g = await tx.get(globalRef);
      if (!g.exists) {
        tx.set(globalRef, {
          sender, subject, firstBy: uid, count: 1, verdict: 'pending',
          firstAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      }
      tx.set(globalRef, { count: (g.data().count || 0) + 1 }, { merge: true });
      return g.data().firstBy === uid;
    });

    const doc = await db.collection('users').doc(uid).collection('reports').add({
      sender, subject, note: note || '', fingerprint: globalRef.id,
      wasFirst: first, verdict: 'pending', xp: 0,
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await bumpStreak(uid);
    res.json({ id: doc.id, wasFirst: first, verdict: 'pending' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to file the report.', detail: err.message });
  }
});

/** Admin triage — the XP only lands once a human confirms the verdict. */
router.post('/admin/reports/:uid/:reportId', verifyToken, adminOnly, async (req, res) => {
  try {
    const { uid, reportId } = req.params;
    const { verdict } = req.body || {};
    if (!['malicious', 'safe'].includes(verdict)) {
      return res.status(400).json({ error: 'verdict must be "malicious" or "safe".' });
    }
    const ref = db.collection('users').doc(uid).collection('reports').doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Report not found.' });
    const r = snap.data();
    if (r.verdict !== 'pending') return res.status(409).json({ error: 'Already triaged.' });

    let xp = 0;
    const breakdown = [];
    if (verdict === 'malicious') {
      xp += 40; breakdown.push({ label: 'Correct', xp: 40 });
      if (r.wasFirst) { xp += 60; breakdown.push({ label: 'First to flag', xp: 60 }); }
    }
    await ref.set({ verdict, xp, breakdown, triagedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('threatReports').doc(r.fingerprint).set({ verdict }, { merge: true });
    if (xp) await awardXp(uid, xp, 'live_report', { reportId });
    res.json({ verdict, xp, breakdown });
  } catch (err) {
    res.status(500).json({ error: 'Triage failed.', detail: err.message });
  }
});

router.get('/admin/reports', verifyToken, adminOnly, async (req, res) => {
  try {
    // No where clause: a collection-group query filtered on `verdict` needs
    // a composite index, which would make the queue unusable until someone
    // clicked a Firebase console link. Report volume is small, so the filter
    // is applied in memory instead.
    const snap = await db.collectionGroup('reports').get();
    const pending = snap.docs.filter((d) => (d.data().verdict || 'pending') === 'pending').slice(0, 50);
    const names = new Map();
    const rows = [];
    for (const d of pending) {
      const uid = d.ref.parent.parent.id;
      if (!names.has(uid)) {
        const u = await db.collection('users').doc(uid).get();
        names.set(uid, (u.data() || {}).fullName || '');
      }
      rows.push({ id: d.id, uid, employee: names.get(uid), ...d.data() });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load the queue.', detail: err.message });
  }
});

// ============================================================ 5e phish-back
//
// The design shows a "predicted click rate". Predicting how many colleagues
// would click is not something this app can measure, and putting a fabricated
// percentage on it would teach the wrong lesson. This scores the draft against
// a stated rubric instead, and says so.

const LEVERS = {
  urgency: { label: 'Deadline pressure', points: 20, hint: 'A deadline the reader cannot verify.' },
  lookalike: { label: 'Lookalike domain', points: 20, hint: 'A sender domain one character from the real one.' },
  authority: { label: 'Borrowed authority', points: 20, hint: 'Claims to be someone the reader answers to.' },
  secrecy: { label: 'Secrecy', points: 15, hint: 'Discourages checking with anyone else.' },
  plausible: { label: 'Plausible detail', points: 25, hint: 'A PO number, a real process, a name that checks out.' },
};

router.post('/phishback/score', verifyToken, async (req, res) => {
  try {
    const { sender = '', subject = '', body = '', levers = [] } = req.body || {};
    if (!subject.trim() || !body.trim()) {
      return res.status(400).json({ error: 'Subject and body are required.' });
    }
    const chosen = levers.filter((l) => LEVERS[l]);
    const breakdown = chosen.map((l) => ({ key: l, label: LEVERS[l].label, points: LEVERS[l].points }));
    let score = breakdown.reduce((a, b) => a + b.points, 0);

    const notes = [];
    if (!chosen.includes('plausible')) {
      notes.push('Weak on plausibility — a real vendor would quote a reference a reader can check.');
    }
    if (!chosen.includes('urgency')) notes.push('No time pressure, so the reader can simply come back to it later.');
    if (chosen.length >= 4) {
      score -= 15;
      notes.push('Too many levers at once reads as a scam — the best bait is boring.');
    }
    score = Math.max(0, Math.min(100, score));

    // A small, once-a-day award: the learning is in the critique, not the XP.
    const uid = req.user.uid;
    const key = dayKey();
    const ref = db.collection('users').doc(uid).collection('phishback').doc(key);
    let xp = 0;
    if (!(await ref.get()).exists) {
      xp = 10;
      await ref.set({ sender, subject, score, levers: chosen, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      await awardXp(uid, xp, 'phishback', { score });
    }
    res.json({ score, breakdown, notes, xp, rubric: Object.entries(LEVERS).map(([k, v]) => ({ key: k, ...v })) });
  } catch (err) {
    res.status(500).json({ error: 'Scoring failed.', detail: err.message });
  }
});

// ============================================================ 5e spot the swap
//
// Replaces the write-your-own-bait sandbox, whose "score" was computed from
// the levers the user ticked about their own text and never read the text at
// all — a number that looked like grading but was not.
//
// This is graded the way the quiz is: the server builds the rounds, keeps the
// answer key, and the client is only ever told which option is which after it
// has committed to an answer.

const SWAP_BRANDS = [
  { real: 'payroll@vasbcorp.com', brand: 'Venator payroll' },
  { real: 'it-support@vasbcorp.com', brand: 'Venator IT' },
  { real: 'no-reply@microsoft.com', brand: 'Microsoft' },
  { real: 'notice@dhl.com', brand: 'DHL' },
  { real: 'service@maybank2u.com.my', brand: 'Maybank' },
  { real: 'billing@digi.com.my', brand: 'Digi' },
  { real: 'alerts@paypal.com', brand: 'PayPal' },
  { real: 'hr@vasbcorp.com', brand: 'Venator HR' },
  { real: 'noreply@grab.com', brand: 'Grab' },
  { real: 'support@shopee.com.my', brand: 'Shopee' },
];

/** Each mutation returns the faked address plus the tell that gives it away. */
const SWAP_MUTATIONS = [
  {
    id: 'hyphen',
    tell: 'A hyphen was pushed into the domain — vasbcorp and vasb-corp are different owners.',
    apply: (addr) => {
      const [user, domain] = addr.split('@');
      const dot = domain.indexOf('.');
      const name = domain.slice(0, dot);
      if (name.length < 6) return null;
      const cut = Math.floor(name.length / 2);
      return `${user}@${name.slice(0, cut)}-${name.slice(cut)}${domain.slice(dot)}`;
    },
  },
  {
    // Only ever targets the domain name, never the TLD. Replacing the first
    // "m" anywhere in the string quietly turned paypal.com into paypal.corn
    // whenever the name itself had no m, which is a different trick with a
    // different explanation — it now has its own entry below.
    id: 'homoglyph-rn',
    tell: 'The "m" is two letters: an r followed by an n. At reading size they close up into a single m, which is why this one survives a glance.',
    apply: (addr) => {
      const at = addr.indexOf('@');
      if (at < 0) return null;
      const local = addr.slice(0, at + 1);
      const domain = addr.slice(at + 1);
      const dot = domain.indexOf('.');
      if (dot < 0) return null;
      const name = domain.slice(0, dot);
      if (!name.includes('m')) return null;
      return local + name.replace('m', 'rn') + domain.slice(dot);
    },
  },
  {
    id: 'tld-corn',
    tell: 'The ending is .corn, not .com — an r and an n where the m should be. It is the same substitution, moved to the part of the address nobody reads.',
    apply: (addr) => (addr.endsWith('.com') ? `${addr.slice(0, -4)}.corn` : null),
  },
  {
    // Domain name only. Left to hit the whole domain it produced ".c0m",
    // which is a zero in the one part of an address everybody knows by
    // shape — glaring rather than subtle, and the opposite of the point.
    id: 'homoglyph-zero',
    tell: 'A letter "o" is a zero. In most interface fonts the two differ by a hair, and nobody proof-reads a domain they recognise.',
    apply: (addr) => {
      const at = addr.indexOf('@');
      if (at < 0) return null;
      const domain = addr.slice(at + 1);
      const dot = domain.indexOf('.');
      if (dot < 0) return null;
      const name = domain.slice(0, dot);
      if (!name.includes('o')) return null;
      return `${addr.slice(0, at + 1)}${name.replace('o', '0')}${domain.slice(dot)}`;
    },
  },
  {
    id: 'suffix',
    tell: 'The real domain is only a prefix here — everything before the final dot is decoration, and the actual owner is the last part.',
    apply: (addr) => {
      const [user, domain] = addr.split('@');
      return `${user}@${domain}.secure-login.net`;
    },
  },
  {
    id: 'tld',
    tell: 'Same name, different top-level domain. Anyone can register the .co version of a .com.',
    apply: (addr) => (addr.endsWith('.com') ? `${addr.slice(0, -4)}.co` : null),
  },
  {
    id: 'doubled',
    tell: 'One letter is doubled up. Reading left to right, the eye supplies the word it expects.',
    apply: (addr) => {
      const at = addr.indexOf('@');
      const domain = addr.slice(at + 1);
      const dot = domain.indexOf('.');
      const name = domain.slice(0, dot);
      if (name.length < 4) return null;
      const i = Math.floor(name.length / 2);
      return `${addr.slice(0, at)}@${name.slice(0, i)}${name[i]}${name.slice(i)}${domain.slice(dot)}`;
    },
  },
];

const SWAP_ROUNDS = 6;
const SWAP_MAX_XP = 30;

/**
 * Builds today's rounds: one address per round, half of them genuine.
 *
 * The first version showed the real and the fake side by side and asked which
 * was which. That is a string diff, not a skill — you never have to know what
 * the real domain looks like, only which of two things in front of you is
 * different. An inbox gives you one address and no reference, so that is what
 * a round gives you now.
 *
 * Three real and three fake, shuffled, so "always tap fake" scores exactly
 * 50% and cannot be mistaken for competence. Deterministic per user per day
 * through the same FNV hash the daily drill uses, so the set cannot be
 * rerolled by reopening the app.
 */
function buildSwapRounds(uid) {
  const key = dayKey();

  // A fixed three-and-three, shuffled by the day's hash.
  const verdicts = [true, true, true, false, false, false];
  for (let i = verdicts.length - 1; i > 0; i--) {
    const j = pickIndex(uid, `${key}:swap:shuffle:${i}`, i + 1);
    [verdicts[i], verdicts[j]] = [verdicts[j], verdicts[i]];
  }

  const rounds = [];
  const usedBrands = new Set();
  // Mutations are spread too, not just brands. Seeing .secure-login.net twice
  // in one sitting teaches the round rather than the pattern.
  const usedMutations = new Set();
  for (let i = 0; i < SWAP_ROUNDS; i++) {
    // Walk from the hashed start until an unused brand is found, so no brand
    // appears twice in one sitting.
    let brand = null;
    const startAt = pickIndex(uid, `${key}:swap:brand:${i}`, SWAP_BRANDS.length);
    for (let k = 0; k < SWAP_BRANDS.length; k++) {
      const cand = SWAP_BRANDS[(startAt + k) % SWAP_BRANDS.length];
      if (!usedBrands.has(cand.real)) { brand = cand; break; }
    }
    if (!brand) brand = SWAP_BRANDS[startAt];
    usedBrands.add(brand.real);

    if (!verdicts[i]) {
      rounds.push({
        brand: brand.brand,
        address: brand.real,
        real: brand.real,
        isFake: false,
        tell: 'Genuine. This is the address the brand actually sends from — the skill is being as sure about a real one as about a fake.',
      });
      continue;
    }

    let address = null;
    let tell = '';
    const mutStart = pickIndex(uid, `${key}:swap:mut:${i}`, SWAP_MUTATIONS.length);
    // Two passes: first only mutations not used yet this sitting, then any
    // that apply, so a brand is never dropped just because its one workable
    // mutation has already appeared.
    for (const fresh of [true, false]) {
      for (let k = 0; k < SWAP_MUTATIONS.length && !address; k++) {
        const m = SWAP_MUTATIONS[(mutStart + k) % SWAP_MUTATIONS.length];
        if (fresh && usedMutations.has(m.id)) continue;
        const out = m.apply(brand.real);
        if (out && out !== brand.real) { address = out; tell = m.tell; usedMutations.add(m.id); }
      }
      if (address) break;
    }
    if (!address) {
      // No mutation applied to this address — serve it as the genuine one
      // rather than dropping a round.
      rounds.push({
        brand: brand.brand,
        address: brand.real,
        real: brand.real,
        isFake: false,
        tell: 'Genuine. This is the address the brand actually sends from.',
      });
      continue;
    }
    rounds.push({ brand: brand.brand, address, real: brand.real, isFake: true, tell });
  }
  return rounds;
}

/** The rounds, with the verdict and the real address withheld. */
router.get('/minigame/swap', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const rounds = buildSwapRounds(uid);
    const done = await db.collection('users').doc(uid)
      .collection('minigames').doc(`swap_${dayKey()}`).get();
    res.json({
      // Only what the player is allowed to see: who it claims to be, and the
      // address. Not whether it is fake, and not the genuine address to
      // compare it against.
      rounds: rounds.map((r) => ({ brand: r.brand, address: r.address })),
      maxXp: SWAP_MAX_XP,
      playedToday: done.exists,
      best: done.exists ? (done.data().correct || 0) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load the round.', detail: err.message });
  }
});

/** Grades the verdicts against the server's own key; XP once a day. */
router.post('/minigame/swap', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    // answers[i] === true means the player called that round a fake.
    const answers = Array.isArray(req.body && req.body.answers) ? req.body.answers : [];
    const rounds = buildSwapRounds(uid);

    const results = rounds.map((r, i) => ({
      brand: r.brand,
      address: r.address,
      real: r.real,
      isFake: r.isFake,
      picked: typeof answers[i] === 'boolean' ? answers[i] : null,
      correct: answers[i] === r.isFake,
      tell: r.tell,
    }));
    const correct = results.filter((r) => r.correct).length;

    const ref = db.collection('users').doc(uid)
      .collection('minigames').doc(`swap_${dayKey()}`);
    let xp = 0;
    if (!(await ref.get()).exists) {
      xp = Math.round((correct / Math.max(1, rounds.length)) * SWAP_MAX_XP);
      await ref.set({
        game: 'swap',
        correct,
        total: rounds.length,
        xp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (xp > 0) await awardXp(uid, xp, 'minigame', { game: 'swap', correct });
    }
    const badges = await checkAndAwardBadges(uid, {});
    res.json({ results, correct, total: rounds.length, xp, badgesAwarded: badges });
  } catch (err) {
    res.status(500).json({ error: 'Scoring failed.', detail: err.message });
  }
});

// ============================================================ admin: reset

/// Every subcollection that represents *earned progress*. The user document
/// itself is edited field-by-field below rather than deleted, so identity
/// survives untouched.
const PROGRESS_SUBCOLLECTIONS = [
  'quizAttempts', 'lessonProgress', 'challengeAttempts', 'badges', 'xpLog',
  'moduleQuizState', 'notifications', 'drills', 'rematches', 'bossRuns',
  'phishback', 'reports', 'minigames',
];

/**
 * Wipes a user's progress and leaves their account alone.
 *
 * Explicitly NOT touched: the Firebase Auth user, email, password, fullName,
 * employeeId, department, role, avatar. Only the gamification state is reset,
 * so the person can log in exactly as before and start from zero.
 */
router.post('/admin/users/:uid/reset-progress', verifyToken, adminOnly, async (req, res) => {
  try {
    const { uid } = req.params;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found.' });

    let deleted = 0;
    for (const name of PROGRESS_SUBCOLLECTIONS) {
      // Batched in chunks: a user with a long xpLog can exceed the 500-write
      // limit of a single batch.
      for (;;) {
        const docs = await userRef.collection(name).limit(400).get();
        if (docs.empty) break;
        const batch = db.batch();
        docs.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += docs.size;
        if (docs.size < 400) break;
      }
    }

    await userRef.set({
      xpTotal: 0,
      level: 1,
      streakDays: 0,
      highestStreak: 0,
      streakInsurance: 0,
      lastActivityDate: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    res.json({ ok: true, docsDeleted: deleted, collections: PROGRESS_SUBCOLLECTIONS.length });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed.', detail: err.message });
  }
});

// ============================================================ admin content

router.get('/admin/drill-items', verifyToken, adminOnly, async (req, res) => {
  const snap = await db.collection('drillItems').get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

router.post('/admin/drill-items', verifyToken, adminOnly, async (req, res) => {
  const { sender, senderEmail, subject, body, isPhish, tell } = req.body || {};
  if (!subject || !body) return res.status(400).json({ error: 'subject and body are required.' });
  const doc = await db.collection('drillItems').add({
    sender: sender || '', senderEmail: senderEmail || '', subject, body,
    isPhish: isPhish === true, tell: tell || '', active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ id: doc.id });
});

router.delete('/admin/drill-items/:id', verifyToken, adminOnly, async (req, res) => {
  await db.collection('drillItems').doc(req.params.id).delete();
  res.json({ ok: true });
});

/** The full boss doc, outcomes included — admins author the fatal branches. */
router.get('/admin/boss/:moduleId', verifyToken, adminOnly, async (req, res) => {
  const snap = await db.collection('modules').doc(req.params.moduleId).collection('boss').doc('main').get();
  res.json(snap.exists ? snap.data() : { name: '', intro: '', howItPlays: [], turns: [] });
});

router.put('/admin/boss/:moduleId', verifyToken, adminOnly, async (req, res) => {
  const { name, intro, howItPlays, turns } = req.body || {};
  await db.collection('modules').doc(req.params.moduleId).collection('boss').doc('main').set({
    name: name || '', intro: intro || '', howItPlays: howItPlays || [], turns: turns || [],
  }, { merge: true });
  res.json({ ok: true });
});

module.exports = router;
