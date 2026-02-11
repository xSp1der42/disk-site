import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, FileText, ArrowLeft, PlusCircle, Pencil, Trash2, GripVertical, Move, ChevronDown, ChevronRight } from 'lucide-react';

const BuildingPage = ({ buildings, user, actions, setSelectedRoom, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    
    // UI State
    const [isReorderingMode, setIsReorderingMode] = useState(false);
    const [expandedContracts, setExpandedContracts] = useState({});

    if (!building) return <div className="content-area">Объект не найден</div>;

    const toggleContract = (cId) => {
        setExpandedContracts(prev => ({ ...prev, [cId]: !prev[cId] }));
    };

    // --- Actions ---
    const handleAddContract = () => {
        sysActions.prompt("Новый договор", "Название (например: Отделочные работы):", (name) => {
            actions.addContract(building.id, name);
        });
    };

    const handleAddFloor = (contractId) => {
        sysActions.prompt("Новый этаж", "Название этажа:", (name) => {
            actions.addFloor(building.id, contractId, name);
        });
    };

    const handleAddRoom = (contractId, floorId) => {
        sysActions.prompt("Новое помещение", "Название/Номер:", (name) => {
            actions.addRoom(building.id, contractId, floorId, name);
        });
    };

    const handleDelete = (type, ids) => {
        sysActions.confirm("Удаление", "Вы уверены? Это действие необратимо.", () => actions.deleteItem(type, ids));
    };
    
    const handleRename = (type, ids, oldName) => {
        sysActions.prompt("Переименование", "Новое название:", (n) => {
            if(n!==oldName) actions.renameItem(type, ids, n);
        }, oldName);
    };

    const getRoomStatusColor = (room) => {
        if (!room.tasks || room.tasks.length === 0) return 'var(--bg-body)';
        const allDone = room.tasks.every(t => t.work_done && t.doc_done);
        if (allDone) return 'var(--status-green-bg)';
        const anyProgress = room.tasks.some(t => t.work_done || t.doc_done);
        return anyProgress ? 'var(--status-orange-bg)' : 'var(--status-red-bg)';
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Объект</div>
                    <div className="control-value">
                        <Building2 size={24} style={{verticalAlign:'middle', marginRight:10, color:'var(--accent-primary)'}}/> 
                        {building.name}
                    </div>
                </div>
                <div className="control-actions">
                    <button className="action-btn secondary" onClick={() => navigate('/dashboard')}><ArrowLeft size={16}/> Назад</button>
                    {hasEditRights && (
                        <>
                            <button className={`action-btn ${isReorderingMode?'primary':'secondary'}`} onClick={() => setIsReorderingMode(!isReorderingMode)}>
                                <Move size={16}/> {isReorderingMode ? 'Готово' : 'Порядок'}
                            </button>
                            <button className="action-btn primary" onClick={handleAddContract}>
                                <PlusCircle size={16}/> Договор
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="content-area">
                {(!building.contracts || building.contracts.length === 0) && (
                    <div style={{textAlign:'center', padding:40, color:'var(--text-muted)'}}>
                        Нет договоров. Создайте первый договор для добавления этажей.
                    </div>
                )}

                <div className="floors-list">
                    {building.contracts?.map((contract) => (
                        <div key={contract.id} style={{marginBottom: 20, background:'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow:'hidden'}}>
                            {/* Заголовок Договора */}
                            <div 
                                style={{
                                    padding: '16px 24px', background: 'var(--bg-hover)', 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                                }}
                                onClick={() => toggleContract(contract.id)}
                            >
                                <div style={{display:'flex', alignItems:'center', gap: 12, fontWeight: 700, fontSize:'1.05rem'}}>
                                    {expandedContracts[contract.id] ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                                    <FileText size={20} color="var(--accent-secondary)"/>
                                    {contract.name}
                                </div>
                                
                                {hasEditRights && (
                                    <div style={{display:'flex', gap: 8}} onClick={e => e.stopPropagation()}>
                                        <button className="icon-btn-edit" onClick={() => handleRename('contract', {buildingId:building.id, contractId:contract.id}, contract.name)}><Pencil size={16}/></button>
                                        <button className="icon-btn-danger" onClick={() => handleDelete('contract', {buildingId:building.id, contractId:contract.id})}><Trash2 size={16}/></button>
                                        {!isReorderingMode && (
                                            <button className="action-btn primary" style={{padding:'6px 12px', fontSize:'0.8rem'}} onClick={() => handleAddFloor(contract.id)}>+ Этаж</button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Список Этажей */}
                            {expandedContracts[contract.id] && (
                                <div style={{padding: 20, background: 'var(--bg-body)'}}>
                                    {contract.floors.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.9rem', fontStyle:'italic'}}>Нет этажей</div>}
                                    
                                    {contract.floors.map((floor) => (
                                        <div key={floor.id} style={{marginBottom: 16, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)'}}>
                                            <div style={{padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                <span style={{fontWeight: 600, display:'flex', alignItems:'center', gap: 8}}>
                                                    {isReorderingMode && <GripVertical size={16} style={{cursor:'grab', color:'var(--text-muted)'}}/>}
                                                    {floor.name}
                                                </span>
                                                {hasEditRights && !isReorderingMode && (
                                                    <div style={{display:'flex', gap:6}}>
                                                        <button className="text-btn" style={{fontSize:'0.8rem'}} onClick={() => handleAddRoom(contract.id, floor.id)}>+ Помещение</button>
                                                        <button className="icon-btn-edit" onClick={()=>handleRename('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id}, floor.name)}><Pencil size={14}/></button>
                                                        <button className="icon-btn-danger" onClick={()=>handleDelete('floor', {buildingId:building.id, contractId:contract.id, floorId:floor.id})}><Trash2 size={14}/></button>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="rooms-grid" style={{padding: 12}}>
                                                {floor.rooms.map((room) => (
                                                    <div 
                                                        key={room.id} 
                                                        className="room-item" 
                                                        style={{background: getRoomStatusColor(room), borderColor: isReorderingMode ? 'transparent' : 'var(--border-color)'}}
                                                        onClick={() => !isReorderingMode && setSelectedRoom({ buildingId: building.id, contractId: contract.id, floorId: floor.id, room })}
                                                    >
                                                        <div className="room-name">{room.name}</div>
                                                        <div className="room-stats" style={{fontSize:'0.7rem'}}>
                                                            Позиций: {room.tasks.length}
                                                        </div>
                                                    </div>
                                                ))}
                                                {floor.rooms.length === 0 && <div style={{width:'100%', fontSize:'0.8rem', color:'var(--text-muted)', padding:4}}>Пусто</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default BuildingPage;