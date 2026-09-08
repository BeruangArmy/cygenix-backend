const ExcelJS = require('exceljs');

// Renders one employee's KPI report onto a fresh workbook — mirrors
// reportPdf.js's layout (overview, rank, accuracy, badges, modules) but as
// a readable single-sheet spreadsheet instead of a printable document.
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function rankLabel(rank) {
  return rank == null ? 'Unranked (no XP this window)' : `#${rank}`;
}

function buildEmployeeReportWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Report');
  sheet.columns = [{ width: 28 }, { width: 40 }];

  const heading = (text) => {
    const row = sheet.addRow([text]);
    row.font = { bold: true, size: 13, color: { argb: 'FF1D2033' } };
    sheet.mergeCells(row.number, 1, row.number, 2);
  };
  const kv = (label, value) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  };

  heading('CyGenix Employee Report');
  sheet.addRow([`Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`]);
  sheet.addRow([]);

  kv('Name', data.fullName);
  kv('Employee ID', data.employeeId || 'No ID');
  kv('Department', data.departmentName || 'No department');
  kv('Email', data.email || 'No email');
  sheet.addRow([]);

  heading('Overview');
  kv('Level', data.level);
  kv('Total XP', data.xpTotal);
  kv('Streak', `${data.streakDays} day${data.streakDays === 1 ? '' : 's'}`);
  sheet.addRow([]);

  heading('Leaderboard Rank');
  kv('All-Time', rankLabel(data.ranks.alltime));
  kv('Weekly', rankLabel(data.ranks.weekly));
  kv('Monthly', rankLabel(data.ranks.monthly));
  sheet.addRow([]);

  heading('Quiz Accuracy');
  kv('Correct Answers / Total', data.accuracy.total > 0 ? `${data.accuracy.correct} / ${data.accuracy.total}` : 'No quiz attempts yet');
  kv('Accuracy', data.accuracy.pct != null ? `${data.accuracy.pct.toFixed(1)}%` : '—');
  kv('Quiz Submissions', data.accuracy.attemptCount);
  sheet.addRow([]);

  heading('Badges Earned');
  if (data.badges.length === 0) {
    sheet.addRow(['No badges earned yet.']);
  } else {
    data.badges.forEach((b) => sheet.addRow([b.badgeName]));
  }
  sheet.addRow([]);

  heading('Modules Progress');
  const modHeader = sheet.addRow(['Module', 'Status']);
  modHeader.font = { bold: true };
  if (data.modules.length === 0) {
    sheet.addRow(['No modules published yet.']);
  } else {
    data.modules.forEach((m) => {
      const status = m.completed
        ? 'Completed (cleared Hard)'
        : m.highestLevel
          ? `In progress — cleared ${cap(m.highestLevel)}`
          : 'Not started';
      sheet.addRow([m.title, status]);
    });
  }

  return wb;
}

// Bulk "export all" workbook — one row per employee, better suited to a
// spreadsheet than the PDF's one-page-per-employee layout since it's meant
// for scanning/filtering across the whole roster at once.
function buildAllEmployeesReportWorkbook(dataList) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('All Employees');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Level', key: 'level', width: 8 },
    { header: 'Total XP', key: 'xp', width: 10 },
    { header: 'Streak (days)', key: 'streak', width: 12 },
    { header: 'Quiz Accuracy', key: 'accuracy', width: 14 },
    { header: 'Quiz Submissions', key: 'attempts', width: 16 },
    { header: 'Badges Earned', key: 'badges', width: 14 },
    { header: 'Modules Completed', key: 'modulesCompleted', width: 18 },
    { header: 'Rank (All-Time)', key: 'rankAlltime', width: 14 },
    { header: 'Rank (Weekly)', key: 'rankWeekly', width: 14 },
    { header: 'Rank (Monthly)', key: 'rankMonthly', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  dataList.forEach((data) => {
    sheet.addRow({
      name: data.fullName,
      employeeId: data.employeeId || '—',
      department: data.departmentName || '—',
      email: data.email || '—',
      level: data.level,
      xp: data.xpTotal,
      streak: data.streakDays,
      accuracy: data.accuracy.pct != null ? `${data.accuracy.pct.toFixed(1)}%` : '—',
      attempts: data.accuracy.attemptCount,
      badges: data.badges.length,
      modulesCompleted: data.modules.filter((m) => m.completed).length,
      rankAlltime: rankLabel(data.ranks.alltime),
      rankWeekly: rankLabel(data.ranks.weekly),
      rankMonthly: rankLabel(data.ranks.monthly),
    });
  });

  return wb;
}

module.exports = { buildEmployeeReportWorkbook, buildAllEmployeesReportWorkbook };
