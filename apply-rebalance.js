// Applies rewritten answer options from rebalance/*.json.
//
// Why this exists: 86% of questions could be answered by picking the longest
// option (98% on Hard), because correct answers were full explanations and
// the distractors were throwaway one-liners. That made the difficulty label
// meaningless — the tell got *stronger* as the level rose.
//
// Each file maps questionId -> the full replacement options array. The
// correct answer's TEXT is preserved exactly, and the script re-derives
// correctOption from where that text now sits, so an option can be reordered
// without silently changing which answer is right. It refuses to write if the
// correct text is missing from the replacement.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db } = require('./src/firebaseAdmin');

const dir = path.join(__dirname, 'rebalance');

(async () => {
  const files = process.argv[2]
    ? [process.argv[2]]
    : fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  const patches = {};
  for (const f of files) {
    Object.assign(patches, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }

  const mods = await db.collection('modules').get();
  let applied = 0, missing = 0, refused = 0;

  for (const m of mods.docs) {
    const qs = await m.ref.collection('quizQuestions').get();
    for (const q of qs.docs) {
      const next = patches[q.id];
      if (!next) continue;
      const d = q.data();
      const correctText = (d.options || [])[d.correctOption];
      const idx = next.indexOf(correctText);
      if (idx < 0) {
        console.log('REFUSED (correct answer not in replacement):', q.id);
        console.log('   wanted:', correctText);
        refused++;
        continue;
      }
      await q.ref.set({ options: next, correctOption: idx }, { merge: true });
      applied++;
      delete patches[q.id];
    }
  }

  missing = Object.keys(patches).length;
  if (missing) console.log('NO SUCH QUESTION:', Object.keys(patches).join(', '));
  console.log(`\napplied ${applied}, refused ${refused}, unmatched ${missing}`);
  process.exit(refused ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
