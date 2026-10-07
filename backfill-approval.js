// Give every account that predates approvals an explicit status: 'approved'.
//
// This is tidiness, not the thing keeping anyone in. Both gates — the
// Firestore rules and verifyToken — already read a missing status as
// approved, precisely so that deploying approvals could never lock out the
// people already using the app, with or without this script having run.
//
// What it does buy: every user document has the same shape afterwards, so
// anyone reading the collection later does not have to know the default.
//
//   node backfill-approval.js            dry run
//   node backfill-approval.js --apply    write it
require('dotenv').config();
const { db, admin } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

(async () => {
  const snap = await db.collection('users').get();
  const needs = snap.docs.filter((d) => d.data().status === undefined);

  if (needs.length === 0) {
    console.log(`All ${snap.size} account(s) already carry a status. Nothing to do.`);
    process.exit(0);
  }

  console.log(`${needs.length} of ${snap.size} account(s) have no status:\n`);
  needs.forEach((d) => {
    const u = d.data();
    console.log(`  ${(u.fullName || u.email || d.id).padEnd(32)} ${u.role === 'admin' ? 'admin' : 'employee'}`);
  });

  if (!apply) {
    console.log('\nDRY RUN - nothing written. Re-run with --apply.');
    process.exit(0);
  }

  // 500 writes per batch is the Firestore limit; one write each here.
  let written = 0;
  for (let i = 0; i < needs.length; i += 400) {
    const batch = db.batch();
    needs.slice(i, i + 400).forEach((d) => {
      batch.set(d.ref, {
        status: 'approved',
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        // No decidedBy: nobody decided these, they predate the feature.
        // Leaving it unset is more honest than naming an admin who never
        // looked at them.
      }, { merge: true });
      written++;
    });
    await batch.commit();
  }

  console.log(`\n${written} account(s) set to approved.`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
