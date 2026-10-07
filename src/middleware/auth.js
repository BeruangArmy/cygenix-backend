const { auth, db } = require('../firebaseAdmin');

// Verifies the Firebase ID token Flutter sends as `Authorization: Bearer <token>`
// (obtained from FirebaseAuth.instance.currentUser.getIdToken()). We trust
// Firebase Auth as the identity provider rather than issuing our own JWTs,
// so there's exactly one place a password is ever checked.
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization: Bearer <idToken> header.' });

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) return res.status(403).json({ error: 'No user profile found for this account.' });
    req.userDoc = { id: userDoc.id, ...userDoc.data() };

    // Account approval, enforced here rather than per route.
    //
    // Every API route in this app goes through verifyToken, so this is the
    // one place that cannot be forgotten when a route is added later. The
    // Firestore rules gate direct reads; this gates everything that reaches
    // the Admin SDK, which bypasses those rules entirely.
    //
    // A missing status means approved — accounts that predate this feature
    // have no status field and must keep working. Admins are never gated.
    //
    // Nothing a waiting user needs lives behind this: the Waiting screen
    // reads its own user document straight from Firestore, and the FCM token
    // is written to that same document, so neither needs an API call.
    const status = req.userDoc.status || 'approved';
    if (status !== 'approved' && req.userDoc.role !== 'admin') {
      return res.status(403).json({
        error: status === 'rejected'
          ? 'This account was not approved.'
          : 'This account is waiting for admin approval.',
        status,
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.', detail: err.message });
  }
}

function adminOnly(req, res, next) {
  if (req.userDoc?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  next();
}

module.exports = { verifyToken, adminOnly };
