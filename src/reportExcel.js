const ExcelJS = require('exceljs');

// The admin KPI export, as a spreadsheet someone can actually work in.
//
// The previous version wrote what the PDF said, in cells. Everything was a
// string: accuracy as "83.3%", rank as "#3", "Unranked (no XP this window)"
// sitting in the same column as a number. Sorting by accuracy ordered it
// alphabetically, filtering by rank was meaningless, and the single-employee
// sheet merged cells down a key/value list, which disables sorting entirely.
//
// So the rule here is: a column holds one type, and that type is the real
// one. Percentages are fractions with a percent format, counts are numbers,
// dates are Dates, and a rank nobody holds is an empty cell rather than a
// sentence — blank sorts and filters correctly, prose does not.
//
// Shape, for both the single and the bulk export (the single one is simply a
// roster of one, so the columns and formatting are identical either way):
//
//   Summary          one row per employee, frozen header, auto-filter
//   <Employee name>  one tab each: standing, accuracy, ranks, modules, badges

const INK = 'FF1D2033';
const HEADER_FILL = 'FF1D2033';
const HEADER_INK = 'FFFFFFFF';
const BAND_FILL = 'FFF4F6FB';
const RULE = 'FFD7DCE8';

/** Excel forbids : \ / ? * [ ] in a sheet name and caps it at 31 characters. */
function sheetNameFor(data, taken) {
  const base = (data.fullName || data.email || data.uid || 'Employee')
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Employee';
  if (!taken.has(base.toLowerCase())) {
    taken.add(base.toLowerCase());
    return base;
  }
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
  return base.slice(0, 28) + '...';
}

const thinBorder = {
  top: { style: 'thin', color: { argb: RULE } },
  left: { style: 'thin', color: { argb: RULE } },
  bottom: { style: 'thin', color: { argb: RULE } },
  right: { style: 'thin', color: { argb: RULE } },
};

/** Bold white-on-ink header row, frozen, with an auto-filter across it. */
function dressHeader(sheet, columnCount, headerRowNumber = 1) {
  const row = sheet.getRow(headerRowNumber);
  row.font = { bold: true, color: { argb: HEADER_INK }, size: 11 };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 26;
  for (let c = 1; c <= columnCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = thinBorder;
  }
  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: columnCount },
  };
}

/** Subtle banding + borders so a wide row stays readable across the sheet. */
function dressBody(sheet, columnCount, firstDataRow = 2) {
  for (let r = firstDataRow; r <= sheet.rowCount; r++) {
    const banded = (r - firstDataRow) % 2 === 1;
    for (let c = 1; c <= columnCount; c++) {
      const cell = sheet.getRow(r).getCell(c);
      cell.border = thinBorder;
      if (banded) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
      }
    }
  }
}

// ------------------------------------------------------------ summary sheet

const SUMMARY_COLUMNS = [
  // Identity
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Department', key: 'department', width: 20 },
  { header: 'Employee ID', key: 'employeeId', width: 14 },
  { header: 'Email', key: 'email', width: 30 },
  // Standing
  { header: 'Level', key: 'level', width: 8 },
  { header: 'Total XP', key: 'xp', width: 11 },
  { header: 'Current Streak', key: 'streak', width: 14 },
  { header: 'Best Streak', key: 'bestStreak', width: 12 },
  // Performance
  { header: 'Quiz Accuracy', key: 'accuracy', width: 14 },
  { header: 'Questions Answered', key: 'answered', width: 18 },
  { header: 'Quiz Submissions', key: 'attempts', width: 16 },
  { header: 'Modules Completed', key: 'modulesCompleted', width: 18 },
  { header: 'Modules Available', key: 'modulesTotal', width: 17 },
  // Recognition
  { header: 'Badges Earned', key: 'badges', width: 14 },
  { header: 'Rank (All-Time)', key: 'rankAlltime', width: 15 },
  { header: 'Rank (Weekly)', key: 'rankWeekly', width: 14 },
  { header: 'Rank (Monthly)', key: 'rankMonthly', width: 15 },
  // Activity
  { header: 'Last Active', key: 'lastActive', width: 13 },
  { header: 'Joined', key: 'joined', width: 13 },
];

function addSummarySheet(wb, dataList) {
  const sheet = wb.addWorksheet('Summary');
  sheet.columns = SUMMARY_COLUMNS;

  dataList.forEach((data) => {
    sheet.addRow({
      name: data.fullName,
      department: data.departmentName || '',
      employeeId: data.employeeId || '',
      email: data.email || '',
      level: data.level,
      xp: data.xpTotal,
      streak: data.streakDays,
      bestStreak: data.highestStreak || 0,
      // A fraction, not "83.3%". Excel shows it as a percentage and still
      // sorts, filters and averages it as the number it is.
      accuracy: data.accuracy.pct != null ? data.accuracy.pct / 100 : null,
      answered: data.accuracy.total,
      attempts: data.accuracy.attemptCount,
      modulesCompleted: data.modules.filter((m) => m.completed).length,
      modulesTotal: data.modules.length,
      badges: data.badges.length,
      // Blank, not "Unranked": an empty cell keeps the column numeric so
      // "sort by rank" and "top 10" filters behave.
      rankAlltime: data.ranks.alltime,
      rankWeekly: data.ranks.weekly,
      rankMonthly: data.ranks.monthly,
      lastActive: data.lastActiveAt,
      joined: data.joinedAt,
    });
  });

  sheet.getColumn('accuracy').numFmt = '0.0%';
  sheet.getColumn('lastActive').numFmt = 'yyyy-mm-dd';
  sheet.getColumn('joined').numFmt = 'yyyy-mm-dd';
  for (const key of ['level', 'xp', 'streak', 'bestStreak', 'answered', 'attempts',
    'modulesCompleted', 'modulesTotal', 'badges', 'rankAlltime', 'rankWeekly', 'rankMonthly']) {
    sheet.getColumn(key).alignment = { horizontal: 'right' };
  }

  dressHeader(sheet, SUMMARY_COLUMNS.length);
  dressBody(sheet, SUMMARY_COLUMNS.length);
  return sheet;
}

