import { DatabaseAdapter } from '../core/api.js';
import { Auth } from '../core/auth.js';

let clockInterval;
let isAbsenLoading  = false;
let _sudahAbsen     = false;  // state lokal, tidak bergantung cache
let _jamAbsen       = '';

export async function initAttendance() {
  _sudahAbsen = false;
  _jamAbsen   = '';
  startClock();
  await loadAttendance();
  return () => { if (clockInterval) clearInterval(clockInterval); };
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  const tick = () => {
    const now = new Date();
    const el  = document.getElementById('clock-display');
    const de  = document.getElementById('date-display');
    if (el) el.textContent = formatJam(now);
    if (de) de.textContent = formatTanggalPanjang(now);
  };
  tick();
  clockInterval = setInterval(tick, 1000);
}

async function loadAttendance() {
  const actionsEl = document.getElementById('attendance-actions');
  const tbody     = document.getElementById('attendance-body');
  const user      = Auth.getCurrentUser();

  const todayRes = await DatabaseAdapter.getTodayAttendance(user.id);
  const today    = todayRes.record;

  // Sinkronisasi state lokal dengan server
  if (today && today.checkin_time) {
    _sudahAbsen = true;
    _jamAbsen   = today.checkin_time;
  }

  renderTombol(user, actionsEl);

  const histRes = await DatabaseAdapter.getAttendance(user.role, user.id);
  const records = histRes.records || [];

  tbody.innerHTML = records.length
    ? records.map(r => `
        <tr>
          <td>${r.name || '-'}</td>
          <td>${formatTanggalID(r.date)}</td>
          <td>${r.checkin_time ? formatJamStr(r.checkin_time) + ' WIB' : '-'}</td>
        </tr>`).join('')
    : `<tr><td colspan="3">
        <div class="empty-state"><div class="icon">🕐</div><p>Belum ada data absensi</p></div>
       </td></tr>`;
}

function renderTombol(user, actionsEl) {
  actionsEl.innerHTML = '';
  if (user.role !== 'intern') return;

  if (_sudahAbsen) {
    actionsEl.innerHTML = `
      <div style="background:rgba(0,166,81,0.15);border:1px solid rgba(0,166,81,0.3);
                  border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:26px;margin-bottom:6px">✅</div>
        <div style="font-weight:700;color:rgba(255,255,255,0.9);font-size:14px">Sudah Absen Hari Ini</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:6px">
          ${_jamAbsen ? formatJamStr(_jamAbsen) + ' WIB' : ''}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:10px;
                    border-top:1px solid rgba(255,255,255,0.1);padding-top:10px">
        </div>
      </div>`;
  } else {
    actionsEl.innerHTML = `
      <button class="btn btn-success" id="btn-do-absen"
              style="font-size:15px;padding:14px 0;width:100%;letter-spacing:0.5px">
        ✅ Absen Sekarang
      </button>`;

    document.getElementById('btn-do-absen').addEventListener('click', () => {
      if (isAbsenLoading) return;
      // Disable tombol langsung sebelum modal terbuka
      document.getElementById('btn-do-absen').disabled = true;
      openAbsenModal();
    });
  }
}

function openAbsenModal() {
  openModal(`
    <div class="modal-header">
      <h3>✅ Absen Sekarang</h3>
      <button class="modal-close" onclick="closeModal(); _batalAbsen()">✕</button>
    </div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
      Waktu: <strong id="modal-clock">${formatJam(new Date())} WIB</strong>
    </p>
    <div class="form-field">
      <label>Selfie <span style="color:var(--muted);font-weight:400">(opsional)</span></label>
      <div class="file-upload-zone">
        <input type="file" id="selfie-input" accept="image/*" capture="user">
        <div class="file-upload-icon">🤳</div>
        <div class="file-upload-text"><strong>Ambil atau unggah</strong> selfie</div>
        <div class="file-preview" id="selfie-preview"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal(); _batalAbsen()">Batal</button>
      <button class="btn btn-success" id="btn-submit-absen">Konfirmasi Absen</button>
    </div>`);

  // Jam berjalan di modal
  const mc = setInterval(() => {
    const el = document.getElementById('modal-clock');
    if (el) el.textContent = formatJam(new Date()) + ' WIB';
    else clearInterval(mc);
  }, 1000);

  document.getElementById('selfie-input').addEventListener('change', function () {
    Auth.handleFileSelect(this, 'selfie');
  });

  document.getElementById('btn-submit-absen').addEventListener('click', async () => {
    if (isAbsenLoading) return;
    isAbsenLoading = true;
    const btn = document.getElementById('btn-submit-absen');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    clearInterval(mc);
    await submitAbsen();
    isAbsenLoading = false;
  });
}

// Dipanggil saat user batal (tutup modal tanpa absen)
window._batalAbsen = function () {
  if (_sudahAbsen) return; // kalau sudah absen, tombol tetap nonaktif
  const btn = document.getElementById('btn-do-absen');
  if (btn) btn.disabled = false;
};

async function submitAbsen() {
  const user = Auth.getCurrentUser();
  const res  = await DatabaseAdapter.checkin(user.id, user.name, Auth.fileData?.selfie || null);

  if (res.success) {
    // Set state lokal SEBELUM re-render — tidak bergantung cache
    _sudahAbsen = true;
    _jamAbsen   = res.checkin_time || formatJam(new Date());

    toast('✅ Absen berhasil!', 'success');
    closeModal();
    if (Auth.fileData) Auth.fileData.selfie = null;

    // Re-render tombol langsung
    renderTombol(user, document.getElementById('attendance-actions'));

    // Refresh tabel riwayat
    const histRes = await DatabaseAdapter.getAttendance(user.role, user.id);
    const records = histRes.records || [];
    const tbody   = document.getElementById('attendance-body');
    if (tbody) {
      tbody.innerHTML = records.length
        ? records.map(r => `
            <tr>
              <td>${r.name || '-'}</td>
              <td>${formatTanggalID(r.date)}</td>
              <td>${r.checkin_time ? formatJamStr(r.checkin_time) + ' WIB' : '-'}</td>
            </tr>`).join('')
        : `<tr><td colspan="3"><div class="empty-state"><div class="icon">🕐</div><p>Belum ada data absensi</p></div></td></tr>`;
    }
  } else {
    // Jika server bilang sudah absen, sinkronisasi state lokal
    if (res.error && res.error.toLowerCase().includes('sudah')) {
      _sudahAbsen = true;
      renderTombol(Auth.getCurrentUser(), document.getElementById('attendance-actions'));
    } else {
      // Absen gagal bukan karena double — aktifkan tombol kembali
      window._batalAbsen();
    }
    toast(res.error || 'Absen gagal', 'error');
    closeModal();
  }
}

// ── Helpers ───────────────────────────────────────────────────
function formatTanggalID(str) {
  if (!str) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatJam(d) {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2,'0')).join(':');
}

function formatJamStr(str) {
  if (!str) return '-';
  const m = String(str).match(/\d{2}:\d{2}/);
  return m ? m[0] : str;
}

function formatTanggalPanjang(d) {
  const hari  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  return `${hari[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}