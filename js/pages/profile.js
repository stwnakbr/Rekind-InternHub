import { DatabaseAdapter } from '../core/api.js';
import { Auth } from '../core/auth.js';

export async function initProfile() {
  await loadProfile();
}

async function loadProfile() {
  const userObj = Auth.getCurrentUser();
  const res = await DatabaseAdapter.getProfile(userObj.id);
  const user = res.user || userObj;

  const avatarEl = document.getElementById('profile-avatar');
  if (user.photo_url) {
    avatarEl.innerHTML = `<img src="${user.photo_url}" alt="${user.name}">`;
  } else {
    avatarEl.textContent = (user.name || '?')[0].toUpperCase();
  }

  let roleLabel = { admin:'Admin', mentor:'Mentor', intern:'Intern' }[user.role] || user.role;
  if (user.status === 'Pending' || user.status === 'Interview') roleLabel = 'Kandidat';

  document.getElementById('profile-name').textContent = user.name || '-';
  document.getElementById('profile-info').textContent = `${user.email} · ${roleLabel}`;
  document.getElementById('profile-badges').innerHTML = `<span class="role-badge role-${user.role}">${roleLabel}</span>`;

  document.getElementById('profile-details').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${[
        ['Nama Lengkap', user.name],
        ['Email',        user.email],
        ['No HP',        user.phone  || '-'],
        ['Kampus',       user.campus || '-'],
        ['Role',         roleLabel],
        ['Status',       user.status || 'Aktif'],
      ].map(([k, v]) => `
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted);font-weight:600;margin-bottom:4px">${k}</div>
          <div style="font-size:14px;font-weight:500">${v}</div>
        </div>`).join('')}
    </div>
    ${user.cv_url
      ? `<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
           <a href="${user.cv_url}" target="_blank" class="btn btn-outline">📄 Lihat CV Saya</a>
         </div>`
      : ''}`;
}
