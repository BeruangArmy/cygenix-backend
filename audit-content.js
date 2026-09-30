// Full content audit: every lesson, every section, every quiz question.
//
// Read-only. Fixes nothing, writes nothing — it produces the list of places
// content is missing, wrong, or stale so the fixing can be decided rather
// than guessed at.
//
// Checks, per lesson:
//   - the lesson can actually be finished (sections exist and each is playable)
//   - a tap-along is solvable: at least one tell, every highlight phrase is a
//     real substring of its line, and every tell explains itself
//   - keep-cards exist and have content
//   - a stat section cites a source (the model refuses to render one without)
//   - nothing references the retired venatorcorp domain
//   - no placeholder text left behind
//
// And per quiz question:
//   - correctOption is a valid index into options
//   - options are non-empty, unique, and there are at least two
//   - the question has feedback
//   - nothing references the retired domain or placeholder text
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|placeholder|xxxx|sample text/i;
const STALE_DOMAIN = /venatorcorp/i;

const problems = [];
const note = (where, severity, msg) => problems.push({ where, severity, msg });

function auditLesson(moduleTitle, lesson) {
  const d = lesson.data();
  const where = `${moduleTitle} / ${d.title || '(untitled)'}`;
  const sections = d.sections || [];

  if (!sections.length && !(d.content || '').trim()) {
    note(where, 'BLOCKER', 'no sections and no body — the lesson has nothing to show');
    return;
  }

  const kinds = sections.map((s) => s.kind || 'read');
  if (!kinds.includes('cards')) note(where, 'minor', 'no keep-cards section to close the lesson');

  sections.forEach((s, i) => {
    const at = `${where} · section ${i + 1} (${s.kind || 'read'})`;
    const blob = JSON.stringify(s);
    if (PLACEHOLDER.test(blob)) note(at, 'MAJOR', 'placeholder text found');
    if (STALE_DOMAIN.test(blob)) {
      const hits = (blob.match(/[a-z0-9.@_-]*venatorcorp[a-z0-9.-]*/gi) || []);
      note(at, 'MAJOR', `retired domain still referenced: ${[...new Set(hits)].slice(0, 3).join(', ')}`);
    }

    switch (s.kind) {
      case 'tells': {
        const lines = s.lines || [];
        if (!lines.length) { note(at, 'BLOCKER', 'tap-along has no lines'); break; }
        const tells = lines.filter((l) => l.phrase && l.phrase.trim());
        if (!tells.length) {
          note(at, 'BLOCKER', 'tap-along has no tells — the Continue gate can never open');
          break;
        }
        for (const l of tells) {
          if (!(l.text || '').includes(l.phrase)) {
            note(at, 'BLOCKER',
              `highlight phrase is not in its line, so the tell is uncountable and untappable: ${JSON.stringify(l.phrase)}`);
          }
          if (!l.label || !l.label.trim()) note(at, 'minor', `tell has no label: ${JSON.stringify(l.phrase)}`);
          if (!l.explain || !l.explain.trim()) note(at, 'minor', `tell has no explanation: ${JSON.stringify(l.phrase)}`);
        }
        if (tells.length === lines.length) {
          note(at, 'MAJOR', 'every line is a tell — nothing to discriminate against');
        }
        break;
      }
      case 'cards': {
        const cards = (s.cards || []).filter((c) => (c.word || '').trim());
        if (!cards.length) note(at, 'BLOCKER', 'keep-cards section has no cards — renders as nothing');
        break;
      }
      case 'stat': {
        const bars = (s.bars || []).filter((b) => (b.label || '').trim());
        if (!bars.length) note(at, 'BLOCKER', 'stat section has no bars — the model drops it, so the section vanishes');
        if (!(s.source || '').trim()) note(at, 'BLOCKER', 'stat section has no source — the model refuses to render it');
        break;
      }
      default: {
        if (!(s.body || '').trim()) note(at, 'BLOCKER', 'read section has no body — the model drops it');
      }
    }
  });
}

