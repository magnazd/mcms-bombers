// ===== MCMS BOMBERS - Fully Client-Side App (localStorage DB) =====

// ===== DATABASE LAYER =====
const DB = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('mcms_' + key)) || []; }
    catch { return []; }
  },
  _set(key, val) { localStorage.setItem('mcms_' + key, JSON.stringify(val)); },
  _nextId(key) {
    const items = this._get(key);
    return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
  },
  getUsers() { return this._get('users'); },
  saveUsers(u) { this._set('users', u); },
  getClasses() { return this._get('classes'); },
  saveClasses(c) { this._set('classes', c); },
  getClassStudents() { return this._get('class_students'); },
  saveClassStudents(cs) { this._set('class_students', cs); },
  getAssignments() { return this._get('assignments'); },
  saveAssignments(a) { this._set('assignments', a); },
  getSubmissions() { return this._get('submissions'); },
  saveSubmissions(s) { this._set('submissions', s); },
  getComments() { return this._get('comments'); },
  saveComments(c) { this._set('comments', c); },

  init() {
    const users = this.getUsers();
    if (!users.find(u => u.role === 'principal')) {
      users.push({
        id: this._nextId('users'),
        username: 'principal',
        password: 'principal123',
        display_name: 'Principal',
        role: 'principal',
        grade: null,
        total_points: 0
      });
      this.saveUsers(users);
    }
  },

  addUser(username, password, display_name, role, grade) {
    const users = this.getUsers();
    if (users.find(u => u.username === username)) return null;
    const user = {
      id: this._nextId('users'),
      username, password, display_name, role,
      grade: grade ? parseInt(grade) : null,
      total_points: 0
    };
    users.push(user);
    this.saveUsers(users);
    return user;
  },

  findUser(username, password) {
    return this.getUsers().find(u => u.username === username && u.password === password);
  },

  addClass(name, subject, grade, teacherId, pfp) {
    const classes = this.getClasses();
    const cls = {
      id: this._nextId('classes'),
      name, subject, grade: parseInt(grade),
      teacher_id: teacherId, pfp: pfp || ''
    };
    classes.push(cls);
    this.saveClasses(classes);
    return cls;
  },

  addStudentToClass(classId, studentId) {
    const cs = this.getClassStudents();
    if (cs.find(r => r.class_id === classId && r.student_id === studentId)) return false;
    cs.push({ id: this._nextId('class_students'), class_id: classId, student_id: studentId });
    this.saveClassStudents(cs);
    return true;
  },

  removeStudentFromClass(classId, studentId) {
    let cs = this.getClassStudents();
    cs = cs.filter(r => !(r.class_id === classId && r.student_id === studentId));
    this.saveClassStudents(cs);
  },

  getStudentsInClass(classId) {
    const cs = this.getClassStudents().filter(r => r.class_id === classId);
    const users = this.getUsers();
    return cs.map(r => users.find(u => u.id === r.student_id)).filter(Boolean);
  },

  getClassesForStudent(studentId) {
    const cs = this.getClassStudents().filter(r => r.student_id === studentId);
    const classes = this.getClasses();
    return cs.map(r => classes.find(c => c.id === r.class_id)).filter(Boolean);
  },

  getClassesForTeacher(teacherId) {
    return this.getClasses().filter(c => c.teacher_id === teacherId);
  },

  addAssignment(classId, title, description, questions, dueDate) {
    const assignments = this.getAssignments();
    const a = {
      id: this._nextId('assignments'),
      class_id: classId, title, description: description || '',
      questions, due_date: dueDate || ''
    };
    assignments.push(a);
    this.saveAssignments(assignments);
    return a;
  },

  getAssignmentsForClass(classId) {
    return this.getAssignments().filter(a => a.class_id === classId);
  },

  submitAssignment(assignmentId, studentId, answers) {
    const subs = this.getSubmissions();
    if (subs.find(s => s.assignment_id === assignmentId && s.student_id === studentId)) return null;
    const assignment = this.getAssignments().find(a => a.id === assignmentId);
    if (!assignment) return null;

    let correct = 0;
    assignment.questions.forEach((q, i) => {
      if (answers[i] && answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase()) {
        correct++;
      }
    });
    const score = Math.round((correct / assignment.questions.length) * 100);
    let points = 0;
    if (score >= 90) points = 100;
    else if (score >= 80) points = 75;
    else if (score >= 70) points = 50;
    else if (score >= 60) points = 25;
    else points = -20;

    const sub = {
      id: this._nextId('submissions'),
      assignment_id: assignmentId, student_id: studentId,
      answers, score, points
    };
    subs.push(sub);
    this.saveSubmissions(subs);

    // Update user points
    const users = this.getUsers();
    const user = users.find(u => u.id === studentId);
    if (user) { user.total_points += points; this.saveUsers(users); }

    return { score, points, correct, total: assignment.questions.length };
  },

  getSubmission(assignmentId, studentId) {
    return this.getSubmissions().find(s => s.assignment_id === assignmentId && s.student_id === studentId);
  },

  getSubmissionsForAssignment(assignmentId) {
    const subs = this.getSubmissions().filter(s => s.assignment_id === assignmentId);
    const users = this.getUsers();
    return subs.map(s => ({ ...s, ...users.find(u => u.id === s.student_id) && {
      display_name: users.find(u => u.id === s.student_id).display_name,
      username: users.find(u => u.id === s.student_id).username
    }}));
  },

  addComment(fromId, toId, message) {
    const comments = this.getComments();
    comments.push({
      id: this._nextId('comments'),
      from_id: fromId, to_id: toId, message, seen: false,
      created_at: new Date().toISOString()
    });
    this.saveComments(comments);
  },

  getCommentsFor(userId) {
    const comments = this.getComments().filter(c => c.to_id === userId);
    const users = this.getUsers();
    return comments.map(c => ({
      ...c,
      from_name: (users.find(u => u.id === c.from_id) || {}).display_name || 'Unknown'
    })).reverse();
  },

  getUnseenComments(userId) {
    return this.getCommentsFor(userId).filter(c => !c.seen);
  },

  markSeen(commentId) {
    const comments = this.getComments();
    const c = comments.find(x => x.id === commentId);
    if (c) { c.seen = true; this.saveComments(comments); }
  }
};

