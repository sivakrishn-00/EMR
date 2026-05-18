import React from 'react';
import { Calendar, Activity, FlaskConical, Pill, Clock, Eye } from 'lucide-react';

const DashboardTab = ({ 
    patientData, 
    user, 
    formatDate, 
    handleTabChange, 
    stats, 
    selectedVisit, 
    setReportView 
}) => {
    return (
        <>
            <div className="a-greeting" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h1>Hello, {patientData.full_name?.split(' ')[0] || user?.username}</h1>
                <p style={{ margin:0 }}><Calendar size={14} color="#7c3aed" /> {formatDate(new Date(), { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
            </div>

            <div className="a-stats-grid">
                <div className="a-stat-card card-blue" onClick={() => handleTabChange('Records')}>
                    <div className="a-stat-header"><span>FACILITY VISITS</span><span className="a-badge">LIVE</span></div>
                    <div className="a-stat-val">{stats.total_visits}</div>
                    <div className="a-stat-icon"><Activity size={32} /></div>
                </div>
                <div className="a-stat-card card-green" onClick={() => handleTabChange('Records')}>
                    <div className="a-stat-header"><span>LABORATORY REPORTS</span><span className="a-badge">LIVE</span></div>
                    <div className="a-stat-val">{stats.total_lab_investigations}</div>
                    <div className="a-stat-icon"><FlaskConical size={32} /></div>
                </div>
                <div className="a-stat-card card-orange" onClick={() => handleTabChange('Records')}>
                    <div className="a-stat-header"><span>ACTIVE PRESCRIPTIONS</span><span className="a-badge">LIVE</span></div>
                    <div className="a-stat-val">{stats.total_active_prescriptions}</div>
                    <div className="a-stat-icon"><Pill size={32} /></div>
                </div>
                {patientData.allow_appointments !== false && (
                    <div className="a-stat-card card-purple" onClick={() => handleTabChange('Appointments')}>
                        <div className="a-stat-header"><span>TOTAL APPOINTMENTS</span><span className="a-badge">LIVE</span></div>
                        <div className="a-stat-val">{stats.total_appointments}</div>
                        <div className="a-stat-icon"><Calendar size={32} /></div>
                    </div>
                )}
            </div>

            <style>{`
                .a-dashboard-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                    width: 100%;
                    align-items: stretch;
                }
                @media (max-width: 1024px) {
                    .a-dashboard-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
            <div className="a-dashboard-grid">
                <div className="a-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                        <h3 className="a-card-title" style={{ margin:0 }}><Clock size={20} color="var(--admin-blue)" /> Latest Clinical Entry</h3>
                        <div style={{ fontSize:'0.7rem', fontWeight:800, color: 'var(--admin-blue)', background:'rgba(79,70,229,0.05)', padding:'4px 10px', borderRadius:'6px' }}>SECURE ARCHIVE</div>
                    </div>

                    {selectedVisit ? (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Registry Date</span>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color:'#0f172a', marginTop:'0.25rem' }}>{formatDate(selectedVisit.visit_date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Diagnosis</span>
                                    <div style={{ marginTop: '0.25rem', color: '#0f172a', fontWeight: 700, fontSize:'1.1rem' }}>{selectedVisit.consultation?.diagnosis || (selectedVisit.is_active ? "Pending Assessment" : "--")}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Visit Type</span>
                                    <div style={{ marginTop: '0.25rem', color: '#475569', fontWeight: 600, fontSize:'1.0rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedVisit.reason || "General Consultation"}</div>
                                </div>
                                <div style={{ textAlign:'right' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Registry Status</span>
                                    <div style={{ marginTop:'0.25rem' }}>
                                        <span style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 700, 
                                            color: selectedVisit.is_active ? '#d97706' : '#059669', 
                                            background: selectedVisit.is_active ? '#fef3c7' : '#d1fae5', 
                                            padding: '4px 10px', 
                                            borderRadius: '6px',
                                            display: 'inline-block'
                                        }}>
                                            {selectedVisit.is_active ? 'IN PROGRESS' : 'COMPLETED'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Clinical Workflow</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '0 5px' }}>
                                    <div style={{ position: 'absolute', top: '6px', left: '10px', right: '10px', height: '2px', background: '#f1f5f9', zIndex: 0 }}></div>
                                    <div style={{ 
                                        position: 'absolute', 
                                        top: '6px', 
                                        left: '10px', 
                                        width: !selectedVisit.is_active ? 'calc(100% - 20px)' : (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0) ? '66%' : selectedVisit.consultation ? '33%' : '0%', 
                                        height: '2px', 
                                        background: '#4338ca', 
                                        zIndex: 0, 
                                        transition: '0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}></div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#4338ca', border: '3px solid white', boxShadow: '0 0 0 2px #4338ca' }}></div>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#4338ca' }}>Vitals</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: selectedVisit.consultation ? '#4338ca' : '#cbd5e1', border: '3px solid white', boxShadow: selectedVisit.consultation ? '0 0 0 2px #4338ca' : 'none' }}></div>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: selectedVisit.consultation ? '#4338ca' : '#94a3b8' }}>Doctor</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0) ? '#4338ca' : '#cbd5e1', border: '3px solid white', boxShadow: (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0) ? '0 0 0 2px #4338ca' : 'none' }}></div>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0) ? '#4338ca' : '#94a3b8' }}>Diagnostic</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: !selectedVisit.is_active ? '#4338ca' : '#cbd5e1', border: '3px solid white', boxShadow: !selectedVisit.is_active ? '0 0 0 2px #4338ca' : 'none' }}></div>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: !selectedVisit.is_active ? '#4338ca' : '#94a3b8' }}>Released</span>
                                    </div>
                                </div>
                            </div>

                            <button className="btn-action btn-view" style={{ marginTop:'auto', width:'100%', justifyContent:'center', padding:'0.75rem', borderRadius: '8px' }} onClick={() => setReportView(selectedVisit)}>
                                <Eye size={16} /> Open Full Visit Details
                            </button>
                        </div>
                    ) : (
                        <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af', background:'#f9fafb', borderRadius:'12px', border:'1px dashed var(--border)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No recent activity found.</div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                    <div className="a-card" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                                <Activity size={16} />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Health Analytics</h3>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                                    <span>Profile Completion</span>
                                    <span>80%</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px' }}>
                                    <div style={{ width: '80%', height: '100%', background: '#7c3aed', borderRadius: '3px' }}></div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Last BP</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>120/80</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>NORMAL</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Heart Rate</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>72 bpm</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>IDEAL</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Blood Sugar</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>95 mg/dL</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>NORMAL</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Weight</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>68 kg</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>STABLE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DashboardTab;
