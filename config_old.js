// ============================================================
// config.js — Rekind InternHub
// Ganti bagian ini saja saat migrasi database
// ============================================================

const CONFIG = {
  // ─── Apps Script URL (aktif sekarang) ───────────────────
  API_URL: 'https://script.google.com/macros/s/AKfycbzstOaMNw75q77c2AUwj4cgCYUZ04yYOE4wDy8s4iQGn9FaKN0gub4uDlDYktYcmfhlRQ/exec',

  // ─── Saat migrasi ke SQL backend, ganti baris di atas jadi:
  // API_URL: 'https://api.rekind.com/v1',
  // atau
  // API_URL: 'http://localhost:3000/api',

  APP_NAME: 'Rekind InternHub',
  APP_VERSION: '1.0.0',
  MAX_FILE_SIZE_MB: 5,
  SESSION_KEY: 'rih_user',
};

// ============================================================
// DB ADAPTER — Abstraksi layer antara UI dan backend
// Saat migrasi ke SQL: cukup ganti isi fungsi di DatabaseAdapter
// Interface-nya tetap sama, UI tidak perlu diubah sama sekali
// ============================================================

const DatabaseAdapter = {

  // ─── Transport layer ──────────────────────────────────────
  // Google Sheets: pakai XHR dengan text/plain (bypass CORS preflight)
  // SQL REST API : bisa langsung pakai fetch dengan JSON
  async _request(action, params = {}) {
    return new Promise((resolve) => {
      const body = JSON.stringify({ action, ...params });
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.API_URL, true);

      // text/plain dipakai untuk Google Apps Script (skip CORS preflight)
      // Saat migrasi ke SQL REST API, ganti ke: 'application/json'
      xhr.setRequestHeader('Content-Type', 'text/plain');

      // ── Saat pakai SQL REST API dengan JWT auth, uncomment ini:
      // const token = localStorage.getItem('rih_token');
      // if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ success: false, error: 'Response tidak valid dari server' }); }
      };
      xhr.onerror  = () => resolve({ success: false, error: 'Tidak bisa terhubung ke server' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Request timeout' });
      xhr.timeout = 30000; // 30 detik
      xhr.send(body);
    });
  },

  // ─── AUTH ─────────────────────────────────────────────────
  async login(email, password) {
    // SQL endpoint nanti: POST /api/auth/login  { email, password }
    return this._request('login', { email, password });
  },

  async registerCandidate(data) {
    // SQL endpoint nanti: POST /api/candidates/register
    return this._request('registerCandidate', data);
  },

  // ─── DASHBOARD ────────────────────────────────────────────
  async getDashboard(role, userId) {
    // SQL endpoint nanti: GET /api/dashboard?role=&userId=
    return this._request('getDashboard', { role, userId });
  },

  // ─── CANDIDATES ───────────────────────────────────────────
  async getCandidates(role, userId) {
    // SQL endpoint nanti: GET /api/candidates
    return this._request('getCandidates', { role, userId });
  },

  async updateCandidateStatus(candidateId, status, mentorId) {
    // SQL endpoint nanti: PATCH /api/candidates/:id/status
    return this._request('updateStatus', { candidateId, status, mentorId });
  },

  // ─── INTERNS ──────────────────────────────────────────────
  async getInterns(role, userId) {
    // SQL endpoint nanti: GET /api/interns
    return this._request('getInterns', { role, userId });
  },

  async assignMentor(internId, mentorId) {
    // SQL endpoint nanti: PATCH /api/interns/:id/mentor
    return this._request('assignIntern', { internId, mentorId });
  },

  async getMentors() {
    // SQL endpoint nanti: GET /api/users?role=mentor
    return this._request('getMentors');
  },

  // ─── ATTENDANCE ───────────────────────────────────────────
  async getTodayAttendance(userId) {
    // SQL endpoint nanti: GET /api/attendance/today?userId=
    return this._request('getTodayAttendance', { userId });
  },

  async getAttendance(role, userId) {
    // SQL endpoint nanti: GET /api/attendance?role=&userId=
    return this._request('getAttendance', { role, userId });
  },

  async checkin(userId, name, selfie) {
    // SQL endpoint nanti: POST /api/attendance/checkin
    return this._request('checkin', { userId, name, selfie });
  },

  async checkout(userId, recordId) {
    // SQL endpoint nanti: POST /api/attendance/checkout
    return this._request('checkout', { userId, recordId });
  },

  // ─── TASKS ────────────────────────────────────────────────
  async getTasks(role, userId) {
    // SQL endpoint nanti: GET /api/tasks?role=&userId=
    return this._request('getTasks', { role, userId });
  },

  async createTask(data) {
    // SQL endpoint nanti: POST /api/tasks
    return this._request('createTask', data);
  },

  async updateTask(taskId, status, userId) {
    // SQL endpoint nanti: PATCH /api/tasks/:id
    return this._request('updateTask', { taskId, status, userId });
  },

  // ─── USERS ────────────────────────────────────────────────
  async getUsers() {
    // SQL endpoint nanti: GET /api/users
    return this._request('getUsers');
  },

  async addUser(data) {
    // SQL endpoint nanti: POST /api/users
    return this._request('addUser', data);
  },

  async getProfile(userId) {
    // SQL endpoint nanti: GET /api/users/:id
    return this._request('getProfile', { userId });
  },
};
