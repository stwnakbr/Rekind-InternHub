// Endpoint untuk kandidat/publik — semua lowongan Open
function handleGetOpenVacancies() {
  const sheet   = getSheet('Vacancies');
  const headers = sheet.getDataRange().getValues()[0];
  const all     = sheetToObjects(sheet);

  // Cek apakah kolom 'status' ada di sheet
  // Jika tidak ada, anggap semua lowongan Open (fallback aman)
  const hasStatusCol = headers.includes('status');

  const open = hasStatusCol
    ? all.filter(v => {
        const s = String(v.status || '').trim().toLowerCase();
        return s === 'open' || s === '';   // kosong juga dianggap Open
      })
    : all; // kalau kolom status belum ada, tampilkan semua

  return {
    success: true,
    vacancies: open.map(v => ({
      id:          v.id,
      title:       v.title,
      description: v.description || '',
      quota:       v.quota || '',
      start_date:  v.start_date || '',
      end_date:    v.end_date   || '',
    }))
  };
}

// Endpoint untuk admin/mentor — semua lowongan
function handleGetVacancies() {
  const vacancies = sheetToObjects(getSheet('Vacancies'));
  return {
    success: true,
    vacancies: vacancies.map(v => ({
      id:          v.id,
      title:       v.title,
      description: v.description || '',
      quota:       v.quota       || '',
      status:      v.status      || 'Open',
      start_date:  v.start_date  || '',
      end_date:    v.end_date    || '',
      created_at:  v.created_at  || '',
    }))
  };
}

function handleCreateVacancy({ title, description, quota, startDate, endDate, createdBy }) {
  if (!title) return { success: false, error: 'Judul wajib diisi' };

  const sheet   = getSheet('Vacancies');
  const headers = sheet.getDataRange().getValues()[0];

  // Tambah kolom yang belum ada agar aman
  const needed = ['start_date', 'end_date', 'status', 'created_by', 'created_at'];
  needed.forEach(col => {
    if (!headers.includes(col)) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  const vacancyId = generateId('vac');
  const now = nowString();

  // Build row sesuai urutan header aktual di sheet
  const map = {
    id: vacancyId, title: title,
    description: description || '',
    quota: quota || '',
    status: 'Open',
    created_by: createdBy || '',
    created_at: now,
    start_date: startDate || '',
    end_date:   endDate   || '',
  };
  const row = headers.map(h => map[h] !== undefined ? map[h] : '');
  sheet.appendRow(row);
  return { success: true, vacancyId };
}

function handleUpdateVacancyStatus({ vacancyId, status }) {
  const sheet = getSheet('Vacancies');
  const v     = sheetToObjects(sheet).find(v => v.id === vacancyId);
  if (!v) return { success: false, error: 'Lowongan tidak ditemukan' };
  const col = sheet.getDataRange().getValues()[0].indexOf('status') + 1;
  if (col > 0) sheet.getRange(v._row, col).setValue(status);
  return { success: true };
}

function handleUpdateVacancy({ vacancyId, title, description, quota, startDate, endDate, status }) {
  const sheet   = getSheet('Vacancies');
  const v       = sheetToObjects(sheet).find(v => v.id === vacancyId);
  if (!v) return { success: false, error: 'Lowongan tidak ditemukan' };

  const headers = sheet.getDataRange().getValues()[0];
  const setCol  = (name, value) => {
    const col = headers.indexOf(name) + 1;
    if (col > 0) sheet.getRange(v._row, col).setValue(value);
  };

  if (title       !== undefined) setCol('title',       title);
  if (description !== undefined) setCol('description', description);
  if (quota       !== undefined) setCol('quota',       quota);
  if (status      !== undefined) setCol('status',      status);
  if (startDate   !== undefined) setCol('start_date',  startDate);
  if (endDate     !== undefined) setCol('end_date',    endDate);
  return { success: true };
}

function handleDeleteVacancy({ vacancyId }) {
  const sheet = getSheet('Vacancies');
  const v     = sheetToObjects(sheet).find(v => v.id === vacancyId);
  if (!v) return { success: false, error: 'Lowongan tidak ditemukan' };
  sheet.deleteRow(v._row);
  return { success: true };
}