DB.init();

// ===== APP STATE =====
let currentUser = null;
let currentClassId = null;

// ===== AUTH =====
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const user = DB.findUser(username, password);
  if (user) {
    currentUser = user;
    localStorage.setItem('mcms_session', JSON.stringify({ id: user.id }));
    showDashboard();
  } else {
    document.getElementById('login-error').textContent = 'Invalid username or password';
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('mcms_session');
  document.getElementById('page-dashboard').classList.add('hidden');
  document.getElementById('page-landing').classList.remove('hidden');
}

function checkAuth() {
  try {
    const session = JSON.parse(localStorage.getItem('mcms_session'));
    if (session) {
      const user = DB.getUsers().find(u => u.id === session.id);
      if (user) { currentUser = user; showDashboard(); }
    }
  } catch (e) {}
}

// ===== CREATE ACCOUNT (Teacher/Principal only) =====
function showCreateAccount() {
  const isPrincipal = currentUser.role === 'principal';
  const roleOptions = isPrincipal
    ? '<option value="student">Student</option><option value="teacher">Teacher</option>'
    : '<option value="student">Student</option>';

  openModal('Create New Account', `
    <form onsubmit="handleCreateAccount(event)">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="ca-username" required placeholder="Username for login">
      </div>
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" id="ca-display" required placeholder="Full name">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="ca-password" required placeholder="Password">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="ca-role" required onchange="toggleCreateGrade()">
          <option value="">Select Role</option>
          ${roleOptions}
        </select>
      </div>
      <div class="form-group" id="ca-grade-group" style="display:none">
        <label>Grade Level</label>
        <select id="ca-grade">
          <option value="">Select Grade</option>
          <option value="6">6th Grade</option>
          <option value="7">7th Grade</option>
          <option value="8">8th Grade</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Create Account</button>
      <div id="ca-error" class="error-msg" style="margin-top:10px"></div>
      <div id="ca-success" class="error-msg" style="margin-top:10px;color:#000"></div>
    </form>
  `);
}

