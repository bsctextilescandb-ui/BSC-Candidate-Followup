/**
 * BSC Candidate CRM — Google Apps Script Backend v3
 * Deploy: Execute as ME · Anyone (even anonymous)
 */

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // ← paste your Sheet ID

const COL = {
  Candidates: {
    APP_NO:1, NAME:2, PHONE:3, DOB:4, DESIG:5, SOURCE:6, REFERRER:7,
    STATUS:8, DATE:9, SALARY:10, RESUME:11, Q1:12, Q2:13, Q3:14, Q4:15,
    DAYS_IN:16, CREATED_AT:17, UPDATED_AT:18
  },
  // ── UPDATED: 1st Call, 2nd Call, Interview Date as separate columns ──
  Interview_Schedule: {
    APP_NO:1, CANDIDATE:2, DESIG:3, INTERVIEWER:4,
    CALL1_DATE:5, CALL2_DATE:6, INTERVIEW_DATE:7,
    STATUS:8, CREATED_AT:9
  },
  // ── UPDATED: Added ROUND column so each role has different questions ──
  Interview_Questions: {
    DESIG:1, ROUND:2, Q_ID:3, QUESTION:4, TYPE:5, MAX_SCORE:6, OPTIONS:7
  },
  HR_Status: { APP_NO:1, HR:2, FM:3, MGR:4, UPDATED_AT:5 },
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

/* ── Utilities ── */
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
  return data.slice(1).map(function(row) {
    var obj = {};
    Object.entries(colMap).forEach(function(kv) { obj[kv[0]] = row[kv[1]-1] ?? ''; });
    return obj;
  });
}
function appendRow(sheetName, values) { getSheet(sheetName).appendRow(values); }
function updateRow(sheetName, matchCol, matchVal, updates) {
  var sh = getSheet(sheetName), data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][matchCol-1]) === String(matchVal)) {
      Object.entries(updates).forEach(function(kv){ sh.getRange(i+1,+kv[0]).setValue(kv[1]); });
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
  return (name||'').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
}
const AV_COLORS = ['navy','gold','green','red','purple','teal'];
function getAvatarColor(name) {
  return AV_COLORS[(((name||'').charCodeAt(0)||0)+((name||'').charCodeAt(1)||0)) % AV_COLORS.length];
}
function formatDate(val) {
  if (!val) return '—';
  try { var d=new Date(val); return isNaN(d)?String(val):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return String(val); }
}
function calcDaysIn(dateVal) {
  try { var d=new Date(dateVal); return isNaN(d)?0:Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); }
  catch { return 0; }
}
function calcDaysUntil(dateVal) {
  try { var d=new Date(dateVal); return isNaN(d)?0:Math.max(0,Math.ceil((d.getTime()-Date.now())/86400000)); }
  catch { return 0; }
}
function safeParseJSON(str) { try { return JSON.parse(str); } catch { return null; } }

/* ── Entry Points ── */
function doGet()  { return jsonRes({status:'BSC CRM API online',version:'3.0'}); }
function doPost(e) {
  try {
    var body=JSON.parse(e.postData.contents), action=body.action;
    delete body.action;
    return jsonRes(dispatch(action,body));
  } catch(err) { return jsonRes({error:err.message}); }
}
function dispatch(action, params) {
  var handlers = {
    verifyUser:verifyUser, getCandidates:getCandidates, addCandidate:addCandidate,
    updateCandidate:updateCandidate, checkDuplicate:checkDuplicate, getNextAppNo:getNextAppNo,
    getKPIs:getKPIs, getPendingActions:getPendingActions, getSourceBreakdown:getSourceBreakdown,
    getDesignations:getDesignations,
    getInterviews:getInterviews, scheduleInterview:scheduleInterview,
    getInterviewQuestions:getInterviewQuestions, saveScore:saveScore, getScores:getScores,
    getOffers:getOffers, logCall:logCall, updateOfferStatus:updateOfferStatus,
    getOnboarding:getOnboarding, tickChecklist:tickChecklist,
    getExits:getExits, initiateExit:initiateExit, saveExitChecklist:saveExitChecklist
  };
  if (!handlers[action]) throw new Error('Unknown action: '+action);
  return handlers[action](params);
}

