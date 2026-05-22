/**
 * BSC Candidate CRM — Google Apps Script Backend
 * Deploy as: Execute as ME · Anyone (even anonymous) can access
 *
 * Sheet tabs required:
 *   Candidates | HR_Status | Interview_Schedule | Interview_Questions
 *   Selection_Offer | Onboarding_Checklist | Exit_Checklist
 *   Roles_Config | Users
 */

// ── SHEET ID — paste your Google Sheet ID here ──
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

// ── Column maps per sheet (1-indexed) ──
const COL = {
  Candidates: {
    APP_NO:     1,  NAME:       2,  PHONE:       3,  DOB:         4,
    DESIG:      5,  SOURCE:     6,  REFERRER:    7,  STATUS:      8,
    DATE:       9,  SALARY:     10, RESUME:      11, Q1:          12,
    Q2:         13, Q3:         14, Q4:          15, DAYS_IN:     16,
    CREATED_AT: 17, UPDATED_AT: 18
  },
  Interview_Schedule: {
    APP_NO:1, CANDIDATE:2, DESIG:3, ROUND:4, INTERVIEWER:5,
    SCHED_DATE:6, SCHED_TIME:7, STATUS:8, CREATED_AT:9
  },
  Interview_Questions: {
    DESIG:1, Q_ID:2, QUESTION:3, TYPE:4, MAX_SCORE:5, OPTIONS:6
  },
  Selection_Offer: {
    APP_NO:1, NAME:2, DESIG:3, NOTICE_PD:4, EST_DOJ:5,
    CALL1_DATE:6, CALL2_DATE:7, CONFIRM_DATE:8,
    OFFER_LETTER:9, STATUS:10, CREATED_AT:11, UPDATED_AT:12
  },
  Onboarding_Checklist: {
    APP_NO:1, NAME:2, DESIG:3, DOJ:4, ITEM:5,
    DONE:6, DONE_BY:7, DONE_AT:8, DUE:9, RESPONSIBLE:10
  },
  Exit_Checklist: {
    EMP_ID:1, NAME:2, DESIG:3, EXIT_DATE:4, REASON:5,
    FF_STATUS:6, SOFTWARE_INACTIVE:7, REHIRE:8,
    ITEM:9, DONE:10, DONE_BY:11, DONE_AT:12
  },
  Users: {
    USERNAME:1, PASSWORD:2, ROLE:3, ACTIVE:4, CREATED_AT:5
  },
  Roles_Config: {
    ROLE:1, DESIG:2, ACTIVE:3
  }
};

