// A module boss for every module (design 5d).
//
// Each is four turns of branching pressure. Every turn offers at least one
// reply that ends the run safely ("pass") — hanging up, refusing, reporting —
// because the lesson being taught is that leaving early is the right move,
// not that you must out-talk an attacker.
//
// Re-runnable: writes one doc per module, overwriting cleanly.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const HOW = [
  'A scenario opens. Every reply you choose changes what happens next.',
  'They escalate — a second person, a deadline, something that backs the story.',
  'Give up one detail and the run ends. Walking away early is a pass.',
];

const BOSSES = {
  // ---------------------------------------------------------------- Phishing
  '0CWGai8J7q0rxAS6fOsh': {
    name: 'The Inbox That Waits',
    intro: 'Four turns of a thread that looks more real with every reply. Clear it without handing over anything.',
    turns: [
      {
        speaker: 'IT Helpdesk <helpdesk@venator-it.co>',
        line: 'Your mailbox is over quota. Messages sent to you today may be bouncing.',
        note: 'The domain is one hyphen away from the real one.',
        options: [
          { text: 'Open the link to check my quota.', outcome: 'fail', reply: 'The page is a perfect copy of the login screen. You have just typed your password into it.' },
          { text: 'Reply asking which mailbox they mean.', outcome: 'advance', reply: 'They answer within a minute: "Your primary. It is urgent — mail is being lost."' },
          { text: 'Check my quota from the mail client I already use.', outcome: 'pass', reply: 'Your mailbox is at 41%. Nothing was wrong, and you touched nothing they sent.' },
        ],
      },
      {
        speaker: 'IT Helpdesk',
        line: 'To save you time I can raise the quota myself — just confirm your username and current password.',
        note: '',
        options: [
          { text: 'Send the username only, not the password.', outcome: 'fail', reply: 'The username was the half they did not have. The password attempts start an hour later.' },
          { text: 'No. I will raise a ticket through the portal.', outcome: 'advance', reply: '"The portal is exactly what is down. I am trying to help you here."' },
          { text: 'Report the message and stop replying.', outcome: 'pass', reply: 'Reported. Security confirms the domain was registered four days ago.' },
        ],
      },
      {
        speaker: 'Priya, "IT Team Lead"',
        line: 'Stepping in — this is affecting three people now. I need you to co-operate so we can close it.',
        note: 'A second sender, same look-alike domain.',
        options: [
          { text: 'If a lead is asking, fine. What do you need?', outcome: 'fail', reply: 'A second name and a title cost them nothing. That was the whole escalation.' },
          { text: 'I will call the service desk on the directory number.', outcome: 'advance', reply: '"Do that and you will be waiting an hour." The tone has changed.' },
        ],
      },
      {
        speaker: 'Priya, "IT Team Lead"',
        line: 'Last thing then — just tell me which mail client you are on so I can log it correctly.',
        note: 'It sounds like nothing.',
        options: [
          { text: 'That much is harmless.', outcome: 'fail', reply: 'Small detail, real value — it tells them exactly which login page to forge next.' },
          { text: 'I am done here. Reporting the thread.', outcome: 'pass', reply: 'Nothing was given away, not even which screen to imitate.' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Malware
  '5gfknBKr3gDnAQZGTVwR': {
    name: 'The Attachment',
    intro: 'An invoice you were not expecting, from a supplier you half recognise. Four turns to keep it off the network.',
    turns: [
      {
        speaker: 'Accounts <invoices@venator-billing.net>',
        line: 'Attached is the outstanding invoice for last quarter. Payment is overdue.',
        note: 'A .docm attachment sits at the bottom.',
        options: [
          { text: 'Open the attachment to see what it is.', outcome: 'advance', reply: 'It opens greyed out: "Enable editing and content to view this document."' },
          { text: 'Check with finance whether this supplier exists.', outcome: 'pass', reply: 'Finance has never heard of them. The mail is quarantined before anyone opens it.' },
        ],
      },
      {
        speaker: 'The document',
        line: 'PROTECTED VIEW — Enable Content to display this invoice.',
        note: '',
        options: [
          { text: 'Enable content, it is only an invoice.', outcome: 'fail', reply: 'Enable Content is the moment a document becomes a program. It ran.' },
          { text: 'Close it and forward the mail to IT.', outcome: 'advance', reply: 'Two minutes later the sender replies: "Did it not open? I can resend."' },
        ],
      },
      {
        speaker: 'Accounts',
        line: 'I can send a version that opens automatically, or share it from our portal. Which is easier?',
        note: '',
        options: [
          { text: 'Send the one that opens automatically.', outcome: 'fail', reply: '"Opens automatically" means it runs without asking. It did.' },
          { text: 'Use the portal link.', outcome: 'fail', reply: 'The portal is theirs. The download was the payload in a different wrapper.' },
          { text: 'Neither. IT has it now.', outcome: 'advance', reply: 'Silence for an hour, then one more mail.' },
        ],
      },
      {
        speaker: 'Accounts',
        line: 'Please do not escalate this to finance — it is embarrassing for us. Let us sort it between ourselves.',
        note: '',
        options: [
          { text: 'Fair enough, keep it quiet.', outcome: 'fail', reply: '"Do not tell anyone" is the request of an attacker, never a supplier.' },
          { text: 'Finance and IT both already have it.', outcome: 'pass', reply: 'The address is blocked that afternoon. Nothing ever ran.' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Smishing
  '85H5T3Y3Ldh3JKbagqWg': {
    name: 'The Short Number',
    intro: 'Four texts, arriving while you are walking. Small screen, small print, no time. Clear it without tapping.',
    turns: [
      {
        speaker: '+60 11-2847 9921',
        line: 'Your parcel is held at our depot. Reference VN-88412.',
        note: 'You are, in fact, waiting for a parcel.',
        options: [
          { text: 'Tap the link to see the parcel.', outcome: 'fail', reply: 'The page asks for your card "to confirm identity". You are already on their site.' },
          { text: 'Reply asking which parcel.', outcome: 'advance', reply: 'The reply is instant — which is itself the tell. "The one from Tuesday. A fee is due."' },
          { text: 'Open the courier app and check the real reference.', outcome: 'pass', reply: 'Your parcel is out for delivery. The text had nothing to do with it.' },
        ],
      },
      {
        speaker: '+60 11-2847 9921',
        line: 'A customs fee of RM 3.50 is required to release it today.',
        note: '',
        options: [
          { text: 'It is only RM 3.50 — pay it.', outcome: 'fail', reply: 'The tiny amount exists to harvest a working card, not to collect RM 3.50.' },
          { text: 'Ignore it and carry on.', outcome: 'advance', reply: 'Twenty minutes later, a second number.' },
        ],
      },
      {
        speaker: '+60 12-9930 4417',
        line: 'FINAL NOTICE: parcel returns to sender in 2 hours. Confirm details to stop this.',
        note: 'Different number, same script.',
        options: [
          { text: 'Reply STOP to make it end.', outcome: 'fail', reply: 'Any reply confirms a live number. You have just qualified yourself as a target.' },
          { text: 'Screenshot both and forward to IT.', outcome: 'advance', reply: 'Reported. One more arrives before the block lands.' },
        ],
      },
      {
        speaker: '+60 12-9930 4417',
        line: 'We can call you to sort it — just confirm this is the right number to reach you on.',
        note: '',
        options: [
          { text: 'Confirm the number so they can call.', outcome: 'fail', reply: 'Confirming the number is how a text campaign becomes a phone call with your name in it.' },
          { text: 'Block and delete. Nothing to confirm.', outcome: 'pass', reply: 'Blocked. Not one reply, not one tap, all afternoon.' },
        ],
      },
    ],
  },

  // ------------------------------------------------------- Incident Reporting
  CxP6a8gX2nxxNazQ6WWc: {
    name: 'The Quiet Hour',
    intro: 'You clicked something. Four turns of reasons not to say so. Clear it by reporting anyway.',
    turns: [
      {
        speaker: 'You, to yourself',
        line: 'The page looked wrong the moment it loaded. You closed it. Probably nothing happened.',
        note: 'It is 4:50pm on a Friday.',
        options: [
          { text: 'Nothing happened. Go home.', outcome: 'fail', reply: 'The session token was taken on load. By Monday it has been used twice.' },
          { text: 'Watch it over the weekend and report Monday if anything looks odd.', outcome: 'advance', reply: 'You keep half an eye on it. An hour later your password prompt appears again.' },
          { text: 'Report it now, even though it is probably nothing.', outcome: 'pass', reply: 'Access is cut in four minutes. Nothing followed. This is what good looks like.' },
        ],
      },
      {
        speaker: 'A colleague',
        line: 'Honestly? I would not bother. They will make a whole thing of it and it will end up in your review.',
        note: '',
        options: [
          { text: 'They have a point. Leave it.', outcome: 'fail', reply: 'Nobody here has ever been disciplined for reporting. Plenty has been lost by waiting.' },
          { text: 'I would rather waste their time than risk it.', outcome: 'advance', reply: 'You open the reporting form. It asks what you clicked.' },
        ],
      },
      {
        speaker: 'The form',
        line: 'Describe what happened. Include anything you entered.',
        note: 'You did type your password before the page looked wrong.',
        options: [
          { text: 'Say you visited a suspicious page. Leave out the password.', outcome: 'fail', reply: 'The half-report sent them looking in the wrong place for two days.' },
          { text: 'Write it exactly — including the password.', outcome: 'advance', reply: 'Submitted. The phone rings within a minute.' },
        ],
      },
      {
        speaker: 'Security analyst',
        line: 'Thanks — one thing. Have you deleted the email? We need the original.',
        note: '',
        options: [
          { text: 'Deleted it straight away, it felt safer.', outcome: 'fail', reply: 'The headers were the evidence. Deleting it cost them the trail.' },
          { text: 'Still there. Forwarding it, leaving the original in place.', outcome: 'pass', reply: 'Headers intact. Sixty-two other copies pulled from other inboxes that evening.' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- MFA
  D2MzfjL3w7IOl9QRnVQ4: {
    name: 'The Prompt Storm',
    intro: 'Your phone will not stop buzzing. Four turns. Clear it by denying every one of them.',
    turns: [
      {
        speaker: 'Your phone',
        line: 'Approve sign-in? — the fourth prompt in ninety seconds.',
        note: 'You are not logging in to anything.',
        options: [
          { text: 'Approve one so it stops.', outcome: 'fail', reply: 'That is the entire attack. One approval was all it needed.' },
          { text: 'Deny them all and report it.', outcome: 'pass', reply: 'Denied, reported, password reset. They had the password; they never got the second factor.' },
          { text: 'Deny them and wait to see what happens.', outcome: 'advance', reply: 'The prompts stop. A minute later, the phone rings.' },
        ],
      },
      {
        speaker: 'Adam, "Service Desk"',
        line: 'We are seeing sync errors on your account — those prompts are our system retrying.',
        note: 'Caller ID shows an internal number.',
        options: [
          { text: 'That explains it. What do you need?', outcome: 'advance', reply: '"Just approve the next one and the errors clear."' },
          { text: 'Prompts I did not start mean someone has my password.', outcome: 'advance', reply: 'A pause. "That is one way to read it. Let me try something else."' },
        ],
      },
      {
        speaker: 'Adam, "Service Desk"',
        line: 'Alternatively, read me the six digits on your screen and I can clear it from this end.',
        note: '',
        options: [
          { text: 'Read the code out.', outcome: 'fail', reply: 'Those six digits were his login, not yours.' },
          { text: 'No code, no approval. I am resetting my password.', outcome: 'advance', reply: '"Do not do that, you will lock yourself out of everything."' },
        ],
      },
      {
        speaker: 'Adam, "Service Desk"',
        line: 'Fine. Just tell me which authenticator app you use so I can note the ticket.',
        note: '',
        options: [
          { text: 'Only the app name — harmless.', outcome: 'fail', reply: 'It tells them exactly which prompt to imitate next time.' },
          { text: 'Hanging up and resetting from a device I trust.', outcome: 'pass', reply: 'Password reset, sessions revoked, prompts gone. They got nothing.' },
        ],
      },
    ],
  },

  // ------------------------------------------------------- Password Hygiene
  KJNy1HHPVhAulA6nn7QJ: {
    name: 'The Helpful Colleague',
    intro: 'Four turns of very reasonable requests for a password. Clear it without sharing one.',
    turns: [
      {
        speaker: 'Faiz, from the next desk',
        line: 'The shared reporting account is locked me out. You use it too, right? What is the password?',
        note: 'Faiz is real, and you do both use it.',
        options: [
          { text: 'Tell him — he already has access anyway.', outcome: 'fail', reply: 'A password spoken aloud is a password with no owner. When it leaks, nobody knows who lost it.' },
          { text: 'Reset it through the manager and let the system send it.', outcome: 'pass', reply: 'He is back in within ten minutes, and the credential never left the vault.' },
          { text: 'Ask why it locked him out.', outcome: 'advance', reply: '"No idea. Kept saying wrong password. Been trying since this morning."' },
        ],
      },
      {
        speaker: 'Faiz',
        line: 'Been trying all morning and it keeps rejecting it. Can you just log in and send me the report?',
        note: 'Repeated failures on a shared account is itself a signal.',
        options: [
          { text: 'Log in and send it over.', outcome: 'advance', reply: 'It rejects your password too. Something has changed it.' },
          { text: 'Repeated failures mean it may already be compromised — report it.', outcome: 'pass', reply: 'Security confirms it: someone else changed the password at 06:40.' },
        ],
      },
      {
        speaker: 'You',
        line: 'Your password does not work either. The account has been changed.',
        note: 'You need a new one for the shared account.',
        options: [
          { text: 'Set it to the team name plus this year, so everyone remembers.', outcome: 'fail', reply: 'Capital first, number at the end, a word anyone could guess. It is cracked by Tuesday.' },
          { text: 'Generate a long one and put it in the shared vault.', outcome: 'advance', reply: 'Done. Faiz asks you to message it to him so he has it handy.' },
        ],
      },
      {
        speaker: 'Faiz',
        line: 'Just WhatsApp it to me, I will not save it anywhere.',
        note: '',
        options: [
          { text: 'Send it, he is a colleague.', outcome: 'fail', reply: 'It now exists in two phone backups and a cloud chat history.' },
          { text: 'Share it through the vault instead.', outcome: 'pass', reply: 'He has access, the password was never typed into a chat, and it can be rotated in one click.' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- BEC
  PnidqxS3AejqssXBMFVn: {
    name: 'The Friday Transfer',
    intro: 'Four turns, 4:40pm, and the CEO needs something handled quietly. Clear it by holding the process.',
    turns: [
      {
        speaker: 'Dato’ Rahman — CEO',
        line: 'Are you at your desk? I need something handled discreetly before close.',
        note: 'Reply-To is an outlook.com address.',
        options: [
          { text: 'Yes — what do you need?', outcome: 'advance', reply: '"A supplier payment has to clear tonight. I will send the details."' },
          { text: 'Call the number in the directory to check it is really him.', outcome: 'pass', reply: 'He is at dinner and has sent nothing. The mail is reported before anything moves.' },
        ],
      },
      {
        speaker: 'Dato’ Rahman — CEO',
        line: 'I am in a board dinner and cannot take calls. Process the transfer to the account attached.',
        note: 'Cannot be called. Cannot be checked.',
        options: [
          { text: 'Process it — it is the CEO.', outcome: 'fail', reply: 'RM 180,000 left the account at 4:58pm. The recall window closed overnight.' },
          { text: 'Ask finance to verify the account first.', outcome: 'advance', reply: '"Do not copy finance on this. I will brief them Monday."' },
        ],
      },
      {
        speaker: 'Dato’ Rahman — CEO',
        line: 'I am relying on you to handle this without making it a committee.',
        note: 'Flattery, secrecy and a deadline in one line.',
        options: [
          { text: 'Handle it alone, quietly.', outcome: 'fail', reply: 'Secrecy from finance is the request of an attacker, never a director.' },
          { text: 'No transfer leaves without a second approver.', outcome: 'advance', reply: 'A new mail arrives, this time from "Finance Director".' },
        ],
      },
      {
        speaker: '"Aisha — Finance Director"',
        line: 'Confirming I have approved this one. Please proceed — Dato’ has my authority.',
        note: 'Same look-alike domain as the first message.',
        options: [
          { text: 'Both have approved it. Send the payment.', outcome: 'fail', reply: 'The second approver was the same attacker with a different display name.' },
          { text: 'Call Aisha on the number already in the directory.', outcome: 'pass', reply: 'She approved nothing. The account was flagged and the thread reported.' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Pretexting
  wNcOaCrq03cTuD1Kj5AO: {
    name: 'The New Contractor',
    intro: 'Four turns of reasonable questions from someone who knows your manager’s name. Clear it by verifying.',
    turns: [
      {
        speaker: 'Wei Ling, "external auditor"',
        line: 'Hi — I am working with Suresh in Finance this quarter on the controls review.',
        note: 'Caller ID withheld. Suresh is real.',
        options: [
          { text: 'Sure, how can I help?', outcome: 'advance', reply: '"He said you would be the one who could answer quickly."' },
          { text: 'I will confirm with Suresh and call you back.', outcome: 'pass', reply: 'Suresh has no auditor this quarter. The number does not ring back.' },
        ],
      },
      {
        speaker: 'Wei Ling',
        line: 'Just a couple of process details. Which system do you use for approvals?',
        note: 'Nothing secret. Yet.',
        options: [
          { text: 'Name the system — it is hardly confidential.', outcome: 'advance', reply: '"Perfect. And who is able to approve on their own?"' },
          { text: 'I would rather confirm who you are first.', outcome: 'advance', reply: '"Of course. Suresh can vouch — he is travelling, but he gave me the go-ahead."' },
        ],
      },
      {
        speaker: 'Wei Ling',
        line: 'And who can sign off alone, without a second approver?',
        note: 'This is a map of your controls.',
        options: [
          { text: 'Answer — it is only process.', outcome: 'fail', reply: 'That answer names the exact person to impersonate, and when.' },
          { text: 'That is not something I will discuss on an unverified call.', outcome: 'advance', reply: 'A sigh. "You are making this harder than it needs to be."' },
        ],
      },
      {
        speaker: 'Wei Ling',
        line: 'No need to bother Suresh, he is travelling. Let us just finish this now.',
        note: '',
        options: [
          { text: 'Fine, let us get it over with.', outcome: 'fail', reply: '"No need to check" was the only sentence in the call that mattered.' },
          { text: 'Then we will finish it when I have checked. Goodbye.', outcome: 'pass', reply: 'You write down the name, the number and the questions. The pattern is the evidence.' },
        ],
      },
    ],
  },
};

(async () => {
  let wrote = 0;
  for (const [moduleId, boss] of Object.entries(BOSSES)) {
    const mod = await db.collection('modules').doc(moduleId).get();
    if (!mod.exists) { console.log('NO SUCH MODULE:', moduleId); continue; }
    await db.collection('modules').doc(moduleId).collection('boss').doc('main')
      .set({ ...boss, howItPlays: HOW }, { merge: true });
    console.log('boss:', mod.data().title, '->', boss.name, `(${boss.turns.length} turns)`);
    wrote++;
  }
  console.log(`\ndone — ${wrote} bosses written (Vishing already had one)`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
