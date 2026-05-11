import { DatabaseAdapter } from '../core/api.js';
import { Auth } from '../core/auth.js';

export async function initUsers() {
  if (Auth.getCurrentUser().role !== 'admin') {
    document.getElementById('router-view').innerHTML = '<div class="empty-state">Akses Ditolak</div>';
    return;
  }
  document.getElementById('btn-add-user').addEventListener('click', openAddUserModal);
  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('users-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center"><span class="loader"></span></td></tr>';
  const res = await DatabaseAdapter.getUsers();
  const users = res.users || [];

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Belum ada pengguna</div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td><span class="status-badge status-active">${u.status || 'Aktif'}</span></td>
    </tr>`).join('');
}

function openAddUserModal() {
  openModal(`
    <div class="modal-header"><h3>➕ Tambah Pengguna</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-field"><label>Nama</label><input type="text" id="new-user-name" placeholder="Nama lengkap"></div>
    <div class="form-field"><label>Email</label><input type="email" id="new-user-email" placeholder="email@contoh.com"></div>
    <div class="form-field"><label>Password</label><input type="password" id="new-user-pass" placeholder="Password awal"></div>
    <div class="form-field">
      <label>Role</label>
      <select id="new-user-role"><option value="intern">Intern</option><option value="mentor">Mentor</option><option value="admin">Admin</option></select>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary-btn" id="btn-submit-user">Tambah</button></div>
  `);
  document.getElementById('btn-submit-user').addEventListener('click', submitAddUser);
}

async function submitAddUser() {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-pass').value;
  const role = document.getElementById('new-user-role').value;
  
  if (!name || !email || !password) return toast('Lengkapi semua field', 'error');

  const res = await DatabaseAdapter.addUser({ name, email, password, role });
  if (res.success) { toast('✅ User ditambahkan', 'success'); closeModal(); loadUsers(); }
  else toast(res.error || 'Gagal menambahkan user', 'error');
}
