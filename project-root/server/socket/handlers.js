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

    // --- Структура ---
    socket.on('create_building', async ({ name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const count = await Building.countDocuments();
            const newBuilding = new Building({ id: genId(), name: name, order: count + 1, floors: [] });
            await newBuilding.save();
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Структура', `Создан дом: "${name}"`);
        } catch(e) { console.error(e); }
    });

    socket.on('add_floor', async ({ buildingId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            if (b) {
                b.floors.push({ id: genId(), name: name, rooms: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Дом: ${b.name}, Добавлен этаж: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('add_room', async ({ buildingId, floorId, name, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
            if (f) {
                f.rooms.push({ id: genId(), name: name, tasks: [] });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Структура', `Дом: ${b.name}, Этаж: ${f.name}, Пом: ${name}`);
            }
        } catch(e) { console.error(e); }
    });

    // ОБНОВЛЕНО: Принимаем unit и unit_power
    socket.on('add_task', async ({ buildingId, floorId, roomId, taskName, groupId, volume, unit, unit_power, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            if (r) {
                r.tasks.push({ 
                    id: genId(), 
                    name: taskName, 
                    groupId: groupId || null,
                    volume: parseFloat(volume) || 0,
                    unit: unit || 'шт',
                    unit_power: unit_power || '', // Сохраняем степень
                    work_done: false, 
                    doc_done: false,
                    start_date: null,
                    end_date: null,
                    comments: []
                });
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Работы', `Кв: ${r.name}, Добавлена работа: ${taskName}`);
            }
        } catch(e) { console.error(e); }
    });

    // ОБНОВЛЕНО: Редактируем unit и unit_power
    socket.on('edit_task', async ({ buildingId, floorId, roomId, taskId, data, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
            const r = f?.rooms.find(x => x.id === roomId);
            const t = r?.tasks.find(x => x.id === taskId);
            
            if (t) {
                if (data.name) t.name = data.name;
                if (data.groupId !== undefined) t.groupId = data.groupId;
                if (data.volume !== undefined) t.volume = parseFloat(data.volume);
                if (data.unit !== undefined) t.unit = data.unit;
                if (data.unit_power !== undefined) t.unit_power = data.unit_power;
                
                await b.save();
                await broadcastBuildings();
                createLog(io, user.username, user.role, 'Редактирование', `Кв: ${r.name}, Изменена работа: ${t.name}`);
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
            } else if (type === 'floor') {
                const f = b.floors.find(x => x.id === ids.floorId);
                if(f) { oldName = f.name; f.name = newName; }
            } else if (type === 'room') {
                const f = b.floors.find(x => x.id === ids.floorId);
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
                details = `Удален дом (ID: ${ids.buildingId})`;
            } else {
                const b = await Building.findOne({ id: ids.buildingId });
                if (b) {
                    if (type === 'floor') {
                        b.floors = b.floors.filter(x => x.id !== ids.floorId);
                        details = `Удален этаж в ${b.name}`;
                    } else if (type === 'room') {
                        const f = b.floors.find(x => x.id === ids.floorId);
                        if(f) {
                            f.rooms = f.rooms.filter(x => x.id !== ids.roomId);
                            details = `Удалено помещение в ${b.name}`;
                        }
                    } else if (type === 'task') {
                        const f = b.floors.find(x => x.id === ids.floorId);
                        const r = f?.rooms.find(x => x.id === ids.roomId);
                        if (r) {
                            r.tasks = r.tasks.filter(x => x.id !== ids.taskId);
                            details = `Удалена работа из ${r.name}`;
                        }
                    }
                    await b.save();
                }
            }
            await broadcastBuildings();
            createLog(io, user.username, user.role, 'Удаление', details);
        } catch(e) { console.error(e); }
    });

    socket.on('move_item', async ({ type, direction, ids, user }) => {
        if (!user || !canEditStructure(user.role)) return;
        try {
            if (type === 'building') {
                let buildings = await Building.find().sort({ order: 1 });
                const idx = buildings.findIndex(b => b.id === ids.buildingId);
                
                if (idx === -1) return;

                if (direction === 'up' && idx > 0) {
                    const temp = buildings[idx].order;
                    buildings[idx].order = buildings[idx - 1].order;
                    buildings[idx - 1].order = temp;
                    
                    if(buildings[idx].order === buildings[idx - 1].order) {
                        buildings[idx - 1].order = idx; 
                        buildings[idx].order = idx + 1;
                    }

                    await buildings[idx].save();
                    await buildings[idx - 1].save();

                } else if (direction === 'down' && idx < buildings.length - 1) {
                    const temp = buildings[idx].order;
                    buildings[idx].order = buildings[idx + 1].order;
                    buildings[idx + 1].order = temp;

                    if(buildings[idx].order === buildings[idx + 1].order) {
                        buildings[idx].order = idx + 1;
                        buildings[idx + 1].order = idx;
                    }

                    await buildings[idx].save();
                    await buildings[idx + 1].save();
                }
                await broadcastBuildings();
                return; 
            }

            const b = await Building.findOne({ id: ids.buildingId });
            if (!b) return;

            const swap = (arr, i1, i2) => { [arr[i1], arr[i2]] = [arr[i2], arr[i1]]; };

            if (type === 'floor') {
                const idx = b.floors.findIndex(f => f.id === ids.floorId);
                if (idx === -1) return;
                if (direction === 'up' && idx > 0) swap(b.floors, idx, idx - 1);
                else if (direction === 'down' && idx < b.floors.length - 1) swap(b.floors, idx, idx + 1);
            }
            
            await b.save();
            await broadcastBuildings();
        } catch(e) { console.error(e); }
    });

    socket.on('toggle_task_status', async ({ buildingId, floorId, roomId, taskId, field, value, user }) => {
        if (!user || ['director', 'architect'].includes(user.role)) return;
        if (field === 'work_done' && !['prorab', 'admin'].includes(user.role)) return;
        if (field === 'doc_done' && !['pto', 'admin'].includes(user.role)) return;

        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
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

    socket.on('update_task_dates', async ({ buildingId, floorId, roomId, taskId, dates, user }) => {
        if (!user || !['admin', 'architect'].includes(user.role)) return;

        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
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

    socket.on('add_task_comment', async ({ buildingId, floorId, roomId, taskId, text, user }) => {
        if (!user) return;
        try {
            const b = await Building.findOne({ id: buildingId });
            const f = b?.floors.find(x => x.id === floorId);
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
                createLog(io, user.username, user.role, 'Комментарий', `Кв: ${r.name} -> ${t.name}, Сообщение: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
            }
        } catch (e) { console.error(e); }
    });
};