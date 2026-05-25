/**
 * BSC Candidate CRM — shared.js COMPLETE FINAL
 * Includes: CONFIG · Auth (localStorage) · API · Utils · Toast · Modal · Clock · Nav
 */
'use strict';

/* ═══ CONFIG ═══ */
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwolTclzyP2skiQi4ndcPs4y4z0s0gRglN0fUK3jmBq-w8RAxBUltcw47QqyjGGRF-3/exec',
  SESSION_KEY: 'bsc_crm_session',
  SALARY_MIN: 8000, SALARY_MAX: 200000,
  INTERVIEW_CUTOFF: 36,
  ROLE_HOME: { 'HR':'dashboard.html','Floor Manager':'interview-panel.html','Manager':'interview-panel.html','Admin':'dashboard.html' },
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
    try { localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({role,username,loginAt:Date.now()})); } catch(e){}
  },
  get() { try { return JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY)); } catch { return null; } },
  check() { return !!this.get(); },
  logout() { try{localStorage.removeItem(CONFIG.SESSION_KEY);}catch(e){} window.location.replace('login.html'); },
  guard() {
    if (!this.check()) {
      if (!sessionStorage.getItem('_bsc_redir')) {
        sessionStorage.setItem('_bsc_redir','1');
        setTimeout(()=>sessionStorage.removeItem('_bsc_redir'),3000);
        window.location.replace('login.html');
      }
      return null;
    }
    sessionStorage.removeItem('_bsc_redir');
    return this.get();
  },
  populateSidebar(session) {
    const init = (session.username||'HR').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    el('sb-av')       && (el('sb-av').textContent       = init);
    el('sb-username') && (el('sb-username').textContent = session.username);
    el('sb-userrole') && (el('sb-userrole').textContent = session.role);
    this._roleNav(session.role);
  },
  _roleNav(role) {
    const allowed = CONFIG.ROLE_NAV[role]||CONFIG.ROLE_NAV['HR'];
    document.querySelectorAll('.nav-item[data-page]').forEach(i=>{
      i.style.display = allowed.includes(i.dataset.page)?'':'none';
    });
  }
};

