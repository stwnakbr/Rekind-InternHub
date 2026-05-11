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
    const raw = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const { action, ...params } = body;

    const handlers = {
      login: handleLogin,
      registerCandidate: handleRegisterCandidate,
      getVacancies: handleGetVacancies,
      getOpenVacancies: handleGetOpenVacancies,
      createVacancy: handleCreateVacancy,
      updateVacancyStatus: handleUpdateVacancyStatus,
      deleteVacancy: handleDeleteVacancy,
      getCandidates: handleGetCandidates,
      getCandidateStatus: handleGetCandidateStatus,
      applyVacancy: handleApplyVacancy,
      getInterns: handleGetInterns,
      updateStatus: handleUpdateStatus,
      updateInternPeriod: handleUpdateInternPeriod,
      updateVacancy: handleUpdateVacancy,      assignIntern: handleAssignIntern,
      checkin: handleCheckin,
      checkout: handleCheckout,
      getTodayAttendance: handleGetTodayAttendance,
      getAttendance: handleGetAttendance,
      getTasks: handleGetTasks,
      createTask: handleCreateTask,
      updateTask: handleUpdateTask,
      deleteTask: handleDeleteTask,
      getDashboard: handleGetDashboard,
      getMentors: handleGetMentors,
      getProfile: handleGetProfile,
      getUsers: handleGetUsers,
      addUser: handleAddUser,
      uploadFile: handleUploadFile,
    };

    if (!handlers[action]) return respond({ success: false, error: 'Action tidak dikenal: ' + action });
    return respond(handlers[action](params));
  } catch (err) {
    Logger.log('Error: ' + err.toString() + '\n' + err.stack);
    return respond({ success: false, error: 'Server error: ' + err.message });
  }
}

function doGet(e) {
  return respond({ success: true, message: 'Rekind InternHub API aktif', version: '2.0 (Modular)' });
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
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
    Vacancies: ['id', 'title', 'description', 'quota', 'status', 'created_by', 'created_at'],
    Candidates: ['id','name','email','password_hash','role','status','phone','campus','photo_url','cv_url','created_at','vacancy_id','vacancy_title','interview_date','interview_time','interview_location'],
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

function generateId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }
function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function nowString() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function todayString() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ============================================================
// SETUP HELPER
// ============================================================
function setupSheets() {
  const sheetNames = ['Users', 'Vacancies', 'Candidates', 'Interns', 'Attendance', 'Tasks'];
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      initSheetHeaders(ss.insertSheet(name), name);
      Logger.log('Sheet dibuat: ' + name);
    }
  });
  const usersSheet = getSheet('Users');
  if (!sheetToObjects(usersSheet).find(u => u.role === 'admin')) {
    usersSheet.appendRow([generateId('usr'), 'Admin Rekind', 'admin@rekind.com', hashPassword('admin123'), 'admin', 'Active', '', '', '', '', nowString()]);
    Logger.log('Admin default dibuat: admin@rekind.com / admin123');
  }
}

function setupDriveFolders() {
  let root;
  const existing = DriveApp.getFoldersByName('RekindInternHub');
  if (existing.hasNext()) root = existing.next(); else root = DriveApp.createFolder('RekindInternHub');
  const folders = ['Photos', 'CV', 'Selfies'];
  const ids = {};
  folders.forEach(name => {
    const sub = DriveApp.getFoldersByName(name);
    let folder = sub.hasNext() ? sub.next() : root.createFolder(name);
    ids[name] = folder.getId();
    Logger.log(name + ' folder ID: ' + folder.getId());
  });
  return ids;
}
