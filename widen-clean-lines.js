// Widens the tap-along filler pool from 8 lines per channel to 20, and makes
// the draw unique within a module.
//
// fix-tell-shape.js adds "substantive but genuinely fine" lines so that
// "which lines actually say something" stops being a winning heuristic. It
// drew them from 8 per channel across 27 exercises, so the same sentence came
// round constantly: "No action is needed if you have already completed this."
// landed in Phishing lesson 1 AND lesson 2, and the 4471-QA reference showed
// up in Phishing, Malware and MFA. Filler that repeats is its own tell — the
// reader learns to skip the lines they recognise, which is the exact skim
// this exercise exists to break.
//
// Re-running fix-tell-shape.js would not have fixed it: on a second pass its
// own previous additions count as original clean lines, so it adds nothing.
// This replaces the filler it already wrote instead.
//
// Only lines whose text is in the OLD pool are touched. Tells, their phrases
// and explanations, and any clean line an author actually wrote are left
// exactly as they are.
//
//   node widen-clean-lines.js            dry run
//   node widen-clean-lines.js --apply    write it
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// Exactly what fix-tell-shape.js shipped. Recognising these is how machine
// filler is told apart from a line someone wrote on purpose.
const OLD = {
  email: [
    'This message was sent to all staff in your department.',
    "A copy has been filed under your team's shared reference.",
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

// Twelve more per channel, to the same brief: ordinary workplace detail that
// carries content, so it cannot be dismissed as filler, and that a careful
// reader has no grounds to flag. Nothing here invents a policy, imposes a
// deadline, names a domain or asks for anything — those are the shapes the
// tells use, and filler that borrowed them would make the exercise unfair
// rather than harder.
const EXTRA = {
  email: [
    'Your department lead has been copied on this message.',
    'This notice is also pinned on the intranet homepage.',
    'We publish these updates on the first Monday of each month.',
    'The change takes effect from the start of next quarter.',
    'A short FAQ covering the common questions is on the intranet.',
    'The previous version of this policy is still available for reference.',
    'This was covered at the last all-hands meeting.',
    'Printed copies are available from reception if you prefer one.',
    'The earlier phase of this closed at the end of last month.',
    'Around four hundred people in the office received the same notice.',
    'Nothing in this message needs a reply.',
    'The team responsible is listed in the intranet directory.',
  ],
  chat: [
    'I pulled the numbers off the shared sheet this morning.',
    'Finance signed this off at the start of the week.',
    'I have put a note on the ticket so it does not get missed.',
    'The meeting notes from Tuesday cover most of this.',
    'I am out tomorrow but back Thursday if it can wait.',
    'Happy to walk through it on a call if that is easier.',
    'It is in the backlog already, somewhere near the top.',
    'No rush on this one at all.',
    'The old version is still sitting in the archive folder.',
    'I asked the same question last month and got nowhere.',
    'Two other people have mentioned the same thing this week.',
    'Let me know once you have had a look at it.',
  ],
  call: [
    'I can see the previous case on your record here.',
    'The letter would have gone second class, so give it a few days.',
    'I will make a note that we spoke today.',
    'I believe a colleague of mine dealt with this last time.',
    'There is nothing outstanding on the account at the moment.',
    'You can do all of this through the normal portal as well.',
    'Take your time, there is no hurry at this end.',
    'If you would rather do this in writing that is completely fine.',
    'I am reading from the same screen you would see yourself.',
    'The reference I gave you is printed on the letter too.',
    'We are open until six if you would rather call back later.',
    'That is everything I needed from my side.',
  ],
};

const NEW = {
  email: [...OLD.email, ...EXTRA.email],
  chat: [...OLD.chat, ...EXTRA.chat],
  call: [...OLD.call, ...EXTRA.call],
};

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let replaced = 0;
  let lessons = 0;

  for (const m of mods.docs) {
    // Unique within a module: the complaint was two lessons of the SAME
    // module sharing a line, which is where repetition is most visible.
    const usedInModule = new Set();
    const snap = await m.ref.collection('lessons').orderBy('sequenceOrder').get()
      .catch(() => m.ref.collection('lessons').get());

    for (const doc of snap.docs) {
      const sections = doc.data().sections || [];
      const idx = sections.findIndex((x) => x.kind === 'tells');
      if (idx < 0) continue;

      const sec = sections[idx];
      const channel = NEW[sec.channel] ? sec.channel : 'email';
      const pool = NEW[channel];
      const recognised = new Set(OLD[channel]);
      const seed = `${m.id}:${doc.id}`;
      const inThisExercise = new Set((sec.lines || []).map((l) => l.text));

      let n = 0;
      let changed = false;
      const lines = (sec.lines || []).map((l) => {
        if (l.phrase || !recognised.has(l.text)) return l; // a tell, or authored
        const start = hash(`${seed}:clean:${n}`) % pool.length;
        let chosen = null;
        for (let k = 0; k < pool.length; k++) {
          const cand = pool[(start + k) % pool.length];
          if (usedInModule.has(cand) || inThisExercise.has(cand)) continue;
          chosen = cand;
          break;
        }
        n++;
        if (chosen == null) return l; // pool exhausted for this module
        inThisExercise.delete(l.text);
        inThisExercise.add(chosen);
        usedInModule.add(chosen);
        replaced++;
        changed = true;
        return { ...l, text: chosen };
      });

      if (!changed) continue;
      lessons++;
      console.log(`  ${apply ? 'wrote' : 'would write'} ${m.data().title} / ${doc.data().title} (${channel})`);
      const next = sections.slice();
      next[idx] = { ...sec, lines };
      if (apply) await doc.ref.set({ sections: next }, { merge: true });
    }
  }

  console.log(`\n${replaced} filler line(s) re-drawn across ${lessons} exercise(s), pool 8 -> 20 per channel.`);
  if (!apply) console.log('\nDRY RUN - nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
