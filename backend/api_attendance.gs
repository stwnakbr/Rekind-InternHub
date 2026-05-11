function handleCheckin({ userId, name, selfie }) {
  const sheet = getSheet('Attendance');
  const records = sheetToObjects(sheet);
  const today = todayString();
  
  // Cek apakah hari ini sudah checkin
  const existing = records.find(r => r.user_id === userId && r.date === today);
  if (existing && existing.checkin_time) {
    return { success: false, error: 'Anda sudah melakukan absen hari ini. Tidak dapat absen lagi.' };
  }
  
  let selfieUrl = '';
  if (selfie && selfie.base64) {
    const result = uploadToDrive(selfie.base64, 'selfie_' + userId + '_' + today + '.jpg', selfie.mime || 'image/jpeg', CONFIG.SELFIE_FOLDER_ID);
    if (result.success) selfieUrl = result.viewUrl;
  }
  
  const recordId = generateId('att');
  const timeStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');
  const dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  sheet.appendRow([recordId, userId, name, dateStr, timeStr, '', '', selfieUrl, '']);
  return { success: true, recordId, checkin_time: timeStr };
}

function handleCheckout({ userId, recordId }) {
  const sheet = getSheet('Attendance');
  const records = sheetToObjects(sheet);
  const today = todayString();
  const record = records.find(r => (recordId ? r.id === recordId : (r.user_id === userId && r.date === today)));
  
  if (!record) return { success: false, error: 'Record absensi tidak ditemukan' };
  if (record.checkout_time) return { success: false, error: 'Sudah check-out' };
  
  const timeStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm:ss');
  let duration = '';
  if (record.checkin_time) {
    try {
      const [ch, cm] = record.checkin_time.split(':').map(Number);
      const [oh, om] = timeStr.split(':').map(Number);
      const diffMins = (oh * 60 + om) - (ch * 60 + cm);
      duration = `${Math.floor(diffMins / 60)}j ${diffMins % 60}m`;
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
  const record = sheetToObjects(getSheet('Attendance')).find(r => r.user_id === userId && r.date === todayString());
  return { success: true, record: record || null };
}

function handleGetAttendance({ role, userId }) {
  let records = sheetToObjects(getSheet('Attendance'));
  
  if (role === 'intern') {
    // Intern hanya lihat absensinya sendiri
    records = records.filter(r => r.user_id === userId);
  } else if (role === 'mentor') {
    // Mentor lihat absensi intern yang dibimbingnya (berdasarkan intern_id di Interns sheet)
    const internSheet = sheetToObjects(getSheet('Interns'));
    const myInternUserIds = internSheet
      .filter(i => i.mentor_id === userId)
      .map(i => {
        // user_id di attendance bisa berupa id intern atau candidate_id
        // Coba match lewat email di Users sheet
        const users = sheetToObjects(getSheet('Users'));
        const user = users.find(u => u.email === i.email);
        return user ? user.id : i.id;
      })
      .filter(Boolean);
    
    records = records.filter(r => myInternUserIds.includes(r.user_id));
  }
  // admin: semua records
  
  records.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.checkin_time.localeCompare(a.checkin_time);
  });
  return { success: true, records: records.slice(0, 200) };
}
