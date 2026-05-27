/**
 * BSC Candidate CRM — code.gs v4 COMPLETE
 * Changes: No FM role, Store Manager, step-by-step scheduling,
 * interview tokens, resume Drive upload, separate Selected/Rejected tabs,
 * mandatory remarks, auto-move on status change
 */

// ══════════════════════════════════════════════════════════════
// REQUIRED: Paste your Google Sheet ID below
// Get it from your Sheet URL:
// https://docs.google.com/spreadsheets/d/[SHEET_ID_IS_HERE]/edit
// ══════════════════════════════════════════════════════════════
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // <-- REPLACE THIS

const COL = {
  Candidates: {
    APP_NO:1,NAME:2,PHONE:3,DOB:4,DESIG:5,SOURCE:6,REFERRER:7,
    STATUS:8,DATE:9,SALARY:10,RESUME_URL:11,
    Q1:12,Q2:13,Q3:14,Q4:15,Q5:16,REMARKS:17,
    DAYS_IN:18,CREATED_AT:19,UPDATED_AT:20
  },
  // Step-by-step scheduling — each call has date + remarks
  Interview_Schedule: {
    APP_NO:1,CANDIDATE:2,DESIG:3,
    CALL1_DATE:4,CALL1_REMARKS:5,
    CALL2_DATE:6,CALL2_REMARKS:7,
    INTERVIEW_DATE:8,INTERVIEW_REMARKS:9,
    STEP:10,STATUS:11,CREATED_AT:12
  },
  // Tokens for shareable interview links (replaces FM login)
  Interview_Tokens: {
    TOKEN:1,APP_NO:2,CANDIDATE:3,DESIG:4,
    ASSIGNED_NAME:5,ASSIGNED_DESIG:6,
    STATUS:7,CREATED_AT:8,COMPLETED_AT:9,
    SCORES_JSON:10,REMARKS:11
  },
  Interview_Questions: {
    DESIG:1,ROUND:2,Q_ID:3,QUESTION:4,TYPE:5,MAX_SCORE:6,OPTIONS:7
  },
  HR_Status: { APP_NO:1,HR:2,ASSIGNED:3,UPDATED_AT:4 },
  Selection_Offer: {
    APP_NO:1, NAME:2, DESIG:3, NOTICE_PD:4, EST_DOJ:5,
    CALL1_DATE:6, CALL2_DATE:7, CONFIRM_DATE:8,
    STATUS:10, CREATED_AT:11, UPDATED_AT:12, ACTUAL_DOJ:13
  },
  Selected_Candidates: {
    APP_NO:1,NAME:2,PHONE:3,DESIG:4,SOURCE:5,
    HR_SCORE:6,ASSIGNED_SCORE:7,TOTAL_SCORE:8,
    DECISION_DATE:9,DECISION_BY:10,REMARKS:11
  },
  Rejected_Candidates: {
    APP_NO:1,NAME:2,PHONE:3,DESIG:4,SOURCE:5,
    STAGE:6,REJECTION_DATE:7,REJECTED_BY:8,REMARKS:9
  },
  Roles_Config: { ROLE:1,DESIG:2,ACTIVE:3 },
  Users: { USERNAME:1,PASSWORD:2,ROLE:3,ACTIVE:4,FULLNAME:5,CREATED_AT:6 }
};

/* ── Utilities ─────────────────────────────────────────────── */
function getSheet(name) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!sh) throw new Error('Sheet "'+name+'" not found');
  return sh;
}
function getRows(sheetName, colMap) {
  var data = getSheet(sheetName).getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(function(row) {
    var obj = {};
    Object.keys(colMap).forEach(function(k){ obj[k] = row[colMap[k]-1] !== undefined ? row[colMap[k]-1] : ''; });
    return obj;
  });
}
function appendRow(sheet, values) { getSheet(sheet).appendRow(values); }
function updateRow(sheet, matchCol, matchVal, updates) {
  var sh = getSheet(sheet), data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][matchCol-1]) === String(matchVal)) {
      Object.keys(updates).forEach(function(col){ sh.getRange(i+1,parseInt(col)).setValue(updates[col]); });
      return true;
    }
  }
  return false;
}
function jsonRes(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function getInitials(name) {
  return String(name||'').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
}
var AV_COLORS = ['navy','gold','green','red','purple','teal'];
function getAvatarColor(name) {
  var s=String(name||'');
  return AV_COLORS[((s.charCodeAt(0)||0)+(s.charCodeAt(1)||0))%AV_COLORS.length];
}
function formatDate(val) {
  if (!val) return '—';
  try { var d=new Date(val); return isNaN(d)?String(val):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
  catch(e){ return String(val); }
}
function calcDaysIn(val) {
  try { var d=new Date(val); return isNaN(d)?0:Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); }
  catch(e){ return 0; }
}
function safeJSON(str) { try{ return JSON.parse(str); }catch(e){ return null; } }
function generateToken() {
  return Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    new Date().toISOString() + Math.random().toString()
  )).replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
}

/* ── Entry Points ──────────────────────────────────────────── */
function doGet(e) {
  // Public interview form access via token
  if (e && e.parameter && e.parameter.action === 'getInterviewByToken') {
    return jsonRes(getInterviewByToken(e.parameter));
  }
  return jsonRes({status:'BSC CRM API v4 online'});
}
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action; delete body.action;
    return jsonRes(dispatch(action, body));
  } catch(err) { return jsonRes({error:err.message}); }
}
function dispatch(action, p) {
  var map = {
    verifyUser:verifyUser,
    getCandidates:getCandidates, addCandidate:addCandidate, getActivityFull:getActivityFull,
    updateCandidate:updateCandidate, checkDuplicate:checkDuplicate, getNextAppNo:getNextAppNo,
    getKPIs:getKPIs, getPendingActions:getPendingActions,
    getSourceBreakdown:getSourceBreakdown, getDesignations:getDesignations,
    // Step-by-step scheduling
    saveCallStep:saveCallStep, getCallStatus:getCallStatus,
    // Interview
    scheduleInterview:scheduleInterview, getInterviews:getInterviews,
    getInterviewQuestions:getInterviewQuestions,
    saveScore:saveScore, getScores:getScores,
    generateInterviewToken:generateInterviewToken,
    getInterviewByToken:getInterviewByToken,
    submitInterviewScore:submitInterviewScore,
    // Offer
    getOffers:getOffers, logOfferCall:logOfferCall,
    updateOfferDetails:updateOfferDetails, acceptOffer:acceptOffer,
    updateOfferStatus:updateOfferStatus,
    // Approve/Reject
    approveSelection:approveSelection, rejectCandidate:rejectCandidate,
    getSelectedCandidates:getSelectedCandidates,
    getRejectedCandidates:getRejectedCandidates,
    // Resume upload
    uploadResume:uploadResume,
    // Settings
    getUsers:getUsers, addUser:addUser, updateUser:updateUser,
    getPageSettings:getPageSettings, savePageSettings:savePageSettings
  };
  if (!map[action]) throw new Error('Unknown action: '+action);
  return map[action](p);
}

