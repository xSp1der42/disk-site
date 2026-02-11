import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Filter, ArrowLeft, PlusCircle, Pencil, Trash2, Download, PieChart, Copy, GripVertical, Move, FileText, ChevronRight } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';

const BuildingPage = ({ buildings, user, actions, setSelectedRoom, filterGroupId, setFilterGroupId, groups, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);

    // Локальное состояние: выбранный договор (для отображения этажей)
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [isReorderingMode, setIsReorderingMode] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    const activeDoc = building?.documents.find(d => d.id === selectedDocId);

    // Статистика объекта
    const stats = useMemo(() => {
        if (!building) return null;
        let total = 0, work = 0, doc = 0, vol = 0;
        (building.documents || []).forEach(d => {
            (d.floors || []).forEach(f => f.rooms.forEach(r => r.tasks.forEach(t => {
                total++;
                if(t.work_done) work++;
                if(t.doc_done) doc++;
                vol += (t.volume || 0);
            })));
        });
        return { total, work, doc, vol };
    }, [building]);

    if (!building) return <div className="content-area" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>Объект не найден</div>;

    // --- Actions for Documents ---
    const handleAddDocument = () => {
        sysActions.prompt("Новый договор", "Название (напр. Договор №1, Этап 1):", (name) => {
            actions.createDocument(building.id, name);
        });
    };
    const handleRenameDocument = (docId, oldName, e) => {
        e.stopPropagation();
        sysActions.prompt("Переименование", "Новое название договора:", (newName) => {
            if(newName !== oldName) actions.renameItem('document', {buildingId: building.id, documentId: docId}, newName);
        }, oldName);
    };
    const handleDeleteDocument = (docId, e) => {
        e.stopPropagation();
        sysActions.confirm("Удаление договора", "Удалить договор и все этажи внутри?", () => {
            actions.deleteItem('document', { buildingId: building.id, documentId: docId });
            if(selectedDocId === docId) setSelectedDocId(null);
        });
    };

    // --- Actions for Floors (Inside a Document) ---
    const handleAddFloor = () => {
        sysActions.prompt("Новый этаж", "Название этажа:", (name) => {
            actions.addFloor(building.id, selectedDocId, name);
        });
    };
    const handleRenameFloor = (floorId, oldName) => {
        sysActions.prompt("Переименование", "Новое название этажа:", (newName) => {
            if(newName !== oldName) actions.renameItem('floor', {buildingId: building.id, documentId: selectedDocId, floorId}, newName);
        }, oldName);
    };
    const handleDeleteFloor = (floorId) => {
        sysActions.confirm("Удаление этажа", "Удалить этаж и помещения?", () => {
            actions.deleteItem('floor', { buildingId: building.id, documentId: selectedDocId, floorId });
        });
    };
    const handleCopyFloor = (floorId) => {
        sysActions.confirm("Копирование", "Создать копию этажа?", () => {
            actions.copyItem('floor', { buildingId: building.id, documentId: selectedDocId, floorId });
        });
    };

    // --- Actions for Rooms ---
    const handleAddRoom = (floorId) => {
        sysActions.prompt("Новое помещение", "Название:", (name) => {
            actions.addRoom(building.id, selectedDocId, floorId, name);
        });
    };
    const handleCopyRoom = (floorId, roomId, e) => {
        e.stopPropagation();
        sysActions.confirm("Копирование", "Создать копию помещения?", () => {
            actions.copyItem('room', { buildingId: building.id, documentId: selectedDocId, floorId, roomId });
        });
    };

    // --- DnD Handlers ---
    const onDragStart = (e, type, item, index, parentId = null) => {
        if (!isReorderingMode) return;
        e.stopPropagation();
        setDraggedItem({ type, id: item.id, index, parentId });
        e.target.classList.add('dragging');
    };
    const onDragEnd = (e) => { e.target.classList.remove('dragging'); setDraggedItem(null); };
    const onDragOver = (e) => { if (isReorderingMode) e.preventDefault(); };
    const onDrop = (e, type, targetIndex, targetParentId = null) => {
        if (!isReorderingMode || !draggedItem || draggedItem.type !== type) return;
        e.preventDefault(); e.stopPropagation();
        
        // Ограничение: нельзя перетаскивать комнаты между этажами (пока)
        if (type === 'room' && targetParentId !== draggedItem.parentId) return;
        if (draggedItem.index === targetIndex) return;

        actions.reorderItem(type, building.id, selectedDocId, targetParentId, draggedItem.index, targetIndex);
        setDraggedItem(null);
    };

    // --- RENDER ---
    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Текущий раздел</div>
                    <div className="control-value">
                        <span style={{display:'flex', alignItems:'center', gap:10}}>
                            <Building2 size={24} color="var(--accent-primary)"/> {building.name}
                            {activeDoc && <><ChevronRight size={20}/> <FileText size={20}/> {activeDoc.name}</>}
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
                    </div>

                    <button className="action-btn secondary" onClick={() => {
                        if(selectedDocId) setSelectedDocId(null);
                        else navigate('/dashboard');
                    }}>
                        <ArrowLeft size={16} /> {selectedDocId ? 'К списку договоров' : 'Назад'}
                    </button>
                    
                    <button className="action-btn secondary" onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/export/${building.id}?username=${user.username}&role=${user.role}`, '_blank')}>
                        <Download size={18} color="#10b981"/> Excel
                    </button>

                    {hasEditRights && (
                        <>
                            <button className={`action-btn ${isReorderingMode ? 'primary' : 'secondary'}`} onClick={() => setIsReorderingMode(!isReorderingMode)}>
                                <Move size={18}/>
                            </button>
                            {/* Если договор не выбран, добавляем договор. Если выбран - добавляем этаж */}
                            {!selectedDocId ? (
                                <button className="action-btn primary" onClick={handleAddDocument}>
                                    <PlusCircle size={18}/> Новый договор
                                </button>
                            ) : (
                                <button className="action-btn primary" onClick={handleAddFloor}>
                                    <PlusCircle size={18}/> Добавить этаж
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Статистика */}
            <div style={{padding: '0 32px', marginTop: 24, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 20}}>
                <div className="stat-card" style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                    <div style={{background:'var(--bg-active)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="var(--accent-primary)"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Всего работ</div><div style={{fontSize:'1.2rem', fontWeight:700}}>{stats.total}</div></div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-green-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#166534"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Выполнено (СМР)</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#166534'}}>{stats.work}</div></div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-orange-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#c2410c"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Сдано (Документы)</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#c2410c'}}>{stats.doc}</div></div>
                </div>
                 <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'#e0f2fe', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#0284c7"/></div>
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Объем (усл.ед.)</div><div style={{fontSize:'1.2rem', fontWeight:700, color:'#0284c7'}}>{stats.vol.toFixed(1)}</div></div>
                </div>
            </div>

            <div className="content-area">
                {/* VIEW 1: СПИСОК ДОГОВОРОВ */}
                {!selectedDocId && (
                    <div className="documents-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap: 20}}>
                        {(building.documents || []).map((doc, idx) => (
                            <div 
                                key={doc.id}
                                className="project-card"
                                onClick={() => setSelectedDocId(doc.id)}
                                draggable={isReorderingMode}
                                onDragStart={(e) => onDragStart(e, 'document', doc, idx)}
                                onDragEnd={onDragEnd}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, 'document', idx)}
                                style={{cursor: isReorderingMode ? 'grab' : 'pointer', borderStyle: isReorderingMode ? 'dashed' : 'solid'}}
                            >
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:15}}>
                                    <div style={{background:'var(--bg-active)', padding:10, borderRadius:10}}>
                                        <FileText size={28} color="var(--accent-primary)"/>
                                    </div>
                                    {hasEditRights && !isReorderingMode && (
                                        <div style={{display:'flex', gap:5}}>
                                            <button className="icon-btn-edit" onClick={(e) => handleRenameDocument(doc.id, doc.name, e)}><Pencil size={16}/></button>
                                            <button className="icon-btn-danger" onClick={(e) => handleDeleteDocument(doc.id, e)}><Trash2 size={16}/></button>
                                        </div>
                                    )}
                                    {isReorderingMode && <GripVertical size={20} style={{color:'var(--text-muted)'}}/>}
                                </div>
                                <h3>{doc.name}</h3>
                                <div style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>Этажей: {(doc.floors || []).length}</div>
                            </div>
                        ))}
                        {(building.documents || []).length === 0 && (
                            <div style={{gridColumn: '1/-1', textAlign:'center', color:'var(--text-muted)', padding: 40}}>
                                Нет договоров. Создайте первый договор для начала работы.
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 2: СПИСОК ЭТАЖЕЙ ВНУТРИ ДОГОВОРА */}
                {activeDoc && (
                    <div className="floors-list">
                        {(activeDoc.floors || []).map((floor, floorIndex) => (
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
                                        {isReorderingMode && <GripVertical size={20} style={{marginRight: 8, color:'var(--accent-primary)'}}/>}
                                        {floor.name}
                                        {hasEditRights && !isReorderingMode && (
                                            <button className="icon-btn-edit" style={{marginLeft:10}} onClick={() => handleRenameFloor(floor.id, floor.name)}><Pencil size={14}/></button>
                                        )}
                                    </span>
                                    {hasEditRights && !isReorderingMode && (
                                        <div style={{display:'flex', gap: 15}}>
                                            <button className="text-btn" onClick={() => handleAddRoom(floor.id)}>+ Квартира</button>
                                            <button className="icon-btn-edit" onClick={() => handleCopyFloor(floor.id)}><Copy size={16}/></button>
                                            <button className="icon-btn-danger" onClick={() => handleDeleteFloor(floor.id)}><Trash2 size={16}/></button>
                                        </div>
                                    )}
                                </div>
                                <div className="rooms-grid">
                                    {floor.rooms.map((room, roomIndex) => {
                                        const statusClass = getRoomStatus(room, filterGroupId);
                                        const hasFiltered = filterGroupId && filterGroupId !== '' && room.tasks.some(t => (t.groupId||'uncategorized')===filterGroupId);
                                        return (
                                            <div 
                                                key={room.id} 
                                                className={`room-item ${statusClass} ${hasFiltered ? 'filtered-highlight' : ''}`}
                                                onClick={() => setSelectedRoom({ buildingId: building.id, documentId: activeDoc.id, floorId: floor.id, room })}
                                                draggable={isReorderingMode}
                                                onDragStart={(e) => onDragStart(e, 'room', room, roomIndex, floor.id)}
                                                onDragEnd={onDragEnd}
                                                onDragOver={onDragOver}
                                                onDrop={(e) => onDrop(e, 'room', roomIndex, floor.id)}
                                                style={{cursor: isReorderingMode ? 'grab' : 'pointer'}}
                                            >
                                                {hasEditRights && !isReorderingMode && (
                                                    <div style={{position:'absolute', top:4, right:4, opacity:0.6}} onClick={(e) => handleCopyRoom(floor.id, room.id, e)}>
                                                        <Copy size={14}/>
                                                    </div>
                                                )}
                                                <div className="room-name">{room.name}</div>
                                                <div className="room-stats">
                                                    {(() => {
                                                        const tasks = filterGroupId ? room.tasks.filter(t => (t.groupId||'uncategorized')===filterGroupId) : room.tasks;
                                                        const done = tasks.filter(t => t.work_done && t.doc_done).length;
                                                        return `${done}/${tasks.length}`;
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {floor.rooms.length === 0 && <div style={{width:'100%', textAlign:'center', color:'var(--text-muted)', padding:10}}>Нет помещений</div>}
                                </div>
                            </div>
                        ))}
                        {(activeDoc.floors || []).length === 0 && <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>В этом договоре пока нет этажей. Добавьте их.</div>}
                    </div>
                )}
            </div>
        </>
    );
};
export default BuildingPage;