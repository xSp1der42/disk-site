// Логика статусов (Новые цвета по ТЗ)
export const getRoomStatus = (room, filterGroupId) => {
    if (!room.tasks || room.tasks.length === 0) return 'status-none';
    
    let filteredTasks = room.tasks;
    if (filterGroupId) {
        filteredTasks = room.tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId);
        if (filteredTasks.length === 0) return 'status-none';
    }

    let allWorkDone = true;
    let allDocDone = true;
    let anyWorkDone = false;
    let anyDocDone = false;
    let allEmpty = true;

    filteredTasks.forEach(t => {
        if (!t.work_done) allWorkDone = false;
        else anyWorkDone = true;

        if (!t.doc_done) allDocDone = false;
        else anyDocDone = true;

        if (t.work_done || t.doc_done) allEmpty = false;
    });
    
    // Красный / Серый (Не начато)
    if (allEmpty) return 'status-red';
    
    // Зеленый (Всё готово: и стройка, и документы)
    if (allWorkDone && allDocDone) return 'status-green';

    // Оранжевый (Одна из частей ПОЛНОСТЬЮ готова, но не обе)
    // Например: СМР готово на 100%, а документы нет. Или наоборот.
    if (allWorkDone || allDocDone) return 'status-orange';

    // Желтый (Работы начаты, но ничего полностью не завершено)
    return 'status-yellow';
};