/* ── Auth ──────────────────────────────────────────────────── */
function verifyUser(p) {
  try {
    var rows = getRows('Users',COL.Users);
    var u = rows.find(function(r){
      return String(r.USERNAME).toLowerCase()===String(p.username).toLowerCase()
          && String(r.PASSWORD)===String(p.password)
          && String(r.ACTIVE).toUpperCase()==='TRUE';
    });
    if (!u) return {success:false};
    return {success:true, role:u.ROLE, displayName:String(u.FULLNAME||u.ROLE)};
  } catch(e) {
    // Demo fallback
    var demo=[
      {u:'hr@bsctextiles.com',p:'bsc@2026',role:'HR',n:'HR Admin'},
      {u:'manager@bsctextiles.com',p:'bsc@2026',role:'Manager',n:'Store Manager'},
      {u:'admin@bsctextiles.com',p:'bsc@2026',role:'Admin',n:'Admin'}
    ];
    var m=demo.find(function(d){return d.u.toLowerCase()===String(p.username).toLowerCase()&&d.p===String(p.password);});
    return m?{success:true,role:m.role,displayName:m.n}:{success:false};
  }
}

/* ── Candidates ────────────────────────────────────────────── */
function getCandidates(params) {
  var f=(params&&params.filters)||{};
  var rows=[];
  try{ rows=getRows('Candidates',COL.Candidates); }catch(e){ return {candidates:[],total:0}; }
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
      rawDate:  r.DATE ? new Date(r.DATE).getTime() : 0,
      status:   String(r.STATUS||'New'),
      daysIn:   calcDaysIn(r.DATE),
      salary:   String(r.SALARY||''),
      resumeUrl:String(r.RESUME_URL||''),
      q1:String(r.Q1||''),q2:String(r.Q2||''),q3:String(r.Q3||''),
      q4:String(r.Q4||''),q5:String(r.Q5||''),
      remarks:  String(r.REMARKS||''),
      rejReason:String(r.REMARKS||'')
    };
  });
  // Sort by date ascending (earliest first) by default
  list.sort(function(a,b){ return a.rawDate - b.rawDate; });
  if (f.status&&f.status!=='all') list=list.filter(function(c){return c.status.toLowerCase()===f.status.toLowerCase();});
  if (f.desig)  list=list.filter(function(c){return c.desig===f.desig;});
  if (f.source) list=list.filter(function(c){return c.source===f.source;});
  if (f.q) { var q=String(f.q).toLowerCase(); list=list.filter(function(c){return c.name.toLowerCase().includes(q)||c.appNo.toLowerCase().includes(q)||c.phone.includes(q);}); }
  var total=list.length, page=parseInt(f.page)||1, limit=parseInt(f.limit)||100;
  return {candidates:list.slice((page-1)*limit,page*limit), total:total, page:page};
}

function addCandidate(p) {
  var d=p.data||{}, now=new Date().toISOString(), appNo=generateAppNo();
  appendRow('Candidates',[
    appNo,d.name,d.phone,d.dob,d.desig,d.source,d.referrer,'New',
    new Date(),d.salary,d.resumeUrl||'',
    d.q1,d.q2,d.q3,d.q4,d.q5,d.remarks,
    0,now,now
  ]);
  return {success:true, appNo:appNo};
}

function updateCandidate(p) {
  var now=new Date().toISOString();
  var cm={
    status:COL.Candidates.STATUS, remarks:COL.Candidates.REMARKS,
    resumeUrl:COL.Candidates.RESUME_URL
  };
  var upd={};
  Object.keys(p.updates||{}).forEach(function(k){ if(cm[k]) upd[cm[k]]=p.updates[k]; });
  upd[COL.Candidates.UPDATED_AT]=now;
  var ok = updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,upd);
  // Auto-move to Selected/Rejected sheets
  if (p.updates&&p.updates.status==='Selected') autoMoveSelected(p.appNo, p.updates.remarks||'');
  if (p.updates&&p.updates.status==='Rejected') autoMoveRejected(p.appNo, p.updates.remarks||'');
  return {success:ok};
}

function checkDuplicate(p) {
  try {
    var rows=getRows('Candidates',COL.Candidates);
    var ph=String(p.phone||'').replace(/\D/g,'');
    var m=rows.find(function(r){return String(r.PHONE||'').replace(/\D/g,'')===ph;});
    return m?{exists:true,name:m.NAME,appNo:m.APP_NO,appliedOn:formatDate(m.DATE)}:{exists:false};
  }catch(e){return {exists:false};}
}
function getNextAppNo() { return {appNo:generateAppNo()}; }
function generateAppNo() {
  try{ var n=Math.max(getSheet('Candidates').getLastRow()-1,0); return 'BSC-'+new Date().getFullYear()+'-'+String(n+1).padStart(4,'0'); }
  catch(e){return 'BSC-'+new Date().getFullYear()+'-0001';}
}

/* ── Resume Upload to Google Drive ─────────────────────────── */
function uploadResume(p) {
  try {
    var folder = getOrCreateDriveFolder('BSC_Resumes');
    var blob = Utilities.newBlob(
      Utilities.base64Decode(p.base64Data),
      'application/pdf',
      p.fileName||('resume_'+p.appNo+'.pdf')
    );
    var existing = folder.getFilesByName(blob.getName());
    if (existing.hasNext()) existing.next().setTrashed(true); // replace old
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://drive.google.com/file/d/'+file.getId()+'/view';
    // Update candidate record
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{[COL.Candidates.RESUME_URL]:url,[COL.Candidates.UPDATED_AT]:new Date().toISOString()});
    return {success:true, fileUrl:url, fileId:file.getId()};
  }catch(e){ return {success:false, error:e.message}; }
}
function getOrCreateDriveFolder(name) {
  var folders=DriveApp.getFoldersByName(name);
  return folders.hasNext()?folders.next():DriveApp.createFolder(name);
}

