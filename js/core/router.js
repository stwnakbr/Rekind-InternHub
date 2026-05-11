import { Auth } from './auth.js';

// ─── Route definitions per role ──────────────────────────────
// Setiap role memiliki folder pages sendiri.
// Shared pages (attendance, tasks, profile) ada di pages/shared/

const ROLE_ROUTES = {
  admin: {
    '/dashboard':  { template: '/pages/dashboard.html',  script: '../pages/admin/dashboard.js',   init: 'initDashboard' },
    '/vacancies':  { template: '/pages/vacancies.html',  script: '../pages/admin/vacancies.js',   init: 'initVacancies' },
    '/candidates': { template: '/pages/candidates.html', script: '../pages/admin/candidates.js',  init: 'initCandidates' },
    '/interns':    { template: '/pages/interns.html',    script: '../pages/admin/interns.js',     init: 'initInterns' },
    '/attendance': { template: '/pages/attendance.html', script: '../pages/shared/attendance.js', init: 'initAttendance' },
    '/tasks':      { template: '/pages/tasks.html',      script: '../pages/shared/tasks.js',      init: 'initTasks' },
    '/profile':    { template: '/pages/profile.html',    script: '../pages/shared/profile.js',    init: 'initProfile' },
    '/users':      { template: '/pages/users.html',      script: '../pages/admin/users.js',       init: 'initUsers' },
  },
  mentor: {
    '/dashboard':  { template: '/pages/dashboard.html',  script: '../pages/mentor/dashboard.js',   init: 'initDashboard' },
    '/vacancies':  { template: '/pages/vacancies.html',  script: '../pages/mentor/vacancies.js',   init: 'initVacancies' },
    '/candidates': { template: '/pages/candidates.html', script: '../pages/mentor/candidates.js',  init: 'initCandidates' },
    '/interns':    { template: '/pages/interns.html',    script: '../pages/mentor/interns.js',     init: 'initInterns' },
    '/attendance': { template: '/pages/attendance.html', script: '../pages/shared/attendance.js',  init: 'initAttendance' },
    '/tasks':      { template: '/pages/tasks.html',      script: '../pages/shared/tasks.js',       init: 'initTasks' },
    '/profile':    { template: '/pages/profile.html',    script: '../pages/shared/profile.js',     init: 'initProfile' },
  },
  intern: {
    '/dashboard':        { template: '/pages/dashboard.html',           script: '../pages/intern/dashboard.js',           init: 'initDashboard' },
    '/candidates':       { template: '/pages/candidates.html',          script: '../pages/intern/candidates.js',          init: 'initCandidates' },
    '/vacancies-browse': { template: '/pages/vacancies-candidate.html', script: '../pages/intern/vacancies-candidate.js', init: 'initVacanciesCandidate' },
    '/attendance':       { template: '/pages/attendance.html',          script: '../pages/shared/attendance.js',          init: 'initAttendance' },
    '/tasks':            { template: '/pages/tasks.html',               script: '../pages/shared/tasks.js',               init: 'initTasks' },
    '/profile':          { template: '/pages/profile.html',             script: '../pages/shared/profile.js',             init: 'initProfile' },
  },
  candidate: {
    '/dashboard':        { template: '/pages/dashboard.html',           script: '../pages/intern/dashboard.js',           init: 'initDashboard' },
    '/candidates':       { template: '/pages/candidates.html',          script: '../pages/intern/candidates.js',          init: 'initCandidates' },
    '/vacancies-browse': { template: '/pages/vacancies-candidate.html', script: '../pages/intern/vacancies-candidate.js', init: 'initVacanciesCandidate' },
    '/profile':          { template: '/pages/profile.html',             script: '../pages/shared/profile.js',             init: 'initProfile' },
  },
};

const PAGE_TITLES = {
  '/dashboard':        ['Status Pendaftaran', 'Pantau proses lamaran Anda'],
  '/vacancies':        ['Lowongan', 'Manajemen lowongan magang'],
  '/vacancies-browse': ['Lowongan Tersedia', 'Temukan & lamar posisi magang impian Anda'],
  '/candidates':       ['Kandidat', 'Daftar pendaftar magang'],
  '/interns':          ['Intern', 'Data peserta magang aktif'],
  '/attendance':       ['Absensi', 'Kelola kehadiran harian'],
  '/tasks':            ['Tugas', 'Manajemen tugas & progres'],
  '/profile':          ['Profil', 'Informasi akun Anda'],
  '/users':            ['Pengguna', 'Manajemen akun sistem'],
};

function getEffectiveRole(user) {
  if (!user) return 'candidate';
  if (user.role === 'admin' || user.role === 'mentor') return user.role;
  if (user.role === 'intern' && user.status === 'Active') return 'intern';
  if (user.role === 'intern' && (user.status === 'Pending' || user.status === 'Interview' || user.status === 'Rejected')) return 'candidate';
  return 'candidate';
}

class Router {
  constructor() {
    this.root = document.getElementById('router-view');
    window.addEventListener('popstate', () => this.handleRoute());
  }

  async navigate(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    await this.handleRoute();
  }

  async handleRoute() {
    let path = window.location.pathname;
    if (path === '/' || path === '/index.html') {
      path = '/dashboard';
      window.history.replaceState({}, '', path);
    }

    if (!Auth.isAuthenticated()) {
      Auth.showLoginScreen();
      return;
    }

    const user = Auth.getCurrentUser();
    const effectiveRole = getEffectiveRole(user);
    const roleRoutes = ROLE_ROUTES[effectiveRole] || ROLE_ROUTES.candidate;

    const route = roleRoutes[path] || roleRoutes['/dashboard'];

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById('nav-' + path.replace('/', ''));
    if (navEl) navEl.classList.add('active');

    // Update header titles
    let titles = PAGE_TITLES[path] || ['Halaman', ''];
    if (path === '/dashboard' && user && user.status !== 'Pending' && user.status !== 'Interview') {
      titles = ['Dashboard', 'Ringkasan aktivitas hari ini'];
    }
    document.getElementById('page-title').textContent = titles[0];
    document.getElementById('page-subtitle').textContent = titles[1];

    try {
      this.root.innerHTML = '<div style="padding:40px;text-align:center"><span class="loader" style="border-top-color:var(--primary)"></span> Memuat halaman...</div>';

      const response = await fetch(route.template);
      if (!response.ok) throw new Error('Gagal memuat template halaman');
      const html = await response.text();
      this.root.innerHTML = html;

      if (route.script) {
        const module = await import(route.script);
        if (module[route.init]) {
          await module[route.init]();
        }
      }
    } catch (e) {
      console.error('Routing error:', e);
      this.root.innerHTML = `<div class="empty-state"><h3>Halaman tidak ditemukan</h3><p>${e.message}</p></div>`;
    }
  }
}

export const appRouter = new Router();
