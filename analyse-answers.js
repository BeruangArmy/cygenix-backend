// Measures the answer-length tell before trying to fix it.
//
// The claim: the correct option is often visibly longer than the distractors,
// so "pick the longest" scores well without knowing anything. This counts how
// often that heuristic actually wins, per level, and writes the worst
// offenders out so they can be rewritten.
require('dotenv').config();
const fs = require('fs');
const { db } = require('./src/firebaseAdmin');

(async () => {
  const mods = await db.collection('modules').get();
  const rows = [];

  for (const m of mods.docs) {
    const qs = await m.ref.collection('quizQuestions').get();
    for (const q of qs.docs) {
      const d = q.data();
      const opts = d.options || [];
      if (opts.length < 2) continue;
      const correctIdx = d.correctOption;
      const lens = opts.map((o) => `${o}`.length);
      const maxLen = Math.max(...lens);
      const correctLen = lens[correctIdx] ?? 0;
      const others = lens.filter((_, i) => i !== correctIdx);
      const avgOther = others.reduce((a, b) => a + b, 0) / others.length;

      rows.push({
        moduleId: m.id,
        module: m.data().title,
        qid: q.id,
        level: d.level || '?',
        question: d.questionText || d.question || '',
        options: opts,
        correctIdx,
        correctLen,
        avgOther: Math.round(avgOther),
        isLongest: correctLen === maxLen,
        // how much longer the correct one is, as a ratio
        ratio: avgOther ? +(correctLen / avgOther).toFixed(2) : 0,
      });
    }
  }

  const byLevel = {};
  for (const r of rows) {
    const b = (byLevel[r.level] ??= { n: 0, longest: 0, ratioSum: 0 });
    b.n++;
    if (r.isLongest) b.longest++;
    b.ratioSum += r.ratio;
  }

  console.log(`questions analysed: ${rows.length}\n`);
  console.log('level      n    correct-is-longest    avg length vs distractors');
  for (const [lvl, b] of Object.entries(byLevel)) {
    const pct = Math.round((100 * b.longest) / b.n);
    console.log(
      `${lvl.padEnd(9)} ${String(b.n).padStart(3)}    ${String(pct).padStart(3)}%`
      + ` (${b.longest}/${b.n})`.padEnd(12)
      + `    ${(b.ratioSum / b.n).toFixed(2)}x`,
    );
  }
  const allLongest = rows.filter((r) => r.isLongest).length;
  console.log(`\noverall: ${Math.round((100 * allLongest) / rows.length)}% of questions`
    + ' can be answered by picking the longest option.');
  console.log('random guessing on 4 options would score 25%.');

  // Worst offenders first, for rewriting.
  rows.sort((a, b) => b.ratio - a.ratio);
  fs.writeFileSync('answer-bias.json', JSON.stringify(rows, null, 2), 'utf8');
  console.log(`\nwrote answer-bias.json (${rows.length} questions, worst first)`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