/* ── Step-by-Step Scheduling ───────────────────────────────── */
function saveCallStep(p) {
  // p: {appNo, candidate, desig, step, date, remarks}
  // step: 1=first_call, 2=second_call, 3=interview_date
  try {
    var now=new Date().toISOString();
    var existing=getRows('Interview_Schedule',COL.Interview_Schedule)
      .find(function(r){return String(r.APP_NO)===String(p.appNo);});

    var statusMap={1:'1st Call Done',2:'2nd Call Done',3:'Interview Scheduled'};
    var newStatus=statusMap[p.step]||'Scheduled';

    if(existing) {
      var upd={[COL.Interview_Schedule.STEP]:p.step,[COL.Interview_Schedule.STATUS]:newStatus};
      if(p.step===1){upd[COL.Interview_Schedule.CALL1_DATE]=new Date(p.date);upd[COL.Interview_Schedule.CALL1_REMARKS]=p.remarks;}
      if(p.step===2){upd[COL.Interview_Schedule.CALL2_DATE]=new Date(p.date);upd[COL.Interview_Schedule.CALL2_REMARKS]=p.remarks;}
      if(p.step===3){upd[COL.Interview_Schedule.INTERVIEW_DATE]=new Date(p.date);upd[COL.Interview_Schedule.INTERVIEW_REMARKS]=p.remarks;}
      updateRow('Interview_Schedule',COL.Interview_Schedule.APP_NO,p.appNo,upd);
    } else {
      var row=[p.appNo,p.candidate,p.desig,'','','','','','',p.step,newStatus,now];
      if(p.step===1){row[3]=new Date(p.date);row[4]=p.remarks;}
      if(p.step===2){row[5]=new Date(p.date);row[6]=p.remarks;}
      if(p.step===3){row[7]=new Date(p.date);row[8]=p.remarks;}
      appendRow('Interview_Schedule',row);
    }
    // Update candidate status
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{
      [COL.Candidates.STATUS]:newStatus,[COL.Candidates.UPDATED_AT]:now
    });
    return {success:true, newStatus:newStatus};
  }catch(e){return {success:false,error:e.message};}
}

function getCallStatus(p) {
  try {
    var rows=getRows('Interview_Schedule',COL.Interview_Schedule);
    var r=rows.find(function(x){return String(x.APP_NO)===String(p.appNo);});
    if(!r) return {step:0,status:'Not Started',call1Date:'',call1Remarks:'',call2Date:'',call2Remarks:'',interviewDate:'',interviewRemarks:''};
    return {
      step:parseInt(r.STEP)||0, status:String(r.STATUS||''),
      call1Date:formatDate(r.CALL1_DATE), call1Remarks:String(r.CALL1_REMARKS||''),
      call2Date:formatDate(r.CALL2_DATE), call2Remarks:String(r.CALL2_REMARKS||''),
      interviewDate:formatDate(r.INTERVIEW_DATE), interviewRemarks:String(r.INTERVIEW_REMARKS||'')
    };
  }catch(e){return {step:0,status:'Not Started'};}
}

/* ── Old scheduleInterview kept for compatibility ──────────── */
function scheduleInterview(p) { return saveCallStep(Object.assign({},p,{step:3})); }

/* ── Dashboard KPIs ────────────────────────────────────────── */
function getKPIs() {
  var total=0,shortlisted=0,selected=0,joined=0,offerAccepted=0,newCandidates=0,avgDays=0,rejected=0,hold=0;
  try{
    var rows=getRows('Candidates',COL.Candidates);
    total=rows.length;
    shortlisted=rows.filter(function(r){
      return ['Shortlisted','1st Call Done','2nd Call Done','Interview Scheduled','Interviewed'].includes(r.STATUS);
    }).length;
    selected=rows.filter(function(r){return r.STATUS==='Selected';}).length;
    joined=rows.filter(function(r){return r.STATUS==='Joined';}).length;
    offerAccepted=rows.filter(function(r){return r.STATUS==='Offer Accepted';}).length;
    newCandidates=rows.filter(function(r){return r.STATUS==='New';}).length;
    rejected=rows.filter(function(r){return r.STATUS==='Rejected';}).length;
    hold=rows.filter(function(r){return r.STATUS==='Hold';}).length;
    var doneRows=rows.filter(function(r){return r.STATUS==='Joined'&&r.DATE;});
    if(doneRows.length) avgDays=Math.round(doneRows.reduce(function(s,r){return s+calcDaysIn(r.DATE);},0)/doneRows.length);
  }catch(e){}
  var acceptanceRate=0,pendingOffers=0;
  try{
    var or=getRows('Selection_Offer',COL.Selection_Offer);
    var acc=or.filter(function(r){return r.STATUS==='Accepted';}).length;
    acceptanceRate=or.length?Math.round(acc/or.length*100):0;
    pendingOffers=or.filter(function(r){return r.STATUS==='Pending Accept';}).length;
  }catch(e){}
  var interviewsToday=0;
  try{
    var sc=getRows('Interview_Schedule',COL.Interview_Schedule);
    var ts=new Date().toDateString();
    interviewsToday=sc.filter(function(r){return r.INTERVIEW_DATE&&new Date(r.INTERVIEW_DATE).toDateString()===ts;}).length;
  }catch(e){}
  return {total:total,shortlisted:shortlisted,selected:selected,joined:joined,
    offerAccepted:offerAccepted,rejected:rejected,hold:hold,
    acceptanceRate:acceptanceRate,avgDays:avgDays,onboarding:offerAccepted,
    interviewsToday:interviewsToday,newCandidates:newCandidates,pendingOffers:pendingOffers};
}

