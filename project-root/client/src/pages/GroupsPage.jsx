import React, { useState } from 'react';
import { Search, PlusCircle, Trash2, Building2, ChevronUp, ChevronDown, Lock, Filter, FileText } from 'lucide-react';
import { getRoomStatus } from '../utils/helpers';
import socket from '../utils/socket';

const GroupsPage = ({ user, groups, actions, buildings, setSelectedRoom, filterGroupId, setFilterGroupId, sysActions }) => {
    
    // Состояние для поиска
    const [searchQuery, setSearchQuery] = useState('');

    const handleCreateGroup = () => {
        sysActions.prompt("Новая группа", "Название группы работ (например: Сантехника):", (name) => {
            actions.createGroup(name);
        });
    };

    const handleDeleteGroup = (id, name) => {
        sysActions.confirm("Удаление группы", `Удалить группу "${name}"? Связанные работы останутся без группы.`, () => {
            actions.deleteGroup(id);
        });
    };

    const handleMoveGroup = (groupId, direction) => {
        socket.emit('move_group', { groupId, direction, user });
    };

    // ЗАЩИТА: (groups || [])
    const safeGroups = Array.isArray(groups) ? groups : [];

    const filteredGroups = safeGroups.filter(g => 
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showSystemGroup = 'без группы'.includes(searchQuery.toLowerCase());
    const safeBuildings = Array.isArray(buildings) ? buildings : [];

    return (
        <div style={{height: '100%', display:'flex', flexDirection:'column'}}>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Справочник</div>
                    <div className="control-value">Группы работ и Сводка</div>
                </div>
                
                {/* ВОССТАНОВЛЕННЫЕ ФИЛЬТРЫ */}
                <div className="control-actions">
                     <div className="filter-dropdown-container">
                        <Filter size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                        <select 
                            className="filter-select"
                            value={filterGroupId} 
                            onChange={e => setFilterGroupId(e.target.value)}
                        >
                            <option value="">Все работы (Общий статус)</option>
                            {safeGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                            <option value="uncategorized">Без группы</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="content-area" style={{padding:0}}>
                <div className="split-layout">
                    {/* LEFT PANEL: GROUPS MANAGEMENT (Admin only) */}
                    <div className="panel-left" style={{padding: '24px', background: 'var(--bg-card)'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                            <h3 style={{margin:0, fontSize:'1.1rem'}}>Группы работ</h3>
                            <button className="action-btn primary" style={{padding: '8px 12px'}} onClick={handleCreateGroup}>
                                <PlusCircle size={16}/>
                            </button>
                        </div>

                        {/* Поисковая строка для групп */}
                        <div style={{position: 'relative', marginBottom: 16}}>
                            <Search size={16} style={{position:'absolute', left:10, top: 10, color:'var(--text-muted)'}}/>
                            <input 
                                className="search-input" 
                                style={{width: '100%', paddingLeft: 34}}
                                placeholder="Поиск работ..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="logs-table-wrapper" style={{boxShadow:'none', border:'none'}}>
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Название</th>
                                        <th style={{width:80, textAlign:'right'}}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {showSystemGroup && (
                                        <tr style={{background: 'var(--bg-hover)', opacity: 0.8}}>
                                            <td>
                                                <div style={{display:'flex', alignItems:'center', gap: 8}}>
                                                    <strong>Без группы</strong>
                                                    <span style={{fontSize:'0.7rem', border:'1px solid var(--border-color)', padding:'2px 6px', borderRadius:4, color:'var(--text-muted)'}}>Системная</span>
                                                </div>
                                            </td>
                                            <td style={{textAlign:'right', paddingRight: 20}}>
                                                <Lock size={16} color="var(--text-muted)"/>
                                            </td>
                                        </tr>
                                    )}

                                    {filteredGroups.map((g, idx) => (
                                        <tr key={g.id}>
                                            <td><strong>{g.name}</strong></td>
                                            <td style={{display: 'flex', gap: 4, justifyContent: 'flex-end'}}>
                                                <div className="move-btn-group">
                                                    <button 
                                                        className="move-btn" 
                                                        disabled={safeGroups.findIndex(x => x.id === g.id) === 0} 
                                                        onClick={() => handleMoveGroup(g.id, 'up')}
                                                    >
                                                        <ChevronUp size={16}/>
                                                    </button>
                                                    <button 
                                                        className="move-btn" 
                                                        disabled={safeGroups.findIndex(x => x.id === g.id) === safeGroups.length - 1} 
                                                        onClick={() => handleMoveGroup(g.id, 'down')}
                                                    >
                                                        <ChevronDown size={16}/>
                                                    </button>
                                                </div>
                                                <button className="icon-btn-danger" onClick={() => handleDeleteGroup(g.id, g.name)}>
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!showSystemGroup && filteredGroups.length === 0 && <tr><td colSpan="2" style={{textAlign:'center', padding: 20}}>Пусто</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RIGHT PANEL: TREE VIEW */}
                    <div className="panel-right" style={{padding: '24px'}}>
                         <h3 style={{margin:'0 0 16px 0', fontSize:'1.1rem'}}>Сводка по договорам</h3>
                         <div className="tree-container">
                            {safeBuildings.map(b => (
                                <div key={b.id} className="tree-building">
                                    <div className="tree-building-header">
                                        <Building2 size={20} color="var(--accent-primary)"/>
                                        {b.name}
                                    </div>
                                    <div style={{paddingLeft: 10, paddingRight: 10}}>
                                        {(b.contracts || []).map(c => (
                                            <div key={c.id} style={{marginTop: 10, borderLeft: '2px solid var(--border-color)', paddingLeft: 10, marginBottom: 10}}>
                                                <div style={{fontWeight: 600, color: 'var(--text-main)', display:'flex', alignItems:'center', gap: 6, marginBottom: 8}}>
                                                    <FileText size={16} color="var(--accent-secondary)"/>
                                                    {c.name}
                                                </div>
                                                <div className="tree-floors">
                                                    {(c.floors || []).map(f => (
                                                        <div key={f.id} className="tree-floor-row">
                                                            <div className="tree-floor-title">{f.name}</div>
                                                            <div className="tree-rooms-list">
                                                                {(f.rooms || []).map(r => (
                                                                    <div 
                                                                        key={r.id} 
                                                                        className={`tree-room-badge ${getRoomStatus(r, filterGroupId)}`}
                                                                        onClick={() => setSelectedRoom({ buildingId: b.id, contractId: c.id, floorId: f.id, room: r })}
                                                                    >
                                                                        {r.name}
                                                                    </div>
                                                                ))}
                                                                {(f.rooms || []).length === 0 && <span style={{fontSize:'0.8rem', color:'var(--text-light)'}}>Пусто</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(c.floors || []).length === 0 && <div style={{padding:10, color:'var(--text-muted)', fontSize: '0.85rem'}}>Нет этажей</div>}
                                                </div>
                                            </div>
                                        ))}
                                        {(b.contracts || []).length === 0 && <div style={{padding:15, color:'var(--text-muted)'}}>Нет договоров</div>}
                                    </div>
                                </div>
                            ))}
                            {safeBuildings.length === 0 && <div style={{textAlign:'center', marginTop: 40, color:'var(--text-muted)'}}>Нет объектов</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupsPage;