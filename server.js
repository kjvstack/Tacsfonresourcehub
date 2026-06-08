const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const usersFile = path.join(__dirname, "users.json");
const requestsFile = path.join(__dirname, "requests.json");
const uploadDir = path.join(__dirname, "public", "files");
const sessions = {};

function loadJson(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    saveJson(filePath, defaultValue);
  }
}

function verifySession(req, res, next) {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId || !sessions[sessionId]) {
    return res.redirect("/login.html");
  }
  req.user = sessions[sessionId];
  next();
}

function onlyExecutive(req, res, next) {
  if (!req.user) {
    return res.redirect("/login.html");
  }
  if (req.user.role !== "Executive") {
    return res.status(403).send("Access denied");
  }
  next();
}

ensureFile(usersFile, []);
ensureFile(requestsFile, []);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(['/dashboard.html', '/requests.html'], verifySession, onlyExecutive);
app.use(express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
  const { fullname, email, matric, department, level, role, password, confirmPassword } = req.body;
  if (!fullname || !email || !password || !confirmPassword || !role) {
    return res.send('Please fill in all required fields. <a href="/register.html">Go back</a>');
  }
  if (password !== confirmPassword) {
    return res.send('Passwords do not match. <a href="/register.html">Go back</a>');
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadJson(usersFile, []);
  if (users.find(u => u.email === cleanEmail)) {
    return res.send('User already exists. <a href="/register.html">Go back</a>');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({
    id: Date.now(),
    fullname,
    email: cleanEmail,
    matric,
    department,
    level,
    role,
    password: hashedPassword
  });
  saveJson(usersFile, users);

  return res.send(`
    <h2>Registration Successful</h2>
    <p>Your account was created successfully.</p>
    <a href="/login.html">Login</a>
  `);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.send('Both email and password are required. <a href="/login.html">Go back</a>');
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadJson(usersFile, []);
  const user = users.find(u => u.email === cleanEmail);
  if (!user) {
    return res.send('Invalid login credentials. <a href="/login.html">Try again</a>');
  }

  const isHashedPassword = typeof user.password === 'string' && user.password.startsWith('$2');
  const passwordMatches = isHashedPassword
    ? await bcrypt.compare(password, user.password)
    : user.password === password;

  if (!passwordMatches) {
    return res.send('Invalid login credentials. <a href="/login.html">Try again</a>');
  }

  if (!isHashedPassword) {
    user.password = await bcrypt.hash(password, 10);
    saveJson(usersFile, users);
  }

  const sessionId = Date.now().toString();
  sessions[sessionId] = {
    id: user.id,
    fullname: user.fullname,
    email: user.email,
    role: user.role
  };
  res.cookie('sessionId', sessionId, { httpOnly: true, maxAge: 2 * 60 * 60 * 1000 });

  if (user.role === 'Executive') {
    return res.redirect('/dashboard.html');
  }
  return res.redirect('/index.html');
});

app.get('/logout', (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId) {
    delete sessions[sessionId];
  }
  res.clearCookie('sessionId');
  return res.redirect('/login.html');
});

app.post('/upload', verifySession, onlyExecutive, upload.single('resourceFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded. <a href="/dashboard.html">Go back</a>');
  }

  const fileUrl = `/files/${encodeURIComponent(req.file.filename)}`;
  return res.send(`
    <h2>Upload Successful ?</h2>
    <p><b>File:</b> ${req.file.originalname}</p>
    <a href="${fileUrl}" target="_blank">View File</a><br><br>
    <a href="/dashboard.html">Go Back</a>
  `);
});

app.get('/api/uploads', (req, res) => {
  const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
  const items = files.map(fname => {
    const fullPath = path.join(uploadDir, fname);
    let stat = { mtime: new Date(0) };
    try { stat = fs.statSync(fullPath); } catch (err) {}
    const idx = fname.indexOf('-');
    const originalName = idx > -1 ? fname.slice(idx + 1) : fname;
    return { filename: fname, originalName, uploadedAt: stat.mtime };
  }).sort((a, b) => b.uploadedAt - a.uploadedAt);
  res.json(items);
});

app.get('/files/:filename', (req, res) => {
  const requested = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, requested);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  const idx = requested.indexOf('-');
  const original = idx > -1 ? requested.slice(idx + 1) : requested;
  res.download(filePath, original);
});

app.post('/api/request-resource', (req, res) => {
  const { resourceName, category, description } = req.body;
  if (!resourceName || !category) {
    return res.status(400).json({ error: 'Resource name and category are required' });
  }
  const requests = loadJson(requestsFile, []);
  const newRequest = {
    id: Date.now(),
    resourceName,
    category,
    description,
    requestedAt: new Date().toISOString(),
    status: 'pending'
  };
  requests.push(newRequest);
  saveJson(requestsFile, requests);
  res.json({ success: true, message: 'Request submitted successfully' });
});

app.get('/api/requests', verifySession, onlyExecutive, (req, res) => {
  const requests = loadJson(requestsFile, []);
  const sorted = requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  res.json(sorted);
});

app.put('/api/requests/:id', verifySession, onlyExecutive, (req, res) => {
  const requestId = Number(req.params.id);
  const { status, answer } = req.body;
  if (!status && !answer) {
    return res.status(400).json({ error: 'Status or answer is required' });
  }
  const requests = loadJson(requestsFile, []);
  const requestIndex = requests.findIndex(r => Number(r.id) === requestId);
  if (requestIndex === -1) {
    return res.status(404).json({ error: 'Request not found' });
  }
  if (status) requests[requestIndex].status = status;
  if (answer !== undefined) requests[requestIndex].adminAnswer = answer;
  if (status && status !== 'pending') {
    requests[requestIndex].resolvedAt = new Date().toISOString();
  }
  saveJson(requestsFile, requests);
  res.json({ success: true, request: requests[requestIndex] });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
