const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    contracts: [{
        id: String,
        name: String,
        order: { type: Number, default: 0 },
        floors: [{
            id: String,
            name: String,
            order: { type: Number, default: 0 },
            rooms: [{
                id: String,
                name: String, // "Помещение"
                order: { type: Number, default: 0 },
                tasks: [{ // Это СМР (Работы)
                    id: String,
                    name: String,
                    groupId: String,
                    volume: { type: Number, default: 0 },
                    unit: { type: String, default: 'шт' }, // м2, м.п, шт и т.д.
                    work_done: { type: Boolean, default: false }, // Выполнено
                    doc_done: { type: Boolean, default: false },  // ИД сдана
                    start_date: { type: Date, default: null },
                    end_date: { type: Date, default: null },
                    comments: [{
                        id: String,
                        text: String,
                        author: String,
                        role: String,
                        timestamp: { type: Date, default: Date.now }
                    }],
                    // НОВОЕ: МТР внутри СМР
                    materials: [{
                        id: String,
                        name: String,
                        coefficient: { type: Number, default: 1 }, // Коэффициент расхода
                        unit: { type: String, default: 'шт' },
                        // Объем берется из родительской задачи * коэффициент
                    }]
                }]
            }]
        }]
    }]
});

module.exports = mongoose.model('Building', BuildingSchema);