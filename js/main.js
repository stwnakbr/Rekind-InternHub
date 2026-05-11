import { Auth } from './core/auth.js';
import { appRouter } from './core/router.js';

window.appRouter = appRouter; // expose globally untuk dipakai di page scripts

window.addEventListener('DOMContentLoaded', async () => {
  Auth.init();

  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('btn-show-register').addEventListener('click', () => Auth.toggleAuthForms('register'));
  document.getElementById('btn-show-login').addEventListener('click', () => Auth.toggleAuthForms('login'));
  document.getElementById('btn-register').addEventListener('click', () => Auth.doRegister());
  document.getElementById('reg-photo').addEventListener('change', function() { Auth.handleFileSelect(this, 'photo'); });
  document.getElementById('reg-cv').addEventListener('change', function() { Auth.handleFileSelect(this, 'cv'); });
  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

  // BUG 16 FIX: akses pertama selalu ke login, jangan langsung app
  if (Auth.isAuthenticated()) {
    await initApp();
  } else {
    Auth.showLoginScreen();
  }
});

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  document.getElementById('login-text').innerHTML = '<span class="loader"></span>';

  const res = await Auth.login(email, pass);

  btn.disabled = false;
  document.getElementById('login-text').textContent = 'Masuk';

  if (res.success) {
    // BUG 13 FIX: kosongkan field login setelah berhasil
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    initApp();
  } else {
    Auth.showAuthError(res.error || 'Login gagal. Periksa email & password.');
  }
}

async function initApp() {
  Auth.hideLoginScreen();

  const user = await Auth.syncUserSession();
  if (!user) return;

  document.getElementById('sb-username').textContent = user.name;
  document.getElementById('topbar-avatar').textContent = user.name[0].toUpperCase();

  let roleLabel = { admin: 'Admin', mentor: 'Mentor', intern: 'Intern' }[user.role] || user.role;
  if (user.status === 'Pending' || user.status === 'Interview') roleLabel = 'Kandidat';

  const badge = document.getElementById('sb-role-badge');
  badge.className = `role-badge role-${user.role}`;
  if (user.status === 'Pending' || user.status === 'Interview') badge.className = 'role-badge role-intern';
  badge.textContent = roleLabel;

  buildSidebar(user);

  // BUG 6 FIX: setelah login arahkan ke halaman yang sesuai per role
  const homePage = getHomePageByRole(user);
  const currentPath = window.location.pathname;
  const validPaths = Object.keys(SIDEBAR_MENUS[user.role === 'intern' && (user.status === 'Pending' || user.status === 'Interview') ? 'candidate' : user.role] || {});
  
  // Kalau URL saat ini bukan halaman yang valid untuk role ini, redirect ke home
  appRouter.navigate(homePage);
}

// BUG 6 FIX: tentukan halaman awal berdasarkan role
function getHomePageByRole(user) {
  if (user.status === 'Pending' || user.status === 'Interview' || user.status === 'Rejected') {
    return '/dashboard'; // kandidat selalu ke status lamaran
  }
  switch (user.role) {
    case 'admin':   return '/dashboard';
    case 'mentor':  return '/dashboard';
    if (user.role === 'intern' && user.status === 'Active') return '/dashboard';
    return '/vacancies-browse';
    default:        return '/dashboard';
  }
}

const SIDEBAR_MENUS = {
  admin: [
    { section: 'Overview', items: [{ icon: '📊', label: 'Dashboard', page: '/dashboard' }] },
    { section: 'Rekrutmen', items: [
      { icon: '💼', label: 'Lowongan', page: '/vacancies' },
      { icon: '👥', label: 'Kandidat', page: '/candidates' },
      { icon: '🎓', label: 'Intern', page: '/interns' }
    ]},
    { section: 'Operasional', items: [
      { icon: '🕐', label: 'Absensi', page: '/attendance' },
      { icon: '📋', label: 'Tugas', page: '/tasks' }
    ]},
    { section: 'Admin', items: [
      { icon: '🔑', label: 'Pengguna', page: '/users' },
      { icon: '👤', label: 'Profil', page: '/profile' }
    ]},
  ],
  mentor: [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard', page: '/dashboard' },
      { icon: '👥', label: 'Kandidat', page: '/candidates' },
      { icon: '🎓', label: 'Intern Saya', page: '/interns' },
    ]},
    { section: 'Operasional', items: [
      { icon: '📋', label: 'Tugas', page: '/tasks' },
      { icon: '🕐', label: 'Absensi', page: '/attendance' },
      { icon: '👤', label: 'Profil', page: '/profile' },
    ]},
  ],
  intern: [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard', page: '/dashboard' },
      { icon: '🕐', label: 'Absensi', page: '/attendance' },
      { icon: '📋', label: 'Tugas Saya', page: '/tasks' },
      { icon: '👤', label: 'Profil', page: '/profile' },
    ]},
  ],
  candidate: [
    { section: 'Status Pendaftaran', items: [
      { icon: '🎯', label: 'Status Lamaran', page: '/dashboard' },
      { icon: '💼', label: 'Lowongan Tersedia', page: '/vacancies-browse' },
      { icon: '📋', label: 'Lamaran Saya', page: '/candidates' },
      { icon: '👤', label: 'Profil', page: '/profile' },
    ]},
  ]
};

function buildSidebar(user) {
  const nav = document.getElementById('sidebar-nav');
  let menus = SIDEBAR_MENUS[user.role] || SIDEBAR_MENUS.intern;
  if (user.role !== 'admin' && user.role !== 'mentor' && user.role !== 'intern') {
    menus = SIDEBAR_MENUS.candidate;
  } else if (user.role === 'intern' && (user.status === 'Pending' || user.status === 'Interview' || user.status === 'Rejected')) {
    menus = SIDEBAR_MENUS.candidate;
  }

  nav.innerHTML = menus.map(section => `
    <div class="nav-section-label">${section.section}</div>
    ${section.items.map(item => `
      <div class="nav-item" id="nav-${item.page.replace('/', '')}" data-path="${item.page}">
        <span class="icon">${item.icon}</span> ${item.label}
      </div>`).join('')}
  `).join('');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      appRouter.navigate(e.currentTarget.dataset.path);
    });
  });
}

// Global UI Helpers
window.toast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

window.openModal = function(html) {
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-box').innerHTML = html;
}

window.closeModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
}