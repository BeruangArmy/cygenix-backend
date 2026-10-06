// Give every quiz question an explicit sequenceOrder.
//
// Firestore's orderBy() does not just sort — it FILTERS. A document with no
// sequenceOrder field is not ordered last, it is left out of the result set
// entirely. Every one of the 135 seeded quiz questions was written without
// that field, so watchQuizQuestions() in firestore_service.dart
//
//     .orderBy('sequenceOrder').orderBy('createdAt')
//
// returned nothing, and the admin Quiz Questions tab showed "No quiz
// questions yet" for modules that have fifteen each. Deploying the composite
// index (IT-05) was necessary but not sufficient: it fixed the error, and
// revealed the empty list underneath it.
//
// The employee side never noticed because quizState.js sorts in memory with
// `(a.sequenceOrder || 0) - (b.sequenceOrder || 0)`, which treats a missing
// field as 0 rather than dropping the question.
//
// So: write 0, the same value that in-memory sort has been assuming all
// along. Not a rank like 0,1,2,… — that would reorder what employees are
// served, because the backend sorts by this field. Zero everywhere keeps the
// serving order byte-for-byte identical and simply makes the documents
// visible to a query that orders on the field. The admin list then falls
// through to its createdAt tiebreak, which is a sensible reading order.
//
//   node backfill-seq-order.js            dry run
//   node backfill-seq-order.js --apply    write it
require('dotenv').config();
const { db, admin } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

(async () => {
  const mods = await db.collection('modules').get();
  let found = 0;
  let written = 0;

  for (const m of mods.docs) {
    const qs = await m.ref.collection('quizQuestions').get();
    const needs = qs.docs.filter((d) => d.data().sequenceOrder === undefined);
    if (needs.length === 0) {
      console.log(`  ${m.data().title}: all ${qs.size} already have it`);
      continue;
    }
    found += needs.length;
    console.log(`  ${m.data().title}: ${needs.length} of ${qs.size} need sequenceOrder`);

    if (!apply) continue;
    // Batched: 135 documents is one batch's worth, but chunk anyway so this
    // stays correct if the question pool grows past Firestore's 500 limit.
    for (let i = 0; i < needs.length; i += 400) {
      const batch = db.batch();
      for (const d of needs.slice(i, i + 400)) {
        batch.update(d.ref, { sequenceOrder: 0 });
        written++;
      }
      await batch.commit();
    }
  }

  console.log(`\n${found} question(s) without sequenceOrder.`);
  if (apply) {
    console.log(`${written} updated.`);
  } else {
    console.log('\nDRY RUN - nothing written. Re-run with --apply.');
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
