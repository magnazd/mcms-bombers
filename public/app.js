// ===== MCMS BOMBERS =====

// ===== DATABASE =====
const DB = {
  _get(k) { try { return JSON.parse(localStorage.getItem('mcms_' + k)) || []; } catch { return []; } },
  _set(k, v) { localStorage.setItem('mcms_' + k, JSON.stringify(v)); },
  _nextId(k) { const i = this._get(k); return i.length ? Math.max(...i.map(x => x.id)) + 1 : 1; },

  getUsers() { return this._get('users'); },
  saveUsers(u) { this._set('users', u); },
  getClasses() { return this._get('classes'); },
  saveClasses(c) { this._set('classes', c); },
  getClassStudents() { return this._get('cs'); },
  saveClassStudents(cs) { this._set('cs', cs); },
  getAssignments() { return this._get('assignments'); },
  saveAssignments(a) { this._set('assignments', a); },
  getSubmissions() { return this._get('submissions'); },
  saveSubmissions(s) { this._set('submissions', s); },
  getComments() { return this._get('comments'); },
  saveComments(c) { this._set('comments', c); },
  getMeetings() { return this._get('meetings'); },
  saveMeetings(m) { this._set('meetings', m); },
  getAnnouncements() { return this._get('announcements'); },
  saveAnnouncements(a) { this._set('announcements', a); },
  getActivity() { return this._get('activity'); },
  saveActivity(a) { this._set('activity', a); },

  init() {
    const users = this.getUsers();
    if (!users.find(u => u.role === 'principal')) {
      users.push({ id: 1, username: 'principal', password: 'principal123', display_name: 'Principal', role: 'principal', grade: null, total_points: 0, avatar: '👤', games_allowed: 'all', games_type: 'all' });
      this.saveUsers(users);
    }
  },

  addUser(username, password, display_name, role, grade) {
    const users = this.getUsers();
    if (users.find(u => u.username === username)) return null;
    const user = { id: this._nextId('users'), username, password, display_name, role, grade: grade ? parseInt(grade) : null, total_points: 0, avatar: '😊', games_allowed: 'pending', games_type: 'all' };
    users.push(user);
    this.saveUsers(users);
    return user;
  },

  findUser(username, password) { return this.getUsers().find(u => u.username === username && u.password === password); },

  updateUser(id, updates) {
    const users = this.getUsers();
    const i = users.findIndex(u => u.id === id);
    if (i >= 0) { users[i] = { ...users[i], ...updates }; this.saveUsers(users); return users[i]; }
    return null;
  },

  addClass(name, subject, grade, teacherId) {
    const classes = this.getClasses();
    const cls = { id: this._nextId('classes'), name, subject, grade: parseInt(grade), teacher_id: teacherId };
    classes.push(cls);
    this.saveClasses(classes);
    return cls;
  },

  addStudentToClass(classId, studentId) {
    const cs = this.getClassStudents();
    if (cs.find(r => r.class_id === classId && r.student_id === studentId)) return false;
    cs.push({ id: this._nextId('cs'), class_id: classId, student_id: studentId });
    this.saveClassStudents(cs);
    return true;
  },

  removeStudentFromClass(classId, studentId) {
    this.saveClassStudents(this.getClassStudents().filter(r => !(r.class_id === classId && r.student_id === studentId)));
  },

  getStudentsInClass(classId) {
    const cs = this.getClassStudents().filter(r => r.class_id === classId);
    const users = this.getUsers();
    return cs.map(r => users.find(u => u.id === r.student_id)).filter(Boolean);
  },

  getClassesForStudent(studentId) {
    const cs = this.getClassStudents().filter(r => r.student_id === studentId);
    return cs.map(r => this.getClasses().find(c => c.id === r.class_id)).filter(Boolean);
  },

  getClassesForTeacher(teacherId) { return this.getClasses().filter(c => c.teacher_id === teacherId); },

  addAssignment(classId, title, description, questions, dueDate) {
    const assignments = this.getAssignments();
    const a = { id: this._nextId('assignments'), class_id: classId, title, description: description || '', questions, due_date: dueDate || '' };
    assignments.push(a);
    this.saveAssignments(assignments);
    return a;
  },

  getAssignmentsForClass(classId) { return this.getAssignments().filter(a => a.class_id === classId); },

  submitAssignment(assignmentId, studentId, answers) {
    const subs = this.getSubmissions();
    if (subs.find(s => s.assignment_id === assignmentId && s.student_id === studentId)) return null;
    const assignment = this.getAssignments().find(a => a.id === assignmentId);
    if (!assignment) return null;
    let correct = 0;
    assignment.questions.forEach((q, i) => {
      if (answers[i] && answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase()) correct++;
    });
    const score = Math.round((correct / assignment.questions.length) * 100);
    let points = score >= 90 ? 100 : score >= 80 ? 75 : score >= 70 ? 50 : score >= 60 ? 25 : -20;
    subs.push({ id: this._nextId('submissions'), assignment_id: assignmentId, student_id: studentId, answers, score, points });
    this.saveSubmissions(subs);
    const users = this.getUsers();
    const user = users.find(u => u.id === studentId);
    if (user) { user.total_points += points; this.saveUsers(users); }
    // Check if all assignments done → unlock games
    this.checkGamesUnlock(studentId);
    return { score, points, correct, total: assignment.questions.length };
  },

  checkGamesUnlock(studentId) {
    const myClasses = this.getClassesForStudent(studentId);
    const allAssignments = myClasses.flatMap(c => this.getAssignmentsForClass(c.id));
    const subs = this.getSubmissions().filter(s => s.student_id === studentId);
    const allDone = allAssignments.every(a => subs.find(s => s.assignment_id === a.id));
    if (allDone && allAssignments.length > 0) {
      const users = this.getUsers();
      const user = users.find(u => u.id === studentId);
      if (user && user.games_allowed === 'pending') {
        user.games_allowed = 'all';
        this.saveUsers(users);
      }
    }
  },

  getSubmission(assignmentId, studentId) { return this.getSubmissions().find(s => s.assignment_id === assignmentId && s.student_id === studentId); },

  getSubmissionsForAssignment(assignmentId) {
    const subs = this.getSubmissions().filter(s => s.assignment_id === assignmentId);
    const users = this.getUsers();
    return subs.map(s => {
      const u = users.find(x => x.id === s.student_id) || {};
      return { ...s, display_name: u.display_name, username: u.username };
    });
  },

  addComment(fromId, toId, message) {
    const comments = this.getComments();
    comments.push({ id: this._nextId('comments'), from_id: fromId, to_id: toId, message, seen: false, created_at: new Date().toISOString() });
    this.saveComments(comments);
  },

  getCommentsFor(userId) {
    const users = this.getUsers();
    return this.getComments().filter(c => c.to_id === userId).map(c => ({
      ...c, from_name: (users.find(u => u.id === c.from_id) || {}).display_name || 'Unknown'
    })).reverse();
  },

  getUnseenComments(userId) { return this.getCommentsFor(userId).filter(c => !c.seen); },
  markSeen(id) { const c = this.getComments(); const x = c.find(i => i.id === id); if (x) { x.seen = true; this.saveComments(c); } },

  addMeeting(title, type, hostId, link) {
    const meetings = this.getMeetings();
    const m = { id: this._nextId('meetings'), title, type, host_id: hostId, link, active: true, created_at: new Date().toISOString() };
    meetings.push(m);
    this.saveMeetings(meetings);
    return m;
  },

  endMeeting(id) {
    const meetings = this.getMeetings();
    const m = meetings.find(x => x.id === id);
    if (m) { m.active = false; this.saveMeetings(meetings); }
  },

  addAnnouncement(message, authorId) {
    const anns = this.getAnnouncements();
    const a = { id: this._nextId('announcements'), message, author_id: authorId, active: true, created_at: new Date().toISOString() };
    anns.push(a);
    this.saveAnnouncements(anns);
    return a;
  },

  removeAnnouncement(id) {
    const anns = this.getAnnouncements();
    const a = anns.find(x => x.id === id);
    if (a) { a.active = false; this.saveAnnouncements(anns); }
  },

  getActiveAnnouncements() { return this.getAnnouncements().filter(a => a.active); },

  updateActivity(userId, page) {
    const activity = this.getActivity();
    const existing = activity.find(a => a.user_id === userId);
    if (existing) { existing.page = page; existing.updated_at = new Date().toISOString(); }
    else activity.push({ user_id: userId, page, updated_at: new Date().toISOString() });
    this.saveActivity(activity);
  },

  getStudentActivity() {
    const activity = this.getActivity();
    const users = this.getUsers().filter(u => u.role === 'student');
    return users.map(u => {
      const a = activity.find(x => x.user_id === u.id);
      return { ...u, current_page: a ? a.page : 'Not online', last_seen: a ? a.updated_at : null };
    });
  }
};

