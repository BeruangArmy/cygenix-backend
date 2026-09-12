// Starter content for Turn 5: the daily-drill pool and one module boss.
//
// Re-runnable: drill items are keyed by a slug so running twice does not
// duplicate them, and the boss is a single doc that is simply rewritten.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

// A deliberate mix — a drill where everything is phishing teaches "always
// press Phish" rather than teaching anyone to read.
const DRILLS = [
  {
    slug: 'payroll-hold',
    sender: 'Payroll Services',
    senderEmail: 'payroll@venator-hr.co',
    subject: 'Your September payslip is on hold',
    body: 'Confirm your bank details by 5pm today or payment will roll to next month\'s run.',
    isPhish: true,
    tell: 'venator-hr.co is not venator.com — and payroll never asks for bank details by email.',
  },
  {
    slug: 'it-maintenance',
    sender: 'IT Service Desk',
    senderEmail: 'servicedesk@venator.com',
    subject: 'Planned maintenance this Saturday 02:00-05:00',
    body: 'File shares and VPN will be unavailable. No action is needed from you.',
    isPhish: false,
    tell: 'Right domain, no link, no request. A notice that asks nothing of you rarely needs suspicion.',
  },
  {
    slug: 'docusign-contract',
    sender: 'DocuSign',
    senderEmail: 'docusign-review@vendor-portal.net',
    subject: 'Contract 8841 awaiting your signature',
    body: 'Review and sign within 48 hours. Click to open the secure document.',
    isPhish: true,
    tell: 'DocuSign sends from docusign.net. vendor-portal.net is somebody else entirely.',
  },
  {
    slug: 'canteen-menu',
    sender: 'Facilities',
    senderEmail: 'facilities@venator.com',
    subject: 'New canteen menu from Monday',
    body: 'The autumn menu is on the intranet. Feedback to the facilities team as usual.',
    isPhish: false,
    tell: 'Internal domain, nothing to click, nothing to confirm.',
  },
  {
    slug: 'mfa-reset',
    sender: 'Microsoft Security',
    senderEmail: 'no-reply@ms-secure-login.com',
    subject: 'Unusual sign-in — reset your MFA',
    body: 'We blocked a sign-in from a new device. Re-register your authenticator now to restore access.',
    isPhish: true,
    tell: 'Microsoft uses microsoft.com. Any mail pushing you to re-register MFA is trying to become your second factor.',
  },
  {
    slug: 'expense-approved',
    sender: 'Finance',
    senderEmail: 'finance@venator.com',
    subject: 'Expense claim EXP-2291 approved',
    body: 'Your claim has been approved and will be paid with this month\'s salary.',
    isPhish: false,
    tell: 'A confirmation of something you did yourself, with no action attached.',
  },
  {
    slug: 'ceo-favour',
    sender: 'Dato’ Rahman',
    senderEmail: 'rahman.ceo@venator-office.com',
    subject: 'Quick favour — are you free?',
    body: 'I am in meetings all day and cannot take calls. Need you to handle something discreetly.',
    isPhish: true,
    tell: 'Off-domain sender, cannot be called, and asks for discretion. Three tells in two lines.',
  },
  {
    slug: 'parcel-fee',
    sender: 'DHL Delivery',
    senderEmail: '+60 11-2847 9921',
    subject: 'Your parcel is held at our depot',
    body: 'A customs fee of RM 3.50 is required to release it. Pay within 12 hours or it returns to sender.',
    isPhish: true,
    tell: 'The tiny fee exists to harvest your card, not to collect RM 3.50.',
  },
  {
    slug: 'training-reminder',
    sender: 'CyGenix',
    senderEmail: 'no-reply@venator.com',
    subject: 'You have 1 module left this quarter',
    body: 'Open the CyGenix app to finish it. No links here — just open the app you already have.',
    isPhish: false,
    tell: 'Names no link and tells you to use the app you already trust.',
  },
];

