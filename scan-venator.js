// Finds every surviving "venator" reference in content — the earlier audit
// searched for "venatorcorp" only, so bare "venator.com" / "Venator" slipped
// through the migration untouched.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const HIT = /venator/i;
const grab = (o, out = []) => {
  if (typeof o === 'string') { if (HIT.test(o)) out.push(o); return out; }
  if (Array.isArray(o)) { o.forEach((v) => grab(v, out)); return out; }
  if (o && typeof o === 'object') { Object.values(o).forEach((v) => grab(v, out)); }
  return out;
};

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let n = 0;
  for (const m of mods.docs) {
    const title = m.data().title;
    for (const [sub, label] of [['lessons', 'lesson'], ['quizQuestions', 'question']]) {
      const snap = await m.ref.collection(sub).get();
      for (const d of snap.docs) {
        const hits = [...new Set(grab(d.data()))];
        if (hits.length) {
          n += hits.length;
          console.log(`\n[${label}] ${title} / ${d.data().title || String(d.data().questionText || '').slice(0, 60)}`);
          console.log(`  doc: modules/${m.id}/${sub}/${d.id}`);
          hits.forEach((h) => console.log(`   - ${h.length > 160 ? h.slice(0, 160) + '…' : h}`));
        }
      }
    }
  }
  // Anything outside modules too.
  for (const col of ['drillItems', 'bosses', 'badges', 'departments']) {
    const snap = await db.collection(col).get().catch(() => null);
    if (!snap) continue;
    for (const d of snap.docs) {
      const hits = [...new Set(grab(d.data()))];
      if (hits.length) { n += hits.length; console.log(`\n[${col}] ${d.id}`); hits.forEach((h) => console.log(`   - ${h.slice(0, 160)}`)); }
    }
  }
  console.log(`\n${n} surviving "venator" string(s).`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
