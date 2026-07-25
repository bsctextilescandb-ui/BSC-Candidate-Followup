// ============================================================
// SHARED — included by every page (login, marking, dashboard, admin)
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzcaGs8hGfvhsydKcdcjdObMqa4VE52LenPxCEMwOH-Lpl6ijLjxxtYh4EiJIc-pkSc/exec';

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

// Renders the shared top bar + nav. `page` is one of 'marking' | 'dashboard' | 'admin'.
function renderTopbar(page) {
  const s = getSession();
  if (!s) return;
  const el = document.getElementById('topbar');
  if (!el) return;

  let navLinks = '';
  if (s.role === 'Admin') {
    navLinks = `
      <a href="dashboard.html" class="${page === 'dashboard' ? 'active' : ''}">Dashboard</a>
      <a href="marking.html" class="${page === 'marking' ? 'active' : ''}">Marking</a>
      <a href="admin.html" class="${page === 'admin' ? 'active' : ''}">Admin Control</a>
    `;
  }

  let scopeLabel = '';
  if (s.role === 'FloorManager') scopeLabel = 'Floor Manager — ' + s.floorName;
  else if (s.role === 'SectionIncharge') scopeLabel = 'Section Incharge — ' + s.sectionName + ' (' + s.floorName + ')';
  else if (s.role === 'DeptIncharge') scopeLabel = 'Dept Incharge — ' + s.departmentName;
  else if (s.role === 'Admin') scopeLabel = 'Admin (HR)';

  el.innerHTML = `
    <div>
      <h1>BSC Textiles — Daily Attendance</h1>
      <div class="sub">${s.name} · ${scopeLabel}</div>
    </div>
    <nav>${navLinks}<span class="logout" onclick="logout()">Logout</span></nav>
  `;
}
