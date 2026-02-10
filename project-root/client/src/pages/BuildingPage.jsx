import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Filter, ArrowLeft, PlusCircle, Pencil, Trash2, Download, PieChart, Copy, GripVertical, Move } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';

const BuildingPage = ({ buildings, user, actions, setSelectedRoom, filterGroupId, setFilterGroupId, groups, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);

    // Состояние режима перемещения (Drag and Drop)
    const [isReorderingMode, setIsReorderingMode] = useState(false);

    // DnD State
    const [draggedItem, setDraggedItem] = useState(null); // { type: 'floor' | 'room', id, index, parentId? }

    const stats = useMemo(() => {
        if (!building) return null;
        let total = 0, work = 0, doc = 0, vol = 0;
        building.floors.forEach(f => f.rooms.forEach(r => r.tasks.forEach(t => {
            total++;
            if(t.work_done) work++;
            if(t.doc_done) doc++;
            vol += (t.volume || 0);
        })));
        return { total, work, doc, vol };
    }, [building]);

    if (!building) {
        return (
            <div className="content-area" style={{display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--text-muted)'}}>
                {buildings.length === 0 ? "Загрузка данных..." : "Объект не найден"}
            </div>
        );
    }

    const handleAddFloor = () => {
        sysActions.prompt("Новый этаж", "Название этажа (например: 2 Этаж):", (name) => {
            actions.addFloor(building.id, name);
        });
    };

    const handleAddRoom = (floorId) => {
        sysActions.prompt("Новое помещение", "Номер квартиры или название:", (name) => {
            actions.addRoom(building.id, floorId, name);
        });
    }

    const handleRenameFloor = (floorId, oldName) => {
        sysActions.prompt("Переименование", "Новое название этажа:", (newName) => {
            if(newName !== oldName) actions.renameItem('floor', {buildingId: building.id, floorId}, newName);
        }, oldName);
    }
    
    const handleDeleteFloor = (floorId) => {
        sysActions.confirm("Удаление этажа", "Удалить этаж и все помещения в нем?", () => {
            actions.deleteItem('floor', { buildingId: building.id, floorId });
        });
    }

    const handleCopyFloor = (floorId) => {
        sysActions.confirm("Копирование", "Создать полную копию этажа со всеми квартирами и работами?", () => {
            actions.copyItem('floor', { buildingId: building.id, floorId });
        });
    };

    const handleCopyRoom = (floorId, roomId, e) => {
        e.stopPropagation();
        sysActions.confirm("Копирование", "Создать копию помещения?", () => {
            actions.copyItem('room', { buildingId: building.id, floorId, roomId });
        });
    };

    const handleDownloadReport = () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        window.open(`${apiUrl}/api/export/${building.id}?username=${user.username}&role=${user.role}`, '_blank');
    };

    // --- DnD Logic (Работает только если isReorderingMode === true) ---
    const onDragStart = (e, type, item, index, parentId = null) => {
        if (!isReorderingMode) return;
        e.stopPropagation();
        setDraggedItem({ type, id: item.id, index, parentId });
        e.target.classList.add('dragging');
    };

    const onDragEnd = (e) => {
        e.target.classList.remove('dragging');
        setDraggedItem(null);
    };

    const onDragOver = (e) => {
        if (!isReorderingMode) return;
        e.preventDefault(); // Разрешаем Drop
    };

    const onDrop = (e, type, targetIndex, targetParentId = null) => {
        if (!isReorderingMode) return;
        e.preventDefault();
        e.stopPropagation();

        if (!draggedItem) return;
        if (draggedItem.type !== type) return; 
        
        // Для комнат: разрешаем перенос только внутри одного этажа (по ТЗ: "между собой")
        if (type === 'room' && targetParentId !== draggedItem.parentId) return; 

        if (draggedItem.index === targetIndex) return;

        actions.reorderItem(type, building.id, targetParentId, draggedItem.index, targetIndex);
        setDraggedItem(null);
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Текущий раздел</div>
                    <div className="control-value">
                        <span style={{display:'flex', alignItems:'center', gap:10}}>
                            <Building2 size={24} color="var(--accent-primary)"/> {building.name}
                        </span>
                    </div>
                </div>
                
                <div className="control-actions">
                     <div className="filter-dropdown-container">
                        <Filter size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                        <select 
                            className="filter-select"
                            value={filterGroupId} 
                            onChange={e => setFilterGroupId(e.target.value)}
                        >
                            <option value="">Все работы (Общий статус)</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                            <option value="uncategorized">Без группы</option>
                        </select>
                    </div>

                    <button className="action-btn secondary" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={16} /> Назад
                    </button>
                    
                    <button className="action-btn secondary" onClick={handleDownloadReport} title="Скачать отчет в Excel">
                        <Download size={18} color="#10b981"/> Excel
                    </button>

                    {hasEditRights && (
                        <>
                             {/* Кнопка включения режима перемещения */}
                            <button 
                                className={`action-btn ${isReorderingMode ? 'primary' : 'secondary'}`} 
                                onClick={() => setIsReorderingMode(!isReorderingMode)}
                                title={isReorderingMode ? "Выключить перемещение" : "Включить режим перемещения (Drag&Drop)"}
                            >
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
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Всего работ</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700}}>{stats.total}</div>
                    </div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-green-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#166534"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Выполнено (СМР)</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#166534'}}>{stats.work} <span style={{fontSize:'0.8rem', opacity:0.7}}>/ {stats.total}</span></div>
                    </div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-orange-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#c2410c"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Сдано (Документы)</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#c2410c'}}>{stats.doc} <span style={{fontSize:'0.8rem', opacity:0.7}}>/ {stats.total}</span></div>
                    </div>
                </div>
                 <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'#e0f2fe', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#0284c7"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Общий объем</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#0284c7'}}>{stats.vol.toFixed(1)} <span style={{fontSize:'0.7rem', fontWeight:400}}>усл.ед.</span></div>
                    </div>
                </div>
            </div>

            <div className="content-area">
                <div className="floors-list">
                    {building.floors.map((floor, floorIndex) => (
                        <div 
                            key={floor.id} 
                            className="floor-block"
                            draggable={isReorderingMode}
                            onDragStart={(e) => onDragStart(e, 'floor', floor, floorIndex)}
                            onDragEnd={onDragEnd}
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, 'floor', floorIndex)}
                            style={{ cursor: isReorderingMode ? 'grab' : 'default', borderStyle: isReorderingMode ? 'dashed' : 'solid' }}
                        >
                            <div className="floor-header">
                                <span className="floor-title">
                                    {isReorderingMode && <GripVertical size={20} style={{cursor:'grab', color:'var(--accent-primary)', marginRight: 8}}/>}
                                    {floor.name}
                                    {hasEditRights && !isReorderingMode && (
                                        <button className="icon-btn-edit" style={{marginLeft:10}} onClick={() => handleRenameFloor(floor.id, floor.name)}>
                                            <Pencil size={14}/>
                                        </button>
                                    )}
                                </span>
                                {hasEditRights && !isReorderingMode && (
                                    <div className="floor-actions" style={{display:'flex', alignItems:'center', gap: 15}}>
                                        <button className="text-btn" onClick={() => handleAddRoom(floor.id)}>+ Квартира</button>
                                        <button className="icon-btn-edit" onClick={() => handleCopyFloor(floor.id)} title="Копировать этаж">
                                            <Copy size={16}/>
                                        </button>
                                        <button className="icon-btn-danger" onClick={() => handleDeleteFloor(floor.id)} title="Удалить этаж">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="rooms-grid">
                                {floor.rooms.map((room, roomIndex) => {
                                    const statusClass = getRoomStatus(room, filterGroupId);
                                    
                                    // Проверка наличия задач для обводки (белый контур)
                                    let hasFilteredTasks = false;
                                    if (filterGroupId && filterGroupId !== '') {
                                        hasFilteredTasks = room.tasks.some(t => {
                                            const tGroup = t.groupId || 'uncategorized';
                                            return tGroup === filterGroupId;
                                        });
                                    }

                                    return (
                                        <div 
                                            key={room.id} 
                                            className={`room-item ${statusClass} ${hasFilteredTasks ? 'filtered-highlight' : ''}`}
                                            onClick={() => !isReorderingMode && setSelectedRoom({ buildingId: building.id, floorId: floor.id, room })}
                                            draggable={isReorderingMode}
                                            onDragStart={(e) => onDragStart(e, 'room', room, roomIndex, floor.id)}
                                            onDragEnd={onDragEnd}
                                            onDragOver={onDragOver}
                                            onDrop={(e) => onDrop(e, 'room', roomIndex, floor.id)}
                                            style={{cursor: isReorderingMode ? 'grab' : 'pointer'}}
                                        >
                                            {/* Кнопка копирования квартиры (видна только редактору и не в режиме перемещения) */}
                                            {hasEditRights && !isReorderingMode && (
                                                <div 
                                                    style={{position:'absolute', top:4, right:4, opacity:0.6}}
                                                    onClick={(e) => handleCopyRoom(floor.id, room.id, e)}
                                                    title="Копировать квартиру"
                                                >
                                                    <Copy size={14}/>
                                                </div>
                                            )}
                                            
                                            <div className="room-name">{room.name}</div>
                                            <div className="room-stats">
                                                {(() => {
                                                    const tasks = filterGroupId 
                                                        ? room.tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId) 
                                                        : room.tasks;
                                                    const done = tasks.filter(t => t.work_done && t.doc_done).length;
                                                    return `${done}/${tasks.length}`;
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                                {floor.rooms.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.9rem', width:'100%', textAlign:'center', padding: 10}}>Нет помещений</div>}
                            </div>
                        </div>
                    ))}
                    {building.floors.length === 0 && <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>Добавьте этажи для этого дома</div>}
                </div>
            </div>
        </>
    );
};

export default BuildingPage;