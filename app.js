// ============================================================
// app.js — Rekind InternHub
// Semua logic UI, state, dan event handler
// Tidak ada referensi langsung ke Google Sheets / URL backend
// Semua akses data lewat DatabaseAdapter (config.js)
// ============================================================

// ─── STATE ───────────────────────────────────────────────────
let currentUser  = null;
let fileData     = { photo: null, cv: null, selfie: null };
let clockInterval = null;
let currentPage  = 'dashboard';

// ─── NAVIGATION MAP ──────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:  ['Dashboard',  'Ringkasan aktivitas hari ini'],
  candidates: ['Kandidat',   'Daftar pendaftar magang'],
  interns:    ['Intern',     'Data peserta magang aktif'],
  attendance: ['Absensi',    'Kelola kehadiran harian'],
  tasks:      ['Tugas',      'Manajemen tugas & progres'],
  profile:    ['Profil',     'Informasi akun Anda'],
  users:      ['Pengguna',   'Manajemen akun sistem'],
};

const SIDEBAR_MENUS = {
  admin: [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard',  page: 'dashboard' },
    ]},
    { section: 'Rekrutmen', items: [
      { icon: '👥', label: 'Kandidat',   page: 'candidates' },
      { icon: '🎓', label: 'Intern',     page: 'interns' },
    ]},
    { section: 'Operasional', items: [
      { icon: '🕐', label: 'Absensi',    page: 'attendance' },
      { icon: '📋', label: 'Tugas',      page: 'tasks' },
    ]},
    { section: 'Admin', items: [
      { icon: '🔑', label: 'Pengguna',   page: 'users' },
      { icon: '👤', label: 'Profil',     page: 'profile' },
    ]},
  ],
  mentor: [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard',    page: 'dashboard' },
      { icon: '👥', label: 'Kandidat',     page: 'candidates' },
      { icon: '🎓', label: 'Intern Saya',  page: 'interns' },
    ]},
    { section: 'Operasional', items: [
      { icon: '📋', label: 'Tugas',        page: 'tasks' },
      { icon: '🕐', label: 'Absensi',      page: 'attendance' },
      { icon: '👤', label: 'Profil',       page: 'profile' },
    ]},
  ],
  intern: [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard',    page: 'dashboard' },
      { icon: '🕐', label: 'Absensi',      page: 'attendance' },
      { icon: '📋', label: 'Tugas Saya',   page: 'tasks' },
      { icon: '👤', label: 'Profil',       page: 'profile' },
    ]},
  ],
};

// ============================================================
// STARTUP
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  // Restore session
  const saved = localStorage.getItem(CONFIG.SESSION_KEY);
  if (saved) {
    try { currentUser = JSON.parse(saved); initApp(); }
    catch { localStorage.removeItem(CONFIG.SESSION_KEY); }
  }
  // Enter to login
  document.getElementById('login-password')
    .addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showAuthError('Isi email dan password');

  setLoginLoading(true);
  const res = await DatabaseAdapter.login(email, password);
  setLoginLoading(false);

  if (res.success && res.user) {
    currentUser = res.user;
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(currentUser));
    initApp();
  } else {
    showAuthError(res.error || 'Login gagal. Periksa email & password.');
  }
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem(CONFIG.SESSION_KEY);
  clearInterval(clockInterval);
  document.getElementById('app').style.display          = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
}

