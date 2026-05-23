/**
 * BSC Candidate CRM — Google Apps Script Backend
 * Deploy: Execute as ME · Anyone (even anonymous)
 */

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // ← paste your Sheet ID here

const COL = {
  Candidates: {
    APP_NO:1, NAME:2, PHONE:3, DOB:4, DESIG:5, SOURCE:6, REFERRER:7,
    STATUS:8, DATE:9, SALARY:10, RESUME:11, Q1:12, Q2:13, Q3:14, Q4:15,
    DAYS_IN:16, CREATED_AT:17, UPDATED_AT:18
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
  Roles_Config: { ROLE:1, DESIG:2, ACTIVE:3 },
  Users: { USERNAME:1, PASSWORD:2, ROLE:3, ACTIVE:4, CREATED_AT:5 }
};

/* ── Utilities ───────────────────────────────────────────── */
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" not found');
  return sh;
}

function getRows(sheetName, colMap) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    Object.entries(colMap).forEach(([key, idx]) => { obj[key] = row[idx - 1] ?? ''; });
    return obj;
  });
}

function appendRow(sheetName, values) {
  getSheet(sheetName).appendRow(values);
}

function updateRow(sheetName, matchCol, matchVal, updates) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][matchCol - 1]) === String(matchVal)) {
      Object.entries(updates).forEach(([col, val]) => sh.getRange(i + 1, +col).setValue(val));
      return true;
    }
  }
  return false;
}

function jsonRes(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getInitials(name) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

const AV_COLORS = ['navy','gold','green','red','purple','teal'];
function getAvatarColor(name) {
  const c = ((name||'').charCodeAt(0)||0) + ((name||'').charCodeAt(1)||0);
  return AV_COLORS[c % AV_COLORS.length];
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
    if (isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  } catch { return 0; }
}

function calcDaysUntil(dateVal) {
  try {
    const d = new Date(dateVal);
    if (isNaN(d)) return 0;
    return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
  } catch { return 0; }
}

/* ── Entry Points ────────────────────────────────────────── */
function doGet()  { return jsonRes({ status:'BSC CRM API online', version:'1.0' }); }

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    delete body.action;
    return jsonRes(dispatch(action, body));
  } catch(err) {
    return jsonRes({ error: err.message });
  }
}

function dispatch(action, params) {
  const handlers = {
    verifyUser, getCandidates, addCandidate, updateCandidate,
    checkDuplicate, getNextAppNo, getKPIs, getPendingActions,
    getSourceBreakdown, getDesignations,
    getInterviewQuestions, saveScore, getScores,
    getOffers, logCall, updateOfferStatus,
    getOnboarding, tickChecklist,
    getExits, initiateExit, saveExitChecklist
  };
  if (!handlers[action]) throw new Error('Unknown action: ' + action);
  return handlers[action](params);
}

/* ── Auth ────────────────────────────────────────────────── */
function verifyUser({ username, password }) {
  try {
    const users = getRows('Users', COL.Users);
    const user  = users.find(u =>
      String(u.USERNAME).toLowerCase() === String(username).toLowerCase() &&
      String(u.PASSWORD) === String(password) &&
      String(u.ACTIVE).toUpperCase() === 'TRUE'
    );
    if (!user) return { success: false };
    const roleMap = {
      'HR':           'HR Admin',
      'Floor Manager':'Floor Manager',
      'Manager':      'Store Manager',
      'Admin':        'Admin'
    };
    return { success: true, role: user.ROLE, displayName: roleMap[user.ROLE] || user.ROLE };
  } catch(e) {
    // Demo fallback — remove after Users sheet is set up
    const demo = [
      { u:'hr@bsctextiles.com',       p:'bsc@2026', role:'HR',           name:'HR Admin' },
      { u:'fm@bsctextiles.com',        p:'bsc@2026', role:'Floor Manager', name:'Floor Manager' },
      { u:'manager@bsctextiles.com',   p:'bsc@2026', role:'Manager',      name:'Store Manager' },
      { u:'admin@bsctextiles.com',     p:'bsc@2026', role:'Admin',         name:'Admin' }
    ];
    const m = demo.find(d => d.u.toLowerCase() === username.toLowerCase() && d.p === password);
    return m ? { success:true, role:m.role, displayName:m.name } : { success:false };
  }
}

