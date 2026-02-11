// Логика статусов (По требованию: "галочек нет" -> красный, "в процессе" -> желтый, "все ок" -> зеленый)
export const getRoomStatus = (room, filterGroupId) => {
    let filteredTasks = room.tasks || [];
    
    // Фильтрация по группе
    if (filterGroupId && filterGroupId !== '') {
        filteredTasks = room.tasks.filter(t => {
            const tGroup = t.groupId || 'uncategorized';
            return tGroup === filterGroupId;
        });
    }

    if (filteredTasks.length === 0) return 'status-none';

    let isFullyCompleted = true; // Считаем, что все ок
    let isStarted = false;       // Начато ли?

    filteredTasks.forEach(t => {
        // Условие полного выполнения: И СМР (work_done), И ИД (doc_done) должны быть true
        if (!t.work_done || !t.doc_done) {
            isFullyCompleted = false;
        }

        // Условие "В работе": Хоть одна галочка стоит ИЛИ добавлены материалы
        if (t.work_done || t.doc_done || (t.materials && t.materials.length > 0)) {
            isStarted = true;
        }
    });

    // 1. Зеленый: ВСЁ (2/2) по всем задачам готово
    if (isFullyCompleted) return 'status-green';

    // 2. Желтый: Что-то начато, но не закончено полностью
    if (isStarted) return 'status-yellow';

    // 3. Красный: Ничего не тронуто
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