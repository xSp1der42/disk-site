import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Building2, TrendingUp, CheckCircle, FileText, ArrowRight, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

const AnalyticsPage = ({ buildings, user }) => {
    const navigate = useNavigate();
    const [chartType, setChartType] = useState('pie'); 

    const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const analyticsData = useMemo(() => {
        let totalStats = { total: 0, work: 0, doc: 0, vol: 0 };
        
        // ЗАЩИТА: (buildings || [])
        const safeBuildings = Array.isArray(buildings) ? buildings : [];

        const buildingStats = safeBuildings.map(b => {
            let bTotal = 0, bWork = 0, bDoc = 0;
            if (b.contracts) {
                b.contracts.forEach(c => {
                    if (c.floors) {
                        c.floors.forEach(f => {
                            if (f.rooms) {
                                f.rooms.forEach(r => {
                                    if (r.tasks) {
                                        r.tasks.forEach(t => {
                                            bTotal++;
                                            if(t.work_done) bWork++;
                                            if(t.doc_done) bDoc++;
                                            totalStats.vol += (t.volume || 0);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }

            totalStats.total += bTotal;
            totalStats.work += bWork;
            totalStats.doc += bDoc;

            return {
                name: b.name.length > 15 ? b.name.substring(0, 12) + '...' : b.name,
                full_name: b.name,
                id: b.id,
                total: bTotal,
                work: bWork,
                doc: bDoc,
                workPercent: bTotal ? Math.round((bWork/bTotal)*100) : 0,
                docPercent: bTotal ? Math.round((bDoc/bTotal)*100) : 0
            };
        });

        const pieData = [
            { name: 'Выполнено', value: totalStats.work },
            { name: 'В работе', value: totalStats.total - totalStats.work }
        ];

        return { totalStats, buildingStats, pieData };
    }, [buildings]);

    const PIE_COLORS = ['#10b981', '#94a3b8']; 

    const handleGlobalExport = () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const uName = user?.username || 'Admin';
        const uRole = user?.role || 'admin';
        window.open(`${apiUrl}/api/export/global?username=${uName}&role=${uRole}`, '_blank');
    };

    const totalPercent = analyticsData.totalStats.total 
        ? Math.round((analyticsData.totalStats.work / analyticsData.totalStats.total) * 100) 
        : 0;
        
    const safeBuildingsList = Array.isArray(buildings) ? buildings : [];

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Кабинет руководителя</div>
                    <div className="control-value">Сводная аналитика</div>
                </div>
                <div className="control-actions">
                     <button className="action-btn primary" onClick={handleGlobalExport} style={{display:'flex', alignItems:'center', gap:10}}>
                        <Download size={20}/> Скачать отчет (Excel)
                    </button>
                </div>
            </div>

            <div className="content-area" style={{padding: '32px'}}>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32}}>
                    <div className="project-card" style={{padding: 24}}>
                        <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 10}}>
                            <div style={{background: 'var(--bg-active)', padding: 10, borderRadius: 10}}><Building2 size={24} color="var(--accent-primary)"/></div>
                            <span style={{fontSize:'0.9rem', color:'var(--text-muted)', fontWeight:600}}>Объектов в работе</span>
                        </div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)'}}>{safeBuildingsList.length}</div>
                    </div>
                    
                    <div className="project-card" style={{padding: 24}}>
                        <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 10}}>
                            <div style={{background: 'rgba(147, 51, 234, 0.1)', padding: 10, borderRadius: 10}}><TrendingUp size={24} color="#9333ea"/></div>
                            <span style={{fontSize:'0.9rem', color:'var(--text-muted)', fontWeight:600}}>Всего задач</span>
                        </div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: '#9333ea'}}>{analyticsData.totalStats.total}</div>
                    </div>

                    <div className="project-card" style={{padding: 24}}>
                        <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 10}}>
                            <div style={{background: 'rgba(22, 101, 52, 0.1)', padding: 10, borderRadius: 10}}><CheckCircle size={24} color="#166534"/></div>
                            <span style={{fontSize:'0.9rem', color:'var(--text-muted)', fontWeight:600}}>Выполнено (СМР)</span>
                        </div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: '#166534'}}>{analyticsData.totalStats.work}</div>
                        <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                            {totalPercent}% от общего объема
                        </div>
                    </div>

                    <div className="project-card" style={{padding: 24}}>
                         <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 10}}>
                            <div style={{background: 'rgba(202, 138, 4, 0.1)', padding: 10, borderRadius: 10}}><FileText size={24} color="#ca8a04"/></div>
                            <span style={{fontSize:'0.9rem', color:'var(--text-muted)', fontWeight:600}}>Сдано (ИД)</span>
                        </div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: '#ca8a04'}}>{analyticsData.totalStats.doc}</div>
                         <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                            {analyticsData.totalStats.total ? Math.round((analyticsData.totalStats.doc/analyticsData.totalStats.total)*100) : 0}% подписано актов
                        </div>
                    </div>
                </div>

                <div className="project-card" style={{padding: 32, marginBottom: 32, minHeight: 450}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 24}}>
                        <h3 style={{margin:0, color: 'var(--text-main)'}}>Визуализация прогресса</h3>
                        <div style={{background:'var(--bg-body)', padding: 4, borderRadius: 8, display:'flex', gap: 4, border: '1px solid var(--border-color)'}}>
                            <button onClick={() => setChartType('pie')} style={{border:'none', background: chartType === 'pie' ? 'var(--bg-card)' : 'transparent', padding: '8px 16px', borderRadius: 6, cursor:'pointer', fontWeight: chartType === 'pie' ? 600 : 400, color: chartType === 'pie' ? 'var(--accent-primary)' : 'var(--text-muted)', boxShadow: chartType === 'pie' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', display:'flex', alignItems:'center', gap: 8}}>
                                <PieIcon size={18}/> Общий статус
                            </button>
                            <button onClick={() => setChartType('bar')} style={{border:'none', background: chartType === 'bar' ? 'var(--bg-card)' : 'transparent', padding: '8px 16px', borderRadius: 6, cursor:'pointer', fontWeight: chartType === 'bar' ? 600 : 400, color: chartType === 'bar' ? 'var(--accent-primary)' : 'var(--text-muted)', boxShadow: chartType === 'bar' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', display:'flex', alignItems:'center', gap: 8}}>
                                <BarChart2 size={18}/> По объектам
                            </button>
                        </div>
                    </div>

                    <div style={{width: '100%', height: 320, position:'relative'}}>
                        {chartType === 'pie' ? (
                            <div style={{width:'100%', height:'100%', position:'relative'}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={analyticsData.pieData} cx="50%" cy="50%" innerRadius={90} outerRadius={120} fill="#8884d8" paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270} stroke="var(--bg-card)">
                                            {analyticsData.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border-color)', color: 'var(--text-main)'}} itemStyle={{color:'var(--text-main)'}}/>
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: 'var(--text-muted)' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{position:'absolute', top:'42%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center', pointerEvents:'none'}}>
                                    <div style={{fontSize:'3rem', fontWeight:800, color:'var(--text-main)', lineHeight: 1}}>{totalPercent}%</div>
                                    <div style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:600, marginTop:5, textTransform:'uppercase'}}>Готовность</div>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analyticsData.buildingStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                    <XAxis dataKey="name" tick={{fontSize: 12, fill:'var(--text-muted)'}} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fontSize: 12, fill:'var(--text-muted)'}}/>
                                    <Tooltip cursor={{fill: 'var(--bg-active)'}} contentStyle={{background:'var(--bg-card)', borderColor:'var(--border-color)', borderRadius:8, color: 'var(--text-main)'}} itemStyle={{color:'var(--text-main)'}}/>
                                    <Legend iconType="circle" wrapperStyle={{ color: 'var(--text-muted)' }}/>
                                    <Bar dataKey="work" name="Выполнено" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="total" name="Всего задач" stackId="b" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <h3 style={{fontSize:'1.2rem', marginBottom: 20, display:'flex', alignItems:'center', gap:10, color: 'var(--text-main)'}}>
                    <FileText size={20} color="var(--accent-primary)"/> Детализация по объектам
                </h3>
                
                <div className="logs-table-wrapper" style={{overflow:'visible'}}>
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Название объекта</th>
                                <th>Прогресс СМР</th>
                                <th>Прогресс ИД</th>
                                <th style={{textAlign:'right'}}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyticsData.buildingStats.map(b => (
                                <tr key={b.id} style={{cursor:'pointer'}} onClick={() => navigate(`/dashboard/${b.id}`)}>
                                    <td style={{fontWeight:600, fontSize:'1rem'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                                            <div style={{width:36, height:36, background:'var(--bg-active)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
                                                <Building2 size={18} color="var(--accent-primary)"/>
                                            </div>
                                            {b.full_name}
                                        </div>
                                    </td>
                                    <td style={{verticalAlign:'middle'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                                            <div style={{flex:1, height:10, background:'var(--border-color)', borderRadius:5, overflow:'hidden', maxWidth: 180}}>
                                                <div style={{width:`${b.workPercent}%`, background:'#10b981', height:'100%'}}></div>
                                            </div>
                                            <span style={{fontWeight:700, width: 40, fontSize:'0.95rem'}}>{b.workPercent}%</span>
                                        </div>
                                    </td>
                                    <td style={{verticalAlign:'middle'}}>
                                         <div style={{display:'flex', alignItems:'center', gap:12}}>
                                            <div style={{flex:1, height:10, background:'var(--border-color)', borderRadius:5, overflow:'hidden', maxWidth: 180}}>
                                                <div style={{width:`${b.docPercent}%`, background:'#f59e0b', height:'100%'}}></div>
                                            </div>
                                            <span style={{fontWeight:700, width: 40, fontSize:'0.95rem'}}>{b.docPercent}%</span>
                                        </div>
                                    </td>
                                    <td style={{textAlign:'right'}}>
                                        <button className="move-btn" style={{marginLeft:'auto'}}><ArrowRight size={20}/></button>
                                    </td>
                                </tr>
                            ))}
                            {safeBuildingsList.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:20}}>Нет данных</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;