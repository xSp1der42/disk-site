// Логика статусов (Req 7: Не готово -> В работе -> Выполнено)
export const getRoomStatus = (room, filterGroupId) => {
    let filteredTasks = room.tasks || [];
    if (filterGroupId && filterGroupId !== '') {
        filteredTasks = room.tasks.filter(t => {
            const tGroup = t.groupId || 'uncategorized';
            return tGroup === filterGroupId;
        });
    }

    if (filteredTasks.length === 0) return 'status-none';

    let allDone = true;
    let anyStarted = false;

    filteredTasks.forEach(t => {
        // Статус "Выполнено" требует галочки ИД (подтверждено)
        // Если галочки ИД нет, значит работа не закрыта полностью
        if (!t.doc_done) allDone = false;
        
        // Статус "В работе" (Начато) - есть галочка СМР или есть материалы
        if (t.work_done || t.doc_done || (t.materials && t.materials.length > 0)) {
            anyStarted = true;
        }
    });

    if (allDone) return 'status-green'; // Выполнено
    if (anyStarted) return 'status-yellow'; // В работе
    return 'status-red'; // Не готово
};

// Проверка на непросмотренные изменения (Req 9)
export const checkUnseenChanges = (room) => {
    if (!room || !room.tasks) return false;
    const lastViewed = localStorage.getItem(`viewed_room_${room.id}`);
    if (!lastViewed) return false; // Если никогда не открывали, не спамим (или true, по желанию)

    // Если есть задача, обновленная ПОЗЖЕ, чем мы смотрели комнату
    return room.tasks.some(t => new Date(t.updatedAt) > new Date(lastViewed));
};

// Проверка на непрочитанные сообщения
export const checkUnreadMessages = (room) => {
    if (!room || !room.tasks) return false;
    return room.tasks.some(t => {
        const lastRead = localStorage.getItem(`read_comments_${t.id}`);
        if (!t.comments || t.comments.length === 0) return false;
        if (!lastRead) return true;
        return new Date(t.comments[t.comments.length - 1].timestamp) > new Date(lastRead);
    });
};