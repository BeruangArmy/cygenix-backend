// Repairs accounts that were un-secured by taking the optional module retry.
//
// levelsCleared() derived "all three levels beaten" from phase/currentLevel,
// and retry-module rewinds both. So anyone who accepted the free retry lost
// the module from their secured count — and if they never finished the retry,
// they are still short of it today with no way back except re-clearing all
// three levels.
//
// A state document was completed at least once if either is true:
//   phase === 'completed'            finished, and not currently retrying
//   isModuleRetryPass === true       only ever set by retry-module, which
//                                    refuses to run unless phase was
//                                    'completed' first
//
//   node backfill-completed-once.js            dry run
//   node backfill-completed-once.js --apply    write it
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

(async () => {
  const users = await db.collection('users').get();
  let scanned = 0; let fixed = 0; const perUser = [];

  for (const u of users.docs) {
    const states = await u.ref.collection('moduleQuizState').get();
    const names = [];
    for (const d of states.docs) {
      scanned++;
      const s = d.data();
      if (s.completedOnce === true) continue;
      const wasCompleted = s.phase === 'completed' || s.isModuleRetryPass === true;
      if (!wasCompleted) continue;
      fixed++;
      names.push(`${d.id}${s.phase === 'completed' ? '' : ' (mid-retry)'}`);
      if (apply) await d.ref.set({ completedOnce: true }, { merge: true });
    }
    if (names.length) perUser.push(`  ${u.data().email || u.id}: ${names.join(', ')}`);
  }

  console.log(perUser.join('\n') || '  nothing to repair');
  console.log(`\n${fixed} of ${scanned} module state(s) ${apply ? 'stamped' : 'would be stamped'} completedOnce.`);
  if (!apply) console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
