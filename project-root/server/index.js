require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path'); // <--- ОБЯЗАТЕЛЬНО
const fs = require('fs'); // Для проверки существования папки
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

// ВАЖНО: 50MB лимит для вложений
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 5e7 
});

// ==========================================
// 1. API ROUTES
// ==========================================

// ГЛОБАЛЬНЫЙ ЭКСПОРТ
app.get('/api/export/global', async (req, res) => {
    try {
        const buildings = await Building.find().sort({ order: 1 });
        
        const username = req.query.username || 'Директор';
        const role = req.query.role || 'director';
        await createLog(io, username, role, 'Экспорт', `Скачан ПОЛНЫЙ отчет по компании`);

        const workbook = new ExcelJS.Workbook();
        
        // Лист 1: Сводка
        const summarySheet = workbook.addWorksheet('Сводка по объектам');
        summarySheet.columns = [
            { header: 'Объект', key: 'name', width: 30 },
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
            { header: 'Этаж', key: 'floor', width: 10 },
            { header: 'Помещение', key: 'room', width: 20 },
            { header: 'СМР (Работа)', key: 'task', width: 40 },
            { header: 'Объем', key: 'vol', width: 10 },
            { header: 'Ед.', key: 'unit', width: 10 },
            { header: 'Статус СМР', key: 'st_work', width: 15 },
            { header: 'Статус ИД', key: 'st_doc', width: 15 },
        ];
        detailSheet.getRow(1).font = { bold: true };

        buildings.forEach(b => {
            let bTotal = 0, bWork = 0, bDoc = 0;
            
            (b.contracts || []).forEach(c => {
                (c.floors || []).sort((x,y) => (x.order || 0) - (y.order || 0)).forEach(f => {
                    (f.rooms || []).sort((x,y) => (x.order || 0) - (y.order || 0)).forEach(r => {
                        r.tasks.forEach(t => {
                            bTotal++;
                            if(t.work_done) bWork++;
                            if(t.doc_done) bDoc++;

                            const row = detailSheet.addRow({
                                b_name: b.name,
                                c_name: c.name,
                                floor: f.name,
                                room: r.name,
                                task: t.name,
                                vol: t.volume,
                                unit: formatUnit(t.unit, t.unit_power),
                                st_work: t.work_done ? 'ГОТОВО' : 'Не выполнено',
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

            summarySheet.addRow({
                name: b.name,
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

// ЭКСПОРТ КОНКРЕТНОГО ДОМА
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
            { header: 'Договор', key: 'contract', width: 20 },
            { header: 'Этаж', key: 'floor', width: 15 },
            { header: 'Помещение', key: 'room', width: 20 },
            { header: 'СМР (Работа)', key: 'task', width: 45 },
            { header: 'Ед.', key: 'unit', width: 8, style: { alignment: { horizontal: 'center' } } },
            { header: 'Объем', key: 'volume', width: 10 },
            { header: 'СМР', key: 'work', width: 15, style: { alignment: { horizontal: 'center' } } },
            { header: 'ИД', key: 'doc', width: 15, style: { alignment: { horizontal: 'center' } } },
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, size: 12 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        (building.contracts || []).sort((a,b) => (a.order||0)-(b.order||0)).forEach(contract => {
            (contract.floors || []).sort((a,b) => (a.order||0)-(b.order||0)).forEach(floor => {
                 (floor.rooms || []).sort((a,b) => (a.order||0)-(b.order||0)).forEach(room => {
                    
                    if (room.tasks.length === 0) {
                        worksheet.addRow({
                            contract: contract.name,
                            floor: floor.name, 
                            room: room.name, 
                            task: 'Нет работ', 
                            unit: '-', 
                            volume: '-', 
                            work: '-', 
                            doc: '-' 
                        });
                    } else {
                        room.tasks.forEach(task => {
                            const row = worksheet.addRow({
                                contract: contract.name,
                                floor: floor.name,
                                room: room.name,
                                task: task.name,
                                unit: formatUnit(task.unit, task.unit_power),
                                volume: task.volume || 0,
                                work: task.work_done ? 'ВЫПОЛНЕНО' : 'Не выполнено',
                                doc: task.doc_done ? 'СДАНО' : 'Нет ИД'
                            });

                            const green = { argb: 'FFC6EFCE' };
                            const red = { argb: 'FFFFC7CE' };

                            if (task.work_done) row.getCell('work').fill = { type: 'pattern', pattern: 'solid', fgColor: green };
                            else row.getCell('work').fill = { type: 'pattern', pattern: 'solid', fgColor: red };

                            if (task.doc_done) row.getCell('doc').fill = { type: 'pattern', pattern: 'solid', fgColor: green };
                            else row.getCell('doc').fill = { type: 'pattern', pattern: 'solid', fgColor: red };
                        });
                    }
                });
            });
        });

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Report_${encodeURIComponent(building.name)}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error(e);
        res.status(500).send('Ошибка генерации отчета');
    }
});

// --- Socket.IO ---
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

// =========================================================
// 2. РАЗДАЧА ФРОНТЕНДА (React SPA Fix)
// =========================================================

// Вычисляем правильный путь.
// __dirname — это папка, где лежит этот файл (server).
// Нам нужно выйти на уровень вверх (..) и зайти в client/dist.
const clientDistPath = path.join(__dirname, '../client/dist');
const indexPath = path.join(clientDistPath, 'index.html');

console.log(`[System] Путь к статике (dist): ${clientDistPath}`);
console.log(`[System] Путь к index.html: ${indexPath}`);

// Проверка: существует ли папка. Если нет — Render не собрал фронтенд.
if (!fs.existsSync(clientDistPath)) {
    console.error(`[CRITICAL ERROR] Папка ${clientDistPath} НЕ НАЙДЕНА!`);
    console.error(`Выполните команду сборки на Render: "cd client && npm install && npm run build && cd ../server && npm install"`);
}

// 1. Отдаем статику (JS, CSS, картинки)
app.use(express.static(clientDistPath));

// 2. ГЛАВНЫЙ ФИКС: Любой запрос, который не API и не статика -> отдаем index.html
app.get('*', (req, res) => {
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send('Ошибка сервера: Файл index.html не найден. Проверьте сборку фронтенда.');
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER READY port ${PORT}`);
});