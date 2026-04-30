const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'mcms.db');

// Multer for file uploads (class profile pics)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student','teacher','principal')),
    grade INTEGER,
    total_points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    pfp TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS class_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    UNIQUE(class_id, student_id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    answers TEXT NOT NULL,
    score INTEGER,
    graded INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_id),
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    seen INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_id) REFERENCES users(id),
    FOREIGN KEY(to_id) REFERENCES users(id)
  )`);

  // Create default principal account if none exists
  const principals = db.exec("SELECT id FROM users WHERE role='principal'");
  if (!principals.length || !principals[0].values.length) {
    const hash = bcrypt.hashSync('principal123', 10);
    db.run("INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)",
      ['principal', hash, 'Principal', 'principal']);
  }

  saveDB();
  console.log('Database initialized');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mcms-bombers-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
  };
}

// ============ AUTH ROUTES ============

app.post('/api/register', requireRole('teacher', 'principal'), (req, res) => {
  const { username, password, display_name, role, grade } = req.body;
  if (!username || !password || !display_name || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!['student', 'teacher'].includes(role)) {
    // Only principal can create teacher accounts
    if (role === 'teacher' && req.session.user.role !== 'principal') {
      return res.status(403).json({ error: 'Only the principal can create teacher accounts' });
    }
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'teacher' && req.session.user.role !== 'principal') {
    return res.status(403).json({ error: 'Only the principal can create teacher accounts' });
  }
  if (role === 'student' && !grade) {
    return res.status(400).json({ error: 'Grade required for students' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password, display_name, role, grade) VALUES (?, ?, ?, ?, ?)",
      [username, hash, display_name, role, role === 'student' ? parseInt(grade) : null]);
    saveDB();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Username already taken' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const rows = db.exec("SELECT * FROM users WHERE username = ?", [username]);
  if (!rows.length || !rows[0].values.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const cols = rows[0].columns;
  const vals = rows[0].values[0];
  const user = {};
  cols.forEach((c, i) => user[c] = vals[i]);

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  delete user.password;
  req.session.user = user;
  res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// ============ CLASS ROUTES ============

app.post('/api/classes', requireRole('teacher', 'principal'), upload.single('pfp'), (req, res) => {
  const { name, subject, grade } = req.body;
  const pfp = req.file ? '/uploads/' + req.file.filename : '';
  db.run("INSERT INTO classes (name, subject, grade, teacher_id, pfp) VALUES (?, ?, ?, ?, ?)",
    [name, subject, parseInt(grade), req.session.user.id, pfp]);
  saveDB();
  res.json({ success: true });
});

app.get('/api/classes', requireAuth, (req, res) => {
  const user = req.session.user;
  let rows;
  if (user.role === 'teacher') {
    rows = db.exec("SELECT c.*, u.display_name as teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id WHERE c.teacher_id = ?", [user.id]);
  } else if (user.role === 'student') {
    rows = db.exec(`SELECT c.*, u.display_name as teacher_name FROM classes c 
      JOIN users u ON c.teacher_id = u.id 
      JOIN class_students cs ON cs.class_id = c.id 
      WHERE cs.student_id = ?`, [user.id]);
  } else {
    // principal sees all
    rows = db.exec("SELECT c.*, u.display_name as teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id");
  }
  res.json(parseRows(rows));
});

app.get('/api/classes/:id', requireAuth, (req, res) => {
  const rows = db.exec("SELECT c.*, u.display_name as teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id WHERE c.id = ?", [parseInt(req.params.id)]);
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Class not found' });
  res.json(parseRows(rows)[0]);
});

// Add student to class
app.post('/api/classes/:id/students', requireRole('teacher', 'principal'), (req, res) => {
  const { student_id } = req.body;
  try {
    db.run("INSERT INTO class_students (class_id, student_id) VALUES (?, ?)",
      [parseInt(req.params.id), parseInt(student_id)]);
    saveDB();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Student already in class or invalid' });
  }
});

// Remove student from class
app.delete('/api/classes/:id/students/:sid', requireRole('teacher', 'principal'), (req, res) => {
  db.run("DELETE FROM class_students WHERE class_id = ? AND student_id = ?",
    [parseInt(req.params.id), parseInt(req.params.sid)]);
  saveDB();
  res.json({ success: true });
});

// Get students in a class
app.get('/api/classes/:id/students', requireAuth, (req, res) => {
  const rows = db.exec(`SELECT u.id, u.username, u.display_name, u.grade, u.total_points 
    FROM users u JOIN class_students cs ON cs.student_id = u.id 
    WHERE cs.class_id = ?`, [parseInt(req.params.id)]);
  res.json(parseRows(rows));
});

// Get available students (not in this class) filtered by grade
app.get('/api/classes/:id/available-students', requireRole('teacher', 'principal'), (req, res) => {
  const classRows = db.exec("SELECT grade FROM classes WHERE id = ?", [parseInt(req.params.id)]);
  if (!classRows.length || !classRows[0].values.length) return res.status(404).json({ error: 'Class not found' });
  const grade = classRows[0].values[0][0];
  const rows = db.exec(`SELECT u.id, u.username, u.display_name, u.grade FROM users u 
    WHERE u.role = 'student' AND u.id NOT IN 
    (SELECT student_id FROM class_students WHERE class_id = ?)
    ORDER BY u.display_name`, [parseInt(req.params.id)]);
  res.json(parseRows(rows));
});

// ============ ASSIGNMENT ROUTES ============

app.post('/api/classes/:id/assignments', requireRole('teacher', 'principal'), (req, res) => {
  const { title, description, questions, due_date } = req.body;
  // questions is JSON array of { question, type, options, correct_answer }
  db.run("INSERT INTO assignments (class_id, title, description, questions, due_date) VALUES (?, ?, ?, ?, ?)",
    [parseInt(req.params.id), title, description || '', JSON.stringify(questions), due_date || null]);
  saveDB();
  res.json({ success: true });
});

app.get('/api/classes/:id/assignments', requireAuth, (req, res) => {
  const rows = db.exec("SELECT * FROM assignments WHERE class_id = ? ORDER BY created_at DESC",
    [parseInt(req.params.id)]);
  const assignments = parseRows(rows);
  assignments.forEach(a => a.questions = JSON.parse(a.questions));
  res.json(assignments);
});

app.get('/api/assignments/:id', requireAuth, (req, res) => {
  const rows = db.exec("SELECT * FROM assignments WHERE id = ?", [parseInt(req.params.id)]);
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' });
  const a = parseRows(rows)[0];
  a.questions = JSON.parse(a.questions);
  res.json(a);
});

// Submit assignment (auto-grade)
app.post('/api/assignments/:id/submit', requireRole('student'), (req, res) => {
  const { answers } = req.body; // array of answers
  const assignmentRows = db.exec("SELECT * FROM assignments WHERE id = ?", [parseInt(req.params.id)]);
  if (!assignmentRows.length || !assignmentRows[0].values.length) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  const assignment = parseRows(assignmentRows)[0];
  const questions = JSON.parse(assignment.questions);

  // Auto-grade
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] && answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase()) {
      correct++;
    }
  });
  const score = Math.round((correct / questions.length) * 100);

  // Calculate points
  let points = 0;
  if (score >= 90) points = 100;
  else if (score >= 80) points = 75;
  else if (score >= 70) points = 50;
  else if (score >= 60) points = 25;
  else points = -20;

  try {
    db.run("INSERT INTO submissions (assignment_id, student_id, answers, score, graded) VALUES (?, ?, ?, ?, 1)",
      [parseInt(req.params.id), req.session.user.id, JSON.stringify(answers), score]);
    // Update total points
    db.run("UPDATE users SET total_points = total_points + ? WHERE id = ?",
      [points, req.session.user.id]);
    saveDB();
    // Update session
    req.session.user.total_points = (req.session.user.total_points || 0) + points;
    res.json({ success: true, score, points, correct, total: questions.length });
  } catch (e) {
    res.status(400).json({ error: 'Already submitted' });
  }
});

// Get submissions for an assignment (teacher view)
app.get('/api/assignments/:id/submissions', requireRole('teacher', 'principal'), (req, res) => {
  const rows = db.exec(`SELECT s.*, u.display_name, u.username FROM submissions s 
    JOIN users u ON s.student_id = u.id 
    WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`, [parseInt(req.params.id)]);
  const subs = parseRows(rows);
  subs.forEach(s => s.answers = JSON.parse(s.answers));
  res.json(subs);
});

// Get student's submission for an assignment
app.get('/api/assignments/:id/my-submission', requireRole('student'), (req, res) => {
  const rows = db.exec("SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?",
    [parseInt(req.params.id), req.session.user.id]);
  if (!rows.length || !rows[0].values.length) return res.json(null);
  const sub = parseRows(rows)[0];
  sub.answers = JSON.parse(sub.answers);
  res.json(sub);
});

// ============ COMMENT / NOTIFICATION ROUTES ============

app.post('/api/comments', requireRole('teacher', 'principal'), (req, res) => {
  const { to_id, message } = req.body;
  db.run("INSERT INTO comments (from_id, to_id, message) VALUES (?, ?, ?)",
    [req.session.user.id, parseInt(to_id), message]);
  saveDB();
  res.json({ success: true });
});

app.get('/api/comments', requireAuth, (req, res) => {
  const rows = db.exec(`SELECT c.*, u.display_name as from_name FROM comments c 
    JOIN users u ON c.from_id = u.id 
    WHERE c.to_id = ? ORDER BY c.created_at DESC`, [req.session.user.id]);
  res.json(parseRows(rows));
});

app.get('/api/comments/unseen', requireAuth, (req, res) => {
  const rows = db.exec(`SELECT c.*, u.display_name as from_name FROM comments c 
    JOIN users u ON c.from_id = u.id 
    WHERE c.to_id = ? AND c.seen = 0 ORDER BY c.created_at DESC`, [req.session.user.id]);
  res.json(parseRows(rows));
});

app.post('/api/comments/:id/seen', requireAuth, (req, res) => {
  db.run("UPDATE comments SET seen = 1 WHERE id = ? AND to_id = ?",
    [parseInt(req.params.id), req.session.user.id]);
  saveDB();
  res.json({ success: true });
});

// ============ LEADERBOARD ============

app.get('/api/leaderboard', requireAuth, (req, res) => {
  const grade = req.query.grade;
  let rows;
  if (grade) {
    rows = db.exec("SELECT id, display_name, grade, total_points FROM users WHERE role='student' AND grade = ? ORDER BY total_points DESC", [parseInt(grade)]);
  } else {
    rows = db.exec("SELECT id, display_name, grade, total_points FROM users WHERE role='student' ORDER BY total_points DESC");
  }
  res.json(parseRows(rows));
});

// ============ ALL STUDENTS (for teacher/principal) ============

app.get('/api/students', requireRole('teacher', 'principal'), (req, res) => {
  const rows = db.exec("SELECT id, username, display_name, grade, total_points FROM users WHERE role='student' ORDER BY grade, display_name");
  res.json(parseRows(rows));
});

// ============ ALL USERS (for principal) ============

app.get('/api/users', requireRole('teacher', 'principal'), (req, res) => {
  const rows = db.exec("SELECT id, username, display_name, role, grade, total_points FROM users ORDER BY role, display_name");
  res.json(parseRows(rows));
});

// ============ GRADES OVERVIEW ============

app.get('/api/my-grades', requireRole('student'), (req, res) => {
  const rows = db.exec(`
    SELECT c.id as class_id, c.name as class_name, c.subject,
      AVG(s.score) as avg_score, COUNT(s.id) as submitted_count
    FROM classes c
    JOIN class_students cs ON cs.class_id = c.id
    LEFT JOIN assignments a ON a.class_id = c.id
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
    WHERE cs.student_id = ?
    GROUP BY c.id
  `, [req.session.user.id, req.session.user.id]);
  res.json(parseRows(rows));
});

// Helper to parse sql.js results into array of objects
function parseRows(result) {
  if (!result || !result.length || !result[0].values.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

// Start
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏈 MCMS BOMBERS is running at http://localhost:${PORT}\n`);
  });
});