/* ── Auth ── */
function verifyUser(p) {
  try {
    var users=getRows('Users',COL.Users);
    var user=users.find(function(u){
      return String(u.USERNAME).toLowerCase()===String(p.username).toLowerCase()&&
             String(u.PASSWORD)===String(p.password)&&
             String(u.ACTIVE).toUpperCase()==='TRUE';
    });
    if (!user) return {success:false};
    var names={HR:'HR Admin','Floor Manager':'Floor Manager',Manager:'Store Manager',Admin:'Admin'};
    return {success:true,role:user.ROLE,displayName:names[user.ROLE]||user.ROLE};
  } catch(e) {
    var demo=[
      {u:'hr@bsctextiles.com',p:'bsc@2026',role:'HR',name:'HR Admin'},
      {u:'fm@bsctextiles.com',p:'bsc@2026',role:'Floor Manager',name:'Floor Manager'},
      {u:'manager@bsctextiles.com',p:'bsc@2026',role:'Manager',name:'Store Manager'},
      {u:'admin@bsctextiles.com',p:'bsc@2026',role:'Admin',name:'Admin'}
    ];
    var m=demo.find(function(d){return d.u.toLowerCase()===p.username.toLowerCase()&&d.p===p.password;});
    return m?{success:true,role:m.role,displayName:m.name}:{success:false};
  }
}

/* ── Candidates ── */
function getCandidates(params) {
  var filters=params&&params.filters?params.filters:{};
  var rows=[];
  try { rows=getRows('Candidates',COL.Candidates); } catch(e) { return {candidates:[],total:0}; }
  var list=rows.map(function(r){
    return {
      appNo:    String(r.APP_NO||''),
      name:     String(r.NAME||''),
      initials: getInitials(String(r.NAME||'')),
      color:    getAvatarColor(String(r.NAME||'')),
      phone:    String(r.PHONE||''),
      dob:      String(r.DOB||''),
      desig:    String(r.DESIG||''),
      source:   String(r.SOURCE||''),
      referrer: String(r.REFERRER||''),
      date:     formatDate(r.DATE),
      status:   String(r.STATUS||'New'),
      daysIn:   calcDaysIn(r.DATE),
      salary:   String(r.SALARY||''),
      resume:   String(r.RESUME||''),
      q1:       String(r.Q1||''),
      q2:       String(r.Q2||''),
      q3:       String(r.Q3||''),
      q4:       String(r.Q4||''),
      rejReason:String(r.Q4||'')
    };
  });
  if (filters.status&&filters.status!=='all')
    list=list.filter(function(c){return c.status.toLowerCase()===filters.status.toLowerCase();});
  if (filters.desig)  list=list.filter(function(c){return c.desig===filters.desig;});
  if (filters.source) list=list.filter(function(c){return c.source===filters.source;});
  if (filters.q) {
    var q=String(filters.q).toLowerCase();
    list=list.filter(function(c){return c.name.toLowerCase().includes(q)||c.appNo.toLowerCase().includes(q)||c.phone.includes(q);});
  }
  var total=list.length, page=parseInt(filters.page)||1, limit=parseInt(filters.limit)||50;
  return {candidates:list.slice((page-1)*limit,page*limit),total:total,page:page};
}

function addCandidate(p) {
  var appNo=generateAppNo(), now=new Date().toISOString(), data=p.data||{};
  appendRow('Candidates',[appNo,data.name,data.phone,data.dob,data.desig,data.source,
    data.referrer,'New',new Date(),data.salary,data.resume,data.q1,data.q2,data.q3,data.q4,0,now,now]);
  return {success:true,appNo:appNo};
}
function updateCandidate(p) {
  var colMap={status:COL.Candidates.STATUS,desig:COL.Candidates.DESIG,q4:COL.Candidates.Q4};
  var upd={};
  Object.entries(p.updates||{}).forEach(function(kv){if(colMap[kv[0]])upd[colMap[kv[0]]]=kv[1];});
  upd[COL.Candidates.UPDATED_AT]=new Date().toISOString();
  return {success:updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,upd)};
}
function checkDuplicate(p) {
  try {
    var rows=getRows('Candidates',COL.Candidates);
    var ph=String(p.phone||'').replace(/\D/g,'');
    var m=rows.find(function(r){return String(r.PHONE||'').replace(/\D/g,'')===ph;});
    return m?{exists:true,name:m.NAME,appNo:m.APP_NO,appliedOn:formatDate(m.DATE)}:{exists:false};
  } catch(e){return {exists:false};}
}
function getNextAppNo() { return {appNo:generateAppNo()}; }
function generateAppNo() {
  try {
    var sh=getSheet('Candidates'), count=Math.max(sh.getLastRow()-1,0);
    return 'BSC-'+new Date().getFullYear()+'-'+String(count+1).padStart(4,'0');
  } catch(e){return 'BSC-'+new Date().getFullYear()+'-0001';}
}

