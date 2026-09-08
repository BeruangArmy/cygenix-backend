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
