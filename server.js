const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Session storage (in-memory)
const sessions = {};

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Ensure upload folder exists
const uploadDir = "./public/files";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

// Serve the dashboard HTML from the public directory (file lives in public)
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Upload route
app.post("/upload", upload.single("resourceFile"), (req, res) => {
    const { title, category, description, requestId } = req.body;
    const file = req.file;

    console.log("UPLOAD RECEIVED:");
    console.log(title, category, requestId, file ? file.filename : 'no file');

    if (requestId) {
        try {
            const requests = fs.existsSync(requestsFile)
                ? JSON.parse(fs.readFileSync(requestsFile, 'utf-8'))
                : [];

            const idx = requests.findIndex(r => Number(r.id) === Number(requestId));
            if (idx !== -1) {
                requests[idx].status = 'uploaded';
                requests[idx].resolvedAt = new Date().toISOString();
                requests[idx].uploadedFile = file ? file.filename : null;
                requests[idx].uploadTitle = title;
                fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
            }
        } catch (err) {
            console.error('Failed to update request status after upload', err);
        }
    }

    res.send(`
        <h2>Upload Successful ✅</h2>
        <p><b>File:</b> ${file.originalname}</p>
        ${requestId ? `<p>Request #${requestId} has been marked as uploaded.</p>` : ''}
        <a href="/dashboard.html">Go Back</a>
    `);
});

// API: list uploaded files
app.get('/api/uploads', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Unable to read uploads' });

        const items = files.map((fname) => {
            const full = path.join(uploadDir, fname);
            let stat = { mtime: 0 };
            try { stat = fs.statSync(full); } catch (e) {}
            const idx = fname.indexOf('-');
            const originalName = idx > -1 ? fname.slice(idx + 1) : fname;
            return {
                filename: fname,
                originalName,
                uploadedAt: stat.mtime
            };
        }).sort((a, b) => b.uploadedAt - a.uploadedAt);

        res.json(items);
    });
});

// Download a file by stored filename
app.get('/files/:filename', (req, res) => {
    const requested = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, requested);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

    const idx = requested.indexOf('-');
    const original = idx > -1 ? requested.slice(idx + 1) : requested;
    res.download(filePath, original);
});

// User file
const usersFile = path.join(__dirname, 'users.json');

// Register route
app.post("/register", (req, res) => {
    const { fullname, email, matric, department, level, role, password, confirmPassword } = req.body;

    // 1. Validate password
    if (password !== confirmPassword) {
        return res.send("Passwords do not match! <a href='/register.html'>Go Back</a>");
    }

    // 2. Normalize email (VERY IMPORTANT FOR LOGIN)
    const cleanEmail = email.trim().toLowerCase();

    // 3. Read users safely
    let users = [];
    try {
        if (fs.existsSync(usersFile)) {
            const data = fs.readFileSync(usersFile, "utf-8");
            users = data ? JSON.parse(data) : [];
        }
    } catch (err) {
        users = [];
    }

    // 4. Check if user already exists
    const userExists = users.find(u => u.email === cleanEmail);
    if (userExists) {
        return res.send("User already exists! <a href='/register.html'>Go Back</a>");
    }

    // 5. Create new user
    const newUser = {
        id: Date.now(),
        fullname,
        email: cleanEmail,
        matric,
        department,
        level,
        role,
        password
    };

    // 6. Save user
    users.push(newUser);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    // 7. Success response
    return res.send(`
        <h2>Registration Successful ✅</h2>
        <p>You can now login</p>
        <a href="/login.html">Go to Login</a>
    `);
});

// Login route
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : "";

    // Read users
    let users = [];
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    // Find user
    const user = users.find(u => u.email === cleanEmail && u.password === password);

    if (!user) {
        return res.send(`
            <h2>Login Failed ❌</h2>
            <p>Invalid email or password</p>
            <a href="/login.html">Try Again</a>
        `);
    }

    // Create session
    const sessionId = Date.now().toString();
    sessions[sessionId] = { id: user.id, fullname: user.fullname, email: user.email, role: user.role };
    res.cookie('sessionId', sessionId, { maxAge: 3600000 });

    // Redirect based on role
    if (user.role === 'Member') {
        return res.redirect(`/index.html?sid=${sessionId}`);
    } else if (user.role === 'Executive') {
        return res.redirect(`/dashboard.html?sid=${sessionId}`);
    }
    return res.redirect(`/index.html?sid=${sessionId}`);
});

// Logout route
app.get('/logout', (req, res) => {
    const sessionId = req.query.sid;
    if (sessionId) delete sessions[sessionId];
    res.redirect('/login.html');
});

// Resource requests file
const requestsFile = path.join(__dirname, 'requests.json');

// Ensure requests file exists
if (!fs.existsSync(requestsFile)) {
    fs.writeFileSync(requestsFile, JSON.stringify([], null, 2));
}

// API: Submit resource request
app.post('/api/request-resource', (req, res) => {
    const { resourceName, category, description } = req.body;

    if (!resourceName || !category) {
        return res.status(400).json({ error: 'Resource name and category are required' });
    }

    // Read existing requests
    let requests = [];
    try {
        if (fs.existsSync(requestsFile)) {
            requests = JSON.parse(fs.readFileSync(requestsFile));
        }
    } catch (e) {
        requests = [];
    }

    // Create new request
    const newRequest = {
        id: Date.now(),
        resourceName,
        category,
        description,
        requestedAt: new Date().toISOString(),
        status: 'pending'
    };

    requests.push(newRequest);
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));

    res.json({ success: true, message: 'Request submitted successfully' });
});

// API: Get all resource requests (for admin)
app.get('/api/requests', (req, res) => {
    try {
        if (fs.existsSync(requestsFile)) {
            const requests = JSON.parse(fs.readFileSync(requestsFile));
            const sorted = requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
            return res.json(sorted);
        }
    } catch (e) {
        console.error(e);
    }
    res.json([]);
});

// API: Update a resource request
app.put('/api/requests/:id', (req, res) => {
    const requestId = Number(req.params.id);
    const { status, answer } = req.body;

    if (!status && !answer) {
        return res.status(400).json({ error: 'Status or answer is required' });
    }

    let requests = [];
    try {
        if (fs.existsSync(requestsFile)) {
            requests = JSON.parse(fs.readFileSync(requestsFile));
        }
    } catch (e) {
        return res.status(500).json({ error: 'Unable to read requests' });
    }

    const requestIndex = requests.findIndex(r => Number(r.id) === requestId);
    if (requestIndex === -1) {
        return res.status(404).json({ error: 'Request not found' });
    }

    if (status) requests[requestIndex].status = status;
    if (answer !== undefined) requests[requestIndex].adminAnswer = answer;
    if (status && status !== 'pending') {
        requests[requestIndex].resolvedAt = new Date().toISOString();
    }

    try {
        fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
    } catch (e) {
        return res.status(500).json({ error: 'Unable to save request update' });
    }

    res.json({ success: true, request: requests[requestIndex] });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});