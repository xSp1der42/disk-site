const User = require('../models/User');
const Log = require('../models/Log');
const WorkGroup = require('../models/WorkGroup');
const Building = require('../models/Building');
const { genId, canEditStructure, canEditGroups, createLog } = require('../utils');
const ExcelJS = require('exceljs');

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
            console.log(`Login attempt: ${username}`);
            const user = await User.findOne({ username, password });
            
            if (user) {
                console.log(`Login success: ${user.username}`);
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
            console.error(e);
            socket.emit('login_error', 'Ошибка сервера');
        }
    });

    // --- Логи ---
    socket.on('get_logs', async ({ page = 1, search = '', user }) => {
        if (!user || !['admin', 'director'].includes(user.role)) return;

        const limit = 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (search) {
            const regex = new RegExp(search, 'i');
            query = {
                $or: [
                    { username: regex },
                    { action: regex },
                    { details: regex }
                ]
            };
        }

        try {
            const logs = await Log.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit);
            const total = await Log.countDocuments(query);
            socket.emit('logs_data', { logs, total });
        } catch (e) { console.error(e); }
    });

    // --- Админка пользователей ---
    socket.on('get_users_list', async ({ user }) => {
        if (!user || user.role !== 'admin') return;
        const users = await User.find({}, '-password'); 
        socket.emit('users_list_update', users);
    });

    socket.on('admin_create_user', async ({ newUserData, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            const exists = await User.findOne({ username: newUserData.username });
            if (exists) {
                socket.emit('operation_error', 'Логин уже занят');
                return;
            }
            const userToCreate = new User(newUserData);
            await userToCreate.save();
            socket.emit('user_saved');
            createLog(io, user.username, user.role, 'Сотрудники', `Создан пользователь: ${newUserData.username}`);
        } catch (e) {
            socket.emit('operation_error', 'Ошибка создания: ' + e.message);
        }
    });

    socket.on('admin_edit_user', async ({ userData, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            const updateFields = { ...userData };
            if (!updateFields.password) delete updateFields.password;
            
            await User.findByIdAndUpdate(userData._id, updateFields);
            socket.emit('user_saved');
            createLog(io, user.username, user.role, 'Сотрудники', `Обновлены данные: ${userData.username}`);
        } catch (e) {
            socket.emit('operation_error', 'Ошибка сохранения');
        }
    });

    socket.on('admin_delete_user', async ({ targetUserId, user }) => {
        if (!user || user.role !== 'admin') return;
        try {
            const target = await User.findByIdAndDelete(targetUserId);
            if (target) {
                createLog(io, user.username, user.role, 'Сотрудники', `Удален пользователь: ${target.username}`);
                const list = await User.find({}, '-password');
                socket.emit('users_list_update', list);
            }
        } catch (e) {
            socket.emit('operation_error', 'Ошибка удаления');
        }
    });

    // --- Группы работ ---
    socket.on('create_group', async ({ name, user }) => {
        if (!user || !canEditGroups(user.role)) return;
        try {
            const count = await WorkGroup.countDocuments();
            const newGroup = new WorkGroup({ id: genId(), name, order: count + 1 });
            await newGroup.save();
            await broadcastGroups();
            createLog(io, user.username, user.role, 'Справочники', `Создана группа работ: "${name}"`);
        } catch (e) { console.error(e); }
    });

    socket.on('delete_group', async ({ groupId, user }) => {
        if (!user || !canEditGroups(user.role)) return;
        try {
            const g = await WorkGroup.findOneAndDelete({ id: groupId });
            if (g) {
                await broadcastGroups();
                createLog(io, user.username, user.role, 'Справочники', `Удалена группа работ: "${g.name}"`);
            }
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
                await groups[index].save();
                await groups[index - 1].save();

            } else if (direction === 'down' && index < groups.length - 1) {
                const tempOrder = groups[index].order;
                groups[index].order = groups[index + 1].order;
                groups[index + 1].order = tempOrder;
                await groups[index].save();
                await groups[index + 1].save();
            }
            await broadcastGroups();
        } catch (e) { console.error(e); }
    });

    // --- Структура: ДОМА ---
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

    // --- Структура: ДОГОВОРЫ ---
    socket.on('create_contract', async ({ buildingId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (b) {
                const order = b.contracts.length;
                b.contracts.push({ id: genId(), name: name, order: order, floors: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Объект: ${b.name}, Создан договор: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    // --- Структура: ЭТАЖИ (Внутри договора) ---
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

    // --- Структура: ПОМЕЩЕНИЯ ---
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

    // --- Структура: СМР (ЗАДАЧИ) ---
    socket.on('add_task', async ({ buildingId, contractId, floorId, roomId, taskName, groupId, volume, unit, unit_power, user }) => {
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
                    unit_power: unit_power || '',
                    work_done: false, 
                    doc_done: false,
                    start_date: null,
                    end_date: null,
                    comments: [],
                    materials: []
                });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Работы', `Кв: ${r.name}, Добавлен СМР: ${taskName}`);
            }
        } catch(e) { console.error(e); }
    });

    // --- Структура: МТР (МАТЕРИАЛЫ) ---
    socket.on('add_material', async ({ buildingId, contractId, floorId, roomId, taskId, name, unit, coefficient, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const c = b?.contracts.find(x => x.id === contractId);
            const f = c?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            
            if (t) {
                const coeffVal = parseFloat(coefficient) || 1;
                const totalQty = (t.volume || 0) * coeffVal;
                
                t.materials.push({
                    id: genId(),
                    name,
                    unit: unit || 'шт',
                    coefficient: coeffVal,
                    total_quantity: totalQty
                });

                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Материалы', `СМР: ${t.name}, Добавлен МТР: ${name}`);
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
                
                const newVolume = parseFloat(data.volume);
                if (data.volume !== undefined && !isNaN(newVolume)) {
                    t.volume = newVolume;
                    // Пересчет материалов
                    t.materials.forEach(m => {
                        m.total_quantity = t.volume * (m.coefficient || 1);
                    });
                }

                if (data.unit !== undefined) t.unit = data.unit;
                if (data.unit_power !== undefined) t.unit_power = data.unit_power;
                
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Редактирование', `Кв: ${r.name}, Изменена работа: ${t.name}`);
            }
        } catch (e) { console.error(e); }
    });

    // --- Переупорядочивание Drag & Drop ---
    socket.on('reorder_item', async ({ type, buildingId, contractId, floorId, sourceIndex, destinationIndex, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (!b) return;

            let arr = null;

            if (type === 'contract') {
                b.contracts.sort((a,b) => (a.order || 0) - (b.order || 0));
                arr = b.contracts;
            } else if (type === 'floor') {
                const c = b.contracts.find(x => x.id === contractId);
                if (c) {
                    c.floors.sort((a,b) => (a.order || 0) - (b.order || 0));
                    arr = c.floors;
                }
            } else if (type === 'room') {
                const c = b.contracts.find(x => x.id === contractId);
                const f = c?.floors.find(x => x.id === floorId);
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

    // --- Копирование ---
    socket.on('copy_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;
            const c = b.contracts.find(x => x.id === ids.contractId);

            const copyTasks = (tasks) => tasks.map(t => ({
                id: genId(),
                name: t.name,
                groupId: t.groupId,
                volume: t.volume,
                unit: t.unit,
                unit_power: t.unit_power,
                work_done: false,
                doc_done: false,
                start_date: null,
                end_date: null,
                comments: [],
                materials: t.materials.map(m => ({...m, id: genId()})) // Копируем МТР
            }));

            if (type === 'floor') {
                if (c) {
                    const f = c.floors.find(x => x.id === ids.floorId);
                    if (f) {
                        const newRooms = f.rooms.map(r => ({
                            id: genId(),
                            name: r.name,
                            order: r.order,
                            tasks: copyTasks(r.tasks)
                        }));
                        
                        c.floors.push({
                            id: genId(),
                            name: `${f.name} (Копия)`,
                            order: c.floors.length,
                            rooms: newRooms
                        });
                        
                        await b.save();
                        await broadcastBuildings();
                        createLog(io, user.username, user.role, 'Копирование', `Скопирован этаж: ${f.name}`);
                    }
                }
            } else if (type === 'room') {
                if (c) {
                    const f = c.floors.find(x => x.id === ids.floorId);
                    if (f) {
                        const r = f.rooms.find(x => x.id === ids.roomId);
                        if (r) {
                            f.rooms.push({
                                id: genId(),
                                name: `${r.name} (Копия)`,
                                order: f.rooms.length,
                                tasks: copyTasks(r.tasks)
                            });
                            await b.save();
                            await broadcastBuildings();
                            createLog(io, user.username, user.role, 'Копирование', `Скопировано помещение: ${r.name}`);
                        }
                    }
                }
            }
        } catch (e) { console.error(e); }
    });

    socket.on('rename_item', async ({ type, ids, newName, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;
            let oldName = '';

            if (type === 'building') {
                oldName = b.name; b.name = newName;
            } else if (type === 'contract') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                if(c) { oldName = c.name; c.name = newName; }
            } else if (type === 'floor') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                if(f) { oldName = f.name; f.name = newName; }
            } else if (type === 'room') {
                const c = b.contracts.find(x => x.id === ids.contractId);
                const f = c?.floors.find(x => x.id === ids.floorId);
                const r = f?.rooms.find(x => x.id === ids.roomId);
                if(r) { oldName = r.name; r.name = newName; }
            } 
            await b.save();
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Переименование', `${type}: "${oldName}" -> "${newName}"`);
        } catch(e) { console.error(e); }
    });

    socket.on('delete_item', async ({ type, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            let details = '';
            if (type === 'building') {
                await Building.deleteOne({ id: ids.buildingId });
                details = `Удален объект (ID: ${ids.buildingId})`;
            } else {
                const b = await Building.findOne({ id: ids.buildingId });
                if (b) {
                    if (type === 'contract') {
                        b.contracts = b.contracts.filter(x => x.id !== ids.contractId);
                        details = `Удален договор в ${b.name}`;
                    } else if (type === 'floor') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        if(c) {
                            c.floors = c.floors.filter(x => x.id !== ids.floorId);
                            details = `Удален этаж в ${b.name} -> ${c.name}`;
                        }
                    } else if (type === 'room') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        const f = c?.floors.find(x => x.id === ids.floorId);
                        if(f) {
                            f.rooms = f.rooms.filter(x => x.id !== ids.roomId);
                            details = `Удалено помещение в ${f.name}`;
                        }
                    } else if (type === 'task') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        const f = c?.floors.find(x => x.id === ids.floorId);
                        const r = f?.rooms.find(x => x.id === ids.roomId);
                        if (r) {
                            r.tasks = r.tasks.filter(x => x.id !== ids.taskId);
                            details = `Удален СМР из ${r.name}`;
                        }
                    } else if (type === 'material') {
                        const c = b.contracts.find(x => x.id === ids.contractId);
                        const f = c?.floors.find(x => x.id === ids.floorId);
                        const r = f?.rooms.find(x => x.id === ids.roomId);
                        const t = r?.tasks.find(x => x.id === ids.taskId);
                        if (t) {
                            t.materials = t.materials.filter(x => x.id !== ids.materialId);
                            details = `Удален МТР из ${t.name}`;
                        }
                    }
                    await b.save();
                }
            }
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Удаление', details);
        } catch(e) { console.error(e); }
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
                
                const fieldName = field === 'work_done' ? 'ФАКТ (СМР)' : 'ИД (Документы)';
                const status = value ? 'Выполнено' : 'Отменено';
                createLog(io, user.username, user.role, 'Статус работ', `${r.name} -> ${task.name} -> ${fieldName}: ${status}`);
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
                
                const sDate = dates.start ? new Date(dates.start).toLocaleDateString('ru-RU') : '...';
                const eDate = dates.end ? new Date(dates.end).toLocaleDateString('ru-RU') : '...';
                createLog(io, user.username, user.role, 'Сроки', `Кв: ${r.name} -> ${t.name}, Период: ${sDate} - ${eDate}`);
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
                    id: genId(),
                    text,
                    author: `${user.surname} ${user.name}`,
                    role: user.role,
                    timestamp: new Date()
                });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Комментарий', `Кв: ${r.name} -> ${t.name}`);
            }
        } catch (e) { console.error(e); }
    });
};