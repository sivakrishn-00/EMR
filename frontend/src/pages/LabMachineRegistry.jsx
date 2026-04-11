import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';
import { 
    HardDrive, 
    Link as LinkIcon, 
    RefreshCcw, 
    Search, 
    ShieldCheck, 
    AlertCircle,
    CheckCircle2,
    Database,
    ExternalLink,
    Activity,
    Clock,
    Wifi,
    WifiOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const LabMachineRegistry = () => {
    const [machines, setMachines] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [linking, setLinking] = useState(null);
    
    // Audit History State
    const [showAudit, setShowAudit] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [auditHistory, setAuditHistory] = useState([]);

    // Fetch both Machines and Projects for the Hub
    const fetchData = async () => {
        setLoading(true);
        try {
            const ts = new Date().getTime();
            const [machineRes, projectRes] = await Promise.all([
                api.get(`laboratory/machines/registry-list/?t=${ts}`),
                api.get('patients/projects/')
            ]);

            console.log("Registry Data Response:", machineRes.data);
            
            const machineData = Array.isArray(machineRes.data) ? machineRes.data : [];
            const projectData = Array.isArray(projectRes.data?.results) ? projectRes.data.results : 
                               Array.isArray(projectRes.data) ? projectRes.data : [];
            
            console.log(`BHSPL DEBUG - Found ${machineData.length} Hardware combos and ${projectData.length} Projects`);
            
            setMachines(machineData);
            setProjects(projectData);
            
        } catch (error) {
            console.error("Registry Fetch Error:", error);
            toast.error("Failed to load Registry Hub. Check API connectivity.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // 20s Background Heartbeat Refresh for Real-Time Status
        const interval = setInterval(fetchData, 20000);
        return () => clearInterval(interval);
    }, []);

    const handleLocalSelect = (machineId, projectId) => {
        setMachines(prev => prev.map(m => 
            m.id === machineId ? { ...m, project_id: projectId, is_linked: !!projectId } : m
        ));
    };

    const handleLinkProject = async (machineId, projectId) => {
        setLinking(machineId);
        try {
            await api.post('laboratory/machines/link_discovery/', {
                machine_db_id: machineId,
                project_id: projectId
            });
            
            toast.success("Machine configuration updated!");
            fetchData(); // Sync everything back from server
        } catch (error) {
            toast.error("Linking failed. Please try again.");
        } finally {
            setLinking(null);
        }
    };

    const fetchAuditHistory = async (machine) => {
        setSelectedMachine(machine);
        setShowAudit(true);
        setAuditLoading(true);
        try {
            const res = await api.get(`laboratory/machines/${machine.id}/sync-audit/`);
            setAuditHistory(res.data || []);
        } catch (err) {
            toast.error("Failed to fetch audit trail");
        } finally {
            setAuditLoading(false);
        }
    };

    const downloadAudit = (machineId) => {
        window.open(`/api/laboratory/machines/${machineId}/download-audit/`, '_blank');
    };

    const [filter, setFilter] = useState('ALL'); // ALL, ONLINE, OFFLINE, UNLINKED

    const filteredMachines = machines.filter(m => {
        const matchesSearch = (m.machine_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (m.machine_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (m.location?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        if (filter === 'ONLINE') return m.is_online;
        if (filter === 'OFFLINE') return !m.is_online && m.last_pulse;
        if (filter === 'UNLINKED') return !m.is_linked;
        return true;
    });

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', color: 'var(--text-main)', padding: '0 1rem' }}>
            {/* Header Area */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <MetricCard 
                    label="Station Total" 
                    value={machines.length} 
                    icon={<HardDrive size={24} />} 
                    gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
                />
                <MetricCard 
                    label="Online Hubs" 
                    value={machines.filter(m => m.is_online).length} 
                    icon={<Activity size={24} />} 
                    color="#4ade80" 
                    gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
                />
                <MetricCard 
                    label="Lost Signal" 
                    value={machines.filter(m => !m.is_online && m.last_pulse).length} 
                    icon={<Clock size={24} />} 
                    color="#f87171" 
                    gradient="linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)"
                />
            </div>

            {/* Controls Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface)', padding: '0.5rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                    <FilterBtn label="All" active={filter === 'ALL'} count={machines.length} onClick={() => setFilter('ALL')} />
                    <FilterBtn label="Online" active={filter === 'ONLINE'} count={machines.filter(m => m.is_online).length} color="#10b981" onClick={() => setFilter('ONLINE')} />
                    <FilterBtn label="Offline" active={filter === 'OFFLINE'} count={machines.filter(m => !m.is_online && m.last_pulse).length} color="#ef4444" onClick={() => setFilter('OFFLINE')} />
                    <FilterBtn label="Unlinked" active={filter === 'UNLINKED'} count={machines.filter(m => !m.is_linked).length} color="#f59e0b" onClick={() => setFilter('UNLINKED')} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flex: 1, maxWidth: '600px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                        <input 
                            type="text" 
                            placeholder="Network Search: ID, Name, or Location..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem 1rem 1rem 3.5rem',
                                borderRadius: '18px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-main)',
                                fontSize: '1rem',
                                fontWeight: 500,
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                            }}
                        />
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="action-btn"
                        style={{ 
                            background: 'var(--surface)', 
                            padding: '1rem 1.5rem', 
                            borderRadius: '18px', 
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                        }}
                    >
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Grid of Command Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
                {filteredMachines.length > 0 ? filteredMachines.map((m) => (
                    <div key={m.id} className="machine-card" style={{ 
                        background: 'var(--surface)', 
                        borderRadius: '24px', 
                        padding: '1.75rem',
                        border: '1px solid var(--border)',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                        position: 'relative',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        {/* Status Pulse */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ 
                                padding: '0.5rem 1rem', 
                                borderRadius: '30px', 
                                background: m.is_online ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)', 
                                color: m.is_online ? '#10b981' : '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <div style={{ 
                                    width: '8px', height: '8px', borderRadius: '50%', 
                                    background: m.is_online ? '#10b981' : '#94a3b8',
                                    animation: m.is_online ? 'pulse-glow 2s infinite' : 'none'
                                }}></div>
                                {m.is_online ? 'SYNC ACTIVE' : 'DISCONNECTED'}
                            </div>
                            
                            <div title="Last Pulse Time" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={14} />
                                {m.last_pulse ? new Date(m.last_pulse).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NA'}
                            </div>
                        </div>

                        {/* Identity */}
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>{m.machine_name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                <Database size={15} />
                                <span style={{ fontWeight: 600 }}>{m.lab_id}</span>
                                <span style={{ opacity: 0.4 }}>|</span>
                                <span>{m.location}</span>
                            </div>
                        </div>

                        {/* Project Linking Dropdown */}
                        <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>EMR Destination</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select 
                                    value={m.project_id || ''}
                                    onChange={(e) => handleLocalSelect(m.id, e.target.value)}
                                    style={{
                                        flex: 1, padding: '0.625rem', borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--surface)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.8125rem', outline: 'none'
                                    }}
                                >
                                    <option value="">{m.is_linked ? 'UNLINK' : 'Select Target...'}</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.id} - {p.name || p.project_name}</option>
                                    ))}
                                </select>
                                <button 
                                    onClick={() => handleLinkProject(m.id, m.project_id)}
                                    disabled={linking === m.id}
                                    style={{ 
                                        padding: '0.625rem', borderRadius: '10px', background: 'var(--primary)', color: 'white', 
                                        border: 'none', cursor: 'pointer', transition: 'transform 0.2s'
                                    }}
                                >
                                    <LinkIcon size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
                            <button 
                                onClick={() => fetchAuditHistory(m)}
                                style={{
                                    padding: '0.75rem', borderRadius: '14px', background: 'var(--background)', color: 'var(--text-main)',
                                    border: '1px solid var(--border)', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem'
                                }}
                            >
                                <Activity size={16} color="var(--primary)" />
                                Performance Audit
                            </button>
                            <button 
                                onClick={() => window.open(`/api/laboratory/machines/${m.id}/download-audit/`, '_blank')}
                                style={{
                                    width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s'
                                }}
                            >
                                <RefreshCcw size={18} />
                            </button>
                        </div>
                    </div>
                )) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '6rem', background: 'var(--surface)', borderRadius: '32px', border: '1px solid var(--border)' }}>
                        <Database size={64} style={{ marginBottom: '1.5rem', opacity: 0.1 }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>No Laboratory Signals Found</h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Make sure your machine bridge agents are running or adjust your filters.</p>
                    </div>
                )}
            </div>

            {/* Audit History Modal */}
            {showAudit && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: '30px', width: '100%', maxWidth: '950px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding: '2.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)' }}>
                            <div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <Activity size={28} color="var(--primary)" />
                                    Forensic Sync Audit
                                </h2>
                                <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                    Tracking 50 most recent pulses for <span style={{ color: 'var(--text-main)', fontWeight: 800 }}>{selectedMachine?.machine_name}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowAudit(false)}
                                style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 900 }}
                            >⨉</button>
                        </div>
                        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                            {auditLoading ? (
                                <div style={{ textAlign: 'center', padding: '5rem' }}>
                                    <RefreshCcw size={48} className="animate-spin" color="var(--primary)" />
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--background)' }}>
                                            <th style={smallHeadStyle}>TIMESTAMP</th>
                                            <th style={smallHeadStyle}>SENT BY LOCAL</th>
                                            <th style={smallHeadStyle}>RECEIVED BY EMR</th>
                                            <th style={smallHeadStyle}>SYSTEM STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditHistory.map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={smallCellStyle}>{new Date(log.received_at).toLocaleString()}</td>
                                                <td style={smallCellStyle}><span style={{ fontWeight: 800 }}>{log.batch_size}</span> records</td>
                                                <td style={smallCellStyle}><span style={{ color: '#10b981', fontWeight: 800 }}>{log.success_count}</span> records</td>
                                                <td style={smallCellStyle}>
                                                    <Badge text="SUCCESS" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div style={{ padding: '2rem', background: 'var(--background)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                            <button 
                                onClick={() => downloadAudit(selectedMachine?.id)}
                                style={{ padding: '1rem 3rem', borderRadius: '16px', background: '#10b981', color: 'white', border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}
                            >
                                📊 DOWNLOAD COMPREHENSIVE PERFORMANCE REPORT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .machine-card:hover { transform: translateY(-10px); border-color: var(--primary); box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.15); }
                .action-btn:active { transform: scale(0.95); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse-glow { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
            `}</style>
        </div>
    );
};

// Helper Components
const MetricCard = ({ label, value, icon, gradient, color }) => (
    <div style={{ 
        background: gradient || 'var(--surface)', 
        borderRadius: '16px', 
        padding: '0.75rem 1.125rem', 
        color: 'white',
        boxShadow: '0 6px 12px -3px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'transform 0.3s ease',
        cursor: 'default'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
        <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.4rem', borderRadius: '10px' }}>
                    {React.cloneElement(icon, { size: 14, strokeWidth: 3 })}
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>Live Pulse</div>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>{value}</div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{label}</div>
        </div>
        {/* Abstract Background Shapes */}
        <div style={{ position: 'absolute', right: '-10%', bottom: '-15%', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', zIndex: 1 }}></div>
    </div>
);

const FilterBtn = ({ label, active, count, color, onClick }) => (
    <button onClick={onClick} style={{
        padding: '0.6rem 1.25rem', borderRadius: '15px', border: 'none',
        background: active ? (color || 'var(--primary)') : 'transparent',
        color: active ? 'white' : 'var(--text-muted)',
        fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.2s'
    }}>
        {label}
        <span style={{ 
            padding: '0.1rem 0.6rem', borderRadius: '8px', 
            background: active ? 'rgba(255,255,255,0.2)' : 'rgba(148, 163, 184, 0.1)',
            fontSize: '0.75rem'
        }}>{count}</span>
    </button>
);

const Badge = ({ text }) => (
    <span style={{ padding: '0.4rem 0.8rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.7rem', fontWeight: 900 }}>{text}</span>
);

const tableHeadStyle = { padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tableCellStyle = { padding: '1.25rem 1.5rem', fontSize: '0.9375rem' };
const smallHeadStyle = { padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };
const smallCellStyle = { padding: '1.25rem', fontSize: '0.9375rem', color: 'var(--text-main)' };

export default LabMachineRegistry;
