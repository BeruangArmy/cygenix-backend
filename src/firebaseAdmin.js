const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Two shapes have to work here. In a local .env, dotenv already strips the
  // surrounding quotes, leaving literal \n escapes. Pasted into a hosting
  // dashboard (Render et al), the value is stored verbatim — so the quotes
  // become part of the string and OpenSSL rejects the key with
  // "DECODER routines::unsupported". Strip any wrapping quotes first, then
  // turn the \n escapes into real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Copy .env.example to .env and fill in ' +
      'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY from a ' +
      'service account key generated in Firebase Console > Project Settings > Service Accounts.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
