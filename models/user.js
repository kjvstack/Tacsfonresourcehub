const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    matric: String,

    department: String,

    level: String,

    role: {
        type: String,
        enum: ["Member", "Executive"],
        default: "Member"
    },

    password: {
        type: String,
        required: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("User", userSchema);