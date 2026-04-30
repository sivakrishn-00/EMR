import React from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Activity, 
  FlaskConical, 
  Pill,
  TrendingUp,
  Clock,
  ArrowRight,
  TrendingDown,
  Calendar as CalendarIcon
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, gradient }) => (
  <div className="card fade-in" style={{ 
    background: gradient || 'var(--surface)', 
    borderRadius: '16px', 
    padding: '0.75rem 1.125rem', 
    color: 'white',
    boxShadow: '0 6px 12px -3px rgba(0,0,0,0.1)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'transform 0.3s ease',
    cursor: 'default',
    minWidth: '180px'
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
  >
    <div style={{ position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.4rem', borderRadius: '10px' }}>
          <Icon size={14} strokeWidth={3} />
        </div>
        <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>Live</div>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{title}</div>
    </div>
    {/* Abstract Background Shapes */}
    <div style={{ position: 'absolute', right: '-10%', bottom: '-15%', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', zIndex: 1 }}></div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = React.useState({
    total_patients: 0,
    pending_patients: 0,
    lab_pending: 0,
    doctor_pending: 0,
    pharmacy_pending: 0,
    recent_visits: [],
    dept_flow: []
  });

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('accounts/stats/');
        setStats(res.data);
      } catch (e) { console.error("Stats fetch failed"); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute for real-time feel
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
            Hello, {user?.first_name || user?.username || 'System'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            <CalendarIcon size={12} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{today}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <div style={{ padding: '0.375rem 0.75rem', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '6px', height: '6px', background: 'var(--background)', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.1)' }} className="pulse"></div>
            <span style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Terminal</span>
          </div>
        </div>
      </header>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Total Registered" value={stats.total_patients} icon={Users} gradient="linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)" />
        <StatCard title="Pending Patients" value={`${stats.pending_patients || 0} Active`} icon={Clock} gradient="linear-gradient(135deg, var(--secondary) 0%, var(--secondary) 100%)" />
        <StatCard title="Laboratory" value={`${stats.lab_pending || 0} Open`} icon={FlaskConical} gradient="linear-gradient(135deg, var(--accent) 0%, var(--accent) 100%)" />
        <StatCard title="Doctor Pending" value={`${stats.doctor_pending || 0} Waiting`} icon={Activity} gradient="linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)" />
        <StatCard title="Pharmacy Pending" value={`${stats.pharmacy_pending || 0} Orders`} icon={Pill} gradient="linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)" />
      </div>

      <div className="main-grid" style={{ gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.015em' }}>Real-time Patient Queue</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 500 }}>Operational log of current day clinical traffic</p>
            </div>
          </div>
          
          <div className="table-responsive" style={{ borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Identified Subject</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Location</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Entry Time</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Process Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recent_visits || []).map((visit, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1rem' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{visit.patient_name || `${visit.patient_details?.first_name} ${visit.patient_details?.last_name}`}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{visit.patient_details?.card_no || 'Walk-in Subject'}</p>
                    </td>
                    <td style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', padding: '1rem' }}>Internal Clinic</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '1rem' }}>{new Date(visit.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${visit.status.includes('CONSULTATION') ? 'badge-doctor' : visit.status.includes('VITALS') ? 'badge-nurse' : ''}`} style={{ fontSize: '0.625rem', padding: '0.35rem 0.625rem', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', background: visit.status === 'PENDING_VITALS' ? '#fef3c7' : visit.status === 'CHECKED_IN' ? '#dcfce7' : '#eff6ff', color: visit.status === 'PENDING_VITALS' ? '#92400e' : visit.status === 'CHECKED_IN' ? '#166534' : '#1e40af' }}>
                        {visit.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!stats.recent_visits || stats.recent_visits.length === 0) && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No active subjects in current processing cycle.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>Operational Throughput</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500, marginTop: '2px' }}>Resource allocation across core departments</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {(stats.dept_flow || [
              { name: 'Nursing', value: 0, color: '#f59e0b' },
              { name: 'Doctor', value: 0, color: '#6366f1' },
              { name: 'Laboratory', value: 0, color: '#10b981' },
              { name: 'Pharmacy', value: 0, color: '#ef4444' }
            ]).map(dept => (
              <div key={dept.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{dept.name}</span>
                  <span style={{ color: 'var(--text-main)' }}>{dept.value}%</span>
                </div>
                <div style={{ height: '10px', background: 'var(--background)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${dept.value}%`, 
                    background: `linear-gradient(90deg, ${dept.color}88, ${dept.color})`, 
                    borderRadius: '5px',
                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}></div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: '2.5rem', 
            padding: '1.5rem', 
            background: 'var(--sidebar-bg)', 
            borderRadius: '24px',
            color: 'white',
            border: 'none',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', padding: '0.5rem', opacity: 0.15, transform: 'rotate(-10deg)' }}>
                <TrendingUp size={80} />
            </div>
            <p style={{ fontSize: '0.625rem', fontWeight: 900, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>Data Integrity Assurance</p>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>The metrics displayed are aggregated from real-time facility transactions and clinical entries.</p>
          </div>
        </div>
      </div>
      <style>{`
        .pulse { animation: pulse-animation 2s infinite; }
        @keyframes pulse-animation {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
