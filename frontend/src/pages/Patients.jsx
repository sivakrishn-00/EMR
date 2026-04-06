import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Search, 
  UserPlus, 
  X, 
  Calendar, 
  Phone, 
  MapPin, 
  Fingerprint, 
  User,
  Filter,
  MoreVertical,
  Download,
  Info,
  Activity,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('ACTIVE'); // 'ACTIVE', 'ALL'
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total_registered: 0, opd_today: 0, emergency_today: 0 });
  const [tabCounts, setTabCounts] = useState({ active: 0, scheduled: 0, completed: 0, all: 0 });
  const [employeeMasters, setEmployeeMasters] = useState([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    phone: '',
    address: '',
    id_proof_type: 'AADHAAR',
    id_proof_number: '',
    patient_type: 'OPD',
    abha_id: '',
    reason: 'Routine Checkup',
    is_employee_linked: false,
    employee_master: null,
    family_member: null,
    project: '',
    card_no: '',
    relationship: ''
  });
  const [formAttempted, setFormAttempted] = useState(false);

  useEffect(() => {
    fetchEmployeeMasters();
    fetchStats();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('patients/projects/');
      if (res.data.results) {
        setProjects(res.data.results);
      } else {
        setProjects(res.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchPatients(1, viewMode, projectFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [viewMode, searchQuery, projectFilter]);
  
  const fetchStats = async () => {
    try {
        const url_params = projectFilter ? `?project=${projectFilter}` : '';
        const res = await api.get(`patients/patients/stats/${url_params}`);
        setStats(res.data);
        // Also update individual tab counts from stats if available, or fetch separately
        setTabCounts(prev => ({
            ...prev,
            all: res.data.total_registered,
            // We can add more specific counts to the stats endpoint later
        }));
    } catch (err) {}
  };

  const fetchPatients = async (pageNum = 1, currentView = viewMode, proj = projectFilter) => {
    setIsLoading(true);
    try {
      const viewParam = currentView.toLowerCase();
      let url = `patients/patients/?page=${pageNum}&view=${viewParam}&search=${searchQuery}`;
      if (proj) url += `&project=${proj}`;
      const res = await api.get(url);
      if (res.data.results) {
          setPatients(res.data.results);
          setTotalCount(res.data.count);
          // Sync the current tab's count into tabCounts
          setTabCounts(prev => ({ ...prev, [viewParam]: res.data.count }));
      } else {
          setPatients(res.data);
          setTotalCount(res.data.length);
      }
      setPage(pageNum);
      fetchStats(); // Update dashboard cards whenever we fetch patients
    } catch (err) {
      console.error(err);
      toast.error("Cloud synchronization delay. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeMasters = async () => {
    try {
      // Use the newly created all-masters endpoint for non-paginated access
      const res = await api.get(`patients/employee-masters/all-masters/`);
      setEmployeeMasters(res.data);
    } catch (err) {
      console.error("Failed to fetch masters");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormAttempted(true);

    if (formData.phone && (formData.phone.length !== 10 || isNaN(formData.phone))) {
        toast.error("Mobile number must be exactly 10 digits");
        return;
    }

    const loadingToast = toast.loading('Registering patient...');
    try {
      const submitData = { ...formData };
      // employee_master, family_member, card_no, relationship are already set in formData by the dropdown onChange handlers
      if (formData.is_employee_linked) {
          submitData.is_employee_linked = true;
          submitData.id_proof_type = 'EMPLOYEE_CARD';
      }

      const patientRes = await api.post('patients/patients/', submitData);
      const newPatient = patientRes.data;
      
      await api.post('clinical/visits/', {
        patient: newPatient.id,
        reason: formData.reason || 'Initial Consultation',
        status: 'PENDING_VITALS'
      });

      toast.success("Patient registered and queued for Vitals!", { id: loadingToast });
      setShowModal(false);
      resetForm();
      setFormAttempted(false);
      fetchPatients();
    } catch (err) {
      toast.error("Error registering patient", { id: loadingToast });
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '', last_name: '', dob: '', gender: '', phone: '', address: '',
      id_proof_type: 'AADHAAR', id_proof_number: '', patient_type: 'OPD', abha_id: '',
      reason: 'Routine Checkup',
      is_employee_linked: false,
      employee_master: null,
      family_member: null,
      project: user?.project || '',
      card_no: '',
      relationship: ''
    });
    setFormAttempted(false);
  };

  const StatusStepper = ({ status }) => {
    const steps = [
      { id: 1, label: 'Reg', key: 'REGISTERED' },
      { id: 2, label: 'Vital', key: 'PENDING_VITALS' },
      { id: 3, label: 'Init', key: 'PENDING_CONSULTATION' },
      { id: 4, label: 'Lab', key: 'PENDING_LAB' },
      { id: 5, label: 'Final', key: 'FINAL_CONSULTATION' },
      { id: 6, label: 'Rx', key: 'PENDING_PHARMACY' }
    ];

    const getStatusIndex = (s) => {
        if (s === 'COMPLETED') return 7;
        if (s === 'PENDING_PHARMACY') return 6;
        if (s === 'FINAL_CONSULTATION') return 5;
        if (s === 'PENDING_LAB') return 4;
        if (s === 'PENDING_CONSULTATION') return 3;
        if (s === 'PENDING_VITALS') return 2;
        return 1;
    };

    const currentIndex = getStatusIndex(status);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {steps.map((step, idx) => {
          const done = currentIndex > step.id;
          const active = currentIndex === step.id;
          
          // Color Logic: Doctor/Action Needed is Blue/Red, Completed is Green
          const dotColor = done ? '#10b981' : active ? 'var(--primary)' : 'var(--border)'; 
          
          return (
            <React.Fragment key={step.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{ 
                  width: '20px', height: '20px', borderRadius: '50%', 
                  background: dotColor,
                  color: done || active ? 'white' : '#94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 800,
                  boxShadow: active ? '0 0 0 3px rgba(239, 68, 68, 0.2)' : 'none',
                  transition: '0.3s'
                }}>
                  {done ? <Check size={10} /> : step.id}
                </div>
                <span style={{ fontSize: '7px', fontWeight: 800, marginTop: '1px', color: active ? '#ef4444' : '#94a3b8', textTransform: 'uppercase' }}>{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{ width: '8px', height: '2px', background: done ? '#10b981' : 'var(--border)', marginBottom: '10px' }}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const filteredPatients = (patients || []).filter(p => {
    const searchLow = searchQuery.toLowerCase();
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const phone = String(p.phone || '');
    const idProof = String(p.id_proof_number || '');
    const cardNo = String(p.card_no || '');
    const patientID = String(p.patient_id || '').toLowerCase();

    return fullName.includes(searchLow) || phone.includes(searchLow) || idProof.includes(searchLow) || cardNo.includes(searchLow) || patientID.includes(searchLow);
  });

  return (
    <div className="fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Patient Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Manage registration and records of all patients</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.625rem 1rem' }}>
            <Download size={18} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <UserPlus size={20} /> Register New Patient
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem', overflowX: 'auto' }}>
        <button 
            onClick={() => setViewMode('ACTIVE')}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'ACTIVE' ? '3px solid var(--primary)' : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            In-Clinic Queue ({tabCounts.active})
        </button>
        <button 
            onClick={() => setViewMode('SCHEDULED')}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'SCHEDULED' ? '3px solid var(--primary)' : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'SCHEDULED' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Planned Schedule ({tabCounts.scheduled})
        </button>
        <button 
            onClick={() => setViewMode('COMPLETED')}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'COMPLETED' ? '3px solid var(--primary)' : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'COMPLETED' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Closed Today ({tabCounts.completed})
        </button>
        <button 
            onClick={() => setViewMode('ALL')}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'ALL' ? '3px solid var(--primary)' : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Master Registry ({tabCounts.all})
        </button>
      </div>

      {/* Premium Hub Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '3rem' }}>
          <DashboardMetric 
              label="Station Total" 
              value={stats.total_registered} 
              icon={<User size={24} />} 
              gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
          />
          <DashboardMetric 
              label="OPD Today" 
              value={String(stats.opd_today).padStart(2, '0')} 
              icon={<Activity size={24} />} 
              gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
          />
          <DashboardMetric 
              label="Emergency" 
              value={String(stats.emergency_today).padStart(2, '0')} 
              icon={<Clock size={24} />} 
              gradient="linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)"
          />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search by ID (BHSPL0001), Name, or Mobile..." 
              style={{ paddingLeft: '2.75rem', height: '44px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {user?.role === 'ADMIN' && (
              <select 
                  className="form-control" 
                  style={{ width: '250px', height: '44px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
              >
                  <option value="">Global Filter (All Projects)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          )}
          <button className="btn btn-secondary" style={{ width: '44px', padding: 0 }}>
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ padding: '1rem 1.5rem' }}>Patient Details</th>
                <th>Project</th>
                <th>Gender/Age</th>
                <th>Contact info</th>
                <th>Patient Type</th>
                <th>Clinic Status</th>
                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading records...</td></tr>
                ))
              ) : filteredPatients.map(p => {
                const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : 'N/A';
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '40px', height: '40px', background: 'var(--background)', color: 'var(--text-main)', 
                          borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.875rem'
                        }}>
                          {(p.first_name?.[0] || 'P')}{(p.last_name?.[0] || '')}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                            {p.first_name || 'Anonymous'} {p.last_name || ''}
                            {p.is_employee_linked && <span style={{ marginLeft: '8px', fontSize: '0.625rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>EMP LINKED</span>}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.patient_id}</span> {p.is_employee_linked && ` | Card: ${p.card_no}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--background)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            {p.project_name || 'GENERAL'}
                        </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.gender}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{age} Years</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                          <Phone size={12} color="var(--text-muted)" /> {p.phone ? p.phone.replace(/(\d{6})(\d{4})/, '$1XXXX') : 'N/A'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <MapPin size={12} color="var(--text-muted)" /> {p.address?.substring(0, 20)}...
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        background: p.patient_type === 'Emergency' ? '#fee2e2' : '#dcfce7',
                        color: p.patient_type === 'Emergency' ? '#991b1b' : '#166534',
                        fontWeight: 700,
                        fontSize: '0.75rem'
                      }}>
                        {p.patient_type || 'OPD'}
                      </span>
                    </td>
                    <td>
                        {p.current_visit ? (
                            <StatusStepper status={p.current_visit.status} />
                        ) : viewMode === 'SCHEDULED' && p.upcoming_appointment ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                                    APPT: {p.upcoming_appointment.time}
                                </span>
                                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 700 }}>{p.upcoming_appointment.date}</span>
                                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{p.upcoming_appointment.reason}</span>
                                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                    Awaiting Arrival
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {p.visits && p.visits.length > 0 ? "Returned Patient" : "Registered Only"}
                                </span>
                                {p.upcoming_appointment && (
                                     <span style={{ fontSize: '0.625rem', color: 'var(--primary)', fontWeight: 700 }}>Next Appt: {p.upcoming_appointment.date}</span>
                                )}
                                {p.last_visit_details && (
                                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <Clock size={10} /> Last Saw: {p.last_visit_details.last_date}
                                    </span>
                                )}
                                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.05)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                    Record Holder
                                    {viewMode === 'ALL' && p.current_visit && " (Active)"}
                                </div>
                            </div>
                        )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                        {p.current_visit ? (
                            <div style={{ background: 'var(--background)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={12} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Clinic</span>
                            </div>
                        ) : viewMode === 'SCHEDULED' ? (
                            <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'var(--primary)', borderRadius: '10px' }}
                                onClick={async () => {
                                    const loading = toast.loading('Initiating Arrived Status...');
                                    try {
                                        if (p.upcoming_appointment?.id) {
                                            // Call the official check-in action
                                            await api.post(`clinical/appointments/${p.upcoming_appointment.id}/check_in/`);
                                        } else {
                                            // Fallback to direct visit creation
                                            await api.post('clinical/visits/', { patient: p.id, reason: 'Scheduled Visit', status: 'PENDING_VITALS' });
                                        }
                                        toast.success("Patient Arrived & Registered!", { id: loading });
                                        fetchPatients();
                                    } catch (e) { toast.error("Check-in sync failed", { id: loading }); }
                                }}
                            >
                                <Check size={12} /> Start Visit
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#f59e0b', borderColor: '#f59e0b', borderRadius: '10px' }}
                                onClick={async () => {
                                    const loading = toast.loading('Re-opening clinical visit...');
                                    try {
                                        await api.post('clinical/visits/', { patient: p.id, reason: 'OPD Consultation', status: 'PENDING_VITALS' });
                                        toast.success("Joined Nurse Queue!", { id: loading });
                                        fetchPatients();
                                        fetchStats();
                                    } catch (e) { toast.error("Patient visit already active", { id: loading }); }
                                }}
                            >
                                <Activity size={12} /> Triage
                            </button>
                        )}
                        <button className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}>
                          <MoreVertical size={18} color="var(--text-muted)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                    <Info size={40} color="var(--border)" style={{ marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No records found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing <span style={{ color: 'var(--primary)' }}>{filteredPatients.length}</span> of {totalCount} patients
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                    className="btn btn-secondary" 
                    disabled={page === 1}
                    onClick={() => fetchPatients(page - 1)}
                    style={{ padding: '0.4rem', borderRadius: '8px', opacity: page === 1 ? 0.5 : 1 }}
                >
                    <ChevronLeft size={18} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {Array.from({ length: Math.ceil(totalCount / 10) }).map((_, i) => (
                        <button 
                            key={i} 
                            onClick={() => fetchPatients(i + 1)}
                            style={{ 
                                width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                background: page === i + 1 ? 'var(--primary)' : 'transparent',
                                color: page === i + 1 ? 'white' : 'var(--text-muted)',
                                fontWeight: 700, cursor: 'pointer', transition: '0.3s'
                            }}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
                <button 
                    className="btn btn-secondary" 
                    disabled={page >= Math.ceil(totalCount / 10)}
                    onClick={() => fetchPatients(page + 1)}
                    style={{ padding: '0.4rem', borderRadius: '8px', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-start',
          zIndex: 10000, 
          padding: '100px 1rem 60px 1rem',
          overflowY: 'auto'
        }}>
          <div className="fade-in card" style={{ 
            width: '100%', 
            maxWidth: '820px', 
            padding: 0, 
            borderRadius: '24px', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            background: 'var(--surface)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--background)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'var(--primary)', padding: '0.75rem', borderRadius: '12px' }}>
                  <UserPlus size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Patient Registration</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fill in the details to create a new UHID</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'var(--border)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                
                {/* Visit Information */}
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Engagement</p>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--background)', padding: '4px', borderRadius: '10px' }}>
                        {(!user?.project || (projects.find(p => p.id === user.project)?.category_mappings?.some(m => m.category === 'GENERAL'))) && (
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, is_employee_linked: false})}
                            style={{ 
                                padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                                background: !formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                color: !formData.is_employee_linked ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: !formData.is_employee_linked ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer'
                            }}
                        >General</button>
                        )}
                        {(!user?.project || (projects.find(p => p.id === user.project)?.category_mappings?.some(m => m.category === 'EMPLOYEE' || m.category === 'FAMILY'))) && (
                        <button 
                             type="button"
                             onClick={() => setFormData({...formData, is_employee_linked: true})}
                             style={{ 
                                 padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                                 background: formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                 color: formData.is_employee_linked ? 'var(--primary)' : 'var(--text-muted)',
                                 boxShadow: formData.is_employee_linked ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                 cursor: 'pointer'
                             }}
                        >Employee/Family</button>
                        )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label><Activity size={14} /> Reason for Visit / Chief Complaint <span style={{ color: '#ef4444' }}>*</span></label>
                    <input required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="e.g. Fever and body pain, Regular followup..." style={{ background: 'var(--background)', borderColor: (formAttempted && !formData.reason) ? '#ef4444' : 'var(--border)' }} />
                    {formAttempted && !formData.reason && <p style={{ color: '#ef4444', fontSize: '10px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required Field</p>}
                  </div>
                </div>

                {formData.is_employee_linked && (
                    <div style={{ gridColumn: 'span 2', background: 'var(--background)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Link Employee Record</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Search Employee (Name/Card No)</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="Type name or card number..."
                                        value={employeeSearchTerm}
                                        onChange={(e) => {
                                            setEmployeeSearchTerm(e.target.value);
                                            setShowEmployeeDropdown(true);
                                        }}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                    />
                                    {showEmployeeDropdown && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                                                onClick={() => setShowEmployeeDropdown(false)}
                                            />
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, 
                                                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                                                maxHeight: '300px', overflowY: 'auto', zIndex: 1000,
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', marginTop: '4px'
                                            }}>
                                                {employeeMasters.filter(emp => 
                                                    emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                                                    emp.card_no.includes(employeeSearchTerm)
                                                ).length === 0 ? (
                                                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matching employees found</div>
                                                ) : (
                                                    employeeMasters.filter(emp => 
                                                        emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                                                        emp.card_no.includes(employeeSearchTerm)
                                                    ).map(emp => (
                                                        <div 
                                                            key={emp.id}
                                                            onClick={() => {
                                                                setEmployeeSearchTerm(`${emp.card_no} - ${emp.name}`);
                                                                setShowEmployeeDropdown(false);
                                                                setFormData({
                                                                    ...formData,
                                                                    employee_master: emp.id,
                                                                    project: emp.project || '',
                                                                    first_name: emp.name.split(' ')[0],
                                                                    last_name: emp.name.split(' ').slice(1).join(' '),
                                                                    dob: emp.dob,
                                                                    gender: emp.gender,
                                                                    phone: emp.mobile_no,
                                                                    address: emp.address,
                                                                    id_proof_type: 'EMPLOYEE_CARD',
                                                                    id_proof_number: emp.card_no,
                                                                    card_no: emp.card_no,
                                                                    relationship: 'PRIMARY CARD HOLDER'
                                                                });
                                                            }}
                                                            style={{
                                                                padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                                                fontSize: '0.875rem'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--background)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{emp.card_no}</div>
                                                            <div style={{ color: 'var(--text-main)' }}>{emp.name}</div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {formData.employee_master && (
                                <div className="form-group">
                                    <label>Select Family Member</label>
                                    <select 
                                        className="form-control"
                                        onChange={(e) => {
                                            const emp = employeeMasters.find(em => em.id === formData.employee_master);
                                            const fam = emp.family_members.find(f => f.id === parseInt(e.target.value));
                                            if (fam) {
                                                setFormData({
                                                    ...formData,
                                                    family_member: fam.id,
                                                    project: emp.project || '',
                                                    first_name: fam.name.split(' ')[0],
                                                    last_name: fam.name.split(' ').slice(1).join(' '),
                                                    dob: fam.dob,
                                                    gender: fam.gender,
                                                    phone: fam.mobile_no || emp.mobile_no,
                                                    id_proof_number: `${emp.card_no}/${fam.card_no_suffix}`,
                                                    card_no: `${emp.card_no}/${fam.card_no_suffix}`,
                                                    relationship: fam.relationship
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">Self (Primary)</option>
                                        {employeeMasters.find(emp => emp.id === formData.employee_master)?.family_members.map(fam => (
                                            <option key={fam.id} value={fam.id}>{fam.relationship}: {fam.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!formData.is_employee_linked && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Registration Project <span style={{ color: '#ef4444' }}>*</span></label>
                    {user?.project ? (
                        <div style={{ padding: '0.75rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {projects.find(p => p.id === user.project)?.name || 'Mapped Project'}
                        </div>
                    ) : (
                        <select 
                        required 
                        value={formData.project} 
                        onChange={e => setFormData({...formData, project: e.target.value})} 
                        style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                        >
                        <option value="">-- Select Project --</option>
                        {projects && Array.isArray(projects) && projects.filter(p => p.category_mappings?.some(m => m.category === 'GENERAL')).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        </select>
                    )}
                  </div>
                )}

                {/* Personal Information */}
                <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Basic Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label><User size={14} /> First Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} placeholder="e.g. John" style={{ border: (formAttempted && !formData.first_name) ? '1px solid #ef4444' : '1px solid var(--border)' }} />
                      {formAttempted && !formData.first_name && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                    <div className="form-group">
                      <label>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} placeholder="e.g. Doe" style={{ border: (formAttempted && !formData.last_name) ? '1px solid #ef4444' : '1px solid var(--border)' }} />
                      {formAttempted && !formData.last_name && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Identity Verification (Primary ID)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label><Fingerprint size={14} /> ID Proof Type *</label>
                            <select value={formData.id_proof_type} onChange={e => setFormData({...formData, id_proof_type: e.target.value})} style={{ background: 'var(--surface)' }}>
                                <option value="AADHAAR">Aadhaar Card</option>
                                <option value="VOTER_ID">Voter ID</option>
                                <option value="DRIVING_LICENCE">Driving Licence</option>
                                <option value="PASSPORT">Passport</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>ID proof Number (Primary Key) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input required value={formData.id_proof_number} onChange={e => setFormData({...formData, id_proof_number: e.target.value})} placeholder="Enter Aadhaar/ID number" style={{ background: 'var(--surface)', border: (formAttempted && !formData.id_proof_number) ? '1px solid #ef4444' : '1px solid var(--border)' }} />
                            {formAttempted && !formData.id_proof_number && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required Field</p>}
                        </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label><Calendar size={14} /> Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" required value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} style={{ border: (formAttempted && !formData.dob) ? '1px solid #ef4444' : '1px solid var(--border)' }} />
                  {formAttempted && !formData.dob && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                <div className="form-group">
                  <label>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <select required value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} style={{ border: (formAttempted && !formData.gender) ? '1px solid #ef4444' : '1px solid var(--border)' }}>
                    <option value="">-- Select --</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {formAttempted && !formData.gender && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                {/* Contact Information */}
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Contact & Address</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label><Phone size={14} /> Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input required type="tel" maxLength={10} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} placeholder="10-digit number" style={{ border: (formAttempted && (!formData.phone || formData.phone.length !== 10)) ? '1px solid #ef4444' : '1px solid var(--border)' }} />
                      {formAttempted && (!formData.phone || formData.phone.length !== 10) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Invalid / Required (10 Digits)</p>}
                    </div>
                    <div className="form-group">
                      <label>Patient Type</label>
                      <select value={formData.patient_type} onChange={e => setFormData({...formData, patient_type: e.target.value})}>
                        <option value="OPD">Outpatient (OPD)</option>
                        <option value="IPD">Inpatient (IPD)</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Review">Review</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label><MapPin size={14} /> Local Address *</label>
                  <textarea rows="2" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="House No, Street, Landmark..."></textarea>
                </div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>ABHA ID (Optional)</label>
                    <input value={formData.abha_id} onChange={e => setFormData({...formData, abha_id: e.target.value})} placeholder="14-digit ABHA Number" />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ 
                display: 'flex', justifyContent: 'flex-end', gap: '1rem', 
                marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' 
              }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '0.75rem 2rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>Complete Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .form-control {
          width: 100%;
          padding: 0.625rem 0.875rem;
          background-color: var(--background);
          border: 1px solid var(--border);
          color: var(--text-main);
          font-weight: 500;
          transition: 0.3s;
          outline: none;
          font-size: 0.875rem;
          border-radius: 12px;
        }
        .form-control:focus {
          border-color: var(--primary);
          background-color: white;
          box-shadow: 0 0 0 4px rgba(67, 56, 202, 0.1);
        }
        .form-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #475569;
        }
        input, select, textarea {
          border-radius: 12px !important;
        }
        .badge {
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
};

// Premium Hub-Style Metric Components 🎯
const DashboardMetric = ({ label, value, icon, gradient }) => (
    <div style={{ 
        background: gradient || 'var(--surface)', 
        borderRadius: '16px', 
        padding: '0.75rem 1.125rem', 
        color: 'white',
        boxShadow: '0 6px 12px -3px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'transform 0.3s ease',
        cursor: 'default'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
        <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.4rem', borderRadius: '10px' }}>
                    {React.cloneElement(icon, { size: 14, strokeWidth: 3 })}
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>Live</div>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>{value}</div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{label}</div>
        </div>
        {/* Abstract Background Shapes */}
        <div style={{ position: 'absolute', right: '-10%', bottom: '-15%', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', zIndex: 1 }}></div>
    </div>
);

export default Patients;
