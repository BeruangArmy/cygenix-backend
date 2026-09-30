// venatorcorp.com -> vasbcorp.com, for accounts that already exist.
//
// Both sides have to move or logins break: Firebase Auth holds the address
// people sign in with, and the Firestore user document holds a copy that the
// roster, leaderboard and reports read. This updates Auth first (the one that
// can actually fail — a duplicate address, a disabled user) and only writes
// the Firestore copy once Auth has accepted, so the two never disagree.
//
//   node migrate-domain.js                  dry run, prints every change
//   node migrate-domain.js --only <uid> --apply   migrate one account
//   node migrate-domain.js --apply                migrate the rest
//   node migrate-domain.js --rollback <file>      put them all back
//
// Every --apply writes a rollback file first: uid -> the address it had.
require('dotenv').config();
const fs = require('fs');
const admin = require('firebase-admin');
const { db } = require('./src/firebaseAdmin');

const FROM = '@venatorcorp.com';
const TO = '@vasbcorp.com';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
const rollbackAt = args.indexOf('--rollback');
const rollbackFile = rollbackAt >= 0 ? args[rollbackAt + 1] : null;

const swap = (email) => email.slice(0, -FROM.length) + TO;

async function listAllAuthUsers() {
  const out = [];
  let token;
  do {
    const page = await admin.auth().listUsers(1000, token);
    out.push(...page.users);
    token = page.pageToken;
  } while (token);
  return out;
}

async function rollback(file) {
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`rolling back ${Object.keys(map).length} accounts from ${file}\n`);
  for (const [uid, oldEmail] of Object.entries(map)) {
    try {
      await admin.auth().updateUser(uid, { email: oldEmail });
      await db.collection('users').doc(uid).set({ email: oldEmail }, { merge: true });
      console.log(`  restored ${uid} -> ${oldEmail}`);
    } catch (e) {
      console.log(`  FAILED  ${uid}: ${e.message}`);
    }
  }
  console.log('\nrollback complete.');
}

(async () => {
  if (rollbackFile) { await rollback(rollbackFile); process.exit(0); }

  const users = await listAllAuthUsers();
  const targets = users.filter((u) => {
    if (!u.email || !u.email.toLowerCase().endsWith(FROM)) return false;
    if (only && u.uid !== only) return false;
    return true;
  });

  const skipped = users.filter((u) => u.email && !u.email.toLowerCase().endsWith(FROM));
  console.log(`${users.length} auth accounts total`);
  if (skipped.length) {
    console.log('\nNOT on the old domain, left alone:');
    for (const u of skipped) console.log(`  ${u.email}`);
  }

  console.log(`\n${apply ? 'MIGRATING' : 'WOULD MIGRATE'} (${targets.length}):`);
  for (const u of targets) console.log(`  ${u.email}  ->  ${swap(u.email)}   ${u.uid}`);

  if (!targets.length) { console.log('\nnothing to do.'); process.exit(0); }

  if (!apply) {
    console.log('\nDRY RUN — nothing was changed. Add --apply to perform it.');
    process.exit(0);
  }

  // Rollback map written before a single account is touched.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = `rollback-${stamp}.json`;
  fs.writeFileSync(file, JSON.stringify(
    Object.fromEntries(targets.map((u) => [u.uid, u.email])), null, 2), 'utf8');
  console.log(`\nrollback map written to ${file}\n`);

  let ok = 0, failed = 0;
  for (const u of targets) {
    const next = swap(u.email);
    try {
      // Auth first: if this throws, the Firestore copy is untouched and the
      // account still logs in with the address it had.
      await admin.auth().updateUser(u.uid, { email: next });
      await db.collection('users').doc(u.uid).set({ email: next }, { merge: true });
      console.log(`  ok      ${u.email} -> ${next}`);
      ok++;
    } catch (e) {
      console.log(`  FAILED  ${u.email}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${ok} migrated, ${failed} failed.`);
  console.log(`Undo with:  node migrate-domain.js --rollback ${file}`);
  if (failed) process.exit(1);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
