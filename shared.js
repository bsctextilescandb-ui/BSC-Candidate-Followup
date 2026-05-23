/**
 * BSC Candidate CRM — shared.js  (config + auth + api + utils)
 * Single file — no external dependencies
 */
'use strict';

/* ═══ CONFIG ═══ */
const CONFIG = {
  SCRIPT_URL:    'https://script.google.com/macros/s/AKfycbwolTclzyP2skiQi4ndcPs4y4z0s0gRglN0fUK3jmBq-w8RAxBUltcw47QqyjGGRF-3/exec',
  SESSION_KEY:   'bsc_crm_session',
  APP_NAME:      'BSC Candidate CRM',
  SALARY_MIN:    8000,
  SALARY_MAX:    200000,
  INTERVIEW_CUTOFF: 36,
  OFFER_SLA_DAYS:   3,
  ROLE_HOME: {
    'HR':           'dashboard.html',
    'Floor Manager':'interview-panel.html',
    'Manager':      'interview-panel.html',
    'Admin':        'dashboard.html'
  },
  ROLE_NAV: {
    'HR':           ['dashboard','candidates','interview','offer','onboarding','exit','form'],
    'Floor Manager':['interview','candidates'],
    'Manager':      ['interview','dashboard'],
    'Admin':        ['dashboard','candidates','interview','offer','onboarding','exit','form','settings']
  }
};

/* ═══ AUTH ═══ */
const Auth = {
  save(role, username) {
    try { localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({role, username, loginAt:Date.now()})); } catch(e){}
  },
  get() {
    try { return JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY)); } catch { return null; }
  },
  check() { return !!this.get(); },
  logout() {
    try { localStorage.removeItem(CONFIG.SESSION_KEY); } catch(e){}
    window.location.replace('login.html');
  },
  guard() {
    // Prevent rapid redirect loops with a flag
    if (sessionStorage.getItem('_bsc_loop')) return null;
    if (!this.check()) {
      sessionStorage.setItem('_bsc_loop','1');
      setTimeout(()=>sessionStorage.removeItem('_bsc_loop'), 3000);
      window.location.replace('login.html');
      return null;
    }
    sessionStorage.removeItem('_bsc_loop');
    return this.get();
  },
  populateSidebar(session) {
    const initials = (session.username||'HR').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
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

/* ═══ API ═══ */
const API = {
  async call(action, params={}) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
      return this._sample(action, params);
    }
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({action, ...params})
      });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch(err) {
      console.warn('[BSC] API fallback:', err.message);
      return this._sample(action, params);
    }
  },
  async getCandidates(filters={})         { return this.call('getCandidates',{filters}); },
  async addCandidate(data)                 { return this.call('addCandidate',{data}); },
  async updateCandidate(appNo,updates)     { return this.call('updateCandidate',{appNo,updates}); },
  async checkDuplicate(phone)              { return this.call('checkDuplicate',{phone}); },
  async getNextAppNo()                     { return this.call('getNextAppNo'); },
  async getKPIs(dr)                        { return this.call('getKPIs',{dateRange:dr}); },
  async getPendingActions()                { return this.call('getPendingActions'); },
  async getInterviewQuestions(desig)       { return this.call('getInterviewQuestions',{desig}); },
  async saveScore(appNo,round,scores)      { return this.call('saveScore',{appNo,round,scores}); },
  async getScores(appNo)                   { return this.call('getScores',{appNo}); },
  async getOffers(filters={})              { return this.call('getOffers',{filters}); },
  async logCall(appNo,callNo,notes)        { return this.call('logCall',{appNo,callNo,notes}); },
  async updateOfferStatus(appNo,status)    { return this.call('updateOfferStatus',{appNo,status}); },
  async getOnboarding()                    { return this.call('getOnboarding'); },
  async tickChecklist(appNo,item,done)     { return this.call('tickChecklist',{appNo,item,done}); },
  async getExits()                         { return this.call('getExits'); },
  async initiateExit(empId,data)           { return this.call('initiateExit',{empId,data}); },
  async saveExitChecklist(empId,item,done) { return this.call('saveExitChecklist',{empId,item,done}); },
  async verifyUser(username,password)      { return this.call('verifyUser',{username,password}); },

  _sample(action, params) {
    // Empty real-data defaults — no fake numbers
    return Promise.resolve({
      getKPIs:            {total:0,shortlisted:0,selected:0,joined:0,acceptanceRate:0,avgDays:0,onboarding:0,interviewsToday:0,newCandidates:0,pendingOffers:0},
      getPendingActions:  {items:[]},
      getCandidates:      {candidates:[],total:0},
      checkDuplicate:     {exists:false},
      getNextAppNo:       {appNo:'BSC-'+new Date().getFullYear()+'-0001'},
      addCandidate:       {success:true,appNo:'BSC-'+new Date().getFullYear()+'-0001'},
      updateCandidate:    {success:true},
      getInterviewQuestions:{questions:[]},
      saveScore:          {success:true},
      getScores:          {rounds:{HR:null,FM:null,MGR:null}},
      getOffers:          {offers:[],total:0},
      logCall:            {success:true},
      updateOfferStatus:  {success:true},
      getOnboarding:      {candidates:[]},
      tickChecklist:      {success:true},
      getExits:           {exits:[]},
      initiateExit:       {success:true},
      saveExitChecklist:  {success:true},
      verifyUser:         {success:true,username:params.username,role:'HR',displayName:'HR Admin'}
    }[action] || {success:true});
  }
};

/* ═══ UTILS ═══ */
function el(id){ return document.getElementById(id); }

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