// ------------------------------------------------------------- detail sheet

function addEmployeeSheet(wb, data, taken) {
  const sheet = wb.addWorksheet(sheetNameFor(data, taken));
  sheet.columns = [{ width: 26 }, { width: 34 }, { width: 16 }, { width: 16 }];

  const section = (title) => {
    const row = sheet.addRow([title]);
    row.font = { bold: true, size: 12, color: { argb: INK } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } };
    return row;
  };
  // Two plain columns rather than a merged banner: merged cells are what
  // stops a reader sorting or filtering anything below them.
  const kv = (label, value, numFmt) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    if (numFmt) row.getCell(2).numFmt = numFmt;
    return row;
  };

  const title = sheet.addRow([data.fullName]);
  title.font = { bold: true, size: 15, color: { argb: INK } };
  sheet.addRow([data.email || '']).getCell(1).font = { color: { argb: 'FF6B7280' } };
  sheet.addRow([]);

  section('Identity');
  kv('Department', data.departmentName || '');
  kv('Employee ID', data.employeeId || '');
  kv('Joined', data.joinedAt, 'yyyy-mm-dd');
  kv('Last active', data.lastActiveAt, 'yyyy-mm-dd');
  sheet.addRow([]);

  section('Standing');
  kv('Level', data.level);
  kv('Total XP', data.xpTotal);
  kv('Current streak (days)', data.streakDays);
  kv('Best streak (days)', data.highestStreak || 0);
  sheet.addRow([]);

  section('Quiz accuracy');
  kv('Correct answers', data.accuracy.correct);
  kv('Questions answered', data.accuracy.total);
  kv('Accuracy', data.accuracy.pct != null ? data.accuracy.pct / 100 : null, '0.0%');
  kv('Quiz submissions', data.accuracy.attemptCount);
  sheet.addRow([]);

  section('Leaderboard rank');
  kv('All-time', data.ranks.alltime);
  kv('Weekly', data.ranks.weekly);
  kv('Monthly', data.ranks.monthly);
  sheet.addRow([]);

  // Modules as a real table with its own header, so an admin can sort this
  // tab by status or levels cleared without untangling a layout first.
  section('Modules');
  const modHeaderRow = sheet.addRow(['Module', 'Status', 'Levels cleared', 'Highest level']);
  modHeaderRow.font = { bold: true, color: { argb: HEADER_INK } };
  for (let c = 1; c <= 4; c++) {
    modHeaderRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    modHeaderRow.getCell(c).border = thinBorder;
  }
  const modFirstRow = modHeaderRow.number + 1;
  if (data.modules.length === 0) {
    sheet.addRow(['No modules published yet.']);
  } else {
    data.modules.forEach((m) => {
      const status = m.completed
        ? 'Completed'
        : m.highestLevel
          ? 'In progress'
          : 'Not started';
      const row = sheet.addRow([
        m.title,
        status,
        m.levelsCleared,
        m.highestLevel ? m.highestLevel.charAt(0).toUpperCase() + m.highestLevel.slice(1) : '',
      ]);
      row.getCell(3).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 4; c++) row.getCell(c).border = thinBorder;
    });
    sheet.autoFilter = {
      from: { row: modHeaderRow.number, column: 1 },
      to: { row: modFirstRow + data.modules.length - 1, column: 4 },
    };
  }
  sheet.addRow([]);

  section('Badges earned');
  if (data.badges.length === 0) {
    sheet.addRow(['None yet.']);
  } else {
    data.badges.forEach((b) => sheet.addRow([b.badgeName]));
  }

  return sheet;
}

// ----------------------------------------------------------------- exports

/**
 * One employee. Still a Summary sheet plus their detail tab rather than a
 * lone key/value dump, so a single export and a bulk export open the same
 * way and the single row can be pasted into a wider roster.
 */
function buildEmployeeReportWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyGenix';
  wb.created = new Date();
  addSummarySheet(wb, [data]);
  addEmployeeSheet(wb, data, new Set(['summary']));
  return wb;
}

/**
 * The whole roster: one Summary row each, then one tab per employee.
 *
 * Detail tabs are capped — a workbook with hundreds of sheets is slow to
 * open and nobody reads past the summary anyway. The summary always lists
 * everyone, and it says so when the cap bites.
 */
const MAX_DETAIL_TABS = 50;

function buildAllEmployeesReportWorkbook(dataList) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyGenix';
  wb.created = new Date();

  const summary = addSummarySheet(wb, dataList);

  const taken = new Set(['summary']);
  dataList.slice(0, MAX_DETAIL_TABS).forEach((data) => addEmployeeSheet(wb, data, taken));

  if (dataList.length > MAX_DETAIL_TABS) {
    const note = summary.addRow([
      `Detail tabs are included for the first ${MAX_DETAIL_TABS} employees of ${dataList.length}; `
      + 'every employee appears in this summary.',
    ]);
    note.font = { italic: true, color: { argb: 'FF6B7280' } };
  }

  return wb;
}

module.exports = { buildEmployeeReportWorkbook, buildAllEmployeesReportWorkbook };
