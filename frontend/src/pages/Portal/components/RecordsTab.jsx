import React from 'react';
import { Clipboard, Filter, Search, Eye, FileDown } from 'lucide-react';

const RecordsTab = ({ 
    filteredHistory, 
    searchTerm, 
    setSearchTerm,
    currentPage, 
    setCurrentPage, 
    fromDate, 
    setFromDate, 
    toDate, 
    setToDate, 
    setReportView, 
    handleDownloadPDF, 
    formatDate 
}) => {
    const filtered = filteredHistory?.filter(v => {
        if (!searchTerm) return true;
        const searchStr = searchTerm.toLowerCase();
        return (v.diagnosis?.toLowerCase().includes(searchStr) || 
                v.visit_type?.toLowerCase().includes(searchStr) ||
                "Internal Clinic".toLowerCase().includes(searchStr));
    }) || [];
    
    const itemsPerPage = 5;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="a-card" style={{ padding:'2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                    <Clipboard size={20} />
                </div>
                <div>
                    <h3 className="a-card-title" style={{ margin:0 }}>Diagnostic Archive</h3>
                    <p style={{ fontSize:'0.8rem', color:'#64748b', fontWeight:500, marginTop:'0.25rem' }}>Filter and retrieve individual clinical reports from your medical history.</p>
                </div>
            </div>

            <div className="filter-bar" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={16} color="#7c3aed" />
                    <label style={{ color: '#475569', fontWeight: 600, margin: 0, fontSize: '0.85rem' }}>Date Range</label>
                </div>
                <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: '#64748b', margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>FROM</label>
                    <input 
                        type="date" 
                        value={fromDate} 
                        onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }} 
                        max={toDate || new Date().toISOString().split('T')[0]}
                        style={{ borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.4rem', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' }} 
                    />
                </div>
                <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: '#64748b', margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>TO</label>
                    <input 
                        type="date" 
                        value={toDate} 
                        onChange={e => { setToDate(e.target.value); setCurrentPage(1); }} 
                        min={fromDate}
                        max={new Date().toISOString().split('T')[0]}
                        style={{ borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.4rem', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' }} 
                    />
                </div>
                
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={16} color="#7c3aed" />
                    <input 
                        type="text" 
                        placeholder="Search records..." 
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        style={{ borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', width: '200px', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' }} 
                    />
                </div>
            </div>

            {filtered.length > 0 ? (
                <>
                    <div className="table-responsive" style={{ overflowX:'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table className="a-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Primary Diagnosis</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Facility / Unit</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Service Type</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map((visit, idx) => (
                                    <tr key={visit.id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                                        <td style={{ fontWeight: 800, color: '#1e293b' }}>{formatDate(visit.visit_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{visit.consultation?.diagnosis || "--"}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ICD-10 Coded</div>
                                        </td>
                                        <td style={{ color: '#475569', fontWeight: 600 }}>Internal Clinic</td>
                                        <td>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>{visit.visit_type?.toUpperCase() || "OPD"}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button className="btn-action btn-view" onClick={() => setReportView(visit)} style={{ fontWeight: 800 }}>
                                                    <Eye size={14} /> View
                                                </button>
                                                <button className="btn-action btn-down" onClick={() => handleDownloadPDF(visit)} style={{ fontWeight: 800 }}>
                                                    <FileDown size={14} /> PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: currentPage === 1 ? '#f1f5f9' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, color: currentPage === 1 ? '#94a3b8' : '#475569' }}
                                >
                                    Previous
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        style={{ 
                                            padding: '0.4rem 0.8rem', 
                                            borderRadius: '6px', 
                                            border: '1px solid #e2e8f0', 
                                            background: currentPage === i + 1 ? 'linear-gradient(135deg, #4c1d95, #6d28d9)' : 'white', 
                                            color: currentPage === i + 1 ? 'white' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: currentPage === totalPages ? '#f1f5f9' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, color: currentPage === totalPages ? '#94a3b8' : '#475569' }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af', background:'#f9fafb', borderRadius:'12px', border:'1px dashed var(--border)' }}>No records found for the selected criteria.</div>
            )}
        </div>
    );
};

export default RecordsTab;