function setLoginLoading(on) {
  document.getElementById('btn-login').disabled = on;
  document.getElementById('login-text').innerHTML =
    on ? '<span class="loader"></span>' : 'Masuk';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent    = msg;
  el.style.display  = 'block';
  el.style.background   = 'rgba(200,68,26,0.15)';
  el.style.borderColor  = 'rgba(200,68,26,0.3)';
  el.style.color        = '#ff8a6a';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── Register ─────────────────────────────────────────────
function showRegisterForm() {
  document.getElementById('register-panel').style.display = 'block';
  document.querySelector('.auth-toggle').style.display    = 'none';
  document.getElementById('btn-login').style.display      = 'none';
  document.querySelectorAll('#auth-screen .field')[0].style.display = 'none';
  document.querySelectorAll('#auth-screen .field')[1].style.display = 'none';
}

function showLoginForm() {
  document.getElementById('register-panel').style.display = 'none';
  document.querySelector('.auth-toggle').style.display    = 'block';
  document.getElementById('btn-login').style.display      = 'block';
  document.querySelectorAll('#auth-screen .field')[0].style.display = 'block';
  document.querySelectorAll('#auth-screen .field')[1].style.display = 'block';
}

async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const campus   = document.getElementById('reg-campus').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!name || !email || !phone || !campus || !password)
    return showAuthError('Lengkapi semua field');
  if (!fileData.photo) return showAuthError('Upload foto wajib!');
  if (!fileData.cv)    return showAuthError('Upload CV wajib!');

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  document.getElementById('register-text').innerHTML =
    '<span class="loader"></span> Mengupload...';

  const res = await DatabaseAdapter.registerCandidate({
    name, email, phone, campus, password,
    photo: fileData.photo, cv: fileData.cv,
  });

  btn.disabled = false;
  document.getElementById('register-text').textContent = 'Kirim Pendaftaran';

  if (res.success) {
    const el = document.getElementById('auth-error');
    el.style.background  = 'rgba(26,138,74,0.15)';
    el.style.borderColor = 'rgba(26,138,74,0.3)';
    el.style.color       = '#6adea0';
    el.textContent       = '✅ Pendaftaran berhasil! Silakan login.';
    el.style.display     = 'block';
    fileData = { photo: null, cv: null, selfie: null };
    setTimeout(showLoginForm, 2000);
  } else {
    showAuthError(res.error || 'Pendaftaran gagal');
  }
}

// ─── File handling ────────────────────────────────────────
function handleFileSelect(input, type) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
    toast(`File terlalu besar! Maks ${CONFIG.MAX_FILE_SIZE_MB}MB`, 'error');
    input.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    fileData[type] = { base64: e.target.result.split(',')[1], name: file.name, mime: file.type };
    const preview = document.getElementById(type + '-preview');
    if (!preview) return;
    if (type === 'photo') {
      preview.innerHTML =
        `<img src="${e.target.result}" style="max-width:70px;max-height:70px;border-radius:8px;margin-top:8px;">`;
    } else {
      preview.innerHTML = `<div class="file-name">📄 ${file.name}</div>`;
    }
  };
  reader.readAsDataURL(file);
}

function handleDrop(e, type) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const input = document.getElementById('reg-' + type);
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
  handleFileSelect(input, type);
  e.currentTarget.classList.remove('drag-over');
}

// ============================================================
// APP INIT
// ============================================================
function initApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display         = 'block';

  const u = currentUser;
  document.getElementById('sb-username').textContent      = u.name;
  document.getElementById('topbar-avatar').textContent    = u.name[0].toUpperCase();

  const roleLabel = { admin:'Admin', mentor:'Mentor', intern:'Intern' }[u.role] || u.role;
  const badge = document.getElementById('sb-role-badge');
  badge.className   = `role-badge role-${u.role}`;
  badge.textContent = roleLabel;

  buildSidebar();
  navigateTo('dashboard');
  startClock();
}

