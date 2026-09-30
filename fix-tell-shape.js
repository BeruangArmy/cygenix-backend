// Breaks the template that was answering the tap-alongs for the player.
//
// Measured across all 27 exercises before this ran:
//   - every single one had exactly 3 tells, and the title said so
//   - 22 of 27 were the identical shape: clean, tell, tell, tell, clean
//   - the first line was a tell in 3 of 27, the last in 2 of 27
//
// So the winning strategy needed no reading: skip the first and last line,
// tap the middle three, stop when the title said to. The content was
// irrelevant because the template was the answer key.
//
// This fixes the shape rather than the prose:
//   1. Titles no longer announce how many tells there are.
//   2. Two or three substantive clean lines are added to every exercise —
//      real content that could plausibly be wrong but isn't, so you cannot
//      pick by "which lines actually say something". Greetings and sign-offs
//      were the only clean lines before, which is why the middle always won.
//   3. Tell positions are redistributed with a per-lesson hash, including
//      into the first and last slots.
//   4. Tell count varies from 2 to 4 by dropping or keeping tells, so the
//      count is no longer a constant you can rely on.
//
// The tells themselves, their phrases and their explanations are untouched.
// Re-runnable: it recomputes shape from whatever is currently stored.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

// Deterministic so a re-run produces the same layout.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const pick = (seed, n) => hash(seed) % n;

// Titles that describe the exercise without counting the answers.
const TITLES = [
  'Read this one carefully',
  'Something here does not hold up',
  'What would you check first?',
  'This one passed the filters',
  'Nobody flagged this at the time',
  'Worth a second read',
  'This landed in a real inbox',
  'Would you have acted on this?',
];

// Plausible, content-bearing lines that are genuinely fine. Chosen by channel
// so an email exercise gets email filler and a chat exercise gets chat filler.
// These exist to make "which lines say something" a useless heuristic.
const CLEAN = {
  email: [
    'This message was sent to all staff in your department.',
    'A copy has been filed under your team\'s shared reference.',
    'You can view previous notices of this type in the staff portal.',
    'Our usual service hours are 9am to 6pm, Monday to Friday.',
    'Reference number for this notice is 4471-QA.',
    'No action is needed if you have already completed this.',
    'This is the second notice on this subject.',
    'Please keep this reference for your records.',
  ],
  chat: [
    'I checked the calendar and the window is still open until Friday.',
    'The ticket number is on the board if anyone needs it.',
    'I have the same setup on my machine and it behaved normally.',
    'Worth flagging in standup tomorrow either way.',
    'I already asked procurement and they confirmed the order.',
    'This came up last quarter too and it was fine then.',
    'Let me know if you want me to pick it up instead.',
    'The document is in the usual folder if you want to look.',
  ],
  call: [
    'The reference on the case is four-four-seven-one.',
    'I can hold while you check with someone if that helps.',
    'We spoke to your colleague about this last week.',
    'This line is recorded for quality purposes.',
    'I will send a written summary afterwards either way.',
    'There is no charge for this, it is part of the service.',
    'Happy to call back at a better time if now is difficult.',
    'You should have received a letter about this already.',
  ],
};

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let touched = 0;
  const shapes = {};

  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const doc of lessons.docs) {
      const sections = doc.data().sections || [];
      const idx = sections.findIndex((x) => x.kind === 'tells');
      if (idx < 0) continue;

      const sec = sections[idx];
      const lines = sec.lines || [];
      const tells = lines.filter((l) => l.phrase);
      const originalClean = lines.filter((l) => !l.phrase);
      if (tells.length === 0) continue;

      const seed = `${m.id}:${doc.id}`;
      const channel = CLEAN[sec.channel] ? sec.channel : 'email';

      // --- 1. how many tells this exercise keeps (2 to 4)
      // Dropping below two would make "tap the one odd line" trivial; four
      // only happens where four were written.
      const want = 2 + pick(`${seed}:count`, 3); // 2, 3 or 4
      const keep = tells.slice(0, Math.max(2, Math.min(want, tells.length)));

      // --- 2. clean lines: the originals plus enough substantive ones that
      // tells are a minority of the exercise.
      const pool = CLEAN[channel];
      const needed = Math.max(0, keep.length + 2 - originalClean.length);
      const added = [];
      for (let i = 0; i < needed; i++) {
        const text = pool[pick(`${seed}:clean:${i}`, pool.length)];
        if (added.some((a) => a.text === text) || originalClean.some((c) => c.text === text)) {
          // collision — walk forward for a different one
          for (let k = 1; k < pool.length; k++) {
            const alt = pool[(pick(`${seed}:clean:${i}`, pool.length) + k) % pool.length];
            if (!added.some((a) => a.text === alt) && !originalClean.some((c) => c.text === alt)) {
              added.push({ text: alt, phrase: '', label: '', explain: '' });
              break;
            }
          }
        } else {
          added.push({ text, phrase: '', label: '', explain: '' });
        }
      }
      const cleans = [...originalClean, ...added];

      // --- 3. interleave, with tells allowed anywhere including the ends
      const total = keep.length + cleans.length;
      const positions = [...Array(total).keys()];
      for (let i = positions.length - 1; i > 0; i--) {
        const j = pick(`${seed}:pos:${i}`, i + 1);
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      const tellSlots = new Set(positions.slice(0, keep.length));
      const out = [];
      let ti = 0; let ci = 0;
      for (let i = 0; i < total; i++) {
        out.push(tellSlots.has(i) ? keep[ti++] : cleans[ci++]);
      }

      // --- 4. a title that does not count the answers
      const title = TITLES[pick(`${seed}:title`, TITLES.length)];
      const intro = 'Tap anything in here you would not act on. Some of these are fine.';

      const next = [...sections];
      next[idx] = { ...sec, title, intro, lines: out };
      await doc.ref.set({ sections: next }, { merge: true });

      const shape = out.map((l) => (l.phrase ? 'T' : '.')).join('');
      shapes[shape] = (shapes[shape] || 0) + 1;
      console.log(`  ${shape.padEnd(9)} ${keep.length} tells  ${doc.data().title.slice(0, 34)}`);
      touched++;
    }
  }

  console.log(`\n${touched} tap-alongs reshaped`);
  console.log('\nshape distribution (T=tell, .=clean):');
  for (const [k, v] of Object.entries(shapes).sort((a, b) => b[1] - a[1])) {
    console.log('  ', k.padEnd(9), v);
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
