require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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
        resource_type: "auto"
    }
});

const upload = multer({ storage });

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
        console.log("LOGIN BODY:", req.body);

        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        console.log("USER FOUND:", user);

        if (!user) {
            return res.send("User not found");
        }

        const match = await bcrypt.compare(password, user.password);

        console.log("PASSWORD MATCH:", match);

        if (!match) {
            return res.send("Wrong password");
        }

        res.send("Login success");

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

                fileUrl: req.file.path,

                cloudinaryId: req.file.filename,

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