import { DatabaseAdapter } from '../../core/api.js';
import { Auth } from '../../core/auth.js';

export async function initVacancies() {
  const user = Auth.getCurrentUser();
  if (user.role !== 'admin' && user.role !== 'mentor') {
    document.getElementById('router-view').innerHTML =
      `<div class="empty-state"><h3>Akses ditolak</h3><p>Halaman ini hanya untuk admin dan mentor.</p></div>`;
    return;
  }

  const btnNew = document.getElementById('btn-new-vacancy');
  if (btnNew) btnNew.addEventListener('click', openNewVacancyModal);

  await loadVacancies();
}

async function loadVacancies() {
  const tbody = document.getElementById('vacancies-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6"><span class="loader"></span> Memuat...</td></tr>`;

  const res = await DatabaseAdapter.getVacancies();
  const vacancies = res.vacancies || [];

  if (!vacancies.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><div class="icon">💼</div><p>Belum ada lowongan</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = vacancies.map(v => `
    <tr>
      <td>
        <strong>${v.title}</strong>
        ${v.description ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.description}</div>` : ''}
      </td>
      <td>${v.quota || '-'}</td>
      <td><span class="badge ${v.status === 'Open' ? 'badge-success' : 'badge-danger'}">${v.status}</span></td>
      <td>
        ${v.start_date
          ? `${formatTanggal(v.start_date)}${v.end_date ? '<br><span style="font-size:11px;color:var(--muted)">s.d. ' + formatTanggal(v.end_date) + '</span>' : ''}`
          : '<span style="color:var(--muted);font-size:12px">Tidak ditentukan</span>'}
      </td>
      <td>${formatTanggal(v.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline" style="font-size:12px;padding:4px 10px"
            onclick="openEditVacancyModal('${v.id}','${escHtml(v.title)}','${escHtml(v.description||'')}','${v.quota||''}','${v.status}','${v.start_date||''}','${v.end_date||''}')">
            ✏️ Edit
          </button>
          <button class="btn btn-outline" style="font-size:12px;padding:4px 10px;color:var(--danger)"
            onclick="confirmDeleteVacancy('${v.id}')">
            🗑️
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function openNewVacancyModal() {
  openModal(`
    <div class="modal-header">
      <h3>💼 Lowongan Baru</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field">
      <label>Judul Posisi</label>
      <input type="text" id="vac-title" placeholder="cth: Frontend Developer">
    </div>
    <div class="form-field">
      <label>Deskripsi</label>
      <textarea id="vac-desc" placeholder="Deskripsi posisi..."></textarea>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Kuota</label>
        <input type="number" id="vac-quota" placeholder="cth: 3">
      </div>
      <div class="form-field">
        <label>Status</label>
        <select id="vac-status">
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Periode Mulai</label>
        <input type="date" id="vac-start">
      </div>
      <div class="form-field">
        <label>Periode Selesai</label>
        <input type="date" id="vac-end">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-submit-vacancy">Buat Lowongan</button>
    </div>`);

  document.getElementById('btn-submit-vacancy').addEventListener('click', async () => {
    const title = document.getElementById('vac-title').value.trim();
    if (!title) return toast('Judul wajib diisi', 'error');

    const btn = document.getElementById('btn-submit-vacancy');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    const res = await DatabaseAdapter.createVacancy({
      title,
      description: document.getElementById('vac-desc').value,
      quota: document.getElementById('vac-quota').value,
      startDate: document.getElementById('vac-start').value,
      endDate: document.getElementById('vac-end').value,
      createdBy: Auth.getCurrentUser().id,
    });

    btn.disabled = false; btn.textContent = 'Buat Lowongan';

    if (res.success) {
      toast('✅ Lowongan dibuat!', 'success');
      closeModal();
      await loadVacancies();
    } else {
      toast(res.error || 'Gagal membuat lowongan', 'error');
    }
  });
}

window.openEditVacancyModal = function(id, title, description, quota, status, startDate, endDate) {
  openModal(`
    <div class="modal-header">
      <h3>✏️ Edit Lowongan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field">
      <label>Judul Posisi</label>
      <input type="text" id="edit-vac-title" value="${title}">
    </div>
    <div class="form-field">
      <label>Deskripsi</label>
      <textarea id="edit-vac-desc">${description}</textarea>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Kuota</label>
        <input type="number" id="edit-vac-quota" value="${quota}">
      </div>
      <div class="form-field">
        <label>Status</label>
        <select id="edit-vac-status">
          <option value="Open" ${status === 'Open' ? 'selected' : ''}>Open</option>
          <option value="Closed" ${status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Periode Mulai</label>
        <input type="date" id="edit-vac-start" value="${startDate}">
      </div>
      <div class="form-field">
        <label>Periode Selesai</label>
        <input type="date" id="edit-vac-end" value="${endDate}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-save-vacancy">Simpan</button>
    </div>`);

  document.getElementById('btn-save-vacancy').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-vacancy');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    const res = await DatabaseAdapter.updateVacancy({
      vacancyId: id,
      title: document.getElementById('edit-vac-title').value.trim(),
      description: document.getElementById('edit-vac-desc').value,
      quota: document.getElementById('edit-vac-quota').value,
      status: document.getElementById('edit-vac-status').value,
      startDate: document.getElementById('edit-vac-start').value,
      endDate: document.getElementById('edit-vac-end').value,
    });

    btn.disabled = false; btn.textContent = 'Simpan';

    if (res.success) {
      toast('✅ Lowongan diperbarui!', 'success');
      closeModal();
      await loadVacancies();
    } else {
      toast(res.error || 'Gagal update lowongan', 'error');
    }
  });
};

window.confirmDeleteVacancy = function(vacancyId) {
  openModal(`
    <div class="modal-header">
      <h3>🗑️ Hapus Lowongan</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="margin:16px 0">Yakin ingin menghapus lowongan ini?</p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-danger" id="btn-confirm-delete-vac">Hapus</button>
    </div>`);

  document.getElementById('btn-confirm-delete-vac').addEventListener('click', async () => {
    const res = await DatabaseAdapter.deleteVacancy(vacancyId);
    if (res.success) {
      toast('🗑️ Lowongan dihapus', 'info');
      closeModal();
      await loadVacancies();
    } else {
      toast(res.error || 'Gagal hapus', 'error');
    }
  });
};

// BUG 8 FIX: format tanggal dd/mm/yyyy
function formatTanggal(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function escHtml(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}