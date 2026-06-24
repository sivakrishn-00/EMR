import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Stethoscope, 
  ClipboardList, 
  Search, 
  Clock, 
  ArrowRight, 
  X, 
  History, 
  FlaskConical, 
  Pill, 
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Pencil,
  FileText,
  Calendar,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  User,
  Phone,
  Hash,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Sun,
  RefreshCw,
  Image,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Indents from './Indents';

// Reusable Custom Select Dropdown for enhanced UI aesthetics
const CustomSelect = ({ options, value, onChange, placeholder = 'Select...', style = {}, primaryColor, height = '52px', borderRadius = '16px' }) => {
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
          height: height,
          borderRadius: borderRadius,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: style.padding || '0 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: style.fontSize || '0.875rem',
          fontWeight: style.fontWeight || 'normal',
          color: 'var(--text-main)',
          textAlign: 'left',
          boxShadow: isOpen ? `0 0 0 3px ${(primaryColor || 'var(--primary)')}20` : 'none',
          borderColor: isOpen ? (primaryColor || 'var(--primary)') : 'var(--border)',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} style={{ 
          color: 'var(--text-muted)', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          marginLeft: '4px',
          flexShrink: 0
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
          borderRadius: borderRadius,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '250px',
          overflowY: 'auto',
          padding: '6px',
          animation: 'fadeIn 0.15s ease'
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: style.fontSize || '0.875rem',
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
              {value === opt.value && <Check size={14} color={primaryColor || 'var(--primary)'} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const Clinical = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isExamineRoute = location.pathname === '/consultations/examine';
  const [projectConfig, setProjectConfig] = useState(null);
  const [visitsReady, setVisitsReady] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consultData, setConsultData] = useState({
    chief_complaint: '', 
    diagnosis: '', 
    plan: '',
    next_step: '',
    lab_investigations: [],
    medications: []
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'visit_date', direction: 'asc' });

  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '1-0-1', duration: '', total_units: 1, timing: 'After Food', item_code: '', item_group: '' });
  const [pharmacyInventory, setPharmacyInventory] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [totalInventoryCount, setTotalInventoryCount] = useState(0);
  
  const [labMasters, setLabMasters] = useState([]);
  const [registryTypes, setRegistryTypes] = useState([]);
  const [searchLab, setSearchLab] = useState("");
  const [drugSearch, setDrugSearch] = useState("");
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);

  const getDrugGroup = (d) => {
    if (!d) return 'General';
    return d.item_group || d.category || d.additional_fields?.item_group || d.additional_fields?.category || 'General';
  };
  const [showLabSearch, setShowLabSearch] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [showHistoryDashboard, setShowHistoryDashboard] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [detailedVisit, setDetailedVisit] = useState(null);
  const [isSavingConsult, setIsSavingConsult] = useState(false);
  
  // Lightbox Image Viewer state
  const [lightboxImage, setLightboxImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [activeSubTab, setActiveSubTab] = useState(() => {
    const stateTab = location.state?.activeTab || location.state?.activeSubTab;
    if (stateTab === 'approval') return 'approval';
    return 'queue';
  });
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const fetchPendingApprovalsCount = async () => {
    try {
      const projectId = user?.project?.id || user?.project;
      const projectQuery = projectId ? `?project=${projectId}` : '';
      const res = await api.get(`pharmacy/indents/${projectQuery}`);
      const indents = res.data.results || res.data || [];
      const count = indents.filter(i => i.status === 'PENDING_APPROVAL').length;
      setPendingApprovalsCount(count);
    } catch (e) {
      console.error("Failed to fetch pending approvals count:", e);
    }
  };

  useEffect(() => {
    fetchVisitsToSee();
    fetchRegistryTypes();
    fetchPendingApprovalsCount();
  }, []);

  useEffect(() => {
    if (isExamineRoute && !selectedVisit) {
      navigate('/consultations', { replace: true });
    }
  }, [isExamineRoute, selectedVisit, navigate]);

  useEffect(() => {
    if (location.pathname === '/consultations') {
      setSelectedVisit(null);
      fetchVisitsToSee(1, searchTerm);
      fetchPendingApprovalsCount();
    }
  }, [location.pathname, user]);

  useEffect(() => {
    if (location.state?.activeTab || location.state?.activeSubTab) {
      const stateTab = location.state.activeTab || location.state.activeSubTab;
      if (stateTab === 'approval') {
        setActiveSubTab('approval');
      } else {
        setActiveSubTab('queue');
      }
    }
  }, [location.state]);

  const fetchRegistryTypes = async () => {
    try {
      const res = await api.get('patients/registry-data/all-masters/');
      setRegistryTypes(res.data || []);
    } catch (e) {
      console.error("Failed to load clinical protocols");
    }
  };

  useEffect(() => {
    if (selectedVisit) {
      const pid = selectedVisit.patient_details?.project_id || selectedVisit.patient_details?.project || "";
      fetchProjectLabMasters(pid);
      fetchPharmacyInventory(pid);
    }
  }, [selectedVisit]);

  useEffect(() => {
    if (user?.project) {
      fetchProjectConfig(user.project);
      fetchPendingApprovalsCount();
    } else {
      setProjectConfig(null);
    }
  }, [user]);

  const fetchProjectConfig = async (projectId) => {
    if (!projectId) return;
    try {
        const res = await api.get(`patients/projects/${projectId}/`);
        setProjectConfig(res.data);
    } catch (err) {
        console.error("Failed to fetch project config:", err);
    }
  };

  const fetchProjectLabMasters = async (projectId) => {
    try {
      const res = await api.get(`laboratory/lab-tests/?project_id=${projectId}&active_only=true`);
      setLabMasters(res.data.results || res.data);
    } catch (err) {
      console.error("Lab link offline:", err);
    }
  };

  const fetchPharmacyInventory = async (projectId = "") => {
    try {
      // Find the correct pharmacy registry for this specific project
      let slug = 'pharmacy-drugs';
      if (projectId) {
         // Resolve protocol by icon (Pill) or common naming patterns if 'pharmacy-drugs' name was customized
         const matchedType = registryTypes.find(rt => 
           String(rt.project) === String(projectId) && 
           (rt.icon === 'Pill' || rt.slug.toLowerCase().includes('pharmacy') || rt.name.toLowerCase().includes('pharmacy'))
         );
         if (matchedType) slug = matchedType.slug;
      }

      // Filter strictly for pharmacy-drugs protocol and isolate by project if specified
      let url = `patients/registry-data/?registry_type=${slug}&all=true`;
      if (projectId) url += `&project=${projectId}`;
      const res = await api.get(url);
      const data = res.data.results || res.data;
      setPharmacyInventory(Array.isArray(data) ? data : []);
      setTotalInventoryCount(Array.isArray(data) ? data.length : (res.data.count || 0));
    } catch (err) {
      console.error("Pharmacy link offline:", err);
    }
  };

  const getAge = (dobString) => {
    if (!dobString) return 'N/A';
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? `${age}y` : 'N/A';
    } catch (e) {
      return 'N/A';
    }
  };

  const checkIsDayBased = (itemGroup) => {
    const groupUpper = String(itemGroup || "").toUpperCase().trim();
    if (groupUpper.includes('BOTTLE') || groupUpper.includes('BOT')) {
      return false;
    }
    return groupUpper.includes('TAB') || groupUpper.includes('CAP');
  };

  const getDoseCount = (freq, dur, itemGroup = "", medName = "") => {
    if (!freq || !dur) return 0;

    // MNC Standard Logic: Only Tablets and Capsules follow frequency-based multiplication
    const isDayBased = checkIsDayBased(itemGroup, medName);

    if (!isDayBased) {
        // For Syrups, Ointments, Liquids, etc., the 'Duration' field is treated as 'Total Units/Bottles'
        return parseInt(dur) || 1;
    }

    let perDay = 0;
    if (freq.includes('-')) {
        perDay = freq.split('-').reduce((sum, val) => {
            const clean = val.trim();
            let parsed = parseFloat(clean) || 0;
            if (clean === '1/2') parsed = 0.5;
            return sum + parsed;
        }, 0);
    } else {
        const map = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 };
        perDay = map[freq] || 1;
    }
    return Math.ceil(perDay * (parseInt(dur) || 0));
  };

  useEffect(() => {
    fetchVisitsToSee();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !selectedVisit) {
        fetchVisitsToSee(page, searchTerm, true);
        fetchPendingApprovalsCount();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [page, searchTerm, selectedVisit, user]);

  const fetchVisitsToSee = async (pageNum = 1, search = searchTerm, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      // Fetch only visits that need consultation
      const res = await api.get(`clinical/visits/?status=PENDING_CONSULTATION,FINAL_CONSULTATION&page=${pageNum}&page_size=30&search=${encodeURIComponent(search)}`);
      if (res.data.results) {
          setVisitsReady(res.data.results);
          setTotalCount(res.data.count);
      } else {
          setVisitsReady(res.data);
          setTotalCount(res.data.length);
      }
      setPage(pageNum);
      
      // Auto-reload stock & diagnostics if a case is currently selected
      if (selectedVisit) {
          const pid = selectedVisit.patient_details?.project_id || selectedVisit.patient_details?.project || "";
          fetchPharmacyInventory(pid);
          fetchProjectLabMasters(pid);
      }
    } catch (err) {
      if (!isBackground) toast.error("Failed to fetch doctor's queue");
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const handleConsultation = async (e) => {
    e.preventDefault();
    if (isSavingConsult) return;
    
    if (!consultData.next_step) {
        toast.error("Please select a Next Workflow Action (Lab, Pharmacy, or Discharge) to proceed.", {
            icon: '🩺',
            style: { borderRadius: '12px', background: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: 'bold' }
        });
        return;
    }
    
    // Auto-add current drug if typed but not added
    let finalConsultData = { ...consultData };
    if (newMed.name && consultData.next_step === 'PENDING_PHARMACY') {
        if (!newMed.duration) {
            toast.error("Please specify the number of Days for the medication being prescribed.");
            return;
        }
        const finalUnits = checkIsDayBased(newMed.item_group, newMed.name) 
          ? getDoseCount(newMed.frequency, newMed.duration, newMed.item_group, newMed.name)
          : (parseInt(newMed.total_units) || 1);
        finalConsultData.medications = [...consultData.medications, { ...newMed, total_units: finalUnits }];
    }

    // Validation
    if (finalConsultData.next_step === 'PENDING_PHARMACY' && finalConsultData.medications.length === 0) {
        toast.error("Please add at least one medication for Pharmacy transfer.");
        return;
    }

    if (finalConsultData.next_step === 'PENDING_LAB' && finalConsultData.lab_investigations.length === 0) {
        toast.error("Please add at least one diagnostic test for Lab request transfer.");
        return;
    }

    // Stock validation: ensure each prescribed medicine is in stock and has sufficient units if any are prescribed
    if (finalConsultData.medications.length > 0) {
        for (const med of finalConsultData.medications) {
            if (!med.duration) {
                toast.error(`Please specify the number of Days for "${med.name}".`);
                return;
            }
            const drugObj = pharmacyInventory.find(d => {
                const dCode = d.ucode || d.item_code;
                if (med.item_code && dCode) {
                    return dCode === med.item_code;
                }
                return d.name.toLowerCase() === med.name.toLowerCase();
            });
            if (!drugObj) {
                toast.error(`"${med.name}" is not registered in the project's pharmacy registry.`);
                return;
            }
            
            const available = drugObj.quantity || drugObj.balance_qty || 0;
            if (available <= 0) {
                toast.error(`"${med.name}" is completely out of stock!`);
                return;
            }

            // Sum up total units requested for this specific drug in the prescription
            const sameMeds = finalConsultData.medications.filter(m => {
                if (med.item_code && m.item_code) {
                    return m.item_code === med.item_code;
                }
                return m.name.toLowerCase() === med.name.toLowerCase();
            });
            const totalRequired = sameMeds.reduce((sum, m) => {
                const units = checkIsDayBased(m.item_group, m.name) 
                    ? getDoseCount(m.frequency, m.duration, m.item_group, m.name)
                    : (parseInt(m.total_units) || 1);
                return sum + units;
            }, 0);

            if (totalRequired > available) {
                toast.error(`Insufficient stock! Total needed for "${med.name}" is ${totalRequired} units, but only ${available} units are available.`);
                return;
            }
        }
    }

    setIsSavingConsult(true);
    const loadingToast = toast.loading('Finalizing consultation...');
    try {
      await api.post(`clinical/visits/${selectedVisit.id}/record_consultation/`, finalConsultData);
      toast.success(`Patient moved to ${finalConsultData.next_step.replace('PENDING_', '')}`, { id: loadingToast });
      navigate('/consultations');
      setConsultData({
        chief_complaint: '', 
        diagnosis: '', 
        plan: '',
        next_step: '',
        lab_investigations: [],
        medications: []
      });
      setSearchLab("");
      setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '', timing: 'After Food', item_code: '', item_group: '' });
      setSelectedGroup("");
      setDrugSearch("");
      fetchVisitsToSee();
    } catch (err) {
      toast.error("Error saving consultation", { id: loadingToast });
    } finally {
      setIsSavingConsult(false);
    }
  };

  const fetchHistory = async (patientId) => {
    const targetId = patientId || selectedVisit?.patient;
    if (!targetId) return;
    
    setIsLoadingHistory(true);
    try {
      const res = await api.get(`clinical/visits/?patient=${targetId}&status=COMPLETED&page_size=5`);
      // Strict Enforcement: Take only last 5 records
      const history = (res.data.results || res.data || []).slice(0, 5);
      setPatientHistory(history);
      if (history.length > 0) setDetailedVisit(history[0]);
    } catch (err) {
      console.error("History pre-fetch failed");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRepeatMedication = (histMed) => {
    const drugObj = pharmacyInventory.find(d => {
      const dCode = d.ucode || d.item_code;
      if (histMed.item_code && dCode) {
        return dCode === histMed.item_code;
      }
      return d.name.toLowerCase() === histMed.medication_name.toLowerCase();
    });
    if (!drugObj) {
      toast.error(`"${histMed.medication_name}" is not registered in the project's pharmacy registry.`);
      return;
    }
    const available = drugObj.quantity || drugObj.balance_qty || 0;
    if (available <= 0) {
      toast.error(`"${histMed.medication_name}" is out of stock!`);
      return;
    }

    const alreadyAdded = consultData.medications.some(m => m.name.toLowerCase() === histMed.medication_name.toLowerCase());
    if (alreadyAdded) {
      toast.error(`"${histMed.medication_name}" is already in your active prescription list.`);
      return;
    }

    const totalUnits = checkIsDayBased(drugObj.item_group, drugObj.name)
      ? getDoseCount(histMed.frequency, histMed.duration, drugObj.item_group, drugObj.name)
      : (parseInt(histMed.total_units) || 1);

    const newPrescription = {
      name: drugObj.name,
      dosage: histMed.dosage || 'As directed',
      frequency: histMed.frequency || '1-0-1',
      duration: histMed.duration || '5 days',
      timing: histMed.timing || 'After Food',
      total_units: totalUnits,
      item_code: drugObj.ucode || drugObj.item_code || '',
      item_group: drugObj.item_group || ''
    };

    setConsultData(prev => ({
      ...prev,
      medications: [...prev.medications, newPrescription],
      next_step: prev.next_step || 'PENDING_PHARMACY'
    }));

    toast.success(`Added ${drugObj.name} to active prescription list!`);
  };

  const handleRepeatAllMedications = () => {
    if (!detailedVisit?.prescriptions?.length) return;
    
    let addedCount = 0;
    let skippedOut = [];
    let skippedDup = [];
    let updatedMedications = [...consultData.medications];

    detailedVisit.prescriptions.forEach(histMed => {
      const drugObj = pharmacyInventory.find(d => {
        const dCode = d.ucode || d.item_code;
        if (histMed.item_code && dCode) {
          return dCode === histMed.item_code;
        }
        return d.name.toLowerCase() === histMed.medication_name.toLowerCase();
      });
      if (!drugObj) {
        skippedOut.push(histMed.medication_name);
        return;
      }
      const available = drugObj.quantity || drugObj.balance_qty || 0;
      if (available <= 0) {
        skippedOut.push(drugObj.name);
        return;
      }
      
      const alreadyAdded = updatedMedications.some(m => m.name.toLowerCase() === histMed.medication_name.toLowerCase());
      if (alreadyAdded) {
        skippedDup.push(drugObj.name);
        return;
      }

      const totalUnits = checkIsDayBased(drugObj.item_group, drugObj.name)
        ? getDoseCount(histMed.frequency, histMed.duration, drugObj.item_group, drugObj.name)
        : (parseInt(histMed.total_units) || 1);

      updatedMedications.push({
        name: drugObj.name,
        dosage: histMed.dosage || 'As directed',
        frequency: histMed.frequency || '1-0-1',
        duration: histMed.duration || '5 days',
        timing: histMed.timing || 'After Food',
        total_units: totalUnits,
        item_code: drugObj.ucode || drugObj.item_code || '',
        item_group: drugObj.item_group || ''
      });
      addedCount++;
    });

    if (addedCount > 0) {
      setConsultData(prev => ({
        ...prev,
        medications: updatedMedications,
        next_step: prev.next_step || 'PENDING_PHARMACY'
      }));
      toast.success(`Successfully repeated ${addedCount} medication(s) in active prescription!`);
    }

    if (skippedOut.length > 0) {
      toast.error(`Out of stock / Unavailable: ${skippedOut.join(', ')}`, { duration: 4000 });
    }
  };

  const filteredVisits = visitsReady.filter(visit => {
    const searchLow = searchTerm.toLowerCase().trim();
    if (!searchLow) return true;

    // Smart card group matching: check if search term is a card base/suffix and extract the base
    const cardMatch = searchLow.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || searchLow.match(/(\d+)(?:\/\d+)?/);
    if (cardMatch) {
      const baseCard = cardMatch[1].padStart(4, '0');
      const pCard = String(visit.patient_details?.card_no || '').toLowerCase();
      const pCardMatch = pCard.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || pCard.match(/(\d+)(?:\/\d+)?/);
      if (pCardMatch && pCardMatch[1].padStart(4, '0') === baseCard) {
        return true;
      }
    }

    const patientName = `${visit.patient_details?.first_name || ''} ${visit.patient_details?.last_name || ''}`.toLowerCase();
    const patientId = String(visit.patient_details?.patient_id || '').toLowerCase();
    const cardNo = String(visit.patient_details?.card_no || '').toLowerCase();
    const phone = String(visit.patient_details?.phone || '').toLowerCase();
    const employeeId = String(visit.patient_details?.employee_details?.additional_fields?.employee_id || '').toLowerCase();

    return patientName.includes(searchLow) || patientId.includes(searchLow) || cardNo.includes(searchLow) || phone.includes(searchLow) || employeeId.includes(searchLow);
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedVisits = [...filteredVisits].sort((a, b) => {
    const { key, direction } = sortConfig;
    let aVal, bVal;
    if (key === 'patient_name') {
      aVal = `${a.patient_details?.first_name || ''} ${a.patient_details?.last_name || ''}`.toLowerCase();
      bVal = `${b.patient_details?.first_name || ''} ${b.patient_details?.last_name || ''}`.toLowerCase();
    } else if (key === 'reason') {
      aVal = (a.reason || '').toLowerCase();
      bVal = (b.reason || '').toLowerCase();
    } else if (key === 'visit_date') {
      aVal = new Date(a.visit_date || 0).getTime();
      bVal = new Date(b.visit_date || 0).getTime();
    } else {
      aVal = a[key]; bVal = b[key];
    }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <>
    <div className="fade-in">
      {!selectedVisit && (
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Consult Desk</h1>
        <p style={{ color: 'var(--text-muted)' }}>Professional clinical assessment and treatment planning</p>
        </div>
      </header>
      )}

      {!selectedVisit && (
        <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem', overflowX: 'auto' }}>
          <button 
              onClick={() => setActiveSubTab('queue')}
              style={{ 
                  padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                  borderBottom: activeSubTab === 'queue' ? `3px solid ${projectConfig?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                  fontWeight: 800, color: activeSubTab === 'queue' ? (projectConfig?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                  cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
              }}
          >
              Consultation Queue ({totalCount})
          </button>
          {(user?.role === 'ADMIN' || user?.permissions?.includes('/indents/approval')) && (
            <button 
                onClick={() => setActiveSubTab('approval')}
                style={{ 
                    padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                    borderBottom: activeSubTab === 'approval' ? `3px solid ${projectConfig?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                    fontWeight: 800, color: activeSubTab === 'approval' ? (projectConfig?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                    cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px'
                }}
            >
                Room Stock Approval Desk
                {pendingApprovalsCount > 0 && (
                  <span style={{ 
                    background: 'var(--primary)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 900,
                    animation: 'pulse 2s infinite'
                  }}>
                    {pendingApprovalsCount}
                  </span>
                )}
            </button>
          )}
        </div>
      )}

      <div style={{ gap: '2rem', alignItems: 'start' }}>
        {/* Waiting Patients - Only show if NO patient is selected */}
        {!selectedVisit && activeSubTab === 'queue' && (
          <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
               <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Consultation Queue ({totalCount})</h3>
                  <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginTop: '2px' }}>Patients waiting for examination</p>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="search-container" style={{ position: 'relative' }}>
                     <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', zIndex: 10 }} />
                     <input
                        type="text"
                        placeholder="Search by Patient/Employee ID, Name, Card No..."
                        value={searchTerm}
                        onChange={e => { const val = e.target.value; setSearchTerm(val); setPage(1); fetchVisitsToSee(1, val); }}
                        className="search-input"
                        style={{ paddingRight: '2rem' }}
                     />
                     {searchTerm && (
                        <button 
                           onClick={() => { setSearchTerm(''); setPage(1); fetchVisitsToSee(1, ''); }}
                           style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                           <X size={14} />
                        </button>
                     )}
                  </div>
                  <button onClick={() => fetchVisitsToSee()} style={{ border: 'none', background: 'var(--background)', padding: '0.625rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Clock size={18} color="#6366f1" />
                  </button>
               </div>
            </div>
            
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                     <th 
                       onClick={() => handleSort('patient_name')}
                       style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                     >
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         Patient Name
                         {sortConfig.key === 'patient_name' ? (
                           sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                         ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                       </div>
                     </th>
                     <th 
                       onClick={() => handleSort('reason')}
                       style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                     >
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         Reason
                         {sortConfig.key === 'reason' ? (
                           sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                         ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                       </div>
                     </th>
                     <th 
                       onClick={() => handleSort('visit_date')}
                       style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                     >
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         Registration Time
                         {sortConfig.key === 'visit_date' ? (
                           sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                         ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                       </div>
                     </th>
                     <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                   {isLoading ? (
                     <tr>
                       <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                           <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                             <div className="pulse-loader"></div>
                             <Stethoscope size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
                           </div>
                           <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Loading Consult Queue...</p>
                         </div>
                         <style>{`
                           .pulse-loader { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--primary); animation: pulse 1.5s infinite; opacity: 0.5; }
                           @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
                         `}</style>
                       </td>
                     </tr>
                   ) : sortedVisits.length === 0 ? (
                     <tr>
                       <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>No patients found</p>
                          <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>Try searching with a different name or ID.</p>
                       </td>
                     </tr>
                   ) : (
                      sortedVisits.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s ease' }}>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="patient-avatar-placeholder" style={{ width: '42px', height: '42px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                               {v.patient_details?.first_name[0].toLowerCase()}
                            </div>
                            <div>
                               <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}>
                                 {v.patient_details?.first_name} {v.patient_details?.last_name}
                                 {v.is_late_entry && (
                                   <span 
                                     style={{ 
                                       marginLeft: '0.5rem', 
                                       fontSize: '0.625rem', 
                                       background: 'rgba(245, 158, 11, 0.1)', 
                                       color: '#d97706', 
                                       padding: '0.15rem 0.4rem', 
                                       borderRadius: '6px', 
                                       fontWeight: 800,
                                       border: '1px solid rgba(245, 158, 11, 0.2)',
                                       textTransform: 'uppercase',
                                       letterSpacing: '0.02em',
                                       verticalAlign: 'middle',
                                       display: 'inline-block'
                                     }}
                                     title={`Justification: ${v.late_entry_justification || 'N/A'}`}
                                   >
                                     Late Entry
                                   </span>
                                 )}
                                 {v.reversion_note && (
                                   <span 
                                     style={{ 
                                       marginLeft: '0.5rem', 
                                       fontSize: '0.625rem', 
                                       background: 'rgba(239, 68, 68, 0.1)', 
                                       color: '#dc2626', 
                                       padding: '0.15rem 0.4rem', 
                                       borderRadius: '6px', 
                                       fontWeight: 800,
                                       border: '1px solid rgba(239, 68, 68, 0.2)',
                                       textTransform: 'uppercase',
                                       letterSpacing: '0.02em',
                                       verticalAlign: 'middle',
                                       display: 'inline-block'
                                     }}
                                     title={`Pharmacy Note: ${v.reversion_note}`}
                                   >
                                     Pharmacy Review
                                   </span>
                                 )}
                               </p>
                               <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                  ID: {v.patient_details?.patient_id}{v.patient_details?.card_no ? ` | Card: ${v.patient_details.card_no}` : ''}{v.vitals?.recorded_by_username ? ` | Vitals: ${v.vitals.recorded_by_username}` : ''}
                                  {v.patient_details?.is_active === false && (
                                    <span 
                                      style={{ 
                                        marginLeft: '0.5rem', 
                                        fontSize: '0.625rem', 
                                        background: '#fee2e2', 
                                        color: '#991b1b', 
                                        padding: '2px 6px', 
                                        borderRadius: '4px', 
                                        fontWeight: 800,
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.02em',
                                        display: 'inline-block'
                                      }}
                                    >
                                      Deactivated
                                    </span>
                                  )}
                                </p>
                            </div>
                         </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>{v.reason?.substring(0, 30)}</td>
                      <td style={{ padding: '1rem' }}>
                         <span className="badge badge-captured" style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: '8px' }}>Captured</span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <button 
                            disabled={v.patient_details?.is_active === false}
                            onClick={() => {
                              setSelectedVisit(v);
                              setConsultData({
                                chief_complaint: v.consultation?.chief_complaint || v.reason || '',
                                diagnosis: v.consultation?.diagnosis || '',
                                plan: v.consultation?.plan || '',
                                next_step: '',
                                lab_investigations: [], // Start fresh for new investigations
                                medications: v.prescriptions?.map(p => ({
                                    name: p.medication_name,
                                    dosage: p.dosage || 'As directed',
                                    frequency: p.frequency,
                                    duration: p.duration,
                                    total_units: p.total_units || 1,
                                    timing: p.timing || 'After Food',
                                    item_code: p.item_code || '',
                                    item_group: p.item_group || ''
                                })) || []
                              });
                              // Background Pre-fetch (Performance)
                              fetchHistory(v.patient);
                              // Keep dashboard hidden initially
                              setShowHistoryDashboard(false);
                              navigate('/consultations/examine');
                            }} 
                            style={{ 
                              background: v.patient_details?.is_active === false ? '#94a3b8' : (projectConfig?.primary_color ? projectConfig.primary_color : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'),
                              color: 'white',
                              border: 'none',
                              padding: '0.625rem 1.5rem',
                              borderRadius: '12px',
                              fontSize: '0.8125rem',
                              fontWeight: 800,
                              cursor: v.patient_details?.is_active === false ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: v.patient_details?.is_active === false ? 'none' : (projectConfig?.primary_color ? `0 4px 12px ${projectConfig.primary_color}33` : '0 4px 12px rgba(79, 70, 229, 0.25)'),
                              transition: 'all 0.2s ease',
                              opacity: v.patient_details?.is_active === false ? 0.6 : 1
                            }}
                          >
                             {v.patient_details?.is_active === false ? 'Deactivated' : 'Examine'} <Stethoscope size={16} />
                          </button>
                      </td>
                    </tr>
                  )))}

                </tbody>
              </table>
            </div>
                  {/* Pagination Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Showing <span style={{ color: 'var(--primary)' }}>{sortedVisits.length}</span> of {totalCount} entries
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                              className="btn btn-secondary" 
                              disabled={page === 1}
                              onClick={() => fetchVisitsToSee(page - 1, searchTerm)}
                              style={{ padding: '0.4rem', borderRadius: '8px', opacity: page === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                          onClick={() => fetchVisitsToSee(1, searchTerm)}
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
                                                  onClick={() => fetchVisitsToSee(i, searchTerm)}
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
                                              onClick={() => fetchVisitsToSee(totalPages, searchTerm)}
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
                              onClick={() => fetchVisitsToSee(page + 1, searchTerm)}
                                      style={{ padding: '0.4rem', borderRadius: '8px', opacity: page >= Math.ceil(totalCount / 30) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                              <ChevronRight size={18} />
                          </button>
                      </div>
                  </div>
          </div>
        )}

        {!selectedVisit && activeSubTab === 'approval' && (
          <div className="fade-in">
             <Indents isEmbed={true} embedTab="approval" />
          </div>
        )}


        {/* Examination & Plan - Only show if a patient is selected */}
        {selectedVisit && (
        <div className="workspace-split" style={{ width: '100%', margin: '0 auto' }}>
          {/* TOP: HISTORICAL REFERENCE PANEL (Unified MNC View) */}
          {showHistoryDashboard && (detailedVisit || isLoadingHistory) && (
            <div className="reference-panel fade-in" style={{ height: 'auto', maxHeight: '500px', border: isLoadingHistory ? '1.5px dashed var(--border)' : `1.5px solid ${projectConfig?.primary_color || 'var(--primary)'}`, marginBottom: '2rem' }}>
                <div className="reference-header" style={{ padding: '0.75rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="dossier-icon-box" style={{ width: '32px', height: '32px', background: isLoadingHistory ? '#e2e8f0' : (projectConfig?.primary_color ? projectConfig.primary_color : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)') }}>
                            <History size={16} color={isLoadingHistory ? '#94a3b8' : 'white'} />
                        </div>
                        <h2 className="dossier-title" style={{ fontSize: '0.9rem', color: isLoadingHistory ? '#94a3b8' : '#1e293b' }}>
                            {isLoadingHistory ? 'Synchronizing Historical Records...' : 'Historical Reference Summary'}
                        </h2>
                    </div>
                    {!isLoadingHistory && (
                        <button onClick={() => setShowHistoryDashboard(false)} className="dossier-close" style={{ width: '30px', height: '30px' }}>
                           <X size={16} />
                        </button>
                    )}
                </div>

                {isLoadingHistory ? (
                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '100px', height: '32px', borderRadius: '10px' }} />)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '40px', borderRadius: '12px' }} />)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="skeleton" style={{ height: '80px', borderRadius: '20px' }} />
                                <div className="skeleton" style={{ height: '150px', borderRadius: '16px' }} />
                            </div>
                            <div className="skeleton" style={{ height: '240px', borderRadius: '16px' }} />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* MNC Visit Selector Tabs */}
                        <div style={{ background: 'var(--surface)', padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                            {patientHistory.slice(0, 5).map((h) => (
                                <button 
                                    key={h.id}
                                    onClick={() => setDetailedVisit(h)}
                                    className={`history-tab-btn ${detailedVisit.id === h.id ? 'active' : ''}`}
                                    style={{ 
                                        padding: '0.5rem 1rem', 
                                        borderRadius: '10px', 
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        whiteSpace: 'nowrap',
                                        transition: '0.2s',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Calendar size={12} /> {new Date(h.visit_date).toLocaleDateString()}
                                </button>
                            ))}
                        </div>

                        <div className="reference-content" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: '1.5rem' }}>
                                {/* Column 1: Vitals Timeline Snapshot */}
                                <div className="snapshot-list">
                                    <p className="section-label-alt" style={{ color: projectConfig?.primary_color || '#6366f1', marginBottom: '10px' }}>Physical Parameters</p>
                                    {[
                                        { label: 'Weight', value: `${detailedVisit.vitals?.weight_kg || '--'} kg` },
                                        { label: 'BP', value: `${detailedVisit.vitals?.blood_pressure_sys || '--'}/${detailedVisit.vitals?.blood_pressure_dia || '--'}` },
                                        { label: 'Pulse', value: `${detailedVisit.vitals?.heart_rate || '--'} BPM` },
                                        { label: 'Temp', value: `${detailedVisit.vitals?.temperature_c || '--'} °C` },
                                        { label: 'BMI', value: `${detailedVisit.vitals?.bmi || '--'}` }
                                    ].map((item, id) => (
                                        <div key={id} className="snapshot-item" style={{ padding: '0.5rem 0.75rem' }}>
                                            <span className="item-label" style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700 }}>{item.label}</span>
                                            <span className="item-value" style={{ fontSize: '0.7rem', fontWeight: 900, color: '#0f172a' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Column 2: Clinical Context */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="diagnosis-box" style={{ padding: '1rem' }}>
                                        <p className="section-label-alt" style={{ fontSize: '0.6rem', color: '#92400e' }}>HISTORICAL DIAGNOSIS</p>
                                        <p className="diagnosis-text" style={{ fontSize: '0.85rem', color: '#78350f' }}>{detailedVisit.consultation?.diagnosis || 'No diagnosis recorded'}</p>
                                    </div>
                                    <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', flex: 1, overflowY: 'auto' }}>
                                        {detailedVisit.prescriptions?.length > 0 ? (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <p style={{ fontSize: '0.65rem', fontWeight: 950, color: projectConfig?.primary_color || '#4338ca', textTransform: 'uppercase', margin: 0 }}>Prescribed Medications</p>
                                                    <button 
                                                        type="button"
                                                        onClick={handleRepeatAllMedications}
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Plus size={10} /> Repeat All
                                                    </button>
                                                </div>
                                                {detailedVisit.prescriptions.map((m, i) => {
                                                    const drugObj = pharmacyInventory.find(d => d.name.toLowerCase() === m.medication_name.toLowerCase());
                                                    const available = drugObj ? (drugObj.quantity || drugObj.balance_qty || 0) : 0;
                                                    const inStock = available > 0;
                                                    
                                                    return (
                                                        <div key={i} className="history-med-item" style={{ marginBottom: '8px', padding: '8px 12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                                            <div>
                                                                <p className="history-med-name" style={{ fontSize: '0.75rem', fontWeight: 800, margin: 0 }}>{m.medication_name}</p>
                                                                <p style={{ fontSize: '0.6rem', color: '#475569', fontWeight: 600, margin: '2px 0 0 0' }}>{m.dosage} | {m.frequency} | {m.duration}</p>
                                                            </div>
                                                            {inStock ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRepeatMedication(m)}
                                                                    style={{ 
                                                                        border: 'none', 
                                                                        background: projectConfig?.primary_color ? projectConfig.primary_color + '1a' : '#eff6ff', 
                                                                        color: projectConfig?.primary_color || '#2563eb', 
                                                                        padding: '4px 8px', 
                                                                        borderRadius: '6px', 
                                                                        fontSize: '0.65rem', 
                                                                        fontWeight: 900, 
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '2px'
                                                                    }}
                                                                >
                                                                    <Plus size={10} /> Repeat
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '0.55rem', fontWeight: 900, background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                                                                    OUT OF STOCK
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 950, color: projectConfig?.primary_color || '#4338ca', marginBottom: '8px', textTransform: 'uppercase' }}>Prescribed Medications</p>
                                                <p className="empty-text">No medications prescribed</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Column 3: Diagnostic Insights */}
                                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', overflowY: 'auto', maxHeight: '350px' }}>
                                    <p style={{ fontSize: '0.65rem', fontWeight: 950, color: '#059669', marginBottom: '10px', textTransform: 'uppercase' }}>Verified Lab Results</p>
                                    {detailedVisit.lab_requests?.length > 0 ? detailedVisit.lab_requests.map((lr, i) => (
                                        <div key={i} className="history-lab-item" style={{ marginBottom: '1rem', padding: '10px', borderRadius: '12px' }}>
                                            <p className="history-lab-name" style={{ fontSize: '0.75rem', fontWeight: 900, marginBottom: '6px' }}>{lr.test_name}</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {lr.test_master_details?.sub_tests?.map(st => (
                                                    <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{st.name}</span>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)' }}>{lr.result?.values?.[st.name] || '--'}</span>
                                                    </div>
                                                ))}
                                                {!lr.test_master_details?.sub_tests?.length && lr.result?.value && (
                                                    <p style={{ fontSize: '0.75rem', fontWeight: 800, textAlign: 'right', color: 'var(--text-main)' }}>{lr.result.value}</p>
                                                )}
                                                {((lr.result?.attachments && lr.result.attachments.length > 0) || lr.result?.attachment_url) && (
                                                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                                        {lr.result.attachments && lr.result.attachments.length > 0 ? (
                                                            lr.result.attachments.map((att, attIdx) => {
                                                                const isPdf = att.file_url?.toLowerCase().endsWith('.pdf') || att.file?.toLowerCase().endsWith('.pdf');
                                                                return isPdf ? (
                                                                    <a key={att.id || attIdx} href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                        <FileText size={10} /> View PDF ({attIdx + 1})
                                                                    </a>
                                                                ) : (
                                                                    <button 
                                                                        key={att.id || attIdx}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setLightboxImage(att.file_url);
                                                                            setZoom(1);
                                                                            setRotation(0);
                                                                            setBrightness(1);
                                                                            setFlipH(false);
                                                                            setFlipV(false);
                                                                            setPan({ x: 0, y: 0 });
                                                                        }}
                                                                        style={{ border: 'none', background: 'none', padding: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                                    >
                                                                        <Image size={10} /> View Scan ({attIdx + 1})
                                                                    </button>
                                                                );
                                                            })
                                                        ) : (
                                                            lr.result.attachment_url.toLowerCase().endsWith('.pdf') ? (
                                                                <a href={lr.result.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                    <FileText size={10} /> View PDF
                                                                </a>
                                                            ) : (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setLightboxImage(lr.result.attachment_url);
                                                                        setZoom(1);
                                                                        setRotation(0);
                                                                        setBrightness(1);
                                                                        setFlipH(false);
                                                                        setFlipV(false);
                                                                        setPan({ x: 0, y: 0 });
                                                                    }}
                                                                    style={{ border: 'none', background: 'none', padding: 0, fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                                >
                                                                    <Image size={10} /> View Scan
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : <p className="empty-text">No laboratory tests requested</p>}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
          )}

          <div className="active-consult-panel card fade-in" style={{ border: '1px solid var(--border)', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '2rem 1.5rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.5rem' }}>
                 <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ width: 'fit-content' }}>
                        <h2 style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>Clinical Assessment</h2>
                        <div style={{ height: '3px', width: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%)', borderRadius: '4px', marginTop: '6px', marginBottom: '8px' }}></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 800 }}> 
                        ID: {selectedVisit.patient_details?.patient_id} | {selectedVisit.patient_details?.first_name} {selectedVisit.patient_details?.last_name}
                        </p>
                        {selectedVisit.is_late_entry && (
                          <span style={{ fontSize: '0.625rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 800, border: '1px solid rgba(245, 158, 11, 0.2)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'inline-block' }}
                            title={`Justification: ${selectedVisit.late_entry_justification || 'N/A'}`}
                          >
                            Late Entry
                          </span>
                        )}
                      </div>
                    </div>
                 </div>
                 <button onClick={() => navigate('/consultations')} style={{ border: 'none', background: 'var(--primary)', padding: '0.6rem 1.25rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.8125rem', boxShadow: '0 4px 12px var(--primary-shadow)' }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'var(--primary-dark)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--primary)'; }}>
                    <ChevronLeft size={16} strokeWidth={2.5} /> Back to Queue
                 </button>
              </div>
              
              {/* Patient Profile Summary */}
              <div style={{ background: 'var(--surface)', margin: '0 0.5rem 2rem 0.5rem', padding: '1.25rem 2rem', borderRadius: '24px', border: '1.5px solid ' + (projectConfig?.primary_color || 'var(--border)'), display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.02)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                     <User size={18} style={{ color: projectConfig?.primary_color || 'var(--primary)', opacity: 0.8 }} />
                     <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{selectedVisit.patient_details?.gender || 'N/A'} / {getAge(selectedVisit.patient_details?.dob)}</p>
                 </div>
                 <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                     <Phone size={16} style={{ color: projectConfig?.primary_color || 'var(--primary)', opacity: 0.8 }} />
                     <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>+91 {selectedVisit.patient_details?.phone ? selectedVisit.patient_details.phone.replace(/(\d{6})(\d{4})/, '$1XXXX') : 'N/A'}</p>
                 </div>
                 <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                     <ClipboardList size={16} style={{ color: projectConfig?.primary_color || 'var(--primary)', opacity: 0.8 }} />
                     <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{selectedVisit.reason?.substring(0, 30) || 'Routine'}</p>
                 </div>
                 <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                     <Hash size={16} style={{ color: projectConfig?.primary_color || 'var(--primary)', opacity: 0.8 }} />
                     <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                       {selectedVisit.patient_details?.card_no || selectedVisit.patient_details?.id_proof_number || 'N/A'}
                     </p>
                 </div>
                   <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
                     {selectedVisit?.patient_details?.total_visits > 1 && (
                        <button type="button" onClick={() => setShowHistoryDashboard(true)} className="view-history-btn" style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                           <History size={13} /> VIEW HISTORY
                        </button>
                     )}
                     <span className="examining-badge" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800, width: 'fit-content' }}>EXAMINING</span>
                  </div>
              </div>

              {selectedVisit.reversion_note && (
                 <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '16px', margin: '0 0.5rem 2rem 0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <AlertCircle size={20} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                       <p style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 800, marginBottom: '4px' }}>Sent Back from Pharmacy (Review Requested)</p>
                       <p style={{ fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 600, margin: 0 }}>Note: <strong>{selectedVisit.reversion_note}</strong></p>
                    </div>
                 </div>
              )}

             {/* Clinic History & Lab Results */}
             <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                   {/* Vitals Summary */}
                   <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <div style={{ gridColumn: 'span 2', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <p style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Vitals</p>
                           <span style={{ fontSize: '0.625rem', color: '#475569', fontWeight: 700 }}>Weight: {selectedVisit.vitals?.weight_kg}kg | Height: {selectedVisit.vitals?.height_cm}cm</span>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Temp / Heart</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>{selectedVisit.vitals?.temperature_c}°C / {selectedVisit.vitals?.heart_rate} BPM</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>BP (S/D)</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>{selectedVisit.vitals?.blood_pressure_sys}/{selectedVisit.vitals?.blood_pressure_dia}</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SPO2 / RR</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>{selectedVisit.vitals?.spo2}% / {selectedVisit.vitals?.respiratory_rate}</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>BMI</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>{selectedVisit.vitals?.bmi || '--'}</p>
                       </div>
                   </div>

                   {/* Personal History */}
                   <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Personal History</p>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                           <HistoryBadge label="Smoke" value={selectedVisit.vitals?.smoking} />
                           <HistoryBadge label="Alcohol" value={selectedVisit.vitals?.alcohol} />
                           <HistoryBadge label="Activity" value={selectedVisit.vitals?.physical_activity} />
                           <HistoryBadge label="Food" value={selectedVisit.vitals?.food_habit} />
                           <HistoryBadge label="Allergy(F)" value={selectedVisit.vitals?.allergy_food} color="#ef4444" />
                           <HistoryBadge label="Allergy(D)" value={selectedVisit.vitals?.allergy_drug} color="#ef4444" />
                       </div>
                   </div>

                   {/* Family History */}
                   <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Family History</p>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                           <HistoryBadge label="DM" value={selectedVisit.vitals?.family_dm} />
                           <HistoryBadge label="HTN" value={selectedVisit.vitals?.family_htn} />
                           <HistoryBadge label="Cancer" value={selectedVisit.vitals?.family_cancer} />
                           <HistoryBadge label="CVS" value={selectedVisit.vitals?.family_cvs} />
                           <HistoryBadge label="Thyroid" value={selectedVisit.vitals?.family_thyroid} />
                           <HistoryBadge label="TB" value={selectedVisit.vitals?.family_tb} />
                       </div>
                   </div>

                   {/* Known History */}
                   <div className="known-history-box" style={{ gridColumn: 'span 2', background: projectConfig?.primary_color ? `${projectConfig.primary_color}0a` : '#eff6ff', padding: '1.25rem', borderRadius: '16px', border: projectConfig?.primary_color ? `1px solid ${projectConfig.primary_color}26` : '1px solid #dbeafe' }}>
                       <p className="known-history-title" style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || '#1e40af', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Known History / Co-morbidities</p>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                           <HistoryBadge label="Known DM" value={selectedVisit.vitals?.known_dm} variant="filled" />
                           <HistoryBadge label="Known HTN" value={selectedVisit.vitals?.known_htn} variant="filled" />
                           <HistoryBadge label="Known Cancer" value={selectedVisit.vitals?.known_cancer} variant="filled" />
                           <HistoryBadge label="Known CVS" value={selectedVisit.vitals?.known_cvs} variant="filled" />
                           <HistoryBadge label="Thyroid Disorder" value={selectedVisit.vitals?.known_thyroid} variant="filled" />
                           <HistoryBadge label="Known TB" value={selectedVisit.vitals?.known_tb} variant="filled" />
                       </div>
                   </div>

                   {/* Systemic Examination */}
                   <div className="systemic-exam-box" style={{ gridColumn: 'span 2', background: projectConfig?.primary_color ? `${projectConfig.primary_color}0a` : '#f0fdf4', padding: '1.25rem', borderRadius: '16px', border: projectConfig?.primary_color ? `1px solid ${projectConfig.primary_color}26` : '1px solid #dcfce7' }}>
                       <p className="systemic-exam-title" style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || '#166534', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Systemic Examination (Clinical Notes)</p>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                           <ExamItem label="Respiratory" value={selectedVisit.vitals?.sys_respiratory} />
                           <ExamItem label="C.V.S" value={selectedVisit.vitals?.sys_cvs} />
                           <ExamItem label="C.N.S" value={selectedVisit.vitals?.sys_cns} />
                           <ExamItem label="G.I.S" value={selectedVisit.vitals?.sys_gis} />
                           <ExamItem label="M.S.S" value={selectedVisit.vitals?.sys_mss} />
                           <ExamItem label="G.U.S" value={selectedVisit.vitals?.sys_gus} />
                       </div>
                   </div>
                </div>

                {/* Lab Results IF EXISTS */}
                {selectedVisit.lab_requests?.some(lr => lr.status === 'COMPLETED') && (
                    <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', marginTop: '1rem' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FlaskConical size={12} /> Laboratory Results
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {selectedVisit.lab_requests.filter(lr => lr.status === 'COMPLETED').map(lr => (
                                <div key={lr.id} style={{ padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                        <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>{lr.test_name}</p>
                                        <span className="badge badge-captured" style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>VERIFIED</span>
                                    </div>
                                    
                                    {lr.test_master_details?.sub_tests?.length > 0 ? (
                                        <div style={{ padding: 0 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--background)' }}>
                                                        <th style={{ padding: '0.5rem', fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Parameter</th>
                                                        <th style={{ padding: '0.5rem', fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Result</th>
                                                        <th style={{ padding: '0.5rem', fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Ref. Range</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {lr.test_master_details.sub_tests.map(st => {
                                                        const val = lr.result?.values?.[st.name];
                                                        let isAbnormal = false;
                                                        if (st.biological_range && val) {
                                                            const match = st.biological_range.match(/([\d.]+)\s*-\s*([\d.]+)/);
                                                            if (match) {
                                                                const numVal = parseFloat(val);
                                                                if (!isNaN(numVal) && (numVal < parseFloat(match[1]) || numVal > parseFloat(match[2]))) {
                                                                    isAbnormal = true;
                                                                }
                                                            }
                                                        }
                                                        return (
                                                            <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{st.name}</td>
                                                                <td style={{ padding: '0.5rem', fontSize: '0.8125rem', fontWeight: isAbnormal ? 900 : 700, color: isAbnormal ? '#dc2626' : '#10b981' }}>
                                                                    {val || '--'} {st.units && <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#475569' }}>{st.units}</span>}
                                                                </td>
                                                                <td style={{ padding: '0.5rem', fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>{st.biological_range || '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                            <div>
                                                <p style={{ fontSize: '0.625rem', color: '#475569', textTransform: 'uppercase' }}>Value</p>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{lr.result?.value}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.625rem', color: '#475569', textTransform: 'uppercase' }}>Ref. Range</p>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>{lr.result?.reference_range || '--'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {lr.result?.interpretation && (
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                                            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 800 }}>Interpretation / Analyst Remarks</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.4, fontWeight: 500 }}>{lr.result.interpretation}</p>
                                        </div>
                                    )}

                                    {((lr.result?.attachments && lr.result.attachments.length > 0) || lr.result?.attachment_url) && (
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                                            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 800 }}>Attached Diagnostics / Scans</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                {lr.result.attachments && lr.result.attachments.length > 0 ? (
                                                    lr.result.attachments.map((att, attIdx) => {
                                                        const isPdf = att.file_url?.toLowerCase().endsWith('.pdf') || att.file?.toLowerCase().endsWith('.pdf');
                                                        return isPdf ? (
                                                            <a 
                                                                key={att.id || attIdx}
                                                                href={att.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '6px', 
                                                                    padding: '8px 12px', 
                                                                    background: 'var(--background)', 
                                                                    border: '1px solid var(--border)', 
                                                                    borderRadius: '10px', 
                                                                    fontSize: '0.7rem', 
                                                                    color: 'var(--primary)', 
                                                                    fontWeight: 800, 
                                                                    textDecoration: 'none' 
                                                                }}
                                                            >
                                                                <FileText size={12} /> View PDF ({attIdx + 1})
                                                            </a>
                                                        ) : (
                                                            <div 
                                                                key={att.id || attIdx}
                                                                style={{ 
                                                                    position: 'relative', 
                                                                    width: '100px', 
                                                                    height: '75px', 
                                                                    borderRadius: '8px', 
                                                                    overflow: 'hidden', 
                                                                    border: '1px solid var(--border)', 
                                                                    cursor: 'pointer',
                                                                    background: '#000'
                                                                }}
                                                                onClick={() => {
                                                                    setLightboxImage(att.file_url);
                                                                    setZoom(1);
                                                                    setRotation(0);
                                                                    setBrightness(1);
                                                                    setFlipH(false);
                                                                    setFlipV(false);
                                                                    setPan({ x: 0, y: 0 });
                                                                }}
                                                            >
                                                                <img 
                                                                    src={att.file_url} 
                                                                    alt={`Scan ${attIdx + 1}`} 
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
                                                                />
                                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '0.6rem', fontWeight: 900 }}>
                                                                    VIEW SCAN {attIdx + 1}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    lr.result.attachment_url.toLowerCase().endsWith('.pdf') ? (
                                                        <a 
                                                            href={lr.result.attachment_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            style={{ 
                                                                display: 'inline-flex', 
                                                                alignItems: 'center', 
                                                                gap: '6px', 
                                                                padding: '8px 16px', 
                                                                background: 'var(--background)', 
                                                                border: '1px solid var(--border)', 
                                                                borderRadius: '10px', 
                                                                fontSize: '0.75rem', 
                                                                color: 'var(--primary)', 
                                                                fontWeight: 800, 
                                                                textDecoration: 'none' 
                                                            }}
                                                        >
                                                            <FileText size={14} /> View PDF Document
                                                        </a>
                                                    ) : (
                                                        <div 
                                                            style={{ 
                                                                position: 'relative', 
                                                                width: '120px', 
                                                                height: '90px', 
                                                                borderRadius: '10px', 
                                                                overflow: 'hidden', 
                                                                border: '1px solid var(--border)', 
                                                                cursor: 'pointer',
                                                                background: '#000'
                                                            }}
                                                            onClick={() => {
                                                                setLightboxImage(lr.result.attachment_url);
                                                                setZoom(1);
                                                                setRotation(0);
                                                                setBrightness(1);
                                                                setFlipH(false);
                                                                setFlipV(false);
                                                                setPan({ x: 0, y: 0 });
                                                            }}
                                                        >
                                                            <img 
                                                                src={lr.result.attachment_url} 
                                                                alt="Diagnostic Scan" 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
                                                            />
                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '0.625rem', fontWeight: 900 }}>
                                                                VIEW SCAN
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleConsultation}>
               <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: projectConfig?.primary_color || 'var(--text-main)', fontWeight: 800 }}><ClipboardList size={14} /> Chief Complaint & History</label>
                  <textarea 
                    rows="3" 
                    required 
                    value={consultData.chief_complaint}
                    onChange={e => setConsultData({...consultData, chief_complaint: e.target.value})}
                    placeholder="Describe symptoms, duration and history..."
                  ></textarea>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label style={{ color: projectConfig?.primary_color || 'var(--text-main)', fontWeight: 800 }}>Diagnosis</label>
                    <textarea rows="3" required value={consultData.diagnosis} onChange={e => setConsultData({...consultData, diagnosis: e.target.value})} placeholder="Differential or final diagnosis..."></textarea>
                  </div>
                  {consultData.next_step !== 'PENDING_LAB' && (
                     <div className="form-group fade-in">
                       <label style={{ color: projectConfig?.primary_color || 'var(--text-main)', fontWeight: 800 }}>Treatment / Plan</label>
                       <textarea rows="3" required={consultData.next_step !== 'PENDING_LAB'} value={consultData.plan} onChange={e => setConsultData({...consultData, plan: e.target.value})} placeholder="Instructions, follow-up, lifestyle changes..."></textarea>
                     </div>
                   )}
               </div>

               {/* Medication Section */}
               {consultData.next_step !== 'PENDING_LAB' && (
                 <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '1.5rem' }} className="fade-in">
                    <p
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: projectConfig?.primary_color || "#4338ca",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        <Pill size={14} /> Prescribe Medications
                      </span>
                      <span className="inventory-count-badge" style={{ fontSize: "0.625rem", padding: "2px 8px", borderRadius: "6px" }}>
                        Total Available: {totalInventoryCount} Drug Variations 
                      </span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 0.8fr 1fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {/* ITEM GROUP DROPDOWN */}
                      <CustomSelect
                        options={[
                          { value: "", label: "SELECT GROUP" },
                          ...([...new Set(pharmacyInventory.map(d => getDrugGroup(d).toUpperCase()))].sort().map(g => ({
                            value: g,
                            label: g
                          })))
                        ]}
                        value={selectedGroup}
                        primaryColor={projectConfig?.primary_color}
                        height="36px"
                        borderRadius="12px"
                        style={{ fontSize: '0.75rem', fontWeight: 700 }}
                        onChange={val => {
                          setSelectedGroup(val);
                          setDrugSearch('');
                          setNewMed({...newMed, name: '', item_code: '', item_group: val});
                        }}
                      />

                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                            <input 
                              placeholder="SEARCH DRUG..." 
                              value={drugSearch} 
                              onFocus={(e) => {
                                setShowDrugDropdown(true);
                                e.target.select();
                              }}
                              onBlur={() => setTimeout(() => setShowDrugDropdown(false), 200)}
                              onChange={e => {
                                setDrugSearch(e.target.value);
                                  setShowDrugDropdown(true);
                                  if (newMed.name) setNewMed({...newMed, name: '', item_code: ''});
                              }} 
                              style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', width: '100%', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 2.25rem 0 0.75rem', fontWeight: 800, color: 'var(--text-main)', cursor: 'text' }} 
                            />
                            {drugSearch && (
                                <button 
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setDrugSearch('');
                                        setNewMed({...newMed, name: '', item_code: ''});
                                        setShowDrugDropdown(true);
                                    }}
                                    style={{ position: 'absolute', right: '30px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#94a3b8', transition: 'color 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                >
                                    <X size={12} />
                                </button>
                            )}
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                <Search size={14} color="#94a3b8" />
                            </div>
                        </div>

                        {showDrugDropdown && (
                            <div className="search-dropdown" style={{ position: 'absolute', top: '40px', left: 0, right: 0, borderRadius: '12px', zIndex: 1000, maxHeight: '250px', overflowY: 'auto' }}>
                                {pharmacyInventory
                                    .filter(d => !selectedGroup || getDrugGroup(d).toUpperCase() === selectedGroup.toUpperCase())
                                    .filter(d => !drugSearch || d.name.toLowerCase().includes(drugSearch.toLowerCase()) || (d.ucode && d.ucode.toLowerCase().includes(drugSearch.toLowerCase())))
                                    .map(d => (
                                        <div 
                                            key={d.id} 
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                const group = getDrugGroup(d);
                                                setSelectedGroup(group.toUpperCase());
                                                setNewMed({
                                                    ...newMed, 
                                                    name: d.name, 
                                                    item_code: d.ucode || d.item_code || '',
                                                    item_group: group
                                                });
                                                setDrugSearch(d.name);
                                                setShowDrugDropdown(false);
                                            }}
                                            className="search-dropdown-item"
                                            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                                        >
                                            <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px' }}>{d.name}</p>
                                            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                CODE: {d.ucode || 'N/A'} | STOCK: {d.quantity || 0}
                                            </p>
                                        </div>
                                    ))}
                                {pharmacyInventory.filter(d => (!selectedGroup || getDrugGroup(d).toUpperCase() === selectedGroup.toUpperCase()) && (!drugSearch || d.name.toLowerCase().includes(drugSearch.toLowerCase()))).length === 0 && (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
                                        No matching drugs found in this group
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Dynamic Stock Indicator */}
                        {newMed.name && (() => {
                            const drug = pharmacyInventory.find(d => {
                                const dCode = d.ucode || d.item_code;
                                if (newMed.item_code && dCode) {
                                    return dCode === newMed.item_code;
                                }
                                return d.name === newMed.name;
                            });
                            if (!drug) return null;
                            const alreadyAdded = consultData.medications
                                .filter(m => {
                                    if (newMed.item_code && m.item_code) {
                                        return m.item_code === newMed.item_code;
                                    }
                                    return m.name === newMed.name;
                                })
                                .reduce((sum, m) => {
                                    const units = checkIsDayBased(m.item_group, m.name)
                                        ? getDoseCount(m.frequency, m.duration, m.item_group, m.name)
                                        : (parseInt(m.total_units) || 1);
                                    return sum + units;
                                }, 0);
                            const remaining = (drug.quantity || drug.balance_qty || 0) - alreadyAdded;
                            const stockState = remaining > 10 ? 'high' : remaining > 0 ? 'low' : 'empty';
                            return (
                                <div className={`stock-indicator stock-${stockState}`} style={{ position: 'absolute', top: '-18px', right: 0, fontSize: '9px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                                    STOCK: {remaining} {drug.stock_uom || 'UNITS'} | CODE: {drug.ucode || drug.item_code || 'N/A'}
                                </div>
                            );
                        })()}
                      </div>
                       <input 
                          placeholder="Dosage" 
                          type="text" 
                          value={newMed.dosage} 
                          onChange={e => setNewMed({...newMed, dosage: e.target.value})} 
                          style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 0.5rem', fontWeight: 800, color: 'var(--text-main)' }} 
                       />
                       <CustomSelect
                         options={[
                           { value: "1-0-1", label: "1-0-1" },
                           { value: "1-1-1", label: "1-1-1" },
                           { value: "0.5-0-0.5", label: "0.5-0-0.5 (Half Morning/Night)" },
                           { value: "0.5-0-0", label: "0.5-0-0 (Half Morning Only)" },
                           { value: "0-0-0.5", label: "0-0-0.5 (Half Night Only)" },
                           { value: "0.5-0.5-0.5", label: "0.5-0.5-0.5 (Half Thrice a day)" },
                           { value: "1-0-0", label: "1-0-0 (Morning Only)" },
                           { value: "0-1-0", label: "0-1-0 (Afternoon Only)" },
                           { value: "0-0-1", label: "0-0-1 (Night Only)" },
                           { value: "1-1-0", label: "1-1-0 (Morning/Afternoon)" },
                           { value: "0-1-1", label: "0-1-1 (Afternoon/Night)" },
                           { value: "OD", label: "OD (Once a day)" },
                           { value: "BD", label: "BD (Twice a day)" },
                           { value: "TDS", label: "TDS (Thrice a day)" },
                           { value: "QID", label: "QID (Four times a day)" },
                           { value: "HS", label: "HS (At Bedtime)" },
                           { value: "SOS", label: "SOS (When needed)" },
                           { value: "STAT", label: "STAT (Immediately)" }
                         ]}
                         value={newMed.frequency}
                         onChange={val => setNewMed({...newMed, frequency: val})}
                         primaryColor={projectConfig?.primary_color}
                         height="36px"
                         borderRadius="12px"
                         style={{ fontSize: '0.75rem', fontWeight: 700 }}
                       />
                       <CustomSelect
                         options={[
                           { value: "Before Food", label: "Before Food" },
                           { value: "After Food", label: "After Food" },
                           { value: "Empty Stomach", label: "Empty Stomach" }
                         ]}
                         value={newMed.timing}
                         onChange={val => setNewMed({...newMed, timing: val})}
                         primaryColor={projectConfig?.primary_color}
                         height="36px"
                         borderRadius="12px"
                         style={{ fontSize: '0.75rem', fontWeight: 700 }}
                       />
                        <input 
                           placeholder="Days" 
                           type="number" 
                           min="1"
                           value={newMed.duration} 
                           onChange={e => {
                               const val = e.target.value;
                               if (val !== "" && parseInt(val) < 0) return; 
                               setNewMed({...newMed, duration: val});
                           }} 
                           style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', width: '90px', fontWeight: 800, color: 'var(--text-main)', border: '2px solid var(--border)', padding: '0 8px' }} 
                       />

                       {/* Extra Units Field for Non-Tablets */}
                       {(!checkIsDayBased(newMed.item_group, newMed.name) && newMed.item_group) && (
                           <input 
                               placeholder="Units" 
                               type="number" 
                               min="1"
                               value={newMed.total_units} 
                               onChange={e => {
                                   const val = e.target.value;
                                   if (val !== "" && parseInt(val) < 0) return; 
                                   setNewMed({...newMed, total_units: val});
                               }} 
                               className="units-input"
                               style={{ height: '36px', fontSize: '0.75rem', width: '85px', fontWeight: 800, padding: '0 8px', marginLeft: '4px' }} 
                           />
                       )}
                       <button type="button" onClick={() => {
                          if (!newMed.name || !newMed.duration) {
                              toast.error("Please provide both Drug Name and Number of Days");
                              return;
                          }
                          
                          // For Tablets, total_units is calculated. For others, it's explicitly provided.
                           const finalUnits = checkIsDayBased(newMed.item_group, newMed.name) 
                             ? getDoseCount(newMed.frequency, newMed.duration, newMed.item_group, newMed.name)
                             : (parseInt(newMed.total_units) || 1);

                           // Stock validation: Check if medication is in stock and we have enough available balance!
                           const drugObj = pharmacyInventory.find(d => 
                               (newMed.item_code && (d.ucode || d.item_code) ? (d.ucode || d.item_code) === newMed.item_code :
                               d.name.toLowerCase() === newMed.name.toLowerCase())
                           );
                          if (drugObj) {
                              const alreadyAdded = consultData.medications
                                  .filter(m => (newMed.item_code && m.item_code ? m.item_code === newMed.item_code : m.name.toLowerCase() === newMed.name.toLowerCase()))
                                  .reduce((sum, m) => {
                                      const units = checkIsDayBased(m.item_group, m.name) 
                                          ? getDoseCount(m.frequency, m.duration, m.item_group, m.name)
                                          : (parseInt(m.total_units) || 1);
                                      return sum + units;
                                  }, 0);
                              const remaining = (drugObj.quantity || drugObj.balance_qty || 0) - alreadyAdded;
                              
                              if (remaining <= 0) {
                                  toast.error(`"${newMed.name}" is completely out of stock!`);
                                  return;
                              }
                              if (finalUnits > remaining) {
                                  toast.error(`Insufficient stock! Only ${remaining} units of "${newMed.name}" are available, but you requested ${finalUnits} units.`);
                                  return;
                              }
                          } else {
                              toast.error(`"${newMed.name}" is not registered in the project's pharmacy registry.`);
                              return;
                          }

                          setConsultData({
                              ...consultData, 
                              medications: [...consultData.medications, { ...newMed, total_units: finalUnits }]
                          });
                          setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '', total_units: 1, timing: 'After Food', item_code: '', item_group: '' }); setSelectedGroup("");
                          setDrugSearch("");
                       }} className="btn btn-primary" style={{ height: '36px', width: '36px', padding: 0 }}>+</button>
                    </div>

                    {/* Prescribed Medications List - 'Falling' here */}
                    {consultData.medications.length > 0 && (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {consultData.medications.map((m, idx) => (
                                <div key={idx} className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '10px 15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '30px', height: '30px', background: '#f5f3ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Pill size={14} color="#6366f1" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)', marginBottom: '4px' }}>{m.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    | {m.dosage ? `${m.dosage} | ` : ''}{m.frequency} | {m.timing} | {m.duration} days
                                                </span>
                                                
                                                <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', padding: '3px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
                                                    Dispense: {m.total_units} units
                                                </span>

                                                {(() => {
                                                    const drug = pharmacyInventory.find(d => 
                                                        (m.item_code && (d.ucode || d.item_code) ? (d.ucode || d.item_code) === m.item_code :
                                                        d.name.toLowerCase() === m.name.toLowerCase())
                                                    );
                                                    if (drug) {
                                                        const initialQty = parseInt(drug.additional_fields?.initial_quantity) || 100;
                                                        const threshold = Math.max(5, Math.round(initialQty * 0.2));
                                                        const isLow = drug.quantity <= threshold;
                                                        return (
                                                            <span className={`stock-status-badge ${isLow ? 'low-stock' : 'in-stock'}`} style={{ 
                                                                padding: '3px 12px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 900, 
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                {isLow ? `Low Stock (Under 20%): ${drug.quantity} remaining` : `In Stock: ${drug.quantity} items`}
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button 
                                            type="button" 
                                            title="Edit Medication"
                                            onClick={() => {
                                                setNewMed({ ...m }); setSelectedGroup(m.item_group ? m.item_group.toUpperCase() : "");
                                                const updated = consultData.medications.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, medications: updated});
                                            }}
                                            className="edit-med-btn"
                                            style={{ border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updated = consultData.medications.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, medications: updated});
                                            }}
                                            className="delete-med-btn"
                                            style={{ border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
               )}

               <div className="next-workflow-box" style={{ background: '#f1f5f9', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', border: !consultData.next_step ? '1.5px solid #fed7d7' : '1.5px solid transparent', transition: 'all 0.3s ease' }}>
                  <p className="next-workflow-title" style={{ fontSize: '0.75rem', fontWeight: 800, color: projectConfig?.primary_color || '#4338ca', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                     <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} /> Select Next Workflow Action
                     </span>
                     {!consultData.next_step && (
                        <span className="required-badge" style={{ fontSize: '0.625rem', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px', fontWeight: 900, animation: 'pulse 2s infinite' }}>REQUIRED</span>
                     )}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: consultData.next_step === 'PENDING_LAB' ? '1rem' : '0' }}>
                     <button 
                       type="button" 
                       onClick={() => setConsultData({...consultData, next_step: 'PENDING_LAB'})}
                       className={`workflow-btn ${consultData.next_step === 'PENDING_LAB' ? 'active-lab' : ''}`}
                       style={{ 
                         padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', 
                         fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                         background: consultData.next_step === 'PENDING_LAB' ? (projectConfig?.primary_color || '#1d4ed8') : undefined,
                         color: consultData.next_step === 'PENDING_LAB' ? 'white' : undefined
                       }}
                     >
                       <FlaskConical size={14} /> Request Lab
                     </button>
                     <button 
                        type="button" 
                        onClick={() => setConsultData({...consultData, next_step: 'PENDING_PHARMACY'})}
                        className={`workflow-btn ${consultData.next_step === 'PENDING_PHARMACY' ? 'active-pharmacy' : ''}`}
                        style={{ 
                          padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', 
                          fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          background: consultData.next_step === 'PENDING_PHARMACY' ? (projectConfig?.primary_color || '#1d4ed8') : undefined,
                          color: consultData.next_step === 'PENDING_PHARMACY' ? 'white' : undefined
                        }}
                      >
                        <Pill size={14} /> Pharmacy ({consultData.medications.length})
                      </button>
                     <button 
                       type="button" 
                       onClick={() => setConsultData({...consultData, next_step: 'COMPLETED'})}
                       className={`workflow-btn ${consultData.next_step === 'COMPLETED' ? 'active-completed' : ''}`}
                       style={{ 
                         padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', 
                         fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                         background: consultData.next_step === 'COMPLETED' ? (projectConfig?.primary_color || '#059669') : undefined,
                         color: consultData.next_step === 'COMPLETED' ? 'white' : undefined
                       }}
                     >
                       <CheckCircle size={14} /> Discharge
                     </button>
                  </div>

                  {consultData.next_step === 'PENDING_LAB' && (
                    <div className="fade-in" style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribe Investigations</label>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#475569' }}>{labMasters.length} Tests Available</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                           <div style={{ flex: 1, position: 'relative' }}>
                               <input 
                                   placeholder="Search Investigation from Master Registry..." 
                                   value={searchLab} 
                                   onFocus={() => setShowLabSearch(true)}
                                   onBlur={() => {
                                       // Delay closing to allow onMouseDown on the registry items to fire first
                                       setTimeout(() => setShowLabSearch(false), 250);
                                   }}
                                   onChange={e => setSearchLab(e.target.value)}
                                   style={{ background: 'var(--surface)', height: '44px', fontSize: '0.875rem', borderRadius: '14px', border: '1px solid var(--border)', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                                   onKeyUp={e => {
                                       if(e.key === 'Escape') setShowLabSearch(false);
                                   }}
                               />
                               {showLabSearch && (
                                  <div className="search-dropdown" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', maxHeight: '280px', overflowY: 'auto', borderRadius: '16px', zIndex: 1000, padding: '6px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                                     <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#475569', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>Available Diagnostic Tests</div>
                                     
                                     <style>{`
                                        .search-item-hover:hover {
                                            background: ${projectConfig?.primary_color ? projectConfig.primary_color + '14' : 'rgba(59, 130, 246, 0.08)'} !important;
                                        }
                                     `}</style>

                                     {labMasters.filter(l => {
                                         const query = searchLab.toLowerCase();
                                         const isAlreadySelected = consultData.lab_investigations.some(inv => inv.id === l.id) ||
                                             (selectedVisit?.lab_requests || []).some(req => req.test_name === l.name);
                                         return l.name.toLowerCase().includes(query) && !isAlreadySelected;
                                     }).map(l => (
                                        <div key={l.id} 
                                             onMouseDown={(e) => {
                                                // 🎯 onMouseDown fires before onBlur, ensuring the selection is captured
                                                e.preventDefault(); 
                                                const isAlreadySelected = consultData.lab_investigations.some(inv => inv.id === l.id) ||
                                                    (selectedVisit?.lab_requests || []).some(req => req.test_name === l.name);
                                                if (!isAlreadySelected) {
                                                    setConsultData({
                                                        ...consultData, 
                                                        lab_investigations: [...consultData.lab_investigations, { id: l.id, name: l.name, code: l.code }]
                                                    });
                                                }
                                                setSearchLab("");
                                                setShowLabSearch(false);
                                             }}
                                             className="search-item search-item-hover"
                                             style={{ padding: '12px 15px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                             <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{l.name}</div>
                                             <div style={{ fontSize: '0.625rem', padding: '2px 8px', background: 'var(--background)', borderRadius: '6px', fontWeight: 700, color: 'var(--text-muted)' }}>{l.code}</div>
                                          </div>
                                          <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, marginTop: '2px' }}>{l.test_type_name} • {l.department_name}</div>
                                        </div>
                                     ))}
                                     {labMasters.filter(l => {
                                         const q = searchLab.toLowerCase();
                                         const isAlreadySelected = consultData.lab_investigations.some(inv => inv.id === l.id) ||
                                             (selectedVisit?.lab_requests || []).some(req => req.test_name === l.name);
                                         return l.name.toLowerCase().includes(q) && !isAlreadySelected;
                                     }).length === 0 && (
                                        <div style={{ padding: '20px', textAlign: 'center' }}>
                                           <p style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 600 }}>All available tests selected</p>
                                        </div>
                                     )}
                                  </div>
                                )}
                           </div>
                        </div>
 
                        {/* Investigations 'Falling' List */}
                        {(consultData.lab_investigations.length > 0 || (selectedVisit?.lab_requests || []).length > 0) && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {/* Historical / Existing Requests (Locked) */}
                                {(selectedVisit?.lab_requests || []).map((req, idx) => (
                                    <div key={`hist-${idx}`} className="fixed-lab-badge" style={{ padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
                                        <CheckCircle size={12} color="#10b981" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{req.test_name}</span>
                                        <span style={{ fontSize: '0.55rem', padding: '1px 5px', background: 'var(--background)', color: 'var(--text-muted)', borderRadius: '4px', fontWeight: 900 }}>FIXED</span>
                                    </div>
                                ))}
 
                                {/* New Additions */}
                                {consultData.lab_investigations.map((inv, idx) => (
                                    <div key={`new-${idx}`} className="fade-in new-lab-badge" style={{ padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: projectConfig?.primary_color ? projectConfig.primary_color + '0a' : '#f0f7ff', border: projectConfig?.primary_color ? `1px solid ${projectConfig.primary_color}40` : '1px solid #3b82f640', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                                        <FlaskConical size={12} color={projectConfig?.primary_color || "#2563eb"} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: projectConfig?.primary_color || '#1e40af' }}>{inv.name}</span>
                                        <button 
                                            type="button" 
                                            onMouseDown={(e) => {
                                                e.preventDefault(); 
                                                const updated = consultData.lab_investigations.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, lab_investigations: updated});
                                            }}
                                            style={{ border: 'none', background: 'transparent', padding: 0, color: projectConfig?.primary_color || '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                  )}
               </div>

               <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.875rem', fontWeight: 800, borderRadius: '12px', background: projectConfig?.primary_color ? projectConfig.primary_color : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: projectConfig?.primary_color ? `0 4px 12px ${projectConfig.primary_color}33` : '0 4px 12px rgba(99, 102, 241, 0.25)' }}>
                     Confirm and Transfer Case <ArrowRight size={16} style={{ marginLeft: '10px' }} />
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
      <style>{`
        /* Dark Mode Overrides for Clinical Workspace */
        :root.dark-theme .known-history-box {
          background: rgba(99, 102, 241, 0.1) !important;
          border: 1px solid rgba(99, 102, 241, 0.25) !important;
        }
        :root.dark-theme .known-history-title {
          color: #a5b4fc !important;
        }

        :root.dark-theme .systemic-exam-box {
          background: rgba(16, 185, 129, 0.1) !important;
          border: 1px solid rgba(16, 185, 129, 0.25) !important;
        }
        :root.dark-theme .systemic-exam-title {
          color: #34d399 !important;
        }

        :root.dark-theme .next-workflow-box {
          background: var(--surface) !important;
          border-color: var(--border) !important;
        }
        :root.dark-theme .next-workflow-title {
          color: var(--primary-light) !important;
        }
        :root.dark-theme .required-badge {
          background: rgba(239, 68, 68, 0.2) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
        }

        .workflow-btn {
          background: white;
          color: #475569;
          border: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .workflow-btn:hover {
          background: #f8fafc;
        }
        .workflow-btn.active-lab {
        }
        .workflow-btn.active-pharmacy {
        }
        .workflow-btn.active-completed {
        }

        :root.dark-theme .workflow-btn {
          background: var(--background);
          color: var(--text-muted);
        }
        :root.dark-theme .workflow-btn:hover {
          background: var(--border);
          color: var(--text-main);
        }
        :root.dark-theme .workflow-btn.active-lab {
        }
        :root.dark-theme .workflow-btn.active-pharmacy {
        }
        :root.dark-theme .workflow-btn.active-completed {
        }

        .patient-avatar-placeholder {
          background: #eff6ff;
          color: #2563eb;
          box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
        }
        :root.dark-theme .patient-avatar-placeholder {
          background: rgba(37, 99, 235, 0.1) !important;
          color: #60a5fa !important;
          box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.2) !important;
        }

        .badge-captured {
          background: #dcfce7;
          color: #166534;
        }
        :root.dark-theme .badge-captured {
          background: rgba(22, 101, 52, 0.2) !important;
          color: #4ade80 !important;
        }

        .examining-badge {
          background: #dcfce7;
          color: #166534;
        }
        :root.dark-theme .examining-badge {
          background: rgba(22, 101, 52, 0.2) !important;
          color: #4ade80 !important;
        }

        .view-history-btn {
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          color: #6d28d9;
        }
        :root.dark-theme .view-history-btn {
          background: rgba(109, 40, 217, 0.15) !important;
          border-color: rgba(109, 40, 217, 0.3) !important;
          color: #a78bfa !important;
        }

        .inventory-count-badge {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }
        :root.dark-theme .inventory-count-badge {
          background: var(--background) !important;
          color: var(--text-muted) !important;
          border-color: var(--border) !important;
        }

        .search-dropdown {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        :root.dark-theme .search-dropdown {
          background: var(--surface) !important;
          border-color: var(--border) !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.4) !important;
        }

        .search-dropdown-item {
          background: white;
        }
        .search-dropdown-item:hover {
          background: #f8fafc !important;
        }
        :root.dark-theme .search-dropdown-item {
          background: var(--surface) !important;
        }
        :root.dark-theme .search-dropdown-item:hover {
          background: var(--background) !important;
        }

        .stock-indicator.stock-high {
          color: #166534;
          background: #dcfce7;
          border: 1px solid rgba(22, 101, 52, 0.25);
        }
        .stock-indicator.stock-low {
          color: #b45309;
          background: #fef3c7;
          border: 1px solid rgba(180, 83, 9, 0.25);
        }
        .stock-indicator.stock-empty {
          color: #ef4444;
          background: #fee2e2;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        :root.dark-theme .stock-indicator.stock-high {
          color: #4ade80;
          background: rgba(22, 101, 52, 0.25);
          border-color: rgba(74, 222, 128, 0.2);
        }
        :root.dark-theme .stock-indicator.stock-low {
          color: #fbbf24;
          background: rgba(180, 83, 9, 0.25);
          border-color: rgba(251, 191, 36, 0.2);
        }
        :root.dark-theme .stock-indicator.stock-empty {
          color: #f87171;
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(248, 113, 113, 0.2);
        }

        .stock-status-badge.in-stock {
          background: #f0fdf4;
          color: #10b981;
          border: 1px solid #dcfce7;
        }
        .stock-status-badge.low-stock {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        :root.dark-theme .stock-status-badge.in-stock {
          background: rgba(16, 185, 129, 0.15) !important;
          color: #34d399 !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
        }
        :root.dark-theme .stock-status-badge.low-stock {
          background: rgba(245, 158, 11, 0.15) !important;
          color: #fbbf24 !important;
          border-color: rgba(245, 158, 11, 0.3) !important;
        }

        .edit-med-btn {
          background: #eff6ff;
          color: #2563eb;
        }
        :root.dark-theme .edit-med-btn {
          background: rgba(37, 99, 235, 0.15) !important;
          color: #60a5fa !important;
        }
        .delete-med-btn {
          background: #fef2f2;
          color: #ef4444;
        }
        :root.dark-theme .delete-med-btn {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
        }

        .fixed-lab-badge {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        :root.dark-theme .fixed-lab-badge {
          background: var(--background) !important;
          border-color: var(--border) !important;
        }

        .new-lab-badge {
          background: #eff6ff;
          border: 1px solid #3b82f6;
        }
        :root.dark-theme .new-lab-badge {
          background: rgba(59, 130, 246, 0.15) !important;
          border-color: rgba(59, 130, 246, 0.3) !important;
        }

        .units-input {
          background: #fff1f2 !important;
          color: #be185d !important;
          border: 2px solid #fce7f3 !important;
        }
        :root.dark-theme .units-input {
          background: rgba(244, 63, 94, 0.1) !important;
          color: #fb7185 !important;
          border-color: rgba(244, 63, 94, 0.2) !important;
        }

        .history-tab-btn {
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
        }
        .history-tab-btn.active {
          border-color: #6366f1;
          background: #eff6ff;
          color: #4338ca;
        }
        :root.dark-theme .history-tab-btn {
          border-color: var(--border);
          background: var(--background);
          color: var(--text-muted);
        }
        :root.dark-theme .history-tab-btn.active {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary-light);
        }

        .history-med-item {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
        }
        .history-med-name {
          color: #1e293b;
        }
        :root.dark-theme .history-med-item {
          background: var(--background);
          border-color: var(--border);
        }
        :root.dark-theme .history-med-name {
          color: var(--text-main);
        }

        .history-lab-item {
          border: 1px solid #f1f5f9;
        }
        .history-lab-name {
          color: #0f172a;
        }
        :root.dark-theme .history-lab-item {
          border-color: var(--border);
        }
        :root.dark-theme .history-lab-name {
          color: var(--text-main);
        }

        /* Override existing light-only properties in dark theme */
        :root.dark-theme .reference-panel { 
            background: var(--surface) !important; 
            border-color: var(--border) !important; 
        }
        :root.dark-theme .reference-header { 
            border-bottom-color: var(--border) !important; 
            background: var(--background) !important; 
        }
        :root.dark-theme .dossier-title { 
            color: var(--text-main) !important; 
        }
        :root.dark-theme .dossier-close { 
            background: var(--background) !important; 
            color: var(--text-muted) !important; 
        }
        :root.dark-theme .snapshot-item { 
            background: var(--background) !important; 
            border-color: var(--border) !important; 
        }
        :root.dark-theme .item-value { 
            color: var(--text-main) !important; 
        }
        :root.dark-theme .diagnosis-box { 
            background: rgba(245, 158, 11, 0.1) !important; 
            border-color: var(--accent) !important; 
        }
        :root.dark-theme .diagnosis-text { 
            color: var(--accent) !important; 
        }
        :root.dark-theme .med-row { 
            background: var(--background) !important; 
            border-color: var(--border) !important; 
        }
        :root.dark-theme .med-name { 
            color: var(--text-main) !important; 
        }
        :root.dark-theme .lab-card { 
            background: var(--background) !important; 
            border-color: var(--border) !important; 
        }
        :root.dark-theme .lab-name { 
            color: var(--text-main) !important; 
        }
        :root.dark-theme .param-val { 
            color: var(--text-main) !important; 
        }
        :root.dark-theme .dossier-footer { 
            background: var(--surface) !important; 
        }
        :root.dark-theme .dossier-confirm-btn { 
            background: var(--primary) !important; 
            color: white !important; 
        }

        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -468px 0; }
          100% { background-position: 468px 0; }
        }
        .skeleton {
          background: #f6f7f8;
          background-image: linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%);
          background-repeat: no-repeat;
          background-size: 800px 104px;
          display: inline-block;
          position: relative;
          animation: shimmer 1.5s infinite linear;
        }
        textarea { border-radius: 12px !important; padding: 0.75rem !important; }
        
        /* MNC Enterprise Workspace System 🏢 */
        .workspace-split { display: flex; flex-direction: column; height: 100%; gap: 1rem; }
        .reference-panel { 
            background: #f8fafc; 
            border: 2px solid #e2e8f0; 
            border-radius: 24px; 
            height: 420px; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden; 
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);
            animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .reference-header { padding: 1.25rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white; }
        .reference-content { flex: 1; overflow-y: auto; padding: 1.5rem 2rem; }
        .active-consult-panel { flex: 1; min-height: 0; overflow-y: auto; }
        
        .dossier-icon-box { width: 42px; height: 42px; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .dossier-title { font-size: 1.15rem; font-weight: 950; color: #1e293b; letter-spacing: -0.02em; margin: 0; }
        .dossier-badge { font-size: 0.65rem; padding: 3px 8px; background: #e0e7ff; color: #4338ca; border-radius: 6px; font-weight: 900; }
        .dossier-subtitle { font-size: 0.8125rem; color: #64748b; fontWeight: 600; margin-top: 2px; }
        .dossier-close { border: none; background: white; width: 40px; height: 40px; border-radius: 14px; cursor: pointer; color: #64748b; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; }
        
        .dossier-content { flex: 1; overflow-y: auto; padding: 2.5rem; }
        .dossier-grid { display: grid; grid-template-columns: 320px 1fr; gap: 3rem; }
        .dossier-sidebar { display: flex; flex-direction: column; gap: 2rem; }
        .section-label { font-size: 0.7rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; }
        .section-label-alt { font-size: 0.625rem; font-weight: 900; color: #c2410c; text-transform: uppercase; margin-bottom: 8px; }
        
        .snapshot-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .snapshot-item { display: flex; justify-content: space-between; padding: 0.875rem 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; }
        .item-label { font-size: 0.75rem; font-weight: 700; color: #64748b; }
        .item-value { font-size: 0.75rem; font-weight: 800; color: #1e293b; }
        
        .diagnosis-box { padding: 1.25rem; background: #fff7ed; border-radius: 20px; border: 1px dotted #fb923c; }
        .diagnosis-text { font-size: 0.875rem; font-weight: 800; color: #9a3412; line-height: 1.5; margin: 0; }
        
        .dossier-main { display: flex; flex-direction: column; }
        .section-header { font-size: 0.875rem; font-weight: 900; color: #1e293b; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px; }
        .med-row { padding: 1rem; background: white; border: 1.2px solid #e2e8f0; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; }
        .med-name { font-size: 0.875rem; font-weight: 800; color: #1e293b; margin: 0; }
        .med-meta { font-size: 0.7rem; color: #64748b; font-weight: 600; margin: 0; }
        .med-qty { font-size: 0.8125rem; font-weight: 900; color: #6366f1; margin: 0; }
        .qty-label { font-size: 0.55rem; font-weight: 800; color: #94a3b8; margin: 0; }
        
        .lab-card { padding: 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 24px; }
        .lab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; }
        .lab-name { font-size: 0.9375rem; font-weight: 950; color: #1e293b; margin: 0; }
        .lab-dept { font-size: 0.65rem; color: #64748b; font-weight: 700; margin: 0; }
        .status-badge { font-size: 0.625rem; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 8px; font-weight: 900; }
        
        .lab-table { width: 100%; border-collapse: collapse; text-align: left; }
        .lab-table th { padding: 0.5rem; font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .lab-table tr { border-bottom: 1px solid #f1f5f9; }
        .param-name { padding: 0.75rem 0.5rem; font-size: 0.75rem; font-weight: 700; color: #475569; }
        .param-val { padding: 0.75rem 0.5rem; font-size: 0.8125rem; font-weight: 900; color: #1e293b; }
        .param-val span { font-size: 0.6rem; color: #94a3b8; }
        .param-range { padding: 0.75rem 0.5rem; font-size: 0.6875rem; font-weight: 700; color: #64748b; }
        
        .dossier-footer { padding: 1.5rem 2.5rem; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: right; }
        .dossier-confirm-btn { padding: 0.75rem 2.5rem; border-radius: 14px; font-weight: 800; background: #1e293b; border: none; color: white; cursor: pointer; transition: 0.2s; }
        .dossier-confirm-btn:hover { background: #000; }
         .empty-text { font-size: 0.8125rem; color: #94a3b8; font-style: italic; }

         .search-container {
            position: relative;
            width: 250px;
         }
         .search-input {
            padding-left: 2.5rem !important;
            border-radius: 12px !important;
            font-size: 0.75rem !important;
            background: var(--background) !important;
         }
         
         @media (max-width: 640px) {
            .search-container {
               width: 100%;
            }
         }

         @media (max-width: 1200px) {
            .dossier-card { right: 2rem; } /* Overlays the drawer on smaller screens */
        }
        
        @media (max-width: 900px) {
            .dossier-grid { grid-template-columns: 1fr; gap: 2rem; }
            .dossier-overlay { padding: 0.5rem; }
            .dossier-card { top: 0.5rem; bottom: 0.5rem; left: 0.5rem; right: 0.5rem; border-radius: 20px; }
            .dossier-header { padding: 1.25rem; }
            .dossier-content { padding: 1.25rem; }
        }
      `}</style>

    </div>

      {lightboxImage && (
          <div 
              style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99999,
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  userSelect: 'none'
              }}
              onKeyDown={(e) => {
                  if (e.key === 'Escape') setLightboxImage(null);
              }}
              tabIndex={0}
          >
              {/* Top Control Bar */}
              <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 2rem',
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white'
              }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Image size={18} color={projectConfig?.primary_color || 'var(--primary)'} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Interactive Imaging Viewer</span>
                  </div>
                  
                  {/* Toolbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                              type="button"
                              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Zoom Out"
                          >
                              <ZoomOut size={16} />
                          </button>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, width: '45px', textAlign: 'center' }}>
                              {Math.round(zoom * 100)}%
                          </span>
                          <button 
                              type="button"
                              onClick={() => setZoom(prev => Math.min(prev + 0.25, 5))}
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Zoom In"
                          >
                              <ZoomIn size={16} />
                          </button>
                      </div>

                      <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                      {/* Rotate Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                              type="button"
                              onClick={() => setRotation(prev => (prev - 90) % 360)}
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Rotate Counter-Clockwise"
                          >
                              <RotateCcw size={16} />
                          </button>
                          
                          {/* Fine Rotation Slider */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px' }}>
                              <input 
                                  type="range" 
                                  min="-180" 
                                  max="180" 
                                  step="1" 
                                  value={rotation} 
                                  onChange={(e) => setRotation(parseInt(e.target.value))}
                                  style={{ width: '80px', cursor: 'pointer' }}
                                  title="Rotate Angle"
                              />
                              <span style={{ fontSize: '0.725rem', fontWeight: 800, minWidth: '35px', textAlign: 'right' }}>{rotation}°</span>
                          </div>

                          <button 
                              type="button"
                              onClick={() => setRotation(prev => (prev + 90) % 360)}
                              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Rotate Clockwise"
                          >
                              <RotateCw size={16} />
                          </button>
                      </div>

                      <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                      {/* Flip Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                              type="button"
                              onClick={() => setFlipH(prev => !prev)}
                              style={{ 
                                  background: flipH ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                  border: 'none', 
                                  color: 'white', 
                                  width: '32px', 
                                  height: '32px', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  transition: 'background 0.2s'
                              }}
                              title="Flip Horizontally"
                          >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M13 3l9 9-9 9" />
                                  <path d="M11 3L2 12l9 9" />
                                  <path d="M12 2v20" strokeDasharray="3" />
                              </svg>
                          </button>
                          <button 
                              type="button"
                              onClick={() => setFlipV(prev => !prev)}
                              style={{ 
                                  background: flipV ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                                  border: 'none', 
                                  color: 'white', 
                                  width: '32px', 
                                  height: '32px', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  transition: 'background 0.2s'
                              }}
                              title="Flip Vertically"
                          >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}>
                                  <path d="M13 3l9 9-9 9" />
                                  <path d="M11 3L2 12l9 9" />
                                  <path d="M12 2v20" strokeDasharray="3" />
                              </svg>
                          </button>
                      </div>

                      <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sun size={16} title="Brightness" />
                          <input 
                              type="range" 
                              min="0.5" 
                              max="2" 
                              step="0.1" 
                              value={brightness} 
                              onChange={(e) => setBrightness(parseFloat(e.target.value))}
                              style={{ width: '80px', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{Math.round(brightness * 100)}%</span>
                      </div>

                      <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                      <button 
                          type="button"
                          onClick={() => {
                              setZoom(1);
                              setRotation(0);
                              setBrightness(1);
                              setFlipH(false);
                              setFlipV(false);
                              setPan({ x: 0, y: 0 });
                          }}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Reset Layout"
                      >
                          <RefreshCw size={16} />
                      </button>
                  </div>

                  <button 
                      type="button"
                      onClick={() => setLightboxImage(null)}
                      style={{ background: '#ef4444', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                      <X size={18} />
                  </button>
              </div>

              {/* View Stage */}
              <div 
                  style={{
                      flex: 1,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={(e) => {
                      if (e.target.tagName === 'IMG') {
                          e.preventDefault();
                          setIsDragging(true);
                          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                      }
                  }}
                  onMouseMove={(e) => {
                      if (!isDragging) return;
                      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                  }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  onWheel={(e) => {
                      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                      setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.5), 5));
                  }}
              >
                  <img 
                      src={lightboxImage} 
                      alt="Diagnostic imaging details" 
                      style={{
                          maxWidth: '90%',
                          maxHeight: '90%',
                          objectFit: 'contain',
                          transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                          filter: `brightness(${brightness})`,
                          transition: isDragging ? 'none' : 'transform 0.15s ease-out, filter 0.15s ease-out',
                          pointerEvents: 'auto',
                          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                      }}
                  />
                  <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15, 23, 42, 0.7)', padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.6875rem', pointerEvents: 'none', fontWeight: 800 }}>
                      Use mouse wheel to zoom. Drag to pan/move scan.
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

const HistoryBadge = ({ label, value, color, variant }) => {
    const isPositive = value === 'YES' || (value && value !== 'NO' && value !== 'NAD' && value !== 'VEG' && value !== 'NONE');
    const displayValue = value || '--';
    
    if (variant === 'filled') {
        return (
            <div style={{ padding: '4px 10px', background: isPositive ? '#fecaca' : '#d1fae5', borderRadius: '8px', border: `1px solid ${isPositive ? '#f87171' : '#6ee7b7'}`, display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#475569' }}>{label}:</span>
                <span style={{ fontSize: '0.625rem', fontWeight: 900, color: isPositive ? '#991b1b' : '#065f46' }}>{displayValue}</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '3px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569' }}>{label}:</span>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: isPositive ? (color || '#ef4444') : '#10b981' }}>{displayValue}</span>
        </div>
    );
};

const ExamItem = ({ label, value }) => {
    const isAbnormal = value === 'FND';
    return (
        <div style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <p style={{ fontSize: '0.55rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: isAbnormal ? '#dc2626' : '#0f5132' }}>{value || '--'}</p>
        </div>
    );
};

export default Clinical;
