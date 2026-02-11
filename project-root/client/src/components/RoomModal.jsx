import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X, Search, Plus, Paperclip, File as FileIcon } from 'lucide-react';
import socket from '../utils/socket';
import { hasUnreadInTask } from '../utils/helpers';

const UNITS = ['шт', 'м', 'м²', 'м³', 'м.п.', 'компл', 'кг', 'т', 'упак', 'л'];

const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');
    return (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, padding: 16, width: 260, marginTop: 8 }} onClick={e => e.stopPropagation()}>
            <div style={{marginBottom: 10}}><label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Начало:</label><input type="date" className="sm-input" style={{width:'100%'}} value={start} onChange={e => setStart(e.target.value)} /></div>
            <div style={{marginBottom: 16}}><label style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Дедлайн:</label><input type="date" className="sm-input" style={{width:'100%'}} value={end} onChange={e => setEnd(e.target.value)} /></div>
            <div style={{display:'flex', gap: 8}}><button className="action-btn primary" style={{flex:1, padding: '8px'}} onClick={() => onSave(start, end)}>Сохранить</button><button className="action-btn secondary" style={{flex:1, padding: '8px'}} onClick={() => onSave(null, null)}>Сброс</button></div>
        </div>
    );
};

const ChatPopup = ({ task, currentUser, onAddComment, onClose }) => {
    const [text, setText] = useState('');
    const chatBodyRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight; }, [task.comments]);
    
    const handleSend = (e) => { 
        e.preventDefault(); 
        if (!text.trim()) return; 
        onAddComment(text, []); 
        setText(''); 
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Лимит 8MB для сокетов
        if (file.size > 8 * 1024 * 1024) {
            alert("Файл слишком большой (макс 8МБ)");
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const base64 = evt.target.result;
            // Отправляем как текст комментария + массив вложений
            onAddComment("📎 " + file.name, [{ name: file.name, data: base64, type: file.type }]);
        };
        reader.readAsDataURL(file);
    };

    const renderAttachment = (att) => {
        if (att.type.startsWith('image/')) {
            return (
                <div style={{marginTop: 5}}>
                    <img src={att.data} alt={att.name} style={{maxWidth: '100%', borderRadius: 8, cursor:'pointer'}} onClick={() => window.open(att.data)} />
                </div>
            );
        }
        return (
            <div style={{marginTop: 5, padding: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 6, fontSize: '0.85rem', display:'flex', alignItems:'center', gap:5}}>
                <FileIcon size={14}/>
                <a href={att.data} download={att.name} style={{color: 'inherit', textDecoration: 'underline', wordBreak:'break-all'}}>{att.name}</a>
            </div>
        );
    };

    return (
        <div style={{ position: 'absolute', top: '100%', right: -50, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', borderRadius: 12, width: 320, height: 400, display: 'flex', flexDirection: 'column', marginTop: 8 }} onClick={e => e.stopPropagation()}>
            <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}><span style={{fontWeight:600}}>Комментарии</span><button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer'}}><X size={16}/></button></div>
            <div ref={chatBodyRef} style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-body)'}}>
                {(!task.comments || task.comments.length === 0) && <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', marginTop: 20}}>Нет комментариев.</div>}
                {task.comments?.map(c => (
                    <div key={c.id} style={{ alignSelf: (c.author.includes(currentUser.surname) || c.role === currentUser.role) ? 'flex-end' : 'flex-start', maxWidth: '85%', background: (c.author.includes(currentUser.surname) || c.role === currentUser.role) ? 'var(--accent-primary)' : 'var(--bg-card)', color: (c.author.includes(currentUser.surname) || c.role === currentUser.role) ? 'white' : 'var(--text-main)', padding: '8px 12px', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                        <div style={{fontSize:'0.7rem', fontWeight:700, opacity: 0.8, marginBottom: 2}}>{c.author}</div>
                        <div style={{fontSize:'0.9rem'}}>{c.text}</div>
                        {c.attachments && c.attachments.map((att, i) => (
                            <div key={i}>{renderAttachment(att)}</div>
                        ))}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSend} style={{padding: 12, borderTop: '1px solid var(--border-color)', display:'flex', gap: 8, background: 'var(--bg-card)', alignItems: 'center'}}>
                <label style={{cursor:'pointer', color:'var(--text-muted)', padding: 4}} title="Прикрепить файл">
                    <Paperclip size={20}/>
                    <input type="file" style={{display:'none'}} ref={fileInputRef} onChange={handleFileSelect}/>
                </label>
                <input className="sm-input" style={{flex:1}} placeholder="Написать..." value={text} onChange={e => setText(e.target.value)} />
                <button type="submit" className="action-btn primary" style={{padding: '0 12px'}} disabled={!text.trim()}><Send size={16}/></button>
            </form>
        </div>
    );
};

const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, sysActions }) => {
    useEffect(() => {
        if (selectedRoom) localStorage.setItem(`viewed_room_${selectedRoom.room.id}`, new Date().toISOString());
    }, [selectedRoom]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterGroupId, setFilterGroupId] = useState('');
    
    const [isAddingSMR, setIsAddingSMR] = useState(false);
    const [newSMR, setNewSMR] = useState({ name: '', groupId: '', volume: '', unit: 'м²' });
    const [addingMTRForTask, setAddingMTRForTask] = useState(null); 
    const [newMTR, setNewMTR] = useState({ name: '', coefficient: '1', unit: 'шт' });
    const [editingTask, setEditingTask] = useState(null);
    const [editTaskData, setEditTaskData] = useState({ name: '', groupId: '', volume: '', unit: '' });
    
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    const [activeChatPopup, setActiveChatPopup] = useState(null);
    const canEditDates = ['admin', 'architect'].includes(currentUser.role);
    const [readState, setReadState] = useState(0); 

    const filteredTasks = useMemo(() => {
        let tasks = selectedRoom.room.tasks || [];
        if (filterGroupId) tasks = tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId);
        if (searchQuery) tasks = tasks.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return tasks;
    }, [selectedRoom.room.tasks, filterGroupId, searchQuery]);

    const groupedTasks = useMemo(() => {
        const result = {};
        groups.forEach(g => { result[g.id] = { name: g.name, tasks: [] }; });
        result['uncategorized'] = { name: 'Без группы', tasks: [] };
        filteredTasks.forEach(task => {
            const gid = task.groupId && result[task.groupId] ? task.groupId : 'uncategorized';
            result[gid].tasks.push(task);
        });
        return result;
    }, [filteredTasks, groups]);

    const handleAddSMR = (e) => { e.preventDefault(); actions.addTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, { ...newSMR, groupId: newSMR.groupId === 'uncategorized' ? '' : newSMR.groupId }); setIsAddingSMR(false); setNewSMR({ name: '', groupId: '', volume: '', unit: 'м²' }); };
    const handleAddMTR = (e, taskId) => { e.preventDefault(); socket.emit('add_material', { buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId: taskId, matName: newMTR.name, coefficient: newMTR.coefficient, unit: newMTR.unit, user: currentUser }); setAddingMTRForTask(null); setNewMTR({ name: '', coefficient: '1', unit: 'шт' }); };
    const handleDeleteMTR = (taskId, matId) => { socket.emit('delete_material', { buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId, matId, user: currentUser }); };
    const startEditing = (task) => { setEditingTask(task.id); setEditTaskData({ name: task.name, groupId: task.groupId || '', volume: task.volume, unit: task.unit || '' }); };
    const saveEditing = (taskId) => { actions.editTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, editTaskData); setEditingTask(null); };
    const handleDeleteTask = (taskId) => sysActions.confirm("Удаление", "Удалить работу?", () => actions.deleteItem('task', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId}));
    const handleDeleteRoom = () => sysActions.confirm("Удаление помещения", `Удалить "${selectedRoom.room.name}"?`, () => { actions.deleteItem('room', { buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id }); setSelectedRoom(null); });
    const handleRenameRoom = () => sysActions.prompt("Переименование", "Новое название:", (newName) => { if(newName !== selectedRoom.room.name) actions.renameItem('room', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id}, newName); }, selectedRoom.room.name);
    const handleSaveDates = (taskId, start, end) => { actions.updateTaskDates(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, { start, end }); setActiveDatePopup(null); };
    
    const handleAddComment = (taskId, text, attachments) => { 
        socket.emit('add_task_comment', { buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId, text, attachments, user: currentUser });
        markAsRead(taskId); 
    };
    
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : null;
    const markAsRead = (taskId) => { localStorage.setItem(`read_comments_${taskId}`, new Date().toISOString()); setReadState(prev => prev + 1); };
    
    const handleOpenChat = (taskId) => { 
        if (activeChatPopup === taskId) { 
            setActiveChatPopup(null); 
        } else { 
            setActiveDatePopup(null); 
            setActiveChatPopup(taskId); 
            markAsRead(taskId); 
        } 
    };

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" onClick={e => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(null); }}>
                <div className="modal-top">
                    <div style={{flex: 1}}>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, marginBottom: 4}}>Помещение</div>
                        <h2>{selectedRoom.room.name} {hasEditRights && <button className="icon-btn-edit" style={{marginLeft:12, padding: 8}} onClick={handleRenameRoom}><Pencil size={20}/></button>}</h2>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap: 20}}>
                        <div className="filter-dropdown-container">
                            <Search size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                            <input className="filter-select" style={{border:'none', outline:'none', background:'transparent', minWidth:'150px'}} placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="filter-dropdown-container">
                             <Layers size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                             <select className="filter-select" value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)}>
                                <option value="">Все работы</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                <option value="uncategorized">Без группы</option>
                            </select>
                        </div>
                        <button className="close-btn" onClick={() => setSelectedRoom(null)}>✕</button>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: '35%'}}>Наименование (СМР / МТР)</th>
                                <th style={{width: '15%'}}>Объем / Коэф.</th>
                                <th style={{width: '15%', textAlign: 'center'}}>Инфо</th>
                                <th style={{width: '15%', textAlign:'center'}}>СМР / Наличие</th>
                                <th style={{width: '15%', textAlign:'center'}}>ИД / Документы</th>
                                {hasEditRights && <th style={{width: '5%'}}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedTasks).map(([gid, group]) => {
                                if (group.tasks.length === 0) return null;
                                return (
                                    <React.Fragment key={gid}>
                                        <tr className="group-header-row"><td colSpan="6"><div style={{display:'flex', alignItems:'center', gap: 10}}><Layers size={16}/> {group.name}</div></td></tr>
                                        {group.tasks.map(task => {
                                            const dateStr = task.end_date ? formatDate(task.end_date) : null;
                                            const hasNewMsg = hasUnreadInTask(task);
                                            
                                            let statusColor = 'transparent';
                                            if (task.work_done && task.doc_done) statusColor = 'rgba(16, 185, 129, 0.1)'; 
                                            else if (task.work_done) statusColor = 'rgba(234, 179, 8, 0.1)'; 
                                            
                                            const isFullyDone = task.work_done && task.doc_done;
                                            const endDateObj = task.end_date ? new Date(task.end_date) : null;
                                            if(endDateObj) endDateObj.setHours(0,0,0,0);
                                            const now = new Date(); now.setHours(0,0,0,0);
                                            const isOverdue = endDateObj && endDateObj < now;
                                            let deadlineColor = 'var(--text-muted)';
                                            if (isFullyDone) deadlineColor = '#10b981'; else if (isOverdue) deadlineColor = '#ef4444';

                                            return (
                                                <React.Fragment key={task.id}>
                                                    <tr style={{background: statusColor}}>
                                                        <td>
                                                            {editingTask === task.id ? (
                                                                <div className="inline-edit-form">
                                                                    <input className="sm-input" style={{flex:1}} value={editTaskData.name} onChange={e=>setEditTaskData({...editTaskData, name: e.target.value})}/>
                                                                    <button className="move-btn" onClick={() => saveEditing(task.id)}>OK</button>
                                                                </div>
                                                            ) : (
                                                                <div style={{display:'flex', alignItems:'center', gap: 8}}>
                                                                    <span style={{fontWeight: 600, fontSize:'1rem', color:'var(--accent-primary)'}}>СМР</span>
                                                                    <div style={{display:'flex', flexDirection:'column'}}>
                                                                        <span>{task.name}</span>
                                                                        {dateStr && <span style={{fontSize:'0.75rem', color: deadlineColor, display:'flex', alignItems:'center', gap:4}}><Clock size={12}/> {dateStr}</span>}
                                                                    </div>
                                                                    {hasEditRights && <button className="icon-btn-edit" onClick={() => startEditing(task)}><Pencil size={12}/></button>}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {editingTask === task.id ? (
                                                                <div className="inline-edit-form">
                                                                    <input className="sm-input" style={{width:60}} type="number" value={editTaskData.volume} onChange={e=>setEditTaskData({...editTaskData, volume: e.target.value})}/>
                                                                    <select className="sm-input" style={{width:60}} value={editTaskData.unit} onChange={e=>setEditTaskData({...editTaskData, unit: e.target.value})}>
                                                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <div style={{fontWeight: 700}}>{task.volume} {task.unit}</div>
                                                            )}
                                                        </td>
                                                        <td style={{textAlign:'center'}}>
                                                            <div style={{display:'flex', gap: 4, justifyContent:'center', position: 'relative'}}>
                                                                <button className="move-btn" disabled={!canEditDates} style={{opacity: canEditDates?1:0.3}} onClick={(e) => { e.stopPropagation(); setActiveChatPopup(null); setActiveDatePopup(activeDatePopup === task.id ? null : task.id); }}><Calendar size={18}/></button>
                                                                {activeDatePopup === task.id && <DatePickerPopup task={task} onSave={(s, e) => handleSaveDates(task.id, s, e)} onClose={() => setActiveDatePopup(null)} />}
                                                                <button className="move-btn" style={{position:'relative'}} onClick={(e) => { e.stopPropagation(); handleOpenChat(task.id); }}>
                                                                    <MessageSquare size={18}/>
                                                                    {hasNewMsg && <span style={{position:'absolute', top:-2, right:-2, width:8, height:8, background:'#ef4444', borderRadius:'50%', border: '1px solid white'}}></span>}
                                                                </button>
                                                                {activeChatPopup === task.id && <ChatPopup task={task} currentUser={currentUser} onAddComment={(text, att) => handleAddComment(task.id, text, att)} onClose={() => setActiveChatPopup(null)} />}
                                                            </div>
                                                        </td>
                                                        <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                                                            <div className="checkbox-wrapper"><div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>{task.work_done && <Hammer size={20}/>}</div></div>
                                                        </td>
                                                        <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                                                            <div className="checkbox-wrapper"><div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>{task.doc_done && <FileText size={20}/>}</div></div>
                                                        </td>
                                                        {hasEditRights && <td style={{textAlign:'center'}}><button className="icon-btn-danger" onClick={() => handleDeleteTask(task.id)}><Trash2 size={16}/></button></td>}
                                                    </tr>

                                                    {task.materials && task.materials.map(mat => (
                                                        <tr key={mat.id} style={{background: '#fef9c3'}}>
                                                            <td style={{paddingLeft: 40}}>
                                                                <div style={{display:'flex', alignItems:'center', gap: 8}}>
                                                                    <span style={{fontWeight: 600, fontSize:'0.8rem', color:'#854d0e', padding:'2px 6px', background:'rgba(0,0,0,0.05)', borderRadius:4}}>МТР</span>
                                                                    <span>{mat.name}</span>
                                                                </div>
                                                            </td>
                                                            <td><div style={{fontSize:'0.9rem', color:'#854d0e'}}>Расх: {mat.coefficient} {mat.unit}<br/><b>Итого: {(task.volume * mat.coefficient).toFixed(2)} {mat.unit}</b></div></td>
                                                            <td colSpan="3"></td>
                                                            {hasEditRights && <td style={{textAlign:'center'}}><button className="icon-btn-danger" onClick={() => handleDeleteMTR(task.id, mat.id)}><Trash2 size={14}/></button></td>}
                                                        </tr>
                                                    ))}

                                                    {hasEditRights && (
                                                        <tr style={{background: 'var(--bg-card)'}}>
                                                            <td colSpan="6" style={{padding: '8px 32px'}}>
                                                                {addingMTRForTask === task.id ? (
                                                                    <form onSubmit={(e) => handleAddMTR(e, task.id)} style={{display:'flex', gap: 8, alignItems:'center', paddingLeft: 20}}>
                                                                        <span style={{fontSize:'0.8rem', fontWeight:600}}>МТР:</span>
                                                                        <input required placeholder="Название материала" className="sm-input" style={{flex:1}} value={newMTR.name} onChange={e=>setNewMTR({...newMTR, name: e.target.value})} />
                                                                        <input type="number" step="0.01" placeholder="Коэф" className="sm-input" style={{width:60}} value={newMTR.coefficient} onChange={e=>setNewMTR({...newMTR, coefficient: e.target.value})} />
                                                                        <select className="sm-input" style={{width:60}} value={newMTR.unit} onChange={e=>setNewMTR({...newMTR, unit: e.target.value})}>
                                                                             {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                                        </select>
                                                                        <button type="submit" className="action-btn primary" style={{padding:'4px 10px', fontSize:'0.8rem'}}>OK</button>
                                                                        <button type="button" className="action-btn secondary" onClick={() => setAddingMTRForTask(null)}>Отмена</button>
                                                                    </form>
                                                                ) : (
                                                                    <button className="text-btn" style={{fontSize:'0.8rem', paddingLeft: 20, display:'flex', alignItems:'center', gap:4}} onClick={() => setAddingMTRForTask(task.id)}>
                                                                        <Plus size={14}/> Добавить МТР
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
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
                            <>
                                <button className="action-btn primary" style={{padding: '12px 24px', fontSize: '1rem'}} onClick={() => setIsAddingSMR(true)}><PlusCircle size={20}/> Добавить СМР (Работу)</button>
                                <button className="text-btn-danger" onClick={handleDeleteRoom}>Удалить помещение</button>
                            </>
                        ) : (
                            <form onSubmit={handleAddSMR} className="add-task-form" style={{background:'var(--bg-body)', padding: 15, borderRadius: 12, width:'100%'}}>
                                <div style={{fontWeight:600, marginBottom:8}}>Новая работа (СМР):</div>
                                <div style={{display:'flex', gap: 10, width:'100%', alignItems: 'center'}}>
                                    <select required value={newSMR.groupId} onChange={e => setNewSMR({...newSMR, groupId: e.target.value})} style={{width: 180}}>
                                        <option value="">Выберите группу...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        <option value="uncategorized">Без группы</option>
                                    </select>
                                    <input required placeholder="Название работы" value={newSMR.name} onChange={e => setNewSMR({...newSMR, name: e.target.value})} style={{flex:1}} />
                                    <input type="number" placeholder="Объем" value={newSMR.volume} onChange={e => setNewSMR({...newSMR, volume: e.target.value})} style={{width: 80}} />
                                    <select value={newSMR.unit} onChange={e => setNewSMR({...newSMR, unit: e.target.value})} style={{width: 60, padding: 10, borderRadius:8, border:'1px solid var(--border-color)'}}>
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <button type="submit" className="action-btn primary">OK</button>
                                    <button type="button" className="action-btn secondary" onClick={() => setIsAddingSMR(false)}>✕</button>
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