const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../firebaseAdmin');
const { verifyToken, adminOnly } = require('../middleware/auth');
const { notify } = require('../notifications');
const { buildEmployeeReportData, computeAllRankMaps } = require('../reportData');
const { renderEmployeeReport } = require('../reportPdf');
const { buildEmployeeReportWorkbook, buildAllEmployeesReportWorkbook } = require('../reportExcel');

const router = express.Router();

async function totalLessonCount() {
  const modulesSnap = await db.collection('modules').get();
  return modulesSnap.docs.reduce((sum, m) => sum + (m.data().totalLessons || 0), 0);
}

// One collectionGroup read for every user's lessonProgress, grouped by
// owning user — far cheaper than an N+1 query per employee in the roster.
async function completedLessonCountsByUser() {
  const snap = await db.collectionGroup('lessonProgress').get();
  const counts = {};
  snap.docs.forEach((d) => {
    const uid = d.ref.parent.parent.id;
    counts[uid] = (counts[uid] || 0) + 1;
  });
  return counts;
}

// GET /admin/employees — roster with a completion % derived from
// lessonProgress (Table 5) vs. total lessons published across all modules.
router.get('/admin/employees', verifyToken, adminOnly, async (req, res) => {
  try {
    const [total, countsByUser, snap] = await Promise.all([
      totalLessonCount(),
      completedLessonCountsByUser(),
      db.collection('users').where('role', '==', 'employee').get(),
    ]);
    const employees = snap.docs.map((d) => {
      const data = d.data();
      const completedCount = countsByUser[d.id] || 0;
      const completion = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      return {
        id: d.id,
        fullName: data.fullName || 'Unknown',
        email: data.email,
        departmentId: data.departmentId || null,
        departmentName: data.departmentName || '—',
        xpTotal: data.xpTotal || 0,
        level: data.level || 1,
        streakDays: data.streakDays || 0,
        avatarId: data.avatarId || 'assets/mascot_neutral.png',
        completion,
      };
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employees.', detail: err.message });
  }
});

// GET /admin/employees/:id — single employee + quiz/challenge history + badges.
router.get('/admin/employees/:id', verifyToken, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Employee not found.' });

    const [attemptsSnap, challengeAttemptsSnap, lessonProgressSnap, badgesSnap, modulesSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('quizAttempts').orderBy('submittedAt', 'desc').get(),
      db.collection('users').doc(userId).collection('challengeAttempts').orderBy('attemptedAt', 'desc').get(),
      db.collection('users').doc(userId).collection('lessonProgress').get(),
      db.collection('users').doc(userId).collection('badges').get(),
      db.collection('modules').get(),
    ]);

    // Quiz attempts only store moduleId — join in the title here so the
    // Admin app can show "Phishing Awareness — Medium" instead of a raw
    // Firestore document ID.
    const moduleTitleById = {};
    modulesSnap.docs.forEach((d) => { moduleTitleById[d.id] = d.data().title || '(untitled module)'; });

    const data = doc.data();
    res.json({
      id: doc.id,
      fullName: data.fullName,
      email: data.email,
      departmentId: data.departmentId || null,
      departmentName: data.departmentName || '—',
      xpTotal: data.xpTotal || 0,
      level: data.level || 1,
      streakDays: data.streakDays || 0,
      avatarId: data.avatarId || 'assets/mascot_neutral.png',
      completedLessons: lessonProgressSnap.docs.map((d) => d.data()),
      quizAttempts: attemptsSnap.docs.map((d) => {
        const attempt = d.data();
        return { id: d.id, ...attempt, moduleTitle: moduleTitleById[attempt.moduleId] || attempt.moduleId };
      }),
      challengeAttempts: challengeAttemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      badges: badgesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employee.', detail: err.message });
  }
});

// GET /admin/dashboard-stats — real numbers for the Admin Dashboard tiles
// (previously hardcoded placeholders on the client).
router.get('/admin/dashboard-stats', verifyToken, adminOnly, async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [employeesSnap, modulesPublishedSnap, activeAttemptsSnap, total, countsByUser] = await Promise.all([
      db.collection('users').where('role', '==', 'employee').get(),
      db.collection('modules').where('status', '==', 'published').get(),
      db.collectionGroup('quizAttempts').where('submittedAt', '>=', weekAgo).get(),
      totalLessonCount(),
      completedLessonCountsByUser(),
    ]);

    const activeUids = new Set(activeAttemptsSnap.docs.map((d) => d.ref.parent.parent.id));
    const totalEmployees = employeesSnap.size;

    let avgCompletionPct = 0;
    if (total > 0 && totalEmployees > 0) {
      const sum = employeesSnap.docs.reduce((acc, d) => acc + Math.round(((countsByUser[d.id] || 0) / total) * 100), 0);
      avgCompletionPct = Math.round(sum / totalEmployees);
    }

    res.json({
      totalEmployees,
      activeThisWeek: activeUids.size,
      avgCompletionPct,
      modulesPublished: modulesPublishedSnap.size,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard stats.', detail: err.message });
  }
});

// POST /admin/employees/:id/notify  { title, body } — lets an admin poke a
// specific employee directly from the "Needs Attention" list. Uses the same
// notify() helper/notification shape as every other event in the app.
router.post('/admin/employees/:id/notify', verifyToken, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Employee not found.' });

    const title = (req.body && req.body.title) || 'A message from your admin';
    const body = (req.body && req.body.body) || 'Your admin noticed you\'re behind on your cybersecurity training — jump back in when you get a chance!';

    await notify(userId, { type: 'admin_message', title, body, meta: { fromAdmin: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notification.', detail: err.message });
  }
});

// POST /admin/modules/:id/notify-published — fans out a "module_unlocked"
// notification to every employee. Called by Admin > Content Management
// (Flutter) right after a module transitions to Published — the fan-out
// has to go through the trusted backend since a client can't write into
// every other employee's notifications subcollection directly.
router.post('/admin/modules/:id/notify-published', verifyToken, adminOnly, async (req, res) => {
  try {
    const moduleId = req.params.id;
    const moduleDoc = await db.collection('modules').doc(moduleId).get();
    if (!moduleDoc.exists) return res.status(404).json({ error: 'Module not found.' });
    const title = moduleDoc.data().title || 'A new module';

    const employeesSnap = await db.collection('users').where('role', '==', 'employee').get();
    await Promise.all(employeesSnap.docs.map((d) => notify(d.id, {
      type: 'module_unlocked',
      title: 'New module available',
      body: `"${title}" is now available to start.`,
      meta: { moduleId },
    })));

    res.json({ ok: true, notified: employeesSnap.size });
  } catch (err) {
    res.status(500).json({ error: 'Failed to notify employees.', detail: err.message });
  }
});

// GET /admin/employees/:id/report — one employee's KPI report as a PDF
// (level/XP, badges, per-module quiz-level progress, quiz accuracy,
// streak, leaderboard rank on all 3 windows). See reportData.js/reportPdf.js.
router.get('/admin/employees/:id/report', verifyToken, adminOnly, async (req, res) => {
  try {
    const data = await buildEmployeeReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Employee not found.' });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data.fullName.replace(/[^a-z0-9]+/gi, '_')}_report.pdf"`);
    doc.pipe(res);
    renderEmployeeReport(doc, data);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to build employee report.', detail: err.message });
  }
});

// GET /admin/employees/report/all — one combined PDF, one page per
// employee, for bulk KPI review. Rank maps and the module list are
// computed once up front and shared across every employee instead of
// being refetched per employee.
router.get('/admin/employees/report/all', verifyToken, adminOnly, async (req, res) => {
  try {
    const [employeesSnap, modulesSnap, rankMaps] = await Promise.all([
      db.collection('users').where('role', '==', 'employee').get(),
      db.collection('modules').orderBy('order').get(),
      computeAllRankMaps(),
    ]);
    if (employeesSnap.empty) return res.status(404).json({ error: 'No employees found.' });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="all_employees_report.pdf"');
    doc.pipe(res);

    let first = true;
    for (const empDoc of employeesSnap.docs) {
      const data = await buildEmployeeReportData(empDoc.id, { rankMaps, modulesSnap });
      if (!data) continue;
      if (!first) doc.addPage();
      first = false;
      renderEmployeeReport(doc, data);
    }
    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to build bulk employee report.', detail: err.message });
  }
});

// GET /admin/employees/:id/report/excel — same KPI report as the PDF
// route above, as an .xlsx workbook for easier spreadsheet review.
router.get('/admin/employees/:id/report/excel', verifyToken, adminOnly, async (req, res) => {
  try {
    const data = await buildEmployeeReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Employee not found.' });

    const wb = buildEmployeeReportWorkbook(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${data.fullName.replace(/[^a-z0-9]+/gi, '_')}_report.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to build employee report.', detail: err.message });
  }
});

// GET /admin/employees/report/all/excel — one row per employee, for bulk
// KPI review in a spreadsheet instead of the PDF's one-page-per-employee.
router.get('/admin/employees/report/all/excel', verifyToken, adminOnly, async (req, res) => {
  try {
    const [employeesSnap, modulesSnap, rankMaps] = await Promise.all([
      db.collection('users').where('role', '==', 'employee').get(),
      db.collection('modules').orderBy('order').get(),
      computeAllRankMaps(),
    ]);
    if (employeesSnap.empty) return res.status(404).json({ error: 'No employees found.' });

    const dataList = [];
    for (const empDoc of employeesSnap.docs) {
      const data = await buildEmployeeReportData(empDoc.id, { rankMaps, modulesSnap });
      if (data) dataList.push(data);
    }

    const wb = buildAllEmployeesReportWorkbook(dataList);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="all_employees_report.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to build bulk employee report.', detail: err.message });
  }
});

module.exports = router;
