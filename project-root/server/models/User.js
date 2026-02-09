const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    role: { type: String, required: true }, // director, admin, pto, prorab, architect
    name: { type: String, default: 'Сотрудник' },
    surname: { type: String, default: '' },
    phone: { type: String, default: '' }
});

module.exports = mongoose.model('User', UserSchema);