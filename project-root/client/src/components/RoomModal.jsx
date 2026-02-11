import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import { ROLES_CONFIG } from '../utils/constants';

const POWERS = { '2': '²', '3': '³' };

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');

    return (
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, padding: 16, width: 260 }} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 12}}>
                <span style={{fontWeight:600, fontSize:'0.9rem'}}>Сроки выполнения</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:0}}><X size={16}/></button>
            </div>
            <div style={{marginBottom: 10}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:4}}>Начало:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div style={{marginBottom: 16}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:4}}>Окончание:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={end} onChange={e => setEnd(e.target.value)} />
            </div>
            <div style={{display:'flex', gap: 8}}>
                <button className="action-btn primary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(start, end)}>Сохранить</button>
                <button className="action-btn secondary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(null, null)}>Сброс</button>
            </div>
        </div>
    );
};

const ChatPopup = ({ task, currentUser, onAddComment, onClose }) => {
    const [text, setText] = useState('');
    const chatBodyRef = useRef(null);

    useEffect(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight; }, [task.comments]);
    const handleSend = (e) => { e.preventDefault(); if (!text.trim()) return; onAddComment(text); setText(''); };

    return (
        <div style={{ position: 'absolute', top: 40, right: -100, zIndex: 25, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, width: 320, height: 400, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:600, fontSize:'0.9rem'}}>Чат по задаче</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:0}}><X size={16}/></button>
            </div>
            <div ref={chatBodyRef} style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-body)'}}>
                {(!task.comments || task.comments.length === 0) && <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', marginTop: 20}}>Нет сообщений.</div>}
                {task.comments?.map(c => {
                    const isMe = c.author === `${currentUser.surname} ${currentUser.name}` || c.role === currentUser.role;
                    return (
                        <div key={c.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', color: isMe ? 'white' : 'var(--text-main)', padding: '8px 12px', borderRadius: 12, border: isMe ? 'none' : '1px solid var(--border-color)' }}>
                            <div style={{fontSize:'0.7rem', fontWeight:700, opacity: 0.8, marginBottom: 2, color: isMe ? 'white' : ROLES_CONFIG[c.role]?.color}}>{c.author} ({ROLES_CONFIG[c.role]?.label})</div>
                            <div style={{fontSize:'0.9rem', lineHeight: 1.4}}>{c.text}</div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={handleSend} style={{padding: 12, borderTop: '1px solid var(--border-color)', display:'flex', gap: 8, background: 'var(--bg-card)'}}>
                <input className="sm-input" style={{flex:1}} placeholder="Сообщение..." value={text} onChange={e => setText(e.target.value)} />
                <button type="submit" className="action-btn primary" style={{padding: '0 12px'}} disabled={!text.trim()}><Send size={16}/></button>
            </form>
        </div>
    );
};

// --- КОМПОНЕНТ СТРОКИ ЗАДАЧИ (СМР + МТР) ---
const TaskRow = ({ 
    task, groupId, editingTask, setEditingTask, editTaskData, setEditTaskData, 
    currentUser, hasEditRights, actions, selectedRoom, 
    activeDatePopup, setActiveDatePopup, activeChatPopup, setActiveChatPopup, 
    saveEditing, formatDate, groups, buildingContracts, filterType, sysActions 
}) => {
    const [expanded, setExpanded] = useState(false);
    const [isAddingMtr, setIsAddingMtr] = useState(false);
    const [newMtr, setNewMtr] = useState({ name: '', unit: 'шт', coefficient: '1' });

    // Обработчики МТР
    const handleAddMtr = (e) => {
        e.preventDefault();
        actions.addMtr(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, newMtr);
        setIsAddingMtr(false);
        setNewMtr({ name: '', unit: 'шт', coefficient: '1' });
        setExpanded(true); // Убедимся, что открыто
    };

    const handleDeleteMtr = (mtrId) => {
        sysActions.confirm("Удаление материала", "Удалить материал из списка?", () => {
            actions.deleteMtr(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, mtrId);
        });
    };

    // Определение цветов и статусов (старый код + новый UI)
    const isFullyDone = task.work_done && task.doc_done;
    const dateStr = task.end_date ? formatDate(task.end_date) : null;
    const now = new Date(); now.setHours(0,0,0,0);
    const endDateObj = task.end_date ? new Date(task.end_date) : null;
    if(endDateObj) endDateObj.setHours(0,0,0,0);
    const isOverdue = endDateObj && endDateObj < now;
    const deadlineColor = isFullyDone ? '#10b981' : (isOverdue ? '#ef4444' : 'var(--text-muted)');

    // Фильтрация отображения (СМР/МТР)
    // Если выбран фильтр "Только МТР", мы все равно показываем строку СМР, но сразу раскрытой и акцент на МТР?
    // Или скрываем СМР, если у нее нет МТР? (Логика фильтрации уже сделана в groupedTasks)
    
    // contract name for display
    const contractName = buildingContracts?.find(c => c.id === task.contractId)?.name;

    return (
        <>
            <tr className={`task-row ${expanded ? 'expanded' : ''}`}>
                <td style={{borderLeft: `4px solid ${expanded ? 'var(--accent-primary)' : 'transparent'}`}}>
                    {editingTask === task.id ? (
                        <div className="inline-edit-form" style={{flexWrap:'wrap'}}>
                            <input className="sm-input" style={{flex:1, minWidth:150}} value={editTaskData.name} onChange={e=>setEditTaskData({...editTaskData, name: e.target.value})} placeholder="Название"/>
                            <select className="sm-input" value={editTaskData.groupId} onChange={e=>setEditTaskData({...editTaskData, groupId: e.target.value})}>
                                <option value="">Без группы</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <select className="sm-input" value={editTaskData.contractId} onChange={e=>setEditTaskData({...editTaskData, contractId: e.target.value})}>
                                <option value="">Без договора</option>
                                {buildingContracts?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button className="move-btn" onClick={() => saveEditing(task.id)}>OK</button>
                        </div>
                    ) : (
                        <div style={{display:'flex', alignItems:'flex-start', gap: 10}}>
                            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
                                {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                            </button>
                            <div>
                                <div style={{fontWeight: 500, fontSize:'1rem'}}>{task.name}</div>
                                <div style={{display:'flex', gap: 10, fontSize:'0.7rem', marginTop: 4, color:'var(--text-muted)'}}>
                                    {contractName && <span style={{background:'var(--bg-active)', padding:'2px 6px', borderRadius:4, color:'var(--accent-primary)'}}>{contractName}</span>}
                                    {dateStr && <span style={{color: deadlineColor, display:'flex', alignItems:'center', gap:4}}><Clock size={12}/> {dateStr}</span>}
                                </div>
                            </div>
                            {hasEditRights && (
                                <div className="hover-tools" style={{marginLeft:'auto'}}>
                                    <button className="icon-btn-edit" onClick={() => {
                                        setEditingTask(task.id);
                                        setEditTaskData({ name: task.name, groupId: task.groupId || '', contractId: task.contractId || '', volume: task.volume, unit: task.unit || '', unit_power: task.unit_power || '' });
                                    }} title="Изменить"><Pencil size={14}/></button>
                                    <button className="icon-btn-danger" onClick={() => {
                                         sysActions.confirm("Удаление", "Удалить работу?", () => actions.deleteItem('task', {buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId: task.id}));
                                    }} title="Удалить"><Trash2 size={14}/></button>
                                </div>
                            )}
                        </div>
                    )}
                </td>
                
                <td>
                    {editingTask === task.id ? (
                        <div className="volume-edit-row">
                             <input className="sm-input" style={{width:60}} type="number" value={editTaskData.volume} onChange={e=>setEditTaskData({...editTaskData, volume: e.target.value})}/>
                             <input className="sm-input" style={{width:40}} value={editTaskData.unit} onChange={e=>setEditTaskData({...editTaskData, unit: e.target.value})}/>
                        </div>
                    ) : (
                        <div className="volume-cell">
                            <span className="volume-val">{task.volume > 0 ? task.volume : '—'}</span>
                            <span className="volume-unit">{task.unit || 'ед'}{POWERS[task.unit_power]}</span>
                        </div>
                    )}
                </td>

                <td style={{verticalAlign: 'middle', textAlign:'center'}}>
                    <div style={{display:'flex', gap: 8, justifyContent:'center', position: 'relative'}}>
                        <button className="move-btn" onClick={(e) => { e.stopPropagation(); setActiveChatPopup(null); setActiveDatePopup(activeDatePopup === task.id ? null : task.id); }} title="Сроки"><Calendar size={18}/></button>
                        {activeDatePopup === task.id && <DatePickerPopup task={task} onSave={(s, e) => { actions.updateTaskDates(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, { start: s, end: e }); setActiveDatePopup(null); }} onClose={() => setActiveDatePopup(null)} />}
                        
                        <button className="move-btn" onClick={(e) => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(activeChatPopup === task.id ? null : task.id); }} title="Комментарии"><MessageSquare size={18}/></button>
                        {activeChatPopup === task.id && <ChatPopup task={task} currentUser={currentUser} onAddComment={(text) => actions.addTaskComment(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, text)} onClose={() => setActiveChatPopup(null)} />}
                    </div>
                </td>
                
                <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                    <div className="checkbox-wrapper">
                        <div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>{task.work_done && <Hammer size={22} strokeWidth={3} />}</div>
                        <span className="check-label">{task.work_done ? 'Готово' : 'В работе'}</span>
                    </div>
                </td>

                <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                    <div className="checkbox-wrapper">
                        <div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>{task.doc_done && <FileText size={22} strokeWidth={3} />}</div>
                        <span className="check-label">{task.doc_done ? 'Сдано' : 'Нет акта'}</span>
                    </div>
                </td>
            </tr>

            {/* БЛОК МТР (МАТЕРИАЛЫ) */}
            {expanded && (
                <tr className="mtr-block-row">
                    <td colSpan="5" style={{padding: 0, borderBottom: '1px solid var(--border-color)'}}>
                        <div style={{padding: '12px 12px 12px 40px', background: 'var(--bg-hover)'}}>
                            <div style={{fontWeight:600, fontSize:'0.85rem', color:'var(--text-muted)', marginBottom: 8, display:'flex', alignItems:'center', gap:8}}>
                                <Package size={16}/> Материалы (МТР)
                            </div>
                            
                            <table style={{width:'100%', fontSize:'0.85rem', marginBottom: 10}}>
                                <thead>
                                    <tr style={{textAlign:'left', color:'var(--text-light)'}}>
                                        <th style={{paddingBottom:4}}>Наименование</th>
                                        <th style={{paddingBottom:4, width: 80}}>Ед.</th>
                                        <th style={{paddingBottom:4, width: 80}}>Коэф.</th>
                                        <th style={{paddingBottom:4, width: 100}}>Итого</th>
                                        <th style={{width: 40}}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {task.mtr && task.mtr.map(m => (
                                        <tr key={m.id} style={{borderBottom:'1px dashed var(--border-color)'}}>
                                            <td style={{padding: '6px 0'}}>{m.name}</td>
                                            <td>{m.unit}</td>
                                            <td>{m.coefficient}</td>
                                            <td style={{fontWeight:600}}>{m.total.toFixed(2)}</td>
                                            <td>
                                                {hasEditRights && <button className="icon-btn-danger" onClick={() => handleDeleteMtr(m.id)}><Trash2 size={12}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!task.mtr || task.mtr.length === 0) && !isAddingMtr && (
                                        <tr><td colSpan="5" style={{padding:'8px 0', color:'var(--text-light)', fontStyle:'italic'}}>Нет добавленных материалов</td></tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Форма добавления МТР */}
                            {hasEditRights && (
                                <div>
                                    {!isAddingMtr ? (
                                        <button className="text-btn" onClick={() => setIsAddingMtr(true)} style={{fontSize:'0.8rem'}}>+ Добавить МТР</button>
                                    ) : (
                                        <div style={{display:'flex', gap: 8, alignItems:'center', background:'var(--bg-card)', padding:8, borderRadius:8, border:'1px solid var(--border-color)'}}>
                                            <input className="sm-input" placeholder="Название материала" value={newMtr.name} onChange={e=>setNewMtr({...newMtr, name: e.target.value})} style={{flex:1}} autoFocus/>
                                            <input className="sm-input" placeholder="Ед" value={newMtr.unit} onChange={e=>setNewMtr({...newMtr, unit: e.target.value})} style={{width: 50}}/>
                                            <div style={{display:'flex', flexDirection:'column', width: 60}}>
                                                <span style={{fontSize:'0.6rem', color:'var(--text-muted)'}}>Коэф.</span>
                                                <input className="sm-input" type="number" value={newMtr.coefficient} onChange={e=>setNewMtr({...newMtr, coefficient: e.target.value})} style={{width: '100%'}}/>
                                            </div>
                                            <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                                                = {((parseFloat(newMtr.coefficient)||0) * task.volume).toFixed(1)}
                                            </div>
                                            <button className="action-btn primary" onClick={handleAddMtr} style={{padding:'4px 10px'}}>OK</button>
                                            <button className="icon-btn-danger" onClick={() => setIsAddingMtr(false)}><X size={16}/></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

const RoomModal = ({ 
    selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, 
    filterGroupId, filterContractId, filterType, sysActions 
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    // Добавили contractId в форму создания
    const [newTask, setNewTask] = useState({ name: '', groupId: '', contractId: '', volume: '', unit: 'м', unit_power: '2' });
    const [editTaskData, setEditTaskData] = useState({ name: '', groupId: '', contractId: '', volume: '', unit: '', unit_power: '' });
    
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    const [activeChatPopup, setActiveChatPopup] = useState(null);

    // Группировка и фильтрация
    const groupedTasks = useMemo(() => {
        const result = {};
        groups.forEach(g => { result[g.id] = { name: g.name, tasks: [] }; });
        result['uncategorized'] = { name: 'Без группы', tasks: [] };

        selectedRoom.room.tasks.forEach(task => {
            // Фильтр по Группе
            const gid = task.groupId && result[task.groupId] ? task.groupId : 'uncategorized';
            if (filterGroupId && filterGroupId !== '' && filterGroupId !== gid) return;

            // Фильтр по Договору
            const cid = task.contractId || 'uncategorized';
            if (filterContractId && filterContractId !== '' && filterContractId !== cid) return;
            
            // Фильтр по Типу (СМР/МТР)
            // Если "mtr", показываем только те задачи, где есть МТР? Или просто показываем структуру?
            // Оставим показ задач, но если МТР нет, задача будет пустой (но мы не скрываем задачи, так как МТР внутри них)
            
            result[gid].tasks.push(task);
        });

        if (filterGroupId && result[filterGroupId]) return { [filterGroupId]: result[filterGroupId] };
        return result;
    }, [selectedRoom.room.tasks, groups, filterGroupId, filterContractId]);

    const handleAddTask = (e) => {
        e.preventDefault();
        const groupIdToSend = newTask.groupId === 'uncategorized' ? '' : newTask.groupId;
        const contractIdToSend = newTask.contractId === 'uncategorized' ? '' : newTask.contractId;
        
        actions.addTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, {
            ...newTask,
            groupId: groupIdToSend,
            contractId: contractIdToSend
        });
        
        setIsAdding(false);
        setNewTask({ name: '', groupId: '', contractId: '', volume: '', unit: 'м', unit_power: '2' });
    };

    const saveEditing = (taskId) => {
        actions.editTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, taskId, editTaskData);
        setEditingTask(null);
    };

    const handleRenameRoom = () => {
        sysActions.prompt("Переименование", "Новое название помещения:", (newName) => {
             if(newName !== selectedRoom.room.name) actions.renameItem('room', {buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id}, newName);
        }, selectedRoom.room.name);
    }

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : null;

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" onClick={e => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(null); }}>
                <div className="modal-top">
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, marginBottom: 4}}>Карточка помещения</div>
                        <h2>
                            {selectedRoom.room.name}
                            {hasEditRights && <button className="icon-btn-edit" style={{marginLeft:12}} onClick={handleRenameRoom}><Pencil size={20}/></button>}
                        </h2>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:20}}>
                        <div style={{textAlign:'right'}}>
                            <div style={{fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600}}>СТАТУС</div>
                            <div className={`status-pill ${getRoomStatus(selectedRoom.room, filterGroupId)}`}>
                                {getRoomStatus(selectedRoom.room, filterGroupId) === 'status-green' ? 'ВЫПОЛНЕНО' : 'В РАБОТЕ'}
                            </div>
                        </div>
                        <button className="close-btn" onClick={() => setSelectedRoom(null)}>✕</button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: '35%'}}>Наименование работ</th>
                                <th style={{width: '10%'}}>Объем</th>
                                <th style={{width: '15%', textAlign: 'center'}}>Инфо</th>
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
                                        {group.tasks.map(task => (
                                            <TaskRow 
                                                key={task.id} task={task} groupId={gid}
                                                editingTask={editingTask} setEditingTask={setEditingTask}
                                                editTaskData={editTaskData} setEditTaskData={setEditTaskData}
                                                currentUser={currentUser} hasEditRights={hasEditRights} actions={actions}
                                                selectedRoom={selectedRoom} activeDatePopup={activeDatePopup} setActiveDatePopup={setActiveDatePopup}
                                                activeChatPopup={activeChatPopup} setActiveChatPopup={setActiveChatPopup}
                                                saveEditing={saveEditing} formatDate={formatDate}
                                                groups={groups} buildingContracts={selectedRoom.contracts}
                                                filterType={filterType} sysActions={sysActions}
                                            />
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {hasEditRights && (
                    <div className="modal-footer">
                        {!isAdding ? (
                            <>
                                <button className="action-btn primary" onClick={() => setIsAdding(true)}><PlusCircle size={20}/> Добавить работу</button>
                                <button className="text-btn-danger" onClick={() => sysActions.confirm("Удаление", `Удалить помещение "${selectedRoom.room.name}"?`, () => { actions.deleteItem('room', { buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id }); setSelectedRoom(null); })}>Удалить помещение</button>
                            </>
                        ) : (
                            <form onSubmit={handleAddTask} className="add-task-form" style={{background:'var(--bg-body)', padding: 15, borderRadius: 12, width:'100%'}}>
                                <div style={{fontWeight:600, marginBottom:8}}>Новая работа (СМР):</div>
                                <div style={{display:'flex', gap: 10, width:'100%', alignItems: 'center', flexWrap:'wrap'}}>
                                    <select required value={newTask.groupId} onChange={e => setNewTask({...newTask, groupId: e.target.value})} style={{width: 150}}>
                                        <option value="">Группа...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        <option value="uncategorized">Без группы</option>
                                    </select>

                                    {/* Выбор Договора */}
                                    <select required value={newTask.contractId} onChange={e => setNewTask({...newTask, contractId: e.target.value})} style={{width: 150}}>
                                        <option value="">Договор...</option>
                                        {selectedRoom.contracts?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        <option value="uncategorized">Без договора</option>
                                    </select>
                                    
                                    <input required placeholder="Название работы" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} style={{flex:1, minWidth:200}} />
                                    <input type="number" placeholder="Объем" value={newTask.volume} onChange={e => setNewTask({...newTask, volume: e.target.value})} style={{width: 80}} />
                                    <div style={{display:'flex', gap:2}}>
                                        <input placeholder="Ед." value={newTask.unit} onChange={e => setNewTask({...newTask, unit: e.target.value})} style={{width: 50, textAlign:'center'}} />
                                    </div>

                                    <button type="submit" className="action-btn primary">OK</button>
                                    <button type="button" className="action-btn secondary" onClick={() => setIsAdding(false)}>✕</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomModal;