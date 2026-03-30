import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ClipboardList, Search, Calendar, Filter, User, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Audit = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async (pageNum = 1) => {
        setIsLoading(true);
        try {
            const res = await api.get(`accounts/audit-logs/?page=${pageNum}`);
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

    return (
        <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Audit Logs</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>System-wide compliance and security tracking</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.625rem 1rem' }}>
                        <Calendar size={18} /> Date Range
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.625rem 1rem' }}>
                        <Filter size={18} /> Filters
                    </button>
                </div>
            </header>

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
                                    <td style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '300px' }}>{log.details}</td>
                                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.ip_address || '127.0.0.1'}</td>
                                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {new Date(log.timestamp).toLocaleDateString()}<br/>
                                        <span style={{ fontSize: '0.625rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && logs.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Page {page} of {Math.ceil(totalCount / 10)}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-secondary" disabled={page === 1} onClick={() => fetchLogs(page - 1)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchLogs(page + 1)}
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