function auditQuestion(moduleTitle, q) {
  const d = q.data();
  const where = `${moduleTitle} · quiz [${d.level || '?'}] ${String(d.questionText || '').slice(0, 52)}`;
  const opts = d.options || [];

  if (!String(d.questionText || '').trim()) note(where, 'BLOCKER', 'question has no text');
  if (opts.length < 2) { note(where, 'BLOCKER', `only ${opts.length} option(s)`); return; }

  const blank = opts.filter((o) => !String(o || '').trim()).length;
  if (blank) note(where, 'BLOCKER', `${blank} blank option(s)`);

  const seen = new Set(opts.map((o) => String(o).trim().toLowerCase()));
  if (seen.size !== opts.length) note(where, 'MAJOR', 'duplicate options');

  const ci = d.correctOption;
  if (typeof ci !== 'number' || ci < 0 || ci >= opts.length) {
    note(where, 'BLOCKER', `correctOption ${JSON.stringify(ci)} is not a valid index into ${opts.length} options`);
  } else if (!String(opts[ci] || '').trim()) {
    note(where, 'BLOCKER', 'the correct option is blank');
  }

  if (!String(d.feedback || '').trim()) note(where, 'minor', 'no feedback shown after answering');

  const blob = JSON.stringify(d);
  if (PLACEHOLDER.test(blob)) note(where, 'MAJOR', 'placeholder text found');
  if (STALE_DOMAIN.test(blob)) {
    const hits = (blob.match(/[a-z0-9.@_-]*venatorcorp[a-z0-9.-]*/gi) || []);
    note(where, 'MAJOR', `retired domain: ${[...new Set(hits)].slice(0, 2).join(', ')}`);
  }
}

(async () => {
  const mods = await db.collection('modules').orderBy('order').get();
  let lessons = 0; let questions = 0;
  const perModule = [];

  for (const m of mods.docs) {
    const title = m.data().title;
    const ls = await m.ref.collection('lessons').orderBy('sequenceOrder').get()
      .catch(() => m.ref.collection('lessons').get());
    const qs = await m.ref.collection('quizQuestions').get();

    for (const l of ls.docs) { auditLesson(title, l); lessons++; }
    for (const q of qs.docs) { auditQuestion(title, q); questions++; }

    // Level coverage: the state machine serves 5 per level, easy -> hard.
    const byLevel = {};
    for (const q of qs.docs) {
      const lv = q.data().level || '?';
      byLevel[lv] = (byLevel[lv] || 0) + 1;
    }
    for (const lv of ['easy', 'medium', 'hard']) {
      const n = byLevel[lv] || 0;
      if (n < 5) note(`${title} · quiz`, 'BLOCKER', `only ${n} ${lv} question(s) — a level needs 5`);
    }
    perModule.push({ title, lessons: ls.size, questions: qs.size, byLevel });
  }

  console.log('=================== COVERAGE ===================');
  for (const p of perModule) {
    console.log(`${p.title.slice(0, 38).padEnd(40)} ${p.lessons} lessons · ${p.questions} questions ` +
      `(easy ${p.byLevel.easy || 0} / med ${p.byLevel.medium || 0} / hard ${p.byLevel.hard || 0})`);
  }
  console.log(`\ntotal: ${lessons} lessons, ${questions} questions`);

  console.log('\n=================== PROBLEMS ==================');
  const order = { BLOCKER: 0, MAJOR: 1, minor: 2 };
  problems.sort((a, b) => order[a.severity] - order[b.severity]);
  const counts = { BLOCKER: 0, MAJOR: 0, minor: 0 };
  for (const p of problems) counts[p.severity]++;
  if (!problems.length) console.log('none found.');
  for (const p of problems) console.log(`[${p.severity}] ${p.where}\n        ${p.msg}`);
  console.log(`\nBLOCKER ${counts.BLOCKER} · MAJOR ${counts.MAJOR} · minor ${counts.minor}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
