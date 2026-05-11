/**
 * ============================================================
 * REKIND INTERNHUB — Google Apps Script Backend
 * ============================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Buka script.google.com → Buat project baru
 * 2. Tempel seluruh kode ini
 * 3. Edit SPREADSHEET_ID dan FOLDER_ID di bagian CONFIG
 * 4. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy URL deployment ke index.html (variabel API_URL)
 * 
 * SHEETS YANG DIPERLUKAN:
 * - Users       : id | name | email | password_hash | role | status | phone | campus | photo_url | cv_url | created_at
 * - Candidates  : id | name | email | phone | campus | status | photo_url | cv_url | applied_at | reviewed_by | reviewed_at
 * - Interns     : id | candidate_id | name | email | phone | campus | mentor_id | mentor_name | status | photo_url | cv_url | start_date
 * - Attendance  : id | user_id | name | date | checkin_time | checkout_time | duration | selfie_url | notes
 * - Tasks       : id | title | description | assignee_id | assignee_name | mentor_id | priority | status | due_date | created_at | updated_at
 * ============================================================
 */

// ============================================================
// CONFIG — SUDAH DIISI (JANGAN DIUBAH)
// ============================================================
const CONFIG = {
  SPREADSHEET_ID: '1RGTBfQ1_PgANDrBEr6oXRIc3kvpwOpHuiZiJ30nTx2Q',   // Google Sheets
  PHOTOS_FOLDER_ID: '1CmuwfGLK8wMEobN8a7WnUSIXAKomxaGq',            // Folder Foto
  CV_FOLDER_ID: '1d59XfWjmKTM4dq_1S1esTQOaCOqq-MIr',               // Folder CV
  SELFIE_FOLDER_ID: '1kf7UeGVNQTEMa_7RZtBK3DN2fUDTctZm',           // Folder Selfie
  MAX_FILE_SIZE: 5 * 1024 * 1024,                                   // 5MB
};

// ============================================================
// MAIN ENTRY POINT
// ============================================================
function doPost(e) {
  try {
    // Support both application/json and text/plain (untuk bypass CORS preflight)
    const raw = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const { action, ...params } = body;

    const handlers = {
      login: handleLogin,
      registerCandidate: handleRegisterCandidate,
      getCandidates: handleGetCandidates,
      getInterns: handleGetInterns,
      updateStatus: handleUpdateStatus,
      assignIntern: handleAssignIntern,
      checkin: handleCheckin,
      checkout: handleCheckout,
      getTodayAttendance: handleGetTodayAttendance,
      getAttendance: handleGetAttendance,
      getTasks: handleGetTasks,
      createTask: handleCreateTask,
      updateTask: handleUpdateTask,
      getDashboard: handleGetDashboard,
      getMentors: handleGetMentors,
      getProfile: handleGetProfile,
      getUsers: handleGetUsers,
      addUser: handleAddUser,
      uploadFile: handleUploadFile,
    };

    if (!handlers[action]) {
      return respond({ success: false, error: 'Action tidak dikenal: ' + action });
    }

    return respond(handlers[action](params));

  } catch (err) {
    Logger.log('Error: ' + err.toString() + '\n' + err.stack);
    return respond({ success: false, error: 'Server error: ' + err.message });
  }
}

