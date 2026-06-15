import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  Search, 
  Plus, 
  Check, 
  X, 
  Package, 
  AlertCircle, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Send,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Phone,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

const Indents = ({ isEmbed = false, embedRoom = 'Nurse Room', embedTab = null, isPharmacy = false }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Tab Permission Checks
  const userPerms = user?.permissions || [];
  const canViewInventory = userPerms.includes('/indents/inventory') || user?.role === 'ADMIN';
  const canViewApproval = userPerms.includes('/indents/approval') || user?.role === 'ADMIN';
  const canViewIndents = userPerms.includes('/indents') || user?.role === 'ADMIN';
  const isPharmacyUser = isPharmacy || user?.role === 'PHARMACIST' || user?.role === 'PHARMACY' || userPerms.includes('/pharmacy');

  const [activeTab, setActiveTab] = useState(() => {
    if (isEmbed && embedTab) return embedTab;
    const stateTab = location.state?.activeTab;
    if (stateTab === 'approval' && canViewApproval) return 'approval';
    if ((stateTab === 'inventory' || stateTab === 'indents') && canViewInventory) return 'inventory';
    if (canViewInventory) return 'inventory';
    if (canViewApproval) return 'approval';
    return 'inventory';
  });

  const [activeSubTab, setActiveSubTab] = useState(() => {
    const stateTab = location.state?.activeTab;
    if (stateTab === 'indents') return 'replenishment_log';
    return 'stock_list';
  });
  
  // Custom Confirmation Dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const [projectConfig, setProjectConfig] = useState(null);
  const [isTabInitialized, setIsTabInitialized] = useState(false);
  const [isRoomInitialized, setIsRoomInitialized] = useState(false);
  
  // Data lists
  const [inventoryList, setInventoryList] = useState([]);
  const [indentsList, setIndentsList] = useState([]);
  const [dispensationsList, setDispensationsList] = useState([]);
  const [registryDrugs, setRegistryDrugs] = useState([]);
  const [patientResults, setPatientResults] = useState([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmiting, setIsSubmiting] = useState(false);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(() => {
    if (isEmbed) return embedRoom;
    return location.state?.activeRoom || 'Nurse Room';
  }); // e.g. Nurse Room, Lab Room
  
  // Pagination states
  const [stockPage, setStockPage] = useState(1);
  const [replenishPage, setReplenishPage] = useState(1);
  const [dispensePage, setDispensePage] = useState(1);
  const [approvalPage, setApprovalPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setStockPage(1);
    setReplenishPage(1);
    setDispensePage(1);
    setApprovalPage(1);
    setHistoryPage(1);
  }, [selectedRoom, searchQuery, activeSubTab, activeTab]);
  
  // Modal states
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [dispenseItems, setDispenseItems] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const medDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsRoomDropdownOpen(false);
      }
      if (medDropdownRef.current && !medDropdownRef.current.contains(event.target)) {
        setIsMedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dispensing Form state
  const [dispenseForm, setDispenseForm] = useState({
    recipient_type: 'PATIENT',
    patient_id: '',
    patient_name_search: '',
    outside_patient_name: '',
    outside_patient_aadhaar: '',
    outside_patient_phone: '',
    outside_patient_details: '',
    quantity: 1
  });

  // Indent Form state
  const [indentForm, setIndentForm] = useState({
    requesting_location: isEmbed ? embedRoom : 'Nurse Room',
    items: [] // { medication_name: '', requested_quantity: 1, registry_item: null }
  });

  // Doctor Approval Form state
  const [approvalItems, setApprovalItems] = useState([]); // [{ id, approved_quantity, name, requested }]
  const [doctorRemarks, setDoctorRemarks] = useState('');

  // Sync selected room if embedding changes dynamically
  useEffect(() => {
    if (isEmbed) {
      setSelectedRoom(embedRoom);
      setIndentForm(f => ({ ...f, requesting_location: embedRoom }));
      if (embedTab) {
        setActiveTab(embedTab);
      }
    }
  }, [isEmbed, embedRoom, embedTab]);

  // Auto-fill Requesting Room based on user role or router state (run once when user loads)
  useEffect(() => {
    if (isEmbed) {
      setSelectedRoom(embedRoom);
      setIndentForm(f => ({ ...f, requesting_location: embedRoom }));
      setIsRoomInitialized(true);
      return;
    }
    if (user && !isRoomInitialized) {
      const stateRoom = location.state?.activeRoom;
      if (stateRoom) {
        setSelectedRoom(stateRoom);
        setIndentForm(f => ({ ...f, requesting_location: stateRoom }));
      } else if (user.role === 'LAB_TECH' || user.role === 'LABORATORY') {
        setSelectedRoom('Lab Room');
        setIndentForm(f => ({ ...f, requesting_location: 'Lab Room' }));
      } else {
        setSelectedRoom('Nurse Room');
        setIndentForm(f => ({ ...f, requesting_location: 'Nurse Room' }));
      }
      setIsRoomInitialized(true);
    }
  }, [user, isRoomInitialized, location.state, isEmbed, embedRoom]);

  const renderPagination = (currentPage, totalItems, onPageChange) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startEntry = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endEntry = Math.min(currentPage * itemsPerPage, totalItems);

    const buttons = [];
    const maxVisiblePages = 5;

    // Always show page 1
    buttons.push(
      <button 
        key={1} 
        disabled={totalPages <= 1}
        onClick={() => onPageChange(1)}
        style={{ 
          width: '32px', height: '32px', borderRadius: '8px', border: 'none',
          background: currentPage === 1 ? 'var(--primary)' : 'transparent',
          color: currentPage === 1 ? 'white' : 'var(--text-muted)',
          fontWeight: 700, cursor: totalPages <= 1 ? 'not-allowed' : 'pointer', transition: '0.3s'
        }}
      >
        1
      </button>
    );

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, maxVisiblePages - 1);
    }
    if (currentPage >= totalPages - 2) {
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
            onClick={() => onPageChange(i)}
            style={{ 
              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
              background: currentPage === i ? 'var(--primary)' : 'transparent',
              color: currentPage === i ? 'white' : 'var(--text-muted)',
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
          onClick={() => onPageChange(totalPages)}
          style={{ 
            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
            background: currentPage === totalPages ? 'var(--primary)' : 'transparent',
            color: currentPage === totalPages ? 'white' : 'var(--text-muted)',
            fontWeight: 700, cursor: 'pointer', transition: '0.3s'
          }}
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap', gap: '1rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
          Showing <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{startEntry}-{endEntry}</span> of <span style={{ fontWeight: 800 }}>{totalItems}</span> records
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            disabled={currentPage === 1 || totalPages <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={{ padding: '0.4rem', borderRadius: '8px', opacity: (currentPage === 1 || totalPages <= 1) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: (currentPage === 1 || totalPages <= 1) ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {buttons}
          </div>
          <button 
            className="btn btn-secondary" 
            disabled={currentPage === totalPages || totalPages <= 1}
            onClick={() => onPageChange(currentPage + 1)}
            style={{ padding: '0.4rem', borderRadius: '8px', opacity: (currentPage === totalPages || totalPages <= 1) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: '32px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: (currentPage === totalPages || totalPages <= 1) ? 'not-allowed' : 'pointer' }}
          >
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>
    );
  };

  // Set first allowed tab when user permissions load (run once when user loads)
  useEffect(() => {
    if (user && !isTabInitialized) {
      const stateTab = location.state?.activeTab;
      if (stateTab === 'approval' && canViewApproval) {
        setActiveTab('approval');
      } else if ((stateTab === 'inventory' || stateTab === 'indents') && canViewInventory) {
        setActiveTab('inventory');
      } else {
        if (canViewInventory) {
          setActiveTab('inventory');
        } else if (canViewApproval) {
          setActiveTab('approval');
        }
      }
      setIsTabInitialized(true);
    }
  }, [user, canViewInventory, canViewApproval, isTabInitialized, location.state]);

  // Sync state if navigation state changes while mounted
  useEffect(() => {
    if (location.state?.activeTab) {
      if (location.state.activeTab === 'indents') {
        setActiveTab('inventory');
        setActiveSubTab('replenishment_log');
      } else {
        setActiveTab(location.state.activeTab);
        if (location.state.activeTab === 'inventory') {
          setActiveSubTab('stock_list');
        }
      }
    }
    if (location.state?.activeRoom) {
      setSelectedRoom(location.state.activeRoom);
      setIndentForm(f => ({ ...f, requesting_location: location.state.activeRoom }));
    }
  }, [location.state]);

  // Load everything initial
  useEffect(() => {
    fetchData();
    fetchRegistryDrugs();
    if (user?.project) {
      fetchProjectConfig(user.project.id || user.project);
    }
  }, [user, activeTab, activeSubTab, selectedRoom, user?.project]);

  // Background Polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, activeSubTab, selectedRoom, user, user?.project]);

  const fetchProjectConfig = async (projectId) => {
    try {
      const res = await api.get(`patients/projects/${projectId}/`);
      setProjectConfig(res.data);
    } catch (err) {
      console.error('Failed to fetch project config:', err);
    }
  };

  const fetchRegistryDrugs = async () => {
    let url = 'patients/registry-data/?all=true&type_category=CLINICAL_DRUGS,PHARMACY&registry_type__slug=pharmacy,pharmacy_drugs,pharmacy_inventory';
    if (user?.project) {
      const pid = user.project.id || user.project;
      if (pid && pid !== 'undefined') {
        url += `&project=${pid}`;
      }
    }
    try {
      const res = await api.get(url);
      setRegistryDrugs(res.data.results || res.data || []);
    } catch (e) {
      console.error('Failed to load pharmacy drugs registry:', e);
    }
  };

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const projectId = user?.project?.id || user?.project;
      const projectQuery = (projectId && projectId !== 'undefined') ? `&project=${projectId}` : '';
      if (activeTab === 'inventory') {
        const [stockRes, dispRes, indentsRes] = await Promise.all([
          api.get(`pharmacy/room-stock/?location=${encodeURIComponent(selectedRoom)}${projectQuery}`),
          api.get(`pharmacy/room-dispensation/?page_size=1000${projectQuery}`),
          api.get(`pharmacy/indents/?page_size=1000${projectQuery}`)
        ]);
        setInventoryList(stockRes.data.results || stockRes.data || []);
        const allDisps = dispRes.data.results || dispRes.data || [];
        setDispensationsList(allDisps.filter(d => d.location === selectedRoom));
        setIndentsList(indentsRes.data.results || indentsRes.data || []);
      } else if (activeTab === 'indents' || activeTab === 'approval') {
        const res = await api.get(`pharmacy/indents/?page_size=1000${projectQuery}`);
        setIndentsList(res.data.results || res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch indents/stock data:', err);
      if (!isBackground) toast.error('Failed to sync data');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  // Autocomplete patient search
  const handlePatientSearch = async (val) => {
    setDispenseForm(f => ({ ...f, patient_name_search: val }));
    if (val.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const projectId = user?.project?.id || user?.project;
      const projectQuery = (projectId && projectId !== 'undefined') ? `&project=${projectId}` : '';
      const res = await api.get(`patients/patients/?search=${encodeURIComponent(val)}${projectQuery}`);
      setPatientResults(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to search patients:', err);
    }
  };

  // Raise Indent Request API Submission
  const handleRaiseIndent = async (e) => {
    e.preventDefault();
    if (!indentForm.items.length) {
      toast.error('Add at least one medicine item');
      return;
    }
    setIsSubmiting(true);
    try {
      const payload = {
        requesting_location: indentForm.requesting_location,
        items: indentForm.items.map(i => ({
          medication_name: i.medication_name,
          requested_quantity: i.requested_quantity
        }))
      };
      await api.post('pharmacy/indents/', payload);
      toast.success('Replenishment indent request raised successfully!');
      setShowRequestModal(false);
      setIndentForm(f => ({ ...f, items: [] }));
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to submit indent request';
      toast.error(errorMsg);
    } finally {
      setIsSubmiting(false);
    }
  };

  // Dispense Stock API Submission
  const handleDispenseStock = async (e) => {
    e.preventDefault();
    if (!dispenseItems || dispenseItems.length === 0) {
      toast.error('Please add at least one medication to dispense');
      return;
    }
    for (const item of dispenseItems) {
      if (item.quantity > item.max_quantity) {
        toast.error(`Dispensed quantity for ${item.name} cannot exceed available room stock (${item.max_quantity})!`);
        return;
      }
      if (item.quantity <= 0) {
        toast.error(`Dispensed quantity for ${item.name} must be greater than zero!`);
        return;
      }
    }
    if (dispenseForm.recipient_type === 'OUTSIDE_PATIENT') {
      if (!dispenseForm.outside_patient_name) {
        toast.error('Walk-In Patient Name is required');
        return;
      }
    } else {
      if (!dispenseForm.patient_id) {
        toast.error('Please select a registered patient');
        return;
      }
    }

    setIsSubmiting(true);
    try {
      const payload = {
        recipient_type: dispenseForm.recipient_type,
        patient_id: dispenseForm.recipient_type === 'PATIENT' ? dispenseForm.patient_id : null,
        outside_patient_name: dispenseForm.recipient_type === 'OUTSIDE_PATIENT' ? dispenseForm.outside_patient_name : '',
        outside_patient_aadhaar: dispenseForm.recipient_type === 'OUTSIDE_PATIENT' ? dispenseForm.outside_patient_aadhaar : '',
        outside_patient_phone: dispenseForm.recipient_type === 'OUTSIDE_PATIENT' ? dispenseForm.outside_patient_phone : '',
        outside_patient_details: dispenseForm.outside_patient_details,
        items: dispenseItems.map(di => ({
          room_stock_id: di.room_stock_id,
          quantity: di.quantity
        }))
      };
      await api.post('pharmacy/room-dispensation/', payload);
      toast.success('Medicine(s) dispensed successfully!');
      setShowDispenseModal(false);
      // Reset form
      setDispenseForm({
        recipient_type: 'PATIENT',
        patient_id: '',
        patient_name_search: '',
        outside_patient_name: '',
        outside_patient_aadhaar: '',
        outside_patient_phone: '',
        outside_patient_details: '',
        quantity: 1
      });
      setDispenseItems([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Dispensation failed');
    } finally {
      setIsSubmiting(false);
    }
  };

  // Cancel Indent (Nurse)
  const handleCancelIndent = (id) => {
    setConfirmDialog({
      show: true,
      title: 'Cancel Indent Request',
      message: 'Are you sure you want to cancel this indent request? This will permanently close the replenishment request.',
      onConfirm: async () => {
        try {
          await api.post(`pharmacy/indents/${id}/cancel/`);
          toast.success('Indent request cancelled');
          fetchData();
        } catch (err) {
          console.error('Failed to cancel indent:', err);
          toast.error('Failed to cancel indent');
        }
      }
    });
  };

  // Fulfill and Dispense to Room Stock (Pharmacist)
  const handleDispenseIndent = (id) => {
    setConfirmDialog({
      show: true,
      title: 'Fulfill & Dispense Indent',
      message: 'Are you sure you want to dispense medicines for this indent? The items will be immediately transferred to the sub-store stock.',
      onConfirm: async () => {
        const loadingToast = toast.loading('Transferring stocks to sub-store...');
        try {
          await api.post(`pharmacy/indents/${id}/dispense/`);
          toast.success('Indent fulfilled! Room stock updated successfully.', { id: loadingToast });
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Failed to dispense indent', { id: loadingToast });
        }
      }
    });
  };

  // Review & Approve Indent (Doctor)
  const handleOpenApproval = (indent) => {
    setSelectedIndent(indent);
    setApprovalItems(indent.items.map(i => ({
      id: i.id,
      medication_name: i.medication_name,
      requested_quantity: i.requested_quantity,
      approved_quantity: i.requested_quantity // Default to fully requested
    })));
    setDoctorRemarks('');
    setShowApprovalModal(true);
  };

  const handleApproveIndentSubmit = async (statusType) => {
    setIsSubmiting(true);
    try {
      if (statusType === 'APPROVED') {
        const payload = {
          items: approvalItems.map(i => ({
            id: i.id,
            approved_quantity: i.approved_quantity
          })),
          doctor_remarks: doctorRemarks
        };
        await api.post(`pharmacy/indents/${selectedIndent.id}/approve/`, payload);
        toast.success('Indent replenishment request approved!');
      } else {
        await api.post(`pharmacy/indents/${selectedIndent.id}/reject/`, {
          doctor_remarks: doctorRemarks
        });
        toast.error('Indent request rejected');
      }
      setShowApprovalModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setIsSubmiting(false);
    }
  };

  // Helpers for formatting UI badges
  const getStatusBadge = (statusVal) => {
    const configs = {
      'PENDING_APPROVAL': { text: 'Pending Approval', bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706', icon: Clock },
      'APPROVED': { text: 'Approved (Pending Pharmacy)', bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', icon: AlertCircle },
      'DISPENSED': { text: 'Fulfilled & Dispensed', bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', icon: CheckCircle2 },
      'REJECTED': { text: 'Rejected by Doctor', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', icon: XCircle },
      'CANCELLED': { text: 'Cancelled', bg: 'rgba(100, 116, 139, 0.1)', color: '#475569', icon: XCircle }
    };
    const c = configs[statusVal] || { text: statusVal, bg: '#f1f5f9', color: '#475569', icon: Clock };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0.25rem 0.75rem',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 700,
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.color}20`
      }}>
        <c.icon size={12} />
        {c.text}
      </span>
    );
  };

  // Indent Item Request Helpers
  const [selectedDrugSearch, setSelectedDrugSearch] = useState('');
  const [selectedDrugQty, setSelectedDrugQty] = useState(1);
  const [drugResults, setDrugResults] = useState([]);
  const [selectedDrugObj, setSelectedDrugObj] = useState(null);

  const searchRegistryDrug = (val) => {
    setSelectedDrugSearch(val);
    setSelectedDrugObj(null);
    if (!val.trim()) {
      setDrugResults([]);
      return;
    }
    const filtered = registryDrugs.filter(d => 
      (d.quantity || 0) > 0 && (
        d.name.toLowerCase().includes(val.toLowerCase()) || 
        (d.code && d.code.toLowerCase().includes(val.toLowerCase())) ||
        (d.ucode && d.ucode.toLowerCase().includes(val.toLowerCase())) ||
        (d.item_code && d.item_code.toLowerCase().includes(val.toLowerCase()))
      )
    ).slice(0, 8);
    setDrugResults(filtered);
  };

  const addDrugToIndent = (drug) => {
    if (selectedDrugQty > (drug.quantity || 0)) {
      toast.error(`Requested quantity for ${drug.name} cannot exceed available pharmacy stock (${drug.quantity || 0})!`);
      return;
    }
    if (indentForm.items.some(i => i.medication_name.toLowerCase() === drug.name.toLowerCase())) {
      toast.error('Medication is already added to request list');
      return;
    }
    setIndentForm(f => ({
      ...f,
      items: [...f.items, {
        medication_name: drug.name,
        requested_quantity: selectedDrugQty,
        registry_item: drug
      }]
    }));
    setSelectedDrugSearch('');
    setSelectedDrugQty(1);
    setSelectedDrugObj(null);
    setDrugResults([]);
  };

  if (!canViewInventory && !canViewIndents && !canViewApproval) {
    return (
      <div className="fade-in" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh', 
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', background: 'var(--surface)', padding: '3rem', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.03)', maxWidth: '440px', border: '1px solid var(--border)' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <ShieldAlert size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            You do not have permission to view any sub-modules within Room Stock & Replenishment. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: isEmbed ? '0' : '0.5rem' }}>
      <style>{`
        .custom-search-input {
          padding-left: 2.75rem !important;
        }
      `}</style>
      {!isEmbed && (
        <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Room Stock & Replenishment</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage local sub-store inventory and pharmacy indent requests</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {activeTab !== 'approval' ? (
            <>
              {isPharmacyUser || !(user?.role === 'NURSE' || user?.role === 'LAB_TECH' || user?.role === 'LABORATORY') ? (
                <select 
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  style={{ 
                    padding: '0.625rem 1.25rem', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--surface)',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: 'var(--text-main)',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
                  }}
                >
                  <option value="Nurse Room">Nurse Room Inventory</option>
                  <option value="Lab Room">Laboratory Room Inventory</option>
                </select>
              ) : (
                <button 
                  onClick={() => {
                    if (selectedRoom === 'Lab Room') {
                      navigate('/lab');
                    } else {
                      navigate('/vitals');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                >
                  <ArrowLeft size={16} style={{ color: 'var(--primary)' }} />
                  {selectedRoom === 'Lab Room' ? 'Back to Laboratory Hub' : 'Back to Nursing Station'}
                </button>
              )}
            </>
          ) : (
            <button 
              onClick={() => {
                const target = location.state?.from || (isPharmacyUser ? '/pharmacy' : '/consultations');
                navigate(target);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.625rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontWeight: 800,
                fontSize: '0.8125rem',
                color: 'var(--text-main)',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              <ArrowLeft size={16} style={{ color: 'var(--primary)' }} />
              {(location.state?.from === '/pharmacy' || isPharmacyUser) ? 'Back to Pharmacy' : 'Back to Consult Desk'}
            </button>
          )}
          {activeTab !== 'approval' && !isPharmacy && (user?.role === 'NURSE' || user?.role === 'LAB_TECH' || user?.role === 'LABORATORY' || user?.role === 'ADMIN') && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowRequestModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '12px' }}
            >
              <Plus size={16} /> Request Replenishment
            </button>
          )}
        </div>
      </header>
      )}


      {/* Main Content Area */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '24px' }}>
        
        {/* Search Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '4px', height: '16px', borderRadius: '2px', background: 'linear-gradient(to bottom, var(--primary), var(--primary-light))' }}></span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.010em' }}>
                  {activeTab === 'inventory' && `${selectedRoom} Stock & Logs`}
                  {activeTab === 'approval' && 'Pending Indents Approval Desk'}
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                {activeTab === 'inventory' && `Manage inventory, replenishment requests, and direct dispensations for ${selectedRoom}`}
                {activeTab === 'approval' && 'Needs immediate clinical review and sign-off'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {isEmbed && (isPharmacyUser || !(user?.role === 'NURSE' || user?.role === 'LAB_TECH' || user?.role === 'LABORATORY')) && (
                <div ref={dropdownRef} style={{ position: 'relative', minWidth: '190px' }}>
                  <button
                    type="button"
                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      color: 'var(--text-main)',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isRoomDropdownOpen) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                  >
                    <span>{selectedRoom === 'Nurse Room' ? 'Nurse Room Inventory' : 'Laboratory Room Inventory'}</span>
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '8px', transform: isRoomDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                  </button>
                  {isRoomDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      zIndex: 1000,
                      overflow: 'hidden',
                      padding: '4px'
                    }}>
                      <div 
                        onClick={() => {
                          setSelectedRoom('Nurse Room');
                          setIndentForm(f => ({ ...f, requesting_location: 'Nurse Room' }));
                          setIsRoomDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: selectedRoom === 'Nurse Room' ? 'var(--primary)' : 'transparent',
                          color: selectedRoom === 'Nurse Room' ? 'white' : 'var(--text-main)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedRoom !== 'Nurse Room') {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedRoom !== 'Nurse Room') {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        Nurse Room Inventory
                      </div>
                      <div 
                        onClick={() => {
                          setSelectedRoom('Lab Room');
                          setIndentForm(f => ({ ...f, requesting_location: 'Lab Room' }));
                          setIsRoomDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: selectedRoom === 'Lab Room' ? 'var(--primary)' : 'transparent',
                          color: selectedRoom === 'Lab Room' ? 'white' : 'var(--text-main)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedRoom !== 'Lab Room') {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedRoom !== 'Lab Room') {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        Laboratory Room Inventory
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="search-container" style={{ position: 'relative', width: '320px' }}>
                <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input custom-search-input"
                  style={{ 
                    paddingLeft: '2.75rem', 
                    paddingRight: '2.5rem', 
                    paddingTop: '0.5rem', 
                    paddingBottom: '0.5rem', 
                    borderRadius: '10px', 
                    border: '1px solid var(--border)', 
                    fontSize: '0.75rem', 
                    outline: 'none',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {isEmbed && activeTab !== 'approval' && !isPharmacy && (user?.role === 'NURSE' || user?.role === 'LAB_TECH' || user?.role === 'LABORATORY' || user?.role === 'ADMIN') && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowRequestModal(true)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontWeight: 700, 
                    borderRadius: '12px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.75rem',
                    height: '34px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={14} /> Request Replenishment
                </button>
              )}
            </div>
          </div>

          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: 'none', padding: '2px', background: 'var(--background)', borderRadius: '14px', width: 'fit-content' }}>
              <button
                onClick={() => setActiveSubTab('stock_list')}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: activeSubTab === 'stock_list' ? 'var(--surface)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: activeSubTab === 'stock_list' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: activeSubTab === 'stock_list' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Package size={14} /> Room Stock List
              </button>
              <button
                onClick={() => setActiveSubTab('replenishment_log')}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: activeSubTab === 'replenishment_log' ? 'var(--surface)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: activeSubTab === 'replenishment_log' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: activeSubTab === 'replenishment_log' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ClipboardList size={14} /> Replenishment Log
              </button>
              <button
                onClick={() => setActiveSubTab('dispensations_log')}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: activeSubTab === 'dispensations_log' ? 'var(--surface)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: activeSubTab === 'dispensations_log' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: activeSubTab === 'dispensations_log' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={14} /> Direct Dispensations Log
              </button>
            </div>
          )}
        </div>

        {/* Tab content rendering */}
        <div className={activeTab === 'approval' ? "approval-outer-container" : "table-responsive"}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTopColor: projectConfig?.primary_color || 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fetching latest sub-store records...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : activeTab === 'inventory' ? (
            activeSubTab === 'stock_list' ? (
              // Room Stock Inventory Table
              <table>
                <thead style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.875rem 1rem 0.875rem 1.5rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medication Name</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Registry Code</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available Quantity</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Updated</th>
                    {!isPharmacyUser && (
                      <th style={{ textAlign: 'right', padding: '0.875rem 1.5rem 0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = inventoryList.filter(item => 
                      item.registry_item_name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    const paginated = filtered.slice((stockPage - 1) * itemsPerPage, stockPage * itemsPerPage);
                    
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={isPharmacyUser ? 5 : 6} style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            <Package size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>No Room Stock Items Found</p>
                            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Raise a replenishment indent to receive medicines from Pharmacy.</p>
                          </td>
                        </tr>
                      );
                    }
                    
                    return paginated.map(item => (
                      <tr key={item.id}>
                        <td style={{ padding: '1rem 1rem 1rem 1.5rem', fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)', verticalAlign: 'middle' }}>{item.registry_item_name}</td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.registry_item_code || 'N/A'}</span></td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}>
                          <span style={{ 
                            fontSize: '0.6875rem', 
                            background: item.category?.toUpperCase()?.includes('TAB') || item.category?.toUpperCase()?.includes('CAP') ? 'rgba(99, 102, 241, 0.08)' : 'rgba(71, 85, 105, 0.06)', 
                            color: item.category?.toUpperCase()?.includes('TAB') || item.category?.toUpperCase()?.includes('CAP') ? '#6366f1' : 'var(--text-muted)',
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '6px', 
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            border: item.category?.toUpperCase()?.includes('TAB') || item.category?.toUpperCase()?.includes('CAP') ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid rgba(71, 85, 105, 0.1)'
                          }}>
                            {item.category || 'GENERAL'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}>
                          <span style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 900,
                            color: item.quantity <= 5 ? '#ef4444' : 'var(--text-main)'
                          }}>
                            {item.quantity} units
                          </span>
                          {item.quantity <= 5 && (
                            <span style={{ marginLeft: '8px', fontSize: '0.625rem', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>Low Stock</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', verticalAlign: 'middle' }}>{new Date(item.updated_at).toLocaleString()}</td>
                        {!isPharmacyUser && (
                          <td style={{ padding: '1rem 1.5rem 1rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                            <button 
                              className="btn"
                              onClick={() => {
                                setSelectedStockItem(item);
                                setDispenseItems([{
                                  room_stock_id: item.id,
                                  name: item.registry_item_name,
                                  quantity: 1,
                                  max_quantity: item.quantity
                                }]);
                                setDispenseForm(f => ({ ...f, quantity: 1 }));
                                setShowDispenseModal(true);
                              }}
                              style={{ 
                                padding: '0.45rem 1rem', 
                                fontSize: '0.75rem', 
                                borderRadius: '10px', 
                                fontWeight: 800,
                                background: 'rgba(99, 102, 241, 0.04)',
                                border: `1px solid rgba(99, 102, 241, 0.15)`,
                                color: projectConfig?.primary_color || 'var(--primary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Send size={12} /> Dispense directly
                            </button>
                          </td>
                        )}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            ) : activeSubTab === 'replenishment_log' ? (
              // Replenishment Requests Log Table
              <table>
                <thead style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.875rem 1rem 0.875rem 1.5rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request Location</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medications Requested</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raised By</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Doctor Reviewer</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remarks</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem 1.5rem 0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = indentsList.filter(ind => 
                      ind.requesting_location === selectedRoom &&
                      (searchQuery === '' || ind.items.some(i => i.medication_name.toLowerCase().includes(searchQuery.toLowerCase())) || ind.id.toString().includes(searchQuery))
                    );
                    const paginated = filtered.slice((replenishPage - 1) * itemsPerPage, replenishPage * itemsPerPage);

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            <ClipboardList size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>No Replenishment Indents Found</p>
                          </td>
                        </tr>
                      );
                    }

                    return paginated.map(ind => (
                      <tr key={ind.id}>
                        <td style={{ padding: '1rem 1rem 1rem 1.5rem', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-main)', verticalAlign: 'middle' }}>{ind.requesting_location}</td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {ind.items.map((i, idx) => (
                              <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                • {i.medication_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Req: {i.requested_quantity} | Appr: {i.approved_quantity} | Disp: {i.dispensed_quantity})</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)' }}>{ind.raised_by_username}</p>
                          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600 }}>{ind.raised_by_role}</p>
                        </td>
                        <td style={{ padding: '1rem 1rem', verticalAlign: 'middle' }}>{getStatusBadge(ind.status)}</td>
                        <td style={{ padding: '1rem 1rem', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-main)', verticalAlign: 'middle' }}>{ind.doctor_username ? `Dr. ${ind.doctor_username}` : 'Pending Review'}</td>
                        <td style={{ padding: '1rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={ind.doctor_remarks}>
                          {ind.doctor_remarks || 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem 1rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                          {ind.status === 'PENDING_APPROVAL' && (
                            <button 
                              className="btn btn-secondary"
                              onClick={() => handleCancelIndent(ind.id)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              Cancel
                            </button>
                          )}
                          {ind.status === 'APPROVED' && isPharmacyUser && (
                            <button 
                              className="btn btn-primary"
                              onClick={() => handleDispenseIndent(ind.id)}
                              style={{ 
                                padding: '0.45rem 1rem', 
                                fontSize: '0.75rem', 
                                borderRadius: '10px', 
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                                border: 'none',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <CheckCircle2 size={12} /> Fulfill & Dispense
                            </button>
                          )}
                          {ind.status !== 'PENDING_APPROVAL' && !(ind.status === 'APPROVED' && isPharmacyUser) && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            ) : (
              // Direct Dispensations Log Table
              <table>
                <thead style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.875rem 1rem 0.875rem 1.5rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient Name / Type</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ID / Aadhaar / Phone</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medication Dispensed</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quantity</th>
                    <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dispensed By</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem 1.5rem 0.875rem 1rem', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dispensation Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = dispensationsList.filter(disp => 
                      searchQuery === '' || 
                      disp.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      disp.outside_patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      disp.medication_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      disp.id.toString().includes(searchQuery)
                    );
                    const paginated = filtered.slice((dispensePage - 1) * itemsPerPage, dispensePage * itemsPerPage);

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '4rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            <ClipboardList size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>No Direct Dispensations Found</p>
                          </td>
                        </tr>
                      );
                    }

                    return paginated.map(disp => (
                      <tr key={disp.id}>
                        <td style={{ padding: '1rem 1rem 1rem 1.5rem', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                            {disp.recipient_type === 'PATIENT' ? disp.patient_name : disp.outside_patient_name}
                          </span>
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '0.625rem', 
                            background: disp.recipient_type === 'PATIENT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                            color: disp.recipient_type === 'PATIENT' ? '#10b981' : '#6366f1', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 800 
                          }}>
                            {disp.recipient_type === 'PATIENT' ? 'Registered' : 'Walk-In'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                          {disp.recipient_type === 'PATIENT' ? (
                            <span>Card: {disp.card_no || 'N/A'}</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>Aadhaar: {disp.outside_patient_aadhaar || 'N/A'}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Phone: {disp.outside_patient_phone || 'N/A'}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem', verticalAlign: 'middle' }}>{disp.medication_name}</td>
                        <td style={{ padding: '1rem 1rem', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.875rem', verticalAlign: 'middle' }}>{disp.quantity} units</td>
                        <td style={{ padding: '1rem 1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.8125rem', verticalAlign: 'middle' }}>{disp.dispensed_by_username}</td>
                        <td style={{ padding: '1rem 1.5rem 1rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                          {new Date(disp.dispensed_at).toLocaleString()}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )
          ) : (
            // Tab 3: Doctor Approval Table
            (() => {
              const pendingApprovals = indentsList.filter(ind => 
                ind.status === 'PENDING_APPROVAL' &&
                (searchQuery === '' || ind.items.some(i => i.medication_name.toLowerCase().includes(searchQuery.toLowerCase())) || ind.id.toString().includes(searchQuery))
              );
              
              const approvalHistory = indentsList.filter(ind => 
                ind.status !== 'PENDING_APPROVAL' &&
                (searchQuery === '' || ind.items.some(i => i.medication_name.toLowerCase().includes(searchQuery.toLowerCase())) || ind.id.toString().includes(searchQuery))
              );

              const sortedHistory = [...approvalHistory].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

              return (
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', background: 'var(--surface)' }}>
                  {/* PENDING APPROVALS */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--primary)' }}></span>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Pending Approvals
                        </h4>
                        <span style={{ 
                          background: pendingApprovals.length > 0 ? '#fef3c7' : 'var(--background)',
                          color: pendingApprovals.length > 0 ? '#d97706' : 'var(--text-muted)',
                          fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '10px',
                          border: pendingApprovals.length > 0 ? '1px solid #fde68a' : '1px solid var(--border)'
                        }}>
                          {pendingApprovals.length} pending
                        </span>
                      </div>
                    </div>

                    {pendingApprovals.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--background)', 
                        borderRadius: '16px', border: '1.5px dashed var(--border)', color: 'var(--text-muted)' 
                      }}>
                        <CheckCircle2 size={32} style={{ marginBottom: '0.75rem', color: '#10b981', opacity: 0.8 }} />
                        <p style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>No records to approve</p>
                        <p style={{ fontSize: '0.75rem', marginTop: '4px', margin: 0 }}>All replenishment requests have been approved or rejected.</p>
                      </div>
                    ) : (
                      <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                        <table style={{ margin: 0 }}>
                          <thead style={{ background: 'var(--background)', borderBottom: '1.5px solid var(--border)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem 1rem 0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request Room</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medications Requested</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raised By</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request Time</th>
                              <th style={{ textAlign: 'right', padding: '0.75rem 1.5rem 0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingApprovals.slice((approvalPage - 1) * itemsPerPage, approvalPage * itemsPerPage).map(ind => (
                              <tr key={ind.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.875rem 1rem 0.875rem 1.5rem', fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-main)', verticalAlign: 'middle' }}>{ind.requesting_location}</td>
                                <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {ind.items.map((i, idx) => (
                                      <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        • {i.medication_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Qty: {i.requested_quantity})</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                                  <p style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)', margin: 0 }}>{ind.raised_by_username}</p>
                                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{ind.raised_by_role}</p>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', verticalAlign: 'middle' }}>{new Date(ind.created_at).toLocaleString()}</td>
                                <td style={{ padding: '0.875rem 1.5rem 0.875rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                  <button 
                                    className="btn btn-primary"
                                    onClick={() => handleOpenApproval(ind)}
                                    style={{ 
                                      padding: '0.45rem 0.9rem', 
                                      fontSize: '0.72rem', 
                                      borderRadius: '8px', 
                                      fontWeight: 800, 
                                      background: projectConfig?.primary_color || 'var(--primary)', 
                                      border: 'none', 
                                      color: 'white', 
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)'
                                    }}
                                  >
                                    Review & Sign-off
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {renderPagination(approvalPage, pendingApprovals.length, setApprovalPage)}
                      </div>
                    )}
                  </div>

                  {/* HISTORY LOG */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--primary-light)' }}></span>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Approval & Rejection History
                        </h4>
                        <span style={{ 
                          background: 'rgba(99, 102, 241, 0.06)',
                          color: 'var(--primary)',
                          fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '10px',
                          border: '1px solid rgba(99, 102, 241, 0.1)'
                        }}>
                          {approvalHistory.length} total processed
                        </span>
                      </div>
                    </div>

                    {approvalHistory.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', padding: '2.5rem 1.5rem', background: 'var(--background)', 
                        borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' 
                      }}>
                        No processed indents in history.
                      </div>
                    ) : (
                      <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                        <table style={{ margin: 0 }}>
                          <thead style={{ background: 'var(--background)', borderBottom: '1.5px solid var(--border)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem 1rem 0.75rem 1.5rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request Room</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medications Details</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raised By</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reviewed By</th>
                              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remarks</th>
                              <th style={{ textAlign: 'right', padding: '0.75rem 1.5rem 0.75rem 1rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage).map(ind => (
                              <tr key={ind.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.875rem 1rem 0.875rem 1.5rem', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-main)', verticalAlign: 'middle' }}>{ind.requesting_location}</td>
                                <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {ind.items.map((i, idx) => (
                                      <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        • {i.medication_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Req: {i.requested_quantity} | Appr: {i.approved_quantity})</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                                  <p style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)', margin: 0 }}>{ind.raised_by_username}</p>
                                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{ind.raised_by_role}</p>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>{getStatusBadge(ind.status)}</td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', verticalAlign: 'middle' }}>
                                  {ind.doctor_username ? `Dr. ${ind.doctor_username}` : '—'}
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={ind.doctor_remarks}>
                                  {ind.doctor_remarks || '—'}
                                </td>
                                <td style={{ padding: '0.875rem 1.5rem 0.875rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                                  {new Date(ind.updated_at || ind.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {renderPagination(historyPage, sortedHistory.length, setHistoryPage)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
        {activeTab === 'inventory' && activeSubTab === 'stock_list' && renderPagination(stockPage, inventoryList.filter(item => item.registry_item_name.toLowerCase().includes(searchQuery.toLowerCase())).length, setStockPage)}
        {activeTab === 'inventory' && activeSubTab === 'replenishment_log' && renderPagination(replenishPage, indentsList.filter(ind => ind.requesting_location === selectedRoom && (searchQuery === '' || ind.items.some(i => i.medication_name.toLowerCase().includes(searchQuery.toLowerCase())) || ind.id.toString().includes(searchQuery))).length, setReplenishPage)}
        {activeTab === 'inventory' && activeSubTab === 'dispensations_log' && renderPagination(dispensePage, dispensationsList.filter(disp => searchQuery === '' || disp.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || disp.outside_patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || disp.medication_name?.toLowerCase().includes(searchQuery.toLowerCase()) || disp.id.toString().includes(searchQuery)).length, setDispensePage)}
      </div>



      {/* MODAL 1: Dispense to Patient */}
      {showDispenseModal && selectedStockItem && createPortal(
        <div style={modalOverlayStyle}>
          <div className="card fade-in" style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ padding: '0.5rem', background: projectConfig?.primary_color || 'var(--primary)', borderRadius: '8px', color: 'white' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Dispense from Room Stock</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dispense multiple medicine varieties from room stock to patient</p>
                </div>
              </div>
              <button onClick={() => setShowDispenseModal(false)} style={closeBtnStyle}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDispenseStock}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800 }}>Dispensation Target / Patient Type</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="recipient_type" 
                      value="PATIENT"
                      checked={dispenseForm.recipient_type === 'PATIENT'}
                      onChange={() => setDispenseForm(f => ({ ...f, recipient_type: 'PATIENT' }))}
                      style={{ width: '16px', height: '16px', margin: 0, padding: 0, cursor: 'pointer' }}
                    />
                    Registered EMR Patient
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="recipient_type" 
                      value="OUTSIDE_PATIENT"
                      checked={dispenseForm.recipient_type === 'OUTSIDE_PATIENT'}
                      onChange={() => setDispenseForm(f => ({ ...f, recipient_type: 'OUTSIDE_PATIENT' }))}
                      style={{ width: '16px', height: '16px', margin: 0, padding: 0, cursor: 'pointer' }}
                    />
                    EMERGENCY / DIRECT WALK-IN
                  </label>
                </div>
              </div>

              {dispenseForm.recipient_type === 'PATIENT' ? (
                // Registered Patient Selection
                <div className="form-group" style={{ marginBottom: '1.25rem', position: 'relative' }}>
                  <label style={{ fontWeight: 800 }}>Search Registered Patient</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input 
                      type="text" 
                      placeholder="Type name, card number, or patient ID..."
                      value={dispenseForm.patient_name_search}
                      onChange={(e) => handlePatientSearch(e.target.value)}
                      className="custom-search-input"
                      style={{ paddingLeft: '2.75rem', paddingRight: '2.5rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', width: '100%', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                    {dispenseForm.patient_name_search && (
                      <button
                        type="button"
                        onClick={() => {
                          setDispenseForm(f => ({ ...f, patient_id: '', patient_name_search: '' }));
                          setPatientResults([]);
                        }}
                        style={{
                          position: 'absolute',
                          right: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {patientResults.length > 0 && (
                    <div style={autocompleteDropdownStyle}>
                      {patientResults.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => {
                            setDispenseForm(f => ({ 
                              ...f, 
                              patient_id: p.id,
                              patient_name_search: `${p.first_name} ${p.last_name} (Card: ${p.card_no || 'N/A'})`
                            }));
                            setPatientResults([]);
                          }}
                          style={autocompleteItemStyle}
                        >
                          <p style={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.first_name} {p.last_name}</p>
                          <p style={{ fontSize: '0.625rem', color: '#64748b' }}>Card: {p.card_no || 'N/A'} | UHID: #{1000 + p.id}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Walk-In Patient Details (Aadhaar & Phone)
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ fontWeight: 800 }}>Walk-In Patient Name *</label>
                    <input 
                      type="text" 
                      placeholder="Enter patient full name..."
                      value={dispenseForm.outside_patient_name}
                      onChange={(e) => setDispenseForm(f => ({ ...f, outside_patient_name: e.target.value }))}
                      required
                      style={{ width: '100%', marginTop: '0.25rem', padding: '0.625rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Aadhaar Number
                      </label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="12-digit Aadhaar..."
                        value={dispenseForm.outside_patient_aadhaar || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 12) {
                            setDispenseForm(f => ({ ...f, outside_patient_aadhaar: val }));
                          }
                        }}
                        style={{ width: '100%', marginTop: '0.25rem', padding: '0.625rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} style={{ color: 'var(--primary)' }} /> Phone Number
                      </label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="10-digit Phone..."
                        value={dispenseForm.outside_patient_phone || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 10) {
                            setDispenseForm(f => ({ ...f, outside_patient_phone: val }));
                          }
                        }}
                        style={{ width: '100%', marginTop: '0.25rem', padding: '0.625rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 800 }}>Emergency Remarks / Clinical Details</label>
                    <textarea 
                      rows="2"
                      placeholder="Describe case details (e.g. Midnight fever spike)..."
                      value={dispenseForm.outside_patient_details}
                      onChange={(e) => setDispenseForm(f => ({ ...f, outside_patient_details: e.target.value }))}
                      style={{ width: '100%', marginTop: '0.25rem', padding: '0.625rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              )}

              {/* Selected Medications List for Dispensation */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800, marginBottom: '0.5rem', display: 'block' }}>Selected Medications & Quantities</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                  {dispenseItems.map((di, idx) => (
                    <div key={di.room_stock_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, marginRight: '10px' }}>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{di.name}</p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>Available: {di.max_quantity} units</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          min="1" 
                          max={di.max_quantity}
                          value={di.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setDispenseItems(items => items.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                          }}
                          required
                          style={{ width: '70px', padding: '4px 8px', fontSize: '0.8125rem', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center' }}
                        />
                        {dispenseItems.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              setDispenseItems(items => items.filter((_, i) => i !== idx));
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add more medication dropdown */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 800 }}>Add More Medications</label>
                <div ref={medDropdownRef} style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsMedDropdownOpen(!isMedDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: 'var(--text-main)',
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isMedDropdownOpen) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>+ Select another medication from room stock...</span>
                    <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: isMedDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                  </button>
                  {isMedDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      zIndex: 1000,
                      overflowY: 'auto',
                      maxHeight: '200px',
                      padding: '4px'
                    }}>
                      {inventoryList
                        .filter(i => i.quantity > 0 && !dispenseItems.some(di => di.room_stock_id === i.id))
                        .map(i => (
                          <div 
                            key={i.id} 
                            onClick={() => {
                              if (dispenseItems.some(di => di.room_stock_id === i.id)) {
                                toast.error('Item is already in dispensation list');
                                return;
                              }
                              setDispenseItems([
                                ...dispenseItems, 
                                {
                                  room_stock_id: i.id,
                                  name: i.registry_item_name,
                                  quantity: 1,
                                  max_quantity: i.quantity
                                }
                              ]);
                              setIsMedDropdownOpen(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: 'var(--text-main)',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                              e.currentTarget.style.color = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-main)';
                            }}
                          >
                            <span>{i.registry_item_name}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({i.quantity} units available)</span>
                          </div>
                        ))
                      }
                      {inventoryList.filter(i => i.quantity > 0 && !dispenseItems.some(di => di.room_stock_id === i.id)).length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          No additional medications available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmiting}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.875rem', fontWeight: 800, borderRadius: '12px' }}
              >
                {isSubmiting ? 'Processing Dispense...' : 'Confirm Dispensation & Deduct Stock'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Request Replenishment (Indent) */}
      {showRequestModal && createPortal(
        <div style={modalOverlayStyle}>
          <div className="card fade-in" style={{ ...modalContentStyle, maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ padding: '0.5rem', background: projectConfig?.primary_color || 'var(--primary)', borderRadius: '8px', color: 'white' }}>
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Create Replenishment Request</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stock request raised from Nurse/Lab room to Main Pharmacy store</p>
                </div>
              </div>
              <button onClick={() => setShowRequestModal(false)} style={closeBtnStyle}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRaiseIndent}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 800 }}>Requesting Room / Sub-Store Location</label>
                {isPharmacyUser || !(user?.role === 'NURSE' || user?.role === 'LAB_TECH' || user?.role === 'LABORATORY') ? (
                  <select 
                    value={indentForm.requesting_location}
                    onChange={(e) => setIndentForm(f => ({ ...f, requesting_location: e.target.value }))}
                    required
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  >
                    <option value="Nurse Room">Nurse Room</option>
                    <option value="Lab Room">Laboratory Room</option>
                  </select>
                ) : (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    marginTop: '0.25rem',
                    color: 'var(--text-main)'
                  }}>
                    {indentForm.requesting_location === 'Nurse Room' ? `Nurse Room (${projectConfig?.name || ''})` : `Laboratory Room (${projectConfig?.name || ''})`}
                  </div>
                )}
              </div>

              {/* Add items section */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Add Medication to Request List</p>
                
                <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input 
                      type="text" 
                      placeholder="Search medication name in Pharmacy Registry..."
                      value={selectedDrugSearch}
                      onChange={(e) => searchRegistryDrug(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      className="custom-search-input"
                      style={{ paddingLeft: '2.75rem', paddingRight: '2.5rem', width: '100%', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.8125rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                    {selectedDrugSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDrugSearch('');
                          setSelectedDrugObj(null);
                          setDrugResults([]);
                        }}
                        style={{
                          position: 'absolute',
                          right: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                    {drugResults.length > 0 && (
                      <div style={autocompleteDropdownStyle}>
                        {drugResults.map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => {
                              setSelectedDrugSearch(d.name);
                              setSelectedDrugObj(d);
                              setDrugResults([]);
                            }}
                            style={autocompleteItemStyle}
                          >
                            <p style={{ fontWeight: 700, fontSize: '0.8rem' }}>{d.name}</p>
                            <p style={{ fontSize: '0.625rem', color: '#64748b' }}>Available Pharmacy Stock: {d.quantity} units | Code: {d.ucode || d.item_code || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ width: '100px' }}>
                    <input 
                      type="number" 
                      min="1" 
                      value={selectedDrugQty}
                      onChange={(e) => setSelectedDrugQty(parseInt(e.target.value) || 1)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Qty"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedDrugObj) {
                        toast.error('Please search and select a medication from the list first');
                        return;
                      }
                      addDrugToIndent(selectedDrugObj);
                    }}
                    style={{
                      background: projectConfig?.primary_color || 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 1.25rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    title="Add to request list"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Request Items Queue ({indentForm.items.length})</p>
                {indentForm.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f1f5f9', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                    No items added yet. Search and select items above.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {indentForm.items.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 800 }}>{it.medication_name}</p>
                          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Stock available in Main Pharmacy: {it.registry_item?.quantity || 0} units</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 900, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px' }}>{it.requested_quantity} units</span>
                          <button 
                            type="button" 
                            onClick={() => setIndentForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSubmiting || indentForm.items.length === 0}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem', fontWeight: 800, borderRadius: '12px' }}
              >
                {isSubmiting ? 'Submitting Indent...' : 'Raise Replenishment Request'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Review & Approve Indent (Doctor) */}
      {showApprovalModal && selectedIndent && createPortal(
        <div style={modalOverlayStyle}>
          <div className="card fade-in" style={{ ...modalContentStyle, maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ padding: '0.5rem', background: projectConfig?.primary_color || 'var(--primary)', borderRadius: '8px', color: 'white' }}>
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Review Indent Request</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Indent ID: #{selectedIndent.id} | From: {selectedIndent.requesting_location}</p>
                </div>
              </div>
              <button onClick={() => setShowApprovalModal(false)} style={closeBtnStyle}>
                <X size={16} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>Review Requested Quantities</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {approvalItems.map((item, idx) => (
                  <div key={item.id} style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.medication_name}</p>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Requested: {item.requested_quantity} units</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Approved Qty:</label>
                      <input 
                        type="number" 
                        min="0"
                        value={item.approved_quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setApprovalItems(prev => prev.map((it, i) => i === idx ? { ...it, approved_quantity: val } : it));
                        }}
                        style={{ width: '80px', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 800 }}>Doctor Remarks / Notes</label>
                <textarea 
                  rows="3"
                  placeholder="Approve notes or reason for modification/rejection..."
                  value={doctorRemarks}
                  onChange={(e) => setDoctorRemarks(e.target.value)}
                  style={{ 
                    width: '100%', 
                    marginTop: '0.25rem',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border)',
                    boxSizing: 'border-box',
                    background: 'var(--background)',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => handleApproveIndentSubmit('REJECTED')}
                  disabled={isSubmiting}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.875rem', fontWeight: 800, color: '#dc2626', borderColor: '#fca5a5', borderRadius: '12px' }}
                >
                  Reject Indent
                </button>
                <button 
                  onClick={() => handleApproveIndentSubmit('APPROVED')}
                  disabled={isSubmiting}
                  className="btn btn-primary"
                  style={{ 
                    flex: 1, 
                    padding: '0.875rem', 
                    fontWeight: 800, 
                    background: projectConfig?.primary_color || 'var(--primary)', 
                    borderColor: projectConfig?.primary_color || 'var(--primary)', 
                    borderRadius: '12px' 
                  }}
                >
                  Approve Indent
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog.show && createPortal(
        <div style={modalOverlayStyle}>
          <div className="card fade-in" style={{ ...modalContentStyle, maxWidth: '400px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: '#ef4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{confirmDialog.title}</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0, lineHeight: '1.4' }}>{confirmDialog.message}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.8125rem', borderRadius: '10px', fontWeight: 700 }}
              >
                No, Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, show: false }));
                }}
                className="btn btn-primary"
                style={{ 
                  padding: '0.55rem 1.1rem', 
                  fontSize: '0.8125rem', 
                  borderRadius: '10px', 
                  fontWeight: 700,
                  background: projectConfig?.primary_color || 'var(--primary)',
                  borderColor: projectConfig?.primary_color || 'var(--primary)'
                }}
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Styling helper objects
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999999,
  padding: '1.5rem'
};

const modalContentStyle = {
  width: '100%',
  maxWidth: '680px',
  background: 'white',
  borderRadius: '24px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  border: '1px solid var(--border)',
  padding: '2rem',
  color: 'var(--text-main)',
  maxHeight: '90vh',
  overflowY: 'auto'
};

const closeBtnStyle = {
  border: 'none',
  background: '#f1f5f9',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#475569',
  transition: 'background-color 0.2s'
};

const autocompleteDropdownStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 1000,
  marginTop: '4px'
};

const autocompleteItemStyle = {
  padding: '0.75rem 1rem',
  cursor: 'pointer',
  borderBottom: '1px solid #f1f5f9',
  transition: 'background-color 0.2s',
  color: 'var(--text-main)'
};

export default Indents;
