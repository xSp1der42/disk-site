import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, FileText, ArrowLeft, PlusCircle, Pencil, Trash2, GripVertical, Move } from 'lucide-react';

const ContractPage = ({ buildings, user, actions, setSelectedRoom, sysActions }) => {
    const { id, contractId } = useParams();
    const navigate = useNavigate();
    
    const building = buildings.find(b => b.id === id);
    const contract = building?.contracts.find(c => c.id === contractId);

    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [isReorderingMode, setIsReorderingMode] = useState(false);

    if (!building || !contract) return <div className="content-area">Договор не найден</div>;

    // --- Actions ---
    const handleAddFloor = () => {
        sysActions.prompt("Новый этаж", "Название этажа:", (name) => {
            actions.addFloor(building.id, contract.id, name);
        });
    };

    const handleAddRoom = (floorId) => {
        sysActions.prompt("Новое помещение", "Название/Номер:", (name) => {
            actions.addRoom(building.id, contract.id, floorId, name);
        });
    };

    const handleDelete = (type, ids) => {
        sysActions.confirm("Удаление", "Удалить?", () => actions.deleteItem(type, ids));
    };
    
    const handleRename = (type, ids, oldName) => {
        sysActions.prompt("Переименование", "Новое название:", (n) => {
            if(n!==oldName) actions.renameItem(type, ids, n);
        }, oldName);
    };

    // --- Status Color Logic ---
    const getRoomStatusColor = (room) => {
        if (!room.tasks || room.tasks.length === 0) return 'var(--bg-body)';
        const allDone = room.tasks.every(t => t.work_done && t.doc_done);
        if (allDone) return 'var(--status-green-bg)';
        const anyProgress = room.tasks.some(t => t.work_done || t.doc_done);
        return anyProgress ? 'var(--status-orange-bg)' : 'var(--status-red-bg)';
    };

    // --- DnD Handlers ---
    const onDragStart = (e, type, index, parentId = null) => {
        if (!isReorderingMode) return;
        e.dataTransfer.setData('type', type);
        e.dataTransfer.setData('index', index);
        if (parentId) e.dataTransfer.setData('parentId', parentId);
        e.target.style.opacity = '0.4';
    };

    const onDrop = (e, type, targetIndex, targetParentId = null) => {
        e.preventDefault();
        e.target.style.opacity = '1';
        if (!isReorderingMode) return;
        
        const srcType = e.dataTransfer.getData('type');
        const srcIndex = parseInt(e.dataTransfer.getData('index'));
        const srcParentId = e.dataTransfer.getData('parentId');

        if (srcType !== type) return;
        if (type === 'room' && srcParentId !== targetParentId) return; // Only reorder within same floor for simplicity
        if (srcIndex === targetIndex) return;

        actions.reorderItem(type, {
            buildingId: building.id, 
            contractId: contract.id, 
            floorId: targetParentId
        }, srcIndex, targetIndex);
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">
                        <span style={{opacity:0.6}}>{building.name} /</span> Договор
                    </div>
                    <div className="control-value">
                        <FileText size={24} style={{verticalAlign:'middle', marginRight:10, color:'var(--accent-secondary)'}}/> 
                        {contract.name}
                    </div>
                </div>
                <div className="control-actions">
                    <button className="action-btn secondary" onClick={() => navigate(`/dashboard/${building.id}`)}>
                        <ArrowLeft size={16}/> Назад к договорам
                    </button>
                    {hasEditRights && (
                        <>
                            <button className={`action-btn ${isReorderingMode?'primary':'secondary'}`} onClick={() => setIsReorderingMode(!isReorderingMode)}>
                                <Move size={16}/> {isReorderingMode ? 'Готово' : 'Порядок'}
                            </button>
                            <button className="action-btn primary" onClick={handleAddFloor}>
                                <PlusCircle size={16}/> Этаж
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="content-area">
                <div className="floors-list">
                    {contract.floors.length === 0 && (
                        <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>
                            Нет этажей. Добавьте первый этаж.
                        </div>
                    )}
                    
                    {contract.floors.map((floor, fIdx) => (
                        <div 
                            key={floor.id} 
                            style={{marginBottom: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow:'hidden'}}
                            draggable={isReorderingMode}
                            onDragStart={(e) => onDragStart(e, 'floor', fIdx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, 'floor', fIdx)}
                        >
                            <div style={{padding: '12px 24px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span style={{fontWeight: 700, display:'flex', alignItems:'center', gap: 8, fontSize:'1.05rem'}}>
                                    {isReorderingMode && <GripVertical size={20} style={{cursor:'grab', color:'var(--text-muted)'}}/>}
                                    {floor.name}
                                </span>
                                {hasEditRights && !isReorderingMode && (
                                    <div style={{display:'flex', gap:6}}>
                                        <button className="text-btn" onClick={() => handleAddRoom(floor.id)}>+ Помещение</button>
                                        <button className="icon-btn-edit" onClick={()=>handleRename('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id}, floor.name)}><Pencil size={16}/></button>
                                        <button className="icon-btn-danger" onClick={()=>handleDelete('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id})}><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="rooms-grid" style={{padding: 20}}>
                                {floor.rooms.map((room, rIdx) => (
                                    <div 
                                        key={room.id} 
                                        className="room-item" 
                                        style={{background: getRoomStatusColor(room), borderColor: isReorderingMode ? 'transparent' : 'var(--border-color)'}}
                                        onClick={() => !isReorderingMode && setSelectedRoom({ buildingId: building.id, contractId: contract.id, floorId: floor.id, room })}
                                        draggable={isReorderingMode}
                                        onDragStart={(e) => { e.stopPropagation(); onDragStart(e, 'room', rIdx, floor.id); }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.stopPropagation(); onDrop(e, 'room', rIdx, floor.id); }}
                                    >
                                        <div className="room-name">{room.name}</div>
                                        <div className="room-stats" style={{fontSize:'0.7rem'}}>
                                            Позиций: {room.tasks.length}
                                        </div>
                                    </div>
                                ))}
                                {floor.rooms.length === 0 && <div style={{width:'100%', fontSize:'0.9rem', color:'var(--text-muted)', textAlign:'center', padding:10}}>Нет помещений</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ContractPage;