function toggleCreateGrade() {
  const role = document.getElementById('ca-role').value;
  document.getElementById('ca-grade-group').style.display = role === 'student' ? '' : 'none';
}

function handleCreateAccount(e) {
  e.preventDefault();
  const role = document.getElementById('ca-role').value;
  if (role === 'teacher' && currentUser.role !== 'principal') {
    document.getElementById('ca-error').textContent = 'Only the principal can create teacher accounts';
    return;
  }
  const user = DB.addUser(
    document.getElementById('ca-username').value,
    document.getElementById('ca-password').value,
    document.getElementById('ca-display').value,
    role,
    document.getElementById('ca-grade').value
  );
  if (user) {
    document.getElementById('ca-error').textContent = '';
    document.getElementById('ca-success').textContent = 'Account created for ' + user.display_name + '!';
    document.getElementById('ca-username').value = '';
    document.getElementById('ca-display').value = '';
    document.getElementById('ca-password').value = '';
  } else {
    document.getElementById('ca-success').textContent = '';
    document.getElementById('ca-error').textContent = 'Username already taken';
  }
}

// ===== DASHBOARD =====
function showDashboard() {
  // Refresh user data
  currentUser = DB.getUsers().find(u => u.id === currentUser.id) || currentUser;

  document.getElementById('page-landing').classList.add('hidden');
  document.getElementById('page-dashboard').classList.remove('hidden');

  document.getElementById('welcome-name').textContent = currentUser.display_name;
  const badge = document.getElementById('role-badge');
  badge.textContent = currentUser.role.toUpperCase();
  badge.className = 'role-badge ' + currentUser.role;

  const info = currentUser.display_name + ' (' + currentUser.role + ')';
  document.getElementById('user-info').textContent = currentUser.grade
    ? info + ' - ' + currentUser.grade + 'th Grade' : info;

  if (currentUser.role === 'teacher' || currentUser.role === 'principal') {
    document.getElementById('btn-create-class').style.display = '';
    document.getElementById('send-comment-area').style.display = '';
    document.getElementById('nav-create-account').style.display = '';
    document.getElementById('nav-users').style.display = '';
  }
  if (currentUser.role === 'student') {
    document.getElementById('student-stats').classList.remove('hidden');
    document.getElementById('student-grades').classList.remove('hidden');
    document.getElementById('stat-points').textContent = currentUser.total_points || 0;
    loadMyGrades();
  }

  showSection('dashboard');
  checkComments();
  startCommentPolling();
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector('.nav-btn[data-page="' + name + '"]');
  if (navBtn) navBtn.classList.add('active');

  if (name === 'classes') loadClasses();
  if (name === 'leaderboard') loadLeaderboard('', document.querySelector('.filter-btn'));
  if (name === 'comments') loadComments();
  if (name === 'users') loadUsers();
}

// ===== MY GRADES =====
function loadMyGrades() {
  const myClasses = DB.getClassesForStudent(currentUser.id);
  const container = document.getElementById('grades-list');

  if (!myClasses.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>';
    return;
  }

  container.innerHTML = myClasses.map(c => {
    const assignments = DB.getAssignmentsForClass(c.id);
    const subs = assignments.map(a => DB.getSubmission(a.id, currentUser.id)).filter(Boolean);
    const avg = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;

    let letter = 'N/A', colorClass = '', bgColor = '#666';
    if (avg !== null) {
      if (avg >= 90) { letter = 'A'; colorClass = 'grade-a'; bgColor = '#000'; }
      else if (avg >= 80) { letter = 'B'; colorClass = 'grade-b'; bgColor = '#333'; }
      else if (avg >= 70) { letter = 'C'; colorClass = 'grade-c'; bgColor = '#555'; }
      else if (avg >= 60) { letter = 'D'; colorClass = 'grade-d'; bgColor = '#777'; }
      else { letter = 'F'; colorClass = 'grade-f'; bgColor = '#999'; }
    }

    return '<div class="grade-card">' +
      '<div class="class-name">' + esc(c.name) + '</div>' +
      '<div class="subject">' + esc(c.subject) + '</div>' +
      '<div class="avg-score ' + colorClass + '">' + (avg !== null ? avg + '%' : 'No grades') + '</div>' +
      '<span class="letter-grade" style="background:' + bgColor + '">' + letter + '</span>' +
      ' <span style="font-size:12px;color:var(--text-light)">' + subs.length + ' submitted</span>' +
      '</div>';
  }).join('');

  document.getElementById('stat-classes').textContent = myClasses.length;
}