/* ── Candidates ──────────────────────────────────────────── */
function getCandidates({ filters = {} } = {}) {
  let rows = [];
  try { rows = getRows('Candidates', COL.Candidates); } catch(e) { return { candidates:[], total:0 }; }

  let list = rows.map(r => ({
    appNo:     String(r.APP_NO  || ''),
    name:      String(r.NAME    || ''),
    initials:  getInitials(String(r.NAME || '')),
    color:     getAvatarColor(String(r.NAME || '')),
    phone:     String(r.PHONE   || ''),
    desig:     String(r.DESIG   || ''),
    source:    String(r.SOURCE  || ''),
    referrer:  String(r.REFERRER|| ''),
    date:      formatDate(r.DATE),
    status:    String(r.STATUS  || 'New'),
    daysIn:    calcDaysIn(r.DATE),
    salary:    String(r.SALARY  || ''),
    rejReason: String(r.Q4      || '')
  }));

  if (filters.status && filters.status !== 'all')
    list = list.filter(c => c.status.toLowerCase() === filters.status.toLowerCase());
  if (filters.desig)  list = list.filter(c => c.desig  === filters.desig);
  if (filters.source) list = list.filter(c => c.source === filters.source);
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q)  ||
      c.appNo.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }

  const total = list.length;
  const page  = parseInt(filters.page)  || 1;
  const limit = parseInt(filters.limit) || 50;
  return { candidates: list.slice((page-1)*limit, page*limit), total, page };
}

function addCandidate({ data } = {}) {
  const appNo = generateAppNo();
  const now   = new Date().toISOString();
  appendRow('Candidates', [
    appNo, data.name, data.phone, data.dob, data.desig,
    data.source, data.referrer, 'New', new Date(),
    data.salary, data.resume, data.q1, data.q2, data.q3, data.q4,
    0, now, now
  ]);
  return { success: true, appNo };
}

function updateCandidate({ appNo, updates } = {}) {
  const colMap = {
    status: COL.Candidates.STATUS,
    desig:  COL.Candidates.DESIG,
    q4:     COL.Candidates.Q4
  };
  const toUpdate = {};
  Object.entries(updates).forEach(([k, v]) => { if (colMap[k]) toUpdate[colMap[k]] = v; });
  toUpdate[COL.Candidates.UPDATED_AT] = new Date().toISOString();
  return { success: updateRow('Candidates', COL.Candidates.APP_NO, appNo, toUpdate) };
}

function checkDuplicate({ phone } = {}) {
  try {
    const rows = getRows('Candidates', COL.Candidates);
    const p    = String(phone || '').replace(/\D/g, '');
    const m    = rows.find(r => String(r.PHONE || '').replace(/\D/g,'') === p);
    if (!m) return { exists: false };
    return { exists: true, name: m.NAME, appNo: m.APP_NO, appliedOn: formatDate(m.DATE) };
  } catch { return { exists: false }; }
}

function getNextAppNo() { return { appNo: generateAppNo() }; }

function generateAppNo() {
  try {
    const sh    = getSheet('Candidates');
    const count = Math.max(sh.getLastRow() - 1, 0);
    return 'BSC-' + new Date().getFullYear() + '-' + String(count + 1).padStart(4, '0');
  } catch { return 'BSC-' + new Date().getFullYear() + '-0001'; }
}

/* ── Dashboard KPIs ──────────────────────────────────────── */
function getKPIs() {
  let total = 0, shortlisted = 0, selected = 0, joined = 0;
  let newCandidates = 0, avgDays = 0;

  try {
    const rows    = getRows('Candidates', COL.Candidates);
    total         = rows.length;
    shortlisted   = rows.filter(r => r.STATUS === 'Shortlisted').length;
    selected      = rows.filter(r => ['Selected','Offer Sent','Onboarding'].includes(r.STATUS)).length;
    joined        = rows.filter(r => r.STATUS === 'Onboarding').length;
    newCandidates = rows.filter(r => r.STATUS === 'New').length;

    // Avg days to hire — from candidates who reached Onboarding
    const hiredRows = rows.filter(r => r.STATUS === 'Onboarding' && r.DATE);
    if (hiredRows.length > 0) {
      const totalDays = hiredRows.reduce((sum, r) => sum + calcDaysIn(r.DATE), 0);
      avgDays = Math.round(totalDays / hiredRows.length);
    }
  } catch(e) { Logger.log('Candidates KPI error: ' + e.message); }

  let acceptanceRate = 0, pendingOffers = 0;
  try {
    const offerRows = getRows('Selection_Offer', COL.Selection_Offer);
    const accepted  = offerRows.filter(r => r.STATUS === 'Accepted').length;
    const total2    = offerRows.length;
    acceptanceRate  = total2 ? Math.round(accepted / total2 * 100) : 0;
    pendingOffers   = offerRows.filter(r => r.STATUS === 'Pending Accept').length;
  } catch(e) { Logger.log('Offer KPI error: ' + e.message); }

  // Interviews today — from Interview_Schedule sheet
  let interviewsToday = 0;
  try {
    const schedRows = getRows('Interview_Schedule', COL.Interview_Schedule);
    const todayStr  = new Date().toDateString();
    interviewsToday = schedRows.filter(r =>
      r.SCHED_DATE && new Date(r.SCHED_DATE).toDateString() === todayStr
    ).length;
  } catch(e) { Logger.log('Schedule KPI error: ' + e.message); }

  return {
    total, shortlisted, selected, joined,
    acceptanceRate, avgDays,
    onboarding:      joined,
    interviewsToday,
    newCandidates,
    pendingOffers
  };
}

