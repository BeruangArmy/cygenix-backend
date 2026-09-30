// Makes the tap-along exercises hard the way real phishing is hard.
//
// The old tells were planted mistakes: broken grammar, an outright "send me
// your password", a domain nobody would mistake for real. Modern phishing is
// fluent, correctly formatted, and fails only on a detail you have to go
// looking for. These replace the obvious tells with the patterns that
// actually survive a glance, and every tell now carries an `explain` line
// naming the technique and pointing at the exact characters.
//
// Difficulty ramps by module unlock order (modules open 2/week, so this
// climbs as the learner does):
//
//   1-3  Phishing, Smishing, Vishing      clear tells, kept as they are —
//                                          only `explain` lines are added
//   4-6  BEC, Pretexting, Passwords       display-name vs address mismatch,
//                                          requests that do not fit the sender
//   7-9  MFA, Malware, Incident           domain lookalikes and copy with
//                                          nothing wrong but one character
//
// Keyed by module id + lesson sequenceOrder, so it does not depend on lesson
// document ids. Re-runnable: it overwrites the tells section of the lessons
// it names and leaves every other section alone.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const L = (text, phrase, label, explain) => ({ text, phrase, label, explain });
const T = (title, intro, channel, caller, number, tip, lines) => ({
  kind: 'tells', title, intro, channel, caller, number, duration: '', tip, lines,
});

const M = {
  PHISHING: '0CWGai8J7q0rxAS6fOsh',
  SMISHING: '85H5T3Y3Ldh3JKbagqWg',
  VISHING: 'biyeZLy4nvajdtYv6t17',
  BEC: 'PnidqxS3AejqssXBMFVn',
  PRETEXT: 'wNcOaCrq03cTuD1Kj5AO',
  PASSWORD: 'KJNy1HHPVhAulA6nn7QJ',
  MFA: 'D2MzfjL3w7IOl9QRnVQ4',
  MALWARE: '5gfknBKr3gDnAQZGTVwR',
  INCIDENT: 'CxP6a8gX2nxxNazQ6WWc',
};

// ===================================================================== tier 2
// Fluent, correctly formatted, no typos. The tell is who is really sending it
// and whether the request fits the person supposedly making it.

