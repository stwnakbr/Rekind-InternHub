function handleGetCandidateStatus({ email }) {
  if (!email) return { success: false, error: 'Email wajib diisi' };
  const candidates = sheetToObjects(getSheet('Candidates'));
  // Kembalikan semua lamaran dari email ini
  const myCandidates = candidates.filter(c => c.email === email);
  if (!myCandidates.length) return { success: false, error: 'Kandidat tidak ditemukan' };
  
  // Status utama: ambil yang paling baik (Accepted > Interview > Pending > Rejected)
  const priority = { 'Accepted': 4, 'Interview': 3, 'Pending': 2, 'Rejected': 1 };
  const best = myCandidates.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0))[0];
  
  return {
    success: true,
    status: best.status || 'Pending',
    interview_date: best.interview_date || '',
    interview_time: best.interview_time || '',
    interview_location: best.interview_location || '',
    applications: myCandidates.map(c => ({
      id: c.id,
      vacancy_title: c.vacancy_title,
      status: c.status || 'Pending',
    }))
  };
}

function handleGetCandidates({ role, userId }) {
  let candidates = sheetToObjects(getSheet('Candidates'));

  if (role !== 'admin' && role !== 'mentor') {
    const user = sheetToObjects(getSheet('Users')).find(u => u.id === userId);
    if (user && user.email) {
      // Ambil SEMUA lamaran milik user ini
      candidates = candidates.filter(c => c.email === user.email);
    } else {
      candidates = [];
    }
  }

  return {
    success: true,
    candidates: candidates.map(c => ({
      id: c.id,
      vacancy_id: c.vacancy_id,
      vacancy_title: c.vacancy_title,
      name: c.name,
      email: c.email,
      phone: c.phone,
      campus: c.campus,
      status: c.status || 'Pending',
      photo_url: c.photo_url,
      cv_url: c.cv_url,
      applied_at: c.created_at,
      interview_date: c.interview_date || '',
      interview_time: c.interview_time || '',
      interview_location: c.interview_location || '',
      intern_start_date: c.intern_start_date || '',
      intern_end_date: c.intern_end_date || '',
    }))
  };
}

function handleUpdateStatus({ candidateId, status, mentorId, interviewDate, interviewTime, interviewLocation }) {
  if (!['Pending', 'Interview', 'Accepted', 'Rejected'].includes(status)) {
    return { success: false, error: 'Status tidak valid' };
  }

  ensureCandidatesInterviewCols();

  const sheet = getSheet('Candidates');
  const candidates = sheetToObjects(sheet);
  const candidate = candidates.find(c => c.id === candidateId);
  if (!candidate) return { success: false, error: 'Kandidat tidak ditemukan' };

  const row = candidate._row;
  const headers = sheet.getDataRange().getValues()[0];
  const setCol = (name, value) => {
    const col = headers.indexOf(name) + 1;
    if (col > 0) sheet.getRange(row, col).setValue(value);
  };

  setCol('status', status);
  setCol('reviewed_by', mentorId || '');
  setCol('reviewed_at', nowString());

  if (status === 'Interview') {
    setCol('interview_date', interviewDate || '');
    setCol('interview_time', interviewTime || '');
    setCol('interview_location', interviewLocation || '');
  }

  // Kalau Accepted, otomatis Reject semua lamaran lain dari email yang sama
  if (status === 'Accepted') {
    const allCandidates = sheetToObjects(sheet);
    allCandidates.forEach(c => {
      if (c.email === candidate.email && c.id !== candidateId && c.status !== 'Accepted') {
        const otherHeaders = sheet.getDataRange().getValues()[0];
        const statusCol = otherHeaders.indexOf('status') + 1;
        if (statusCol > 0) sheet.getRange(c._row, statusCol).setValue('Rejected');
      }
    });
  }

  // Update Users sheet
  const userSheet = getSheet('Users');
  const users = sheetToObjects(userSheet);
  const user = users.find(u => u.email === candidate.email);
  if (user) {
    const userHeaders = userSheet.getDataRange().getValues()[0];
    const userStatusCol = userHeaders.indexOf('status') + 1;
    const newStatus = status === 'Accepted' ? 'Active' : status;
    if (userStatusCol > 0) userSheet.getRange(user._row, userStatusCol).setValue(newStatus);
    
    // Update role menjadi 'intern' jika Accepted
    if (status === 'Accepted') {
      const roleCol = userHeaders.indexOf('role') + 1;
      if (roleCol > 0) userSheet.getRange(user._row, roleCol).setValue('intern');
    }
  }

  // Kalau Accepted, pindahkan ke Interns dengan data periode magang
  if (status === 'Accepted') {
    const existingInterns = sheetToObjects(getSheet('Interns'));
    if (!existingInterns.find(i => i.email === candidate.email)) {
      const internSheet = getSheet('Interns');
      const internHeaders = internSheet.getDataRange().getValues()[0];
      
      // Cek kolom periode magang ada atau tidak, tambah jika belum ada
      const neededCols = ['start_date', 'end_date'];
      neededCols.forEach(col => {
        if (!internHeaders.includes(col)) {
          internSheet.getRange(1, internHeaders.length + 1).setValue(col);
          internHeaders.push(col);
        }
      });
      
      internSheet.appendRow([
        generateId('intern'), candidateId, candidate.name, candidate.email,
        candidate.phone, candidate.campus, '', '', 'Active',
        candidate.photo_url, candidate.cv_url,
        candidate.intern_start_date || todayString(),
        candidate.intern_end_date || ''
      ]);
    }
  }

  return { success: true };
}

