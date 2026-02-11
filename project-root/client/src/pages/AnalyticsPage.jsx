import React, { useMemo } from 'react';
import { Download, Building2, TrendingUp, CheckCircle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AnalyticsPage = ({ buildings, user }) => {

    const analyticsData = useMemo(() => {
        let totalStats = { total: 0, work: 0, doc: 0 };
        
        const buildingStats = buildings.map(b => {
            let bTotal = 0, bWork = 0, bDoc = 0;
            // Проход по договорам
            (b.contracts || []).forEach(c => {
                c.floors.forEach(f => f.rooms.forEach(r => r.tasks.forEach(t => {
                    bTotal++;
                    if(t.work_done) bWork++;
                    if(t.doc_done) bDoc++;
                })));
            });
            totalStats.total += bTotal;
            totalStats.work += bWork;
            totalStats.doc += bDoc;

            return {
                name: b.name,
                total: bTotal,
                work: bWork,
                workPercent: bTotal ? Math.round((bWork/bTotal)*100) : 0
            };
        });

        return { totalStats, buildingStats };
    }, [buildings]);

    const handleGlobalExport = () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        window.open(`${apiUrl}/api/export/global?username=${user?.username}&role=${user?.role}`, '_blank');
    };

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            <div className="control-bar">
                <div className="control-group">
                    <div className="control-label">Аналитика</div>
                    <div className="control-value">Сводная статистика</div>
                </div>
                <div className="control-actions">
                     <button className="action-btn primary" onClick={handleGlobalExport}>
                        <Download size={20}/> Отчет (Excel)
                    </button>
                </div>
            </div>

            <div className="content-area" style={{padding: '32px'}}>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32}}>
                    <div className="project-card" style={{padding: 24}}>
                        <div style={{fontSize:'0.9rem', color:'var(--text-muted)', marginBottom:10}}>Всего позиций</div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)'}}>{analyticsData.totalStats.total}</div>
                    </div>
                    <div className="project-card" style={{padding: 24}}>
                        <div style={{fontSize:'0.9rem', color:'var(--text-muted)', marginBottom:10}}>Выполнено (СМР)</div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: '#166534'}}>{analyticsData.totalStats.work}</div>
                    </div>
                    <div className="project-card" style={{padding: 24}}>
                        <div style={{fontSize:'0.9rem', color:'var(--text-muted)', marginBottom:10}}>Сдано (ИД)</div>
                        <div style={{fontSize: '2rem', fontWeight: 800, color: '#ca8a04'}}>{analyticsData.totalStats.doc}</div>
                    </div>
                </div>

                <div className="project-card" style={{padding: 32, height: 400}}>
                    <h3>Прогресс по объектам</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.buildingStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip contentStyle={{background:'var(--bg-card)'}} />
                            <Legend />
                            <Bar dataKey="work" name="Выполнено" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total" name="Всего" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;