/* ── Dashboard ── */
function getKPIs() {
  var total=0,shortlisted=0,selected=0,joined=0,newCandidates=0,avgDays=0;
  try {
    var rows=getRows('Candidates',COL.Candidates);
    total=rows.length;
    shortlisted=rows.filter(function(r){return r.STATUS==='Shortlisted';}).length;
    selected=rows.filter(function(r){return ['Selected','Offer Sent','Onboarding'].includes(r.STATUS);}).length;
    joined=rows.filter(function(r){return r.STATUS==='Onboarding';}).length;
    newCandidates=rows.filter(function(r){return r.STATUS==='New';}).length;
    var hr=rows.filter(function(r){return r.STATUS==='Onboarding'&&r.DATE;});
    if(hr.length) avgDays=Math.round(hr.reduce(function(s,r){return s+calcDaysIn(r.DATE);},0)/hr.length);
  } catch(e){Logger.log('KPI candidates error:'+e.message);}
  var acceptanceRate=0,pendingOffers=0;
  try {
    var or=getRows('Selection_Offer',COL.Selection_Offer);
    var acc=or.filter(function(r){return r.STATUS==='Accepted';}).length;
    acceptanceRate=or.length?Math.round(acc/or.length*100):0;
    pendingOffers=or.filter(function(r){return r.STATUS==='Pending Accept';}).length;
  } catch(e){}
  var interviewsToday=0;
  try {
    var sc=getRows('Interview_Schedule',COL.Interview_Schedule);
    var ts=new Date().toDateString();
    interviewsToday=sc.filter(function(r){return r.INTERVIEW_DATE&&new Date(r.INTERVIEW_DATE).toDateString()===ts;}).length;
  } catch(e){}
  return {total:total,shortlisted:shortlisted,selected:selected,joined:joined,
    acceptanceRate:acceptanceRate,avgDays:avgDays,onboarding:joined,
    interviewsToday:interviewsToday,newCandidates:newCandidates,pendingOffers:pendingOffers};
}

function getPendingActions() {
  var items=[];
  try {
    var rows=getRows('Candidates',COL.Candidates);
    var nc=rows.filter(function(r){return r.STATUS==='New';}).length;
    if(nc>0) items.push({text:nc+' new candidate'+(nc>1?'s':'')+' awaiting review',priority:'info'});
    rows.filter(function(r){return r.STATUS==='Hold'&&calcDaysIn(r.DATE)>7;}).slice(0,3).forEach(function(r){
      items.push({text:String(r.NAME)+' — on hold for '+calcDaysIn(r.DATE)+' days',priority:'warn'});
    });
  } catch(e){}
  try {
    var or=getRows('Selection_Offer',COL.Selection_Offer);
    or.filter(function(r){return r.STATUS==='Pending Accept';}).slice(0,3).forEach(function(r){
      items.push({text:String(r.NAME)+' — offer pending confirmation',priority:'urgent'});
    });
  } catch(e){}
  return {items:items.slice(0,8)};
}

function getSourceBreakdown() {
  try {
    var rows=getRows('Candidates',COL.Candidates);
    return {
      walkin: rows.filter(function(r){return r.SOURCE==='Walk-in';}).length,
      empref: rows.filter(function(r){return r.SOURCE==='Employee Ref';}).length,
      online: rows.filter(function(r){return r.SOURCE==='Online Apply';}).length,
      other:  rows.filter(function(r){return !['Walk-in','Employee Ref','Online Apply'].includes(r.SOURCE)&&r.SOURCE;}).length
    };
  } catch(e){return {walkin:0,empref:0,online:0,other:0};}
}