function getPendingActions() {
  var items=[];
  try{
    var rows=getRows('Candidates',COL.Candidates);
    var nc=rows.filter(function(r){return r.STATUS==='New';}).length;
    if(nc>0) items.push({text:nc+' new candidate'+(nc>1?'s':'')+' awaiting review',priority:'info'});
    rows.filter(function(r){return r.STATUS==='Hold'&&calcDaysIn(r.DATE)>7;}).slice(0,3).forEach(function(r){
      items.push({text:String(r.NAME)+' on hold '+calcDaysIn(r.DATE)+' days',priority:'warn'});
    });
  }catch(e){}
  try{
    getRows('Selection_Offer',COL.Selection_Offer).filter(function(r){return r.STATUS==='Pending Accept';}).slice(0,3).forEach(function(r){
      items.push({text:String(r.NAME)+' — offer pending',priority:'urgent'});
    });
  }catch(e){}
  return {items:items.slice(0,8)};
}
function getSourceBreakdown() {
  try{
    var rows=getRows('Candidates',COL.Candidates);
    return {walkin:rows.filter(function(r){return r.SOURCE==='Walk-in';}).length,
      empref:rows.filter(function(r){return r.SOURCE==='Employee Ref';}).length,
      online:rows.filter(function(r){return r.SOURCE==='Online Apply';}).length,
      other:rows.filter(function(r){return r.SOURCE&&!['Walk-in','Employee Ref','Online Apply'].includes(r.SOURCE);}).length};
  }catch(e){return {walkin:0,empref:0,online:0,other:0};}
}
function getDesignations() {
  try{
    var rows=getRows('Roles_Config',COL.Roles_Config);
    return {designations:rows.filter(function(r){return String(r.ACTIVE).toUpperCase()==='TRUE';})
      .map(function(r){return String(r.DESIG||'').trim();}).filter(Boolean)};
  }catch(e){return {designations:['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']};}
}

/* ── Interview (No FM — uses token for 2nd round) ─────────── */
function getInterviews() {
  var schedRows=[];
  try{schedRows=getRows('Interview_Schedule',COL.Interview_Schedule);}catch(e){return{interviews:[]};}
  var scoreMap={};
  try{
    getRows('HR_Status',{APP_NO:1,HR:2,ASSIGNED:3}).forEach(function(r){
      scoreMap[String(r.APP_NO)]={hrScore:r.HR?safeJSON(r.HR):null,assignedScore:r.ASSIGNED?safeJSON(r.ASSIGNED):null};
    });
  }catch(e){}
  var candMap={};
  try{
    getRows('Candidates',COL.Candidates).forEach(function(r){
      candMap[String(r.APP_NO)]={name:String(r.NAME||''),desig:String(r.DESIG||'')};
    });
  }catch(e){}
  var tokenMap={};
  try{
    getRows('Interview_Tokens',COL.Interview_Tokens).forEach(function(r){
      tokenMap[String(r.APP_NO)]={assignedName:String(r.ASSIGNED_NAME||''),assignedDesig:String(r.ASSIGNED_DESIG||''),tokenStatus:String(r.STATUS||'')};
    });
  }catch(e){}
  return {interviews:schedRows
    .filter(function(r){return parseInt(r.STEP)>=3||String(r.STATUS)==='Interview Scheduled';})
    .map(function(r){
      var appNo=String(r.APP_NO||''),c=candMap[appNo]||{},sc=scoreMap[appNo]||{},tk=tokenMap[appNo]||{};
      return {
        appNo:appNo,candidate:String(r.CANDIDATE||c.name||''),
        initials:getInitials(String(r.CANDIDATE||c.name||'')),
        color:getAvatarColor(String(r.CANDIDATE||c.name||'')),
        desig:String(r.DESIG||c.desig||''),
        call1Date:formatDate(r.CALL1_DATE),call1Remarks:String(r.CALL1_REMARKS||''),
        call2Date:formatDate(r.CALL2_DATE),call2Remarks:String(r.CALL2_REMARKS||''),
        interviewDate:formatDate(r.INTERVIEW_DATE),interviewRemarks:String(r.INTERVIEW_REMARKS||''),
        status:String(r.STATUS||''),
        hrScore:sc.hrScore, assignedScore:sc.assignedScore,
        assignedName:tk.assignedName, assignedDesig:tk.assignedDesig, tokenStatus:tk.tokenStatus
      };
    })};
}

function getInterviewQuestions(p) {
  var round = p&&p.round ? p.round : 'HR';
  var desig  = p&&p.desig ? p.desig : '';
  // Accept multiple round name variants
  var roundVariants = [round];
  if(round==='Round 2') roundVariants = ['Round 2','FM','ASSIGNED'];
  if(round==='HR')      roundVariants = ['HR'];
  try{
    var rows = getRows('Interview_Questions',COL.Interview_Questions);
    var filtered = rows.filter(function(r){
      // Match round (accept variants + 'All')
      var rm = !r.ROUND || r.ROUND==='All' || roundVariants.indexOf(r.ROUND)>=0;
      // Match designation: blank/All matches everyone; or exact match
      var dm = !r.DESIG || r.DESIG==='All' || !desig || r.DESIG===desig;
      return rm && dm;
    });
    // If designation-specific found, prefer those; else fall back to 'All'
    var specific = filtered.filter(function(r){ return r.DESIG===desig; });
    if(specific.length) filtered = specific;
    return {questions:filtered.map(function(r){
      return {id:String(r.Q_ID),text:String(r.QUESTION),type:String(r.TYPE||'score'),
        max:parseInt(r.MAX_SCORE)||10,
        options:r.OPTIONS?String(r.OPTIONS).split(',').map(function(o){return o.trim();}):[],
        round:String(r.ROUND||'HR')};
    })};
  }catch(e){ return {questions:[]}; }
}

/* ── HR Score — mandatory remarks ──────────────────────────── */
function saveScore(p) {
  if (!p.scores||!p.scores.remarks) return {success:false,error:'Remarks are mandatory — please add remarks before saving'};
  try{
    var now=new Date().toISOString(), scoreStr=JSON.stringify(p.scores);
    var updated=updateRow('HR_Status',COL.HR_Status.APP_NO,p.appNo,{[COL.HR_Status.HR]:scoreStr,[COL.HR_Status.UPDATED_AT]:now});
    if(!updated) appendRow('HR_Status',[p.appNo,scoreStr,'',now]);
    return {success:true};
  }catch(e){return {success:false,error:e.message};}
}
function getScores(p) {
  try{
    var row=getRows('HR_Status',{APP_NO:1,HR:2,ASSIGNED:3}).find(function(r){return String(r.APP_NO)===String(p.appNo);});
    if(!row)return{rounds:{HR:null,ASSIGNED:null}};
    return{rounds:{HR:row.HR?safeJSON(row.HR):null,ASSIGNED:row.ASSIGNED?safeJSON(row.ASSIGNED):null}};
  }catch(e){return{rounds:{HR:null,ASSIGNED:null}};}
}

