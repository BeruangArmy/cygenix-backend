// Set an admin account's password.
//
// There is no password anywhere in this repo and there should not be: admin
// identity is Firebase Auth, and promotion to admin is a manual Firestore
// Console edit (the rules block self-serve admin). So changing an admin
// password is an Auth operation, not a code change — this script is the
// Admin SDK way to do it.
//
// The new password is read from argv, never stored here. Nothing is written
// to disk and the password is never printed back.
//
//   node set-admin-pw.js admin@vasbcorp.com 'TheNewPassword'
//
// Refuses to touch an account whose user doc is not role: admin, so a typo in
// the email cannot silently reset an employee's password.
require('dotenv').config();
const { auth, db } = require('./src/firebaseAdmin');

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node set-admin-pw.js <email> <newPassword>');
  console.error("Wrap the password in single quotes so the shell leaves it alone.");
  process.exit(1);
}

// The same policy the register screen enforces (see
// flutter_app/lib/password_rules.dart) — an admin password should not be
// weaker than the one an employee is held to.
function problemWith(pw) {
  if (pw.length < 6) return 'must be at least 6 characters';
  if (!/[a-z]/.test(pw)) return 'needs a lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'needs an uppercase letter';
  if (!/[0-9]/.test(pw)) return 'needs a number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'needs a symbol';
  return null;
}

(async () => {
  const weak = problemWith(password);
  if (weak) {
    console.error(`That password ${weak}. Pick another one.`);
    process.exit(1);
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    console.error(`No Firebase Auth account for ${email} (${e.code || e.message}).`);
    process.exit(1);
  }

  const doc = await db.collection('users').doc(user.uid).get();
  const role = doc.exists ? doc.data().role : null;
  if (role !== 'admin') {
    console.error(`${email} is role: ${role || '(no user doc)'}, not admin. Refusing.`);
    console.error('Promote the account in the Firestore Console first if that is what you meant.');
    process.exit(1);
  }

  await auth.updateUser(user.uid, { password });
  // Existing sessions keep working on a password change; revoking them makes
  // the change mean what people assume it means.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`Password updated for ${email} (${user.uid}).`);
  console.log('Existing sessions revoked — sign in again on the device.');
  process.exit(0);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
