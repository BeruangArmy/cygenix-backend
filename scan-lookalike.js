// The rebrand regex matched the word spelled correctly. Deliberate lookalikes
// are spelled WRONG on purpose — venat0r with a zero, ven-ator with a hyphen —
// so they survived it, and they are the ones that matter most: a lookalike is
// only a tell if it is a near-miss of the REAL domain, and the real domain
// just moved.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

// Anything that looks like it is trying to be the old brand.
const FUZZY = /v[e3a][n#][a@4][t7][o0]r|ven4tor|\bvenat\w*/i;

const grab = (o, out = []) => {
  if (typeof o === 'string') { if (FUZZY.test(o)) out.push(o); return out; }
  if (Array.isArray(o)) { o.forEach((v) => grab(v, out)); return out; }
  if (o && typeof o === 'object') Object.values(o).forEach((v) => grab(v, out));
  return out;
};

(async () => {
  let n = 0;
  const report = (where, ref, data) => {
    const hits = [...new Set(grab(data))];
    if (!hits.length) return;
    n += hits.length;
    console.log(`\n[${where}] ${ref}`);
    hits.forEach((h) => console.log(`   - ${h.length > 170 ? h.slice(0, 170) + '…' : h}`));
  };

  const mods = await db.collection('modules').orderBy('order').get();
  for (const m of mods.docs) {
    for (const [sub, label] of [['lessons', 'lesson'], ['quizQuestions', 'quiz']]) {
      const snap = await m.ref.collection(sub).get();
      for (const d of snap.docs) {
        report(`${m.data().title} · ${label}`, `${sub}/${d.id}`, d.data());
      }
    }
  }
  for (const col of ['drillItems', 'bosses', 'badges', 'departments', 'challenges']) {
    const snap = await db.collection(col).get().catch(() => null);
    if (!snap) continue;
    for (const d of snap.docs) report(col, d.id, d.data());
  }
  console.log(`\n${n} lookalike string(s) still pointing at the old brand.`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