function doGet(e) {
  return respond({ success: true, message: 'Rekind InternHub API aktif', version: '1.0' });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    Users: ['id','name','email','password_hash','role','status','phone','campus','photo_url','cv_url','created_at'],
    Candidates: ['id','name','email','phone','campus','status','photo_url','cv_url','applied_at','reviewed_by','reviewed_at'],
    Interns: ['id','candidate_id','name','email','phone','campus','mentor_id','mentor_name','status','photo_url','cv_url','start_date'],
    Attendance: ['id','user_id','name','date','checkin_time','checkout_time','duration','selfie_url','notes'],
    Tasks: ['id','title','description','assignee_id','assignee_name','mentor_id','priority','status','due_date','created_at','updated_at'],
  };
  if (headers[name]) sheet.appendRow(headers[name]);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]) : ''; });
    return obj;
  }).filter(obj => obj.id && obj.id !== '');
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function hashPassword(password) {
  // Simple hash (untuk production, gunakan yang lebih aman)
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function nowString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function todayString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
// FILE UPLOAD TO GOOGLE DRIVE
// ============================================================
function uploadToDrive(base64Data, fileName, mimeType, folderId) {
  try {
    if (!base64Data) throw new Error('Tidak ada data file');
    
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    // Set sharing dalam try-catch agar jika gagal, upload tetap sukses
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingErr) {
      Logger.log('Gagal set sharing (tapi file tetap terupload): ' + sharingErr.toString());
    }
    
    const fileId = file.getId();
    // Return direct view URL
    const viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    const downloadUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    
    return { success: true, fileId, viewUrl, downloadUrl, name: fileName };
  } catch (err) {
    Logger.log('Upload error: ' + err.toString());
    return { success: false, error: err.message };
  }
}

function handleUploadFile({ base64, fileName, mimeType, type }) {
  const folderIds = {
    photo: CONFIG.PHOTOS_FOLDER_ID,
    cv: CONFIG.CV_FOLDER_ID,
    selfie: CONFIG.SELFIE_FOLDER_ID,
  };
  const folderId = folderIds[type] || CONFIG.PHOTOS_FOLDER_ID;
  return uploadToDrive(base64, fileName || ('file_' + Date.now()), mimeType || 'application/octet-stream', folderId);
}

// ============================================================
// AUTH
// ============================================================
function handleLogin({ email, password }) {
  if (!email || !password) return { success: false, error: 'Email dan password wajib diisi' };
  
  const users = sheetToObjects(getSheet('Users'));
  const hash = hashPassword(password);
  const user = users.find(u => u.email === email && u.password_hash === hash);
  
  if (!user) return { success: false, error: 'Email atau password salah' };
  if (user.status === 'Inactive') return { success: false, error: 'Akun tidak aktif' };
  
  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      campus: user.campus,
      photo_url: user.photo_url,
      cv_url: user.cv_url,
      status: user.status,
    }
  };
}

// ============================================================
// REGISTRATION
// ============================================================
function handleRegisterCandidate({ name, email, phone, campus, password, photo, cv }) {
  if (!name || !email || !password) return { success: false, error: 'Field wajib tidak lengkap' };
  
  // Cek email duplikat
  const users = sheetToObjects(getSheet('Users'));
  const candidates = sheetToObjects(getSheet('Candidates'));
  
  if (users.find(u => u.email === email) || candidates.find(c => c.email === email)) {
    return { success: false, error: 'Email sudah terdaftar' };
  }

  // Upload foto
  let photoUrl = '';
  if (photo && photo.base64) {
    const result = uploadToDrive(
      photo.base64, 
      'photo_' + Date.now() + '_' + name.replace(/\s/g,'_') + getExtension(photo.mime),
      photo.mime || 'image/jpeg',
      CONFIG.PHOTOS_FOLDER_ID
    );
    if (!result.success) return { success: false, error: 'Gagal upload foto: ' + result.error };
    photoUrl = result.viewUrl;
  }

  // Upload CV
  let cvUrl = '';
  if (cv && cv.base64) {
    const result = uploadToDrive(
      cv.base64,
      'cv_' + Date.now() + '_' + name.replace(/\s/g,'_') + getExtension(cv.mime),
      cv.mime || 'application/pdf',
      CONFIG.CV_FOLDER_ID
    );
    if (!result.success) return { success: false, error: 'Gagal upload CV: ' + result.error };
    cvUrl = result.downloadUrl;
  }

  const candidateId = generateId('cand');
  const userId = generateId('usr');
  const now = nowString();
  
  // Simpan ke Candidates
  getSheet('Candidates').appendRow([
    candidateId, name, email, phone, campus, 'Pending',
    photoUrl, cvUrl, now, '', ''
  ]);
  
  // Buat akun user dengan role intern (pending acceptance)
  getSheet('Users').appendRow([
    userId, name, email, hashPassword(password),
    'intern', 'Pending', phone, campus, photoUrl, cvUrl, now
  ]);
  
  return { success: true, candidateId, message: 'Pendaftaran berhasil! Menunggu review.' };
}