// ===== CLASSES =====
function loadClasses() {
  let classes;
  if (currentUser.role === 'teacher') {
    classes = DB.getClassesForTeacher(currentUser.id);
  } else if (currentUser.role === 'student') {
    classes = DB.getClassesForStudent(currentUser.id);
  } else {
    classes = DB.getClasses();
  }

  const grid = document.getElementById('classes-grid');
  if (!classes.length) {
    grid.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>';
    return;
  }

  const users = DB.getUsers();
  grid.innerHTML = classes.map(c => {
    const teacher = users.find(u => u.id === c.teacher_id);
    const teacherName = teacher ? teacher.display_name : 'Unknown';
    const subjectIcons = {
      'Math': '📐', 'Science': '🔬', 'English': '📚', 'History': '🏛️',
      'Art': '🎨', 'Music': '🎵', 'PE': '🏃', 'Technology': '💻',
      'Reading': '📖', 'Writing': '✍️', 'Social Studies': '🌍'
    };
    const icon = subjectIcons[c.subject] || '📝';
    const imgHtml = c.pfp
      ? '<img src="' + esc(c.pfp) + '" alt="class">'
      : '<span>' + icon + '</span>';

    return '<div class="class-card" onclick="openClass(' + c.id + ')">' +
      '<div class="class-card-img">' + imgHtml + '</div>' +
      '<div class="class-card-body">' +
      '<h3>' + esc(c.name) + '</h3>' +
      '<span class="subject-tag">' + esc(c.subject) + ' - ' + c.grade + 'th Grade</span>' +
      '<div class="teacher-name">Teacher: ' + esc(teacherName) + '</div>' +
      '</div></div>';
  }).join('');
}

function showCreateClass() {
  openModal('Create New Class', `
    <form onsubmit="createClass(event)">
      <div class="form-group">
        <label>Class Name</label>
        <input type="text" id="cc-name" required placeholder="e.g. Mrs. Smith's Math">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <select id="cc-subject" required>
          <option value="">Select Subject</option>
          <option>Math</option><option>Science</option><option>English</option>
          <option>Reading</option><option>Writing</option><option>History</option>
          <option>Social Studies</option><option>Art</option><option>Music</option>
          <option>PE</option><option>Technology</option>
        </select>
      </div>
      <div class="form-group">
        <label>Grade Level</label>
        <select id="cc-grade" required>
          <option value="">Select Grade</option>
          <option value="6">6th Grade</option>
          <option value="7">7th Grade</option>
          <option value="8">8th Grade</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Create Class</button>
    </form>
  `);
}

function createClass(e) {
  e.preventDefault();
  DB.addClass(
    document.getElementById('cc-name').value,
    document.getElementById('cc-subject').value,
    document.getElementById('cc-grade').value,
    currentUser.id, ''
  );
  closeModal();
  loadClasses();
}

