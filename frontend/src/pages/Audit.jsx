import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ClipboardList, Search, Calendar, Filter, User, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Audit = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async (pageNum = 1, startStr = startDate, endStr = endDate, searchStr = searchQuery) => {
        setIsLoading(true);
        try {
            let url = `accounts/audit-logs/?page=${pageNum}`;
            if (startStr) url += `&start_date=${startStr}`;
            if (endStr) url += `&end_date=${endStr}`;
            if (searchStr) url += `&search=${encodeURIComponent(searchStr)}`;

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
        fetchLogs(1, '', '', '');
    };

    return (
        <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Audit Logs</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>System-wide compliance and security tracking</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {(startDate || endDate || searchQuery) && (
                        <button 
                            className="btn btn-secondary" 
                            style={{ 
                                padding: '0.625rem 1rem', 
                                color: '#ef4444', 
                                borderColor: '#fee2e2', 
                                background: '#fef2f2',
                                borderRadius: '14px',
                                fontSize: '0.875rem',
                                fontWeight: 700
                            }}
                            onClick={handleClearFilters}
                        >
                            <X size={16} /> Remove Filter
                        </button>
                    )}
                    <button 
                        className="btn btn-secondary" 
                        style={{ 
                            padding: '0.625rem 1rem',
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
                            padding: '0.625rem 1rem',
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
                                className="btn btn-secondary" disabled={page === 1} onClick={() => fetchLogs(page - 1, startDate, endDate, searchQuery)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchLogs(page + 1, startDate, endDate, searchQuery)}
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