const VISHING_MODULE = 'biyeZLy4nvajdtYv6t17';

const BOSS = {
  name: 'The Persistent Caller',
  intro:
    'Four turns. No hints, no highlighted tells, no retry until tomorrow. '
    + 'Give up one detail and the run ends — hanging up early is a pass.',
  howItPlays: [
    'A call comes in. Every reply you choose changes what they say next.',
    'They escalate — a manager joins, then an email lands mid-call to back the story.',
    'Give up one detail and the run ends. Hanging up early is a pass.',
  ],
  turns: [
    {
      speaker: 'Adam, IT Service Desk',
      line: 'Hi, it is Adam from IT. We are seeing failed logins on your account — can I just confirm I have the right person?',
      note: 'Caller ID shows the internal service desk number.',
      options: [
        { text: 'Sure, it is me. What do you need?', outcome: 'advance',
          reply: 'Great. I just need to get you back in before it locks properly.' },
        { text: 'Which account are you seeing that on?', outcome: 'advance',
          reply: 'Your main one — the sign-ins are coming from outside the country.' },
        { text: 'I will call the service desk back on the directory number.', outcome: 'pass',
          reply: 'The line goes quiet, then dead. That was the right call.' },
      ],
    },
    {
      speaker: 'Adam, IT Service Desk',
      line: 'I can clear it from here, but the system wants the code on your phone to confirm it is you.',
      note: 'A push notification arrives on your phone as he says it.',
      options: [
        { text: 'Read the six digits out.', outcome: 'fail',
          reply: 'He thanks you warmly and hangs up. That code was his login, not yours.' },
        { text: 'Approve the prompt on my phone.', outcome: 'fail',
          reply: 'Approved. You have just let someone else into your account.' },
        { text: 'I am not giving out a code. I will call back.', outcome: 'advance',
          reply: 'His tone shifts. "Let me get my manager, this is getting urgent."' },
      ],
    },
    {
      speaker: 'Suresh, "IT Manager"',
      line: 'This is Suresh, I run the desk. We have a live intrusion. I need you to co-operate with Adam right now.',
      note: 'An email lands in your inbox from an address one character off the real one.',
      options: [
        { text: 'Sorry — I still need to call back on the directory number.', outcome: 'advance',
          reply: 'A pause. "Fine. But if this escalates, that is on you."' },
        { text: 'If a manager is asking, all right — what do you need?', outcome: 'fail',
          reply: 'Authority was the whole play. Two names and a matching email were enough.' },
        { text: 'Send it in writing and I will action it.', outcome: 'fail',
          reply: 'The email is already there. You open it, and the run ends.' },
      ],
    },
    {
      speaker: 'Suresh, "IT Manager"',
      line: 'Last thing — just tell me which authenticator app you use so I can log the ticket properly.',
      note: 'It sounds harmless.',
      options: [
        { text: 'It is only the app name, that is fine.', outcome: 'fail',
          reply: 'Small detail, real value. It tells them exactly which prompt to fake next time.' },
        { text: 'I am hanging up and calling the desk myself.', outcome: 'pass',
          reply: 'You hang up. Nothing was given away — not even which app to imitate.' },
      ],
    },
  ],
};

(async () => {
  let wrote = 0, skipped = 0;
  for (const d of DRILLS) {
    const ref = db.collection('drillItems').doc(d.slug);
    if ((await ref.get()).exists) { skipped++; continue; }
    const { slug, ...rest } = d;
    await ref.set({ ...rest, active: true });
    wrote++;
  }
  console.log(`drill items — wrote ${wrote}, already present ${skipped}`);

  const bossRef = db.collection('modules').doc(VISHING_MODULE).collection('boss').doc('main');
  await bossRef.set(BOSS, { merge: true });
  console.log(`boss written for Vishing: ${BOSS.name} (${BOSS.turns.length} turns)`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
