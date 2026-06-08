import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Activity, 
  Pill, 
  Stethoscope, 
  ShoppingCart,
  Layers,
  Filter,
  RefreshCw,
  Search,
  Radio,
  FileText,
  AlertTriangle,
  Building2,
  Database,
  CheckCircle2,
  Server,
  Microscope,
  Briefcase
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Project styling gradients
const COLOR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', // Indigo
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan
  'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // Pink
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
  'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', // Rose
  'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', // Teal
  'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)', // Lime
];

// Animated CountUp Component
const CountUp = ({ to, duration = 1.0 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(to) || 0;
    if (start === end) {
      setCount(end);
      return;
    }

    const totalMiliseconds = duration * 1000;
    const incrementTime = 25; 
    const totalSteps = Math.round(totalMiliseconds / incrementTime);
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const current = Math.round(end * (step / totalSteps));
      if (step >= totalSteps) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [to, duration]);

  return <>{count.toLocaleString()}</>;
};

const OperationsHub = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(() => {
    return sessionStorage.getItem('op_hub_selected_project') || 'all';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (user?.project && selectedProject === 'all') {
      const defaultProj = String(user.project);
      setSelectedProject(defaultProj);
      sessionStorage.setItem('op_hub_selected_project', defaultProj);
    }
  }, [user]);

  // Main fetch function
  const fetchHubData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsSyncing(true);

    try {
      const url = selectedProject === 'all' 
        ? 'patients/reports/operations_hub/' 
        : `patients/reports/operations_hub/?project=${selectedProject}`;
      
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch operations hub data:", err);
      if (!isBackground) {
        toast.error("Failed to load operations analytics.");
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get('patients/projects/');
      setProjects(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  // Polling mechanism (Every 5 seconds)
  useEffect(() => {
    fetchHubData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHubData(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedProject]);

  const currentProjectName = projects.find(p => p.id === parseInt(selectedProject))?.name || 'All Projects';

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          <div className="pulse-loader"></div>
          <Activity size={32} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#6366f1' }} />
        </div>
        <style>{`
          .pulse-loader { width: 100%; height: 100%; border-radius: 50%; border: 3px solid #6366f1; animation: pulse 1.5s infinite; opacity: 0.5; }
          @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
        `}</style>
      </div>
    );
  }

  const counts = data?.counts || {};
  const topDrugs = data?.top_drugs || [];
  const topDiseases = data?.top_diseases || [];
  const recentActivity = data?.recent_activity || [];
  const stockAlerts = data?.stock_alerts || { low: 0, depleted: 0 };
  const projectBreakdown = data?.project_breakdown || [];
  const labTelemetry = data?.lab_telemetry || { total_machines: 0, online_machines: 0, total_raw_results: 0, total_audits: 0, successful_audits: 0, machines_list: [] };

  // Calculations
  const maxDrugQty = topDrugs.length > 0 ? Math.max(...topDrugs.map(d => d.quantity)) : 1;
  const maxDiseaseCount = topDiseases.length > 0 ? Math.max(...topDiseases.map(d => d.count)) : 1;
  const syncSuccessRate = labTelemetry.total_audits > 0 
    ? Math.round((labTelemetry.successful_audits / labTelemetry.total_audits) * 100) 
    : 100;

  // Rank Badge Styling helper
  const getRankBadge = (rank) => {
    let bg = '#f1f5f9';
    let text = '#64748b';
    let label = rank;
    if (rank === 1) {
      bg = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
      text = '#ffffff';
    } else if (rank === 2) {
      bg = 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)';
      text = '#ffffff';
    } else if (rank === 3) {
      bg = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
      text = '#ffffff';
    }
    return (
      <div style={{
        background: bg,
        color: text,
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 900,
        boxShadow: rank <= 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
        flexShrink: 0
      }}>
        {label}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '1.5rem' }}>
      
      {/* 🎖️ HEADER AREA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.03em', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <TrendingUp size={34} style={{ color: 'var(--primary)' }} /> Executive Operations Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            {selectedProject !== 'all' ? `Tracking ${currentProjectName} Operations` : 'Global Cross-Project Registry Intelligence'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Live Indicator Status */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--surface)', 
            padding: '8px 14px', 
            borderRadius: '14px', 
            border: '1px solid var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <span style={{ position: 'relative', display: 'flex', height: '10px', width: '10px' }}>
              <span className="live-ping" style={{
                position: 'absolute',
                display: 'inline-flex',
                height: '100%',
                width: '100%',
                borderRadius: '50%',
                background: '#10b981',
                opacity: 0.75,
                animation: 'ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite'
              }}></span>
              <span style={{
                position: 'relative',
                display: 'inline-flex',
                borderRadius: '50%',
                height: '10px',
                width: '10px',
                background: '#10b981'
              }}></span>
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              LIVE MONITORING (5s)
            </span>
            {isSyncing && (
              <RefreshCw size={12} className="spin-sync" style={{ color: 'var(--primary)', marginLeft: '4px' }} />
            )}
          </div>

          {/* 🌟 CUSTOM PROFESSIONAL DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => !user?.project && setIsDropdownOpen(!isDropdownOpen)}
              style={{
                padding: '10px 1.25rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                fontSize: '0.875rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                minWidth: '240px',
                cursor: user?.project ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                outline: 'none',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              disabled={!!user?.project}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={14} style={{ color: 'var(--primary)' }} />
                <span>{selectedProject === 'all' ? 'Enterprise Global (All)' : currentProjectName}</span>
              </div>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: '8px' }}>▼</span>
            </button>

            {isDropdownOpen && (
              <>
                <div 
                  onClick={() => setIsDropdownOpen(false)} 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                />
                <div 
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    minWidth: '260px',
                    zIndex: 1000,
                    overflow: 'hidden',
                    padding: '6px'
                  }}
                >
                  <div 
                    onClick={() => {
                      setSelectedProject('all');
                      sessionStorage.setItem('op_hub_selected_project', 'all');
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8125rem',
                      fontWeight: 750,
                      cursor: 'pointer',
                      background: selectedProject === 'all' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      color: selectedProject === 'all' ? '#6366f1' : 'var(--text-main)',
                      transition: '0.15s',
                    }}
                    className="dropdown-item-hover"
                  >
                    Enterprise Global (All Projects)
                  </div>
                  {projects.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setSelectedProject(String(p.id));
                        sessionStorage.setItem('op_hub_selected_project', String(p.id));
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.8125rem',
                        fontWeight: 750,
                        cursor: 'pointer',
                        background: selectedProject === String(p.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        color: selectedProject === String(p.id) ? '#6366f1' : 'var(--text-main)',
                        transition: '0.15s',
                      }}
                      className="dropdown-item-hover"
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 📊 CORE STATS COUNTERS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2.5rem'
      }}>
        {[
          { label: 'Patient Volume', val: counts.total_registered, icon: Users, gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
          { label: 'Vitals Captured', val: counts.total_vitals, icon: Activity, gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
          { label: 'Consultations Completed', val: counts.total_consultations, icon: Stethoscope, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
          { label: 'Dispensing Count', val: counts.total_dispenses, icon: ShoppingCart, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
          { label: 'Total Units Dispensed', val: counts.total_units_dispensed, icon: Pill, gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
          { label: 'Active Clinic Queue', val: counts.active_queue, icon: Layers, gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            style={{
              background: stat.gradient,
              padding: '1.5rem',
              borderRadius: '24px',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              minHeight: '110px'
            }}
          >
            <div style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '12px', 
              background: 'rgba(255, 255, 255, 0.22)', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              flexShrink: 0
            }}>
              <stat.icon size={22} />
            </div>
            <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>{stat.label}</p>
              <h3 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                <CountUp to={stat.val} />
              </h3>
            </div>
            <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', width: '55px', height: '55px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          </motion.div>
        ))}
      </div>

      {/* 🏢 THE 10 PROJECTS TELEMETRY DASHBOARD GRID */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
          <Building2 size={20} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: 950, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Project Telemetry Dashboard ({projectBreakdown.length > 0 ? `${projectBreakdown.length} Active Projects` : 'Active Projects'})
          </span>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {projectBreakdown.map((proj, idx) => {
            const hasQueue = proj.active_queue > 0;
            const gradient = COLOR_GRADIENTS[idx % COLOR_GRADIENTS.length];
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '1.5rem 1.5rem 1.25rem 1.5rem',
                  boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Colorful top border strip */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: gradient
                }} />

                {/* Project Title & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: gradient }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-main)' }}>{proj.name}</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.625rem', 
                    fontWeight: 900, 
                    background: hasQueue ? '#ef444412' : '#10b98112',
                    color: hasQueue ? '#ef4444' : '#059669',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {hasQueue ? `${proj.active_queue} Intake Queue` : 'Standby'}
                  </span>
                </div>

                {/* Colorful Metric Values Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '10px', 
                  background: 'var(--background)',
                  padding: '12px 8px',
                  borderRadius: '16px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Intake</span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#6366f1' }}><CountUp to={proj.patients} /></span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Vitals</span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#06b6d4' }}><CountUp to={proj.vitals} /></span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Consults</span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}><CountUp to={proj.consultations} /></span>
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px',
                  padding: '4px 6px 0 6px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Lab Orders</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#f59e0b' }}><CountUp to={proj.lab_requests} /></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Dispenses</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#ec4899' }}><CountUp to={proj.units_dispensed} /></span>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 📊 DRUG UTILIZATION & DIAGNOSES & ACTIVITY STREAM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.6fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* TOP DRUGS CARD */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '1.75rem',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
          minHeight: '520px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
              <Pill size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Drug Utilization</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Top {topDrugs.length} dispensed medications</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            {topDrugs.length === 0 ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No dispensing logs available
              </div>
            ) : (
              topDrugs.map((drug, index) => {
                const pct = Math.round((drug.quantity / maxDrugQty) * 100);
                return (
                  <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {getRankBadge(index + 1)}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {drug.name}
                        </span>
                        <span style={{ color: '#ec4899', fontWeight: 800 }}><CountUp to={drug.quantity} /> units</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--background)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ec4899, #db2777)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TOP DISEASES CARD */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '1.75rem',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
          minHeight: '520px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Activity size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Top Diagnoses</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Most common disease types</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            {topDiseases.length === 0 ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No diagnostic insights found
              </div>
            ) : (
              topDiseases.map((disease, index) => {
                const pct = Math.round((disease.count / maxDiseaseCount) * 100);
                return (
                  <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {getRankBadge(index + 1)}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {disease.name}
                        </span>
                        <span style={{ color: '#10b981', fontWeight: 800 }}><CountUp to={disease.count} /> cases</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--background)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* LIVE ACTIVITY / TIMELINE AUDIT FEED */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '1.75rem',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
          minHeight: '520px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <Radio size={18} className="live-radar-icon" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Live Activity Feed</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Real-time clinic transactions</p>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingLeft: '20px', maxHeight: '420px' }}>
            {recentActivity.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No recent activity logged
              </div>
            ) : (
              <>
                <div style={{
                  position: 'absolute',
                  left: '7px',
                  top: '10px',
                  bottom: '20px',
                  width: '2px',
                  background: 'var(--border)',
                  zIndex: 0
                }} />

                <AnimatePresence initial={false}>
                  {recentActivity.map((act, idx) => {
                    let badgeBg = '#6366f115';
                    let badgeColor = '#6366f1';
                    let dotColor = '#6366f1';
                    if (act.type === 'DISPENSE') {
                      badgeBg = '#f59e0b15';
                      badgeColor = '#d97706';
                      dotColor = '#d97706';
                    } else if (act.type === 'CONSULTATION') {
                      badgeBg = '#10b98115';
                      badgeColor = '#059669';
                      dotColor = '#059669';
                    }

                    const timeStr = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <motion.div 
                        key={act.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                        style={{
                          position: 'relative',
                          marginBottom: '1.25rem',
                          zIndex: 1
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          left: '-18px',
                          top: '14px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: 'var(--surface)',
                          border: `2.5px solid ${dotColor}`,
                          zIndex: 2
                        }} />

                        <div style={{
                          padding: '0.875rem 1rem',
                          background: 'var(--background)',
                          borderRadius: '16px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '0.625rem', 
                              fontWeight: 800, 
                              background: badgeBg, 
                              color: badgeColor, 
                              padding: '2px 8px', 
                              borderRadius: '6px',
                              textTransform: 'uppercase'
                            }}>
                              {act.type}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              {timeStr}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.4' }}>
                            {act.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 🔬 LAB MACHINE SYNC & TELEMETRY SECTION (MORE COLORFUL REDESIGN) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '2.4fr 1.6fr', 
        gap: '1.5rem', 
        marginBottom: '1rem',
        alignItems: 'start'
      }}>
        
        {/* LAB INTEGRATION HUB TELEMETRY */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '1.75rem',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top colorful accent bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)'
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <Server size={20} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Lab cloud Sync Telemetry ({labTelemetry.total_locations !== undefined ? `${labTelemetry.total_locations} Connected Locations` : 'Locations'})
              </span>
            </div>

            {/* Colorful Sync Counters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Registered', val: labTelemetry.total_machines, icon: Microscope, bg: 'rgba(99, 102, 241, 0.04)', border: 'rgba(99, 102, 241, 0.15)', text: '#6366f1' },
                { label: 'Online Stations', val: labTelemetry.online_machines, icon: Radio, bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
                { label: 'Ingested Results', val: labTelemetry.total_raw_results, icon: Database, bg: 'rgba(6, 182, 212, 0.04)', border: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
                { label: 'Success Rate', val: `${syncSuccessRate}%`, icon: CheckCircle2, bg: 'rgba(239, 68, 68, 0.04)', border: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }
              ].map((c, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: '1.25rem 1rem', 
                    background: c.bg, 
                    border: `1px solid ${c.border}`, 
                    borderRadius: '18px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.text }}>
                    <c.icon size={15} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{c.label}</span>
                  </div>
                  <span style={{ fontSize: '1.35rem', fontWeight: 950, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    {typeof c.val === 'string' ? c.val : <CountUp to={c.val} />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '0.75rem' }}>Recently Active Sync Stations</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {labTelemetry.machines_list.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No active sync engines connected</div>
              ) : (
                labTelemetry.machines_list.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`status-dot ${m.status === 'ONLINE' ? 'online' : 'offline'}`} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{m.name}</span>
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600 }}>{m.location} • {m.project_name}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      Last Synced: {m.last_synced ? new Date(m.last_synced).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* STOCK HEALTH WIDGET (MORE COLORFUL REDESIGN) */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          padding: '1.75rem',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 20px -6px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top colorful accent bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Stock Auditing Status</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ 
                flex: 1, 
                background: 'rgba(245, 158, 11, 0.05)', 
                border: '1px solid rgba(245, 158, 11, 0.22)', 
                borderRadius: '18px', 
                padding: '1.25rem 1rem', 
                textAlign: 'center',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)'
              }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Low Stock Items</span>
                <span style={{ fontSize: '1.625rem', fontWeight: 950, color: '#d97706', letterSpacing: '-0.02em' }}>
                  <CountUp to={stockAlerts.low} />
                </span>
              </div>

              <div style={{ 
                flex: 1, 
                background: 'rgba(239, 68, 68, 0.05)', 
                border: '1px solid rgba(239, 68, 68, 0.22)', 
                borderRadius: '18px', 
                padding: '1.25rem 1rem', 
                textAlign: 'center',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)'
              }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Depleted / Out</span>
                <span style={{ fontSize: '1.625rem', fontWeight: 950, color: '#ef4444', letterSpacing: '-0.02em' }}>
                  <CountUp to={stockAlerts.depleted} />
                </span>
              </div>
            </div>
          </div>

          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            borderTop: '1px dashed var(--border)', 
            paddingTop: '0.75rem',
            textAlign: 'center',
            fontWeight: 650
          }}>
            Critical thresholds configured at &lt; {data?.low_threshold || 10} units.
          </div>
        </div>

      </div>

      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .spin-sync {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .live-radar-icon {
          animation: livePulse 2s infinite ease-in-out;
        }
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-dot.online {
          background-color: #10b981;
          box-shadow: 0 0 8px #10b981;
        }
        .status-dot.offline {
          background-color: #94a3b8;
        }
        .dropdown-item-hover {
          transition: background-color 0.15s, color 0.15s;
        }
        .dropdown-item-hover:hover {
          background-color: var(--background) !important;
          color: var(--primary) !important;
        }
      `}</style>

    </div>
  );
};

export default OperationsHub;
