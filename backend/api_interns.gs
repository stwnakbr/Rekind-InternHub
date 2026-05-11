function handleGetInterns({ role, userId }) {
  let interns = sheetToObjects(getSheet('Interns'));
  if (role === 'mentor') interns = interns.filter(i => i.mentor_id === userId);
  return {
    success: true,
    interns: interns.map(i => ({
      id: i.id, name: i.name, email: i.email, phone: i.phone, campus: i.campus,
      mentor_id: i.mentor_id, mentor_name: i.mentor_name, status: i.status,
      photo_url: i.photo_url, cv_url: i.cv_url, start_date: i.start_date,
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
