import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Filter, ArrowLeft, PlusCircle, Pencil, Trash2, Download, PieChart, Copy, GripVertical, Move, X } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';

const ContractPage = ({ buildings, user, actions, setSelectedRoom, groups, sysActions }) => {
    const { buildingId, contractId } = useParams();
    const navigate = useNavigate();
    
    const building = buildings.find(b => b.id === buildingId);
    const contract = building?.contracts.find(c => c.id === contractId);
    const hasEditRights = ['admin', 'architect'].includes(user.role);

    // DnD & Filter State
    const [isReorderingMode, setIsReorderingMode] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null); 
    const [filterGroupId, setFilterGroupId] = useState('');

    const stats = useMemo(() => {
        if (!contract) return null;
        let total = 0, work = 0, doc = 0, vol = 0;
        contract.floors.forEach(f => f.rooms.forEach(r => r.tasks.forEach(t => {
            if (t.type === 'smr') { 
                total++;
                if(t.work_done) work++;
                if(t.doc_done) doc++;
                vol += (t.volume || 0);
            }
        })));
        return { total, work, doc, vol };
    }, [contract]);

    if (!contract) return <div className="content-area">Договор не найден</div>;

    // --- Actions ---
    const handleAddFloor = () => {
        sysActions.prompt("Новый этаж", "Название (например: 2 Этаж):", (name) => {
            actions.addFloor(building.id, contract.id, name);
        });
    };

    const handleAddRoom = (floorId) => {
        sysActions.prompt("Новое помещение", "Номер/Название:", (name) => {
            actions.addRoom(building.id, contract.id, floorId, name);
        });
    };

    const handleRenameFloor = (floorId, oldName) => {
        sysActions.prompt("Переименование", "Новое название этажа:", (newName) => {
            if(newName !== oldName) actions.renameItem('floor', {buildingId: building.id, contractId: contract.id, floorId}, newName);
        }, oldName);
    };

    const handleDeleteFloor = (floorId) => {
        sysActions.confirm("Удаление этажа", "Удалить этаж и все помещения?", () => {
            actions.deleteItem('floor', { buildingId: building.id, contractId: contract.id, floorId });
        });
    };

    const handleCopyFloor = (floorId) => {
        sysActions.confirm("Копирование", "Дублировать этаж?", () => {
            actions.copyItem('floor', { buildingId: building.id, contractId: contract.id, floorId });
        });
    };

    const handleCopyRoom = (floorId, roomId, e) => {
        e.stopPropagation();
        sysActions.confirm("Копирование", "Дублировать помещение?", () => {
            actions.copyItem('room', { buildingId: building.id, contractId: contract.id, floorId, roomId });
        });
    };

    // --- DnD ---
    const onDragStart = (e, type, item, index, parentId) => {
        if (!isReorderingMode) return;
        e.stopPropagation();
        setDraggedItem({ type, id: item.id, index, parentId });
        e.target.classList.add('dragging');
    };

    const onDragEnd = (e) => {
        e.target.classList.remove('dragging');
        setDraggedItem(null);
    };

    const onDrop = (e, type, targetIndex, targetParentId) => {
        if (!isReorderingMode || !draggedItem || draggedItem.type !== type) return;
        e.preventDefault(); e.stopPropagation();
        
        // Block dropping into wrong parent
        if (type === 'room' && targetParentId !== draggedItem.parentId) return;
        if (draggedItem.index === targetIndex) return;

        actions.reorderItem(type, building.id, contract.id, targetParentId, draggedItem.index, targetIndex);
        setDraggedItem(null);
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">{building.name}</div>
                    <div className="control-value">
                        <span style={{display:'flex', alignItems:'center', gap:10}}>
                            <FileText size={24} color="var(--accent-secondary)"/> {contract.name}
                        </span>
                    </div>
                </div>
                
                <div className="control-actions">
                     <div className="filter-dropdown-container">
                        <Filter size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                        <select className="filter-select" value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)}>
                            <option value="">Все работы</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            <option value="uncategorized">Без группы</option>
                        </select>
                        {filterGroupId && <button className="icon-btn-danger" onClick={() => setFilterGroupId('')}><X size={14}/></button>}
                    </div>

                    <button className="action-btn secondary" onClick={() => navigate(`/dashboard/${building.id}`)}>
                        <ArrowLeft size={16} /> Назад
                    </button>
                    
                    {hasEditRights && (
                        <>
                            <button className={`action-btn ${isReorderingMode ? 'primary' : 'secondary'}`} onClick={() => setIsReorderingMode(!isReorderingMode)}>
                                <Move size={18}/>
                            </button>
                            <button className="action-btn primary" onClick={handleAddFloor}>
                                <PlusCircle size={18}/> Добавить этаж
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div style={{padding: '0 32px', marginTop: 24, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 20}}>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                    <div style={{background:'var(--bg-active)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="var(--accent-primary)"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Всего СМР</div><div style={{fontSize:'1.2rem', fontWeight:700}}>{stats.total}</div></div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-green-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#166534"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Выполнено</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#166534'}}>{stats.work}</div></div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-orange-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#c2410c"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Сдано ИД</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#c2410c'}}>{stats.doc}</div></div>
                </div>
                 <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'#e0f2fe', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#0284c7"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Объем</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#0284c7'}}>{stats.vol.toFixed(1)}</div></div>
                </div>
            </div>

            <div className="content-area">
                <div className="floors-list">
                    {contract.floors.map((floor, floorIndex) => (
                        <div 
                            key={floor.id} 
                            className="floor-block"
                            draggable={isReorderingMode}
                            onDragStart={(e) => onDragStart(e, 'floor', floor, floorIndex, contract.id)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => { if(isReorderingMode) e.preventDefault(); }}
                            onDrop={(e) => onDrop(e, 'floor', floorIndex, contract.id)}
                            style={{ cursor: isReorderingMode ? 'grab' : 'default', borderStyle: isReorderingMode ? 'dashed' : 'solid' }}
                        >
                            <div className="floor-header">
                                <span className="floor-title">
                                    {isReorderingMode && <GripVertical size={20} style={{marginRight: 8}}/>}
                                    {floor.name}
                                    {hasEditRights && !isReorderingMode && <button className="icon-btn-edit" style={{marginLeft:10}} onClick={() => handleRenameFloor(floor.id, floor.name)}><Pencil size={14}/></button>}
                                </span>
                                {hasEditRights && !isReorderingMode && (
                                    <div className="floor-actions" style={{display:'flex', alignItems:'center', gap: 15}}>
                                        <button className="text-btn" onClick={() => handleAddRoom(floor.id)}>+ Помещение</button>
                                        <button className="icon-btn-edit" onClick={() => handleCopyFloor(floor.id)}><Copy size={16}/></button>
                                        <button className="icon-btn-danger" onClick={() => handleDeleteFloor(floor.id)}><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                            <div className="rooms-grid">
                                {floor.rooms.map((room, roomIndex) => {
                                    const statusClass = getRoomStatus(room, filterGroupId);
                                    let isHighlighted = false;
                                    if (filterGroupId) isHighlighted = room.tasks.some(t => (t.groupId || 'uncategorized') === filterGroupId);

                                    return (
                                        <div 
                                            key={room.id} 
                                            className={`room-item ${statusClass} ${isHighlighted ? 'filtered-highlight' : ''}`}
                                            onClick={() => setSelectedRoom({ buildingId: building.id, contractId: contract.id, floorId: floor.id, room })}
                                            draggable={isReorderingMode}
                                            onDragStart={(e) => onDragStart(e, 'room', room, roomIndex, floor.id)}
                                            onDragEnd={onDragEnd}
                                            onDragOver={(e) => { if(isReorderingMode) e.preventDefault(); }}
                                            onDrop={(e) => onDrop(e, 'room', roomIndex, floor.id)}
                                            style={{cursor: isReorderingMode ? 'grab' : 'pointer'}}
                                        >
                                            {hasEditRights && !isReorderingMode && (
                                                <div style={{position:'absolute', top:4, right:4, opacity:0.6}} onClick={(e) => handleCopyRoom(floor.id, room.id, e)}><Copy size={14}/></div>
                                            )}
                                            <div className="room-name">{room.name}</div>
                                            <div className="room-stats">
                                                {(() => {
                                                    const tasks = room.tasks.filter(t => t.type === 'smr');
                                                    const filtered = filterGroupId ? tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId) : tasks;
                                                    const done = filtered.filter(t => t.work_done && t.doc_done).length;
                                                    return `${done}/${filtered.length}`;
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                                {floor.rooms.length === 0 && <div style={{width:'100%', textAlign:'center', padding:10, color:'var(--text-muted)'}}>Пусто</div>}
                            </div>
                        </div>
                    ))}
                </div>
                {contract.floors.length === 0 && <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>Добавьте этажи</div>}
            </div>
        </>
    );
};

export default ContractPage;