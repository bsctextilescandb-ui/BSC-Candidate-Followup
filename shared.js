/**
 * BSC Candidate CRM — Shared JS v1.0
 * Auth · API · Navigation · Utilities · Toast · Modal
 */

'use strict';

/* ═══════════════════════════════════════
   AUTH
   ═══════════════════════════════════════ */
const Auth = {
  save(role, username) {
    const session = { role, username, loginAt: Date.now() };
    sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
  },
  get() {
    try { return JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY)); }
    catch { return null; }
  },
  check() { return !!this.get(); },
  logout() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    window.location.href = 'login.html';
  },
  guard() {
    if (!this.check()) { window.location.href = 'login.html'; return null; }
    return this.get();
  },
  populateSidebar(session) {
    const initials = (session.username || 'HR').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    el('sb-av')       && (el('sb-av').textContent       = initials);
    el('sb-username') && (el('sb-username').textContent = session.username);
    el('sb-userrole') && (el('sb-userrole').textContent = session.role);
    this._applyRoleNav(session.role);
  },
  _applyRoleNav(role) {
    const allowed = CONFIG.ROLE_NAV[role] || CONFIG.ROLE_NAV['HR'];
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.style.display = allowed.includes(item.dataset.page) ? '' : 'none';
    });
  }
};

/* ═══════════════════════════════════════
   API WRAPPER
   ═══════════════════════════════════════ */
const API = {
  async call(action, params = {}) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes('https://script.google.com/macros/s/AKfycbwolTclzyP2skiQi4ndcPs4y4z0s0gRglN0fUK3jmBq-w8RAxBUltcw47QqyjGGRF-3/exec')) {
      return this._sampleData(action, params);
    }
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...params })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.warn('API error — falling back to sample data. Reason:', err.message);
      return this._sampleData(action, params);
    }
  },

  async getCandidates(filters = {})            { return this.call('getCandidates', { filters }); },
  async addCandidate(data)                      { return this.call('addCandidate', { data }); },
  async updateCandidate(appNo, updates)         { return this.call('updateCandidate', { appNo, updates }); },
  async checkDuplicate(phone)                   { return this.call('checkDuplicate', { phone }); },
  async getNextAppNo()                          { return this.call('getNextAppNo'); },
  async getKPIs(dateRange)                      { return this.call('getKPIs', { dateRange }); },
  async getPendingActions()                     { return this.call('getPendingActions'); },
  async getInterviewQuestions(desig)            { return this.call('getInterviewQuestions', { desig }); },
  async saveScore(appNo, round, scores)         { return this.call('saveScore', { appNo, round, scores }); },
  async getScores(appNo)                        { return this.call('getScores', { appNo }); },
  async getOffers(filters = {})                 { return this.call('getOffers', { filters }); },
  async logCall(appNo, callNo, notes)           { return this.call('logCall', { appNo, callNo, notes }); },
  async updateOfferStatus(appNo, status)        { return this.call('updateOfferStatus', { appNo, status }); },
  async getOnboarding()                         { return this.call('getOnboarding'); },
  async tickChecklist(appNo, item, done)        { return this.call('tickChecklist', { appNo, item, done }); },
  async getExits()                              { return this.call('getExits'); },
  async initiateExit(empId, data)               { return this.call('initiateExit', { empId, data }); },
  async saveExitChecklist(empId, item, done)    { return this.call('saveExitChecklist', { empId, item, done }); },
  async verifyUser(username, password, role)    { return this.call('verifyUser', { username, password, role }); },

  _sampleData(action, params) {
    const samples = {
      getKPIs: { total:248, shortlisted:188, selected:84, joined:36, acceptanceRate:78, avgDays:18, onboarding:7, interviewsToday:3 },
      getPendingActions: { items:[
        { text:'Priya Nair — interview score pending', priority:'urgent' },
        { text:'Arjun Mehta — offer not confirmed (3d)', priority:'urgent' },
        { text:'Kavya Reddy — DOJ in 5 days, 3 items pending', priority:'warn' },
        { text:'Ravi Kumar — exit checklist incomplete', priority:'warn' },
        { text:'2 new walk-in candidates to shortlist', priority:'info' }
      ]},
      getCandidates: { candidates: SAMPLE_CANDIDATES, total: 248 },
      checkDuplicate: { exists: params.phone === '9876543210', name:'Rahul Sharma', appNo:'BSC-2026-0180', appliedOn:'15 Mar 2026' },
      getNextAppNo: { appNo:'BSC-2026-0249' },
      addCandidate: { success:true, appNo:'BSC-2026-0249' },
      updateCandidate: { success:true },
      getInterviewQuestions: { questions: SAMPLE_QUESTIONS },
      saveScore: { success:true },
      getScores: { rounds:{ HR:null, FM:null, MGR:null } },
      getOffers: { offers: SAMPLE_OFFERS, total:72 },
      logCall: { success:true },
      updateOfferStatus: { success:true },
      getOnboarding: { candidates: SAMPLE_ONBOARDING },
      tickChecklist: { success:true },
      getExits: { exits: SAMPLE_EXITS },
      initiateExit: { success:true },
      saveExitChecklist: { success:true },
      verifyUser: { success:true, username: params.username, role: params.role }
    };
    return Promise.resolve(samples[action] || { success:true });
  }
};