/* ═══ API ═══ */
const API = {
  async call(action, params={}) {
    if (!CONFIG.SCRIPT_URL||CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return this._sample(action,params);
    try {
      const res = await fetch(CONFIG.SCRIPT_URL,{method:'POST',body:JSON.stringify({action,...params})});
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch(err) {
      console.warn('[BSC API] Fallback →',err.message);
      return this._sample(action,params);
    }
  },
  async getCandidates(f={})            { return this.call('getCandidates',{filters:f}); },
  async addCandidate(data)             { return this.call('addCandidate',{data}); },
  async updateCandidate(appNo,updates) { return this.call('updateCandidate',{appNo,updates}); },
  async checkDuplicate(phone)          { return this.call('checkDuplicate',{phone}); },
  async getNextAppNo()                 { return this.call('getNextAppNo'); },
  async getKPIs(dr)                    { return this.call('getKPIs',{dateRange:dr}); },
  async getPendingActions()            { return this.call('getPendingActions'); },
  async getInterviewQuestions(desig,round) { return this.call('getInterviewQuestions',{desig,round}); },
  async saveScore(appNo,round,scores)  { return this.call('saveScore',{appNo,round,scores}); },
  async getScores(appNo)               { return this.call('getScores',{appNo}); },
  async getInterviews()                { return this.call('getInterviews'); },
  async scheduleInterview(p)           { return this.call('scheduleInterview',p); },
  async getOffers(f={})               { return this.call('getOffers',{filters:f}); },
  async logCall(appNo,callNo,notes)    { return this.call('logCall',{appNo,callNo,notes}); },
  async updateOfferStatus(appNo,status){ return this.call('updateOfferStatus',{appNo,status}); },
  async getOnboarding()               { return this.call('getOnboarding'); },
  async tickChecklist(appNo,item,done) { return this.call('tickChecklist',{appNo,item,done}); },
  async getExits()                     { return this.call('getExits'); },
  async initiateExit(empId,data)       { return this.call('initiateExit',{empId,data}); },
  async saveExitChecklist(e,i,d)       { return this.call('saveExitChecklist',{empId:e,item:i,done:d}); },
  async verifyUser(u,p)                { return this.call('verifyUser',{username:u,password:p}); },
  _sample(action,params) {
    const yr = new Date().getFullYear();
    return Promise.resolve({
      getKPIs:{total:0,shortlisted:0,selected:0,joined:0,acceptanceRate:0,avgDays:0,onboarding:0,interviewsToday:0,newCandidates:0,pendingOffers:0},
      getPendingActions:{items:[]},
      getCandidates:{candidates:[],total:0},
      checkDuplicate:{exists:false},
      getNextAppNo:{appNo:'BSC-'+yr+'-0001'},
      addCandidate:{success:true,appNo:'BSC-'+yr+'-0001'},
      updateCandidate:{success:true},
      getInterviewQuestions:{questions:[]},
      saveScore:{success:true},
      getScores:{rounds:{HR:null,FM:null,MGR:null}},
      getInterviews:{interviews:[]},
      scheduleInterview:{success:true},
      getOffers:{offers:[],total:0},
      logCall:{success:true},
      updateOfferStatus:{success:true},
      getOnboarding:{candidates:[]},
      tickChecklist:{success:true},
      getExits:{exits:[]},
      initiateExit:{success:true},
      saveExitChecklist:{success:true},
      verifyUser:{success:true,username:params.username,role:'HR',displayName:'HR Admin'},
      getSourceBreakdown:{walkin:0,empref:0,online:0,other:0},
      getDesignations:{designations:['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']}
    }[action]||{success:true});
  }
};

/* ═══ UTILS ═══ */
function el(id){return document.getElementById(id);}
function fmtDate(v){if(!v)return '—';try{const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}catch{return String(v);}}
function todayDisplay(){return new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}
function debounce(fn,ms=400){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function maskPhone(phone){const p=String(phone||'').replace(/\D/g,'');return p?p.slice(0,5)+' XXXXX':'—';}
const AV_COLORS=['navy','gold','green','red','purple','teal'];
function avColor(name){return AV_COLORS[(((name||'').charCodeAt(0)||0)+((name||'').charCodeAt(1)||0))%AV_COLORS.length];}
const STATUS_BADGE={'New':'b-new','Shortlisted':'b-short','Interviewed':'b-int','Selected':'b-sel','Offer Sent':'b-offer','Hold':'b-hold','Rejected':'b-rej','Onboarding':'b-board'};
function statusBadge(s){return '<span class="badge '+(STATUS_BADGE[s]||'b-info')+'">'+s+'</span>';}
function daysChip(days,warn=7,danger=10){days=parseInt(days)||0;if(days<=warn)return '<span class="days-chip dc-ok">'+days+'d</span>';if(days<danger)return '<span class="days-chip dc-warn">'+days+'d</span>';return '<span class="days-chip dc-danger">'+days+'d ⚠</span>';}
function calcAge(dob){try{const d=new Date(dob);return isNaN(d)?'—':Math.floor((Date.now()-d.getTime())/(365.25*86400000));}catch{return '—';}}

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
  if(!ov){ov=document.createElement('div');ov.id='shared-modal';ov.className='modal-overlay';
    ov.innerHTML='<div class="modal"><div class="modal-title" id="sm-title"></div><div class="modal-body" id="sm-body"></div><div class="modal-btns"><button class="btn btn-muted" id="sm-cancel"></button><button class="btn" id="sm-confirm"></button></div></div>';
    document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});}
  el('sm-title').textContent=title;el('sm-body').innerHTML=body;
  el('sm-cancel').textContent=cancelText;el('sm-confirm').textContent=confirmText;
  el('sm-confirm').className='btn '+confirmClass;
  el('sm-cancel').onclick=closeModal;
  el('sm-confirm').onclick=()=>{closeModal();if(onConfirm)onConfirm();};
  ov.classList.add('show');
}
function closeModal(){const o=el('shared-modal');if(o)o.classList.remove('show');}

/* ═══ CLOCK ═══ */
function startClock(){
  function tick(){const c=el('live-clock');if(!c)return;const n=new Date();c.textContent=n.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})+' · '+n.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  tick();setInterval(tick,1000);
}

/* ═══ NAV ═══ */
function highlightNav(page){document.querySelectorAll('.nav-item[data-page]').forEach(i=>i.classList.toggle('active',i.dataset.page===page));}
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
  try{const k=await API.getKPIs();
    const nc=el('nb-cand');if(nc)nc.textContent=k.newCandidates||0;
    const no=el('nb-offer');if(no)no.textContent=k.pendingOffers||0;
  }catch(e){}
}

/* ═══ LOAD DESIGNATIONS into any select[data-desig-source] ═══ */
async function loadDesigDropdowns(){
  try{
    const res=await API.call('getDesignations');
    const desigs=res.designations||[];
    if(!desigs.length)return;
    document.querySelectorAll('select[data-desig-source]').forEach(sel=>{
      while(sel.options.length>1)sel.remove(1);
      desigs.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;sel.appendChild(o);});
    });
  }catch(e){console.warn('Desig load failed:',e.message);}
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
  if(lb)lb.addEventListener('click',()=>showModal({title:'Sign out?',body:'You will be returned to the login screen.',confirmText:'Sign out',confirmClass:'btn-primary',onConfirm:()=>Auth.logout()}));
  return session;
}
