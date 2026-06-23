import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Eye,
  Info,
  Activity,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight, 
  ShieldCheck,
  Loader2,
  Users,
  Database,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Reusable Custom Select Dropdown for enhanced UI aesthetics
const CustomSelect = ({ options, value, onChange, placeholder = 'Select...', style = {}, primaryColor }) => {
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
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="form-control"
        style={{
          width: '100%',
          height: '52px',
          borderRadius: '16px',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          padding: '0 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          color: 'var(--text-main)',
          textAlign: 'left'
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
          borderRadius: '16px',
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
                padding: '0.75rem 1rem',
                borderRadius: '10px',
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

const Patients = () => {
  const { user } = useAuth();

  const getLocalISOString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  };
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
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [employeeMasters, setEmployeeMasters] = useState([]);
  const [isMastersLoading, setIsMastersLoading] = useState(false);
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
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triagePatient, setTriagePatient] = useState(null);
  const [triageReason, setTriageReason] = useState('Routine Checkup');
  const [isLateEntry, setIsLateEntry] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const [lateEntryJustification, setLateEntryJustification] = useState('OFFLINE_CHARTING');
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackAppointment, setAckAppointment] = useState(null);
  const [ackForm, setAckForm] = useState({ date: '', startTime: '', endTime: '' });
  const [isAcking, setIsAcking] = useState(false);
  const [isEnablingPortal, setIsEnablingPortal] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isTriaging, setIsTriaging] = useState(false);
  const [visibleRows, setVisibleRows] = useState(15);
  const sentinelRef = React.useRef(null);
  const latestRequestRef = React.useRef(0);
  
  // Download Report Settings
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadVisitCount, setDownloadVisitCount] = useState(5);
  const [selectedPatientForDownload, setSelectedPatientForDownload] = useState(null);

  // Personnel Registry Access
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [masterFormData, setMasterFormData] = useState({
    project: "", card_no: "", name: "", dob: "", gender: "MALE", mobile_no: "", aadhar_no: "", address: "", designation: "", is_active: true, additional_fields: {},
  });
  const [familyFormData, setFamilyFormData] = useState({
    card_no_suffix: "", name: "", dob: "", gender: "MALE", mobile_no: "", aadhar_no: "", relationship: "SPOUSE", additional_fields: {},
  });
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [familyMasterSearch, setFamilyMasterSearch] = useState("");
  const [showFamilyMasterDropdown, setShowFamilyMasterDropdown] = useState(false);
  const [masterFormAttempted, setMasterFormAttempted] = useState(false);
  const [familyFormAttempted, setFamilyFormAttempted] = useState(false);
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [bulkEnrollData, setBulkEnrollData] = useState('');
  const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
  const [bulkEnrollStatus, setBulkEnrollStatus] = useState({
    isProcessing: false,
    total: 0,
    current: 0,
    success: 0,
    errors: 0,
    failedRecords: [],
    completed: false
  });

  const filteredPatients = (patients || []).filter(p => {
    const searchLow = searchQuery.toLowerCase().trim();
    if (!searchLow) return true;

    // Smart card group matching: check if search term is a card base/suffix and extract the base
    const cardMatch = searchLow.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || searchLow.match(/(\d+)(?:\/\d+)?/);
    if (cardMatch) {
      const baseCard = cardMatch[1].padStart(4, '0');
      const pCard = String(p.card_no || '').toLowerCase();
      const pCardMatch = pCard.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || pCard.match(/(\d+)(?:\/\d+)?/);
      if (pCardMatch && pCardMatch[1].padStart(4, '0') === baseCard) {
        return true;
      }
    }

    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const phone = String(p.phone || '');
    const idProof = String(p.id_proof_number || '');
    const cardNo = String(p.card_no || '').toLowerCase();
    const patientID = String(p.patient_id || '').toLowerCase();
    const employeeId = String(p.employee_details?.additional_fields?.employee_id || '').toLowerCase();

    return fullName.includes(searchLow) || phone.includes(searchLow) || idProof.includes(searchLow) || cardNo.includes(searchLow) || patientID.includes(searchLow) || employeeId.includes(searchLow);
  });

  const downloadFailedEnrollmentCards = () => {
    if (bulkEnrollStatus.failedRecords.length === 0) return;
    const headers = ["Card Number", "Error Reason"];
    const rows = bulkEnrollStatus.failedRecords.map(r => [r.card_no, `"${r.error}"`]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `failed_activation_cards_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchNextCardNo = async (projectId) => {
    try {
      const res = await api.get(`patients/employee-masters/next-card-no/?project=${projectId}`);
      if (res.data.next_card_no) {
        setMasterFormData(prev => ({ ...prev, card_no: res.data.next_card_no }));
      }
    } catch (err) {
      console.error("Failed to fetch next card number", err);
    }
  };

  const openMasterOnboarding = () => {
    const currentProject = projects.find(p => p.id == (projectFilter || user?.project));
    if (currentProject && currentProject.use_registry_for_personnel) {
      setMasterFormData(prev => ({ ...prev, project: currentProject.id }));
      fetchNextCardNo(currentProject.id);
    }
    setShowMasterModal(true);
  };

  const handleMasterOnboardingSubmit = async (e) => {
    e.preventDefault();
    setMasterFormAttempted(true);
    if (!masterFormData.name || !masterFormData.card_no || !masterFormData.dob || !masterFormData.mobile_no) {
       toast.error("Please fill all required clinical fields");
       return;
    }
    const loadId = toast.loading("Finalizing Master Personnel Record...");
    try {
      const data = new FormData();
      Object.keys(masterFormData).forEach(key => {
        if (key === 'additional_fields') {
          data.append(key, JSON.stringify(masterFormData[key]));
        } else {
          data.append(key, masterFormData[key]);
        }
      });
      await api.post('patients/employee-masters/', data);
      toast.success("Personnel Master Onboarded Successfully!", { id: loadId });
      setShowMasterModal(false);
      setMasterFormAttempted(false);
      setMasterFormData({
        project: "", card_no: "", name: "", dob: "", gender: "MALE", mobile_no: "", aadhar_no: "", address: "", designation: "", is_active: true, additional_fields: {},
      });
      fetchEmployeeMasters();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to onboard personnel. Check for duplicate Card ID/Aadhar.", { id: loadId });
    }
  };

  const handleBulkEnrollSubmit = async () => {
    const cardNumbers = bulkEnrollData.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
    if (cardNumbers.length === 0) {
      toast.error("Please provide Card Numbers to enroll");
      return;
    }

    const currentProjectId = projectFilter || user?.project;
    if (!currentProjectId) {
      toast.error("Please select a project filter first");
      return;
    }

    setBulkEnrollStatus({
      isProcessing: true,
      total: cardNumbers.length,
      current: 0,
      success: 0,
      errors: 0,
      failedRecords: [],
      completed: false
    });
    setIsBulkEnrolling(true);

    const CHUNK_SIZE = 500;
    let localSuccess = 0;
    let localErrors = 0;
    let failedList = [];

    try {
      for (let i = 0; i < cardNumbers.length; i += CHUNK_SIZE) {
        const chunk = cardNumbers.slice(i, i + CHUNK_SIZE);
        
        try {
          const res = await api.post(`patients/projects/${currentProjectId}/bulk-link-employees/`, {
            card_numbers: chunk
          });
          
          if (res.data.status === 'success') {
            localSuccess += res.data.linked || 0;
            if (res.data.errors && res.data.errors.length > 0) {
              localErrors += res.data.errors.length;
              res.data.errors.forEach(errStr => {
                const match = errStr.match(/(?:Card|Dependent|Error linking)\s+([^\s]+)/i);
                const cardNo = match ? match[1] : errStr;
                failedList.push({
                  card_no: cardNo,
                  error: errStr
                });
              });
            }
          } else {
            localErrors += chunk.length;
            chunk.forEach(c => failedList.push({ card_no: c, error: 'Batch activation rejected by backend' }));
          }
        } catch (err) {
          localErrors += chunk.length;
          chunk.forEach(c => failedList.push({ card_no: c, error: err.response?.data?.error || err.message || 'Network request failed' }));
        }

        setBulkEnrollStatus(prev => ({
          ...prev,
          current: Math.min(i + chunk.length, cardNumbers.length),
          success: localSuccess,
          errors: localErrors,
          failedRecords: [...failedList]
        }));
      }

      setBulkEnrollStatus(prev => ({
        ...prev,
        completed: true
      }));

      toast.success(`Bulk activation completed! Succeeded: ${localSuccess}, Failed: ${localErrors}`);
      fetchEmployeeMasters();
      fetchPatients();
    } catch (globalErr) {
      console.error(globalErr);
      toast.error("Bulk activation failed");
    } finally {
      setIsBulkEnrolling(false);
    }
  };

  const handleFamilyRegistrySubmit = async (e) => {
    e.preventDefault();
    setFamilyFormAttempted(true);
    if (!selectedMasterId) {
      toast.error("Please select an employee from the dropdown list first");
      return;
    }
    if (!familyFormData.name || !familyFormData.dob) {
      toast.error("Employee details incomplete: Name and DOB are required");
      return;
    }
    if (!familyFormData.card_no_suffix) {
      toast.error("System error: Next suffix not calculated. Please re-select the employee.");
      return;
    }
    const loadId = toast.loading("Archiving Dependent Relation...");
    try {
      const payload = {
        employee: selectedMasterId,
        ...familyFormData,
        additional_fields: JSON.stringify(familyFormData.additional_fields)
      };
      await api.post('patients/family-members/', payload);
      toast.success("Family Member Registered!", { id: loadId });
      setShowFamilyModal(false);
      setFamilyFormAttempted(false);
      setSelectedMasterId("");
      setFamilyMasterSearch("");
      fetchEmployeeMasters();
    } catch (err) {
      toast.error("Registration conflict. Verify details.", { id: loadId });
    }
  };

  const handleSelectMasterForFamily = (master) => {
    setSelectedMasterId(master.id);
    setFamilyMasterSearch(`${master.card_no} - ${master.name}`);
    setShowFamilyMasterDropdown(false);
    
    // Auto-calculate next suffix
    const nextSuffix = (master.family_members?.length || 0) + 1;
    setFamilyFormData(prev => ({ 
      ...prev, 
      card_no_suffix: `/${nextSuffix}` 
    }));
  };

  const openFamilyModal = () => {
    setFamilyMasterSearch("");
    setSelectedMasterId("");
    setFamilyFormData(prev => ({ 
      ...prev, 
      card_no_suffix: "",
      name: "",
      dob: "",
      gender: "MALE",
      relationship: "SPOUSE"
    }));
    setShowFamilyModal(true);
  };

  useEffect(() => {
    fetchProjects();
    fetchPatients();
    fetchEmployeeMasters();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const noModalsOpen = !showModal && !showTriageModal && !showAckModal && !showDownloadModal && !showMasterModal && !showFamilyModal && !showBulkEnrollModal;
      if (document.visibilityState === 'visible' && noModalsOpen) {
        fetchPatients(page, viewMode, projectFilter, searchQuery, true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [page, viewMode, projectFilter, searchQuery, showModal, showTriageModal, showAckModal, showDownloadModal, showMasterModal, showFamilyModal, showBulkEnrollModal]);

  useEffect(() => {
    if (projectFilter) {
      localStorage.setItem('activeProjectId', projectFilter);
    } else {
      localStorage.removeItem('activeProjectId');
    }
  }, [projectFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'employee') {
      // Small delay to ensure projects are loaded for the project-aware onboarding
      setTimeout(() => {
        openMasterOnboarding();
      }, 500);
    }
  }, [projects]);

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
    if (showFamilyModal) {
      fetchEmployeeMasters();
    }
  }, [showFamilyModal]);

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchPatients(1, viewMode, projectFilter, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [viewMode, searchQuery, projectFilter]);

  useEffect(() => {
    setVisibleRows(15);
  }, [patients, viewMode]);

  useEffect(() => {
    if (isLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleRows < filteredPatients.length) {
        setVisibleRows(prev => Math.min(prev + 15, filteredPatients.length));
      }
    }, { threshold: 0.1 });
    
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [visibleRows, filteredPatients.length, isLoading]);
  
  const fetchStats = async () => {
    try {
        const url_params = projectFilter ? `?project=${projectFilter}` : '';
        const res = await api.get(`patients/patients/stats/${url_params}`);
        setStats(res.data);
        setTabCounts({
            active: res.data.active_count || 0,
            scheduled: res.data.scheduled_count || 0,
            completed: res.data.completed_count || 0,
            all: res.data.total_registered || 0
        });
    } catch (err) {}
  };

  const fetchPatients = async (pageNum = 1, currentView = viewMode, proj = projectFilter, search = searchQuery, isBackground = false) => {
    const requestId = ++latestRequestRef.current;
    if (!isBackground) setIsLoading(true);
    try {
      const viewParam = currentView.toLowerCase();
      let url = `patients/patients/?page=${pageNum}&page_size=30&view=${viewParam}&search=${search}`;
      if (proj) url += `&project=${proj}`;
      const res = await api.get(url);
      
      // If a newer request has been started, ignore this response entirely!
      if (requestId !== latestRequestRef.current) {
          return;
      }
      
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
      if (requestId === latestRequestRef.current) {
          console.error(err);
          if (!isBackground) toast.error("Cloud synchronization delay. Please refresh.");
      }
    } finally {
      if (requestId === latestRequestRef.current) {
          if (!isBackground) setIsLoading(false);
      }
    }
  };

  const fetchEmployeeMasters = async () => {
    setIsMastersLoading(true);
    try {
      // Use the newly created all-masters endpoint for non-paginated access
      const res = await api.get(`patients/employee-masters/all-masters/`);
      setEmployeeMasters(res.data);
    } catch (err) {
      console.error("Failed to fetch masters");
    } finally {
      setIsMastersLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegistering) return;
    setFormAttempted(true);

    if (formData.phone && (formData.phone.length !== 10 || isNaN(formData.phone))) {
        toast.error("Mobile number must be exactly 10 digits");
        return;
    }

    setIsRegistering(true);
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
      
      const visitPayload = {
        patient: newPatient.id,
        reason: formData.reason || 'Initial Consultation',
        status: 'PENDING_VITALS'
      };
      const pId = newPatient.project || newPatient.project_id || formData.project;
      const matchedProj = projects.find(p => p.id == pId);
      if (matchedProj && matchedProj.allow_custom_visit_date && isLateEntry) {
        visitPayload.visit_date = new Date(visitDate).toISOString();
        visitPayload.late_entry_justification = lateEntryJustification;
      }
      await api.post('clinical/visits/', visitPayload);

      toast.success("Patient registered and queued for Vitals!", { id: loadingToast });
      setShowModal(false);
      resetForm();
      setFormAttempted(false);
      fetchPatients();
    } catch (err) {
      toast.error("Error registering patient", { id: loadingToast });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleInstantTriageSubmit = async (e) => {
    e.preventDefault();
    if (!triagePatient) return;
    if (isTriaging) return;

    setIsTriaging(true);
     const loadingToast = toast.loading('Initiating instant intake...');
    try {
      const payload = {
        patient: triagePatient.id,
        reason: triageReason || 'OPD Consultation',
        status: 'PENDING_VITALS'
      };
      const pId = triagePatient.project || triagePatient.project_id;
      const matchedProj = projects.find(p => p.id == pId);
      if (matchedProj && matchedProj.allow_custom_visit_date && isLateEntry) {
        payload.visit_date = new Date(visitDate).toISOString();
        payload.late_entry_justification = lateEntryJustification;
      }
      await api.post('clinical/visits/', payload);
      toast.success('Patient moved to Intake/Vitals queue!', { id: loadingToast });
      setShowTriageModal(false);
      setTriagePatient(null);
      setTriageReason('Routine Checkup');
      fetchPatients(1, viewMode, projectFilter);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start visit', { id: loadingToast });
    } finally {
      setIsTriaging(false);
    }
  };

  const handleEnablePortal = async (patientId) => {
    if (isEnablingPortal) return;
    setIsEnablingPortal(patientId);
    const loading = toast.loading("Provisioning Portal Credentials...");
    try {
      await api.post(`patients/patients/${patientId}/enable_portal/`);
      toast.success("Portal Access Enabled! Patient can now log in.", { id: loading });
      fetchPatients(page, viewMode, projectFilter);
    } catch (err) {
      toast.error(err.response?.data?.error || "Portal sync failed", { id: loading });
    } finally {
      setIsEnablingPortal(null);
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

  const initiateDownload = (patient) => {
    setSelectedPatientForDownload(patient);
    // Default to the total number of visits they have, but at least 1
    const totalV = patient.total_visits || 1;
    setDownloadVisitCount(totalV > 5 ? 5 : totalV); 
    setShowDownloadModal(true);
  };

  const downloadMasterReport = async (patient, limit = 5) => {
    setShowDownloadModal(false);
    const loading = toast.loading(`Generating clinical report for ${patient.first_name}...`);
    try {
      // 🚀 ELITE REDIRECTION: Using the Backend PDF API for 100% template synchronization
      const response = await api.get(`patients/patients/${patient.id}/download_report/?limit=${limit}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Clinical_Report_${patient.patient_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Elite Clinical Report Downloaded!", { id: loading });
    } catch (err) {
      console.error("PDF Export Failure:", err);
      toast.error("Failed to generate clinical report. Check server status.", { id: loading });
    }
  };

  const viewMasterReport = async (patient, limit = 5) => {
    setShowDownloadModal(false);
    const loading = toast.loading(`Preparing clinical report for ${patient.first_name}...`);
    try {
      const response = await api.get(`patients/patients/${patient.id}/download_report/?limit=${limit}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      toast.success("Elite Clinical Report Opened!", { id: loading });
    } catch (err) {
      console.error("PDF Preview Failure:", err);
      toast.error("Failed to generate clinical report. Check server status.", { id: loading });
    }
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

  const handleAckSubmit = async (e) => {
    e.preventDefault();
    if (!ackAppointment) return;

    setIsAcking(true);
    const loading = toast.loading('Allocating clinical slot range...');
    try {
      const appointment_date = `${ackForm.date}T${ackForm.startTime}:00`;
      const end_time = ackForm.endTime ? `${ackForm.date}T${ackForm.endTime}:00` : null;
      
      await api.post(`clinical/appointments/${ackAppointment.id}/confirm/`, {
        appointment_date,
        end_time
      });
      toast.success("Clinical Slot Allocated & Confirmed!", { id: loading });
      setShowAckModal(false);
      fetchPatients(1, viewMode, projectFilter);
    } catch (err) {
      toast.error("Failed to allocate slot. Check connectivity.", { id: loading });
    } finally {
      setIsAcking(false);
    }
  };

  const renderAckModal = () => {
    if (!showAckModal) return null;    return createPortal(
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '500px', borderRadius: '28px', padding: '0', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--primary)0d 100%)', padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--background)', color: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', border: '1px solid var(--border)' }}>
              <ShieldCheck size={24} />
            </div>
            <h2 style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.15rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Slot Allocation</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>Validate and confirm clinical encounter</p>
          </div>

          <form onSubmit={handleAckSubmit} style={{ padding: '1.5rem 2.5rem 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.75rem' }}>

              <div className="form-group">
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.625rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allocation Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required 
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', height: '42px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}
                  value={ackForm.date}
                  onChange={(e) => setAckForm({ ...ackForm, date: e.target.value })}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Time</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    required 
                    style={{ background: 'var(--background)', border: '1px solid var(--border)', height: '42px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}
                    value={ackForm.startTime}
                    onChange={(e) => setAckForm({ ...ackForm, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Time</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    required 
                    style={{ background: 'var(--background)', border: '1px solid var(--border)', height: '42px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}
                    value={ackForm.endTime}
                    onChange={(e) => setAckForm({ ...ackForm, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isAcking}
                style={{ padding: '0.875rem', borderRadius: '14px', fontWeight: 900, background: 'var(--primary)', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)', width: '100%' }}
              >
                {isAcking ? 'SYNCHRONIZING...' : 'CONFIRM ALLOCATION'}
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => setShowAckModal(false)}
                style={{ padding: '0.75rem', borderRadius: '14px', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', width: '100%', fontSize: '0.875rem' }}
              >
                Cancel Action
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  };

  const renderDownloadModal = () => {
    if (!showDownloadModal || !selectedPatientForDownload) return null;

    // Dynamically retrieve the currently selected project-specific theme colors for consistent page styling
    const primaryColor = currentProject?.primary_color || 'var(--primary)';
    const secondaryColor = currentProject?.secondary_color || 'var(--primary-dark)';
    const fullName = `${selectedPatientForDownload.first_name} ${selectedPatientForDownload.last_name || ''}`.trim();

    return createPortal(
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '450px', borderRadius: '28px', padding: '0', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ background: `linear-gradient(135deg, var(--background) 0%, ${primaryColor}0d 100%)`, padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--background)', color: primaryColor, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', border: '1px solid var(--border)' }}>
              <Download size={24} />
            </div>
            <h2 style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.15rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Export Scope</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>{fullName}'s Clinical Report</p>
          </div>

          <div style={{ padding: '1.5rem 2.5rem 2rem' }}>
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Include Recent Visits Count</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="number" 
                  min="1" 
                  max={selectedPatientForDownload.total_visits || 100}
                  className="form-control" 
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', height: '52px', fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', color: 'var(--text-main)' }}
                  value={downloadVisitCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const maxV = selectedPatientForDownload.total_visits || 100;
                    setDownloadVisitCount(val > maxV ? maxV : val);
                  }}
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontWeight: 600 }}>
                Patient has <span style={{ color: primaryColor }}>{selectedPatientForDownload.total_visits || 'multiple'}</span> total records.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => viewMasterReport(selectedPatientForDownload, downloadVisitCount)}
                  className="btn" 
                  style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', fontWeight: 900, border: `2px solid ${primaryColor}`, background: 'var(--surface)', color: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8125rem' }}
                >
                  <Eye size={16} /> VIEW PDF
                </button>
                <button 
                  onClick={() => downloadMasterReport(selectedPatientForDownload, downloadVisitCount)}
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '0.875rem', borderRadius: '14px', fontWeight: 900, background: primaryColor, border: 'none', boxShadow: `0 10px 15px -3px ${primaryColor}4d`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8125rem' }}
                >
                  <Download size={16} /> DOWNLOAD
                </button>
              </div>
              <button 
                type="button" 
                className="btn" 
                onClick={() => setShowDownloadModal(false)}
                style={{ padding: '0.75rem', borderRadius: '14px', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', width: '100%', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };



  const currentProject = projects.find(p => p.id == (projectFilter || user?.project));
  const activeRegProject = projects.find(p => p.id == (formData.project || user?.project));

  return (
    <div className="fade-in">
      {renderAckModal()}
      {renderDownloadModal()}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Patient Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Manage registration and records of all patients</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          
          {currentProject?.use_registry_for_personnel && (
            <>
              <button className="btn" onClick={openMasterOnboarding} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', border: 'none', color: '#fff', fontWeight: 800, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}>
                <ShieldCheck size={18} /> Employee Registry
              </button>
              <button className="btn" onClick={openFamilyModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff', fontWeight: 800, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                <Users size={18} /> Family Registry
              </button>
            </>
          )}

          <button className="btn" onClick={() => {
            resetForm();
            setVisitDate(getLocalISOString());
            setIsLateEntry(false);
            setLateEntryJustification('OFFLINE_CHARTING');
            setShowModal(true);
          }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', background: currentProject?.primary_color ? currentProject.primary_color : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', border: 'none', color: '#fff', fontWeight: 800, boxShadow: currentProject?.primary_color ? `0 4px 12px ${currentProject.primary_color}33` : '0 4px 12px var(--primary-shadow)' }}>
            <UserPlus size={18} /> Register New Patient
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem', overflowX: 'auto' }}>
        <button 
            onClick={() => { setSearchQuery(''); setViewMode('ACTIVE'); }}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'ACTIVE' ? `3px solid ${currentProject?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'ACTIVE' ? (currentProject?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            In-Clinic Queue ({tabCounts.active})
        </button>
        <button 
            onClick={() => { setSearchQuery(''); setViewMode('SCHEDULED'); }}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'SCHEDULED' ? `3px solid ${currentProject?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'SCHEDULED' ? (currentProject?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Planned Schedule ({tabCounts.scheduled})
        </button>
        <button 
            onClick={() => { setSearchQuery(''); setViewMode('COMPLETED'); }}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'COMPLETED' ? `3px solid ${currentProject?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'COMPLETED' ? (currentProject?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Closed Today ({tabCounts.completed})
        </button>
        <button 
            onClick={() => { setSearchQuery(''); setViewMode('ALL'); }}
            style={{ 
                padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                borderBottom: viewMode === 'ALL' ? `3px solid ${currentProject?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                fontWeight: 800, color: viewMode === 'ALL' ? (currentProject?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
            }}
        >
            Master Registry ({tabCounts.all})
        </button>
      </div>


      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search by Patient/Employee ID, Name, Mobile, Card No..." 
              style={{ paddingLeft: '2.75rem', paddingRight: '2.5rem', height: '44px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-main)', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <X
                size={16}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                onClick={() => {
                  setSearchQuery('');
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              />
            )}
          </div>
          {user?.role === 'ADMIN' && (
              <select 
                  className="form-control" 
                  style={{ flex: '1 1 200px', height: '44px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
              >
                  <option value="">Global Filter (All Projects)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          )}
          {/* Filter button removed */}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive" style={{ overflowX: 'auto', width: '100%' }}>
          <table>
            <thead style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient Details</th>
                <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project</th>
                <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gender/Age</th>
                <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact info</th>
                <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient Type</th>
                <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clinic Status</th>
                <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading records...</td></tr>
                ))
              ) : filteredPatients.slice(0, visibleRows).map(p => {
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
                            {p.is_employee_linked && (
                            <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '0.625rem', 
                                background: p.relationship === 'PRIMARY CARD HOLDER' ? '#dcfce7' : '#eff6ff', 
                                color: p.relationship === 'PRIMARY CARD HOLDER' ? '#166534' : '#1e40af', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                fontWeight: 800,
                                textTransform: 'uppercase'
                            }}>
                                {p.relationship === 'PRIMARY CARD HOLDER' ? 'PRIMARY' : 'DEPENDENT'}
                            </span>
                          )}
                          {p.is_active === false && (
                            <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '0.625rem', 
                                background: '#fee2e2', 
                                color: '#991b1b', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                fontWeight: 800,
                                textTransform: 'uppercase'
                            }}>
                                DEACTIVATED
                            </span>
                          )}
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
                                    APPT: {p.upcoming_appointment.formatted_time || p.upcoming_appointment.time}
                                </span>
                                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 700 }}>{p.upcoming_appointment.date}</span>
                                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{p.upcoming_appointment.reason}</span>
                                <div style={{ 
                                    fontSize: '0.625rem', 
                                    fontWeight: 700, 
                                    color: (p.upcoming_appointment.status === 'CONFIRMED' || p.upcoming_appointment.status === 'PATIENT_ACKNOWLEDGED') ? '#059669' : '#f59e0b', 
                                    background: (p.upcoming_appointment.status === 'CONFIRMED' || p.upcoming_appointment.status === 'PATIENT_ACKNOWLEDGED') ? 'rgba(5, 150, 105, 0.05)' : 'rgba(245, 158, 11, 0.05)', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px', 
                                    width: 'fit-content' 
                                }}>
                                    {p.upcoming_appointment.status === 'PATIENT_ACKNOWLEDGED' ? 'Verified Attendance' : p.upcoming_appointment.status === 'CONFIRMED' ? 'Slot Proposed' : 'Awaiting Slot Allocation'}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {p.visits && p.visits.length > 0 ? "Returned Patient" : "Registered Only"}
                                </span>
                                {p.upcoming_appointment && (
                                     <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800 }}>
                                            NEXT: {p.upcoming_appointment.formatted_time || p.upcoming_appointment.time}
                                        </span>
                                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            {p.upcoming_appointment.date}
                                        </span>
                                     </div>
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
                            <div style={{ 
                                background: p.current_visit.status === 'PENDING_PHARMACY' ? '#faf5ff' : '#f0f9ff', 
                                padding: '0.4rem 0.75rem', 
                                borderRadius: '10px', 
                                border: p.current_visit.status === 'PENDING_PHARMACY' ? '1px solid #e9d5ff' : '1px solid #bae6fd', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem' 
                            }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.current_visit.status === 'PENDING_PHARMACY' ? '#a855f7' : '#0ea5e9', animation: 'pulse 2s infinite' }}></div>
                                <span style={{ 
                                    fontSize: '0.625rem', 
                                    fontWeight: 800, 
                                    color: p.current_visit.status === 'PENDING_PHARMACY' ? '#7e22ce' : '#0369a1', 
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.025em'
                                }}>
                                    {p.current_visit.status === 'PENDING_PHARMACY' ? 'Awaiting Pharmacy' : 
                                     p.current_visit.status === 'PENDING_LAB' ? 'In Laboratory' :
                                     p.current_visit.status === 'PENDING_VITALS' ? 'In Clinic' :
                                     p.current_visit.status === 'PENDING_CONSULTATION' ? 'Initial Consult' :
                                     p.current_visit.status === 'FINAL_CONSULTATION' ? 'Final Review' : 'In Clinic'}
                                </span>
                            </div>
                        ) : viewMode === 'COMPLETED' ? (
                            <div style={{ background: '#f0fdf4', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Check size={12} color="#166534" />
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Visit Closed</span>
                            </div>
                        ) : viewMode === 'SCHEDULED' ? (
                            p.upcoming_appointment?.status === 'SCHEDULED' ? (
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => {
                                        setAckAppointment(p.upcoming_appointment);
                                        setAckForm({ 
                                            date: p.upcoming_appointment.date, 
                                            startTime: p.upcoming_appointment.time,
                                            endTime: p.upcoming_appointment.end_time_only || '' 
                                        });
                                        setShowAckModal(true);
                                    }}
                                >
                                    <ShieldCheck size={12} /> Acknowledge
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-primary" 
                                    style={{ 
                                        padding: '0.4rem 0.75rem', 
                                        fontSize: '0.75rem', 
                                        background: p.is_active === false ? '#94a3b8' : 'var(--primary)', 
                                        borderColor: p.is_active === false ? '#94a3b8' : 'var(--primary)',
                                        borderRadius: '10px', 
                                        opacity: (isCheckingIn === p.id || p.is_active === false) ? 0.5 : 1 
                                    }}
                                    disabled={isCheckingIn === p.id || p.is_active === false}
                                    onClick={async () => {
                                        const loading = toast.loading('Initiating Arrived Status...');
                                        setIsCheckingIn(p.id);
                                        try {
                                            if (p.upcoming_appointment?.id) {
                                                await api.post(`clinical/appointments/${p.upcoming_appointment.id}/check_in/`);
                                            } else {
                                                await api.post('clinical/visits/', { patient: p.id, reason: 'Scheduled Visit', status: 'PENDING_VITALS' });
                                            }
                                            toast.success("Patient Arrived & Registered!", { id: loading });
                                            fetchPatients();
                                        } catch (e) { 
                                            toast.error(e.response?.data?.error || "Check-in sync failed", { id: loading }); 
                                        } finally {
                                            setIsCheckingIn(null);
                                        }
                                    }}
                                >
                                    <Check size={12} /> {isCheckingIn === p.id ? 'Starting...' : p.is_active === false ? 'Deactivated' : 'Start Visit'}
                                </button>
                            )
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                style={{ 
                                    padding: '0.4rem 0.75rem', 
                                    fontSize: '0.75rem', 
                                    background: p.is_active === false ? '#94a3b8' : '#f59e0b', 
                                    borderColor: p.is_active === false ? '#94a3b8' : '#f59e0b', 
                                    borderRadius: '10px',
                                    opacity: p.is_active === false ? 0.5 : 1
                                }}
                                disabled={p.is_active === false}
                                onClick={() => {
                                    setTriagePatient(p);
                                    setTriageReason('Routine Checkup');
                                    setVisitDate(getLocalISOString());
                                    setIsLateEntry(false);
                                    setLateEntryJustification('OFFLINE_CHARTING');
                                    setShowTriageModal(true);
                                }}
                            >
                                <Activity size={12} /> {p.is_active === false ? 'Deactivated' : 'Intake'}
                            </button>
                        )}
                        {(viewMode === 'ALL' || viewMode === 'COMPLETED') && (
                            <>
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: '10px' }}
                                    onClick={() => initiateDownload(p)}
                                    title="View Case Summary PDF"
                                >
                                    <Eye size={16} color="var(--primary)" />
                                </button>
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: '10px' }}
                                    onClick={() => initiateDownload(p)}
                                    title="Download Case Summary PDF"
                                >
                                    <Download size={16} color="var(--primary)" />
                                </button>
                            </>
                        )}
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
          {/* Lazy Loading Sentinel */}
          {!isLoading && visibleRows < filteredPatients.length && (
            <div 
              ref={sentinelRef} 
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '1.5rem', 
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                gap: '0.5rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}
            >
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading more records...
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing <span style={{ color: 'var(--primary)' }}>{filteredPatients.length}</span> of {totalCount} patients
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                    className="btn btn-secondary" 
                    disabled={page === 1}
                    onClick={() => fetchPatients(page - 1)}
                    style={{ padding: '0.4rem', borderRadius: '8px', opacity: page === 1 ? 0.5 : 1 }}
                >
                    <ChevronLeft size={18} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {(() => {
                        const totalPages = Math.ceil(totalCount / 30);
                        if (totalPages <= 1) return null;

                        const buttons = [];
                        const maxVisiblePages = 5;
                        
                        // Always show page 1
                        buttons.push(
                            <button 
                                key={1} 
                                onClick={() => fetchPatients(1)}
                                style={{ 
                                    width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                    background: page === 1 ? 'var(--primary)' : 'transparent',
                                    color: page === 1 ? 'white' : 'var(--text-muted)',
                                    fontWeight: 700, cursor: 'pointer', transition: '0.3s'
                                }}
                            >
                                1
                            </button>
                        );

                        let startPage = Math.max(2, page - 1);
                        let endPage = Math.min(totalPages - 1, page + 1);

                        if (page <= 3) {
                            endPage = Math.min(totalPages - 1, maxVisiblePages - 1);
                        }
                        if (page >= totalPages - 2) {
                            startPage = Math.max(2, totalPages - maxVisiblePages + 2);
                        }

                        if (startPage > 2) {
                            buttons.push(<span key="ellipsis1" style={{ color: 'var(--text-muted)', padding: '0 4px', fontWeight: 700 }}>...</span>);
                        }

                        for (let i = startPage; i <= endPage; i++) {
                            if (i > 1 && i < totalPages) {
                                buttons.push(
                                    <button 
                                        key={i} 
                                        onClick={() => fetchPatients(i)}
                                        style={{ 
                                            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                            background: page === i ? 'var(--primary)' : 'transparent',
                                            color: page === i ? 'white' : 'var(--text-muted)',
                                            fontWeight: 700, cursor: 'pointer', transition: '0.3s'
                                        }}
                                    >
                                        {i}
                                    </button>
                                );
                            }
                        }

                        if (endPage < totalPages - 1) {
                            buttons.push(<span key="ellipsis2" style={{ color: 'var(--text-muted)', padding: '0 4px', fontWeight: 700 }}>...</span>);
                        }

                        // Always show last page
                        if (totalPages > 1) {
                            buttons.push(
                                <button 
                                    key={totalPages} 
                                    onClick={() => fetchPatients(totalPages)}
                                    style={{ 
                                        width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                        background: page === totalPages ? 'var(--primary)' : 'transparent',
                                        color: page === totalPages ? 'white' : 'var(--text-muted)',
                                        fontWeight: 700, cursor: 'pointer', transition: '0.3s'
                                    }}
                                >
                                    {totalPages}
                                </button>
                            );
                        }

                        return buttons;
                    })()}
                </div>
                <button 
                    className="btn btn-secondary" 
                    disabled={page >= Math.ceil(totalCount / 30)}
                    onClick={() => fetchPatients(page + 1)}
                    style={{ padding: '0.4rem', borderRadius: '8px', opacity: page >= Math.ceil(totalCount / 30) ? 0.5 : 1 }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && createPortal(
        <div style={{
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--glass-bg)', 
          backdropFilter: 'blur(12px)',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-start',
          zIndex: 10000, 
          padding: '80px 1rem 60px 1rem',
          overflowY: 'auto'
        }}>
          <div className="fade-in card" style={{ 
            width: '100%', 
            maxWidth: '680px', 
            padding: 0, 
            borderRadius: '32px', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: '1.5rem 2rem', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ 
                    padding: '0.75rem', 
                    background: activeRegProject?.primary_color ? activeRegProject.primary_color : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', 
                    borderRadius: '16px', 
                    boxShadow: activeRegProject?.primary_color ? `0 4px 12px ${activeRegProject.primary_color}33` : '0 4px 12px var(--primary-shadow)' 
                }}>
                  <UserPlus size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Patient Registration</h2>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Fill in the details to create a new UHID</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                style={{ 
                    border: 'none', 
                    background: 'var(--background)', 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                
                {/* Visit Information */}
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: activeRegProject?.primary_color || '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Engagement</p>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--background)', padding: '4px', borderRadius: '12px' }}>
                        {(!formData.project || (projects.find(p => p.id == formData.project)?.category_mappings?.some(m => m.category === 'GENERAL')) || projects.find(p => p.id == formData.project)?.use_registry_for_personnel) && (
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, is_employee_linked: false})}
                            style={{ 
                                padding: '6px 20px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                background: !formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                color: !formData.is_employee_linked ? (activeRegProject?.primary_color || 'var(--primary)') : '#64748b',
                                boxShadow: !formData.is_employee_linked ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', transition: '0.3s'
                            }}
                        >General</button>
                        )}
                        {(user?.role === 'ADMIN' || !formData.project || projects.find(p => p.id == formData.project)?.use_registry_for_personnel) && (
                        <button 
                             type="button"
                             onClick={() => setFormData({...formData, is_employee_linked: true})}
                             style={{ 
                                 padding: '6px 20px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                 background: formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                 color: formData.is_employee_linked ? (activeRegProject?.primary_color || 'var(--primary)') : '#64748b',
                                 boxShadow: formData.is_employee_linked ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                 cursor: 'pointer', transition: '0.3s'
                             }}
                        >Employee/Family</button>
                        )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><Activity size={14} /> Reason for Visit / Chief Complaint <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                        required 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
                        value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="e.g. Fever and body pain, Regular followup..." 
                    />
                    {formAttempted && !formData.reason && <p style={{ color: '#ef4444', fontSize: '10px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required Field</p>}
                  </div>
                </div>

                {formData.is_employee_linked && (
                    <div style={{ gridColumn: 'span 2', background: 'var(--background)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 900, color: activeRegProject?.primary_color || 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Link Employee Record</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Search Employee (Name/Card No)</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
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
                                                background: 'white', border: '1px solid var(--border)', borderRadius: '16px',
                                                maxHeight: '300px', overflowY: 'auto', zIndex: 1000,
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', marginTop: '8px'
                                            }}>
                                                {isMastersLoading ? (
                                                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                        <Loader2 size={16} className="spin" /> Searching Registry...
                                                    </div>
                                                ) : employeeMasters.filter(emp => 
                                                    emp.is_active && (
                                                        emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                                                        emp.card_no.includes(employeeSearchTerm)
                                                    )
                                                ).length === 0 ? (
                                                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matching employees found</div>
                                                ) : (
                                                    employeeMasters.filter(emp => 
                                                        emp.is_active && (
                                                            emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                                                            emp.card_no.includes(employeeSearchTerm)
                                                        )
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
                                                                padding: '0.875rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                                                fontSize: '0.875rem'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <div style={{ fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.01em' }}>{emp.card_no}</div>
                                                            <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{emp.name}</div>
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
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Select Family Member</label>
                                    <CustomSelect
                                        options={[
                                            { value: "", label: "Self (Primary)" },
                                            ...(employeeMasters.find(emp => emp.id == formData.employee_master)?.family_members.map(fam => ({
                                                value: String(fam.id),
                                                label: `${fam.relationship}: ${fam.name}`
                                            })) || [])
                                        ]}
                                        value={String(formData.family_member || "")}
                                        primaryColor={activeRegProject?.primary_color}
                                        onChange={(val) => {
                                            if (!val) {
                                                setFormData({ ...formData, family_member: "" });
                                                return;
                                            }
                                            const emp = employeeMasters.find(em => em.id === formData.employee_master);
                                            const fam = emp.family_members.find(f => f.id === parseInt(val));
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
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!formData.is_employee_linked && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Registration Project <span style={{ color: '#ef4444' }}>*</span></label>
                    {user?.project ? (
                        <div style={{ 
                            padding: '1rem 1.25rem', 
                            background: '#f8fafc', 
                            border: '1.5px solid #e2e8f0', 
                            borderRadius: '16px', 
                            color: '#1e293b', 
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <ShieldCheck size={18} color="#6366f1" />
                            {projects.find(p => p.id == user.project)?.name || 'Mapped Project'}
                            <span style={{ fontSize: '0.625rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', marginLeft: 'auto', fontWeight: 900 }}>LOCKED</span>
                        </div>
                    ) : (
                        <CustomSelect
                            options={[
                                { value: "", label: "-- Select Project --" },
                                ...(projects && Array.isArray(projects) ? projects.filter(p => p.category_mappings?.some(m => m.category === 'GENERAL')).map(p => ({
                                    value: String(p.id),
                                    label: p.name
                                })) : [])
                            ]}
                            value={formData.project}
                            primaryColor={activeRegProject?.primary_color}
                            onChange={val => setFormData({...formData, project: val})}
                        />
                    )}
                  </div>
                )}

                {/* Personal Information */}
                <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: activeRegProject?.primary_color || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Basic Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><User size={14} /> First Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        required 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                        value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} placeholder="e.g. John" 
                      />
                      {formAttempted && !formData.first_name && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        required 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                        value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} placeholder="e.g. Doe" 
                      />
                      {formAttempted && !formData.last_name && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 900, color: activeRegProject?.primary_color || 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Identity Verification (Primary ID)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><Fingerprint size={14} /> ID Proof Type *</label>
                            <CustomSelect
                                options={[
                                    { value: "AADHAAR", label: "Aadhaar Card" },
                                    { value: "VOTER_ID", label: "Voter ID" },
                                    { value: "DRIVING_LICENCE", label: "Driving Licence" },
                                    { value: "PASSPORT", label: "Passport" },
                                    { value: "CARD_NO", label: "Card No" }
                                ]}
                                value={formData.id_proof_type}
                                primaryColor={activeRegProject?.primary_color}
                                onChange={val => setFormData({...formData, id_proof_type: val})}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>ID proof Number <span style={{ color: '#ef4444' }}>*</span></label>
                            <input 
                                required 
                                className="form-control"
                                style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
                                value={formData.id_proof_number} onChange={e => setFormData({...formData, id_proof_number: e.target.value})} placeholder="Enter Aadhaar/ID number" 
                            />
                            {formAttempted && !formData.id_proof_number && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required Field</p>}
                        </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><Calendar size={14} /> Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" required max={new Date().toLocaleDateString('en-CA')}
                    value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} 
                    className="form-control" style={{ height: '52px', borderRadius: '16px', borderColor: (formAttempted && !formData.dob) ? '#ef4444' : '#e2e8f0' }} />
                  {formAttempted && !formData.dob && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <CustomSelect
                      options={[
                          { value: "", label: "-- Select --" },
                          { value: "MALE", label: "Male" },
                          { value: "FEMALE", label: "Female" },
                          { value: "OTHER", label: "Other" }
                      ]}
                      value={formData.gender}
                      primaryColor={activeRegProject?.primary_color}
                      onChange={val => setFormData({...formData, gender: val})}
                  />
                  {formAttempted && !formData.gender && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                {/* Contact Information */}
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: activeRegProject?.primary_color || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Contact & Address</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><Phone size={14} /> Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        required type="tel" maxLength={10} 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} placeholder="10-digit number" 
                      />
                      {formAttempted && (!formData.phone || formData.phone.length !== 10) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Invalid / Required (10 Digits)</p>}
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Patient Type</label>
                      <CustomSelect
                          options={[
                              { value: "OPD", label: "Outpatient (OPD)" },
                              { value: "IPD", label: "Inpatient (IPD)" },
                              { value: "Emergency", label: "Emergency" },
                              { value: "Review", label: "Review" }
                          ]}
                          value={formData.patient_type}
                          primaryColor={activeRegProject?.primary_color}
                          onChange={val => setFormData({...formData, patient_type: val})}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><MapPin size={14} /> Local Address *</label>
                  <textarea 
                    rows="2" required 
                    className="form-control"
                    style={{ height: '80px', borderRadius: '16px', padding: '1rem' }}
                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="House No, Street, Landmark..."
                  ></textarea>
                </div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>ABHA ID (Optional)</label>
                    <input 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                        value={formData.abha_id} onChange={e => setFormData({...formData, abha_id: e.target.value})} placeholder="14-digit ABHA Number" 
                    />
                </div>
              
                {activeRegProject?.allow_custom_visit_date && (
                  <div style={{ gridColumn: 'span 2', marginTop: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: '#334155' }}>
                      <input 
                        type="checkbox" 
                        checked={isLateEntry} 
                        onChange={(e) => setIsLateEntry(e.target.checked)} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Late Entry / Backdated Visit
                    </label>
                    
                    {isLateEntry && (
                      <div className="fade-in" style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>
                            Visit Date & Time
                          </label>
                          <input 
                            type="datetime-local" 
                            className="form-control" 
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                            max={getLocalISOString()}
                            required
                            style={{ height: '48px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-main)', fontWeight: 700 }}
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>
                            Late Entry Justification
                          </label>
                          <CustomSelect
                            options={[
                                { value: "OFFLINE_CHARTING", label: "Offline/Paper Charting Reconciliation" },
                                { value: "DELAYED_DOCUMENTATION", label: "Delayed Administrative Documentation" },
                                { value: "EMERGENCY_BACKLOG", label: "Emergency Backlog Prioritization" },
                                { value: "SYSTEM_DOWNTIME", label: "System/Network Downtime Recovery" }
                            ]}
                            value={lateEntryJustification}
                            primaryColor={activeRegProject?.primary_color}
                            onChange={val => setLateEntryJustification(val)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ 
                display: 'flex', justifyContent: 'flex-end', gap: '1rem', 
                marginTop: '3.5rem'
              }}>
                <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowModal(false)} 
                    style={{ padding: '0.75rem 2rem', borderRadius: '16px', fontWeight: 800 }}
                >Cancel</button>
                <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ 
                        padding: '0.75rem 2.5rem', 
                        borderRadius: '16px', 
                        fontWeight: 800,
                        background: activeRegProject?.primary_color ? activeRegProject.primary_color : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                        border: 'none',
                        boxShadow: activeRegProject?.primary_color ? `0 4px 12px ${activeRegProject.primary_color}33` : '0 4px 12px var(--primary-shadow)',
                        opacity: isRegistering ? 0.5 : 1
                    }}
                    disabled={isRegistering}
                >{isRegistering ? 'Registering...' : 'Complete Registration'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* INSTANT INTAKE MODAL FOR EXISTING PATIENTS */}
      {showTriageModal && triagePatient && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="fade-in" style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.3)' }}>
                  <Activity size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 950, letterSpacing: '-0.02em', color: '#1e293b' }}>Confirm Intake</h2>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Create new visit for returning patient</p>
                </div>
              </div>
              <button onClick={() => setShowTriageModal(false)} style={{ border: 'none', background: '#f1f5f9', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#4f46e5', fontSize: '1rem' }}>
                    {triagePatient.first_name[0]}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>{triagePatient.first_name} {triagePatient.last_name}</h3>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>UHID: {triagePatient.patient_id} • {triagePatient.phone}</p>
                  </div>
               </div>
               <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  Linked Project: {triagePatient.project_name || 'General Registry'}
               </div>
            </div>

            <form onSubmit={handleInstantTriageSubmit}>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={14} /> Reason for Visit <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  className="form-control"
                  style={{ height: '54px', borderRadius: '16px', background: 'var(--background)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.875rem' }}
                  value={triageReason}
                  onChange={(e) => setTriageReason(e.target.value)}
                  required
                >
                  <option value="Routine Checkup">Routine Checkup</option>
                  <option value="Follow-up">Follow-up Visit</option>
                  <option value="OPD Consultation">OPD Consultation</option>
                  <option value="Emergency Care">Emergency Care</option>
                  <option value="Diagnostic Review">Diagnostic Review</option>
                </select>
              </div>
              
              {projects.find(p => p.id == (triagePatient.project || triagePatient.project_id))?.allow_custom_visit_date && (
                <div style={{ marginBottom: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: '#334155' }}>
                    <input 
                      type="checkbox" 
                      checked={isLateEntry} 
                      onChange={(e) => setIsLateEntry(e.target.checked)} 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Late Entry / Backdated Visit
                  </label>
                  
                  {isLateEntry && (
                    <div className="fade-in" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>
                          Visit Date & Time
                        </label>
                        <input 
                          type="datetime-local" 
                          className="form-control" 
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          max={getLocalISOString()}
                          required
                          style={{ height: '48px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-main)', fontWeight: 700 }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>
                          Late Entry Justification
                        </label>
                        <select 
                          className="form-control"
                          value={lateEntryJustification}
                          onChange={(e) => setLateEntryJustification(e.target.value)}
                          required
                          style={{ height: '48px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-main)', fontWeight: 700 }}
                        >
                          <option value="OFFLINE_CHARTING">Offline/Paper Charting Reconciliation</option>
                          <option value="DELAYED_DOCUMENTATION">Delayed Administrative Documentation</option>
                          <option value="EMERGENCY_BACKLOG">Emergency Backlog Prioritization</option>
                          <option value="SYSTEM_DOWNTIME">System/Network Downtime Recovery</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '1rem', borderRadius: '18px', fontWeight: 900, letterSpacing: '0.01em',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', border: 'none',
                    boxShadow: '0 10px 15px -3px var(--primary-shadow)',
                    opacity: isTriaging ? 0.5 : 1
                  }}
                  disabled={isTriaging}
                >
                  {isTriaging ? 'Starting...' : 'START CLINICAL VISIT'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTriageModal(false)}
                  style={{ padding: '0.875rem', borderRadius: '18px', fontWeight: 800, border: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  Back to Registry
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* MODAL 2: Register in Masters (Ported for AP-GENCO Access) */}
      {showMasterModal && createPortal(
        <div className="modal-overlay" style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", zIndex: 100000 }}>
          <div className="card fade-in" style={{ width: "100%", maxWidth: "600px", padding: 0, borderRadius: "32px", background: "white", boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', borderRadius: '16px', boxShadow: '0 4px 12px var(--primary-shadow)' }}>
                  <ShieldCheck size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Register in Masters</h2>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Clinical Registry & Personnel Onboarding</p>
                </div>
              </div>
              <button onClick={() => setShowMasterModal(false)} style={{ border: "none", background: "#f1f5f9", width: "36px", height: "36px", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleMasterOnboardingSubmit} style={{ padding: "2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <div className="form-group">
                  <label>Card No *</label>
                  <input required readOnly value={masterFormData.card_no} placeholder="Auto-generating..." className="form-control" style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }} />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input required value={masterFormData.name} onChange={(e) => setMasterFormData({ ...masterFormData, name: e.target.value })} placeholder="e.g. P. BABU RAO" className="form-control" />
                </div>
                <div className="form-group">
                  <label>DOB *</label>
                  <input type="date" required max={new Date().toLocaleDateString('en-CA')} value={masterFormData.dob} onChange={(e) => setMasterFormData({ ...masterFormData, dob: e.target.value })} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select value={masterFormData.gender} onChange={(e) => setMasterFormData({ ...masterFormData, gender: e.target.value })} className="form-control">
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Mobile No *</label>
                  <input required value={masterFormData.mobile_no} onChange={(e) => { const val = e.target.value.replace(/\D/g, ""); if (val.length <= 10) setMasterFormData({ ...masterFormData, mobile_no: val }); }} className="form-control" placeholder="10-digit number" />
                </div>
                <div className="form-group">
                  <label>Aadhar No</label>
                  <input value={masterFormData.aadhar_no} onChange={(e) => { const val = e.target.value.replace(/\D/g, ""); if (val.length <= 12) setMasterFormData({ ...masterFormData, aadhar_no: val }); }} className="form-control" placeholder="12-digit number" />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>Home Address</label>
                  <textarea value={masterFormData.address} onChange={(e) => setMasterFormData({ ...masterFormData, address: e.target.value })} className="form-control" placeholder="Village/City, District, State" style={{ height: '80px', paddingTop: '12px' }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMasterModal(false)} style={{ background: '#f1f5f9' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ background: activeRegProject?.primary_color || '#1e1b4b', color: 'white', padding: '0.75rem 2.5rem' }}>Submit</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Add Family Member (Ported for AP-GENCO Access) */}
      {showFamilyModal && createPortal(
        <div className="modal-overlay" style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", zIndex: 100000 }}>
          <div className="card fade-in" style={{ width: "100%", maxWidth: "600px", padding: 0, borderRadius: "32px", background: "white", boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                  <Users size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Add Family Member</h2>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Personal Dependants & Relations</p>
                </div>
              </div>
              <button onClick={() => setShowFamilyModal(false)} style={{ border: "none", background: "#f1f5f9", width: "36px", height: "36px", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleFamilyRegistrySubmit} style={{ padding: "2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <div className="form-group" style={{ gridColumn: "span 2", position: 'relative' }}>
                  <label>Select Employee *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Type name or Card No..." 
                      value={familyMasterSearch} 
                      onFocus={() => setShowFamilyMasterDropdown(true)}
                      onBlur={() => setTimeout(() => setShowFamilyMasterDropdown(false), 250)}
                      onChange={(e) => {
                        setFamilyMasterSearch(e.target.value);
                        setSelectedMasterId(""); 
                        setShowFamilyMasterDropdown(true);
                      }}
                      style={{ 
                        height: '52px', borderRadius: '16px', paddingRight: '40px',
                        borderColor: selectedMasterId ? '#10b981' : 'var(--border)',
                        background: selectedMasterId ? '#f0fdf4' : 'white',
                        fontWeight: selectedMasterId ? 700 : 500,
                        transition: '0.3s'
                      }}
                    />
                    {selectedMasterId ? (
                        <Check size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                    ) : (
                        <Search size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    )}
                  </div>
                  {showFamilyMasterDropdown && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                      background: 'white', borderRadius: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                      maxHeight: '220px', overflowY: 'auto', marginTop: '8px', border: '1px solid #e2e8f0'
                    }}>
                      {isMastersLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            <Loader2 size={24} className="spin-anim" style={{ margin: '0 auto', display: 'block' }} />
                            <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Synchronizing Registry...</p>
                        </div>
                      ) : (
                        <>
                          {employeeMasters
                            .filter(m => 
                              `${m.card_no} - ${m.name}`.toLowerCase().includes(familyMasterSearch.toLowerCase())
                            )
                            .map(m => (
                              <div 
                                key={m.id} 
                                onClick={() => handleSelectMasterForFamily(m)}
                                style={{ 
                                  padding: '0.875rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', 
                                  fontWeight: 700, fontSize: '0.875rem', color: '#1e293b',
                                  transition: '0.2s',
                                  background: selectedMasterId === m.id ? '#f0fdf4' : 'transparent'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.target.style.background = selectedMasterId === m.id ? '#f0fdf4' : 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Database size={14} color={selectedMasterId === m.id ? "#10b981" : "#6366f1"} />
                                    <span>{m.card_no} - {m.name}</span>
                                </div>
                              </div>
                            ))}
                          {employeeMasters.filter(m => `${m.card_no} - ${m.name}`.toLowerCase().includes(familyMasterSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>
                                <Info size={20} style={{ marginBottom: '0.5rem', display: 'block', margin: '0 auto' }} />
                                No employees matched your search
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input required value={familyFormData.name} onChange={(e) => setFamilyFormData({ ...familyFormData, name: e.target.value })} placeholder="e.g. Baby.P. SONITHA" className="form-control" />
                </div>
                <div className="form-group">
                  <label>DOB *</label>
                  <input type="date" required max={new Date().toLocaleDateString('en-CA')} value={familyFormData.dob} onChange={(e) => setFamilyFormData({ ...familyFormData, dob: e.target.value })} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Relationship *</label>
                  <select value={familyFormData.relationship} onChange={(e) => setFamilyFormData({ ...familyFormData, relationship: e.target.value })} className="form-control">
                    <option value="SPOUSE">Spouse</option>
                    <option value="WIFE">Wife</option>
                    <option value="HUSBAND">Husband</option>
                    <option value="SON">Son</option>
                    <option value="DAUGHTER">Daughter</option>
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="BROTHER">Brother</option>
                    <option value="SISTER">Sister</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select value={familyFormData.gender} onChange={(e) => setFamilyFormData({ ...familyFormData, gender: e.target.value })} className="form-control">
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFamilyModal(false)} style={{ background: '#f1f5f9' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: activeRegProject?.primary_color || '#4f46e5', color: 'white', padding: '0.75rem 2rem' }}>Save Family Member</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          background: white;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Bulk Enrollment Modal */}
      {showBulkEnrollModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 100001 }}>
          <div className="modal-content" style={{ maxWidth: '500px', borderRadius: '32px' }}>
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', borderRadius: '12px' }}>
                  <ShieldCheck size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Bulk Activation</h2>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Link existing Master records & their families to this project</p>
                </div>
              </div>

              {bulkEnrollStatus.isProcessing ? (
                <div style={{ padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                      {bulkEnrollStatus.completed ? 'Activation Finished!' : 'Activating & Syncing Records...'}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--primary)' }}>
                      {Math.round((bulkEnrollStatus.current / bulkEnrollStatus.total) * 100)}%
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                    <div style={{ 
                      width: `${(bulkEnrollStatus.current / bulkEnrollStatus.total) * 100}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, var(--primary) 0%, #4f46e5 100%)', 
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Total</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>{bulkEnrollStatus.total}</div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.05)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', marginBottom: '4px' }}>Linked</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a' }}>{bulkEnrollStatus.success}</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Failed</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>{bulkEnrollStatus.errors}</div>
                    </div>
                  </div>

                  {bulkEnrollStatus.failedRecords.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>
                          Encountered Errors ({bulkEnrollStatus.failedRecords.length})
                        </span>
                        {bulkEnrollStatus.completed && (
                          <button 
                            onClick={downloadFailedEnrollmentCards}
                            style={{ 
                              background: 'none', border: 'none', color: '#dc2626', fontSize: '0.7rem', 
                              fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(220, 38, 38, 0.05)'
                            }}
                          >
                            <Download size={10} /> Download Failed CSV
                          </button>
                        )}
                      </div>
                      <div style={{ 
                        maxHeight: '120px', overflowY: 'auto', background: '#fef2f2', 
                        borderRadius: '12px', padding: '0.75rem', fontSize: '0.75rem', color: '#991b1b',
                        border: '1px solid rgba(239, 68, 68, 0.1)'
                      }}>
                        {bulkEnrollStatus.failedRecords.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(239, 68, 68, 0.05)' }}>
                            <span style={{ fontWeight: 800 }}>Card: {item.card_no}</span>
                            <span style={{ opacity: 0.85 }}>{item.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkEnrollStatus.completed && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        setShowBulkEnrollModal(false);
                        setBulkEnrollData('');
                        setBulkEnrollStatus(prev => ({ ...prev, isProcessing: false, completed: false }));
                      }}
                      style={{ width: '100%', padding: '1rem', borderRadius: '14px', fontWeight: 900, background: 'var(--primary)', border: 'none', color: 'white' }}
                    >
                      Done & Close
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                        Paste Card Numbers
                      </label>
                      <label style={{ 
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', 
                        background: 'rgba(99, 102, 241, 0.05)', padding: '4px 10px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Download size={12} /> Upload CSV
                        <input 
                          type="file" 
                          accept=".csv,.txt" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const text = event.target.result;
                                const numbers = text.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
                                setBulkEnrollData(numbers.join('\n'));
                                toast.success(`Extracted ${numbers.length} card numbers from file!`);
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <textarea 
                      className="form-control" 
                      rows="8"
                      placeholder="e.g.&#10;2254&#10;2255&#10;2256"
                      style={{ background: '#f8fafc', borderRadius: '16px', fontSize: '1rem', padding: '1rem', fontFamily: 'monospace' }}
                      value={bulkEnrollData}
                      onChange={(e) => setBulkEnrollData(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button 
                      className="btn btn-primary"
                      disabled={isBulkEnrolling}
                      onClick={handleBulkEnrollSubmit}
                      style={{ padding: '1rem', borderRadius: '14px', fontWeight: 900, background: 'var(--primary)', border: 'none', color: 'white' }}
                    >
                      {isBulkEnrolling ? 'ACTIVATING...' : 'ACTIVATE & SYNC RECORDS'}
                    </button>
                    <button 
                      className="btn" 
                      onClick={() => setShowBulkEnrollModal(false)}
                      style={{ padding: '0.75rem', fontWeight: 800, color: '#64748b' }}
                    >Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Premium Hub-Style Metric Components 
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