/* ═══════════════════════════════════════
   SAMPLE DATA
   ═══════════════════════════════════════ */
const SAMPLE_CANDIDATES = [
  { appNo:'BSC-2026-0248', name:'Rahul Sharma',  initials:'RS', color:'navy',   phone:'9876543210', desig:'Sales Executive',   source:'Walk-in',      date:'21 May 2026', status:'New',        daysIn:1,  referrer:'' },
  { appNo:'BSC-2026-0247', name:'Priya Nair',    initials:'PN', color:'gold',   phone:'9123456789', desig:'Floor Manager',     source:'Employee Ref', date:'20 May 2026', status:'Shortlisted', daysIn:2,  referrer:'Suresh K.' },
  { appNo:'BSC-2026-0246', name:'Arjun Mehta',   initials:'AM', color:'green',  phone:'8765432109', desig:'Cashier',           source:'Walk-in',      date:'20 May 2026', status:'Selected',   daysIn:2,  referrer:'' },
  { appNo:'BSC-2026-0245', name:'Fatima Ansari', initials:'FA', color:'red',    phone:'7654321098', desig:'Billing Executive', source:'Online Apply', date:'14 May 2026', status:'Hold',       daysIn:8,  referrer:'' },
  { appNo:'BSC-2026-0244', name:'Deepak Tiwari', initials:'DT', color:'purple', phone:'6543210987', desig:'Sales Executive',   source:'Walk-in',      date:'10 May 2026', status:'Rejected',   daysIn:12, referrer:'', rejReason:'Low experience' },
  { appNo:'BSC-2026-0243', name:'Sneha Patil',   initials:'SP', color:'green',  phone:'5432109876', desig:'Sales Executive',   source:'Employee Ref', date:'18 May 2026', status:'Onboarding', daysIn:3,  referrer:'Meena R.' }
];
const SAMPLE_QUESTIONS = [
  { id:1, text:'Years of retail sales experience?', type:'select', options:['0–1 years','1–3 years','3–5 years','5+ years'], max:10 },
  { id:2, text:'Worked in textile/garment store before?', type:'select', options:['Yes','No'], max:15 },
  { id:3, text:'Confidence & presentation', type:'score', max:10 },
  { id:4, text:'Textile retail knowledge', type:'score', max:15 },
  { id:5, text:'Team management ability', type:'score', max:10 }
];
const SAMPLE_OFFERS = [
  { appNo:'BSC-2026-0246', name:'Arjun Mehta',   initials:'AM', color:'green', desig:'Cashier',         noticePd:'Immediate', doj:'26 May 2026', call1:'20 May', call2:'21 May', confirm:'Due Today', status:'Pending Accept', urgent:false },
  { appNo:'BSC-2026-0240', name:'Kavya Reddy',   initials:'KR', color:'gold',  desig:'Sales Executive', noticePd:'1 week',    doj:'01 Jun 2026', call1:'18 May', call2:'19 May', confirm:'20 May',    status:'Accepted',       urgent:false },
  { appNo:'BSC-2026-0238', name:'Mohit Gupta',   initials:'MG', color:'navy',  desig:'Store Keeper',    noticePd:'15 days',   doj:'TBD',         call1:'17 May', call2:'Due Today', confirm:'Locked', status:'Pending 4d',  urgent:true },
  { appNo:'BSC-2026-0235', name:'Neha Kulkarni', initials:'NK', color:'red',   desig:'Billing Exec',    noticePd:'Immediate', doj:'—',           call1:'15 May', call2:'16 May', confirm:'17 May',    status:'Declined',       urgent:false }
];
const SAMPLE_ONBOARDING = [
  { appNo:'BSC-2026-0246', name:'Arjun Mehta', desig:'Cashier',         doj:'26 May 2026', progress:5, total:8, dojDays:5 },
  { appNo:'BSC-2026-0240', name:'Kavya Reddy', desig:'Sales Executive', doj:'01 Jun 2026', progress:8, total:8, dojDays:11 },
  { appNo:'BSC-2026-0243', name:'Sneha Patil', desig:'Sales Executive', doj:'28 May 2026', progress:3, total:8, dojDays:7 },
  { appNo:'BSC-2026-0239', name:'Rithika S.',  desig:'Billing Exec',    doj:'30 May 2026', progress:1, total:8, dojDays:9 }
];
const SAMPLE_EXITS = [
  { appNo:'BSC-2026-0180', name:'Ravi Kumar',   initials:'RK', color:'navy',   desig:'Sales Executive', exitDate:'15 May 2026', reason:'Better opportunity', ffStatus:'Settled', softwareInactive:true,  rehire:true,  overdue:0 },
  { appNo:'BSC-2026-0195', name:'Aisha Begum',  initials:'AB', color:'gold',   desig:'Cashier',         exitDate:'20 May 2026', reason:'Personal reasons',   ffStatus:'Pending', softwareInactive:false, rehire:false, overdue:1 },
  { appNo:'BSC-2026-0201', name:'Deepak Joshi', initials:'DJ', color:'red',    desig:'Floor Manager',   exitDate:'18 May 2026', reason:'Career growth',      ffStatus:'Settled', softwareInactive:true,  rehire:false, overdue:0 },
  { appNo:'BSC-2026-0188', name:'Meena Pillai', initials:'MP', color:'purple', desig:'Sales Executive', exitDate:'12 May 2026', reason:'Salary low',         ffStatus:'Settled', softwareInactive:true,  rehire:true,  overdue:0 }
];

