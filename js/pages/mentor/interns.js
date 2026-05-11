import { DatabaseAdapter } from '../../core/api.js';
import { Auth } from '../../core/auth.js';

export async function initInterns() {
  await loadInterns();
}

async function loadInterns() {
  const tbody = document.getElementById('interns-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><span class="loader"></span></td></tr>';
  const user = Auth.getCurrentUser();
  const res = await DatabaseAdapter.getInterns(user.role, user.id);
  const interns = res.interns || [];

  if (!interns.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">🎓</div><p>Belum ada intern aktif</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = interns.map(i => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="candidate-photo">${i.photo_url ? `<img src="${i.photo_url}" onerror="this.parentElement.textContent='👤'">` : '👤'}</div>
          <div style="font-weight:600;font-size:13px">${i.name}</div>
        </div>
      </td>
      <td>${i.email}</td>
      <td>${i.campus||'-'}</td>
      <td>${i.mentor_name||'<em style="color:var(--muted)">Belum assign</em>'}</td>
      <td><span class="status-badge status-active">${i.status||'Aktif'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${i.cv_url ? `<a href="${i.cv_url}" target="_blank" class="btn btn-outline btn-sm">📄 CV</a>` : ''}
          ${user.role === 'admin' ? `<button class="btn btn-info btn-sm btn-assign" data-id="${i.id}" data-name="${i.name}">👤 Assign</button>` : ''}
        </div>
      </td>
    </tr>`).join('');

  document.querySelectorAll('.btn-assign').forEach(btn => {
    btn.addEventListener('click', (e) => openAssignMentorModal(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
  });
}

async function openAssignMentorModal(internId, internName) {
  const res = await DatabaseAdapter.getMentors();
  const mentors = res.mentors || [];
  openModal(`
    <div class="modal-header"><h3>👤 Assign Mentor — ${internName}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-field">
      <label>Pilih Mentor</label>
      <select id="assign-mentor-select">
        <option value="">— Pilih mentor —</option>
        ${mentors.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-do-assign">Simpan</button>
    </div>`);
  document.getElementById('btn-do-assign').addEventListener('click', async () => {
    const mentorId = document.getElementById('assign-mentor-select').value;
    if (!mentorId) return toast('Pilih mentor dulu', 'error');
    const res = await DatabaseAdapter.assignMentor(internId, mentorId);
    if (res.success) { toast('Mentor di-assign', 'success'); closeModal(); loadInterns(); }
    else toast(res.error || 'Gagal assign', 'error');
  });
}
