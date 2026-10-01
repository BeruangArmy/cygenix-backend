// Seeds the running first-serve tallies on each user document from the
// attempts they have already made.
//
// quizState.js now keeps firstServeCorrect/firstServeTotal up to date as
// people submit, so accuracy is a field read rather than a scan — the
// leaderboard ranks 50 people at once and cannot afford a subcollection
// query each. Without this, everyone who was already using the app would
// show no accuracy until their next first serve.
//
// Retry rounds are excluded, matching reportData.js and the client: a retry
// is practice, not assessment.
//
//   node backfill-first-serve.js            dry run
//   node backfill-first-serve.js --apply    write it
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

(async () => {
  const users = await db.collection('users').get();
  let written = 0;

  for (const u of users.docs) {
    const attempts = await u.ref.collection('quizAttempts').get();
    let correct = 0;
    let total = 0;
    for (const d of attempts.docs) {
      const a = d.data();
      if (a.isRetry) continue;
      correct += a.score || 0;
      total += a.total || 0;
    }

    const existing = u.data();
    if ((existing.firstServeTotal || 0) === total && (existing.firstServeCorrect || 0) === correct) continue;

    const pct = total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : 'no first serves yet';
    console.log(`  ${apply ? 'wrote' : 'would write'} ${existing.email || u.id}: ${correct}/${total}  (${pct})`);
    written++;
    if (apply) {
      await u.ref.set({ firstServeCorrect: correct, firstServeTotal: total }, { merge: true });
    }
  }

  console.log(`\n${written} user(s) ${apply ? 'updated' : 'would be updated'}.`);
  if (!apply) console.log('\nDRY RUN - nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