DB.init();

// ===== STATE =====
let currentUser = null;
let currentClassId = null;
let commentInterval = null;
let activityInterval = null;
let questionCount = 0;

// ===== ACTIVITY TRACKING =====
function trackPage(page) {
  if (currentUser) DB.updateActivity(currentUser.id, page);
}

// ===== AUTH =====
function handleLogin(e) {
  e.preventDefault();
  const user = DB.findUser(document.getElementById('login-username').value, document.getElementById('login-password').value);
  if (user) {
    currentUser = user;
    localStorage.setItem('mcms_session', JSON.stringify({ id: user.id }));
    showDashboard();
  } else {
    document.getElementById('login-error').textContent = 'Invalid username or password';
  }
}

function handleLogout() {
  if (currentUser) DB.updateActivity(currentUser.id, 'Offline');
  currentUser = null;
  localStorage.removeItem('mcms_session');
  if (commentInterval) clearInterval(commentInterval);
  if (activityInterval) clearInterval(activityInterval);
  document.getElementById('page-dashboard').classList.add('hidden');
  document.getElementById('page-landing').classList.remove('hidden');
}

function checkAuth() {
  try {
    const s = JSON.parse(localStorage.getItem('mcms_session'));
    if (s) { const u = DB.getUsers().find(x => x.id === s.id); if (u) { currentUser = u; showDashboard(); } }
  } catch (e) {}
}

// ===== CREATE ACCOUNT =====
function showCreateAccount() {
  const isPrincipalOrCounselor = ['principal','counselor'].includes(currentUser.role);
  const roleOptions = isPrincipalOrCounselor
    ? '<option value="student">Student</option><option value="teacher">Teacher</option><option value="counselor">Counselor</option>'
    : '<option value="student">Student</option>';

  openModal('Create New Account', `
    <form onsubmit="handleCreateAccount(event)">
      <div class="form-group"><label>Username</label><input type="text" id="ca-username" required placeholder="Login username"></div>
      <div class="form-group"><label>Display Name</label><input type="text" id="ca-display" required placeholder="Full name"></div>
      <div class="form-group"><label>Password</label><input type="password" id="ca-password" required placeholder="Password"></div>
      <div class="form-group"><label>Role</label>
        <select id="ca-role" required onchange="toggleCreateGrade()">
          <option value="">Select Role</option>${roleOptions}
        </select>
      </div>
      <div class="form-group" id="ca-grade-group" style="display:none"><label>Grade Level</label>
        <select id="ca-grade">
          <option value="">Select Grade</option>
          <option value="6">6th Grade</option><option value="7">7th Grade</option><option value="8">8th Grade</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Create Account</button>
      <div id="ca-error" class="error-msg" style="margin-top:8px"></div>
      <div id="ca-success" style="margin-top:8px;color:var(--success);text-align:center;font-size:14px"></div>
    </form>
  `);
}

function toggleCreateGrade() {
  document.getElementById('ca-grade-group').style.display = document.getElementById('ca-role').value === 'student' ? '' : 'none';
}

function handleCreateAccount(e) {
  e.preventDefault();
  const role = document.getElementById('ca-role').value;
  if (['teacher','counselor'].includes(role) && !['principal','counselor'].includes(currentUser.role)) {
    document.getElementById('ca-error').textContent = 'Only principal/counselor can create staff accounts';
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
    document.getElementById('ca-success').textContent = '✅ Account created for ' + user.display_name + '!';
    document.getElementById('ca-username').value = '';
    document.getElementById('ca-display').value = '';
    document.getElementById('ca-password').value = '';
  } else {
    document.getElementById('ca-success').textContent = '';
    document.getElementById('ca-error').textContent = 'Username already taken';
  }
}

