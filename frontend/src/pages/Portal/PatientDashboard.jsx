import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
    Activity, 
    Calendar, 
    FileText, 
    Clipboard, 
    User, 
    LogOut, 
    Clock, 
    Download,
    Zap,
    ShieldCheck,
    Menu,
    X,
    Camera,
    HeartPulse,
    Search,
    ChevronRight,
    CheckCircle2,
    LayoutDashboard,
    Bell,
    Settings,
    ArrowUpRight,
    Filter,
    FileDown,
    Stethoscope,
    FlaskConical,
    Pill,
    UserCheck,
    Thermometer,
    Gauge,
    Weight,
    Dna,
    ArrowLeft,
    Eye,
    Info,
    History,
    Plus,
    MapPin,
    AlertCircle
} from 'lucide-react';

const PatientDashboard = () => {
    const { user, logout } = useAuth(); 
    const navigate = useNavigate();
    const location = useLocation();
    
    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [activeTab, setActiveTab] = useState('Overview');

    // 📄 REPORT GENERATION ENGINE (MNC Standard - Backend PDF)
    const handleDownloadReport = async (v) => {
        const loadId = toast.loading("Connecting to Secure Report Engine...");
        try {
            const vDate = v.visit_date ? v.visit_date.split('T')[0] : '';
            const response = await api.get(`patients/patients/download_report/?date=${vDate}`, {
                responseType: 'blob'
            });
            
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Clinical_Report_${vDate || 'latest'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("High-Fidelity PDF Ready", { id: loadId });
        } catch (err) {
            console.error("PDF Generation Error:", err);
            toast.error("Failed to generate Secure PDF. Registry sync required.", { id: loadId });
        }
    };

    const [reportView, setReportView] = useState(null); // High-fidelity Dossier Modal
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingForm, setBookingForm] = useState({ date: '', time: '', reason: '' });
    const [isBooking, setIsBooking] = useState(false);
    
    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    
    // Sync tab with URL
    const currentTab = location.pathname.includes('records') ? 'Records' : 
                      location.pathname.includes('appointments') ? 'Appointments' : 'Dashboard';

    // Filtering states
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        fetchDossier();
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000); // Pulse every minute
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('accounts/notifications/');
            setNotifications(Array.isArray(res.data) ? res.data : []);
            setUnreadCount(Array.isArray(res.data) ? res.data.filter(n => !n.is_read).length : 0);
        } catch (err) {
            console.error("Notification pulse failed");
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('accounts/notifications/mark_all_as_read/');
            setUnreadCount(0);
            fetchNotifications();
        } catch (err) {
            toast.error("Failed to update notifications");
        }
    };

    const fetchDossier = async () => {
        try {
            const res = await api.get('patients/patients/me/full_report/');
            setDossier(res.data);
            const history = res.data.visit_history || res.data.visits || [];
            if (history.length > 0) {
                setSelectedVisit(history[0]);
            }
        } catch (err) {
            toast.error("Medical Bridge Securely Connected");
        } finally {
            setLoading(false);
        }
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        if (!bookingForm.date || !bookingForm.time) {
            toast.error("Please select a date and time");
            return;
        }
        
        setIsBooking(true);
        const loadId = toast.loading("Reserving your clinical slot...");
        try {
            const appointment_date = `${bookingForm.date}T${bookingForm.time}:00`;
            await api.post('clinical/appointments/', {
                appointment_date,
                reason: bookingForm.reason || 'General Consultation'
            });
            toast.success("Appointment Scheduled Successfully!", { id: loadId });
            setShowBookingModal(false);
            setBookingForm({ date: '', time: '', reason: '' });
            fetchDossier(); // Refresh stats
        } catch (err) {
            console.error("Booking Error:", err.response?.data);
            const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : "Failed to book appointment. Please try again.";
            toast.error(errorMsg, { id: loadId });
        } finally {
            setIsBooking(false);
        }
    };

    const [scheduleTab, setScheduleTab] = useState('ACTIVE');

    const handleAcknowledgeAppointment = async (apptId) => {
        const loading = toast.loading('Acknowledging clinical slot...');
        try {
            await api.post(`clinical/appointments/${apptId}/acknowledge/`);
            toast.success("Slot Acknowledged! See you then.", { id: loading });
            fetchDossier(); // Refresh dossier
        } catch (err) {
            toast.error("Failed to acknowledge slot.", { id: loading });
        }
    };

    const handleRejectAppointment = async (apptId) => {
        const loading = toast.loading('Processing rejection...');
        try {
            await api.post(`clinical/appointments/${apptId}/reject/`);
            toast.success("Slot Declined. You can request a new time.", { id: loading });
            fetchDossier();
        } catch (err) {
            toast.error("Failed to process request.", { id: loading });
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleTabChange = (tab) => {
        const path = tab === 'Dashboard' ? '/portal/dashboard' : 
                     tab === 'Records' ? '/portal/records' : '/portal/appointments';
        navigate(path);
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
             <div className="hq-loader"></div>
             <style>{`
                 .hq-loader { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s infinite linear; }
                 @keyframes spin { to { transform: rotate(360deg); } }
             `}</style>
        </div>
    );

    const patientData = {
        patient_id: dossier?.patient_id || dossier?.registry_metadata?.patient_id,
        full_name: dossier?.full_name || dossier?.registry_metadata?.full_name || user?.username || 'Verified Patient',
        email: user?.email || dossier?.email || dossier?.registry_metadata?.email,
        ...(dossier?.registry_metadata || {}),
        ...(dossier?.patient || {})
    };
    const visitHistory = dossier?.visit_history || dossier?.visits || [];
    
    // Filter logic
    const filteredHistory = visitHistory.filter(v => {
        if (!fromDate && !toDate) return true;
        const vDate = new Date(v.visit_date);
        const fDate = fromDate ? new Date(fromDate) : null;
        const tDate = toDate ? new Date(toDate) : null;
        if (fDate && vDate < fDate) return false;
        if (tDate && vDate > tDate) return false;
        return true;
    });

    const stats = {
        total_visits: dossier?.clinical_summary?.total_visits || visitHistory.length,
        total_lab_investigations: dossier?.clinical_summary?.total_lab_investigations || 
                                   visitHistory.reduce((acc, v) => acc + (v.lab_requests?.length || 0), 0),
        total_active_prescriptions: dossier?.clinical_summary?.total_active_prescriptions || 
                                     visitHistory.reduce((acc, v) => acc + (v.prescriptions?.length || 0), 0),
        total_appointments: dossier?.clinical_summary?.total_appointments || (dossier?.appointments || []).length
    };

    const formatDate = (dateStr, options = { day:'2-digit', month:'2-digit', year:'numeric' }) => {
        if (!dateStr) return '--/--/----';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', options);
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const checkRangeStatus = (value, rangeStr) => {
        if (!rangeStr || !value || rangeStr === 'N/A') return 'normal';
        // Match ranges like "12.0 - 16.0" or "12-16"
        const match = rangeStr.match(/(\d+\.?\d*)\s*[-]\s*(\d+\.?\d*)/);
        if (match) {
            const min = parseFloat(match[1]);
            const max = parseFloat(match[2]);
            const val = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
            if (!isNaN(val)) {
                if (val < min || val > max) return 'abnormal';
            }
        }
        return 'normal';
    };

    // --- ELITE DIAGNOSTIC DOSSIER MODAL ---
    const renderDossierModal = () => {
        if (!reportView) return null;
        const v = reportView;
        const vitals = v.vitals || {};
        const consultation = v.consultation || {};
        
        return (
            <div className="dossier-overlay" onClick={() => setReportView(null)}>
                <style>{`
                    .dossier-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(15, 23, 42, 0.6);
                        backdrop-filter: blur(8px);
                        z-index: 3000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 2rem;
                        font-family: 'Inter', sans-serif;
                    }
                    
                    .dossier-container {
                        background: #f8fafc;
                        width: 100%;
                        max-width: 1200px;
                        height: 90vh;
                        border-radius: 32px;
                        display: flex;
                        overflow: hidden;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
                        animation: dossierModalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    }

                    @keyframes dossierModalIn {
                        from { opacity: 0; transform: scale(0.95) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    
                    .d-sidebar {
                        width: 320px;
                        background: #ffffff;
                        border-right: 1px solid #e2e8f0;
                        padding: 2.5rem;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                    }
                    
                    .d-content {
                        flex: 1;
                        padding: 3rem;
                        overflow-y: auto;
                        scrollbar-width: thin;
                        scrollbar-color: #cbd5e1 transparent;
                    }

                    .d-close {
                        position: absolute;
                        top: 1.5rem;
                        left: 1.5rem;
                        color: #94a3b8;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.7rem;
                        font-weight: 800;
                        text-transform: uppercase;
                        transition: 0.2s;
                    }
                    .d-close:hover { color: #4f46e5; }

                    .p-badge {
                        width: 64px;
                        height: 64px;
                        border-radius: 18px;
                        background: #f1f5f9;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #cbd5e1;
                        margin-bottom: 1.5rem;
                        margin-top: 1rem;
                    }

                    .d-meta-item { margin-bottom: 1.25rem; }
                    .d-meta-label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
                    .d-meta-val { font-size: 0.85rem; font-weight: 700; color: #1e293b; }

                    /* Premium UI Cards */
                    .d-card { 
                        background: white; 
                        border-radius: 24px; 
                        border: 1px solid #e2e8f0; 
                        padding: 2rem; 
                        margin-bottom: 1.5rem; 
                        box-shadow: 0 1px 3px rgba(0,0,0,0.02); 
                    }
                    .d-card-header { 
                        font-size: 0.75rem; 
                        font-weight: 900; 
                        color: #6366f1; 
                        text-transform: uppercase; 
                        letter-spacing: 0.08em; 
                        margin-bottom: 1.75rem; 
                        display: flex; 
                        align-items: center; 
                        gap: 0.75rem; 
                    }
                    .d-card-header::after { content:''; height: 1px; background: #f1f5f9; flex: 1; }

                    .v-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
                    .v-item { display: flex; flex-direction: column; gap: 0.25rem; }
                    .v-label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                    .v-val { font-size: 1.75rem; font-weight: 900; color: #0f172a; display: flex; align-items: baseline; gap: 4px; }
                    .v-unit { font-size: 0.8rem; font-weight: 700; color: #cbd5e1; }

                    .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                    .tag-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                    .tag-item { 
                        padding: 0.5rem 0.875rem; 
                        border-radius: 10px; 
                        background: #f8fafc; 
                        border: 1px solid #e2e8f0; 
                        font-size: 0.75rem; 
                        font-weight: 700; 
                        color: #475569;
                    }
                    .tag-yes { background: #ecfdf5; border-color: #10b981; color: #059669; }

                    .exam-grid-elite { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                    .exam-pill { 
                        background: #ffffff; 
                        border: 1px solid #e2e8f0; 
                        padding: 1.5rem; 
                        border-radius: 20px; 
                        transition: all 0.3s ease;
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    .exam-pill:hover { border-color: #6366f1; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                    .exam-pill-label { font-size: 0.6rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                    .exam-pill-val { font-size: 1rem; font-weight: 800; color: #10b981; }

                    .table-elite { width: 100%; border-collapse: collapse; }
                    .table-elite th { text-align: left; font-size: 0.65rem; font-weight: 800; color: #94a3b8; padding: 1rem; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
                    .table-elite td { padding: 1.25rem 1rem; font-size: 0.85rem; font-weight: 700; color: #334155; border-bottom: 1px solid #f8fafc; }
                    
                    .export-btn { 
                        width: 100%; 
                        padding: 0.875rem; 
                        border-radius: 12px; 
                        background: #0f172a; 
                        color: white; 
                        border: none; 
                        fontWeight: 800; 
                        fontSize: 0.75rem; 
                        cursor: pointer; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 0.5rem;
                        margin-top: auto;
                        transition: 0.2s;
                    }
                    .export-btn:hover { background: #1e293b; transform: translateY(-1px); }
                `}</style>

                <div className="dossier-container" onClick={e => e.stopPropagation()}>
                    <aside className="d-sidebar">
                        <div className="d-close" onClick={() => setReportView(null)}><ArrowLeft size={14} /> Back</div>
                        
                        <div className="p-badge" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', border: '1px solid #e2e8f0' }}><User size={32} color="#94a3b8" /></div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>{patientData.full_name || user?.username}</h2>
                        <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', marginBottom: '2.5rem', background: '#eef2ff', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>UID: {dossier?.patient_id || patientData.patient_id || 'N/A'}</p>
                        
                        <div className="d-meta-item"><span className="d-meta-label">Visit Registry Date</span><div className="d-meta-val">{formatDate(v.visit_date, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
                        <div className="d-meta-item"><span className="d-meta-label">Facility Location</span><div className="d-meta-val">Main Clinical Hub</div></div>
                        <div className="d-meta-item"><span className="d-meta-label">Protocol Status</span><div className="d-meta-val" style={{ color: '#10b981' }}>VERIFIED ARCHIVE</div></div>
                        
                        <button className="export-btn" onClick={() => handleDownloadReport(v)}>
                            <Download size={16} /> Export Diagnostic Report
                        </button>
                    </aside>

                    <main className="d-content">
                        <div className="d-card">
                            <div className="d-card-header"><Gauge size={18} /> Vitals Monitoring</div>
                            <div className="v-grid">
                                <div className="v-item">
                                    <span className="v-label">Body Temperature</span>
                                    <div className="v-val">
                                        {vitals.temperature_c ? (
                                            <>{vitals.temperature_c}<span className="v-unit">°C</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                                <div className="v-item">
                                    <span className="v-label">Blood Pressure</span>
                                    <div className="v-val" style={{ color: '#6366f1' }}>
                                        {vitals.blood_pressure_sys ? (
                                            <>{vitals.blood_pressure_sys}/{vitals.blood_pressure_dia}<span className="v-unit">mmHg</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                                <div className="v-item">
                                    <span className="v-label">Heart Rate / Pulse</span>
                                    <div className="v-val">
                                        {vitals.heart_rate ? (
                                            <>{vitals.heart_rate}<span className="v-unit">BPM</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                                <div className="v-item">
                                    <span className="v-label">Oxygen SPO2</span>
                                    <div className="v-val">
                                        {vitals.spo2 ? (
                                            <>{vitals.spo2}<span className="v-unit">%</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '3rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                                <div className="v-item">
                                    <span className="v-label">BMI Score</span>
                                    <div className="v-val" style={{ fontSize: '1.25rem' }}>
                                        {vitals.bmi ? (
                                            <>{vitals.bmi}<span className="v-unit">kg/m²</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                                <div className="v-item">
                                    <span className="v-label">Resp. Rate</span>
                                    <div className="v-val" style={{ fontSize: '1.25rem' }}>
                                        {vitals.respiratory_rate ? (
                                            <>{vitals.respiratory_rate}<span className="v-unit">CPM</span></>
                                        ) : '--'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="history-grid">
                            <div className="d-card">
                                <div className="d-card-header"><History size={18} /> Personal History</div>
                                <div className="tag-list">
                                    <div className={`tag-item ${vitals.smoking === 'YES' ? 'tag-yes' : ''}`}>SMOKING: {vitals.smoking || '--'}</div>
                                    <div className={`tag-item ${vitals.alcohol === 'YES' ? 'tag-yes' : ''}`}>ALCOHOL: {vitals.alcohol || '--'}</div>
                                    <div className={`tag-item ${vitals.physical_activity === 'YES' ? 'tag-yes' : ''}`}>ACTIVITY: {vitals.physical_activity || '--'}</div>
                                    <div className="tag-item">FOOD: {vitals.food_habit || '--'}</div>
                                </div>
                            </div>
                            <div className="d-card">
                                <div className="d-card-header"><Dna size={18} /> Family History</div>
                                <div className="tag-list">
                                    <div className={`tag-item ${vitals.family_dm === 'YES' ? 'tag-yes' : ''}`}>DIABETES: {vitals.family_dm || '--'}</div>
                                    <div className={`tag-item ${vitals.family_htn === 'YES' ? 'tag-yes' : ''}`}>HTN: {vitals.family_htn || '--'}</div>
                                    <div className={`tag-item ${vitals.family_cvs === 'YES' ? 'tag-yes' : ''}`}>CVS: {vitals.family_cvs || '--'}</div>
                                    <div className={`tag-item ${vitals.family_tb === 'YES' ? 'tag-yes' : ''}`}>TB: {vitals.family_tb || '--'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="d-card">
                            <div className="d-card-header"><Activity size={18} /> Systemic Examination</div>
                            <div className="exam-grid-elite">
                                {[
                                    { id: 'RESP', label: 'Respiratory', val: vitals.sys_respiratory },
                                    { id: 'CVS', label: 'C.V.S', val: vitals.sys_cvs },
                                    { id: 'CNS', label: 'C.N.S', val: vitals.sys_cns },
                                    { id: 'GIS', label: 'G.I.S', val: vitals.sys_gis },
                                    { id: 'MSS', label: 'M.S.S', val: vitals.sys_mss },
                                    { id: 'GUS', label: 'G.U.S', val: vitals.sys_gus },
                                ].map(sys => (
                                    <div key={sys.id} className="exam-pill">
                                        <span className="exam-pill-label">{sys.label} SYSTEM</span>
                                        <span className="exam-pill-val" style={{ color: sys.val ? '#10b981' : '#94a3b8' }}>{sys.val || '--'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="d-card">
                            <div className="d-card-header"><FlaskConical size={18} /> Laboratory Diagnostics</div>
                            {v.lab_requests?.length > 0 ? (
                                <table className="table-elite">
                                    <thead>
                                        <tr>
                                            <th>Investigation</th>
                                            <th>Result Value</th>
                                            <th>Biological Reference</th>
                                            <th style={{ textAlign: 'right' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {v.lab_requests.map((lr, lidx) => {
                                            const subResults = [];
                                            if (lr.result?.values && Object.keys(lr.result.values).length > 0) {
                                                Object.entries(lr.result.values).forEach(([name, val]) => {
                                                    const range = lr.test_master_details?.sub_tests?.find(st => st.name === name)?.biological_range || lr.result?.reference_range || "N/A";
                                                    subResults.push({ name, val, range });
                                                });
                                            } else {
                                                subResults.push({ 
                                                    name: "General Result", 
                                                    val: lr.result?.value || "Result Pending", 
                                                    range: lr.result?.reference_range || "N/A"
                                                });
                                            }

                                            return (
                                                <React.Fragment key={lidx}>
                                                    <tr style={{ background: '#f8fafc' }}>
                                                        <td colSpan="4" style={{ padding: '0.875rem 1rem', borderTop: lidx > 0 ? '1px solid #e2e8f0' : 'none' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <FlaskConical size={14} color="#6366f1" />
                                                                </div>
                                                                <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lr.test_name}</span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', background: 'white', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginLeft: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                                    <Clock size={12} /> {formatDate(lr.result?.recorded_at || lr.created_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {subResults.map((res, ridx) => {
                                                        const status = checkRangeStatus(res.val, res.range);
                                                        return (
                                                            <tr key={`${lidx}-${ridx}`} style={{ borderBottom: ridx === subResults.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '1rem 1rem 1rem 3rem' }}>
                                                                    <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{res.name}</span>
                                                                </td>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ 
                                                                        fontSize: '0.95rem', 
                                                                        fontWeight: 900, 
                                                                        color: status === 'abnormal' ? '#ef4444' : '#10b981',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                        {res.val}
                                                                        {status === 'abnormal' && <AlertCircle size={12} />}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                                                                    {res.range}
                                                                </td>
                                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                    <span style={{ 
                                                                        fontSize: '0.65rem', 
                                                                        fontWeight: 900, 
                                                                        color: '#10b981', 
                                                                        background: '#ecfdf5', 
                                                                        padding: '4px 10px', 
                                                                        borderRadius: '6px', 
                                                                        border: '1px solid #d1fae5' 
                                                                    }}>
                                                                        RELEASED
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>No laboratory investigations recorded for this visit.</div>
                            )}
                        </div>

                        <div className="d-card">
                            <div className="d-card-header"><Pill size={18} /> Pharmacy Prescriptions</div>
                            {v.prescriptions?.length > 0 ? (
                                <table className="table-elite">
                                    <thead>
                                        <tr>
                                            <th>Medication / Regimen</th>
                                            <th>Dosage</th>
                                            <th>Frequency</th>
                                            <th>Duration</th>
                                            <th style={{ textAlign: 'right' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {v.prescriptions.map((p, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 800, color: '#0f172a' }}>{p.medication_name}</td>
                                                <td style={{ fontWeight: 700 }}>{p.dosage}</td>
                                                <td><span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '3px 8px', borderRadius: '6px' }}>{p.frequency}</span></td>
                                                <td style={{ color: '#64748b' }}>{p.duration}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <span style={{ 
                                                        fontSize: '0.55rem', 
                                                        fontWeight: 900, 
                                                        color: p.status === 'DISPENSED' ? '#10b981' : '#f59e0b', 
                                                        background: p.status === 'DISPENSED' ? '#ecfdf5' : '#fffbeb', 
                                                        padding: '4px 10px', 
                                                        borderRadius: '6px',
                                                        border: `1px solid ${p.status === 'DISPENSED' ? '#d1fae5' : '#fef3c7'}`
                                                    }}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>No active prescriptions found for this clinical visit.</div>
                            )}
                        </div>

                        <div className="d-card">
                            <div className="d-card-header"><Clipboard size={18} /> Clinical Conclusion</div>
                            <div style={{ padding: '0.5rem' }}>
                                <span className="d-meta-label">Primary Diagnosis</span>
                                <h3 style={{ margin: '0.5rem 0 1.5rem', fontSize: '1.25rem', fontWeight: 900, color: '#6366f1' }}>{consultation.diagnosis || (v.is_active ? "Awaiting Assessment" : "--")}</h3>
                                
                                <span className="d-meta-label">Clinical Advice & Plan</span>
                                <p style={{ margin: '0.5rem 0 0', fontWeight: 600, color: '#475569', lineHeight: 1.7, fontSize: '0.9rem' }}>{consultation.plan || (v.is_active ? "Clinical plan will be established following assessment." : "--")}</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    };

    const renderNotifications = () => {
        if (!showNotifications) return null;
        return (
            <div 
                style={{ 
                    position: 'absolute', 
                    top: '60px', 
                    right: '80px', 
                    width: '320px', 
                    background: 'white', 
                    borderRadius: '16px', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', 
                    border: '1px solid #e5e7eb',
                    zIndex: 1001,
                    overflow: 'hidden',
                    animation: 'slideInDown 0.2s ease-out'
                }}
            >
                <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1f2937' }}>Alerts & Notifications</span>
                    {unreadCount > 0 && (
                        <button 
                            onClick={handleMarkAllRead}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-blue)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                            Mark all read
                        </button>
                    )}
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length > 0 ? notifications.map((n, i) => (
                        <div 
                            key={i} 
                            style={{ 
                                padding: '1rem', 
                                borderBottom: i === notifications.length - 1 ? 'none' : '1px solid #f9fafb',
                                background: n.is_read ? 'white' : '#f5f7ff',
                                transition: '0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: n.is_read ? 'transparent' : 'var(--admin-blue)', 
                                    marginTop: '4px',
                                    flexShrink: 0 
                                }}></div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#111827', marginBottom: '2px' }}>{n.title}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', lineHeight: 1.4 }}>{n.message}</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={10} /> {formatDate(n.created_at, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#9ca3af' }}>
                            <Bell size={24} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>No new notifications</div>
                        </div>
                    )}
                </div>
                <style>{`
                    @keyframes slideInDown {
                        from { transform: translateY(-10px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <div className="admin-style-portal">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                
                :root {
                    --admin-blue: #4f46e5;
                    --admin-green: #10b981;
                    --admin-orange: #f59e0b;
                    --admin-red: #ef4444;
                    --admin-purple: #8b5cf6;
                    --bg: #f3f4f6;
                    --border: #e5e7eb;
                }

                .admin-style-portal {
                    min-height: 100vh;
                    background: var(--bg);
                    font-family: 'Inter', sans-serif;
                    color: #1f2937;
                }

                /* --- ADMIN HEADER --- */
                .a-header {
                    background: #ffffff;
                    height: 70px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-bottom: 1px solid var(--border);
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    padding: 0 2rem;
                }
                .a-header-inner {
                    width: 100%;
                    max-width: 1400px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .a-brand-block { display: flex; flex-direction: column; justify-content: center; }
                .a-brand { font-weight: 900; font-size: 0.9rem; color: #4338ca; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1; }
                .a-brand-sub { font-size: 0.65rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-top: 2px; }

                .a-nav { display: flex; gap: 2.5rem; height: 100%; align-items: center; }
                .a-nav-item {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #6b7280;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    position: relative;
                    height: 100%;
                    transition: 0.2s;
                }
                .a-nav-item:hover { color: var(--admin-blue); }
                .a-nav-item.active { color: var(--admin-blue); }
                .a-nav-item.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: var(--admin-blue);
                }

                .a-user-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.4rem 0.875rem;
                    background: white;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.8rem;
                }

                /* --- CONTENT AREA --- */
                .a-container { 
                    padding: 2.5rem 2rem; 
                    max-width: 1400px; 
                    margin: 0 auto; 
                }
                
                .a-greeting { margin-bottom: 2rem; }
                .a-greeting h1 { font-size: 1.5rem; font-weight: 800; margin: 0; color: #111827; }
                .a-greeting p { font-size: 0.8rem; color: #6b7280; font-weight: 600; margin-top: 0.4rem; display: flex; align-items: center; gap: 0.4rem; }

                /* --- STATS --- */
                .a-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2.5rem; }
                .a-stat-card {
                    padding: 1.5rem;
                    border-radius: 16px;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    cursor: pointer;
                }
                .card-blue { background: linear-gradient(135deg, #4f46e5, #6366f1); }
                .card-green { background: linear-gradient(135deg, #10b981, #34d399); }
                .card-orange { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
                .card-purple { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }
                .a-stat-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; opacity: 0.85; }
                .a-badge { background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.55rem; }
                .a-stat-val { font-size: 1.85rem; font-weight: 900; margin-top: 0.5rem; display: block; }
                .a-stat-icon { position: absolute; bottom: 1rem; right: 1rem; opacity: 0.15; }

                /* --- CARD --- */
                .a-card { background: white; border-radius: 14px; border: 1px solid var(--border); padding: 1.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
                .a-card-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 1.5rem; color: #111827; display: flex; align-items: center; gap: 0.75rem; }

                /* --- TABLE & FILTER --- */
                .filter-bar { display: flex; gap: 1.5rem; align-items: center; background: #f9fafb; padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid var(--border); }
                .filter-group { display: flex; align-items: center; gap: 0.75rem; }
                .filter-group label { font-size: 0.65rem; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 0.02em; }
                .filter-group input { padding: 0.6rem 0.875rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #374151; outline: none; }

                .a-table { width: 100%; border-collapse: collapse; }
                .a-table th { text-align: left; font-size: 0.65rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; padding: 1rem; border-bottom: 1px solid #f3f4f6; }
                .a-table td { padding: 1.25rem 1rem; border-bottom: 1px solid #f9fafb; font-size: 0.85rem; font-weight: 600; color: #374151; }

                .btn-action { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
                .btn-view { color: var(--admin-blue); background: rgba(79,70,229,0.05); }
                .btn-view:hover { background: rgba(79,70,229,0.1); border-color: var(--admin-blue); }
                .btn-down { color: #059669; background: rgba(5,150,105,0.05); margin-left: 0.5rem; }
                .btn-down:hover { background: rgba(5,150,105,0.1); border-color: #059669; }

                /* --- MODAL --- */
                .a-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(6px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 2rem; }
                .a-modal { background: white; width: 100%; max-width: 750px; border-radius: 24px; padding: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); max-height: 90vh; overflow-y: auto; }
            `}</style>

            <header className="a-header">
                <div className="a-header-inner">
                    <div className="a-brand-block">
                        <div className="a-brand">{dossier?.project_name || user?.project_name || "EMR"}</div>
                        <div className="a-brand-sub">Electronic Medical Records</div>
                    </div>

                    <nav className="a-nav">
                        <span className={`a-nav-item ${currentTab === 'Dashboard' ? 'active' : ''}`} onClick={() => handleTabChange('Dashboard')}>Dashboard</span>
                        <span className={`a-nav-item ${currentTab === 'Records' ? 'active' : ''}`} onClick={() => handleTabChange('Records')}>Clinical Records</span>
                        {patientData.allow_appointments !== false && (
                            <span className={`a-nav-item ${currentTab === 'Appointments' ? 'active' : ''}`} onClick={() => handleTabChange('Appointments')}>Book Appointment</span>
                        )}
                    </nav>

                    <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', position: 'relative' }}>
                        <div style={{ position: 'relative', cursor:'pointer' }} onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}>
                            <Bell size={18} color={unreadCount > 0 ? "var(--admin-blue)" : "#9ca3af"} />
                            {unreadCount > 0 && (
                                <span style={{ 
                                    position: 'absolute', 
                                    top: '-4px', 
                                    right: '-4px', 
                                    background: 'var(--admin-red)', 
                                    color: 'white', 
                                    fontSize: '0.55rem', 
                                    fontWeight: 900, 
                                    padding: '2px 5px', 
                                    borderRadius: '50%',
                                    border: '2px solid white'
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {renderNotifications()}
                        
                        <div className="a-user-pill" onClick={() => { setShowProfile(true); setShowNotifications(false); }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'8px', background: 'var(--admin-blue)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                                <User size={16} />
                            </div>
                            {user?.username}
                        </div>
                        <button onClick={logout} style={{ color:'#f87171', background:'transparent', border:'none', cursor:'pointer', display:'flex' }}><LogOut size={20} /></button>
                    </div>
                </div>
            </header>

            <main className="a-container">
                {currentTab === 'Dashboard' && (
                    <>
                        <div className="a-greeting" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <h1>Hello, {patientData.full_name?.split(' ')[0] || user?.username}</h1>
                            <p style={{ margin:0 }}><Calendar size={14} /> {formatDate(new Date(), { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
                        </div>

                        <div className="a-stats-grid">
                            <div className="a-stat-card card-blue" onClick={() => handleTabChange('Records')}>
                                <div className="a-stat-header"><span>FACILITY VISITS</span><span className="a-badge">LIVE</span></div>
                                <div className="a-stat-val">{stats.total_visits}</div>
                                <div className="a-stat-icon"><Activity size={32} /></div>
                            </div>
                            <div className="a-stat-card card-green" onClick={() => handleTabChange('Records')}>
                                <div className="a-stat-header"><span>LABORATORY REPORTS</span><span className="a-badge">LIVE</span></div>
                                <div className="a-stat-val">{stats.total_lab_investigations}</div>
                                <div className="a-stat-icon"><FlaskConical size={32} /></div>
                            </div>
                            <div className="a-stat-card card-orange" onClick={() => handleTabChange('Records')}>
                                <div className="a-stat-header"><span>ACTIVE PRESCRIPTIONS</span><span className="a-badge">LIVE</span></div>
                                <div className="a-stat-val">{stats.total_active_prescriptions}</div>
                                <div className="a-stat-icon"><Pill size={32} /></div>
                            </div>
                            {patientData.allow_appointments !== false && (
                                <div className="a-stat-card card-purple" onClick={() => handleTabChange('Appointments')}>
                                    <div className="a-stat-header"><span>TOTAL APPOINTMENTS</span><span className="a-badge">LIVE</span></div>
                                    <div className="a-stat-val">{stats.total_appointments}</div>
                                    <div className="a-stat-icon"><Calendar size={32} /></div>
                                </div>
                            )}
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:'1.5rem' }}>
                            <div className="a-card">
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                                    <h3 className="a-card-title" style={{ margin:0 }}><Clock size={20} color="var(--admin-blue)" /> Latest Clinical Entry</h3>
                                    <div style={{ fontSize:'0.7rem', fontWeight:800, color: 'var(--admin-blue)', background:'rgba(79,70,229,0.05)', padding:'4px 10px', borderRadius:'6px' }}>SECURE ARCHIVE</div>
                                </div>

                                {selectedVisit ? (
                                    <div 
                                        style={{ background: '#f9fafb', borderRadius: '12px', padding: '1.75rem', border: '1px solid #f3f4f6', cursor: 'pointer', transition: '0.2s' }}
                                        onClick={() => setReportView(selectedVisit)}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--admin-blue)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f3f4f6'}
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '2rem', marginBottom: '2rem' }}>
                                            <div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Registry Date</span>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color:'#0f172a', marginTop:'0.25rem' }}>{formatDate(selectedVisit.visit_date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Diagnosis</span>
                                                <div style={{ marginTop: '0.25rem', color: 'var(--admin-blue)', fontWeight: 800, fontSize:'1.1rem' }}>{selectedVisit.consultation?.diagnosis || (selectedVisit.is_active ? "Pending Assessment" : "--")}</div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Visit Type</span>
                                                <div style={{ marginTop: '0.25rem', color: '#1e293b', fontWeight: 800, fontSize:'1.0rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedVisit.reason || "General Consultation"}</div>
                                            </div>
                                            <div style={{ textAlign:'right' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase' }}>Registry Status</span>
                                                <div style={{ marginTop:'0.25rem' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 900, 
                                                        color: selectedVisit.is_active ? '#f59e0b' : '#10b981', 
                                                        background: selectedVisit.is_active ? '#fffbeb' : '#ecfdf5', 
                                                        padding: '6px 12px', 
                                                        borderRadius: '8px',
                                                        border: `1px solid ${selectedVisit.is_active ? '#fef3c7' : '#d1fae5'}`,
                                                        display: 'inline-block'
                                                    }}>
                                                        {selectedVisit.is_active ? 'IN PROGRESS' : 'COMPLETED'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '1rem', paddingTop: '1.5rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'block' }}>Clinical Workflow Timeline</span>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '0 10px' }}>
                                                {/* Timeline Line */}
                                                <div style={{ position: 'absolute', top: '12px', left: '20px', right: '20px', height: '2px', background: '#f1f5f9', zIndex: 0 }}></div>
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    top: '12px', 
                                                    left: '20px', 
                                                    width: !selectedVisit.is_active ? 'calc(100% - 40px)' : (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0) ? '66%' : selectedVisit.consultation ? '33%' : '0%', 
                                                    height: '2px', 
                                                    background: 'var(--admin-blue)', 
                                                    zIndex: 0, 
                                                    transition: '0.8s ease-in-out' 
                                                }}></div>

                                                {[
                                                    { label: 'Vitals', done: !!selectedVisit.vitals, icon: <Activity size={10} /> },
                                                    { label: 'Doctor', done: !!selectedVisit.consultation, icon: <Stethoscope size={10} /> },
                                                    { label: 'Diagnostic', done: (selectedVisit.lab_requests?.length > 0 || selectedVisit.prescriptions?.length > 0), icon: <FlaskConical size={10} /> },
                                                    { label: 'Released', done: !selectedVisit.is_active, icon: <CheckCircle2 size={10} /> }
                                                ].map((step, si) => (
                                                    <div key={si} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ 
                                                            width: '24px', 
                                                            height: '24px', 
                                                            borderRadius: '50%', 
                                                            background: step.done ? 'var(--admin-blue)' : 'white', 
                                                            border: `2px solid ${step.done ? 'var(--admin-blue)' : '#e2e8f0'}`,
                                                            color: step.done ? 'white' : '#94a3b8',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: '0.3s',
                                                            boxShadow: step.done ? '0 0 0 4px rgba(79, 70, 229, 0.1)' : 'none'
                                                        }}>
                                                            {step.icon}
                                                        </div>
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: step.done ? '#1e293b' : '#94a3b8' }}>{step.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedVisit.prescriptions?.length > 0 && (
                                            <div style={{ marginTop: '1.5rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '10px', padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                                    <Pill size={14} color="#f59e0b" />
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#9a3412', textTransform: 'uppercase' }}>Active Prescriptions</span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {selectedVisit.prescriptions.map((p, pi) => (
                                                        <span key={pi} style={{ fontSize: '0.7rem', fontWeight: 800, color: '#c2410c', background: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                                                            {p.medication_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button className="btn-action btn-view" style={{ marginTop:'2rem', width:'100%', justifyContent:'center', padding:'1rem' }} onClick={() => setReportView(selectedVisit)}>
                                            <Eye size={18} /> Open Full Visit Details
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af', background:'#f9fafb', borderRadius:'12px', border:'1px dashed var(--border)' }}>No recent activity found.</div>
                                )}
                            </div>

                            <div className="a-card" style={{ padding:'1.5rem' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'1px solid #f3f4f6' }}>
                                    <div style={{ width:'50px', height:'50px', borderRadius:'12px', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}><User size={24} /></div>
                                    <div>
                                        <h4 style={{ margin:0, fontWeight:800 }}>{patientData?.full_name || user?.username || 'User'}</h4>
                                        <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#9ca3af' }}>UID: {patientData?.patient_id || 'N/A'}</span>
                                    </div>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem' }}><span style={{ color:'#9ca3af', fontWeight:600 }}>Age / Gender</span><span style={{ fontWeight:700 }}>{patientData?.age || '--'} / {patientData?.gender || 'N/A'}</span></div>
                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem' }}><span style={{ color:'#9ca3af', fontWeight:600 }}>Blood Type</span><span style={{ fontWeight:700, color: 'var(--admin-red)' }}>{patientData?.blood_group || 'N/A'}</span></div>
                                </div>
                                <button style={{ width:'100%', marginTop:'2rem', padding:'0.875rem', borderRadius:'10px', background:'#f9fafb', border:'1px solid var(--border)', fontWeight:800, fontSize:'0.8rem', cursor:'pointer' }} onClick={() => setShowProfile(true)}>Update Profile</button>
                            </div>
                        </div>
                    </>
                )}

                {currentTab === 'Records' && (
                    <div className="a-card" style={{ padding:'2.5rem' }}>
                        <div style={{ marginBottom:'2.5rem' }}>
                            <h3 className="a-card-title" style={{ margin:0 }}><Clipboard size={24} color="var(--admin-blue)" /> Diagnostic Archive</h3>
                            <p style={{ fontSize:'0.85rem', color:'#6b7280', fontWeight:500, marginTop:'0.5rem' }}>Filter and retrieve individual clinical reports from your medical history.</p>
                        </div>

                        <div className="filter-bar">
                            <div className="filter-group"><Filter size={16} color="var(--admin-blue)" /><label>Date Range Filter</label></div>
                            <div className="filter-group"><label>From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
                            <div className="filter-group"><label>To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
                            {(fromDate || toDate) && <button onClick={() => {setFromDate(''); setToDate('');}} style={{ background:'transparent', border:'none', color: 'var(--admin-red)', fontWeight:800, fontSize:'0.7rem', cursor:'pointer', textTransform:'uppercase' }}>Clear Filters</button>}
                        </div>

                        <div style={{ overflowX:'auto' }}>
                            <table className="a-table">
                                <thead>
                                    <tr><th>Registry Date</th><th>Facility Location</th><th>Diagnostic Conclusion</th><th>Data Status</th><th style={{ textAlign:'center' }}>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {filteredHistory && filteredHistory.length > 0 ? filteredHistory.map((v, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight:800 }}>{formatDate(v.visit_date)}</td>
                                            <td>Internal Clinic</td>
                                            <td>{v.diagnosis || "General Review"}</td>
                                            <td><span style={{ fontSize:'0.6rem', fontWeight:800, color: 'var(--admin-green)', background:'rgba(16,185,129,0.05)', padding:'4px 10px', borderRadius:'6px' }}>VERIFIED</span></td>
                                            <td style={{ display:'flex', justifyContent:'center' }}>
                                                <button className="btn-action btn-view" onClick={() => setReportView(v)}><Eye size={14} /> Open Report</button>
                                                <button className="btn-action btn-down" onClick={() => handleDownloadReport(v)}><Download size={14} /> Download</button>
                                            </td>
                                        </tr>
                                    )) : <tr><td colSpan="5" style={{ textAlign:'center', padding:'4rem', color:'#9ca3af', fontWeight:600 }}>No records found for the selected date range.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {currentTab === 'Appointments' && (
                    <div className="a-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div 
                                    onClick={() => setScheduleTab('ACTIVE')}
                                    style={{ 
                                        fontSize: '0.875rem', 
                                        fontWeight: 800, 
                                        color: scheduleTab === 'ACTIVE' ? 'var(--admin-blue)' : '#94a3b8', 
                                        cursor: 'pointer',
                                        paddingBottom: '0.5rem',
                                        borderBottom: scheduleTab === 'ACTIVE' ? '3px solid var(--admin-blue)' : '3px solid transparent',
                                        transition: '0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Clock size={18} /> Active Schedule
                                </div>
                                <div 
                                    onClick={() => setScheduleTab('HISTORY')}
                                    style={{ 
                                        fontSize: '0.875rem', 
                                        fontWeight: 800, 
                                        color: scheduleTab === 'HISTORY' ? 'var(--admin-blue)' : '#94a3b8', 
                                        cursor: 'pointer',
                                        paddingBottom: '0.5rem',
                                        borderBottom: scheduleTab === 'HISTORY' ? '3px solid var(--admin-blue)' : '3px solid transparent',
                                        transition: '0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <History size={18} /> Appointment History
                                </div>
                            </div>
                            
                            {patientData.allow_appointments !== false && (
                                <button 
                                    onClick={() => setShowBookingModal(true)}
                                    style={{ background: 'var(--admin-blue)', color:'white', border:'none', padding:'0.6rem 1.5rem', borderRadius:'8px', fontWeight:800, cursor:'pointer', fontSize:'0.875rem', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
                                >
                                    <Plus size={16} /> New Appointment
                                </button>
                            )}
                        </div>

                        {dossier?.appointments?.length > 0 ? (
                            <div className="table-responsive">
                                <table className="a-table">
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Date & Time</th>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Clinical Reason</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Service Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dossier.appointments.filter(a => {
                                            if (scheduleTab === 'ACTIVE') {
                                                return ['SCHEDULED', 'CONFIRMED', 'PATIENT_ACKNOWLEDGED'].includes(a.status);
                                            } else {
                                                return ['REJECTED', 'CANCELLED', 'CHECKED_IN', 'NO_SHOW'].includes(a.status);
                                            }
                                        }).map((appt, idx) => (
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
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                <Calendar size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No scheduled appointments found</p>
                                <p style={{ fontSize: '0.8rem' }}>Click "New Appointment" to reserve a slot.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Appointment Booking Modal */}
            {showBookingModal && (
                <div className="a-modal-overlay">
                    <div className="a-modal" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h2 style={{ fontWeight: 900, fontSize: '1.5rem', color: '#0f172a', margin: 0 }}>Book Clinical Session</h2>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>Reserve your slot for consultation</p>
                            </div>
                            <button onClick={() => setShowBookingModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleBookAppointment}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label className="input-label">Appointment Date</label>
                                        <input 
                                            className="p-input" 
                                            type="date" 
                                            required
                                            min={new Date().toISOString().split('T')[0]}
                                            value={bookingForm.date}
                                            onChange={e => setBookingForm({...bookingForm, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Preferred Time</label>
                                        <input 
                                            className="p-input" 
                                            type="time" 
                                            required
                                            value={bookingForm.time}
                                            onChange={e => setBookingForm({...bookingForm, time: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Reason for Visit</label>
                                    <textarea 
                                        className="p-input" 
                                        placeholder="Briefly describe your symptoms or reason for visit..."
                                        rows="3"
                                        style={{ height: 'auto', padding: '1rem' }}
                                        value={bookingForm.reason}
                                        onChange={e => setBookingForm({...bookingForm, reason: e.target.value})}
                                    />
                                </div>

                                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowBookingModal(false)}
                                        style={{ flex: 1, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isBooking}
                                        style={{ flex: 1, background: 'var(--admin-blue)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.3)' }}
                                    >
                                        {isBooking ? 'Processing...' : 'Confirm Appointment'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- PROFILE MODAL --- */}
            {showProfile && (
                <div className="a-modal-overlay" onClick={() => setShowProfile(false)}>
                    <style>{`
                        .a-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 4000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
                        .a-modal { background: white; border-radius: 28px; width: 100%; max-width: 650px; padding: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalScale 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                        @keyframes modalScale { from { transform: scale(0.9) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                        .input-group { display: flex; flexDirection: column; gap: 0.6rem; }
                        .input-label { fontSize: 0.65rem; fontWeight: 800; color: #9ca3af; textTransform: uppercase; letter-spacing: 0.05em; }
                        .p-input { padding: 0.875rem 1.25rem; border-radius: 12px; border: 1.5px solid #f1f5f9; font-weight: 700; color: #1e293b; font-size: 0.9rem; background: #f8fafc; transition: 0.2s; }
                        .p-input:focus { outline: none; border-color: var(--admin-blue); background: white; }
                        .p-input:disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
                    `}</style>
                    <div className="a-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2.5rem' }}>
                            <div>
                                <h2 style={{ margin:0, fontWeight:900, fontSize:'1.5rem', letterSpacing: '-0.02em' }}>Account Identification</h2>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Secure Clinical Identity Management</p>
                            </div>
                            <button onClick={() => setShowProfile(false)} style={{ background:'#f3f4f6', border:'none', width: '36px', height: '36px', borderRadius:'12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor:'pointer', color: '#64748b' }}><X size={18} /></button>
                        </div>
                        
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
                            <div className="input-group">
                                <label className="input-label">Registry UID</label>
                                <input className="p-input" disabled value={patientData.patient_id || 'N/A'} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Workspace / Project</label>
                                <input className="p-input" disabled value={dossier?.project_name || 'Medical Workspace'} />
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label className="input-label">Full Legal Name</label>
                                <input className="p-input" type="text" defaultValue={patientData.full_name || user?.username} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Contact Number</label>
                                <input className="p-input" type="text" defaultValue={patientData.contact_number || patientData.phone} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Registered Email</label>
                                <input className="p-input" type="email" defaultValue={patientData.email} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Gender</label>
                                <input className="p-input" type="text" defaultValue={patientData.gender} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Blood Group</label>
                                <input className="p-input" type="text" defaultValue={patientData.blood_group || 'N/A'} />
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label className="input-label">Permanent Address</label>
                                <input className="p-input" type="text" defaultValue={patientData.address || ''} />
                            </div>
                        </div>
                        <button style={{ width:'100%', marginTop:'2.5rem', background: 'var(--admin-blue)', color:'white', border:'none', padding:'1.125rem', borderRadius:'16px', fontWeight:800, cursor:'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)', fontSize: '1rem' }} onClick={() => {
                            toast.success("Clinical Identity Verified & Updated");
                            setShowProfile(false);
                        }}>Confirm Updates</button>
                    </div>
                </div>
            )}

            {/* --- DOSSIER MODAL --- */}
            {renderDossierModal()}
        </div>
    );
};

export default PatientDashboard;