// ===== CLASS DETAIL =====
function openClass(id) {
  currentClassId = id;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-class-detail').classList.remove('hidden');

  const cls = DB.getClasses().find(c => c.id === id);
  const teacher = DB.getUsers().find(u => u.id === cls.teacher_id);
  const teacherName = teacher ? teacher.display_name : 'Unknown';

  const header = document.getElementById('class-header');
  header.innerHTML = '<div class="class-icon">📚</div>' +
    '<div><h2>' + esc(cls.name) + '</h2>' +
    '<p style="color:var(--text-light)">' + esc(cls.subject) + ' - ' + cls.grade + 'th Grade | Teacher: ' + esc(teacherName) + '</p></div>';

  if (currentUser.role === 'teacher' || currentUser.role === 'principal') {
    document.getElementById('btn-create-assignment').style.display = '';
    document.getElementById('tab-add-students').style.display = '';
  } else {
    document.getElementById('btn-create-assignment').style.display = 'none';
    document.getElementById('tab-add-students').style.display = 'none';
  }

  showClassTab('assignments', document.querySelector('.class-tabs .tab-btn'));
  loadAssignments(id);
  loadClassStudents(id);
}

function showClassTab(tab, btn) {
  document.querySelectorAll('.class-tab').forEach(t => t.classList.add('hidden'));
  document.getElementById('class-tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.class-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'add-students') loadAvailableStudents(currentClassId);
}

function backToClassDetail() {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-class-detail').classList.remove('hidden');
}

// ===== ASSIGNMENTS =====
function loadAssignments(classId) {
  const assignments = DB.getAssignmentsForClass(classId);
  const container = document.getElementById('assignments-list');

  if (!assignments.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No assignments yet.</p>';
    return;
  }

  container.innerHTML = assignments.map(a => {
    const due = a.due_date ? 'Due: ' + a.due_date : 'No due date';
    return '<div class="assignment-card" onclick="openAssignment(' + a.id + ')">' +
      '<div><h4>' + esc(a.title) + '</h4><span class="due-date">' + due + '</span></div>' +
      '<span style="font-size:13px;color:var(--text-light)">' + a.questions.length + ' questions</span></div>';
  }).join('');
}

let questionCount = 0;

function showCreateAssignment() {
  questionCount = 0;
  openModal('Create Assignment', `
    <form onsubmit="createAssignment(event)">
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="ca-title" required placeholder="Assignment title">
      </div>
      <div class="form-group">
        <label>Description (optional)</label>
        <textarea id="ca-desc" rows="2" placeholder="Instructions for students"></textarea>
      </div>
      <div class="form-group">
        <label>Due Date (optional)</label>
        <input type="date" id="ca-due">
      </div>
      <div id="questions-container">
        <h4>Questions</h4>
        <div id="questions-list"></div>
        <button type="button" class="btn btn-sm btn-outline" onclick="addQuestion()">+ Add Question</button>
      </div>
      <br>
      <button type="submit" class="btn btn-primary btn-full">Create Assignment</button>
    </form>
  `);
  addQuestion();
}

function addQuestion() {
  questionCount++;
  const n = questionCount;
  const div = document.createElement('div');
  div.className = 'question-block';
  div.innerHTML = `
    <label>Question ${n}</label>
    <input type="text" id="q-text-${n}" placeholder="Enter question" required>
    <label style="margin-top:8px">Type</label>
    <select id="q-type-${n}" onchange="toggleQuestionType(${n})">
      <option value="multiple_choice">Multiple Choice</option>
      <option value="short_answer">Short Answer</option>
      <option value="true_false">True/False</option>
    </select>
    <div id="q-options-${n}" style="margin-top:8px">
      <label>Options (one per line)</label>
      <textarea id="q-opts-${n}" rows="4" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"></textarea>
    </div>
    <label style="margin-top:8px">Correct Answer</label>
    <input type="text" id="q-answer-${n}" placeholder="Exact correct answer" required>
  `;
  document.getElementById('questions-list').appendChild(div);
}

function toggleQuestionType(n) {
  const type = document.getElementById('q-type-' + n).value;
  const optsDiv = document.getElementById('q-options-' + n);
  if (type === 'multiple_choice') { optsDiv.style.display = ''; }
  else if (type === 'true_false') {
    optsDiv.style.display = 'none';
    document.getElementById('q-answer-' + n).placeholder = 'true or false';
  } else { optsDiv.style.display = 'none'; }
}

function createAssignment(e) {
  e.preventDefault();
  const questions = [];
  for (let i = 1; i <= questionCount; i++) {
    const textEl = document.getElementById('q-text-' + i);
    if (!textEl) continue;
    const type = document.getElementById('q-type-' + i).value;
    const q = { question: textEl.value, type, correct_answer: document.getElementById('q-answer-' + i).value };
    if (type === 'multiple_choice') {
      q.options = document.getElementById('q-opts-' + i).value.split('\n').filter(o => o.trim());
    } else if (type === 'true_false') {
      q.options = ['True', 'False'];
    }
    questions.push(q);
  }
  DB.addAssignment(currentClassId,
    document.getElementById('ca-title').value,
    document.getElementById('ca-desc').value,
    questions,
    document.getElementById('ca-due').value
  );
  questionCount = 0;
  closeModal();
  loadAssignments(currentClassId);
}

// ===== ASSIGNMENT DETAIL =====
function openAssignment(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-assignment').classList.remove('hidden');

  const assignment = DB.getAssignments().find(a => a.id === id);
  const container = document.getElementById('assignment-content');

  if (currentUser.role === 'student') {
    const submission = DB.getSubmission(id, currentUser.id);

    if (submission) {
      let letter = 'F', color = '#999';
      if (submission.score >= 90) { letter = 'A'; color = '#000'; }
      else if (submission.score >= 80) { letter = 'B'; color = '#333'; }
      else if (submission.score >= 70) { letter = 'C'; color = '#555'; }
      else if (submission.score >= 60) { letter = 'D'; color = '#777'; }

      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description) + '</p>' +
        '<div class="score-display">' +
        '<div class="score-number" style="color:' + color + '">' + submission.score + '%</div>' +
        '<div class="score-label">Grade: ' + letter + '</div>' +
        '<div class="points-earned ' + (submission.points >= 0 ? 'points-positive' : 'points-negative') + '">' +
        (submission.points >= 0 ? '+' : '') + submission.points + ' points</div></div>' +
        '<h3 style="margin-top:20px">Your Answers</h3>' +
        assignment.questions.map((q, i) => {
          const correct = submission.answers[i] &&
            submission.answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase();
          return '<div class="question-block" style="border-left:4px solid ' + (correct ? '#000' : '#ccc') + '">' +
            '<h4>Q' + (i + 1) + ': ' + esc(q.question) + '</h4>' +
            '<p>Your answer: <strong>' + esc(submission.answers[i] || 'No answer') + '</strong></p>' +
            '<p>Correct answer: <strong>' + esc(q.correct_answer) + '</strong> ' +
            (correct ? '✅' : '❌') + '</p></div>';
        }).join('');
    } else {
      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description) + '</p>' +
        '<form onsubmit="submitAssignment(event, ' + id + ')">' +
        assignment.questions.map((q, i) => {
          let inputHtml = '';
          if (q.type === 'multiple_choice' || q.type === 'true_false') {
            const opts = q.options || (q.type === 'true_false' ? ['True', 'False'] : []);
            inputHtml = '<div class="options">' + opts.map(o =>
              '<label><input type="radio" name="answer-' + i + '" value="' + esc(o) + '"> ' + esc(o) + '</label>'
            ).join('') + '</div>';
          } else {
            inputHtml = '<input type="text" name="answer-' + i + '" placeholder="Your answer">';
          }
          return '<div class="question-block"><h4>Q' + (i + 1) + ': ' + esc(q.question) + '</h4>' + inputHtml + '</div>';
        }).join('') +
        '<button type="submit" class="btn btn-primary btn-full">Submit Assignment</button></form>';
    }
  } else {
    const submissions = DB.getSubmissionsForAssignment(id);
    container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
      '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description) + '</p>' +
      '<h3>Questions</h3>' +
      assignment.questions.map((q, i) =>
        '<div class="question-block"><h4>Q' + (i + 1) + ': ' + esc(q.question) + '</h4>' +
        '<p>Answer: <strong>' + esc(q.correct_answer) + '</strong></p></div>'
      ).join('') +
      '<h3 style="margin-top:24px">Submissions (' + submissions.length + ')</h3>' +
      (submissions.length ? submissions.map(s => {
        let color = '#999';
        if (s.score >= 90) color = '#000';
        else if (s.score >= 80) color = '#333';
        else if (s.score >= 70) color = '#555';
        else if (s.score >= 60) color = '#777';
        return '<div class="student-row">' +
          '<div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">@' + esc(s.username) + '</span></div>' +
          '<span style="font-weight:900;color:' + color + '">' + s.score + '%</span></div>';
      }).join('') : '<p style="color:var(--text-light)">No submissions yet.</p>');
  }
}

