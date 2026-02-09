const Log = require('../models/Log');

const genId = () => Math.random().toString(36).substr(2, 9);

// Права
const canEditStructure = (role) => ['admin', 'architect'].includes(role);
const canEditGroups = (role) => ['admin'].includes(role);

// Логирование
async function createLog(io, username, role, action, details) {
    try {
        const newLog = new Log({ username, role, action, details });
        await newLog.save();
        io.emit('new_log', newLog); 
    } catch (e) {
        console.error("Ошибка логирования:", e);
    }
}

module.exports = {
    genId,
    canEditStructure,
    canEditGroups,
    createLog
};