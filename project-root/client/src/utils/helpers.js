// Логика статусов (Новая схема)
// Красный - работы не начаты (0%)
// Желтый - работы начаты частично
// Оранжевый - ИД или СМР полностью выполнена (одна из колонок 100%)
// Зеленый - ИД и СМР выполнены (обе колонки 100%)
// Серая - нету работ

export const getRoomStatus = (room, filterGroupId) => {
    let filteredTasks = room.tasks || [];
    
    // Фильтрация по группе
    if (filterGroupId && filterGroupId !== '') {
        filteredTasks = room.tasks.filter(t => {
            const tGroup = t.groupId || 'uncategorized';
            return tGroup === filterGroupId;
        });
    }

    // Серая: Нет работ
    if (filteredTasks.length === 0) return 'status-none';

    const totalTasks = filteredTasks.length;
    let smrDoneCount = 0;
    let docDoneCount = 0;
    let isStarted = false; // Начато ли хоть что-то

    filteredTasks.forEach(t => {
        if (t.work_done) smrDoneCount++;
        if (t.doc_done) docDoneCount++;
        
        // Если стоит хоть одна галочка (СМР или ИД), считаем работу начатой
        if (t.work_done || t.doc_done) {
            isStarted = true;
        }
    });

    // 1. Зеленый: И СМР, И ИД выполнены полностью (100% / 100%)
    if (smrDoneCount === totalTasks && docDoneCount === totalTasks) {
        return 'status-green';
    }

    // 2. Оранжевый: Либо СМР полностью (100%), Либо ИД полностью (100%)
    // (Попадает сюда только если не сработало условие Зеленого)
    if (smrDoneCount === totalTasks || docDoneCount === totalTasks) {
        return 'status-orange';
    }

    // 3. Желтый: Работы начаты частично (есть прогресс, но нет полных столбцов)
    if (isStarted) {
        return 'status-yellow';
    }

    // 4. Красный: Работы не начаты (0%)
    return 'status-red';
};

// --- ФУНКЦИИ УВЕДОМЛЕНИЙ (КРАСНЫЕ ТОЧКИ) ---

// Проверка одной задачи: есть ли новые комменты
export const hasUnreadInTask = (task) => {
    if (!task.comments || task.comments.length === 0) return false;
    const lastRead = localStorage.getItem(`read_comments_${task.id}`);
    
    // Если никогда не открывали, но комменты есть -> true
    if (!lastRead) return true;
    
    // Сравниваем даты
    const lastCommentDate = new Date(task.comments[task.comments.length - 1].timestamp);
    const lastReadDate = new Date(lastRead);
    return lastCommentDate > lastReadDate;
};

// Проверка помещения (рекурсивно по задачам)
export const hasUnreadInRoom = (room) => {
    if (!room.tasks) return false;
    return room.tasks.some(task => hasUnreadInTask(task));
};

// Проверка договора (по всем этажам и помещениям)
export const hasUnreadInContract = (contract) => {
    if (!contract.floors) return false;
    return contract.floors.some(floor => 
        floor.rooms && floor.rooms.some(room => hasUnreadInRoom(room))
    );
};

// Проверка объекта (по всем договорам)
export const hasUnreadInBuilding = (building) => {
    if (!building.contracts) return false;
    return building.contracts.some(contract => hasUnreadInContract(contract));
};

// Проверка непросмотренных изменений (техническая, для обновления списка)
export const checkUnseenChanges = (room) => {
    if (!room || !room.tasks) return false;
    const lastViewed = localStorage.getItem(`viewed_room_${room.id}`);
    if (!lastViewed) return false; 
    return room.tasks.some(t => new Date(t.updatedAt) > new Date(lastViewed));
};