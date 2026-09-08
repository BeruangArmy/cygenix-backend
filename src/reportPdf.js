// Renders one employee's KPI report onto an existing PDFKit document —
// factored out so the bulk "export all" route can call this once per
// employee (with doc.addPage() between them) instead of duplicating the
// single-employee layout.
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function rankLabel(rank) {
  return rank == null ? 'Unranked (no XP this window)' : `#${rank}`;
}

function section(doc, title, rows) {
  doc.fontSize(12).fillColor('#1D2033').text(title, { underline: true });
  doc.moveDown(0.3);
  rows.forEach(([label, value]) => {
    doc.fontSize(10).fillColor('#333333').text(`${label}: `, { continued: true }).fillColor('#111111').text(`${value}`);
  });
  doc.moveDown(0.8);
}

function renderEmployeeReport(doc, data) {
  doc.fontSize(18).fillColor('#1D2033').text('CyGenix Employee Report');
  doc.moveDown(0.15);
  doc.fontSize(9).fillColor('#888888').text(`Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`);
  doc.moveDown(0.8);

  doc.fontSize(15).fillColor('#111111').text(data.fullName);
  doc.fontSize(10).fillColor('#555555').text(
    `${data.employeeId || 'No ID'}  ·  ${data.departmentName || 'No department'}  ·  ${data.email || 'No email'}`
  );
  doc.moveDown(1);

  section(doc, 'Overview', [
    ['Level', `${data.level}`],
    ['Total XP', `${data.xpTotal}`],
    ['Streak', `${data.streakDays} day${data.streakDays === 1 ? '' : 's'}`],
  ]);

  section(doc, 'Leaderboard Rank', [
    ['All-Time', rankLabel(data.ranks.alltime)],
    ['Weekly', rankLabel(data.ranks.weekly)],
    ['Monthly', rankLabel(data.ranks.monthly)],
  ]);

  section(doc, 'Quiz Accuracy', [
    ['Correct Answers / Total', data.accuracy.total > 0 ? `${data.accuracy.correct} / ${data.accuracy.total}` : 'No quiz attempts yet'],
    ['Accuracy', data.accuracy.pct != null ? `${data.accuracy.pct.toFixed(1)}%` : '—'],
    ['Quiz Submissions', `${data.accuracy.attemptCount}`],
  ]);

  doc.fontSize(12).fillColor('#1D2033').text('Badges Earned', { underline: true });
  doc.moveDown(0.3);
  if (data.badges.length === 0) {
    doc.fontSize(10).fillColor('#888888').text('No badges earned yet.');
  } else {
    data.badges.forEach((b) => doc.fontSize(10).fillColor('#333333').text(`• ${b.badgeName}`));
  }
  doc.moveDown(0.8);

  doc.fontSize(12).fillColor('#1D2033').text('Modules Progress', { underline: true });
  doc.moveDown(0.3);
  if (data.modules.length === 0) {
    doc.fontSize(10).fillColor('#888888').text('No modules published yet.');
  } else {
    data.modules.forEach((m) => {
      const status = m.completed
        ? 'Completed (cleared Hard)'
        : m.highestLevel
          ? `In progress — cleared ${cap(m.highestLevel)}`
          : 'Not started';
      doc.fontSize(10).fillColor('#333333').text(`${m.title}: `, { continued: true }).fillColor('#111111').text(status);
    });
  }
}

module.exports = { renderEmployeeReport };
