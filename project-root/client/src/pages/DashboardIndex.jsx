import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Building2, ChevronUp, ChevronDown, Pencil, Trash2, Layers, BarChart3 } from 'lucide-react';

const DashboardIndex = ({ buildings, user, actions, filterGroupId, setFilterGroupId, groups, sysActions }) => {
    const navigate = useNavigate();
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    
    // Состояние поиска объектов
    const [searchQuery, setSearchQuery] = useState('');

    const handleCreate = () => {
        sysActions.prompt("Новый объект", "Введите название дома (объекта):", (name) => {
             actions.createBuilding(name);
        });
    };

    const handleDelete = (id) => {
        sysActions.confirm("Удаление объекта", "Вы уверены? Это действие удалит дом и все связанные данные.", () => {
            actions.deleteItem('building', { buildingId: id });
        });
    }

    const handleRename = (id, oldName) => {
        sysActions.prompt("Переименование", "Новое название объекта:", (newName) => {
            if(newName !== oldName) actions.renameItem('building', {buildingId: id}, newName);
        }, oldName);
    }

    // Вспомогательная функция для расчета статистики
    const getBuildingStats = (b) => {
        let totalTasks = 0;
        let doneWork = 0;
        let doneDocs = 0;

        b.floors.forEach(f => {
            f.rooms.forEach(r => {
                r.tasks.forEach(t => {
                    totalTasks++;
                    if (t.work_done) doneWork++;
                    if (t.doc_done) doneDocs++;
                });
            });
        });

        const workPercent = totalTasks === 0 ? 0 : Math.round((doneWork / totalTasks) * 100);
        const docPercent = totalTasks === 0 ? 0 : Math.round((doneDocs / totalTasks) * 100);

        return { totalTasks, doneWork, doneDocs, workPercent, docPercent };
    };

    const filteredBuildings = buildings.filter(b => 
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Текущий раздел</div>
                    <div className="control-value">Все объекты (Аналитика)</div>
                </div>
                <div className="control-actions">
                    <div className="filter-dropdown-container" style={{paddingLeft: 8, paddingRight: 8}}>
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
                            <PlusCircle size={18}/> Добавить дом
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                <div className="dashboard-grid">
                    {filteredBuildings.map((b, idx) => {
                        const stats = getBuildingStats(b);
                        return (
                            <div key={b.id} className="project-card" onClick={() => navigate(`/dashboard/${b.id}`)}>
                                <div className="card-top">
                                    <div style={{background: 'var(--bg-active)', padding: 12, borderRadius: 12}}>
                                        <Building2 size={32} color="var(--accent-primary)"/>
                                    </div>
                                    {hasEditRights && (
                                        <div style={{display:'flex', gap:'5px'}} onClick={e => e.stopPropagation()}>
                                            <div className="move-btn-group">
                                                <button className="move-btn" disabled={idx===0} onClick={() => actions.moveItem('building', 'up', {buildingId: b.id})}>
                                                    <ChevronUp size={16}/>
                                                </button>
                                                <button className="move-btn" disabled={idx===filteredBuildings.length-1} onClick={() => actions.moveItem('building', 'down', {buildingId: b.id})}>
                                                    <ChevronDown size={16}/>
                                                </button>
                                            </div>
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
                                
                                {/* БЛОК АНАЛИТИКИ (Прогресс-бары) */}
                                <div style={{marginBottom: 16}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom: 4, fontWeight:600, color:'var(--text-muted)'}}>
                                        <span>СМР (Факт)</span>
                                        <span>{stats.workPercent}%</span>
                                    </div>
                                    <div style={{width:'100%', background:'var(--border-color)', height: 6, borderRadius: 3, overflow:'hidden', marginBottom: 8}}>
                                        <div style={{width: `${stats.workPercent}%`, background:'#10b981', height:'100%'}}></div>
                                    </div>

                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom: 4, fontWeight:600, color:'var(--text-muted)'}}>
                                        <span>ИД (Документы)</span>
                                        <span>{stats.docPercent}%</span>
                                    </div>
                                    <div style={{width:'100%', background:'var(--border-color)', height: 6, borderRadius: 3, overflow:'hidden'}}>
                                        <div style={{width: `${stats.docPercent}%`, background:'#f59e0b', height:'100%'}}></div>
                                    </div>
                                </div>

                                <div className="card-meta">
                                    <span><Layers size={14} style={{marginRight:5, verticalAlign:'text-bottom'}}/> Этажей: {b.floors.length}</span>
                                    <span className="arrow">→</span>
                                </div>
                            </div>
                        );
                    })}
                    {filteredBuildings.length === 0 && (
                        <div style={{textAlign:'center', padding: 40, color:'var(--text-muted)'}}>
                            {buildings.length === 0 ? "Список объектов пуст. Добавьте первый дом." : "Объекты не найдены."}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default DashboardIndex;