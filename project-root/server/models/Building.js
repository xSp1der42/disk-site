const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    // Новая сущность: Договоры (Пакеты)
    contracts: [{
        id: String,
        name: String,
        description: String
    }], 
    floors: [{
        id: String,
        name: String,
        rooms: [{
            id: String,
            name: String,
            tasks: [{
                id: String,
                name: String,
                groupId: String,
                contractId: String, // Привязка к договору
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
                }],
                // Новая сущность: МТР (Материалы внутри работы)
                mtr: [{
                    id: String,
                    name: String,
                    unit: String,
                    coefficient: { type: Number, default: 1 }, // Коэффициент расхода
                    total: { type: Number, default: 0 }        // Итоговое кол-во (Объем * Коэф)
                }]
            }]
        }]
    }]
});

module.exports = mongoose.model('Building', BuildingSchema);