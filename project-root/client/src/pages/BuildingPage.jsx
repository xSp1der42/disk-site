import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, PlusCircle, Pencil, Trash2, FileText, ChevronUp, ChevronDown } from 'lucide-react';

const BuildingPage = ({ buildings, user, actions, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [q, setQ] = useState('');

    if (!building) return <div className="content-area">Объект не найден</div>;

    const handleAddContract = () => {
        sysActions.prompt("Новый договор", "Название (например: Отделочные работы):", (name) => {
            actions.addContract(building.id, name);
        });
    };

    const handleDelete = (cId) => {
        sysActions.confirm("Удаление", "Удалить договор и все данные внутри?", () => {
            actions.deleteItem('contract', { buildingId: building.id, contractId: cId });
        });
    };

    const handleRename = (cId, oldName) => {
        sysActions.prompt("Переименование", "Новое название:", (n) => {
            if(n!==oldName) actions.renameItem('contract', {buildingId: building.id, contractId: cId}, n);
        }, oldName);
    };

    const contracts = building.contracts || [];
    const filtered = contracts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

    // Подсчет статистики для карточки договора
    const getStats = (contract) => {
        let total = 0, work = 0, doc = 0;
        (contract.floors || []).forEach(f => {
            (f.rooms || []).forEach(r => {
                (r.tasks || []).forEach(t => {
                    total++;
                    if(t.work_done) work++;
                    if(t.doc_done) doc++;
                });
            });
        });
        const wp = total ? Math.round((work/total)*100) : 0;
        const dp = total ? Math.round((doc/total)*100) : 0;
        return { total, wp, dp };
    };

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Объект</div>
                    <div className="control-value">
                        <Building2 size={24} style={{verticalAlign:'middle', marginRight:10, color:'var(--accent-primary)'}}/> 
                        {building.name}
                    </div>
                </div>
                <div className="control-actions">
                    <div style={{display:'flex', alignItems:'center', background:'var(--bg-body)', padding:'6px 12px', borderRadius:8, marginRight: 10}}>
                        <FileText size={16} color="var(--text-muted)"/>
                        <input className="sm-input" style={{border:'none', background:'transparent', width:150}} placeholder="Найти договор..." value={q} onChange={e=>setQ(e.target.value)}/>
                    </div>

                    <button className="action-btn secondary" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={16}/> Назад
                    </button>
                    
                    {hasEditRights && (
                        <button className="action-btn primary" onClick={handleAddContract}>
                            <PlusCircle size={16}/> Договор
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                <div className="dashboard-grid">
                    {filtered.map((c, idx) => {
                        const stats = getStats(c);
                        return (
                            <div key={c.id} className="project-card" onClick={() => navigate(`/dashboard/${building.id}/contract/${c.id}`)}>
                                <div className="card-top">
                                    <div style={{background: 'var(--bg-active)', padding: 12, borderRadius: 12}}>
                                        <FileText size={32} color="var(--accent-secondary)"/>
                                    </div>
                                    {hasEditRights && (
                                        <div style={{display:'flex', gap:'5px'}} onClick={e => e.stopPropagation()}>
                                            <div className="move-btn-group">
                                                <button className="move-btn" disabled={idx===0} onClick={() => actions.reorderItem('contract', {buildingId: building.id}, idx, idx-1)}>
                                                    <ChevronUp size={16}/>
                                                </button>
                                                <button className="move-btn" disabled={idx===filtered.length-1} onClick={() => actions.reorderItem('contract', {buildingId: building.id}, idx, idx+1)}>
                                                    <ChevronDown size={16}/>
                                                </button>
                                            </div>
                                            <button className="icon-btn-edit" onClick={() => handleRename(c.id, c.name)}>
                                                <Pencil size={16}/>
                                            </button>
                                            <button className="icon-btn-danger" onClick={() => handleDelete(c.id)}>
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <h3>{c.name}</h3>

                                <div style={{marginBottom: 16}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom: 4, fontWeight:600, color:'var(--text-muted)'}}>
                                        <span>СМР</span>
                                        <span>{stats.wp}%</span>
                                    </div>
                                    <div style={{width:'100%', background:'var(--border-color)', height: 6, borderRadius: 3, overflow:'hidden', marginBottom: 8}}>
                                        <div style={{width: `${stats.wp}%`, background:'#10b981', height:'100%'}}></div>
                                    </div>
                                </div>
                                
                                <div className="card-meta">
                                    <span>Этажей: {c.floors?.length || 0}</span>
                                    <span className="arrow">→</span>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div style={{padding:40, textAlign:'center', color:'var(--text-muted)', gridColumn: '1 / -1'}}>
                            Нет договоров. Добавьте первый договор.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default BuildingPage;