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

    socket.on('create_building', async ({ name, user }) => { // "Добавить объект"
        if (!user || !canEditStructure(user.role)) return;
        try {
            const count = await Building.countDocuments();
            const newBuilding = new Building({ id: genId(), name: name, order: count + 1, contracts: [] });
            await newBuilding.save();
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Структура', `Создан объект: "${name}"`);
        } catch(e) { console.error(e); }
    });

    socket.on('create_contract', async ({ buildingId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (b) {
                const order = b.contracts.length;
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
            const contract = b?.contracts.find(c => c.id === contractId);
            if (contract) {
                const order = contract.floors.length;
                contract.floors.push({ id: genId(), name: name, order: order, rooms: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Договор: ${contract.name}, Добавлен этаж: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('add_room', async ({ buildingId, contractId, floorId, name, user }) => { // "Добавить помещение"
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
                createLog(io, user.username, user.role, 'Структура', `Этаж: ${f.name}, Помещение: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    // --- СМР (Работы) ---
    socket.on('add_task', async ({ buildingId, contractId, floorId, roomId, taskName, groupId, volume, unit, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            if (r) {
                r.tasks.push({ 
                    id: genId(), 
                    name: taskName, 
                    groupId: groupId || null,
                    volume: parseFloat(volume) || 0,
                    unit: unit || 'шт',
                    work_done: false, 
                    doc_done: false,
                    start_date: null,
                    end_date: null,
                    comments: [],
                    materials: [] // Инициализируем массив материалов
                });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'СМР', `Пом: ${r.name}, Добавлена работа: ${taskName}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('edit_task', async ({ buildingId, contractId, floorId, roomId, taskId, data, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            
            if (t) {
                if (data.name) t.name = data.name;
                if (data.groupId !== undefined) t.groupId = data.groupId;
                if (data.volume !== undefined) t.volume = parseFloat(data.volume);
                if (data.unit !== undefined) t.unit = data.unit;
                
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Редактирование', `Пом: ${r.name}, Изменена работа: ${t.name}`);
            }
        } catch (e) { console.error(e); }
    });

    // --- МТР (Материалы) ---
    socket.on('add_material', async ({ buildingId, contractId, floorId, roomId, taskId, matName, coefficient, unit, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            
            if (t) {
                t.materials.push({
                    id: genId(),
                    name: matName,
                    coefficient: parseFloat(coefficient) || 1,
                    unit: unit || 'шт'
                });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'МТР', `Работа: ${t.name}, Добавлен материал: ${matName}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('delete_material', async ({ buildingId, contractId, floorId, roomId, taskId, matId, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            
            if (t) {
                t.materials = t.materials.filter(m => m.id !== matId);
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'МТР', `Удален материал из работы: ${t.name}`);
            }
        } catch(e) { console.error(e); }
    });

    // --- Общие операции ---

    socket.on('delete_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            if (type === 'building') {
                await Building.deleteOne({ id: ids.buildingId });
                createLog(io, user.username, user.role, 'Удаление', `Удален объект ID: ${ids.buildingId}`);
            } else {
                const b = await Building.findOne({ id: ids.buildingId });
                if (b) {
                    if (type === 'contract') {
                        b.contracts = b.contracts.filter(c => c.id !== ids.contractId);
                        createLog(io, user.username, user.role, 'Удаление', `Удален договор в объекте ${b.name}`);
                    } else {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        if (c) {
                            if (type === 'floor') {
                                c.floors = c.floors.filter(f => f.id !== ids.floorId);
                                createLog(io, user.username, user.role, 'Удаление', `Удален этаж в договоре ${c.name}`);
                            } else {
                                const f = c.floors.find(x => x.id === ids.floorId);
                                if (f) {
                                    if (type === 'room') {
                                        f.rooms = f.rooms.filter(r => r.id !== ids.roomId);
                                        createLog(io, user.username, user.role, 'Удаление', `Удалено помещение в ${f.name}`);
                                    } else if (type === 'task') {
                                        const r = f.rooms.find(x => x.id === ids.roomId);
                                        if (r) {
                                            r.tasks = r.tasks.filter(t => t.id !== ids.taskId);
                                            createLog(io, user.username, user.role, 'Удаление', `Удалена работа в ${r.name}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    await b.save();
                }
            }
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('rename_item', async ({ type, ids, newName, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;

            if (type === 'building') { b.name = newName; }
            else {
                const c = b.contracts.find(x => x.id === ids.contractId);
                if (c) {
                    if (type === 'contract') { c.name = newName; }
                    else {
                        const f = c.floors.find(x => x.id === ids.floorId);
                        if (f) {
                            if (type === 'floor') { f.name = newName; }
                            else if (type === 'room') {
                                const r = f.rooms.find(x => x.id === ids.roomId);
                                if (r) r.name = newName;
                            }
                        }
                    }
                }
            }
            await b.save();
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('copy_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;
            const c = b.contracts.find(x => x.id === ids.contractId);
            if (!c) return;

            const copyTasks = (tasks) => tasks.map(t => ({
                id: genId(), name: t.name, groupId: t.groupId, volume: t.volume, unit: t.unit,
                work_done: false, doc_done: false, comments: [],
                materials: t.materials ? t.materials.map(m => ({...m, id: genId()})) : []
            }));

            if (type === 'floor') {
                const f = c.floors.find(x => x.id === ids.floorId);
                if (f) {
                    const newRooms = f.rooms.map(r => ({ id: genId(), name: r.name, order: r.order, tasks: copyTasks(r.tasks) }));
                    c.floors.push({ id: genId(), name: `${f.name} (Копия)`, order: c.floors.length, rooms: newRooms });
                    createLog(io, user.username, user.role, 'Копирование', `Скопирован этаж: ${f.name}`);
                }
            } else if (type === 'room') {
                const f = c.floors.find(x => x.id === ids.floorId);
                const r = f?.rooms.find(x => x.id === ids.roomId);
                if (r) {
                    f.rooms.push({ id: genId(), name: `${r.name} (Копия)`, order: f.rooms.length, tasks: copyTasks(r.tasks) });
                    createLog(io, user.username, user.role, 'Копирование', `Скопировано помещение: ${r.name}`);
                }
            }
            await b.save();
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('reorder_item', async ({ type, buildingId, contractId, floorId, sourceIndex, destinationIndex, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (!b) return;
            const c = b.contracts.find(x => x.id === contractId);
            if (!c) return;

            let arr = null;
            if (type === 'floor') {
                c.floors.sort((a,b) => (a.order || 0) - (b.order || 0));
                arr = c.floors;
            } else if (type === 'room') {
                const f = c.floors.find(x => x.id === floorId);
                if (f) {
                    f.rooms.sort((a,b) => (a.order || 0) - (b.order || 0));
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

    socket.on('move_item', async ({ type, direction, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            if (type === 'building') {
                let buildings = await Building.find().sort({ order: 1 });
                const idx = buildings.findIndex(b => b.id === ids.buildingId);
                if (idx === -1) return;
                
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx >= 0 && swapIdx < buildings.length) {
                    const temp = buildings[idx].order;
                    buildings[idx].order = buildings[swapIdx].order;
                    buildings[swapIdx].order = temp;
                    if(buildings[idx].order === buildings[swapIdx].order) {
                        buildings[idx].order = idx; buildings[swapIdx].order = swapIdx;
                    }
                    await buildings[idx].save();
                    await buildings[swapIdx].save();
                    await broadcastBuildings();
                }
            } else if (type === 'contract') {
                const b = await Building.findOne({ id: ids.buildingId });
                if (b) {
                    const idx = b.contracts.findIndex(c => c.id === ids.contractId);
                    if (idx === -1) return;
                    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                    if (swapIdx >= 0 && swapIdx < b.contracts.length) {
                        const temp = b.contracts[idx];
                        b.contracts[idx] = b.contracts[swapIdx];
                        b.contracts[swapIdx] = temp;
                        b.contracts.forEach((c, i) => c.order = i);
                        await b.save();
                        await broadcastBuildings();
                    }
                }
            }
        } catch(e) { console.error(e); }
    });

    socket.on('toggle_task_status', async ({ buildingId, contractId, floorId, roomId, taskId, field, value, user }) => {
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const task = r?.tasks.find(x => x.id === taskId);
            
            if (task) {
                task[field] = value;
                await b.save();
                await broadcastBuildings(); // Оптимизация возможна, но для надежности пока так
                
                const actionLabel = field === 'work_done' ? 'СМР Сделано' : 'ИД Сдана';
                const statusLabel = value ? 'Да' : 'Нет';
                createLog(io, user.username, user.role, 'Статус', `${r.name} -> ${task.name}: ${actionLabel} = ${statusLabel}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('update_task_dates', async ({ buildingId, contractId, floorId, roomId, taskId, dates, user }) => {
        if (!user || !['admin', 'architect'].includes(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            if (t) {
                t.start_date = dates.start ? new Date(dates.start) : null;
                t.end_date = dates.end ? new Date(dates.end) : null;
                await b.save();
                await broadcastBuildings();
            }
        } catch (e) { console.error(e); }
    });

    socket.on('add_task_comment', async ({ buildingId, contractId, floorId, roomId, taskId, text, user }) => {
        if (!user) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            if (t) {
                t.comments.push({
                    id: genId(), text, author: `${user.surname} ${user.name}`, role: user.role, timestamp: new Date()
                });
                await b.save();
                await broadcastBuildings();
            }
        } catch (e) { console.error(e); }
    });

    // --- Общие ---
    socket.on('get_logs', async ({ page = 1, search = '', user }) => {
        if (!user || !['admin', 'director'].includes(user.role)) return;
        const limit = 50;
        const skip = (page - 1) * limit;
        let query = {};
        if (search) {
            const regex = new RegExp(search, 'i');
            query = { $or: [{ username: regex }, { action: regex }, { details: regex }] };
        }
        try {
            const logs = await Log.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit);
            const total = await Log.countDocuments(query);
            socket.emit('logs_data', { logs, total });
        } catch (e) { console.error(e); }
    });

    socket.on('get_users_list', async ({ user }) => {
        if (!user || user.role !== 'admin') return;
        const users = await User.find({}, '-password'); 
        socket.emit('users_list_update', users);
    });

    socket.on('admin_create_user', async ({ newUserData, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            const exists = await User.findOne({ username: newUserData.username });
            if (exists) { socket.emit('operation_error', 'Логин уже занят'); return; }
            const userToCreate = new User(newUserData);
            await userToCreate.save();
            socket.emit('user_saved');
        } catch (e) { socket.emit('operation_error', 'Ошибка: ' + e.message); }
    });

    socket.on('admin_edit_user', async ({ userData, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            const updateFields = { ...userData };
            if (!updateFields.password) delete updateFields.password;
            await User.findByIdAndUpdate(userData._id, updateFields);
            socket.emit('user_saved');
        } catch (e) { socket.emit('operation_error', 'Ошибка сохранения'); }
    });

    socket.on('admin_delete_user', async ({ targetUserId, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            await User.findByIdAndDelete(targetUserId);
            const list = await User.find({}, '-password');
            socket.emit('users_list_update', list);
        } catch (e) { socket.emit('operation_error', 'Ошибка удаления'); }
    });

    socket.on('create_group', async ({ name, user }) => {
        if (!user || !canEditGroups(user.role)) return;
        try {
            const count = await WorkGroup.countDocuments();
            const newGroup = new WorkGroup({ id: genId(), name, order: count + 1 });
            await newGroup.save();
            await broadcastGroups();
        } catch (e) { console.error(e); }
    });

    socket.on('delete_group', async ({ groupId, user }) => {
        if (!user || !canEditGroups(user.role)) return;
        try {
            await WorkGroup.findOneAndDelete({ id: groupId });
            await broadcastGroups();
        } catch (e) { console.error(e); }
    });

    socket.on('move_group', async ({ groupId, direction, user }) => {
        if (!user || !canEditGroups(user.role)) return;
        try {
            let groups = await WorkGroup.find().sort({ order: 1 });
            const index = groups.findIndex(g => g.id === groupId);
            if (index === -1) return;
            if (direction === 'up' && index > 0) {
                const tempOrder = groups[index].order;
                groups[index].order = groups[index - 1].order;
                groups[index - 1].order = tempOrder;
                await groups[index].save(); await groups[index - 1].save();
            } else if (direction === 'down' && index < groups.length - 1) {
                const tempOrder = groups[index].order;
                groups[index].order = groups[index + 1].order;
                groups[index + 1].order = tempOrder;
                await groups[index].save(); await groups[index + 1].save();
            }
            await broadcastGroups();
        } catch (e) { console.error(e); }
    });
};