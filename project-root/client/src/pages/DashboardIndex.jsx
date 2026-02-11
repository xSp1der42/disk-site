import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Building2, Trash2 } from 'lucide-react';

const DashboardIndex = ({ buildings, user, actions, sysActions }) => {
    const navigate = useNavigate();
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [q, setQ] = useState('');

    const handleCreate = () => {
        sysActions.prompt("Новый объект", "Название объекта:", (name) => actions.createBuilding(name));
    };

    const handleDelete = (id) => {
        sysActions.confirm("Удаление", "Удалить объект?", () => actions.deleteItem('building', { buildingId: id }));
    };

    const filtered = buildings.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Главная</div>
                    <div className="control-value">Мои Объекты</div>
                </div>
                <div className="control-actions">
                     <div style={{display:'flex', alignItems:'center', background:'var(--bg-body)', padding:'6px 12px', borderRadius:8}}>
                        <Search size={16} color="var(--text-muted)"/>
                        <input className="sm-input" style={{border:'none', background:'transparent', width:150}} placeholder="Поиск..." value={q} onChange={e=>setQ(e.target.value)}/>
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
                    {filtered.map(b => (
                        <div key={b.id} className="project-card" onClick={() => navigate(`/dashboard/${b.id}`)}>
                            <div className="card-top">
                                <div style={{background: 'var(--bg-active)', padding: 12, borderRadius: 12}}>
                                    <Building2 size={32} color="var(--accent-primary)"/>
                                </div>
                                {hasEditRights && (
                                    <button className="icon-btn-danger" onClick={(e) => {e.stopPropagation(); handleDelete(b.id);}}>
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                            </div>
                            <h3>{b.name}</h3>
                            <div className="card-meta">
                                <span>Договоров: {b.contracts?.length || 0}</span>
                                <span className="arrow">→</span>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <div style={{padding:40, textAlign:'center', color:'var(--text-muted)'}}>Объектов не найдено</div>}
                </div>
            </div>
        </>
    );
};

export default DashboardIndex;