// Kandidat submit periode magang yang diinginkan
function handleUpdateInternPeriod({ candidateId, startDate, endDate }) {
  ensureCandidatesInterviewCols();
  const sheet = getSheet('Candidates');
  const candidates = sheetToObjects(sheet);
  const candidate = candidates.find(c => c.id === candidateId);
  if (!candidate) return { success: false, error: 'Kandidat tidak ditemukan' };

  const headers = sheet.getDataRange().getValues()[0];
  const setCol = (name, value) => {
    const col = headers.indexOf(name) + 1;
    if (col > 0) sheet.getRange(candidate._row, col).setValue(value);
  };

  setCol('intern_start_date', startDate || '');
  setCol('intern_end_date', endDate || '');

  return { success: true };
}

// Kandidat melamar lowongan (bisa lebih dari 1)
function handleApplyVacancy({ userId, vacancyId }) {
  const users = sheetToObjects(getSheet('Users'));
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, error: 'User tidak ditemukan' };
  
  const vacancies = sheetToObjects(getSheet('Vacancies'));
  const vacancy = vacancies.find(v => v.id === vacancyId);
  if (!vacancy) return { success: false, error: 'Lowongan tidak ditemukan' };
  if (vacancy.status !== 'Open') return { success: false, error: 'Lowongan sudah ditutup' };
  
  // Cek apakah sudah pernah melamar lowongan ini
  const existing = sheetToObjects(getSheet('Candidates')).find(
    c => c.email === user.email && c.vacancy_id === vacancyId
  );
  if (existing) return { success: false, error: 'Anda sudah melamar posisi ini' };
  
  ensureCandidatesInterviewCols();
  
  const candidateId = generateId('cand');
  const sheet = getSheet('Candidates');
  const headers = sheet.getDataRange().getValues()[0];
  
  // Build row berdasarkan headers
  const row = headers.map(h => {
    const map = {
      id: candidateId,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      campus: user.campus || '',
      status: 'Pending',
      photo_url: user.photo_url || '',
      cv_url: user.cv_url || '',
      created_at: nowString(),
      vacancy_id: vacancyId,
      vacancy_title: vacancy.title,
    };
    return map[h] !== undefined ? map[h] : '';
  });
  
  sheet.appendRow(row);
  return { success: true, candidateId };
}

function ensureCandidatesInterviewCols() {
  const sheet = getSheet('Candidates');
  const headers = sheet.getDataRange().getValues()[0];
  const needed = [
    'interview_date', 'interview_time', 'interview_location',
    'reviewed_by', 'reviewed_at', 'intern_start_date', 'intern_end_date',
    'vacancy_id', 'vacancy_title'
  ];
  needed.forEach(col => {
    if (!headers.includes(col)) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });
}
