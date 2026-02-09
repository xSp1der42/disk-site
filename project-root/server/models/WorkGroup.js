const mongoose = require('mongoose');

const WorkGroupSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 }
});

module.exports = mongoose.model('WorkGroup', WorkGroupSchema);