const TIER2 = {
  [M.BEC]: {
    1: T('Three things here do not fit',
      'Well written, no mistakes, and the name at the top is real. Tap the messages that do not add up.',
      'email', 'Dato\' Rahman  <ceo.office@vasbcorp.com>', 'Subject: Quick one before the board call',
      'Nothing here is misspelled. What is wrong is the shape of the request: the CEO does not route payments around finance, and a reply-to that differs from the sender is the attacker collecting your answer.',
      [
        L('Good morning. I hope the quarter is treating your team well.', '', '', ''),
        L('Reply-To: rahman.office@vasbcorp-exec.com', 'vasbcorp-exec.com',
          'reply-to is a different domain',
          'The From line is the real address; Reply-To is where your answer actually goes. vasbcorp-exec.com is a separate registration — your reply leaves the company.'),
        L('I would like this handled directly with you rather than through the finance mailbox.', 'rather than through the finance mailbox',
          'a request that routes around the process',
          'A chief executive asking to bypass finance is not a favour, it is the attack. Real approval chains exist precisely so no single person can be talked past them.'),
        L('Please treat it as confidential until the announcement on Monday.', 'as confidential until the announcement',
          'secrecy with a deadline attached',
          'Confidentiality is used here to stop you asking a colleague. A genuine embargo never prevents you verifying internally.'),
        L('Thank you, and please do call my assistant if anything is unclear.', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'A vendor you really do work with, writing the way they always do. Tap what should still stop the payment.',
      'email', 'Sentra Supplies  <accounts@sentrasupplies.com>', 'Subject: Updated remittance details',
      'The address is genuine and the tone is right. What changed is the destination of the money and the way you are being asked to confirm it.',
      [
        L('Further to invoice 88214, please note our remittance details have been updated.', 'remittance details have been updated',
          'a change of bank details, unprompted',
          'Redirecting an existing, already-approved payment is the single most profitable request in business email compromise. It arrives on a real thread because the account was taken over.'),
        L('Kindly confirm by replying to this message so we can log the change.', 'replying to this message',
          'verification routed back through the sender',
          'If the account is compromised, your confirmation is read by the attacker. Verification only counts on a channel you chose — a number you already held.'),
        L('Our finance line is being migrated this week, so please do not call the old number.', 'do not call the old number',
          'closing off the channel that would expose it',
          'The one number you have that they do not control is being ruled out for you. That instruction is the tell, not the migration.'),
        L('We appreciate your continued business.', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'An internal thread that has been running for a week. Tap the replies that should not have been acted on.',
      'chat', 'Finance thread · #ap-approvals', '',
      'The thread is real and so are the people. The tell is a new participant nobody added and a request that skips the step the thread exists to perform.',
      [
        L('Hafiz: Invoice 88214 is queued for Friday, standard terms.', '', '', ''),
        L('Unknown participant joined this conversation.', 'Unknown participant joined',
          'someone added themselves to the thread',
          'Forwarded or compromised threads let an attacker inherit all the trust the conversation has built. Check who is actually in a thread before acting on it.'),
        L('Can we release it today instead? I will get the second approval retrospectively.', 'second approval retrospectively',
          'dual approval turned into a formality',
          'Dual approval only works before the money moves. "Retrospectively" is the control being removed while sounding like it is being followed.'),
        L('Sending the updated account details separately to keep this thread clean.', 'separately to keep this thread clean',
          'moving the critical detail off the record',
          'Splitting the bank details out of the audited thread means nobody reviewing it later sees where the money went.'),
        L('Hafiz: I will check with procurement first.', '', '', ''),
      ]),
  },

  [M.PRETEXT]: {
    1: T('Three things here do not fit',
      'A caller who has clearly done their homework. Tap what should still have stopped the call.',
      'call', 'Internal Audit  <+60 3-2011 4408>', 'Caller ID matches the switchboard range',
      'Every detail they offer is checkable and true. That is what a pretext is: real facts assembled to make an unreasonable request feel routine.',
      [
        L('Good afternoon, I am finishing the quarterly controls review with Puan Aisha.', '', '', ''),
        L('I can see you reported the duplicate invoice in March, which is why I am calling you.', 'which is why I am calling you',
          'researched detail used as credentials',
          'Knowing something true about you is not proof of identity. Details like this come from org charts, LinkedIn and previous breaches, and they are the whole point of the pretext.'),
        L('Rather than raise a ticket, could you send the vendor list straight to me today?', 'Rather than raise a ticket',
          'a request that avoids the system that records it',
          'The ticket is what creates an auditable trail and lets someone else see the request. Avoiding it is the ask, dressed as saving you effort.'),
        L('If Aisha asks, tell her I have already cleared it with her office.', 'I have already cleared it',
          'authority you are told not to check',
          'Borrowed authority only holds while it is unverified. A real clearance survives you ringing Aisha yourself.'),
        L('I appreciate the help, I know it is a busy week.', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'A contractor at reception, badge on, expected on site. Tap what should still have been checked.',
      'chat', 'Reception log · Tuesday 09:14', '',
      'A real maintenance window, a real vendor name, a real badge holder. The tell is what is being asked for beyond the visit itself.',
      [
        L('Visitor states he is here for the scheduled UPS inspection in the server room.', '', '', ''),
        L('Says his escort is running late and asks to be let through in the meantime.', 'asks to be let through in the meantime',
          'the escort rule dropped for convenience',
          'The escort is the control. "In the meantime" removes it while sounding like patience, and unescorted time in a server room is the entire objective.'),
        L('Requests the door code so he does not have to call reception on the way back.', 'Requests the door code',
          'a credential asked for as a convenience',
          'A code shared once is shared permanently and cannot be attributed to anyone. Genuine contractors expect to be let in each time.'),
        L('Carries a work order that names a maintenance window ending last Friday.', 'a maintenance window ending last Friday',
          'paperwork that does not match today',
          'The document is real, just expired — reused from a legitimate previous visit. Read the dates on paperwork, not just the letterhead.'),
        L('Signed in at 09:14 and issued a visitor badge.', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'A helpdesk call that ended in a password reset. Tap where the procedure was dropped.',
      'call', 'Service desk transcript', '',
      'The caller never raised their voice or made a mistake. The procedure was set aside a step at a time, each one sounding reasonable on its own.',
      [
        L('Caller gave the employee number and the office they work from, both correct.', 'both correct',
          'correct answers to guessable questions',
          'Employee numbers and office locations sit in email signatures and directories. Verification has to use something an outsider could not look up.'),
        L('He was calling from a mobile, so the callback to his desk line was skipped.', 'the callback to his desk line was skipped',
          'the one step that would have caught it',
          'The callback is the only part of the process the caller cannot control. Skipping it because they are "not at their desk" is the request every pretext makes.'),
        L('Agent read the temporary password out over the phone to save time.', 'read the temporary password out',
          'the credential handed to whoever is holding the line',
          'A temporary password is a live credential. Sending it to the account of record, never reading it aloud, is what keeps the reset attached to the real person.'),
        L('Ticket closed as resolved within four minutes.', '', '', ''),
      ]),
  },

  [M.PASSWORD]: {
    1: T('Three things here do not fit',
      'A password reset notice that looks exactly like the real one. Tap what gives it away.',
      'email', 'VASB IT Service Desk  <no-reply@vasbcorp.com>', 'Subject: Password expiry notice',
      'The branding, the tone and the sender are all right. What is wrong is where the link goes and what it wants you to do before it gets there.',
      [
        L('Your network password expires in 3 days. You can change it from the portal at any time.', '', '', ''),
        L('To reset now, use the link below and enter your current password to confirm identity.', 'enter your current password',
          'the old password asked for as well as the new one',
          'A genuine reset never needs the password you already have — you are already signed in, or you are proving identity another way. Asking for both is how the working one is collected.'),
        L('If the portal is slow, our alternate site is available at portal.vasbcorp-it.com', 'portal.vasbcorp-it.com',
          'an alternate site on a different domain',
          'vasbcorp-it.com is not vasbcorp.com — the hyphen makes it a separate registration anyone can buy. "Alternate site" is the excuse for the domain being unfamiliar.'),
        L('This link expires in 30 minutes for your security.', 'expires in 30 minutes',
          'urgency framed as a safety feature',
          'A short window stops you checking with anyone. Framing it as protection is what makes it read as reassurance instead of pressure.'),
        L('IT Service Desk, VASB Corp.', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'A team chat about a shared tool. Tap the habits that will cost an account.',
      'chat', 'Project channel · #site-works', '',
      'Nobody here is careless. Each shortcut is a reasonable answer to a real problem, and each one removes the thing that would have limited the damage.',
      [
        L('The site portal only allows one licence, so we set up a single login for the team.', 'a single login for the team',
          'an account nobody can be held to',
          'A shared account has no owner: nothing it does can be attributed, and it cannot be revoked for one person when they leave.'),
        L('Password is in the pinned message so nobody has to ask for it.', 'in the pinned message',
          'a credential stored where the whole channel can read it',
          'Chat history is searchable, exportable and often retained for years. A password pinned in a channel is a password in every backup of that channel.'),
        L('We use the same one on the supplier portal to keep it simple.', 'the same one on the supplier portal',
          'reuse across systems',
          'Reuse converts one breach anywhere into access everywhere. Automated tools replay leaked pairs across hundreds of sites within minutes.'),
        L('Works fine so far.', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'A vault migration notice from the password manager the company actually uses. Tap what is wrong.',
      'email', '1Password  <support@1password.com>', 'Subject: Action required: vault migration',
      'A real product, a real address, and a process that genuinely exists. The tell is that no legitimate vault migration ever needs what this one asks for.',
      [
        L('We are migrating team vaults to the new infrastructure this month.', '', '', ''),
        L('To move your items, confirm your master password in the form below.', 'confirm your master password',
          'the one secret that is never collected',
          'A password manager is built so the provider cannot read your master password. Any message asking you to type it outside the app is, by design, not from them.'),
        L('Your Secret Key is also required to re-link this device.', 'Your Secret Key is also required',
          'the second half of the vault, requested together',
          'The master password and the Secret Key together are the whole vault. Asking for both in one form is asking for everything at once.'),
        L('Vaults not migrated by Friday will be archived and access suspended.', 'will be archived and access suspended',
          'loss of access used as the deadline',
          'Threatening to remove something you depend on is pressure, not policy. Check the claim inside the app you already have installed.'),
        L('The 1Password Team', '', '', ''),
      ]),
  },
};

// ===================================================================== tier 3
// Nothing is misspelled, nothing is rushed, nothing is impolite. The tell is
// one character in a domain, or a name that does not match the address behind
// it. These are meant to be genuinely difficult on a first read.

const TIER3 = {
  [M.MFA]: {
    1: T('Three things here do not fit',
      'Read the addresses letter by letter before you tap anything.',
      'email', 'Microsoft account team  <account-security-noreply@accountprotection.micros0ft.com>', 'Subject: New sign-in to your account',
      'This is a faithful copy of a real Microsoft notice. The only faults are in characters you do not normally read.',
      [
        L('We detected a new sign-in to your account from Kuala Lumpur, Malaysia.', '', '', ''),
        L('If this was not you, secure your account at accountprotection.micros0ft.com', 'micros0ft.com',
          'a zero standing in for the letter o',
          'micros0ft.com uses a zero in place of the "o". At normal reading size and in this typeface the two are almost identical, which is exactly why this substitution is still in use.'),
        L('Reviewing this alert requires your current verification code to continue.', 'requires your current verification code',
          'a one-time code requested by a notification',
          'A security alert tells you something happened; it never needs your code to show it to you. A code only ever goes into the login screen you opened yourself.'),
        L('Unrecognised sign-ins are locked automatically after 2 hours of inactivity.', 'locked automatically after 2 hours',
          'an invented rule creating a deadline',
          'No such automatic lock exists. Fabricated policy is how a message makes its own urgency sound like the provider being careful.'),
        L('Microsoft account team', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'The name at the top is right. Tap what is wrong underneath it.',
      'email', 'VASB IT Support  <it.support.vasbcorp@outlook.com>', 'Subject: Authenticator re-enrolment',
      'The display name is correct and the message is well written. The address it is really from, and what it asks you to do with your codes, are the tells.',
      [
        L('As part of the device refresh, your authenticator needs to be re-enrolled this week.', '', '', ''),
        L('Sent from it.support.vasbcorp@outlook.com', 'it.support.vasbcorp@outlook.com',
          'the company name moved into the local part',
          'Everything before the @ is chosen freely by whoever registered the mailbox. "vasbcorp" sitting there is decoration — the actual owner of this address is outlook.com.'),
        L('When the prompts arrive, approve each one so the new device can be registered.', 'approve each one',
          'blanket approval requested in advance',
          'Being told to expect several prompts and approve them all is how prompt bombing is made to feel like a procedure. Approve only what you started, one at a time.'),
        L('You may receive prompts outside working hours while the batch runs overnight.', 'outside working hours',
          'permission for the prompts to arrive at 3am',
          'Pre-excusing prompts at strange times removes the one signal that would have made you suspicious of them.'),
        L('Thank you for your cooperation.', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'Two people, both real, on a channel you both use every day. Tap what should not be acted on.',
      'chat', 'Direct message · IT Helpdesk', '',
      'Nothing here is badly written or obviously urgent. One participant simply is not who the channel says they are.',
      [
        L('Hi, following up on the ticket you raised about the shared drive.', '', '', ''),
        L('Profile created 14 minutes ago · display name matches an existing colleague', 'created 14 minutes ago',
          'a brand new account wearing a familiar name',
          'Display names are not unique on most platforms. A new account can take the name and picture of a colleague; account age and the underlying handle are what actually identify someone.'),
        L('I will send a verification prompt now, just accept it and I can see your session.', 'just accept it and I can see your session',
          'approval requested so someone else can get in',
          'Your approval authenticates a login someone is attempting right now. If you did not start it, accepting hands them the session.'),
        L('No need to raise this with the service desk, I have picked it up directly.', 'No need to raise this with the service desk',
          'the record being avoided',
          'Keeping the exchange off the ticketing system means no second person ever sees it. That is the request, not a courtesy.'),
        L('Thanks, this should only take a minute.', '', '', ''),
      ]),
  },

  [M.MALWARE]: {
    1: T('Three things here do not fit',
      'A delivery notice that gets everything right except three details. Tap them.',
      'email', 'DHL Express  <noreply@dhl-express.delivery>', 'Subject: Shipment 4471882 — customs documentation',
      'Correct branding, correct tone, no errors. The tells are the domain, the attachment type, and an instruction real software never gives.',
      [
        L('Your shipment is held pending customs documentation.', '', '', ''),
        L('Sent from noreply@dhl-express.delivery', 'dhl-express.delivery',
          'a lookalike domain on an unfamiliar ending',
          'DHL sends from dhl.com. "dhl-express.delivery" borrows the brand as a word inside a domain anyone can register — the hyphen and the unusual ending are both doing work.'),
        L('The attached customs form is Shipment_4471882.pdf.htm', 'Shipment_4471882.pdf.htm',
          'a double extension',
          'The real extension is the last one: this is an .htm web page dressed as a PDF. The ".pdf" is part of the filename, not the file type.'),
        L('If the form appears blank, enable editing to load the content.', 'enable editing to load the content',
          'the prompt that runs the payload',
          'Enable editing and enable content are what release macros or scripts. A document that needs them to display anything is not a document.'),
        L('DHL Express Customer Service', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'An IT notice about a tool you genuinely use. Tap what is wrong with it.',
      'email', 'VASB IT Operations  <it-ops@vasbcorp.com>', 'Subject: Endpoint agent update required',
      'The address really is the company domain. The tell is what the message asks you to do with it — legitimate internal software never arrives this way.',
      [
        L('A required security agent update is available for your workstation.', '', '', ''),
        L('Download the installer from vasbcorp.com.updates-cdn.net and run it as administrator.', 'vasbcorp.com.updates-cdn.net',
          'the company domain used only as a prefix',
          'Read a domain right to left: the owner is updates-cdn.net. Everything before the final dot, including "vasbcorp.com", is a subdomain they chose to make it look right.'),
        L('You will need to approve the elevation prompt to complete installation.', 'approve the elevation prompt',
          'administrator rights requested from the user',
          'Managed software is pushed by IT and installs without asking you for admin rights. Being asked to elevate is the moment a program gets the run of the machine.'),
        L('If your antivirus flags the file, add an exclusion and continue.', 'add an exclusion and continue',
          'being told to overrule the thing protecting you',
          'No legitimate update instructs you to disable a detection. The instruction exists because the file is, correctly, being detected.'),
        L('VASB IT Operations', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'An incident already in progress. Tap the responses that made it worse.',
      'chat', 'Direct message · colleague', '',
      'Calm, sensible-sounding decisions. Each one destroys something the response team needs or gives the malware more room.',
      [
        L('My machine has been slow since I opened that invoice this morning.', '', '', ''),
        L('I restarted it a few times and it seems better, so I carried on working.', 'I restarted it a few times',
          'a restart treated as a fix',
          'Restarting clears the symptom you can see and leaves persistence in place. It also drops volatile evidence that would have shown what ran.'),
        L('Still connected to the share drive, I did not want to lose the files I had open.', 'Still connected to the share drive',
          'the path the infection spreads along, left open',
          'Network shares are how one compromised machine becomes many. Disconnecting is the first containment step precisely because it costs you the open files.'),
        L('I emptied the downloads folder and the recycle bin to be safe.', 'emptied the downloads folder and the recycle bin',
          'the sample deleted before anyone saw it',
          'The file is what tells the response team what this is and who else received it. Deleting it feels like cleaning up and removes the only evidence.'),
        L('Should I tell anyone or is it fine now?', '', '', ''),
      ]),
  },

  [M.INCIDENT]: {
    1: T('Three things here do not fit',
      'A message about reporting, from an address that almost belongs to us. Tap what is wrong.',
      'email', 'VASB Security Operations  <soc@vasb-corp.com>', 'Subject: Mandatory incident declaration',
      'Written exactly as a real security notice would be. The tells are one hyphen, one instruction that inverts the point of reporting, and a channel that leads away from the company.',
      [
        L('All staff must declare any suspected incident from the last 30 days.', '', '', ''),
        L('Sent from soc@vasb-corp.com', 'vasb-corp.com',
          'a hyphen inserted into the real domain',
          'vasbcorp.com and vasb-corp.com are two different registrations. A single hyphen is among the cheapest and most effective lookalikes because the eye reads the words, not the punctuation.'),
        L('Declarations should be submitted through the external portal linked below.', 'through the external portal',
          'reporting routed outside the company',
          'Incident reports go to your own security team through a channel you already know. An external portal is an attacker collecting exactly the information you would least like them to have.'),
        L('Include the systems affected and any credentials that may have been exposed.', 'any credentials that may have been exposed',
          'the passwords themselves requested "for the report"',
          'A real report names what happened. It never asks you to type the credential in — knowing an account is affected is enough to act on it.'),
        L('VASB Security Operations', '', '', ''),
      ]),
    2: T('Three things here do not fit',
      'A manager replying to someone who wants to report something. Tap the advice that should not be followed.',
      'chat', 'Direct message · line manager', '',
      'Reasonable, well-meant, and wrong. Every delay here is time the incident keeps running.',
      [
        L('You think you clicked something on Monday and nothing has happened since?', '', '', ''),
        L('Let us wait until we are certain before we put it in writing.', 'wait until we are certain',
          'certainty made a condition of reporting',
          'Reports are triaged by people whose job is to decide. Waiting for certainty means the only person judging it is the one least equipped to, and the clock runs the whole time.'),
        L('Write it up properly first so we are not sending them half a story.', 'Write it up properly first',
          'completeness put ahead of speed',
          'Early containment prevents spread; detail can be added afterwards. A thorough report filed late describes damage that a rough report filed now would have prevented.'),
        L('No need to name who clicked it, I would rather keep this off the record.', 'keep this off the record',
          'the report made unattributable',
          'Security needs to know which account and which machine to act at all. "Off the record" protects nobody and makes the report unusable.'),
        L('I will mention it at the team meeting on Thursday.', '', '', ''),
      ]),
    3: T('Three things here do not fit',
      'A follow-up after an incident was reported. Tap what is not really from the security team.',
      'email', 'VASB Incident Response  <ir@vasbcorp.com>', 'Subject: RE: your report — next steps',
      'This lands on a thread you started, which is what makes it convincing. Read what it asks for rather than what it refers to.',
      [
        L('Thank you for the report. We have opened case INC-2291 and begun triage.', '', '', ''),
        L('To confirm your identity on the case, reply with your network password.', 'reply with your network password',
          'the response team asking for a credential',
          'Your own security team never needs your password — they can act on your account without it. A request for one on a real thread means someone else is reading that thread.'),
        L('Please also install the remote session tool attached so we can inspect the device.', 'install the remote session tool attached',
          'remote access delivered as an attachment',
          'Support tooling is deployed by IT to managed devices, not emailed to you. An attachment that grants remote control is the compromise, not the investigation.'),
        L('Do not discuss the case with colleagues while the investigation is open.', 'Do not discuss the case with colleagues',
          'isolation dressed as investigative process',
          'Real investigations restrict what is shared publicly, never whether you can check with your own team. Isolation is how a second stage goes unnoticed.'),
        L('VASB Incident Response', '', '', ''),
      ]),
  },
};

// ===================================================================== tier 1
// Kept as they are — these are the first three modules and clear tells are
// correct there. Only the explanation is added, matched on the phrase.

const TIER1_EXPLAIN = {
  'sign in on my behalf': 'Your access is issued to you and logged as you. Anything done with it is done in your name, whoever asked.',
  'your username and password': 'No system and no colleague needs your password. A request for it is the whole attack, however ordinary the wrapper.',
  'keep this between us': 'Secrecy exists to stop you asking the one person who would recognise it. That is its only function here.',
  'I clicked the link first': 'Opening it is the action the message was built to cause. Curiosity and compliance land in the same place.',
  'Replying here': 'A reply proves the address is live and monitored, which is worth money on its own even if you send nothing else.',
  'leave it a few days': 'The gap between click and report is the window the attacker works in. Nothing about waiting makes it smaller.',
  'pos-my.delivery-update.net': 'Read right to left: the owner is delivery-update.net. The courier name is a subdomain anyone can put there.',
  'within 12 hours': 'A deadline you cannot verify is pressure, not information. Real couriers hold parcels for days and say so in their own app.',
  'Reply STOP': 'Replying anything, including STOP, confirms a real person reads this number. Block instead of answering.',
  'I tapped the link': 'A convincing copy is the normal case, not the exception — it is cheap to clone a login page exactly.',
  'text it back': 'A code you pass on is a code you have given away. It authenticates you, never the person asking.',
  'the same one the bank always uses': 'Sender IDs and numbers can be set to any value. A familiar name in the header proves nothing at all.',
};

// ---------------------------------------------------------------------------

async function applySection(moduleId, seq, section, report) {
  const mod = db.collection('modules').doc(moduleId);
  const snap = await mod.collection('lessons').where('sequenceOrder', '==', seq).get();
  if (snap.empty) { report.missing.push(`${moduleId} seq${seq}`); return; }
  const doc = snap.docs[0];
  const sections = doc.data().sections || [];
  const at = sections.findIndex((x) => x.kind === 'tells');
  const next = [...sections];
  if (at >= 0) next[at] = section;
  else {
    const cardsAt = next.findIndex((x) => x.kind === 'cards');
    next.splice(cardsAt < 0 ? next.length : cardsAt, 0, section);
  }
  await doc.ref.set({ sections: next }, { merge: true });
  report.replaced.push(`${doc.data().title}`);
}

(async () => {
  // Validate before writing a single document.
  let bad = 0;
  for (const tier of [TIER2, TIER3]) {
    for (const [moduleId, lessons] of Object.entries(tier)) {
      for (const [seq, sec] of Object.entries(lessons)) {
        const tells = sec.lines.filter((l) => l.phrase);
        for (const l of tells) {
          if (!l.text.includes(l.phrase)) {
            console.log('BAD PHRASE', moduleId, seq, JSON.stringify(l.phrase)); bad++;
          }
          if (!l.explain) { console.log('NO EXPLAIN', moduleId, seq, JSON.stringify(l.phrase)); bad++; }
        }
        if (tells.length < 3) { console.log('TOO FEW TELLS', moduleId, seq, tells.length); bad++; }
      }
    }
  }
  if (bad) { console.error(`\n${bad} problems — nothing written.`); process.exit(1); }
  console.log('all phrases and explanations verified\n');

  const report = { replaced: [], missing: [] };

  console.log('TIER 2 — display-name and context mismatches (modules 4-6)');
  for (const [moduleId, lessons] of Object.entries(TIER2)) {
    for (const [seq, sec] of Object.entries(lessons)) {
      await applySection(moduleId, Number(seq), sec, report);
    }
  }
  console.log('TIER 3 — domain lookalikes and near-perfect copy (modules 7-9)');
  for (const [moduleId, lessons] of Object.entries(TIER3)) {
    for (const [seq, sec] of Object.entries(lessons)) {
      await applySection(moduleId, Number(seq), sec, report);
    }
  }
  for (const t of report.replaced) console.log('  replaced tap-along in:', t);
  if (report.missing.length) console.log('  MISSING lessons:', report.missing.join(', '));

  // Tier 1 keeps its lines; only the explanation is filled in.
  console.log('\nTIER 1 — adding explanations, text unchanged (modules 1-3)');
  let explained = 0;
  for (const moduleId of [M.PHISHING, M.SMISHING, M.VISHING]) {
    const lessons = await db.collection('modules').doc(moduleId).collection('lessons').get();
    for (const doc of lessons.docs) {
      const sections = doc.data().sections || [];
      let touched = false;
      const next = sections.map((sec) => {
        if (sec.kind !== 'tells') return sec;
        return {
          ...sec,
          lines: (sec.lines || []).map((l) => {
            const e = TIER1_EXPLAIN[l.phrase];
            if (!e || l.explain === e) return l;
            touched = true;
            explained++;
            return { ...l, explain: e };
          }),
        };
      });
      if (touched) {
        await doc.ref.set({ sections: next }, { merge: true });
        console.log('  explained:', doc.data().title);
      }
    }
  }
  console.log(`\n${report.replaced.length} tap-alongs replaced, ${explained} tier-1 tells explained.`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
