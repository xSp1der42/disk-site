import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Filter, ArrowLeft, PlusCircle, Pencil, Trash2, Download, PieChart, Copy, GripVertical, Move, FileText, Briefcase } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';

const BuildingPage = ({ 
    buildings, user, actions, setSelectedRoom, 
    filterGroupId, setFilterGroupId, 
    filterContractId, setFilterContractId,
    filterType, setFilterType,
    groups, sysActions 
}) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);

    // Состояние режима перемещения
    const [isReorderingMode, setIsReorderingMode] = useState(false);
    // Управление договорами (просто список в попапе или прямо здесь)
    const [showContractsModal, setShowContractsModal] = useState(false);

    // DnD State
    const [draggedItem, setDraggedItem] = useState(null);

    const stats = useMemo(() => {
        if (!building) return null;
        let total = 0, work = 0, doc = 0, vol = 0;
        building.floors.forEach(f => f.rooms.forEach(r => r.tasks.forEach(t => {
            // Учитываем фильтры при расчете статистики? 
            // Пока считаем общую статистику объекта, чтобы цифры не прыгали.
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

    // Управление Договорами
    const handleAddContract = () => {
        sysActions.prompt("Новый договор", "Название пакета/договора:", (name) => {
            actions.createContract(building.id, name);
        });
    };
    const handleDeleteContract = (cid, cname) => {
        sysActions.confirm("Удаление договора", `Удалить договор "${cname}"? Работы потеряют привязку.`, () => {
            actions.deleteContract(building.id, cid);
        });
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
                    {/* ФИЛЬТРЫ */}
                    <div className="filter-dropdown-container">
                        <Filter size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                        
                        {/* 1. Группа работ */}
                        <select 
                            className="filter-select"
                            value={filterGroupId} 
                            onChange={e => setFilterGroupId(e.target.value)}
                            style={{marginRight: 8}}
                        >
                            <option value="">Все группы</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                            <option value="uncategorized">Без группы</option>
                        </select>

                        {/* 2. Пакет / Договор */}
                        <select 
                            className="filter-select"
                            value={filterContractId} 
                            onChange={e => setFilterContractId(e.target.value)}
                            style={{marginRight: 8, borderLeft:'1px solid var(--border-color)', paddingLeft:8}}
                        >
                            <option value="">Все договоры</option>
                            {building.contracts?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                            <option value="uncategorized">Без договора</option>
                        </select>

                        {/* 3. Тип: СМР / МТР */}
                        <select 
                            className="filter-select"
                            value={filterType} 
                            onChange={e => setFilterType(e.target.value)}
                            style={{borderLeft:'1px solid var(--border-color)', paddingLeft:8}}
                        >
                            <option value="all">Всё (СМР + МТР)</option>
                            <option value="smr">Только Работы (СМР)</option>
                            <option value="mtr">Только Материалы (МТР)</option>
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
                             {/* Кнопка управления Договорами */}
                             <button className="action-btn secondary" onClick={() => setShowContractsModal(true)}>
                                <Briefcase size={18}/> Договоры
                            </button>

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

            {/* Contracts Modal (Simple Popup) */}
            {showContractsModal && (
                <div className="modal-backdrop" onClick={() => setShowContractsModal(false)}>
                    <div className="modal-window" style={{width: 500, height: 'auto', padding: 24}} onClick={e => e.stopPropagation()}>
                        <h3 style={{marginTop:0}}>Управление договорами</h3>
                        <div style={{marginBottom: 16, display:'flex', gap: 8}}>
                            <button className="action-btn primary" onClick={handleAddContract}><PlusCircle size={16}/> Новый договор</button>
                        </div>
                        <div style={{maxHeight: 400, overflowY:'auto'}}>
                            <table className="users-table">
                                <thead><tr><th>Название</th><th style={{width:40}}></th></tr></thead>
                                <tbody>
                                    {building.contracts?.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.name}</td>
                                            <td>
                                                <button className="icon-btn-danger" onClick={() => handleDeleteContract(c.id, c.name)}><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!building.contracts || building.contracts.length === 0) && <tr><td colSpan="2" style={{textAlign:'center'}}>Нет договоров</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div style={{marginTop: 20, textAlign:'right'}}>
                            <button className="action-btn secondary" onClick={() => setShowContractsModal(false)}>Закрыть</button>
                        </div>
                    </div>
                </div>
            )}

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
                                    // Логика фильтрации для подсветки: учитываем и группу, и контракт
                                    const filteredTasks = room.tasks.filter(t => {
                                        let matchGroup = true;
                                        if (filterGroupId && filterGroupId !== '') {
                                            const tGroup = t.groupId || 'uncategorized';
                                            matchGroup = (tGroup === filterGroupId);
                                        }
                                        let matchContract = true;
                                        if (filterContractId && filterContractId !== '') {
                                            const tContract = t.contractId || 'uncategorized';
                                            matchContract = (tContract === filterContractId);
                                        }
                                        return matchGroup && matchContract;
                                    });
                                    if (filteredTasks.length > 0) hasFilteredTasks = true;

                                    return (
                                        <div 
                                            key={room.id} 
                                            className={`room-item ${statusClass} ${hasFilteredTasks ? 'filtered-highlight' : ''}`}
                                            onClick={() => setSelectedRoom({ buildingId: building.id, floorId: floor.id, room, contracts: building.contracts })}
                                            draggable={isReorderingMode}
                                            onDragStart={(e) => onDragStart(e, 'room', room, roomIndex, floor.id)}
                                            onDragEnd={onDragEnd}
                                            onDragOver={onDragOver}
                                            onDrop={(e) => onDrop(e, 'room', roomIndex, floor.id)}
                                            style={{cursor: isReorderingMode ? 'grab' : 'pointer'}}
                                        >
                                            {/* Кнопка копирования квартиры */}
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
                                                {`${filteredTasks.filter(t=>t.work_done && t.doc_done).length}/${filteredTasks.length}`}
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