// ===== AVATAR =====
const AVATARS = ['😊','😎','🤓','😄','🙂','😏','🤩','😇','🥳','😤','🤔','😴','🦁','🐯','🐻','🦊','🐼','🐸','🐧','🦅','🏈','⭐','🔥','💎','🎯'];

function showAvatarBuilder() {
  const current = currentUser.avatar || '😊';
  openModal('Customize Your Avatar', `
    <div class="avatar-builder">
      <div class="avatar-preview" id="avatar-preview-big">${current}</div>
      <p style="color:var(--text-light);font-size:13px">Pick your avatar</p>
      <div class="avatar-options">
        ${AVATARS.map(a => `<div class="avatar-opt ${a === current ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="saveAvatar()">Save Avatar</button>
    </div>
  `);
}

let selectedAvatar = null;
function selectAvatar(a) {
  selectedAvatar = a;
  document.getElementById('avatar-preview-big').textContent = a;
  document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
}

function saveAvatar() {
  if (!selectedAvatar) return;
  DB.updateUser(currentUser.id, { avatar: selectedAvatar });
  currentUser.avatar = selectedAvatar;
  document.getElementById('nav-avatar').textContent = selectedAvatar;
  closeModal();
}

// ===== DASHBOARD =====
function showDashboard() {
  currentUser = DB.getUsers().find(u => u.id === currentUser.id) || currentUser;
  document.getElementById('page-landing').classList.add('hidden');
  document.getElementById('page-dashboard').classList.remove('hidden');

  document.getElementById('welcome-name').textContent = currentUser.display_name;
  document.getElementById('nav-avatar').textContent = currentUser.avatar || '😊';
  const badge = document.getElementById('role-badge');
  badge.textContent = currentUser.role.toUpperCase();
  badge.className = 'role-badge ' + currentUser.role;

  const gradeDisplay = document.getElementById('grade-display');
  if (currentUser.grade) gradeDisplay.textContent = currentUser.grade + 'th Grade';
  else gradeDisplay.textContent = '';

  document.getElementById('user-info').textContent = currentUser.display_name;

  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  if (isStaff) {
    document.getElementById('btn-create-class').style.display = '';
    document.getElementById('send-comment-area').style.display = '';
    document.getElementById('nav-create-account').style.display = '';
    document.getElementById('nav-users').style.display = '';
    document.getElementById('nav-monitor').style.display = '';
    document.getElementById('nav-announcements').style.display = '';
    document.getElementById('btn-create-meeting').style.display = '';
  }
  if (currentUser.role === 'student') {
    document.getElementById('student-stats').classList.remove('hidden');
    document.getElementById('student-grades').classList.remove('hidden');
    document.getElementById('stat-points').textContent = currentUser.total_points || 0;
    loadMyGrades();
  }

  loadAnnouncements();
  showSection('dashboard');
  checkComments();
  startPolling();
  trackPage('Dashboard');
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.querySelector('.nav-btn[data-page="' + name + '"]');
  if (nb) nb.classList.add('active');

  const pageNames = { dashboard:'Dashboard', classes:'Classes', games:'Games', meetings:'Meetings', leaderboard:'Leaderboard', comments:'Messages', users:'All Users', monitor:'Monitor', announcements:'Announcements' };
  trackPage(pageNames[name] || name);

  if (name === 'classes') loadClasses();
  if (name === 'leaderboard') loadLeaderboard('', document.querySelector('.filter-btn'));
  if (name === 'comments') loadComments();
  if (name === 'users') loadUsers();
  if (name === 'games') loadGames();
  if (name === 'meetings') loadMeetings();
  if (name === 'monitor') loadMonitor();
  if (name === 'announcements') loadAnnouncementsManage();
}

// ===== ANNOUNCEMENTS =====
function loadAnnouncements() {
  const anns = DB.getActiveAnnouncements();
  const bar = document.getElementById('announcement-bar');
  const content = document.getElementById('ann-content');
  const dismissBtn = document.getElementById('ann-dismiss-btn');

  if (!anns.length) { bar.classList.add('hidden'); return; }

  bar.classList.remove('hidden');
  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  if (isStaff) dismissBtn.style.display = '';

  // Show all active announcements
  content.innerHTML = anns.map(a => {
    // Convert URLs in message to clickable links
    const linked = linkify(esc(a.message));
    return '<div style="margin-bottom:4px">' + linked + '</div>';
  }).join('');
}

function linkify(text) {
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function dismissAnnouncement() {
  const anns = DB.getActiveAnnouncements();
  if (anns.length) { DB.removeAnnouncement(anns[anns.length - 1].id); loadAnnouncements(); }
}

function showCreateAnnouncement() {
  openModal('New Announcement', `
    <form onsubmit="createAnnouncement(event)">
      <div class="form-group">
        <label>Message (you can include URLs — they become clickable links)</label>
        <textarea id="ann-msg" rows="4" required placeholder="Type your announcement... You can paste a URL like https://example.com"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Post Announcement</button>
    </form>
  `);
}

function createAnnouncement(e) {
  e.preventDefault();
  DB.addAnnouncement(document.getElementById('ann-msg').value, currentUser.id);
  closeModal();
  loadAnnouncements();
  loadAnnouncementsManage();
}

function loadAnnouncementsManage() {
  const anns = DB.getAnnouncements().reverse();
  const users = DB.getUsers();
  const container = document.getElementById('announcements-manage-list');

  if (!anns.length) { container.innerHTML = '<p style="color:var(--text-light)">No announcements yet.</p>'; return; }

  container.innerHTML = anns.map(a => {
    const author = users.find(u => u.id === a.author_id);
    const linked = linkify(esc(a.message));
    return '<div class="ann-manage-card">' +
      '<div class="ann-text">' + linked +
      '<div class="ann-meta">By ' + esc(author ? author.display_name : 'Unknown') + ' · ' + new Date(a.created_at).toLocaleString() + (a.active ? ' · <span style="color:var(--success)">Active</span>' : ' · <span style="color:var(--text-light)">Removed</span>') + '</div></div>' +
      (a.active ? '<button class="btn btn-sm btn-danger" onclick="removeAnn(' + a.id + ')">Remove</button>' : '') +
      '</div>';
  }).join('');
}

function removeAnn(id) {
  DB.removeAnnouncement(id);
  loadAnnouncements();
  loadAnnouncementsManage();
}

// ===== MY GRADES =====
function loadMyGrades() {
  const myClasses = DB.getClassesForStudent(currentUser.id);
  const container = document.getElementById('grades-list');
  if (!myClasses.length) { container.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>'; return; }

  let totalSubs = 0;
  container.innerHTML = myClasses.map(c => {
    const assignments = DB.getAssignmentsForClass(c.id);
    const subs = assignments.map(a => DB.getSubmission(a.id, currentUser.id)).filter(Boolean);
    totalSubs += subs.length;
    const avg = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;
    let letter = 'N/A', colorClass = '', bgColor = '#555';
    if (avg !== null) {
      if (avg >= 90) { letter = 'A'; colorClass = 'grade-a'; bgColor = 'var(--success)'; }
      else if (avg >= 80) { letter = 'B'; colorClass = 'grade-b'; bgColor = '#8bc34a'; }
      else if (avg >= 70) { letter = 'C'; colorClass = 'grade-c'; bgColor = 'var(--accent)'; }
      else if (avg >= 60) { letter = 'D'; colorClass = 'grade-d'; bgColor = '#ff9800'; }
      else { letter = 'F'; colorClass = 'grade-f'; bgColor = 'var(--danger)'; }
    }
    return '<div class="grade-card">' +
      '<div class="class-name">' + esc(c.name) + '</div>' +
      '<div class="subject">' + esc(c.subject) + '</div>' +
      '<div class="avg-score ' + colorClass + '">' + (avg !== null ? avg + '%' : 'No grades') + '</div>' +
      '<span class="letter-grade" style="background:' + bgColor + ';color:' + (bgColor === 'var(--accent)' ? '#000' : 'white') + '">' + letter + '</span>' +
      ' <span style="font-size:11px;color:var(--text-light)">' + subs.length + '/' + assignments.length + ' done</span></div>';
  }).join('');

  document.getElementById('stat-classes').textContent = myClasses.length;
  document.getElementById('stat-assignments').textContent = totalSubs;
  document.getElementById('stat-points').textContent = DB.getUsers().find(u => u.id === currentUser.id).total_points || 0;
}

// ===== CLASSES =====
function loadClasses() {
  let classes;
  if (currentUser.role === 'teacher') classes = DB.getClassesForTeacher(currentUser.id);
  else if (currentUser.role === 'student') classes = DB.getClassesForStudent(currentUser.id);
  else classes = DB.getClasses();

  const grid = document.getElementById('classes-grid');
  if (!classes.length) { grid.innerHTML = '<p style="color:var(--text-light)">No classes yet.</p>'; return; }

  const users = DB.getUsers();
  const icons = { 'Math':'📐','Science':'🔬','English':'📚','History':'🏛️','Art':'🎨','Music':'🎵','PE':'🏃','Technology':'💻','Reading':'📖','Writing':'✍️','Social Studies':'🌍' };

  grid.innerHTML = classes.map(c => {
    const teacher = users.find(u => u.id === c.teacher_id);
    return '<div class="class-card" onclick="openClass(' + c.id + ')">' +
      '<div class="class-card-img"><span>' + (icons[c.subject] || '📝') + '</span></div>' +
      '<div class="class-card-body"><h3>' + esc(c.name) + '</h3>' +
      '<span class="subject-tag">' + esc(c.subject) + ' · ' + c.grade + 'th</span>' +
      '<div class="teacher-name">Teacher: ' + esc(teacher ? teacher.display_name : 'Unknown') + '</div></div></div>';
  }).join('');
}

function showCreateClass() {
  openModal('Create New Class', `
    <form onsubmit="createClass(event)">
      <div class="form-group"><label>Class Name</label><input type="text" id="cc-name" required placeholder="e.g. Mrs. Smith's Math"></div>
      <div class="form-group"><label>Subject</label>
        <select id="cc-subject" required>
          <option value="">Select Subject</option>
          <option>Math</option><option>Science</option><option>English</option><option>Reading</option>
          <option>Writing</option><option>History</option><option>Social Studies</option>
          <option>Art</option><option>Music</option><option>PE</option><option>Technology</option>
        </select>
      </div>
      <div class="form-group"><label>Grade Level</label>
        <select id="cc-grade" required>
          <option value="">Select Grade</option>
          <option value="6">6th Grade</option><option value="7">7th Grade</option><option value="8">8th Grade</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Create Class</button>
    </form>
  `);
}

function createClass(e) {
  e.preventDefault();
  DB.addClass(document.getElementById('cc-name').value, document.getElementById('cc-subject').value, document.getElementById('cc-grade').value, currentUser.id);
  closeModal();
  loadClasses();
}

function openClass(id) {
  currentClassId = id;
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-class-detail').classList.remove('hidden');
  trackPage('Class Detail');

  const cls = DB.getClasses().find(c => c.id === id);
  const teacher = DB.getUsers().find(u => u.id === cls.teacher_id);
  document.getElementById('class-header').innerHTML =
    '<div class="class-icon">📚</div><div><h2>' + esc(cls.name) + '</h2>' +
    '<p style="color:var(--text-light);font-size:13px">' + esc(cls.subject) + ' · ' + cls.grade + 'th Grade · Teacher: ' + esc(teacher ? teacher.display_name : 'Unknown') + '</p></div>';

  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  document.getElementById('btn-create-assignment').style.display = isStaff ? '' : 'none';
  document.getElementById('tab-add-students').style.display = isStaff ? '' : 'none';

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
  if (!assignments.length) { container.innerHTML = '<p style="color:var(--text-light)">No assignments yet.</p>'; return; }
  container.innerHTML = assignments.map(a => {
    const done = currentUser.role === 'student' ? DB.getSubmission(a.id, currentUser.id) : null;
    return '<div class="assignment-card" onclick="openAssignment(' + a.id + ')">' +
      '<div><h4>' + esc(a.title) + (done ? ' <span style="color:var(--success);font-size:12px">✅ Done</span>' : '') + '</h4>' +
      '<span class="due-date">' + (a.due_date ? 'Due: ' + a.due_date : 'No due date') + '</span></div>' +
      '<span style="font-size:12px;color:var(--text-light)">' + a.questions.length + ' questions</span></div>';
  }).join('');
}

function showCreateAssignment() {
  questionCount = 0;
  openModal('Create Assignment', `
    <form onsubmit="createAssignment(event)">
      <div class="form-group"><label>Title</label><input type="text" id="ca-title" required placeholder="Assignment title"></div>
      <div class="form-group"><label>Description (optional)</label><textarea id="ca-desc" rows="2" placeholder="Instructions"></textarea></div>
      <div class="form-group"><label>Due Date (optional)</label><input type="date" id="ca-due"></div>
      <div id="questions-container">
        <h4 style="margin-bottom:8px">Questions</h4>
        <div id="questions-list"></div>
        <button type="button" class="btn btn-sm btn-dark" onclick="addQuestion()">+ Add Question</button>
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
  div.innerHTML = `<label>Question ${n}</label>
    <input type="text" id="q-text-${n}" placeholder="Enter question" required>
    <label style="margin-top:8px">Type</label>
    <select id="q-type-${n}" onchange="toggleQType(${n})">
      <option value="multiple_choice">Multiple Choice</option>
      <option value="short_answer">Short Answer</option>
      <option value="true_false">True/False</option>
    </select>
    <div id="q-opts-wrap-${n}" style="margin-top:8px">
      <label>Options (one per line)</label>
      <textarea id="q-opts-${n}" rows="4" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"></textarea>
    </div>
    <label style="margin-top:8px">Correct Answer</label>
    <input type="text" id="q-answer-${n}" placeholder="Exact correct answer" required>`;
  document.getElementById('questions-list').appendChild(div);
}

function toggleQType(n) {
  const t = document.getElementById('q-type-' + n).value;
  document.getElementById('q-opts-wrap-' + n).style.display = t === 'multiple_choice' ? '' : 'none';
  if (t === 'true_false') document.getElementById('q-answer-' + n).placeholder = 'true or false';
}

function createAssignment(e) {
  e.preventDefault();
  const questions = [];
  for (let i = 1; i <= questionCount; i++) {
    const textEl = document.getElementById('q-text-' + i);
    if (!textEl) continue;
    const type = document.getElementById('q-type-' + i).value;
    const q = { question: textEl.value, type, correct_answer: document.getElementById('q-answer-' + i).value };
    if (type === 'multiple_choice') q.options = document.getElementById('q-opts-' + i).value.split('\n').filter(o => o.trim());
    else if (type === 'true_false') q.options = ['True', 'False'];
    questions.push(q);
  }
  DB.addAssignment(currentClassId, document.getElementById('ca-title').value, document.getElementById('ca-desc').value, questions, document.getElementById('ca-due').value);
  questionCount = 0;
  closeModal();
  loadAssignments(currentClassId);
}

function openAssignment(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-assignment').classList.remove('hidden');
  trackPage('Assignment');
  const assignment = DB.getAssignments().find(a => a.id === id);
  const container = document.getElementById('assignment-content');

  if (currentUser.role === 'student') {
    const sub = DB.getSubmission(id, currentUser.id);
    if (sub) {
      let letter = 'F', color = 'var(--danger)';
      if (sub.score >= 90) { letter = 'A'; color = 'var(--success)'; }
      else if (sub.score >= 80) { letter = 'B'; color = '#8bc34a'; }
      else if (sub.score >= 70) { letter = 'C'; color = 'var(--accent)'; }
      else if (sub.score >= 60) { letter = 'D'; color = '#ff9800'; }
      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:16px">' + esc(assignment.description) + '</p>' +
        '<div class="score-display"><div class="score-number" style="color:' + color + '">' + sub.score + '%</div>' +
        '<div class="score-label">Grade: ' + letter + '</div>' +
        '<div class="points-earned ' + (sub.points >= 0 ? 'points-positive' : 'points-negative') + '">' + (sub.points >= 0 ? '+' : '') + sub.points + ' points</div></div>' +
        '<h3 style="margin-top:16px">Your Answers</h3>' +
        assignment.questions.map((q, i) => {
          const correct = sub.answers[i] && sub.answers[i].toString().trim().toLowerCase() === q.correct_answer.toString().trim().toLowerCase();
          return '<div class="question-block" style="border-left:3px solid ' + (correct ? 'var(--success)' : 'var(--danger)') + '">' +
            '<h4>Q' + (i+1) + ': ' + esc(q.question) + '</h4>' +
            '<p>Your answer: <strong>' + esc(sub.answers[i] || 'No answer') + '</strong></p>' +
            '<p>Correct: <strong>' + esc(q.correct_answer) + '</strong> ' + (correct ? '✅' : '❌') + '</p></div>';
        }).join('');
    } else {
      container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
        '<p style="color:var(--text-light);margin-bottom:16px">' + esc(assignment.description) + '</p>' +
        '<form onsubmit="submitAssignment(event,' + id + ')">' +
        assignment.questions.map((q, i) => {
          let inp = '';
          if (q.type === 'multiple_choice' || q.type === 'true_false') {
            const opts = q.options || ['True','False'];
            inp = '<div class="options">' + opts.map(o => '<label><input type="radio" name="ans-' + i + '" value="' + esc(o) + '"> ' + esc(o) + '</label>').join('') + '</div>';
          } else {
            inp = '<input type="text" name="ans-' + i + '" placeholder="Your answer">';
          }
          return '<div class="question-block"><h4>Q' + (i+1) + ': ' + esc(q.question) + '</h4>' + inp + '</div>';
        }).join('') +
        '<button type="submit" class="btn btn-primary btn-full">Submit Assignment</button></form>';
    }
  } else {
    const subs = DB.getSubmissionsForAssignment(id);
    container.innerHTML = '<h2>' + esc(assignment.title) + '</h2>' +
      '<p style="color:var(--text-light);margin-bottom:16px">' + esc(assignment.description) + '</p>' +
      '<h3>Questions & Answers</h3>' +
      assignment.questions.map((q, i) => '<div class="question-block"><h4>Q' + (i+1) + ': ' + esc(q.question) + '</h4><p>Answer: <strong>' + esc(q.correct_answer) + '</strong></p></div>').join('') +
      '<h3 style="margin-top:20px">Submissions (' + subs.length + ')</h3>' +
      (subs.length ? subs.map(s => {
        let color = 'var(--danger)';
        if (s.score >= 90) color = 'var(--success)';
        else if (s.score >= 80) color = '#8bc34a';
        else if (s.score >= 70) color = 'var(--accent)';
        else if (s.score >= 60) color = '#ff9800';
        return '<div class="student-row"><div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">@' + esc(s.username) + '</span></div><span style="font-weight:900;color:' + color + '">' + s.score + '%</span></div>';
      }).join('') : '<p style="color:var(--text-light)">No submissions yet.</p>');
  }
}

function submitAssignment(e, id) {
  e.preventDefault();
  const assignment = DB.getAssignments().find(a => a.id === id);
  const answers = assignment.questions.map((q, i) => {
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const c = document.querySelector('input[name="ans-' + i + '"]:checked');
      return c ? c.value : '';
    }
    const inp = document.querySelector('input[name="ans-' + i + '"]');
    return inp ? inp.value : '';
  });
  const result = DB.submitAssignment(id, currentUser.id, answers);
  if (result) { currentUser = DB.getUsers().find(u => u.id === currentUser.id); openAssignment(id); }
  else alert('Already submitted!');
}

