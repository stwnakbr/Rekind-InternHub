const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzstOaMNw75q77c2AUwj4cgCYUZ04yYOE4wDy8s4iQGn9FaKN0gub4uDlDYktYcmfhlRQ/exec',
  APP_NAME: 'Rekind InternHub',
  APP_VERSION: '2.0.0',
  MAX_FILE_SIZE_MB: 5,
  SESSION_KEY: 'rih_user',
  CACHE_TTL: 30000, // cache 30 detik
};

// BUG 7 FIX: cache sederhana untuk kurangi request berulang ke GAS
const _cache = new Map();

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CONFIG.CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

// Hapus cache saat data berubah (mutasi)
const MUTATING_ACTIONS = [
  'checkin', 'checkout', 'createTask', 'updateTask', 'deleteTask',
  'updateStatus', 'assignIntern', 'registerCandidate', 'addUser',
  'createVacancy', 'updateVacancyStatus', 'deleteVacancy', 'uploadFile',
  'applyVacancy', 'updateInternPeriod', 'updateVacancy'
];

const DatabaseAdapter = {
  async _request(action, params = {}) {
    // Cek cache untuk action yang bukan mutasi
    const cacheKey = action + ':' + JSON.stringify(params);
    if (!MUTATING_ACTIONS.includes(action)) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    } else {
      // Kalau mutasi, bersihkan semua cache supaya data fresh
      _cache.clear();
    }

    return new Promise((resolve) => {
      const body = JSON.stringify({ action, ...params });
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.API_URL, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          // Simpan ke cache kalau bukan mutasi
          if (!MUTATING_ACTIONS.includes(action)) {
            setCache(cacheKey, result);
          }
          resolve(result);
        } catch {
          resolve({ success: false, error: 'Response tidak valid dari server' });
        }
      };
      xhr.onerror = () => resolve({ success: false, error: 'Tidak bisa terhubung ke server' });
      xhr.timeout = 30000;
      xhr.ontimeout = () => resolve({ success: false, error: 'Request timeout, coba lagi' });
      xhr.send(body);
    });
  },

  // Auth
  async login(email, password) { return this._request('login', { email, password }); },
  async registerCandidate(data) { return this._request('registerCandidate', data); },

  // Vacancies
  async getVacancies() { return this._request('getVacancies'); },
  async getOpenVacancies() { return this._request('getOpenVacancies'); },
  async createVacancy(data) { return this._request('createVacancy', data); },
  async updateVacancyStatus(vacancyId, status) { return this._request('updateVacancyStatus', { vacancyId, status }); },
  async deleteVacancy(vacancyId) { return this._request('deleteVacancy', { vacancyId }); },
  async updateVacancy(data) { return this._request('updateVacancy', data); },
  async updateInternPeriod(candidateId, startDate, endDate) {
    return this._request('updateInternPeriod', { candidateId, startDate, endDate });
  },
  // Candidates
  async getCandidates(role, userId) { return this._request('getCandidates', { role, userId }); },
  async getCandidateStatus(email) { return this._request('getCandidateStatus', { email }); },
  async updateCandidateStatus(candidateId, status, mentorId, interviewDetails = {}, assignedMentorId = '') {
      return this._request('updateStatus', { candidateId, status, mentorId, assignedMentorId, ...interviewDetails });
    },
  async applyVacancy(userId, vacancyId) { return this._request('applyVacancy', { userId, vacancyId }); },

  // Interns
  async getInterns(role, userId) { return this._request('getInterns', { role, userId }); },
  async assignMentor(internId, mentorId) { return this._request('assignIntern', { internId, mentorId }); },

  // Attendance
  async getTodayAttendance(userId) { return this._request('getTodayAttendance', { userId }); },
  async getAttendance(role, userId) { return this._request('getAttendance', { role, userId }); },
  async checkin(userId, name, selfie) { return this._request('checkin', { userId, name, selfie }); },
  async checkout(userId, recordId) { return this._request('checkout', { userId, recordId }); },

  // Tasks
  async getTasks(role, userId) { return this._request('getTasks', { role, userId }); },
  async createTask(data) { return this._request('createTask', data); },
  async updateTask(taskId, data) { return this._request('updateTask', { taskId, ...data }); },
  async deleteTask(taskId) { return this._request('deleteTask', { taskId }); },

  // Dashboard & Users
  async getDashboard(role, userId) { return this._request('getDashboard', { role, userId }); },
  async getMentors() { return this._request('getMentors'); },
  async getUsers() { return this._request('getUsers'); },
  async addUser(data) { return this._request('addUser', data); },
  async getProfile(userId) { return this._request('getProfile', { userId }); },
};

export { CONFIG, DatabaseAdapter };