function submitAssignment(e, assignmentId) {
  e.preventDefault();
  const assignment = DB.getAssignments().find(a => a.id === assignmentId);
  const answers = [];
  assignment.questions.forEach((q, i) => {
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const checked = document.querySelector('input[name="answer-' + i + '"]:checked');
      answers.push(checked ? checked.value : '');
    } else {
      const input = document.querySelector('input[name="answer-' + i + '"]');
      answers.push(input ? input.value : '');
    }
  });
  const result = DB.submitAssignment(assignmentId, currentUser.id, answers);
  if (result) {
    currentUser = DB.getUsers().find(u => u.id === currentUser.id);
    openAssignment(assignmentId);
  } else {
    alert('Already submitted!');
  }
}

// ===== CLASS STUDENTS =====
function loadClassStudents(classId) {
  const students = DB.getStudentsInClass(classId);
  const container = document.getElementById('class-students-list');

  if (!students.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No students in this class yet.</p>';
    return;
  }

  const isTeacher = currentUser.role === 'teacher' || currentUser.role === 'principal';
  container.innerHTML = students.map(s =>
    '<div class="student-row">' +
    '<div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">' + s.grade + 'th Grade | ' + s.total_points + ' pts</span></div>' +
    '<div>' +
    (isTeacher ? '<button class="btn btn-sm btn-outline" onclick="sendCommentTo(' + s.id + ',\'' + esc(s.display_name) + '\')">Message</button> ' : '') +
    (isTeacher ? '<button class="btn btn-sm btn-danger" onclick="removeStudent(' + classId + ',' + s.id + ')">Remove</button>' : '') +
    '</div></div>'
  ).join('');
}

