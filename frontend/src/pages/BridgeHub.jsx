import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';
import { 
    Radio, 
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
    WifiOff,
    Shield,
    Terminal,
    Bell,
    Settings,
    RotateCcw,
    Zap,
    Cpu,
    ArrowUpRight,
    Lock,
    Info,
    Eye,
    EyeOff,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const BridgeHub = () => {
    const navigate = useNavigate();
    const [machines, setMachines] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('ALL');
    const [linking, setLinking] = useState(null);
    
    // Advanced Configuration States
    const [showConfig, setShowConfig] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showRotateBridgeConfirm, setShowRotateBridgeConfirm] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [machineIpList, setMachineIpList] = useState('');
    const [alertEmails, setAlertEmails] = useState('');
    const [downtimeThreshold, setDowntimeThreshold] = useState(5);
    const [auditLogs, setAuditLogs] = useState([]);
    const [projectBridge, setProjectBridge] = useState(null);
    const [showBridgeConfig, setShowBridgeConfig] = useState(false);
    const [bridgeTokenVisible, setBridgeTokenVisible] = useState(false);

    // Telemetry Stats
    const fetchData = async () => {
        setLoading(true);
        try {
            const ts = new Date().getTime();
            const [machineRes, projectRes] = await Promise.all([
                api.get(`laboratory/machines/registry-list/?t=${ts}`),
                api.get('patients/projects/')
            ]);
            
            setMachines(Array.isArray(machineRes.data) ? machineRes.data : []);
            setProjects(Array.isArray(projectRes.data?.results) ? projectRes.data.results : 
                       Array.isArray(projectRes.data) ? projectRes.data : []);

            
        } catch (error) {
            toast.error("Failed to sync with telemetry cloud.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // 10s Live Refresh
        return () => clearInterval(interval);
    }, []);

    // Handle Project Governance Bridge specifically
    useEffect(() => {
        if (selectedProjectFilter !== 'ALL' && selectedProjectFilter !== 'DETACHED') {
            const fetchBridge = async () => {
                try {
                    const bridgeRes = await api.get(`laboratory/project-bridge/get-by-project/?project=${selectedProjectFilter}`);
                    setProjectBridge(bridgeRes.data);
                } catch (e) {
                    setProjectBridge(null);
                }
            };
            fetchBridge();
        } else {
            setProjectBridge(null);
        }
    }, [selectedProjectFilter]);


    const fetchAudit = async (id) => {
        try {
            const res = await api.get(`laboratory/machines/${id}/sync-audit/`);
            setAuditLogs(res.data);
            setShowAudit(true);
        } catch (err) {
            toast.error("Cloud audit logs unavailable.");
        }
    };

    const handleResetAgent = async () => {
        setShowResetConfirm(false);
        const id = selectedMachine.id;
        try {
            await api.post(`laboratory/machines/${id}/rotate-key/`);
            await api.patch(`laboratory/machines/${id}/`, { maintenance_mode: true });
            toast.success("Remote Reset Command Dispatched");
        } catch (err) {
            toast.error("Failed to reach agent");
        }
    };

    const handleLinkProject = async (machineId, projectId) => {
        setLinking(machineId);
        try {
            await api.post('laboratory/machines/link_discovery/', {
                machine_db_id: machineId,
                project_id: projectId
            });
            toast.success("Signal Routed Successfully");
            fetchData();
        } catch (error) {
            toast.error("Routing Error");
        } finally {
            setLinking(null);
        }
    };

    const handleSaveBridgeSecurity = async () => {
        if (!projectBridge) return;
        setConfigLoading(true);
        try {
            await api.patch(`laboratory/project-bridge/${projectBridge.id}/`, {
                allowed_ips: machineIpList.split(',').map(ip => ip.trim()).filter(ip => ip),
                alert_emails: alertEmails,
                downtime_threshold: parseInt(downtimeThreshold) || 5
            });
            toast.success("Project Governance Policy Updated");
            setShowBridgeConfig(false);
            fetchData();
        } catch (err) {
            toast.error("Project policy update failed");
        } finally {
            setConfigLoading(false);
        }
    };

    const openBridgeSecurity = () => {
        if (!projectBridge) return;
        setMachineIpList(Array.isArray(projectBridge.allowed_ips) ? projectBridge.allowed_ips.join(', ') : '');
        setAlertEmails(projectBridge.alert_emails || '');
        setDowntimeThreshold(projectBridge.downtime_threshold || 5);
        setShowBridgeConfig(true);
    };

    const handleRotateBridgeKey = () => {
        setShowRotateBridgeConfirm(true);
    };

    const confirmRotateBridgeKey = async () => {
        try {
            const res = await api.post(`laboratory/project-bridge/${projectBridge.id}/rotate-key/`);
            setProjectBridge({ ...projectBridge, sync_key: res.data.sync_key });
            toast.success("Project Master Key Rotated");
        } catch (err) {
            toast.error("Rotation failed");
        } finally {
            setShowRotateBridgeConfirm(false);
        }
    };

    const filteredMachines = machines.filter(m => {
        const matchesSearch = (m.machine_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (m.machine_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (m.location?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        
        const matchesProject = selectedProjectFilter === 'ALL' || String(m.project_id) === String(selectedProjectFilter) || (selectedProjectFilter === 'DETACHED' && !m.project_id);
        
        if (!matchesSearch || !matchesProject) return false;
        if (filter === 'ONLINE') return m.is_online;
        if (filter === 'OFFLINE') return !m.is_online;
        return true;
    });

    return (
        <div className="fade-in" style={{ maxWidth: '1600px', margin: '0 auto', color: 'var(--text-main)', padding: '0 1.5rem' }}>
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.025em', color: '#0f172a' }}>EMR Central Bridge Hub</h1>
                    <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>Full-spectrum telemetry and connectivity management for all clinical hardware.</p>
                </div>
                <button 
                >
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
            </header>
            
            {/* PLATINUM HEADER: Telemetry Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                <TelemetryCard 
                    label="Station Total" 
                    value={machines.length} 
                    icon={<Cpu size={20} />} 
                    gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
                    subtext="Registered Assets"
                />
                <TelemetryCard 
                    label="Live Signal" 
                    value={machines.filter(m => m.is_online).length} 
                    icon={<Zap size={20} />} 
                    gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    subtext="Real-time Active"
                    pulse
                />
                <TelemetryCard 
                    label="Idle / Silent" 
                    value={machines.filter(m => !m.is_online && m.last_pulse).length} 
                    icon={<Clock size={20} />} 
                    gradient="linear-gradient(135deg, #64748b 0%, #475569 100%)"
                    subtext="Last Pulse > 90s"
                />
                <TelemetryCard 
                    label="Service Alerts" 
                    value={machines.filter(m => m.maintenance_mode).length} 
                    icon={<AlertCircle size={20} />} 
                    gradient="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                    subtext="Maintenance Required"
                />
            </div>

            {/* COMMAND BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '2rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ 
                        display: 'flex', gap: '0.4rem', background: '#f8fafc', padding: '0.5rem', 
                        borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' 
                    }}>
                        <FilterTab label="All Hubs" active={filter === 'ALL'} color="#475569" onClick={() => setFilter('ALL')} />
                        <FilterTab label="Active" active={filter === 'ONLINE'} color="#10b981" onClick={() => setFilter('ONLINE')} />
                        <FilterTab label="Suspended" active={filter === 'OFFLINE'} color="#ef4444" onClick={() => setFilter('OFFLINE')} />
                    </div>

                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e2e8f0', padding: '0 1rem', borderRadius: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <Database size={16} color="#64748b" />
                        <select 
                            value={selectedProjectFilter}
                            onChange={(e) => setSelectedProjectFilter(e.target.value)}
                            style={{ 
                                border: 'none', 
                                background: 'transparent', 
                                padding: '0.75rem 0',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                color: '#334155',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL">All Cloud Projects</option>
                            <option value="DETACHED">Detached Only</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search style={{ position: 'absolute', left: '1.125rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input 
                        type="text" 
                        placeholder="Search Station, Name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%', padding: '0.875rem 1rem 0.875rem 3.25rem', borderRadius: '16px',
                            border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontSize: '0.9rem',
                            fontWeight: 600, outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                    />
                </div>
            </div>

            {/* PROJECT GOVERNANCE CARD */}
            {projectBridge && (
                <div className="card fade-in" style={{ 
                    marginBottom: '1.5rem', 
                    padding: '1.5rem 2rem', 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    color: 'white',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', right: '-10px', top: '-30px', opacity: 0.05 }}>
                         <Shield size={140} />
                    </div>
                    
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.25rem' }}>
                            <ShieldCheck size={20} color="#10b981" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.01em' }}>Project Governance Master</h2>
                        </div>
                        <p style={{ opacity: 0.6, fontSize: '0.75rem', maxWidth: '400px', fontWeight: 600 }}>
                            Centralized security policy for {projectBridge.project_name}. Master Key manages {machines.filter(m => String(m.project_id) === String(selectedProjectFilter)).length} machines.
                        </p>
                        
                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '2rem' }}>
                             <div>
                                <label style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.1em' }}>Master Sync Key</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                    <code style={{ 
                                        background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px', 
                                        fontSize: '0.8125rem', color: '#818cf8', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)',
                                        fontFamily: 'JetBrains Mono, monospace'
                                    }}>
                                        {bridgeTokenVisible ? projectBridge.sync_key : '••••••••••••••••••••••••••••••••'}
                                    </code>
                                    <button 
                                        onClick={() => setBridgeTokenVisible(!bridgeTokenVisible)} 
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                        {bridgeTokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                 <label style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.1em' }}>Status</label>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.4rem' }}>
                                     <div style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', fontSize: '0.6rem', fontWeight: 900 }}>
                                         {projectBridge.allowed_ips?.length || 'ALL'} IPs
                                     </div>
                                     <div style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', color: '#818cf8', fontSize: '0.6rem', fontWeight: 900 }}>
                                         ALERTS
                                     </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                        <button 
                            onClick={openBridgeSecurity}
                            className="btn" 
                            style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', fontWeight: 800, fontSize: '0.75rem', background: '#6366f1', color: 'white', border: 'none', boxShadow: '0 8px 16px -4px rgba(99,102,241,0.4)', cursor: 'pointer' }}
                        >
                            Global Security Config
                        </button>
                        <button 
                            onClick={handleRotateBridgeKey}
                            className="btn" 
                            style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', fontWeight: 800, fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer' }}
                        >
                            Rotate Master Key
                        </button>
                    </div>
                </div>
            )}

            {/* MACHINERY GRID */}
            {filteredMachines.length === 0 ? (
                <div className="fade-in" style={{ 
                    padding: '8rem 2rem', textAlign: 'center', background: 'white', 
                    borderRadius: '32px', border: '2.5px dashed #f1f5f9',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem'
                }}>
                    <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                        <Database size={40} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>No Active Connectivity Data</h2>
                        <p style={{ color: '#94a3b8', fontWeight: 500, maxWidth: '400px', margin: '0 auto' }}>Establishing a sync bridge is required to begin monitoring distributed hardware. Currently, no machines are reporting telemetry.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {filteredMachines.map(m => (
                        <div key={m.id} className="bridge-card" style={{ 
                            padding: '1.25rem', borderRadius: '24px', border: '1px solid #f1f5f9', background: '#ffffff',
                            boxShadow: '0 4px 15px -1px rgba(0,0,0,0.03), 0 2px 6px -1px rgba(0,0,0,0.02)', position: 'relative'
                        }}>
                            {/* Header Section */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <div style={{ 
                                        padding: '0.75rem', background: m.is_online ? '#f0fdf4' : '#f8fafc', 
                                        borderRadius: '16px', border: `1.5px solid ${m.is_online ? '#10b98140' : '#e2e8f0'}`, position: 'relative'
                                    }}>
                                        <Cpu size={24} color={m.is_online ? '#10b981' : '#94a3b8'} />
                                        {m.is_online && <div className="pulse-dot" style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, background: '#10b981', borderRadius: '50%', border: '2px solid white' }} />}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.25rem' }}>{m.machine_name}</h3>
                                        <div style={{ display: 'flex', gap: '0.5rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800 }}>
                                            <span style={{ color: '#6366f1' }}>{m.machine_id}</span>
                                            <span style={{ opacity: 0.3 }}>•</span>
                                            <span>{m.location || m.lab_id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: '5px 12px', borderRadius: '10px', background: m.is_online ? '#dcfce7' : '#f1f5f9', 
                                    color: m.is_online ? '#166534' : '#64748b', fontSize: '0.65rem', fontWeight: 900,
                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}>
                                    {m.is_online ? 'Live' : 'Silent'}
                                </div>
                            </div>

                            {/* Telemetry Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ padding: '0.75rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                    <p style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Records Sent</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{m.telemetry_data?.total_records || 0}</p>
                                </div>
                                <div style={{ padding: '0.75rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                    <p style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Connectivity</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 900, color: '#6366f1' }}>{m.telemetry_data?.avg_latency_ms || 0}<span style={{ fontSize: '0.7rem', opacity: 0.6 }}>ms</span></p>
                                </div>
                            </div>

                            {/* Routing Destination */}
                            <div style={{ background: '#f8fafc', padding: '0.875rem', borderRadius: '16px', border: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Routing Target</span>
                                    {m.is_linked && <ShieldCheck size={14} color="#10b981" />}
                                </div>
                                
                                {m.is_linked ? (
                                    <div style={{ 
                                        padding: '0.75rem 1rem', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>
                                            {m.project_name || 'Mapped Workspace'}
                                        </span>
                                        <ExternalLink size={14} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select 
                                            className="pro-select"
                                            value={m.project_id || ''}
                                            onChange={(e) => {
                                                const pId = e.target.value;
                                                setMachines(prev => prev.map(vm => vm.id === m.id ? { ...vm, project_id: pId } : vm));
                                            }}
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.8125rem', background: 'white' }}
                                        >
                                            <option value="">Detached Engine</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={() => handleLinkProject(m.id, m.project_id)}
                                            disabled={linking === m.id}
                                            style={{ width: '42px', borderRadius: '12px', background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <ArrowUpRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Actions Deck */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                 <button 
                                     onClick={() => { setSelectedMachine(m); fetchAudit(m.id); }}
                                     style={{ padding: '0.75rem', borderRadius: '16px', background: '#ffffff', border: '1.5px solid #e2e8f0', fontWeight: 800, fontSize: '0.7rem', color: '#475569', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                 >
                                     <Activity size={16} color="#6366f1" />
                                     Audit Logs
                                 </button>
                                 <button 
                                     onClick={() => { setSelectedMachine(m); setShowResetConfirm(true); }}
                                     title="Remote Reset"
                                     style={{ gridColumn: 'span 2', padding: '0.75rem', borderRadius: '16px', background: '#fff1f2', border: '1.5px solid #fee2e2', fontWeight: 800, fontSize: '0.7rem', color: '#e11d48', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                 >
                                     <RotateCcw size={16} />
                                     Emergency Reset Signal
                                 </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SYNC AUDIT LOGS MODAL */}
            {showAudit && selectedMachine && (
                <div style={modalBackdropStyle} className="fade-in">
                    <div style={{ ...modalContainerStyle, maxWidth: '900px', height: '85vh' }} className="modal-content">
                        <div style={modalHeaderStyle}>
                            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                                <div style={{ padding: '0.875rem', background: '#eef2ff', borderRadius: '16px', color: '#6366f1' }}>
                                    <Activity size={24} />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Sync Transmission Logs</h2>
                            </div>
                            <button onClick={() => setShowAudit(false)} style={closeButtonStyle}>⨉</button>
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.75rem' }}>
                                <thead>
                                    <tr style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.1em' }}>
                                        <th style={{ padding: '1rem' }}>Ingestion Time</th>
                                        <th>Packet Size</th>
                                        <th>Success</th>
                                        <th>Failed</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map((log) => (
                                        <React.Fragment key={log.id}>
                                            <tr style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '1.25rem', borderRadius: '16px 0 0 16px', fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', border: '1px solid #f1f5f9' }}>
                                                    {new Date(log.received_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </td>
                                                <td style={{ fontWeight: 800, color: '#6366f1' }}>{log.batch_size} <small style={{ opacity: 0.5 }}>rec</small></td>
                                                <td style={{ color: '#10b981', fontWeight: 800 }}>{log.success_count}</td>
                                                <td style={{ color: log.failed_count > 0 ? '#e11d48' : '#94a3b8', fontWeight: 800 }}>{log.failed_count}</td>
                                                <td style={{ borderRadius: '0 16px 16px 0', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ 
                                                        padding: '4px 12px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900,
                                                        background: log.status === 'Success' ? '#f0fdf4' : '#fff1f2',
                                                        color: log.status === 'Success' ? '#166534' : '#991b1b'
                                                    }}>
                                                        {log.status.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                            {log.status_msg && (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '0 1.25rem 1rem 1.25rem' }}>
                                                        <div style={{ background: '#fff1f2', border: '1px solid #fee2e2', padding: '1.25rem', borderRadius: '0 0 16px 16px', fontSize: '0.8rem', color: '#991b1b', fontWeight: 600, whiteSpace: 'pre-line', position: 'relative', top: '-10px', zIndex: -1 }}>
                                                            {log.status_msg}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}


            {/* RESET CONFIRMATION MODAL */}
            {showResetConfirm && (
                <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '400px', padding: '2.5rem', borderRadius: '32px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <RotateCcw size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '1rem' }}>Initiate Remote Reset?</h2>
                        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                            This will send a hardware kill signal to the local agent and revoke the current sync key. The agent will require manual re-registration.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowResetConfirm(false)} className="btn btn-secondary" style={{ flex: 1, borderRadius: '14px', fontWeight: 800 }}>Cancel</button>
                            <button onClick={handleResetAgent} className="btn btn-primary" style={{ flex: 1, borderRadius: '14px', fontWeight: 800, background: '#e11d48' }}>Reset Asset</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ROTATE BRIDGE KEY CONFIRMATION MODAL */}
            {showRotateBridgeConfirm && (
                <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card bounce-in" style={{ width: '420px', padding: '2rem', textAlign: 'center', borderRadius: '24px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                            <Lock size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '1rem' }}>Rotate Protocol Master Key?</h2>
                        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                            This will instantly disconnect ALL local sync agents running within this project. You will need to deploy the new key to their configuration files.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowRotateBridgeConfirm(false)} className="btn btn-secondary" style={{ flex: 1, borderRadius: '14px', fontWeight: 800 }}>Cancel</button>
                            <button onClick={confirmRotateBridgeKey} className="btn btn-primary" style={{ flex: 1, borderRadius: '14px', fontWeight: 800, background: '#e11d48' }}>Rotate Key</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PROJECT BRIDGE SECURITY MODAL */}
            {showBridgeConfig && (
                <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div className="card bounce-in" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '32px', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5)', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '12px', borderRadius: '16px', background: '#f1f5f9' }}>
                                <ShieldCheck size={28} color="#6366f1" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Global Governance Policy</h2>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Configure security for all project assets.</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>PROJECT IP WHITELIST (Comma Separated)</label>
                                <input 
                                    type="text" 
                                    className="pro-input"
                                    placeholder="e.g. 203.0.113.1, 198.51.100.2"
                                    value={machineIpList}
                                    onChange={(e) => setMachineIpList(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '2px solid #f1f5f9', fontWeight: 700, fontSize: '0.875rem', outline: 'none' }}
                                />
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.75rem' }}>Only requests from these IPs will be accepted with the Master Key.</p>
                            </div>

                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>ALERT RECIPIENTS (Emails)</label>
                                <input 
                                    type="text" 
                                    className="pro-input"
                                    placeholder="admin@lab.com, tech@lab.com"
                                    value={alertEmails}
                                    onChange={(e) => setAlertEmails(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '2px solid #f1f5f9', fontWeight: 700, fontSize: '0.875rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Heartbeat Window</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            className="pro-input"
                                            value={downtimeThreshold}
                                            onChange={(e) => setDowntimeThreshold(e.target.value)}
                                            style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '2px solid #f1f5f9', fontWeight: 700, fontSize: '0.875rem', outline: 'none' }}
                                        />
                                        <span style={{ position: 'absolute', right: '1.125rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, fontSize: '0.7rem', color: '#94a3b8' }}>MINS</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0f9ff', padding: '0.75rem', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                    <Info size={16} color="#0369a1" />
                                    <p style={{ fontSize: '0.6rem', color: '#0369a1', fontWeight: 800 }}>Global setting for all project sensors.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button 
                                onClick={() => setShowBridgeConfig(false)} 
                                className="btn btn-secondary" 
                                style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', fontWeight: 900, background: '#f1f5f9', border: 'none' }}
                            >
                                Discard
                            </button>
                            <button 
                                onClick={handleSaveBridgeSecurity} 
                                disabled={configLoading}
                                className="btn btn-primary" 
                                style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', fontWeight: 900, background: '#6366f1', border: 'none', color: 'white' }}
                            >
                                {configLoading ? 'Syncing...' : 'Deploy Policy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes modalPopUp { from { transform: scale(0.95) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                .fade-in { animation: modalFadeIn 0.3s ease-out forwards; }
                .modal-content { animation: modalPopUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .bridge-card { transition: all 0.3s ease; }
                .bridge-card:hover { transform: translateY(-8px); border-color: #6366f1; box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.1); }
                .pro-select:focus, .pro-input:focus { border-color: #6366f1; outline: none; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pulse-dot { animation: pulse 2s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
                .metric-pulse { animation: metric-glow 2.5s infinite; }
                @keyframes metric-glow { 0% { opacity: 0.8; } 50% { opacity: 1; filter: brightness(1.2); } 100% { opacity: 0.8; } }
            `}</style>
        </div>
    );
};

const TelemetryCard = ({ label, value, icon, gradient, subtext, pulse }) => (
    <div className={pulse ? "metric-pulse" : ""} style={{ 
        background: gradient, borderRadius: '14px', padding: '0.625rem 1rem', color: 'white',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)'
    }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.35rem', borderRadius: '8px' }}>
                    {React.cloneElement(icon, { size: 14 })}
                </div>
                <div style={{ fontSize: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '6px' }}>Live</div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0rem', letterSpacing: '-0.01em' }}>{value}</h3>
            <p style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.9 }}>{label}</p>
        </div>
        <div style={{ position: 'absolute', right: '-10%', bottom: '-20%', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', zIndex: 1 }} />
    </div>
);

const FilterTab = ({ label, active, onClick, color }) => (
    <button onClick={onClick} style={{
        padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none',
        background: active ? (color || 'var(--primary)') : 'transparent',
        color: active ? 'white' : '#64748b',
        fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.2s'
    }}>
        {label}
    </button>
);

const modalBackdropStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' };
const modalContainerStyle = { background: 'white', borderRadius: '32px', width: '100%', maxWidth: '650px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.03), 0 10px 10px -5px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const modalHeaderStyle = { padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeButtonStyle = { background: '#f8fafc', border: 'none', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const labelStyle = { fontSize: '0.6875rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center' };
const inputStyle = { width: '100%', padding: '0.875rem 1.125rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: '0.875rem', background: '#fff' };

export default BridgeHub;