// ===== CLASS STUDENTS =====
function loadClassStudents(classId) {
  const students = DB.getStudentsInClass(classId);
  const container = document.getElementById('class-students-list');
  if (!students.length) { container.innerHTML = '<p style="color:var(--text-light)">No students yet.</p>'; return; }
  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  container.innerHTML = students.map(s =>
    '<div class="student-row">' +
    '<div><span class="avatar-display" style="width:28px;height:28px;font-size:16px">' + (s.avatar || '😊') + '</span> ' +
    '<span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">' + s.grade + 'th · ' + s.total_points + ' pts</span></div>' +
    '<div style="display:flex;gap:6px">' +
    (isStaff ? '<button class="btn btn-sm btn-dark" onclick="sendCommentTo(' + s.id + ',\'' + esc(s.display_name) + '\')">Message</button>' : '') +
    (isStaff ? '<button class="btn btn-sm btn-danger" onclick="removeStudent(' + classId + ',' + s.id + ')">Remove</button>' : '') +
    '</div></div>'
  ).join('');
}

function loadAvailableStudents(classId) {
  const inClass = DB.getStudentsInClass(classId).map(s => s.id);
  const students = DB.getUsers().filter(u => u.role === 'student' && !inClass.includes(u.id));
  const container = document.getElementById('available-students-list');
  if (!students.length) { container.innerHTML = '<p style="color:var(--text-light)">No students to add.</p>'; return; }
  container.innerHTML = students.map(s =>
    '<div class="student-row"><div><span class="name">' + esc(s.display_name) + '</span> <span class="grade-label">' + (s.grade || '') + 'th</span></div>' +
    '<button class="btn btn-sm btn-primary" onclick="addStudentToClass(' + classId + ',' + s.id + ')">Add</button></div>'
  ).join('');
}