function getPendingActions() {
  const items = [];
  try {
    const rows = getRows('Candidates', COL.Candidates);
    const newCount = rows.filter(r => r.STATUS === 'New').length;
    if (newCount > 0)
      items.push({ text: newCount + ' new candidate' + (newCount>1?'s':'') + ' awaiting review', priority:'info' });

    rows.filter(r => r.STATUS === 'Hold' && calcDaysIn(r.DATE) > 7).slice(0,3).forEach(r =>
      items.push({ text: String(r.NAME) + ' — on hold for ' + calcDaysIn(r.DATE) + ' days', priority:'warn' })
    );
  } catch(e) {}

  try {
    const offerRows = getRows('Selection_Offer', COL.Selection_Offer);
    offerRows.filter(r => r.STATUS === 'Pending Accept').slice(0,3).forEach(r =>
      items.push({ text: String(r.NAME) + ' — offer pending confirmation', priority:'urgent' })
    );
  } catch(e) {}

  return { items: items.slice(0, 8) };
}

function getSourceBreakdown() {
  try {
    const rows = getRows('Candidates', COL.Candidates);
    return {
      walkin: rows.filter(r => r.SOURCE === 'Walk-in').length,
      empref: rows.filter(r => r.SOURCE === 'Employee Ref').length,
      online: rows.filter(r => r.SOURCE === 'Online Apply').length,
      other:  rows.filter(r => !['Walk-in','Employee Ref','Online Apply'].includes(r.SOURCE) && r.SOURCE).length
    };
  } catch { return { walkin:0, empref:0, online:0, other:0 }; }
}

function getDesignations() {
  try {
    const rows = getRows('Roles_Config', COL.Roles_Config);
    return {
      designations: rows
        .filter(r => String(r.ACTIVE).toUpperCase() === 'TRUE')
        .map(r => String(r.DESIG || '').trim())
        .filter(Boolean)
    };
  } catch { return { designations:['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper'] }; }
}

/* ── Interview ───────────────────────────────────────────── */
function getInterviewQuestions({ desig } = {}) {
  try {
    const rows = getRows('Interview_Questions', COL.Interview_Questions);
    const qs   = rows.filter(r => !r.DESIG || r.DESIG === desig || r.DESIG === 'All');
    return {
      questions: qs.map(r => ({
        id:      String(r.Q_ID),
        text:    String(r.QUESTION),
        type:    String(r.TYPE || 'score'),
        max:     parseInt(r.MAX_SCORE) || 10,
        options: r.OPTIONS ? String(r.OPTIONS).split(',').map(o=>o.trim()) : []
      }))
    };
  } catch { return { questions:[] }; }
}

function saveScore({ appNo, round, scores } = {}) {
  try {
    const now     = new Date().toISOString();
    const scoreStr= JSON.stringify(scores);
    const colMap  = { HR:2, FM:3, MGR:4 };
    const col     = colMap[round] || 2;
    const updated = updateRow('HR_Status', 1, appNo, { [col]: scoreStr, 5: now });
    if (!updated) {
      appendRow('HR_Status', [appNo,
        round==='HR'  ? scoreStr : '',
        round==='FM'  ? scoreStr : '',
        round==='MGR' ? scoreStr : '',
        now
      ]);
    }
    return { success: true };
  } catch(e) { return { success:false, error:e.message }; }
}