/* ── Interview Token (replaces FM login) ───────────────────── */
function generateInterviewToken(p) {
  // p: {appNo, candidate, desig, assignedName, assignedDesig}
  try{
    var token=generateToken(), now=new Date().toISOString();
    // Remove old token for this candidate if exists
    try{
      var sh=getSheet('Interview_Tokens'), data=sh.getDataRange().getValues();
      for(var i=1;i<data.length;i++){
        if(String(data[i][1])===String(p.appNo)&&String(data[i][6])==='pending'){
          sh.getRange(i+1,7).setValue('replaced');
        }
      }
    }catch(e2){}
    appendRow('Interview_Tokens',[token,p.appNo,p.candidate,p.desig,p.assignedName,p.assignedDesig,'pending',now,'','','']);
    var baseUrl='https://bsctextilescandb-ui.github.io/BSC-Candidate-Followup/interview-form.html';
    return {success:true, token:token, link:baseUrl+'?token='+token};
  }catch(e){return{success:false,error:e.message};}
}

function getInterviewByToken(p) {
  try{
    var rows=getRows('Interview_Tokens',COL.Interview_Tokens);
    var r=rows.find(function(x){return String(x.TOKEN)===String(p.token);});
    if(!r) return{success:false,error:'Invalid or expired link'};
    if(String(r.STATUS)==='completed') return{success:false,error:'This interview has already been submitted'};
    // Try Round 2 → FM (old name) → ASSIGNED in order, always pass designation
    var qData=getInterviewQuestions({round:'Round 2',desig:String(r.DESIG||'')});
    if(!qData.questions.length) qData=getInterviewQuestions({round:'FM',desig:String(r.DESIG||'')});
    if(!qData.questions.length) qData=getInterviewQuestions({round:'ASSIGNED',desig:String(r.DESIG||'')});
    if(!qData.questions.length) qData=getInterviewQuestions({round:'Round 2'}); // fallback without desig
    var hrScores=null;
    try{
      var hrRow=getRows('HR_Status',{APP_NO:1,HR:2}).find(function(x){return String(x.APP_NO)===String(r.APP_NO);});
      if(hrRow&&hrRow.HR) hrScores=safeJSON(hrRow.HR);
    }catch(e2){}
    var candidateQs=null;
    try{
      var cRow=getRows('Candidates',COL.Candidates).find(function(x){return String(x.APP_NO)===String(r.APP_NO);});
      if(cRow) candidateQs={q1:cRow.Q1,q2:cRow.Q2,q3:cRow.Q3,q4:cRow.Q4,q5:cRow.Q5,remarks:cRow.REMARKS};
    }catch(e2){}
    // Also fetch HR questions so Round 2 form can show Round 1 Q&A
    var hrQData = getInterviewQuestions({round:'HR', desig:String(r.DESIG||'')});
    return {
      success:true,
      token:r.TOKEN, appNo:r.APP_NO,
      candidate:String(r.CANDIDATE||''),
      desig:String(r.DESIG||''),
      assignedName:String(r.ASSIGNED_NAME||''),
      assignedDesig:String(r.ASSIGNED_DESIG||''),
      questions:qData.questions,
      hrQuestions:hrQData.questions,
      hrScores:hrScores,
      candidateInfo:candidateQs
    };
  }catch(e){return{success:false,error:e.message};}
}

function submitInterviewScore(p) {
  // p: {token, scores, total, remarks}
  if(!p.remarks) return{success:false,error:'Remarks are mandatory'};
  try{
    var now=new Date().toISOString(), scoreStr=JSON.stringify({scores:p.scores,total:p.total,remarks:p.remarks});
    var sh=getSheet('Interview_Tokens'), data=sh.getDataRange().getValues();
    var tokenRow=-1;
    for(var i=1;i<data.length;i++){
      if(String(data[i][0])===String(p.token)){tokenRow=i+1;break;}
    }
    if(tokenRow<0) return{success:false,error:'Token not found'};
    sh.getRange(tokenRow,COL.Interview_Tokens.STATUS).setValue('completed');
    sh.getRange(tokenRow,COL.Interview_Tokens.COMPLETED_AT).setValue(now);
    sh.getRange(tokenRow,COL.Interview_Tokens.SCORES_JSON).setValue(scoreStr);
    sh.getRange(tokenRow,COL.Interview_Tokens.REMARKS).setValue(p.remarks);
    // Save to HR_Status as ASSIGNED score
    var appNo=String(data[tokenRow-1][1]);
    var updated=updateRow('HR_Status',COL.HR_Status.APP_NO,appNo,{[COL.HR_Status.ASSIGNED]:scoreStr,[COL.HR_Status.UPDATED_AT]:now});
    if(!updated) appendRow('HR_Status',[appNo,'',scoreStr,now]);
    return {success:true};
  }catch(e){return{success:false,error:e.message};}
}

