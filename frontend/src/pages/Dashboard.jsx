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

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
  <div className="card fade-in" style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '0.5rem',
    position: 'relative',
    overflow: 'hidden',
    padding: '1rem',
    borderRadius: '12px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ 
        background: `${color}10`, 
        color: color,
        padding: '0.5rem', 
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={18} />
      </div>
      {trend && (
        <div style={{ 
          fontSize: '0.625rem', 
          fontWeight: 800, 
          color: trend === 'up' ? 'var(--secondary)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trendValue}
        </div>
      )}
    </div>
    
    <div>
      <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.025em', marginTop: '0.125rem' }}>{value}</p>
    </div>

    {/* Subtle decorative icon */}
    <div style={{
      position: 'absolute',
      right: '-15px',
      bottom: '-15px',
      opacity: 0.04,
      color: color
    }}>
      <Icon size={100} />
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = React.useState({
    total_patients: 0,
    visits_today: 0,
    lab_pending: 0,
    prescriptions_today: 0,
    emergency_today: 0,
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.025em', color: '#0f172a' }}>
            Hello, System
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', color: '#94a3b8' }}>
            <CalendarIcon size={12} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{today}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <div style={{ padding: '0.375rem 0.75rem', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.1)' }} className="pulse"></div>
            <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Terminal</span>
          </div>
        </div>
      </header>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Total Registered" value={stats.total_patients} icon={Users} color="#6366f1" />
        <StatCard title="Visits (Current)" value={stats.visits_today} icon={Clock} color="#10b981" />
        <StatCard title="Laboratory" value={`${stats.lab_pending || 0} Open`} icon={FlaskConical} color="#f59e0b" />
        <StatCard title="Pharmacy" value={`${stats.prescriptions_today || 0} Issued`} icon={Pill} color="#ef4444" />
        <StatCard title="Emergency" value={stats.emergency_today || 0} icon={Activity} color="#9333ea" />
      </div>

      <div className="main-grid" style={{ gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'white', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.015em' }}>Real-time Patient Queue</h2>
              <p style={{ color: '#64748b', fontSize: '0.6875rem', fontWeight: 500 }}>Operational log of current day clinical traffic</p>
            </div>
          </div>
          
          <div className="table-responsive" style={{ borderRadius: '10px', border: '1px solid #f2f5f9', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Identified Subject</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Location</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Entry Time</th>
                  <th style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 1rem', letterSpacing: '0.05em' }}>Process Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recent_visits || []).map((visit, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1.25rem 1rem' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#1e293b' }}>{visit.patient_name || `${visit.patient_details?.first_name} ${visit.patient_details?.last_name}`}</p>
                        <p style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{visit.patient_details?.card_no || 'Walk-in Subject'}</p>
                    </td>
                    <td style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', padding: '1rem' }}>Internal Clinic</td>
                    <td style={{ fontSize: '0.8125rem', color: '#64748b', padding: '1rem' }}>{new Date(visit.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${visit.status.includes('CONSULTATION') ? 'badge-doctor' : visit.status.includes('VITALS') ? 'badge-nurse' : ''}`} style={{ fontSize: '0.625rem', padding: '0.35rem 0.625rem', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', background: visit.status === 'PENDING_VITALS' ? '#fef3c7' : visit.status === 'CHECKED_IN' ? '#dcfce7' : '#eff6ff', color: visit.status === 'PENDING_VITALS' ? '#92400e' : visit.status === 'CHECKED_IN' ? '#166534' : '#1e40af' }}>
                        {visit.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!stats.recent_visits || stats.recent_visits.length === 0) && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.8125rem' }}>No active subjects in current processing cycle.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', background: 'white', border: '1px solid #f1f5f9' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Operational Throughput</h2>
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
                  <span style={{ color: '#64748b' }}>{dept.name}</span>
                  <span style={{ color: '#0f172a' }}>{dept.value}%</span>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
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
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
            borderRadius: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem', opacity: 0.1 }}>
                <TrendingUp size={60} />
            </div>
            <p style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Data Integrity Assurance</p>
            <p style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.5 }}>The metrics displayed are aggregated from real-time facility transactions and clinical entries.</p>
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
