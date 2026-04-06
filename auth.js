const API_BASE = 'http://localhost:3000';

function saveUser(user) {
  localStorage.setItem('bilimcloud_user', JSON.stringify(user));
}

function getCurrentUser() {
  const data = localStorage.getItem('bilimcloud_user');
  return data ? JSON.parse(data) : null;
}

function isLoggedIn() { return !!getCurrentUser(); }

function isTeacher() {
  const user = getCurrentUser();
  return user && user.role === 'teacher';
}

function logout() {
  localStorage.removeItem('bilimcloud_user');
  window.location.href = 'main.html';
}

// ── Вход ──
async function handleLogin() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    alert('Заполните email и пароль');
    return;
  }

  try {
    const res  = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.error) { alert(data.error); return; }

    saveUser(data.user);
    window.location.href = 'profile.html';

  } catch (err) {
    alert('Не удалось подключиться к серверу. Проверьте: node server.js запущен?');
  }
}

// ── Регистрация ученика ──
// Работает и со старой формой (id="name", id="age") и с новой (id="firstName", id="lastName")
async function handleRegister() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const age      = document.getElementById('age')?.value.trim() || null;
  const city     = document.getElementById('city')?.value || null;
  const role     = document.getElementById('role')?.value || 'student';

  // Поддержка старой формы (одно поле "name") и новой (firstName + lastName)
  let firstName, lastName, name;
  if (document.getElementById('firstName')) {
    firstName = document.getElementById('firstName').value.trim();
    lastName  = document.getElementById('lastName')?.value.trim() || '';
    name      = `${firstName} ${lastName}`.trim();
  } else {
    // старая форма — поле id="name"
    name      = document.getElementById('name')?.value.trim() || '';
    const parts = name.split(' ');
    firstName = parts[0] || name;
    lastName  = parts.slice(1).join(' ') || '';
  }

  if (!email || !password) {
    alert('Email и пароль обязательны');
    return;
  }

  const payload = { firstName, lastName, name, email, password, age, city, role };

  try {
    const res  = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) { alert(data.error); return; }

    saveUser(data.user || { id: data.userId, firstName, lastName, name, email, age, city, role });
    window.location.href = 'profile.html';

  } catch (err) {
    // Сервер недоступен — сохраняем локально и всё равно открываем профиль
    saveUser({ firstName, lastName, name, email, age, city, role });
    window.location.href = 'profile.html';
  }
}

// ── Регистрация преподавателя ──
function saveTeacherAndRedirect(teacherData) {
  saveUser({ ...teacherData, role: 'teacher', status: 'pending' });
  window.location.href = 'profile.html';
}
