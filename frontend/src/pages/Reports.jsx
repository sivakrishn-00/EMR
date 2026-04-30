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
  CalendarDays,
  UserCheck,
  FileText,
  Printer,
  User,
  ShieldCheck,
  Building2
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
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { user } = useAuth();
  const dropdownRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [consumptionData, setConsumptionData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [timeRange, setTimeRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('GENERAL'); // GENERAL or PERSONNEL
  const [employeePage, setEmployeePage] = useState(1);
  const [hasMoreEmployees, setHasMoreEmployees] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (user?.project && selectedProject === 'all') {
      setSelectedProject(String(user.project));
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedProject, timeRange, startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'PERSONNEL' && !consumptionData) {
      fetchConsumption();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedProject !== 'all') {
      fetchEmployees(1, true);
    }
  }, [selectedProject]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'PERSONNEL' && selectedProject !== 'all') {
        fetchEmployees(1, true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  const fetchEmployees = async (page = 1, isNewSearch = false) => {
    if (selectedProject === 'all') return;
    setIsSearching(true);
    try {
      const res = await api.get(`patients/employee-masters/?project=${selectedProject}&search=${searchTerm}&page=${page}&page_size=30`);
      const newData = res.data.results || [];
      
      if (isNewSearch) {
        setEmployeeList(newData);
      } else {
        setEmployeeList(prev => [...prev, ...newData]);
      }
      
      setHasMoreEmployees(!!res.data.next);
      setEmployeePage(page);
    } catch (err) {
      console.error("Employee fetch error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMoreEmployees && !isSearching) {
      fetchEmployees(employeePage + 1);
    }
  };

  const fetchConsumption = async () => {
    if (timeRange === 'custom') {
      if (!startDate || !endDate) {
        toast.error("Please select both Start and End dates");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        toast.error("Start date cannot be after End date");
        return;
      }
    }
    
    setLoading(true);
    try {
      let url = `pharmacy/consumption-report/?project=${selectedProject}&employee=${selectedEmployee}&range=${timeRange}`;
      if (timeRange === 'custom') {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await api.get(url);
      setConsumptionData(res.data);
      toast.success("Consumption analytics synchronized");
    } catch (err) {
      toast.error("Consumption data sync failed");
    } finally {
      setLoading(false);
    }
  };

  const getRangeString = () => {
    if (timeRange === 'custom') return `${startDate || '...'} to ${endDate || '...'}`;
    const now = new Date();
    const start = new Date();
    if (timeRange === 'day') return now.toLocaleDateString();
    if (timeRange === 'week') start.setDate(now.getDate() - 7);
    else if (timeRange === 'month') start.setDate(now.getDate() - 30);
    else if (timeRange === 'year') start.setDate(now.getDate() - 365);
    else return "ALL TIME";
    return `${start.toLocaleDateString()} to ${now.toLocaleDateString()}`;
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleEmployeeSelect = (empId, name) => {
    setSelectedEmployee(empId);
    setSearchTerm(name);
    setShowDropdown(false);
  };

  const filteredEmployees = employeeList || [];

  const exportToCSV = () => {
    if (activeTab === 'PERSONNEL') {
      if (!consumptionData?.items) {
        toast.error("No consumption data to export");
        return;
      }
      
      const metaRows = [
        ["OFFICIAL PERSONNEL CONSUMPTION AUDIT REPORT"],
        ["PROJECT", currentProjectName],
        ["DATE RANGE", getRangeString().toUpperCase()],
        ["AUDIT SCOPE", selectedEmployee ? `INDIVIDUAL: ${searchTerm}` : "FULL PROJECT REGISTRY"],
        ["GENERATED AT", new Date().toLocaleString()],
        [] // Spacer
      ];

      const headers = ["Visit Date", "Visit ID", "Patient ID", "Patient Name", "Medication Name", "Quantity (Units)", "Unit Price (₹)", "Total Cost (₹)", "Project"];
      const rows = [...metaRows, headers];
      
      consumptionData.items.forEach(visit => {
        let visitTotal = 0;
        visit.medications.forEach(med => {
          rows.push([
            visit.visit_date,
            `V-${visit.visit_id}`,
            `"${visit.patient_id || 'N/A'}"`,
            `"${visit.patient_name || 'N/A'}"`,
            `"${med.name}"`,
            med.quantity,
            med.unit_price.toFixed(2),
            med.total_cost.toFixed(2),
            `"${currentProjectName}"`
          ]);
          visitTotal += med.total_cost;
        });
        // Add Visit Total Row
        rows.push([
          `SUBTOTAL VISIT (${visit.visit_date})`,
          `V-${visit.visit_id}`,
          `"${visit.patient_id || 'N/A'}"`,
          `"${visit.patient_name || 'N/A'}"`,
          "",
          "",
          "",
          visitTotal.toFixed(2),
          ""
        ]);
        rows.push([]); // Empty spacer row
      });

      // Add Grand Total Row
      rows.push([
        "GRAND TOTAL EXPENDITURE",
        "",
        "",
        "",
        "",
        consumptionData.grand_total_units,
        "",
        consumptionData.grand_total_cost.toFixed(2),
        `"${currentProjectName}"`
      ]);

      let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + rows.map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Personnel_Audit_${selectedProject}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported complete audit record`);
      return;
    }

    const dataToExport = reportData?.all_consumption || reportData?.top_medications;
    if (!dataToExport) return;
    
    const headers = ["Medication Name", "Total Consumption (Units)", "Project Scope", "Report Date"];
    const rows = dataToExport.map(m => [
      `"${m.name}"`, 
      m.total, 
      `"${reportData.project_name}"`, 
      new Date().toLocaleDateString()
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `General_Report_${selectedProject}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${dataToExport.length} entries`);
  };

  const currentProjectName = projects.find(p => p.id === parseInt(selectedProject))?.name || 'Global Enterprise';

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
      {/* CORPORATE PRINT HEADER (ONLY FOR PDF EXPORT) */}
      <div className="print-only-block" style={{ marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {currentProjectName}
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', fontWeight: 700, color: '#64748b' }}>Personnel Medication Consumption Audit Report</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-block', marginBottom: '8px' }}>OFFICIAL RECORD</div>
            <p style={{ margin: 0, fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600 }}>Report ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            <p style={{ margin: 0, fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600 }}>Generated At: {new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Audit Scope</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', fontWeight: 700 }}>
               {selectedEmployee ? `Individual Audit: ${searchTerm}` : `Full Project Audit: ${currentProjectName}`}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Chronological Filter</span>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'capitalize' }}>
               {timeRange === 'custom' ? `${startDate} to ${endDate}` : `${timeRange}ly Review`}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }} className="no-print">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BarChart3 size={32} style={{ color: '#6366f1' }} /> Analytics Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
            {selectedProject !== 'all' ? `Tracking ${currentProjectName} Registry Performance` : 'Global Clinical Data Intelligence'}
          </p>
        </div>

        {activeTab === 'GENERAL' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <CalendarDays size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>Last 7 Days</span>
            </div>

            <div style={{ position: 'relative' }}>
              <select 
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                style={{
                  padding: '6px 2.5rem 6px 1rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  minWidth: '180px',
                  cursor: user?.project ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                disabled={user?.project}
              >
                <option value="all" disabled={user?.project}>Enterprise Global</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Filter size={12} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {selectedProject !== 'all' && projects.find(p => p.id === parseInt(selectedProject))?.use_registry_for_personnel && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }} className="no-print">
          <button 
            onClick={() => setActiveTab('GENERAL')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'GENERAL' ? '#6366f1' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
              padding: '8px 16px',
              borderBottom: activeTab === 'GENERAL' ? '2px solid #6366f1' : 'none',
              transition: '0.2s'
            }}
          >General Analytics</button>
          <button 
            onClick={() => setActiveTab('PERSONNEL')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'PERSONNEL' ? '#6366f1' : 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
              padding: '8px 16px',
              borderBottom: activeTab === 'PERSONNEL' ? '2px solid #6366f1' : 'none',
              transition: '0.2s'
            }}
          >Personnel Consumption</button>
        </div>
      )}

      {activeTab === 'GENERAL' ? (
        <div className="no-print">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2.5rem'
          }}>
            {[
              { label: 'Patient Volume', val: reportData?.total_registered, icon: Users, gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' },
              { label: 'Units Dispensed', val: reportData?.total_units_all_time, icon: ShoppingCart, gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
              { label: 'Workflow Efficiency', val: `${reportData?.conversion_rate}%`, icon: TrendingUp, gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
              { label: 'Clinical Drugs count', val: reportData?.drug_variations || 0, icon: Activity, gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  background: stat.gradient,
                  padding: '1.5rem 1.5rem',
                  borderRadius: '24px',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  minHeight: '100px'
                }}
              >
                <div style={{ 
                  width: '44px', 
                  height: '44px', 
                  borderRadius: '12px', 
                  background: 'rgba(255, 255, 255, 0.25)', 
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
                  <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>{stat.label}</p>
                  <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{stat.val || 0}</h3>
                </div>
                <div style={{ position: 'absolute', right: '-12px', bottom: '-12px', width: '60px', height: '60px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginBottom: '2rem', height: '420px' }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: 'var(--surface)',
                borderRadius: '24px',
                padding: '1.5rem',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
              }}
            >
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)' }}>Consumption Velocity</h3>
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData?.trends || []}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    />
                    <Tooltip 
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="units" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUnits)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: '#0f172a',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  color: 'white',
                  height: '220px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                  <Package size={18} />
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Stock Intelligence</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Low Stock</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.25rem', fontWeight: 800 }}>
                      <AlertCircle size={16} color="#f59e0b" /> {reportData?.stock_health?.low || 0}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Depleted</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.25rem', fontWeight: 800 }}>
                      <AlertCircle size={16} color="#ef4444" /> {reportData?.stock_health?.out || 0}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  flex: 1,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                }}
              >
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem' }}>Demographic Split</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, justifyContent: 'center' }}>
                  {reportData?.by_gender?.map((g, i) => {
                    const total = reportData.total_registered || 1;
                    const pct = Math.round((g.count / total) * 100);
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{g.gender || 'Unknown'}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${pct}%` }} 
                            style={{ height: '100%', background: g.gender === 'FEMALE' ? '#ec4899' : '#6366f1', borderRadius: '4px' }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="printable-report"
        >
          {/* PRINT-ONLY HEADER */}
          <div className="print-only-block" style={{ textAlign: 'center', marginBottom: '2.5rem', borderBottom: '2px solid #0f172a', paddingBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>Official Personnel Consumption Audit Report</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> PROJECT: {currentProjectName}</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CalendarDays size={14} /> RANGE: {getRangeString()}</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> SCOPE: {selectedEmployee ? searchTerm : "FULL REGISTRY"}</div>
            </div>
          </div>

          <div className="no-print" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            background: 'var(--surface)', 
            padding: '1rem', 
            borderRadius: '16px', 
            border: '1px solid var(--border)',
            marginBottom: '1.5rem',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }} ref={dropdownRef}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    placeholder="Search Employee / Card No / Family..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                      if (!e.target.value) setSelectedEmployee('');
                    }}
                    onFocus={() => setShowDropdown(true)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 2.5rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      outline: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                    }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  {searchTerm && (
                    <button 
                      onClick={() => { setSearchTerm(''); setSelectedEmployee(''); }}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >✕</button>
                  )}
                </div>

                {showDropdown && (
                  <div 
                    onScroll={handleScroll}
                    style={{ 
                      position: 'absolute', 
                      top: '110%', 
                      left: 0, 
                      right: 0, 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '16px', 
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                      maxHeight: '350px', 
                      overflowY: 'auto', 
                      zIndex: 1000,
                      padding: '8px'
                    }}
                  >
                    <div 
                      onClick={() => handleEmployeeSelect('', 'Full Project Consumption')}
                      style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 800, color: '#6366f1', background: !selectedEmployee ? '#6366f110' : 'transparent', marginBottom: '4px' }}
                    >
                      All Personnel (Project View)
                    </div>
                    {filteredEmployees.map(emp => (
                      <div key={emp.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '4px' }}>
                        <div 
                          onClick={() => handleEmployeeSelect(emp.id, `${emp.card_no} - ${emp.name}`)}
                          style={{ 
                            padding: '10px 12px', 
                            borderRadius: '10px', 
                            cursor: 'pointer', 
                            fontSize: '0.8125rem', 
                            fontWeight: 700, 
                            color: 'var(--text-main)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            background: selectedEmployee === emp.id ? 'var(--background)' : 'transparent'
                          }}
                        >
                          <User size={14} style={{ color: '#6366f1' }} /> {emp.card_no} - {emp.name}
                        </div>
                        {emp.family_members?.map(f => (
                          <div 
                            key={`${emp.id}-${f.id}`}
                            onClick={() => handleEmployeeSelect(emp.id, `${emp.card_no}${f.card_no_suffix} - ${f.name}`)}
                            style={{ 
                              padding: '6px 12px 6px 2.5rem', 
                              borderRadius: '8px', 
                              cursor: 'pointer', 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Users size={12} /> {f.name} ({f.relationship})
                          </div>
                        ))}
                      </div>
                    ))}
                    {isSearching && (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading more...</div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', background: 'var(--surface)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)', gap: '4px' }}>
                {['week', 'month', 'year', 'all', 'custom'].map(r => (
                  <button 
                    key={r}
                    onClick={() => setTimeRange(r)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '8px',
                      background: timeRange === r ? '#6366f1' : 'transparent',
                      color: timeRange === r ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: '0.2s',
                      textTransform: 'capitalize'
                    }}
                  >{r}</button>
                ))}
              </div>

              {timeRange === 'custom' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--surface)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                   <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', outline: 'none' }} />
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                   <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', outline: 'none' }} />
                </div>
              )}

              <button 
                onClick={fetchConsumption}
                style={{
                  padding: '10px 24px',
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                <Search size={16} /> Generate Analytics
              </button>


              <button 
                onClick={exportToCSV}
                style={{
                  padding: '10px 20px',
                  background: 'var(--text-main)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>

          {/* SUMMARY CARDS (PRINTABLE) */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${[
              { label: 'Total Visits', val: consumptionData?.total_visits },
              { label: selectedEmployee ? 'Family Size' : 'Active Personnel', val: consumptionData?.total_patients, hideIfEmployee: true },
              { label: 'Med. Variations', val: consumptionData?.items?.length },
              { label: 'Total Units', val: consumptionData?.grand_total_units },
              { label: 'Expenditure', val: `₹${consumptionData?.grand_total_cost?.toLocaleString()}`, printAlways: true }
            ].filter(s => !selectedEmployee || !s.hideIfEmployee).length}, 1fr)`, 
            gap: '1rem', 
            marginBottom: '1.5rem' 
          }}>
            {[
              { label: 'Total Visits', val: consumptionData?.total_visits, icon: CalendarDays, color: '#6366f1', grad: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
              { label: selectedEmployee ? 'Family Size' : 'Active Personnel', val: consumptionData?.total_patients, icon: Users, color: '#10b981', grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', hideIfEmployee: true },
              { label: 'Med. Variations', val: consumptionData?.items?.length, icon: Package, color: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
              { label: 'Total Units', val: consumptionData?.grand_total_units, icon: ShoppingCart, color: '#3b82f6', grad: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
              { label: 'Expenditure', val: `₹${consumptionData?.grand_total_cost?.toLocaleString()}`, icon: IndianRupee, color: '#1e293b', grad: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)', printAlways: true }
            ].filter(s => !selectedEmployee || !s.hideIfEmployee).map((s, i) => (
              <div key={i} style={{ 
                background: s.grad, 
                padding: '1.25rem', 
                borderRadius: '24px', 
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                color: 'white',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                position: 'relative',
                overflow: 'hidden'
              }} className={s.printAlways ? '' : 'no-print'}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                  <s.icon size={20} />
                </div>
                <div style={{ zIndex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>{s.val || 0}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* DETAILED TABLES (PRINTABLE) */}
          <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '1.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="no-print">
              <h3 style={{ fontSize: '0.875rem', fontWeight: 850, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#6366f1' }} /> Detailed Breakdown
              </h3>
            </div>
            
            <div className="table-responsive" style={{ border: 'none' }}>
              {consumptionData?.items?.map((visit, vIdx) => (
                  <div key={vIdx} style={{ marginBottom: '2.5rem', breakInside: 'avoid' }}>
                      <div style={{ 
                          background: '#f8fafc', 
                          padding: '12px 16px', 
                          borderRadius: '8px', 
                          marginBottom: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid #e2e8f0',
                          borderLeft: '5px solid #0f172a'
                      }}>
                           <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CalendarDays size={14} style={{ color: '#64748b' }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                                  {new Date(visit.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '2px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                <ShieldCheck size={12} style={{ color: '#0f172a' }} />
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0f172a' }}>REF: V-{visit.visit_id}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                                <User size={14} style={{ color: '#6366f1' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>{visit.patient_name}</span>
                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{visit.patient_id}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{visit.medications.length} Line Items</span>
                      </div>
                      
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                          <thead>
                              <tr style={{ borderBottom: '2px solid #0f172a' }}>
                                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Medication Description</th>
                                  <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Qty</th>
                                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Rate (₹)</th>
                                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subtotal (₹)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {visit.medications.map((med, mIdx) => (
                                  <tr key={mIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '14px 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>{med.name}</td>
                                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 900, color: '#0f172a' }}>{med.quantity}</td>
                                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>{med.unit_price.toFixed(2)}</td>
                                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>{med.total_cost.toFixed(2)}</td>
                                  </tr>
                              ))}
                              <tr style={{ background: '#f8fafc' }}>
                                <td colSpan={3} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Visit Total:</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 900, color: '#0f172a' }}>
                                   ₹{visit.medications.reduce((sum, m) => sum + m.total_cost, 0).toFixed(2)}
                                </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              ))}
              
              <div style={{ 
                marginTop: '2rem', 
                padding: '1.5rem', 
                background: '#0f172a', 
                borderRadius: '12px', 
                color: 'white', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '2rem'
              }}>
                <div style={{ display: 'flex', gap: '2rem', flex: 1 }}>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.625rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase' }}>Units Dispensed</span>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{consumptionData?.grand_total_units || 0}</p>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.625rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase' }}>Grand Total Cost</span>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>₹{consumptionData?.grand_total_cost?.toLocaleString()}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '150px' }} className="print-only-block">
                  <span style={{ fontSize: '0.625rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase' }}>Certified By</span>
                  <p style={{ margin: '8px 0 0 0', borderBottom: '1px solid rgba(255,255,255,0.3)', width: '100%' }}></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.5rem', opacity: 0.5 }}>Authorized Clinical Officer Signature</p>
                </div>
              </div>

              {(!consumptionData?.items || consumptionData.items.length === 0) && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                    No consumption records found for this selection.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <style>{`
        @media print {
          @page { 
            margin: 0 !important;
            size: auto;
          }
          body { 
            background: white !important; 
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          .print-only-block { display: block !important; }
          
          /* Elite Audit Page Wrapper */
          .printable-report { 
            position: relative;
            margin: 10mm !important; /* Forces content away from page edge */
            padding: 15mm !important; /* Internal breathing room */
            border: 2px solid #0f172a !important; /* Professional 4-sided border */
            background: white !important;
            min-height: calc(100vh - 20mm);
            box-sizing: border-box;
          }

          /* Suppress Browser Metadata */
          header, footer, .sidebar, aside { display: none !important; }
          
          .report-visit-card {
            break-inside: avoid;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 1.5rem !important;
          }
        }
        .print-only-block, .print-only-inline { display: none; }
      `}</style>
    </div>
  );
};

export default Reports;
