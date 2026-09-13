// Batch item 4 — a deeper daily-drill pool.
//
// The drill serves one item per user per day and holds back anything already
// answered, so the pool size is literally how many days it lasts before
// repeating. Nine was a week and a half. This takes it past a month, with at
// least one item drawn from each module's subject so the drill reinforces the
// same ground the lessons cover.
//
// Still a deliberate mix of genuine and malicious: a pool that is all
// phishing teaches people to press Phish every time.
//
// Re-runnable: keyed by slug.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const D = (slug, sender, senderEmail, subject, body, isPhish, tell) =>
  ({ slug, sender, senderEmail, subject, body, isPhish, tell });

const DRILLS = [
  // ---------------------------------------------------------- phishing
  D('ph-storage', 'Microsoft 365', 'no-reply@m365-storage.net',
    'Your mailbox is almost full',
    'Free up space now or incoming mail will start bouncing. Review storage here.',
    true, 'm365-storage.net is not microsoft.com. Storage warnings come from inside your mail client, not a link.'),
  D('ph-hr-policy', 'People Team', 'people@venator.com',
    'Updated leave policy from 1 October',
    'The handbook has been updated. It is on the intranet under People > Policies.',
    false, 'Internal domain, points at the intranet you already use, asks for nothing.'),
  D('ph-shared-doc', 'Aisha Rahim', 'aisha.rahim@venator.com',
    'Shared: Q3 handover notes',
    'Adding you to the handover doc ahead of Thursday. No action needed today.',
    false, 'A real colleague on the real domain, about work you are expecting.'),
  D('ph-password-expiry', 'IT Security', 'alerts@venator-secure.com',
    'Your password expires in 2 hours',
    'Re-enter your current password to keep your account active.',
    true, 'Venator-secure.com is not venator.com, and no system asks for your CURRENT password to extend it.'),

  // ---------------------------------------------------------- smishing
  D('sm-bank-otp', 'MayBank', '+60 13-770 2288',
    'Transaction alert: RM 4,820 to a new payee',
    'If this was not you, verify immediately by replying with the OTP we just sent.',
    true, 'A bank will never ask you to send an OTP back. The scary number exists to rush you.'),
  D('sm-2fa-real', 'Venator IT', '62221',
    'Your verification code is 418 220',
    'This code expires in 5 minutes. We will never ask you for it.',
    false, 'A code you requested yourself, and it says outright that nobody will ask for it.'),
  D('sm-prize', 'Contest', '+60 17-224 9910',
    'You have won a RM 1,000 voucher',
    'Claim within 24 hours. Reply YES to confirm your details.',
    true, 'You did not enter anything. Replying only proves the number is live.'),

  // ---------------------------------------------------------- vishing
  D('vs-callback', 'Service Desk', '+60 3-2856 1122',
    'Missed call — voicemail left',
    'A ticket you raised has been updated. Call the desk back on the number in the directory.',
    false, 'It tells you to use the directory number rather than a number it supplies.'),
  D('vs-mfa-call', '"IT Support"', 'Caller ID withheld',
    'We need to verify your identity',
    'Read back the six-digit code on your screen so we can confirm it is really you.',
    true, 'Nobody legitimate needs the code on your screen. That code IS the login.'),

  // ---------------------------------------------------------- BEC
  D('bec-bank-change', 'Supplier Accounts', 'accounts@nexovendor-pay.com',
    'Updated bank details for future invoices',
    'Please update our account on file before the next payment run. New details attached.',
    true, 'Bank-detail changes are verified by phone on the number already on file, never from the email asking.'),
  D('bec-po-confirm', 'Procurement', 'procurement@venator.com',
    'PO-4471 approved',
    'Your purchase order has been approved and sent to the supplier. No action needed.',
    false, 'Internal, references a PO you can look up, and asks for nothing.'),
  D('bec-gift-cards', 'Dato’ Rahman', 'rahman.venator@gmail.com',
    'Are you free? Quick task',
    'In meetings all day. Need you to buy gift cards for a client and send the codes.',
    true, 'Gmail address, cannot be called, and gift cards are the classic unrecoverable payment.'),

  // ---------------------------------------------------------- malware
  D('mw-resume', 'Careers', 'careers-reply@venator-hiring.net',
    'Candidate CV for the analyst role',
    'CV attached as a macro-enabled document. Enable content to view the formatting.',
    true, 'A CV has no reason to need macros. Enable Content is where a document becomes a program.'),
  D('mw-update', 'IT Service Desk', 'servicedesk@venator.com',
    'Laptop updates install tonight at 7pm',
    'Leave your machine on and plugged in. Nothing to click.',
    false, 'Right domain, no link, no attachment, no request.'),
  D('mw-usb', 'Facilities', 'facilities@venator.com',
    'Lost property: USB drives at reception',
    'Several drives were handed in. Collect from reception — do not plug in drives you find.',
    false, 'Internal notice that actually reinforces the right behaviour.'),

  // ---------------------------------------------------------- passwords
  D('pw-breach-real', 'Venator IT', 'servicedesk@venator.com',
    'Password reset required after a third-party breach',
    'Reset from the company portal you normally use. This email contains no link on purpose.',
    false, 'Deliberately link-free and tells you to use the portal you already know.'),
  D('pw-manager-phish', 'LastPass', 'security@lastpass-alerts.co',
    'Master password compromised',
    'Confirm your master password immediately to secure your vault.',
    true, 'No password manager will ever ask for your master password by email.'),

  // ---------------------------------------------------------- MFA
  D('mfa-approve', 'Microsoft Authenticator', 'push notification',
    'Approve sign-in from Jakarta?',
    'A sign-in is waiting for approval. You are not signing in to anything right now.',
    true, 'A prompt you did not start means someone else has your password. Deny and report.'),
  D('mfa-enrol', 'Venator IT', 'servicedesk@venator.com',
    'MFA enrolment window opens Monday',
    'Book a slot on the intranet. Bring the phone you want to enrol.',
    false, 'Internal, scheduled, and asks for nothing you would type.'),

  // ---------------------------------------------------------- pretexting
  D('pt-auditor', '"Wei Ling, external audit"', 'w.ling@audit-partners.org',
    'Quick controls question',
    'Suresh suggested I ask you directly — who can approve a payment without a second signature?',
    true, 'Borrowed authority plus a question that maps your controls. Verify through your manager.'),
  D('pt-newstarter', 'People Team', 'people@venator.com',
    'New starter in Finance on Monday',
    'Aiman joins the AP team. Building access is arranged; no action needed from you.',
    false, 'An announcement, not a request.'),

  // ---------------------------------------------------------- reporting
  D('ir-thanks', 'Security Operations', 'soc@venator.com',
    'Thanks — the message you reported was malicious',
    'It was pulled from other inboxes this morning. Nothing further needed from you.',
    false, 'A follow-up on something you did, from the internal domain, asking nothing.'),
  D('ir-fake-soc', '"Security Operations"', 'soc@venator-security.info',
    'Confirm you did not open the attachment',
    'Reply with your username and the last page you visited so we can clear your machine.',
    true, 'Look-alike domain, and a real SOC does not collect your username by reply.'),
];

(async () => {
  let wrote = 0, skipped = 0;
  for (const d of DRILLS) {
    const { slug, ...rest } = d;
    const ref = db.collection('drillItems').doc(slug);
    if ((await ref.get()).exists) { skipped++; continue; }
    await ref.set({ ...rest, active: true });
    wrote++;
  }
  const all = await db.collection('drillItems').get();
  const phish = all.docs.filter((d) => d.data().isPhish === true).length;
  console.log(`wrote ${wrote}, already present ${skipped}`);
  console.log(`pool is now ${all.size} items — ${phish} phish / ${all.size - phish} legit`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
