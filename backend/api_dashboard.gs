function handleGetDashboard({ role, userId }) {
  const candidates = sheetToObjects(getSheet('Candidates'));
  const interns    = sheetToObjects(getSheet('Interns'));
  const attendance = sheetToObjects(getSheet('Attendance'));
  const tasks      = sheetToObjects(getSheet('Tasks'));
  const today      = todayString();

  let filteredInterns   = interns;
  let filteredTasks     = tasks;
  let filteredAttendance = attendance;

  if (role === 'mentor') {
    filteredInterns    = interns.filter(i => i.mentor_id === userId);
    filteredTasks      = tasks.filter(t => t.mentor_id === userId);
    const internIds    = filteredInterns.map(i => i.id);
    filteredAttendance = attendance.filter(a => internIds.includes(a.user_id));
  } else if (role === 'intern') {
    filteredTasks      = tasks.filter(t => t.assignee_id === userId);
    filteredAttendance = attendance.filter(a => a.user_id === userId);
  }

  const todayAttendance = filteredAttendance.filter(a => a.date === today);

  // BUG 2 FIX: data tambahan untuk intern
  const todayCheckin   = todayAttendance.some(a => a.user_id === userId && a.checkin_time);
  const totalAttendance = filteredAttendance.length;

  const doneTasks = filteredTasks.filter(t => t.status === 'Done').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'In Progress').length;
  const todoTasks = filteredTasks.filter(t => t.status === 'Todo').length;

  // Aktivitas terbaru — BUG 8 FIX: pakai format tanggal lokal
  const recentActivity = [];
  candidates.slice(-3).forEach(c => {
    recentActivity.push({
      time: c.created_at ? c.created_at.split(' ')[0] : '',
      text: `👤 ${c.name} mendaftar sebagai kandidat`
    });
  });
  filteredAttendance.filter(a => a.date === today).slice(0, 3).forEach(a => {
    recentActivity.push({
      time: a.checkin_time || '',
      text: `✅ ${a.name} check-in`
    });
  });
  recentActivity.sort((a, b) => b.time.localeCompare(a.time));

  return {
    success: true,
    data: {
      totalCandidates:  candidates.length,
      pendingCandidates: candidates.filter(c => c.status === 'Pending').length,
      totalInterns:     filteredInterns.length,
      todayAttendance:  todayAttendance.length,
      todayCheckin,
      totalAttendance,
      recentActivity:   recentActivity.slice(0, 5),
      taskSummary: {
        total:      filteredTasks.length,
        done:       doneTasks,
        todo:       todoTasks,
        in_progress: inProgressTasks,
      }
    }
  };
}