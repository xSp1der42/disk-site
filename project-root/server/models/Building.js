const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    // НОВЫЙ УРОВЕНЬ: Документы (Договоры)
    documents: [{
        id: String,
        name: String, // Название договора/этапа
        order: { type: Number, default: 0 },
        floors: [{
            id: String,
            name: String,
            order: { type: Number, default: 0 },
            rooms: [{
                id: String,
                name: String,
                order: { type: Number, default: 0 },
                tasks: [{
                    id: String,
                    name: String,
                    groupId: String,
                    volume: { type: Number, default: 0 },
                    unit: { type: String, default: 'шт' },
                    unit_power: { type: String, default: '' },
                    work_done: { type: Boolean, default: false },
                    doc_done: { type: Boolean, default: false },
                    start_date: { type: Date, default: null },
                    end_date: { type: Date, default: null },
                    comments: [{
                        id: String,
                        text: String,
                        author: String,
                        role: String,
                        timestamp: { type: Date, default: Date.now }
                    }]
                }]
            }]
        }]
    }]
});

module.exports = mongoose.model('Building', BuildingSchema);