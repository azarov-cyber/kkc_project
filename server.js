const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
 
const app  = express();
const PORT = 3000;
 
app.use(cors({ origin: '*' }));
app.use(express.json());
 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));
 
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./uploads/courses')) fs.mkdirSync('./uploads/courses');
if (!fs.existsSync('./uploads/avatars')) fs.mkdirSync('./uploads/avatars');
 
// ── Multer курсы ──
const courseStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/courses'),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random()*1e6) + ext);
  }
});
const uploadCourse = multer({
  storage: courseStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /jpeg|jpg|png|webp|gif/.test(path.extname(file.originalname).toLowerCase()));
  }
});
 
// ── Multer аватары ──
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/avatars'),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()));
  }
});
 
// ── База данных ──
const db = new sqlite3.Database('./bilimcloud.db', (err) => {
  if (err) console.error('❌ Ошибка:', err.message);
  else     console.log('✅ База данных подключена');
});
 
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
    avatar     TEXT,
    role       TEXT DEFAULT 'student',
    streak     INTEGER DEFAULT 0,
    last_visit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
 
  // Добавляем колонки streak/last_visit если их нет (миграция)
  db.run(`ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN last_visit TEXT`, () => {});
 
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
    avatar       TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
 
  db.run(`CREATE TABLE IF NOT EXISTS content (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    teacher_info TEXT,
    price        INTEGER DEFAULT 0,
    teacher_id   INTEGER,
    category     TEXT,
    level        TEXT,
    lang         TEXT,
    image        TEXT,
    type         TEXT DEFAULT 'course',
    duration     TEXT,
    max_students INTEGER DEFAULT 0,
    scheduled_at TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`);
 
  // Совместимость: таблица courses как VIEW или просто синоним
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT,
    teacher_info TEXT,
    price        INTEGER DEFAULT 0,
    teacher_id   INTEGER,
    category     TEXT,
    level        TEXT,
    lang         TEXT,
    image        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`);
 
  // Заявки преподавателей (аккаунт создаётся только после одобрения)
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    email        TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
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
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
 
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    content_type TEXT DEFAULT 'course',
    progress   INTEGER DEFAULT 0,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id, content_type)
  )`);
 
  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    code        TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, code)
  )`);
 
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    date     TEXT NOT NULL,
    UNIQUE(user_id, date)
  )`);
 
  console.log('✅ Таблицы готовы');
 
  // ── Seed данные ──
  seedData();
});
 
