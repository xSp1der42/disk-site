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
                tasks: [{
                    id: String,
                    name: String,
                    groupId: String,
                    type: { type: String, default: 'smr' }, // 'smr' (СМР) or 'mtr' (МТР)
                    volume: { type: Number, default: 0 },
                    unit: { type: String, default: 'шт' },
                    unit_power: { type: String, default: '' },
                    work_done: { type: Boolean, default: false }, // СМР: Выполнено, МТР: Доставлено
                    doc_done: { type: Boolean, default: false },  // СМР: ИД сдана, МТР: Входной контроль/Акт
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