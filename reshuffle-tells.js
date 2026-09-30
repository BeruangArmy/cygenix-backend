// Re-permutes tap-along line order only. Counts, prose, phrases and
// explanations are untouched, so it is safe to run more than once —
// unlike fix-tell-shape.js, which can only ever drop tells.
//
// Exists because the first shuffle left the last line a tell in just 4 of 27
// exercises, below chance for the tell density. "The sign-off is never the
// problem" is the same kind of positional shortcut the reshape was meant to
// remove.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const salt = process.argv[2] || 'v2';

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let n = 0;
  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const doc of lessons.docs) {
      const sections = doc.data().sections || [];
      const idx = sections.findIndex((x) => x.kind === 'tells');
      if (idx < 0) continue;
      const lines = [...(sections[idx].lines || [])];
      if (!lines.length) continue;

      // Fisher-Yates seeded on the lesson AND the value being moved, so the
      // sequence is not the same walk for every lesson of the same length.
      for (let i = lines.length - 1; i > 0; i--) {
        const j = hash(`${salt}:${m.id}:${doc.id}:${i}:${lines[i].text}`) % (i + 1);
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      const next = [...sections];
      next[idx] = { ...sections[idx], lines };
      await doc.ref.set({ sections: next }, { merge: true });
      n++;
    }
  }
  console.log(`re-permuted ${n} tap-alongs (salt "${salt}")`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
