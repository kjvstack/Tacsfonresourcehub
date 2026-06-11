require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const https = require("https");
const http = require("http");

const path = require("path");

const User = require("./models/user");
const Upload = require("./models/upload");
const Request = require("./models/request");

const verifyToken = require("./middleware/verifyToken");
const onlyExecutive = require("./middleware/onlyExecutive");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- DATABASE ---------------- */

mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("MongoDB Connected ✅");
})
.catch(err => {
    console.error("MongoDB Connection Failed ❌");
    console.error(err);
});

/* ---------------- CLOUDINARY ---------------- */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "tacsfon-resources",
        resource_type: "auto",
        use_filename: true,
        unique_filename: true
    }
});

const upload = multer({ storage });

const MAX_DOWNLOAD_REDIRECTS = 5;

function streamCloudinaryFile(sourceUrl, res, downloadName, mimeType, redirectCount = 0) {
    if (redirectCount >= MAX_DOWNLOAD_REDIRECTS) {
        return res.status(508).send("Too many redirects while downloading file");
    }

    const parsedUrl = new URL(sourceUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    client.get(sourceUrl, remoteRes => {
        if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
            return streamCloudinaryFile(remoteRes.headers.location, res, downloadName, mimeType, redirectCount + 1);
        }

        if (remoteRes.statusCode !== 200) {
            console.error('Cloudinary download error', remoteRes.statusCode, remoteRes.statusMessage);
            return res.status(502).send("Failed to retrieve file from storage");
        }

        res.setHeader('Content-Type', mimeType || remoteRes.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        remoteRes.pipe(res);
    }).on('error', err => {
        console.error('Download stream error:', err);
        if (!res.headersSent) {
            res.status(500).send("Download failed");
        }
    });
}

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

/* ---------------- REGISTER ---------------- */

app.post("/register", async (req, res) => {

    try {

        const {
            fullname,
            email,
            matric,
            department,
            level,
            role,
            password,
            confirmPassword
        } = req.body;

        if (password !== confirmPassword) {
            return res.send("Passwords do not match");
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        await User.create({
            fullname,
            email: email.toLowerCase(),
            matric,
            department,
            level,
            role,
            password: hashedPassword
        });

        res.redirect("/login.html");

    } catch (error) {

        console.log(error);
        res.status(500).send("Registration failed");

    }

});



/* ---------------- LOGIN ---------------- */

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.send("User not found");
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.send("Wrong password");
        }

        // Create JWT Token
        const token = jwt.sign(
            {
                id: user._id,
                fullname: user.fullname,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        // Save token in cookie
        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 2 * 60 * 60 * 1000
        });

        // Redirect based on role
        if (user.role === "Executive") {
            return res.redirect("/dashboard.html");
        }

        return res.redirect("/index.html");

    } catch (err) {
        console.log("LOGIN ERROR:", err);
        res.status(500).send("Server error");
    }
});

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {

    res.clearCookie("token");

    res.redirect("/login.html");

});

/* ---------------- UPLOAD ---------------- */

app.post(
    "/upload",
    verifyToken,
    onlyExecutive,
    upload.single("resourceFile"),

    async (req, res) => {

        try {

            const newUpload = await Upload.create({

                title: req.body.title,
                category: req.body.category,
                description: req.body.description,

                originalName: req.file.originalname,
                fileUrl: req.file.path,
                cloudinaryId: req.file.filename,
                mimeType: req.file.mimetype,

                uploadedBy: req.user.fullname

            });

            res.send(`
                <h2>Upload Successful ✅</h2>
                <a href="${newUpload.fileUrl}">
                    View File
                </a>
            `);

        } catch (error) {

            console.log(error);
            res.status(500).send("Upload failed");

        }

    }
);

/* ---------------- GET UPLOADS ---------------- */

app.get("/api/uploads", async (req, res) => {

    const uploads = await Upload
        .find()
        .sort({ createdAt: -1 });

    res.json(uploads);

});

/* ---------------- DOWNLOAD FILE ---------------- */

app.get("/download/:id", async (req, res) => {

    try {

        const file = await Upload.findById(req.params.id);

        if (!file) {
            return res.status(404).send("File not found");
        }

        // Increment download counter
        await Upload.findByIdAndUpdate(req.params.id, {
            $inc: { downloads: 1 }
        });

        const downloadName = file.originalName || `${file.title || 'download'}`;
        let sourceUrl = null;

        if (file.cloudinaryId) {
            // Try to resolve the real asset metadata from Cloudinary
            try {
                const resource = await cloudinary.api.resource(file.cloudinaryId, {
                    resource_type: 'auto',
                    type: 'upload'
                });
                console.log('Cloudinary resource (auto) found for', file.cloudinaryId, resource.resource_type);
                sourceUrl = resource.secure_url;
            } catch (cloudErr) {
                console.warn('Cloudinary resource lookup (auto) failed:', cloudErr && cloudErr.message);
                // Retry as raw (documents like pdf/docx/xls/xml are often stored as raw)
                try {
                    const resourceRaw = await cloudinary.api.resource(file.cloudinaryId, {
                        resource_type: 'raw',
                        type: 'upload'
                    });
                    console.log('Cloudinary resource (raw) found for', file.cloudinaryId);
                    sourceUrl = resourceRaw.secure_url;
                } catch (rawErr) {
                    console.warn('Cloudinary resource lookup (raw) failed:', rawErr && rawErr.message);
                    // Final fallback: generate a Cloudinary URL for raw resource and stream it.
                    try {
                        const generated = cloudinary.url(file.cloudinaryId, {
                            resource_type: 'raw',
                            type: 'upload',
                            secure: true
                        });
                        console.log('Generated Cloudinary URL fallback for', file.cloudinaryId);
                        sourceUrl = generated;
                    } catch (genErr) {
                        console.error('Failed to generate Cloudinary fallback URL:', genErr && genErr.message);
                    }
                }
            }
        }

        if (!sourceUrl && file.fileUrl && /^https?:\/\//i.test(file.fileUrl)) {
            sourceUrl = file.fileUrl;
        }

        if (!sourceUrl) {
            return res.status(404).send("Download URL not found");
        }

        streamCloudinaryFile(sourceUrl, res, downloadName, file.mimeType);

    } catch (error) {

        console.log(error);
        res.status(500).send("Download failed");

    }

});

/* ---------------- RESOURCE REQUEST ---------------- */

app.post(
    "/api/request-resource",
    verifyToken,

    async (req, res) => {

        const request = await Request.create({

            resourceName: req.body.resourceName,
            category: req.body.category,
            description: req.body.description

        });

        res.json(request);

    }
);

/* ---------------- GET REQUESTS ---------------- */

app.get(
    "/api/requests",
    verifyToken,
    onlyExecutive,

    async (req, res) => {

        const requests = await Request
            .find()
            .sort({ createdAt: -1 });

        res.json(requests);

    }
);

/* ---------------- UPDATE REQUEST ---------------- */

app.put(
    "/api/requests/:id",
    verifyToken,
    onlyExecutive,

    async (req, res) => {

        const request = await Request.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(request);

    }
);

/* ---------------- DASHBOARD ---------------- */

app.get(
    "/dashboard.html",
    verifyToken,
    onlyExecutive,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "dashboard.html"
            )
        );

    }
);

/* ---------------- START ---------------- */

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});