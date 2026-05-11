function handleGetTasks({ role, userId }) {
  const allTasks = sheetToObjects(getSheet('Tasks'));
  let tasks = allTasks;

  if (role === 'intern') {
    // ── Strategi matching assignee_id ────────────────────────────
    // Di sheet Tasks, kolom assignee_id bisa berisi:
    //   a) ID dari sheet Interns  (intern_xxx)
    //   b) ID dari sheet Users    (usr_xxx)
    //   c) nama intern (data lama)
    //
    // userId dari session = ID dari sheet Users (usr_xxx)
    // Kita perlu collect semua kemungkinan ID & nama yang mewakili user ini.

    const users    = sheetToObjects(getSheet('Users'));
    const interns  = sheetToObjects(getSheet('Interns'));
    const me       = users.find(u => u.id === userId);

    const myKeys = new Set([userId]); // mulai dari userId session

    if (me) {
      // Tambahkan intern_id berdasarkan email yang sama
      interns
        .filter(i => i.email === me.email)
        .forEach(i => {
          myKeys.add(i.id);           // intern_xxx
          myKeys.add(i.candidate_id); // cand_xxx (kalau ada)
          if (i.name) myKeys.add(i.name); // fallback nama (data lama)
        });
      if (me.name) myKeys.add(me.name); // nama dari Users
    }

    tasks = allTasks.filter(t => myKeys.has(t.assignee_id));

  } else if (role === 'mentor') {
    // Mentor lihat semua tugas yang dia buat
    tasks = allTasks.filter(t => t.mentor_id === userId);
  }
  // Admin: semua tasks tanpa filter

  tasks.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return { success: true, tasks };
}

function handleCreateTask({ title, description, assigneeId, priority, status, dueDate, mentorId }) {
  if (!title) return { success: false, error: 'Judul tugas wajib' };

  // Cari nama assignee dari Interns → Users
  let assigneeName = '';
  if (assigneeId) {
    const intern = sheetToObjects(getSheet('Interns')).find(i => i.id === assigneeId);
    if (intern) {
      assigneeName = intern.name;
    } else {
      const user = sheetToObjects(getSheet('Users')).find(u => u.id === assigneeId);
      if (user) assigneeName = user.name;
    }
  }

  const taskId = generateId('task');
  const now    = nowString();
  getSheet('Tasks').appendRow([
    taskId, title, description || '', assigneeId || '', assigneeName,
    mentorId || '', priority || 'Medium', status || 'Todo', dueDate || '', now, now
  ]);
  return { success: true, taskId };
}

function handleUpdateTask({ taskId, status, userId, title, description, assigneeId, priority, dueDate }) {
  const sheet = getSheet('Tasks');
  const task  = sheetToObjects(sheet).find(t => t.id === taskId);
  if (!task) return { success: false, error: 'Tugas tidak ditemukan' };

  const headers = sheet.getDataRange().getValues()[0];
  const setCol  = (name, value) => {
    const col = headers.indexOf(name) + 1;
    if (col > 0) sheet.getRange(task._row, col).setValue(value);
  };

  if (status      !== undefined) setCol('status',      status);
  if (title       !== undefined) setCol('title',       title);
  if (description !== undefined) setCol('description', description);
  if (priority    !== undefined) setCol('priority',    priority);
  if (dueDate     !== undefined) setCol('due_date',    dueDate);

  if (assigneeId !== undefined) {
    setCol('assignee_id', assigneeId);
    const intern = sheetToObjects(getSheet('Interns')).find(i => i.id === assigneeId);
    if (intern) {
      setCol('assignee_name', intern.name);
    } else {
      const user = sheetToObjects(getSheet('Users')).find(u => u.id === assigneeId);
      setCol('assignee_name', user ? user.name : '');
    }
  }

  setCol('updated_at', nowString());
  return { success: true };
}

function handleDeleteTask({ taskId }) {
  const sheet = getSheet('Tasks');
  const task  = sheetToObjects(sheet).find(t => t.id === taskId);
  if (!task) return { success: false, error: 'Tugas tidak ditemukan' };
  sheet.deleteRow(task._row);
  return { success: true };
}