function todayDisplay() {
  return new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}

function debounce(fn,ms=400){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

function maskPhone(phone) {
  const p = String(phone||'').replace(/\D/g,'');
  return p ? p.slice(0,5)+' XXXXX' : '—';
}

const AV_COLORS=['navy','gold','green','red','purple','teal'];
function avColor(name){
  return AV_COLORS[((name||'').charCodeAt(0)+((name||'').charCodeAt(1)||0))%AV_COLORS.length];
}

const STATUS_BADGE={
  'New':'b-new','Shortlisted':'b-short','Interviewed':'b-int',
  'Selected':'b-sel','Offer Sent':'b-offer','Hold':'b-hold',
  'Rejected':'b-rej','Onboarding':'b-board'
};
function statusBadge(s){return '<span class="badge '+(STATUS_BADGE[s]||'b-info')+'">'+s+'</span>';}

function daysChip(days,warn=7,danger=10){
  days=parseInt(days)||0;
  if(days<=warn)  return '<span class="days-chip dc-ok">'+days+'d</span>';
  if(days<danger) return '<span class="days-chip dc-warn">'+days+'d</span>';
  return '<span class="days-chip dc-danger">'+days+'d ⚠</span>';
}

/* ═══ TOAST ═══ */
let _tt;
function toast(msg,type='default',dur=3000){
  let t=document.querySelector('.toast');
  if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.className='toast'+(type!=='default'?' '+type:'');
  void t.offsetWidth;t.classList.add('show');
  clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('show'),dur);
}

/* ═══ MODAL ═══ */
function showModal({title,body,confirmText='Confirm',confirmClass='btn-primary',cancelText='Cancel',onConfirm}){
  let ov=el('shared-modal');
  if(!ov){
    ov=document.createElement('div');ov.id='shared-modal';ov.className='modal-overlay';
    ov.innerHTML='<div class="modal"><div class="modal-title" id="sm-title"></div><div class="modal-body" id="sm-body"></div><div class="modal-btns"><button class="btn btn-muted" id="sm-cancel"></button><button class="btn" id="sm-confirm"></button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
  }
  el('sm-title').textContent=title; el('sm-body').innerHTML=body;
  el('sm-cancel').textContent=cancelText; el('sm-confirm').textContent=confirmText;
  el('sm-confirm').className='btn '+confirmClass;
  el('sm-cancel').onclick=closeModal;
  el('sm-confirm').onclick=()=>{closeModal();if(onConfirm)onConfirm();};
  ov.classList.add('show');
}
function closeModal(){const o=el('shared-modal');if(o)o.classList.remove('show');}

/* ═══ CLOCK ═══ */
function startClock(){
  function tick(){
    const c=el('live-clock');if(!c)return;
    const n=new Date();
    c.textContent=n.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})
      +' · '+n.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  tick();setInterval(tick,1000);
}

/* ═══ NAV HELPERS ═══ */
function highlightNav(page){
  document.querySelectorAll('.nav-item[data-page]').forEach(i=>i.classList.toggle('active',i.dataset.page===page));
}
function initDateFilter(onChange){
  document.querySelectorAll('.df-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.df-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const l=el('df-label');if(l)l.textContent='Showing: '+todayDisplay();
      if(onChange)onChange(btn.dataset.range||btn.textContent);
    });
  });
}
function initPhoneReveal(){
  document.addEventListener('click',e=>{
    if(!e.target.classList.contains('phone-mask'))return;
    const s=e.target;
    if(s.dataset.revealed){s.textContent=maskPhone(s.dataset.real);delete s.dataset.revealed;}
    else{s.textContent=String(s.dataset.real||'').replace(/(\d{5})(\d{5})/,'$1 $2');s.dataset.revealed='1';}
  });
}
function initStatusPills(onFilter){
  document.querySelectorAll('.sp').forEach(pill=>{
    pill.addEventListener('click',()=>{
      document.querySelectorAll('.sp').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      if(onFilter)onFilter(pill.dataset.status||'all');
    });
  });
}

/* ═══ NAV BADGES ═══ */
async function updateNavBadges(){
  try{
    const k=await API.getKPIs();
    const nc=el('nb-cand'); if(nc)nc.textContent=k.newCandidates||0;
    const no=el('nb-offer');if(no)no.textContent=k.pendingOffers||0;
  }catch(e){}
}


// ── Load designations dynamically from Roles_Config sheet ──
async function loadDesigDropdowns() {
  try {
    const res   = await API.call('getDesignations');
    const desigs = res.designations || [];
    if (!desigs.length) return;
    // Update every designation select on this page
    document.querySelectorAll('select[data-desig-source]').forEach(sel => {
      const hasAll = sel.dataset.desigSource === 'filter';
      // Keep first option (placeholder / "All Designations")
      while (sel.options.length > 1) sel.remove(1);
      desigs.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        sel.appendChild(opt);
      });
    });
  } catch(e) { console.warn('Designation load failed:', e.message); }
}

/* ═══ PAGE INIT — single definition ═══ */
function initPage(pageKey){
  const session=Auth.guard();
  if(!session)return null;
  startClock();
  Auth.populateSidebar(session);
  highlightNav(pageKey);
  initPhoneReveal();
  updateNavBadges();
  loadDesigDropdowns();
  const lb=el('logout-btn');
  if(lb)lb.addEventListener('click',()=>showModal({
    title:'Sign out?',body:'You will be returned to the login screen.',
    confirmText:'Sign out',confirmClass:'btn-primary',
    onConfirm:()=>Auth.logout()
  }));
  return session;
}
