// A safe exit no longer ends a boss encounter — it survives the turn and the
// attacker escalates (see routes/loop.js). The seeded replies for those
// options still read as endings ("the line goes quiet, then dead"), which now
// contradicts what happens next. This rewrites the non-final ones.
//
// The reply on the LAST turn is left alone: there, a pass really is the end.
// Re-runnable: it only rewrites replies it has not already rewritten.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const ESCALATIONS = [
  'You hold the line. A pause — then they come at it from another angle.',
  'Refused. They do not hang up; they try something else.',
  'You do not budge. The pressure shifts rather than stopping.',
  'Held. They regroup, and the story gets a little bigger.',
];

(async () => {
  const mods = await db.collection('modules').get();
  let touched = 0, bosses = 0;

  for (const m of mods.docs) {
    const ref = m.ref.collection('boss').doc('main');
    const snap = await ref.get();
    if (!snap.exists) continue;
    const boss = snap.data();
    const turns = boss.turns || [];
    if (!turns.length) continue;

    let changed = false;
    turns.forEach((t, ti) => {
      const isLast = ti === turns.length - 1;
      (t.options || []).forEach((o, oi) => {
        if (o.outcome !== 'pass' || isLast) return;
        if (ESCALATIONS.includes(o.reply)) return; // already rewritten
        o.reply = ESCALATIONS[(ti + oi) % ESCALATIONS.length];
        changed = true;
        touched++;
      });
    });

    if (changed) {
      await ref.set({ turns }, { merge: true });
      bosses++;
      console.log('updated:', m.data().title, '->', boss.name);
    }
  }

  console.log(`\ndone — ${touched} replies rewritten across ${bosses} bosses`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
