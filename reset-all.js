// Mass progress reset — every account EXCEPT the test account and any admin.
//
// The inverse of POST /admin/users/:uid/reset-progress, and deliberately the
// same deletion set: only gamification state goes. Auth users, emails,
// passwords, names, employee IDs, departments, roles and avatars are all left
// exactly as they are, so everyone logs in as before and starts from zero.
//
// Run `node reset-all.js` for a DRY RUN that only lists what it would do.
// Run `node reset-all.js --apply` to actually perform it.
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('./src/firebaseAdmin');

// Kept in sync with PROGRESS_SUBCOLLECTIONS in src/routes/loop.js.
const PROGRESS_SUBCOLLECTIONS = [
  'quizAttempts', 'lessonProgress', 'challengeAttempts', 'badges', 'xpLog',
  'moduleQuizState', 'notifications', 'drills', 'rematches', 'bossRuns',
  'phishback', 'reports',
];

// Never reset: the test account, and anyone with the admin role.
const KEEP_EMAILS = ['nialasyraaf36@gmail.com'];

const apply = process.argv.includes('--apply');

async function wipe(userRef) {
  let deleted = 0;
  for (const name of PROGRESS_SUBCOLLECTIONS) {
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
  return deleted;
}

(async () => {
  const users = await db.collection('users').get();
  const toReset = [];
  const kept = [];

  for (const d of users.docs) {
    const u = d.data();
    const email = `${u.email || ''}`.toLowerCase();
    if (KEEP_EMAILS.includes(email)) { kept.push([d.id, email, 'test account']); continue; }
    if (u.role === 'admin') { kept.push([d.id, email, 'admin']); continue; }
    toReset.push(d);
  }

  console.log(`${users.size} accounts total\n`);
  console.log('KEEPING:');
  for (const [id, email, why] of kept) console.log(`  ${email || '(no email)'}  [${why}]  ${id}`);

  console.log(`\n${apply ? 'RESETTING' : 'WOULD RESET'} (${toReset.length}):`);
  for (const d of toReset) {
    const u = d.data();
    console.log(`  ${u.email || '(no email)'}  xp=${u.xpTotal || 0} level=${u.level || 1} streak=${u.streakDays || 0}  ${d.id}`);
  }

  if (!apply) {
    console.log('\nDRY RUN — nothing was changed. Re-run with --apply to perform it.');
    process.exit(0);
  }

  let totalDocs = 0;
  for (const d of toReset) {
    const n = await wipe(d.ref);
    totalDocs += n;
    console.log(`  reset ${d.data().email || d.id} (${n} progress docs removed)`);
  }
  console.log(`\ndone: ${toReset.length} accounts reset, ${totalDocs} progress documents deleted.`);
  console.log(`${kept.length} accounts left untouched.`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