function seedData() {
  db.get(`SELECT COUNT(*) as cnt FROM content`, (err, row) => {
    if (err || row.cnt > 0) return;
 
    const contents = [
      // ── Курсы: ОРТ ──
      { title:'Математика — подготовка к ОРТ', description:'Полный курс математики для подготовки к ОРТ. Алгебра, геометрия, тригонометрия. 120 уроков с практикой.', teacher_info:'Асан Бейшенов', price:2500, category:'ort', level:'Средний', lang:'Кыргызский', type:'course' },
      { title:'Физика — Подготовка к ОРТ', description:'Механика, электричество, оптика — всё что нужно для высокого балла по физике на ОРТ.', teacher_info:'Руслан Сейткали', price:2200, category:'ort', level:'Средний', lang:'Русский', type:'course' },
      { title:'Кыргызский язык — ОРТ', description:'Грамматика, орфография и пунктуация кыргызского языка. Разбор всех типов заданий ОРТ с практикой.', teacher_info:'Нурлан Асанов', price:1800, category:'ort', level:'Средний', lang:'Кыргызский', type:'course' },
      { title:'Биология — ОРТ за 3 месяца', description:'Клетка, генетика, экология, эволюция — все темы ОРТ по биологии. Тесты и разбор ошибок.', teacher_info:'Гүлнур Эшматова', price:2000, category:'ort', level:'Средний', lang:'Русский', type:'course' },
      { title:'История КР — ОРТ', description:'Полная история Кыргызстана от древности до современности. 80 уроков + все тестовые задания.', teacher_info:'Бакыт Жоробеков', price:1600, category:'ort', level:'Начинающий', lang:'Кыргызский', type:'course' },
      { title:'Химия — ОРТ: органика и неорганика', description:'Все разделы химии для ОРТ. Реакции, уравнения, задачи с решениями. Интенсив за 2 месяца.', teacher_info:'Айнагүл Сыдыкова', price:2100, category:'ort', level:'Средний', lang:'Русский', type:'course' },
 
      // ── Курсы: IT ──
      { title:'Python с нуля до джуниора', description:'Программирование на Python для начинающих. От переменных до создания веб-приложений на Flask.', teacher_info:'Тимур Абдылдаев', price:2900, category:'it', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Web-разработка: HTML & CSS', description:'Создавайте красивые сайты с нуля. Полный курс по HTML5, CSS3 и адаптивной верстке.', teacher_info:'Адилет Байзаков', price:1900, category:'it', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'JavaScript для начинающих', description:'Основы JS: переменные, функции, DOM, события, fetch. Создаём 5 мини-проектов с нуля.', teacher_info:'Адилет Байзаков', price:2400, category:'it', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'React + Node.js: fullstack с нуля', description:'Создаём полноценное веб-приложение. Фронтенд на React, бэкенд на Node.js + Express + PostgreSQL.', teacher_info:'Тимур Абдылдаев', price:4500, category:'it', level:'Средний', lang:'Русский', type:'course' },
      { title:'UI/UX Design: Figma с нуля', description:'Проектируем интерфейсы в Figma. Wireframes, прототипы, дизайн-системы. Портфолио из 3 проектов.', teacher_info:'Зарина Исакова', price:2800, category:'it', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Кибербезопасность: основы', description:'Защита данных, сети, атаки и уязвимости. Практические задания в лабораторной среде.', teacher_info:'Нурлан Осмонов', price:3500, category:'it', level:'Средний', lang:'Русский', type:'course' },
      { title:'SQL и базы данных', description:'PostgreSQL, SQLite, основы проектирования БД. От простых SELECT до оптимизации сложных запросов.', teacher_info:'Адилет Байзаков', price:2200, category:'it', level:'Начинающий', lang:'Русский', type:'course' },
 
      // ── Курсы: Языки ──
      { title:'Английский язык — Upper Intermediate', description:'Продвинутый английский: грамматика, лексика, разговорная практика. Подготовка к IELTS и TOEFL.', teacher_info:'Айгерим Токтосунова', price:3200, category:'lang', level:'Продвинутый', lang:'Русский', type:'course' },
      { title:'Английский с нуля — А1/А2', description:'Алфавит, базовая грамматика, 500 слов для ежедневного общения. Курс для абсолютных начинающих.', teacher_info:'Айгерим Токтосунова', price:1500, category:'lang', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Турецкий язык — базовый', description:'Основы турецкого: алфавит, грамматика, приветствия, числа. 60 уроков с носителем языка.', teacher_info:'Мехмет Йылмаз', price:0, category:'lang', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Китайский язык — HSK 1-2', description:'Иероглифы, тоны, базовые диалоги. Подготовка к сдаче HSK 1 и HSK 2 с нуля.', teacher_info:'Ли Вэй', price:3800, category:'lang', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Русский язык — грамматика и письмо', description:'Орфография, пунктуация, стилистика. Для тех, кто хочет писать грамотно и красиво.', teacher_info:'Татьяна Морозова', price:1200, category:'lang', level:'Средний', lang:'Русский', type:'course' },
 
      // ── Курсы: Медицина ──
      { title:'Анатомия человека', description:'Полный курс анатомии для студентов медицинских вузов. Системы органов, топографическая анатомия.', teacher_info:'Д-р Болотбеков А.', price:0, category:'med', level:'Продвинутый', lang:'Русский', type:'course' },
      { title:'Первая медицинская помощь', description:'Как действовать при ДТП, ожогах, переломах, остановке сердца. Сертификат по окончании.', teacher_info:'Д-р Болотбеков А.', price:0, category:'med', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Фармакология: основы', description:'Классификация лекарств, механизмы действия, побочные эффекты. Для студентов медвузов.', teacher_info:'Проф. Осмонов Б.', price:2500, category:'med', level:'Продвинутый', lang:'Русский', type:'course' },
      { title:'Кардиология для врачей', description:'Современные методы диагностики и лечения сердечно-сосудистых заболеваний.', teacher_info:'Проф. Осмонов Б.', price:4500, category:'med', level:'Продвинутый', lang:'Русский', type:'course' },
      { title:'Психология здоровья', description:'Связь психики и тела, управление стрессом, профилактика выгорания. Для врачей и всех желающих.', teacher_info:'Айнура Сатарова', price:1800, category:'med', level:'Любой', lang:'Русский', type:'course' },
 
      // ── Курсы: Право ──
      { title:'Гражданское право КР', description:'Курс по гражданскому кодексу Кыргызской Республики для юристов и студентов.', teacher_info:'Адв. Мамытов С.', price:2000, category:'law', level:'Средний', lang:'Русский', type:'course' },
      { title:'Трудовое право КР', description:'Трудовой кодекс, права работника, увольнение, пособия. Практические кейсы и шаблоны документов.', teacher_info:'Адв. Мамытов С.', price:1800, category:'law', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Налоговое право для бизнеса', description:'НДС, налог на прибыль, патент, упрощёнка. Как законно оптимизировать налоги в КР.', teacher_info:'Бектур Алиев', price:2500, category:'law', level:'Средний', lang:'Русский', type:'course' },
      { title:'Уголовное право: основы', description:'УК КР: составы преступлений, наказания, защита прав. Для студентов и всех, кто хочет знать свои права.', teacher_info:'Адв. Мамытов С.', price:0, category:'law', level:'Начинающий', lang:'Русский', type:'course' },
 
      // ── Курсы: Творчество ──
      { title:'Рисование акварелью', description:'Научитесь рисовать акварелью с нуля. Техники, цветовые сочетания, практические упражнения.', teacher_info:'Айнура Джакыпова', price:1500, category:'art', level:'Начинающий', lang:'Кыргызский', type:'course' },
      { title:'Цифровая иллюстрация в Procreate', description:'Рисуем на iPad в Procreate. Слои, кисти, портреты, пейзажи. С нуля до готового портфолио.', teacher_info:'Зарина Исакова', price:2200, category:'art', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Фотография: от смартфона до зеркалки', description:'Композиция, свет, цвет, обработка в Lightroom. Снимаем красиво на любую камеру.', teacher_info:'Марат Джумабаев', price:1700, category:'art', level:'Начинающий', lang:'Русский', type:'course' },
      { title:'Кулинария: Кыргызская кухня', description:'Бешбармак, манты, самса, лагман и другие традиционные блюда. Секреты правильного теста и бульона.', teacher_info:'Гульзат Маматова', price:0, category:'art', level:'Начинающий', lang:'Кыргызский', type:'course' },
      { title:'Игра на комузе для начинающих', description:'История комуза, настройка, базовые приёмы игры, традиционные кюи. Обучение с нуля онлайн.', teacher_info:'Алмаз Токтомаматов', price:1200, category:'art', level:'Начинающий', lang:'Кыргызский', type:'course' },
 
      // ── Мастер-классы ──
      { title:'Мастер-класс: Акварельный пейзаж', description:'Рисуем горный пейзаж Кыргызстана акварелью за 3 часа. Прямой эфир с практическими заданиями.', teacher_info:'Айнура Джакыпова', price:500, category:'art', level:'Начинающий', lang:'Кыргызский', type:'masterclass', duration:'3 часа', scheduled_at:'2026-04-20 14:00' },
      { title:'Мастер-класс: Алгоритмы и структуры данных', description:'Разбираем топ-20 алгоритмических задач на Python. Подготовка к техническим интервью.', teacher_info:'Тимур Абдылдаев', price:800, category:'it', level:'Средний', lang:'Русский', type:'masterclass', duration:'4 часа', scheduled_at:'2026-04-25 10:00' },
      { title:'Мастер-класс: Разговорный английский', description:'2 часа живой практики. Обсуждение актуальных тем, исправление ошибок в режиме реального времени.', teacher_info:'Айгерим Токтосунова', price:400, category:'lang', level:'Любой', lang:'Английский', type:'masterclass', duration:'2 часа', scheduled_at:'2026-04-18 17:00' },
 
      // Лекции
      { title:'Лекция: Введение в машинное обучение', description:'Основные концепции ML: supervised learning, нейросети, применение в реальных задачах. Лекция + Q&A.', teacher_info:'Нурлан Осмонов', price:0, category:'it', level:'Средний', lang:'Русский', type:'lecture', duration:'1.5 часа', scheduled_at:'2026-04-15 19:00' },
      { title:'Лекция: Права человека в КР', description:'Международные стандарты прав человека и их применение в Кыргызстане. Актуальные кейсы 2025-2026.', teacher_info:'Адв. Мамытов С.', price:0, category:'law', level:'Любой', lang:'Русский', type:'lecture', duration:'1 час', scheduled_at:'2026-04-22 18:00' },
      { title:'Лекция: Современная кардиология', description:'Новые методы лечения сердечно-сосудистых заболеваний. Для врачей и студентов медицинских вузов.', teacher_info:'Проф. Осмонов Б.', price:0, category:'med', level:'Продвинутый', lang:'Русский', type:'lecture', duration:'2 часа', scheduled_at:'2026-04-30 16:00' },
 
      // Вебинары
      { title:'Вебинар: Как поступить в зарубежный вуз', description:'Пошаговый план поступления в университеты Европы и США. Документы, мотивационное письмо, интервью.', teacher_info:'Нурбек Жолдошев', price:0, category:'lang', level:'Любой', lang:'Русский', type:'webinar', duration:'1.5 часа', scheduled_at:'2026-04-16 17:00' },
      { title:'Вебинар: Фриланс для разработчиков', description:'Как найти первых клиентов, установить цены и выстроить карьеру фрилансера в IT из Кыргызстана.', teacher_info:'Тимур Абдылдаев', price:0, category:'it', level:'Любой', lang:'Русский', type:'webinar', duration:'1 час', scheduled_at:'2026-04-19 14:00' },
    ];
 
    const stmt = db.prepare(`INSERT INTO content (title, description, teacher_info, price, category, level, lang, type, duration, scheduled_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    contents.forEach(c => {
      stmt.run(c.title, c.description, c.teacher_info, c.price, c.category, c.level, c.lang, c.type, c.duration||null, c.scheduled_at||null);
    });
    stmt.finalize();
    console.log('✅ Тестовые данные добавлены');
  });
}
 
// ══════════════════════════════════════════════════════
// РОУТЫ
// ══════════════════════════════════════════════════════
 
// ── Регистрация ──
app.post('/register', (req, res) => {
  const { firstName, lastName, name, email, password, age, city, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const fullName = name || `${firstName||''} ${lastName||''}`.trim();
  db.run(
    `INSERT INTO users (name, first_name, last_name, email, password, age, city, role) VALUES (?,?,?,?,?,?,?,?)`,
    [fullName, firstName||null, lastName||null, email, password, age||null, city||null, role||'student'],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email уже занят' });
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      res.json({ message: 'Регистрация успешна', userId: this.lastID,
        user: { id: this.lastID, firstName, lastName, name: fullName, email, age, city, role: role||'student', streak: 0 }
      });
    }
  );
});
 
// ── Заявка преподавателя (аккаунт НЕ создаётся до одобрения) ──
app.post('/register-teacher', (req, res) => {
  const { firstName, lastName, email, password, phone, age, city, university, specialty, degree, gradYear, experience, bio, subjects, level, format, coursePrice } = req.body;
  if (!email || !password || !firstName || !lastName) return res.status(400).json({ error: 'Имя, фамилия, email и пароль обязательны' });
  const subjectsJson = Array.isArray(subjects) ? JSON.stringify(subjects) : (subjects||'[]');
 
  // Проверяем нет ли уже заявки или аккаунта с таким email
  db.get(`SELECT id FROM applications WHERE email=?`, [email], (err, existing) => {
    if (existing) return res.status(409).json({ error: 'Заявка с таким email уже существует' });
    db.get(`SELECT id FROM users WHERE email=?`, [email], (err2, user) => {
      if (user) return res.status(409).json({ error: 'Аккаунт с таким email уже существует' });
 
      db.run(
        `INSERT INTO applications (first_name,last_name,email,password,phone,age,city,university,specialty,degree,grad_year,experience,bio,subjects,level,format,course_price,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
        [firstName, lastName, email, password, phone||null, age||null, city||null, university||null, specialty||null, degree||null, gradYear||null, experience||0, bio||null, subjectsJson, level||null, format||null, coursePrice||0],
        function(err3) {
          if (err3) return res.status(500).json({ error: 'Ошибка при сохранении заявки' });
          res.json({ message: 'Заявка отправлена на проверку', applicationId: this.lastID });
        }
      );
    });
  });
});
 
// ── Получить все заявки (для админа) ──
app.get('/applications', (req, res) => {
  db.all(`SELECT * FROM applications ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    rows.forEach(r => { try { r.subjects = JSON.parse(r.subjects||'[]'); } catch { r.subjects=[]; } });
    res.json(rows);
  });
});
 
// ── Одобрить/отклонить заявку ──
app.patch('/applications/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'Неверный статус' });
 
  if (status === 'rejected') {
    db.run(`UPDATE applications SET status='rejected' WHERE id=?`, [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      res.json({ message: 'Заявка отклонена' });
    });
    return;
  }
 
  // Одобрить — создаём аккаунт
  db.get(`SELECT * FROM applications WHERE id=?`, [req.params.id], (err, app) => {
    if (!app) return res.status(404).json({ error: 'Заявка не найдена' });
    const fullName = `${app.first_name} ${app.last_name}`.trim();
 
    db.run(
      `INSERT INTO users (name,first_name,last_name,email,password,age,city,role) VALUES (?,?,?,?,?,?,?,'teacher')`,
      [fullName, app.first_name, app.last_name, app.email, app.password, app.age, app.city],
      function(err2) {
        if (err2) {
          if (err2.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Аккаунт с таким email уже существует' });
          return res.status(500).json({ error: 'Ошибка при создании аккаунта' });
        }
        const userId = this.lastID;
        db.run(
          `INSERT INTO teachers (user_id,first_name,last_name,phone,age,city,university,specialty,degree,grad_year,experience,bio,subjects,level,format,course_price,status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved')`,
          [userId, app.first_name, app.last_name, app.phone, app.age, app.city, app.university, app.specialty, app.degree, app.grad_year, app.experience, app.bio, app.subjects, app.level, app.format, app.course_price],
          function(err3) {
            if (err3) return res.status(500).json({ error: 'Ошибка при создании профиля' });
            db.run(`UPDATE applications SET status='approved' WHERE id=?`, [req.params.id]);
            res.json({ message: 'Заявка одобрена, аккаунт создан', userId });
          }
        );
      }
    );
  });
});
 
// ── Логин + streak ──
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });
 
  db.get(`SELECT * FROM users WHERE email=? AND password=?`, [email, password], (err, user) => {
    if (err)   return res.status(500).json({ error: 'Ошибка сервера' });
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
 
    // Обновляем streak
    const today = new Date().toISOString().slice(0,10);
    const last  = user.last_visit ? user.last_visit.slice(0,10) : null;
    let streak  = user.streak || 0;
    if (last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
      streak = (last === yesterday) ? streak + 1 : 1;
      db.run(`UPDATE users SET streak=?, last_visit=? WHERE id=?`, [streak, today, user.id]);
      db.run(`INSERT OR IGNORE INTO activity_log (user_id, date) VALUES (?,?)`, [user.id, today]);
    }
    user.streak = streak;
 
    // Проверяем достижения
    checkAchievements(user.id, streak);
 
    if (user.role === 'teacher') {
      db.get(`SELECT * FROM teachers WHERE user_id=?`, [user.id], (err2, teacher) => {
        if (teacher) {
          try { teacher.subjects = JSON.parse(teacher.subjects||'[]'); } catch { teacher.subjects=[]; }
          Object.assign(user, teacher);
        }
        delete user.password;
        res.json({ message: 'Вход выполнен', user });
      });
    } else {
      delete user.password;
      res.json({ message: 'Вход выполнен', user });
    }
  });
});
 
