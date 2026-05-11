import { DatabaseAdapter } from '../../core/api.js';
import { Auth } from '../../core/auth.js';

// ── Auto-logout 5 menit idle ──────────────────────────────────
let inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    Auth.logout();
    window.location.reload();
  }, 5 * 60 * 1000);
}
['click','mousemove','keydown','scroll','touchstart'].forEach(evt =>
  document.addEventListener(evt, resetInactivityTimer, { passive: true })
);

export async function initDashboard() {
  resetInactivityTimer();

  const user = await Auth.syncUserSession();
  if (!user) return;

  const isKandidat = (user.role !== 'admin' && user.role !== 'mentor' && user.role !== 'intern')
    || (user.role === 'intern' && (user.status === 'Pending' || user.status === 'Interview'));

  if (isKandidat) {
    document.getElementById('candidate-view').style.display = 'block';
    document.getElementById('active-view').style.display   = 'none';

    const btnBrowse = document.getElementById('btn-go-browse');
    if (btnBrowse) {
      btnBrowse.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.appRouter) window.appRouter.navigate('/vacancies-browse');
      });
    }

    let candidates = [];
    try {
      const res = await DatabaseAdapter.getCandidates(user.role, user.id);
      if (res.success) candidates = res.candidates || [];
    } catch (e) {}

    // Buang entri tanpa vacancy
    candidates = candidates.filter(c =>
      c.vacancy_id    && c.vacancy_id.trim()    !== '' && c.vacancy_id    !== 'null' &&
      c.vacancy_title && c.vacancy_title.trim() !== '' && c.vacancy_title !== 'null'
    );

    renderCandidateView(candidates);
  } else {
    document.getElementById('candidate-view').style.display = 'none';
    document.getElementById('active-view').style.display   = 'block';
    await loadDashboardStats(user);
  }
}