function getDesignations() {
  try {
    var rows=getRows('Roles_Config',COL.Roles_Config);
    return {designations:rows.filter(function(r){return String(r.ACTIVE).toUpperCase()==='TRUE';})
      .map(function(r){return String(r.DESIG||'').trim();}).filter(Boolean)};
  } catch(e){return {designations:['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']};}
}

/* ── Interview Schedule ── */
function scheduleInterview(p) {
  try {
    var now=new Date().toISOString();
    var existing=getRows('Interview_Schedule',COL.Interview_Schedule);
    var dup=existing.find(function(r){return String(r.APP_NO)===String(p.appNo);});
    if (dup) {
      updateRow('Interview_Schedule',COL.Interview_Schedule.APP_NO,p.appNo,{
        [COL.Interview_Schedule.CALL1_DATE]:    p.call1Date ? new Date(p.call1Date) : '',
        [COL.Interview_Schedule.CALL2_DATE]:    p.call2Date ? new Date(p.call2Date) : '',
        [COL.Interview_Schedule.INTERVIEW_DATE]:new Date(p.interviewDate),
        [COL.Interview_Schedule.STATUS]:        'Scheduled',
        [COL.Interview_Schedule.CREATED_AT]:    now
      });
    } else {
      appendRow('Interview_Schedule',[
        p.appNo, p.candidate, p.desig, 'HR Admin',
        p.call1Date    ? new Date(p.call1Date)    : '',
        p.call2Date    ? new Date(p.call2Date)    : '',
        new Date(p.interviewDate),
        'Scheduled', now
      ]);
    }
    return {success:true};
  } catch(e){return {success:false,error:e.message};}
}

function getInterviews() {
  var schedRows=[];
  try { schedRows=getRows('Interview_Schedule',COL.Interview_Schedule); }
  catch(e){return {interviews:[]};}

  var scoreMap={};
  try {
    getRows('HR_Status',{APP_NO:1,HR:2,FM:3,MGR:4}).forEach(function(r){
      scoreMap[String(r.APP_NO)]={
        hrScore: r.HR  ? safeParseJSON(r.HR)  : null,
        fmScore: r.FM  ? safeParseJSON(r.FM)  : null,
        mgrScore:r.MGR ? safeParseJSON(r.MGR) : null
      };
    });
  } catch(e){}

  var candMap={};
  try {
    getRows('Candidates',COL.Candidates).forEach(function(r){
      candMap[String(r.APP_NO)]={name:String(r.NAME||''),desig:String(r.DESIG||'')};
    });
  } catch(e){}

  return {interviews:schedRows.map(function(r){
    var appNo=String(r.APP_NO||'');
    var cand=candMap[appNo]||{};
    var sc=scoreMap[appNo]||{hrScore:null,fmScore:null,mgrScore:null};
    return {
      appNo:         appNo,
      candidate:     String(r.CANDIDATE||cand.name||''),
      initials:      getInitials(String(r.CANDIDATE||cand.name||'')),
      color:         getAvatarColor(String(r.CANDIDATE||cand.name||'')),
      desig:         String(r.DESIG||cand.desig||''),
      interviewer:   String(r.INTERVIEWER||'HR Admin'),
      call1Date:     formatDate(r.CALL1_DATE),
      call2Date:     formatDate(r.CALL2_DATE),
      interviewDate: formatDate(r.INTERVIEW_DATE),
      status:        String(r.STATUS||'Scheduled'),
      hrScore:       sc.hrScore,
      fmScore:       sc.fmScore,
      mgrScore:      sc.mgrScore
    };
  })};
}

/* ── Interview Questions — now filtered by ROUND ── */
function getInterviewQuestions(p) {
  var desig=p&&p.desig?p.desig:'', round=p&&p.round?p.round:'HR';
  try {
    var rows=getRows('Interview_Questions',COL.Interview_Questions);
    var filtered=rows.filter(function(r){
      var dMatch = !r.DESIG || r.DESIG===desig || r.DESIG==='All';
      var rMatch = !r.ROUND || r.ROUND===round  || r.ROUND==='All';
      return dMatch && rMatch;
    });
    return {questions:filtered.map(function(r){
      return {
        id:      String(r.Q_ID),
        text:    String(r.QUESTION),
        type:    String(r.TYPE||'score'),
        max:     parseInt(r.MAX_SCORE)||10,
        options: r.OPTIONS?String(r.OPTIONS).split(',').map(function(o){return o.trim();}):[]
      };
    })};
  } catch(e){return {questions:[]};}
}