function getExtension(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[mime] || '';
}

// ============================================================
// CANDIDATES
// ============================================================
function handleGetCandidates({ role, userId }) {
  const candidates = sheetToObjects(getSheet('Candidates'));
  return {
    success: true,
    candidates: candidates.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      campus: c.campus,
      status: c.status || 'Pending',
      photo_url: c.photo_url,
      cv_url: c.cv_url,
      applied_at: c.applied_at,
    }))
  };
}

function handleUpdateStatus({ candidateId, status, mentorId }) {
  if (!['Accepted', 'Rejected', 'Pending'].includes(status)) {
    return { success: false, error: 'Status tidak valid' };
  }
  
  const sheet = getSheet('Candidates');
  const candidates = sheetToObjects(sheet);
  const candidate = candidates.find(c => c.id === candidateId);
  
  if (!candidate) return { success: false, error: 'Kandidat tidak ditemukan' };
  
  // Update status
  const row = candidate._row;
  const headers = sheet.getDataRange().getValues()[0];
  const statusCol = headers.indexOf('status') + 1;
  const reviewedByCol = headers.indexOf('reviewed_by') + 1;
  const reviewedAtCol = headers.indexOf('reviewed_at') + 1;
  
  sheet.getRange(row, statusCol).setValue(status);
  if (reviewedByCol > 0) sheet.getRange(row, reviewedByCol).setValue(mentorId || '');
  if (reviewedAtCol > 0) sheet.getRange(row, reviewedAtCol).setValue(nowString());
  
  // Update status di Users juga
  const userSheet = getSheet('Users');
  const users = sheetToObjects(userSheet);
  const user = users.find(u => u.email === candidate.email);
  if (user) {
    const userHeaders = userSheet.getDataRange().getValues()[0];
    const userStatusCol = userHeaders.indexOf('status') + 1;
    if (userStatusCol > 0) {
      userSheet.getRange(user._row, userStatusCol).setValue(status === 'Accepted' ? 'Active' : status);
    }
  }
  
  // Jika diterima, tambah ke Interns
  if (status === 'Accepted') {
    const existingInterns = sheetToObjects(getSheet('Interns'));
    const alreadyIntern = existingInterns.find(i => i.email === candidate.email);
    
    if (!alreadyIntern) {
      const internId = generateId('intern');
      getSheet('Interns').appendRow([
        internId, candidateId, candidate.name, candidate.email,
        candidate.phone, candidate.campus, '', '', 'Active',
        candidate.photo_url, candidate.cv_url, todayString()
      ]);
    }
  }
  
  return { success: true };
}

// ============================================================
// INTERNS
// ============================================================
function handleGetInterns({ role, userId }) {
  let interns = sheetToObjects(getSheet('Interns'));
  
  if (role === 'mentor') {
    interns = interns.filter(i => i.mentor_id === userId);
  }
  
  return {
    success: true,
    interns: interns.map(i => ({
      id: i.id,
      name: i.name,
      email: i.email,
      phone: i.phone,
      campus: i.campus,
      mentor_id: i.mentor_id,
      mentor_name: i.mentor_name,
      status: i.status,
      photo_url: i.photo_url,
      cv_url: i.cv_url,
      start_date: i.start_date,
    }))
  };
}

