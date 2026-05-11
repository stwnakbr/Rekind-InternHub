import { DatabaseAdapter } from '../../core/api.js';
import { Auth } from '../../core/auth.js';

export async function initTasks() {
  const user = Auth.getCurrentUser();
  const btnNewTask = document.getElementById('btn-new-task');

  if (user.role === 'mentor' || user.role === 'admin') {
    btnNewTask.style.display = 'inline-flex';
    btnNewTask.addEventListener('click', openNewTaskModal);
  }

  await loadTasks();
}

async function loadTasks() {
  const list = document.getElementById('tasks-list');
  const progress = document.getElementById('tasks-progress');
  const user = Auth.getCurrentUser();

  list.innerHTML = '<div style="color:var(--muted);font-size:13px"><span class="loader"></span> Memuat tugas...</div>';

  const res = await DatabaseAdapter.getTasks(user.role, user.id);
  const tasks = res.tasks || [];

  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Belum ada tugas</p></div>`;
    progress.innerHTML = '';
    return;
  }

  const isMentorOrAdmin = user.role === 'mentor' || user.role === 'admin';

  // BUG 10 FIX: tampilkan info assignee agar intern tahu tugas dari mentor siapa
  // BUG 3 FIX: tambah tombol edit & hapus untuk mentor/admin
  list.innerHTML = tasks.map(t => `
    <div class="task-item">
      <div class="task-check ${t.status === 'Done' ? 'done' : ''}"
           data-id="${t.id}" data-status="${t.status || 'Todo'}">
        ${t.status === 'Done' ? '✓' : ''}
      </div>
      <div style="flex:1">
        <div class="task-title ${t.status === 'Done' ? 'done' : ''}">${t.title}</div>
        <div class="task-meta">
          ${t.assignee_name ? `👤 ${t.assignee_name}` : ''}
          ${t.due_date ? ` · 📅 ${formatTanggal(t.due_date)}` : ''}
          · <span style="color:${statusColor(t.status)}">${t.status || 'Todo'}</span>
        </div>
        ${t.description ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${t.description}</div>` : ''}
      </div>
      <span class="task-priority priority-${(t.priority || 'medium').toLowerCase()}">${t.priority || 'Medium'}</span>
      ${isMentorOrAdmin ? `
        <div style="display:flex;gap:6px;margin-left:8px">
          <button class="btn btn-outline" style="padding:4px 10px;font-size:12px"
            onclick="openEditTaskModal('${t.id}','${escHtml(t.title)}','${escHtml(t.description||'')}','${t.priority||'Medium'}','${t.due_date||''}','${t.assignee_id||''}','${t.status||'Todo'}')">
            ✏️
          </button>
          <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;color:var(--danger)"
            onclick="confirmDeleteTask('${t.id}')">
            🗑️
          </button>
        </div>` : ''}
    </div>`).join('');

  // Toggle done untuk intern
  document.querySelectorAll('.task-check').forEach(chk => {
    chk.addEventListener('click', (e) => {
      if (user.role === 'intern') {
        toggleTask(e.currentTarget.dataset.id, e.currentTarget.dataset.status);
      }
    });
  });

  // Progress
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  progress.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-family:'Syne',sans-serif;font-size:42px;font-weight:800;color:var(--ink)">${pct}%</div>
      <div style="font-size:13px;color:var(--muted)">${done} dari ${tasks.length} tugas selesai</div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div style="margin-top:16px">
      ${['Todo','In Progress','Done'].map(s => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border)">
          <span>${s}</span>
          <strong>${tasks.filter(t => (t.status || 'Todo') === s).length}</strong>
        </div>`).join('')}
    </div>`;
}

// ── Modal Buat Tugas Baru ─────────────────────────────────────

async function openNewTaskModal() {
  const user = Auth.getCurrentUser();
  const res = await DatabaseAdapter.getInterns(user.role, user.id);
  const interns = res.interns || [];

  openModal(`
    <div class="modal-header">
      <h3>📋 Tugas Baru</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field">
      <label>Judul Tugas</label>
      <input type="text" id="task-title" placeholder="Nama tugas">
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Assign ke</label>
        <select id="task-assignee">
          <option value="">— Pilih intern —</option>
          ${interns.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Prioritas</label>
        <select id="task-priority">
          <option>High</option>
          <option selected>Medium</option>
          <option>Low</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Status</label>
        <select id="task-status">
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      </div>
      <div class="form-field">
        <label>Deadline</label>
        <input type="date" id="task-due">
      </div>
    </div>
    <div class="form-field">
      <label>Deskripsi</label>
      <textarea id="task-desc" placeholder="Deskripsi tugas..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-submit-task">Buat Tugas</button>
    </div>`);

  document.getElementById('btn-submit-task').addEventListener('click', submitNewTask);
}

async function submitNewTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return toast('Judul tugas wajib', 'error');

  const btn = document.getElementById('btn-submit-task');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  const res = await DatabaseAdapter.createTask({
    title,
    assigneeId: document.getElementById('task-assignee').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    dueDate: document.getElementById('task-due').value,
    description: document.getElementById('task-desc').value,
    mentorId: Auth.getCurrentUser().id,
  });

  btn.disabled = false;
  btn.textContent = 'Buat Tugas';

  if (res.success) {
    toast('✅ Tugas dibuat!', 'success');
    closeModal();
    await loadTasks();
  } else {
    toast(res.error || 'Gagal membuat tugas', 'error');
  }
}

