const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    username: String,
    role: String,
    action: String,
    details: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema);