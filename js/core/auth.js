import { CONFIG, DatabaseAdapter } from './api.js';
import { appRouter } from './router.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.fileData = { photo: null, cv: null };
  }

  init() {
    const saved = localStorage.getItem(CONFIG.SESSION_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch {
        localStorage.removeItem(CONFIG.SESSION_KEY);
      }
    }

    // Tandai tab ini sudah diverifikasi login manual
    // Kalau sessionStorage tidak ada flagnya, berarti tab baru → paksa login ulang
    if (!sessionStorage.getItem('tab_authenticated')) {
      this.currentUser = null;
    }

    // Auto logout setelah 5 menit tidak ada aktivitas
    this._startInactivityTimer();
    ['click','keydown','mousemove','scroll','touchstart'].forEach(evt => {
      window.addEventListener(evt, () => this._resetInactivityTimer(), { passive: true });
    });
  }

  _startInactivityTimer() {
    this._inactivityTimer = setTimeout(() => {
      if (this.isAuthenticated()) {
        toast('⏱️ Sesi habis karena tidak ada aktivitas. Silakan login ulang.', 'info');
        setTimeout(() => this.logout(), 2000);
      }
    }, 5 * 60 * 1000); // 5 menit
  }

  _resetInactivityTimer() {
    clearTimeout(this._inactivityTimer);
    this._startInactivityTimer();
  }

  isAuthenticated() { return this.currentUser !== null; }
  getCurrentUser() { return this.currentUser; }

  async syncUserSession() {
    if (!this.currentUser) return null;
    const res = await DatabaseAdapter.getProfile(this.currentUser.id);
    if (res.success && res.user) {
      this.currentUser = res.user;

      // Sinkronisasi status dari Candidates sheet agar tidak stuck di Pending
      if (['Pending', 'Interview', 'Accepted', 'Rejected'].includes(this.currentUser.status)) {
        const candRes = await DatabaseAdapter.getCandidateStatus(this.currentUser.email);
        if (candRes.success && candRes.status) {
          this.currentUser.status = candRes.status;
        }
      }

      localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(this.currentUser));
    }
    return this.currentUser;
  }

  async login(email, password) {
    if (!email || !password) return { success: false, error: 'Isi email dan password' };
    // [FIX 2] Email case-insensitive: selalu kirim lowercase ke server
    const res = await DatabaseAdapter.login(email.toLowerCase().trim(), password);
    if (res.success && res.user) {
      this.currentUser = res.user;
      localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(this.currentUser));
      sessionStorage.setItem('tab_authenticated', '1');
    }
    return res;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
    sessionStorage.removeItem('tab_authenticated');
    clearTimeout(this._inactivityTimer); 
    this.showLoginScreen();
  }

  showLoginScreen() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    this.toggleAuthForms('login');
  }

  hideLoginScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }

  toggleAuthForms(form) {
    if (form === 'register') {
      document.getElementById('register-panel').style.display = 'block';
      document.querySelector('.auth-toggle').style.display = 'none';
      document.getElementById('btn-login').style.display = 'none';
      document.querySelectorAll('#auth-screen .field')[0].style.display = 'none';
      document.querySelectorAll('#auth-screen .field')[1].style.display = 'none';
    } else {
      document.getElementById('register-panel').style.display = 'none';
      document.querySelector('.auth-toggle').style.display = 'block';
      document.getElementById('btn-login').style.display = 'block';
      document.querySelectorAll('#auth-screen .field')[0].style.display = 'block';
      document.querySelectorAll('#auth-screen .field')[1].style.display = 'block';
    }
  }

  // BUG 13 FIX: reset semua field setelah register berhasil
  resetRegisterForm() {
    const fields = ['reg-name', 'reg-email', 'reg-phone', 'reg-campus', 'reg-password'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const photoPreview = document.getElementById('photo-preview');
    const cvPreview = document.getElementById('cv-preview');
    if (photoPreview) photoPreview.innerHTML = '';
    if (cvPreview) cvPreview.innerHTML = '';
    this.fileData = { photo: null, cv: null };
  }

  handleFileSelect(input, type) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.showAuthError(`File terlalu besar! Maks ${CONFIG.MAX_FILE_SIZE_MB}MB`);
      input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.fileData[type] = { base64: e.target.result.split(',')[1], name: file.name, mime: file.type };
      const preview = document.getElementById(type + '-preview');
      if (!preview) return;
      if (type === 'photo') {
        preview.innerHTML = `<img src="${e.target.result}" style="max-width:70px;max-height:70px;border-radius:8px;margin-top:8px;">`;
      } else {
        preview.innerHTML = `<div class="file-name">📄 ${file.name}</div>`;
      }
    };
    reader.readAsDataURL(file);
  }

  showAuthError(msg, isSuccess = false) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
    if (isSuccess) {
      el.style.background = 'rgba(26,138,74,0.15)';
      el.style.borderColor = 'rgba(26,138,74,0.3)';
      el.style.color = '#6adea0';
    } else {
      el.style.background = 'rgba(200,68,26,0.15)';
      el.style.borderColor = 'rgba(200,68,26,0.3)';
      el.style.color = '#ff8a6a';
    }
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // BUG 14 FIX: register tanpa pilih posisi — posisi dipilih setelah login
  async doRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const campus = document.getElementById('reg-campus').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !phone || !campus || !password) return this.showAuthError('Lengkapi semua field');
    if (!this.fileData.photo) return this.showAuthError('Upload foto wajib!');
    if (!this.fileData.cv) return this.showAuthError('Upload CV wajib!');

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    document.getElementById('register-text').innerHTML = '<span class="loader"></span> Mengupload...';

    const res = await DatabaseAdapter.registerCandidate({
      vacancyId: '',  // kosong dulu, pilih setelah login
      name, email, phone, campus, password,
      photo: this.fileData.photo,
      cv: this.fileData.cv,
    });

    btn.disabled = false;
    document.getElementById('register-text').textContent = 'Kirim Pendaftaran';

    if (res.success) {
      this.showAuthError('✅ Pendaftaran berhasil! Silakan login.', true);
      this.resetRegisterForm(); // BUG 13 FIX
      setTimeout(() => this.toggleAuthForms('login'), 2000);
    } else {
      this.showAuthError(res.error || 'Pendaftaran gagal');
    }
  }
}

export const Auth = new AuthManager();