function loadAvailableStudents(classId) {
  const inClass = DB.getStudentsInClass(classId).map(s => s.id);
  const students = DB.getUsers().filter(u => u.role === 'student' && !inClass.includes(u.id));
  const container = document.getElementById('available-students-list');

  if (!students.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No available students to add.</p>';
    return;
  }

  container.innerHTML = students.map(s =>
    '<div class="student-row">' +
    '<div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">' + (s.grade || '') + 'th Grade</span></div>' +
    '<button class="btn btn-sm btn-success" onclick="addStudentToClass(' + classId + ',' + s.id + ')">Add to Class</button></div>'
  ).join('');
}

function addStudentToClass(classId, studentId) {
  DB.addStudentToClass(classId, studentId);
  loadClassStudents(classId);
  loadAvailableStudents(classId);
}

function removeStudent(classId, studentId) {
  if (!confirm('Remove this student from the class?')) return;
  DB.removeStudentFromClass(classId, studentId);
  loadClassStudents(classId);
}

// ===== LEADERBOARD =====
function loadLeaderboard(grade, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  let students = DB.getUsers().filter(u => u.role === 'student');
  if (grade) students = students.filter(u => u.grade === parseInt(grade));
  students.sort((a, b) => b.total_points - a.total_points);

  const container = document.getElementById('leaderboard-list');
  if (!students.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No students yet.</p>';
    return;
  }

  container.innerHTML = students.map((s, i) =>
    '<div class="lb-row">' +
    '<div class="lb-rank">#' + (i + 1) + '</div>' +
    '<div class="lb-info"><div class="lb-name">' + esc(s.display_name) + '</div>' +
    '<div class="lb-grade">' + s.grade + 'th Grade</div></div>' +
    '<div class="lb-points">' + s.total_points + ' pts</div></div>'
  ).join('');
}

