export const getRoomStatus = (room, filterGroupId) => {
    if (!room.tasks || room.tasks.length === 0) return 'status-none';
    
    let filteredTasks = room.tasks;
    if (filterGroupId) {
        filteredTasks = room.tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId);
        if (filteredTasks.length === 0) return 'status-none';
    }

    let allDone = true, allEmpty = true;
    filteredTasks.forEach(t => {
        if (!t.work_done || !t.doc_done) allDone = false;
        if (t.work_done || t.doc_done) allEmpty = false;
    });
    
    if (allEmpty) return 'status-red';
    if (allDone) return 'status-green';
    return 'status-yellow';
};