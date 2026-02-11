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
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==========================================
// ЭКСПОРТ (Обновлен под договоры)
// ==========================================
app.get('/api/export/global', async (req, res) => {
    try {
        const buildings = await Building.find().sort({ order: 1 });
        const username = req.query.username || 'User';
        const role = req.query.role || 'guest';
        await createLog(io, username, role, 'Экспорт', `Скачан ПОЛНЫЙ отчет по компании`);

        const workbook = new ExcelJS.Workbook();
        
        // Лист 1: Сводка
        const summarySheet = workbook.addWorksheet('Сводка по объектам');
        summarySheet.columns = [
            { header: 'Объект', key: 'name', width: 30 },
            { header: 'Договоров', key: 'contracts', width: 15 },
            { header: 'Всего задач', key: 'total', width: 15 },
            { header: 'Выполнено СМР', key: 'work', width: 20 },
            { header: 'Сдано ИД', key: 'doc', width: 20 },
            { header: '% СМР', key: 'perc_work', width: 10 },
            { header: '% ИД', key: 'perc_doc', width: 10 },
        ];
        summarySheet.getRow(1).font = { bold: true };

        // Лист 2: Детализация
        const detailSheet = workbook.addWorksheet('Полная детализация');
        detailSheet.columns = [
            { header: 'Объект', key: 'b_name', width: 20 },
            { header: 'Договор', key: 'c_name', width: 20 },
            { header: 'Этаж', key: 'floor', width: 15 },
            { header: 'Помещение', key: 'room', width: 20 },
            { header: 'Тип', key: 'type', width: 10 },
            { header: 'Пакет', key: 'pkg', width: 15 },
            { header: 'Работа/МТР', key: 'task', width: 35 },
            { header: 'Объем', key: 'vol', width: 10 },
            { header: 'Ед.', key: 'unit', width: 10 },
            { header: 'Статус СМР', key: 'st_work', width: 15 },
            { header: 'Статус ИД', key: 'st_doc', width: 15 },
        ];
        detailSheet.getRow(1).font = { bold: true };

        buildings.forEach(b => {
            let bTotal = 0, bWork = 0, bDoc = 0;
            const contracts = (b.contracts || []).sort((x,y) => (x.order || 0) - (y.order || 0));

            contracts.forEach(c => {
                const floors = (c.floors || []).sort((x,y) => (x.order || 0) - (y.order || 0));
                floors.forEach(f => {
                    const rooms = (f.rooms || []).sort((x,y) => (x.order || 0) - (y.order || 0));
                    rooms.forEach(r => {
                        r.tasks.forEach(t => {
                            bTotal++;
                            if(t.work_done) bWork++;
                            if(t.doc_done) bDoc++;

                            // Добавляем в детализацию
                            const row = detailSheet.addRow({
                                b_name: b.name,
                                c_name: c.name,
                                floor: f.name,
                                room: r.name,
                                type: t.type === 'mtr' ? 'МТР' : 'СМР',
                                pkg: t.package || '-',
                                task: t.name,
                                vol: t.volume,
                                unit: formatUnit(t.unit, t.unit_power),
                                st_work: t.work_done ? 'ГОТОВО' : 'В работе',
                                st_doc: t.doc_done ? 'СДАНО' : 'Нет ИД'
                            });
                            
                            const green = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                            const red = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };

                            if (t.work_done) row.getCell('st_work').fill = green;
                            else row.getCell('st_work').fill = red;

                            if (t.doc_done) row.getCell('st_doc').fill = green;
                            else row.getCell('st_doc').fill = red;
                        });
                    });
                });
            });

            // Добавляем в сводку
            summarySheet.addRow({
                name: b.name,
                contracts: contracts.length,
                total: bTotal,
                work: bWork,
                doc: bDoc,
                perc_work: bTotal ? Math.round((bWork/bTotal)*100)+'%' : '0%',
                perc_doc: bTotal ? Math.round((bDoc/bTotal)*100)+'%' : '0%',
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