function getScores({ appNo } = {}) {
  try {
    const rows = getRows('HR_Status', { APP_NO:1, HR:2, FM:3, MGR:4 });
    const row  = rows.find(r => r.APP_NO === appNo);
    if (!row) return { rounds:{ HR:null, FM:null, MGR:null } };
    return {
      rounds: {
        HR:  row.HR  ? JSON.parse(row.HR)  : null,
        FM:  row.FM  ? JSON.parse(row.FM)  : null,
        MGR: row.MGR ? JSON.parse(row.MGR) : null
      }
    };
  } catch { return { rounds:{ HR:null, FM:null, MGR:null } }; }
}

/* ── Offer Process ───────────────────────────────────────── */
function getOffers({ filters = {} } = {}) {
  try {
    const rows = getRows('Selection_Offer', COL.Selection_Offer);
    return {
      offers: rows.map(r => ({
        appNo:    String(r.APP_NO  || ''),
        name:     String(r.NAME    || ''),
        initials: getInitials(String(r.NAME || '')),
        color:    getAvatarColor(String(r.NAME || '')),
        desig:    String(r.DESIG   || ''),
        noticePd: String(r.NOTICE_PD || '—'),
        doj:      formatDate(r.EST_DOJ),
        call1:    formatDate(r.CALL1_DATE),
        call2:    formatDate(r.CALL2_DATE),
        confirm:  formatDate(r.CONFIRM_DATE),
        status:   String(r.STATUS  || '')
      })),
      total: rows.length
    };
  } catch { return { offers:[], total:0 }; }
}

function logCall({ appNo, callNo, notes } = {}) {
  try {
    const colMap = { 1:COL.Selection_Offer.CALL1_DATE, 2:COL.Selection_Offer.CALL2_DATE, 3:COL.Selection_Offer.CONFIRM_DATE };
    const col    = colMap[callNo];
    if (!col) throw new Error('Invalid call number');
    updateRow('Selection_Offer', COL.Selection_Offer.APP_NO, appNo, {
      [col]: new Date(),
      [COL.Selection_Offer.UPDATED_AT]: new Date().toISOString()
    });
    return { success: true };
  } catch(e) { return { success:false, error:e.message }; }
}

function updateOfferStatus({ appNo, status } = {}) {
  try {
    updateRow('Selection_Offer', COL.Selection_Offer.APP_NO, appNo, {
      [COL.Selection_Offer.STATUS]:     status,
      [COL.Selection_Offer.UPDATED_AT]: new Date().toISOString()
    });
    return { success: true };
  } catch(e) { return { success:false, error:e.message }; }
}

/* ── Onboarding ──────────────────────────────────────────── */
function getOnboarding() {
  try {
    const rows    = getRows('Onboarding_Checklist', COL.Onboarding_Checklist);
    const grouped = {};
    rows.forEach(r => {
      const key = String(r.APP_NO);
      if (!grouped[key]) grouped[key] = { appNo:key, name:String(r.NAME||''), desig:String(r.DESIG||''), doj:formatDate(r.DOJ), items:[] };
      grouped[key].items.push({
        item:       String(r.ITEM    || ''),
        done:       String(r.DONE).toUpperCase() === 'TRUE',
        doneBy:     String(r.DONE_BY || ''),
        doneAt:     String(r.DONE_AT || ''),
        due:        formatDate(r.DUE),
        responsible:String(r.RESPONSIBLE || '')
      });
    });
    return {
      candidates: Object.values(grouped).map(c => ({
        ...c,
        progress: c.items.filter(i=>i.done).length,
        total:    c.items.length,
        dojDays:  calcDaysUntil(c.doj)
      }))
    };
  } catch { return { candidates:[] }; }
}

function tickChecklist({ appNo, item, done } = {}) {
  try {
    const sh   = getSheet('Onboarding_Checklist');
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(appNo) && String(data[i][4]) === String(item)) {
        sh.getRange(i+1, COL.Onboarding_Checklist.DONE).setValue(done ? 'TRUE' : 'FALSE');
        if (done) {
          sh.getRange(i+1, COL.Onboarding_Checklist.DONE_BY).setValue('HR');
          sh.getRange(i+1, COL.Onboarding_Checklist.DONE_AT).setValue(new Date().toISOString());
        }
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) { return { success:false, error:e.message }; }
}

