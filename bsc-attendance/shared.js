// ============================================================
// SHARED — included by every page (login, marking, dashboard, admin)
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzcaGs8hGfvhsydKcdcjdObMqa4VE52LenPxCEMwOH-Lpl6ijLjxxtYh4EiJIc-pkSc/exec';
const LOGO_BSC = 'https://bsctextilescandb-ui.github.io/retail-crm/logo.jpg';
const LOGO_CNB = 'https://bsctextilescandb-ui.github.io/retail-crm/cnb-logo.png';

// ---- Universal button loading/disable helper ----
// Usage: onclick="withBtn(this, doLogin)"  or  onclick="withBtn(this, () => toggleFloor('FL1', true))"
async function withBtn(btn, fn) {
  if (btn.disabled) return; // already running — ignore extra clicks
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Working...';
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

// ---- JSONP helper (GET-only, avoids CORS from GitHub Pages) ----
let jsonpCounter = 0;
function jsonpCall(params, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + (jsonpCounter++) + '_' + Date.now();
    const timer = setTimeout(() => {
      delete window[cbName];
      script.remove();
      reject(new Error('No response after 15s — check the Apps Script deployment access is "Anyone", and that API_URL in shared.js is correct.'));
    }, timeoutMs);
    window[cbName] = (data) => { clearTimeout(timer); resolve(data); delete window[cbName]; script.remove(); };
    const qs = new URLSearchParams({ ...params, callback: cbName }).toString();
    const script = document.createElement('script');
    script.src = API_URL + '?' + qs;
    script.onerror = () => { clearTimeout(timer); reject(new Error('Network error calling backend.')); };
    document.body.appendChild(script);
  });
}

// ---- Session (survives navigation between pages, since each .html is a fresh page load) ----
function saveSession(session) { localStorage.setItem('bsc_att_session', JSON.stringify(session)); }
function getSession() { try { return JSON.parse(localStorage.getItem('bsc_att_session')); } catch (e) { return null; } }
function clearSession() { localStorage.removeItem('bsc_att_session'); localStorage.removeItem('bsc_att_unit'); }

// Once a FloorManager picks a section from the dropdown, we remember that
// choice separately from the login session (it's a per-visit pick, not identity).
function saveSelectedUnit(unitType, unitId, unitLabel) {
  localStorage.setItem('bsc_att_unit', JSON.stringify({ unitType, unitId, unitLabel }));
}
function getSelectedUnit() { try { return JSON.parse(localStorage.getItem('bsc_att_unit')); } catch (e) { return null; } }
function clearSelectedUnit() { localStorage.removeItem('bsc_att_unit'); }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function logout() { clearSession(); window.location.href = 'login.html'; }

// Redirect to login if there's no session, or if the session's role isn't allowed on this page.
function requireLogin(allowedRoles) {
  const s = getSession();
  if (!s) { window.location.href = 'login.html'; return null; }
  if (allowedRoles && allowedRoles.indexOf(s.role) === -1) { window.location.href = 'login.html'; return null; }
  return s;
}

function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function roleLabel(s) {
  if (s.role === 'FloorManager') return 'Floor Manager';
  if (s.role === 'SectionIncharge') return 'Section Incharge';
  if (s.role === 'DeptIncharge') return 'Dept Incharge';
  if (s.role === 'Admin') return 'Admin (HR)';
  return s.role;
}

function scopeLine(s) {
  if (s.role === 'FloorManager') return s.floorName;
  if (s.role === 'SectionIncharge') return s.sectionName + ' · ' + s.floorName;
  if (s.role === 'DeptIncharge') return s.departmentName;
  return '';
}

function navItemsForRole(role) {
  const items = [];
  if (role === 'Admin') {
    items.push({ group: 'MAIN', key: 'dashboard', icon: '\u25a4', label: 'Dashboard', href: 'dashboard.html' });
    items.push({ group: 'MAIN', key: 'marking', icon: '\u2611', label: 'Daily Marking', href: 'marking.html' });
    items.push({ group: 'ADMIN', key: 'admin', icon: '\u2699', label: 'Admin Control', href: 'admin.html' });
  } else {
    items.push({ group: 'MAIN', key: 'marking', icon: '\u2611', label: 'Daily Marking', href: 'marking.html' });
  }
  return items;
}

function pageTitleForKey(key) {
  if (key === 'marking') return 'Daily Marking';
  if (key === 'dashboard') return 'HR Dashboard';
  if (key === 'admin') return 'Admin Control';
  return 'BSC Attendance';
}

