// Account approvals: new sign-ups wait as pending until an admin decides.
//
// Every route here is adminOnly. The decision itself must not be
// client-decidable — it writes `status`, which the Firestore rules forbid any
// client from touching (see the hasOnly list on users/{uid}) — so it lives
// behind the Admin SDK like every other earned-progress write in this app.
const express = require('express');
const { db, admin } = require('../firebaseAdmin');
const { verifyToken, adminOnly } = require('../middleware/auth');
const { notify } = require('../notifications');
const { sendPush } = require('../push');

const router = express.Router();

// Firestore's limit is 500 writes per batch. Each approval writes the user
// document plus one notification, so a chunk of 200 accounts is 400 writes —
// comfortably inside it with room for the notification's own prune.
const CHUNK = 200;

// Sorted in memory, not with orderBy().
//
// orderBy() does not merely sort, it filters: a document missing the field is
// dropped from the result entirely. `decidedAt` only exists after a decision,
// and sorting the pending list by it would have returned nothing at all.
function byNewest(field) {
  return (a, b) => {
    const at = (a[field] && a[field].toMillis) ? a[field].toMillis() : 0;
    const bt = (b[field] && b[field].toMillis) ? b[field].toMillis() : 0;
    return bt - at;
  };
}

function toMs(ts) {
  return ts && ts.toMillis ? ts.toMillis() : null;
}

function shape(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    fullName: d.fullName || '',
    employeeId: d.employeeId || '',
    departmentName: d.departmentName || '',
    email: d.email || '',
    status: d.status || 'approved',
    rejectReason: d.rejectReason || '',
    createdAt: toMs(d.createdAt),
    decidedAt: toMs(d.decidedAt),
  };
}

// GET /admin/approvals?status=pending|rejected
router.get('/admin/approvals', verifyToken, adminOnly, async (req, res) => {
  const status = (req.query.status || 'pending').toString();
  if (status !== 'pending' && status !== 'rejected') {
    return res.status(400).json({ error: "status must be 'pending' or 'rejected'." });
  }
  try {
    const snap = await db.collection('users').where('status', '==', status).get();
    const rows = snap.docs.map(shape);
    rows.sort(byNewest(status === 'pending' ? 'createdAt' : 'decidedAt'));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load approvals.', detail: err.message });
  }
});