function handleAssignIntern({ internId, mentorId }) {
  const internSheet = getSheet('Interns');
  const interns = sheetToObjects(internSheet);
  const intern = interns.find(i => i.id === internId);
  if (!intern) return { success: false, error: 'Intern tidak ditemukan' };
  
  const mentors = sheetToObjects(getSheet('Users')).filter(u => u.role === 'mentor');
  const mentor = mentors.find(m => m.id === mentorId);
  if (!mentor) return { success: false, error: 'Mentor tidak ditemukan' };
  
  const headers = internSheet.getDataRange().getValues()[0];
  const mentorIdCol = headers.indexOf('mentor_id') + 1;
  const mentorNameCol = headers.indexOf('mentor_name') + 1;
  
  internSheet.getRange(intern._row, mentorIdCol).setValue(mentorId);
  internSheet.getRange(intern._row, mentorNameCol).setValue(mentor.name);
  
  return { success: true };
}

// ============================================================
// ATTENDANCE
// ============================================================
function handleCheckin({ userId, name, selfie }) {
  // Cek apakah sudah check-in hari ini
  const sheet = getSheet('Attendance');
  const records = sheetToObjects(sheet);
  const today = todayString();
  const existing = records.find(r => r.user_id === userId && r.date === today);
  
  if (existing && existing.checkin_time) {
    return { success: false, error: 'Sudah check-in hari ini' };
  }
  
  let selfieUrl = '';
  if (selfie && selfie.base64) {
    const result = uploadToDrive(
      selfie.base64,
      'selfie_' + userId + '_' + today + '.jpg',
      selfie.mime || 'image/jpeg',
      CONFIG.SELFIE_FOLDER_ID
    );
    if (result.success) selfieUrl = result.viewUrl;
  }
  
  const recordId = generateId('att');
  const now = new Date();
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  sheet.appendRow([recordId, userId, name, today, timeStr, '', '', selfieUrl, '']);
  
  return { success: true, recordId, checkin_time: timeStr };
}

function handleCheckout({ userId, recordId }) {
  const sheet = getSheet('Attendance');
  const records = sheetToObjects(sheet);
  const today = todayString();
  
  const record = records.find(r => 
    (recordId ? r.id === recordId : (r.user_id === userId && r.date === today))
  );
  
  if (!record) return { success: false, error: 'Record absensi tidak ditemukan' };
  if (record.checkout_time) return { success: false, error: 'Sudah check-out' };
  
  const now = new Date();
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  // Hitung durasi
  let duration = '';
  if (record.checkin_time) {
    try {
      const [ch, cm, cs] = record.checkin_time.split(':').map(Number);
      const [oh, om, os] = timeStr.split(':').map(Number);
      const diffMins = (oh * 60 + om) - (ch * 60 + cm);
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      duration = `${h}j ${m}m`;
    } catch (e) {}
  }
  
  const headers = sheet.getDataRange().getValues()[0];
  const checkoutCol = headers.indexOf('checkout_time') + 1;
  const durationCol = headers.indexOf('duration') + 1;
  
  sheet.getRange(record._row, checkoutCol).setValue(timeStr);
  if (durationCol > 0) sheet.getRange(record._row, durationCol).setValue(duration);
  
  return { success: true, checkout_time: timeStr, duration };
}

function handleGetTodayAttendance({ userId }) {
  const records = sheetToObjects(getSheet('Attendance'));
  const today = todayString();
  const record = records.find(r => r.user_id === userId && r.date === today);
  return { success: true, record: record || null };
}