// ── Обновить профиль ──
app.patch('/users/:id', (req, res) => {
  const { firstName, lastName, age, city, bio, phone } = req.body;
  const name = `${firstName||''} ${lastName||''}`.trim();
  db.run(`UPDATE users SET name=?,first_name=?,last_name=?,age=?,city=? WHERE id=?`,
    [name, firstName||null, lastName||null, age||null, city||null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      // Обновляем teachers если препод
      db.run(`UPDATE teachers SET first_name=?,last_name=?,phone=?,age=?,city=?,bio=? WHERE user_id=?`,
        [firstName||null, lastName||null, phone||null, age||null, city||null, bio||null, req.params.id]);
      res.json({ message: 'Профиль обновлён' });
    }
  );
});
 
// ── Аватар ──
app.post('/upload/avatar/:userId', uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const avatarUrl = `http://localhost:3000/uploads/avatars/${req.file.filename}`;
  db.run(`UPDATE users SET avatar=? WHERE id=?`, [avatarUrl, req.params.userId], (err) => {
    if (err) return res.status(500).json({ error: 'Ошибка при сохранении' });
    res.json({ avatarUrl });
  });
});
 
// ── Фото курса ──
app.post('/upload/course-image', uploadCourse.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  res.json({ imageUrl: `http://localhost:3000/uploads/courses/${req.file.filename}` });
});
 
