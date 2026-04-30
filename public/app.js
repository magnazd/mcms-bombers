// ===== MCMS BOMBERS - Frontend App =====
let currentUser = null;
let currentClassId = null;
let popupQueue = [];

// Check if already logged in
async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      currentUser = await res.json();
      showDashboard();
    }
  } catch (e) {}
}

// ===== AUTH =====
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (res.ok) {
    currentUser = data.user;
    showDashboard();
  } else {
    document.getElementById('login-error').textContent = data.error;
  }
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
      <div id="ca-success" class="error-msg" style="margin-top:10px;color:var(--text)"></div>
    </form>
  `);
}

function toggleCreateGrade() {
  const role = document.getElementById('ca-role').value;
  document.getElementById('ca-grade-group').style.display = role === 'student' ? '' : 'none';
}

async function handleCreateAccount(e) {
  e.preventDefault();
  const body = {
    username: document.getElementById('ca-username').value,
    password: document.getElementById('ca-password').value,
    display_name: document.getElementById('ca-display').value,
    role: document.getElementById('ca-role').value,
    grade: document.getElementById('ca-grade').value
  };
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('ca-error').textContent = '';
    document.getElementById('ca-success').textContent = 'Account created for ' + body.display_name + '!';
    document.getElementById('ca-username').value = '';
    document.getElementById('ca-display').value = '';
    document.getElementById('ca-password').value = '';
  } else {
    document.getElementById('ca-success').textContent = '';
    document.getElementById('ca-error').textContent = data.error;
  }
}

async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  document.getElementById('page-dashboard').classList.add('hidden');
  document.getElementById('page-landing').classList.remove('hidden');
}

// ===== DASHBOARD =====
function showDashboard() {
  document.getElementById('page-landing').classList.add('hidden');
  document.getElementById('page-dashboard').classList.remove('hidden');

  document.getElementById('welcome-name').textContent = currentUser.display_name;
  const badge = document.getElementById('role-badge');
  badge.textContent = currentUser.role.toUpperCase();
  badge.className = 'role-badge ' + currentUser.role;

  const info = currentUser.display_name + ' (' + currentUser.role + ')';
  if (currentUser.grade) {
    document.getElementById('user-info').textContent = info + ' - ' + currentUser.grade + 'th Grade';
  } else {
    document.getElementById('user-info').textContent = info;
  }

  // Show/hide role-specific elements
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
  loadClasses();
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
  if (name === 'leaderboard') loadLeaderboard('');
  if (name === 'comments') loadComments();
  if (name === 'users') loadUsers();
}

// ===== MY GRADES =====
async function loadMyGrades() {
  const res = await fetch('/api/my-grades');
  const grades = await res.json();
  const container = document.getElementById('grades-list');

  if (!grades.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>';
    return;
  }

  let classCount = 0;
  container.innerHTML = grades.map(g => {
    const avg = g.avg_score !== null ? Math.round(g.avg_score) : null;
    let letter = 'N/A', colorClass = '', bgColor = '#6c757d';
    if (avg !== null) {
      if (avg >= 90) { letter = 'A'; colorClass = 'grade-a'; bgColor = 'var(--success)'; }
      else if (avg >= 80) { letter = 'B'; colorClass = 'grade-b'; bgColor = '#27ae60'; }
      else if (avg >= 70) { letter = 'C'; colorClass = 'grade-c'; bgColor = 'var(--warning)'; }
      else if (avg >= 60) { letter = 'D'; colorClass = 'grade-d'; bgColor = '#e67e22'; }
      else { letter = 'F'; colorClass = 'grade-f'; bgColor = 'var(--danger)'; }
    }
    classCount++;
    return '<div class="grade-card">' +
      '<div class="class-name">' + esc(g.class_name) + '</div>' +
      '<div class="subject">' + esc(g.subject) + '</div>' +
      '<div class="avg-score ' + colorClass + '">' + (avg !== null ? avg + '%' : 'No grades') + '</div>' +
      '<span class="letter-grade" style="background:' + bgColor + '">' + letter + '</span>' +
      ' <span style="font-size:12px;color:var(--text-light)">' + g.submitted_count + ' submitted</span>' +
      '</div>';
  }).join('');

  document.getElementById('stat-classes').textContent = classCount;
}

// ===== CLASSES =====
async function loadClasses() {
  const res = await fetch('/api/classes');
  const classes = await res.json();
  const grid = document.getElementById('classes-grid');

  if (!classes.length) {
    grid.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>';
    return;
  }

  grid.innerHTML = classes.map(c => {
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
      '<div class="teacher-name">Teacher: ' + esc(c.teacher_name) + '</div>' +
      '</div></div>';
  }).join('');
}

function showCreateClass() {
  openModal('Create New Class', `
    <form onsubmit="createClass(event)" enctype="multipart/form-data">
      <div class="form-group">
        <label>Class Name</label>
        <input type="text" id="cc-name" required placeholder="e.g. Mrs. Smith's Math">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <select id="cc-subject" required>
          <option value="">Select Subject</option>
          <option>Math</option>
          <option>Science</option>
          <option>English</option>
          <option>Reading</option>
          <option>Writing</option>
          <option>History</option>
          <option>Social Studies</option>
          <option>Art</option>
          <option>Music</option>
          <option>PE</option>
          <option>Technology</option>
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
      <div class="form-group">
        <label>Class Profile Picture (optional)</label>
        <input type="file" id="cc-pfp" accept="image/*">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Create Class</button>
    </form>
  `);
}

async function createClass(e) {
  e.preventDefault();
  const form = new FormData();
  form.append('name', document.getElementById('cc-name').value);
  form.append('subject', document.getElementById('cc-subject').value);
  form.append('grade', document.getElementById('cc-grade').value);
  const pfp = document.getElementById('cc-pfp').files[0];
  if (pfp) form.append('pfp', pfp);

  const res = await fetch('/api/classes', { method: 'POST', body: form });
  if (res.ok) {
    closeModal();
    loadClasses();
  }
}

// ===== CLASS DETAIL =====
async function openClass(id) {
  currentClassId = id;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-class-detail').classList.remove('hidden');

  const res = await fetch('/api/classes/' + id);
  const cls = await res.json();

  const header = document.getElementById('class-header');
  const imgHtml = cls.pfp
    ? '<img src="' + esc(cls.pfp) + '" alt="class">'
    : '<div class="class-icon">📚</div>';
  header.innerHTML = imgHtml +
    '<div><h2>' + esc(cls.name) + '</h2>' +
    '<p style="color:var(--text-light)">' + esc(cls.subject) + ' - ' + cls.grade + 'th Grade | Teacher: ' + esc(cls.teacher_name) + '</p></div>';

  // Show teacher controls
  if (currentUser.role === 'teacher' || currentUser.role === 'principal') {
    document.getElementById('btn-create-assignment').style.display = '';
    document.getElementById('tab-add-students').style.display = '';
  } else {
    document.getElementById('btn-create-assignment').style.display = 'none';
    document.getElementById('tab-add-students').style.display = 'none';
  }

  showClassTab('assignments');
  loadAssignments(id);
  loadClassStudents(id);
}

function showClassTab(tab) {
  document.querySelectorAll('.class-tab').forEach(t => t.classList.add('hidden'));
  document.getElementById('class-tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.class-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (tab === 'add-students') loadAvailableStudents(currentClassId);
}

function backToClassDetail() {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-class-detail').classList.remove('hidden');
}

// ===== ASSIGNMENTS =====
async function loadAssignments(classId) {
  const res = await fetch('/api/classes/' + classId + '/assignments');
  const assignments = await res.json();
  const container = document.getElementById('assignments-list');

  if (!assignments.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No assignments yet.</p>';
    return;
  }

  container.innerHTML = assignments.map(a => {
    const due = a.due_date ? 'Due: ' + a.due_date : 'No due date';
    return '<div class="assignment-card" onclick="openAssignment(' + a.id + ')">' +
      '<div><h4>' + esc(a.title) + '</h4><span class="due-date">' + due + '</span></div>' +
      '<span style="font-size:13px;color:var(--text-light)">' + a.questions.length + ' questions</span>' +
      '</div>';
  }).join('');
}

function showCreateAssignment() {
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

let questionCount = 0;
function addQuestion() {
  questionCount++;
  const n = questionCount;
  const div = document.createElement('div');
  div.className = 'question-block';
  div.id = 'q-block-' + n;
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
  if (type === 'multiple_choice') {
    optsDiv.style.display = '';
  } else if (type === 'true_false') {
    optsDiv.style.display = 'none';
    document.getElementById('q-answer-' + n).placeholder = 'true or false';
  } else {
    optsDiv.style.display = 'none';
  }
}

async function createAssignment(e) {
  e.preventDefault();
  const questions = [];
  for (let i = 1; i <= questionCount; i++) {
    const textEl = document.getElementById('q-text-' + i);
    if (!textEl) continue;
    const type = document.getElementById('q-type-' + i).value;
    const q = {
      question: textEl.value,
      type: type,
      correct_answer: document.getElementById('q-answer-' + i).value
    };
    if (type === 'multiple_choice') {
      q.options = document.getElementById('q-opts-' + i).value.split('\n').filter(o => o.trim());
    } else if (type === 'true_false') {
      q.options = ['True', 'False'];
    }
    questions.push(q);
  }

  const body = {
    title: document.getElementById('ca-title').value,
    description: document.getElementById('ca-desc').value,
    due_date: document.getElementById('ca-due').value,
    questions
  };

  const res = await fetch('/api/classes/' + currentClassId + '/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    questionCount = 0;
    closeModal();
    loadAssignments(currentClassId);
  }
}

// ===== ASSIGNMENT DETAIL =====
async function openAssignment(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-assignment').classList.remove('hidden');

  const res = await fetch('/api/assignments/' + id);
  const assignment = await res.json();
  const container = document.getElementById('assignment-content');

  if (currentUser.role === 'student') {
    // Check if already submitted
    const subRes = await fetch('/api/assignments/' + id + '/my-submission');
    const submission = await subRes.json();

    if (submission) {
      // Show results
      let letter = 'F', color = 'var(--danger)';
      if (submission.score >= 90) { letter = 'A'; color = 'var(--success)'; }
      else if (submission.score >= 80) { letter = 'B'; color = '#27ae60'; }
      else if (submission.score >= 70) { letter = 'C'; color = 'var(--warning)'; }
      else if (submission.score >= 60) { letter = 'D'; color = '#e67e22'; }

      let points = 0;
      if (submission.score >= 90) points = 100;
      else if (submission.score >= 80) points = 75;
      else if (submission.score >= 70) points = 50;
      else if (submission.score >= 60) points = 25;
      else points = -20;

      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description || '') + '</p>' +
        '<div class="score-display">' +
        '<div class="score-number" style="color:' + color + '">' + submission.score + '%</div>' +
        '<div class="score-label">Grade: ' + letter + '</div>' +
        '<div class="points-earned ' + (points >= 0 ? 'points-positive' : 'points-negative') + '">' +
        (points >= 0 ? '+' : '') + points + ' points</div>' +
        '</div>' +
        '<h3 style="margin-top:20px">Your Answers</h3>' +
        assignment.questions.map((q, i) => {
          const correct = submission.answers[i] &&
            submission.answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase();
          return '<div class="question-block" style="border-left:4px solid ' + (correct ? 'var(--success)' : 'var(--danger)') + '">' +
            '<h4>Q' + (i + 1) + ': ' + esc(q.question) + '</h4>' +
            '<p>Your answer: <strong>' + esc(submission.answers[i] || 'No answer') + '</strong></p>' +
            '<p>Correct answer: <strong>' + esc(q.correct_answer) + '</strong> ' +
            (correct ? '✅' : '❌') + '</p></div>';
        }).join('');
    } else {
      // Show assignment form
      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description || '') + '</p>' +
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
    // Teacher/Principal view - show submissions
    const subRes = await fetch('/api/assignments/' + id + '/submissions');
    const submissions = await subRes.json();

    container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
      '<p style="color:var(--text-light);margin-bottom:20px">' + esc(assignment.description || '') + '</p>' +
      '<h3>Questions</h3>' +
      assignment.questions.map((q, i) =>
        '<div class="question-block"><h4>Q' + (i + 1) + ': ' + esc(q.question) + '</h4>' +
        '<p>Answer: <strong>' + esc(q.correct_answer) + '</strong></p></div>'
      ).join('') +
      '<h3 style="margin-top:24px">Submissions (' + submissions.length + ')</h3>' +
      (submissions.length ? submissions.map(s => {
        let color = 'var(--danger)';
        if (s.score >= 90) color = 'var(--success)';
        else if (s.score >= 80) color = '#27ae60';
        else if (s.score >= 70) color = 'var(--warning)';
        else if (s.score >= 60) color = '#e67e22';
        return '<div class="student-row">' +
          '<div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">@' + esc(s.username) + '</span></div>' +
          '<span style="font-weight:900;color:' + color + '">' + s.score + '%</span></div>';
      }).join('') : '<p style="color:var(--text-light)">No submissions yet.</p>');
  }
}

async function submitAssignment(e, assignmentId) {
  e.preventDefault();
  const res = await fetch('/api/assignments/' + assignmentId);
  const assignment = await res.json();
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

  const subRes = await fetch('/api/assignments/' + assignmentId + '/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  const data = await subRes.json();
  if (subRes.ok) {
    currentUser.total_points = (currentUser.total_points || 0) + data.points;
    openAssignment(assignmentId); // Reload to show results
  } else {
    alert(data.error);
  }
}

// ===== CLASS STUDENTS =====
async function loadClassStudents(classId) {
  const res = await fetch('/api/classes/' + classId + '/students');
  const students = await res.json();
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

async function loadAvailableStudents(classId) {
  const res = await fetch('/api/classes/' + classId + '/available-students');
  const students = await res.json();
  const container = document.getElementById('available-students-list');

  if (!students.length) {
    container.innerHTML = '<p style="color:var(--text-light)">No available students to add.</p>';
    return;
  }

  container.innerHTML = students.map(s =>
    '<div class="student-row">' +
    '<div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">' + (s.grade || '') + 'th Grade</span></div>' +
    '<button class="btn btn-sm btn-success" onclick="addStudentToClass(' + classId + ',' + s.id + ')">Add to Class</button>' +
    '</div>'
  ).join('');
}

async function addStudentToClass(classId, studentId) {
  await fetch('/api/classes/' + classId + '/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId })
  });
  loadClassStudents(classId);
  loadAvailableStudents(classId);
}

async function removeStudent(classId, studentId) {
  if (!confirm('Remove this student from the class?')) return;
  await fetch('/api/classes/' + classId + '/students/' + studentId, { method: 'DELETE' });
  loadClassStudents(classId);
}

// ===== LEADERBOARD =====
async function loadLeaderboard(grade) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const url = grade ? '/api/leaderboard?grade=' + grade : '/api/leaderboard';
  const res = await fetch(url);
  const students = await res.json();
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
    '<div class="lb-points">' + s.total_points + ' pts</div>' +
    '</div>'
  ).join('');
}

// ===== COMMENTS / MESSAGES =====
let commentInterval;

function startCommentPolling() {
  if (commentInterval) clearInterval(commentInterval);
  commentInterval = setInterval(checkComments, 5000);
}

async function checkComments() {
  try {
    const res = await fetch('/api/comments/unseen');
    const comments = await res.json();
    const badge = document.getElementById('msg-badge');

    if (comments.length > 0) {
      badge.textContent = comments.length;
      badge.classList.remove('hidden');

      // Show popup for newest unseen comment
      if (comments.length > 0 && !document.getElementById('popup-overlay').classList.contains('hidden') === false) {
        showPopup(comments[0]);
      }
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {}
}

function showPopup(comment) {
  document.getElementById('popup-from').textContent = comment.from_name;
  document.getElementById('popup-message').textContent = comment.message;
  document.getElementById('popup-overlay').classList.remove('hidden');
  // Mark as seen
  fetch('/api/comments/' + comment.id + '/seen', { method: 'POST' });
}

function dismissPopup() {
  document.getElementById('popup-overlay').classList.add('hidden');
  checkComments();
}

async function loadComments() {
  // Load student list for sending
  if (currentUser.role === 'teacher' || currentUser.role === 'principal') {
    const studRes = await fetch('/api/students');
    const students = await studRes.json();
    const select = document.getElementById('comment-to');
    select.innerHTML = '<option value="">Select Student</option>' +
      students.map(s => '<option value="' + s.id + '">' + esc(s.display_name) + ' (' + s.grade + 'th)</option>').join('');
  }

  const res = await fetch('/api/comments');
  const comments = await res.json();
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
      '<div class="time">' + date + '</div>' +
      '</div>';
  }).join('');
}

async function sendComment() {
  const toId = document.getElementById('comment-to').value;
  const msg = document.getElementById('comment-msg').value;
  if (!toId || !msg) return alert('Select a student and type a message');

  await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_id: toId, message: msg })
  });
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

// ===== USERS (Principal) =====
async function loadUsers() {
  const res = await fetch('/api/users');
  const users = await res.json();
  const container = document.getElementById('users-list');

  container.innerHTML = '<table class="users-table"><thead><tr>' +
    '<th>Name</th><th>Username</th><th>Role</th><th>Grade</th><th>Points</th></tr></thead><tbody>' +
    users.map(u => {
      const roleBg = u.role === 'principal' ? 'var(--accent)' : u.role === 'teacher' ? 'var(--success)' : 'var(--gold)';
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

// Init
checkAuth();
