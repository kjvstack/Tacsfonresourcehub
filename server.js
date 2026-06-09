const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URL || "mongodb+srv://tacsfonresourcehub:Vbf1LHxqKdsj7Kcr@cluster0.if6852u.mongodb.net/?appName=Cluster0" , {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("MongoDB connected ✅");
}).catch(err => {
    console.log("MongoDB connection error ❌", err);
});

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

const JWT_SECRET = "tacsfon_secret_key_2026_change_this";

require("dotenv").config();

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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
    const token = req.cookies.token;

    if (!token) return res.redirect("/login.html");

    try {
        const user = jwt.verify(token, JWT_SECRET);

        if (user.role !== "Executive") {
            return res.send("Access denied ❌");
        }

        req.user = user;
        next();
    } catch (err) {
        return res.redirect("/login.html");
    }
}

ensureFile(usersFile, []);
ensureFile(requestsFile, []);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "tacsfon-resources",
    resource_type: "auto"
  }
});

const upload = multer({ storage });

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(['/dashboard.html', '/requests.html'], verifySession, onlyExecutive);
app.use(express.static(path.join(__dirname, 'public')));

app.get("/dashboard.html", verifyToken, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

//Register Route
app.post("/register", async (req, res) => {
    const { fullname, email, matric, department, level, role, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.send("Passwords do not match");
    }

    const cleanEmail = email.trim().toLowerCase();

    // check if exists
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) {
        return res.send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
        fullname,
        email: cleanEmail,
        matric,
        department,
        level,
        role,
        password: hashedPassword
    });

    await newUser.save();

    res.send(`
        <h2>Registration Successful ✅</h2>
        <a href="/login.html">Login</a>
    `);
});

//Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
        return res.send("Invalid login");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return res.send("Invalid login");
    }

    const token = jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            fullname: user.fullname
        },
        JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        maxAge: 2 * 60 * 60 * 1000
    });

    if (user.role === "Executive") {
        return res.redirect("/dashboard.html");
    }

    return res.redirect("/index.html");
});

//Logout Route
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login.html");
});

//Upload Route
app.post("/upload", onlyExecutive, upload.single("resourceFile"), (req, res) => {

    const fileUrl = req.file.path;

    console.log("Uploaded to Cloudinary:");
    console.log(fileUrl);

    res.send(`
        <h2>Upload Successful ✅</h2>
        <a href="${fileUrl}" target="_blank">View File</a>
        <br><br>
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
