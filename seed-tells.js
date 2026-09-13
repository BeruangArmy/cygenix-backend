// Adds the missing tap-along ("tells") section to the two modules that had
// none, so every module's middle lesson has the same shape as Phishing's:
// read -> tells -> cards.
//
// Incident Reporting and Password Hygiene were the only two modules whose
// lessons were read + cards all the way through — three straight reading
// sections with nothing to do, which is what made them feel like a wall of
// text next to the others.
//
// Re-runnable and non-destructive: it inserts the tells section before the
// cards section of the target lesson, and does nothing if one is already
// there.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

// moduleTitle -> { lessonTitleContains, section }
const TELLS = {
  'Incident Reporting': {
    lessonMatch: 'report',
    section: {
      kind: 'tells',
      title: 'Four things in this message should have been reported',
      intro:
        'A colleague forwarded this to the team chat instead of IT, three days after it arrived. Tap what should have gone straight to security.',
      channel: 'email',
      caller: '"IT Service Desk"',
      number: 'From: servicedesk@venator-support.net',
      duration: '',
      tip:
        'None of these need to be confirmed before you report them. Speed is the whole point — an early, incomplete report beats a late, thorough one.',
      lines: [
        {
          text: 'Hi team, got this on Monday and I think I clicked the link before I noticed.',
          phrase: 'I clicked the link before I noticed',
          label: 'a click that needs reporting, whatever happened after',
        },
        {
          text: 'It asked me to sign in again so I entered my password, then the page just went blank.',
          phrase: 'I entered my password',
          label: 'credentials entered on a page you did not trust',
        },
        {
          text: 'Nothing seems wrong with my account so I did not want to make a fuss.',
          phrase: 'Nothing seems wrong with my account',
          label: 'no visible damage is not evidence that nothing happened',
        },
        {
          text: 'Anyway it has been a few days now so it is probably fine.',
          phrase: 'it has been a few days now',
          label: 'the delay is the problem, not a reason to stay quiet',
        },
        {
          text: 'Has anyone else had one like this?',
          phrase: '',
          label: '',
        },
      ],
    },
  },
  'Password Hygiene & Password Managers': {
    lessonMatch: 'password',
    section: {
      kind: 'tells',
      title: 'Four habits in this message will cost someone an account',
      intro:
        'A new starter asking for help in the team channel. Tap the parts that put the company at risk.',
      channel: 'chat',
      caller: 'New starter · #ops-help',
      number: '',
      duration: '',
      tip:
        'Length beats cleverness, every account gets its own password, and a manager removes the need to remember any of them.',
      lines: [
        {
          text: 'Hey, finally set up my accounts today.',
          phrase: '',
          label: '',
        },
        {
          text: 'I used the same password as my personal email so I can actually remember it.',
          phrase: 'the same password as my personal email',
          label: 'reuse turns one leak into every account',
        },
        {
          text: 'It is Venator2026! which fits the rules and has a symbol and everything.',
          phrase: 'Venator2026!',
          label: 'a predictable pattern cracking tools already expect',
        },
        {
          text: 'I wrote it on a note under my keyboard in case I forget.',
          phrase: 'on a note under my keyboard',
          label: 'anyone at your desk now has it',
        },
        {
          text: 'Also can someone send me the shared login for the reporting tool?',
          phrase: 'the shared login',
          label: 'a shared account nobody can be held to',
        },
      ],
    },
  },
};

(async () => {
  const mods = await db.collection('modules').get();
  let added = 0;
  let skipped = 0;

  for (const m of mods.docs) {
    const plan = TELLS[m.data().title];
    if (!plan) continue;

    const lessons = await m.ref.collection('lessons').get();
    // Prefer a lesson whose title mentions the topic word; otherwise take the
    // middle one, which is where every other module puts its tap-along.
    const byTitle = lessons.docs.filter((l) =>
      `${l.data().title || ''}`.toLowerCase().includes(plan.lessonMatch));
    const target = byTitle[0] || lessons.docs[Math.floor(lessons.docs.length / 2)];
    if (!target) {
      console.log('no lessons for', m.data().title);
      continue;
    }

    const sections = target.data().sections || [];
    if (sections.some((s) => s.kind === 'tells')) {
      console.log('already has a tap-along:', m.data().title, '/', target.data().title);
      skipped++;
      continue;
    }

    // Slot it in before the keep-cards, which always close a lesson.
    const cardsAt = sections.findIndex((s) => s.kind === 'cards');
    const next = [...sections];
    next.splice(cardsAt < 0 ? next.length : cardsAt, 0, plan.section);

    await target.ref.set({ sections: next }, { merge: true });
    console.log('added tap-along:', m.data().title, '/', target.data().title,
      '->', next.map((s) => s.kind || 'read').join('+'));
    added++;
  }

  console.log(`\nadded ${added}, skipped ${skipped}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