// ══ КОНТЕНТ (курсы, мастер-классы, лекции, вебинары) ══
 
app.get('/content', (req, res) => {
  const type = req.query.type || null;
  const q    = type ? `SELECT * FROM content WHERE type=? ORDER BY created_at DESC` : `SELECT * FROM content ORDER BY created_at DESC`;
  const params = type ? [type] : [];
  db.all(q, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    res.json(rows);
  });
});
 
app.post('/content', (req, res) => {
  const { title, description, teacherInfo, price, teacher_id, category, level, lang, image, type, duration, scheduled_at, max_students } = req.body;
  if (!title || !teacher_id) return res.status(400).json({ error: 'Название и teacher_id обязательны' });
  db.run(
    `INSERT INTO content (title,description,teacher_info,price,teacher_id,category,level,lang,image,type,duration,scheduled_at,max_students) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [title, description||null, teacherInfo||null, price||0, teacher_id, category||null, level||null, lang||null, image||null, type||'course', duration||null, scheduled_at||null, max_students||0],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка при добавлении' });
      res.json({ message: 'Контент добавлен', id: this.lastID });
    }
  );
});
 
// ── Старый роут /courses (совместимость) ──
app.get('/courses', (req, res) => {
  db.all(`SELECT * FROM content WHERE type='course' ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    res.json(rows);
  });
});
 
