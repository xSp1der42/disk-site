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
                name: String,
                order: { type: Number, default: 0 },
                tasks: [{
                    id: String,
                    name: String,
                    groupId: String,
                    volume: { type: Number, default: 0 },
                    unit: { type: String, default: 'шт' },
                    work_done: { type: Boolean, default: false },
                    doc_done: { type: Boolean, default: false },
                    start_date: { type: Date, default: null },
                    end_date: { type: Date, default: null },
                    updatedAt: { type: Date, default: Date.now }, 
                    comments: [{
                        id: String,
                        text: String,
                        author: String,
                        role: String,
                        timestamp: { type: Date, default: Date.now },
                        attachments: [{ 
                            name: String,
                            data: String, 
                            type: String 
                        }]
                    }],
                    materials: [{
                        id: String,
                        name: String,
                        coefficient: { type: Number, default: 1 },
                        unit: { type: String, default: 'шт' }
                    }]
                }]
            }]
        }]
    }]
});

module.exports = mongoose.model('Building', BuildingSchema);