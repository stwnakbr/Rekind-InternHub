import { DatabaseAdapter } from '../core/api.js';
import { Auth } from '../core/auth.js';

export async function initVacanciesCandidate() {
  const user = Auth.getCurrentUser();
  await loadOpenVacancies(user);
  await loadMyApplications(user);

  document.getElementById('btn-my-applications').addEventListener('click', toggleMyApplications);
}

async function loadOpenVacancies(user) {
  const container = document.getElementById('vacancies-list-candidate');
  const res = await DatabaseAdapter.getOpenVacancies();
  const vacancies = res.vacancies || [];

  // Ambil lamaran user ini untuk cek sudah melamar atau belum
  const myAppsRes = await DatabaseAdapter.getCandidates(user.role, user.id);
  const myAppliedIds = (myAppsRes.candidates || []).map(c => c.vacancy_id);

  if (!vacancies.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💼</div><p>Belum ada lowongan yang tersedia saat ini</p></div>`;
    return;
  }

  container.innerHTML = vacancies.map(v => {
    const alreadyApplied = myAppliedIds.includes(v.id);
    return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:20px;margin-bottom:16px;transition:box-shadow 0.2s" 
         onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" 
         onmouseout="this.style.boxShadow='none'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <h4 style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin:0">${v.title}</h4>
            <span class="badge badge-success">Open</span>
          </div>
          ${v.description ? `<p style="font-size:13px;color:var(--muted);margin:0 0 10px;line-height:1.6">${v.description}</p>` : ''}
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--muted)">
            ${v.quota ? `<span>👥 Kuota: <strong>${v.quota} orang</strong></span>` : ''}
            ${v.start_date ? `<span>📅 Periode: <strong>${formatTanggal(v.start_date)}${v.end_date ? ' — ' + formatTanggal(v.end_date) : ''}</strong></span>` : ''}
          </div>
        </div>
        <div style="flex-shrink:0">
          ${alreadyApplied
            ? `<span class="badge badge-success" style="font-size:12px;padding:8px 14px">✓ Sudah Melamar</span>`
            : `<button class="btn btn-primary-btn btn-apply" data-id="${v.id}" data-title="${escHtml(v.title)}" style="white-space:nowrap">
                ✉️ Lamar Sekarang
               </button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.btn-apply').forEach(btn => {
    btn.addEventListener('click', async e => {
      const vacancyId = e.currentTarget.dataset.id;
      const vacancyTitle = e.currentTarget.dataset.title;
      openApplyModal(user, vacancyId, vacancyTitle);
    });
  });
}

function openApplyModal(user, vacancyId, vacancyTitle) {
  openModal(`
    <div class="modal-header">
      <h3>✉️ Ajukan Lamaran</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="background:var(--paper);border-radius:var(--radius-sm);padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Posisi</div>
      <div style="font-size:16px;font-weight:700;font-family:'Syne',sans-serif">${vacancyTitle}</div>
    </div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
      Isi preferensi periode magang Anda (opsional). Informasi ini membantu tim kami dalam penjadwalan.
    </p>
    <div class="form-grid">
      <div class="form-field">
        <label>Preferensi Mulai (opsional)</label>
        <input type="date" id="apply-start">
      </div>
      <div class="form-field">
        <label>Preferensi Selesai (opsional)</label>
        <input type="date" id="apply-end">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-submit-apply">✉️ Kirim Lamaran</button>
    </div>`);

  document.getElementById('btn-submit-apply').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit-apply');
    btn.disabled = true; btn.textContent = 'Mengirim...';

    const res = await DatabaseAdapter.applyVacancy(user.id, vacancyId);
    
    if (res.success) {
      // Simpan periode jika diisi
      const startDate = document.getElementById('apply-start').value;
      const endDate = document.getElementById('apply-end').value;
      if ((startDate || endDate) && res.candidateId) {
        await DatabaseAdapter.updateInternPeriod(res.candidateId, startDate, endDate);
      }
      toast('✅ Lamaran berhasil dikirim!', 'success');
      closeModal();
      // Refresh halaman
      await loadOpenVacancies(user);
      await loadMyApplications(user);
    } else {
      toast(res.error || 'Gagal mengirim lamaran', 'error');
      btn.disabled = false; btn.textContent = '✉️ Kirim Lamaran';
    }
  });
}

async function loadMyApplications(user) {
  const res = await DatabaseAdapter.getCandidates(user.role, user.id);
  const candidates = res.candidates || [];
  
  // Update counter
  const countEl = document.getElementById('app-count');
  if (countEl) countEl.textContent = candidates.length;

  const tbody = document.getElementById('my-applications-body');
  if (!tbody) return;

  if (!candidates.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">📋</div><p>Belum ada lamaran</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = candidates.map(c => `
    <tr>
      <td><strong>${c.vacancy_title || '-'}</strong></td>
      <td>${c.applied_at ? formatTanggalWaktu(c.applied_at) : '-'}</td>
      <td>
        ${c.intern_start_date
          ? `${formatTanggal(c.intern_start_date)} — ${c.intern_end_date ? formatTanggal(c.intern_end_date) : '?'}`
          : '<span style="color:var(--muted);font-size:12px">Belum diisi</span>'}
      </td>
      <td>
        <span class="status-badge status-${(c.status||'pending').toLowerCase()}">${c.status || 'Pending'}</span>
        ${c.status === 'Interview' && c.interview_date ? `
          <div style="font-size:11px;color:#8a2be2;margin-top:4px">
            📅 ${formatTanggal(c.interview_date)} ${formatTime(c.interview_time)} WIB
          </div>` : ''}
      </td>
      <td>
        ${c.status === 'Pending' ? `
          <button class="btn btn-outline" style="font-size:11px;padding:4px 10px" 
            onclick="openSetPeriodInline('${c.id}','${c.intern_start_date||''}','${c.intern_end_date||''}')">
            📅 ${c.intern_start_date ? 'Ubah' : 'Set'} Periode
          </button>` : ''}
      </td>
    </tr>`).join('');
}

window.openSetPeriodInline = function(candidateId, startDate, endDate) {
  openModal(`
    <div class="modal-header">
      <h3>📅 Set Preferensi Periode Magang</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Tanggal Mulai</label>
        <input type="date" id="inline-start" value="${startDate}">
      </div>
      <div class="form-field">
        <label>Tanggal Selesai</label>
        <input type="date" id="inline-end" value="${endDate}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-save-inline-period">Simpan</button>
    </div>`);

  document.getElementById('btn-save-inline-period').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-inline-period');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const res = await DatabaseAdapter.updateInternPeriod(
      candidateId,
      document.getElementById('inline-start').value,
      document.getElementById('inline-end').value
    );
    if (res.success) {
      toast('✅ Periode disimpan!', 'success');
      closeModal();
      const user = Auth.getCurrentUser();
      await loadMyApplications(user);
    } else {
      toast(res.error || 'Gagal menyimpan', 'error');
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  });
};

function toggleMyApplications() {
  const panel = document.getElementById('my-applications-panel');
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'block';
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

function formatTanggalWaktu(str) {
  if (!str) return '-';
  // "2026-05-08 14:30:00" → "08/05/2026, 14:30 WIB"
  const parts = str.split(' ');
  const tgl = formatTanggal(parts[0]);
  if (parts[1]) {
    const jam = parts[1].substring(0, 5);
    return `${tgl}, ${jam} WIB`;
  }
  return tgl;
}

function formatTime(str) {
  if (!str || str === '-') return '-';
  const match = String(str).match(/(\d{2}:\d{2})/);
  if (match) return match[1];
  return str;
}

function escHtml(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
