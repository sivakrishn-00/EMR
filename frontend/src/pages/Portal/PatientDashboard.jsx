import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Sub-modules
import DashboardTab from './components/DashboardTab';
import RecordsTab from './components/RecordsTab';
import AppointmentsTab from './components/AppointmentsTab';

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
    AlertCircle,
    MessageCircle
} from 'lucide-react';

const PatientDashboard = () => {
    const { user, logout } = useAuth(); 
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [appointmentSearchTerm, setAppointmentSearchTerm] = useState('');
    const [currentApptPage, setCurrentApptPage] = useState(1);
    const [showChatBot, setShowChatBot] = useState(false);
    const [messages, setMessages] = useState([
        { text: "Hello! I'm your health assistant. How can I help you today?", isBot: true }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    
    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [activeTab, setActiveTab] = useState('Overview');

    // 📄 REPORT GENERATION ENGINE (MNC Standard - Backend PDF)
    const handleDownloadReport = async (v) => {
        const correctId = (dossier?.patient_id || dossier?.registry_metadata?.patient_id || "").trim().toUpperCase();
        const enteredPassword = window.prompt("Enter your Patient ID (e.g. BHSPL10636) to access your secure clinical report:");
        
        if (enteredPassword === null) {
            return; // User cancelled
        }
        
        if (enteredPassword.trim().toUpperCase() !== correctId) {
            toast.error("Incorrect Patient ID. Access denied.");
            return;
        }

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

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;
        
        const newMessages = [...messages, { text: inputMessage, isBot: false }];
        setMessages(newMessages);
        setInputMessage('');

        setTimeout(() => {
            let reply = "I'm sorry, I can only help you with questions about your health records shown here. Try asking about your 'BP', 'heart rate', or 'prescriptions'.";
            const lower = inputMessage.toLowerCase();
            
            if (lower.includes('bp') || lower.includes('blood pressure')) {
                reply = "Your last recorded BP was **120/80 mmHg** (Normal).";
            } else if (lower.includes('heart') || lower.includes('pulse')) {
                reply = "Your last recorded heart rate was **72 bpm** (Ideal).";
            } else if (lower.includes('sugar') || lower.includes('glucose')) {
                reply = "Your last recorded blood sugar was **95 mg/dL** (Normal).";
            } else if (lower.includes('weight')) {
                reply = "Your last recorded weight was **68 kg** (Stable).";
            } else if (lower.includes('prescription') || lower.includes('medicine')) {
                reply = "You have 1 active prescription: **Amantrel Tablets**.";
            } else if (lower.includes('visit')) {
                reply = "You have had **1 facility visit** recorded in the system.";
            }

            setMessages([...newMessages, { text: reply, isBot: true }]);
        }, 1000);
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
                    .d-close:hover { color: #4c1d95; }
                    
                    .p-badge {
                        width: 64px;
                        height: 64px;
                        border-radius: 8px;
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
                        border-radius: 8px; 
                        border: 1px solid #e2e8f0; 
                        padding: 2rem; 
                        margin-bottom: 1.5rem; 
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
                    }
                    .d-card-header { 
                        font-size: 0.75rem; 
                        font-weight: 800; 
                        color: #4c1d95; 
                        text-transform: uppercase; 
                        letter-spacing: 0.05em; 
                        margin-bottom: 1.5rem; 
                        display: flex; 
                        align-items: center; 
                        gap: 0.5rem; 
                    }
                    .d-card-header::after { content:''; height: 1px; background: #e2e8f0; flex: 1; }

                    .v-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
                    .v-item { display: flex; flex-direction: column; gap: 0.25rem; }
                    .v-label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                    .v-val { font-size: 1.75rem; font-weight: 900; color: #0f172a; display: flex; align-items: baseline; gap: 4px; }
                    .v-unit { font-size: 0.8rem; font-weight: 700; color: #cbd5e1; }

                    .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                    .tag-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                    .tag-item { 
                        padding: 0.35rem 0.75rem; 
                        border-radius: 4px; 
                        background: #f1f5f9; 
                        border: 1px solid #cbd5e1; 
                        font-size: 0.7rem; 
                        font-weight: 700; 
                        color: #334155;
                    }
                    .tag-yes { background: #d1fae5; border-color: #10b981; color: #0f5132; }

                    .exam-grid-elite { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                    .exam-pill { 
                        background: #ffffff; 
                        border: 1px solid #e2e8f0; 
                        padding: 1rem; 
                        border-radius: 6px; 
                        transition: all 0.2s ease;
                        display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
                    }
                    .exam-pill:hover { border-color: #4c1d95; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                    .exam-pill-label { font-size: 0.6rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                    .exam-pill-val { font-size: 0.9rem; font-weight: 700; color: #059669; }

                    .table-elite { width: 100%; border-collapse: collapse; }
                    .table-elite th { text-align: left; font-size: 0.65rem; font-weight: 800; color: #94a3b8; padding: 1rem; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
                    .table-elite td { padding: 1.25rem 1rem; font-size: 0.85rem; font-weight: 700; color: #334155; border-bottom: 1px solid #f8fafc; }
                    
                    .export-btn { 
                        width: 100%; 
                        padding: 0.75rem; 
                        border-radius: 4px; 
                        background: #4c1d95; 
                        color: white; 
                        border: none; 
                        font-weight: 700; 
                        font-size: 0.75rem; 
                        cursor: pointer; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 0.5rem;
                        margin-top: auto;
                        transition: background-color 0.2s;
                    }
                    .export-btn:hover { background: #3b0764; }
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
                                    <div className="v-val" style={{ color: '#4c1d95' }}>
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
                    background: linear-gradient(135deg, #4c1d95, #6d28d9); /* Dark Violet */
                    height: 64px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    padding: 0 2rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .a-header-inner {
                    width: 100%;
                    max-width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .a-brand-block { display: flex; flex-direction: column; justify-content: center; }
                .a-brand { font-weight: 800; font-size: 0.85rem; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1; }
                .a-brand-sub { font-size: 0.6rem; font-weight: 600; color: #ccfbf1; text-transform: uppercase; margin-top: 2px; }

                .a-nav { display: flex; gap: 2rem; height: 100%; align-items: center; }
                .a-nav-item {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #ccfbf1;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    position: relative;
                    height: 100%;
                    transition: 0.2s;
                }
                .a-nav-item:hover { color: #ffffff; }
                .a-nav-item.active { color: #ffffff; font-weight: 700; }
                .a-nav-item.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #ffffff;
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
                    padding: 1.5rem 1rem; 
                    max-width: 100%; 
                    margin: 0 auto; 
                    display: flex;
                    flex-direction: column;
                    min-height: calc(100vh - 64px); 
                    box-sizing: border-box;
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
                .card-blue { background: linear-gradient(135deg, #2563eb, #3b82f6); }
                .card-green { background: linear-gradient(135deg, #059669, #10b981); }
                .card-orange { background: linear-gradient(135deg, #d97706, #f59e0b); }
                .card-purple { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
                .a-stat-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; opacity: 0.85; }
                .a-badge { background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.55rem; color: white; }
                .a-stat-val { font-size: 1.85rem; font-weight: 900; margin-top: 0.5rem; display: block; color: white; }
                .a-stat-icon { position: absolute; bottom: 1rem; right: 1rem; opacity: 0.15; color: white; }

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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                        <nav className="a-nav">
                            <span className={`a-nav-item ${currentTab === 'Dashboard' ? 'active' : ''}`} onClick={() => handleTabChange('Dashboard')}>Dashboard</span>
                            <span className={`a-nav-item ${currentTab === 'Records' ? 'active' : ''}`} onClick={() => handleTabChange('Records')}>Clinical Records</span>
                            {patientData.allow_appointments !== false && (
                                <span className={`a-nav-item ${currentTab === 'Appointments' ? 'active' : ''}`} onClick={() => handleTabChange('Appointments')}>Book Appointment</span>
                            )}
                        </nav>

                        <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', position: 'relative' }}>
                            <div style={{ position: 'relative', cursor:'pointer' }} onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}>
                                <Bell size={18} color={unreadCount > 0 ? "#ffedd5" : "#e0e7ff"} />
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
                                <div style={{ width:'28px', height:'28px', borderRadius:'8px', background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                                    <User size={16} />
                                </div>
                                {user?.username}
                            </div>
                            <button onClick={logout} style={{ color:'#f87171', background:'transparent', border:'none', cursor:'pointer', display:'flex' }}><LogOut size={20} /></button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="a-container">
                {currentTab === 'Dashboard' && (
                    <DashboardTab 
                        patientData={patientData}
                        user={user}
                        formatDate={formatDate}
                        handleTabChange={handleTabChange}
                        stats={stats}
                        selectedVisit={selectedVisit}
                        setReportView={setReportView}
                    />
                )}

                {currentTab === 'Records' && (
                    <RecordsTab 
                        filteredHistory={filteredHistory}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        fromDate={fromDate}
                        setFromDate={setFromDate}
                        toDate={toDate}
                        setToDate={setToDate}
                        setReportView={setReportView}
                        handleDownloadPDF={handleDownloadReport}
                        formatDate={formatDate}
                    />
                )}

                {currentTab === 'Appointments' && (
                    <AppointmentsTab 
                        dossier={dossier}
                        scheduleTab={scheduleTab}
                        setScheduleTab={setScheduleTab}
                        appointmentSearchTerm={appointmentSearchTerm}
                        setAppointmentSearchTerm={setAppointmentSearchTerm}
                        currentApptPage={currentApptPage}
                        setCurrentApptPage={setCurrentApptPage}
                        setShowBookingModal={setShowBookingModal}
                        patientData={patientData}
                        handleAcknowledgeAppointment={handleAcknowledgeAppointment}
                        handleRejectAppointment={handleRejectAppointment}
                        formatDate={formatDate}
                    />
                )}
            </main>

            {showBookingModal && (
                <div className="a-modal-overlay" onClick={() => setShowBookingModal(false)}>
                    <style>{`
                        .a-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 4000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
                        .a-modal { background: white; border-radius: 28px; width: 100%; max-width: 500px; padding: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalScale 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                        @keyframes modalScale { from { transform: scale(0.9) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                        .input-group { display: flex; flex-direction: column; gap: 0.3rem; }
                        .input-label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                        .p-input { padding: 0.875rem 1.25rem; border-radius: 12px; border: 1.5px solid #f1f5f9; font-weight: 700; color: #1e293b; font-size: 0.9rem; background: #f8fafc; transition: 0.2s; }
                        .p-input:focus { outline: none; border-color: #7c3aed; background: white; }
                    `}</style>
                    <div className="a-modal" onClick={e => e.stopPropagation()}>
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
                                        required
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
                                        style={{ flex: 1, background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(109, 40, 217, 0.3)' }}
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
                        .input-group { display: flex; flex-direction: column; gap: 0.3rem; }
                        .input-label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                        .p-input { padding: 0.875rem 1.25rem; border-radius: 12px; border: 1.5px solid #f1f5f9; font-weight: 700; color: #1e293b; font-size: 0.9rem; background: #f8fafc; transition: 0.2s; }
                        .p-input:focus { outline: none; border-color: var(--admin-blue); background: white; }
                        .p-input:disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
                    `}</style>
                    <div className="a-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                            <div>
                                <h2 style={{ margin:0, fontWeight:900, fontSize:'1.5rem', letterSpacing: '-0.02em' }}>Account Identification</h2>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Secure Clinical Identity Management</p>
                            </div>
                            <button onClick={() => setShowProfile(false)} style={{ background:'#f3f4f6', border:'none', width: '36px', height: '36px', borderRadius:'12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor:'pointer', color: '#64748b' }}><X size={18} /></button>
                        </div>
                        <div style={{ width: '100%', height: '1px', background: '#f1f5f9', marginBottom: '1.5rem' }}></div>
                        
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem', padding: '1rem 0' }}>
                            <div className="input-group">
                                <span className="input-label">Registry UID</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.patient_id || 'N/A'}</span>
                            </div>
                            <div className="input-group">
                                <span className="input-label">Workspace / Project</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{dossier?.project_name || 'Medical Workspace'}</span>
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <span className="input-label">Full Legal Name</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.full_name || user?.username}</span>
                            </div>
                            <div className="input-group">
                                <span className="input-label">Contact Number</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.contact_number || patientData.phone}</span>
                            </div>
                            <div className="input-group">
                                <span className="input-label">Registered Email</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.email || 'N/A'}</span>
                            </div>
                            <div className="input-group">
                                <span className="input-label">Gender</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{patientData.gender}</span>
                            </div>
                            <div className="input-group">
                                <span className="input-label">Blood Group</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.blood_group || 'N/A'}</span>
                            </div>
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <span className="input-label">Permanent Address</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patientData.address || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- CHAT BOT --- */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 5000 }}>
                {/* Chat Window */}
                {showChatBot && (
                    <div style={{ width: '350px', height: '450px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Bavya AI Assistant</h4>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Always here to help</span>
                            </div>
                            <button onClick={() => setShowChatBot(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        
                        {/* Messages Area */}
                        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc' }}>
                            {messages.map((msg, idx) => (
                                <div key={idx} style={{ alignSelf: msg.isBot ? 'flex-start' : 'flex-end', background: msg.isBot ? 'white' : 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '0.75rem', borderRadius: '12px', border: msg.isBot ? '1px solid #e2e8f0' : 'none', color: msg.isBot ? '#1e293b' : 'white', maxWidth: '80%' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{msg.text}</p>
                                    <span style={{ fontSize: '0.65rem', color: msg.isBot ? '#94a3b8' : 'rgba(255,255,255,0.8)', display: 'block', marginTop: '4px' }}>{msg.isBot ? 'AI' : 'You'} • Just now</span>
                                </div>
                            ))}
                        </div>
                        
                        {/* Input Area */}
                        <div style={{ padding: '0.75rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="text" 
                                placeholder="Type a message..." 
                                value={inputMessage}
                                onChange={e => setInputMessage(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                style={{ flex: 1, borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                            />
                            <button 
                                onClick={handleSendMessage}
                                style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}

                {/* FAB */}
                <button 
                    onClick={() => setShowChatBot(!showChatBot)}
                    style={{ 
                        width: '56px', 
                        height: '56px', 
                        borderRadius: '28px', 
                        background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', 
                        color: 'white', 
                        border: 'none', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer', 
                        boxShadow: '0 4px 12px rgba(109, 40, 217, 0.3)',
                        transition: '0.2s',
                        marginLeft: 'auto'
                    }}
                >
                    <MessageCircle size={24} />
                </button>
            </div>

            {/* --- FOOTER --- */}
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, borderTop: '1px solid #f1f5f9', width: '100%', marginTop: 'auto' }}>
                Powered by <span style={{ color: '#7c3aed', fontWeight: 800 }}>Bavya</span>
            </div>

            {/* --- DOSSIER MODAL --- */}
            {renderDossierModal()}
        </div>
    );
};

export default PatientDashboard;
