function handleGetMentors() {
  const users = sheetToObjects(getSheet('Users')).filter(u => u.role === 'mentor' && u.status !== 'Inactive');
  return { success: true, mentors: users.map(u => ({ id: u.id, name: u.name, email: u.email })) };
}

function handleGetProfile({ userId }) {
  const user = sheetToObjects(getSheet('Users')).find(u => u.id === userId);
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
  return {
    success: true,
    users: sheetToObjects(getSheet('Users')).map(u => ({
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
