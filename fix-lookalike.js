// The one spelling the rebrand could not match: venat0r-support.com, written
// with a zero on purpose.
//
// It has to move for the same reason the correctly-spelled domains did, and
// more so: this address is only a tell because it is a near-miss of the real
// company domain. Against vasbcorp.com, "venat0r" is not a near-miss of
// anything — it is just a stranger, and the question stops teaching what it
// was written to teach ("0 instead of o"). vasbc0rp-support.com keeps the
// substitution, the extra word, and the lesson.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const FROM = /venat0r-support\.com/gi;
const TO = 'vasbc0rp-support.com';
const apply = process.argv.includes('--apply');

let changed = 0;
const deep = (o) => {
  if (typeof o === 'string') {
    const out = o.replace(FROM, TO);
    if (out !== o) changed++;
    return out;
  }
  if (Array.isArray(o)) return o.map(deep);
  if (o && typeof o === 'object' && o.constructor === Object) {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)]));
  }
  return o;
};

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  for (const m of mods.docs) {
    for (const sub of ['lessons', 'quizQuestions']) {
      const snap = await m.ref.collection(sub).get();
      for (const d of snap.docs) {
        const data = d.data();
        if (!FROM.test(JSON.stringify(data))) { FROM.lastIndex = 0; continue; }
        FROM.lastIndex = 0;
        const before = changed;
        const next = deep(data);
        console.log(`  ${apply ? 'fixed' : 'would fix'} ${m.data().title} / ${sub}/${d.id}  (${changed - before})`);
        if (apply) await d.ref.set(next);
      }
    }
  }
  console.log(`\n${changed} string(s).`);
  if (!apply) console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
