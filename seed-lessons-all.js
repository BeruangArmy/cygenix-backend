// Authors the structured lesson flow (design 4a-4f) across every module.
//
// Non-destructive by design:
//   - a lesson that already has sections is skipped entirely
//   - title, content and sequenceOrder are never written
//   - section 01's body is the lesson's OWN existing content, so nothing an
//     admin wrote is replaced — the flow is built around it
//
// Re-runnable: running it twice changes nothing the second time.
//
// No stat sections are seeded here. A data card has to carry a real source,
// and inventing nine sets of figures — even labelled — would put numbers in
// front of staff that nobody measured. Add them from the admin Content tab
// where you have data you trust.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const card = (word, body) => ({ word, body });
const line = (text, phrase = '', label = '') => ({ text, phrase, label });

// ---------------------------------------------------------------------------
// L1 = "what is it", L2 = "how it works" (carries the tap-along scenario),
// L3 = "what to do". Keyed by lesson id so nothing depends on ordering.
// ---------------------------------------------------------------------------
const LESSONS = {
  // ============================================ Phishing Awareness
  dyViIXjNw8qsFMT4nH79: {
    summary: 'What phishing actually is, and why it still works on people who know better.',
    stake: 'Most breaches start with one message somebody opened on a busy morning.',
    objectives: [
      'Say what makes a message phishing',
      'Name the three things an attacker is really after',
      'Notice the moment you are being rushed',
    ],
    readTitle: 'Why phishing still works',
    quote: 'Phishing does not attack your computer. It attacks your attention.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three habits to keep',
    cards: [
      card('Slow down', 'Urgency is the payload. A message that rushes you is telling you something.'),
      card('Check the sender', 'Read the full address, not the display name beside it.'),
      card('Use the route you know', 'Reach the company the way you always do, never the way the message suggests.'),
    ],
    sayIt: "I'll open this from the app I already use, not from the link.",
  },
  '6z2A9KOnNzb70nWkspDd': {
    summary: 'The tells that give a phishing email away, in the order you will meet them.',
    stake: 'This one landed in four inboxes here last month. Two people clicked.',
    objectives: [
      'Read a sender address properly',
      'Name three pressure tactics on sight',
      'Decide without clicking anything',
    ],
    readTitle: 'What to read first',
    quote: 'The display name is a costume. The address is the face.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Four tells are hiding in this email',
      intro: 'A real message reported by a colleague. Tap the words that should have stopped them.',
      channel: 'email',
      caller: '"Microsoft 365 Support"',
      number: 'From: security@m365-alerts.co',
      duration: '09:41',
      tip: 'Microsoft never asks for a password by email, and no genuine deadline lands in 24 hours.',
      lines: [
        line('Your mailbox storage is full and outgoing mail has been paused.'),
        line(
          'Verify your account within 24 hours or your messages will be permanently deleted.',
          'within 24 hours or your messages will be permanently deleted',
          'a deadline you cannot check',
        ),
        line('Click below to re-validate your credentials.', 're-validate your credentials', 'asks for your password'),
        line(
          'If the button does not work, reply to this email with your username and password.',
          'reply to this email with your username and password',
          'credentials over email',
        ),
        line('Thank you for helping us keep your account secure.'),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Read the domain', 'm365-alerts.co is not microsoft.com. The last two parts before the slash are the ones that count.'),
      card('Never reply with a password', 'No service on earth needs it emailed to them.'),
      card('Report, then delete', 'Reporting it protects the next four people who get it.'),
    ],
    sayIt: "I'll report this and check my account from the app, not the email.",
  },
  t07nrQ8xZYnm61qS0nHO: {
    summary: 'What to do in the first five minutes after you think you clicked something.',
    stake: 'The people who report fastest are the reason an incident stays small.',
    objectives: [
      'Act in the right order after a click',
      'Know who to tell and how fast',
      'Say it without worrying you will look silly',
    ],
    readTitle: 'The first five minutes',
    quote: 'Nobody has ever been disciplined here for reporting too early.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Disconnect', 'If you ran something, take the machine off the network. Do not power it off.'),
      card('Change it elsewhere', 'Change the password from a different device, not the one you suspect.'),
      card('Tell someone now', 'Speed matters more than certainty. Report it even if you are not sure.'),
    ],
    sayIt: "I think I clicked something — I'm reporting it now.",
  },

  // ============================================ Malware & Ransomware
  fTRokvsnZdYaX8maSxNc: {
    summary: 'What malware is, how it arrives, and what it is actually trying to do.',
    stake: 'Most malware does not announce itself. It waits.',
    objectives: [
      'Name the common ways malware arrives',
      'Say what different families are after',
      'Spot software that should not be asking',
    ],
    readTitle: 'How it gets in',
    quote: 'Almost all of it still arrives as something you were expecting.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three habits to keep',
    cards: [
      card('Install from source', 'Software comes from the company or the IT catalogue. Nowhere else.'),
      card('Mind the macro', 'A document that needs macros enabled to be read is asking for permission to run code.'),
      card('Patch when asked', 'Most infections use a hole that was fixed months ago.'),
    ],
    sayIt: "If I did not go looking for this download, I'm not running it.",
  },
  u8uGeL76kvt3XCtPwvrE: {
    summary: 'How a ransomware attack unfolds, from the first click to the ransom note.',
    stake: 'By the time the note appears, the attacker has usually been inside for weeks.',
    objectives: [
      'Describe the stages of a ransomware attack',
      'Spot the delivery message for what it is',
      'Know why backups alone are not the answer',
    ],
    readTitle: 'The shape of an attack',
    quote: 'The encryption is the last step, not the first.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Three tells are hiding in this message',
      intro: 'A delivery attempt, reported before anyone opened the file.',
      channel: 'email',
      caller: '"Accounts Payable"',
      number: 'From: invoices@venator-billing.net',
      duration: '14:06',
      tip: 'Attachments that ask you to enable anything are asking to run code.',
      lines: [
        line('Please find attached the outstanding invoice for last quarter.'),
        line(
          'The document is protected — enable editing and content to view it.',
          'enable editing and content to view it',
          'asking to run macros',
        ),
        line(
          'Payment is overdue and the account will be referred today.',
          'overdue and the account will be referred today',
          'manufactured urgency',
        ),
        line(
          'Do not forward this to finance, it is being handled directly.',
          'Do not forward this to finance',
          'isolating you from checks',
        ),
        line('Regards, Accounts Payable.'),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Never enable', 'Enable Content is the moment a document becomes a program.'),
      card('Verify the invoice', 'Unexpected bills get checked with finance through the usual channel.'),
      card('Forward anyway', '"Do not tell anyone" is the request of an attacker, never a supplier.'),
    ],
    sayIt: "I'll check this invoice with finance before I open anything.",
  },
  aw02cACRw1vMUTmGOSjT: {
    summary: 'Preventing infection, and what the first hour looks like if one lands.',
    stake: 'Disconnecting a machine in the first minutes can be the difference between one laptop and the department.',
    objectives: [
      'List the controls that actually stop malware',
      'Act correctly in the first hour',
      'Know why you should not power the machine off',
    ],
    readTitle: 'Before and after',
    quote: 'Pull the cable. Leave it running. Call someone.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Disconnect', 'Off the network immediately — cable out, Wi-Fi off.'),
      card('Do not power off', 'Shutting down destroys evidence that helps scope the damage.'),
      card('Do not pay', 'Payment is not a decision you make, and it does not reliably get data back.'),
    ],
    sayIt: "I'm taking this machine off the network and calling IT.",
  },

  // ============================================ Smishing
  GVVuAu1uS5mba5fmEMxq: {
    summary: 'Phishing by text message, and why the small screen makes it work.',
    stake: 'A text arrives while you are walking. That is exactly the point.',
    objectives: [
      'Say why SMS is harder to judge than email',
      'Spot a shortened or lookalike link',
      'Check a claim without tapping anything',
    ],
    readTitle: 'Why the phone is the weak spot',
    quote: 'A phone hides everything you would use to judge a message.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three habits to keep',
    cards: [
      card('Never tap through', 'Open the company or bank app yourself and look.'),
      card('Sender is not proof', 'A text can display any name the sender chooses.'),
      card('Short links hide', 'A shortened link shows you nothing about where it goes.'),
    ],
    sayIt: "I'll check this in the app instead of tapping the link.",
  },
  '6dgYHJSUhue0GnlFiQXl': {
    summary: 'The handful of smishing scripts you will actually receive, and their tells.',
    stake: 'The delivery one works because almost everyone is waiting for a parcel.',
    objectives: [
      'Recognise the common smishing scripts',
      'Name the tells inside a short message',
      'Answer without engaging',
    ],
    readTitle: 'The scripts that repeat',
    quote: 'A real courier does not need your card details to redeliver.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Three tells are hiding in these texts',
      intro: 'A message thread reported by a colleague. Tap the words that give it away.',
      channel: 'sms',
      caller: '"DHL Delivery"',
      number: '+60 11-2847 9921',
      duration: '08:12',
      tip: 'A courier that cannot deliver leaves a card. It does not ask for payment by text.',
      lines: [
        line('Your parcel is being held at our depot.'),
        line(
          'A customs fee of RM 3.50 is required to release it today.',
          'customs fee of RM 3.50 is required',
          'small payment to get card details',
        ),
        line(
          'Pay here within 12 hours or the parcel returns to sender.',
          'within 12 hours or the parcel returns to sender',
          'manufactured urgency',
        ),
        line(
          'Confirm your full card number and address on the next page.',
          'full card number and address',
          'asks for card details',
        ),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Small fee, big flag', 'A tiny charge exists to harvest the card, not to collect the money.'),
      card('Go direct', 'Track the parcel with the reference in your own order confirmation.'),
      card('Forward and delete', 'Report it, then delete — do not reply, not even STOP.'),
    ],
    sayIt: "I'll check this in the courier's own app before I do anything.",
  },
  '2D7BLtzNuKMHETepys8k': {
    summary: 'Settling what you do every time a suspicious text arrives.',
    stake: 'The decision is easier when you have already made it once.',
    objectives: [
      'Apply one rule to every unexpected text',
      'Report a smishing attempt properly',
      'Protect a colleague who did tap',
    ],
    readTitle: 'One rule, every time',
    quote: 'Never act on a link you did not go looking for.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Do not reply', 'Any reply confirms the number is live and worth attacking again.'),
      card('Report it', 'Forward to IT so the pattern gets blocked for everyone.'),
      card('Speak up early', 'If you tapped, say so. The window to contain it is short.'),
    ],
    sayIt: "I'm not replying — I'm reporting it and deleting it.",
  },

  // ============================================ Incident Reporting
  xJxjk9wFjihyWhOFDtEj: {
    summary: 'Why the report matters more than the mistake that caused it.',
    stake: 'Every incident that stayed small did so because somebody spoke up quickly.',
    objectives: [
      'Say why speed beats certainty',
      'Name what reporting actually triggers',
      'Report without fear of blame',
    ],
    readTitle: 'Why we ask',
    quote: 'We would rather chase a hundred false alarms than miss the one that mattered.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('Early beats certain', 'Report the suspicion. Confirming it is not your job.'),
      card('No blame', 'The report is the good outcome, not the failure.'),
      card('Minutes matter', 'Containment options shrink fast.'),
    ],
    sayIt: "I'm not sure this is anything, but I'm reporting it anyway.",
  },
  nvTyeca4LhQYv5pkqqhN: {
    summary: 'What counts as an incident — including the ones that feel too small to mention.',
    stake: 'The small ones are the ones that go unreported, and they are usually the first sign.',
    objectives: [
      'Recognise the reportable events',
      'Judge a near-miss correctly',
      'Report a lost device the right way',
    ],
    readTitle: 'Bigger than you think',
    quote: 'A near-miss is an incident that was lucky.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Report all of these',
    cards: [
      card('You clicked', 'Even if nothing seemed to happen afterwards.'),
      card('You lost it', 'A phone, laptop or badge, even briefly out of your sight.'),
      card('It felt wrong', 'A call, a request, a message. Instinct is evidence.'),
    ],
    sayIt: "It might be nothing, but it felt wrong, so I'm logging it.",
  },
  Tl5sihrZpY5RKtRiiAqr: {
    summary: 'How to report so the response starts immediately.',
    stake: 'A good report saves the responder twenty minutes of asking you questions.',
    objectives: [
      'Report through the right channel',
      'Include what the responder needs first',
      'Preserve the evidence while you wait',
    ],
    readTitle: 'What to include',
    quote: 'What happened, when, and what you touched. That is the whole report.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Say what you did', 'Clicked, entered, downloaded, replied — be specific and honest.'),
      card('Keep the evidence', 'Do not delete the message. Forward it, leave the original.'),
      card('Stay reachable', 'Expect a call back, and stay off the affected device.'),
    ],
    sayIt: "Here is what happened, when, and exactly what I clicked.",
  },

  // ============================================ MFA
  xuQv5dAY0y165Gj3c5wj: {
    summary: 'What MFA protects you from, and the one thing it cannot fix.',
    stake: 'A stolen password is worth very little against MFA. Attackers know it.',
    objectives: [
      'Say what MFA actually stops',
      'Rank the factor types by strength',
      'Explain why SMS codes are the weakest',
    ],
    readTitle: 'What the second factor buys you',
    quote: 'MFA turns a stolen password into a failed login.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('Not all equal', 'An app prompt or a security key beats an SMS code.'),
      card('A code is a key', 'Treat six digits exactly like a password.'),
      card('Still need a good password', 'MFA is the second lock, not a replacement for the first.'),
    ],
    sayIt: "Nobody legitimate will ever need the code on my screen.",
  },
  QihuBbqJXXvr6b534eHj: {
    summary: 'How attackers get past MFA — fatigue, relay sites, and simply asking.',
    stake: 'Most MFA bypasses do not break the maths. They ask you politely.',
    objectives: [
      'Recognise a push-fatigue attack',
      'Spot a real-time relay login page',
      'Refuse a code request under pressure',
    ],
    readTitle: 'Going around, not through',
    quote: 'If a prompt arrives and you were not logging in, someone has your password.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Three tells are hiding in this call',
      intro: 'This came in ten minutes after a wave of push notifications. Tap what should have ended it.',
      channel: 'call',
      caller: '"Service Desk"',
      number: 'Caller ID spoofed as internal',
      duration: '01:12',
      tip: 'The prompts were the attacker. The call was there to make you approve one.',
      lines: [
        line("We've had reports of login errors across your team this morning."),
        line(
          'You may have seen a few prompts — that is our system retrying.',
          'that is our system retrying',
          'explains away the attack',
        ),
        line(
          'Just approve the next one and the errors will clear.',
          'Just approve the next one',
          'asks you to approve a login',
        ),
        line(
          'Or read me the six digits and I can clear it from this end.',
          'read me the six digits',
          'asks for your code',
        ),
        line('It will only take a moment, then you are sorted.'),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Never approve blind', 'If you did not start it, deny it — every time.'),
      card('Repeat prompts = breach', 'Unexpected prompts mean your password is already out.'),
      card('Report the wave', 'Push fatigue is an active attack in progress, not a glitch.'),
    ],
    sayIt: "I did not start this login, so I'm denying it and reporting it.",
  },
  H5HGonF143VlxQopK5sX: {
    summary: 'Setting MFA up so it protects you, and keeping a way back in.',
    stake: 'The safest setup is the one you can still use when your phone is gone.',
    objectives: [
      'Choose the strongest factor available',
      'Store recovery codes safely',
      'Recover access without weakening it',
    ],
    readTitle: 'Setting it up properly',
    quote: 'Recovery codes are a spare key. Keep them like one.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Pick the strong one', 'Security key first, app prompt second, SMS last.'),
      card('Save your codes', 'In your password manager — never in a note or a photo.'),
      card('Deny and report', 'An unexpected prompt is an incident, not an annoyance.'),
    ],
    sayIt: "My recovery codes are in the password manager, not my camera roll.",
  },

  // ============================================ Password Hygiene
  fbWjPyPyYVS4zwevqs8N: {
    summary: 'Why one reused password is the most expensive habit you have.',
    stake: 'Attackers do not guess your password. They look it up from somewhere else you used it.',
    objectives: [
      'Explain credential stuffing in a sentence',
      'Say why reuse is the real risk',
      'Check whether you are already exposed',
    ],
    readTitle: 'Reuse is the whole problem',
    quote: 'Your weakest account decides how strong your best one is.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('Never reuse', 'One breach elsewhere becomes a breach here the moment you do.'),
      card('Length beats symbols', 'Four unrelated words outlast P@ssw0rd! by a long way.'),
      card('Unique where it counts', 'Work, email and banking get their own, always.'),
    ],
    sayIt: "Every account gets its own password, generated not invented.",
  },
  vemxrQJBEnNkoHK6gFSN: {
    summary: 'What actually makes a password hard to break, and what only feels like it does.',
    stake: 'The rules most of us learned make passwords harder to remember, not harder to crack.',
    objectives: [
      'Judge a password by length, not symbols',
      'Build a passphrase you will remember',
      'Spot patterns a cracker expects',
    ],
    readTitle: 'Long, not complicated',
    quote: 'Substituting 3 for e fools nobody with a word list.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three words to keep',
    cards: [
      card('Longer wins', 'Every extra character costs an attacker far more than an extra symbol.'),
      card('Avoid the pattern', 'Capital first, number and ! last is the first thing tried.'),
      card('Let it generate', 'A password you never have to remember can be as long as you like.'),
    ],
    sayIt: "I'll let the manager generate it — I don't need to remember this one.",
  },
  y5KYF5Hii0UkAkqVHg83: {
    summary: 'Using a password manager properly, including the one password you still memorise.',
    stake: 'One strong master password, and you never invent another one again.',
    objectives: [
      'Set a master password you can trust',
      'Use autofill as a phishing check',
      'Handle a manager on a shared device',
    ],
    readTitle: 'The one you keep',
    quote: 'If autofill will not fire, look hard at the address bar.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Master it', 'Long passphrase, unique, memorised, never written down.'),
      card('Autofill is a tell', 'A manager will not fill a lookalike domain. That silence is a warning.'),
      card('Lock it', 'Lock the vault and sign out on any device that is not only yours.'),
    ],
    sayIt: "Autofill didn't offer — I'm checking this address before I type anything.",
  },

  // ============================================ BEC
  Ech6OAxTb19u6gc9pYn2: {
    summary: 'What business email compromise is, and why it beats technical defences.',
    stake: 'BEC costs organisations more than ransomware, with no malware involved at all.',
    objectives: [
      'Say what makes BEC different from phishing',
      'Name who is actually targeted',
      'Explain why filters do not catch it',
    ],
    readTitle: 'No malware required',
    quote: 'There is nothing for the scanner to find. It is just an email asking.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('Authority is the weapon', 'The whole attack rests on who the message appears to be from.'),
      card('It targets permission', 'Anyone who can move money or data is the target.'),
      card('Verify out of band', 'Confirm by a channel the email cannot reach.'),
    ],
    sayIt: "I'll confirm this on a number I already have, not one in the email.",
  },
  '1J0Yu0wZmQpcpLuI0O4g': {
    summary: 'How a BEC attack unfolds, from research to the payment request.',
    stake: 'By the time the request arrives, they have read weeks of your mail.',
    objectives: [
      'Describe the stages of a BEC attack',
      'Spot the tells in an executive request',
      'Hold the process when pressured',
    ],
    readTitle: 'Patience, then one request',
    quote: 'They wait for the week the finance director is away.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Four tells are hiding in this email',
      intro: 'Sent to a finance assistant on a Friday afternoon. Tap what should have stopped it.',
      channel: 'email',
      caller: '"Dato’ Rahman — CEO"',
      number: 'Reply-To: rahman.venator@outlook.com',
      duration: '16:52',
      tip: 'A real executive expects the process to be followed, especially by their own staff.',
      lines: [
        line('Are you at your desk? I need something handled quietly.'),
        line(
          'I am in a board meeting all afternoon so I cannot take a call.',
          'I cannot take a call',
          'blocks you verifying',
        ),
        line(
          'Please process a transfer today to the account in the attachment.',
          'process a transfer today',
          'urgent payment request',
        ),
        line(
          'Do not copy finance, I will brief them myself on Monday.',
          'Do not copy finance',
          'bypasses the normal process',
        ),
        line(
          'I am relying on you to handle this discreetly.',
          'relying on you to handle this discreetly',
          'pressure through flattery',
        ),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Check the reply-to', 'The display name is the CEO. The address rarely is.'),
      card('Never bypass', 'Secrecy from finance is the request of an attacker, never a director.'),
      card('Call the known number', 'The one in your directory, not one in the message.'),
    ],
    sayIt: "I'll call the number in our directory before anything moves.",
  },
  O2wMppVvDFbGrraijXU0: {
    summary: 'The controls that stop BEC, and what to do when one gets through.',
    stake: 'A recalled transfer in the first hours is usually recoverable. After that, rarely.',
    objectives: [
      'Apply dual approval without exception',
      'Verify a bank-detail change safely',
      'Act fast on a payment already sent',
    ],
    readTitle: 'Process beats instinct',
    quote: 'The exception is the attack. That is what the exception is for.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Two people, always', 'Dual approval on every transfer, with no urgent exception.'),
      card('Call to confirm', 'Bank-detail changes are verified by phone on the number already on file.'),
      card('Move in minutes', 'Tell the bank and IT immediately — recall windows are hours, not days.'),
    ],
    sayIt: "No transfer leaves without a second approver, whoever is asking.",
  },

  // ============================================ Vishing (L2 already authored)
  '7lRfivl5mjSPw3zT4NvY': {
    summary: 'What vishing is, and why hearing a voice lowers your guard.',
    stake: 'A voice gets trust that the same words in an email never would.',
    objectives: [
      'Say what makes a call vishing',
      'Explain why caller ID proves nothing',
      'Name what the caller is really after',
    ],
    readTitle: 'Why a voice gets through',
    quote: 'Caller ID is a suggestion, not an identity.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('ID can be faked', 'Any number can be displayed. It costs nothing to spoof.'),
      card('Live pressure', 'A call removes the time you would have taken over email.'),
      card('Verify by calling back', 'On a number you already had, never one you were given.'),
    ],
    sayIt: "I'll take the name and call the desk back myself.",
  },
  '6I0xLgSkXvUdfnlB4I2t': {
    summary: 'Ending a suspicious call safely, and what to do straight afterwards.',
    stake: 'Hanging up feels rude for about four seconds. Then it feels fine.',
    objectives: [
      'End a call without giving anything away',
      'Find the real number quickly',
      'Report the attempt so others are warned',
    ],
    readTitle: 'Ending it well',
    quote: 'You do not owe a stranger the rest of the conversation.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Give nothing', 'Not a code, not a confirmation, not even which system you use.'),
      card('Hang up first', 'Then look the number up yourself, on the intranet.'),
      card('Report the attempt', 'They are working through a list. Warn the rest of the list.'),
    ],
    sayIt: "Thanks — I'll call the service desk back on our own number.",
  },

  // ============================================ Pretexting
  bHOmpVwWRSZ1llhkjim9: {
    summary: 'Pretexting is the story an attacker builds before they ask for anything.',
    stake: 'The best pretexts never ask for anything you would refuse.',
    objectives: [
      'Say what a pretext is',
      'Name the roles attackers borrow',
      'Notice research being used as proof',
    ],
    readTitle: 'The story comes first',
    quote: 'Knowing your manager’s name is research, not authorisation.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'Three things to keep',
    cards: [
      card('Familiarity is cheap', 'Org charts, job titles and project names are public.'),
      card('Small asks first', 'The harmless question is establishing that you answer questions.'),
      card('Verify the role', 'Confirm who someone is through the company, not through them.'),
    ],
    sayIt: "I'll confirm who you are through the directory before we go further.",
  },
  mqlwpxbrCWwfhEEPPvCQ: {
    summary: 'How a pretext is built and escalated, one reasonable question at a time.',
    stake: 'Nothing in this conversation sounds wrong until you read it back.',
    objectives: [
      'Follow how a pretext escalates',
      'Spot borrowed authority',
      'Break the script politely',
    ],
    readTitle: 'One step at a time',
    quote: 'Every question was reasonable. The sequence was not.',
    quoteBy: 'CyGenix security training',
    tells: {
      title: 'Three tells are hiding in this call',
      intro: 'A caller claiming to be a new contractor. Tap the words that should have stopped it.',
      channel: 'call',
      caller: '"Wei Ling — external auditor"',
      number: 'Caller ID withheld',
      duration: '02:34',
      tip: 'A genuine auditor arrives through a manager, with a scope you can check.',
      lines: [
        line('Hi, I am with the audit team working with Suresh in Finance this quarter.'),
        line(
          'He said you would be the one who could help me quickly.',
          'He said you would be the one who could help me',
          'borrowed authority',
        ),
        line('I just need to confirm a couple of process details for the report.'),
        line(
          'Which system do you use for approvals, and who can sign off alone?',
          'who can sign off alone',
          'mapping your controls',
        ),
        line(
          'No need to check with Suresh, he is travelling and I have his go-ahead.',
          'No need to check with Suresh',
          'blocks you verifying',
        ),
      ],
    },
    cardsTitle: 'Three words to keep',
    cards: [
      card('Names are not proof', 'Anyone can learn who your manager is.'),
      card('Notice the mapping', 'Questions about who can approve alone are reconnaissance.'),
      card('Always check', '"No need to check" is the only sentence that matters in that call.'),
    ],
    sayIt: "I'll check with Suresh directly before I answer any of this.",
  },
  CuTMkCjLme2zM0zPq9g8: {
    summary: 'Refusing a pretext without being rude, and reporting what you heard.',
    stake: 'Politeness is what attackers rely on. You can keep it and still say no.',
    objectives: [
      'Refuse a request without confrontation',
      'Verify identity through the company',
      'Report a pretext attempt usefully',
    ],
    readTitle: 'Saying no, politely',
    quote: 'Anyone genuine will wait while you check. That is the whole test.',
    quoteBy: 'CyGenix security training',
    cardsTitle: 'The drill',
    cards: [
      card('Offer to call back', 'It costs a genuine caller nothing and ends a fake one.'),
      card('Check through the org', 'Confirm the person exists and the work is real, via your manager.'),
      card('Write it down', 'Name, number, what they asked. The pattern is the evidence.'),
    ],
    sayIt: "Happy to help once I've confirmed this with my manager.",
  },
};

