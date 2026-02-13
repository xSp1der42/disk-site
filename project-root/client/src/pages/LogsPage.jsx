import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import socket from '../utils/socket';
import { ROLES_CONFIG } from '../utils/constants';

const LogsPage = ({ user }) => {
    const [logs, setLogs] = useState([]);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsSearch, setLogsSearch] = useState('');

    useEffect(() => {
        socket.emit('get_logs', { page: logsPage, search: logsSearch, user });
    }, [logsPage, logsSearch]);

    useEffect(() => {
        const handleLogsData = ({ logs, total }) => {
            setLogs(logs);
            setLogsTotal(total);
        };
        const handleNewLog = () => {
             if (logsPage === 1) socket.emit('get_logs', { page: 1, search: logsSearch, user });
        };

        socket.on('logs_data', handleLogsData);
        socket.on('new_log', handleNewLog);
        return () => {
            socket.off('logs_data', handleLogsData);
            socket.off('new_log', handleNewLog);
        };
    }, [logsPage, logsSearch, user]);

    const handleClearLogs = () => {
        if (window.confirm("Вы уверены? Это действие полностью очистит журнал событий.")) {
            socket.emit('clear_logs', { user });
        }
    };

    return (
        <div className="logs-container" style={{display:'flex', flexDirection:'column', height:'100%'}}>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Аудит системы</div>
                    <div className="control-value">Журнал действий ({logsTotal})</div>
                </div>
                
                {/* Кнопка очистки логов (только для Админа) */}
                {user.role === 'admin' && (
                    <div className="control-actions">
                        <button className="action-btn secondary" onClick={handleClearLogs} style={{color: '#ef4444', borderColor: '#ef4444'}}>
                            <Trash2 size={16} /> Очистить журнал
                        </button>
                    </div>
                )}
            </div>
            
            <div className="content-area" style={{display:'flex', flexDirection:'column'}}>
                <div className="logs-toolbar">
                     <div style={{position: 'relative'}}>
                        <Search size={16} style={{position:'absolute', left:12, top: 12, color:'var(--text-muted)'}}/>
                        <input 
                            className="search-input" 
                            placeholder="Поиск по событиям..." 
                            value={logsSearch}
                            onChange={e => { setLogsSearch(e.target.value); setLogsPage(1); }}
                        />
                     </div>
                     <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:10}}>
                         <span style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>Стр. {logsPage}</span>
                         <div style={{display:'flex', gap:5}}>
                             <button className="page-btn" disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)}><ChevronLeft size={16}/></button>
                             <button className="page-btn" disabled={logsPage >= Math.ceil(logsTotal / 50)} onClick={() => setLogsPage(p => p + 1)}><ChevronRight size={16}/></button>
                         </div>
                     </div>
                </div>

                <div className="logs-table-wrapper">
                    <table className="logs-table">
                        <thead>
                            <tr>
                                <th>Время</th>
                                <th>Пользователь</th>
                                <th>Роль</th>
                                <th>Действие</th>
                                <th>Детали</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx}>
                                    <td style={{whiteSpace:'nowrap', color:'var(--text-muted)'}}>{new Date(log.timestamp).toLocaleString('ru-RU')}</td>
                                    <td><strong>{log.username}</strong></td>
                                    <td><span className="role-tag" style={{borderColor: ROLES_CONFIG[log.role]?.color, color: ROLES_CONFIG[log.role]?.color}}>{ROLES_CONFIG[log.role]?.label}</span></td>
                                    <td>{log.action}</td>
                                    <td>{log.details}</td>
                                </tr>
                            ))}
                            {logs.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:30}}>Записей не найдено</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LogsPage;