// Renders the full sidebar + topbar shell. Call once per page with the active nav key
// ('marking' | 'dashboard' | 'admin'). Expects #sidebar, #topbarTitle, #topbarBreadcrumb,
// #topbarClock elements already in the page HTML.
function renderShell(activeKey) {
  const s = getSession();
  if (!s) return;

  const items = navItemsForRole(s.role);
  const groups = [...new Set(items.map(i => i.group))];
  const navHtml = groups.map(g => `
    <div class="sb-section">${g}</div>
    ${items.filter(i => i.group === g).map(i => `
      <a class="nav-item ${i.key === activeKey ? 'active' : ''}" href="${i.href}">
        <span class="nav-icon">${i.icon}</span>${i.label}
      </a>
    `).join('')}
  `).join('');

  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) {
    sidebarEl.innerHTML = `
      <div class="sb-logo-box"><img src="${LOGO_BSC}" alt="BSC"></div>
      <div class="sb-user">
        <div class="sb-avatar">${initials(s.name)}</div>
        <div>
          <div class="sb-user-name">${s.name}</div>
          <div class="sb-user-role">${roleLabel(s)}</div>
        </div>
      </div>
      ${navHtml}
      <div class="sb-bottom">
        <button class="logout-btn" onclick="logout()">&#8618; Logout</button>
        <div class="sb-cnb-box"><img src="${LOGO_CNB}" alt="C&amp;B"></div>
      </div>
    `;
  }

  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = pageTitleForKey(activeKey);
  const bcEl = document.getElementById('topbarBreadcrumb');
  if (bcEl) bcEl.textContent = roleLabel(s) + (scopeLine(s) ? ' · ' + scopeLine(s) : '');
  const clockEl = document.getElementById('topbarClock');
  if (clockEl) {
    const tick = () => { clockEl.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); };
    tick();
    setInterval(tick, 30000);
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mob-open');
  document.getElementById('sbOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mob-open');
  document.getElementById('sbOverlay').classList.remove('show');
}

// ============================================================
// PNG REPORT BUILDER — shared by dashboard.html (full store) and
// marking.html (single section/department). Renders a hidden,
// inline-styled block and rasterizes it with html2canvas so both
// downloads look identical regardless of the page's own CSS.
// ============================================================

const STATUS_ICON_FALLBACK = '\u25CF'; // solid dot, used if a status has no icon set
const PRESENT_ICON = '\u2705';

function statusIcon(st) { return (st && st.Icon) ? st.Icon : STATUS_ICON_FALLBACK; }

function reportCountBoxHTML(icon, n, label, color) {
  return `
    <div style="flex:1;min-width:90px;background:#F9F7F4;border-left:4px solid ${color};border-radius:10px;text-align:center;padding:14px 6px;">
      <div style="font-size:18px;">${icon}</div>
      <div style="font-size:24px;font-weight:800;color:#1E2D4E;margin-top:2px;">${n}</div>
      <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-top:2px;">${label}</div>
    </div>
  `;
}

function reportHeaderHTML(title, scopeLabel, dateStr) {
  return `
    <div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #EDE8DE;padding-bottom:14px;margin-bottom:16px;">
      <img src="${LOGO_BSC}" style="height:44px;border-radius:4px;">
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:800;color:#1E2D4E;">${title}</div>
        <div style="font-size:11px;color:#888;margin-top:2px;">${scopeLabel} · ${dateStr}</div>
      </div>
      <img src="${LOGO_CNB}" style="height:28px;">
    </div>
  `;
}

function reportFooterHTML() {
  return `
    <div style="margin-top:18px;padding-top:10px;border-top:1px solid #EDE8DE;font-size:9.5px;color:#aaa;text-align:center;">
      Generated ${new Date().toLocaleString('en-IN')} · BSC Textiles Daily Attendance
    </div>
  `;
}

function reportGroupRowHTML(icon, label, present, total, statusTypes, statusCounts, submittedLine) {
  const chips = statusTypes.map(st => `
    <span style="font-size:10px;background:#F9F7F4;border-radius:12px;padding:3px 9px;margin-right:5px;color:#555;">
      ${statusIcon(st)} ${statusCounts[st.StatusName] || 0} ${st.StatusName}
    </span>
  `).join('');
  return `
    <div style="padding:10px 0;border-bottom:1px solid #f0ede8;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;">
        <span>${icon} <strong style="color:#1E2D4E;">${label}</strong></span>
        <span style="color:#2d8a4e;font-weight:700;">${present} / ${total} Present</span>
      </div>
      <div style="margin-top:5px;">${chips}</div>
      ${submittedLine ? `<div style="font-size:9.5px;color:#aaa;margin-top:4px;">${submittedLine}</div>` : ''}
    </div>
  `;
}

