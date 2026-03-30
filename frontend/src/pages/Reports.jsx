import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Activity, 
  Filter, 
  Download,
  BarChart3,
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  CalendarDays
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('patients/projects/');
      setProjects(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error("Project fetch error:", err);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const url = selectedProject === 'all' ? 'patients/reports/' : `patients/reports/?project=${selectedProject}`;
      const res = await api.get(url);
      setReportData(res.data);
    } catch (err) {
      toast.error("Analytics sync failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const dataToExport = reportData?.all_consumption || reportData?.top_medications;
    if (!dataToExport) return;
    
    const headers = ["Medication Name", "Total Consumption (Units)", "Project Scope", "Report Date"];
    const rows = dataToExport.map(m => [
      `"${m.name}"`, 
      m.total, 
      `"${reportData.project_name}"`, 
      new Date().toLocaleDateString()
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registry_Full_Report_${selectedProject}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${dataToExport.length} entries`);
  };

  if (loading && !reportData) {
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

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      {/* COMPACT TOP HEADER */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'baseline', 
        marginBottom: '1.5rem',
        padding: '0 0.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 850, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={24} style={{ color: '#6366f1' }} /> 
            Analytics Hub
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500, marginTop: '2px' }}>
            Tracking {reportData?.project_name} Registry Performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CalendarDays size={14} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Last 7 Days</span>
          </div>

          <div style={{ position: 'relative' }}>
            <select 
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                appearance: 'none',
                padding: '6px 2.5rem 6px 1rem',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#1e293b',
                minWidth: '180px',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <option value="all">Enterprise Global</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Filter size={12} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          </div>

          <button 
            onClick={exportToCSV}
            style={{
              padding: '6px 16px',
              background: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* COMPACT GRID STATS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Patient Volume', val: reportData?.total_registered, icon: Users, color: '#6366f1' },
          { label: 'Units Dispensed', val: reportData?.top_medications?.reduce((a,c)=>a+c.total,0), icon: ShoppingCart, color: '#10b981' },
          { label: 'Workflow Efficiency', val: `${reportData?.conversion_rate}%`, icon: TrendingUp, color: '#f59e0b' },
          { label: 'Inventory Assets', val: `₹${reportData?.inventory_value?.toLocaleString()}`, icon: IndianRupee, color: '#ef4444' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{
              background: 'white',
              padding: '1.25rem',
              borderRadius: '20px',
              border: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: `${stat.color}10`, 
              color: stat.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <stat.icon size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', margin: '2px 0' }}>{stat.val || 0}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CHARTS AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Trend Area Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'white',
            borderRadius: '24px',
            padding: '1.5rem',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 850, color: '#1e293b' }}>Consumption Velocity</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>Daily Units</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reportData?.trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="units" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorUnits)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Inventory Criticality List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              background: '#0f172a',
              borderRadius: '24px',
              padding: '1.25rem',
              color: 'white'
            }}
          >
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} /> Stock Intelligence
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Low Stock</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <AlertCircle size={14} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>{reportData?.stock_health?.low || 0}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Depleted</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <Package size={14} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>{reportData?.stock_health?.out || 0}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: 'white',
              borderRadius: '24px',
              padding: '1.25rem',
              flex: 1,
              border: '1px solid #f1f5f9'
            }}
          >
            <h3 style={{ fontSize: '0.875rem', fontWeight: 850, color: '#1e293b', marginBottom: '1rem' }}>Demographic Split</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reportData?.by_gender?.map((g, idx) => {
                const perc = Math.round((g.count / reportData.total_registered) * 100);
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{g.gender || 'Other'}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{perc}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${perc}%` }} 
                        style={{ height: '100%', background: idx === 0 ? '#6366f1' : '#ec4899', borderRadius: '3px' }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* TOP CONSUMPTION TABLE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '1.5rem',
          border: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 850, color: '#1e293b' }}>High Intent Consumption</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
             <CheckCircle2 size={16} style={{ color: '#10b981' }} />
             <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Verified Project Data</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
          {reportData?.top_medications?.length > 0 ? (
            reportData.top_medications.map((m, i) => (
              <div key={i} style={{ 
                padding: '12px', 
                borderRadius: '16px', 
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#6366f1', fontSize: '0.75rem', border: '1px solid #e2e8f0' }}>
                    {i + 1}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>{m.name}</h4>
                    <p style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600 }}>Active Consumption</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0f172a' }}>{m.total}</span>
                  <span style={{ fontSize: '0.625rem', color: '#64748b', marginLeft: '4px', fontWeight: 700 }}>Units</span>
                </div>
              </div>
            ))
          ) : (
             <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
               No consumption data available for this project.
             </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Reports;
