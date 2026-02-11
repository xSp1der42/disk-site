import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, PlusCircle, Pencil, Trash2, GripVertical, Move, Copy } from 'lucide-react';

const ContractPage = ({ buildings, user, actions, setSelectedRoom, sysActions }) => {
    const { id, contractId } = useParams();
    const navigate = useNavigate();
    
    const building = buildings.find(b => b.id === id);
    const contract = building?.contracts.find(c => c.id === contractId);

    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [isReorderingMode, setIsReorderingMode] = useState(false);

    if (!building || !contract) return <div className="content-area">Договор не найден</div>;

    // --- Actions ---
    const handleAddFloor = () => sysActions.prompt("Новый этаж", "Название:", (name) => actions.addFloor(building.id, contract.id, name));
    const handleAddRoom = (floorId) => sysActions.prompt("Новое помещение", "Название:", (name) => actions.addRoom(building.id, contract.id, floorId, name));
    const handleDelete = (type, ids) => sysActions.confirm("Удаление", "Удалить?", () => actions.deleteItem(type, ids));
    const handleRename = (type, ids, oldName) => sysActions.prompt("Переименование", "Новое название:", (n) => { if(n&&n!==oldName) actions.renameItem(type, ids, n); }, oldName);
    const handleCopyFloor = (floorId) => sysActions.confirm("Копирование этажа", "Создать копию этажа?", () => actions.copyItem('floor', { buildingId: building.id, contractId: contract.id, floorId }));
    const handleCopyRoom = (e, floorId, roomId) => {
        e.stopPropagation();
        sysActions.confirm("Копирование помещения", "Создать копию помещения?", () => actions.copyItem('room', { buildingId: building.id, contractId: contract.id, floorId, roomId }));
    };

    const getRoomStatusColor = (room) => {
        if (!room.tasks || room.tasks.length === 0) return 'var(--bg-body)';
        if (room.tasks.every(t => t.work_done && t.doc_done)) return 'var(--status-green-bg)';
        if (room.tasks.some(t => t.work_done || t.doc_done)) return 'var(--status-orange-bg)';
        return 'var(--status-red-bg)';
    };

    // --- DnD Handlers (ИСПРАВЛЕНО) ---
    const [draggedItem, setDraggedItem] = useState(null);
    
    const onDragStart = (e, type, index, parentId = null) => {
        if (!isReorderingMode) return;
        setDraggedItem({ type, index, parentId });
        e.currentTarget.classList.add('dragging');
    };
    
    const onDragEnd = (e) => {
        if (!isReorderingMode) return;
        e.currentTarget.classList.remove('dragging');
        setDraggedItem(null);
    };

    const onDrop = (e, type, targetIndex, targetParentId = null) => {
        if (!isReorderingMode || !draggedItem) return;
        e.preventDefault();
        
        if (draggedItem.type !== type) return;
        if (type === 'room' && draggedItem.parentId !== targetParentId) return;
        if (draggedItem.index === targetIndex) return;

        actions.reorderItem(type, {
            buildingId: building.id, 
            contractId: contract.id, 
            floorId: targetParentId
        }, draggedItem.index, targetIndex);
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label" style={{cursor:'pointer'}} onClick={()=>navigate(`/dashboard/${id}`)}>{building.name} /</div>
                    <div className="control-value"><FileText size={24}/> {contract.name}</div>
                </div>
                <div className="control-actions">
                    <button className="action-btn secondary" onClick={() => navigate(`/dashboard/${building.id}`)}><ArrowLeft size={16}/> К договорам</button>
                    {hasEditRights && <>
                        <button className={`action-btn ${isReorderingMode?'primary':'secondary'}`} onClick={() => setIsReorderingMode(!isReorderingMode)}><Move size={16}/> {isReorderingMode ? 'Готово' : 'Порядок'}</button>
                        <button className="action-btn primary" onClick={handleAddFloor}><PlusCircle size={16}/> Этаж</button>
                    </>}
                </div>
            </div>

            <div className="content-area">
                <div className="floors-list">
                    {contract.floors.map((floor, fIdx) => (
                        <div key={floor.id} className="floor-block"
                            draggable={isReorderingMode}
                            onDragStart={(e) => onDragStart(e, 'floor', fIdx, contract.id)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, 'floor', fIdx, contract.id)}
                        >
                            <div className="floor-header">
                                <span className="floor-title">
                                    {isReorderingMode && <GripVertical size={20} style={{cursor:'grab'}}/>}
                                    {floor.name}
                                </span>
                                {hasEditRights && !isReorderingMode && (
                                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                                        <button className="text-btn" onClick={() => handleAddRoom(floor.id)}>+ Помещение</button>
                                        <button className="icon-btn-edit" onClick={() => handleCopyFloor(floor.id)} title="Копировать этаж"><Copy size={16}/></button>
                                        <button className="icon-btn-edit" onClick={()=>handleRename('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id}, floor.name)}><Pencil size={16}/></button>
                                        <button className="icon-btn-danger" onClick={()=>handleDelete('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id})}><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="rooms-grid" onDragOver={(e) => e.preventDefault()}>
                                {floor.rooms.map((room, rIdx) => (
                                    <div key={room.id} className="room-item" 
                                        style={{background: getRoomStatusColor(room)}}
                                        onClick={() => !isReorderingMode && setSelectedRoom({ buildingId: building.id, contractId: contract.id, floorId: floor.id, room })}
                                        draggable={isReorderingMode}
                                        onDragStart={(e) => onDragStart(e, 'room', rIdx, floor.id)}
                                        onDragEnd={onDragEnd}
                                        onDrop={(e) => { e.stopPropagation(); onDrop(e, 'room', rIdx, floor.id); }}
                                    >
                                        {hasEditRights && !isReorderingMode && (
                                            <div style={{position:'absolute', top:4, right:4, opacity:0.6}} onClick={(e) => handleCopyRoom(e, floor.id, room.id)} title="Копировать помещение">
                                                <Copy size={14}/>
                                            </div>
                                        )}
                                        <div className="room-name">{room.name}</div>
                                        <div className="room-stats">Позиций: {room.tasks.length}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ContractPage;