/* ── Save Score — status to "Interviewed" only after all 3 rounds done ── */
function saveScore(p) {
  try {
    var now=new Date().toISOString();
    var scoreStr=JSON.stringify(p.scores);
    var colMap={HR:COL.HR_Status.HR,FM:COL.HR_Status.FM,MGR:COL.HR_Status.MGR};
    var col=colMap[p.round]||2;
    var updated=updateRow('HR_Status',COL.HR_Status.APP_NO,p.appNo,{[col]:scoreStr,[COL.HR_Status.UPDATED_AT]:now});
    if (!updated) {
      appendRow('HR_Status',[p.appNo,
        p.round==='HR'?scoreStr:'',
        p.round==='FM'?scoreStr:'',
        p.round==='MGR'?scoreStr:'',
        now
      ]);
    }
    // Check if all 3 rounds complete → update status to Interviewed
    var allScores=getRows('HR_Status',{APP_NO:1,HR:2,FM:3,MGR:4})
      .find(function(r){return String(r.APP_NO)===String(p.appNo);});
    if (allScores && allScores.HR && allScores.FM && allScores.MGR) {
      updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{
        [COL.Candidates.STATUS]:     'Interviewed',
        [COL.Candidates.UPDATED_AT]: now
      });
    }
    return {success:true};
  } catch(e){return {success:false,error:e.message};}
}

function getScores(p) {
  try {
    var rows=getRows('HR_Status',{APP_NO:1,HR:2,FM:3,MGR:4});
    var row=rows.find(function(r){return String(r.APP_NO)===String(p.appNo);});
    if (!row) return {rounds:{HR:null,FM:null,MGR:null}};
    return {rounds:{
      HR: row.HR?safeParseJSON(row.HR):null,
      FM: row.FM?safeParseJSON(row.FM):null,
      MGR:row.MGR?safeParseJSON(row.MGR):null
    }};
  } catch(e){return {rounds:{HR:null,FM:null,MGR:null}};}
}

/* ── Offer Process ── */
function getOffers(p) {
  try {
    var rows=getRows('Selection_Offer',COL.Selection_Offer);
    return {offers:rows.map(function(r){
      return {
        appNo:   String(r.APP_NO||''), name:String(r.NAME||''),
        initials:getInitials(String(r.NAME||'')), color:getAvatarColor(String(r.NAME||'')),
        desig:   String(r.DESIG||''), noticePd:String(r.NOTICE_PD||'—'),
        doj:     formatDate(r.EST_DOJ), call1:formatDate(r.CALL1_DATE),
        call2:   formatDate(r.CALL2_DATE), confirm:formatDate(r.CONFIRM_DATE),
        status:  String(r.STATUS||'')
      };
    }),total:rows.length};
  } catch(e){return {offers:[],total:0};}
}
function logCall(p) {
  try {
    var cm={1:COL.Selection_Offer.CALL1_DATE,2:COL.Selection_Offer.CALL2_DATE,3:COL.Selection_Offer.CONFIRM_DATE};
    var col=cm[p.callNo]; if(!col) throw new Error('Invalid call number');
    updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,{[col]:new Date(),[COL.Selection_Offer.UPDATED_AT]:new Date().toISOString()});
    return {success:true};
  } catch(e){return {success:false,error:e.message};}
}
function updateOfferStatus(p) {
  updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,{[COL.Selection_Offer.STATUS]:p.status,[COL.Selection_Offer.UPDATED_AT]:new Date().toISOString()});
  return {success:true};
}