function handleGetAttendance({ role, userId }) {
  let records = sheetToObjects(getSheet('Attendance'));
  
  if (role === 'intern') {
    records = records.filter(r => r.user_id === userId);
  } else if (role === 'mentor') {
    // Mentor lihat intern yang di-assign
    const interns = sheetToObjects(getSheet('Interns')).filter(i => i.mentor_id === userId);
    const internIds = interns.map(i => i.id);
    records = records.filter(r => internIds.includes(r.user_id) || r.user_id === userId);
  }
  
  // Sort descending by date
  records.sort((a, b) => (b.date + b.checkin_time).localeCompare(a.date + a.checkin_time));
  
  return {
    success: true,
    records: records.slice(0, 100).map(r => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      date: r.date,
      checkin_time: r.checkin_time,
      checkout_time: r.checkout_time,
      duration: r.duration,
      selfie_url: r.selfie_url,
    }))
  };
}

// ============================================================
// TASKS
// ============================================================
function handleGetTasks({ role, userId }) {
  let tasks = sheetToObjects(getSheet('Tasks'));
  
  if (role === 'intern') {
    tasks = tasks.filter(t => t.assignee_id === userId);
  } else if (role === 'mentor') {
    tasks = tasks.filter(t => t.mentor_id === userId);
  }
  
  tasks.sort((a, b) => b.created_at.localeCompare(a.created_at));
  
  return {
    success: true,
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assignee_id: t.assignee_id,
      assignee_name: t.assignee_name,
      mentor_id: t.mentor_id,
      priority: t.priority || 'Medium',
      status: t.status || 'Todo',
      due_date: t.due_date,
      created_at: t.created_at,
    }))
  };
}

function handleCreateTask({ title, description, assigneeId, priority, dueDate, mentorId }) {
  if (!title) return { success: false, error: 'Judul tugas wajib' };
  
  let assigneeName = '';
  if (assigneeId) {
    const interns = sheetToObjects(getSheet('Interns'));
    const assignee = interns.find(i => i.id === assigneeId);
    if (assignee) assigneeName = assignee.name;
  }
  
  const taskId = generateId('task');
  const now = nowString();
  
  getSheet('Tasks').appendRow([
    taskId, title, description || '', assigneeId || '', assigneeName,
    mentorId || '', priority || 'Medium', 'Todo', dueDate || '', now, now
  ]);
  
  return { success: true, taskId };
}

function handleUpdateTask({ taskId, status, userId }) {
  const sheet = getSheet('Tasks');
  const tasks = sheetToObjects(sheet);
  const task = tasks.find(t => t.id === taskId);
  
  if (!task) return { success: false, error: 'Tugas tidak ditemukan' };
  
  const headers = sheet.getDataRange().getValues()[0];
  const statusCol = headers.indexOf('status') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  
  if (statusCol > 0) sheet.getRange(task._row, statusCol).setValue(status);
  if (updatedCol > 0) sheet.getRange(task._row, updatedCol).setValue(nowString());
  
  return { success: true };
}

// ============================================================
// DASHBOARD
// ============================================================
function handleGetDashboard({ role, userId }) {
  const candidates = sheetToObjects(getSheet('Candidates'));
  const interns = sheetToObjects(getSheet('Interns'));
  const attendance = sheetToObjects(getSheet('Attendance'));
  const tasks = sheetToObjects(getSheet('Tasks'));
  
  const today = todayString();
  const todayAttendance = attendance.filter(a => a.date === today);
  
  let filteredInterns = interns;
  let filteredTasks = tasks;
  
  if (role === 'mentor') {
    filteredInterns = interns.filter(i => i.mentor_id === userId);
    filteredTasks = tasks.filter(t => t.mentor_id === userId);
  } else if (role === 'intern') {
    filteredTasks = tasks.filter(t => t.assignee_id === userId);
  }
  
  const doneTasks = filteredTasks.filter(t => t.status === 'Done').length;
  
  // Recent activity (last 5 events)
  const recentActivity = [];
  candidates.slice(-3).forEach(c => {
    recentActivity.push({ time: c.applied_at?.split(' ')[0] || '', text: `👤 ${c.name} mendaftar sebagai kandidat` });
  });
  attendance.filter(a => a.date === today).slice(0, 3).forEach(a => {
    recentActivity.push({ time: a.checkin_time || '', text: `✅ ${a.name} check-in` });
  });
  recentActivity.sort((a,b) => b.time.localeCompare(a.time));
  
  return {
    success: true,
    data: {
      totalCandidates: candidates.length,
      pendingCandidates: candidates.filter(c => c.status === 'Pending').length,
      totalInterns: filteredInterns.length,
      todayAttendance: todayAttendance.length,
      recentActivity: recentActivity.slice(0, 5),
      taskSummary: {
        total: filteredTasks.length,
        done: doneTasks,
      }
    }
  };
}

