import React from 'react';
import { Clock, History, Search, Plus, X, ShieldCheck, Calendar } from 'lucide-react';

const AppointmentsTab = ({ 
    dossier, 
    scheduleTab, 
    setScheduleTab, 
    appointmentSearchTerm, 
    setAppointmentSearchTerm, 
    currentApptPage, 
    setCurrentApptPage, 
    setShowBookingModal, 
    patientData, 
    handleAcknowledgeAppointment, 
    handleRejectAppointment, 
    formatDate 
}) => {
    const filtered = dossier?.appointments?.filter(a => {
        let matchTab = false;
        if (scheduleTab === 'ACTIVE') {
            matchTab = ['SCHEDULED', 'CONFIRMED', 'PATIENT_ACKNOWLEDGED'].includes(a.status);
        } else {
            matchTab = ['REJECTED', 'CANCELLED', 'CHECKED_IN', 'NO_SHOW'].includes(a.status);
        }
        if (!matchTab) return false;

        if (!appointmentSearchTerm) return true;
        const searchStr = appointmentSearchTerm.toLowerCase();
        return (a.reason?.toLowerCase().includes(searchStr) || 
                a.status?.toLowerCase().includes(searchStr));
    }) || [];
    
    const itemsPerPage = 5;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const indexOfLastItem = currentApptPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="a-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div 
                        onClick={() => { setScheduleTab('ACTIVE'); setCurrentApptPage(1); }}
                        style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 800, 
                            color: scheduleTab === 'ACTIVE' ? '#7c3aed' : '#94a3b8', 
                            cursor: 'pointer',
                            paddingBottom: '0.5rem',
                            borderBottom: scheduleTab === 'ACTIVE' ? '3px solid #7c3aed' : '3px solid transparent',
                            transition: '0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Clock size={18} /> Active Schedule
                    </div>
                    <div 
                        onClick={() => { setScheduleTab('HISTORY'); setCurrentApptPage(1); }}
                        style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 800, 
                            color: scheduleTab === 'HISTORY' ? '#7c3aed' : '#94a3b8', 
                            cursor: 'pointer',
                            paddingBottom: '0.5rem',
                            borderBottom: scheduleTab === 'HISTORY' ? '3px solid #7c3aed' : '3px solid transparent',
                            transition: '0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <History size={18} /> Appointment History
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={16} color="#7c3aed" />
                        <input 
                            type="text" 
                            placeholder="Search appointments..." 
                            value={appointmentSearchTerm}
                            onChange={e => { setAppointmentSearchTerm(e.target.value); setCurrentApptPage(1); }}
                            style={{ borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', width: '200px', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' }} 
                        />
                    </div>
                    
                    {patientData.allow_appointments !== false && (
                        <button 
                            onClick={() => setShowBookingModal(true)}
                            style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', color:'white', border:'none', padding:'0.6rem 1.5rem', borderRadius:'8px', fontWeight:800, cursor:'pointer', fontSize:'0.875rem', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s', height: '32px' }}
                        >
                            <Plus size={16} /> New Appointment
                        </button>
                    )}
                </div>
            </div>

            {filtered.length > 0 ? (
                <>
                    <div className="table-responsive" style={{ overflowX:'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table className="a-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Date & Time</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Clinical Reason</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'white', fontWeight: 700, textTransform: 'uppercase', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>Service Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map((appt, idx) => (
                                    <tr key={appt.id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                                        <td>
                                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{formatDate(appt.appointment_date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{appt.formatted_time}</div>
                                        </td>
                                        <td style={{ maxWidth: '300px' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{appt.reason}</div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '6px', 
                                                    padding: '6px 14px', 
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.02em',
                                                    background: appt.status === 'PATIENT_ACKNOWLEDGED' ? 'rgba(5, 150, 105, 0.08)' : appt.status === 'CONFIRMED' ? 'rgba(99, 102, 241, 0.08)' : appt.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.08)' : appt.status === 'SCHEDULED' ? 'rgba(245, 158, 11, 0.08)' : '#f8fafc',
                                                    color: appt.status === 'PATIENT_ACKNOWLEDGED' ? '#059669' : appt.status === 'CONFIRMED' ? 'var(--primary)' : appt.status === 'REJECTED' ? '#ef4444' : appt.status === 'SCHEDULED' ? '#f59e0b' : '#64748b',
                                                    border: '1px solid ' + (appt.status === 'PATIENT_ACKNOWLEDGED' ? '#10b98133' : appt.status === 'CONFIRMED' ? '#6366f133' : appt.status === 'REJECTED' ? '#ef444433' : appt.status === 'SCHEDULED' ? '#fbbf2433' : '#e2e8f0'),
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                }}>
                                                    {appt.status === 'REJECTED' ? <X size={12} /> : (appt.status === 'PATIENT_ACKNOWLEDGED' || appt.status === 'CONFIRMED') ? <ShieldCheck size={12} /> : <Clock size={12} />}
                                                    {appt.status === 'PATIENT_ACKNOWLEDGED' ? 'Slot Verified' : appt.status === 'CONFIRMED' ? 'Slot Proposed' : appt.status === 'REJECTED' ? 'Slot Declined' : appt.status === 'SCHEDULED' ? 'Awaiting Slot' : appt.status}
                                                </div>
                                                
                                                {appt.status === 'CONFIRMED' && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button 
                                                            onClick={() => handleAcknowledgeAppointment(appt.id)}
                                                            className="a-btn-primary"
                                                            style={{ 
                                                                padding: '6px 14px', 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: 900, 
                                                                borderRadius: '8px',
                                                                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                background: 'var(--primary)',
                                                                color: 'white'
                                                            }}
                                                        >
                                                            Accept Slot
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRejectAppointment(appt.id)}
                                                            style={{ 
                                                                padding: '6px 14px', 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: 800, 
                                                                borderRadius: '8px',
                                                                border: '1px solid #fee2e2',
                                                                background: '#fef2f2',
                                                                color: '#ef4444',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Decline
                                                        </button>
                                                    </div>
                                                )}
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
                                    onClick={() => setCurrentApptPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentApptPage === 1}
                                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: currentApptPage === 1 ? '#f1f5f9' : 'white', cursor: currentApptPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, color: currentApptPage === 1 ? '#94a3b8' : '#475569' }}
                                >
                                    Previous
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setCurrentApptPage(i + 1)}
                                        style={{ 
                                            padding: '0.4rem 0.8rem', 
                                            borderRadius: '6px', 
                                            border: '1px solid #e2e8f0', 
                                            background: currentApptPage === i + 1 ? 'linear-gradient(135deg, #4c1d95, #6d28d9)' : 'white', 
                                            color: currentApptPage === i + 1 ? 'white' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setCurrentApptPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentApptPage === totalPages}
                                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: currentApptPage === totalPages ? '#f1f5f9' : 'white', cursor: currentApptPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, color: currentApptPage === totalPages ? '#94a3b8' : '#475569' }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <Calendar size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No scheduled appointments found</p>
                    <p style={{ fontSize: '0.8rem' }}>Click "New Appointment" to reserve a slot.</p>
                </div>
            )}
        </div>
    );
};

export default AppointmentsTab;
