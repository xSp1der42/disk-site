import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, FileText, ArrowLeft, PlusCircle, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const BuildingPage = ({ buildings, user, actions, sysActions }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const building = buildings.find(b => b.id === id);
    const hasEditRights = ['admin', 'architect'].includes(user.role);
    const [searchQuery, setSearchQuery] = useState('');

    if (!building) {
        return <div className="content-area" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>Загрузка...</div>;
    }

    const handleAddContract = () => {
        sysActions.prompt("Новый договор", "Название (например: Отделка, Электрика):", (name) => {
            actions.createContract(building.id, name);
        });
    };

    const handleRenameContract = (contractId, oldName, e) => {
        e.stopPropagation();
        sysActions.prompt("Переименование", "Новое название договора:", (newName) => {
            if(newName !== oldName) actions.renameItem('contract', {buildingId: building.id, contractId}, newName);
        }, oldName);
    };

    const handleDeleteContract = (contractId, e) => {
        e.stopPropagation();
        sysActions.confirm("Удаление договора", "Удалить договор и все его этажи?", () => {
            actions.deleteItem('contract', { buildingId: building.id, contractId });
        });
    };

    // Статистика для карточки договора + уведомления
    const getContractStats = (contract) => {
        let total = 0, work = 0, doc = 0;
        let hasUnread = false;

        contract.floors.forEach(f => f.rooms.forEach(r => {
            // Проверка уведомлений
            if (r.tasks) {
                r.tasks.forEach(t => {
                    const lastRead = localStorage.getItem(`read_comments_${t.id}`);
                    if (t.comments && t.comments.length > 0) {
                        if (!lastRead || new Date(t.comments[t.comments.length-1].timestamp) > new Date(lastRead)) {
                            hasUnread = true;
                        }
                    }
                });
            }

            r.tasks.forEach(t => {
                total++; // Считаем задачи
                if (t.work_done) work++;
                if (t.doc_done) doc++;
            });
        }));

        return { 
            total, 
            workPercent: total ? Math.round((work/total)*100) : 0, 
            docPercent: total ? Math.round((doc/total)*100) : 0,
            hasUnread
        };
    };

    const filteredContracts = building.contracts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Объект</div>
                    <div className="control-value">
                        <span style={{display:'flex', alignItems:'center', gap:10}}>
                            <Building2 size={24} color="var(--accent-primary)"/> {building.name}
                        </span>
                    </div>
                </div>
                
                <div className="control-actions">
                    <button className="action-btn secondary" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={16} /> Назад
                    </button>
                    {hasEditRights && (
                        <button className="action-btn primary" onClick={handleAddContract}>
                            <PlusCircle size={18}/> Добавить договор
                        </button>
                    )}
                </div>
            </div>

            <div className="content-area">
                <h3 style={{marginTop:0, marginBottom: 20, color: 'var(--text-muted)'}}>Список договоров (Документы)</h3>
                <div className="dashboard-grid">
                    {filteredContracts.map((c, idx) => {
                        const stats = getContractStats(c);
                        return (
                            <div key={c.id} className="project-card" onClick={() => navigate(`/dashboard/${building.id}/${c.id}`)}>
                                {/* ИНДИКАТОР УВЕДОМЛЕНИЙ НА ДОГОВОРЕ */}
                                {stats.hasUnread && <div style={{position:'absolute', top: -5, right: -5, width: 14, height: 14, background: '#ef4444', borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 5}}></div>}
                                
                                <div className="card-top">
                                    <div style={{background: 'var(--bg-active)', padding: 12, borderRadius: 12}}>
                                        <FileText size={32} color="var(--accent-secondary)"/>
                                    </div>
                                    {hasEditRights && (
                                        <div style={{display:'flex', gap:'5px'}} onClick={e => e.stopPropagation()}>
                                            <div className="move-btn-group">
                                                <button className="move-btn" disabled={idx===0} 
                                                    onClick={() => actions.moveItem('contract', 'up', {buildingId: building.id, contractId: c.id})}>
                                                    <ChevronUp size={16}/>
                                                </button>
                                                <button className="move-btn" disabled={idx===filteredContracts.length-1} 
                                                    onClick={() => actions.moveItem('contract', 'down', {buildingId: building.id, contractId: c.id})}>
                                                    <ChevronDown size={16}/>
                                                </button>
                                            </div>
                                            <button className="icon-btn-edit" onClick={(e) => handleRenameContract(c.id, c.name, e)}>
                                                <Pencil size={16}/>
                                            </button>
                                            <button className="icon-btn-danger" onClick={(e) => handleDeleteContract(c.id, e)}>
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <h3 style={{marginBottom: 8}}>{c.name}</h3>

                                {/* Мини-статистика договора */}
                                <div style={{marginBottom: 16}}>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom: 4, fontWeight:600, color:'var(--text-muted)'}}>
                                        <span>СМР</span><span>{stats.workPercent}%</span>
                                    </div>
                                    <div style={{width:'100%', background:'var(--border-color)', height: 4, borderRadius: 2, overflow:'hidden', marginBottom: 8}}>
                                        <div style={{width: `${stats.workPercent}%`, background:'#10b981', height:'100%'}}></div>
                                    </div>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom: 4, fontWeight:600, color:'var(--text-muted)'}}>
                                        <span>ИД</span><span>{stats.docPercent}%</span>
                                    </div>
                                    <div style={{width:'100%', background:'var(--border-color)', height: 4, borderRadius: 2, overflow:'hidden'}}>
                                        <div style={{width: `${stats.docPercent}%`, background:'#f59e0b', height:'100%'}}></div>
                                    </div>
                                </div>

                                <div className="card-meta">
                                    <span>Этажей: {c.floors.length}</span>
                                    <span className="arrow">→</span>
                                </div>
                            </div>
                        );
                    })}
                    {filteredContracts.length === 0 && (
                        <div style={{gridColumn: '1 / -1', textAlign:'center', padding: 40, color:'var(--text-muted)', background:'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)'}}>
                            Нет договоров. Добавьте первый договор для начала работы.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default BuildingPage;