import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import { ROLES_CONFIG } from '../utils/constants';

const POWERS = { '2': '²', '3': '³' };

const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');
    return (
        <div style={{position: 'absolute', top: 40, right: 0, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, padding: 16, width: 260}} onClick={e => e.stopPropagation()}>
            <div style={{marginBottom: 10}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Начало:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div style={{marginBottom: 16}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Дедлайн:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={end} onChange={e => setEnd(e.target.value)} />
            </div>
            <div style={{display:'flex', gap: 8}}>
                <button className="action-btn primary" style={{flex:1}} onClick={() => onSave(start, end)}>Сохранить</button>
                <button className="action-btn secondary" style={{flex:1}} onClick={() => onSave(null, null)}>Сброс</button>
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
        <div style={{position: 'absolute', top: 40, right: -100, zIndex: 25, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, width: 320, height: 400, display: 'flex', flexDirection: 'column'}} onClick={e => e.stopPropagation()}>
            <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between'}}>
                <span style={{fontWeight:600}}>Чат</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer'}}><X size={16}/></button>
            </div>
            <div ref={chatBodyRef} style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-body)'}}>
                {task.comments?.map(c => {
                    const isMe = c.author === `${currentUser.surname} ${currentUser.name}` || c.role === currentUser.role;
                    return (
                        <div key={c.id} style={{alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', color: isMe ? 'white' : 'var(--text-main)', padding: '8px 12px', borderRadius: 12, boxShadow: 'var(--shadow-sm)'}}>
                            <div style={{fontSize:'0.7rem', fontWeight:700, opacity: 0.8, color: isMe ? 'white' : ROLES_CONFIG[c.role]?.color}}>{c.author}</div>
                            <div style={{fontSize:'0.9rem'}}>{c.text}</div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={handleSend} style={{padding: 12, borderTop: '1px solid var(--border-color)', display:'flex', gap: 8, background: 'var(--bg-card)'}}>
                <input className="sm-input" style={{flex:1}} value={text} onChange={e => setText(e.target.value)} placeholder="Сообщение..." />
                <button type="submit" className="action-btn primary"><Send size={16}/></button>
            </form>
        </div>
    );
};

const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, filterGroupId, sysActions }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newTask, setNewTask] = useState({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    const [editTaskData, setEditTaskData] = useState({ name: '', groupId: '', volume: '', unit: '', unit_power: '' });
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    const [activeChatPopup, setActiveChatPopup] = useState(null);
    const canEditDates = ['admin', 'architect'].includes(currentUser.role);

    const groupedTasks = useMemo(() => {
        const result = {};
        groups.forEach(g => { result[g.id] = { name: g.name, tasks: [] }; });
        result['uncategorized'] = { name: 'Без группы', tasks: [] };
        selectedRoom.room.tasks.forEach(task => {
            const gid = task.groupId && result[task.groupId] ? task.groupId : 'uncategorized';
            if (!filterGroupId || filterGroupId === gid) result[gid].tasks.push(task);
        });
        if (filterGroupId && result[filterGroupId]) return { [filterGroupId]: result[filterGroupId] };
        return result;
    }, [selectedRoom.room.tasks, groups, filterGroupId]);

    const handleAddTask = (e) => {
        e.preventDefault();
        actions.addTask(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, {
            ...newTask,
            groupId: newTask.groupId === 'uncategorized' ? '' : newTask.groupId
        });
        setIsAdding(false);
        setNewTask({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    };

    const startEditing = (task) => {
        setEditingTask(task.id);
        setEditTaskData({ name: task.name, groupId: task.groupId || '', volume: task.volume, unit: task.unit || '', unit_power: task.unit_power || '' });
    };
    const saveEditing = (taskId) => {
        actions.editTask(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, taskId, editTaskData);
        setEditingTask(null);
    };
    const handleDeleteTask = (taskId) => {
        sysActions.confirm("Удаление", "Удалить работу?", () => {
             actions.deleteItem('task', {buildingId: selectedRoom.buildingId, documentId: selectedRoom.documentId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId});
        });
    };
    const handleDeleteRoom = () => {
        sysActions.confirm("Удаление", "Удалить помещение?", () => {
            actions.deleteItem('room', { buildingId: selectedRoom.buildingId, documentId: selectedRoom.documentId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id });
            setSelectedRoom(null);
        });
    };
    const handleRenameRoom = () => {
        sysActions.prompt("Переименование", "Новое название:", (newName) => {
             if(newName !== selectedRoom.room.name) actions.renameItem('room', {buildingId: selectedRoom.buildingId, documentId: selectedRoom.documentId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id}, newName);
        }, selectedRoom.room.name);
    };

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" onClick={e => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(null); }}>
                <div className="modal-top">
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:700}}>КАРТОЧКА ПОМЕЩЕНИЯ</div>
                        <h2>{selectedRoom.room.name} {hasEditRights && <button className="icon-btn-edit" onClick={handleRenameRoom}><Pencil size={20}/></button>}</h2>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:20}}>
                         <div className={`status-pill ${getRoomStatus(selectedRoom.room, filterGroupId)}`}>
                             {getRoomStatus(selectedRoom.room, filterGroupId) === 'status-green' ? 'ГОТОВО' : 'В ПРОЦЕССЕ'}
                         </div>
                        <button className="close-btn" onClick={() => setSelectedRoom(null)}>✕</button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: '35%'}}>Работа</th>
                                <th style={{width: '10%'}}>Объем</th>
                                <th style={{width: '15%', textAlign: 'center'}}>Инфо</th>
                                <th style={{width: '20%', textAlign:'center'}}>СМР (Факт)</th>
                                <th style={{width: '20%', textAlign:'center'}}>ИД (Документы)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedTasks).map(([gid, group]) => {
                                if (group.tasks.length === 0) return null;
                                return (
                                    <React.Fragment key={gid}>
                                        <tr className="group-header-row"><td colSpan="5"><div style={{display:'flex', gap: 10}}><Layers size={16}/> {group.name}</div></td></tr>
                                        {group.tasks.map(task => (
                                            <tr key={task.id}>
                                                <td>
                                                    {editingTask === task.id ? (
                                                        <div className="inline-edit-form">
                                                            <input className="sm-input" style={{flex:1}} value={editTaskData.name} onChange={e=>setEditTaskData({...editTaskData, name: e.target.value})}/>
                                                            <button className="move-btn" onClick={() => saveEditing(task.id)}>OK</button>
                                                        </div>
                                                    ) : (
                                                        <div style={{display:'flex', justifyContent:'space-between'}}>
                                                            <div>
                                                                <div style={{fontWeight:500}}>{task.name}</div>
                                                                {task.end_date && <div style={{fontSize:'0.75rem', color: (new Date(task.end_date) < new Date() && !(task.work_done && task.doc_done)) ? '#ef4444' : 'var(--text-light)', marginTop:4}}><Clock size={12}/> {new Date(task.end_date).toLocaleDateString()}</div>}
                                                            </div>
                                                            {hasEditRights && <div className="hover-tools"><button className="icon-btn-edit" onClick={() => startEditing(task)}><Pencil size={14}/></button><button className="icon-btn-danger" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14}/></button></div>}
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
                                                        <div className="volume-cell"><span className="volume-val">{task.volume||'—'}</span><span className="volume-unit">{task.unit}{POWERS[task.unit_power]}</span></div>
                                                    )}
                                                </td>
                                                <td style={{textAlign:'center', verticalAlign:'middle'}}>
                                                    <div style={{display:'flex', gap:8, justifyContent:'center', position:'relative'}}>
                                                        <button className="move-btn" disabled={!canEditDates} onClick={(e) => { e.stopPropagation(); setActiveChatPopup(null); setActiveDatePopup(activeDatePopup === task.id ? null : task.id); }}><Calendar size={18}/></button>
                                                        {activeDatePopup === task.id && <DatePickerPopup task={task} onSave={(s,e) => { actions.updateTaskDates(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, task.id, {start:s, end:e}); setActiveDatePopup(null); }} onClose={() => setActiveDatePopup(null)} />}
                                                        
                                                        <button className="move-btn" style={{color: task.comments?.length > 0 ? 'var(--accent-secondary)' : ''}} onClick={(e) => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(activeChatPopup === task.id ? null : task.id); }}><MessageSquare size={18}/></button>
                                                        {activeChatPopup === task.id && <ChatPopup task={task} currentUser={currentUser} onAddComment={(text) => actions.addTaskComment(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, task.id, text)} onClose={() => setActiveChatPopup(null)} />}
                                                    </div>
                                                </td>
                                                <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                                                    <div className="checkbox-wrapper"><div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>{task.work_done && <Hammer size={22}/>}</div><span className="check-label">СМР</span></div>
                                                </td>
                                                <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.documentId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                                                    <div className="checkbox-wrapper"><div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>{task.doc_done && <FileText size={22}/>}</div><span className="check-label">ИД</span></div>
                                                </td>
                                            </tr>
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
                                <button className="text-btn-danger" onClick={handleDeleteRoom}>Удалить помещение</button>
                            </>
                        ) : (
                            <form onSubmit={handleAddTask} className="add-task-form" style={{background:'var(--bg-body)', padding: 15, borderRadius: 12, width:'100%'}}>
                                <select required value={newTask.groupId} onChange={e => setNewTask({...newTask, groupId: e.target.value})} style={{width: 180}}>
                                    <option value="">Выберите группу...</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    <option value="uncategorized">Без группы</option>
                                </select>
                                <input required placeholder="Название" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} style={{flex:1}} />
                                <input type="number" placeholder="Объем" value={newTask.volume} onChange={e => setNewTask({...newTask, volume: e.target.value})} style={{width: 80}} />
                                <div style={{display:'flex', gap:2}}>
                                    <input placeholder="Ед." value={newTask.unit} onChange={e => setNewTask({...newTask, unit: e.target.value})} style={{width: 50, textAlign:'center'}} />
                                    <select value={newTask.unit_power} onChange={e => setNewTask({...newTask, unit_power: e.target.value})} style={{width: 50}}><option value="">-</option><option value="2">²</option><option value="3">³</option></select>
                                </div>
                                <button type="submit" className="action-btn primary">OK</button>
                                <button type="button" className="action-btn secondary" onClick={() => setIsAdding(false)}>✕</button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default RoomModal;