function addStudentToClass(classId, studentId) { DB.addStudentToClass(classId, studentId); loadClassStudents(classId); loadAvailableStudents(classId); }
function removeStudent(classId, studentId) { if (!confirm('Remove student?')) return; DB.removeStudentFromClass(classId, studentId); loadClassStudents(classId); }

// ===== GAMES =====
const GAMES = [
  { id: 1, name: 'Math Playground', desc: 'Practice math skills', icon: '📐', type: 'educational', url: 'https://www.mathplayground.com/games.html' },
  { id: 2, name: 'Typing Club', desc: 'Improve your typing speed', icon: '⌨️', type: 'educational', url: 'https://www.typingclub.com' },
  { id: 3, name: 'GeoGuessr', desc: 'Explore world geography', icon: '🌍', type: 'educational', url: 'https://www.geoguessr.com' },
  { id: 4, name: 'Scratch', desc: 'Learn coding by making games', icon: '🐱', type: 'educational', url: 'https://scratch.mit.edu' },
  { id: 5, name: 'Cool Math Games', desc: 'Fun math-based games', icon: '🎮', type: 'fun', url: 'https://www.coolmathgames.com' },
  { id: 6, name: 'Prodigy Math', desc: 'Math adventure game', icon: '⚔️', type: 'educational', url: 'https://www.prodigygame.com' },
  { id: 7, name: 'Kahoot!', desc: 'Quiz game platform', icon: '❓', type: 'educational', url: 'https://kahoot.it' },
  { id: 8, name: 'Quizlet', desc: 'Study with flashcards', icon: '🃏', type: 'educational', url: 'https://quizlet.com' },
  { id: 9, name: 'Poki Games', desc: 'Fun browser games', icon: '🕹️', type: 'fun', url: 'https://poki.com' },
  { id: 10, name: 'Chess.com', desc: 'Play chess online', icon: '♟️', type: 'fun', url: 'https://www.chess.com/play/computer' },
];

