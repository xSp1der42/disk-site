const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 }, 
    // НОВЫЙ УРОВЕНЬ: Договоры
    contracts: [{
        id: String,
        name: String, // Название договора (напр. "Отделка корп. 1")
        order: Number,
        floors: [{
            id: String,
            name: String,
            order: Number,
            rooms: [{
                id: String,
                name: String, // Помещение
                order: Number,
                tasks: [{
                    id: String,
                    name: String,
                    type: { type: String, default: 'smr' }, // 'smr' (СМР) или 'mtr' (Материалы)
                    package: { type: String, default: '' }, // Пакет работ
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