// Логика статусов (Новые цвета по ТЗ)
export const getRoomStatus = (room, filterGroupId) => {
    // 1. Получаем список задач (с учетом фильтра)
    let filteredTasks = room.tasks || [];
    if (filterGroupId && filterGroupId !== '') {
        filteredTasks = room.tasks.filter(t => {
            const tGroup = t.groupId || 'uncategorized';
            return tGroup === filterGroupId;
        });
    }

    if (filteredTasks.length === 0) return 'status-none'; // Пусто (серый)

    let allWorkDone = true;
    let allDocDone = true;
    let hasAnyProgress = false; // Хотя бы одна галочка (СМР или ИД)
    let hasAllWork = true;      // Все СМР готовы
    let hasAllDoc = true;       // Все ИД готовы

    filteredTasks.forEach(t => {
        if (t.work_done) hasAnyProgress = true;
        else hasAllWork = false;

        if (t.doc_done) hasAnyProgress = true;
        else hasAllDoc = false;

        // Для полного зеленого нужно чтобы И то, И другое было готово у всех задач
        if (!t.work_done) allWorkDone = false;
        if (!t.doc_done) allDocDone = false;
    });

    // Зеленый: Всё готово (и стройка, и документы)
    if (allWorkDone && allDocDone) return 'status-green';

    // Оранжевый: Либо стройка вся готова, Либо документы все готовы (но не вместе)
    if (hasAllWork || hasAllDoc) return 'status-orange';

    // Желтый: Работа началась (есть хоть одна галочка), но разделы целиком не закрыты
    if (hasAnyProgress) return 'status-yellow';

    // Красный: Ничего не начато
    return 'status-red';
};