let currentGameFilter = 'all';

function loadGames() {
  document.getElementById('game-frame-area').classList.add('hidden');
  document.getElementById('games-grid').classList.remove('hidden');

  const user = DB.getUsers().find(u => u.id === currentUser.id);
  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);

  if (!isStaff) {
    const allowed = user.games_allowed || 'pending';
    const typeFilter = user.games_type || 'all';

    if (allowed === 'pending') {
      document.getElementById('games-locked-msg').classList.remove('hidden');
      document.getElementById('games-grid').classList.add('hidden');
      return;
    }
    document.getElementById('games-locked-msg').classList.add('hidden');

    let games = GAMES;
    if (allowed === 'educational') games = games.filter(g => g.type === 'educational');
    else if (allowed === 'fun') games = games.filter(g => g.type === 'fun');
    if (typeFilter !== 'all') games = games.filter(g => g.type === typeFilter);
    if (currentGameFilter !== 'all') games = games.filter(g => g.type === currentGameFilter);
    renderGames(games);
  } else {
    document.getElementById('games-locked-msg').classList.add('hidden');
    const games = currentGameFilter === 'all' ? GAMES : GAMES.filter(g => g.type === currentGameFilter);
    renderGames(games);
  }
}

function renderGames(games) {
  const grid = document.getElementById('games-grid');
  if (!games.length) { grid.innerHTML = '<p style="color:var(--text-light)">No games available.</p>'; return; }
  grid.innerHTML = games.map(g =>
    '<div class="game-card" onclick="openGame(\'' + g.url + '\',\'' + esc(g.name) + '\')">' +
    '<div class="game-icon">' + g.icon + '</div>' +
    '<h4>' + esc(g.name) + '</h4>' +
    '<p>' + esc(g.desc) + '</p>' +
    '<span class="game-tag ' + g.type + '">' + g.type.toUpperCase() + '</span></div>'
  ).join('');
}

