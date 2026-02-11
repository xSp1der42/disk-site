import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Building2, Pencil, Trash2, FileText } from 'lucide-react';
import { hasUnreadInBuilding } from '../utils/helpers';

const DashboardIndex = ({ buildings, user, actions, sysActions }) => {
    const navigate = useNavigate();
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [searchQuery, setSearchQuery] = useState('');

    const handleCreate = () => {
        sysActions.prompt("Новый объект", "Введите название объекта:", (name) => {
             actions.createBuilding(name);
        });
    };

    const handleDelete = (id) => {
        sysActions.confirm("Удаление объекта", "Вы уверены? Это действие удалит объект и все договоры.", () => {
            actions.deleteItem('building', { buildingId: id });
        });
    }

    const handleRename = (id, oldName) => {
        sysActions.prompt("Переименование", "Новое название объекта:", (newName) => {
            if(newName !== oldName) actions.renameItem('building', {buildingId: id}, newName);
        }, oldName);
    }

    const filteredBuildings = buildings.filter(b => 
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Текущий раздел</div>
                    <div className="control-value">Обзор объектов</div>
                </div>
                <div className="control-actions">
                    <div className="filter-dropdown-container">
                        <Search size={16} style={{marginRight: 8, color: 'var(--text-muted)'}} />
                        <input 
                             className="filter-select"
                             style={{border:'none', outline:'none', background:'transparent', minWidth:'200px', cursor: 'text'}}
                             placeholder="Поиск объекта..."
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {hasEditRights && (
                        <button className="action-btn primary" onClick={handleCreate}>
                            <PlusCircle size={18}/> Добавить объект
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                <div className="dashboard-grid">
                    {filteredBuildings.map((b) => {
                        // ПРОВЕРКА УВЕДОМЛЕНИЙ НА УРОВНЕ ОБЪЕКТА
                        const hasUnread = hasUnreadInBuilding(b);

                        return (
                            <div key={b.id} className="project-card" onClick={() => navigate(`/dashboard/${b.id}`)}>
                                {/* КРАСНАЯ ТОЧКА */}
                                {hasUnread && (
                                    <div style={{
                                        position:'absolute', top: -6, right: -6, 
                                        width: 16, height: 16, 
                                        background: '#ef4444', 
                                        borderRadius: '50%', 
                                        border: '2px solid var(--bg-body)', 
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)', 
                                        zIndex: 5
                                    }}></div>
                                )}
                                
                                <div className="card-top">
                                    <div style={{background: 'var(--bg-active)', padding: 12, borderRadius: 12}}>
                                        <Building2 size={32} color="var(--accent-primary)"/>
                                    </div>
                                    {hasEditRights && (
                                        <div style={{display:'flex', gap:'5px'}} onClick={e => e.stopPropagation()}>
                                            <button className="icon-btn-edit" onClick={() => handleRename(b.id, b.name)}>
                                                <Pencil size={16}/>
                                            </button>
                                            <button className="icon-btn-danger" onClick={() => handleDelete(b.id)}>
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <h3 style={{marginBottom: 8}}>{b.name}</h3>
                                <div className="card-meta">
                                    <span><FileText size={14} style={{marginRight:5, verticalAlign:'text-bottom'}}/> Договоров: {b.contracts.length}</span>
                                    <span className="arrow">→</span>
                                </div>
                            </div>
                        );
                    })}
                    {filteredBuildings.length === 0 && (
                        <div style={{textAlign:'center', padding: 40, color:'var(--text-muted)'}}>
                            {buildings.length === 0 ? "Список объектов пуст." : "Объекты не найдены."}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default DashboardIndex;