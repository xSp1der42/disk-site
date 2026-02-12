require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Log = require('./models/Log');

// Импорт моделей и обработчиков
const Building = require('./models/Building');
const WorkGroup = require('./models/WorkGroup');
const registerSocketHandlers = require('./socket/handlers');
const { createLog } = require('./utils');

// --- Настройка MongoDB ---
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construction_db';

mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

// --- Очистка логов (старше 31 дня) ---
const cleanOldLogs = async () => {
    try {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - 31);
        const result = await Log.deleteMany({ timestamp: { $lt: dateThreshold } });
        if (result.deletedCount > 0) {
            console.log(`[System] Очищено старых логов: ${result.deletedCount}`);
        }
    } catch (e) {
        console.error("Ошибка очистки логов:", e);
    }
};

const formatUnit = (base, power) => {
    const superscripts = { '2': '²', '3': '³' };
    const p = power ? (superscripts[power] || power) : '';
    return `${base || ''}${p}`;
};

// --- Сервер ---
const app = express();
app.use(cors());
const server = http.createServer(app);

// ВАЖНО: УВЕЛИЧЕНО ДО 50MB (5e7), чтобы файлы 10-15мб пролезали в base64
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 5e7 
});

// ГЛОБАЛЬНЫЙ ЭКСПОРТ
app.get('/api/export/global', async (req, res) => {
    try {
        const buildings = await Building.find().sort({ order: 1 });
        const username = req.query.username || 'Директор';
        const role = req.query.role || 'director';
        await createLog(io, username, role, 'Экспорт', `Скачан ПОЛНЫЙ отчет по компании`);

        const workbook = new ExcelJS.Workbook();
        const summarySheet = workbook.addWorksheet('Сводка по объектам');
        summarySheet.columns = [
            { header: 'Объект', key: 'name', width: 30 },
            { header: 'Всего задач', key: 'total', width: 15 },
            { header: 'Выполнено СМР', key: 'work', width: 20 },
            { header: 'Сдано ИД', key: 'doc', width: 20 },
            { header: '% СМР', key: 'perc_work', width: 10 },
            { header: '% ИД', key: 'perc_doc', width: 10 },
        ];
        
        const detailSheet = workbook.addWorksheet('Полная детализация');
        detailSheet.columns = [
            { header: 'Объект', key: 'b_name', width: 25 },
            { header: 'Этаж', key: 'floor', width: 15 },
            { header: 'Помещение', key: 'room', width: 20 },
            { header: 'Работа', key: 'task', width: 40 },
            { header: 'Объем', key: 'vol', width: 10 },
            { header: 'Ед.', key: 'unit', width: 10 },
            { header: 'Статус СМР', key: 'st_work', width: 15 },
            { header: 'Статус ИД', key: 'st_doc', width: 15 },
        ];

        buildings.forEach(b => {
            let bTotal = 0, bWork = 0, bDoc = 0;
            (b.floors || []).forEach(f => {
                (f.rooms || []).forEach(r => {
                    r.tasks.forEach(t => {
                        bTotal++; if(t.work_done) bWork++; if(t.doc_done) bDoc++;
                        detailSheet.addRow({ 
                            b_name: b.name, floor: f.name, room: r.name, task: t.name, vol: t.volume, 
                            unit: formatUnit(t.unit, t.unit_power), 
                            st_work: t.work_done ? 'ГОТОВО' : 'В работе', 
                            st_doc: t.doc_done ? 'СДАНО' : 'Нет акта' 
                        });
                    });
                });
            });
            summarySheet.addRow({ 
                name: b.name, total: bTotal, work: bWork, doc: bDoc, 
                perc_work: bTotal ? Math.round((bWork/bTotal)*100)+'%' : '0%', 
                perc_doc: bTotal ? Math.round((bDoc/bTotal)*100)+'%' : '0%' 
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Global_Report.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) { res.status(500).send('Error'); }
});

// ЭКСПОРТ ОБЪЕКТА
app.get('/api/export/:buildingId', async (req, res) => {
    try {
        const building = await Building.findOne({ id: req.params.buildingId });
        if (!building) return res.status(404).send('Not found');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Отчет');
        worksheet.columns = [
            { header: 'Этаж', key: 'floor', width: 20 },
            { header: 'Помещение', key: 'room', width: 25 },
            { header: 'Работа', key: 'task', width: 50 },
            { header: 'Ед.', key: 'unit', width: 10 },
            { header: 'Объем', key: 'volume', width: 10 },
            { header: 'СМР', key: 'work', width: 15 },
            { header: 'ИД', key: 'doc', width: 15 }
        ];
        (building.floors || []).forEach(floor => {
             (floor.rooms || []).forEach(room => {
                room.tasks.forEach(task => {
                    worksheet.addRow({ 
                        floor: floor.name, room: room.name, task: task.name, 
                        unit: formatUnit(task.unit, task.unit_power), volume: task.volume, 
                        work: task.work_done ? 'ГОТОВО' : 'В работе', 
                        doc: task.doc_done ? 'СДАНО' : 'Нет акта' 
                    });
                });
            });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Report.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) { res.status(500).send('Error'); }
});

io.on('connection', async (socket) => {
    try {
        const buildings = await Building.find().sort({ order: 1 });
        const groups = await WorkGroup.find().sort({ order: 1 });
        socket.emit('init_data', buildings);
        socket.emit('init_groups', groups);
    } catch (e) { console.error("Error fetching init data:", e); }

    registerSocketHandlers(io, socket);
});

cleanOldLogs();
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER READY port ${PORT}`);
});