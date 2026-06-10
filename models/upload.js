const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema({

    title: String,

    category: String,

    description: String,

    fileUrl: String,

    cloudinaryId: String,

    mimeType: String,

    uploadedBy: String,

    downloads: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Upload", uploadSchema);