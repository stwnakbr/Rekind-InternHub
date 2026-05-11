import { DatabaseAdapter } from '../core/api.js';
import { Auth } from '../core/auth.js';

export async function initCandidates() {
  await loadCandidates();
}

function safe(val) {
  if (!val || val.trim() === '') return '-';
  if (val.startsWith('http') || val.startsWith('drive.google')) return '-';
  return val;
}

async function loadCandidates() {
  const tbody = document.getElementById('candidates-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><span class="loader"></span></td></tr>';
  const user = Auth.getCurrentUser();
  const res = await DatabaseAdapter.getCandidates(user.role, user.id);
  const candidates = res.candidates || [];

  if (!candidates.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">👥</div><p>Belum ada data lamaran</p></div></td></tr>`;
    return;
  }

  // Jika kandidat biasa (bukan admin/mentor), tampilkan semua lamarannya
  const isCandidateView = user.role !== 'admin' && user.role !== 'mentor';

  tbody.innerHTML = candidates.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="candidate-photo">${c.photo_url ? `<img src="${c.photo_url}" onerror="this.parentElement.textContent='👤'">` : '👤'}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${c.name}</div>
            <div style="font-size:11px;color:var(--muted)">${safe(c.campus)}</div>
          </div>
        </div>
      </td>
      <td><strong>${c.vacancy_title || '-'}</strong></td>
      <td>${c.email}<br><span style="font-size:11px;color:var(--muted)">${c.phone||'-'}</span></td>
      <td>
        <span class="status-badge status-${(c.status||'pending').toLowerCase()}">${c.status || 'Pending'}</span>
        ${c.intern_start_date ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">📅 ${formatTanggal(c.intern_start_date)} — ${c.intern_end_date ? formatTanggal(c.intern_end_date) : '?'}</div>` : ''}
      </td>
      <td>
        <button class="btn btn-outline btn-sm btn-view-profile" data-id="${c.id}">👁 Lihat Profil</button>
        ${isCandidateView && c.status === 'Pending' ? `
          <button class="btn btn-outline btn-sm btn-set-period" data-id="${c.id}" style="margin-top:4px;font-size:11px">
            📅 Set Periode
          </button>` : ''}
      </td>
    </tr>`).join('');

  window._candidatesData = candidates;

  document.querySelectorAll('.btn-view-profile').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      const candidate = window._candidatesData.find(c => c.id === id);
      if (candidate) openCandidateProfileModal(candidate);
    });
  });

  document.querySelectorAll('.btn-set-period').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      const candidate = window._candidatesData.find(c => c.id === id);
      if (candidate) openSetPeriodModal(candidate);
    });
  });
}

// Modal set periode magang (untuk kandidat)
function openSetPeriodModal(c) {
  openModal(`
    <div class="modal-header">
      <h3>📅 Periode Magang</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
      Isi periode magang yang Anda inginkan untuk lamaran <strong>${c.vacancy_title || '-'}</strong>.
      Informasi ini bersifat preferensi dan tidak mengikat.
    </p>
    <div class="form-grid">
      <div class="form-field">
        <label>Tanggal Mulai</label>
        <input type="date" id="period-start" value="${c.intern_start_date || ''}">
      </div>
      <div class="form-field">
        <label>Tanggal Selesai</label>
        <input type="date" id="period-end" value="${c.intern_end_date || ''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-save-period">Simpan</button>
    </div>`);

  document.getElementById('btn-save-period').addEventListener('click', async () => {
    const startDate = document.getElementById('period-start').value;
    const endDate = document.getElementById('period-end').value;
    const btn = document.getElementById('btn-save-period');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const res = await DatabaseAdapter.updateInternPeriod(c.id, startDate, endDate);
    btn.disabled = false; btn.textContent = 'Simpan';
    if (res.success) {
      toast('✅ Periode magang disimpan!', 'success');
      closeModal();
      await loadCandidates();
    } else {
      toast(res.error || 'Gagal menyimpan', 'error');
    }
  });
}

function openCandidateProfileModal(c) {
  const user = Auth.getCurrentUser();
  const canAct = user.role === 'admin' || user.role === 'mentor';
  const status = c.status || 'Pending';

  const stepColors = {
    Pending:   ['var(--primary)', 'var(--border)',  'var(--border)'],
    Interview: ['var(--primary)', 'var(--primary)', 'var(--border)'],
    Accepted:  ['var(--primary)', 'var(--primary)', 'var(--success)'],
    Rejected:  ['var(--primary)', 'var(--primary)', 'var(--danger)'],
  };
  const colors = stepColors[status] || stepColors.Pending;
  const steps = ['Review Berkas', 'Interview', 'Keputusan'];

  const interviewInfo = (status === 'Interview' && c.interview_date) ? `
    <div style="background:rgba(106,13,173,0.06);border:1px solid rgba(106,13,173,0.15);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#8a2be2;margin-bottom:10px">📅 Jadwal Interview</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
        <div><span style="color:var(--muted)">Tanggal:</span><br><strong>${formatTanggal(c.interview_date)}</strong></div>
        <div><span style="color:var(--muted)">Waktu:</span><br><strong>${formatTime(c.interview_time)} WIB</strong></div>
      </div>
      ${c.interview_location ? `<div style="margin-top:8px;font-size:13px"><span style="color:var(--muted)">Tempat/Link:</span><br>
        <strong>${c.interview_location.startsWith('http') 
          ? `<a href="${c.interview_location}" target="_blank" style="color:var(--primary)">${c.interview_location}</a>` 
          : c.interview_location}</strong>
      </div>` : ''}
    </div>` : '';

  // Periode magang yang diinginkan kandidat
  const periodInfo = (c.intern_start_date || c.intern_end_date) ? `
    <div style="background:rgba(0,102,179,0.06);border:1px solid rgba(0,102,179,0.15);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#0066b3;margin-bottom:8px">📅 Preferensi Periode Magang</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
        <div><span style="color:var(--muted)">Mulai:</span><br><strong>${c.intern_start_date ? formatTanggal(c.intern_start_date) : '-'}</strong></div>
        <div><span style="color:var(--muted)">Selesai:</span><br><strong>${c.intern_end_date ? formatTanggal(c.intern_end_date) : '-'}</strong></div>
      </div>
    </div>` : '';

  let actionButtons = '';
  if (canAct) {
    if (status === 'Pending') {
      actionButtons = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
          <button class="btn btn-info" id="btn-call-interview" data-id="${c.id}" style="flex:1">📞 Panggil Interview</button>
          <button class="btn btn-danger btn-modal-action" data-id="${c.id}" data-action="Rejected" style="flex:1">✗ Tolak</button>
        </div>`;
    } else if (status === 'Interview') {
      actionButtons = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
          <button class="btn btn-success btn-modal-action" data-id="${c.id}" data-action="Accepted" style="flex:1">✓ Terima sebagai Intern</button>
          <button class="btn btn-danger btn-modal-action" data-id="${c.id}" data-action="Rejected" style="flex:1">✗ Tolak</button>
        </div>`;
    } else if (status === 'Accepted') {
      actionButtons = `<div style="margin-top:16px;color:var(--success);font-weight:600;font-size:13px;text-align:center">✅ Kandidat sudah diterima sebagai Intern</div>`;
    } else if (status === 'Rejected') {
      actionButtons = `<div style="margin-top:16px;color:var(--danger);font-weight:600;font-size:13px;text-align:center">❌ Kandidat telah ditolak</div>`;
    }
  }

  openModal(`
    <div class="modal-header" style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:0">
      <h3>👤 Profil Kandidat</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="background:linear-gradient(135deg,var(--ink),#1e2a45);padding:24px;margin:0 -28px;display:flex;gap:18px;align-items:center">
      <div style="width:72px;height:72px;border-radius:16px;overflow:hidden;background:var(--primary);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:white;font-family:'Syne',sans-serif;">
        ${c.photo_url ? `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover"/>` : c.name[0].toUpperCase()}
      </div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:white">${c.name}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px">${c.email}</div>
        <div style="margin-top:8px"><span class="status-badge status-${status.toLowerCase()}">${status}</span></div>
      </div>
    </div>

    <div style="padding:20px 0 12px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[
        ['📍 Kampus',        safe(c.campus)],
        ['📱 No HP',         c.phone || '-'],
        ['💼 Posisi Dilamar', c.vacancy_title || '-'],
        ['📅 Tanggal Daftar', c.applied_at ? formatTanggal(c.applied_at.split(' ')[0]) : '-'],
      ].map(([k, v]) => `
        <div style="background:var(--paper);border-radius:var(--radius-sm);padding:12px 14px">
          <div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">${k}</div>
          <div style="font-size:14px;font-weight:500;color:var(--ink)">${v}</div>
        </div>`).join('')}
    </div>

    ${periodInfo}
    ${interviewInfo}

    <div style="padding:16px;background:var(--paper);border-radius:var(--radius-sm);margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:16px">Tahap Seleksi</div>
      <div style="display:flex;align-items:flex-start">
        ${steps.map((label, i) => `
          <div style="flex:1;text-align:center;position:relative">
            ${i < steps.length - 1 ? `<div style="position:absolute;top:16px;left:50%;right:-50%;height:3px;background:${colors[i+1] !== 'var(--border)' ? colors[i] : 'var(--border)'};z-index:0"></div>` : ''}
            <div style="width:32px;height:32px;border-radius:50%;background:${colors[i]};margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;position:relative;z-index:1">
              ${colors[i] !== 'var(--border)' ? '✓' : i + 1}
            </div>
            <div style="font-size:11px;font-weight:600;color:${colors[i] !== 'var(--border)' ? 'var(--ink)' : 'var(--muted)'}">${label}</div>
          </div>`).join('')}
      </div>
    </div>

    ${c.cv_url ? `<a href="${c.cv_url}" target="_blank" class="btn btn-outline" style="width:100%;justify-content:center;margin-bottom:8px">📄 Lihat CV / Portfolio</a>` : ''}

    ${actionButtons}
  `);

  const btnCallInterview = document.getElementById('btn-call-interview');
  if (btnCallInterview) {
    btnCallInterview.addEventListener('click', () => {
      const id = btnCallInterview.dataset.id;
      closeModal();
      openInterviewScheduleModal(id, c.name);
    });
  }

  document.querySelectorAll('.btn-modal-action').forEach(btn => {
    btn.addEventListener('click', async e => {
      const { id, action } = e.currentTarget.dataset;
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = 'Memproses...';
      await updateCandidateStatus(id, action, {});
      closeModal();
    });
  });
}

function openInterviewScheduleModal(candidateId, candidateName) {
  const today = new Date().toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <h3>📞 Jadwal Interview — ${candidateName}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Tanggal Interview</label>
        <input type="date" id="itvw-date" min="${today}" value="${today}">
      </div>
      <div class="form-field">
        <label>Waktu Interview</label>
        <input type="time" id="itvw-time" value="09:00">
      </div>
    </div>
    <div class="form-field">
      <label>Tempat / Link Interview</label>
      <input type="text" id="itvw-location" placeholder="Cth: Ruang Rapat Lt.3 atau https://meet.google.com/xxx">
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-info" id="btn-confirm-interview">📞 Konfirmasi & Panggil Interview</button>
    </div>
  `);

  document.getElementById('btn-confirm-interview').addEventListener('click', async () => {
    const date     = document.getElementById('itvw-date').value;
    const time     = document.getElementById('itvw-time').value;
    const location = document.getElementById('itvw-location').value.trim();
    if (!date) return toast('Tanggal interview wajib diisi', 'error');

    const btn = document.getElementById('btn-confirm-interview');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    await updateCandidateStatus(candidateId, 'Interview', {
      interviewDate: date,
      interviewTime: time,
      interviewLocation: location,
    });
    closeModal();
  });
}

async function updateCandidateStatus(id, status, interviewDetails) {
  const user = Auth.getCurrentUser();
  const res = await DatabaseAdapter.updateCandidateStatus(id, status, user.id, interviewDetails);
  if (res.success) {
    const labels = {
      Interview: '📞 Kandidat dipanggil interview!',
      Accepted:  '✅ Kandidat diterima sebagai Intern!',
      Rejected:  '❌ Kandidat ditolak',
    };
    toast(labels[status] || `Status: ${status}`, status === 'Rejected' ? 'error' : 'success');
    loadCandidates();
  } else {
    toast(res.error || 'Gagal update status', 'error');
  }
}

// ── Helpers ──────────────────────────────────────────────────
function formatTanggal(str) {
  if (!str) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatTime(str) {
  if (!str || str === '-') return '-';
  const match = String(str).match(/(\d{2}:\d{2})/);
  if (match) return match[1];
  return str;
}
