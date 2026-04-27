import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  User as UserIcon,
  ChevronDown,
  Settings,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { MEDIA_URL } from '../services/api';
import toast from 'react-hot-toast';

const Navbar = ({ onToggleSidebar, isCollapsed }) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [bookingForm, setBookingForm] = useState({
    patientId: '', doctorId: '', date: '', time: '', reason: '',
    isOutside: false,
    searchQ: '',
    outsideData: { first_name: '', last_name: '', phone: '', gender: 'MALE', dob: '', id_number: '' }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null); // { type: 'PATIENT'|'MASTER', data: {} }
  const [headerProjects, setHeaderProjects] = useState([]);
  const dropdownRef = useRef(null);
  const calendarRef = useRef(null);
  const notifyRef = useRef(null);
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark-theme'));

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false);
      if (calendarRef.current && !calendarRef.current.contains(event.target)) setShowCalendar(false);
      if (notifyRef.current && !notifyRef.current.contains(event.target)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // 30 sec poll
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchMasters();
      const interval = setInterval(fetchAppointments, 60000);
      return () => clearInterval(interval);
    }
  }, [user, scheduleDate]);

  const fetchMasters = async () => {
    try {
      const res = await api.get('patients/employee-masters/all-masters/');
      setMasters(res.data);
    } catch (err) { }
  };

  const fetchAppointments = async () => {
    try {
      // Fetch for 3 days window around selected date
      const d = new Date(scheduleDate);
      const prev = new Date(d); prev.setDate(d.getDate() - 1);
      const next = new Date(d); next.setDate(d.getDate() + 3);

      const start = prev.toLocaleDateString('en-CA');
      const end = next.toLocaleDateString('en-CA');

      const res = await api.get(`clinical/appointments/?from_date=${start}&to_date=${end}`);
      setAppointments(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error("Appt fetch fail");
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('accounts/notifications/');
      setNotifications(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error("Notify fail");
    }
  };

  const fetchHeaderProjects = async () => {
    if (!user?.project) {
        setHeaderProjects([]);
        return;
    }
    try {
      const res = await api.get(`patients/project-logos/?project=${user.project}`);
      const pList = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setHeaderProjects(pList.slice(0, 6)); // Up to 6
    } catch (err) {
      setHeaderProjects([]);
    }
  };

  useEffect(() => {
    fetchHeaderProjects();
  }, [user]);

  const markRead = async () => {
    try {
      await api.post('accounts/notifications/mark_all_as_read/');
      fetchNotifications();
    } catch (err) {
      console.error("Mark read fail");
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const resetBookingForm = () => {
    setBookingForm({
      patientId: '', doctorId: '', date: '', time: '', reason: '',
      isOutside: false,
      searchQ: '',
      outsideData: { first_name: '', last_name: '', phone: '', gender: 'MALE', dob: '', id_number: '' }
    });
    setSelectedResult(null);
    setPatients([]);
  };

  const handleCheckIn = async (apptId) => {
    try {
      await api.post(`clinical/appointments/${apptId}/check_in/`);
      toast.success("Patient Checked In!");
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Check-in failed");
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (bookingForm.isOutside) {
      if (!bookingForm.outsideData.first_name || !bookingForm.outsideData.phone || !bookingForm.outsideData.dob) {
        toast.error("Please fill outside person details");
        return;
      }
    } else if (!selectedResult) {
      toast.error("Please select a valid patient or employee");
      return;
    }

    if (!bookingForm.date || !bookingForm.time) {
      toast.error("Please select date and time");
      return;
    }

    // Past date validation
    const selectedDate = new Date(`${bookingForm.date}T${bookingForm.time}`);
    if (selectedDate < new Date()) {
      toast.error("Cannot book appointments in the past");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPatientId = null;

      if (bookingForm.isOutside) {
        // Quick Register Outside Person
        const pRes = await api.post('patients/patients/', {
          ...bookingForm.outsideData,
          address: 'Outside Visitor',
          id_proof_type: 'AADHAAR', // Default or could be select
          id_proof_number: bookingForm.outsideData.id_number || `OUT-${Date.now()}`
        });
        finalPatientId = pRes.data.id;
      } else if (selectedResult.type === 'MASTER') {
        // Convert Master to Patient if not already
        try {
          const checkRes = await api.get(`patients/patients/?id_proof_number=${selectedResult.data.card_no}`);
          if (checkRes.data.results && checkRes.data.results.length > 0) {
            finalPatientId = checkRes.data.results[0].id;
          } else {
            // Register from master
            const regData = {
              first_name: selectedResult.data.name.split(' ')[0],
              last_name: selectedResult.data.name.split(' ').slice(1).join(' '),
              dob: selectedResult.data.dob,
              gender: selectedResult.data.gender,
              phone: selectedResult.data.mobile_no || '0000000000',
              address: selectedResult.data.address || 'Linked from Master',
              is_employee_linked: true,
              id_proof_type: 'EMPLOYEE_CARD',
              id_proof_number: selectedResult.data.card_no,
              card_no: selectedResult.data.card_no,
              employee_master: selectedResult.isFamily ? selectedResult.data.employee : selectedResult.data.id,
              family_member: selectedResult.isFamily ? selectedResult.data.id : null,
              relationship: selectedResult.data.relationship || 'PRIMARY CARD HOLDER'
            };
            const pRes = await api.post('patients/patients/', regData);
            finalPatientId = pRes.data.id;
          }
        } catch (err) { throw err; }
      } else {
        finalPatientId = selectedResult.data.id;
      }

      if (!finalPatientId) throw new Error("Patient ID generation failed");

      const dateTime = `${bookingForm.date}T${bookingForm.time}:00`;
      await api.post('clinical/appointments/', {
        patient: finalPatientId,
        doctor: user.id,
        appointment_date: dateTime,
        reason: bookingForm.reason || 'General Checkup'
      });

      toast.success("Appointment Scheduled!");
      setShowBookingModal(false);
      resetBookingForm();
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const searchUnified = (q) => {
    if (!q) {
      setPatients([]);
      return;
    }
    const lowQ = q.toLowerCase();

    // Search current patients
    // (We could fetch from API for patients, but masters are already in memory)
    const matchedPatients = patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowQ) ||
      p.phone.includes(q) || (p.card_no && p.card_no.includes(q))
    ).map(p => ({ type: 'PATIENT', data: p }));

    // Search masters (Employees and their family)
    const matchedMasters = [];
    masters.forEach(emp => {
      if (emp.name.toLowerCase().includes(lowQ) || emp.card_no.includes(q)) {
        matchedMasters.push({ type: 'MASTER', isFamily: false, data: emp });
      }
      (emp.family_members || []).forEach(fam => {
        if (fam.name.toLowerCase().includes(lowQ) || `${emp.card_no}${fam.card_no_suffix}`.includes(q)) {
          matchedMasters.push({ type: 'MASTER', isFamily: true, data: { ...fam, employee: emp.id, card_no: `${emp.card_no}${fam.card_no_suffix}` } });
        }
      });
    });

    setPatients([...matchedPatients, ...matchedMasters].slice(0, 10)); // Limit 10
  };

  const fetchPatientsApi = async (q) => {
    if (q.length < 2) return;
    try {
      const res = await api.get(`patients/patients/?search=${q}`);
      const pData = Array.isArray(res.data) ? res.data : (res.data.results || []);

      // Re-run unified with fresh API patient data
      const lowQ = q.toLowerCase();
      const matchedMasters = [];
      masters.forEach(emp => {
        if (emp.name.toLowerCase().includes(lowQ) || emp.card_no.includes(q)) {
          matchedMasters.push({ type: 'MASTER', isFamily: false, data: emp });
        }
        (emp.family_members || []).forEach(fam => {
          if (fam.name.toLowerCase().includes(lowQ) || `${emp.card_no}${fam.card_no_suffix}`.includes(q)) {
            matchedMasters.push({ type: 'MASTER', isFamily: true, data: { ...fam, employee: emp.id, card_no: `${emp.card_no}${fam.card_no_suffix}` } });
          }
        });
      });
      const apiPatients = pData.map(p => ({ type: 'PATIENT', data: p }));
      setPatients([...apiPatients, ...matchedMasters].slice(0, 15));
    } catch (err) { }
  };

  return (
    <>
      <header className="glass" style={{
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
      }}>
        {/* Left Section: Simplified Text Branding */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                fontSize: '1rem',
                fontWeight: 900,
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                lineHeight: 1
              }}>
                {user?.project_name || 'EMR'}
              </span>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                ELECTRONIC MEDICAL RECORDS
              </span>
            </div>
          )}
        </div>

        {/* Right Section: Compacted Actions + Search Utility */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          
          {/* Dynamic Header Logos (Up to 6 Round Logos) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {headerProjects.map((p) => {
                const logoSrc = p.image || p.logo;
                if (!logoSrc) return null;
                return (
                  <div 
                    key={p.id} 
                    className="logo-round-container"
                    style={{ 
                      width: '46px', 
                      height: '46px', 
                      borderRadius: '50%', 
                      overflow: 'hidden', 
                      border: '2.5px solid white',
                      background: 'white',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={p.name}
                  >
                    <img src={logoSrc.startsWith('http') ? logoSrc : `${MEDIA_URL}${logoSrc}`} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                );
            })}
          </div>

          {/* Theme Toggle Utility */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
                onClick={toggleTheme}
                style={{
                  padding: '0.5rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
                className="theme-toggle"
              >
                {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#475569" />}
                <span style={{ minWidth: '40px' }}>{isDark ? 'LIGHT' : 'DARK'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>

            {/* Appointment Hub */}
            <div style={{ position: 'relative' }} ref={calendarRef}>
              <button
                onClick={() => { setShowCalendar(!showCalendar); setShowNotifications(false); setShowDropdown(false); fetchAppointments(); }}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: showCalendar ? '#f1f5f9' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => !showCalendar && (e.currentTarget.style.background = '#f8fafc')}
                onMouseOut={e => !showCalendar && (e.currentTarget.style.background = 'transparent')}
              >
                <CalendarIcon size={18} color={showCalendar ? 'var(--primary)' : '#64748b'} />
              </button>
              {showCalendar && (
                <div className="fade-in shadow-2xl" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '340px', background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1.25rem', zIndex: 100 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Appointment Hub</h3>
                    <button 
                      onClick={() => { setShowBookingModal(true); setShowCalendar(false); }}
                      className="btn btn-primary" 
                      style={{ fontSize: '0.625rem', padding: '0.375rem 0.75rem', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      New Appointment
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--background)', padding: '0.5rem 0.75rem', borderRadius: '12px', marginBottom: '1rem' }}>
                    <button onClick={() => {
                      const d = new Date(scheduleDate);
                      d.setDate(d.getDate() - 1);
                      setScheduleDate(d.toLocaleDateString('en-CA'));
                    }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {new Date(scheduleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button onClick={() => {
                      const d = new Date(scheduleDate);
                      d.setDate(d.getDate() + 1);
                      setScheduleDate(d.toLocaleDateString('en-CA'));
                    }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><ChevronRight size={16} /></button>
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                    {appointments.filter(a => a.appointment_date.startsWith(scheduleDate)).length > 0 ? (
                      appointments.filter(a => a.appointment_date.startsWith(scheduleDate)).map((appt, i) => (
                        <div key={i} style={{ 
                          padding: '0.875rem', 
                          borderRadius: '12px', 
                          background: 'var(--background)', 
                          marginBottom: '0.625rem',
                          border: '1px solid var(--border)',
                          transition: 'transform 0.2s, background 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'var(--background)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>{appt.patient_name || `${appt.patient_details?.first_name} ${appt.patient_details?.last_name}`}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                                <Clock size={10} color="#94a3b8" />
                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>{new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <span style={{ 
                              fontSize: '0.625rem', 
                              fontWeight: 800, 
                              padding: '0.25rem 0.625rem', 
                              borderRadius: '6px', 
                              background: appt.status === 'CHECKED_IN' ? '#dcfce7' : '#eff6ff',
                              color: appt.status === 'CHECKED_IN' ? '#166534' : '#1e40af',
                              textTransform: 'uppercase'
                            }}>
                              {appt.status.replace('_', ' ')}
                            </span>
                          </div>
                          {appt.status === 'SCHEDULED' && (
                             <button 
                               onClick={() => handleCheckIn(appt.id)}
                               style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                             >CHECK-IN PATIENT</button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{ background: 'var(--background)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                          <CalendarIcon size={20} color="#94a3b8" />
                        </div>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748b' }}>No appointments found</p>
                        <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Schedule a new visit to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} ref={notifyRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowCalendar(false); setShowDropdown(false); }}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: showNotifications ? 'var(--background)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'background 0.2s',
                  position: 'relative'
                }}
                onMouseOver={e => !showNotifications && (e.currentTarget.style.background = 'var(--background)')}
                onMouseOut={e => !showNotifications && (e.currentTarget.style.background = 'transparent')}
              >
                <Bell size={18} color={unreadCount > 0 ? 'var(--primary)' : '#64748b'} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--danger)', width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid var(--surface)' }}></span>
                )}
              </button>
              {showNotifications && (
                <div className="fade-in shadow-2xl" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '320px', background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1.25rem', zIndex: 100 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'var(--text-main)' }}>News & Alerts</h3>
                      {unreadCount > 0 && <span style={{ background: 'var(--danger)', color: 'white', fontSize: '0.625rem', fontWeight: 900, padding: '1px 6px', borderRadius: '10px' }}>{unreadCount}</span>}
                    </div>
                    <button 
                      onClick={markRead}
                      style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                    {notifications.length > 0 ? (
                      notifications.map((n, i) => (
                        <div key={i} style={{ 
                          padding: '0.875rem', 
                          borderRadius: '12px', 
                          background: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.03)', 
                          marginBottom: '0.5rem',
                          border: '1px solid',
                          borderColor: n.is_read ? 'var(--border)' : 'rgba(99, 102, 241, 0.1)',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}>
                          {!n.is_read && <div style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)' }}></div>}
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ paddingTop: '2px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: n.type === 'ALERT' ? '#fef2f2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bell size={14} color={n.type === 'ALERT' ? '#ef4444' : 'var(--primary)'} />
                              </div>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4 }}>{n.message}</p>
                                <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.375rem' }}>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Just now</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                        <div style={{ background: 'var(--background)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                          <Bell size={20} color="#94a3b8" />
                        </div>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>All caught up!</p>
                        <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>No new notifications to show</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ height: '24px', width: '1px', background: 'var(--border)', margin: '0 0.25rem' }}></div>

          {/* Identity & Profile */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div
              onClick={() => setShowDropdown(!showDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                cursor: 'pointer',
                padding: '0.25rem 0.625rem',
                borderRadius: '8px',
                background: showDropdown ? 'var(--background)' : 'transparent',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => !showDropdown && (e.currentTarget.style.background = 'var(--background)')}
              onMouseOut={e => !showDropdown && (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: '32px', height: '32px', background: 'var(--primary)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left', display: 'block' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{user?.username}</p>
              </div>
              <ChevronDown size={14} color="#94a3b8" />
            </div>

            {showDropdown && (
              <div className="fade-in shadow-xl" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '220px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '0.5rem', zIndex: 100 }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <div style={{ width: '42px', height: '42px', background: 'var(--primary)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)' }}>
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username || 'System User'}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowDropdown(false); navigate('/profile'); }} className="dropdown-link"><UserIcon size={16} /> My Profile</button>
                <button className="dropdown-link"><Settings size={16} /> Preferences</button>
                <button className="dropdown-link"><HelpCircle size={16} /> Help Support</button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 0' }}></div>
                <button onClick={handleLogout} className="dropdown-link logout-btn"><LogOut size={16} /> Log Out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Booking Modal - Moved outside header to avoid sticky/z-index containment issues */}
      {showBookingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="fade-in shadow-2xl" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', background: 'var(--surface)', borderRadius: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', position: 'sticky', top: 0, zIndex: 10 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Clinical Appointment</h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="btn btn-secondary"
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} style={{ padding: '2rem' }}>
              {/* Toggle */}
              <div style={{ display: 'flex', gap: '8px', background: 'var(--background)', padding: '4px', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setBookingForm({ ...bookingForm, isOutside: false })}
                  style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', background: !bookingForm.isOutside ? 'var(--surface)' : 'transparent', color: !bookingForm.isOutside ? 'var(--primary)' : '#64748b', boxShadow: !bookingForm.isOutside ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                >SYSTEM SEARCH</button>
                <button
                  type="button"
                  onClick={() => setBookingForm({ ...bookingForm, isOutside: true })}
                  style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', background: bookingForm.isOutside ? 'var(--surface)' : 'transparent', color: bookingForm.isOutside ? 'var(--primary)' : '#64748b', boxShadow: bookingForm.isOutside ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                >OUTSIDE PERSON</button>
              </div>

              {!bookingForm.isOutside ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Search Patient / Employee *</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Type name, card number or mobile..."
                      value={bookingForm.searchQ || ''}
                      onChange={(e) => {
                        setBookingForm({ ...bookingForm, searchQ: e.target.value });
                        fetchPatientsApi(e.target.value);
                      }}
                      className="form-control"
                      style={{ borderRadius: '12px', paddingLeft: '2.5rem' }}
                    />
                  </div>
                  {patients.length > 0 && !selectedResult && (
                    <div style={{ marginTop: '0.5rem', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      {patients.map((res, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedResult(res);
                            setBookingForm({ ...bookingForm, searchQ: res.data.name || `${res.data.first_name} ${res.data.last_name}` });
                          }}
                          style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: 'var(--surface)' }}
                          onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseOut={e => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b' }}>{res.data.name || `${res.data.first_name} ${res.data.last_name}`}</p>
                              <p style={{ fontSize: '0.6875rem', color: '#64748b' }}>{res.type === 'MASTER' ? `Master Code: ${res.data.card_no}` : `Patient UHID: #${1000 + res.data.id}`}</p>
                            </div>
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: res.type === 'MASTER' ? '#dcfce7' : '#eff6ff', color: res.type === 'MASTER' ? '#166534' : '#1e40af' }}>
                              {res.type === 'MASTER' ? (res.isFamily ? 'FAMILY' : 'EMPLOYEE') : 'EXISTING PATIENT'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedResult && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>Selected: {selectedResult.data.name || `${selectedResult.data.first_name} ${selectedResult.data.last_name}`}</p>
                        <p style={{ fontSize: '0.625rem', color: '#64748b' }}>UID: {selectedResult.data.card_no || selectedResult.data.id_proof_number}</p>
                      </div>
                      <button type="button" onClick={() => { setSelectedResult(null); setBookingForm({ ...bookingForm, searchQ: '' }); }} style={{ border: 'none', background: 'var(--surface)', width: '24px', height: '24px', borderRadius: '50%', fontSize: '12px', cursor: 'pointer', color: '#ef4444' }}>&times;</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid #eef2f6' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>First Name *</label>
                    <input type="text" className="form-control" style={{ borderRadius: '10px' }} onChange={e => setBookingForm({ ...bookingForm, outsideData: { ...bookingForm.outsideData, first_name: e.target.value } })} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>Last Name</label>
                    <input type="text" className="form-control" style={{ borderRadius: '10px' }} onChange={e => setBookingForm({ ...bookingForm, outsideData: { ...bookingForm.outsideData, last_name: e.target.value } })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>Mobile *</label>
                    <input type="tel" className="form-control" style={{ borderRadius: '10px' }} onChange={e => setBookingForm({ ...bookingForm, outsideData: { ...bookingForm.outsideData, phone: e.target.value } })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>Gender</label>
                    <select className="form-control" style={{ borderRadius: '10px' }} onChange={e => setBookingForm({ ...bookingForm, outsideData: { ...bookingForm.outsideData, gender: e.target.value } })}>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>Date of Birth *</label>
                    <input type="date" className="form-control" style={{ borderRadius: '10px' }} onChange={e => setBookingForm({ ...bookingForm, outsideData: { ...bookingForm.outsideData, dob: e.target.value } })} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Appt Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ borderRadius: '12px' }}
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingForm.date || ''}
                    onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Appt Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    style={{ borderRadius: '12px' }}
                    value={bookingForm.time || ''}
                    onChange={e => setBookingForm({ ...bookingForm, time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Reason for visit</label>
                <textarea
                  rows="2"
                  className="form-control"
                  placeholder="Chief complaint..."
                  style={{ borderRadius: '12px', resize: 'none' }}
                  onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '1rem', position: 'sticky', bottom: 0, background: 'var(--surface)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowBookingModal(false)} className="btn btn-secondary" style={{ flex: 1, height: '48px', borderRadius: '12px', fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2, height: '48px', borderRadius: '12px', fontWeight: 700, boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)' }}>
                  {isSubmitting ? 'Processing...' : 'Schedule Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .dropdown-link { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.625rem 0.875rem; border: none; background: transparent; color: var(--text-main); font-size: 0.8125rem; font-weight: 600; cursor: pointer; border-radius: 10px; transition: 0.2s; text-align: left; }
        .dropdown-link:hover { background: var(--background); color: var(--primary); }
        .logout-btn { color: #ef4444 !important; }
        .logout-btn:hover { background: #fef2f2 !important; }
        .form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
        .logo-round-container:hover { transform: scale(1.15) translateY(-2px); box-shadow: 0 8px 15px rgba(0,0,0,0.15); z-index: 50; }
      `}</style>
    </>
  );
};

export default Navbar;
