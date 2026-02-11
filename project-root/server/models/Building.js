const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 }, 
    // Новый уровень: Договоры (Пакеты)
    contracts: [{
        id: String,
        name: String, // Название договора (Отделка, Электрика и т.д.)
        order: { type: Number, default: 0 },
        floors: [{
            id: String,
            name: String,
            order: { type: Number, default: 0 },
            rooms: [{
                id: String,
                name: String,
                order: { type: Number, default: 0 },
                tasks: [{ // Это теперь СМР
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
                    }],
                    // Новый уровень: МТР (Материалы)
                    materials: [{
                        id: String,
                        name: String, // Название материала (Клей, Саморезы)
                        unit: { type: String, default: 'шт' },
                        coefficient: { type: Number, default: 1 }, // Коэффициент расхода
                        total_quantity: { type: Number, default: 0 } // Итого = объем работы * к-т
                    }]
                }]
            }]
        }]
    }]
});

module.exports = mongoose.model('Building', BuildingSchema);