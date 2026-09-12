// One-off: enrich Vishing Lesson 2 with the structured lesson flow
// (design panels 4a-4f) as the worked exemplar.
//
// Deliberately non-destructive: title, content and sequenceOrder are left
// exactly as they are, and the lesson's existing written content becomes
// section 01's body, so nothing an admin wrote is replaced.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const MODULE_ID = 'biyeZLy4nvajdtYv6t17'; // Vishing (Voice Phishing)
const LESSON_ID = 'rLuFjzd4BKkQkdNDxD2G'; // Vishing Tactics to Recognize

(async () => {
  const ref = db.collection('modules').doc(MODULE_ID).collection('lessons').doc(LESSON_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('lesson not found');
  const existing = snap.data();

  if (existing.sections && existing.sections.length) {
    console.log('Lesson already has sections — leaving it alone.');
    process.exit(0);
  }

  const sections = [
    {
      kind: 'read',
      title: 'Why a voice works on us',
      // The admin's own written content, untouched, as the opening section.
      body: existing.content || '',
      quote: 'Knowing things about you is not the same as being who they say they are.',
      quoteBy: 'CyGenix security training',
    },
    {
      kind: 'stat',
      title: 'Why the phone, and not email',
      body:
        'Email gives you time. A phone call takes it away. A live voice asking for ' +
        'something small, right now, borrows the authority of whoever it claims to be.',
      caption: 'Share of staff who complied when asked for a credential',
      // Stated plainly on screen: these are teaching figures, not measured
      // Venator data. Replace with your own numbers and source when you have
      // them — the admin form requires a source for exactly this reason.
      source: 'Illustrative example — not measured at Venator',
      bars: [
        { label: 'Email', value: 12, suffix: '%' },
        { label: 'SMS', value: 19, suffix: '%' },
        { label: 'Voice', value: 31, suffix: '%' },
      ],
    },
    {
      kind: 'tells',
      title: 'Three tells are hiding in this call',
      intro: 'A call reported by a colleague. Three lines in it should have ended it.',
      caller: '"Adam from IT"',
      number: 'Caller ID spoofed as the service desk',
      duration: '00:41',
      tip: 'A real service desk never minds being called back.',
      lines: [
        {
          text: "Hi, this is Adam from IT — I'm covering the service desk today.",
          phrase: '',
          label: '',
        },
        {
          text: "I've only got a minute before my next call, so bear with me.",
          phrase: 'only got a minute before my next call',
          label: 'manufactured urgency',
        },
        {
          text: "We're seeing sign-ins on your account from another country.",
          phrase: '',
          label: '',
        },
        {
          text: 'Can you read me the six digits on your phone?',
          phrase: 'the six digits on your phone',
          label: 'asks for a code',
        },
        {
          text: "No need to call back — just stay on with me and we'll get it sorted.",
          phrase: 'just stay on with me',
          label: 'blocks you verifying',
        },
      ],
    },
    {
      kind: 'cards',
      title: 'Three words to keep',
      cards: [
        { word: 'Hang up', body: 'You owe a caller nothing. Ending a call is not rude.' },
        { word: 'Look up', body: 'Find the service-desk number yourself — from the intranet, never from the call.' },
        { word: 'Call back', body: 'An attacker cannot receive the call you place.' },
      ],
      sayIt: "I'll hang up and call IT back on the number in the directory.",
    },
  ];

  await ref.set(
    {
      summary: 'What a vishing call actually sounds like, and the three moves that end it safely.',
      stake: 'A call like this reaches someone in the company most weeks. You are the one who picks up.',
      readMinutes: 4,
      xpValue: 10,
      objectives: [
        'Name the three tells in a live call',
        'Say the callback line without hesitating',
        'Find the real service-desk number in seconds',
      ],
      sections,
    },
    { merge: true },
  );

  console.log('Enriched:', existing.title);
  console.log('Sections:', sections.map((s) => s.kind).join(' -> '));
  process.exit(0);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