/* ═══════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════ */
function el(id) { return document.getElementById(id); }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function todayDisplay() {
  return new Date().toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

function debounce(fn, ms = 400) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function maskPhone(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  return p.slice(0, 5) + ' XXXXX';
}

const AV_COLORS = ['navy','gold','green','red','purple','teal'];
function avColor(name) {
  const i = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AV_COLORS.length;
  return AV_COLORS[i];
}

const STATUS_BADGE = {
  'New':'b-new', 'Shortlisted':'b-short', 'Interviewed':'b-int',
  'Selected':'b-sel', 'Offer Sent':'b-offer', 'Hold':'b-hold',
  'Rejected':'b-rej', 'Onboarding':'b-board'
};
function statusBadge(status) {
  return `<span class="badge ${STATUS_BADGE[status]||'b-info'}">${status}</span>`;
}

function daysChip(days, warn=7, danger=10) {
  if (days <= warn)  return `<span class="days-chip dc-ok">${days}d</span>`;
  if (days < danger) return `<span class="days-chip dc-warn">${days}d</span>`;
  return `<span class="days-chip dc-danger">${days}d ⚠</span>`;
}

/* ═══════════════════════════════════════
   TOAST
   ═══════════════════════════════════════ */
let toastTimer;
function toast(msg, type = 'default', duration = 3000) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast' + (type !== 'default' ? ' ' + type : '');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ═══════════════════════════════════════
   MODAL
   ═══════════════════════════════════════ */
function showModal({ title, body, confirmText='Confirm', confirmClass='btn-primary', cancelText='Cancel', onConfirm }) {
  let overlay = el('shared-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shared-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title" id="sm-title"></div>
        <div class="modal-body"  id="sm-body"></div>
        <div class="modal-btns">
          <button class="btn btn-muted" id="sm-cancel"></button>
          <button class="btn" id="sm-confirm"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  el('sm-title').textContent   = title;
  el('sm-body').innerHTML      = body;
  el('sm-cancel').textContent  = cancelText;
  el('sm-confirm').textContent = confirmText;
  el('sm-confirm').className   = `btn ${confirmClass}`;
  el('sm-cancel').onclick  = closeModal;
  el('sm-confirm').onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
  overlay.classList.add('show');
}

function closeModal() {
  const overlay = el('shared-modal');
  if (overlay) overlay.classList.remove('show');
}

/* ═══════════════════════════════════════
   CLOCK
   ═══════════════════════════════════════ */
function startClock() {
  function tick() {
    const clockEl = el('live-clock');
    if (clockEl) {
      const n = new Date();
      clockEl.textContent = n.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })
        + ' · ' + n.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ═══════════════════════════════════════
   NAV
   ═══════════════════════════════════════ */
function highlightNav(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

function initDateFilter(onChange) {
  document.querySelectorAll('.df-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.df-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dfLabel = el('df-label');
      if (dfLabel) dfLabel.textContent = 'Showing: ' + btn.textContent + ' (' + todayDisplay() + ')';
      if (onChange) onChange(btn.dataset.range || btn.textContent);
    });
  });
}

function initPhoneReveal() {
  document.addEventListener('click', e => {
    if (e.target.classList.contains('phone-mask')) {
      const span = e.target;
      if (span.dataset.revealed) {
        span.textContent = maskPhone(span.dataset.real);
        delete span.dataset.revealed;
      } else {
        span.textContent = String(span.dataset.real || '').replace(/(\d{5})(\d{5})/, '$1 $2');
        span.dataset.revealed = '1';
      }
    }
  });
}

function initStatusPills(onFilter) {
  document.querySelectorAll('.sp').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.sp').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (onFilter) onFilter(pill.dataset.status || 'all');
    });
  });
}

/* ═══════════════════════════════════════
   NAV BADGES — live counts
   ═══════════════════════════════════════ */
async function updateNavBadges() {
  try {
    const kpis = await API.getKPIs();
    const nbCand  = el('nb-cand');
    const nbOffer = el('nb-offer');
    if (nbCand)  nbCand.textContent  = kpis.newCandidates || 0;
    if (nbOffer) nbOffer.textContent = kpis.pendingOffers  || 0;
  } catch(e) {}
}

/* ═══════════════════════════════════════
   PAGE INIT — single definition
   ═══════════════════════════════════════ */
function initPage(pageKey) {
  const session = Auth.guard();
  if (!session) return null;
  startClock();
  Auth.populateSidebar(session);
  highlightNav(pageKey);
  initPhoneReveal();
  updateNavBadges();
  const logoutBtn = el('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      showModal({
        title: 'Sign out?',
        body: 'You will be returned to the login screen.',
        confirmText: 'Sign out',
        confirmClass: 'btn-primary',
        onConfirm: () => Auth.logout()
      });
    });
  }
  return session;
}
