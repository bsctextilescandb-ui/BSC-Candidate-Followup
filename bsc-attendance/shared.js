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
