// Sets the department list to exactly the seven the company uses, and
// re-points every existing user at the right one.
//
// The old list was HR / IT / Finance / Operations. Three of those are renamed
// rather than removed, so users carrying them are remapped instead of being
// left pointing at a department id that no longer exists — the registration
// dropdown reads `departments`, but the admin roster and the squad label on
// the Base page read `departmentName` off the user document, so both sides
// have to move together or the two disagree.
//
// Run `node seed-depts.js` for a dry run; add --apply to write.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const DEPARTMENTS = [
  'Human Resources',
  'Finance',
  'Procurement',
  'Engineering',
  'Operation',
  'EHSQ',
  'Information Technology',
];

const idFor = (name) => `department_${name.replace(/[^A-Za-z0-9]+/g, '_')}`;

// Old name -> new name. Anything not listed keeps whatever it has and is
// reported, rather than being silently reassigned to a guess.
const REMAP = {
  HR: 'Human Resources',
  IT: 'Information Technology',
  Operations: 'Operation',
  Finance: 'Finance',
};

const apply = process.argv.includes('--apply');

(async () => {
  const existing = await db.collection('departments').get();
  const keep = new Set(DEPARTMENTS.map(idFor));

  console.log('DEPARTMENTS');
  for (const name of DEPARTMENTS) {
    const id = idFor(name);
    const had = existing.docs.find((d) => d.id === id);
    console.log(`  ${had ? 'keep  ' : 'create'}  ${id}  (${name})`);
    if (apply) await db.collection('departments').doc(id).set({ name }, { merge: true });
  }
  for (const d of existing.docs) {
    if (keep.has(d.id)) continue;
    console.log(`  remove  ${d.id}  (${d.data().name})`);
    if (apply) await d.ref.delete();
  }

  console.log('\nUSERS');
  const users = await db.collection('users').get();
  let moved = 0, unchanged = 0, unknown = 0;
  for (const u of users.docs) {
    const data = u.data();
    const current = data.departmentName;
    if (!current) { continue; }
    const target = REMAP[current] || (DEPARTMENTS.includes(current) ? current : null);
    if (target === null) {
      console.log(`  ?? ${data.email}: "${current}" has no mapping — left as is`);
      unknown++;
      continue;
    }
    if (target === current && data.departmentId === idFor(target)) { unchanged++; continue; }
    console.log(`  -> ${data.email}: "${current}" => "${target}"`);
    if (apply) {
      await u.ref.set({ departmentName: target, departmentId: idFor(target) }, { merge: true });
    }
    moved++;
  }

  console.log(`\n${moved} users remapped, ${unchanged} already correct, ${unknown} unmapped`);
  if (!apply) console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