// ===== COMMENTS / MESSAGES =====
let commentInterval;

function startCommentPolling() {
  if (commentInterval) clearInterval(commentInterval);
  commentInterval = setInterval(checkComments, 3000);
}

function checkComments() {
  const unseen = DB.getUnseenComments(currentUser.id);
  const badge = document.getElementById('msg-badge');

  if (unseen.length > 0) {
    badge.textContent = unseen.length;
    badge.classList.remove('hidden');
    if (document.getElementById('popup-overlay').classList.contains('hidden')) {
      showPopup(unseen[0]);
    }
  } else {
    badge.classList.add('hidden');
  }
}

function showPopup(comment) {
  document.getElementById('popup-from').textContent = comment.from_name;
  document.getElementById('popup-message').textContent = comment.message;
  document.getElementById('popup-overlay').classList.remove('hidden');
  DB.markSeen(comment.id);
}

function dismissPopup() {
  document.getElementById('popup-overlay').classList.add('hidden');
  checkComments();
}

function loadComments() {
  if (currentUser.role === 'teacher' || currentUser.role === 'principal') {
    const students = DB.getUsers().filter(u => u.role === 'student');
    const select = document.getElementById('comment-to');
    select.innerHTML = '<option value="">Select Student</option>' +
      students.map(s => '<option value="' + s.id + '">' + esc(s.display_name) + ' (' + s.grade + 'th)</option>').join('');
  }

  const comments = DB.getCommentsFor(currentUser.id);
  const container = document.getElementById('comments-list');

  if (!comments.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No messages yet.</p>';
    return;
  }

  container.innerHTML = comments.map(c => {
    const date = new Date(c.created_at).toLocaleString();
    return '<div class="comment-card ' + (c.seen ? '' : 'unseen') + '">' +
      '<div class="from">From: ' + esc(c.from_name) + '</div>' +
      '<div class="msg">' + esc(c.message) + '</div>' +
      '<div class="time">' + date + '</div></div>';
  }).join('');
}

function sendComment() {
  const toId = parseInt(document.getElementById('comment-to').value);
  const msg = document.getElementById('comment-msg').value;
  if (!toId || !msg) return alert('Select a student and type a message');
  DB.addComment(currentUser.id, toId, msg);
  document.getElementById('comment-msg').value = '';
  alert('Message sent!');
}

function sendCommentTo(studentId, name) {
  showSection('comments');
  setTimeout(() => {
    document.getElementById('comment-to').value = studentId;
    document.getElementById('comment-msg').focus();
    document.getElementById('comment-msg').placeholder = 'Message to ' + name + '...';
  }, 100);
}

// ===== USERS =====
function loadUsers() {
  const users = DB.getUsers();
  const container = document.getElementById('users-list');

  container.innerHTML = '<table class="users-table"><thead><tr>' +
    '<th>Name</th><th>Username</th><th>Role</th><th>Grade</th><th>Points</th></tr></thead><tbody>' +
    users.map(u => {
      const roleBg = u.role === 'principal' ? '#000' : u.role === 'teacher' ? '#444' : '#888';
      return '<tr><td>' + esc(u.display_name) + '</td><td>' + esc(u.username) + '</td>' +
        '<td><span style="padding:3px 10px;border-radius:10px;color:white;background:' + roleBg + ';font-size:12px;font-weight:700">' +
        u.role.toUpperCase() + '</span></td>' +
        '<td>' + (u.grade ? u.grade + 'th' : '-') + '</td>' +
        '<td>' + (u.total_points || 0) + '</td></tr>';
    }).join('') +
    '</tbody></table>';
}

// ===== MODAL =====
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  questionCount = 0;
}

// ===== HELPERS =====
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== INIT =====
checkAuth();