// ── BUG 3 FIX: Modal Edit Tugas ──────────────────────────────

window.openEditTaskModal = async function(taskId, title, description, priority, dueDate, assigneeId, status) {
  const user = Auth.getCurrentUser();
  const res = await DatabaseAdapter.getInterns(user.role, user.id);
  const interns = res.interns || [];

  openModal(`
    <div class="modal-header">
      <h3>✏️ Edit Tugas</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-field">
      <label>Judul Tugas</label>
      <input type="text" id="edit-task-title" value="${title}">
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Assign ke</label>
        <select id="edit-task-assignee">
          <option value="">— Pilih intern —</option>
          ${interns.map(i => `<option value="${i.id}" ${i.id === assigneeId ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Prioritas</label>
        <select id="edit-task-priority">
          ${['High','Medium','Low'].map(p => `<option ${p === priority ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-field">
        <label>Status</label>
        <select id="edit-task-status">
          ${['Todo','In Progress','Done'].map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Deadline</label>
        <input type="date" id="edit-task-due" value="${dueDate}">
      </div>
    </div>
    <div class="form-field">
      <label>Deskripsi</label>
      <textarea id="edit-task-desc">${description}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary-btn" id="btn-save-task">Simpan Perubahan</button>
    </div>`);

  document.getElementById('btn-save-task').addEventListener('click', async () => {
    const newTitle = document.getElementById('edit-task-title').value.trim();
    if (!newTitle) return toast('Judul tugas wajib', 'error');

    const btn = document.getElementById('btn-save-task');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const saveRes = await DatabaseAdapter.updateTask(taskId, {
      title: newTitle,
      assigneeId: document.getElementById('edit-task-assignee').value,
      priority: document.getElementById('edit-task-priority').value,
      status: document.getElementById('edit-task-status').value,
      dueDate: document.getElementById('edit-task-due').value,
      description: document.getElementById('edit-task-desc').value,
    });

    btn.disabled = false;
    btn.textContent = 'Simpan Perubahan';

    if (saveRes.success) {
      toast('✅ Tugas diperbarui!', 'success');
      closeModal();
      await loadTasks();
    } else {
      toast(saveRes.error || 'Gagal update tugas', 'error');
    }
  });
};

window.confirmDeleteTask = function(taskId) {
  openModal(`
    <div class="modal-header">
      <h3>🗑️ Hapus Tugas</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="margin:16px 0">Yakin ingin menghapus tugas ini? Tindakan tidak bisa dibatalkan.</p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-danger" id="btn-confirm-delete">Hapus</button>
    </div>`);

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    const res = await DatabaseAdapter.deleteTask(taskId);
    if (res.success) {
      toast('🗑️ Tugas dihapus', 'info');
      closeModal();
      await loadTasks();
    } else {
      toast(res.error || 'Gagal hapus tugas', 'error');
    }
  });
};

async function toggleTask(taskId, currentStatus) {
  const user = Auth.getCurrentUser();
  const newStatus = currentStatus === 'Done' ? 'In Progress' : 'Done';
  const res = await DatabaseAdapter.updateTask(taskId, { status: newStatus }, user.id);
  if (res.success) await loadTasks();
  else toast(res.error || 'Gagal update tugas', 'error');
}

// ── Helpers ───────────────────────────────────────────────────

// BUG 8 FIX: format tanggal dd/mm/yyyy
function formatTanggal(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function statusColor(status) {
  return { 'Done': 'var(--success)', 'In Progress': '#f59e0b', 'Todo': 'var(--muted)' }[status] || 'var(--muted)';
}

function escHtml(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}