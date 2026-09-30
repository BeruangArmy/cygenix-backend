// The line order inside a tap-along is a free choice, so rather than accept
// whatever the first seed produced, this tries a range of salts against the
// real data and reports which one distributes tells most evenly across the
// first and last slots. Nothing is written — it only prints the winner.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

(async () => {
  const sections = [];
  const mods = await db.collection('modules').orderBy('order').get();
  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const doc of lessons.docs) {
      for (const sec of (doc.data().sections || [])) {
        if (sec.kind !== 'tells') continue;
        sections.push({ mid: m.id, lid: doc.id, lines: sec.lines || [] });
      }
    }
  }

  // What a perfectly even distribution would look like for this data.
  let expected = 0;
  for (const s of sections) {
    const t = s.lines.filter((l) => l.phrase).length;
    expected += t / s.lines.length;
  }

  let best = null;
  for (let n = 0; n < 60; n++) {
    const salt = `v${n}`;
    let first = 0; let last = 0; const shapes = new Set();
    for (const s of sections) {
      const lines = [...s.lines];
      for (let i = lines.length - 1; i > 0; i--) {
        const j = hash(`${salt}:${s.mid}:${s.lid}:${i}:${lines[i].text}`) % (i + 1);
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      if (lines[0].phrase) first++;
      if (lines[lines.length - 1].phrase) last++;
      shapes.add(lines.map((l) => (l.phrase ? 'T' : '.')).join(''));
    }
    // Score: how far first and last are from the even expectation, with a
    // small bonus for shape variety.
    const err = Math.abs(first - expected) + Math.abs(last - expected)
      - (shapes.size - sections.length) * 0.5;
    if (!best || err < best.err) best = { salt, first, last, shapes: shapes.size, err };
  }

  console.log(`sections: ${sections.length}`);
  console.log(`even distribution would put ~${expected.toFixed(1)} tells in each end slot`);
  console.log(`best salt: ${best.salt}  first=${best.first}  last=${best.last}  distinct shapes=${best.shapes}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
