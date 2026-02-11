import React, { useState, useMemo } from 'react';
import { Pencil, Trash2, Hammer, FileText, PlusCircle, Filter, X, Search } from 'lucide-react';

const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, sysActions }) => {
    const [isAdding, setIsAdding] = useState(false);
    
    // Новая задача
    const [newTask, setNewTask] = useState({ name: '', type: 'smr', package: '', groupId: '', volume: '', unit: 'шт', unit_power: '' });
    
    // Фильтры
    const [filterType, setFilterType] = useState('all'); // all, smr, mtr
    const [filterGroup, setFilterGroup] = useState('');
    const [filterPackage, setFilterPackage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const tasks = selectedRoom.room.tasks || [];
    
    // Уникальные пакеты
    const availablePackages = useMemo(() => [...new Set(tasks.map(t => t.package).filter(Boolean))], [tasks]);

    // Логика фильтрации
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filterType !== 'all' && t.type !== filterType) return false;
            if (filterGroup && (t.groupId || 'uncategorized') !== filterGroup) return false;
            if (filterPackage && t.package !== filterPackage) return false;
            if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [tasks, filterType, filterGroup, filterPackage, searchQuery]);

    const handleAddTask = (e) => {
        e.preventDefault();
        actions.addTask({
            buildingId: selectedRoom.buildingId,
            contractId: selectedRoom.contractId,
            floorId: selectedRoom.floorId,
            roomId: selectedRoom.room.id,
            taskData: newTask
        });
        setIsAdding(false);
        setNewTask({ name: '', type: 'smr', package: '', groupId: '', volume: '', unit: 'шт', unit_power: '' });
    };

    const handleDeleteTask = (taskId) => {
        sysActions.confirm("Удаление", "Удалить позицию?", () => {
            actions.deleteItem('task', {
                buildingId: selectedRoom.buildingId, 
                contractId: selectedRoom.contractId,
                floorId: selectedRoom.floorId, 
                roomId: selectedRoom.room.id, 
                taskId
            });
        });
    };

    const resetFilters = () => {
        setFilterType('all');
        setFilterGroup('');
        setFilterPackage('');
        setSearchQuery('');
    };

    const toggleStatus = (taskId, field, currentVal) => {
        actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, field, currentVal);
    };

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" style={{width: 1100}} onClick={e => e.stopPropagation()}>
                
                {/* HEAD */}
                <div className="modal-top">
                    <div>
                        <div style={{fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase'}}>Карточка помещения</div>
                        <h2 style={{margin:'4px 0 0'}}>{selectedRoom.room.name}</h2>
                    </div>
                    <button className="close-btn" onClick={() => setSelectedRoom(null)}><X size={20}/></button>
                </div>

                {/* FILTERS */}
                <div style={{padding: '12px 24px', background: 'var(--bg-body)', borderBottom:'1px solid var(--border-color)', display:'flex', gap: 12, alignItems:'center', flexWrap:'wrap'}}>
                    <div style={{display:'flex', alignItems:'center', background:'var(--bg-card)', padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)'}}>
                        <Search size={16} color="var(--text-muted)"/>
                        <input className="sm-input" style={{border:'none', width:120}} placeholder="Поиск..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
                    </div>

                    <select className="sm-input" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                        <option value="all">Все типы (СМР + МТР)</option>
                        <option value="smr">Только СМР</option>
                        <option value="mtr">Только МТР (Материалы)</option>
                    </select>

                    <select className="sm-input" value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}>
                        <option value="">Все группы</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        <option value="uncategorized">Без группы</option>
                    </select>

                    <select className="sm-input" value={filterPackage} onChange={e=>setFilterPackage(e.target.value)}>
                        <option value="">Все пакеты</option>
                        {availablePackages.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <button className="text-btn" style={{fontSize:'0.85rem'}} onClick={resetFilters}>Сбросить фильтры</button>
                </div>

                {/* TABLE */}
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: 50}}>Тип</th>
                                <th style={{width: 100}}>Пакет</th>
                                <th>Наименование</th>
                                <th style={{width: 100}}>Объем</th>
                                <th style={{width: 140, textAlign:'center'}}>СМР / Наличие</th>
                                <th style={{width: 140, textAlign:'center'}}>ИД / Документы</th>
                                {hasEditRights && <th style={{width: 50}}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map(task => (
                                <tr key={task.id}>
                                    <td>
                                        <span style={{
                                            fontSize:'0.7rem', fontWeight:700, padding:'2px 6px', borderRadius:4,
                                            background: task.type==='mtr' ? '#fef3c7' : '#dbeafe',
                                            color: task.type==='mtr' ? '#d97706' : '#2563eb'
                                        }}>
                                            {task.type === 'mtr' ? 'МТР' : 'СМР'}
                                        </span>
                                    </td>
                                    <td style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{task.package || '-'}</td>
                                    <td style={{fontWeight:500}}>{task.name}</td>
                                    <td>
                                        {task.volume} <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{task.unit}{task.unit_power==='2'?'²':task.unit_power==='3'?'³':''}</span>
                                    </td>
                                    <td onClick={() => toggleStatus(task.id, 'work_done', task.work_done)} style={{cursor:'pointer', textAlign:'center'}}>
                                        <div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`} style={{width:32, height:32, margin:'0 auto'}}>
                                            {task.work_done && <Hammer size={16}/>}
                                        </div>
                                    </td>
                                    <td onClick={() => toggleStatus(task.id, 'doc_done', task.doc_done)} style={{cursor:'pointer', textAlign:'center'}}>
                                         <div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`} style={{width:32, height:32, margin:'0 auto'}}>
                                            {task.doc_done && <FileText size={16}/>}
                                        </div>
                                    </td>
                                    {hasEditRights && (
                                        <td>
                                            <button className="icon-btn-danger" onClick={()=>handleDeleteTask(task.id)}><Trash2 size={16}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredTasks.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:30}}>Нет данных по фильтрам</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* ADD FORM */}
                {hasEditRights && (
                    <div className="modal-footer">
                        {!isAdding ? (
                            <button className="action-btn primary" onClick={() => setIsAdding(true)}>
                                <PlusCircle size={18}/> Добавить позицию
                            </button>
                        ) : (
                            <form onSubmit={handleAddTask} style={{width:'100%', display:'flex', gap:10, alignItems:'center', background:'var(--bg-body)', padding:12, borderRadius:8}}>
                                <select className="sm-input" value={newTask.type} onChange={e=>setNewTask({...newTask, type: e.target.value})}>
                                    <option value="smr">СМР</option>
                                    <option value="mtr">МТР</option>
                                </select>
                                <input className="sm-input" placeholder="Пакет" style={{width:100}} value={newTask.package} onChange={e=>setNewTask({...newTask, package: e.target.value})}/>
                                <input className="sm-input" placeholder="Название" style={{flex:1}} required value={newTask.name} onChange={e=>setNewTask({...newTask, name: e.target.value})}/>
                                <select className="sm-input" value={newTask.groupId} onChange={e=>setNewTask({...newTask, groupId: e.target.value})}>
                                    <option value="">Группа...</option>
                                    {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <input type="number" className="sm-input" placeholder="Объем" style={{width:80}} value={newTask.volume} onChange={e=>setNewTask({...newTask, volume: e.target.value})}/>
                                <input className="sm-input" placeholder="Ед" style={{width:50}} value={newTask.unit} onChange={e=>setNewTask({...newTask, unit: e.target.value})}/>
                                <button type="submit" className="action-btn primary">OK</button>
                                <button type="button" className="action-btn secondary" onClick={() => setIsAdding(false)}>Отмена</button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomModal;