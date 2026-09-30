// Gives every lesson something to do.
//
// 18 of 27 lessons were read -> cards: you read a list, tap Continue, read the
// keep-cards, done. Nothing to interact with, which is what makes a lesson
// feel like a reading assignment however well the prose is laid out. Each one
// below gets a tap-along built from that lesson's own subject.
//
// Keyed by lesson document id so it targets exactly the intended lesson.
// Re-runnable and non-destructive: a lesson that already has a tells section
// is skipped, and the new section is inserted before the keep-cards, which
// always close a lesson.
//
// Every `phrase` must appear verbatim inside its `text` — the UI highlights
// the substring — and the script verifies that before writing anything.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const T = (title, intro, channel, caller, number, tip, lines) => ({
  kind: 'tells', title, intro, channel, caller, number, duration: '', tip, lines,
});

const SECTIONS = {
  // ---------------------------------------------------------------- Phishing
  dyViIXjNw8qsFMT4nH79: T(
    'Three tells are hiding in this email',
    'It looks like it came from inside the company. Tap what should have stopped the reader.',
    'email', '"Aisha Rahman — Finance"', 'From: a.rahman@venatorcorp-finance.com',
    'A trusted name in the display line proves nothing; the address and the request are what you read.',
    [
      { text: 'Hi, sorry to bother you on a Friday.', phrase: '', label: '' },
      { text: 'I am locked out of the portal and need you to sign in on my behalf.', phrase: 'sign in on my behalf', label: 'asks you to use your own access for someone else' },
      { text: 'Just send me your username and password and I will sort it from here.', phrase: 'your username and password', label: 'nobody legitimate asks for this' },
      { text: 'Please keep this between us, I do not want IT making a thing of it.', phrase: 'keep this between us', label: 'secrecy exists to stop you checking' },
      { text: 'Thanks, I owe you one.', phrase: '', label: '' },
    ]),
  t07nrQ8xZYnm61qS0nHO: T(
    'Three mistakes in this reply',
    'A colleague answering a phishing email they already suspected. Tap what made it worse.',
    'email', 'Reply from a colleague', 'To: security@m365-alerts.co',
    'Do not click, do not reply, do not wait. Verify on a channel you chose and report it.',
    [
      { text: 'I got your message about my mailbox being full.', phrase: '', label: '' },
      { text: 'I clicked the link first to see where it went, then closed it.', phrase: 'I clicked the link first', label: 'opening it is the action the attacker wanted' },
      { text: 'Replying here to ask if this is really you.', phrase: 'Replying here', label: 'a reply confirms your address is live' },
      { text: 'I will leave it a few days and see if anything happens.', phrase: 'leave it a few days', label: 'delay is what turns a near miss into an incident' },
      { text: 'Let me know either way.', phrase: '', label: '' },
    ]),

  // ----------------------------------------------------------------- Malware
  fTRokvsnZdYaX8maSxNc: T(
    'Three tells are hiding in this email',
    'An invoice nobody was expecting. Tap the parts that should have stopped it being opened.',
    'email', '"Accounts Payable"', 'From: billing@invoice-secure.co',
    'An attachment you were not expecting is the single most common way malware arrives.',
    [
      { text: 'Please find your outstanding invoice attached.', phrase: '', label: '' },
      { text: 'The file is Invoice_4471.docm and you will need to enable content to view it.', phrase: 'enable content', label: 'that is the prompt that runs the macro' },
      { text: 'If the document will not open, try the .exe version in the second attachment.', phrase: 'the .exe version', label: 'a program, not a document' },
      { text: 'Payment is overdue and will be escalated to your manager today.', phrase: 'escalated to your manager today', label: 'pressure to open it before thinking' },
      { text: 'Regards, Accounts.', phrase: '', label: '' },
    ]),
  aw02cACRw1vMUTmGOSjT: T(
    'Three mistakes in this message',
    'Someone whose laptop is behaving strangely, asking the team chat what to do. Tap what is going wrong.',
    'chat', 'Colleague · #ops-help', '',
    'Disconnect, do not pay, do not tidy up, and tell IT. The evidence matters as much as the machine.',
    [
      { text: 'My laptop has been really slow since this morning and files are opening oddly.', phrase: '', label: '' },
      { text: 'Still on the VPN though, I did not want to lose my session.', phrase: 'Still on the VPN', label: 'a connected machine is how it spreads' },
      { text: 'I deleted the weird files to clean it up.', phrase: 'I deleted the weird files', label: 'that destroys what IT needs to see' },
      { text: 'There is a note asking for payment to unlock the rest, should I just pay it?', phrase: 'should I just pay it', label: 'paying funds them and guarantees nothing' },
      { text: 'Anyone seen this before?', phrase: '', label: '' },
    ]),

  // ---------------------------------------------------------------- Smishing
  GVVuAu1uS5mba5fmEMxq: T(
    'Three tells are hiding in this text',
    'A delivery message on a phone, where the details are hardest to read. Tap what gives it away.',
    'chat', 'MYPOS-DELIVERY', '+60 11-2884 9931',
    'A courier with a real problem will be waiting for you inside their own app, not behind a link.',
    [
      { text: 'Your parcel is held at the depot.', phrase: '', label: '' },
      { text: 'A redelivery fee of RM 2.30 is outstanding, pay at pos-my.delivery-update.net', phrase: 'pos-my.delivery-update.net', label: 'the real name is only a prefix here' },
      { text: 'Your parcel will be returned to sender within 12 hours if unpaid.', phrase: 'within 12 hours', label: 'a deadline you have no way to check' },
      { text: 'Reply STOP to opt out of these alerts.', phrase: 'Reply STOP', label: 'any reply confirms the number is live' },
      { text: 'Thank you for using our service.', phrase: '', label: '' },
    ]),
  '2D7BLtzNuKMHETepys8k': T(
    'Three mistakes in this exchange',
    'A colleague handling a suspicious bank text. Tap the parts that put them at risk.',
    'chat', 'Colleague · #general', '',
    'Do not tap, do not reply, never pass on a code. Go to the app you already have.',
    [
      { text: 'Got a text saying there is a suspicious transaction on my account.', phrase: '', label: '' },
      { text: 'I tapped the link to check, it looked exactly like the bank site.', phrase: 'I tapped the link', label: 'looking identical is the entire point' },
      { text: 'Then it sent me a code and asked me to text it back to confirm.', phrase: 'text it back', label: 'a code you send on is a code you have given away' },
      { text: 'I did, because the number was the same one the bank always uses.', phrase: 'the same one the bank always uses', label: 'the sender ID can be spoofed' },
      { text: 'Should I be worried?', phrase: '', label: '' },
    ]),

  // ------------------------------------------------------- Incident Reporting
  xJxjk9wFjihyWhOFDtEj: T(
    'Three reasons this went unreported',
    'A conversation after a near miss. Tap the thinking that kept security in the dark.',
    'chat', 'Two colleagues · #team', '',
    'Nothing here needs to be certain before it is reported. Reporting early is what keeps an incident small.',
    [
      { text: 'Did you get that fake invoice email this morning?', phrase: '', label: '' },
      { text: 'Yes but I did not click it, so there is nothing to report.', phrase: 'nothing to report', label: 'a failed attempt still warns everyone else' },
      { text: 'I would rather not look like I fell for something.', phrase: 'look like I fell for something', label: 'embarrassment is what delays every report' },
      { text: 'Security will already know about it anyway.', phrase: 'will already know', label: 'they know what somebody tells them' },
      { text: 'Fair enough, leave it then.', phrase: '', label: '' },
    ]),
  nvTyeca4LhQYv5pkqqhN: T(
    'Three of these are reportable',
    'A list somebody wrote off as "not worth bothering IT with". Tap the ones that should have been reported.',
    'chat', 'Personal notes', '',
    'Lost devices, misdirected data and entered credentials are all incidents, whatever happened afterwards.',
    [
      { text: 'Things from this week I did not mention to anyone:', phrase: '', label: '' },
      { text: 'Left my work phone in a taxi on Tuesday, got it back Wednesday.', phrase: 'Left my work phone in a taxi', label: 'out of your hands is out of your control' },
      { text: 'Sent the payroll sheet to the wrong Ahmad in the address book.', phrase: 'the wrong Ahmad', label: 'misdirected sensitive data is reportable' },
      { text: 'Typed my password into a login page that then went blank.', phrase: 'a login page that then went blank', label: 'that is a credential you must assume is taken' },
      { text: 'Booked the meeting room for Thursday.', phrase: '', label: '' },
    ]),

  // --------------------------------------------------------------------- MFA
  xuQv5dAY0y165Gj3c5wj: T(
    'Three tells are hiding in this call',
    'A caller trying to get past someone\'s second factor. Tap what should have ended the call.',
    'call', '"Service Desk"', '+60 3-2011 8890',
    'MFA only protects you while the code stays with you. Nobody legitimate needs it read aloud.',
    [
      { text: 'We are migrating your account tonight and need to confirm it is you.', phrase: '', label: '' },
      { text: 'You will get a code on your phone in a moment, just read it back to me.', phrase: 'read it back to me', label: 'a one-time code authenticates you, not the caller' },
      { text: 'If you get a few prompts, approve any of them, the system is retrying.', phrase: 'approve any of them', label: 'repeated prompts mean someone has your password' },
      { text: 'This has to be done before midnight or you will be locked out.', phrase: 'before midnight or you will be locked out', label: 'a deadline invented to stop you verifying' },
      { text: 'Are you at your desk now?', phrase: '', label: '' },
    ]),
  H5HGonF143VlxQopK5sX: T(
    'Three habits here will cost an account',
    'A new starter describing how they set up MFA. Tap what needs correcting.',
    'chat', 'New starter · #it-help', '',
    'Use an app or a key, keep codes to yourself, and deny anything you did not start.',
    [
      { text: 'Got MFA switched on this morning, thanks for the walkthrough.', phrase: '', label: '' },
      { text: 'I set it to SMS because the authenticator app looked fiddly.', phrase: 'set it to SMS', label: 'a number can be moved to someone else\'s SIM' },
      { text: 'I approved a prompt last night that I had not asked for, to stop it buzzing.', phrase: 'to stop it buzzing', label: 'that is exactly what prompt bombing counts on' },
      { text: 'And I shared the backup codes with my manager in case I lose my phone.', phrase: 'shared the backup codes', label: 'a backup code is a password' },
      { text: 'All set now though.', phrase: '', label: '' },
    ]),

  // --------------------------------------------------------------- Passwords
  vemxrQJBEnNkoHK6gFSN: T(
    'Three problems with this password',
    'Someone talking through the password they just chose. Tap what makes it weak.',
    'chat', 'Colleague · #general', '',
    'Length beats cleverness. Substitutions are the first thing a cracking tool tries.',
    [
      { text: 'Finally picked a new one for the finance system.', phrase: '', label: '' },
      { text: 'It is P@ssw0rd2026 so it has symbols and numbers in it.', phrase: 'P@ssw0rd2026', label: 'a common word with the swaps everyone makes' },
      { text: 'Only eight characters but it is complicated enough.', phrase: 'Only eight characters', label: 'length is what actually costs an attacker time' },
      { text: 'Same one as my email so I will actually remember it.', phrase: 'Same one as my email', label: 'one leak then opens both' },
      { text: 'Should be fine for a while.', phrase: '', label: '' },
    ]),
  y5KYF5Hii0UkAkqVHg83: T(
    'Three mistakes in this setup',
    'A colleague describing how they use their password manager. Tap what undoes the benefit.',
    'chat', 'Colleague · #it-help', '',
    'The master password is the one you protect above all others, and the vault is not a place to share from.',
    [
      { text: 'Password manager is set up and importing my old logins.', phrase: '', label: '' },
      { text: 'Master password is the same as my laptop login so there is less to remember.', phrase: 'the same as my laptop login', label: 'one password now unlocks everything' },
      { text: 'No second factor on the vault, it felt like overkill.', phrase: 'No second factor on the vault', label: 'the vault is the account that most needs one' },
      { text: 'I emailed a few of the entries to the team so we all have them.', phrase: 'emailed a few of the entries', label: 'that puts them back in plain text forever' },
      { text: 'Much easier already.', phrase: '', label: '' },
    ]),

  // --------------------------------------------------------------------- BEC
  Ech6OAxTb19u6gc9pYn2: T(
    'Three tells are hiding in this email',
    'A request that arrived just before the weekend. Tap what should have stopped it.',
    'email', '"Dato\' Rahman — CEO"', 'From: ceo.rahman@venatorcorp.co',
    'Rank in the signature is not authority. The process exists precisely for requests like this one.',
    [
      { text: 'Are you at your desk? I need something handled before close.', phrase: '', label: '' },
      { text: 'A supplier payment has to clear today, I will send the account details.', phrase: 'has to clear today', label: 'urgency that removes the time to verify' },
      { text: 'Do not raise it with finance, I will explain on Monday.', phrase: 'Do not raise it with finance', label: 'bypassing approval is the whole attack' },
      { text: 'I am travelling so email is the only way to reach me.', phrase: 'email is the only way to reach me', label: 'closing off the channel that would expose it' },
      { text: 'Thank you for handling this.', phrase: '', label: '' },
    ]),
  O2wMppVvDFbGrraijXU0: T(
    'Three tells are hiding in this notice',
    'A vendor updating their payment details. Tap what has to be checked before anything is paid.',
    'email', '"Sentra Supplies — Accounts"', 'From: accounts@sentra-supplies.net',
    'Call the number you already hold, not the one in the message, and never on the message\'s schedule.',
    [
      { text: 'Please note our banking details have changed as of this month.', phrase: 'banking details have changed', label: 'the single most abused request in BEC' },
      { text: 'Kindly update your records before the next payment run.', phrase: '', label: '' },
      { text: 'For any queries call our new line on the number below.', phrase: 'our new line on the number below', label: 'verification routed back through the attacker' },
      { text: 'Invoices already issued will be reissued to the new account.', phrase: 'reissued to the new account', label: 'redirects money you have already approved' },
      { text: 'Thank you for your continued business.', phrase: '', label: '' },
    ]),

  // ----------------------------------------------------------------- Vishing
  '7lRfivl5mjSPw3zT4NvY': T(
    'Three tells are hiding in this call',
    'An unexpected call claiming to be internal IT. Tap what should have ended it.',
    'call', '"Venator IT Support"', 'Caller ID: +60 3-7890 1122',
    'Hang up and call IT on the number you already have. A real technician will expect you to.',
    [
      { text: 'We have detected unusual activity on your workstation.', phrase: '', label: '' },
      { text: 'I need you to install a remote support tool so I can take a look.', phrase: 'install a remote support tool', label: 'hands over the machine entirely' },
      { text: 'Confirm your network password so I can verify you first.', phrase: 'Confirm your network password', label: 'IT never needs your password' },
      { text: 'Please stay on the line, hanging up will lock your account.', phrase: 'hanging up will lock your account', label: 'invented to stop you checking' },
      { text: 'This will only take a few minutes.', phrase: '', label: '' },
    ]),
  '6I0xLgSkXvUdfnlB4I2t': T(
    'Three mistakes in this response',
    'How an employee answered a suspicious call. Tap what they should not have done.',
    'call', 'Employee side of the call', '',
    'Decline, hang up, verify on a number you chose, then report it. Partial cooperation is still cooperation.',
    [
      { text: 'Sorry, who did you say you were with again?', phrase: '', label: '' },
      { text: 'I will not give you the password, but I can confirm my employee ID.', phrase: 'confirm my employee ID', label: 'partial information is what the next call is built on' },
      { text: 'You can call me straight back on this line if you need to.', phrase: 'call me straight back on this line', label: 'the callback has to be to a number you chose' },
      { text: 'I will not report it since I did not actually tell you anything.', phrase: 'will not report it', label: 'the attempt itself is what security needs' },
      { text: 'Have a good afternoon.', phrase: '', label: '' },
    ]),

  // -------------------------------------------------------------- Pretexting
  bHOmpVwWRSZ1llhkjim9: T(
    'Three tells are hiding in this call',
    'A caller with a very convincing story. Tap the parts that are doing the work.',
    'call', '"External auditor"', '+60 3-2777 4410',
    'The more the story explains itself, the more reason to verify it through your own channel.',
    [
      { text: 'I am with the external audit team finishing this quarter\'s review.', phrase: '', label: '' },
      { text: 'Your manager Fauzi said you would be the person to ask.', phrase: 'Fauzi said you would be the person to ask', label: 'a real name used to borrow trust' },
      { text: 'I just need the staff list with employee numbers emailed over.', phrase: 'the staff list with employee numbers', label: 'the raw material for the next impersonation' },
      { text: 'We are past deadline so I cannot go through the usual request form.', phrase: 'cannot go through the usual request form', label: 'the process is exactly what is being avoided' },
      { text: 'I will hold while you pull it up.', phrase: '', label: '' },
    ]),
  CuTMkCjLme2zM0zPq9g8: T(
    'Three mistakes in this exchange',
    'A helpdesk call that ended with a reset. Tap where it should have stopped.',
    'call', 'Helpdesk side of the call', '',
    'Verification is a fixed procedure, not a judgement about how convincing someone sounds.',
    [
      { text: 'You are through to the service desk, how can I help?', phrase: '', label: '' },
      { text: 'He knew the office address and my manager\'s name, so it added up.', phrase: 'it added up', label: 'researched detail is the pretext, not proof' },
      { text: 'He sounded stressed about a deadline so I skipped the callback step.', phrase: 'skipped the callback step', label: 'the step exists for exactly this moment' },
      { text: 'I reset the password and read the temporary one out to him.', phrase: 'read the temporary one out', label: 'handed over the account' },
      { text: 'He was very grateful.', phrase: '', label: '' },
    ]),
};

(async () => {
  // Refuse to write anything if a highlight phrase is not in its line.
  let bad = 0;
  for (const [id, sec] of Object.entries(SECTIONS)) {
    for (const l of sec.lines) {
      if (l.phrase && !l.text.includes(l.phrase)) {
        console.log('BAD PHRASE', id, '|', JSON.stringify(l.phrase));
        bad++;
      }
    }
    const tells = sec.lines.filter((l) => l.phrase).length;
    if (tells < 3) { console.log('TOO FEW TELLS', id, tells); bad++; }
  }
  if (bad) { console.error(`\n${bad} problems — nothing written.`); process.exit(1); }
  console.log('all phrases verified\n');

  const mods = await db.collection('modules').get();
  let added = 0, skipped = 0, missing = Object.keys(SECTIONS).length;

  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const l of lessons.docs) {
      const sec = SECTIONS[l.id];
      if (!sec) continue;
      missing--;
      const sections = l.data().sections || [];
      if (sections.some((s) => s.kind === 'tells')) {
        console.log('skip (already interactive):', l.data().title);
        skipped++;
        continue;
      }
      const cardsAt = sections.findIndex((s) => s.kind === 'cards');
      const next = [...sections];
      next.splice(cardsAt < 0 ? next.length : cardsAt, 0, sec);
      await l.ref.set({ sections: next }, { merge: true });
      console.log('added:', m.data().title, '/', l.data().title,
        '->', next.map((s) => s.kind || 'read').join('+'));
      added++;
    }
  }

  if (missing) console.log(`\nWARNING: ${missing} lesson ids were not found.`);
  console.log(`\nadded ${added}, skipped ${skipped}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