// ============================================================
// USERS
// ============================================================
function handleGetMentors() {
  const users = sheetToObjects(getSheet('Users')).filter(u => u.role === 'mentor' && u.status !== 'Inactive');
  return {
    success: true,
    mentors: users.map(u => ({ id: u.id, name: u.name, email: u.email }))
  };
}

function handleGetProfile({ userId }) {
  const users = sheetToObjects(getSheet('Users'));
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, error: 'User tidak ditemukan' };
  return {
    success: true,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, campus: user.campus, status: user.status,
      photo_url: user.photo_url, cv_url: user.cv_url,
    }
  };
}

function handleGetUsers() {
  const users = sheetToObjects(getSheet('Users'));
  return {
    success: true,
    users: users.map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      status: u.status, campus: u.campus
    }))
  };
}

function handleAddUser({ name, email, password, role }) {
  if (!name || !email || !password || !role) return { success: false, error: 'Field wajib tidak lengkap' };
  
  const users = sheetToObjects(getSheet('Users'));
  if (users.find(u => u.email === email)) return { success: false, error: 'Email sudah terdaftar' };
  
  const userId = generateId('usr');
  getSheet('Users').appendRow([
    userId, name, email, hashPassword(password),
    role, 'Active', '', '', '', '', nowString()
  ]);
  
  return { success: true, userId };
}

// ============================================================
// SETUP HELPER — Jalankan sekali untuk inisialisasi sheet
// ============================================================
function setupSheets() {
  const sheetNames = ['Users', 'Candidates', 'Interns', 'Attendance', 'Tasks'];
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      initSheetHeaders(sheet, name);
      Logger.log('Sheet dibuat: ' + name);
    }
  });
  
  // Buat akun admin default
  const usersSheet = getSheet('Users');
  const users = sheetToObjects(usersSheet);
  if (!users.find(u => u.role === 'admin')) {
    usersSheet.appendRow([
      generateId('usr'), 'Admin Rekind', 'admin@rekind.com',
      hashPassword('admin123'), 'admin', 'Active',
      '', '', '', '', nowString()
    ]);
    Logger.log('Admin default dibuat: admin@rekind.com / admin123');
  }
  
  Logger.log('Setup selesai!');
}

// ============================================================
// SETUP GOOGLE DRIVE FOLDERS — Jalankan sekali
// ============================================================
function setupDriveFolders() {
  let root;
  const existing = DriveApp.getFoldersByName('RekindInternHub');
  
  if (existing.hasNext()) {
    root = existing.next();
  } else {
    root = DriveApp.createFolder('RekindInternHub');
  }
  
  const folders = ['Photos', 'CV', 'Selfies'];
  const ids = {};
  
  folders.forEach(name => {
    const sub = DriveApp.getFoldersByName(name);
    let folder;
    if (sub.hasNext()) {
      folder = sub.next();
    } else {
      folder = root.createFolder(name);
    }
    ids[name] = folder.getId();
    Logger.log(name + ' folder ID: ' + folder.getId());
  });
  
  Logger.log('\n=== COPY KE CONFIG ===');
  Logger.log('PHOTOS_FOLDER_ID: ' + ids['Photos']);
  Logger.log('CV_FOLDER_ID: ' + ids['CV']);
  Logger.log('SELFIE_FOLDER_ID: ' + ids['Selfies']);
  
  return ids;
}