function buildSidebar() {
  const nav   = document.getElementById('sidebar-nav');
  const menus = SIDEBAR_MENUS[currentUser.role] || SIDEBAR_MENUS.intern;
  nav.innerHTML = menus.map(section => `
    <div class="nav-section-label">${section.section}</div>
    ${section.items.map(item => `
      <div class="nav-item" id="nav-${item.page}" onclick="navigateTo('${item.page}')">
        <span class="icon">${item.icon}</span> ${item.label}
      </div>`).join('')}
  `).join('');
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  const navEl  = document.getElementById('nav-'  + page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  const [title, sub] = PAGE_TITLES[page] || ['Halaman', ''];
  document.getElementById('page-title').textContent    = title;
  document.getElementById('page-subtitle').textContent = sub;

  const loaders = {
    dashboard: loadDashboard, candidates: loadCandidates,
    interns:   loadInterns,   attendance: loadAttendance,
    tasks:     loadTasks,     profile:    loadProfile,
    users:     loadUsers,
  };
  if (loaders[page]) loaders[page]();
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  const grid  = document.getElementById('stats-grid');
  const cards = document.getElementById('dashboard-cards');
  grid.innerHTML =
    '<div class="stat-card"><div class="stat-value">' +
    '<span class="loader" style="border-color:rgba(0,0,0,0.1);border-top-color:var(--primary)"></span>' +
    '</div></div>';

  const res = await DatabaseAdapter.getDashboard(currentUser.role, currentUser.id);
  if (!res.success) {
    grid.innerHTML = '<p style="color:var(--muted)">Gagal memuat data</p>'; return;
  }

  const d = res.data;
  const statCards = [
    { value: d.totalCandidates  || 0, label: 'Total Kandidat',    icon: '👥', color: '#0066b3' },
    { value: d.pendingCandidates|| 0, label: 'Menunggu Review',   icon: '⏳', color: '#ff6600' },
    { value: d.totalInterns     || 0, label: 'Intern Aktif',      icon: '🎓', color: '#0066b3' },
    { value: d.todayAttendance  || 0, label: 'Hadir Hari Ini',    icon: '✅', color: '#00a651' },
  ];

  grid.innerHTML = statCards.map(s => `
    <div class="stat-card" style="--accent-color:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');

  const pct = d.taskSummary && d.taskSummary.total
    ? Math.round(d.taskSummary.done / d.taskSummary.total * 100) : 0;

  cards.innerHTML = `
    <div class="content-card">
      <div class="card-header"><span class="card-title">⚡ Aktivitas Terbaru</span></div>
      <div class="card-body">
        ${(d.recentActivity || []).length
          ? d.recentActivity.map(a =>
              `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <span style="color:var(--muted);font-size:11px">${a.time}</span><br>${a.text}
              </div>`).join('')
          : '<div class="empty-state"><div class="icon">📭</div><p>Belum ada aktivitas</p></div>'}
      </div>
    </div>
    <div class="content-card">
      <div class="card-header"><span class="card-title">📋 Ringkasan Tugas</span></div>
      <div class="card-body">
        ${d.taskSummary
          ? `<div style="margin-bottom:12px">
               <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                 <span>Progress</span>
                 <span>${d.taskSummary.done}/${d.taskSummary.total} selesai</span>
               </div>
               <div class="progress-bar">
                 <div class="progress-fill" style="width:${pct}%"></div>
               </div>
             </div>`
          : '<div class="empty-state"><div class="icon">📋</div><p>Belum ada tugas</p></div>'}
      </div>
    </div>`;
}

// ============================================================
// CANDIDATES
// ============================================================
async function loadCandidates() {
  const tbody = document.getElementById('candidates-body');
  tbody.innerHTML = _loadingRow(6);

  const res = await DatabaseAdapter.getCandidates(currentUser.role, currentUser.id);
  const candidates = res.candidates || [];

  if (!candidates.length) {
    tbody.innerHTML = _emptyRow(6, '👥', 'Belum ada kandidat', 'Kandidat yang mendaftar akan muncul di sini');
    return;
  }

  tbody.innerHTML = candidates.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="candidate-photo">
            ${c.photo_url
              ? `<img src="${c.photo_url}" alt="${c.name}" onerror="this.parentElement.textContent='👤'">`
              : '👤'}
          </div>
          <div>
            <div style="font-weight:600;font-size:13px">${c.name}</div>
            <div style="font-size:11px;color:var(--muted)">${c.campus || '-'}</div>
          </div>
        </div>
      </td>
      <td>${c.email}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.campus || '-'}</td>
      <td><span class="status-badge status-${(c.status||'pending').toLowerCase()}">${c.status || 'Pending'}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${c.cv_url    ? `<a href="${c.cv_url}" target="_blank" class="btn btn-outline btn-sm">📄 CV</a>` : ''}
          ${c.photo_url ? `<button class="btn btn-outline btn-sm" onclick="previewPhoto('${c.photo_url}','${c.name}')">🖼 Foto</button>` : ''}
          ${(currentUser.role === 'admin' || currentUser.role === 'mentor') && (!c.status || c.status === 'Pending') ? `
            <button class="btn btn-success btn-sm" onclick="updateCandidateStatus('${c.id}','Accepted')">✓ Terima</button>
            <button class="btn btn-danger  btn-sm" onclick="updateCandidateStatus('${c.id}','Rejected')">✗ Tolak</button>
          ` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function updateCandidateStatus(candidateId, status) {
  const res = await DatabaseAdapter.updateCandidateStatus(candidateId, status, currentUser.id);
  if (res.success) {
    toast(status === 'Accepted' ? '✅ Kandidat diterima!' : '❌ Kandidat ditolak',
          status === 'Accepted' ? 'success' : 'error');
    loadCandidates();
  } else toast(res.error || 'Gagal update status', 'error');
}

function previewPhoto(url, name) {
  openModal(`
    <div class="modal-header">
      <h3>📷 Foto — ${name}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="text-align:center">
      <img src="${url}" alt="${name}"
        style="max-width:100%;max-height:60vh;border-radius:12px;box-shadow:var(--shadow-md)">
    </div>`);
}

// ============================================================
// INTERNS
// ============================================================
async function loadInterns() {
  const tbody = document.getElementById('interns-body');
  tbody.innerHTML = _loadingRow(6);

  const res = await DatabaseAdapter.getInterns(currentUser.role, currentUser.id);
  const interns = res.interns || [];

  if (!interns.length) {
    tbody.innerHTML = _emptyRow(6, '🎓', 'Belum ada intern', 'Kandidat yang diterima akan muncul di sini');
    return;
  }

  tbody.innerHTML = interns.map(i => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="candidate-photo">
            ${i.photo_url
              ? `<img src="${i.photo_url}" alt="${i.name}" onerror="this.parentElement.textContent='👤'">`
              : '👤'}
          </div>
          <div style="font-weight:600;font-size:13px">${i.name}</div>
        </div>
      </td>
      <td>${i.email}</td>
      <td>${i.campus || '-'}</td>
      <td>${i.mentor_name || '<em style="color:var(--muted)">Belum assign</em>'}</td>
      <td><span class="status-badge status-active">${i.status || 'Aktif'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${i.cv_url ? `<a href="${i.cv_url}" target="_blank" class="btn btn-outline btn-sm">📄 CV</a>` : ''}
          ${currentUser.role === 'admin'
            ? `<button class="btn btn-info btn-sm" onclick="openAssignMentorModal('${i.id}','${i.name}')">👤 Assign</button>`
            : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function openAssignMentorModal(internId, internName) {
  const res     = await DatabaseAdapter.getMentors();
  const mentors = res.mentors || [];
  openModal(`
    <div class="modal-header">
      <h3>👤 Assign Mentor — ${internName}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field">
      <label>Pilih Mentor</label>
      <select id="assign-mentor-select">
        <option value="">— Pilih mentor —</option>
        ${mentors.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" onclick="doAssignMentor('${internId}')">Simpan</button>
    </div>`);
}

async function doAssignMentor(internId) {
  const mentorId = document.getElementById('assign-mentor-select').value;
  if (!mentorId) return toast('Pilih mentor dulu', 'error');
  const res = await DatabaseAdapter.assignMentor(internId, mentorId);
  if (res.success) { toast('Mentor berhasil di-assign', 'success'); closeModal(); loadInterns(); }
  else toast(res.error || 'Gagal assign', 'error');
}

// ============================================================
// ATTENDANCE
// ============================================================
function startClock() {
  const tick = () => {
    const now = new Date();
    document.getElementById('clock-display').textContent =
      now.toLocaleTimeString('id-ID');
    document.getElementById('date-display').textContent =
      now.toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  };
  tick();
  clockInterval = setInterval(tick, 1000);
}

async function loadAttendance() {
  const actionsEl = document.getElementById('attendance-actions');
  const tbody     = document.getElementById('attendance-body');

  const todayRes = await DatabaseAdapter.getTodayAttendance(currentUser.id);
  const today    = todayRes.record;

  actionsEl.innerHTML = '';
  if (!today || !today.checkin_time) {
    actionsEl.innerHTML =
      `<button class="btn btn-success" onclick="doCheckin()">✅ Check In</button>`;
  } else if (!today.checkout_time) {
    actionsEl.innerHTML = `
      <div style="color:rgba(255,255,255,0.6);font-size:13px">Check in: ${today.checkin_time}</div>
      <button class="btn btn-danger" onclick="doCheckout('${today.id}')">🔴 Check Out</button>`;
  } else {
    actionsEl.innerHTML =
      `<div style="color:rgba(255,255,255,0.6);font-size:13px">
        ✅ Selesai — In: ${today.checkin_time} | Out: ${today.checkout_time}
      </div>`;
  }

  const histRes  = await DatabaseAdapter.getAttendance(currentUser.role, currentUser.id);
  const records  = histRes.records || [];

  tbody.innerHTML = records.length
    ? records.map(r => `
        <tr>
          <td>${r.name || '-'}</td>
          <td>${r.date || '-'}</td>
          <td>${r.checkin_time  || '-'}</td>
          <td>${r.checkout_time || '-'}</td>
          <td>${r.duration || '-'}</td>
          <td>${r.selfie_url
            ? `<img src="${r.selfie_url}"
                style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid var(--border)"
                onerror="this.style.display='none'">`
            : '-'}</td>
        </tr>`).join('')
    : `<tr><td colspan="6">${_emptyHTML('🕐', 'Belum ada data absensi', '')}</td></tr>`;
}

async function doCheckin() {
  openModal(`
    <div class="modal-header">
      <h3>✅ Check In</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
      Waktu: ${new Date().toLocaleTimeString('id-ID')}
    </p>
    <div class="form-field">
      <label>Selfie (opsional)</label>
      <div class="file-upload-zone">
        <input type="file" id="selfie-input" accept="image/*" capture="user"
          onchange="handleFileSelect(this,'selfie')">
        <div class="file-upload-icon">🤳</div>
        <div class="file-upload-text"><strong>Ambil atau unggah</strong> selfie</div>
        <div class="file-preview" id="selfie-preview"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-success" onclick="submitCheckin()">Check In Sekarang</button>
    </div>`);
}

async function submitCheckin() {
  const res = await DatabaseAdapter.checkin(currentUser.id, currentUser.name, fileData.selfie);
  if (res.success) {
    toast('✅ Check in berhasil!', 'success');
    closeModal(); fileData.selfie = null; loadAttendance();
  } else toast(res.error || 'Check in gagal', 'error');
}

async function doCheckout(recordId) {
  const res = await DatabaseAdapter.checkout(currentUser.id, recordId);
  if (res.success) { toast('🔴 Check out berhasil!', 'info'); loadAttendance(); }
  else toast(res.error || 'Check out gagal', 'error');
}

// ============================================================
// TASKS
// ============================================================
async function loadTasks() {
  const list       = document.getElementById('tasks-list');
  const progress   = document.getElementById('tasks-progress');
  const btnNewTask = document.getElementById('btn-new-task');

  if (currentUser.role === 'mentor' || currentUser.role === 'admin')
    btnNewTask.style.display = 'inline-flex';

  list.innerHTML = '<div style="color:var(--muted);font-size:13px">Memuat tugas...</div>';

  const res   = await DatabaseAdapter.getTasks(currentUser.role, currentUser.id);
  const tasks = res.tasks || [];

  if (!tasks.length) {
    list.innerHTML = _emptyHTML('📋', 'Belum ada tugas', 'Tugas yang diberikan akan muncul di sini');
    progress.innerHTML = ''; return;
  }

  list.innerHTML = tasks.map(t => `
    <div class="task-item">
      <div class="task-check ${t.status === 'Done' ? 'done' : ''}"
        onclick="toggleTask('${t.id}','${t.status}')">
        ${t.status === 'Done' ? '✓' : ''}
      </div>
      <div style="flex:1">
        <div class="task-title ${t.status === 'Done' ? 'done' : ''}">${t.title}</div>
        <div class="task-meta">
          ${t.assignee_name || ''} ${t.due_date ? '· Due: ' + t.due_date : ''}
        </div>
      </div>
      <span class="task-priority priority-${(t.priority||'medium').toLowerCase()}">
        ${t.priority || 'Medium'}
      </span>
    </div>`).join('');

  const done = tasks.filter(t => t.status === 'Done').length;
  const pct  = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  progress.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-family:'Syne',sans-serif;font-size:42px;font-weight:800;color:var(--ink)">${pct}%</div>
      <div style="font-size:13px;color:var(--muted)">${done} dari ${tasks.length} tugas selesai</div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>
    <div style="margin-top:16px">
      ${['Todo','In Progress','Done'].map(s => {
        const count = tasks.filter(t => (t.status || 'Todo') === s).length;
        return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border)">
                  <span>${s}</span><strong>${count}</strong>
                </div>`;
      }).join('')}
    </div>`;
}

function openNewTaskModal() {
  DatabaseAdapter.getInterns(currentUser.role, currentUser.id).then(res => {
    const myInterns = res.interns || [];
    openModal(`
      <div class="modal-header">
        <h3>📋 Tugas Baru</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-field">
        <label>Judul Tugas</label>
        <input type="text" id="task-title" placeholder="Nama tugas">
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label>Assign ke</label>
          <select id="task-assignee">
            <option value="">— Pilih intern —</option>
            ${myInterns.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Prioritas</label>
          <select id="task-priority">
            <option>High</option><option selected>Medium</option><option>Low</option>
          </select>
        </div>
      </div>
      <div class="form-field">
        <label>Deadline</label>
        <input type="date" id="task-due">
      </div>
      <div class="form-field">
        <label>Deskripsi</label>
        <textarea id="task-desc" placeholder="Deskripsi tugas..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary-btn" onclick="submitNewTask()">Buat Tugas</button>
      </div>`);
  });
}

async function submitNewTask() {
  const title       = document.getElementById('task-title').value.trim();
  const assigneeId  = document.getElementById('task-assignee').value;
  const priority    = document.getElementById('task-priority').value;
  const dueDate     = document.getElementById('task-due').value;
  const description = document.getElementById('task-desc').value;
  if (!title) return toast('Judul tugas wajib diisi', 'error');

  const res = await DatabaseAdapter.createTask({
    title, assigneeId, priority, dueDate, description, mentorId: currentUser.id
  });
  if (res.success) { toast('✅ Tugas dibuat!', 'success'); closeModal(); loadTasks(); }
  else toast(res.error || 'Gagal membuat tugas', 'error');
}

async function toggleTask(taskId, currentStatus) {
  const newStatus = currentStatus === 'Done' ? 'In Progress' : 'Done';
  const res = await DatabaseAdapter.updateTask(taskId, newStatus, currentUser.id);
  if (res.success) loadTasks();
  else toast(res.error || 'Gagal update tugas', 'error');
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
  const res  = await DatabaseAdapter.getProfile(currentUser.id);
  const user = res.user || currentUser;

  const avatarEl = document.getElementById('profile-avatar');
  if (user.photo_url) {
    avatarEl.innerHTML = `<img src="${user.photo_url}" alt="${user.name}">`;
  } else {
    avatarEl.textContent = (user.name || '?')[0].toUpperCase();
  }

  const roleLabel = { admin:'Admin', mentor:'Mentor', intern:'Intern' }[user.role] || user.role;
  document.getElementById('profile-name').textContent  = user.name  || '-';
  document.getElementById('profile-info').textContent  = `${user.email} · ${user.role}`;
  document.getElementById('profile-badges').innerHTML  =
    `<span class="role-badge role-${user.role}">${roleLabel}</span>`;

  document.getElementById('profile-details').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${[
        ['Nama Lengkap', user.name],
        ['Email',        user.email],
        ['No HP',        user.phone  || '-'],
        ['Kampus',       user.campus || '-'],
        ['Role',         roleLabel],
        ['Status',       user.status || 'Aktif'],
      ].map(([k, v]) => `
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted);font-weight:600;margin-bottom:4px">${k}</div>
          <div style="font-size:14px;font-weight:500">${v}</div>
        </div>`).join('')}
    </div>
    ${user.cv_url
      ? `<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
           <a href="${user.cv_url}" target="_blank" class="btn btn-outline">📄 Lihat CV Saya</a>
         </div>`
      : ''}`;
}

