// Backfills createdAt on the rank-tier badges.
//
// watchBadges() is `badges.orderBy('createdAt')`, and Firestore silently
// excludes any document missing the field you order by. seed-rank-badges.js
// never wrote createdAt, so the four rank crests existed, could be earned,
// and were counted in the "earned" numerator — while being invisible to the
// definition query that produces the denominator and the grid.
//
// That is what made the Crest Case read "7 of 8" with only 4 tiles unlocked:
// 7 earned (3 of them rank crests), 8 visible definitions, 4 of the visible
// ones earned.
//
// Dated in tier order so they sort after the achievement badges rather than
// landing in an arbitrary spot.
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('./src/firebaseAdmin');

const ORDER = ['rank-silver', 'rank-gold', 'rank-ruby', 'rank-peak'];

(async () => {
  const snap = await db.collection('badges').get();
  const newest = snap.docs
    .map((d) => d.data().createdAt)
    .filter(Boolean)
    .map((t) => t.toMillis())
    .reduce((a, b) => Math.max(a, b), 0);

  let fixed = 0;
  for (let i = 0; i < ORDER.length; i++) {
    const ref = db.collection('badges').doc(ORDER[i]);
    const doc = await ref.get();
    if (!doc.exists) { console.log('  missing definition:', ORDER[i]); continue; }
    if (doc.data().createdAt) { console.log('  already dated:', ORDER[i]); continue; }
    // One minute apart, after every existing badge, in tier order.
    const at = new Date(newest + (i + 1) * 60000);
    await ref.set({ createdAt: admin.firestore.Timestamp.fromDate(at) }, { merge: true });
    console.log('  dated', ORDER[i], '->', at.toISOString());
    fixed++;
  }

  const all = await db.collection('badges').get();
  const visible = await db.collection('badges').orderBy('createdAt').get();
  console.log(`\n${fixed} backfilled`);
  console.log(`definitions: ${all.size} | visible to orderBy(createdAt): ${visible.size}`);
  if (all.size !== visible.size) console.log('STILL DROPPING SOME — check for other missing fields.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