/* ── Onboarding ── */
function getOnboarding() {
  try {
    var rows=getRows('Onboarding_Checklist',COL.Onboarding_Checklist);
    var grouped={};
    rows.forEach(function(r){
      var k=String(r.APP_NO);
      if(!grouped[k]) grouped[k]={appNo:k,name:String(r.NAME||''),desig:String(r.DESIG||''),doj:formatDate(r.DOJ),items:[]};
      grouped[k].items.push({item:String(r.ITEM||''),done:String(r.DONE).toUpperCase()==='TRUE',doneBy:String(r.DONE_BY||''),doneAt:String(r.DONE_AT||''),due:formatDate(r.DUE),responsible:String(r.RESPONSIBLE||'')});
    });
    return {candidates:Object.values(grouped).map(function(c){
      return Object.assign({},c,{progress:c.items.filter(function(i){return i.done;}).length,total:c.items.length,dojDays:calcDaysUntil(c.doj)});
    })};
  } catch(e){return {candidates:[]};}
}
function tickChecklist(p) {
  try {
    var sh=getSheet('Onboarding_Checklist'), data=sh.getDataRange().getValues();
    for(var i=1;i<data.length;i++){
      if(String(data[i][0])===String(p.appNo)&&String(data[i][4])===String(p.item)){
        sh.getRange(i+1,COL.Onboarding_Checklist.DONE).setValue(p.done?'TRUE':'FALSE');
        if(p.done){sh.getRange(i+1,COL.Onboarding_Checklist.DONE_BY).setValue('HR');sh.getRange(i+1,COL.Onboarding_Checklist.DONE_AT).setValue(new Date().toISOString());}
        return {success:true};
      }
    }
    return {success:false};
  } catch(e){return {success:false,error:e.message};}
}

/* ── Exit ── */
function getExits() {
  try {
    var rows=getRows('Exit_Checklist',COL.Exit_Checklist), grouped={};
    rows.forEach(function(r){
      var k=String(r.EMP_ID);
      if(!grouped[k]) grouped[k]={appNo:k,name:String(r.NAME||''),initials:getInitials(String(r.NAME||'')),color:getAvatarColor(String(r.NAME||'')),desig:String(r.DESIG||''),exitDate:formatDate(r.EXIT_DATE),reason:String(r.REASON||''),ffStatus:String(r.FF_STATUS||'Pending'),softwareInactive:String(r.SOFTWARE_INACTIVE).toUpperCase()==='TRUE',rehire:String(r.REHIRE).toUpperCase()==='TRUE',items:[]};
      grouped[k].items.push({item:String(r.ITEM||''),done:String(r.DONE).toUpperCase()==='TRUE',doneBy:String(r.DONE_BY||''),doneAt:String(r.DONE_AT||'')});
    });
    return {exits:Object.values(grouped).map(function(e){return Object.assign({},e,{overdue:Math.max(0,calcDaysIn(e.exitDate)-5)});})};
  } catch(e){return {exits:[]};}
}
function initiateExit(p) {
  try {
    var d=p.data||{};
    ['Resignation accepted','Knowledge transfer','Assets returned','ID & access revoked','Software deactivated','FF settlement','Exit interview','Final payslip issued']
      .forEach(function(item){appendRow('Exit_Checklist',[p.empId,d.name,d.desig,d.exitDate,d.reason,'Pending','FALSE','FALSE',item,'FALSE','','']);});
    return {success:true};
  } catch(e){return {success:false,error:e.message};}
}
function saveExitChecklist(p) {
  try {
    var sh=getSheet('Exit_Checklist'), data=sh.getDataRange().getValues();
    for(var i=1;i<data.length;i++){
      if(String(data[i][0])===String(p.empId)&&String(data[i][8])===String(p.item)){
        sh.getRange(i+1,COL.Exit_Checklist.DONE).setValue(p.done?'TRUE':'FALSE');
        if(p.done){sh.getRange(i+1,COL.Exit_Checklist.DONE_BY).setValue('HR');sh.getRange(i+1,COL.Exit_Checklist.DONE_AT).setValue(new Date().toISOString());}
        return {success:true};
      }
    }
    return {success:false};
  } catch(e){return {success:false,error:e.message};}
}

