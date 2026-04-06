const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = 3000;

app.use(cors({
  origin: '*' ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000']
}));
app.use(express.json());

// ── База данных
const db = new sqlite3.Database('./bilimcloud.db', (err) => {
  if (err) console.error("❌ Ошибка подключения:", err.message);
  else     console.log("✅ База данных подключена → learnkg-simple.db");
});

// ── Таблицы
db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    first_name TEXT,
    last_name  TEXT,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    age        INTEGER,
    city       TEXT,
    role       TEXT DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER UNIQUE NOT NULL,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    phone        TEXT,
    age          INTEGER,
    city         TEXT,
    university   TEXT,
    specialty    TEXT,
    degree       TEXT,
    grad_year    INTEGER,
    experience   INTEGER DEFAULT 0,
    bio          TEXT,
    subjects     TEXT,
    level        TEXT,
    format       TEXT,
    course_price INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'pending',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    teacher_info TEXT,
    price        INTEGER DEFAULT 0,
    teacher_id   INTEGER,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`);

  console.log("✅ Таблицы готовы");
});

// ══════════════════════════════════════════════════════
// РОУТЫ
// ══════════════════════════════════════════════════════

// Регистрация ученика
app.post('/register', (req, res) => {
  const { firstName, lastName, name, email, password, age, city, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email и пароль обязательны" });

  const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();

  db.run(
    `INSERT INTO users (name, first_name, last_name, email, password, age, city, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [fullName, firstName||null, lastName||null, email, password, age||null, city||null, role||'student'],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: "Email уже занят" });
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      res.json({
        message: "Регистрация успешна",
        userId: this.lastID,
        user: { id: this.lastID, firstName, lastName, name: fullName, email, age, city, role: role||'student' }
      });
    }
  );
});

// Регистрация преподавателя
app.post('/register-teacher', (req, res) => {
  const {
    firstName, lastName, email, password, phone, age, city,
    university, specialty, degree, gradYear, experience,
    bio, subjects, level, format, coursePrice
  } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: "Имя, фамилия, email и пароль обязательны" });
  }

  const fullName = `${firstName} ${lastName}`.trim();

  // Шаг 1: создаём пользователя
  db.run(
    `INSERT INTO users (name, first_name, last_name, email, password, age, city, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'teacher')`,
    [fullName, firstName, lastName, email, password, age||null, city||null],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: "Email уже занят" });
        return res.status(500).json({ error: "Ошибка при создании аккаунта" });
      }

      const userId = this.lastID;
      const subjectsJson = Array.isArray(subjects) ? JSON.stringify(subjects) : (subjects || '[]');

      // Шаг 2: сохраняем анкету
      db.run(
        `INSERT INTO teachers
          (user_id, first_name, last_name, phone, age, city,
           university, specialty, degree, grad_year, experience,
           bio, subjects, level, format, course_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, firstName, lastName, phone||null, age||null, city||null,
         university||null, specialty||null, degree||null, gradYear||null, experience||0,
         bio||null, subjectsJson, level||null, format||null, coursePrice||0],
        function(err2) {
          if (err2) return res.status(500).json({ error: "Ошибка при сохранении анкеты" });

          const subjectsArr = Array.isArray(subjects) ? subjects : [];
          res.json({
            message: "Анкета отправлена на проверку",
            userId,
            teacherId: this.lastID,
            user: {
              id: userId, firstName, lastName, name: fullName,
              email, phone, age, city,
              university, specialty, degree, gradYear, experience,
              bio, subjects: subjectsArr, level, format, coursePrice,
              role: 'teacher', status: 'pending'
            }
          });
        }
      );
    }
  );
});

// Логин
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Введите email и пароль" });

  db.get(
    `SELECT id, name, first_name, last_name, email, role, age, city FROM users WHERE email = ? AND password = ?`,
    [email, password],
    (err, user) => {
      if (err)   return res.status(500).json({ error: "Ошибка сервера" });
      if (!user) return res.status(401).json({ error: "Неверный email или пароль" });

      if (user.role === 'teacher') {
        db.get(`SELECT * FROM teachers WHERE user_id = ?`, [user.id], (err2, teacher) => {
          if (teacher) {
            try { teacher.subjects = JSON.parse(teacher.subjects || '[]'); } catch { teacher.subjects = []; }
            Object.assign(user, teacher);
          }
          res.json({ message: "Вход выполнен", user });
        });
      } else {
        res.json({ message: "Вход выполнен", user });
      }
    }
  );
});

// Получить одного преподавателя
app.get('/teachers/:userId', (req, res) => {
  db.get(
    `SELECT u.id, u.email, u.role, t.* FROM users u
     LEFT JOIN teachers t ON t.user_id = u.id
     WHERE u.id = ? AND u.role = 'teacher'`,
    [req.params.userId],
    (err, row) => {
      if (err)  return res.status(500).json({ error: "Ошибка сервера" });
      if (!row) return res.status(404).json({ error: "Преподаватель не найден" });
      try { row.subjects = JSON.parse(row.subjects || '[]'); } catch { row.subjects = []; }
      res.json(row);
    }
  );
});

// Все преподаватели
app.get('/teachers', (req, res) => {
  db.all(
    `SELECT u.id, u.email, t.first_name, t.last_name, t.city,
            t.subjects, t.experience, t.university, t.specialty,
            t.level, t.format, t.course_price, t.status, t.bio
     FROM teachers t JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Ошибка сервера" });
      rows.forEach(r => { try { r.subjects = JSON.parse(r.subjects||'[]'); } catch { r.subjects=[]; } });
      res.json(rows);
    }
  );
});

// Одобрить / отклонить преподавателя
app.patch('/teachers/:userId/status', (req, res) => {
  const { status } = req.body;
  if (!['approved','rejected','pending'].includes(status)) {
    return res.status(400).json({ error: "Неверный статус" });
  }
  db.run(`UPDATE teachers SET status = ? WHERE user_id = ?`, [status, req.params.userId], function(err) {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
    res.json({ message: `Статус → ${status}` });
  });
});

// Курсы
app.get('/courses', (req, res) => {
  db.all(
    `SELECT c.*, u.name as teacher_name FROM courses c
     LEFT JOIN users u ON u.id = c.teacher_id
     ORDER BY c.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Ошибка сервера" });
      res.json(rows);
    }
  );
});

app.post('/courses', (req, res) => {
  const { title, description, teacherInfo, price, teacher_id } = req.body;
  if (!title || !teacher_id) return res.status(400).json({ error: "Название и teacher_id обязательны" });

  db.run(
    `INSERT INTO courses (title, description, teacher_info, price, teacher_id) VALUES (?, ?, ?, ?, ?)`,
    [title, description||null, teacherInfo||null, price||0, teacher_id],
    function(err) {
      if (err) return res.status(500).json({ error: "Ошибка при добавлении курса" });
      res.json({ message: "Курс добавлен", courseId: this.lastID });
    }
  );
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: "ok", message: "Сервер работает 🚀" });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер → http://localhost:${PORT}`);
  console.log(`🔍 Health → http://localhost:${PORT}/health`);
});