/* ── Approve / Reject with separate tabs ───────────────────── */
function approveSelection(p) {
  try{
    var now=new Date().toISOString();
    if(!p.remarks) return{success:false,error:'Remarks are mandatory'};
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{[COL.Candidates.STATUS]:'Selected',[COL.Candidates.UPDATED_AT]:now});
    autoMoveSelected(p.appNo, p.remarks);
    // Add to Selection_Offer
    var ex=getRows('Selection_Offer',COL.Selection_Offer).find(function(r){return String(r.APP_NO)===String(p.appNo);});
    if(!ex) appendRow('Selection_Offer',[p.appNo,p.candidate,p.desig,'','','','','','','Pending Accept',now,now]);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

function rejectCandidate(p) {
  if(!p.remarks) return{success:false,error:'Remarks are mandatory'};
  try{
    var now=new Date().toISOString();
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{
      [COL.Candidates.STATUS]:'Rejected',[COL.Candidates.REMARKS]:p.remarks,[COL.Candidates.UPDATED_AT]:now
    });
    autoMoveRejected(p.appNo, p.remarks);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

function autoMoveSelected(appNo, remarks) {
  try{
    var rows=getRows('Candidates',COL.Candidates);
    var c=rows.find(function(r){return String(r.APP_NO)===String(appNo);});
    if(!c)return;
    var hrRow=null;
    try{hrRow=getRows('HR_Status',{APP_NO:1,HR:2,ASSIGNED:3}).find(function(r){return String(r.APP_NO)===String(appNo);});}catch(e2){}
    var hrTotal=hrRow&&hrRow.HR?safeJSON(hrRow.HR):{};
    var asTotal=hrRow&&hrRow.ASSIGNED?safeJSON(hrRow.ASSIGNED):{};
    var hr=(hrTotal&&hrTotal.total)||0, as=(asTotal&&asTotal.total)||0;
    // Remove existing entry if any
    try{
      var sh=getSheet('Selected_Candidates'),data=sh.getDataRange().getValues();
      for(var i=1;i<data.length;i++){if(String(data[i][0])===String(appNo)){sh.deleteRow(i+1);break;}}
    }catch(e2){}
    appendRow('Selected_Candidates',[appNo,c.NAME,c.PHONE,c.DESIG,c.SOURCE,hr,as,hr+as,new Date(),'Manager',remarks]);
  }catch(e){Logger.log('autoMoveSelected: '+e.message);}
}

function autoMoveRejected(appNo, remarks) {
  try{
    var rows=getRows('Candidates',COL.Candidates);
    var c=rows.find(function(r){return String(r.APP_NO)===String(appNo);});
    if(!c)return;
    var stage='';
    try{
      var ivRow=getRows('HR_Status',{APP_NO:1,HR:2}).find(function(r){return String(r.APP_NO)===String(appNo);});
      stage=ivRow&&ivRow.HR?'Post Interview':'Pre Interview';
    }catch(e2){stage='Pre Interview';}
    try{
      var sh=getSheet('Rejected_Candidates'),data=sh.getDataRange().getValues();
      for(var i=1;i<data.length;i++){if(String(data[i][0])===String(appNo)){sh.deleteRow(i+1);break;}}
    }catch(e2){}
    appendRow('Rejected_Candidates',[appNo,c.NAME,c.PHONE,c.DESIG,c.SOURCE,stage,new Date(),'HR',remarks]);
  }catch(e){Logger.log('autoMoveRejected: '+e.message);}
}

function getSelectedCandidates() {
  try{
    var rows=getRows('Selected_Candidates',COL.Selected_Candidates);
    return {candidates:rows.map(function(r){
      return {appNo:String(r.APP_NO||''),name:String(r.NAME||''),phone:String(r.PHONE||''),
        desig:String(r.DESIG||''),source:String(r.SOURCE||''),
        hrScore:parseInt(r.HR_SCORE)||0,assignedScore:parseInt(r.ASSIGNED_SCORE)||0,
        totalScore:parseInt(r.TOTAL_SCORE)||0,decisionDate:formatDate(r.DECISION_DATE),
        remarks:String(r.REMARKS||'')};
    })};
  }catch(e){return{candidates:[]};}
}

function getRejectedCandidates() {
  try{
    var rows=getRows('Rejected_Candidates',COL.Rejected_Candidates);
    return {candidates:rows.map(function(r){
      return {appNo:String(r.APP_NO||''),name:String(r.NAME||''),phone:String(r.PHONE||''),
        desig:String(r.DESIG||''),source:String(r.SOURCE||''),stage:String(r.STAGE||''),
        rejectionDate:formatDate(r.REJECTION_DATE),remarks:String(r.REMARKS||'')};
    })};
  }catch(e){return{candidates:[]};}
}

/* ── Offer Process ─────────────────────────────────────────── */
function markJoined(p) {
  // p: {appNo, joiningDate}
  if(!p.joiningDate) return {success:false, error:'Joining date is required'};
  try {
    var now = new Date().toISOString();
    var doj = new Date(p.joiningDate);
    updateRow('Selection_Offer', COL.Selection_Offer.APP_NO, p.appNo, {
      [COL.Selection_Offer.STATUS]:     'Joined',
      [COL.Selection_Offer.ACTUAL_DOJ]: doj,
      [COL.Selection_Offer.UPDATED_AT]: now
    });
    updateRow('Candidates', COL.Candidates.APP_NO, p.appNo, {
      [COL.Candidates.STATUS]:     'Joined',
      [COL.Candidates.UPDATED_AT]: now
    });
    // Also update Selected_Candidates record
    try {
      updateRow('Selected_Candidates', COL.Selected_Candidates.APP_NO, p.appNo,
        {[COL.Selected_Candidates.DECISION_DATE]: doj});
    } catch(e2){}
    return {success:true};
  } catch(e) { return {success:false, error:e.message}; }
}


function getActivityFull(p) {
  var appNo = String(p.appNo);
  var activity = [];
  try {
    // ── Candidate basic + status history ──────────────────────
    var cRows = getRows('Candidates', COL.Candidates);
    var c = cRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(c) {
      var createdAt = c.CREATED_AT ? formatDate(c.CREATED_AT) : '';
      activity.push({type:'applied', icon:'📋', label:'Applied', date:createdAt, color:'navy'});
    }

    // ── Interview Schedule (calls + interview date) ────────────
    var schRows = getRows('Interview_Schedule', COL.Interview_Schedule);
    var sch = schRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(sch) {
      if(sch.CALL1_DATE) activity.push({type:'call1',icon:'📞',label:'1st Follow-up Call',
        date:formatDate(sch.CALL1_DATE),remarks:String(sch.CALL1_REMARKS||''),color:'gold'});
      if(sch.CALL2_DATE) activity.push({type:'call2',icon:'📞',label:'2nd Follow-up Call',
        date:formatDate(sch.CALL2_DATE),remarks:String(sch.CALL2_REMARKS||''),color:'gold'});
      if(sch.INTERVIEW_DATE) activity.push({type:'interview',icon:'📅',label:'Interview Scheduled',
        date:formatDate(sch.INTERVIEW_DATE),remarks:String(sch.INTERVIEW_REMARKS||''),color:'navy'});
    }

    // ── HR Round 1 scores ──────────────────────────────────────
    var hrRows = getRows('HR_Status', COL.HR_Status);
    var hr = hrRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(hr && hr.HR) {
      try {
        var hd = JSON.parse(hr.HR);
        activity.push({type:'hr_score',icon:'🎯',label:'HR Round 1 Assessment',
          score:hd.total||0,maxScore:60,remarks:String(hd.remarks||''),
          date:formatDate(hr.UPDATED_AT),color:'navy'});
      } catch(e2) {}
    }

    // ── Round 2 scores + who assessed ─────────────────────────
    var tokRows = getRows('Interview_Tokens', COL.Interview_Tokens);
    var tok = tokRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(tok) {
      var assignedBy = String(tok.ASSIGNED_NAME||'')+(tok.ASSIGNED_DESIG?' ('+tok.ASSIGNED_DESIG+')':'');
      if(hr && hr.ASSIGNED) {
        try {
          var r2 = JSON.parse(hr.ASSIGNED);
          activity.push({type:'r2_score',icon:'🤝',label:'Round 2 Assessment',
            score:r2.total||0,maxScore:60,remarks:String(r2.remarks||''),
            assignedBy:assignedBy,date:formatDate(tok.COMPLETED_AT),color:'teal'});
        } catch(e3) {
          activity.push({type:'r2_assigned',icon:'🔗',label:'Round 2 Assigned to '+assignedBy,
            date:formatDate(tok.CREATED_AT),color:'purple'});
        }
      } else {
        activity.push({type:'r2_assigned',icon:'🔗',label:'Round 2 Assigned to '+assignedBy,
          date:formatDate(tok.CREATED_AT),color:'purple'});
      }
    }

    // ── Manager selection decision ─────────────────────────────
    var selRows = getRows('Selected_Candidates', COL.Selected_Candidates);
    var sel = selRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(sel) {
      activity.push({type:'selected',icon:'✅',label:'Selected by Manager',
        date:formatDate(sel.DECISION_DATE),
        by:String(sel.DECISION_BY||''),
        remarks:String(sel.REMARKS||''),color:'green'});
    }

    // ── Offer process ──────────────────────────────────────────
    var ofRows = getRows('Selection_Offer', COL.Selection_Offer);
    var of = ofRows.find(function(r){ return String(r.APP_NO)===appNo; });
    if(of) {
      activity.push({type:'offer_start',icon:'📤',label:'Offer Process Started',
        date:formatDate(of.CREATED_AT),color:'gold'});
      if(of.CALL1_DATE) activity.push({type:'offer_c1',icon:'📞',label:'Offer Call 1',
        date:formatDate(of.CALL1_DATE),color:'gold'});
      if(of.CALL2_DATE) activity.push({type:'offer_c2',icon:'📞',label:'Offer Call 2',
        date:formatDate(of.CALL2_DATE),color:'gold'});
      if(of.CONFIRM_DATE) activity.push({type:'offer_conf',icon:'📞',label:'Offer Confirm Call',
        date:formatDate(of.CONFIRM_DATE),color:'gold'});
      if(of.NOTICE_PD||of.EST_DOJ) activity.push({type:'doj',icon:'📅',
        label:'Joining Details Updated',
        note:(of.NOTICE_PD?'Notice: '+of.NOTICE_PD:'')+(of.EST_DOJ?' | Est. DOJ: '+formatDate(of.EST_DOJ):''),
        color:'teal'});
      var st = String(of.STATUS||'');
      if(st==='Accepted'||st==='Offer Accepted') activity.push({type:'offer_acc',icon:'✅',
        label:'Offer Accepted',color:'green'});
      else if(st==='Declined') activity.push({type:'offer_dec',icon:'❌',
        label:'Offer Declined',color:'red'});
      else if(st==='Offer Rejected') activity.push({type:'offer_rej',icon:'❌',
        label:'Offer Rejected',color:'red'});
      if(of.ACTUAL_DOJ) activity.push({type:'joined',icon:'🎉',
        label:'Employee Joined',date:formatDate(of.ACTUAL_DOJ),color:'green'});
    }

  } catch(e) { return {success:false, error:e.message}; }
  return {success:true, activity:activity};
}


function getOffers() {
  try{
    var rows=getRows('Selection_Offer',COL.Selection_Offer);
    return{offers:rows.map(function(r){
      return {
        appNo:String(r.APP_NO||''),name:String(r.NAME||''),
        initials:getInitials(String(r.NAME||'')),color:getAvatarColor(String(r.NAME||'')),
        desig:String(r.DESIG||''),noticePd:String(r.NOTICE_PD||''),
        estDoj:r.EST_DOJ?new Date(r.EST_DOJ).toISOString().slice(0,10):'',
        actualDoj:r.ACTUAL_DOJ?new Date(r.ACTUAL_DOJ).toISOString().slice(0,10):'',
        call1:formatDate(r.CALL1_DATE),call1Remarks:'',
        call2:formatDate(r.CALL2_DATE),call2Remarks:'',
        confirm:formatDate(r.CONFIRM_DATE),confirmRemarks:'',
        status:String(r.STATUS||'')
      };
    }),total:rows.length};
  }catch(e){return{offers:[],total:0};}
}

function logOfferCall(p) {
  try{
    var upd={};
    if(p.callNo===1) upd[COL.Selection_Offer.CALL1_DATE]  = p.date?new Date(p.date):new Date();
    if(p.callNo===2) upd[COL.Selection_Offer.CALL2_DATE]  = p.date?new Date(p.date):new Date();
    if(p.callNo===3) upd[COL.Selection_Offer.CONFIRM_DATE]= p.date?new Date(p.date):new Date();
    upd[COL.Selection_Offer.UPDATED_AT]=new Date().toISOString();
    updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,upd);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

function updateOfferDetails(p) {
  if(!p.noticePd&&!p.estDoj) return{success:false,error:'Enter at least one field'};
  try{
    var upd={};
    if(p.noticePd) upd[COL.Selection_Offer.NOTICE_PD]=p.noticePd;
    if(p.estDoj)   upd[COL.Selection_Offer.EST_DOJ]=new Date(p.estDoj);
    upd[COL.Selection_Offer.UPDATED_AT]=new Date().toISOString();
    updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,upd);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

function rejectOffer(p) {
  if(!p.remarks) return{success:false,error:'Remarks are mandatory'};
  try{
    var now=new Date().toISOString();
    updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,{
      [COL.Selection_Offer.STATUS]:'Offer Rejected',
      [COL.Selection_Offer.UPDATED_AT]:now
    });
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{
      [COL.Candidates.STATUS]:'Offer Rejected',
      [COL.Candidates.UPDATED_AT]:now
    });
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}


function acceptOffer(p) {
  if(!p.remarks) return{success:false,error:'Remarks are mandatory'};
  try{
    var now=new Date().toISOString();
    updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,{[COL.Selection_Offer.STATUS]:'Accepted',[COL.Selection_Offer.UPDATED_AT]:now});
    updateRow('Candidates',COL.Candidates.APP_NO,p.appNo,{[COL.Candidates.STATUS]:'Offer Accepted',[COL.Candidates.UPDATED_AT]:now});
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

function updateOfferStatus(p) {
  updateRow('Selection_Offer',COL.Selection_Offer.APP_NO,p.appNo,{[COL.Selection_Offer.STATUS]:p.status,[COL.Selection_Offer.UPDATED_AT]:new Date().toISOString()});
  return{success:true};
}

/* ── Settings / Users ──────────────────────────────────────── */
function getUsers() {
  try{
    var rows=getRows('Users',COL.Users);
    return{users:rows.map(function(r){return{username:String(r.USERNAME||''),role:String(r.ROLE||''),active:String(r.ACTIVE).toUpperCase()==='TRUE',fullName:String(r.FULLNAME||'')};})};
  }catch(e){return{users:[]};}
}
function addUser(p) {
  try{
    appendRow('Users',[p.username,p.password,p.role,'TRUE',p.fullName||p.role,new Date().toISOString()]);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}
function updateUser(p) {
  try{
    var upd={[COL.Users.ACTIVE]:p.active?'TRUE':'FALSE'};
    if(p.role)     upd[COL.Users.ROLE]=p.role;
    if(p.password) upd[COL.Users.PASSWORD]=p.password;
    updateRow('Users',COL.Users.USERNAME,p.username,upd);
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}
function getPageSettings() {
  try{
    var props=PropertiesService.getScriptProperties();
    var val=props.getProperty('PAGE_SETTINGS');
    return val?JSON.parse(val):{};
  }catch(e){return{};}
}
function savePageSettings(p) {
  try{
    PropertiesService.getScriptProperties().setProperty('PAGE_SETTINGS',JSON.stringify(p.settings));
    return{success:true};
  }catch(e){return{success:false,error:e.message};}
}

/* ── Setup ─────────────────────────────────────────────────── */
function setupSheets() {
  var ss=SpreadsheetApp.openById(SHEET_ID);
  var defs={
    Candidates:['App No','Name','Phone','DOB','Designation','Source','Referrer','Status','Date Applied','Salary','Resume URL','Q1','Q2','Q3','Q4','Q5','Remarks','Days In','Created At','Updated At'],
    Interview_Schedule:['App No','Candidate','Designation','Call1 Date','Call1 Remarks','Call2 Date','Call2 Remarks','Interview Date','Interview Remarks','Step','Status','Created At'],
    Interview_Tokens:['Token','App No','Candidate','Designation','Assigned Name','Assigned Designation','Status','Created At','Completed At','Scores JSON','Remarks'],
    Interview_Questions:['Designation','Round','Question ID','Question','Type','Max Score','Options'],
    HR_Status:['App No','HR Score JSON','Assigned Score JSON','Updated At'],
    Selection_Offer:['App No','Name','Designation','Notice Period','Est DOJ','Call1 Date','Call1 Remarks','Call2 Date','Call2 Remarks','Confirm Date','Confirm Remarks','Status','Created At','Updated At','Actual DOJ'],
    Selected_Candidates:['App No','Name','Phone','Designation','Source','HR Score','Assigned Score','Total Score','Decision Date','Decision By','Remarks'],
    Rejected_Candidates:['App No','Name','Phone','Designation','Source','Stage','Rejection Date','Rejected By','Remarks'],
    Roles_Config:['Role','Designation','Active'],
    Users:['Username','Password','Role','Active','Full Name','Created At']
  };
  Object.keys(defs).forEach(function(name){
    var sh=ss.getSheetByName(name)||ss.insertSheet(name);
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,defs[name].length).setValues([defs[name]])
        .setFontWeight('bold').setBackground('#1E2D4E').setFontColor('#fff');
    }
  });
  // Seed Users (no FM role)
  var us=ss.getSheetByName('Users');
  if(us.getLastRow()<=1){
    [['hr@bsctextiles.com','bsc@2026','HR','TRUE','HR Admin'],
     ['manager@bsctextiles.com','bsc@2026','Manager','TRUE','Store Manager'],
     ['admin@bsctextiles.com','bsc@2026','Admin','TRUE','Admin']]
    .forEach(function(r){us.appendRow(r.concat([new Date()]));});
  }
  // Seed Roles_Config
  var rc=ss.getSheetByName('Roles_Config');
  if(rc.getLastRow()<=1){
    ['Sales Executive','Floor Manager','Cashier','Billing Executive','Store Keeper']
      .forEach(function(d){rc.appendRow(['All',d,'TRUE']);});
  }
  // Seed Interview Questions (HR + ASSIGNED rounds)
  var iq=ss.getSheetByName('Interview_Questions');
  if(iq.getLastRow()<=1){
    [['All','HR','1','Communication & confidence','score',15,''],
     ['All','HR','2','Previous work experience','score',15,''],
     ['All','HR','3','Textile/retail knowledge','score',15,''],
     ['All','HR','4','Expected salary reasonable?','score',10,''],
     ['All','HR','5','Can join immediately?','select',0,'Yes immediately,After 1 week,After 15 days,After 1 month'],
     ['All','Round 2','1','Job knowledge & product skills','score',20,''],
     ['All','Round 2','2','Problem solving & decision making','score',15,''],
     ['All','Round 2','3','Team fit & attitude','score',15,''],
     ['All','Round 2','4','Customer handling ability','score',10,''],
     ['All','Round 2','5','Overall recommendation','score',10,'']
    ].forEach(function(q){iq.appendRow(q);});
  }
  Logger.log('BSC CRM v4 setup complete!');
}