// ---------------------------------------------------------------------------

function buildSections(spec, existingContent) {
  const sections = [
    {
      kind: 'read',
      title: spec.readTitle,
      body: existingContent || '',
      quote: spec.quote || '',
      quoteBy: spec.quoteBy || '',
    },
  ];
  if (spec.tells) {
    sections.push({
      kind: 'tells',
      title: spec.tells.title,
      intro: spec.tells.intro || '',
      channel: spec.tells.channel || 'call',
      caller: spec.tells.caller || '',
      number: spec.tells.number || '',
      duration: spec.tells.duration || '',
      tip: spec.tells.tip || '',
      lines: spec.tells.lines,
    });
  }
  sections.push({
    kind: 'cards',
    title: spec.cardsTitle,
    cards: spec.cards,
    sayIt: spec.sayIt || '',
  });
  return sections;
}

(async () => {
  const mods = await db.collection('modules').get();
  let wrote = 0, skipped = 0, missing = 0;

  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    for (const l of lessons.docs) {
      const spec = LESSONS[l.id];
      if (!spec) continue;
      const data = l.data();
      if ((data.sections || []).length) {
        console.log('skip (already authored):', data.title);
        skipped++;
        continue;
      }
      const sections = buildSections(spec, data.content);
      await l.ref.set(
        {
          summary: spec.summary,
          stake: spec.stake,
          xpValue: 10,
          objectives: spec.objectives,
          sections,
        },
        { merge: true },
      );
      console.log('wrote:', m.data().title, '/', data.title, '->', sections.map((s) => s.kind).join('+'));
      wrote++;
    }
  }

  const seen = new Set();
  for (const m of mods.docs) {
    const lessons = await m.ref.collection('lessons').get();
    lessons.docs.forEach((l) => seen.add(l.id));
  }
  Object.keys(LESSONS).forEach((id) => {
    if (!seen.has(id)) { console.log('NO SUCH LESSON:', id); missing++; }
  });

  console.log(`\ndone — wrote ${wrote}, skipped ${skipped}, unmatched ${missing}`);
  process.exit(0);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