// ── Utility: get sheet by name ──
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found`);
  return sheet;
}

// ── Utility: sheet data as array of row-objects ──
function getRows(sheetName, colMap) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    Object.entries(colMap).forEach(([key, colIdx]) => {
      obj[key] = row[colIdx - 1] ?? '';
    });
    return obj;
  });
}

// ── Utility: append row ──
function appendRow(sheetName, values) {
  getSheet(sheetName).appendRow(values);
}

// ── Utility: find and update row ──
function updateRow(sheetName, matchCol, matchVal, updates) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][matchCol - 1]) === String(matchVal)) {
      Object.entries(updates).forEach(([colIdx, val]) => {
        sheet.getRange(i + 1, parseInt(colIdx)).setValue(val);
      });
      return true;
    }
  }
  return false;
}

// ── Utility: CORS-safe JSON response ──
function jsonRes(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════
   ENTRY POINTS
   ═══════════════════════════════════════════════ */

function doGet(e)  { return jsonRes({ status:'BSC CRM API online', version:'1.0' }); }

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    delete body.action;
    const result = dispatch(action, body);
    return jsonRes(result);
  } catch(err) {
    return jsonRes({ error: err.message });
  }
}

function dispatch(action, params) {
  const handlers = {
    verifyUser,
    getCandidates, addCandidate, updateCandidate, checkDuplicate, getNextAppNo,
    getKPIs, getPendingActions,
    getInterviewQuestions, saveScore, getScores,
    getOffers, logCall, updateOfferStatus,
    getOnboarding, tickChecklist,
    getExits, initiateExit, saveExitChecklist
  };
  if (!handlers[action]) throw new Error(`Unknown action: ${action}`);
  return handlers[action](params);
}

/* ═══════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════ */
function verifyUser({ username, password, role }) {
  // In production: hash + compare passwords. Here: plain text for simplicity.
  const users = getRows('Users', COL.Users);
  const user  = users.find(u =>
    String(u.USERNAME).toLowerCase() === String(username).toLowerCase() &&
    String(u.PASSWORD) === String(password) &&
    String(u.ROLE)     === String(role) &&
    String(u.ACTIVE)   === 'TRUE'
  );
  if (!user) return { success: false };
  return { success: true, username, role };
}

/* ═══════════════════════════════════════════════
   CANDIDATES
   ═══════════════════════════════════════════════ */
function getCandidates({ filters = {} }) {
  const rows = getRows('Candidates', COL.Candidates);
  let candidates = rows.map(r => ({
    appNo:     r.APP_NO,
    name:      r.NAME,
    initials:  getInitials(r.NAME),
    color:     getAvatarColor(r.NAME),
    phone:     r.PHONE,
    desig:     r.DESIG,
    source:    r.SOURCE,
    referrer:  r.REFERRER,
    date:      formatDate(r.DATE),
    status:    r.STATUS,
    daysIn:    calcDaysIn(r.DATE),
    salary:    r.SALARY,
    rejReason: r.Q4  // stores rejection reason when rejected
  }));

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    candidates = candidates.filter(c => c.status.toLowerCase() === filters.status.toLowerCase());
  }
  if (filters.desig) {
    candidates = candidates.filter(c => c.desig === filters.desig);
  }
  if (filters.source) {
    candidates = candidates.filter(c => c.source === filters.source);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    candidates = candidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.appNo.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }

  const total = candidates.length;
  const page  = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const paged = candidates.slice((page-1)*limit, page*limit);

  return { candidates: paged, total, page, limit };
}

function addCandidate({ data }) {
  const appNo = generateAppNo();
  const now   = new Date().toISOString();
  appendRow('Candidates', [
    appNo,        data.name,     data.phone,    data.dob,
    data.desig,   data.source,   data.referrer, 'New',
    new Date(),   data.salary,   data.resume,   data.q1,
    data.q2,      data.q3,       data.q4,       0,
    now,          now
  ]);
  return { success: true, appNo };
}

function updateCandidate({ appNo, updates }) {
  const colMap = {
    status:    COL.Candidates.STATUS,
    desig:     COL.Candidates.DESIG,
    updatedAt: COL.Candidates.UPDATED_AT
  };
  const toUpdate = {};
  Object.entries(updates).forEach(([k, v]) => {
    if (colMap[k]) toUpdate[colMap[k]] = v;
  });
  toUpdate[COL.Candidates.UPDATED_AT] = new Date().toISOString();
  const updated = updateRow('Candidates', COL.Candidates.APP_NO, appNo, toUpdate);
  return { success: updated };
}

function checkDuplicate({ phone }) {
  const rows = getRows('Candidates', COL.Candidates);
  const p    = String(phone).replace(/\D/g, '');
  const match = rows.find(r => String(r.PHONE).replace(/\D/g,'') === p);
  if (!match) return { exists: false };
  return { exists: true, name: match.NAME, appNo: match.APP_NO, appliedOn: formatDate(match.DATE) };
}

function getNextAppNo() {
  return { appNo: generateAppNo() };
}

function generateAppNo() {
  const sheet  = getSheet('Candidates');
  const count  = Math.max(sheet.getLastRow() - 1, 0);
  const seq    = String(count + 1).padStart(4, '0');
  const year   = new Date().getFullYear();
  return `BSC-${year}-${seq}`;
}

/* ═══════════════════════════════════════════════
   DASHBOARD KPIs
   ═══════════════════════════════════════════════ */
function getKPIs({ dateRange }) {
  const rows = getRows('Candidates', COL.Candidates);
  const total        = rows.length;
  const shortlisted  = rows.filter(r => r.STATUS === 'Shortlisted').length;
  const selected     = rows.filter(r => ['Selected','Offer Sent','Onboarding'].includes(r.STATUS)).length;
  const joined       = rows.filter(r => r.STATUS === 'Onboarding').length;
  const offerRows    = getRows('Selection_Offer', COL.Selection_Offer);
  const accepted     = offerRows.filter(r => r.STATUS === 'Accepted').length;
  const totalOffers  = offerRows.length;
  const acceptRate   = totalOffers ? Math.round(accepted / totalOffers * 100) : 0;

  return {
    total, shortlisted, selected, joined,
    acceptanceRate: acceptRate,
    avgDays: 18,           // TODO: calculate from date fields
    onboarding: joined,
    interviewsToday: 3     // TODO: query Interview_Schedule for today
  };
}

function getPendingActions() {
  // Collect urgent items across sheets
  const items = [];
  const cands = getRows('Candidates', COL.Candidates);

  // Candidates on Hold > 7 days
  cands.filter(r => r.STATUS === 'Hold' && calcDaysIn(r.DATE) > 7).forEach(r => {
    items.push({ text: `${r.NAME} — on hold for ${calcDaysIn(r.DATE)} days`, priority:'warn' });
  });

  // New unreviewed candidates
  const newCount = cands.filter(r => r.STATUS === 'New').length;
  if (newCount > 0) items.push({ text: `${newCount} new candidates awaiting review`, priority:'info' });

  // Pending offers > SLA
  const offers = getRows('Selection_Offer', COL.Selection_Offer);
  offers.filter(r => r.STATUS === 'Pending Accept').forEach(r => {
    items.push({ text: `${r.NAME} — offer pending for over 3 days`, priority:'urgent' });
  });

  return { items: items.slice(0, 8) };
}

/* ═══════════════════════════════════════════════
   INTERVIEW
   ═══════════════════════════════════════════════ */
function getInterviewQuestions({ desig }) {
  const rows = getRows('Interview_Questions', COL.Interview_Questions);
  const qs   = rows.filter(r => !r.DESIG || r.DESIG === desig || r.DESIG === 'All');
  return {
    questions: qs.map(r => ({
      id:      r.Q_ID,
      text:    r.QUESTION,
      type:    r.TYPE,
      max:     parseInt(r.MAX_SCORE) || 10,
      options: r.OPTIONS ? r.OPTIONS.split(',').map(o => o.trim()) : []
    }))
  };
}

function saveScore({ appNo, round, scores }) {
  // Store in HR_Status sheet (one row per round per candidate)
  const now = new Date().toISOString();
  const roundCol = { HR: 2, FM: 3, MGR: 4 }[round] || 2;
  const scoreStr = JSON.stringify(scores);

  // Try update first, then append
  const updated = updateRow('HR_Status', 1, appNo, { [roundCol]: scoreStr, 5: now });
  if (!updated) {
    appendRow('HR_Status', [appNo, round === 'HR' ? scoreStr : '', round === 'FM' ? scoreStr : '', round === 'MGR' ? scoreStr : '', now]);
  }
  return { success: true };
}

function getScores({ appNo }) {
  const rows = getRows('HR_Status', { APP_NO:1, HR:2, FM:3, MGR:4 });
  const row  = rows.find(r => r.APP_NO === appNo);
  if (!row) return { rounds: { HR: null, FM: null, MGR: null } };
  return {
    rounds: {
      HR:  row.HR  ? JSON.parse(row.HR)  : null,
      FM:  row.FM  ? JSON.parse(row.FM)  : null,
      MGR: row.MGR ? JSON.parse(row.MGR) : null
    }
  };
}

/* ═══════════════════════════════════════════════
   OFFER PROCESS
   ═══════════════════════════════════════════════ */
function getOffers({ filters = {} }) {
  const rows = getRows('Selection_Offer', COL.Selection_Offer);
  return {
    offers: rows.map(r => ({
      appNo:     r.APP_NO,
      name:      r.NAME,
      initials:  getInitials(r.NAME),
      color:     getAvatarColor(r.NAME),
      desig:     r.DESIG,
      noticePd:  r.NOTICE_PD,
      doj:       formatDate(r.EST_DOJ),
      call1:     formatDate(r.CALL1_DATE),
      call2:     formatDate(r.CALL2_DATE),
      confirm:   formatDate(r.CONFIRM_DATE),
      status:    r.STATUS
    })),
    total: rows.length
  };
}

function logCall({ appNo, callNo, notes }) {
  const colMap = { 1: COL.Selection_Offer.CALL1_DATE, 2: COL.Selection_Offer.CALL2_DATE, 3: COL.Selection_Offer.CONFIRM_DATE };
  const col = colMap[callNo];
  if (!col) throw new Error('Invalid call number');
  updateRow('Selection_Offer', COL.Selection_Offer.APP_NO, appNo, {
    [col]: new Date(),
    [COL.Selection_Offer.UPDATED_AT]: new Date().toISOString()
  });
  return { success: true };
}

function updateOfferStatus({ appNo, status }) {
  updateRow('Selection_Offer', COL.Selection_Offer.APP_NO, appNo, {
    [COL.Selection_Offer.STATUS]: status,
    [COL.Selection_Offer.UPDATED_AT]: new Date().toISOString()
  });
  return { success: true };
}

/* ═══════════════════════════════════════════════
   ONBOARDING
   ═══════════════════════════════════════════════ */
function getOnboarding() {
  const rows = getRows('Onboarding_Checklist', COL.Onboarding_Checklist);
  // Group by APP_NO
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.APP_NO]) {
      grouped[r.APP_NO] = { appNo: r.APP_NO, name: r.NAME, desig: r.DESIG, doj: formatDate(r.DOJ), items: [] };
    }
    grouped[r.APP_NO].items.push({ item: r.ITEM, done: r.DONE === 'TRUE', doneBy: r.DONE_BY, doneAt: r.DONE_AT, due: formatDate(r.DUE), responsible: r.RESPONSIBLE });
  });
  return {
    candidates: Object.values(grouped).map(c => ({
      ...c,
      progress: c.items.filter(i => i.done).length,
      total:    c.items.length,
      dojDays:  calcDaysUntil(c.doj)
    }))
  };
}

function tickChecklist({ appNo, item, done }) {
  const sheet = getSheet('Onboarding_Checklist');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.Onboarding_Checklist.APP_NO-1] === appNo &&
        data[i][COL.Onboarding_Checklist.ITEM-1]   === item) {
      sheet.getRange(i+1, COL.Onboarding_Checklist.DONE).setValue(done ? 'TRUE' : 'FALSE');
      if (done) {
        sheet.getRange(i+1, COL.Onboarding_Checklist.DONE_BY).setValue(Session.getActiveUser().getEmail() || 'HR');
        sheet.getRange(i+1, COL.Onboarding_Checklist.DONE_AT).setValue(new Date().toISOString());
      }
      return { success: true };
    }
  }
  return { success: false, error: 'Item not found' };
}

/* ═══════════════════════════════════════════════
   EXIT
   ═══════════════════════════════════════════════ */
function getExits() {
  const rows = getRows('Exit_Checklist', COL.Exit_Checklist);
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.EMP_ID]) {
      grouped[r.EMP_ID] = {
        appNo: r.EMP_ID, name: r.NAME, desig: r.DESIG,
        initials: getInitials(r.NAME), color: getAvatarColor(r.NAME),
        exitDate: formatDate(r.EXIT_DATE), reason: r.REASON,
        ffStatus: r.FF_STATUS,
        softwareInactive: r.SOFTWARE_INACTIVE === 'TRUE',
        rehire: r.REHIRE === 'TRUE',
        items: []
      };
    }
    grouped[r.EMP_ID].items.push({ item: r.ITEM, done: r.DONE === 'TRUE', doneBy: r.DONE_BY, doneAt: r.DONE_AT });
  });
  return {
    exits: Object.values(grouped).map(e => ({
      ...e,
      overdue: calcOverdueExitDays(e.exitDate)
    }))
  };
}

function initiateExit({ empId, data }) {
  const now = new Date().toISOString();
  const items = ['Resignation accepted','Knowledge transfer','Assets returned','ID & access revoked','Software deactivated','FF settlement','Exit interview','Final payslip'];
  items.forEach(item => {
    appendRow('Exit_Checklist', [empId, data.name, data.desig, data.exitDate, data.reason, 'Pending', 'FALSE', '', item, 'FALSE', '', '']);
  });
  return { success: true };
}

function saveExitChecklist({ empId, item, done }) {
  const sheet = getSheet('Exit_Checklist');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === empId && data[i][COL.Exit_Checklist.ITEM-1] === item) {
      sheet.getRange(i+1, COL.Exit_Checklist.DONE).setValue(done ? 'TRUE' : 'FALSE');
      if (done) {
        sheet.getRange(i+1, COL.Exit_Checklist.DONE_BY).setValue('HR');
        sheet.getRange(i+1, COL.Exit_Checklist.DONE_AT).setValue(new Date().toISOString());
      }
      return { success: true };
    }
  }
  return { success: false };
}

/* ═══════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════ */
function getInitials(name) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

const AV_COLORS = ['navy','gold','green','red','purple','teal'];
function getAvatarColor(name) {
  const code = ((name || '').charCodeAt(0) || 0) + ((name || '').charCodeAt(1) || 0);
  return AV_COLORS[code % AV_COLORS.length];
}

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return String(val); }
}

function calcDaysIn(dateVal) {
  try {
    const d = new Date(dateVal);
    const diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  } catch { return 0; }
}

function calcDaysUntil(dateStr) {
  try {
    const d = new Date(dateStr);
    const diff = d.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  } catch { return 0; }
}

function calcOverdueExitDays(exitDateStr) {
  const SLA = 5; // days to complete exit checklist
  return Math.max(0, calcDaysIn(exitDateStr) - SLA);
}

/* ═══════════════════════════════════════════════
   SHEET SETUP — run once to create structure
   (Run setupSheets() manually from Apps Script editor)
   ═══════════════════════════════════════════════ */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const sheetDefs = {
    Candidates: ['App No','Name','Phone','DOB','Designation','Source','Referrer','Status','Date Applied','Expected Salary','Resume Submitted','Q1','Q2','Q3','Q4','Days In','Created At','Updated At'],
    HR_Status:  ['App No','HR Score JSON','FM Score JSON','MGR Score JSON','Updated At'],
    Interview_Schedule: ['App No','Candidate Name','Designation','Round','Interviewer','Scheduled Date','Scheduled Time','Status','Created At'],
    Interview_Questions: ['Designation','Question ID','Question','Type','Max Score','Options (comma separated)'],
    Selection_Offer: ['App No','Candidate Name','Designation','Notice Period','Est DOJ','Call 1 Date','Call 2 Date','Confirm Call Date','Offer Letter Link','Status','Created At','Updated At'],
    Onboarding_Checklist: ['App No','Name','Designation','DOJ','Item','Done','Done By','Done At','Due Date','Responsible'],
    Exit_Checklist: ['Emp ID','Name','Designation','Exit Date','Reason','FF Status','Software Inactive','Rehire Eligible','Item','Done','Done By','Done At'],
    Roles_Config: ['Role','Designation','Active'],
    Users: ['Username','Password','Role','Active','Created At']
  };

  Object.entries(sheetDefs).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E2D4E').setFontColor('#fff');
    }
  });

  // Seed default admin user (change password immediately!)
  const usersSheet = ss.getSheetByName('Users');
  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow(['hr@bsctextiles.com',    'bsc@2026', 'HR',            'TRUE', new Date()]);
    usersSheet.appendRow(['fm@bsctextiles.com',     'bsc@2026', 'Floor Manager', 'TRUE', new Date()]);
    usersSheet.appendRow(['manager@bsctextiles.com','bsc@2026', 'Manager',       'TRUE', new Date()]);
    usersSheet.appendRow(['admin@bsctextiles.com',  'bsc@2026', 'Admin',         'TRUE', new Date()]);
  }

  // Seed interview questions (Sales Executive example)
  const qSheet = ss.getSheetByName('Interview_Questions');
  if (qSheet.getLastRow() === 1) {
    const qs = [
      ['Sales Executive','1','Communication skills','score',10,''],
      ['Sales Executive','2','Relevant experience','score',15,''],
      ['Sales Executive','3','Confidence & presentation','score',10,''],
      ['Sales Executive','4','Textile retail knowledge','score',15,''],
      ['Sales Executive','5','Customer handling ability','score',10,''],
      ['Floor Manager','1','Leadership skills','score',15,''],
      ['Floor Manager','2','Team management','score',15,''],
      ['Floor Manager','3','Retail floor experience','score',10,''],
      ['Floor Manager','4','Problem solving','score',10,''],
      ['Floor Manager','5','Communication','score',10,''],
      ['All','1','Can join immediately?','select',0,'Yes,After 1 week,After 15 days,After 1 month'],
    ];
    qs.forEach(q => qSheet.appendRow(q));
  }

  // Seed Roles Config
  const rcSheet = ss.getSheetByName('Roles_Config');
  if (rcSheet.getLastRow() === 1) {
    ['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper'].forEach(d => {
      rcSheet.appendRow(['All', d, 'TRUE']);
    });
  }

  Logger.log('Setup complete!');
  SpreadsheetApp.getUi().alert('✅ BSC CRM sheet structure created successfully!\n\nNext step: copy your Sheet ID into code.gs SHEET_ID variable.');
}
