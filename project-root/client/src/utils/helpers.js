// Логика статусов (Req 7 + Исправление бага "сразу зеленый")
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

    let isFullyCompleted = true; // Предполагаем, что все готово
    let isStarted = false;       // Начато ли что-то?

    filteredTasks.forEach(t => {
        // Условие полного выполнения: И СМР (work_done), И ИД (doc_done) должны быть true
        if (!t.work_done || !t.doc_done) {
            isFullyCompleted = false;
        }

        // Условие "В работе": Хоть одна галочка или добавлены материалы
        if (t.work_done || t.doc_done || (t.materials && t.materials.length > 0)) {
            isStarted = true;
        }
    });

    // 1. Если ВСЁ (2/2) по всем задачам готово -> Зеленый
    if (isFullyCompleted) return 'status-green';

    // 2. Если что-то начато (1/2 или материалы), но не закончено -> Желтый
    if (isStarted) return 'status-yellow';

    // 3. Иначе -> Красный
    return 'status-red';
};

// Проверка на непросмотренные изменения (Для уведомлений об обновлении задачи)
export const checkUnseenChanges = (room) => {
    if (!room || !room.tasks) return false;
    const lastViewed = localStorage.getItem(`viewed_room_${room.id}`);
    if (!lastViewed) return false; 

    return room.tasks.some(t => new Date(t.updatedAt) > new Date(lastViewed));
};

// Проверка на непрочитанные сообщения (Для красных огоньков)
export const checkUnreadMessages = (room) => {
    if (!room || !room.tasks) return false;
    return room.tasks.some(t => {
        // Проверяем комментарии
        if (!t.comments || t.comments.length === 0) return false;
        
        const lastRead = localStorage.getItem(`read_comments_${t.id}`);
        // Если никогда не читали, а комменты есть -> true
        if (!lastRead) return true;
        
        // Если последний коммент новее, чем дата прочтения -> true
        const lastCommentDate = new Date(t.comments[t.comments.length - 1].timestamp);
        const lastReadDate = new Date(lastRead);
        
        return lastCommentDate > lastReadDate;
    });
};