// GET /admin/approvals/count — just the badge number on the nav.
router.get('/admin/approvals/count', verifyToken, adminOnly, async (req, res) => {
  try {
    const snap = await db.collection('users').where('status', '==', 'pending').count().get();
    res.json({ pending: snap.data().count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count approvals.', detail: err.message });
  }
});

/** Writes one decision and tells the employee about it. */
async function decide(uid, { status, reason, adminUid }) {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new Error(`No account ${uid}`);

  const patch = {
    status,
    decidedAt: admin.firestore.FieldValue.serverTimestamp(),
    decidedBy: adminUid,
  };
  // Clearing the reason matters on "Approve instead" from the Rejected tab:
  // leaving a stale rejection reason on an approved account would show up
  // the next time anyone read the document.
  patch.rejectReason = status === 'rejected' ? (reason || '') : '';
  // Undo returns the account to the queue, so the decision fields go with it.
  if (status === 'pending') {
    patch.decidedAt = admin.firestore.FieldValue.delete();
    patch.decidedBy = admin.firestore.FieldValue.delete();
    patch.rejectReason = '';
  }
  await userRef.set(patch, { merge: true });

  // Undo is a correction, not an event — the employee should not be told
  // they were approved and then told nothing when it is taken back.
  if (status === 'pending') return;

  const approved = status === 'approved';
  const title = approved ? 'Your account is approved' : 'Your account was not approved';
  const body = approved
    ? 'You can start your training now.'
    : (reason ? reason : 'Please contact IT Support for help.');

  // critical: an account decision must reach someone who muted notifications.
  await notify(uid, { type: approved ? 'account_approved' : 'account_rejected', title, body, critical: true });
  await sendPush(uid, { title, body, data: { type: approved ? 'account_approved' : 'account_rejected' } });
}

// POST /admin/approvals/:uid/approve
router.post('/admin/approvals/:uid/approve', verifyToken, adminOnly, async (req, res) => {
  try {
    await decide(req.params.uid, { status: 'approved', adminUid: req.user.uid });
    res.json({ ok: true, status: 'approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve.', detail: err.message });
  }
});

// POST /admin/approvals/:uid/reject   body: { reason? }
router.post('/admin/approvals/:uid/reject', verifyToken, adminOnly, async (req, res) => {
  try {
    const reason = (req.body?.reason || '').toString().trim().slice(0, 500);
    await decide(req.params.uid, { status: 'rejected', reason, adminUid: req.user.uid });
    res.json({ ok: true, status: 'rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject.', detail: err.message });
  }
});

// POST /admin/approvals/bulk-approve   body: { uids: [] }
//
// All-or-nothing per chunk. The client's error state says "Nothing was
// changed", so a half-applied batch would make that message a lie: the user
// documents and their notifications go in one committed batch, and a failure
// throws before the next chunk starts.
router.post('/admin/approvals/bulk-approve', verifyToken, adminOnly, async (req, res) => {
  const uids = Array.isArray(req.body?.uids) ? req.body.uids.filter((u) => typeof u === 'string') : [];
  if (uids.length === 0) return res.status(400).json({ error: 'uids must be a non-empty array.' });

  try {
    const approved = [];
    for (let i = 0; i < uids.length; i += CHUNK) {
      const slice = uids.slice(i, i + CHUNK);
      const snaps = await db.getAll(...slice.map((u) => db.collection('users').doc(u)));

      const batch = db.batch();
      const live = [];
      snaps.forEach((snap) => {
        // Skip anyone already decided between the list loading and the tap —
        // approving an account twice would resend the notification.
        if (!snap.exists || (snap.data().status || 'approved') !== 'pending') return;
        live.push(snap.id);
        batch.set(snap.ref, {
          status: 'approved',
          rejectReason: '',
          decidedAt: admin.firestore.FieldValue.serverTimestamp(),
          decidedBy: req.user.uid,
        }, { merge: true });
        batch.create(db.collection('users').doc(snap.id).collection('notifications').doc(), {
          type: 'account_approved',
          title: 'Your account is approved',
          body: 'You can start your training now.',
          meta: {},
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      if (live.length === 0) continue;
      await batch.commit();
      approved.push(...live);
    }

    // Push is best-effort and deliberately outside the batch: a device that
    // has no token, or whose token has expired, must not undo an approval
    // that is already committed.
    await Promise.all(approved.map((uid) => sendPush(uid, {
      title: 'Your account is approved',
      body: 'You can start your training now.',
      data: { type: 'account_approved' },
    }).catch(() => {})));

    res.json({ ok: true, approved: approved.length, uids: approved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve the selected accounts.', detail: err.message });
  }
});

// POST /admin/approvals/revert   body: { uids: [] }
//
// Undo, for every flavour of decision — one approve, one reject, or a whole
// bulk batch. Puts the accounts back in the queue and clears the decision.
router.post('/admin/approvals/revert', verifyToken, adminOnly, async (req, res) => {
  const uids = Array.isArray(req.body?.uids) ? req.body.uids.filter((u) => typeof u === 'string') : [];
  if (uids.length === 0) return res.status(400).json({ error: 'uids must be a non-empty array.' });
  try {
    for (let i = 0; i < uids.length; i += CHUNK) {
      const batch = db.batch();
      uids.slice(i, i + CHUNK).forEach((uid) => {
        batch.set(db.collection('users').doc(uid), {
          status: 'pending',
          rejectReason: '',
          decidedAt: admin.firestore.FieldValue.delete(),
          decidedBy: admin.firestore.FieldValue.delete(),
        }, { merge: true });
      });
      await batch.commit();
    }
    res.json({ ok: true, reverted: uids.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to undo.', detail: err.message });
  }
});

module.exports = router;