function filterGames(type, btn) {
  currentGameFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadGames();
}

function openGame(url, name) {
  trackPage('Playing: ' + name);
  document.getElementById('games-grid').classList.add('hidden');
  document.getElementById('games-locked-msg').classList.add('hidden');
  document.getElementById('game-frame-area').classList.remove('hidden');
  document.getElementById('game-iframe').src = url;
}

function closeGame() {
  document.getElementById('game-iframe').src = '';
  document.getElementById('game-frame-area').classList.add('hidden');
  loadGames();
}

// ===== GAME PERMISSIONS (Teacher/Principal) =====
function showGameSettings(studentId, studentName) {
  const user = DB.getUsers().find(u => u.id === studentId);
  openModal('Game Settings for ' + studentName, `
    <div class="form-group">
      <label>Games Access</label>
      <select id="gs-allowed">
        <option value="pending" ${user.games_allowed === 'pending' ? 'selected' : ''}>Locked (must finish work)</option>
        <option value="all" ${user.games_allowed === 'all' ? 'selected' : ''}>All Games Unlocked</option>
        <option value="educational" ${user.games_allowed === 'educational' ? 'selected' : ''}>Educational Only</option>
        <option value="fun" ${user.games_allowed === 'fun' ? 'selected' : ''}>Fun Only</option>
        <option value="none" ${user.games_allowed === 'none' ? 'selected' : ''}>No Games</option>
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveGameSettings(${studentId})">Save</button>
  `);
}

function saveGameSettings(studentId) {
  DB.updateUser(studentId, { games_allowed: document.getElementById('gs-allowed').value });
  closeModal();
}

// ===== MEETINGS =====
function loadMeetings() {
  const meetings = DB.getMeetings();
  const users = DB.getUsers();
  const container = document.getElementById('meetings-list');

  const active = meetings.filter(m => m.active);
  const past = meetings.filter(m => !m.active);

  let html = '';
  if (active.length) {
    html += '<h3 style="margin-bottom:10px">🟢 Live Now</h3>';
    html += active.map(m => {
      const host = users.find(u => u.id === m.host_id);
      const isHost = m.host_id === currentUser.id || ['principal','counselor'].includes(currentUser.role);
      return '<div class="meeting-card live">' +
        '<div><div class="meeting-title"><span class="live-dot"></span>' + esc(m.title) + '</div>' +
        '<div class="meeting-info">' + (m.type === 'video' ? '📹 Video' : '🎙️ Audio') + ' · Host: ' + esc(host ? host.display_name : 'Unknown') + '</div></div>' +
        '<div style="display:flex;gap:8px">' +
        '<a href="' + esc(m.link) + '" target="_blank" class="btn btn-primary btn-sm">Join</a>' +
        (isHost ? '<button class="btn btn-sm btn-danger" onclick="endMeeting(' + m.id + ')">End</button>' : '') +
        '</div></div>';
    }).join('');
  }

  if (past.length) {
    html += '<h3 style="margin:16px 0 10px">Past Meetings</h3>';
    html += past.slice(-5).reverse().map(m => {
      const host = users.find(u => u.id === m.host_id);
      return '<div class="meeting-card"><div><div class="meeting-title">' + esc(m.title) + '</div>' +
        '<div class="meeting-info">' + (m.type === 'video' ? '📹 Video' : '🎙️ Audio') + ' · Host: ' + esc(host ? host.display_name : 'Unknown') + ' · Ended</div></div></div>';
    }).join('');
  }

  if (!active.length && !past.length) html = '<p style="color:var(--text-light)">No meetings yet.</p>';
  container.innerHTML = html;
}

function showCreateMeeting() {
  openModal('Host a Meeting', `
    <form onsubmit="createMeeting(event)">
      <div class="form-group"><label>Meeting Title</label><input type="text" id="mt-title" required placeholder="e.g. Math Review Session"></div>
      <div class="form-group"><label>Type</label>
        <select id="mt-type">
          <option value="video">📹 Video Meeting</option>
          <option value="audio">🎙️ Audio Only</option>
        </select>
      </div>
      <div class="form-group">
        <label>Meeting Link (Google Meet, Zoom, etc.)</label>
        <input type="url" id="mt-link" required placeholder="https://meet.google.com/...">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Start Meeting</button>
    </form>
  `);
}

function createMeeting(e) {
  e.preventDefault();
  DB.addMeeting(document.getElementById('mt-title').value, document.getElementById('mt-type').value, currentUser.id, document.getElementById('mt-link').value);
  closeModal();
  loadMeetings();
}

function endMeeting(id) {
  if (!confirm('End this meeting?')) return;
  DB.endMeeting(id);
  loadMeetings();
}

// ===== LEADERBOARD =====
function loadLeaderboard(grade, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  let students = DB.getUsers().filter(u => u.role === 'student');
  if (grade) students = students.filter(u => u.grade === parseInt(grade));
  students.sort((a, b) => b.total_points - a.total_points);
  const container = document.getElementById('leaderboard-list');
  if (!students.length) { container.innerHTML = '<p style="color:var(--text-light)">No students yet.</p>'; return; }
  container.innerHTML = students.map((s, i) =>
    '<div class="lb-row">' +
    '<div class="lb-rank">#' + (i+1) + '</div>' +
    '<div style="font-size:22px">' + (s.avatar || '😊') + '</div>' +
    '<div class="lb-info"><div class="lb-name">' + esc(s.display_name) + '</div><div class="lb-grade">' + s.grade + 'th Grade</div></div>' +
    '<div class="lb-points">' + s.total_points + ' pts</div></div>'
  ).join('');
}

