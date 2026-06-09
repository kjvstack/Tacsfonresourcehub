const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({

    resourceName: String,

    category: String,

    description: String,

    status: {
        type: String,
        default: "Pending"
    },

    adminAnswer: String

}, {
    timestamps: true
});

module.exports = mongoose.model("Request", requestSchema);