// Builds the full whole-store report (Dashboard / Admin use)
function buildFullStoreReportHTML(data) {
  const cum = data.cumulative;
  let boxes = reportCountBoxHTML(PRESENT_ICON, cum.totalPresent, 'Present', '#2d8a4e');
  data.statusTypes.forEach(st => {
    boxes += reportCountBoxHTML(statusIcon(st), cum.statusCounts[st.StatusName] || 0, st.StatusName, '#C9952A');
  });

  const mgr = data.managerUnit;
  const mgrHtml = reportGroupRowHTML('\u{1F3E2}', mgr.label, mgr.totalPresent ?? 0, mgr.totalAssigned ?? 0, data.statusTypes, mgr.statusCounts,
    mgr.submitted ? `Submitted by ${mgr.submittedByName} at ${mgr.submittedAt}` : 'Not yet submitted');

  const sectionRows = data.sectionUnits.map(u => reportGroupRowHTML('\u{1F3EC}', u.label, u.totalPresent ?? 0, u.totalAssigned ?? 0, data.statusTypes, u.statusCounts,
    u.submitted ? `Submitted by ${u.submittedByName} at ${u.submittedAt}` : 'Not yet submitted')).join('');

  const deptRows = data.deptUnits.map(u => reportGroupRowHTML('\u{1F5C2}\uFE0F', u.label, u.totalPresent ?? 0, u.totalAssigned ?? 0, data.statusTypes, u.statusCounts,
    u.submitted ? `Submitted by ${u.submittedByName} at ${u.submittedAt}` : 'Not yet submitted')).join('');

  return `
    <div style="width:820px;background:#fff;padding:24px;font-family:'Segoe UI',system-ui,sans-serif;">
      ${reportHeaderHTML('BSC Textiles — Daily Attendance Report', 'Whole Store', data.date)}
      <div style="font-size:10px;color:#aaa;margin-bottom:8px;">${cum.unitsSubmitted} of ${cum.unitsTotal} groups submitted · ${cum.totalAssigned} total assigned · Grooming checked ${cum.groomingChecked} (non-compliant ${cum.groomingNonCompliant})</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">${boxes}</div>
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Managers</div>
      ${mgrHtml}
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin:16px 0 8px;">Sales — By Section</div>
      ${sectionRows}
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin:16px 0 8px;">Non-Sales — By Department</div>
      ${deptRows}
      ${reportFooterHTML()}
    </div>
  `;
}

// Builds a single section/department's own report (marker's submitted view)
function buildSingleGroupReportHTML(scopeLabel, dateStr, status, statusTypes) {
  const statusCounts = {};
  statusTypes.forEach(st => { statusCounts[st.StatusName] = 0; });
  (status.exceptions || []).forEach(x => { statusCounts[x.StatusName] = (statusCounts[x.StatusName] || 0) + 1; });

  let boxes = reportCountBoxHTML(PRESENT_ICON, status.totalPresent, 'Present', '#2d8a4e');
  statusTypes.forEach(st => {
    boxes += reportCountBoxHTML(statusIcon(st), statusCounts[st.StatusName] || 0, st.StatusName, '#C9952A');
  });

  const excRows = (status.exceptions || []).map(x => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #f0ede8;">
      <span>${x.EmployeeName}</span>
      <span>${statusIcon(statusTypes.find(st => st.StatusName === x.StatusName))} ${x.StatusName} · ${x.Permission}</span>
    </div>
  `).join('') || '<div style="font-size:11px;color:#aaa;">None — everyone Present.</div>';

  const groomRows = (status.grooming || []).map(g => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #f0ede8;">
      <span>${g.EmployeeName}</span>
      <span>Grooming ${g.GroomingScore} · Uniform ${g.UniformOK} · ID ${g.IDCardOK}</span>
    </div>
  `).join('') || '<div style="font-size:11px;color:#aaa;">None — everyone default.</div>';

  return `
    <div style="width:560px;background:#fff;padding:24px;font-family:'Segoe UI',system-ui,sans-serif;">
      ${reportHeaderHTML('BSC Textiles — Daily Attendance Report', scopeLabel, dateStr)}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">${boxes}</div>
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Attendance Exceptions</div>
      ${excRows}
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin:16px 0 8px;">Grooming / Uniform / ID Overrides</div>
      ${groomRows}
      <div style="font-size:10px;color:#aaa;margin-top:12px;">Submitted by ${status.submittedByName} at ${status.submittedAt}</div>
      ${reportFooterHTML()}
    </div>
  `;
}

