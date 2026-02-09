import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, Trash2, Layers, Hammer, FileText, PlusCircle, Calendar, MessageSquare, Clock, Send, X } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import { ROLES_CONFIG } from '../utils/constants';

// Маппинг для красивого отображения степеней
const POWERS = {
    '2': '²',
    '3': '³'
};

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

// 1. Попап для Календаря
const DatePickerPopup = ({ task, onSave, onClose }) => {
    const [start, setStart] = useState(task.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '');
    const [end, setEnd] = useState(task.end_date ? new Date(task.end_date).toISOString().split('T')[0] : '');

    return (
        <div style={{
            position: 'absolute', top: 40, right: 0, zIndex: 20,
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
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:4}}>Окончание (Дедлайн):</label>
                <input type="date" className="sm-input" style={{width:'100%'}} value={end} onChange={e => setEnd(e.target.value)} />
            </div>

            <div style={{display:'flex', gap: 8}}>
                <button className="action-btn primary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(start, end)}>Сохранить</button>
                <button className="action-btn secondary" style={{flex:1, padding: '8px', fontSize:'0.85rem'}} onClick={() => onSave(null, null)}>Сброс</button>
            </div>
        </div>
    );
};

// 2. Попап для Чата (Комментарии)
const ChatPopup = ({ task, currentUser, onAddComment, onClose }) => {
    const [text, setText] = useState('');
    const chatBodyRef = useRef(null);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [task.comments]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAddComment(text);
        setText('');
    };

    return (
        <div style={{
            position: 'absolute', top: 40, right: -100, zIndex: 25,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)', borderRadius: 12, width: 320, height: 400,
            display: 'flex', flexDirection: 'column'
        }} onClick={e => e.stopPropagation()}>
            <div style={{padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:600, fontSize:'0.9rem'}}>Чат по задаче</span>
                <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', padding:0}}><X size={16}/></button>
            </div>

            <div ref={chatBodyRef} style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-body)'}}>
                {(!task.comments || task.comments.length === 0) && (
                    <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', marginTop: 20}}>
                        Нет сообщений. Напишите первое!
                    </div>
                )}
                {task.comments?.map(c => {
                    const isMe = c.author === `${currentUser.surname} ${currentUser.name}` || c.role === currentUser.role;
                    return (
                        <div key={c.id} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                            color: isMe ? 'white' : 'var(--text-main)',
                            padding: '8px 12px', borderRadius: 12,
                            borderBottomRightRadius: isMe ? 2 : 12,
                            borderBottomLeftRadius: isMe ? 12 : 2,
                            boxShadow: 'var(--shadow-sm)',
                            border: isMe ? 'none' : '1px solid var(--border-color)'
                        }}>
                            <div style={{fontSize:'0.7rem', fontWeight:700, opacity: 0.8, marginBottom: 2, color: isMe ? 'white' : ROLES_CONFIG[c.role]?.color}}>
                                {c.author} ({ROLES_CONFIG[c.role]?.label})
                            </div>
                            <div style={{fontSize:'0.9rem', lineHeight: 1.4}}>{c.text}</div>
                            <div style={{fontSize:'0.65rem', opacity: 0.7, textAlign:'right', marginTop: 4}}>
                                {new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleSend} style={{padding: 12, borderTop: '1px solid var(--border-color)', display:'flex', gap: 8, background: 'var(--bg-card)'}}>
                <input 
                    className="sm-input" 
                    style={{flex:1}} 
                    placeholder="Написать сообщение..." 
                    value={text} 
                    onChange={e => setText(e.target.value)}
                />
                <button type="submit" className="action-btn primary" style={{padding: '0 12px'}} disabled={!text.trim()}>
                    <Send size={16}/>
                </button>
            </form>
        </div>
    );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

const RoomModal = ({ selectedRoom, setSelectedRoom, hasEditRights, currentUser, actions, groups, filterGroupId, sysActions }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newTask, setNewTask] = useState({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    const [editTaskData, setEditTaskData] = useState({ name: '', groupId: '', volume: '', unit: '', unit_power: '' });
    
    // Состояние для активных попапов
    const [activeDatePopup, setActiveDatePopup] = useState(null);
    const [activeChatPopup, setActiveChatPopup] = useState(null);

    const canEditDates = ['admin', 'architect'].includes(currentUser.role);

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

        if (filterGroupId && result[filterGroupId]) return { [filterGroupId]: result[filterGroupId] };
        return result;
    }, [selectedRoom.room.tasks, groups, filterGroupId]);

    const handleAddTask = (e) => {
        e.preventDefault();
        const groupIdToSend = newTask.groupId === 'uncategorized' ? '' : newTask.groupId;
        
        actions.addTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, {
            ...newTask,
            groupId: groupIdToSend
        });
        
        setIsAdding(false);
        setNewTask({ name: '', groupId: '', volume: '', unit: 'м', unit_power: '2' });
    };

    const startEditing = (task) => {
        setEditingTask(task.id);
        setEditTaskData({ 
            name: task.name, 
            groupId: task.groupId || '', 
            volume: task.volume, 
            unit: task.unit || '', 
            unit_power: task.unit_power || '' 
        });
    };

    const saveEditing = (taskId) => {
        actions.editTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, taskId, editTaskData);
        setEditingTask(null);
    };

    const handleDeleteTask = (taskId) => {
        sysActions.confirm("Удаление работы", "Удалить эту работу из списка?", () => {
             actions.deleteItem('task', {buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id, taskId});
        });
    }

    const handleDeleteRoom = () => {
        sysActions.confirm("Удаление помещения", `Удалить помещение "${selectedRoom.room.name}"?`, () => {
            actions.deleteItem('room', { buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id });
            setSelectedRoom(null);
        });
    }

    const handleRenameRoom = () => {
        sysActions.prompt("Переименование", "Новое название помещения:", (newName) => {
             if(newName !== selectedRoom.room.name) actions.renameItem('room', {buildingId: selectedRoom.buildingId, floorId: selectedRoom.floorId, roomId: selectedRoom.room.id}, newName);
        }, selectedRoom.room.name);
    }
    
    const handleSaveDates = (taskId, start, end) => {
        actions.updateTaskDates(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, taskId, { start, end });
        setActiveDatePopup(null);
    };

    const handleAddComment = (taskId, text) => {
        actions.addTaskComment(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, taskId, text);
        markAsRead(taskId); 
    };

    const formatDate = (d) => {
        if (!d) return null;
        const date = new Date(d);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    };

    const hasUnreadComments = (task) => {
        if (!task.comments || task.comments.length === 0) return false;
        const lastReadTime = localStorage.getItem(`read_comments_${task.id}`);
        if (!lastReadTime) return true;
        return task.comments.some(c => new Date(c.timestamp) > new Date(lastReadTime));
    };

    const markAsRead = (taskId) => {
        localStorage.setItem(`read_comments_${taskId}`, new Date().toISOString());
    };

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
                    <div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, marginBottom: 4}}>
                            Карточка помещения
                        </div>
                        <h2>
                            {selectedRoom.room.name}
                            {hasEditRights && (
                                 <button className="icon-btn-edit" style={{marginLeft:12, padding: 8}} onClick={handleRenameRoom}>
                                    <Pencil size={20}/>
                                 </button>
                            )}
                        </h2>
                    </div>
                    
                    <div style={{display:'flex', alignItems:'center', gap:20}}>
                        <div style={{textAlign:'right'}}>
                            <div style={{fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600, marginBottom:4}}>СТАТУС ГОТОВНОСТИ</div>
                            <div className={`status-pill ${getRoomStatus(selectedRoom.room, filterGroupId)}`}>
                                {getRoomStatus(selectedRoom.room, filterGroupId) === 'status-green' ? 'ВСЁ ВЫПОЛНЕНО' : 
                                 getRoomStatus(selectedRoom.room, filterGroupId) === 'status-red' ? 'НЕ НАЧАТО' : 'В ПРОЦЕССЕ'}
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
                                <th style={{width: '20%', textAlign:'center'}}>
                                    СМР (Факт)
                                    <div style={{fontSize: '0.65rem', fontWeight: 400, opacity: 0.7, textTransform: 'none'}}>Работа выполнена?</div>
                                </th>
                                <th style={{width: '20%', textAlign:'center'}}>
                                    ИД (Документы)
                                    <div style={{fontSize: '0.65rem', fontWeight: 400, opacity: 0.7, textTransform: 'none'}}>Документы подписаны?</div>
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
                                            const isUnread = hasUnreadComments(task);
                                            
                                            // --- НОВАЯ ЛОГИКА ЦВЕТОВ ДЕДЛАЙНА ---
                                            const isFullyDone = task.work_done && task.doc_done;
                                            
                                            // Получаем дату окончания и сегодня, сбрасываем время в 00:00:00
                                            const endDateObj = task.end_date ? new Date(task.end_date) : null;
                                            const now = new Date();
                                            now.setHours(0,0,0,0);
                                            if(endDateObj) endDateObj.setHours(0,0,0,0);

                                            // Просрочено, если дата есть и она меньше сегодняшней
                                            const isOverdue = endDateObj && endDateObj < now;

                                            let deadlineColor = 'var(--text-muted)'; // Серый (по умолчанию)
                                            if (isFullyDone) {
                                                deadlineColor = '#10b981'; // Зеленый (Всё сдано)
                                            } else if (isOverdue) {
                                                deadlineColor = '#ef4444'; // Красный (Просрочено и не всё сдано)
                                            }
                                            // -------------------------------------

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
                                                                    {dateStr && (
                                                                        <span style={{fontSize:'0.75rem', color: deadlineColor, display:'flex', alignItems:'center', gap:4, marginTop: 4}}>
                                                                            <Clock size={12}/> Дедлайн: {dateStr}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {hasEditRights && (
                                                                    <div className="hover-tools">
                                                                        <button className="icon-btn-edit" onClick={() => startEditing(task)} title="Изменить"><Pencil size={14}/></button>
                                                                        <button className="icon-btn-danger" onClick={() => handleDeleteTask(task.id)} title="Удалить"><Trash2 size={14}/></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    
                                                    <td>
                                                        {editingTask === task.id ? (
                                                            <div className="volume-edit-row">
                                                                 <input 
                                                                    className="sm-input" 
                                                                    style={{width:60}} 
                                                                    type="number" 
                                                                    value={editTaskData.volume} 
                                                                    onChange={e=>setEditTaskData({...editTaskData, volume: e.target.value})}
                                                                 />
                                                                 <input 
                                                                    className="sm-input" 
                                                                    style={{width:40, textAlign:'center'}} 
                                                                    value={editTaskData.unit} 
                                                                    placeholder="Ед"
                                                                    onChange={e=>setEditTaskData({...editTaskData, unit: e.target.value})}
                                                                 />
                                                                 <select 
                                                                    className="sm-input" 
                                                                    style={{width:45, padding: '8px 2px'}}
                                                                    value={editTaskData.unit_power}
                                                                    onChange={e=>setEditTaskData({...editTaskData, unit_power: e.target.value})}
                                                                 >
                                                                    <option value="">-</option>
                                                                    <option value="2">²</option>
                                                                    <option value="3">³</option>
                                                                 </select>
                                                            </div>
                                                        ) : (
                                                            <div className="volume-cell">
                                                                <span className="volume-val">{task.volume > 0 ? task.volume : '—'}</span>
                                                                <span className="volume-unit">
                                                                    {task.unit || 'ед'}
                                                                    {POWERS[task.unit_power] || task.unit_power}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td style={{verticalAlign: 'middle', textAlign:'center'}}>
                                                        <div style={{display:'flex', gap: 8, justifyContent:'center', position: 'relative'}}>
                                                            
                                                            <button 
                                                                className="move-btn" 
                                                                disabled={!canEditDates}
                                                                style={{
                                                                    color: (isOverdue && !isFullyDone) ? '#ef4444' : (task.end_date ? 'var(--accent-primary)' : 'var(--text-light)'),
                                                                    background: task.end_date ? 'var(--bg-active)' : 'transparent',
                                                                    border: task.end_date ? '1px solid var(--border-color)' : 'none',
                                                                    opacity: canEditDates ? 1 : 0.3,
                                                                    cursor: canEditDates ? 'pointer' : 'not-allowed'
                                                                }}
                                                                onClick={(e) => {
                                                                    if (!canEditDates) return;
                                                                    e.stopPropagation();
                                                                    setActiveChatPopup(null);
                                                                    setActiveDatePopup(activeDatePopup === task.id ? null : task.id);
                                                                }}
                                                                title={canEditDates ? "Установить сроки" : "Только Проектировщик может менять сроки"}
                                                            >
                                                                <Calendar size={18}/>
                                                            </button>
                                                            {activeDatePopup === task.id && (
                                                                <DatePickerPopup task={task} onSave={(s, e) => handleSaveDates(task.id, s, e)} onClose={() => setActiveDatePopup(null)} />
                                                            )}

                                                            <button 
                                                                className="move-btn"
                                                                style={{
                                                                    position:'relative',
                                                                    color: (task.comments && task.comments.length > 0) ? 'var(--accent-secondary)' : 'var(--text-light)',
                                                                    background: (task.comments && task.comments.length > 0) ? '#fff7ed' : 'transparent',
                                                                    border: (task.comments && task.comments.length > 0) ? '1px solid #ffedd5' : 'none'
                                                                }} 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenChat(task.id);
                                                                }}
                                                                title="Комментарии"
                                                            >
                                                                <MessageSquare size={18}/>
                                                                {isUnread && <span style={{position:'absolute', top:-2, right:-2, width:8, height:8, background:'#ef4444', borderRadius:'50%', border: '1px solid white'}}></span>}
                                                            </button>
                                                            {activeChatPopup === task.id && (
                                                                <ChatPopup task={task} currentUser={currentUser} onAddComment={(text) => handleAddComment(task.id, text)} onClose={() => setActiveChatPopup(null)} />
                                                            )}
                                                        </div>
                                                    </td>
                                                    
                                                    <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'work_done', task.work_done)}>
                                                        <div className="checkbox-wrapper">
                                                            <div className={`checkbox-custom ${task.work_done ? 'cb-green' : ''}`}>
                                                                {task.work_done && <Hammer size={22} strokeWidth={3} />}
                                                            </div>
                                                            <span className="check-label">{task.work_done ? 'Готово' : 'В работе'}</span>
                                                        </div>
                                                    </td>

                                                    <td onClick={() => actions.toggleTask(selectedRoom.buildingId, selectedRoom.floorId, selectedRoom.room.id, task.id, 'doc_done', task.doc_done)}>
                                                        <div className="checkbox-wrapper">
                                                            <div className={`checkbox-custom ${task.doc_done ? 'cb-orange' : ''}`}>
                                                                {task.doc_done && <FileText size={22} strokeWidth={3} />}
                                                            </div>
                                                            <span className="check-label">{task.doc_done ? 'Сдано' : 'Нет акта'}</span>
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
                                    <PlusCircle size={20}/> Добавить работу
                                </button>
                                <button className="text-btn-danger" onClick={handleDeleteRoom}>Удалить это помещение</button>
                            </>
                        ) : (
                            <form onSubmit={handleAddTask} className="add-task-form" style={{background:'var(--bg-body)', padding: 15, borderRadius: 12, width:'100%'}}>
                                <div style={{fontWeight:600, marginBottom:8}}>Новая работа:</div>
                                <div style={{display:'flex', gap: 10, width:'100%', alignItems: 'center'}}>
                                    <select required value={newTask.groupId} onChange={e => setNewTask({...newTask, groupId: e.target.value})} style={{width: 180}}>
                                        <option value="">Выберите группу...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        <option value="uncategorized">Без группы</option>
                                    </select>
                                    
                                    <input required placeholder="Название работы" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} style={{flex:1}} />
                                    
                                    <input type="number" placeholder="Объем" value={newTask.volume} onChange={e => setNewTask({...newTask, volume: e.target.value})} style={{width: 80}} />
                                    
                                    <div style={{display:'flex', gap:2}}>
                                        <input 
                                            placeholder="Ед." 
                                            value={newTask.unit} 
                                            onChange={e => setNewTask({...newTask, unit: e.target.value})} 
                                            style={{width: 50, textAlign:'center'}} 
                                        />
                                        <select 
                                            value={newTask.unit_power} 
                                            onChange={e => setNewTask({...newTask, unit_power: e.target.value})}
                                            style={{width: 50, padding: '10px 4px'}}
                                        >
                                            <option value="">-</option>
                                            <option value="2">²</option>
                                            <option value="3">³</option>
                                        </select>
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