app.post('/courses', (req, res) => {
  const { title, description, teacherInfo, price, teacher_id, category, level, lang, image } = req.body;
  if (!title || !teacher_id) return res.status(400).json({ error: 'Название и teacher_id обязательны' });
  db.run(
    `INSERT INTO content (title,description,teacher_info,price,teacher_id,category,level,lang,image,type) VALUES (?,?,?,?,?,?,?,?,?,'course')`,
    [title, description||null, teacherInfo||null, price||0, teacher_id, category||null, level||null, lang||null, image||null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка при добавлении курса' });
      res.json({ message: 'Курс добавлен', courseId: this.lastID });
    }
  );
});
 
// ── Запись на контент ──
app.post('/enroll', (req, res) => {
  const { user_id, content_id, content_type } = req.body;
  if (!user_id || !content_id) return res.status(400).json({ error: 'user_id и content_id обязательны' });
  db.run(`INSERT OR IGNORE INTO enrollments (user_id, content_id, content_type) VALUES (?,?,?)`,
    [user_id, content_id, content_type||'course'],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      // Проверяем ачивку за первую запись
      db.get(`SELECT COUNT(*) as cnt FROM enrollments WHERE user_id=?`, [user_id], (e, r) => {
        if (r && r.cnt >= 1) grantAchievement(user_id, 'first_enroll');
        if (r && r.cnt >= 5) grantAchievement(user_id, 'five_courses');
      });
      res.json({ message: 'Записан успешно' });
    }
  );
});
 
