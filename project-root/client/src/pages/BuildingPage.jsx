import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Filter, ArrowLeft, PlusCircle, Pencil, Trash2, Download, PieChart, Copy, GripVertical, Move, FileText, Briefcase } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';

const BuildingPage = ({ buildings, user, actions, setSelectedRoom, filterGroupId, setFilterGroupId, groups, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);

    // --- State ---
    const [selectedContractId, setSelectedContractId] = useState(null);
    const [isReorderingMode, setIsReorderingMode] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);
    
    // Новые фильтры
    const [showSMR, setShowSMR] = useState(true);
    const [showMTR, setShowMTR] = useState(true);

    const selectedContract = building?.contracts?.find(c => c.id === selectedContractId);

    // Stats for Building or Contract
    const stats = useMemo(() => {
        if (!building) return null;
        let total = 0, work = 0, doc = 0, vol = 0;
        
        // Loop depending on context
        const contractsToLoop = selectedContract ? [selectedContract] : building.contracts;

        contractsToLoop.forEach(c => 
            c.floors.forEach(f => 
                f.rooms.forEach(r => 
                    r.tasks.forEach(t => {
                        total++;
                        if(t.work_done) work++;
                        if(t.doc_done) doc++;
                        vol += (t.volume || 0);
                    })
                )
            )
        );
        return { total, work, doc, vol };
    }, [building, selectedContract]);

    if (!building) {
        return (
            <div className="content-area" style={{display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--text-muted)'}}>
                {buildings.length === 0 ? "Загрузка данных..." : "Объект не найден"}
            </div>
        );
    }

    // --- Handlers: Contract ---
    const handleAddContract = () => {
        sysActions.prompt("Новый договор", "Название (например: Отделка, Электрика):", (name) => {
            actions.createContract(building.id, name);
        });
    };

    const handleRenameContract = (cId, oldName) => {
        sysActions.prompt("Переименование", "Новое название договора:", (newName) => {
            if(newName !== oldName) actions.renameItem('contract', {buildingId: building.id, contractId: cId}, newName);
        }, oldName);
    };

    const handleDeleteContract = (cId) => {
        sysActions.confirm("Удаление договора", "Удалить договор и все данные внутри?", () => {
            actions.deleteItem('contract', { buildingId: building.id, contractId: cId });
        });
    };

    // --- Handlers: Floor ---
    const handleAddFloor = () => {
        if(!selectedContractId) return;
        sysActions.prompt("Новый этаж", "Название этажа (например: 2 Этаж):", (name) => {
            actions.addFloor(building.id, selectedContractId, name);
        });
    };

    const handleRenameFloor = (floorId, oldName) => {
        sysActions.prompt("Переименование", "Новое название этажа:", (newName) => {
            if(newName !== oldName) actions.renameItem('floor', {buildingId: building.id, contractId: selectedContractId, floorId}, newName);
        }, oldName);
    }
    
    const handleDeleteFloor = (floorId) => {
        sysActions.confirm("Удаление этажа", "Удалить этаж и все помещения в нем?", () => {
            actions.deleteItem('floor', { buildingId: building.id, contractId: selectedContractId, floorId });
        });
    }

    const handleCopyFloor = (floorId) => {
        sysActions.confirm("Копирование", "Создать полную копию этажа?", () => {
            actions.copyItem('floor', { buildingId: building.id, contractId: selectedContractId, floorId });
        });
    };

    // --- Handlers: Room ---
    const handleAddRoom = (floorId) => {
        sysActions.prompt("Новое помещение", "Номер квартиры или название:", (name) => {
            actions.addRoom(building.id, selectedContractId, floorId, name);
        });
    }

    const handleCopyRoom = (floorId, roomId, e) => {
        e.stopPropagation();
        sysActions.confirm("Копирование", "Создать копию помещения?", () => {
            actions.copyItem('room', { buildingId: building.id, contractId: selectedContractId, floorId, roomId });
        });
    };

    const handleDownloadReport = () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        window.open(`${apiUrl}/api/export/${building.id}?username=${user.username}&role=${user.role}`, '_blank');
    };

    // --- DnD Logic ---
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
        e.preventDefault(); 
    };

    const onDrop = (e, type, targetIndex, targetParentId = null) => {
        if (!isReorderingMode) return;
        e.preventDefault();
        e.stopPropagation();

        if (!draggedItem) return;
        if (draggedItem.type !== type) return; 
        
        // Проверка родителя (чтобы не перетащить комнату на другой этаж)
        if (type === 'room' && targetParentId !== draggedItem.parentId) return;
        if (type === 'floor' && selectedContractId) { /* внутри контракта */ }

        if (draggedItem.index === targetIndex) return;

        actions.reorderItem(type, building.id, selectedContractId, targetParentId, draggedItem.index, targetIndex);
        setDraggedItem(null);
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">
                        {selectedContract ? "Текущий договор" : "Текущий объект"}
                    </div>
                    <div className="control-value">
                        <span style={{display:'flex', alignItems:'center', gap:10}}>
                            {selectedContract ? <Briefcase size={24} color="var(--accent-secondary)"/> : <Building2 size={24} color="var(--accent-primary)"/>} 
                            {selectedContract ? `${building.name} / ${selectedContract.name}` : building.name}
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
                            <option value="">Все группы работ</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                            <option value="uncategorized">Без группы</option>
                        </select>
                    </div>

                    {/* Фильтры СМР / МТР */}
                    {selectedContract && (
                        <div style={{display:'flex', gap:4, marginRight: 10, border: '1px solid var(--border-color)', borderRadius:8, padding:4, background: 'var(--bg-body)'}}>
                            <button 
                                onClick={() => setShowSMR(!showSMR)}
                                style={{background: showSMR ? 'var(--bg-active)' : 'transparent', color: showSMR ? 'var(--accent-primary)' : 'var(--text-muted)', border:'none', borderRadius:4, padding:'6px 10px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer'}}
                            >СМР</button>
                             <button 
                                onClick={() => setShowMTR(!showMTR)}
                                style={{background: showMTR ? 'var(--bg-active)' : 'transparent', color: showMTR ? 'var(--accent-primary)' : 'var(--text-muted)', border:'none', borderRadius:4, padding:'6px 10px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer'}}
                            >МТР</button>
                        </div>
                    )}

                    <button className="action-btn secondary" onClick={() => {
                        if (selectedContract) setSelectedContractId(null);
                        else navigate('/dashboard');
                    }}>
                        <ArrowLeft size={16} /> Назад
                    </button>
                    
                    {!selectedContract && (
                        <button className="action-btn secondary" onClick={handleDownloadReport} title="Скачать отчет">
                            <Download size={18} color="#10b981"/> Excel
                        </button>
                    )}

                    {hasEditRights && (
                        <>
                            <button 
                                className={`action-btn ${isReorderingMode ? 'primary' : 'secondary'}`} 
                                onClick={() => setIsReorderingMode(!isReorderingMode)}
                                title={isReorderingMode ? "Выключить перемещение" : "Включить режим перемещения (Drag&Drop)"}
                            >
                                <Move size={18}/>
                            </button>

                            {!selectedContract ? (
                                <button className="action-btn primary" onClick={handleAddContract}>
                                    <PlusCircle size={18}/> Добавить Договор
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
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                    <div style={{background:'var(--bg-active)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="var(--accent-primary)"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Всего работ (СМР)</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700}}>{stats.total}</div>
                    </div>
                </div>
                {/* ... остальные статы аналогично ... */}
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-green-bg)', padding: 10, borderRadius: '50%'}}><PieChart size={24} color="#166534"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Выполнено (СМР)</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#166534'}}>{stats.work}</div>
                    </div>
                </div>
                <div style={{background:'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', display:'flex', alignItems:'center', gap: 15}}>
                     <div style={{background:'var(--status-orange-bg)', padding: 10, borderRadius: '50%'}}><FileText size={24} color="#c2410c"/></div>
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Сдано (Документы)</div>
                        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#c2410c'}}>{stats.doc}</div>
                    </div>
                </div>
            </div>

            {/* --- VIEW 1: CONTRACTS LIST --- */}
            {!selectedContract && (
                <div className="content-area">
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap: 24}}>
                        {building.contracts.map((c, cIndex) => (
                            <div 
                                key={c.id}
                                className="project-card"
                                onClick={() => setSelectedContractId(c.id)}
                                draggable={isReorderingMode}
                                onDragStart={(e) => onDragStart(e, 'contract', c, cIndex)}
                                onDragEnd={onDragEnd}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, 'contract', cIndex)}
                                style={{
                                    borderLeft: '5px solid var(--accent-secondary)',
                                    cursor: isReorderingMode ? 'grab' : 'pointer'
                                }}
                            >
                                <div className="card-top">
                                    <h3 style={{display:'flex', alignItems:'center', gap:10}}>
                                        <Briefcase size={20} color="var(--text-muted)"/> {c.name}
                                    </h3>
                                    {hasEditRights && (
                                        <div style={{display:'flex', gap:4}} onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn-edit" onClick={() => handleRenameContract(c.id, c.name)}><Pencil size={14}/></button>
                                            <button className="icon-btn-danger" onClick={() => handleDeleteContract(c.id)}><Trash2 size={14}/></button>
                                        </div>
                                    )}
                                </div>
                                <div className="card-meta">
                                    <span>Этажей: {c.floors.length}</span>
                                    {isReorderingMode && <Move size={14}/>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {building.contracts.length === 0 && <div style={{textAlign:'center', marginTop:40, color:'var(--text-muted)'}}>Нет договоров. Создайте первый пакет работ.</div>}
                </div>
            )}

            {/* --- VIEW 2: FLOORS & ROOMS (Inside Contract) --- */}
            {selectedContract && (
                <div className="content-area">
                    <div className="floors-list">
                        {selectedContract.floors.map((floor, floorIndex) => (
                            <div 
                                key={floor.id} 
                                className="floor-block"
                                draggable={isReorderingMode}
                                onDragStart={(e) => onDragStart(e, 'floor', floor, floorIndex)}
                                onDragEnd={onDragEnd}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDrop(e, 'floor', floorIndex, selectedContract.id)}
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
                                        const hasFilteredTasks = filterGroupId ? room.tasks.some(t => (t.groupId || 'uncategorized') === filterGroupId) : false;

                                        return (
                                            <div 
                                                key={room.id} 
                                                className={`room-item ${statusClass} ${hasFilteredTasks ? 'filtered-highlight' : ''}`}
                                                onClick={() => setSelectedRoom({ 
                                                    buildingId: building.id, 
                                                    contractId: selectedContract.id, 
                                                    floorId: floor.id, 
                                                    room,
                                                    showSMR,
                                                    showMTR
                                                })}
                                                draggable={isReorderingMode}
                                                onDragStart={(e) => onDragStart(e, 'room', room, roomIndex, floor.id)}
                                                onDragEnd={onDragEnd}
                                                onDragOver={onDragOver}
                                                onDrop={(e) => onDrop(e, 'room', roomIndex, floor.id)}
                                                style={{cursor: isReorderingMode ? 'grab' : 'pointer'}}
                                            >
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
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default BuildingPage;