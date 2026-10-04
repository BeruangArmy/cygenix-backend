// The rebrand that missed the bosses.
//
// rebrand.js swept a top-level 'bosses' collection. There isn't one — a boss
// lives at modules/{moduleId}/boss/main, so every encounter kept its old
// domains while the lessons and quiz questions around it moved. A boss turn
// still reading "helpdesk@venator-it.co" is the most visible place to get
// this wrong: the whole encounter is about reading a sender address.
//
//   node rebrand-bosses.js            dry run
//   node rebrand-bosses.js --apply    write it
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const apply = process.argv.includes('--apply');

// Same rules as rebrand.js: venatorcorp/venator<domainish> -> vasbcorp,
// the bare word -> VASB. Lookalikes move with the real domain or they stop
// being near-misses of anything.
function rebrand(text) {
  return text.replace(/venat(?:0|o)r(corp)?/gi, (match, corp, offset, full) => {
    const after = full.slice(offset + match.length);
    const domain = !!corp || /^[.-][a-z0-9]/i.test(after);
    const zero = /0/.test(match);
    if (match === match.toUpperCase()) return domain ? 'VASBCORP' : 'VASB';
    if (match[0] === match[0].toUpperCase()) return domain ? 'Vasbcorp' : 'VASB';
    // Keep a deliberate homoglyph a homoglyph: venat0r -> vasbc0rp.
    if (zero && domain) return 'vasbc0rp';
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
  return o;
};

(async () => {
  const snap = await db.collectionGroup('boss').get();
  let docs = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!/venat/i.test(JSON.stringify(data))) continue;
    const before = changed;
    const next = deep(data);
    docs++;
    console.log(`  ${apply ? 'fixed' : 'would fix'} ${d.ref.parent.parent.id} / ${data.name || '(unnamed)'}  (${changed - before} strings)`);
    if (apply) await d.ref.set(next);
  }
  console.log(`\n${changed} string(s) across ${docs} boss document(s).`);
  if (!apply) console.log('\nDRY RUN - nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
