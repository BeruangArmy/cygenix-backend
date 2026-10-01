// Finishes the venator -> vasb rebrand in CONTENT.
//
// migrate-domain.js moved the thing that would have broken logins: the
// addresses in Firebase Auth and the copy on each user document. It never
// touched a word of lesson, quiz or drill content, and the content audit
// searched for the string "venatorcorp" only — so every bare "venator.com"
// and every "Venator" written as the company name survived untouched.
//
// The result is an app that teaches one company and quizzes another: a
// lesson shows "VASB IT Operations <it-ops@vasbcorp.com>" and the quiz two
// screens later asks about "venator.com/login".
//
// Three shapes, by what follows the word:
//   venatorcorp.com     -> vasbcorp.com        (already domain-stemmed)
//   venator.com         -> vasbcorp.com        (bare domain)
//   venator-hr.co       -> vasbcorp-hr.co      (deliberate lookalikes: they
//                                               only read as near-misses of
//                                               the REAL domain, so they have
//                                               to move with it)
//   Venator IT          -> VASB IT             (the company, as a word)
//
//   node rebrand.js            dry run, prints every change
//   node rebrand.js --apply    write it
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

function rebrand(text) {
  return text.replace(/venator(corp)?/gi, (match, corp, offset, full) => {
    const after = full.slice(offset + match.length);
    // A "." or "-" followed by more label is a domain, not prose.
    const domain = !!corp || /^[.-][a-z0-9]/i.test(after);
    if (match === match.toUpperCase()) return domain ? 'VASBCORP' : 'VASB';
    if (match[0] === match[0].toUpperCase()) return domain ? 'Vasbcorp' : 'VASB';
    return domain ? 'vasbcorp' : 'vasb';
  });
}

let changed = 0;
const deep = (o) => {
  if (typeof o === 'string') {
    const out = rebrand(o);
    if (out !== o) changed++;
    return out;
  }
  if (Array.isArray(o)) return o.map(deep);
  if (o && typeof o === 'object' && o.constructor === Object) {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)]));
  }
  return o; // Timestamps, refs and the like pass through untouched.
};

const HIT = /venator/i;
const touched = (o) => HIT.test(JSON.stringify(o));

async function sweep(ref, label) {
  const snap = await ref.get().catch(() => null);
  if (!snap) return 0;
  let docs = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!touched(data)) continue;
    const before = changed;
    const next = deep(data);
    docs++;
    const name = data.title || data.questionText || data.subject || d.id;
    console.log(`  ${apply ? 'fixed' : 'would fix'} [${label}] ${String(name).slice(0, 62)}  (${changed - before} string${changed - before === 1 ? '' : 's'})`);
    if (apply) await d.ref.set(next);
  }
  return docs;
}

(async () => {
  let docs = 0;
  const mods = await db.collection('modules').orderBy('order').get();
  for (const m of mods.docs) {
    docs += await sweep(m.ref.collection('lessons'), `${m.data().title} · lesson`);
    docs += await sweep(m.ref.collection('quizQuestions'), `${m.data().title} · quiz`);
    // The module document itself can carry the name too.
    const md = m.data();
    if (touched(md)) {
      docs++; const before = changed;
      const next = deep(md);
      console.log(`  ${apply ? 'fixed' : 'would fix'} [module] ${md.title}  (${changed - before} strings)`);
      if (apply) await m.ref.set(next);
    }
  }
  for (const col of ['drillItems', 'bosses', 'badges', 'departments', 'challenges']) {
    docs += await sweep(db.collection(col), col);
  }

  console.log(`\n${changed} string(s) across ${docs} document(s).`);
  if (!apply) console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