// ===== COMMENTS =====
function startPolling() {
  if (commentInterval) clearInterval(commentInterval);
  commentInterval = setInterval(checkComments, 3000);
  if (activityInterval) clearInterval(activityInterval);
  activityInterval = setInterval(() => { if (currentUser) DB.updateActivity(currentUser.id, document.title); }, 10000);
}

function checkComments() {
  const unseen = DB.getUnseenComments(currentUser.id);
  const badge = document.getElementById('msg-badge');
  if (unseen.length > 0) {
    badge.textContent = unseen.length;
    badge.classList.remove('hidden');
    if (document.getElementById('popup-overlay').classList.contains('hidden')) showPopup(unseen[0]);
  } else { badge.classList.add('hidden'); }
}

function showPopup(comment) {
  document.getElementById('popup-from').textContent = comment.from_name;
  document.getElementById('popup-message').textContent = comment.message;
  document.getElementById('popup-overlay').classList.remove('hidden');
  DB.markSeen(comment.id);
}

function dismissPopup() { document.getElementById('popup-overlay').classList.add('hidden'); checkComments(); }

function loadComments() {
  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  if (isStaff) {
    const students = DB.getUsers().filter(u => u.role === 'student');
    document.getElementById('comment-to').innerHTML = '<option value="">Select Student</option>' +
      students.map(s => '<option value="' + s.id + '">' + esc(s.display_name) + ' (' + s.grade + 'th)</option>').join('');
  }
  const comments = DB.getCommentsFor(currentUser.id);
  const container = document.getElementById('comments-list');
  if (!comments.length) { container.innerHTML = '<p style="color:var(--text-light)">No messages yet.</p>'; return; }
  container.innerHTML = comments.map(c =>
    '<div class="comment-card ' + (c.seen ? '' : 'unseen') + '">' +
    '<div class="from">From: ' + esc(c.from_name) + '</div>' +
    '<div class="msg">' + esc(c.message) + '</div>' +
    '<div class="time">' + new Date(c.created_at).toLocaleString() + '</div></div>'
  ).join('');
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
  }, 100);
}

// ===== USERS =====
function loadUsers() {
  const users = DB.getUsers();
  const isStaff = ['teacher','principal','counselor'].includes(currentUser.role);
  const container = document.getElementById('users-list');
  const roleBgs = { principal: '#f5c400', counselor: '#333', teacher: '#444', student: '#222' };
  const roleColors = { principal: '#000', counselor: '#f5c400', teacher: '#f5c400', student: '#f5c400' };

  container.innerHTML = '<table class="users-table"><thead><tr><th>Avatar</th><th>Name</th><th>Username</th><th>Role</th><th>Grade</th><th>Points</th>' +
    (isStaff ? '<th>Actions</th>' : '') + '</tr></thead><tbody>' +
    users.map(u =>
      '<tr><td style="font-size:20px">' + (u.avatar || '😊') + '</td>' +
      '<td>' + esc(u.display_name) + '</td><td>' + esc(u.username) + '</td>' +
      '<td><span style="padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;background:' + (roleBgs[u.role]||'#333') + ';color:' + (roleColors[u.role]||'#fff') + '">' + u.role.toUpperCase() + '</span></td>' +
      '<td>' + (u.grade ? u.grade + 'th' : '-') + '</td>' +
      '<td>' + (u.total_points || 0) + '</td>' +
      (isStaff && u.role === 'student' ? '<td><button class="btn btn-sm btn-dark" onclick="showGameSettings(' + u.id + ',\'' + esc(u.display_name) + '\')">🎮 Games</button> <button class="btn btn-sm btn-dark" onclick="promoteStudent(' + u.id + ')">⬆️ Grade</button></td>' : (isStaff ? '<td>-</td>' : '')) +
      '</tr>'
    ).join('') + '</tbody></table>';
}

// ===== GRADE PROMOTION =====
function promoteStudent(studentId) {
  const user = DB.getUsers().find(u => u.id === studentId);
  if (!user) return;
  const currentGrade = user.grade || 6;
  if (currentGrade >= 8) { alert(user.display_name + ' is already in 8th grade (max).'); return; }
  const newGrade = currentGrade + 1;
  if (!confirm('Promote ' + user.display_name + ' from ' + currentGrade + 'th to ' + newGrade + 'th grade?')) return;
  DB.updateUser(studentId, { grade: newGrade });
  alert(user.display_name + ' has been promoted to ' + newGrade + 'th grade!');
  loadUsers();
}

// ===== MONITOR =====
function loadMonitor() {
  const activity = DB.getStudentActivity();
  const container = document.getElementById('monitor-grid');
  if (!activity.length) { container.innerHTML = '<p style="color:var(--text-light)">No students registered yet.</p>'; return; }

  const now = Date.now();
  container.innerHTML = activity.map(s => {
    const lastSeen = s.last_seen ? new Date(s.last_seen) : null;
    const isOnline = lastSeen && (now - lastSeen.getTime()) < 30000;
    return '<div class="monitor-card">' +
      '<div class="monitor-name">' +
      '<span class="' + (isOnline ? 'online-dot' : 'offline-dot') + '"></span>' +
      '<span style="font-size:18px">' + (s.avatar || '😊') + '</span>' +
      esc(s.display_name) + '</div>' +
      '<div class="monitor-page">' + esc(s.current_page || 'Not online') + '</div>' +
      '<div class="monitor-time">' + (lastSeen ? 'Last seen: ' + lastSeen.toLocaleTimeString() : 'Never visited') + '</div></div>';
  }).join('');
}

// ===== MODAL =====
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); questionCount = 0; }

// ===== HELPERS =====
function esc(str) {
  if (!str && str !== 0) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== INIT =====
checkAuth();
