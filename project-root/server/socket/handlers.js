const User = require('../models/User');
const Log = require('../models/Log');
const WorkGroup = require('../models/WorkGroup');
const Building = require('../models/Building');
const { genId, canEditStructure, canEditGroups, createLog } = require('../utils');

module.exports = function(io, socket) {
    
    const broadcastGroups = async () => {
        const groups = await WorkGroup.find().sort({ order: 1 });
        io.emit('init_groups', groups);
    };

    const broadcastBuildings = async () => {
        const buildings = await Building.find().sort({ order: 1 });
        io.emit('init_data', buildings);
    };

    // --- Авторизация ---
    socket.on('login', async ({ username, password }) => {
        try {
            const user = await User.findOne({ username, password });
            if (user) {
                socket.emit('login_success', { 
                    username: user.username, 
                    role: user.role,
                    name: user.name,
                    surname: user.surname,
                    phone: user.phone,
                    _id: user._id
                });
            } else {
                socket.emit('login_error', 'Неверный логин или пароль');
            }
        } catch (e) {
            socket.emit('login_error', 'Ошибка сервера');
        }
    });
    
    // --- Структура ---
    socket.on('create_building', async ({ name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const count = await Building.countDocuments();
            const newBuilding = new Building({ id: genId(), name: name, order: count + 1, contracts: [] });
            await newBuilding.save();
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Структура', `Создан объект: "${name}"`);
        } catch(e) { console.error(e); }
    });

    socket.on('add_contract', async ({ buildingId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (b) {
                const order = b.contracts ? b.contracts.length : 0;
                b.contracts.push({ id: genId(), name: name, order: order, floors: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Объект: ${b.name}, Добавлен договор: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('add_floor', async ({ buildingId, contractId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            if (c) {
                const order = c.floors.length;
                c.floors.push({ id: genId(), name: name, order: order, rooms: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Договор: ${c.name}, Добавлен этаж: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('add_room', async ({ buildingId, contractId, floorId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            if (f) {
                const order = f.rooms.length;
                f.rooms.push({ id: genId(), name: name, order: order, tasks: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Этаж: ${f.name}, Добавлено помещение: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('add_task', async ({ buildingId, contractId, floorId, roomId, taskData, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            if (r) {
                r.tasks.push({ 
                    id: genId(), 
                    name: taskData.name, 
                    type: taskData.type || 'smr',
                    package: taskData.package || '',
                    groupId: taskData.groupId || null,
                    volume: parseFloat(taskData.volume) || 0,
                    unit: taskData.unit || 'шт',
                    unit_power: taskData.unit_power || '',
                    work_done: false, 
                    doc_done: false,
                    start_date: null,
                    end_date: null,
                    comments: []
                });
                await b.save();
                await broadcastBuildings();
            }
        } catch(e) { console.error(e); }
    });
    
    // --- НОВОЕ: Копирование ---
    socket.on('copy_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;

            const copyTasks = (tasks) => tasks.map(t => ({
                id: genId(),
                name: t.name,
                type: t.type,
                package: t.package,
                groupId: t.groupId,
                volume: t.volume,
                unit: t.unit,
                unit_power: t.unit_power,
                work_done: false, // Сброс статуса
                doc_done: false,  // Сброс статуса
                start_date: null,
                end_date: null,
                comments: []
            }));

            const copyRooms = (rooms) => rooms.map(r => ({
                id: genId(),
                name: r.name,
                order: r.order,
                tasks: copyTasks(r.tasks)
            }));

            if (type === 'contract') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                if (c) {
                    const newFloors = c.floors.map(f => ({
                        id: genId(),
                        name: f.name,
                        order: f.order,
                        rooms: copyRooms(f.rooms)
                    }));
                    b.contracts.push({
                        id: genId(),
                        name: `${c.name} (Копия)`,
                        order: b.contracts.length,
                        floors: newFloors
                    });
                    createLog(io, user.username, user.role, 'Копирование', `Скопирован договор: ${c.name}`);
                }
            } else if (type === 'floor') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                if (f) {
                    c.floors.push({
                        id: genId(),
                        name: `${f.name} (Копия)`,
                        order: c.floors.length,
                        rooms: copyRooms(f.rooms)
                    });
                    createLog(io, user.username, user.role, 'Копирование', `Скопирован этаж: ${f.name}`);
                }
            } else if (type === 'room') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                const r = f?.rooms.find(x => x.id === ids.roomId);
                if (r) {
                    f.rooms.push({
                        id: genId(),
                        name: `${r.name} (Копия)`,
                        order: f.rooms.length,
                        tasks: copyTasks(r.tasks)
                    });
                    createLog(io, user.username, user.role, 'Копирование', `Скопировано помещение: ${r.name}`);
                }
            }
            
            await b.save();
            await broadcastBuildings();

        } catch (e) { console.error(e); }
    });

    // --- Остальные обработчики ---
    // (без изменений, скопированы из предыдущей версии для полноты файла)
    socket.on('rename_item', async ({ type, ids, newName, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;

            if (type === 'building') {
                b.name = newName;
            } else if (type === 'contract') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                if(c) c.name = newName;
            } else if (type === 'floor') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                if(f) f.name = newName;
            } else if (type === 'room') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                const r = f?.rooms.find(x => x.id === ids.roomId);
                if(r) r.name = newName;
            } 
            await b.save();
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('delete_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            if (type === 'building') {
                await Building.deleteOne({ id: ids.buildingId });
            } else {
                const b = await Building.findOne({ id: ids.buildingId });
                if (b) {
                    if (type === 'contract') {
                        b.contracts = b.contracts.filter(x => x.id !== ids.contractId);
                    } else if (type === 'floor') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        if(c) c.floors = c.floors.filter(x => x.id !== ids.floorId);
                    } else if (type === 'room') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        const f = c?.floors.find(x => x.id === ids.floorId);
                        if(f) f.rooms = f.rooms.filter(x => x.id !== ids.roomId);
                    } else if (type === 'task') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        const f = c?.floors.find(x => x.id === ids.floorId);
                        const r = f?.rooms.find(x => x.id === ids.roomId);
                        if (r) r.tasks = r.tasks.filter(x => x.id !== ids.taskId);
                    }
                    await b.save();
                }
            }
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('reorder_item', async ({ type, ids, sourceIndex, destinationIndex, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;

            let arr = null;

            if (type === 'contract') {
                b.contracts.sort((a,b) => (a.order||0) - (b.order||0));
                arr = b.contracts;
            } else if (type === 'floor') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                if (c) {
                    c.floors.sort((a,b) => (a.order||0) - (b.order||0));
                    arr = c.floors;
                }
            } else if (type === 'room') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                if (f) {
                    f.rooms.sort((a,b) => (a.order||0) - (b.order||0));
                    arr = f.rooms;
                }
            }

            if (arr) {
                const [movedItem] = arr.splice(sourceIndex, 1);
                arr.splice(destinationIndex, 0, movedItem);
                arr.forEach((item, index) => { item.order = index; });
                await b.save();
                await broadcastBuildings();
            }
        } catch (e) { console.error(e); }
    });
    
    socket.on('toggle_task_status', async ({ buildingId, contractId, floorId, roomId, taskId, field, value, user }) => {
        if (!user || ['director', 'architect'].includes(user.role)) return;
        if (field === 'work_done' && !['prorab', 'admin'].includes(user.role)) return;
        if (field === 'doc_done' && !['pto', 'admin'].includes(user.role)) return;

        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const task = r?.tasks.find(x => x.id === taskId);

            if (task) {
                task[field] = value;
                await b.save();
                await broadcastBuildings();
            }
        } catch(e) { console.error(e); }
    });
};