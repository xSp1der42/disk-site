import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import { ROLES_CONFIG } from '../utils/constants';

const POWERS = { '2': '²', '3': '³' };

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---
const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');

    return (
        <div style={{
            position: 'absolute', top: 40, right: 0, zIndex: 20,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)', borderRadius: 12, padding: 16, width: 260
        }} onClick={e => e.stopPropagation()}>
            <div style={{marginBottom: 10}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Начало:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div style={{marginBottom: 16}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Окончание:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={end} onChange={e => setEnd(e.target.value)} />
            </div>
            <div style={{display:'flex', gap: 8}}>
                <button className="action-btn primary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(start, end)}>Сохранить</button>
                <button className="action-btn secondary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(null, null)}>Сброс</button>
            </div>
        </div>
    );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, filterGroupId, sysActions }) => {
    // State для СМР
    const [isAddingSMR, setIsAddingSMR] = useState(false);
    const [newSMR, setNewSMR] = useState({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    
    // State для МТР (материала)
    const [addingMaterialToTaskId, setAddingMaterialToTaskId] = useState(null); // ID задачи, куда добавляем МТР
    const [newMTR, setNewMTR] = useState({ name: '', coefficient: 1, unit: 'шт' });

    const [editingTask, setEditingTask] = useState(null);
    const [editTaskData, setEditTaskData] = useState({});
    
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    
    // Раскрытые СМР (для показа МТР)
    const [expandedTasks, setExpandedTasks] = useState({});

    // Фильтры видимости из BuildingPage
    const showSMR = selectedRoom.showSMR !== false; // По умолчанию true
    const showMTR = selectedRoom.showMTR !== false; // По умолчанию true

    const toggleExpand = (taskId) => {
        setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    const groupedTasks = useMemo(() => {
        const result = {};
        groups.forEach(g => { result[g.id] = { name: g.name, tasks: [] }; });
        result['uncategorized'] = { name: 'Без группы', tasks: [] };

        selectedRoom.room.tasks.forEach(task => {
            const gid = task.groupId && result[task.groupId] ? task.groupId : 'uncategorized';
            if (!filterGroupId || filterGroupId === gid) {
                result[gid].tasks.push(task);
            }
        });
        return result;
    }, [selectedRoom.room.tasks, groups, filterGroupId]);

    // --- ADD SMR ---
    const handleAddSMR = (e) => {
        e.preventDefault();
        actions.addTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, {
            ...newSMR,
            groupId: newSMR.groupId === 'uncategorized' ? '' : newSMR.groupId
        });
        setIsAddingSMR(false);
        setNewSMR({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    };

    // --- ADD MTR ---
    const handleAddMTR = (e, taskId) => {
        e.preventDefault();
        actions.addMaterial(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, newMTR);
        setAddingMaterialToTaskId(null);
        setNewMTR({ name: '', coefficient: 1, unit: 'шт' });
        // Автоматически раскрыть задачу
        if (!expandedTasks[taskId]) toggleExpand(taskId);
    };

    const handleDeleteItem = (type, id, subId = null) => {
        if (type === 'task') {
             sysActions.confirm("Удаление работы", "Удалить СМР и все материалы?", () => {
                 actions.deleteItem('task', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId: id});
            });
        } else if (type === 'material') {
            sysActions.confirm("Удаление материала", "Удалить МТР?", () => {
                 actions.deleteItem('material', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId: id, materialId: subId});
            });
        }
    }

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" onClick={e => { e.stopPropagation(); setActiveDatePopup(null); }}>
                <div className="modal-top">
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:700, marginBottom: 4}}>
                            {selectedRoom.room.name}
                        </div>
                        <h2>{selectedRoom.room.name}</h2>
                    </div>
                    <div style={{display:'flex', gap:20, alignItems:'center'}}>
                        <div className={`status-pill ${getRoomStatus(selectedRoom.room, filterGroupId)}`}>
                             {getRoomStatus(selectedRoom.room, filterGroupId) === 'status-green' ? 'ВСЁ ВЫПОЛНЕНО' : 'В ПРОЦЕССЕ'}
                        </div>
                        <button className="close-btn" onClick={() => setSelectedRoom(null)}>✕</button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: '40%'}}>Наименование (СМР / МТР)</th>
                                <th style={{width: '10%'}}>Объем</th>
                                <th style={{width: '10%'}}>Ед.</th>
                                <th style={{width: '20%', textAlign:'center'}}>СМР (Факт)</th>
                                <th style={{width: '20%', textAlign:'center'}}>ИД (Доки)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedTasks).map(([gid, group]) => {
                                if (group.tasks.length === 0) return null;
                                return (
                                    <React.Fragment key={gid}>
                                        <tr className="group-header-row"><td colSpan="5"><Layers size={16} style={{marginRight:8}}/> {group.name}</td></tr>
                                        {group.tasks.map(task => {
                                            const isExpanded = expandedTasks[task.id];
                                            const hasMaterials = task.materials && task.materials.length > 0;
                                            
                                            return (
                                                <React.Fragment key={task.id}>
                                                    {/* СМР ROW */}
                                                    {showSMR && (
                                                        <tr style={{background: 'var(--bg-card)'}}>
                                                            <td>
                                                                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                                                                    <button onClick={() => toggleExpand(task.id)} style={{border:'none', background:'transparent', cursor:'pointer', padding:0, display:'flex'}}>
                                                                        {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                                                    </button>
                                                                    <div style={{fontWeight: 600, fontSize:'1rem'}}>{task.name}</div>
                                                                    {hasEditRights && (
                                                                        <div className="hover-tools">
                                                                            <button className="icon-btn-danger" onClick={() => handleDeleteItem('task', task.id)}><Trash2 size={14}/></button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Date Info */}
                                                                {task.end_date && <div style={{fontSize:'0.75rem', color: '#10b981', marginLeft: 28}}>Дедлайн: {new Date(task.end_date).toLocaleDateString()}</div>}
                                                            </td>
                                                            <td style={{fontWeight:700}}>{task.volume}</td>
                                                            <td style={{color:'var(--text-muted)'}}>{task.unit}{POWERS[task.unit_power]}</td>
                                                            
                                                            {/* Checkboxes */}
                                                            <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                                                                <div className="checkbox-wrapper">
                                                                    <div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>
                                                                        {task.work_done && <Hammer size={20}/>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                                                                <div className="checkbox-wrapper">
                                                                    <div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>
                                                                        {task.doc_done && <FileText size={20}/>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {/* МТР ROWS (Nested) */}
                                                    {isExpanded && showMTR && (
                                                        <>
                                                            {task.materials.map(mat => (
                                                                <tr key={mat.id} style={{background: 'var(--bg-body)'}}>
                                                                    <td style={{paddingLeft: 48}}>
                                                                        <div style={{display:'flex', alignItems:'center', gap: 8, fontSize:'0.9rem', color:'var(--text-main)'}}>
                                                                            <Package size={14} color="var(--accent-secondary)"/> 
                                                                            {mat.name}
                                                                            {hasEditRights && <button className="icon-btn-danger" style={{opacity:0.5}} onClick={() => handleDeleteItem('material', task.id, mat.id)}><Trash2 size={12}/></button>}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{fontSize:'0.9rem'}}>
                                                                        {mat.total_quantity.toFixed(1)}
                                                                        <div style={{fontSize:'0.7rem', color:'var(--text-muted)'}}>k={mat.coefficient}</div>
                                                                    </td>
                                                                    <td style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>{mat.unit}</td>
                                                                    <td colSpan="2"></td>
                                                                </tr>
                                                            ))}
                                                            
                                                            {/* Add MTR Form */}
                                                            {hasEditRights && (
                                                                <tr style={{background: 'var(--bg-body)'}}>
                                                                    <td colSpan="5" style={{paddingLeft: 48, paddingBottom: 16}}>
                                                                        {addingMaterialToTaskId === task.id ? (
                                                                            <form onSubmit={(e) => handleAddMTR(e, task.id)} style={{display:'flex', gap: 8, alignItems:'center'}}>
                                                                                <span style={{fontSize:'0.8rem', fontWeight:600, color:'var(--accent-secondary)'}}>Новый МТР:</span>
                                                                                <input className="sm-input" placeholder="Название (Клей...)" value={newMTR.name} onChange={e=>setNewMTR({...newMTR, name: e.target.value})} required autoFocus/>
                                                                                <input className="sm-input" type="number" step="0.01" placeholder="Коэф." style={{width:60}} value={newMTR.coefficient} onChange={e=>setNewMTR({...newMTR, coefficient: parseFloat(e.target.value)})} required/>
                                                                                <input className="sm-input" placeholder="Ед." style={{width:50}} value={newMTR.unit} onChange={e=>setNewMTR({...newMTR, unit: e.target.value})} required/>
                                                                                <button type="submit" className="action-btn primary" style={{padding:'6px 12px'}}>OK</button>
                                                                                <button type="button" className="action-btn secondary" style={{padding:'6px 12px'}} onClick={() => setAddingMaterialToTaskId(null)}>✕</button>
                                                                            </form>
                                                                        ) : (
                                                                            <button className="text-btn" style={{fontSize:'0.8rem', color:'var(--text-muted)'}} onClick={() => setAddingMaterialToTaskId(task.id)}>
                                                                                + Добавить МТР (Материал)
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {hasEditRights && (
                    <div className="modal-footer">
                        {!isAddingSMR ? (
                            <button className="action-btn primary" onClick={() => setIsAddingSMR(true)}>
                                <PlusCircle size={20}/> Добавить СМР (Работу)
                            </button>
                        ) : (
                            <form onSubmit={handleAddSMR} className="add-task-form">
                                <strong>Новая СМР:</strong>
                                <select value={newSMR.groupId} onChange={e => setNewSMR({...newSMR, groupId: e.target.value})}>
                                    <option value="">Группа...</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    <option value="uncategorized">Без группы</option>
                                </select>
                                <input placeholder="Название" value={newSMR.name} onChange={e => setNewSMR({...newSMR, name: e.target.value})} required/>
                                <input type="number" placeholder="Объем" style={{width:80}} value={newSMR.volume} onChange={e => setNewSMR({...newSMR, volume: e.target.value})} required/>
                                <button type="submit" className="action-btn primary">OK</button>
                                <button type="button" onClick={() => setIsAddingSMR(false)} className="action-btn secondary">✕</button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomModal;