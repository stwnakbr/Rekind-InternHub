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
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, campus: user.campus, photo_url: user.photo_url,
      cv_url: user.cv_url, status: user.status,
    }
  };
}

function handleRegisterCandidate({ vacancyId, name, email, phone, campus, password, photo, cv }) {
  if (!name || !email || !password || !vacancyId) return { success: false, error: 'Field wajib tidak lengkap' };
  
  const users = sheetToObjects(getSheet('Users'));
  const candidates = sheetToObjects(getSheet('Candidates'));
  
  if (users.find(u => u.email === email) || candidates.find(c => c.email === email)) {
    return { success: false, error: 'Email sudah terdaftar' };
  }

  const vacancies = sheetToObjects(getSheet('Vacancies'));
  const vacancy = vacancies.find(v => v.id === vacancyId);
  if (!vacancy) return { success: false, error: 'Lowongan tidak ditemukan' };

  let photoUrl = '';
  if (photo && photo.base64) {
    const result = uploadToDrive(photo.base64, 'photo_' + Date.now() + '_' + name.replace(/\s/g,'_') + getExtension(photo.mime), photo.mime || 'image/jpeg', CONFIG.PHOTOS_FOLDER_ID);
    if (!result.success) return { success: false, error: 'Gagal upload foto: ' + result.error };
    photoUrl = result.viewUrl;
  }

  let cvUrl = '';
  if (cv && cv.base64) {
    const result = uploadToDrive(cv.base64, 'cv_' + Date.now() + '_' + name.replace(/\s/g,'_') + getExtension(cv.mime), cv.mime || 'application/pdf', CONFIG.CV_FOLDER_ID);
    if (!result.success) return { success: false, error: 'Gagal upload CV: ' + result.error };
    cvUrl = result.downloadUrl;
  }

  const candidateId = generateId('cand');
  const userId = generateId('usr');
  const now = nowString();
  
  getSheet('Candidates').appendRow([
    candidateId, name, email, hashPassword(password), 'intern', 'Pending',
    phone, campus, photoUrl, cvUrl, now, vacancy.id, vacancy.title
  ]);
  
  getSheet('Users').appendRow([
    userId, name, email, hashPassword(password),
    'intern', 'Pending', phone, campus, photoUrl, cvUrl, now
  ]);
  
  return { success: true, candidateId, message: 'Pendaftaran berhasil! Menunggu review.' };
}