/* ── One-time Setup ── */
function setupSheets() {
  var ss=SpreadsheetApp.openById(SHEET_ID);
  var defs={
    Candidates:           ['App No','Name','Phone','DOB','Designation','Source','Referrer','Status','Date Applied','Salary','Resume','Q1','Q2','Q3','Q4','Days In','Created At','Updated At'],
    HR_Status:            ['App No','HR Score JSON','FM Score JSON','MGR Score JSON','Updated At'],
    Interview_Schedule:   ['App No','Candidate','Designation','Interviewer','1st Call Date','2nd Call Date','Interview Date','Status','Created At'],
    Interview_Questions:  ['Designation','Round','Question ID','Question','Type','Max Score','Options'],
    Selection_Offer:      ['App No','Name','Designation','Notice Period','Est DOJ','Call 1','Call 2','Confirm','Offer Letter','Status','Created At','Updated At'],
    Onboarding_Checklist: ['App No','Name','Designation','DOJ','Item','Done','Done By','Done At','Due Date','Responsible'],
    Exit_Checklist:       ['Emp ID','Name','Designation','Exit Date','Reason','FF Status','Software Inactive','Rehire','Item','Done','Done By','Done At'],
    Roles_Config:         ['Role','Designation','Active'],
    Users:                ['Username','Password','Role','Active','Created At']
  };
  Object.entries(defs).forEach(function(kv){
    var sh=ss.getSheetByName(kv[0])||ss.insertSheet(kv[0]);
    if(sh.getLastRow()===0) sh.getRange(1,1,1,kv[1].length).setValues([kv[1]]).setFontWeight('bold').setBackground('#1E2D4E').setFontColor('#fff');
  });

  // Seed Users
  var us=ss.getSheetByName('Users');
  if(us.getLastRow()<=1){
    [['hr@bsctextiles.com','bsc@2026','HR','TRUE'],['fm@bsctextiles.com','bsc@2026','Floor Manager','TRUE'],
     ['manager@bsctextiles.com','bsc@2026','Manager','TRUE'],['admin@bsctextiles.com','bsc@2026','Admin','TRUE']]
    .forEach(function(r){us.appendRow(r.concat([new Date()]));});
  }

  // Seed Roles_Config
  var rc=ss.getSheetByName('Roles_Config');
  if(rc.getLastRow()<=1){
    ['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']
      .forEach(function(d){rc.appendRow(['All',d,'TRUE']);});
  }

  // Seed Interview_Questions with round-specific questions
  var iq=ss.getSheetByName('Interview_Questions');
  if(iq.getLastRow()<=1){
    var qs=[
      // HR Round questions
      ['Sales Executive','HR','1','Communication skills','score',10,''],
      ['Sales Executive','HR','2','Confidence & presentation','score',10,''],
      ['Sales Executive','HR','3','Retail experience','score',15,''],
      ['Sales Executive','HR','4','Expected salary reasonable?','score',10,''],
      ['Sales Executive','HR','5','Can join immediately?','select',0,'Yes immediately,After 1 week,After 15 days,After 1 month'],
      // FM Round questions
      ['Sales Executive','FM','1','Product knowledge','score',15,''],
      ['Sales Executive','FM','2','Floor handling ability','score',15,''],
      ['Sales Executive','FM','3','Team interaction','score',10,''],
      ['Sales Executive','FM','4','Textile experience','score',10,''],
      // Manager Round questions
      ['Sales Executive','MGR','1','Overall personality','score',15,''],
      ['Sales Executive','MGR','2','Long-term commitment','score',15,''],
      ['Sales Executive','MGR','3','Salary negotiation','score',10,''],
      ['Sales Executive','MGR','4','Final recommendation','score',10,''],
      // Floor Manager role
      ['Floor Manager','HR','1','Leadership experience','score',15,''],
      ['Floor Manager','HR','2','Communication skills','score',10,''],
      ['Floor Manager','HR','3','Management knowledge','score',15,''],
      ['Floor Manager','FM','1','Floor operations','score',15,''],
      ['Floor Manager','FM','2','Team management','score',15,''],
      ['Floor Manager','FM','3','Problem solving','score',10,''],
      ['Floor Manager','MGR','1','Strategic thinking','score',15,''],
      ['Floor Manager','MGR','2','Leadership fit','score',15,''],
      ['Floor Manager','MGR','3','Overall assessment','score',10,''],
      // All designations
      ['All','HR','ALL1','Years of experience','select',0,'0–1 years,1–3 years,3–5 years,5+ years'],
      ['All','HR','ALL2','Highest qualification','select',0,'10th Pass,12th Pass,Graduate,Post Graduate'],
    ];
    qs.forEach(function(q){iq.appendRow(q);});
  }

  Logger.log("BSC CRM v3 setup complete!");
}