// ── Simple Table report (classic bordered Excel-style layout) ──────────────
const FLOOR_ORDER_ = ['Ground Floor', 'Ground', 'First Floor', 'First', 'Second Floor', 'Second', 'Third Floor', 'Third', 'Fourth Floor', 'Fourth'];

function simpleTableCell(text, opts = {}) {
  const bold = opts.bold ? 'font-weight:700;' : '';
  const bg = opts.bg || '#fff';
  const color = opts.color || '#222';
  const align = opts.align || 'left';
  return `<td style="border:1px solid #333;padding:6px 10px;background:${bg};color:${color};text-align:${align};font-size:12px;${bold}">${text}</td>`;
}

function simpleTableHeaderRow(cols) {
  return `<tr>${cols.map(c => simpleTableCell(c, { bold: true, bg: '#1E2D4E', color: '#fff', align: 'center' })).join('')}</tr>`;
}

// Table 1 — Sales, grouped by floor with a subtotal row per floor, then grand total
function buildSalesSimpleTable(sectionUnits, statusTypes) {
  const byFloor = {};
  sectionUnits.forEach(u => {
    const floor = u.floorName || 'Unknown';
    const section = u.label.replace(floor + ' — ', '');
    (byFloor[floor] = byFloor[floor] || []).push({ section, present: u.totalPresent ?? 0, total: u.totalAssigned ?? 0, counts: u.statusCounts });
  });
  const floorNames = Object.keys(byFloor).sort((a, b) => {
    const ia = FLOOR_ORDER_.indexOf(a), ib = FLOOR_ORDER_.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const statusCols = statusTypes.map(st => st.StatusName);
  let grand = { present: 0, total: 0, counts: {} };
  statusCols.forEach(c => grand.counts[c] = 0);

  let rowsHtml = '';
  floorNames.forEach(floor => {
    const rows = byFloor[floor];
    let sub = { present: 0, total: 0, counts: {} };
    statusCols.forEach(c => sub.counts[c] = 0);
    rowsHtml += `<tr>${simpleTableCell(floor.toUpperCase(), { bold: true, bg: '#29ABE2', color: '#fff' })}${simpleTableCell('', { bg: '#29ABE2' })}${statusCols.map(() => simpleTableCell('', { bg: '#29ABE2' })).join('')}${simpleTableCell('', { bg: '#29ABE2' })}${simpleTableCell('', { bg: '#29ABE2' })}</tr>`;
    rows.forEach(r => {
      sub.present += r.present; sub.total += r.total;
      statusCols.forEach(c => sub.counts[c] += (r.counts[c] || 0));
      rowsHtml += `<tr>${simpleTableCell('')}${simpleTableCell(r.section)}${simpleTableCell(r.present, { align: 'center' })}${statusCols.map(c => simpleTableCell(r.counts[c] || 0, { align: 'center' })).join('')}${simpleTableCell(r.total, { align: 'center', bold: true })}</tr>`;
    });
    rowsHtml += `<tr>${simpleTableCell('')}${simpleTableCell('TOTAL', { bold: true, bg: '#F7DFC7' })}${simpleTableCell(sub.present, { bold: true, bg: '#F7DFC7', align: 'center' })}${statusCols.map(c => simpleTableCell(sub.counts[c], { bold: true, bg: '#F7DFC7', align: 'center' })).join('')}${simpleTableCell(sub.total, { bold: true, bg: '#F7DFC7', align: 'center' })}</tr>`;
    grand.present += sub.present; grand.total += sub.total;
    statusCols.forEach(c => grand.counts[c] += sub.counts[c]);
  });

  const headerCols = ['FLOOR', 'SECTION', 'PRESENT', ...statusCols.map(s => s.toUpperCase()), 'TOTAL STRENGTH'];
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      ${simpleTableHeaderRow(headerCols)}
      ${rowsHtml}
      <tr>${simpleTableCell('GRAND TOTAL OF STAFF', { bold: true, bg: '#29ABE2', color: '#fff' })}${simpleTableCell('', { bg: '#29ABE2' })}${simpleTableCell(grand.present, { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })}${statusCols.map(c => simpleTableCell(grand.counts[c], { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })).join('')}${simpleTableCell(grand.total, { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })}</tr>
    </table>
  `;
}

// Table 2 — Non-Sales, flat by department (no Floor column)
function buildNonSalesSimpleTable(deptUnits, statusTypes) {
  const statusCols = statusTypes.map(st => st.StatusName);
  let grand = { present: 0, total: 0, counts: {} };
  statusCols.forEach(c => grand.counts[c] = 0);

  let rowsHtml = '';
  deptUnits.forEach(u => {
    const present = u.totalPresent ?? 0, total = u.totalAssigned ?? 0;
    grand.present += present; grand.total += total;
    statusCols.forEach(c => grand.counts[c] += (u.statusCounts[c] || 0));
    rowsHtml += `<tr>${simpleTableCell(u.label)}${simpleTableCell(present, { align: 'center' })}${statusCols.map(c => simpleTableCell(u.statusCounts[c] || 0, { align: 'center' })).join('')}${simpleTableCell(total, { align: 'center', bold: true })}</tr>`;
  });

  const headerCols = ['DEPARTMENT', 'PRESENT', ...statusCols.map(s => s.toUpperCase()), 'TOTAL STRENGTH'];
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      ${simpleTableHeaderRow(headerCols)}
      ${rowsHtml}
      <tr>${simpleTableCell('GRAND TOTAL', { bold: true, bg: '#29ABE2', color: '#fff' })}${simpleTableCell(grand.present, { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })}${statusCols.map(c => simpleTableCell(grand.counts[c], { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })).join('')}${simpleTableCell(grand.total, { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })}</tr>
    </table>
  `;
}

// Table 3 — Managers, one row per person (Floor Managers + Dept Incharges only)
function buildManagersSimpleTable(managerDetail) {
  let present = 0;
  let rowsHtml = managerDetail.map(m => {
    const context = m.Department === 'Sales' ? m.Floor : m.Department;
    const isPresent = m.Status === 'Present';
    if (isPresent) present++;
    return `<tr>${simpleTableCell(m.Name)}${simpleTableCell(context)}${simpleTableCell(m.Status, { align: 'center', color: isPresent ? '#2d8a4e' : '#C0272D', bold: true })}</tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
      ${simpleTableHeaderRow(['NAME', 'FLOOR / DEPARTMENT', 'STATUS'])}
      ${rowsHtml}
      <tr>${simpleTableCell('GRAND TOTAL', { bold: true, bg: '#29ABE2', color: '#fff' })}${simpleTableCell('', { bg: '#29ABE2' })}${simpleTableCell(`${present} / ${managerDetail.length} Present`, { bold: true, bg: '#29ABE2', color: '#fff', align: 'center' })}</tr>
    </table>
  `;
}

function buildSimpleTableReportHTML(data, managerDetail) {
  return `
    <div style="width:760px;background:#fff;padding:20px;font-family:'Segoe UI',system-ui,sans-serif;">
      <div style="text-align:center;margin-bottom:10px;"><img src="${LOGO_BSC}" style="height:50px;"></div>
      <div style="background:#FBE4CF;border:1px solid #333;padding:8px;text-align:center;font-weight:800;font-size:15px;color:#1E2D4E;margin-bottom:10px;">DATE : ${data.date}</div>
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Sales — By Floor / Section</div>
      ${buildSalesSimpleTable(data.sectionUnits, data.statusTypes)}
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 4px;">Non-Sales — By Department</div>
      ${buildNonSalesSimpleTable(data.deptUnits, data.statusTypes)}
      <div style="font-size:9px;font-weight:800;color:#1E2D4E;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 4px;">Managers</div>
      ${buildManagersSimpleTable(managerDetail)}
      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #ccc;font-size:10px;color:#888;text-align:center;">
        Prepared via BSC Attendance App · C&amp;B (Consulting &amp; Beyond)
      </div>
    </div>
  `;
}

// Renders reportHTML off-screen, rasterizes with html2canvas, triggers a PNG download.
// Requires html2canvas to be loaded on the page (CDN script tag).
function downloadReportPNG(reportHTML, filename) {
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.style.top = '0';
  holder.innerHTML = reportHTML;
  document.body.appendChild(holder);

  return html2canvas(holder.firstElementChild, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    document.body.removeChild(holder);
  }).catch(err => {
    document.body.removeChild(holder);
    throw err;
  });
}