app.get('/enrollments/:userId', (req, res) => {
  db.all(`SELECT e.*, c.title, c.category, c.type, c.price FROM enrollments e JOIN content c ON c.id=e.content_id WHERE e.user_id=? ORDER BY e.enrolled_at DESC`,
    [req.params.userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      res.json(rows);
    }
  );
});
 
// ── Активность (streak calendar) ──
app.get('/activity/:userId', (req, res) => {
  db.all(`SELECT date FROM activity_log WHERE user_id=? ORDER BY date DESC LIMIT 30`,
    [req.params.userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      res.json(rows.map(r => r.date));
    }
  );
});
 
// ── Достижения ──
app.get('/achievements/:userId', (req, res) => {
  db.all(`SELECT code, unlocked_at FROM achievements WHERE user_id=?`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    res.json(rows);
  });
});
 
function grantAchievement(userId, code) {
  db.run(`INSERT OR IGNORE INTO achievements (user_id, code) VALUES (?,?)`, [userId, code]);
}
 
function checkAchievements(userId, streak) {
  if (streak >= 7)  grantAchievement(userId, 'week_streak');
  if (streak >= 30) grantAchievement(userId, 'month_streak');
  grantAchievement(userId, 'first_login');
}
 
// ── Преподаватели ──
app.get('/teachers', (req, res) => {
  db.all(
    `SELECT u.id, u.email, u.avatar, t.first_name, t.last_name, t.city, t.subjects, t.experience, t.university, t.specialty, t.level, t.format, t.course_price, t.status, t.bio
     FROM teachers t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      rows.forEach(r => { try { r.subjects = JSON.parse(r.subjects||'[]'); } catch { r.subjects=[]; } });
      res.json(rows);
    }
  );
});
 
app.get('/teachers/:userId', (req, res) => {
  db.get(
    `SELECT u.id, u.email, u.role, u.avatar, t.* FROM users u LEFT JOIN teachers t ON t.user_id=u.id WHERE u.id=? AND u.role='teacher'`,
    [req.params.userId], (err, row) => {
      if (err)  return res.status(500).json({ error: 'Ошибка сервера' });
      if (!row) return res.status(404).json({ error: 'Преподаватель не найден' });
      try { row.subjects = JSON.parse(row.subjects||'[]'); } catch { row.subjects=[]; }
      res.json(row);
    }
  );
});
 
app.patch('/teachers/:userId/status', (req, res) => {
  const { status } = req.body;
  if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  db.run(`UPDATE teachers SET status=? WHERE user_id=?`, [status, req.params.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Ошибка сервера' });
    if (status === 'approved') grantAchievement(req.params.userId, 'teacher_approved');
    res.json({ message: `Статус → ${status}` });
  });
});
 
// ── Пользователи ──
app.get('/users', (req, res) => {
  db.all(`SELECT id, name, first_name, last_name, email, role, age, city, streak, created_at FROM users ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
 
// ── Статистика для админа ──
app.get('/admin/stats', (req, res) => {
  db.get(`SELECT COUNT(*) as total_users FROM users`, (e1, u) => {
    db.get(`SELECT COUNT(*) as total_teachers FROM teachers`, (e2, t) => {
      db.get(`SELECT COUNT(*) as pending FROM teachers WHERE status='pending'`, (e3, p) => {
        db.get(`SELECT COUNT(*) as total_content FROM content`, (e4, c) => {
          res.json({ total_users: u?.total_users||0, total_teachers: t?.total_teachers||0, pending: p?.pending||0, total_content: c?.total_content||0 });
        });
      });
    });
  });
});
 
// ── Health ──
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Сервер работает 🚀' }));
 
app.listen(PORT, () => {
  console.log(`🚀 Сервер → http://localhost:${PORT}`);
  console.log(`📋 Админ  → http://localhost:${PORT}/admin.html`);
});
 