// ============================================================
// USERS (Admin only)
// ============================================================
async function loadUsers() {
  const tbody = document.getElementById('users-body');
  tbody.innerHTML = _loadingRow(5);

  const res   = await DatabaseAdapter.getUsers();
  const users = res.users || [];

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td><span class="status-badge status-active">${u.status || 'Aktif'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="editUserRole('${u.id}','${u.role}')">Edit</button></td>
    </tr>`).join('');
}

async function openAddUserModal() {
  openModal(`
    <div class="modal-header">
      <h3>➕ Tambah Pengguna</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field"><label>Nama</label>
      <input type="text"     id="new-user-name"  placeholder="Nama lengkap"></div>
    <div class="form-field"><label>Email</label>
      <input type="email"    id="new-user-email" placeholder="email@contoh.com"></div>
    <div class="form-field"><label>Password</label>
      <input type="password" id="new-user-pass"  placeholder="Password awal"></div>
    <div class="form-field"><label>Role</label>
      <select id="new-user-role">
        <option value="intern">Intern</option>
        <option value="mentor">Mentor</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" onclick="submitAddUser()">Tambah</button>
    </div>`);
}

async function submitAddUser() {
  const name     = document.getElementById('new-user-name').value.trim();
  const email    = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-pass').value;
  const role     = document.getElementById('new-user-role').value;
  if (!name || !email || !password) return toast('Lengkapi semua field', 'error');

  const res = await DatabaseAdapter.addUser({ name, email, password, role });
  if (res.success) { toast('✅ User ditambahkan', 'success'); closeModal(); loadUsers(); }
  else toast(res.error || 'Gagal menambahkan user', 'error');
}

// ============================================================
// UI HELPERS
// ============================================================
function filterTable(input, tableId) {
  const q = input.value.toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML     = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ─── Table helpers ────────────────────────────────────────
function _loadingRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--muted)">Memuat data...</td></tr>`;
}
function _emptyHTML(icon, title, desc) {
  return `<div class="empty-state"><div class="icon">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`;
}
function _emptyRow(cols, icon, title, desc) {
  return `<tr><td colspan="${cols}">${_emptyHTML(icon, title, desc)}</td></tr>`;
}