// ── Render status kandidat ────────────────────────────────────
function renderCandidateView(candidates) {
  const listEl       = document.getElementById('all-applications-list');
  const infoBox      = document.getElementById('cand-info-box');
  const scheduleCard = document.getElementById('interview-schedule-card');

  if (scheduleCard) scheduleCard.style.display = 'none';
  if (infoBox)      infoBox.style.display      = 'none';

  // ── Belum ada lamaran ─────────────────────────────────────────
  if (!candidates.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:48px 24px">
        <div style="font-size:64px;margin-bottom:20px;filter:drop-shadow(0 4px 12px rgba(0,102,179,0.2))">💼</div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:10px;
                    background:linear-gradient(135deg,var(--primary),#8a2be2);
                    -webkit-background-clip:text;-webkit-text-fill-color:transparent">
          Mulai Perjalanan Magang Anda
        </div>
        <p style="color:var(--muted);font-size:14px;margin-bottom:28px;line-height:1.7;
                  max-width:380px;margin-left:auto;margin-right:auto">
          Anda belum melamar ke posisi magang manapun.<br>
          Temukan posisi yang sesuai dengan minat dan kemampuan Anda.
        </p>
        <button onclick="window.appRouter && window.appRouter.navigate('/vacancies-browse')"
                style="background:linear-gradient(135deg,var(--primary),#8a2be2);color:white;
                       border:none;border-radius:12px;padding:14px 32px;font-size:15px;
                       font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;
                       box-shadow:0 4px 20px rgba(0,102,179,0.35);transition:transform 0.15s"
                onmouseover="this.style.transform='translateY(-2px)'"
                onmouseout="this.style.transform='translateY(0)'">
          🔍 Lihat Lowongan Tersedia
        </button>
        <div style="margin-top:36px;display:flex;justify-content:center;gap:36px;flex-wrap:wrap">
          ${[['📄','Lengkapi Profil','Pastikan data Anda sudah lengkap'],
             ['🔍','Cari Lowongan','Temukan posisi yang sesuai'],
             ['✉️','Kirim Lamaran','Lamar dengan satu klik']
            ].map(([icon,title,desc]) => `
            <div style="text-align:center;max-width:120px">
              <div style="font-size:28px;margin-bottom:8px">${icon}</div>
              <div style="font-size:12px;font-weight:700;color:var(--ink)">${title}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">${desc}</div>
            </div>`).join('')}
        </div>
      </div>`;
    return;
  }

  // ── Ada lamaran ───────────────────────────────────────────────
  if (infoBox) infoBox.style.display = 'block';

  const priority = { Accepted:4, Interview:3, Pending:2, Rejected:1 };
  const best = [...candidates].sort((a,b) => (priority[b.status]||0)-(priority[a.status]||0))[0];
  if (best && infoBox) {
    const msgs = {
      Pending:   '📋 <strong>Dalam Proses Review.</strong> Tim kami sedang meninjau berkas Anda.',
      Interview: '📌 <strong>Dipanggil Interview!</strong> Selamat, Anda lolos seleksi berkas. Cek jadwal di bawah.',
      Accepted:  '🎉 <strong>Selamat, Anda Diterima!</strong> Silakan login ulang untuk akses fitur intern.',
      Rejected:  '📩 <strong>Belum Berhasil.</strong> Anda masih bisa melamar posisi lain.',
    };
    const colors = { Pending:'var(--primary)', Interview:'#8a2be2', Accepted:'var(--success)', Rejected:'var(--danger)' };
    infoBox.innerHTML = msgs[best.status] || msgs.Pending;
    infoBox.style.borderLeftColor = colors[best.status] || 'var(--primary)';
  }

  listEl.innerHTML = candidates.map(c => {
    const status = c.status || 'Pending';
    let step = 1;
    if (status === 'Interview')                         step = 2;
    if (status === 'Accepted' || status === 'Rejected') step = 3;
    const lineWidth = step === 1 ? '0%' : step === 2 ? '50%' : '100%';

    const circles = [
      { label:'Review Berkas', desc:'Selesai', bg:'var(--primary)', color:'white', icon:'✓' },
      { label:'Interview',
        desc: step > 2 ? 'Selesai' : step === 2 ? 'Dalam Proses' : 'Menunggu',
        bg: step >= 2 ? 'var(--primary)' : 'var(--border)',
        color: step >= 2 ? 'white' : 'var(--muted)',
        icon: step > 2 ? '✓' : '2' },
      { label:'Keputusan Akhir',
        desc: status === 'Accepted' ? '🎉 Diterima!' : status === 'Rejected' ? 'Mohon Maaf' : 'Menunggu',
        bg: step < 3 ? 'var(--border)' : status === 'Accepted' ? 'var(--success)' : 'var(--danger)',
        color: step >= 3 ? 'white' : 'var(--muted)',
        icon: status === 'Accepted' ? '✓' : status === 'Rejected' ? '✗' : '3' },
    ];

    const borderColor = { Pending:'var(--border)', Interview:'#8a2be2', Accepted:'var(--success)', Rejected:'var(--danger)' }[status] || 'var(--border)';
    const bgColor     = { Interview:'rgba(106,13,173,0.03)', Accepted:'rgba(0,166,81,0.03)', Rejected:'rgba(200,68,26,0.03)' }[status] || 'var(--white)';

    let extraHtml = '';
    if (status === 'Interview' && c.interview_date) {
      const loc = c.interview_location
        ? (c.interview_location.startsWith('http')
            ? `<a href="${c.interview_location}" target="_blank" style="color:var(--primary)">${c.interview_location}</a>`
            : c.interview_location)
        : '-';
      extraHtml = `
        <div style="margin-top:14px;background:rgba(106,13,173,0.06);
             border:1px solid rgba(106,13,173,0.18);border-radius:var(--radius-sm);padding:14px;font-size:13px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a2be2;margin-bottom:10px">📅 Jadwal Interview</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><div style="color:var(--muted);font-size:11px;margin-bottom:3px">TANGGAL</div>
              <strong>${formatTanggal(c.interview_date)}</strong></div>
            <div><div style="color:var(--muted);font-size:11px;margin-bottom:3px">WAKTU</div>
              <strong>${formatWaktu(c.interview_time)} WIB</strong></div>
          </div>
          ${c.interview_location ? `<div style="margin-top:8px">
            <div style="color:var(--muted);font-size:11px;margin-bottom:3px">TEMPAT / LINK</div>
            <strong>${loc}</strong></div>` : ''}
        </div>`;
    }

    const periode = c.intern_start_date
      ? `📅 ${formatTanggal(c.intern_start_date)}${c.intern_end_date ? ' — ' + formatTanggal(c.intern_end_date) : ''}`
      : '';

    return `
    <div style="border:1.5px solid ${borderColor};border-radius:12px;padding:20px;margin-bottom:16px;
                background:${bgColor};transition:box-shadow 0.2s"
         onmouseover="this.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)'"
         onmouseout="this.style.boxShadow='none'">

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:4px">
            💼 ${c.vacancy_title}
          </div>
          <div style="font-size:11px;color:var(--muted)">
            Daftar: ${c.applied_at ? formatTanggalLengkap(c.applied_at) : '-'}
            ${periode ? ' &nbsp;·&nbsp; ' + periode : ''}
          </div>
        </div>
        <span class="status-badge status-${status.toLowerCase()}">${status}</span>
      </div>

      <div style="display:flex;justify-content:space-between;position:relative;padding:0 16px">
        <div style="position:absolute;top:15px;left:calc(16%);right:calc(16%);height:3px;background:var(--border);z-index:1"></div>
        <div style="position:absolute;top:15px;left:calc(16%);height:3px;background:var(--primary);z-index:2;
                    width:${lineWidth};transition:width 0.4s ease;max-width:68%"></div>
        ${circles.map(ci => `
          <div style="position:relative;z-index:3;text-align:center;width:33%">
            <div style="width:32px;height:32px;border-radius:50%;background:${ci.bg};color:${ci.color};
                 display:flex;align-items:center;justify-content:center;margin:0 auto 8px;
                 font-weight:700;font-size:13px;
                 box-shadow:${ci.bg !== 'var(--border)' ? '0 2px 8px rgba(0,102,179,0.3)' : 'none'}">
              ${ci.icon}
            </div>
            <div style="font-size:12px;font-weight:600">${ci.label}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${ci.desc}</div>
          </div>`).join('')}
      </div>
      ${extraHtml}
    </div>`;
  }).join('');
}

// ── Dashboard aktif ───────────────────────────────────────────
async function loadDashboardStats(user) {
  const grid  = document.getElementById('stats-grid');
  const cards = document.getElementById('dashboard-cards');
  grid.innerHTML = '<div style="color:var(--muted);font-size:13px"><span class="loader"></span> Memuat...</div>';

  const res = await DatabaseAdapter.getDashboard(user.role, user.id);
  if (!res.success) { grid.innerHTML = '<p style="color:var(--muted)">Gagal memuat data</p>'; return; }
  const d = res.data;

  if (user.role === 'admin') {
    grid.innerHTML = `
      <div class="stat-card" style="--accent-color:#0066b3"><div class="stat-icon">👥</div><div class="stat-value">${d.totalCandidates||0}</div><div class="stat-label">Total Kandidat</div></div>
      <div class="stat-card" style="--accent-color:#ff6600"><div class="stat-icon">⏳</div><div class="stat-value">${d.pendingCandidates||0}</div><div class="stat-label">Menunggu Review</div></div>
      <div class="stat-card" style="--accent-color:#0066b3"><div class="stat-icon">🎓</div><div class="stat-value">${d.totalInterns||0}</div><div class="stat-label">Intern Aktif</div></div>
      <div class="stat-card" style="--accent-color:#00a651"><div class="stat-icon">✅</div><div class="stat-value">${d.todayAttendance||0}</div><div class="stat-label">Hadir Hari Ini</div></div>`;
  } else if (user.role === 'mentor') {
    const pct = d.taskSummary?.total ? Math.round((d.taskSummary.done/d.taskSummary.total)*100) : 0;
    grid.innerHTML = `
      <div class="stat-card" style="--accent-color:#0066b3"><div class="stat-icon">🎓</div><div class="stat-value">${d.totalInterns||0}</div><div class="stat-label">Intern Saya</div></div>
      <div class="stat-card" style="--accent-color:#00a651"><div class="stat-icon">✅</div><div class="stat-value">${d.todayAttendance||0}</div><div class="stat-label">Hadir Hari Ini</div></div>
      <div class="stat-card" style="--accent-color:#8a2be2"><div class="stat-icon">📋</div><div class="stat-value">${d.taskSummary?.total||0}</div><div class="stat-label">Total Tugas</div></div>
      <div class="stat-card" style="--accent-color:#f59e0b"><div class="stat-icon">🏆</div><div class="stat-value">${pct}%</div><div class="stat-label">Tugas Selesai</div></div>`;
  } else {
    const ok = d.todayCheckin || false;
    grid.innerHTML = `
      <div class="stat-card" style="--accent-color:${ok?'#00a651':'#ff6600'}"><div class="stat-icon">${ok?'✅':'⏰'}</div><div class="stat-value">${ok?'Sudah':'Belum'}</div><div class="stat-label">Absen Hari Ini</div></div>
      <div class="stat-card" style="--accent-color:#0066b3"><div class="stat-icon">📋</div><div class="stat-value">${d.taskSummary?.total||0}</div><div class="stat-label">Total Tugas</div></div>
      <div class="stat-card" style="--accent-color:#00a651"><div class="stat-icon">✓</div><div class="stat-value">${d.taskSummary?.done||0}</div><div class="stat-label">Tugas Selesai</div></div>
      <div class="stat-card" style="--accent-color:#8a2be2"><div class="stat-icon">📅</div><div class="stat-value">${d.totalAttendance||0}</div><div class="stat-label">Total Hadir</div></div>`;
  }

  const pct = d.taskSummary?.total ? Math.round((d.taskSummary.done/d.taskSummary.total)*100) : 0;
  const aktivitasHtml = (d.recentActivity||[]).length
    ? d.recentActivity.map(a=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--muted);font-size:11px">${formatTanggal(a.time)}</span><br>${a.text}</div>`).join('')
    : '<div class="empty-state"><div class="icon">📭</div><p>Belum ada aktivitas</p></div>';

  cards.innerHTML = `
    <div class="content-card">
      <div class="card-header"><span class="card-title">⚡ Aktivitas Terbaru</span></div>
      <div class="card-body">${aktivitasHtml}</div>
    </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────
function formatTanggal(str) {
  if (!str || str === '-') return '-';
  if (str.includes(' ')) return formatTanggal(str.split(' ')[0]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y,m,d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function formatTanggalLengkap(str) {
  if (!str) return '-';
  return formatTanggal(str.split(' ')[0]);
}
function formatWaktu(str) {
  if (!str || str === '-') return '-';
  const m = String(str).match(/(\d{2}:\d{2})/);
  return m ? m[1] : str;
}