require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Log = require('./models/Log');
const Building = require('./models/Building');
const WorkGroup = require('./models/WorkGroup');
const registerSocketHandlers = require('./socket/handlers');
const { createLog } = require('./utils');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construction_db';

mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

const cleanOldLogs = async () => {
    try {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - 31);
        const result = await Log.deleteMany({ timestamp: { $lt: dateThreshold } });
        if (result.deletedCount > 0) {
            console.log(`[System] Очищено старых логов: ${result.deletedCount}`);
        }
    } catch (e) { console.error("Ошибка очистки логов:", e); }
};

const formatUnit = (base, power) => {
    const superscripts = { '2': '²', '3': '³' };
    const p = power ? (superscripts[power] || power) : '';
    return `${base || ''}${p}`;
};

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- EXPORT GLOBAL ---
app.get('/api/export/global', async (req, res) => {
    try {
        const buildings = await Building.find().sort({ order: 1 });
        const username = req.query.username || 'Директор';
        const role = req.query.role || 'director';
        await createLog(io, username, role, 'Экспорт', `Скачан ПОЛНЫЙ отчет по компании`);

        const workbook = new ExcelJS.Workbook();
        const detailSheet = workbook.addWorksheet('Полная детализация');
        detailSheet.columns = [
            { header: 'Объект', key: 'b_name', width: 25 },
            { header: 'Договор', key: 'doc_name', width: 25 },
            { header: 'Этаж', key: 'floor', width: 15 },
            { header: 'Помещение', key: 'room', width: 20 },
            { header: 'Работа', key: 'task', width: 40 },
            { header: 'Объем', key: 'vol', width: 10 },
            { header: 'Ед.', key: 'unit', width: 10 },
            { header: 'Статус СМР', key: 'st_work', width: 15 },
            { header: 'Статус ИД', key: 'st_doc', width: 15 },
        ];
        detailSheet.getRow(1).font = { bold: true };

        buildings.forEach(b => {
            const sortedDocs = (b.documents || []).sort((x,y) => (x.order || 0) - (y.order || 0));
            sortedDocs.forEach(doc => {
                const sortedFloors = (doc.floors || []).sort((x,y) => (x.order || 0) - (y.order || 0));
                sortedFloors.forEach(f => {
                    const sortedRooms = (f.rooms || []).sort((x,y) => (x.order || 0) - (y.order || 0));
                    sortedRooms.forEach(r => {
                        r.tasks.forEach(t => {
                            const row = detailSheet.addRow({
                                b_name: b.name,
                                doc_name: doc.name,
                                floor: f.name,
                                room: r.name,
                                task: t.name,
                                vol: t.volume,
                                unit: formatUnit(t.unit, t.unit_power),
                                st_work: t.work_done ? 'ГОТОВО' : 'В работе',
                                st_doc: t.doc_done ? 'СДАНО' : 'Нет акта'
                            });
                            const green = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                            const red = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                            if (t.work_done) row.getCell('st_work').fill = green; else row.getCell('st_work').fill = red;
                            if (t.doc_done) row.getCell('st_doc').fill = green; else row.getCell('st_doc').fill = red;
                        });
                    });
                });
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Global_Report_${new Date().toISOString().slice(0,10)}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error("Export Error:", e);
        res.status(500).send('Ошибка генерации глобального отчета');
    }
});

// --- EXPORT SPECIFIC BUILDING ---
app.get('/api/export/:buildingId', async (req, res) => {
    try {
        const building = await Building.findOne({ id: req.params.buildingId });
        if (!building) return res.status(404).send('Объект не найден');

        const username = req.query.username || 'Неизвестный';
        const role = req.query.role || 'user';
        await createLog(io, username, role, 'Экспорт', `Скачан отчет Excel: ${building.name}`);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Отчет');

        worksheet.columns = [
            { header: 'Договор', key: 'doc', width: 25 },
            { header: 'Этаж', key: 'floor', width: 20 },
            { header: 'Помещение', key: 'room', width: 25 },
            { header: 'Работа', key: 'task', width: 50 },
            { header: 'Ед.', key: 'unit', width: 12 },
            { header: 'Объем', key: 'volume', width: 12 },
            { header: 'СМР', key: 'work', width: 18 },
            { header: 'ИД', key: 'doc_status', width: 18 },
        ];
        
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        const sortedDocs = (building.documents || []).sort((x,y) => (x.order || 0) - (y.order || 0));
        sortedDocs.forEach(doc => {
            const sortedFloors = (doc.floors || []).sort((x,y) => (x.order || 0) - (y.order || 0));
            sortedFloors.forEach(floor => {
                const sortedRooms = (floor.rooms || []).sort((x,y) => (x.order || 0) - (y.order || 0));
                sortedRooms.forEach(room => {
                    if (room.tasks.length === 0) {
                        worksheet.addRow({ doc: doc.name, floor: floor.name, room: room.name, task: 'Нет работ', unit: '-', volume: '-', work: '-', doc_status: '-' });
                    } else {
                        room.tasks.forEach(task => {
                            const row = worksheet.addRow({
                                doc: doc.name,
                                floor: floor.name,
                                room: room.name,
                                task: task.name,
                                unit: formatUnit(task.unit, task.unit_power),
                                volume: task.volume || 0,
                                work: task.work_done ? 'ВЫПОЛНЕНО' : 'В работе',
                                doc_status: task.doc_done ? 'ПОДПИСАНО' : 'Нет акта'
                            });
                            const green = { argb: 'FFC6EFCE' };
                            const red = { argb: 'FFFFC7CE' };
                            row.getCell('work').fill = { type: 'pattern', pattern: 'solid', fgColor: task.work_done ? green : red };
                            row.getCell('doc_status').fill = { type: 'pattern', pattern: 'solid', fgColor: task.doc_done ? green : red };
                        });
                    }
                });
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Report_${encodeURIComponent(building.name)}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) { console.error(e); res.status(500).send('Ошибка генерации отчета'); }
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
server.listen(PORT, () => { console.log(`SERVER READY port ${PORT}`); });