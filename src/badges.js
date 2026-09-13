const { db, admin } = require('./firebaseAdmin');
const { notify } = require('./notifications');

// Evaluates every badge definition (Data Dictionary Table 11) against one
// user and awards (writes users/{uid}/badges/{badgeId}, Table 12) any that
// newly qualify. Badge docs carry a criteriaType/criteriaValue pair so this
// can run automatically — criteria (free text) is just the human-readable
// description shown in the app.
//
// context lets callers report the specific event that just happened, since
// some criteria (quiz_perfect, module_complete) only make sense evaluated
// at the moment they occur rather than recomputed from scratch every time.
const { tierIndexForXp, tierIndexByName } = require('./rankTiers');

async function checkAndAwardBadges(uid, context = {}) {
  const [badgesSnap, userSnap, earnedSnap] = await Promise.all([
    db.collection('badges').get(),
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(uid).collection('badges').get(),
  ]);
  if (!userSnap.exists) return [];

  const user = userSnap.data();
  const alreadyEarned = new Set(earnedSnap.docs.map((d) => d.id));
  const newlyAwarded = [];

  let rank = null;
  const needsRank = badgesSnap.docs.some((d) => !alreadyEarned.has(d.id) && d.data().criteriaType === 'top_rank');
  if (needsRank) {
    const leaderboardSnap = await db.collection('users').orderBy('xpTotal', 'desc').limit(200).get();
    rank = leaderboardSnap.docs.findIndex((d) => d.id === uid) + 1 || null;
  }

  // Only run this (a published-module count + the user's completed-module
  // count) when a badge actually needs it, matching the top_rank pattern.
  let allModulesComplete = null;
  const needsAllModules = badgesSnap.docs.some((d) => !alreadyEarned.has(d.id) && d.data().criteriaType === 'all_modules_complete');
  if (needsAllModules) {
    const [modulesSnap, completedStateSnap] = await Promise.all([
      db.collection('modules').where('status', '==', 'published').get(),
      db.collection('users').doc(uid).collection('moduleQuizState').where('phase', '==', 'completed').get(),
    ]);
    allModulesComplete = modulesSnap.size > 0 && completedStateSnap.size >= modulesSnap.size;
  }

  for (const badgeDoc of badgesSnap.docs) {
    if (alreadyEarned.has(badgeDoc.id)) continue;
    const badge = badgeDoc.data();
    let qualifies = false;

    switch (badge.criteriaType) {
      case 'module_complete':
        qualifies = context.moduleCompletedId != null && context.moduleCompletedId === badge.criteriaValue;
        break;
      case 'any_module_complete':
        qualifies = context.moduleCompletedId != null;
        break;
      case 'quiz_perfect':
        qualifies = context.perfectScoreJustAchieved === true;
        break;
      case 'streak':
        qualifies = (user.streakDays || 0) >= (parseInt(badge.criteriaValue, 10) || Infinity);
        break;
      case 'top_rank':
        qualifies = rank != null && rank <= (parseInt(badge.criteriaValue, 10) || 0);
        break;
      case 'level_reached':
        qualifies = (user.level || 1) >= (parseInt(badge.criteriaValue, 10) || Infinity);
        break;
      case 'all_modules_complete':
        qualifies = allModulesComplete === true;
        break;
      // criteriaValue is a crest tier name ("Ruby", "Obsidian", ...). Once
      // earned the badge stays earned, so this records the highest tier the
      // user has ever reached rather than the one they hold right now.
      case 'rank_tier': {
        const want = tierIndexByName(badge.criteriaValue);
        qualifies = want >= 0 && tierIndexForXp(user.xpTotal || 0) >= want;
        break;
      }
      default:
        qualifies = false;
    }

    if (qualifies) {
      await db.collection('users').doc(uid).collection('badges').doc(badgeDoc.id).set({
        badgeName: badge.badgeName,
        earnedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await notify(uid, {
        type: 'badge_earned',
        title: 'New badge earned!',
        body: `You've earned the "${badge.badgeName}" badge.`,
        meta: { badgeId: badgeDoc.id, badgeName: badge.badgeName },
      });
      newlyAwarded.push({ id: badgeDoc.id, badgeName: badge.badgeName });
    }
  }

  return newlyAwarded;
}

// Updates streakDays based on the gap since the user's last recorded
// activity, and returns the new value. Call once per "counts as active
// today" event (currently: quiz submit).
async function bumpStreak(uid) {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() || {};
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const lastKey = data.lastActivityDate || null;

    let streakDays = data.streakDays || 0;
    let insurance = data.streakInsurance || 0;
    if (lastKey === todayKey) {
      // already counted today — no change.
    } else if (lastKey) {
      const dayBefore = (n) => {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - n);
        return d.toISOString().slice(0, 10);
      };
      if (lastKey === dayBefore(1)) {
        streakDays += 1;
      } else if (lastKey === dayBefore(2) && insurance > 0) {
        // Streak insurance (design 5a): one banked day covers exactly one
        // gap, and is spent doing it.
        insurance -= 1;
        streakDays += 1;
      } else {
        streakDays = 1;
      }
    } else {
      streakDays = 1;
    }

    // All-time best, kept alongside the running streak so missing a day
    // resets streakDays without erasing what the user actually achieved.
    // Seeded from the current streak for users who predate this field.
    const highestStreak = Math.max(data.highestStreak || 0, streakDays);

    tx.set(userRef, { streakDays, highestStreak, streakInsurance: insurance, lastActivityDate: todayKey }, { merge: true });
    return streakDays;
  });
}

module.exports = { checkAndAwardBadges, bumpStreak };
