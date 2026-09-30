// Fixes exactly what audit-content.js reported: 3 stale domain references and
// 14 tells with no explanation. Nothing else is touched.
//
// The domain migration rewrote code and rules but not Firestore content, so
// three lessons still tell people to mail it-support@venatorcorp.com — an
// address that no longer resolves. That is worse than cosmetic: it is the
// reporting instruction in an incident lesson.
//
// The missing explanations are tier-1 tells that predate the explain field.
// Without one the reader is told a phrase was the tell and never why, which
// is the difference between a quiz and a lesson.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

// phrase -> why it is the tell
const EXPLAIN = {
  're-validate your credentials':
    'No service asks you to re-enter a password to keep an account open. Re-validation is not a thing that exists; the word is there to make typing your password sound like maintenance.',
  'within 24 hours or your messages will be permanently deleted':
    'A deadline you cannot verify, attached to a loss you cannot afford. Real providers warn about quota for weeks and never delete mail as a penalty.',
  'reply to this email with your username and password':
    'Credentials sent by email sit in two mailboxes and every backup of both. No system needs them sent anywhere — it already has them.',
  'full card number and address':
    'A courier already has the delivery address, and never needs a card number to redeliver. Being asked for what they should already hold is the tell.',
  'within 12 hours or the parcel returns to sender':
    'The deadline exists to stop you opening the courier app and checking, which would take less time than reading the text.',
  'customs fee of RM 3.50 is required':
    'The amount is deliberately trivial. A sum too small to argue about is easier to pay than to verify, and the card details are the real target.',
  'Confirm your network password':
    'IT can reset your password without ever knowing it. Anyone who needs you to say it out loud is not IT.',
  'install a remote support tool':
    'That hands over the machine completely — screen, files, saved sessions. Genuine support deploys its tooling to managed devices, it does not talk you through installing one.',
  'hanging up will lock your account':
    'Invented to keep you on the line, because the call ending is what breaks the attack. Hanging up has never locked anything.',
  'just stay on with me':
    'Staying on the line stops you doing the one thing that would end this: hanging up and calling back on a number you chose.',
  'only got a minute before my next call':
    'Manufactured scarcity. The rush is not their schedule, it is the window in which you have not yet checked.',
  'the six digits on your phone':
    'A one-time code proves you are you, to the service, not to a caller. Reading it out hands over exactly the thing the second factor exists to protect.',
  'call me straight back on this line':
    'A callback only verifies anything if you choose the number. Calling back the line they gave you reaches the same person every time.',
  'confirm my employee ID':
    'Partial cooperation is still cooperation. An employee ID is the detail that makes the next call, to someone else, sound legitimate.',
};

const STALE = /venatorcorp/gi;
const apply = process.argv.includes('--apply');

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let domainFixed = 0; let explained = 0;

  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const doc of lessons.docs) {
      const sections = doc.data().sections || [];
      let touched = false;

      const next = sections.map((sec) => {
        let s = sec;

        // --- stale domain, anywhere a string lives in the section
        const swap = (v) => {
          if (typeof v !== 'string' || !STALE.test(v)) return v;
          STALE.lastIndex = 0;
          const out = v.replace(STALE, 'vasbcorp');
          if (out !== v) { touched = true; domainFixed++; }
          return out;
        };
        const deep = (o) => {
          if (typeof o === 'string') return swap(o);
          if (Array.isArray(o)) return o.map(deep);
          if (o && typeof o === 'object') {
            return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)]));
          }
          return o;
        };
        s = deep(s);

        // --- missing explanations
        if (s.kind === 'tells') {
          s = {
            ...s,
            lines: (s.lines || []).map((l) => {
              if (!l.phrase || (l.explain || '').trim()) return l;
              const e = EXPLAIN[l.phrase];
              if (!e) return l;
              touched = true; explained++;
              return { ...l, explain: e };
            }),
          };
        }
        return s;
      });

      if (touched) {
        console.log(`  ${apply ? 'fixed' : 'would fix'}: ${m.data().title} / ${doc.data().title}`);
        if (apply) await doc.ref.set({ sections: next }, { merge: true });
      }
    }
  }

  console.log(`\n${domainFixed} stale domain string(s), ${explained} explanation(s) added`);
  if (!apply) console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
