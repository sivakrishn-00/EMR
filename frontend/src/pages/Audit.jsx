import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { ClipboardList, Search, Calendar, Filter, User, ChevronLeft, ChevronRight, X, Download, ChevronDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Reusable Custom Select Dropdown for enhanced UI aesthetics
const CustomSelect = ({ options, value, onChange, placeholder = 'Select...', style = {}, primaryColor, height = '52px' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="form-control"
        style={{
          width: '100%',
          height: height,
          borderRadius: '12px',
          background: 'var(--background)',
          border: '1.5px solid var(--border)',
          padding: '0 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          color: 'var(--text-main)',
          textAlign: 'left',
          fontWeight: 600
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={18} style={{ 
          color: 'var(--text-muted)', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          marginLeft: '8px'
        }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '250px',
          overflowY: 'auto',
          padding: '6px'
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
                fontWeight: value === opt.value ? 700 : 500,
                background: value === opt.value ? `${primaryColor || 'var(--primary)'}15` : 'transparent',
                color: value === opt.value ? (primaryColor || 'var(--primary)') : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = 'var(--background)';
                }
              }}
              onMouseLeave={e => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check size={16} color={primaryColor || 'var(--primary)'} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Audit = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(user?.project || '');

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchLogs(1, startDate, endDate, searchQuery, selectedProject);
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('patients/projects/');
            setProjects(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {
            console.error("Failed to load projects", err);
        }
    };

    const fetchLogs = async (pageNum = 1, startStr = startDate, endStr = endDate, searchStr = searchQuery, projId = selectedProject) => {
        setIsLoading(true);
        try {
            let url = `accounts/audit-logs/?page=${pageNum}`;
            if (startStr) url += `&start_date=${startStr}`;
            if (endStr) url += `&end_date=${endStr}`;
            if (searchStr) url += `&search=${encodeURIComponent(searchStr)}`;
            if (projId) url += `&project=${projId}`;

            const res = await api.get(url);
            if (res.data.results) {
                setLogs(res.data.results);
                setTotalCount(res.data.count);
            } else {
                setLogs(res.data);
                setTotalCount(res.data.length);
            }
            setPage(pageNum);
        } catch (err) {
            toast.error("Failed to load audit logs");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchQuery('');
        fetchLogs(1, '', '', '', selectedProject);
    };

    const handleDownloadCSV = async () => {
        try {
            let url = `accounts/audit-logs/download_csv/`;
            const params = [];
            if (startDate) params.push(`start_date=${startDate}`);
            if (endDate) params.push(`end_date=${endDate}`);
            if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
            if (selectedProject) params.push(`project=${selectedProject}`);
            
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
            
            toast.loading("Preparing CSV download...", { id: 'download-csv' });
            const response = await api.get(url, { responseType: 'blob' });
            
            const blob = new Blob([response.data], { type: 'text/csv' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
            toast.success("Audit logs downloaded successfully", { id: 'download-csv' });
        } catch (err) {
            toast.error("Failed to download audit logs", { id: 'download-csv' });
        }
    };

    return (
        <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Audit Logs</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>System-wide compliance and security tracking</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {!user?.project && (
                        <CustomSelect
                            options={[
                                { value: "", label: "All Projects" },
                                ...projects.map(p => ({ value: String(p.id), label: p.name }))
                            ]}
                            value={String(selectedProject || "")}
                            onChange={val => setSelectedProject(val)}
                            placeholder="All Projects"
                            height="44px"
                            style={{ minWidth: '160px' }}
                        />
                    )}
                    {(startDate || endDate || searchQuery) && (
                        <button 
                            className="btn btn-secondary" 
                            style={{ 
                                height: '44px',
                                padding: '0 1.25rem',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                whiteSpace: 'nowrap',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                color: '#ef4444', 
                                borderColor: '#fee2e2', 
                                background: '#fef2f2'
                            }}
                            onClick={handleClearFilters}
                        >
                            <X size={16} /> Remove Filter
                        </button>
                    )}
                    <button 
                        className="btn btn-secondary" 
                        style={{ 
                            height: '44px',
                            padding: '0 1.25rem',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            background: showDatePicker ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
                            borderColor: showDatePicker ? 'var(--primary)' : 'var(--border)'
                        }}
                        onClick={() => {
                            setShowDatePicker(!showDatePicker);
                            setShowFilters(false);
                        }}
                    >
                        <Calendar size={18} color={showDatePicker ? 'var(--primary)' : 'currentColor'} /> Date Range
                    </button>
                    <button 
                        className="btn btn-secondary" 
                        style={{ 
                            height: '44px',
                            padding: '0 1.25rem',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            background: showFilters ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
                            borderColor: showFilters ? 'var(--primary)' : 'var(--border)'
                        }}
                        onClick={() => {
                            setShowFilters(!showFilters);
                            setShowDatePicker(false);
                        }}
                    >
                        <Filter size={18} color={showFilters ? 'var(--primary)' : 'currentColor'} /> Filters
                    </button>
                    <button 
                        className="btn btn-primary" 
                        style={{ 
                            height: '44px',
                            padding: '0 1.25rem',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                        }}
                        onClick={handleDownloadCSV}
                    >
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </header>

            {/* Premium Filter Controls Panel */}
            {(showDatePicker || showFilters) && (
                <div className="card fade-in" style={{ 
                    padding: '1.5rem', 
                    marginBottom: '1.5rem', 
                    background: 'var(--surface)', 
                    borderRadius: '20px',
                    border: '1.5px solid var(--border)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}>
                    {showDatePicker && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                                <input 
                                    type="date" 
                                    className="form-control-simple" 
                                    style={{ 
                                        height: '48px', 
                                        padding: '0 1rem', 
                                        borderRadius: '12px', 
                                        fontSize: '0.9375rem', 
                                        border: '1.5px solid var(--border)', 
                                        background: 'var(--background)',
                                        color: 'var(--text-main)',
                                        fontWeight: 600
                                    }} 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                                <input 
                                    type="date" 
                                    className="form-control-simple" 
                                    style={{ 
                                        height: '48px', 
                                        padding: '0 1rem', 
                                        borderRadius: '12px', 
                                        fontSize: '0.9375rem', 
                                        border: '1.5px solid var(--border)', 
                                        background: 'var(--background)',
                                        color: 'var(--text-main)',
                                        fontWeight: 600
                                    }} 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <button 
                                className="btn btn-primary" 
                                style={{ height: '48px', borderRadius: '12px', padding: '0 1.5rem' }}
                                onClick={() => fetchLogs(1, startDate, endDate, searchQuery)}
                            >
                                Apply Date Range
                            </button>
                        </div>
                    )}

                    {showFilters && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search Logs</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input 
                                        type="text" 
                                        className="form-control-simple" 
                                        placeholder="Search by user, action, module or details..." 
                                        style={{ 
                                            height: '48px', 
                                            paddingLeft: '3rem', 
                                            paddingRight: '1rem',
                                            borderRadius: '12px', 
                                            fontSize: '0.9375rem', 
                                            border: '1.5px solid var(--border)', 
                                            background: 'var(--background)',
                                            color: 'var(--text-main)',
                                            fontWeight: 600,
                                            width: '100%'
                                        }} 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                fetchLogs(1, startDate, endDate, searchQuery);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <button 
                                className="btn btn-primary" 
                                style={{ height: '48px', borderRadius: '12px', padding: '0 1.5rem' }}
                                onClick={() => fetchLogs(1, startDate, endDate, searchQuery)}
                            >
                                Search
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ padding: '1rem 1.5rem' }}>User</th>
                                <th>Module</th>
                                <th>Action</th>
                                <th>Details</th>
                                <th>IP Address</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <User size={14} color="#94a3b8" />
                                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{log.user_name}</span>
                                        </div>
                                    </td>
                                    <td><span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.04em' }}>{log.module}</span></td>
                                    <td><span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{log.action}</span></td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px' }}>{log.details}</td>
                                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.ip_address || '127.0.0.1'}</td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {new Date(log.timestamp).toLocaleDateString()}<br/>
                                        <span style={{ fontSize: '0.625rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && logs.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        <ClipboardList size={40} style={{ marginBottom: '1rem', opacity: 0.1 }} />
                                        <p>No audit records found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {totalCount > 10 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(totalCount / 10)}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-secondary" disabled={page === 1} onClick={() => fetchLogs(page - 1, startDate, endDate, searchQuery, selectedProject)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchLogs(page + 1, startDate, endDate, searchQuery, selectedProject)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Audit;