/* ── Employee Exit ───────────────────────────────────────── */
function getExits() {
  try {
    const rows    = getRows('Exit_Checklist', COL.Exit_Checklist);
    const grouped = {};
    rows.forEach(r => {
      const key = String(r.EMP_ID);
      if (!grouped[key]) grouped[key] = {
        appNo:           key,
        name:            String(r.NAME    || ''),
        initials:        getInitials(String(r.NAME || '')),
        color:           getAvatarColor(String(r.NAME || '')),
        desig:           String(r.DESIG   || ''),
        exitDate:        formatDate(r.EXIT_DATE),
        reason:          String(r.REASON  || ''),
        ffStatus:        String(r.FF_STATUS || 'Pending'),
        softwareInactive:String(r.SOFTWARE_INACTIVE).toUpperCase()==='TRUE',
        rehire:          String(r.REHIRE).toUpperCase()==='TRUE',
        items:           []
      };
      grouped[key].items.push({
        item:   String(r.ITEM    || ''),
        done:   String(r.DONE).toUpperCase() === 'TRUE',
        doneBy: String(r.DONE_BY || ''),
        doneAt: String(r.DONE_AT || '')
      });
    });
    return {
      exits: Object.values(grouped).map(e => ({
        ...e,
        overdue: Math.max(0, calcDaysIn(e.exitDate) - 5)
      }))
    };
  } catch { return { exits:[] }; }
}

function initiateExit({ empId, data } = {}) {
  try {
    const items = ['Resignation accepted','Knowledge transfer','Assets returned',
                   'ID & access revoked','Software deactivated','FF settlement',
                   'Exit interview','Final payslip issued'];
    items.forEach(item => appendRow('Exit_Checklist', [
      empId, data.name, data.desig, data.exitDate, data.reason,
      'Pending','FALSE','FALSE', item,'FALSE','',''
    ]));
    return { success: true };
  } catch(e) { return { success:false, error:e.message }; }
}

function saveExitChecklist({ empId, item, done } = {}) {
  try {
    const sh   = getSheet('Exit_Checklist');
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(empId) && String(data[i][8]) === String(item)) {
        sh.getRange(i+1, COL.Exit_Checklist.DONE).setValue(done ? 'TRUE' : 'FALSE');
        if (done) {
          sh.getRange(i+1, COL.Exit_Checklist.DONE_BY).setValue('HR');
          sh.getRange(i+1, COL.Exit_Checklist.DONE_AT).setValue(new Date().toISOString());
        }
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) { return { success:false, error:e.message }; }
}

/* ── One-time Setup ──────────────────────────────────────── */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const defs = {
    Candidates:           ['App No','Name','Phone','DOB','Designation','Source','Referrer','Status','Date Applied','Salary','Resume','Q1','Q2','Q3','Q4','Days In','Created At','Updated At'],
    HR_Status:            ['App No','HR Score JSON','FM Score JSON','MGR Score JSON','Updated At'],
    Interview_Schedule:   ['App No','Candidate','Designation','Round','Interviewer','Scheduled Date','Scheduled Time','Status','Created At'],
    Interview_Questions:  ['Designation','Question ID','Question','Type','Max Score','Options'],
    Selection_Offer:      ['App No','Name','Designation','Notice Period','Est DOJ','Call 1','Call 2','Confirm','Offer Letter','Status','Created At','Updated At'],
    Onboarding_Checklist: ['App No','Name','Designation','DOJ','Item','Done','Done By','Done At','Due Date','Responsible'],
    Exit_Checklist:       ['Emp ID','Name','Designation','Exit Date','Reason','FF Status','Software Inactive','Rehire','Item','Done','Done By','Done At'],
    Roles_Config:         ['Role','Designation','Active'],
    Users:                ['Username','Password','Role','Active','Created At']
  };
  Object.entries(defs).forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#1E2D4E').setFontColor('#fff');
    }
  });
  const us = ss.getSheetByName('Users');
  if (us.getLastRow() <= 1) {
    [['hr@bsctextiles.com','bsc@2026','HR','TRUE'],
     ['fm@bsctextiles.com','bsc@2026','Floor Manager','TRUE'],
     ['manager@bsctextiles.com','bsc@2026','Manager','TRUE'],
     ['admin@bsctextiles.com','bsc@2026','Admin','TRUE']
    ].forEach(r => us.appendRow([...r, new Date()]));
  }
  const rc = ss.getSheetByName('Roles_Config');
  if (rc.getLastRow() <= 1) {
    ['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']
      .forEach(d => rc.appendRow(['All', d, 'TRUE']));
  }
  SpreadsheetApp.getUi().alert('✅ BSC CRM setup complete!');
}
