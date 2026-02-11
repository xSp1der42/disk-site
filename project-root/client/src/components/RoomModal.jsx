import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X, Search, Package } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import { ROLES_CONFIG } from '../utils/constants';

const POWERS = { '2': '²', '3': '³' };

// --- POPUPS ---
const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');

    return (
        <div style={{
            position: 'absolute', top: 40, right: 0, zIndex: 30,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)', borderRadius: 12, padding: 16, width: 260
        }} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 12}}>
                <span style={{fontWeight:600, fontSize:'0.9rem'}}>Сроки выполнения</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:0}}><X size={16}/></button>
            </div>
            <div style={{marginBottom: 10}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:4}}>Начало:</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div style={{marginBottom: 16}}>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:4}}>Дедлайн:</label>
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
        <div style={{
            position: 'absolute', top: 40, right: -100, zIndex: 35,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)', borderRadius: 12, width: 320, height: 400,
            display: 'flex', flexDirection: 'column'
        }} onClick={e => e.stopPropagation()}>
            <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:600, fontSize:'0.9rem'}}>Чат</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:0}}><X size={16}/></button>
            </div>
            <div ref={chatBodyRef} style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-body)'}}>
                {(!task.comments || task.comments.length === 0) && <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', marginTop: 20}}>Нет сообщений.</div>}
                {task.comments?.map(c => {
                    const isMe = c.author === `${currentUser.surname} ${currentUser.name}` || c.role === currentUser.role;
                    return (
                        <div key={c.id} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%',
                            background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', color: isMe ? 'white' : 'var(--text-main)',
                            padding: '8px 12px', borderRadius: 12, boxShadow: 'var(--shadow-sm)', border: isMe ? 'none' : '1px solid var(--border-color)'
                        }}>
                            <div style={{fontSize:'0.7rem', fontWeight:700, opacity: 0.8, marginBottom: 2, color: isMe ? 'white' : ROLES_CONFIG[c.role]?.color}}>{c.author}</div>
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

// --- MAIN ---
const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, sysActions }) => {
    const [activeTab, setActiveTab] = useState('smr'); // 'smr' | 'mtr'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGroupId, setFilterGroupId] = useState('');
    
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    const [editingTask, setEditingTask] = useState(null);
    const [editTaskData, setEditTaskData] = useState({ name: '', groupId: '', volume: '', unit: '', unit_power: '' });
    
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    const [activeChatPopup, setActiveChatPopup] = useState(null);
    const canEditDates = ['admin', 'architect'].includes(currentUser.role);

    const filteredTasks = useMemo(() => {
        let tasks = selectedRoom.room.tasks || [];
        tasks = tasks.filter(t => (t.type || 'smr') === activeTab);
        if (filterGroupId) tasks = tasks.filter(t => (t.groupId || 'uncategorized') === filterGroupId);
        if (searchQuery) tasks = tasks.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return tasks;
    }, [selectedRoom.room.tasks, activeTab, filterGroupId, searchQuery]);

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

    const handleAddTask = (e) => {
        e.preventDefault();
        actions.addTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, {
            ...newTask,
            groupId: newTask.groupId === 'uncategorized' ? '' : newTask.groupId,
            type: activeTab
        });
        setIsAdding(false);
        setNewTask({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    };

    const startEditing = (task) => {
        setEditingTask(task.id);
        setEditTaskData({ name: task.name, groupId: task.groupId || '', volume: task.volume, unit: task.unit || '', unit_power: task.unit_power || '' });
    };

    const saveEditing = (taskId) => {
        actions.editTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, editTaskData);
        setEditingTask(null);
    };

    const handleDeleteTask = (taskId) => {
        sysActions.confirm("Удаление", "Удалить эту позицию?", () => {
             actions.deleteItem('task', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId});
        });
    }

    const handleDeleteRoom = () => {
        sysActions.confirm("Удаление помещения", `Удалить помещение "${selectedRoom.room.name}"?`, () => {
            actions.deleteItem('room', { buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id });
            setSelectedRoom(null);
        });
    }

    const handleRenameRoom = () => {
        sysActions.prompt("Переименование", "Новое название помещения:", (newName) => {
             if(newName !== selectedRoom.room.name) actions.renameItem('room', {buildingId: selectedRoom.buildingId, contractId: selectedRoom.contractId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id}, newName);
        }, selectedRoom.room.name);
    }
    
    const handleSaveDates = (taskId, start, end) => {
        actions.updateTaskDates(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, { start, end });
        setActiveDatePopup(null);
    };

    const handleAddComment = (taskId, text) => {
        actions.addTaskComment(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, taskId, text);
        markAsRead(taskId);
    };

    const formatDate = (d) => { if (!d) return null; return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); };

    const markAsRead = (taskId) => localStorage.setItem(`read_comments_${taskId}`, new Date().toISOString());

    const hasUnread = (task) => {
        if (!task.comments || task.comments.length === 0) return false;
        const lastRead = localStorage.getItem(`read_comments_${task.id}`);
        if (!lastRead) return true;
        return new Date(task.comments[task.comments.length-1].timestamp) > new Date(lastRead);
    }

    const resetFilters = () => { setSearchQuery(''); setFilterGroupId(''); };

    const handleOpenChat = (taskId) => {
        if (activeChatPopup === taskId) setActiveChatPopup(null);
        else { setActiveDatePopup(null); setActiveChatPopup(taskId); markAsRead(taskId); }
    };

    return (
        <div className="modal-backdrop" onClick={() => setSelectedRoom(null)}>
            <div className="modal-window" onClick={e => { e.stopPropagation(); setActiveDatePopup(null); setActiveChatPopup(null); }}>
                <div className="modal-top">
                    <div style={{flex: 1}}>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, marginBottom: 4}}>
                            Помещение
                        </div>
                        <h2>
                            {selectedRoom.room.name}
                            {hasEditRights && <button className="icon-btn-edit" style={{marginLeft:12, padding: 8}} onClick={handleRenameRoom}><Pencil size={20}/></button>}
                        </h2>
                    </div>
                    
                    <div style={{display:'flex', alignItems:'center', gap: 20}}>
                        <div className="filter-dropdown-container">
                            <Search size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                            <input className="filter-select" style={{border:'none', outline:'none', background:'transparent', minWidth:'150px'}}
                                placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="filter-dropdown-container">
                             <Layers size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                             <select className="filter-select" value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)}>
                                <option value="">Все группы</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                <option value="uncategorized">Без группы</option>
                            </select>
                        </div>
                        {(searchQuery || filterGroupId) && <button className="icon-btn-danger" onClick={resetFilters}><X size={18}/></button>}
                        <div className="divider" style={{width: 1, height: 30, background: 'var(--border-color)', margin: '0 10px'}}></div>
                        <button className="close-btn" onClick={() => setSelectedRoom(null)}>✕</button>
                    </div>
                </div>

                <div style={{padding: '16px 32px 0 32px'}}>
                    <div className="tab-switcher">
                        <button className={`tab-btn ${activeTab === 'smr' ? 'active' : ''}`} onClick={() => {setActiveTab('smr'); setIsAdding(false);}}>
                            <Hammer size={16} style={{verticalAlign: 'text-bottom', marginRight: 6}}/> СМР
                        </button>
                        <button className={`tab-btn ${activeTab === 'mtr' ? 'active' : ''}`} onClick={() => {setActiveTab('mtr'); setIsAdding(false);}}>
                            <Package size={16} style={{verticalAlign: 'text-bottom', marginRight: 6}}/> МТР
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{width: '35%'}}>Наименование</th>
                                <th style={{width: '10%'}}>Объем</th>
                                <th style={{width: '15%', textAlign: 'center'}}>Инфо</th>
                                <th style={{width: '20%', textAlign:'center'}}>
                                    {activeTab === 'smr' ? 'СМР (Факт)' : 'Наличие'}
                                </th>
                                <th style={{width: '20%', textAlign:'center'}}>
                                    {activeTab === 'smr' ? 'ИД (Доки)' : 'Качество'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedTasks).map(([gid, group]) => {
                                if (group.tasks.length === 0) return null;
                                return (
                                    <React.Fragment key={gid}>
                                        <tr className="group-header-row">
                                            <td colSpan="5">
                                                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                                                    <Layers size={16}/> {group.name}
                                                </div>
                                            </td>
                                        </tr>
                                        {group.tasks.map(task => {
                                            const dateStr = task.end_date ? formatDate(task.end_date) : null;
                                            const isFullyDone = task.work_done && task.doc_done;
                                            const endDateObj = task.end_date ? new Date(task.end_date) : null;
                                            if(endDateObj) endDateObj.setHours(0,0,0,0);
                                            const now = new Date(); now.setHours(0,0,0,0);
                                            const isOverdue = endDateObj && endDateObj < now;
                                            
                                            let deadlineColor = 'var(--text-muted)';
                                            if (isFullyDone) deadlineColor = '#10b981';
                                            else if (isOverdue) deadlineColor = '#ef4444';

                                            return (
                                                <tr key={task.id}>
                                                    <td>
                                                        {editingTask === task.id ? (
                                                            <div className="inline-edit-form">
                                                                <input className="sm-input" style={{flex:1}} value={editTaskData.name} onChange={e=>setEditTaskData({...editTaskData, name: e.target.value})} placeholder="Название"/>
                                                                <select className="sm-input" value={editTaskData.groupId} onChange={e=>setEditTaskData({...editTaskData, groupId: e.target.value})}>
                                                                    <option value="">Без группы</option>
                                                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                                </select>
                                                                <button className="move-btn" onClick={() => saveEditing(task.id)}>OK</button>
                                                            </div>
                                                        ) : (
                                                            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                                                                <div style={{display:'flex', flexDirection:'column'}}>
                                                                    <span style={{fontWeight: 500, fontSize:'1rem'}}>{task.name}</span>
                                                                    {dateStr && <span style={{fontSize:'0.75rem', color: deadlineColor, marginTop: 4, display:'flex', alignItems:'center', gap:4}}><Clock size={12}/> {dateStr}</span>}
                                                                </div>
                                                                {hasEditRights && (
                                                                    <div className="hover-tools">
                                                                        <button className="icon-btn-edit" onClick={() => startEditing(task)}><Pencil size={14}/></button>
                                                                        <button className="icon-btn-danger" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14}/></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {editingTask === task.id ? (
                                                            <div className="volume-edit-row">
                                                                 <input className="sm-input" style={{width:60}} type="number" value={editTaskData.volume} onChange={e=>setEditTaskData({...editTaskData, volume: e.target.value})}/>
                                                                 <input className="sm-input" style={{width:40, textAlign:'center'}} value={editTaskData.unit} onChange={e=>setEditTaskData({...editTaskData, unit: e.target.value})}/>
                                                            </div>
                                                        ) : (
                                                            <div className="volume-cell">
                                                                <span className="volume-val">{task.volume > 0 ? task.volume : '—'}</span>
                                                                <span className="volume-unit">{task.unit}{POWERS[task.unit_power]}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {/* КНОПКИ КАЛЕНДАРЯ И ЧАТА ВОЗВРАЩЕНЫ */}
                                                    <td style={{verticalAlign: 'middle', textAlign:'center'}}>
                                                        <div style={{display:'flex', gap: 8, justifyContent:'center', position: 'relative'}}>
                                                            <button 
                                                                className="move-btn" 
                                                                disabled={!canEditDates}
                                                                style={{
                                                                    color: (isOverdue && !isFullyDone) ? '#ef4444' : (task.end_date ? 'var(--accent-primary)' : 'var(--text-light)'),
                                                                    background: task.end_date ? 'var(--bg-active)' : 'transparent',
                                                                    border: task.end_date ? '1px solid var(--border-color)' : 'none',
                                                                    opacity: canEditDates ? 1 : 0.3
                                                                }}
                                                                onClick={(e) => { e.stopPropagation(); setActiveChatPopup(null); setActiveDatePopup(activeDatePopup === task.id ? null : task.id); }}
                                                            >
                                                                <Calendar size={18}/>
                                                            </button>
                                                            {activeDatePopup === task.id && <DatePickerPopup task={task} onSave={(s, e) => handleSaveDates(task.id, s, e)} onClose={() => setActiveDatePopup(null)} />}
                                                            
                                                            <button 
                                                                className="move-btn"
                                                                style={{
                                                                    position:'relative',
                                                                    color: (task.comments && task.comments.length > 0) ? 'var(--accent-secondary)' : 'var(--text-light)',
                                                                    background: (task.comments && task.comments.length > 0) ? '#fff7ed' : 'transparent',
                                                                    border: (task.comments && task.comments.length > 0) ? '1px solid #ffedd5' : 'none'
                                                                }} 
                                                                onClick={(e) => { e.stopPropagation(); handleOpenChat(task.id); }}
                                                            >
                                                                <MessageSquare size={18}/>
                                                                {hasUnread(task) && <span style={{position:'absolute', top:-2, right:-2, width:8, height:8, background:'#ef4444', borderRadius:'50%', border: '1px solid white'}}></span>}
                                                            </button>
                                                            {activeChatPopup === task.id && <ChatPopup task={task} currentUser={currentUser} onAddComment={(text) => handleAddComment(task.id, text)} onClose={() => setActiveChatPopup(null)} />}
                                                        </div>
                                                    </td>
                                                    
                                                    <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                                                        <div className="checkbox-wrapper">
                                                            <div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>
                                                                {task.work_done && (activeTab === 'smr' ? <Hammer size={22} strokeWidth={3} /> : <Package size={22} strokeWidth={3} />)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.contractId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                                                        <div className="checkbox-wrapper">
                                                            <div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>
                                                                {task.doc_done && <FileText size={22} strokeWidth={3} />}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
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
                        {!isAdding ? (
                            <>
                                <button className="action-btn primary" style={{padding: '12px 24px', fontSize: '1rem'}} onClick={() => setIsAdding(true)}>
                                    <PlusCircle size={20}/> Добавить {activeTab === 'smr' ? 'работу' : 'материал'}
                                </button>
                                <button className="text-btn-danger" onClick={handleDeleteRoom}>Удалить помещение</button>
                            </>
                        ) : (
                            <form onSubmit={handleAddTask} className="add-task-form" style={{background:'var(--bg-body)', padding: 15, borderRadius: 12, width:'100%'}}>
                                <div style={{fontWeight:600, marginBottom:8}}>Новая позиция ({activeTab.toUpperCase()}):</div>
                                <div style={{display:'flex', gap: 10, width:'100%', alignItems: 'center'}}>
                                    <select required value={newTask.groupId} onChange={e => setNewTask({...newTask, groupId: e.target.value})} style={{width: 180}}>
                                        <option value="">Выберите группу...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        <option value="uncategorized">Без группы</option>
                                    </select>
                                    <input required placeholder="Название" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} style={{flex:1}} />
                                    <input type="number" placeholder="Объем" value={newTask.volume} onChange={e => setNewTask({...newTask, volume: e.target.value})} style={{width: 80}} />
                                    <input placeholder="Ед." value={newTask.unit} onChange={e => setNewTask({...newTask, unit: e.target.value})} style={{width: 50, textAlign:'center'}} />
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