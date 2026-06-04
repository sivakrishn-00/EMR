import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  MapPin,
  Phone,
  Calendar,
  Download,
  Info,
  Activity,
  X,
  Check,
  Plus,
  Database,
  ShieldCheck,
  Pencil,
  Trash2,
  Upload,
  AlertCircle,
  RotateCcw,
  Settings,
  Layers,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pill,
  FlaskConical,
  Edit2,
  Power,
  Clock,
  ShoppingCart,
  Radio,
  Key,
  Shuffle,
  History,
  Lock
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const AdminMasters = () => {
  const navigate = useNavigate();
  const { board } = useParams();
  const location = useLocation();
  const activeBoard = (board || "protocols").toUpperCase();
  const setActiveBoard = (boardName) => {
    navigate(`/admin-masters/${boardName.toLowerCase()}`);
  };

  const { user } = useAuth();
  const userPerms = user?.permissions || [];
  const hasFullAdminMasters = user?.role === 'ADMIN' || userPerms.includes('ADMIN_ALL') || userPerms.includes('/admin-masters');
  const isAdmin = user?.role === 'ADMIN' || user?.is_superuser || user?.user_roles?.some(r => r.name === 'ADMIN');
  
  const tabPermissions = {
    PROTOCOLS: hasFullAdminMasters || userPerms.includes('/admin-masters/protocols'),
    DIAGNOSTICS: hasFullAdminMasters || userPerms.includes('/admin-masters/diagnostics'),
    MACHINES: hasFullAdminMasters || userPerms.includes('/admin-masters/machines'),
    STATS: hasFullAdminMasters || userPerms.includes('/admin-masters/stats'),
    UPLOAD_HISTORY: hasFullAdminMasters || userPerms.includes('/admin-masters/upload_history')
  };

  const permittedTabsCount = Object.values(tabPermissions).filter(Boolean).length;

  const [employeeMasters, setEmployeeMasters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalFamilyCount, setTotalFamilyCount] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [viewMode, setViewMode] = useState("PROJECTS"); // PROJECTS, DATA

  useEffect(() => {
    if (location.state && location.state.selectedProject) {
      setSelectedProject(location.state.selectedProject);
      setViewMode("DATA");
    }
  }, [location.state]);
  const [projects, setProjects] = useState([]);
  const [customProtocols, setCustomProtocols] = useState({}); // { projectId: [ protocols ] }
  const [exploringProtocolId, setExploringProtocolId] = useState("employee_master");
  const toggleProtocolVisibility = async (proto) => {
    try {
      const newVisibility = !proto.is_visible;
      await api.patch(`patients/registry-types/${proto.dbId}/`, {
        is_visible: newVisibility
      });
      await fetchProjects();
      toast.success(`${proto.name} visibility updated successfully!`);
    } catch (err) {
      toast.error("Failed to update visibility settings");
      console.error(err);
    }
  };

  const getCurrentProtocols = (projectId = selectedProject) => {
    const proj = projects.find((p) => String(p.id) === String(projectId));
    if (!proj) return [];

    const activeCategories = (proj.category_mappings || []).map(m => m.category);

    const customSet = (proj.registry_types || []).map((rt) => ({
      id: rt.slug,
      dbId: rt.id,
      slug: rt.slug,
      type_category: rt.type_category,
      name: rt.name,
      description: rt.description,
      coverage: rt.coverage,
      icon:
        rt.icon === "Pill"
          ? Pill
          : rt.type_category === "PERSONNEL_DEPENDENT"
            ? UserPlus
            : Users,
      color: rt.color,
      is_visible: rt.is_visible ?? true,
      isCustom: !["PERSONNEL_PRIMARY", "PERSONNEL_DEPENDENT"].includes(rt.type_category),
      fields:
        rt.fields && rt.fields.length > 0
          ? rt.fields
          : rt.slug === "employee_master"
            ? [
                { label: "Card No", slug: "card_no" },
                { label: "Employee ID", slug: "employee_id" },
                { label: "Name", slug: "name" },
                { label: "Age / Gender", slug: "gender" },
                { label: "Aadhar No", slug: "aadhar_no" },
                { label: "Mobile No", slug: "mobile_no" },
                { label: "Address", slug: "address" },
                { label: "Designation", slug: "designation" },
              ]
            : rt.slug === "family_member"
              ? [
                  { label: "Card No", slug: "card_no" },
                  { label: "Name", slug: "name" },
                  { label: "Age / Gender", slug: "gender" },
                  { label: "Mobile No", slug: "mobile_no" },
                  { label: "Aadhar No", slug: "aadhar_no" },
                  { label: "Relationship", slug: "relationship" },
                ]
              : [],
    }));
    return customSet;
  };

  const [showNewProtocolModal, setShowNewProtocolModal] = useState(false);
  const [isEditingProtocol, setIsEditingProtocol] = useState(false);
  const [editingProtocolId, setEditingProtocolId] = useState(null);
  const [newProtocolData, setNewProtocolData] = useState({
    name: "",
    description: "",
    coverage: "",
    fields: [],
  });

  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [selectedEmployeeForFamily, setSelectedEmployeeForFamily] =
    useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [bulkEnrollData, setBulkEnrollData] = useState('');
  const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
  const isEnrollingRef = useRef(false);
  const [bulkEnrollStatus, setBulkEnrollStatus] = useState({
    isProcessing: false,
    total: 0,
    current: 0,
    success: 0,
    errors: 0,
    failedRecords: [],
    completed: false
  });
  const [uploadSessions, setUploadSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState("SUCCESS"); // SUCCESS or FAILED
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showRegistryEditModal, setShowRegistryEditModal] = useState(false);
  const [registryEditData, setRegistryEditData] = useState({
    id: null,
    ucode: "",
    name: "",
    category: "",
    description: "",
    quantity: 0,
    cost: 0,
    additional_fields: {},
  });
  
  const [lowStockThreshold, setLowStockThreshold] = useState(() => {
    return parseInt(localStorage.getItem(`low_stock_threshold_${selectedProject}`)) || 10;
  });
  const [tempThreshold, setTempThreshold] = useState(lowStockThreshold);
  const [allowNonAdmin, setAllowNonAdmin] = useState(() => {
    return localStorage.getItem(`low_stock_threshold_allow_non_admin_${selectedProject}`) === 'true';
  });
  const [stockDetailModal, setStockDetailModal] = useState({
    isOpen: false,
    title: "",
    type: "",
    items: []
  });
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [dashboardStats, setDashboardStats] = useState(null);
  const [depletionItems, setDepletionItems] = useState([]);
  const [isDepletionLoading, setIsDepletionLoading] = useState(false);
  const [statsViewTab, setStatsViewTab] = useState("TRENDS");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [depletionSearchQuery, setDepletionSearchQuery] = useState("");
  const [depletionDisplayLimit, setDepletionDisplayLimit] = useState(10);
  const [batchDisplayLimit, setBatchDisplayLimit] = useState(10);
  
  // Laboratory Diagnostic Masters State
  const [labTests, setLabTests] = useState([]);
  const [labDepartments, setLabDepartments] = useState([]);
  const [labTestTypes, setLabTestTypes] = useState([]);
  const [showLabTestModal, setShowLabTestModal] = useState(false);
  const [showSubTestModal, setShowSubTestModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showTestTypeModal, setShowTestTypeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ id: null, type: null, label: "" });
  const [currentLabTest, setCurrentLabTest] = useState(null);
  const [currentSubTest, setCurrentSubTest] = useState(null);
  const [isEditingLabTest, setIsEditingLabTest] = useState(false);
  const [isEditingSubTest, setIsEditingSubTest] = useState(false);
  const [expandedLabTests, setExpandedLabTests] = useState({});

  // Lab Machine Registry State
  const [labMachines, setLabMachines] = useState([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [machineForm, setMachineForm] = useState({
    machine_id: "",
    machine_name: "",
    lab_id: "",
    location: "",
    is_active: true
  });
  const [currentMachine, setCurrentMachine] = useState(null);
  const [isEditingMachine, setIsEditingMachine] = useState(false);

  const [labTestForm, setLabTestForm] = useState({
    name: "",
    code: "",
    test_type: "",
    department: "",
    description: "",
    is_active: true
  });
  const [deptForm, setDeptForm] = useState({
     name: "",
     description: ""
  });
  const [testTypeForm, setTestTypeForm] = useState({
     name: "",
     description: ""
  });
   const [subTestForm, setSubTestForm] = useState({
     name: "",
     code: "",
     value_type: "INPUT",
     input_data_type: "text",
     min_chars: 0,
     max_chars: 255,
     units: "",
     biological_range: "",
     description: "",
     dropdown_options: "",
     is_active: true
   });

  // Batch Stock Ledger State
  const [selectedBatchForLedger, setSelectedBatchForLedger] = useState(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerRecords, setLedgerRecords] = useState([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  const openBatchLedger = async (batch) => {
    setSelectedBatchForLedger(batch);
    setIsLedgerModalOpen(true);
    setIsLedgerLoading(true);
    try {
      const response = await api.get(`/api/pharmacy/dispensing/?batch=${batch.id}`);
      setLedgerRecords(response.data);
    } catch (err) {
      console.error("Error fetching batch dispensing records:", err);
    } finally {
      setIsLedgerLoading(false);
    }
  };

   const resetLabForm = () => {
     setLabTestForm({ name: "", code: "", test_type: "", department: "", description: "", is_active: true });
     setIsEditingLabTest(false);
     setCurrentLabTest(null);
   };

   const resetSubTestForm = () => {
     setSubTestForm({ name: "", code: "", value_type: "INPUT", input_data_type: "text", min_chars: 0, max_chars: 255, units: "", biological_range: "", description: "", dropdown_options: "", is_active: true });
     setIsEditingSubTest(false);
     setCurrentSubTest(null);
   };


  const customFieldFormBase = { field_label: "", field_type: "VARCHAR", char_length: 100 };
  const [customFieldForm, setCustomFieldForm] = useState(customFieldFormBase);
  const [activeProjectFields, setActiveProjectFields] = useState([]);

  useEffect(() => {
    if (showBulkModal && selectedProject) {
      setBulkProject(selectedProject);
    }
  }, [showBulkModal, selectedProject]);

  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const proj = projects.find(
        (p) => String(p.id) === String(selectedProject),
      );
      setActiveProjectFields(proj?.custom_fields || []);
    }
  }, [selectedProject, projects]);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkStatus, setBulkStatus] = useState({
    isUploading: false,
    total: 0,
    current: 0,
    success: 0,
    errors: 0,
    failedRecords: [],
    completed: false,
  });
  const [bulkProject, setBulkProject] = useState("");
  const [bulkMode, setBulkMode] = useState(user?.role === "ADMIN" ? "OVERWRITE" : "INCREMENT"); // OVERWRITE or INCREMENT
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [uploadHistorySubTab, setUploadHistorySubTab] = useState("UPLOADS"); // UPLOADS or EDITS

  const [bulkStep, setBulkStep] = useState("PROJECT"); // PROJECT, TYPE, UPLOAD
  const [bulkType, setBulkType] = useState(""); // MAPPING, FAMILY, COMPLETE
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [editingMasterId, setEditingMasterId] = useState(null);
  const [isEditingFamily, setIsEditingFamily] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState(null);

  const [masterFormData, setMasterFormData] = useState({
    project: "",
    card_no: "",
    name: "",
    dob: "",
    gender: "",
    mobile_no: "",
    aadhar_no: "",
    address: "",
    designation: "",
    proof_image: null,
    additional_fields: { employee_id: "" },
  });

  const [familyFormData, setFamilyFormData] = useState({
    card_no_suffix: "",
    name: "",
    dob: "",
    gender: "",
    mobile_no: "",
    aadhar_no: "",
    relationship: "SPOUSE",
    custom_relationship: "",
    proof_image: null,
  });

  const [masterFormAttempted, setMasterFormAttempted] = useState(false);
  const [familyFormAttempted, setFamilyFormAttempted] = useState(false);

  const getProjectDesignationsKey = (projId) => `emr_designations_${projId || 'global'}`;

  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    const projId = selectedProject || user?.project || "";
    const key = getProjectDesignationsKey(projId);
    try {
      const saved = localStorage.getItem(key);
      setDesignations(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setDesignations([]);
    }
  }, [selectedProject, user?.project]);

  const [showAddDesignationModal, setShowAddDesignationModal] = useState(false);
  const [newDesignationInput, setNewDesignationInput] = useState("");

  const handleAddNewDesignation = () => {
    setNewDesignationInput("");
    setShowAddDesignationModal(true);
  };

  const submitNewDesignation = () => {
    if (newDesignationInput && newDesignationInput.trim()) {
      const formatted = newDesignationInput.trim().toUpperCase();
      const projId = selectedProject || user?.project || "";
      const key = getProjectDesignationsKey(projId);
      if (!designations.includes(formatted)) {
        const updated = [...designations, formatted];
        setDesignations(updated);
        localStorage.setItem(key, JSON.stringify(updated));
        toast.success(`Designation "${formatted}" added successfully!`);
      }
      setMasterFormData(prev => ({ ...prev, designation: formatted }));
      setShowAddDesignationModal(false);
      setNewDesignationInput("");
    } else {
      toast.error("Please enter a valid designation name");
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', '#6366f1');
    root.style.setProperty('--primary-dark', '#4f46e5');
    root.style.setProperty('--secondary', '#10b981');
    root.style.setProperty('--accent', '#f59e0b');
  }, []);

  useEffect(() => {
    if (showMasterModal && !isEditingMaster) {
      fetchNextCardNo(selectedProject || user?.project);
    }
  }, [showMasterModal, isEditingMaster]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeBoard === "DIAGNOSTICS") {
        fetchLabTests();
        fetchLabDepartments();
        fetchLabTestTypes();
      } else if (activeBoard === "MACHINES") {
        fetchLabMachines();
      } else if (activeBoard === "STATS") {
        fetchDashboardStats();
      } else if (activeBoard === "UPLOAD_HISTORY") {
        fetchUploadSessions();
      } else {
        fetchEmployeeMasters(1);
      }
    }, 400);
    
    fetchProjects();
    return () => clearTimeout(timer);
  }, [selectedProject, exploringProtocolId, searchQuery, activeBoard, lowStockThreshold]);

  useEffect(() => {
    if (selectedProject) {
      const saved = parseInt(localStorage.getItem(`low_stock_threshold_${selectedProject}`)) || 10;
      setLowStockThreshold(saved);
      setTempThreshold(saved);
      setAllowNonAdmin(localStorage.getItem(`low_stock_threshold_allow_non_admin_${selectedProject}`) === 'true');
    }
  }, [selectedProject]);

  useEffect(() => {
    const tabsOrder = ["PROTOCOLS", "DIAGNOSTICS", "MACHINES", "STATS", "UPLOAD_HISTORY"];
    const activePermKey = activeBoard === "REGISTRY" ? "PROTOCOLS" : activeBoard;
    
    if (!tabPermissions[activePermKey]) {
      const firstPermitted = tabsOrder.find(t => tabPermissions[t]);
      if (firstPermitted) {
        setActiveBoard(firstPermitted);
      }
    }
  }, [activeBoard, userPerms]);

  const fetchDashboardStats = async () => {
    if (!selectedProject) return;
    setIsDepletionLoading(true);
    try {
      const res = await api.get(`patients/reports/?project=${selectedProject}&low_threshold=${lowStockThreshold}`);
      setDashboardStats(res.data);

      const endpoint = `patients/registry-data/?all=true&page_size=2000&type_category=CLINICAL_DRUGS,PHARMACY&registry_type__slug=pharmacy,pharmacy_drugs,pharmacy_inventory&project=${selectedProject}`;
      const invRes = await api.get(endpoint);
      const invData = invRes.data.results || invRes.data || [];
      
      const sorted = [...invData].sort((a, b) => {
        const initialQtyA = parseInt(a.additional_fields?.initial_quantity) || 100;
        const pctA = Math.round((a.quantity / initialQtyA) * 100) || 0;
        
        const initialQtyB = parseInt(b.additional_fields?.initial_quantity) || 100;
        const pctB = Math.round((b.quantity / initialQtyB) * 100) || 0;
        
        return pctA - pctB;
      });
      setDepletionItems(sorted);
    } catch (err) {
      console.error("Failed to fetch dashboard stats or depletion items", err);
    } finally {
      setIsDepletionLoading(false);
    }
  };

  const fetchLabTests = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`laboratory/lab-tests/?project=${selectedProject || ""}`);
      setLabTests(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to fetch lab tests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLabDepartments = async () => {
    try {
      const res = await api.get(`laboratory/departments/?project=${selectedProject || ""}`);
      setLabDepartments(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to fetch lab departments");
    }
  };

  const fetchLabTestTypes = async () => {
    try {
      const res = await api.get(`laboratory/test-types/?project=${selectedProject || ""}`);
      setLabTestTypes(res.data.results || res.data);
    } catch (err) {
       toast.error("Failed to fetch test types");
    }
  };

  const fetchNextCardNo = async (projectId) => {
    const pId = projectId || selectedProject || user?.project || "";
    try {
      const res = await api.get(`patients/employee-masters/next-card-no/?project=${pId}`);
      if (res.data.next_card_no) {
        setMasterFormData(prev => ({ ...prev, card_no: res.data.next_card_no }));
      }
    } catch (err) {
      console.error("Failed to fetch next card number", err);
    }
  };

  const handleLabTestSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedProject) return toast.error("Please select a project first");
      if (!labTestForm.department) return toast.error("Please select or create a department");
      if (!labTestForm.test_type) return toast.error("Please select or create a test type");
      
      const data = { ...labTestForm, project: selectedProject };
      if (isEditingLabTest && currentLabTest) {
        await api.put(`laboratory/lab-tests/${currentLabTest.id}/`, data);
        toast.success("Lab Test Updated");
      } else {
        await api.post("laboratory/lab-tests/", data);
        toast.success("Lab Test Master Created");
      }
      
      setShowLabTestModal(false);
      resetLabForm();
      fetchLabTests();
    } catch (err) {
      toast.error(isEditingLabTest ? "Error updating lab test" : "Error creating lab test");
    }
  };

  const handleTestTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedProject) return toast.error("Select project first");
      const data = { ...testTypeForm, project: selectedProject };
      const res = await api.post("laboratory/test-types/", data);
      toast.success("Test Type Created");
      setLabTestTypes([...labTestTypes, res.data]);
      setLabTestForm({ ...labTestForm, test_type: res.data.id });
      setShowTestTypeModal(false);
      setTestTypeForm({ name: "", description: "" });
    } catch (err) {
      toast.error("Error creating test type");
    }
  };

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedProject) return toast.error("Select project first");
      const data = { ...deptForm, project: selectedProject };
      const res = await api.post("laboratory/departments/", data);
      toast.success("Department Created");
      setLabDepartments([...labDepartments, res.data]);
      setLabTestForm({ ...labTestForm, department: res.data.id });
      setShowDeptModal(false);
      setDeptForm({ name: "", description: "" });
    } catch (err) {
      toast.error("Error creating department");
    }
  };

  const handleSubTestSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { 
        ...subTestForm, 
        lab_test: currentLabTest.id,
        dropdown_options: subTestForm.dropdown_options ? 
          (Array.isArray(subTestForm.dropdown_options) ? subTestForm.dropdown_options : subTestForm.dropdown_options.split(',').map(s => s.trim())) 
          : []
      };

      if (isEditingSubTest && currentSubTest) {
        await api.put(`laboratory/sub-tests/${currentSubTest.id}/`, data);
        toast.success("Sub Test Updated");
      } else {
        await api.post("laboratory/sub-tests/", data);
        toast.success("Sub Test Added");
      }
      
      setShowSubTestModal(false);
      resetSubTestForm();
      fetchLabTests();
    } catch (err) {
      toast.error(isEditingSubTest ? "Error updating sub test" : "Error adding sub test");
    }
  };

  const handleToggleLabStatus = async (test) => {
    try {
      await api.patch(`laboratory/lab-tests/${test.id}/`, { is_active: !test.is_active });
      toast.success(test.is_active ? "Test Deactivated" : "Test Activated");
      fetchLabTests();
    } catch (err) {
      toast.error("Error toggling status");
    }
  };

  const handleToggleSubTestStatus = async (sub) => {
    try {
      await api.patch(`laboratory/sub-tests/${sub.id}/`, { is_active: !sub.is_active });
      toast.success(sub.is_active ? "Component Deactivated" : "Component Activated");
      fetchLabTests();
    } catch (err) {
      toast.error("Error toggling status");
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteTarget.type === 'LAB') {
        await api.delete(`laboratory/lab-tests/${deleteTarget.id}/`);
        toast.success("Lab Test Deleted");
      } else {
        await api.delete(`laboratory/sub-tests/${deleteTarget.id}/`);
        toast.success("Sub Test Deleted");
      }
      setShowDeleteModal(false);
      fetchLabTests();
    } catch (err) {
      toast.error("Error deleting record");
    }
  };

  const handleDeleteLabTest = (id, name) => {
    setDeleteTarget({ id, type: 'LAB', label: name });
    setShowDeleteModal(true);
  };

  const handleDeleteSubTest = (id, name) => {
    setDeleteTarget({ id, type: 'SUB', label: name });
    setShowDeleteModal(true);
  };

  const fetchLabMachines = async () => {
    setIsLoadingMachines(true);
    try {
      const res = await api.get(`laboratory/machines/?project=${selectedProject || ""}`);
      setLabMachines(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to fetch lab machines");
    } finally {
      setIsLoadingMachines(false);
    }
  };

  const handleMachineSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedProject) return toast.error("Select project first");
      
      const data = { 
        ...machineForm, 
        project_id: selectedProject,
        // For backwards compatibility or direct machine model fields
        machine_name: machineForm.machine_name,
        machine_id: machineForm.machine_id,
        lab_id: machineForm.lab_id,
        location: machineForm.location
      };

      if (isEditingMachine && currentMachine) {
        await api.put(`laboratory/machines/${currentMachine.id}/`, { ...data, project: selectedProject });
        toast.success("Machine Registry Updated");
      } else {
        // Use link_discovery for creation as it handles composite_identity and retroactive data mirroring
        await api.post("laboratory/machines/link_discovery/", data);
        toast.success("Machine Registered & Linked Successfully");
      }
      setShowMachineModal(false);
      fetchLabMachines();
    } catch (err) {
      toast.error("Error managing machine registry");
    }
  };

  const handleGenerateKey = async (machineId) => {
    try {
      const res = await api.post(`laboratory/machines/${machineId}/generate-key/`);
      toast.success("New Sync Key Generated");
      fetchLabMachines();
    } catch (err) {
      toast.error("Failed to generate key");
    }
  };

  const handleRotateKey = async (machineId) => {
    if (!window.confirm("Rotating the key will immediately disconnect the current sync agent. Proceed?")) return;
    try {
      const res = await api.post(`laboratory/machines/${machineId}/rotate-key/`);
      toast.success("Sync Key Rotated Successfully");
      fetchLabMachines();
    } catch (err) {
      toast.error("Failed to rotate key");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get("patients/projects/");
      if (res.data.results) {
        setProjects(res.data.results);
      } else {
        setProjects(res.data);
      }
    } catch (err) {
      toast.error("Failed to fetch projects");
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const res = await api.get("accounts/audit-logs/");
      if (res.data.results) {
        setAuditLogs(res.data.results);
      } else {
        setAuditLogs(res.data);
      }
    } catch (err) {
      toast.error("Failed to fetch detailed audit logs");
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const fetchUploadSessions = async () => {
    setSessionsLoading(true);
    try {
      const url = selectedProject 
        ? `patients/upload-sessions/?project=${selectedProject}`
        : "patients/upload-sessions/";
      const res = await api.get(url);
      if (res.data.results) {
        setUploadSessions(res.data.results);
      } else {
        setUploadSessions(res.data);
      }
      fetchAuditLogs();
    } catch (err) {
      toast.error("Failed to fetch upload sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchEmployeeMasters = async (pageNum = 1, projectId = null, protocolId = null) => {
    setIsLoading(true);
    const targetProject = projectId !== null ? projectId : selectedProject;
    const targetProtocol = protocolId !== null ? protocolId : exploringProtocolId;
    
    try {
        const isStandard = ["employee_master"].includes(
          targetProtocol,
        );
      const endpoint = isStandard
        ? "patients/employee-masters/"
        : "patients/registry-data/";

      const params = `?page=${pageNum}&search=${searchQuery}&registry_type=${targetProtocol || ""}&project=${targetProject}`;

      const res = await api.get(`${endpoint}${params}`);

      const fetchedResults = res.data.results || (Array.isArray(res.data) ? res.data : []);
      if (res.data.results) {
        setEmployeeMasters(res.data.results);
        setTotalCount(res.data.count);
        setTotalFamilyCount(res.data.total_family_count || 0);
      } else {
        setEmployeeMasters(fetchedResults);
        setTotalCount(res.data.count || fetchedResults.length);
        setTotalFamilyCount(res.data.total_family_count || 0);
      }
      
      // Auto-extract designations from loaded employees and merge with the dropdown list
      if (fetchedResults.length > 0) {
        const extractedDesigs = fetchedResults
          .map(emp => emp.designation ? String(emp.designation).trim().toUpperCase() : '')
          .filter(d => d && d !== 'NAN' && d !== 'NONE' && d !== 'NULL');
        if (extractedDesigs.length > 0) {
          setDesignations(prev => {
            const merged = [...new Set([...prev, ...extractedDesigs])];
            const projId = targetProject || user?.project || "";
            const key = getProjectDesignationsKey(projId);
            localStorage.setItem(key, JSON.stringify(merged));
            return merged;
          });
        }
      }
      setPage(pageNum);
    } catch (err) {
      toast.error("Database Integration Hub: Refreshing clinical state...");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMasterSubmit = async (e) => {
    e.preventDefault();
    setMasterFormAttempted(true);

    if (!masterFormData.gender) {
      toast.error("Please select a Gender");
      return;
    }

    if (masterFormData.mobile_no && masterFormData.mobile_no.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits");
      return;
    }

    if (masterFormData.additional_fields?.employee_id && masterFormData.additional_fields.employee_id.length > 10) {
      toast.error("Employee ID must be maximum 10 characters");
      return;
    }

    const data = new FormData();
    Object.keys(masterFormData).forEach((key) => {
      const val = masterFormData[key];
      if (val !== null && val !== undefined && val !== "") {
        if (key === "additional_fields") {
          data.append(key, JSON.stringify(val));
        } else {
          data.append(key, val);
        }
      }
    });

    const loadingToast = toast.loading(isEditingMaster ? "Saving changes..." : "Registering employee...");
    try {
      if (isEditingMaster) {
        await api.put(`patients/employee-masters/${editingMasterId}/`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Employee Master Updated!", { id: loadingToast });
      } else {
        await api.post("patients/employee-masters/", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Employee Master Registered!", { id: loadingToast });
      }
      setShowMasterModal(false);
      setIsEditingMaster(false);
      setEditingMasterId(null);
      setMasterFormAttempted(false);
      setMasterFormData({
        project: selectedProject || "",
        card_no: "",
        name: "",
        dob: "",
        gender: "",
        mobile_no: "",
        aadhar_no: "",
        address: "",
        designation: "",
        proof_image: null,
        additional_fields: { employee_id: "" },
      });
      fetchEmployeeMasters();
    } catch (err) {
      console.error(err.response?.data);
      const errorMsg = err.response?.data 
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(", ")
        : (isEditingMaster ? "Error updating master" : "Error creating master");
      toast.error(errorMsg, { id: loadingToast });
    }
  };

  const handleDeleteMaster = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Employee Master",
      message:
        "Are you sure you want to delete this master? This will also remove all linked family members.",
      onConfirm: async () => {
        try {
          await api.delete(`patients/employee-masters/${id}/`);
          toast.success("Master deleted successfully");
          fetchEmployeeMasters();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          toast.error("Failed to delete master");
        }
      },
    });
  };

  const handleFamilySubmit = async (e) => {
    e.preventDefault();
    setFamilyFormAttempted(true);
    if (!familyFormData.gender) {
      toast.error("Please select a Gender for the family member");
      return;
    }
    const finalRelationship =
      familyFormData.relationship === "OTHER"
        ? familyFormData.custom_relationship
        : familyFormData.relationship;
    const isStandard = ["employee_master"].includes(
      exploringProtocolId,
    );

    const loadingToast = toast.loading(isEditingFamily ? "Saving changes..." : "Adding family member...");
    try {
      if (isStandard) {
        // Legacy Protocol Persistence
        const data = new FormData();
        Object.keys(familyFormData).forEach((key) => {
          if (key === "relationship") data.append(key, finalRelationship);
          else if (
            key !== "custom_relationship" &&
            familyFormData[key] !== null
          )
            data.append(key, familyFormData[key]);
        });
        data.append("employee", selectedEmployeeForFamily);

        if (isEditingFamily) {
          await api.put(`patients/family-members/${editingFamilyId}/`, data, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success("Legacy Family Member Updated!", { id: loadingToast });
        } else {
          await api.post("patients/family-members/", data, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success("Legacy Family Member Added!", { id: loadingToast });
        }
      } else {
        // Polymorphic Registry Persistence: Dynamically resolve the dependent registry type
        const dependentProtocol = getCurrentProtocols().find(
          (p) => p.type_category === "PERSONNEL_DEPENDENT",
        );
        const payload = {
          registry_type: dependentProtocol?.slug || "family_member",
          ucode: `${selectedEmployeeForFamily}${familyFormData.card_no_suffix}`,
          name: familyFormData.name,
          category: "DEPENDENT",
          additional_fields: {
            ...familyFormData,
            parent_card_no: selectedEmployeeForFamily,
            relationship: finalRelationship,
          },
        };

        if (isEditingFamily) {
          await api.patch(`patients/registry-data/${editingFamilyId}/`, payload);
          toast.success("Registry: Dependent Profile Updated!", { id: loadingToast });
        } else {
          await api.post("patients/registry-data/", payload);
          toast.success("Registry: New Dependent Registered!", { id: loadingToast });
        }
      }

      setShowFamilyModal(false);
      setIsEditingFamily(false);
      setEditingFamilyId(null);
      setFamilyFormAttempted(false);
      setFamilyFormData({
        card_no_suffix: "",
        name: "",
        dob: "",
        gender: "",
        mobile_no: "",
        aadhar_no: "",
        relationship: "SPOUSE",
        custom_relationship: "",
        proof_image: null,
      });
      fetchEmployeeMasters();
    } catch (err) {
      toast.error(
        isEditingFamily
          ? "Action Blocked: Profile Update Failed"
          : "Action Blocked: Dependency Link Failed",
        { id: loadingToast }
      );
    }
  };

  const handleAddCustomField = async () => {
    if (!customFieldForm.field_label) return toast.error("Label required");
    try {
      const fieldName = customFieldForm.field_label
        .toLowerCase()
        .replace(/\s+/g, "_");
      await api.post("patients/project-field-configs/", {
        ...customFieldForm,
        project: selectedProject,
        field_name: fieldName,
      });
      toast.success("Registry Extended");
      setCustomFieldForm({
        field_label: "",
        field_type: "VARCHAR",
        char_length: 100,
      });
      fetchProjects();
    } catch (err) {
      toast.error("Extension Failed");
    }
  };

  const handleDeleteCustomField = async (id) => {
    try {
      await api.delete(`patients/project-field-configs/${id}/`);
      toast.success("Field Excised");
      fetchProjects();
    } catch (err) {
      toast.error("Operation Denied");
    }
  };

  const handleExport = async () => {
    const loadId = toast.loading("Preparing Workspace Export...");
    try {
      const res = await api.get(
        `patients/employee-masters/all-masters/?project=${selectedProject}`,
      );
      const allData = res.data;

      const headers = [
        "Card No",
        "Employee ID",
        "Name",
        "Relationship",
        "DOB",
        "Gender",
        "Aadhar No",
        "Mobile No",
        "Designation",
        "Address",
        ...activeProjectFields.map((f) => f.field_label),
      ];
      const rows = [];

      allData.forEach((emp) => {
        rows.push([
          emp.card_no,
          emp.additional_fields?.employee_id || "",
          `"${emp.name}"`,
          "PRIMARY CARD HOLDER",
          emp.dob,
          emp.gender,
          emp.aadhar_no || "",
          emp.mobile_no,
          emp.designation || "",
          `"${emp.address?.replace(/\n/g, " ")}"`,
          ...activeProjectFields.map(
            (f) => emp.additional_fields?.[f.field_name] || "",
          ),
        ]);

        emp.family_members?.forEach((fam) => {
          rows.push([
            `${emp.card_no}/${fam.card_no_suffix}`,
            "",
            `"${fam.name}"`,
            fam.relationship,
            fam.dob,
            fam.gender,
            fam.aadhar_no || "",
            fam.mobile_no || emp.mobile_no,
            "",
            "",
            ...activeProjectFields.map(
              (f) => fam.additional_fields?.[f.field_name] || "",
            ),
          ]);
        });
      });

      const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${projects.find((p) => p.id == selectedProject)?.name}_Registry_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Workspace Repository Exported!", { id: loadId });
    } catch (err) {
      toast.error("Export Failed", { id: loadId });
    }
  };
  const handleDeleteRegistryItem = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Registry Item",
      message: "Proceed with permanent removal of this clinical record?",
      onConfirm: async () => {
        try {
          await api.delete(`patients/registry-data/${id}/`);
          toast.success("Registry Record Deleted");
          fetchEmployeeMasters(page);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          toast.error("Erasure Failed");
        }
      },
    });
  };

  const handleRegistryEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(
        `patients/registry-data/${registryEditData.id}/`,
        registryEditData,
      );
      toast.success("Command Hub: Registry Updated!");
      setShowRegistryEditModal(false);
      fetchEmployeeMasters(page);
    } catch (err) {
      toast.error("System Refresh Required: Edit Failed");
    }
  };

  const handleDeleteFamily = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Family Member",
      message: "Are you sure you want to remove this family member?",
      onConfirm: async () => {
        try {
          await api.delete(`patients/family-members/${id}/`);
          toast.success("Family member removed");
          fetchEmployeeMasters();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          toast.error("Failed to delete family member");
        }
      },
    });
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error("Please select a CSV file first");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) {
        toast.error("CSV must contain a header row and at least one data row");
        return;
      }

      const parseLine = (line) => {
        const parts = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (char === '"') inQuotes = !inQuotes;
          else if (char === "," && !inQuotes) {
            parts.push(current.trim());
            current = "";
          } else current += char;
        }
        parts.push(current.trim());
        return parts;
      };

      const headers = parseLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/\s+/g, "_"),
      );
      const records = lines
        .slice(1)
        .map((line) => {
          const parts = parseLine(line);
          if (parts.length < headers.length) return null;

          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = parts[idx];
          });
          return obj;
        })
        .filter((r) => r !== null);

      if (records.length === 0) {
        toast.error("No valid data found in CSV");
        return;
      }

      if (!bulkProject) {
        toast.error("Please select a Project for the bulk upload");
        return;
      }

      const recordsWithProject = records.map((r) => ({
        ...r,
        project: bulkProject,
      }));

      setBulkStatus({
        isUploading: true,
        total: records.length,
        current: 0,
        success: 0,
        errors: 0,
        failedRecords: [],
        completed: false,
      });

      const uniqueSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const batchSize = 500;
      let totalSuccess = 0;
      let totalErrors = 0;
      let allFailed = [];

      try {
        const isStandard = ["employee_master"].includes(
          exploringProtocolId,
        );
        // For Project 1, the dynamic registries 'employee_master' and 'family_member' should also hit the specialized personnel endpoint
        // as it handles the Primary/Family relationship logic much better than the generic clinical repository endpoint.
        const isProject1Personnel =
          String(bulkProject) === "1" &&
          (exploringProtocolId === "employee_master" ||
            exploringProtocolId === "family_member");

        const endpoint =
          isStandard || isProject1Personnel
            ? "patients/employee-masters/bulk-upload/"
            : "patients/registry-data/bulk-upload/";

        for (let i = 0; i < recordsWithProject.length; i += batchSize) {
          const batch = recordsWithProject.slice(i, i + batchSize);
          const payload =
            isStandard || isProject1Personnel
              ? { records: batch, filename: bulkFile ? bulkFile.name : 'uploaded_sheet.xlsx', upload_session_id: uniqueSessionId }
              : { registry_type: exploringProtocolId, records: batch, mode: user?.role === "ADMIN" ? bulkMode : "INCREMENT", project: bulkProject, filename: bulkFile ? bulkFile.name : 'uploaded_sheet.xlsx', upload_session_id: uniqueSessionId };
          const res = await api.post(endpoint, payload);

          totalSuccess += res.data.success || 0;
          totalErrors += res.data.errors || 0;
          if (res.data.failed_records) {
            allFailed = [...allFailed, ...res.data.failed_records];
          }

          setBulkStatus((prev) => ({
            ...prev,
            current: Math.min(i + batchSize, records.length),
            success: totalSuccess,
            errors: totalErrors,
            failedRecords: allFailed,
          }));
        }

        setBulkStatus((prev) => ({
          ...prev,
          isUploading: false,
          completed: true,
        }));
        toast.success("Bulk upload completed!");
        fetchEmployeeMasters();
      } catch (err) {
        setBulkStatus((prev) => ({
          ...prev,
          isUploading: false,
          completed: true,
        }));
        toast.error("Bulk upload interrupted or failed");
      }
    };
    reader.readAsText(bulkFile);
  };

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

  const handleBulkEnrollSubmit = async () => {
    if (isEnrollingRef.current) return;
    
    const cardNumbers = bulkEnrollData.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
    if (cardNumbers.length === 0) {
      toast.error("Please provide Card Numbers to enroll");
      return;
    }

    const currentProjectId = selectedProject || user?.project;
    if (!currentProjectId) {
      toast.error("Please select a target project first");
      return;
    }

    isEnrollingRef.current = true;
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
      fetchEmployeeMasters(1, selectedProject, exploringProtocolId);
    } catch (globalErr) {
      toast.error("An error occurred during bulk enrollment");
    } finally {
      setIsBulkEnrolling(false);
      isEnrollingRef.current = false;
    }
  };

  const getStats = () => {
    const activeProject = projects.find(
      (p) => p.id === parseInt(selectedProject),
    );
    const totalEmployees = totalCount;
    const totalFamily = totalFamilyCount;
    return {
      projectName: activeProject?.name || "All Projects",
      totalEmployees,
      totalFamily,
    };
  };

  const handleAddNewProtocol = async (e) => {
    e.preventDefault();
    if (!newProtocolData.name) return toast.error("Protocol Name Required");

    try {
      if (isEditingProtocol) {
        await api.patch(`patients/registry-types/${editingProtocolId}/`, {
          name: newProtocolData.name,
          slug: newProtocolData.slug,
          description: newProtocolData.description,
          coverage: newProtocolData.coverage,
        });

        // Sync fields
        const existingFields =
          getCurrentProtocols().find((p) => p.id === editingProtocolId)
            ?.fields || [];
        for (const field of newProtocolData.fields) {
          if (field.id) {
            await api.patch(`patients/registry-fields/${field.id}/`, field);
          } else {
            await api.post("patients/registry-fields/", {
              ...field,
              registry_type: editingProtocolId,
            });
          }
        }
        toast.success("Governance Hub: Schema Updated!");
      } else {
        const res = await api.post("patients/registry-types/", {
          project: selectedProject,
          name: newProtocolData.name,
          slug:
            newProtocolData.slug ||
            newProtocolData.name.toLowerCase().replace(/\s+/g, "_"),
          description:
            newProtocolData.description || "Custom clinical data repository",
          coverage: newProtocolData.coverage || "WORKSPACE SCOPE",
          icon: "Pill",
          color: "#ec4899",
        });

        // Save fields
        const typeId = res.data.id;
        for (const [idx, field] of newProtocolData.fields.entries()) {
          await api.post("patients/registry-fields/", {
            ...field,
            registry_type: typeId,
            order: idx,
          });
        }

        const loadId = toast.loading("Initializing Clinical Workspace...");
        setTimeout(() => {
          toast.success(`${newProtocolData.name} Table Created Successfully!`, {
            id: loadId,
          });
        }, 800);
      }
      fetchProjects(); // Refresh to get updated registry_types
    } catch (err) {
      toast.error("Database Integration Failed");
    }

    setShowNewProtocolModal(false);
    setIsEditingProtocol(false);
    setEditingProtocolId(null);
    setNewProtocolData({ name: "", description: "", coverage: "", fields: [] });
  };

  const handleDeleteProtocol = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Registry Protocol",
      message: "Are you sure you want to remove this custom registry? All clinical data and schema mapping for this type will be permanently lost.",
      onConfirm: async () => {
        try {
          await api.delete(`patients/registry-types/${id}/`);
          toast.success("Governance Hub: Registry Protocol Excised.");
          fetchProjects(); // Refresh UI
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err) {
          toast.error("Process Blocked: Protocol Erasure Failed");
        }
      },
    });
  };

  const handleSetupPharmacy = async (projectId) => {
    try {
      const loadId = toast.loading("Initializing Project Pharmacy...");
      await api.post(`patients/projects/${projectId}/setup-pharmacy/`);
      toast.success("Pharmacy Registry Provisioned Successfully", { id: loadId });
      fetchProjects(); // Refresh to show the new registry
    } catch (err) {
      toast.error("Failed to initialize pharmacy");
    }
  };

  const stats = getStats();

  const downloadFailedRecords = () => {
    if (bulkStatus.failedRecords.length === 0) return;

    const failed = bulkStatus.failedRecords;
    const isStandard = ["employee_master", "family_member"].includes(exploringProtocolId) || 
                       (String(bulkProject) === "1" && (exploringProtocolId === "employee_master" || exploringProtocolId === "family_member"));

    let headers = [];
    let rows = [];

    if (isStandard) {
      headers = [
        "CardNo",
        "Name",
        "Age/Gender",
        "Aadhar",
        "Mobile",
        "Address",
        "Relationship",
        "Error Reason",
      ];
      rows = failed.map((r) => [
        r.card_no || r.card_no_suffix || "",
        `"${(r.name || "").replace(/"/g, '""')}"`,
        r.age_gender || "",
        r.aadhar_no || "",
        r.mobile_no || "",
        `"${(r.address || "").replace(/\n/g, " ").replace(/"/g, '""')}"`,
        r.relationship || "",
        `"${(r.error || "").replace(/"/g, '""')}"`,
      ]);
    } else {
      const allKeysSet = new Set();
      failed.forEach(r => {
        Object.keys(r).forEach(k => {
          if (k !== 'error') {
            allKeysSet.add(k);
          }
        });
      });
      const dataKeys = Array.from(allKeysSet);
      headers = [...dataKeys, "Error Reason"];
      rows = failed.map(r => {
        const row = dataKeys.map(k => {
          const val = r[k] !== undefined && r[k] !== null ? String(r[k]) : "";
          return `"${val.replace(/"/g, '""').replace(/\n/g, " ")}"`;
        });
        row.push(`"${(r.error || "").replace(/"/g, '""')}"`);
        return row;
      });
    }

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `failed_records_${exploringProtocolId || "bulk"}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="fade-in">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2.5rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Admin Masters
            </h1>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              {viewMode === "PROJECTS"
                ? "Select a project workspace to manage health cards"
                : `Managing workspace: ${projects.find((p) => String(p.id) === String(selectedProject))?.name || "Workspace"}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {viewMode === "DATA" && (
              <>
                <button
                  className="btn"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                    color: "white",
                    border: "none",
                    fontWeight: 800,
                    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    height: "40px",
                    borderRadius: "14px",
                    fontSize: "0.75rem",
                    padding: "0 1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 15px rgba(124, 58, 237, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(124, 58, 237, 0.2)";
                  }}
                  onClick={() => {
                    setViewMode("PROJECTS");
                    setSelectedProject("");
                  }}
                >
                  Back to Project List
                </button>
                {activeBoard === "PROTOCOLS" && isAdmin && (
                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0 1.25rem",
                      height: "40px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      border: "none",
                      fontWeight: 800,
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 15px rgba(99, 102, 241, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.2)";
                    }}
                    onClick={() => {
                      setIsEditingProtocol(false);
                      setNewProtocolData({
                        name: "",
                        description: "",
                        coverage: "",
                        fields: [],
                      });
                      setShowNewProtocolModal(true);
                    }}
                  >
                    <Plus size={16} /> New Registry Type
                  </button>
                )}
                {activeBoard === "DIAGNOSTICS" && (
                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0 1.25rem",
                      height: "40px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      fontWeight: 800,
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 15px rgba(16, 185, 129, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
                    }}
                    onClick={() => setShowLabTestModal(true)}
                  >
                    <Plus size={16} /> New Lab Test
                  </button>
                )}
                {activeBoard === "REGISTRY" && (exploringProtocolId === "employee_master" || exploringProtocolId === "family_member") && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {exploringProtocolId === "employee_master" && isAdmin && (
                      <button
                        className="btn btn-secondary"
                        style={{
                          color: "var(--primary)",
                          fontWeight: 800,
                          fontSize: "0.75rem",
                          height: "40px",
                          borderRadius: "10px",
                          padding: "0 1.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                        onClick={() => {
                          setBulkEnrollData('');
                          setBulkEnrollStatus({
                            isProcessing: false,
                            total: 0,
                            current: 0,
                            success: 0,
                            errors: 0,
                            failedRecords: [],
                            completed: false
                          });
                          setShowBulkEnrollModal(true);
                        }}
                      >
                        <ShieldCheck size={16} color="var(--primary)" /> Bulk Link From Master
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{
                        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                        fontSize: "0.75rem",
                        height: "40px",
                        borderRadius: "10px",
                        padding: "0 1.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                      onClick={() => {
                        setIsEditingMaster(false);
                        setMasterFormData({
                          project: selectedProject || user?.project || "",
                          card_no: "",
                          name: "",
                          dob: "",
                          gender: "MALE",
                          mobile_no: "",
                          aadhar_no: "",
                          address: "",
                          designation: "",
                          proof_image: null,
                          additional_fields: { employee_id: "" },
                        });
                        fetchNextCardNo(selectedProject || user?.project);
                        setShowMasterModal(true);
                      }}
                    >
                      <Plus size={16} /> New Registry Entry
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </header>

        {viewMode === "PROJECTS" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.5rem",
              marginTop: "1rem",
            }}
          >
            {projects && projects.length > 0 ? (
              projects
                .filter((p) => !user?.project || String(p.id) === String(user.project))
                .map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProject(p.id);
                    setViewMode("DATA");
                    const tabsOrder = ["PROTOCOLS", "DIAGNOSTICS", "MACHINES", "STATS", "UPLOAD_HISTORY"];
                    const firstPermitted = tabsOrder.find(t => tabPermissions[t]) || "PROTOCOLS";
                    setActiveBoard(firstPermitted);
                    if (firstPermitted === "STATS") {
                      fetchDashboardStats();
                    } else if (firstPermitted === "DIAGNOSTICS") {
                      fetchLabTests();
                    } else if (firstPermitted === "MACHINES") {
                      fetchLabMachines();
                    } else if (firstPermitted === "UPLOAD_HISTORY") {
                      fetchUploadSessions();
                    } else {
                      fetchEmployeeMasters(1, p.id);
                    }
                  }}
                  className="card fade-in"
                  style={{
                    padding: "1.75rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                    borderRadius: "28px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px)";
                    e.currentTarget.style.boxShadow =
                      "0 15px 30px rgba(0,0,0,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 15px rgba(0,0,0,0.02)";
                  }}
                >
                  <div
                    style={{
                      padding: "1.25rem",
                      background: "var(--background)",
                      borderRadius: "20px",
                      width: "fit-content",
                      margin: "0 auto 1.25rem auto",
                    }}
                  >
                    <Database size={32} color="var(--primary)" />
                  </div>
                  <h4
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 900,
                      marginBottom: "0.75rem",
                      color: "var(--text-main)",
                    }}
                  >
                    {p.name}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--primary)",
                        fontWeight: 800,
                        background: "var(--background)",
                        padding: "0.4rem 1rem",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Open Workspace <Plus size={12} />
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {p.registry_types?.some(rt => rt.slug === 'pharmacy' || rt.icon === 'Pill') ? (
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                          <ShieldCheck size={14} /> Pharmacy Enabled
                       </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetupPharmacy(p.id);
                        }}
                        style={{
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "10px",
                          fontSize: "0.65rem",
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)",
                        }}
                      >
                        <Pill size={14} /> Setup Pharmacy
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  gridColumn: "span 3",
                  textAlign: "center",
                  padding: "5rem",
                  color: "#94a3b8",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    background: "#f1f5f9",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.5rem auto",
                  }}
                >
                  <Activity size={40} style={{ opacity: 0.2 }} />
                </div>
                <h3 style={{ fontWeight: 800, color: "#1e293b" }}>
                  No Projects Found
                </h3>
                <p style={{ fontWeight: 600 }}>
                  Create a project in the settings to start managing masters.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Statistics cards removed at user request */}

            {permittedTabsCount > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "2rem",
                  marginTop: "1.5rem",
                  marginBottom: "1.5rem",
                  borderBottom: "1px solid #e2e8f0",
                  width: "100%",
                  paddingBottom: "0",
                }}
              >
                {tabPermissions.PROTOCOLS && (
                   <button
                    className="btn"
                    style={{
                      background: "transparent",
                      color: (activeBoard === "PROTOCOLS" || activeBoard === "REGISTRY") ? "#6366f1" : "#64748b",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.5rem 0.75rem 0.5rem",
                      borderRadius: "0",
                      transition: "all 0.2s",
                      fontWeight: (activeBoard === "PROTOCOLS" || activeBoard === "REGISTRY") ? 600 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderBottom: (activeBoard === "PROTOCOLS" || activeBoard === "REGISTRY") ? "2px solid #6366f1" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                    onClick={() => setActiveBoard("PROTOCOLS")}
                  >
                    <Layers size={16} color={(activeBoard === "PROTOCOLS" || activeBoard === "REGISTRY") ? "#6366f1" : "#64748b"} /> Data Hub
                  </button>
                )}

                {tabPermissions.DIAGNOSTICS && (
                  <button
                    className="btn"
                    style={{
                      background: "transparent",
                      color: activeBoard === "DIAGNOSTICS" ? "#10b981" : "#64748b",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.5rem 0.75rem 0.5rem",
                      borderRadius: "0",
                      transition: "all 0.2s",
                      fontWeight: activeBoard === "DIAGNOSTICS" ? 600 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderBottom: activeBoard === "DIAGNOSTICS" ? "2px solid #10b981" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                    onClick={() => {
                      setActiveBoard("DIAGNOSTICS");
                      fetchLabTests();
                    }}
                  >
                    <Activity size={16} color={activeBoard === "DIAGNOSTICS" ? "#10b981" : "#64748b"} /> Lab Masters
                  </button>
                )}

                {tabPermissions.MACHINES && (
                  <button
                    className="btn"
                    style={{
                      background: "transparent",
                      color: activeBoard === "MACHINES" ? "#a855f7" : "#64748b",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.5rem 0.75rem 0.5rem",
                      borderRadius: "0",
                      transition: "all 0.2s",
                      fontWeight: activeBoard === "MACHINES" ? 600 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderBottom: activeBoard === "MACHINES" ? "2px solid #a855f7" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                    onClick={() => {
                      setActiveBoard("MACHINES");
                      fetchLabMachines();
                    }}
                  >
                    <Radio size={16} color={activeBoard === "MACHINES" ? "#a855f7" : "#64748b"} /> Sync Bridge
                  </button>
                )}

                {tabPermissions.STATS && (
                  <button
                    className="btn"
                    style={{
                      background: "transparent",
                      color: activeBoard === "STATS" ? "#f59e0b" : "#64748b",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.5rem 0.75rem 0.5rem",
                      borderRadius: "0",
                      transition: "all 0.2s",
                      fontWeight: activeBoard === "STATS" ? 600 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderBottom: activeBoard === "STATS" ? "2px solid #f59e0b" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                    onClick={() => {
                      setActiveBoard("STATS");
                      fetchDashboardStats();
                    }}
                  >
                    <Activity size={16} color={activeBoard === "STATS" ? "#f59e0b" : "#64748b"} /> Analytics & Stock Monitor
                  </button>
                )}

                {tabPermissions.UPLOAD_HISTORY && (
                  <button
                    className="btn"
                    style={{
                      background: "transparent",
                      color: activeBoard === "UPLOAD_HISTORY" ? "#3b82f6" : "#64748b",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.5rem 0.75rem 0.5rem",
                      borderRadius: "0",
                      transition: "all 0.2s",
                      fontWeight: activeBoard === "UPLOAD_HISTORY" ? 600 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderBottom: activeBoard === "UPLOAD_HISTORY" ? "2px solid #3b82f6" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                    onClick={() => {
                      setActiveBoard("UPLOAD_HISTORY");
                      fetchUploadSessions();
                    }}
                  >
                    <History size={16} color={activeBoard === "UPLOAD_HISTORY" ? "#3b82f6" : "#64748b"} /> Upload Audit Logs
                  </button>
                )}
              </div>
            )}

            {activeBoard === "STATS" ? (
              <div className="fade-in">
                {dashboardStats ? (
                  <>
                    {(() => {
                      const currentProtocols = getCurrentProtocols(selectedProject) || [];
                      const hasPharmacy = currentProtocols.some(p => 
                        p.id?.toLowerCase().includes("pharmacy") || 
                        p.id?.toLowerCase().includes("drug") || 
                        p.category === "PHARMACY" || 
                        p.category === "CLINICAL_DRUGS"
                      );

                      return (
                        <>
                          {/* Premium Dashboard Header & Dynamic Threshold Controller */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            background: 'var(--surface)',
                            padding: '0.875rem 1.25rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                  <h2 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                                    Real-Time Operations & Inventory Intelligence
                                  </h2>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <span className="pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real-Time Sync</span>
                                  </div>
                                </div>
                                <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Live clinical trends and pharmacy stock level diagnostics
                                </p>
                              </div>
                            </div>

                            {hasPharmacy && (() => {
                              const isAdmin = user?.role === 'ADMIN' || user?.is_superuser || user?.user_roles?.some(r => r.name === 'ADMIN');
                              const canEdit = isAdmin || allowNonAdmin;
                              return (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  background: 'var(--background)',
                                  padding: '0.375rem 0.75rem',
                                  borderRadius: '12px',
                                  border: '1px solid var(--border)'
                                }}>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Low Stock Warning Threshold:
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button 
                                      onClick={() => setTempThreshold(prev => Math.max(1, prev - 1))}
                                      disabled={!canEdit}
                                      style={{
                                        border: 'none',
                                        background: 'rgba(0,0,0,0.03)',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        cursor: canEdit ? 'pointer' : 'not-allowed',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s',
                                        opacity: canEdit ? 1 : 0.5
                                      }}
                                      onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                                      onMouseLeave={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                    >
                                      −
                                    </button>
                                    <input 
                                      type="range" 
                                      min="1" 
                                      max="100" 
                                      value={tempThreshold} 
                                      onChange={(e) => setTempThreshold(parseInt(e.target.value) || 10)}
                                      disabled={!canEdit}
                                      style={{
                                        width: '120px',
                                        accentColor: '#f59e0b',
                                        cursor: canEdit ? 'pointer' : 'not-allowed',
                                        height: '4px',
                                        borderRadius: '2px',
                                        background: 'var(--border)',
                                        opacity: canEdit ? 1 : 0.5
                                      }}
                                    />
                                    <button 
                                      onClick={() => setTempThreshold(prev => Math.min(100, prev + 1))}
                                      disabled={!canEdit}
                                      style={{
                                        border: 'none',
                                        background: 'rgba(0,0,0,0.03)',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        cursor: canEdit ? 'pointer' : 'not-allowed',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s',
                                        opacity: canEdit ? 1 : 0.5
                                      }}
                                      onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                                      onMouseLeave={(e) => { if (canEdit) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                    >
                                      +
                                    </button>
                                    <div style={{
                                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                      color: 'white',
                                      fontWeight: 900,
                                      fontSize: '0.7rem',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      minWidth: '24px',
                                      textAlign: 'center',
                                      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                                      marginLeft: '0.25rem'
                                    }}>
                                      {tempThreshold}
                                    </div>
                                    
                                    {canEdit ? (
                                      tempThreshold !== lowStockThreshold ? (
                                        <button
                                          onClick={() => {
                                            setLowStockThreshold(tempThreshold);
                                            localStorage.setItem(`low_stock_threshold_${selectedProject}`, tempThreshold);
                                            toast.success(`Low stock threshold updated to ${tempThreshold} units!`);
                                          }}
                                          style={{
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: 'white',
                                            fontSize: '0.65rem',
                                            fontWeight: 850,
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            marginLeft: '0.5rem'
                                          }}
                                        >
                                          <Check size={10} strokeWidth={3} /> Save & Apply
                                        </button>
                                      ) : (
                                        <span style={{
                                          fontSize: '0.625rem',
                                          fontWeight: 800,
                                          color: '#10b981',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          background: 'rgba(16, 185, 129, 0.05)',
                                          border: '1px solid rgba(16, 185, 129, 0.15)',
                                          marginLeft: '0.5rem'
                                        }}>
                                          <Check size={10} strokeWidth={3.5} /> Saved
                                        </span>
                                      )
                                    ) : (
                                      <span style={{
                                        fontSize: '0.625rem',
                                        fontWeight: 800,
                                        color: 'var(--text-muted)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        marginLeft: '0.5rem'
                                      }}>
                                        <Lock size={10} /> Locked (Admin Only)
                                      </span>
                                    )}

                                    {/* Admin-only Switch to Grant/Revoke access for other staff */}
                                    {isAdmin && (
                                      <div 
                                        onClick={() => {
                                          const newVal = !allowNonAdmin;
                                          setAllowNonAdmin(newVal);
                                          localStorage.setItem(`low_stock_threshold_allow_non_admin_${selectedProject}`, newVal);
                                          toast.success(newVal ? "Staff members are now permitted to modify low stock threshold!" : "Access restricted. Only Admins can modify threshold now.");
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.375rem',
                                          background: 'rgba(0,0,0,0.02)',
                                          padding: '3px 8px',
                                          borderRadius: '8px',
                                          border: '1px solid var(--border)',
                                          cursor: 'pointer',
                                          marginLeft: '0.75rem',
                                          userSelect: 'none',
                                          transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                                      >
                                        <div style={{
                                          width: '24px',
                                          height: '14px',
                                          background: allowNonAdmin ? '#10b981' : '#cbd5e1',
                                          borderRadius: '8px',
                                          position: 'relative',
                                          transition: 'background 0.2s ease',
                                          padding: '1px'
                                        }}>
                                          <div style={{
                                            width: '12px',
                                            height: '12px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            position: 'absolute',
                                            left: allowNonAdmin ? '11px' : '1px',
                                            transition: 'left 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                          }} />
                                        </div>
                                        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                          Staff Edit
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* KPI Metric Cards */}
                          {(() => {
                            const StatCard = ({ title, value, icon: Icon, subtext, gradient, onClick }) => (
                              <div className="card fade-in" 
                                onClick={onClick}
                                style={{ 
                                  background: gradient, 
                                  borderRadius: '16px', 
                                  padding: '0.75rem 1.125rem', 
                                  color: 'white',
                                  boxShadow: onClick ? '0 8px 16px -4px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' : '0 6px 12px -3px rgba(0,0,0,0.1)',
                                  position: 'relative',
                                  overflow: 'hidden',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  transition: 'all 0.3s ease',
                                  cursor: onClick ? 'pointer' : 'default',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  minWidth: '0'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-4px)';
                                  if (onClick) {
                                    e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.2)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = onClick ? '0 8px 16px -4px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' : '0 6px 12px -3px rgba(0,0,0,0.1)';
                                }}
                              >
                                <div style={{ position: 'relative', zIndex: 2 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.4rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Icon size={14} strokeWidth={3} />
                                    </div>
                                    <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>Live</div>
                                  </div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>{value}</div>
                                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.01em', marginBottom: '0.1rem' }}>{title}</div>
                                  <div style={{ fontSize: '0.6rem', fontWeight: 600, opacity: 0.7 }}>{subtext}</div>
                                </div>
                                <div style={{ position: 'absolute', right: '-10%', bottom: '-15%', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', zIndex: 1 }}></div>
                              </div>
                            );

                            const filteredModalItems = stockDetailModal.items.filter(item => 
                              item.name?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                              item.ucode?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                              item.category?.toLowerCase().includes(modalSearchQuery.toLowerCase())
                            );

                            return (
                              <>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: hasPharmacy ? "repeat(4, 1fr)" : "repeat(3, 1fr)",
                                    gap: "1rem",
                                    marginBottom: "1.25rem",
                                  }}
                                >
                                  {hasPharmacy ? (
                                    <StatCard 
                                      title="Total Inventory Value" 
                                      value={`₹${dashboardStats.inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                      icon={ShoppingCart}
                                      subtext={`${dashboardStats.total_registered} Patients Served`}
                                      gradient="linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)"
                                    />
                                  ) : (
                                    <StatCard 
                                      title="Total Registered Patients" 
                                      value={`${dashboardStats.total_registered} Patients`}
                                      icon={Users}
                                      subtext="Primary Patients & Dependents"
                                      gradient="linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)"
                                    />
                                  )}
                                  
                                  {hasPharmacy && (
                                    <>
                                      <StatCard 
                                        title="Low Stock Items" 
                                        value={dashboardStats.stock_health.low}
                                        icon={Clock}
                                        subtext="Items needing replenishment"
                                        gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                                        onClick={() => {
                                          setStockDetailModal({
                                            isOpen: true,
                                            title: `Low Stock Inventory Diagnostics`,
                                            type: "LOW_STOCK",
                                            items: depletionItems.filter(item => item.quantity > 0 && item.quantity < lowStockThreshold)
                                          });
                                          setModalSearchQuery("");
                                        }}
                                      />
                                      <StatCard 
                                        title="Out of Stock" 
                                        value={dashboardStats.stock_health.out}
                                        icon={AlertCircle}
                                        subtext="Critically depleted items"
                                        gradient="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                                        onClick={() => {
                                          setStockDetailModal({
                                            isOpen: true,
                                            title: "Critically Depleted Out-of-Stock Registry",
                                            type: "OUT_OF_STOCK",
                                            items: depletionItems.filter(item => item.quantity === 0)
                                          });
                                          setModalSearchQuery("");
                                        }}
                                      />
                                    </>
                                  )}

                                  <StatCard 
                                    title="Clinical Conversion" 
                                    value={`${dashboardStats.conversion_rate}%`}
                                    icon={Activity}
                                    subtext="Visits successfully completed today"
                                    gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)"
                                  />
                                </div>


                              </>
                            );
                          })()}
                          {/* Split Dashboard Row */}
                          {/* Split Dashboard Row */}
                          {/* Split Dashboard Row */}
                          {hasPharmacy ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                               
                               {/* Top Row: Trends and Top Dispensed side-by-side (equal height stretch) */}
                               <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "stretch" }}>
                                  
                                   {/* Section A: Weekly Consumption Trends (Left Side) */}
                                   <div className="card" style={{ flex: "1 1 450px", minWidth: "280px", padding: "0.75rem", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)", display: "flex", flexDirection: "column" }}>
                                      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                            <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                                               WEEKLY MEDICATION TRENDS
                                            </h4>
                                            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 800, background: "var(--background)", padding: "3px 8px", borderRadius: "6px" }}>Live Consumption Chart</span>
                                         </div>

                                         {/* Dynamic Insight Banner */}
                                         {(() => {
                                            const peak = [...dashboardStats.trends].sort((a,b) => b.units - a.units)[0];
                                            if (peak && peak.units > 0) {
                                               let peakDay = "";
                                               try {
                                                  const d = new Date(peak.date);
                                                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                                  peakDay = days[d.getDay()];
                                               } catch(e) {}
                                               return (
                                                  <div style={{ 
                                                     display: "flex", 
                                                     alignItems: "center", 
                                                     gap: "6px", 
                                                     background: "rgba(99, 102, 241, 0.1)", 
                                                     padding: "0.5rem 0.75rem", 
                                                     borderRadius: "10px", 
                                                     fontSize: "0.75rem", 
                                                     fontWeight: 800, 
                                                     color: "#4f46e5",
                                                     border: "1px solid rgba(99, 102, 241, 0.2)",
                                                     marginBottom: "1rem"
                                                  }}>
                                                     <span style={{ fontSize: "0.85rem" }}>⚡</span>
                                                     <span>Peak dispensing reached <b>{peak.units} units</b> on <b>{peakDay} ({peak.date.split('-').slice(1).join('/')})</b></span>
                                                  </div>
                                               );
                                            }
                                            return null;
                                         })()}

                                         {/* Chart Columns Container */}
                                         <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flex: 1, padding: "0.5rem 0", minHeight: "120px" }}>
                                            {dashboardStats.trends.map((t, i) => {
                                               const maxVal = Math.max(...dashboardStats.trends.map(x => x.units), 1);
                                               const percentHeight = Math.min(100, (t.units / maxVal) * 92); /* Max height 92% to leave space for floating indicator */
                                               
                                               let dayName = "";
                                               try {
                                                  const d = new Date(t.date);
                                                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                  dayName = days[d.getDay()];
                                               } catch (e) {
                                                  dayName = "";
                                               }

                                               return (
                                                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%" }}>
                                                     
                                                     {/* Outer Track Column */}
                                                     <div style={{ 
                                                        width: "100%", 
                                                        background: "rgba(99, 102, 241, 0.02)", 
                                                        borderRadius: "12px", 
                                                        height: "135px",
                                                        position: "relative",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        justifyContent: "flex-end",
                                                        border: "1px solid rgba(99, 102, 241, 0.06)",
                                                        padding: "3px" /* Small inset spacing for dynamic bar */
                                                     }} title={`${t.units} units dispensed`}>
                                                        
                                                        {/* Dynamic Floating Value Indicator (always floats exactly 6px above bar) */}
                                                        <span style={{ 
                                                           position: "absolute", 
                                                           bottom: `calc(${percentHeight}% + 6px)`, 
                                                           left: "50%", 
                                                           transform: "translateX(-50%)", 
                                                           fontSize: "0.625rem", 
                                                           fontWeight: 900, 
                                                           color: t.units > 0 ? "#4f46e5" : "var(--text-muted)",
                                                           background: t.units > 0 ? "rgba(99, 102, 241, 0.09)" : "transparent",
                                                           padding: t.units > 0 ? "2px 6px" : "0",
                                                           borderRadius: "6px",
                                                           zIndex: 2,
                                                           transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                                        }}>
                                                           {t.units}
                                                        </span>

                                                        {/* Dynamic Bar */}
                                                        <div style={{ 
                                                           width: "100%", 
                                                           background: t.units > 0 ? "linear-gradient(to top, #4f46e5, #6366f1)" : "#f1f5f9", 
                                                           borderRadius: "10px", 
                                                           height: `${percentHeight}%`,
                                                           boxShadow: t.units > 0 ? "0 4px 10px rgba(99, 102, 241, 0.12)" : "none",
                                                           transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                                                           minHeight: t.units > 0 ? "8px" : "0"
                                                        }} />
                                                     </div>

                                                     {/* Multi-tier Date Label */}
                                                     <div style={{ textAlign: "center", lineHeight: "1.2" }}>
                                                        <span style={{ fontSize: "0.72rem", fontWeight: 900, color: "var(--text-main)", display: "block" }}>{dayName}</span>
                                                        <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--text-muted)" }}>{t.date.split('-').slice(1).join('/')}</span>
                                                     </div>

                                                  </div>
                                               );
                                            })}
                                          </div>
                                       </div>
                                    </div>
                                  {/* Right Column Widget 1: TOP DISPENSED (Right Side) */}
                                  <div className="card" style={{ 
                                     flex: "1 1 360px",
                                     minWidth: "280px",
                                     padding: "0.75rem", 
                                     borderRadius: "10px", 
                                     background: "var(--surface)", 
                                     border: "1px solid var(--border)",
                                     borderLeft: "3px solid #f59e0b",
                                     boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                                     display: "flex",
                                     flexDirection: "column",
                                     justifyContent: "space-between"
                                  }}>
                                     <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                           <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--text-main)", letterSpacing: "0.02em" }}>TOP DISPENSED</h4>
                                           <span style={{ fontSize: "0.625rem", color: "#d97706", fontWeight: 900, background: "rgba(245, 158, 11, 0.15)", padding: "2px 6px", borderRadius: "6px" }}>Volume Rank</span>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                           {dashboardStats.top_medications.slice(0, 5).map((m, i) => {
                                              const maxDispensed = Math.max(...dashboardStats.top_medications.map(x => x.total), 1);
                                              const percentage = (m.total / maxDispensed) * 100;
                                              
                                              const medalBg = "#f1f5f9";
                                              const medalColor = "#475569";
                                              const medalText = `#${i+1}`;

                                              return (
                                                 <div key={i} style={{ 
                                                    display: "flex", 
                                                    flexDirection: "column", 
                                                    gap: "6px", 
                                                    background: "var(--surface)", 
                                                    padding: "0.75rem", 
                                                    borderRadius: "12px", 
                                                    border: "1px solid var(--border)",
                                                    transition: "all 0.2s ease"
                                                 }} className="hover-lift">
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                       <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                          <span style={{ 
                                                             fontSize: "0.75rem", 
                                                             fontWeight: 900, 
                                                             background: medalBg, 
                                                             color: medalColor, 
                                                             width: "20px", 
                                                             height: "20px", 
                                                             borderRadius: "50%", 
                                                             display: "flex", 
                                                             alignItems: "center", 
                                                             justifyContent: "center" 
                                                          }}>
                                                             {medalText}
                                                          </span>
                                                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)" }}>{m.name}</span>
                                                       </div>
                                                       <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "#4f46e5" }}>{m.total} Units</span>
                                                    </div>
                                                    
                                                    {/* Proportional Progress Bar */}
                                                    <div style={{ width: "100%", height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                                                       <div style={{ 
                                                          width: `${percentage}%`, 
                                                          height: "100%", 
                                                          background: "#6366f1",
                                                          borderRadius: "2px",
                                                          transition: "width 0.4s ease-out"
                                                       }} />
                                                    </div>
                                                 </div>
                                              );
                                           })}
                                        </div>
                                     </div>
                                  </div>
                               </div>

                               {/* Bottom Row: Full-width Batch Stock Monitor */}
                               <div className="card" style={{ padding: "0.75rem", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                                     <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <span>BATCH STOCKS MONITOR</span>
                                        <span style={{ 
                                           fontSize: "0.625rem", 
                                           background: "rgba(99, 102, 241, 0.15)", 
                                           color: "#4f46e5", 
                                           padding: "2px 8px", 
                                           borderRadius: "20px", 
                                           fontWeight: 900,
                                           border: "1px solid rgba(99, 102, 241, 0.2)",
                                        }}>
                                           {(() => {
                                              const filteredCount = (dashboardStats.batches || []).filter(b => {
                                                 const q = batchSearchQuery.toLowerCase();
                                                 return b.medication_name.toLowerCase().includes(q) || b.batch_number.toLowerCase().includes(q);
                                              }).length;
                                              const totalCount = (dashboardStats.batches || []).length;
                                              return batchSearchQuery ? `${filteredCount} of ${totalCount} Batches` : `${totalCount} Total Batches`;
                                           })()}
                                        </span>
                                     </h4>
                                     
                                     {/* Premium Search Input */}
                                     <div style={{ position: "relative", minWidth: "180px" }}>
                                        <input
                                           type="text"
                                           placeholder="Filter batch database..."
                                           value={batchSearchQuery}
                                           onChange={(e) => setBatchSearchQuery(e.target.value)}
                                           style={{
                                              width: "100%",
                                              padding: "0.5rem 0.75rem 0.5rem 2rem",
                                              fontSize: "0.75rem",
                                              fontWeight: 600,
                                              borderRadius: "8px",
                                              border: "1px solid #cbd5e1",
                                              background: "#f8fafc",
                                              outline: "none",
                                              transition: "all 0.2s",
                                              color: "var(--text-main)"
                                           }}
                                        />
                                        <svg style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", fill: "none", stroke: "#64748b", strokeWidth: 2.5, pointerEvents: "none" }} viewBox="0 0 24 24">
                                           <circle cx="11" cy="11" r="8" />
                                           <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                     </div>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                                     {dashboardStats.batches && dashboardStats.batches.length > 0 ? (
                                        (() => {
                                           // Group and find currently consuming batch (earliest non-expired, non-depleted)
                                           const activeBatchForMed = {};
                                           const activeBatchesSorted = [...dashboardStats.batches]
                                              .filter(b => b.quantity > 0 && b.status !== 'EXPIRED')
                                              .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
                                           
                                           activeBatchesSorted.forEach(b => {
                                              if (!activeBatchForMed[b.medication_name]) {
                                                 activeBatchForMed[b.medication_name] = b.batch_number;
                                              }
                                           });

                                           const filtered = dashboardStats.batches.filter(b => {
                                              const q = batchSearchQuery.toLowerCase();
                                              return b.medication_name.toLowerCase().includes(q) || b.batch_number.toLowerCase().includes(q);
                                           });

                                           const sortedBatches = [...filtered].sort((a, b) => {
                                              const aIsConsuming = a.quantity > 0 && a.status !== 'EXPIRED' && activeBatchForMed[a.medication_name] === a.batch_number;
                                              const bIsConsuming = b.quantity > 0 && b.status !== 'EXPIRED' && activeBatchForMed[a.medication_name] === b.batch_number;
                                              
                                              if (aIsConsuming && !bIsConsuming) return -1;
                                              if (!aIsConsuming && bIsConsuming) return 1;
                                              
                                              if (a.status === 'EXPIRED') return -1;
                                              if (b.status === 'EXPIRED') return 1;
                                              if (a.status === 'EXPIRING_SOON') return -1;
                                              if (b.status === 'EXPIRING_SOON') return 1;
                                              return a.quantity - b.quantity;
                                           });

                                           if (sortedBatches.length === 0) {
                                              return (
                                                 <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>
                                                    No batches match your filter criteria.
                                                 </div>
                                              );
                                           }

                                           return sortedBatches.map((b) => {
                                              const isExpired = b.status === 'EXPIRED' || b.days_to_expiry <= 0;
                                              const isDepleted = b.quantity <= 0;
                                              const isConsuming = !isExpired && !isDepleted && activeBatchForMed[b.medication_name] === b.batch_number;
                                              
                                              let roleLabel = "BACKUP STOCK";
                                              let roleColor = "#4f46e5";
                                              let roleBg = "rgba(99, 102, 241, 0.08)";
                                              let roleBorder = "1px solid rgba(99, 102, 241, 0.15)";
                                              
                                              if (isDepleted) {
                                                 roleLabel = "DEPLETED";
                                                 roleColor = "var(--text-muted)";
                                                 roleBg = "#f8fafc";
                                                 roleBorder = "1px solid #e2e8f0";
                                              } else if (isExpired) {
                                                 roleLabel = "EXPIRED";
                                                 roleColor = "#ef4444";
                                                 roleBg = "rgba(239, 68, 68, 0.08)";
                                                 roleBorder = "1px solid rgba(239, 68, 68, 0.15)";
                                              } else if (isConsuming) {
                                                 roleLabel = "ACTIVE CONSUMING";
                                                 roleColor = "#ea580c";
                                                 roleBg = "rgba(234, 88, 12, 0.08)";
                                                 roleBorder = "1px solid rgba(234, 88, 12, 0.15)";
                                              }

                                              const statusColor = isExpired ? '#ef4444' : isDepleted ? '#ef4444' : b.status === 'EXPIRING_SOON' ? '#f59e0b' : b.status === 'LOW_STOCK' ? '#f97316' : b.status === 'HIGH_STOCK' ? '#3b82f6' : '#10b981';
                                              const statusBg = isExpired ? 'rgba(239, 68, 68, 0.15)' : isDepleted ? 'rgba(239, 68, 68, 0.15)' : b.status === 'EXPIRING_SOON' ? 'rgba(245, 158, 11, 0.15)' : b.status === 'LOW_STOCK' ? 'rgba(249, 115, 22, 0.15)' : b.status === 'HIGH_STOCK' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                                              const statusLabel = isExpired ? 'EXPIRED' : isDepleted ? 'DEPLETED' : b.status === 'EXPIRING_SOON' ? 'EXPIRING' : b.status === 'LOW_STOCK' ? 'LOW' : b.status === 'HIGH_STOCK' ? 'HIGH' : 'SAFE';

                                              return (
                                                 <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "0.75rem 1rem", borderRadius: "12px", border: "1px solid var(--border)", borderLeft: isConsuming ? "4px solid #ea580c" : "1px solid var(--border)", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)", transition: "all 0.2s" }} className="hover-lift">
                                                    <div>
                                                       <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)" }}>{b.medication_name}</span>
                                                          <span style={{ fontSize: "0.625rem", background: "rgba(148, 163, 184, 0.12)", color: "var(--text-main)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>B {b.batch_number}</span>
                                                          <span style={{ fontSize: "0.625rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>₹{b.unit_cost !== undefined ? Number(b.unit_cost).toFixed(2) : "0.00"}</span>
                                                          
                                                          <span style={{ 
                                                             fontSize: "0.625rem", 
                                                             background: roleBg, 
                                                             color: roleColor, 
                                                             padding: "2px 6px", 
                                                             borderRadius: "4px", 
                                                             fontWeight: 700,
                                                             border: roleBorder,
                                                             display: "flex",
                                                             alignItems: "center",
                                                             gap: "2px"
                                                          }}>
                                                             {isConsuming && <span style={{ display: "inline-block", width: "4px", height: "4px", background: "#ea580c", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />}
                                                             {roleLabel}
                                                          </span>
                                                       </div>
                                                       <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                                                          <span>Mfg: <b>{b.mfg_date}</b></span>
                                                          <span style={{ color: "#cbd5e1" }}>|</span>
                                                          <span>Exp: <b style={{ color: "var(--text-main)" }}>{b.expiry_date}</b></span>
                                                          <span style={{ color: "#cbd5e1" }}>|</span>
                                                          {isExpired ? (
                                                              <span style={{ color: "#ef4444", fontWeight: 700 }}>EXPIRED</span>
                                                          ) : b.days_to_expiry <= 90 ? (
                                                              <span style={{ color: "#b45309", fontWeight: 700 }}>Expiring {b.days_to_expiry}d</span>
                                                          ) : (
                                                              <span>({b.days_to_expiry}d)</span>
                                                          )}
                                                       </div>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                       <div style={{ textAlign: "right" }}>
                                                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)", display: "block" }}>{b.quantity} / {b.initial_qty}</span>
                                                          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block" }}>{Math.round((b.quantity / (b.initial_qty || 1)) * 100)}% left</span>
                                                       </div>
                                                       <span style={{ 
                                                          fontSize: "0.625rem", 
                                                          background: statusBg, 
                                                          color: statusColor, 
                                                          padding: "2px 6px", 
                                                          borderRadius: "6px", 
                                                          fontWeight: 700,
                                                          border: `1px solid ${statusColor}10`,
                                                          minWidth: "40px",
                                                          textAlign: "center"
                                                       }}>
                                                          {statusLabel}
                                                       </span>
                                                       
                                                       {/* Beautiful Ledger History Trigger */}
                                                       <button
                                                          title="View Stock Deduction History"
                                                          onClick={() => openBatchLedger(b)}
                                                          style={{
                                                             background: "var(--surface)",
                                                             border: "1px solid var(--border)",
                                                             borderRadius: "8px",
                                                             width: "30px",
                                                             height: "30px",
                                                             cursor: "pointer",
                                                             display: "flex",
                                                             alignItems: "center",
                                                             justifyContent: "center",
                                                             transition: "all 0.2s"
                                                          }}
                                                          className="hover-lift"
                                                       >
                                                          <svg width="14" height="14" fill="none" stroke="var(--primary)" strokeWidth="2.5" viewBox="0 0 24 24">
                                                             <path d="M12 8v4l3 3" stroke="var(--primary)" />
                                                             <circle cx="12" cy="12" r="9" stroke="var(--primary)" />
                                                          </svg>
                                                       </button>
                                                    </div>
                                                 </div>
                                              );
                                           });
                                        })()
                                     ) : (
                                        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                           No active batch listings registered for this pharmacy workspace.
                                        </div>
                                     )}
                                  </div>
                               </div>
                            </div>
                          ) : (
                            <div 
                              className="card" 
                              style={{ 
                                padding: "3.5rem 2rem", 
                                borderRadius: "16px", 
                                textAlign: "center", 
                                background: "var(--surface)", 
                                border: "1px solid var(--border)" 
                              }}
                            >
                              <div style={{ 
                                width: "56px", 
                                height: "56px", 
                                borderRadius: "50%", 
                                background: "#fffbeb", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                margin: "0 auto 1.25rem" 
                              }}>
                                 <Info size={28} color="#d97706" />
                              </div>
                              <h4 style={{ fontSize: "1rem", fontWeight: 900, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                                No Active Pharmacy Registry
                              </h4>
                              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", maxWidth: "480px", margin: "0 auto", lineHeight: "1.6" }}>
                                Pharmacy inventory metrics and real-time drug depletion warnings are hidden because there are no active Pharmacy or Drug registries configured in this workspace.
                              </p>
                            </div>
                          )}

                          {/* Unified Drug Depletion Monitor (Admin Master Only) */}
                          {hasPharmacy && (
                            <div className="card fade-in" style={{ padding: '1rem', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)", marginTop: '1.25rem' }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.15rem", flexWrap: "wrap", gap: "1rem" }}>
                                 <div>
                                   <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                                     <Pill size={16} color="#ef4444" /> Unified Drug Depletion Monitor
                                   </h4>
                                   <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 500, marginTop: "2px" }}>Real-time health overview of critically low medication inventory</p>
                                 </div>

                                 {/* Premium Table Search Bar */}
                                 <div style={{ position: "relative", minWidth: "260px" }}>
                                    <input
                                       type="text"
                                       placeholder="Search table medications..."
                                       value={depletionSearchQuery}
                                       onChange={(e) => setDepletionSearchQuery(e.target.value)}
                                       style={{
                                          width: "100%",
                                          padding: "0.5rem 0.75rem 0.5rem 2rem",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          borderRadius: "8px",
                                          border: "1px solid var(--border)",
                                          background: "var(--background)",
                                          outline: "none",
                                          transition: "all 0.2s",
                                          color: "var(--text-main)"
                                       }}
                                    />
                                    <svg style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", fill: "none", stroke: "#64748b", strokeWidth: 2.5, pointerEvents: "none" }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                 </div>
                              </div>
                              
                              <div className="table-responsive" style={{ borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", maxHeight: "480px", overflowY: "auto" }}
                                onScroll={(e) => {
                                  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                                  if (scrollTop + clientHeight >= scrollHeight - 20) {
                                    setDepletionDisplayLimit(prev => prev + 10);
                                  }
                                }}
                              >
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ background: "var(--background)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
                                      <th style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", padding: "1rem 1.25rem", letterSpacing: "0.05em", background: "var(--background)" }}>Medication Name</th>
                                      <th style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", padding: "1rem 1.25rem", letterSpacing: "0.05em", background: "var(--background)" }}>Facility Project</th>
                                      <th style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", padding: "1rem 1.25rem", letterSpacing: "0.05em", background: "var(--background)" }}>Quantity Left</th>
                                      <th style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", padding: "1rem 1.25rem", letterSpacing: "0.05em", background: "var(--background)" }}>Depletion Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {isDepletionLoading ? (
                                      <tr>
                                        <td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                                          Analyzing inventory levels...
                                        </td>
                                      </tr>
                                    ) : depletionItems.length === 0 ? (
                                      <tr>
                                        <td colSpan="4" style={{ textAlign: "center", padding: "3.5rem", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                          No medication stocks found in this workspace.
                                        </td>
                                      </tr>
                                    ) : (
                                       (() => {
                                          const filteredDepletion = depletionItems.filter(item => 
                                             item.name.toLowerCase().includes(depletionSearchQuery.toLowerCase())
                                          );
                                          
                                          if (filteredDepletion.length === 0) {
                                             return (
                                                <tr>
                                                   <td colSpan="4" style={{ textAlign: "center", padding: "3.5rem", color: "var(--text-muted)", fontSize: "0.8125rem", fontWeight: 800 }}>
                                                      No medications match your search criteria.
                                                   </td>
                                                </tr>
                                             );
                                          }
                                          
                                          return filteredDepletion.slice(0, depletionDisplayLimit).map((item, idx) => {
                                             const initialQty = parseInt(item.additional_fields?.initial_quantity) || 100;
                                             const pct = Math.round((item.quantity / initialQty) * 100) || 0;
                                             const isZero = item.quantity === 0;
                                             const isLow = pct <= 20;
                                             
                                             const dotColor = isZero ? "#ef4444" : isLow ? "#f59e0b" : "#10b981";
                                             const badgeBg = isZero ? "rgba(239, 68, 68, 0.05)" : isLow ? "rgba(245, 158, 11, 0.05)" : "rgba(16, 185, 129, 0.05)";
                                             const badgeColor = isZero ? "#ef4444" : isLow ? "#f59e0b" : "#10b981";
                                             const badgeBorder = isZero ? "rgba(239, 68, 68, 0.1)" : isLow ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)";
                                             
                                             const qtyColor = isZero ? "#ef4444" : isLow ? "#f59e0b" : "var(--text-main)";
                                             
                                             const gradient = isZero 
                                               ? "linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)" 
                                               : isLow 
                                                 ? "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)"
                                                 : "linear-gradient(90deg, #10b981 0%, #059669 100%)";
                                                 
                                             const statusText = isZero ? "DEPLETED" : isLow ? `${pct}% left` : `SAFE - ${pct}%`;
                                             
                                             return (
                                               <tr 
                                                 key={idx} 
                                                 style={{ 
                                                   borderBottom: "1px solid var(--border)",
                                                   transition: "all 0.2s ease",
                                                   background: "transparent"
                                                 }}
                                                 onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(148, 163, 184, 0.08)"; }}
                                                 onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                               >
                                                 <td style={{ padding: "1rem 1.25rem", fontWeight: 800, fontSize: "0.8125rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                                                   <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: dotColor, animation: isLow ? "pulse 1.5s infinite" : "none" }} />
                                                   {item.name}
                                                 </td>
                                                 <td style={{ padding: "1rem 1.25rem" }}>
                                                   <span style={{ 
                                                     background: "rgba(99, 102, 241, 0.08)", 
                                                     color: "var(--primary)", 
                                                     padding: "4px 10px", 
                                                     borderRadius: "12px", 
                                                     fontWeight: 700, 
                                                     fontSize: "0.75rem", 
                                                     border: "1px solid rgba(99, 102, 241, 0.15)",
                                                     display: "inline-block"
                                                   }}>
                                                     {item.registry_type_project_name || "Global"}
                                                   </span>
                                                 </td>
                                                 <td style={{ padding: "1rem 1.25rem", fontSize: "0.8125rem", fontWeight: 900 }}>
                                                   <span style={{ 
                                                      color: qtyColor,
                                                      fontWeight: 700,
                                                      fontSize: "0.8125rem"
                                                    }}>
                                                      {item.quantity} / {initialQty} units
                                                    </span>
                                                 </td>
                                                 <td style={{ padding: "1rem 1.25rem" }}>
                                                   <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                     <div style={{ flex: 1, minWidth: "80px", height: "8px", background: "var(--background)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border)" }}>
                                                       <div style={{ 
                                                         width: `${Math.min(100, pct)}%`, 
                                                         height: "100%", 
                                                         background: gradient, 
                                                         borderRadius: "4px",
                                                         transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                                                       }} />
                                                     </div>
                                                     <span style={{ 
                                                       fontSize: "0.6875rem", 
                                                       fontWeight: 900, 
                                                       padding: "3px 8px", 
                                                       borderRadius: "6px", 
                                                       background: badgeBg, 
                                                       color: badgeColor,
                                                       border: `1px solid ${badgeBorder}`,
                                                       boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                                                     }}>
                                                       {statusText}
                                                     </span>
                                                   </div>
                                                 </td>
                                               </tr>
                                             );
                                          });
                                       })()
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <div
                    style={{
                      padding: "4rem 2rem",
                      textAlign: "center",
                      background: "white",
                      borderRadius: "32px",
                      border: "1.5px dashed #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        background: "#f5f3ff",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.5rem auto",
                      }}
                    >
                      <Database size={40} color="var(--primary)" />
                    </div>
                    <h2
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 900,
                        marginBottom: "0.5rem",
                      }}
                    >
                      Workspace Repository Ready
                    </h2>
                    <p
                      style={{
                        color: "#64748b",
                        fontWeight: 600,
                        marginBottom: "2.5rem",
                      }}
                    >
                      Select 'Browse Registry' to view and manage {totalCount}{" "}
                      patient records and {totalFamilyCount} dependents.
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{
                        margin: "0 auto",
                        padding: "1rem 3rem",
                        borderRadius: "16px",
                      }}
                      onClick={() => {
                        setActiveBoard("PROTOCOLS");
                      }}
                    >
                      Open Protocol Hub
                    </button>
                  </div>
                )}
              </div>
            ) : activeBoard === "PROTOCOLS" ? (
              <div className="fade-in">
                {/* Protocol Visibility Control Panel */}
                {isAdmin && (
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "24px",
                      padding: "1.5rem",
                      marginBottom: "1.5rem",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                          ⚙️ Registry Protocol Visibility Settings
                        </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                          Toggle which registry upload protocols are active and visible in the workspace hub.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      {getCurrentProtocols().map((proto) => {
                        const isHidden = !proto.is_visible;
                        return (
                          <button
                            key={proto.id}
                            onClick={() => toggleProtocolVisibility(proto)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 16px",
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                              background: isHidden ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              color: isHidden ? "#ef4444" : "#10b981",
                              cursor: "pointer",
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              transition: "all 0.2s"
                            }}
                          >
                            <span style={{ 
                              width: "8px", 
                              height: "8px", 
                              borderRadius: "50%", 
                              background: isHidden ? "#ef4444" : "#10b981" 
                            }} />
                            {proto.name} {isHidden ? "(Hidden)" : "(Allowed)"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  className="card"
                  style={{
                    padding: 0,
                    borderRadius: "24px",
                    overflow: "hidden",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr
                        style={{
                          background: "var(--surface)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <th
                          style={{
                            padding: "1rem 2rem",
                            textAlign: "left",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#475569",
                            background: "var(--surface)",
                          }}
                        >
                          Available Upload Protocol
                        </th>
                        <th
                          style={{
                            padding: "1rem 2rem",
                            textAlign: "left",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#475569",
                            background: "var(--surface)",
                          }}
                        >
                          Data Coverage
                        </th>
                        <th
                          style={{
                            padding: "1rem 2rem",
                            textAlign: "right",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#475569",
                            background: "var(--surface)",
                          }}
                        >
                          Management Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentProtocols().filter(proto => isAdmin || proto.is_visible).length === 0 ? (
                        <tr>
                          <td colSpan="3" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontWeight: 700 }}>
                            All upload protocols are currently hidden by visibility settings.
                          </td>
                        </tr>
                      ) : (
                        getCurrentProtocols()
                          .filter(proto => isAdmin || proto.is_visible)
                          .map((proto) => (
                        <tr
                          key={proto.id}
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <td style={{ padding: "1.5rem 2rem" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "1.25rem",
                              }}
                            >
                              <div
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  background: `${proto.color}10`,
                                  borderRadius: "12px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <proto.icon
                                  size={24}
                                  style={{ color: proto.color }}
                                />
                              </div>
                              <div>
                                <h4
                                  style={{
                                    fontSize: "1rem",
                                    fontWeight: 800,
                                    color: "var(--text-main)",
                                    marginBottom: "2px",
                                  }}
                                >
                                {proto.name}
                                </h4>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <p
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {proto.description}
                                  </p>
                                  {(proto.icon === Pill || proto.slug.includes('pharmacy')) && (
                                     <span style={{ 
                                       fontSize: "0.625rem", 
                                       background: "#fef3c7", 
                                       color: "#92400e", 
                                       padding: "2px 6px", 
                                       borderRadius: "4px", 
                                       fontWeight: 900 
                                     }}>
                                       AUTO-DEDUCTIVE
                                     </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "1.5rem 2rem" }}>
                            <span
                              style={{
                                fontSize: "0.625rem",
                                fontWeight: 900,
                                color: "#0f172a",
                                background: "#f1f5f9",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                border: "1px solid #e2e8f0"
                              }}
                            >
                              {proto.coverage}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "1.5rem 2rem",
                              textAlign: "right",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                justifyContent: "flex-end",
                                alignItems: "center",
                              }}
                            >
                              {isAdmin && proto.isCustom && (
                                <>
                                  <button
                                    onClick={() => {
                                      setIsEditingProtocol(true);
                                      setEditingProtocolId(proto.dbId);
                                      setNewProtocolData({
                                        name: proto.name,
                                        description: proto.description,
                                        coverage: proto.coverage,
                                        fields: proto.fields || [],
                                      });
                                      setShowNewProtocolModal(true);
                                    }}
                                    style={{
                                      border: "none",
                                      background: "#f8fafc",
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "10px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#6366f1",
                                    }}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteProtocol(proto.dbId)
                                    }
                                    style={{
                                      border: "none",
                                      background: "#fef2f2",
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "10px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#ef4444",
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <div
                                    style={{
                                      width: "1px",
                                      height: "24px",
                                      background: "#e2e8f0",
                                      margin: "0 4px",
                                    }}
                                  />
                                </>
                              )}
                              <button
                                className="btn btn-secondary"
                                style={{
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  color: "#1e293b",
                                  fontSize: "0.75rem",
                                  height: "40px",
                                  padding: "0 1.25rem",
                                  borderRadius: "10px",
                                  fontWeight: 800,
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                }}
                                onClick={() => {
                                  setExploringProtocolId(proto.id);
                                  setActiveBoard("REGISTRY");
                                  if (proto.id === "employee_master") {
                                    setSearchQuery("");
                                  }
                                  fetchEmployeeMasters(1, null, proto.id);
                                }}
                              >
                                Explore
                              </button>
                              <button
                                className="btn btn-primary"
                                style={{
                                  background: proto.color,
                                  border: "none",
                                  color: "white",
                                  fontSize: "0.75rem",
                                  height: "40px",
                                  padding: "0 1.25rem",
                                  borderRadius: "10px",
                                  fontWeight: 800,
                                  boxShadow: `0 4px 12px ${proto.color}30`,
                                }}
                                onClick={() => {
                                  setBulkProject(selectedProject);
                                  setExploringProtocolId(proto.id);
                                  setBulkType(
                                    proto.id === "employee_master"
                                      ? "MASTER"
                                      : proto.id === "family_member"
                                        ? "FAMILY"
                                        : "HEALTH",
                                  );
                                  setBulkStep("UPLOAD");
                                  setShowBulkModal(true);
                                }}
                              >
                                Upload
                              </button>
                            </div>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeBoard === "MACHINES" ? (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>Regional Sync Bridge</h3>
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Configure project linking and monitoring for {projects.find(p => String(p.id) === String(selectedProject))?.name} hardware</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            className="btn btn-secondary"
                            onClick={() => navigate('/bridge-hub')}
                            style={{ 
                                borderRadius: '12px', 
                                padding: '0.75rem 1.25rem', 
                                fontSize: '0.75rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                color: 'white',
                                border: 'none',
                                fontWeight: 800,
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Radio size={16} /> Global Hub
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={() => {
                              setIsEditingMachine(false);
                              setMachineForm({ machine_id: "", machine_name: "", lab_id: "", location: "", is_active: true });
                              setShowMachineModal(true);
                            }}
                            style={{ background: 'var(--primary)', borderRadius: '12px', padding: '0.75rem 1.5rem' }}
                        >
                            <Plus size={18} /> Register Station
                        </button>
                    </div>
                </div>

                {isLoadingMachines ? (
                  <div style={{ padding: '8rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '32px' }}>
                      <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
                      <p style={{ fontWeight: 800, color: 'var(--text-muted)' }}>Syncing registry states...</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                      {labMachines.map(m => (
                        <div key={m.id} className="card" style={{ 
                            padding: '1.5rem', 
                            borderRadius: '24px', 
                            border: '1px solid var(--border)', 
                            background: 'var(--surface)',
                            position: 'relative',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ padding: '12px', background: 'var(--background)', borderRadius: '16px', border: m.is_online ? '2.5px solid #10b981' : '2.5px solid var(--border)' }}>
                                            <Radio size={24} color={m.is_online ? '#10b981' : 'var(--text-muted)'} />
                                        </div>
                                        {m.is_online && <div style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '3px solid var(--surface)', animation: 'pulse 2s infinite' }} />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-main)' }}>{m.machine_name || m.name}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.lab_id || 'LOCAL_GW'} • {m.location || 'SITE'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      onClick={() => { setCurrentMachine(m); setMachineForm({...m}); setIsEditingMachine(true); setShowMachineModal(true); }}
                                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'var(--background)', color: 'var(--text-main)' }}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '18px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Health</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: m.is_online ? '#059669' : '#eab308' }}>
                                        {m.is_online ? 'ACTIVE SIGNAL' : 'SIGNAL IDLE'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: m.is_online ? '100%' : '30%', height: '100%', background: m.is_online ? '#10b981' : '#f59e0b', transition: 'width 1s' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '4px' }}>TELEMETRY</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#6366f1' }}>{m.telemetry_data?.total_records || 0} Records</div>
                                </div>
                                <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '4px' }}>LAST PULSE</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>{m.last_pulse ? new Date(m.last_pulse).toLocaleTimeString() : '---'}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem', background: 'rgba(14, 165, 233, 0.15)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800 }}>
                                    Security Managed Centrally
                                </div>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: '#0284c7', border: 'none', borderRadius: '8px' }}
                                    onClick={() => navigate('/bridge-hub')}
                                >
                                    View Project Master Key
                                </button>
                            </div>
                        </div>
                      ))}
                      {labMachines.length === 0 && (
                        <div style={{ gridColumn: '1/-1', padding: '8rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '32px', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '64px', height: '64px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                <Radio size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Bridge Data Available</h3>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, maxWidth: '400px', margin: '0 auto' }}>Establishing a sync bridge is required to begin ingestion for this project workspace. Please ensure your local agents are configured with the correct project key.</p>
                            </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ) : activeBoard === "UPLOAD_HISTORY" ? (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>Registry Upload & Change Audit History</h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Complete permanent chronological ledger of spreadsheet uploads, refills, and record modifications</p>
                  </div>
                  <button 
                    className="btn"
                    onClick={fetchUploadSessions}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={14} className={sessionsLoading || auditLogsLoading ? "spin" : ""} /> Refresh Logs
                  </button>
                </div>

                {/* Sub Tabs for Upload History vs Edit History */}
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.25rem' }}>
                  <button
                    onClick={() => setUploadHistorySubTab("UPLOADS")}
                    style={{
                      padding: '10px 20px',
                      background: uploadHistorySubTab === "UPLOADS" ? 'var(--primary)' : 'transparent',
                      color: uploadHistorySubTab === "UPLOADS" ? 'white' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: uploadHistorySubTab === "UPLOADS" ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                    }}
                  >
                    Registry Upload History
                  </button>
                  <button
                    onClick={() => setUploadHistorySubTab("EDITS")}
                    style={{
                      padding: '10px 20px',
                      background: uploadHistorySubTab === "EDITS" ? 'var(--primary)' : 'transparent',
                      color: uploadHistorySubTab === "EDITS" ? 'white' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: uploadHistorySubTab === "EDITS" ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                    }}
                  >
                    Registry & Personnel Change Audits
                  </button>
                </div>

                {uploadHistorySubTab === "UPLOADS" ? (
                  sessionsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
                      <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                    </div>
                  ) : uploadSessions.length === 0 ? (
                    <div style={{ padding: '8rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '32px', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ width: '64px', height: '64px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                        <Clock size={32} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Upload Sessions Recorded</h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, maxWidth: '400px', margin: '0 auto' }}>All Excel/CSV imports, registry updates, and drug refills will be logged here with complete audits of who, when, and what was added.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>File Details</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Registry / Category</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Mode</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Tally (Success / Errors)</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Done By</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Audit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uploadSessions.map((session) => (
                              <tr key={session.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.875rem' }}>{session.filename}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{new Date(session.timestamp).toLocaleString('en-IN', { hour12: true })}</div>
                                </td>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 800, 
                                    color: session.registry_type_name?.toLowerCase().includes('drug') ? '#8b5cf6' : '#3b82f6',
                                    background: session.registry_type_name?.toLowerCase().includes('drug') ? 'rgba(139, 92, 246, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                    padding: '4px 10px',
                                    borderRadius: '20px'
                                  }}>
                                    {session.registry_type_name || 'Registry'}
                                  </span>
                                </td>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: session.mode === 'INCREMENT' || session.mode === 'ADD' ? '#059669' : '#d97706',
                                    background: session.mode === 'INCREMENT' || session.mode === 'ADD' ? 'rgba(5, 150, 105, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                                    padding: '4px 10px',
                                    borderRadius: '20px'
                                  }}>
                                    {session.mode === 'INCREMENT' || session.mode === 'ADD' ? 'Refill (Add)' : 'Replace'}
                                  </span>
                                </td>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                                      {session.success_count} Passed
                                    </span>
                                    {session.error_count > 0 && (
                                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                                        {session.error_count} Failed
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '1.25rem 2rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  {session.username || 'System Admin'}
                                </td>
                                <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                  <button
                                    className="btn"
                                    onClick={() => {
                                      setSelectedSession(session);
                                      setActiveDetailTab(session.success_count > 0 ? "SUCCESS" : "FAILED");
                                    }}
                                    style={{
                                      background: 'var(--primary)',
                                      color: 'white',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                      borderRadius: '10px',
                                      padding: '6px 14px',
                                      border: 'none',
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)'
                                    }}
                                  >
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                ) : (
                  auditLogsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
                      <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div style={{ padding: '8rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '32px', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ width: '64px', height: '64px', background: 'var(--background)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                        <Clock size={32} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Change Audits Recorded</h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, maxWidth: '400px', margin: '0 auto' }}>All manual edits, changes, additions, and overrides will be logged here with complete "from old to new" details.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Timestamp</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Module</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Action</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Done By</th>
                              <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569', background: 'var(--surface)' }}>Details of Modifications</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.filter(log => ['Registry', 'Personnel', 'Governance'].includes(log.module)).map((log) => (
                              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                                <td style={{ padding: '1.25rem 2rem', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                    {new Date(log.timestamp).toLocaleString('en-IN', { hour12: true })}
                                  </div>
                                </td>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 800, 
                                    color: log.module === 'Registry' ? '#3b82f6' : '#8b5cf6',
                                    background: log.module === 'Registry' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(139, 92, 246, 0.08)',
                                    padding: '4px 10px',
                                    borderRadius: '20px'
                                  }}>
                                    {log.module}
                                  </span>
                                </td>
                                <td style={{ padding: '1.25rem 2rem' }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: log.action.includes('Updated') ? '#d97706' : '#059669',
                                    background: log.action.includes('Updated') ? 'rgba(217, 119, 6, 0.08)' : 'rgba(5, 150, 105, 0.08)',
                                    padding: '4px 10px',
                                    borderRadius: '20px'
                                  }}>
                                    {log.action}
                                  </span>
                                </td>
                                <td style={{ padding: '1.25rem 2rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  {log.user_name || 'System Admin'}
                                </td>
                                <td style={{ padding: '1.25rem 2rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                  {log.details}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : activeBoard === "DIAGNOSTICS" ? (
              <div className="fade-in">
                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>Laboratory Diagnostic Masters</h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Configure project-specific lab tests and component definitions</p>
                </div>
                
                <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div className="table-responsive">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569', background: 'var(--surface)' }}>Test Name / Code</th>
                                  <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569', background: 'var(--surface)' }}>Type</th>
                                  <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: '#475569', background: 'var(--surface)' }}>Dept / Components</th>
                                  <th style={{ padding: '1rem 2rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569', background: 'var(--surface)' }}>Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                               {labTests.map(test => (
                                 <React.Fragment key={test.id}>
                                   <tr style={{ borderBottom: '1px solid var(--border)', background: test.is_active ? 'transparent' : 'var(--background)' }}>
                                       <td style={{ padding: '1.5rem 2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                               <button
                                                  onClick={() => setExpandedLabTests({ ...expandedLabTests, [test.id]: !expandedLabTests[test.id] })}
                                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedLabTests[test.id] ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                                  title={expandedLabTests[test.id] ? "Collapse" : "Expand"}
                                               >
                                                  <ChevronRight size={16} />
                                               </button>
                                               <div style={{ padding: '8px', background: 'var(--background)', borderRadius: '10px' }}>
                                                  <FlaskConical size={20} color="var(--primary)" />
                                               </div>
                                               <div>
                                                 <div style={{ fontWeight: 800, color: test.is_active ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '1rem' }}>{test.name}</div>
                                                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Code: {test.code || 'N/A'}</div>
                                               </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.5rem 2rem' }}>
                                            <span style={{ fontSize: '0.625rem', fontWeight: 900, background: test.is_active ? 'rgba(99, 102, 241, 0.15)' : 'var(--background)', color: test.is_active ? '#818cf8' : 'var(--text-muted)', padding: '0.4rem 0.75rem', borderRadius: '8px', textTransform: 'uppercase' }}>
                                                {test.test_type_details?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.5rem 2rem' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: test.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{test.department_details?.name || 'N/A'}</div>
                                            <div style={{ 
                                              fontSize: '0.7rem', 
                                              color: '#6366f1', 
                                              fontWeight: 700, 
                                              background: 'rgba(99, 102, 241, 0.1)', 
                                              padding: '2px 8px', 
                                              borderRadius: '12px',
                                              width: 'fit-content',
                                              marginTop: '4px'
                                            }}>
                                                {test.sub_tests?.length || 0} Components
                                            </div>
                                        </td>
                                       <td style={{ padding: '1.5rem 2rem', textAlign: 'right' }}>
                                           <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                               <button 
                                                   title="Add Component"
                                                   className="btn btn-secondary" 
                                                   style={{ width: '38px', height: '38px', padding: 0, borderRadius: '10px' }}
                                                   onClick={() => {
                                                       setCurrentLabTest(test);
                                                       setShowSubTestModal(true);
                                                   }}
                                               >
                                                   <Plus size={16} />
                                               </button>
                                               <button 
                                                   title="Edit Test Master"
                                                   className="btn btn-secondary" 
                                                   style={{ width: '38px', height: '38px', padding: 0, borderRadius: '10px', background: '#eff6ff', color: '#2563eb', borderColor: '#dbeafe' }}
                                                   onClick={() => {
                                                       setCurrentLabTest(test);
                                                       setLabTestForm({
                                                          name: test.name,
                                                          code: test.code,
                                                          test_type: test.test_type,
                                                          department: test.department,
                                                          description: test.description,
                                                          is_active: test.is_active
                                                       });
                                                       setIsEditingLabTest(true);
                                                       setShowLabTestModal(true);
                                                   }}
                                               >
                                                   <Edit2 size={16} />
                                               </button>
                                               <button 
                                                   title={test.is_active ? "Deactivate" : "Activate"}
                                                   className="btn btn-secondary" 
                                                   style={{ width: '38px', height: '38px', padding: 0, borderRadius: '10px', background: test.is_active ? '#fff7ed' : '#ecfdf5', color: test.is_active ? '#ea580c' : '#059669' }}
                                                   onClick={() => handleToggleLabStatus(test)}
                                               >
                                                   {test.is_active ? <Power size={16} /> : <Power size={16} />}
                                               </button>
                                               <button 
                                                   title="Delete"
                                                   className="btn btn-secondary" 
                                                   style={{ width: '38px', height: '38px', padding: 0, borderRadius: '10px', background: '#fef2f2', color: '#dc2626' }}
                                                   onClick={() => handleDeleteLabTest(test.id, test.name)}
                                               >
                                                   <Trash2 size={16} />
                                               </button>
                                           </div>
                                       </td>
                                   </tr>
                                   {expandedLabTests[test.id] && (
                                       <tr>
                                         <td colSpan="4" style={{ padding: '0.5rem 2rem 1.5rem 4rem' }}>
                                             <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'linear-gradient(to bottom, #6366f1, #a855f7)' }}></div>
                                                <div style={{ paddingLeft: '0.5rem' }}>
                                                   <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Component Definitions</div>
                                                   {test.sub_tests && test.sub_tests.length > 0 ? (
                                                      <div style={{ display: 'grid', gap: '0.25rem' }}>
                                                         {test.sub_tests.map(sub => (
                                                            <div key={sub.id} 
                                                               style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', opacity: sub.is_active ? 1 : 0.6, borderRadius: '8px', transition: 'background 0.2s' }}
                                                               onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                                               onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sub.is_active ? '#10b981' : '#cbd5e1' }}></div>
                                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                     <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{sub.name}</div>
                                                                     <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{sub.code}</span>
                                                                     <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                                                     <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{sub.value_type} • {sub.units || 'No units'} • {sub.biological_range || 'No range'}</div>
                                                                  </div>
                                                               </div>
                                                               <div style={{ display: 'flex', gap: '6px' }}>
                                                                  <button onClick={() => {
                                                                     setCurrentLabTest(test);
                                                                     setCurrentSubTest(sub);
                                                                     setSubTestForm({
                                                                        name: sub.name,
                                                                        code: sub.code,
                                                                        value_type: sub.value_type,
                                                                        input_data_type: sub.input_data_type,
                                                                        min_chars: sub.min_chars,
                                                                        max_chars: sub.max_chars,
                                                                        units: sub.units,
                                                                        biological_range: sub.biological_range,
                                                                        description: sub.description,
                                                                        dropdown_options: Array.isArray(sub.dropdown_options) ? sub.dropdown_options.join(', ') : sub.dropdown_options,
                                                                        is_active: sub.is_active
                                                                     });
                                                                     setIsEditingSubTest(true);
                                                                     setShowSubTestModal(true);
                                                                  }} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 8px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit Component"><Edit2 size={12} /></button>
                                                                  <button onClick={() => handleToggleSubTestStatus(sub)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 8px', color: sub.is_active ? '#ea580c' : '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={sub.is_active ? "Deactivate" : "Activate"}><Power size={12} /></button>
                                                                  <button onClick={() => handleDeleteSubTest(sub.id, sub.name)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 8px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><Trash2 size={12} /></button>
                                                               </div>
                                                            </div>
                                                         ))}
                                                      </div>
                                                   ) : (
                                                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.5rem 0' }}>No components defined for this test.</div>
                                                   )}
                                                </div>
                                             </div>
                                         </td>
                                       </tr>
                                    )}
                                </React.Fragment>
                               ))}
                              {labTests.length === 0 && !isLoading && (
                                  <tr>
                                      <td colSpan="4" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                          <div style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                                              <Activity size={48} style={{ opacity: 0.2, margin: '0 auto' }} />
                                          </div>
                                          <p style={{ color: '#94a3b8', fontWeight: 600 }}>No Lab Masters configured.</p>
                                          <p style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Add a new test to start building your diagnostic registry.</p>
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                    </div>
                </div>
              </div>
            ) : (
              <>
                {/* PROFESSIONAL REGISTRY BREADCRUMB & NAVIGATOR */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "1.5rem",
                    background: "var(--surface)",
                    padding: "0.75rem 1.25rem",
                    borderRadius: "16px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <button
                    onClick={() => setActiveBoard("PROTOCOLS")}
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Layers size={14} /> Workspace Hub
                  </button>
                  <ChevronRight size={14} color="var(--border)" />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 900,
                      color: "var(--primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {getCurrentProtocols().find(
                      (p) => p.id === exploringProtocolId,
                    )?.name || "Registry View"}
                  </span>
                </div>

                <div
                  className="card"
                  style={{
                    marginBottom: "1.5rem",
                    padding: "1.25rem",
                    borderRadius: "24px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ position: "relative", flex: 1 }}>
                      <Search
                        size={16}
                        style={{
                          position: "absolute",
                          left: "1.25rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#64748b",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        type="text"
                        placeholder={`Search ${getCurrentProtocols()
                            .find((p) => p.id === exploringProtocolId)
                            ?.name?.toLowerCase() || "repository"
                          }...`}
                        style={{
                          width: "100%",
                          padding: "0.5rem 3rem 0.5rem 3.5rem",
                          height: "48px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "12px",
                          background: "#f8fafc",
                          color: "var(--text-main)",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          transition: "all 0.2s",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          outline: "none"
                        }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && fetchEmployeeMasters(1)
                        }
                      />
                      {searchQuery && (
                        <X
                          size={16}
                          style={{
                            position: "absolute",
                            right: "1.25rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#64748b",
                            cursor: "pointer",
                            transition: "color 0.2s",
                          }}
                          onClick={() => {
                            setSearchQuery("");
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-main)"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        className="btn btn-secondary"
                        style={{
                          width: "52px",
                          height: "52px",
                          padding: 0,
                          background: "var(--background)",
                          border: "1.5px solid var(--border)",
                          borderRadius: "16px",
                        }}
                        onClick={() => fetchEmployeeMasters(1)}
                        title="Refresh Data"
                      >
                        <RotateCcw size={20} color="var(--text-muted)" />
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const currentProtocol = getCurrentProtocols().find(p => p.id === exploringProtocolId);
                          setBulkProject(selectedProject);
                          setExploringProtocolId(exploringProtocolId);
                          // Use the technical dbId for the server request to ensure it finds the right table
                          setBulkType(currentProtocol?.dbId || exploringProtocolId); 
                          setBulkStep("UPLOAD");
                          setBulkMode("INCREMENT");
                          setShowBulkModal(true);
                        }}
                        style={{
                          height: "52px",
                          padding: "0 1.5rem",
                          borderRadius: "16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: "#10b981",
                          border: "none",
                          fontSize: "0.75rem",
                          fontWeight: 800
                        }}
                      >
                        <Plus size={18} /> Refill Stock
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setBulkProject(selectedProject);
                          setExploringProtocolId(exploringProtocolId);
                          setBulkType("HEALTH");
                          setBulkStep("UPLOAD");
                          setBulkMode("OVERWRITE");
                          setShowBulkModal(true);
                        }}
                        style={{
                          height: "52px",
                          padding: "0 1.5rem",
                          borderRadius: "16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: "var(--primary)",
                          border: "none",
                          fontSize: "0.75rem",
                          fontWeight: 800
                        }}
                      >
                        <Upload size={18} /> Upload Data
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{
                          height: "52px",
                          padding: "0 2.5rem",
                          borderRadius: "16px",
                          fontWeight: 800,
                          background: "var(--background)",
                          color: "var(--text-main)",
                          border: "1.5px solid var(--border)"
                        }}
                        onClick={() => fetchEmployeeMasters(1)}
                      >
                        Query Database
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    borderRadius: "24px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="table-responsive"
                    style={{ overflowX: "auto", width: "100%" }}
                  >
                    <table style={{ minWidth: "1000px", tableLayout: "auto" }}>
                      <thead>
                        <tr
                          style={{
                            background: "var(--background)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {["employee_master"].includes(
                            exploringProtocolId,
                          ) ? (
                            <>
                              <th
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  fontSize: "0.625rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                S.NO
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                CARD NO
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                EMPLOYEE ID
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                NAME
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                AGE / GENDER
                              </th>
                              <th
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                AADHAR NO
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                MOBILE NO
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                ADDRESS
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                DESIGNATION
                              </th>
                              <th
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                RELATIONSHIP
                              </th>
                              {activeProjectFields.map((field) => (
                                <th
                                  key={field.id}
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 900,
                                    color: "#475569",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  {field.field_label.toUpperCase()}
                                </th>
                              ))}
                            </>
                          ) : (
                             <>
                               <th
                                 style={{
                                   padding: "1.25rem 1.5rem",
                                   fontSize: "0.75rem",
                                   fontWeight: 900,
                                   color: "#475569",
                                   textTransform: "uppercase",
                                   letterSpacing: "0.05em",
                                 }}
                               >
                                 S.NO
                               </th>
                               {exploringProtocolId?.toLowerCase().includes("pharmacy") ? (
                                 <>
                                   {["ITEM CODE", "ITEM NAME", "DESCRIPTION", "ITEM GROUP", "TOTAL UPLOADED", "QTY", "COST"].map(h => (
                                      <th key={h} style={{ padding: "1.25rem 1.5rem", fontSize: "0.75rem", fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                                   ))}
                                 </>
                               ) : (
                                 getCurrentProtocols()
                                   .find((p) => p.id === exploringProtocolId)
                                   ?.fields?.map((f) => (
                                     <th
                                       key={f.id || f.slug}
                                       style={{
                                         padding: "1.25rem 1.5rem",
                                         fontSize: "0.75rem",
                                         fontWeight: 900,
                                         color: "#475569",
                                         textTransform: "uppercase",
                                         letterSpacing: "0.05em",
                                       }}
                                     >
                                       {f.label.toUpperCase()}
                                     </th>
                                   ))
                               )}
                             </>
                          )}
                          <th
                            style={{
                              textAlign: "right",
                              paddingRight: "1.5rem",
                              fontSize: "0.75rem",
                              fontWeight: 900,
                              color: "#475569",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            GOVERNANCE
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading
                          ? Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i}>
                              <td
                                colSpan="8"
                                style={{
                                  padding: "4rem",
                                  textAlign: "center",
                                  color: "#94a3b8",
                                }}
                              >
                                <div
                                  className="spinner"
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    border: "3px solid #f3f3f3",
                                    borderTop: "3px solid var(--primary)",
                                    borderRadius: "50%",
                                    animation: "spin 1s linear infinite",
                                    margin: "0 auto 1rem auto",
                                  }}
                                ></div>
                                Searching clinical repository...
                              </td>
                            </tr>
                          ))
                          : employeeMasters.length === 0 ? (
                            <tr>
                              <td
                                colSpan="12"
                                style={{
                                  padding: "8rem 2rem",
                                  textAlign: "center",
                                  background: "transparent",
                                }}
                              >
                                <div style={{ maxWidth: "300px", margin: "0 auto" }}>
                                  <div
                                    style={{
                                      width: "80px",
                                      height: "80px",
                                      background: "var(--background)",
                                      borderRadius: "30px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      margin: "0 auto 1.5rem auto",
                                      border: "1px solid var(--border)",
                                    }}
                                  >
                                    <Search size={32} color="var(--text-muted)" />
                                  </div>
                                  <h3 style={{ fontWeight: 900, color: "var(--text-main)", marginBottom: "0.5rem", fontSize: "1.25rem" }}>No Records Found</h3>
                                  <p style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.875rem", lineHeight: 1.6 }}>
                                    We couldn't find any results matching "{searchQuery}". Try refining your search or checking another registry.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : employeeMasters.map((m, idx) => {
                            const age = m.dob
                              ? new Date().getFullYear() -
                              new Date(m.dob).getFullYear()
                              : "N/A";
                            const isRegistry = ![
                              "employee_master",
                            ].includes(exploringProtocolId);
                            const pageSize = isRegistry ? 100 : 10;
                            const sno = (page - 1) * pageSize + idx + 1;
                            const activeProtocol = getCurrentProtocols().find(
                              (p) => p.id === exploringProtocolId,
                            );
                            return (
                              <React.Fragment key={m.id}>
                                <tr style={{ background: "transparent" }}>
                                  {["employee", "family", "health", "employee_master"].includes(
                                    exploringProtocolId,
                                  ) ? (
                                    <>
                                      <td
                                        style={{
                                          padding: "1.25rem 1.5rem",
                                          fontWeight: 900,
                                          color: "var(--text-muted)",
                                          fontSize: "0.8125rem",
                                        }}
                                      >
                                        {sno}
                                      </td>
                                      <td
                                        style={{
                                          fontWeight: 900,
                                          color: "var(--primary)",
                                          fontSize: "0.9375rem",
                                        }}
                                      >
                                        {m.card_no}
                                      </td>
                                      <td
                                        style={{
                                          fontWeight: 800,
                                          color: "var(--text-main)",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        {m.additional_fields?.employee_id || "--"}
                                      </td>
                                      <td
                                        style={{
                                          fontWeight: 800,
                                          color: "var(--text-main)",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        {m.name}
                                      </td>
                                      <td style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.8125rem" }}>
                                        {age !== "N/A" ? `${age} / ${m.gender?.[0] || m.gender}` : (m.gender || "--")}
                                      </td>
                                      <td style={{ color: "var(--text-muted)", fontSize: '0.75rem', fontWeight: 700 }}>
                                        {m.aadhar_no || "--"}
                                      </td>
                                      <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                                        {m.mobile_no || "--"}
                                      </td>
                                      <td
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        {m.address ? (m.address.length > 20 ? m.address.substring(0, 20) + "..." : m.address) : "--"}
                                      </td>
                                      <td
                                        style={{
                                          fontSize: "0.8125rem",
                                          fontWeight: 900,
                                          color: "var(--text-main)",
                                        }}
                                      >
                                        {m.designation || "-"}
                                      </td>
                                      <td
                                        style={{
                                          fontSize: "0.8125rem",
                                          fontWeight: 800,
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        -
                                      </td>
                                    </>
                                  ) : (
                                      <>
                                        <td
                                          style={{
                                            padding: "1.5rem 1.5rem",
                                            fontWeight: 900,
                                            color: "var(--text-muted)",
                                            fontSize: "0.875rem",
                                          }}
                                        >
                                          {sno}
                                        </td>
                                        {exploringProtocolId?.toLowerCase().includes("pharmacy") ? (
                                           <>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>{m.ucode || "--"}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>{m.name || "--"}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>{m.description || "--"}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>{m.category || "--"}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 900, color: "var(--primary)", fontSize: "0.875rem" }}>{m.total_uploaded ?? m.quantity ?? 0}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>{m.quantity || 0}</td>
                                              <td style={{ padding: "1.5rem 1.5rem", fontWeight: 700, color: "var(--text-main)", fontSize: "0.875rem" }}>
                                                {m.batch_info?.has_batches && !m.batch_info.costs_match ? (
                                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                                    <span style={{ fontWeight: 800, color: "var(--text-main)" }}>
                                                      ₹{m.cost || 0.00} <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600 }}>(Latest)</span>
                                                    </span>
                                                    <span style={{ 
                                                      fontSize: "0.675rem", 
                                                      color: "#10b981", 
                                                      fontWeight: 800, 
                                                      background: "rgba(16, 185, 129, 0.15)", 
                                                      border: "1px solid rgba(16, 185, 129, 0.25)",
                                                      padding: "2px 8px", 
                                                      borderRadius: "6px", 
                                                      width: "fit-content",
                                                      marginTop: "2px"
                                                    }}>
                                                      Multi-Price (₹{m.batch_info.min_cost} - ₹{m.batch_info.max_cost})
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <span>₹{m.cost || 0.00}</span>
                                                )}
                                              </td>
                                           </>
                                        ) : (
                                          (
                                            getCurrentProtocols().find(
                                              (p) => p.id === exploringProtocolId,
                                            )?.fields || []
                                          ).map((f) => {
                                            const slugLower = f.slug?.toLowerCase();
                                            let displayVal = m.additional_fields?.[f.slug] ||
                                                             m.additional_fields?.[slugLower] ||
                                                             m.additional_fields?.[f.slug.toUpperCase()] ||
                                                             m[slugLower];

                                            // Special overrides for dependent registry
                                            if (slugLower === 'card_no') {
                                              displayVal = m.ucode || displayVal;
                                            } else if (slugLower === 'gender') {
                                              const dob = m.additional_fields?.dob || m.additional_fields?.DOB;
                                              const genderVal = m.additional_fields?.gender || m.additional_fields?.GENDER || displayVal || "--";
                                              if (dob) {
                                                const ageVal = new Date().getFullYear() - new Date(dob).getFullYear();
                                                displayVal = `${ageVal} / ${genderVal?.[0] || genderVal}`;
                                              } else {
                                                displayVal = genderVal;
                                              }
                                            }

                                            return (
                                              <td
                                                key={f.id || f.slug}
                                                style={{
                                                  padding: "1.5rem 1.5rem",
                                                  fontWeight: 700,
                                                  color: "var(--text-main)",
                                                  fontSize: "0.875rem",
                                                }}
                                              >
                                                {String(displayVal || "--")}
                                              </td>
                                            );
                                          })
                                        )}
                                      </>
                                  )}
                                  {exploringProtocolId === "employee_master" &&
                                    activeProjectFields.map((field) => (
                                      <td
                                        key={field.id}
                                        style={{
                                          fontSize: "0.8125rem",
                                          fontWeight: 700,
                                          color: "var(--text-main)",
                                        }}
                                      >
                                        {m.additional_fields?.[
                                          field.field_name
                                        ] || "--"}
                                      </td>
                                    ))}
                                  <td
                                    style={{
                                      textAlign: "right",
                                      paddingRight: "1.5rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      {(exploringProtocolId === "employee_master" ||
                                        activeProtocol?.type_category ===
                                        "PERSONNEL_PRIMARY") && (
                                          <button
                                            className="btn btn-secondary"
                                            style={{
                                              padding: "0.5rem",
                                              border: "none",
                                              background: "#eff6ff",
                                              borderRadius: "10px",
                                            }}
                                            title="Add Family Member"
                                            onClick={() => {
                                                if (
                                                  exploringProtocolId ===
                                                  "employee_master"
                                                ) {
                                                const nextSuffix =
                                                  (m.family_members?.length ||
                                                    0) + 1;
                                                setSelectedEmployeeForFamily(
                                                  m.id,
                                                );
                                                setIsEditingFamily(false);
                                                setFamilyFormData({
                                                  card_no_suffix: `/${nextSuffix}`,
                                                  name: "",
                                                  dob: "",
                                                  gender: "MALE",
                                                  mobile_no: "",
                                                  aadhar_no: "",
                                                  relationship: "SPOUSE",
                                                  proof_image: null,
                                                });
                                                setShowFamilyModal(true);
                                              } else {
                                                const nextSuffix =
                                                  (m.family_members?.length ||
                                                    0) + 1;
                                                setSelectedEmployeeForFamily(
                                                  m.ucode,
                                                );
                                                setIsEditingFamily(false);
                                                setFamilyFormData({
                                                  card_no_suffix: `/${nextSuffix}`,
                                                  name: "",
                                                  dob: "",
                                                  gender: "MALE",
                                                  mobile_no: m.mobile_no || "",
                                                  aadhar_no: "",
                                                  relationship: "SPOUSE",
                                                  proof_image: null,
                                                });
                                                setShowFamilyModal(true);
                                              }
                                            }}
                                          >
                                            <Plus
                                              size={18}
                                              color="var(--primary)"
                                            />
                                          </button>
                                        )}
                                      <button
                                        className="btn btn-secondary"
                                        style={{
                                          padding: "0.5rem",
                                          border: "none",
                                          background: "#f8fafc",
                                          borderRadius: "10px",
                                        }}
                                        onClick={() => {
                                          if (!isRegistry) {
                                            setMasterFormData({
                                              project: m.project || "",
                                              card_no: m.card_no,
                                              name: m.name,
                                              dob: m.dob,
                                              gender: m.gender,
                                              mobile_no: m.mobile_no,
                                              aadhar_no: m.aadhar_no || "",
                                              address: m.address,
                                              designation:
                                                m.designation || "",
                                              additional_fields: {
                                                employee_id: "",
                                                ...(m.additional_fields || {})
                                              },
                                            });
                                            setEditingMasterId(m.id);
                                            setIsEditingMaster(true);
                                            setShowMasterModal(true);
                                          } else {
                                            // Handle Custom Registry Edit
                                            setRegistryEditData({
                                              id: m.id,
                                              ucode: m.ucode,
                                              name: m.name,
                                              category: m.category || "",
                                              description:
                                                m.description || "",
                                              quantity: m.quantity || 0,
                                              cost: m.cost || 0.0,
                                              additional_fields:
                                                m.additional_fields || {},
                                            });
                                            setShowRegistryEditModal(true);
                                          }
                                        }}
                                      >
                                        <Pencil size={18} color="#64748b" />
                                      </button>
                                      {isAdmin && (
                                        <button
                                          className="btn btn-secondary"
                                          style={{
                                            padding: "0.5rem",
                                            border: "none",
                                            background: "#fef2f2",
                                            borderRadius: "10px",
                                          }}
                                          onClick={() => {
                                            if (!isRegistry) {
                                              handleDeleteMaster(m.id);
                                            } else {
                                              handleDeleteRegistryItem(m.id);
                                            }
                                          }}
                                        >
                                          <Trash2 size={18} color="#ef4444" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {/* Family Rendering Bridge: Switches between Legacy and Polymorphic Registry Schemes */}
                                {m.family_members?.map((f) => {
                                  if (!isRegistry) {
                                    const fAge = f.dob
                                      ? new Date().getFullYear() -
                                      new Date(f.dob).getFullYear()
                                      : "N/A";
                                    return (
                                      <tr
                                        key={`${m.id}-${f.id}`}
                                        style={{
                                          fontSize: "0.8125rem",
                                          background: "transparent",
                                          borderBottom: "1px solid var(--border)",
                                        }}
                                      >
                                        <td style={{ padding: "1rem 1.5rem" }}></td>
                                        <td
                                          style={{
                                            fontWeight: 900,
                                            color: "var(--text-muted)",
                                            fontSize: "0.8125rem",
                                          }}
                                        >
                                          {m.card_no}{f.card_no_suffix ? (f.card_no_suffix.startsWith('/') ? f.card_no_suffix : `/${f.card_no_suffix}`) : ""}
                                        </td>
                                        <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                          --
                                        </td>
                                        <td
                                          style={{
                                            fontWeight: 800,
                                            color: "var(--text-main)",
                                          }}
                                        >
                                          {f.name}
                                        </td>
                                        <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                                          {fAge} / {f.gender?.[0] || f.gender}
                                        </td>
                                        <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                          {f.aadhar_no || "--"}
                                        </td>
                                        <td style={{ color: "var(--text-muted)" }}>
                                          {f.mobile_no || m.mobile_no || "--"}
                                        </td>
                                        <td style={{ color: "var(--text-muted)", fontSize: '0.7rem' }}>
                                          {f.address ? (f.address.length > 10 ? f.address.substring(0, 10) + "..." : f.address) : "--"}
                                        </td>
                                        <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                          --
                                        </td>
                                        <td
                                          style={{
                                            color: "var(--text-muted)",
                                            fontWeight: 800,
                                            textTransform: "uppercase",
                                            fontSize: '0.7rem'
                                          }}
                                        >
                                          {f.relationship}
                                        </td>
                                        <td
                                          style={{
                                            textAlign: "right",
                                            paddingRight: "1.5rem",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "flex-end",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            <button
                                              className="btn btn-secondary"
                                              style={{
                                                padding: "0.4rem",
                                                border: "none",
                                                background: "transparent",
                                              }}
                                              onClick={() => {
                                                setFamilyFormData({
                                                  card_no_suffix:
                                                    f.card_no_suffix,
                                                  name: f.name,
                                                  dob: f.dob,
                                                  gender: f.gender,
                                                  mobile_no:
                                                    f.mobile_no || "",
                                                  aadhar_no:
                                                    f.aadhar_no || "",
                                                  relationship:
                                                    f.relationship,
                                                });
                                                setSelectedEmployeeForFamily(
                                                  m.id,
                                                );
                                                setEditingFamilyId(f.id);
                                                setIsEditingFamily(true);
                                                setShowFamilyModal(true);
                                              }}
                                            >
                                              <Pencil
                                                size={16}
                                                color="#94a3b8"
                                              />
                                            </button>
                                            {isAdmin && (
                                              <button
                                                className="btn btn-secondary"
                                                style={{
                                                  padding: "0.4rem",
                                                  border: "none",
                                                  background: "transparent",
                                                }}
                                                onClick={() =>
                                                  handleDeleteFamily(f.id)
                                                }
                                              >
                                                <Trash2
                                                  size={16}
                                                  color="#ef4444"
                                                />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  } else {
                                    // Polymorphic Registry Rendering
                                    return (
                                      <tr
                                        key={`fam-${m.id}-${f.id}`}
                                        style={{
                                          background: "transparent",
                                          fontSize: "0.85rem",
                                          borderBottom: "1px solid var(--border)",
                                        }}
                                      >
                                        <td
                                          style={{
                                            padding: "0.75rem 1.5rem",
                                            color: "var(--text-muted)",
                                            fontWeight: 900,
                                          }}
                                        >
                                          {sno}.
                                          {f.ucode?.split("/").pop() || "f"}
                                        </td>
                                        {(
                                          getCurrentProtocols().find(
                                            (p) =>
                                              p.id === exploringProtocolId,
                                          )?.fields || []
                                        ).map((fieldDef) => (
                                          <td
                                            key={fieldDef.slug}
                                            style={{
                                              padding: "0.75rem 1.5rem",
                                              color: "var(--text-main)",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {String(
                                              f.additional_fields?.[
                                              fieldDef.slug
                                              ] ||
                                              f.additional_fields?.[
                                              fieldDef.slug.toLowerCase()
                                              ] ||
                                              f[fieldDef.slug] ||
                                              "--",
                                            )}
                                            {fieldDef.slug.includes(
                                              "name",
                                            ) && (
                                                <span
                                                  style={{
                                                    marginLeft: "8px",
                                                    fontSize: "0.625rem",
                                                    background: "var(--background)",
                                                    color: "var(--primary)",
                                                    padding: "2px 8px",
                                                    borderRadius: "6px",
                                                    fontWeight: 800,
                                                  }}
                                                >
                                                  DEPENDENT
                                                </span>
                                              )}
                                          </td>
                                        ))}
                                        <td
                                          style={{
                                            textAlign: "right",
                                            paddingRight: "1.5rem",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "flex-end",
                                              gap: "0.5rem",
                                            }}
                                          >
                                            <button
                                              className="btn btn-secondary"
                                              style={{
                                                padding: "0.4rem",
                                                border: "none",
                                                background: "transparent",
                                              }}
                                              onClick={() => {
                                                setFamilyFormData({
                                                  card_no_suffix: f.ucode?.split("/").pop() || "",
                                                  name: f.name,
                                                  dob: f.additional_fields?.dob || "",
                                                  gender: f.additional_fields?.gender || "",
                                                  mobile_no: f.additional_fields?.mobile_no || "",
                                                  aadhar_no: f.additional_fields?.aadhar_no || "",
                                                  relationship: f.additional_fields?.relationship || "SPOUSE",
                                                });
                                                setSelectedEmployeeForFamily(m.ucode);
                                                setEditingFamilyId(f.id);
                                                setIsEditingFamily(true);
                                                setFamilyFormAttempted(false);
                                                setShowFamilyModal(true);
                                              }}
                                            >
                                              <Pencil
                                                size={16}
                                                color="#94a3b8"
                                              />
                                            </button>
                                            {isAdmin && (
                                              <button
                                                className="btn btn-secondary"
                                                style={{
                                                  padding: "0.4rem",
                                                  border: "none",
                                                  background: "transparent",
                                                }}
                                                onClick={() =>
                                                  handleDeleteRegistryItem(f.id)
                                                }
                                              >
                                                <Trash2
                                                  size={16}
                                                  color="#ef4444"
                                                />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  }
                                })}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1.5rem",
                      borderTop: "1px solid var(--border)",
                      background: "var(--background)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      Showing {employeeMasters.length} of {totalCount} Records
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        className="btn btn-secondary"
                        disabled={page === 1}
                        onClick={() => fetchEmployeeMasters(page - 1)}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "10px",
                          opacity: page === 1 ? 0.5 : 1,
                          fontWeight: 800,
                        }}
                      >
                        Previous
                      </button>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0 1rem",
                          background: "var(--surface)",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          fontSize: "0.8125rem",
                          fontWeight: 800,
                          color: "var(--text-main)",
                        }}
                      >
                        {page}
                      </div>
                      <button
                        className="btn btn-secondary"
                        disabled={
                          page >=
                          Math.ceil(
                            totalCount /
                            (!["employee", "family", "health"].includes(
                              exploringProtocolId,
                            )
                              ? 100
                              : 10),
                          )
                        }
                        onClick={() => fetchEmployeeMasters(page + 1)}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "10px",
                          opacity:
                            page >=
                              Math.ceil(
                                totalCount /
                                (!["employee", "family", "health"].includes(
                                  exploringProtocolId,
                                )
                                  ? 100
                                  : 10),
                              )
                              ? 0.5
                              : 1,
                          fontWeight: 800,
                        }}
                      >
                        Next Page
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {showMasterModal && createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              zIndex: 100000,
              padding: "40px 1rem 60px 1rem",
              overflowY: "auto",
            }}
          >
            <div
              className="fade-in card"
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: 0,
                borderRadius: "32px",
                background: "var(--surface)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "1.5rem 2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                    <ShieldCheck size={24} color="white" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                      {isEditingMaster
                        ? "Edit Master Record"
                        : "Register in Masters"}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Clinical Registry & Personnel Onboarding</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMasterModal(false);
                    setIsEditingMaster(false);
                  }}
                  style={{
                    border: "none",
                    background: "var(--background)",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
              </div>
              <form onSubmit={handleMasterSubmit} style={{ padding: "2rem" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.25rem",
                  }}
                >
                  {!(user?.project || selectedProject || masterFormData.project) && (
                    <div className="form-group" style={{ gridColumn: "span 2" }}>
                      <label>Assign Project *</label>
                      <select
                        required
                        value={masterFormData.project}
                        onChange={(e) =>
                          setMasterFormData({
                            ...masterFormData,
                            project: e.target.value,
                          })
                        }
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                      >
                        <option value="">-- Select Project --</option>
                        {projects &&
                          Array.isArray(projects) &&
                          projects
                            .filter((p) =>
                              p.category_mappings?.some(
                                (m) => m.category === "EMPLOYEE",
                              ),
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Card No *</label>
                    <input
                      required
                      readOnly
                      value={masterFormData.card_no}
                      placeholder="Auto-generating..."
                      className="form-control"
                      style={{
                        background: 'var(--background)',
                        cursor: 'not-allowed',
                        color: 'var(--text-muted)'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      required
                      value={masterFormData.name}
                      onChange={(e) =>
                        setMasterFormData({
                          ...masterFormData,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. P. BABU RAO"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>DOB *</label>
                    <input
                      type="date"
                      required
                      max={new Date().toLocaleDateString('en-CA')}
                      value={masterFormData.dob}
                      onChange={(e) =>
                        setMasterFormData({
                          ...masterFormData,
                          dob: e.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      value={masterFormData.gender}
                      onChange={(e) =>
                        setMasterFormData({
                          ...masterFormData,
                          gender: e.target.value,
                        })
                      }
                      className="form-control"
                      style={{
                        borderColor:
                          masterFormAttempted && !masterFormData.gender
                            ? "#ef4444"
                            : "#e2e8f0",
                      }}
                    >
                      <option value="">-- Select --</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {masterFormAttempted && !masterFormData.gender && (
                      <p
                        style={{
                          color: "#ef4444",
                          fontSize: "8px",
                          fontWeight: 800,
                          marginTop: "2px",
                          textTransform: "uppercase",
                        }}
                      >
                        Required
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Mobile No *</label>
                    <input
                      required
                      value={masterFormData.mobile_no}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 10) {
                          setMasterFormData({
                            ...masterFormData,
                            mobile_no: val,
                          });
                        }
                      }}
                      className="form-control"
                      placeholder="10-digit number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Aadhar No</label>
                    <input
                      value={masterFormData.aadhar_no}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 12) {
                          setMasterFormData({
                            ...masterFormData,
                            aadhar_no: val,
                          });
                        }
                      }}
                      className="form-control"
                      placeholder="12-digit number"
                    />
                  </div>
                   <div className="form-group">
                    <label>Employee ID</label>
                    <input
                      value={masterFormData.additional_fields?.employee_id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^[A-Za-z0-9-]*$/.test(val) && val.length <= 10) {
                          setMasterFormData({
                            ...masterFormData,
                            additional_fields: {
                              ...masterFormData.additional_fields,
                              employee_id: val.toUpperCase(),
                            },
                          });
                        }
                      }}
                      className="form-control"
                      placeholder="EMPLOYEE ID"
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        value={masterFormData.designation}
                        onChange={(e) =>
                          setMasterFormData({
                            ...masterFormData,
                            designation: e.target.value,
                          })
                        }
                        className="form-control"
                        style={{
                          flex: 1,
                          borderRadius: "16px",
                        }}
                      >
                        <option value="">-- Select --</option>
                        {designations.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddNewDesignation}
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          border: "none",
                          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Home Address</label>
                    <textarea
                      rows="2"
                      value={masterFormData.address}
                      onChange={(e) =>
                        setMasterFormData({
                          ...masterFormData,
                          address: e.target.value,
                        })
                      }
                      className="form-control"
                      placeholder="Village/City, District, State"
                    ></textarea>
                  </div>

                  {activeProjectFields.length > 0 && (
                    <div
                      style={{
                        gridColumn: "span 2",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1.25rem",
                        marginTop: "1rem",
                        borderTop: "1.5px dashed var(--border)",
                        paddingTop: "1.5rem",
                      }}
                    >
                      {activeProjectFields.map((field) => (
                        <div className="form-group" key={field.id}>
                          <label
                            style={{
                              fontSize: "0.625rem",
                              color: "#94a3b8",
                              fontWeight: 900,
                              textTransform: "uppercase",
                            }}
                          >
                            {field.field_label}
                          </label>
                          <input
                            type={
                              field.field_type === "NUMBER" ? "number" : "text"
                            }
                            className="form-control"
                            placeholder={`Enter ${field.field_label}`}
                            value={
                              masterFormData.additional_fields?.[
                              field.field_name
                              ] || ""
                            }
                            onChange={(e) =>
                              setMasterFormData({
                                ...masterFormData,
                                additional_fields: {
                                  ...masterFormData.additional_fields,
                                  [field.field_name]: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "1rem",
                    marginTop: "1.5rem",
                    padding: "1.5rem 2rem",
                    background: "var(--surface)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "0.75rem 2rem" }}
                    onClick={() => {
                      setShowMasterModal(false);
                      setIsEditingMaster(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      padding: "0.75rem 2.5rem",
                      background: "var(--primary)",
                    }}
                  >
                    {isEditingMaster
                      ? "Save"
                      : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {showAddDesignationModal && createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(8px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 200000,
              padding: "1.5rem",
            }}
            onClick={() => setShowAddDesignationModal(false)}
          >
            <div
              className="fade-in card"
              style={{
                width: "100%",
                maxWidth: "420px",
                padding: "2rem",
                borderRadius: "24px",
                background: "var(--surface)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                    borderRadius: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                    boxShadow: "0 8px 16px rgba(99, 102, 241, 0.25)",
                  }}
                >
                  <Plus size={24} color="white" />
                </div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 900,
                    color: "var(--text-main)",
                    margin: 0,
                  }}
                >
                  Add Designation
                </h3>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    fontWeight: 600,
                  }}
                >
                  Create a new title for clinical registry
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitNewDesignation();
                }}
              >
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      letterSpacing: "0.05em",
                      marginBottom: "6px",
                      display: "block",
                    }}
                  >
                    Designation Name *
                  </label>
                  <input
                    autoFocus
                    required
                    value={newDesignationInput}
                    onChange={(e) => setNewDesignationInput(e.target.value.toUpperCase())}
                    placeholder="e.g. MANAGER, OPERATOR, RTPP..."
                    className="form-control"
                    style={{
                      height: "48px",
                      borderRadius: "14px",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      padding: "0 1rem",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    marginTop: "1.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      height: "44px",
                      borderRadius: "14px",
                      fontWeight: 800,
                      fontSize: "0.8125rem",
                    }}
                    onClick={() => setShowAddDesignationModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      height: "44px",
                      borderRadius: "14px",
                      fontWeight: 800,
                      fontSize: "0.8125rem",
                      background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {showFamilyModal && createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              zIndex: 100000,
              padding: "100px 1rem 60px 1rem",
              overflowY: "auto",
            }}
          >
            <div
              className="fade-in card"
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: 0,
                borderRadius: "32px",
                background: "var(--surface)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "1.5rem 2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                    <Users size={24} color="white" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                      {isEditingFamily ? "Edit Family Member" : "Add Family Member"}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Personal Dependants & Relations</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowFamilyModal(false);
                    setIsEditingFamily(false);
                  }}
                  style={{
                    border: "none",
                    background: "var(--background)",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
              </div>
              <form onSubmit={handleFamilySubmit} style={{ padding: "2rem" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.25rem",
                  }}
                >
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      required
                      value={familyFormData.name}
                      onChange={(e) =>
                        setFamilyFormData({
                          ...familyFormData,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Baby.P. SONITHA"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>DOB *</label>
                    <input
                      type="date"
                      required
                      max={new Date().toLocaleDateString('en-CA')}
                      value={familyFormData.dob}
                      onChange={(e) =>
                        setFamilyFormData({
                          ...familyFormData,
                          dob: e.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Relationship *</label>
                    <select
                      value={familyFormData.relationship}
                      onChange={(e) =>
                        setFamilyFormData({
                          ...familyFormData,
                          relationship: e.target.value,
                        })
                      }
                      className="form-control"
                    >
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
                    <select
                      value={familyFormData.gender}
                      onChange={(e) =>
                        setFamilyFormData({
                          ...familyFormData,
                          gender: e.target.value,
                        })
                      }
                      className="form-control"
                      style={{
                        borderColor:
                          familyFormAttempted && !familyFormData.gender
                            ? "#ef4444"
                            : "#e2e8f0",
                      }}
                    >
                      <option value="">-- Select --</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {familyFormAttempted && !familyFormData.gender && (
                      <p
                        style={{
                          color: "#ef4444",
                          fontSize: "8px",
                          fontWeight: 800,
                          marginTop: "2px",
                          textTransform: "uppercase",
                        }}
                      >
                        Required
                      </p>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "1rem",
                    marginTop: "2rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowFamilyModal(false);
                      setIsEditingFamily(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {isEditingFamily
                      ? "Update Family Member"
                      : "Save Family Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {showRegistryEditModal && createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              zIndex: 100000,
              padding: "40px 1rem 60px 1rem",
              overflowY: "auto",
            }}
          >
            <div
              className="fade-in card"
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: 0,
                borderRadius: "32px",
                background: "var(--surface)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "1.5rem 2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}>
                    <Pencil size={24} color="white" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                      Edit Registry Item
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Updating Global Database Entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRegistryEditModal(false)}
                  style={{
                    border: "none",
                    background: "var(--background)",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
              </div>
              <form
                onSubmit={handleRegistryEditSubmit}
                style={{ padding: "2rem" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.25rem",
                  }}
                >
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Unique Code / ID</label>
                    <input
                      disabled
                      value={registryEditData.ucode}
                      className="form-control"
                      style={{ background: "var(--background)" }}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Item Name / Primary Label</label>
                    <input
                      required
                      value={registryEditData.name}
                      onChange={(e) =>
                        setRegistryEditData({
                          ...registryEditData,
                          name: e.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </div>

                  {/* Standard Registry Columns */}
                  <div className="form-group">
                    <label>Category / Group</label>
                    <input
                      value={registryEditData.category}
                      onChange={(e) =>
                        setRegistryEditData({
                          ...registryEditData,
                          category: e.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Internal Quantity</label>
                    <input
                      type="number"
                      value={registryEditData.quantity}
                      onChange={(e) =>
                        setRegistryEditData({
                          ...registryEditData,
                          quantity: e.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </div>

                  {/* Dynamic Fields from User Schema */}
                  {getCurrentProtocols()
                    .find((p) => p.id === exploringProtocolId)
                    ?.fields?.map((f) => (
                      <div className="form-group" key={f.slug}>
                        <label>{f.label}</label>
                        <input
                          value={
                            registryEditData.additional_fields?.[f.slug] || ""
                          }
                          onChange={(e) =>
                            setRegistryEditData({
                              ...registryEditData,
                              additional_fields: {
                                ...registryEditData.additional_fields,
                                [f.slug]: e.target.value,
                              },
                            })
                          }
                          className="form-control"
                        />
                      </div>
                    ))}

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label>Detailed Description</label>
                    <textarea
                      rows="3"
                      value={registryEditData.description}
                      onChange={(e) =>
                        setRegistryEditData({
                          ...registryEditData,
                          description: e.target.value,
                        })
                      }
                      className="form-control"
                    ></textarea>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "1rem",
                    marginTop: "2.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRegistryEditModal(false)}
                  >
                    Discard
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update Entry
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>

      {showBulkModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 1000000,
            overflowY: "auto",
            padding: "40px 1rem",
          }}
        >
          <div
            className="fade-in card"
            style={{
              width: "100%",
              maxWidth: bulkStep === "UPLOAD" ? "800px" : "900px",
              padding: 0,
              borderRadius: "32px",
              background: "var(--surface)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
              border: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                padding: "1.5rem 2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                  <Download size={24} color="white" />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 900,
                      color: "var(--text-main)",
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {bulkStep === "PROJECT" && "Select Target Project"}
                    {bulkStep === "TYPE" &&
                      `Upload Type: ${projects.find((p) => String(p.id) === String(bulkProject))?.name || "Workspace"}`}
                    {bulkStep === "UPLOAD" && "Prepare Your Data"}
                  </h2>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      marginTop: "2px",
                    }}
                  >
                    {bulkStep === "PROJECT" &&
                      "Choose the project you want to populate with bulk data"}
                    {bulkStep === "TYPE" &&
                      "Select the specific bulk operation for this project"}
                    {bulkStep === "UPLOAD" &&
                      "Upload your standardized CSV file below"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkStep("PROJECT");
                }}
                style={{
                  border: "none",
                  background: "var(--background)",
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ padding: "2rem" }}>
              {/* STEP 1: PROJECT SELECTION TILES */}
              {bulkStep === "PROJECT" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {projects && projects.length > 0 ? (
                    projects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setBulkProject(p.id);
                          setBulkStep("TYPE");
                        }}
                        className="card"
                        style={{
                          padding: "2rem",
                          textAlign: "center",
                          cursor: "pointer",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          border:
                            String(bulkProject) == String(p.id)
                              ? "2px solid var(--primary)"
                              : "1px solid var(--border)",
                          background:
                            String(bulkProject) == String(p.id)
                              ? "var(--background)"
                              : "var(--surface)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "1.25rem",
                            background: "var(--background)",
                            borderRadius: "20px",
                            width: "fit-content",
                            margin: "0 auto 1.5rem auto",
                          }}
                        >
                          <Database size={32} color="var(--primary)" />
                        </div>
                        <h4
                          style={{
                            fontSize: "1.125rem",
                            fontWeight: 900,
                            marginBottom: "0.5rem",
                            color: "var(--text-main)",
                          }}
                        >
                          {p.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          ID: #{p.id} | Click to configure
                        </p>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        gridColumn: "span 3",
                        textAlign: "center",
                        padding: "3rem",
                        color: "#94a3b8",
                      }}
                    >
                      <Activity
                        size={48}
                        style={{ opacity: 0.1, marginBottom: "1rem" }}
                      />
                      <p>No projects available for bulk registration.</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: UPLOAD PROTOCOL MATRIX */}
              {bulkStep === "TYPE" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {getCurrentProtocols(bulkProject)
                    .filter(proto => isAdmin || proto.is_visible)
                    .map((proto) => (
                    <div
                      key={proto.id}
                      onClick={() => {
                        setBulkType(proto.id.toUpperCase());
                        setBulkStep("UPLOAD");
                        setExploringProtocolId(proto.id); // Synchronize selection
                      }}
                      className="card"
                      style={{
                        padding: "1.5rem",
                        cursor: "pointer",
                        border: "1px solid var(--border)",
                        borderRadius: "24px",
                        transition: "all 0.2s ease",
                        background: "var(--background)",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow =
                          "0 12px 24px rgba(0,0,0,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div
                        style={{
                          padding: "1rem",
                          background: "var(--surface)",
                          borderRadius: "16px",
                          color: "var(--primary)",
                        }}
                      >
                        <Activity size={24} />
                      </div>
                      <div>
                        <h4
                          style={{
                            fontSize: "1rem",
                            fontWeight: 900,
                            color: "var(--text-main)",
                            marginBottom: "4px",
                          }}
                        >
                          {proto.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          {proto.coverage} Repository
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 3: UPLOAD & PROCESSING */}
              {bulkStep === "UPLOAD" && (
                <>
                  {!bulkStatus.completed && !bulkStatus.isUploading ? (
                    <>
                      <div
                        style={{
                          background: "var(--background)",
                          padding: "1.5rem",
                          borderRadius: "20px",
                          marginBottom: "2rem",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "1rem",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-main)",
                              fontWeight: 900,
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <Check size={18} color="#10b981" /> Configuration
                            Verified
                          </p>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "1rem",
                          }}
                        >
                          <div
                            style={{
                              background: "var(--surface)",
                              padding: "0.75rem 1rem",
                              borderRadius: "12px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "0.625rem",
                                color: "var(--text-muted)",
                                fontWeight: 800,
                                textTransform: "uppercase",
                              }}
                            >
                              Selected Project
                            </p>
                            <p
                              style={{ fontSize: "0.875rem", fontWeight: 700 }}
                            >
                              {projects.find(
                                (p) => String(p.id) === String(bulkProject),
                              )?.name || "Unknown Project"}
                            </p>
                          </div>
                          <div
                            style={{
                              background: "var(--surface)",
                              padding: "0.75rem 1rem",
                              borderRadius: "12px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "0.625rem",
                                color: "var(--text-muted)",
                                fontWeight: 800,
                                textTransform: "uppercase",
                              }}
                            >
                              Upload Objective
                            </p>
                            <p
                              style={{ fontSize: "0.875rem", fontWeight: 700 }}
                            >
                              {getCurrentProtocols().find(
                                (p) => p.id === exploringProtocolId,
                              )?.name || "Custom Data Store"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: "2px dashed var(--border)",
                          borderRadius: "24px",
                          padding: "4rem 2rem",
                          textAlign: "center",
                          background: "var(--background)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            padding: "1rem",
                            background: "var(--surface)",
                            borderRadius: "50%",
                            width: "fit-content",
                            margin: "0 auto 1.5rem auto",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          }}
                        >
                          <Upload size={32} color="var(--primary)" />
                        </div>
                        <h4 style={{ fontWeight: 900, marginBottom: "0.5rem" }}>
                          Drop your CSV file here
                        </h4>
                        <p
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            marginBottom: "2rem",
                          }}
                        >
                          Only .csv files are supported for bulk processing
                        </p>

                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => setBulkFile(e.target.files[0])}
                          style={{ display: "none" }}
                          id="bulk-csv-input"
                        />
                        <label
                          htmlFor="bulk-csv-input"
                          className="btn btn-secondary"
                          style={{
                            cursor: "pointer",
                            padding: "0.75rem 2rem",
                            borderRadius: "12px",
                          }}
                        >
                          {bulkFile ? bulkFile.name : "Choose File from System"}
                        </label>
                      </div>

                      <div
                        style={{
                          marginTop: "2rem",
                          padding: "1.5rem",
                          background: "var(--background)",
                          borderRadius: "20px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            marginBottom: "1.25rem",
                          }}
                        >
                          <div
                            style={{
                              padding: "0.5rem",
                              background: "white",
                              borderRadius: "10px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            }}
                          >
                            <Layers size={16} color="var(--primary)" />
                          </div>
                          <h5
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--text-main)",
                            }}
                          >
                            Required CSV Column Sequence
                          </h5>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          {(() => {
                            const schemaFields = getCurrentProtocols(bulkProject).find(
                              (p) => p.id === exploringProtocolId,
                            )?.fields || [];
                            
                            let displayFields = [...schemaFields];
                            if (exploringProtocolId === "employee_master") {
                              const hasEmpId = displayFields.some(f => f.slug === "employee_id");
                              if (!hasEmpId) {
                                const cardNoIndex = displayFields.findIndex(f => f.slug === "card_no");
                                if (cardNoIndex !== -1) {
                                  displayFields.splice(cardNoIndex + 1, 0, { slug: "employee_id", label: "Employee ID" });
                                } else {
                                  displayFields.push({ slug: "employee_id", label: "Employee ID" });
                                }
                              }
                            }
                            
                            const isPharmacy = exploringProtocolId && (
                              exploringProtocolId.includes("pharmacy") || 
                              exploringProtocolId.includes("drug")
                            );
                            
                            return (
                              <>
                                {displayFields.map((f) => (
                                  <span
                                    key={f.slug}
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 800,
                                      background: "var(--surface)",
                                      color: "#6366f1",
                                      padding: "0.4rem 0.75rem",
                                      borderRadius: "8px",
                                      border: "1px solid var(--border)",
                                    }}
                                  >
                                    {f.slug}
                                  </span>
                                ))}
                                {isPharmacy && (
                                  <>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 800, background: "#fffbeb", color: "#b45309", padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                      batch_number (Optional)
                                    </span>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 800, background: "#fffbeb", color: "#b45309", padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                      mfg_date (Optional)
                                    </span>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 800, background: "#fffbeb", color: "#b45309", padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                      expiry_date (Optional)
                                    </span>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p
                          style={{
                            fontSize: "0.675rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            marginTop: "1rem",
                            fontStyle: "italic",
                          }}
                        >
                          Note: Case-sensitive headers are mandatory in this
                          exact sequence for clinical integration.
                        </p>
                      </div>

                      {user?.role === 'ADMIN' && (
                        <div
                          style={{
                            marginTop: "1.5rem",
                            padding: "1.25rem",
                            background: "var(--surface)",
                            borderRadius: "18px",
                            border: "1.5px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onClick={() => setBulkMode(bulkMode === "OVERWRITE" ? "INCREMENT" : "OVERWRITE")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                             <div style={{ 
                               width: "44px", 
                               height: "44px", 
                               borderRadius: "12px", 
                               background: bulkMode === "INCREMENT" ? "rgba(16, 185, 129, 0.15)" : "var(--background)",
                               display: "flex",
                               alignItems: "center",
                               justifyContent: "center",
                               transition: "all 0.3s"
                             }}>
                                {bulkMode === "INCREMENT" ? <Plus size={22} color="#10b981" /> : <RotateCcw size={20} color="#6366f1" />}
                             </div>
                             <div>
                                <p style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                                   {bulkMode === "INCREMENT" ? "Add to Existing Stock" : "Overwrite Current Data"}
                                </p>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, margin: 0 }}>
                                   {bulkMode === "INCREMENT" ? "Increments quantity for existing medicine codes" : "Replaces all data fields for existing codes"}
                                </p>
                             </div>
                          </div>
                          <div style={{ 
                            width: "52px", 
                            height: "28px", 
                            background: bulkMode === "INCREMENT" ? "#10b981" : "var(--background)",
                            borderRadius: "20px",
                            position: "relative",
                            transition: "all 0.3s"
                          }}>
                             <div style={{ 
                               width: "20px", 
                               height: "20px", 
                               background: "white", 
                               borderRadius: "50%", 
                               position: "absolute",
                               top: "4px",
                               left: bulkMode === "INCREMENT" ? "28px" : "4px",
                               transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                               boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                             }} />
                          </div>
                        </div>
                      )}

                      {bulkMode === "INCREMENT" && (
                        <div style={{
                          marginTop: "1.25rem",
                          padding: "1rem",
                          background: "rgba(217, 119, 6, 0.15)",
                          borderRadius: "14px",
                          border: "1px solid rgba(217, 119, 6, 0.25)",
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "flex-start"
                        }}>
                          <AlertCircle size={18} color="#f59e0b" style={{ marginTop: "2px" }} />
                          <div>
                            <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f59e0b", margin: "0 0 2px 0" }}>Caution: Refill Mode Active</p>
                            <p style={{ fontSize: "0.675rem", fontWeight: 600, color: "#fbbf24", margin: "0 0 2px 0", opacity: 0.9 }}>
                              This will add quantities to current stock. To avoid double-entry, ensure this file hasn't been uploaded before.
                            </p>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "1rem",
                          marginTop: "2.5rem",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleBulkUpload}
                          style={{
                            padding: "0.75rem 2.5rem",
                            borderRadius: "12px",
                            background: "var(--primary)",
                          }}
                        >
                          Process Import
                        </button>
                      </div>
                    </>
                  ) : bulkStatus.isUploading ? (
                    <div style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                      <div
                        className="spinner"
                        style={{
                          width: "56px",
                          height: "56px",
                          border: "4px solid rgba(99, 102, 241, 0.1)",
                          borderTop: "4px solid #6366f1",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          margin: "0 auto 1.5rem auto",
                        }}
                      ></div>
                      
                      <h3 style={{ fontSize: "1.35rem", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
                        Integrating Master Registries
                      </h3>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500, marginTop: "0.25rem" }}>
                        Please remain on this screen. Database transaction savepoints are active.
                      </p>

                      {/* Premium Progress Bar */}
                      <div style={{ width: "100%", maxWidth: "380px", margin: "2rem auto 1rem auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#6366f1", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ display: "inline-block", width: "6px", height: "6px", background: "#6366f1", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />
                            BATCH {Math.min(Math.ceil(bulkStatus.current / 500) || 1, Math.ceil(bulkStatus.total / 500))} OF {Math.ceil(bulkStatus.total / 500) || 1}
                          </span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--text-main)" }}>
                            {Math.round((bulkStatus.current / bulkStatus.total) * 100) || 0}%
                          </span>
                        </div>
                        
                        <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "20px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                          <div
                            style={{
                              width: `${(bulkStatus.current / bulkStatus.total) * 100}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)",
                              borderRadius: "20px",
                              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Detailed Metric Grid */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(3, 1fr)", 
                        gap: "0.75rem", 
                        maxWidth: "420px", 
                        margin: "1.5rem auto 0 auto",
                        background: "#f8fafc",
                        padding: "1rem",
                        borderRadius: "16px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <div style={{ textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Processed</span>
                          <span style={{ fontSize: "1rem", fontWeight: 900, color: "var(--text-main)" }}>{bulkStatus.current} <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontWeight: 700 }}>/ {bulkStatus.total}</span></span>
                        </div>
                        <div style={{ textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#10b981", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Succeeded</span>
                          <span style={{ fontSize: "1rem", fontWeight: 900, color: "#10b981" }}>{bulkStatus.success}</span>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Failed</span>
                          <span style={{ fontSize: "1rem", fontWeight: 900, color: "#ef4444" }}>{bulkStatus.errors}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "2rem 0" }}>
                      <div
                        style={{
                          padding: "1.25rem",
                          background: "#dcfce7",
                          borderRadius: "50%",
                          width: "fit-content",
                          margin: "0 auto 1.5rem auto",
                        }}
                      >
                        <Check size={36} color="#15803d" />
                      </div>
                      <h2
                        style={{
                          fontWeight: 900,
                          fontSize: "1.5rem",
                          color: "#1e293b",
                        }}
                      >
                        Import Cycle Finalized
                      </h2>
                      <p
                        style={{
                          color: "#64748b",
                          fontWeight: 600,
                          marginTop: "0.5rem",
                        }}
                      >
                        Successfully integrated {bulkStatus.success}{" "}
                        {getCurrentProtocols(bulkProject).find(
                          (p) => p.id === exploringProtocolId,
                        )?.name || "records"}
                        .
                      </p>

                      {bulkStatus.errors > 0 && (
                        <div
                          style={{
                            background: "#fef2f2",
                            padding: "1rem",
                            borderRadius: "12px",
                            margin: "1.5rem 0",
                            border: "1px solid #fee2e2",
                          }}
                        >
                          <p
                            style={{
                              color: "#991b1b",
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                            }}
                          >
                            NOTICE: {bulkStatus.errors} records encountered
                            structural errors.
                          </p>
                          <button
                            onClick={downloadFailedRecords}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#dc2626",
                              fontSize: "0.75rem",
                              fontWeight: 900,
                              cursor: "pointer",
                              marginTop: "4px",
                              textDecoration: "underline",
                            }}
                          >
                            Download Detailed Error Report
                          </button>
                        </div>
                      )}

                      <button
                        className="btn btn-primary"
                        style={{
                          width: "100%",
                          marginTop: "2rem",
                          padding: "1rem",
                          borderRadius: "16px",
                          background: "#1e293b",
                        }}
                        onClick={() => {
                          setShowBulkModal(false);
                          setActiveBoard("REGISTRY");
                          setBulkStatus({ ...bulkStatus, completed: false });
                        }}
                      >
                        Return to Registry Board
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSchemaModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 1100000,
            overflowY: "auto",
            padding: "40px 1rem",
          }}
        >
          <div
            className="fade-in card"
            style={{
              width: "100%",
              maxWidth: "900px",
              borderRadius: "32px",
              padding: "0",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr" }}>
              {/* Left: Configuration Form */}
              <div
                style={{
                  padding: "2.5rem",
                  background: "#f8fafc",
                  borderRight: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "2rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.75rem",
                      background: "#1e293b",
                      borderRadius: "16px",
                      color: "white",
                    }}
                  >
                    <Settings size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 900 }}>
                      Field Extensibility
                    </h2>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      Define custom VARCHAR attributes
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: "0.625rem",
                        color: "#94a3b8",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        marginBottom: "0.5rem",
                        display: "block",
                      }}
                    >
                      Display Label
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Employee Grade"
                      value={customFieldForm.field_label}
                      onChange={(e) =>
                        setCustomFieldForm({
                          ...customFieldForm,
                          field_label: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}
                  >
                    <div className="form-group">
                      <label
                        style={{
                          fontSize: "0.625rem",
                          color: "#94a3b8",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          marginBottom: "0.5rem",
                          display: "block",
                        }}
                      >
                        Field Type
                      </label>
                      <select
                        className="form-control"
                        value={customFieldForm.field_type}
                        onChange={(e) =>
                          setCustomFieldForm({
                            ...customFieldForm,
                            field_type: e.target.value,
                          })
                        }
                      >
                        <option value="VARCHAR">VARCHAR (Text)</option>
                        <option value="NUMBER">NUMERIC</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label
                        style={{
                          fontSize: "0.625rem",
                          color: "#94a3b8",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          marginBottom: "0.5rem",
                          display: "block",
                        }}
                      >
                        Max Length
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={customFieldForm.char_length}
                        onChange={(e) =>
                          setCustomFieldForm({
                            ...customFieldForm,
                            char_length: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      borderRadius: "16px",
                      background: "#1e293b",
                    }}
                    onClick={handleAddCustomField}
                  >
                    Implement Attribute Extension
                  </button>
                </div>
              </div>

              {/* Right: Live Schema View */}
              <div
                style={{
                  padding: "2.5rem",
                  background: "white",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => setShowSchemaModal(false)}
                  style={{
                    position: "absolute",
                    top: "1.5rem",
                    right: "1.5rem",
                    border: "none",
                    background: "#f1f5f9",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>

                <h3
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    marginBottom: "1.5rem",
                    color: "#1e293b",
                  }}
                >
                  Active Registry Protocol Extensions
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    maxHeight: "400px",
                    overflowY: "auto",
                    paddingRight: "0.5rem",
                  }}
                >
                  {activeProjectFields.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "4rem 2rem",
                        border: "2px dashed #f1f5f9",
                        borderRadius: "24px",
                      }}
                    >
                      <Database
                        size={32}
                        color="#cbd5e1"
                        style={{ marginBottom: "1rem" }}
                      />
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "#94a3b8",
                          fontWeight: 600,
                        }}
                      >
                        No dynamic extensions active for this workstream.
                      </p>
                    </div>
                  ) : (
                    activeProjectFields.map((field) => (
                      <div
                        key={field.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "1rem 1.25rem",
                          borderRadius: "16px",
                          border: "1px solid #f1f5f9",
                          background: "#fafafa",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 800,
                              color: "var(--text-main)",
                            }}
                          >
                            {field.field_label}
                          </p>
                          <p
                            style={{
                              fontSize: "0.625rem",
                              color: "#94a3b8",
                              fontWeight: 900,
                            }}
                          >
                            {field.field_type}({field.char_length})
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteCustomField(field.id)}
                          style={{
                            padding: "0.4rem",
                            borderRadius: "8px",
                            border: "none",
                            background: "#fee2e2",
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div
                  style={{
                    marginTop: "2.5rem",
                    padding: "1rem",
                    background: "#fff9eb",
                    borderRadius: "16px",
                    border: "1px solid #ffedd5",
                    display: "flex",
                    gap: "0.75rem",
                  }}
                >
                  <ShieldCheck size={20} color="#d97706" />
                  <p
                    style={{
                      fontSize: "0.7rem",
                      color: "#92400e",
                      fontWeight: 600,
                      lineHeight: 1.4,
                    }}
                  >
                    System-wide Warning: Removing active fields will permanently
                    truncate associated clinical data from the registry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {showNewProtocolModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999999,
            padding: "20px",
          }}
        >
          <div
            className="fade-in"
            style={{
              width: "100%",
              maxWidth: "900px",
              background: "white",
              borderRadius: "28px",
              padding: "32px",
              boxShadow: "0 40px 80px -15px rgba(0,0,0,0.3)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  background: "#f5f3ff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6366f1",
                }}
              >
                <Layers size={28} />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 900,
                    color: "#1e293b",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {isEditingProtocol
                    ? "Registry Governance: Edit"
                    : "Registry Protocol Setup"}
                </h2>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  {isEditingProtocol
                    ? "Modify live workspace metadata"
                    : "Initialize workspace extension"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNewProtocolModal(false);
                  setIsEditingProtocol(false);
                }}
                style={{
                  position: "absolute",
                  top: "32px",
                  right: "32px",
                  border: "none",
                  background: "#f1f5f9",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            <form
              onSubmit={handleAddNewProtocol}
              style={{
                maxHeight: "80vh",
                overflowY: "auto",
                paddingRight: "12px",
                overflowX: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    gridColumn: "span 2",
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #edf2f7",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#6366f1",
                      marginBottom: "8px",
                      display: "block",
                      letterSpacing: "0.05em",
                    }}
                  >
                    WORKSPACE IDENTITY (PUBLIC NAME)
                  </label>
                  <input
                    required
                    type="text"
                    className="form-control"
                    placeholder="e.g. Pharmacy Tracking"
                    value={newProtocolData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewProtocolData((prev) => ({
                        ...prev,
                        name: val,
                        slug: prev.isSlugManual
                          ? prev.slug
                          : val.toLowerCase().replace(/\s+/g, "_"),
                      }));
                    }}
                    style={{
                      background: "white",
                      height: "48px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div
                  style={{
                    gridColumn: "span 2",
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #edf2f7",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#6366f1",
                      marginBottom: "8px",
                      display: "block",
                      letterSpacing: "0.05em",
                    }}
                  >
                    TABLE NAME IDENTIFIER (INTERNAL ID)
                  </label>
                  <input
                    required
                    type="text"
                    className="form-control"
                    placeholder="e.g. pharmacy_data"
                    value={newProtocolData.slug}
                    onChange={(e) =>
                      setNewProtocolData({
                        ...newProtocolData,
                        slug: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                        isSlugManual: true,
                      })
                    }
                    style={{
                      background: "white",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--primary)",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "0.65rem",
                      color: "#94a3b8",
                      marginTop: "6px",
                      fontWeight: 600,
                    }}
                  >
                    This defines the physical data table identity in the
                    clinical backend.
                  </p>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #edf2f7",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#6366f1",
                      marginBottom: "8px",
                      display: "block",
                      letterSpacing: "0.05em",
                    }}
                  >
                    COVERAGE SCOPE
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Scope area"
                    value={newProtocolData.coverage}
                    onChange={(e) =>
                      setNewProtocolData({
                        ...newProtocolData,
                        coverage: e.target.value,
                      })
                    }
                    style={{
                      background: "white",
                      height: "48px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "16px",
                    border: "1px solid #edf2f7",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#10b981",
                      marginBottom: "8px",
                      display: "block",
                      letterSpacing: "0.05em",
                    }}
                  >
                    SYSTEM STATUS
                  </label>
                  <div
                    style={{
                      height: "48px",
                      background: "white",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 1rem",
                      color: "#10b981",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                    }}
                  >
                    <Check size={16} style={{ marginRight: "6px" }} /> MODULE
                    ACTIVE
                  </div>
                </div>
                {/* DYNAMIC FIELD BUILDER */}
                <div
                  style={{
                    marginTop: "2rem",
                    paddingTop: "1.5rem",
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 800,
                        color: "#1e293b",
                      }}
                    >
                      <Database size={14} style={{ marginRight: "6px" }} />{" "}
                      Dynamic Data Schema
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setNewProtocolData((prev) => ({
                          ...prev,
                          fields: [
                            ...prev.fields,
                            {
                              label: "",
                              slug: "",
                              data_type: "VARCHAR",
                              order: prev.fields.length,
                            },
                          ],
                        }))
                      }
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--primary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Plus size={14} /> Add Column
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      maxHeight: "250px",
                      overflowY: "auto",
                      paddingRight: "8px",
                      marginBottom: "1rem",
                    }}
                  >
                    {newProtocolData.fields.map((f, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "center",
                        }}
                      >
                        <input
                          placeholder="Field Label (e.g. Item Name)"
                          value={f.label}
                          onChange={(e) => {
                            const updated = [...newProtocolData.fields];
                            updated[idx].label = e.target.value;
                            updated[idx].slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "_");
                            setNewProtocolData((prev) => ({
                              ...prev,
                              fields: updated,
                            }));
                          }}
                          style={{
                            flex: "1 1 240px",
                            minWidth: "240px",
                            padding: "0.625rem 1rem",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--text-main)",
                          }}
                        />
                        <select
                          value={f.data_type}
                          onChange={(e) => {
                            const updated = [...newProtocolData.fields];
                            updated[idx].data_type = e.target.value;
                            setNewProtocolData((prev) => ({
                              ...prev,
                              fields: updated,
                            }));
                          }}
                          style={{
                            flex: 1,
                            padding: "0.625rem 1rem",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.75rem",
                          }}
                        >
                          <option value="VARCHAR">VARCHAR</option>
                          <option value="INT">INT</option>
                          <option value="DATE">DATE</option>
                          <option value="BOOLEAN">BOOLEAN</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Max Len"
                          value={f.max_length || 255}
                          title="Max length (e.g. 10 for phone)"
                          onChange={(e) => {
                            const updated = [...newProtocolData.fields];
                            updated[idx].max_length = parseInt(e.target.value);
                            setNewProtocolData((prev) => ({
                              ...prev,
                              fields: updated,
                            }));
                          }}
                          style={{
                            width: "60px",
                            padding: "0.625rem 0.5rem",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.75rem",
                            textAlign: "center",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...newProtocolData.fields];
                            updated[idx].is_required =
                              !updated[idx].is_required;
                            setNewProtocolData((prev) => ({
                              ...prev,
                              fields: updated,
                            }));
                          }}
                          style={{
                            padding: "0.625rem 0.75rem",
                            borderRadius: "10px",
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            border: "none",
                            background: f.is_required ? "#fef3c7" : "#f1f5f9",
                            color: f.is_required ? "#92400e" : "#64748b",
                          }}
                        >
                          {f.is_required ? "REQUIRED" : "OPTIONAL"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewProtocolData((prev) => ({
                              ...prev,
                              fields: prev.fields.filter((_, i) => i !== idx),
                            }))
                          }
                          style={{
                            color: "#ef4444",
                            background: "#fef2f2",
                            border: "none",
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {newProtocolData.fields.length === 0 && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                          textAlign: "center",
                          padding: "1rem",
                          background: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px dashed #e2e8f0",
                        }}
                      >
                        No custom columns defined yet.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    gridColumn: "span 2",
                    background: "#f8fafc",
                    padding: "20px",
                    borderRadius: "20px",
                    border: "1px solid #edf2f7",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      color: "#6366f1",
                      marginBottom: "8px",
                      display: "block",
                      letterSpacing: "0.05em",
                    }}
                  >
                    CLINICAL OBJECTIVES
                  </label>
                  <textarea
                    className="form-control"
                    style={{
                      height: "100px",
                      padding: "12px",
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      lineHeight: 1.5,
                      fontSize: "0.8125rem",
                    }}
                    placeholder="Registry purpose..."
                    value={newProtocolData.description}
                    onChange={(e) =>
                      setNewProtocolData({
                        ...newProtocolData,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProtocolModal(false);
                    setIsEditingProtocol(false);
                  }}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    height: "52px",
                    borderRadius: "14px",
                    background: "white",
                  }}
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 1.5,
                    height: "52px",
                    borderRadius: "14px",
                    background: "#1e293b",
                    border: "none",
                  }}
                >
                  {isEditingProtocol ? "Save Changes" : "Initialize Registry"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {showMachineModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100000 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "450px", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.6rem', background: 'linear-gradient(135deg, #6366f1 0%, #44403c 100%)', borderRadius: '12px' }}>
                     <Radio size={20} color="white" />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>{isEditingMachine ? 'Edit Station' : 'Register Station'}</h2>
               </div>
               <button onClick={() => setShowMachineModal(false)} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <X size={18} color="#64748b" />
               </button>
            </div>
            <form onSubmit={handleMachineSubmit}>
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                   <label>Station ID (e.g. CBC_01)</label>
                   <input type="text" className="form-control" placeholder="Unique machine identifier" required value={machineForm.machine_id} onChange={e => setMachineForm({ ...machineForm, machine_id: e.target.value })} />
                </div>
                <div>
                   <label>Station Name (e.g. CBC Machine 1)</label>
                   <input type="text" className="form-control" placeholder="Display name" required value={machineForm.machine_name} onChange={e => setMachineForm({ ...machineForm, machine_name: e.target.value })} />
                </div>
                <div>
                   <label>Lab Room / ID</label>
                   <input type="text" className="form-control" placeholder="e.g. Lab Room 1" required value={machineForm.lab_id} onChange={e => setMachineForm({ ...machineForm, lab_id: e.target.value })} />
                </div>
                <div>
                   <label>Location / Facility</label>
                   <input type="text" className="form-control" placeholder="e.g. Area Hospital" required value={machineForm.location} onChange={e => setMachineForm({ ...machineForm, location: e.target.value })} />
                </div>
                <div 
                   style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', padding: '1rem 1.25rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onClick={() => setMachineForm({ ...machineForm, is_active: !machineForm.is_active })}
                >
                   <input type="checkbox" id="m-active" style={{ width: '1.25rem', height: '1.25rem', margin: 0, cursor: 'pointer', pointerEvents: 'none' }} checked={machineForm.is_active} readOnly />
                   <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Active Registry Station</label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px', background: 'var(--primary)' }}>
                {isEditingMachine ? 'Update Station Profile' : 'Register in Bridge Hub'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showLabTestModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100000 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <div style={{ padding: '0.6rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '12px' }}>
                    <Activity size={20} color="white" />
                 </div>
                 <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>{isEditingLabTest ? 'Edit Lab Test' : 'Lab Test Master'}</h2>
              </div>
              <button onClick={() => { setShowLabTestModal(false); resetLabForm(); }} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleLabTestSubmit}>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label>Test Name (Required)</label>
                  <input type="text" className="form-control" required value={labTestForm.name} onChange={e => setLabTestForm({ ...labTestForm, name: e.target.value })} />
                </div>
                <div>
                  <label>Test Code (Required)</label>
                  <input type="text" className="form-control" required value={labTestForm.code} onChange={e => setLabTestForm({ ...labTestForm, code: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label>Test Type (Required)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select required className="form-control" value={labTestForm.test_type} onChange={e => setLabTestForm({ ...labTestForm, test_type: e.target.value })}>
                        <option value="">Select Type</option>
                        {labTestTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setShowTestTypeModal(true)} style={{ width: '44px', height: '52px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                   <div>
                    <label>Department (Required)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select required className="form-control" value={labTestForm.department} onChange={e => setLabTestForm({ ...labTestForm, department: e.target.value })}>
                        <option value="">Select Dept</option>
                        {labDepartments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setShowDeptModal(true)} style={{ width: '44px', height: '52px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label>Description (Required)</label>
                  <textarea className="form-control" style={{ height: '80px', padding: '10px' }} value={labTestForm.description} onChange={e => setLabTestForm({ ...labTestForm, description: e.target.value })} />
                </div>

                <div 
                   style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onClick={() => setLabTestForm({ ...labTestForm, is_active: !labTestForm.is_active })}
                >
                   <input type="checkbox" id="lab-active" style={{ width: '1.25rem', height: '1.25rem', margin: 0, cursor: 'pointer', pointerEvents: 'none' }} checked={labTestForm.is_active} readOnly />
                   <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Active Registry Entry</label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px', background: isEditingLabTest ? '#2563eb' : 'var(--primary)' }}>{isEditingLabTest ? 'Update Test Master' : 'Save Test Master'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showDeptModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1110000 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>New Department</h2>
              <button onClick={() => setShowDeptModal(false)} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleDeptSubmit}>
               <div style={{ display: 'grid', gap: '1.5rem' }}>
                 <div>
                    <label>Department Name</label>
                    <input type="text" className="form-control" required value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} />
                 </div>
                 <div>
                    <label>Purpose / Desc</label>
                    <textarea className="form-control" style={{ height: '60px' }} value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} />
                 </div>
               </div>
               <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px' }}>Initialize Dept</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showTestTypeModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1110000 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>New Test Type</h2>
              <button onClick={() => setShowTestTypeModal(false)} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <X size={18} color="#64748b" />
              </button>
            </div>
            <form onSubmit={handleTestTypeSubmit}>
               <div style={{ display: 'grid', gap: '1.5rem' }}>
                 <div>
                    <label>Type Name (e.g. Single)</label>
                    <input type="text" className="form-control" required value={testTypeForm.name} onChange={e => setTestTypeForm({ ...testTypeForm, name: e.target.value })} />
                 </div>
                 <div>
                    <label>Description</label>
                    <textarea className="form-control" style={{ height: '60px' }} value={testTypeForm.description} onChange={e => setTestTypeForm({ ...testTypeForm, description: e.target.value })} />
                 </div>
               </div>
               <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px' }}>Initialize Type</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showSubTestModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1111000 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "600px", border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{isEditingSubTest ? 'Edit Component' : 'Sub Test Definition'}</h2>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>For: {currentLabTest?.name}</div>
              </div>
              <X onClick={() => { setShowSubTestModal(false); resetSubTestForm(); }} cursor="pointer" />
            </div>
            <form onSubmit={handleSubTestSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Sub Test Name (Required)</label>
                  <input type="text" className="form-control" required placeholder="Enter" value={subTestForm.name} onChange={e => setSubTestForm({ ...subTestForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Sub Test Code (Required)</label>
                  <input type="text" className="form-control" required placeholder="Enter" value={subTestForm.code} onChange={e => setSubTestForm({ ...subTestForm, code: e.target.value })} />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Value Type (Required)</label>
                  <select className="form-control" value={subTestForm.value_type} onChange={e => setSubTestForm({ ...subTestForm, value_type: e.target.value })}>
                    <option value="INPUT">Input</option>
                    <option value="DROPDOWN">Dropdown</option>
                    <option value="DESCRIPTIVE">Descriptive</option>
                  </select>
                </div>

                {subTestForm.value_type === "INPUT" && (
                   <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Input Data Type (Required)</label>
                      <select className="form-control" value={subTestForm.input_data_type} onChange={e => setSubTestForm({ ...subTestForm, input_data_type: e.target.value })}>
                        <option value="text">text</option>
                        <option value="number">number</option>
                      </select>
                   </div>
                )}

                {subTestForm.value_type === "INPUT" && subTestForm.input_data_type === "text" && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Min Chars Length (Required)</label>
                      <input type="number" className="form-control" placeholder="Enter" value={subTestForm.min_chars} onChange={e => setSubTestForm({ ...subTestForm, min_chars: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Max chars Length</label>
                      <input type="number" className="form-control" placeholder="Enter" value={subTestForm.max_chars} onChange={e => setSubTestForm({ ...subTestForm, max_chars: e.target.value })} />
                    </div>
                  </>
                )}

                {subTestForm.value_type === "DROPDOWN" && (
                  <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Dropdown Values (comma-separated)</label>
                    <input type="text" className="form-control" placeholder="e.g. Positive, Negative" value={subTestForm.dropdown_options} onChange={e => setSubTestForm({ ...subTestForm, dropdown_options: e.target.value })} />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Units (Required)</label>
                  <input type="text" className="form-control" placeholder="e.g. mg/dL" value={subTestForm.units} onChange={e => setSubTestForm({ ...subTestForm, units: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Biological Range (Required)</label>
                  <input type="text" className="form-control" placeholder="e.g. 70 - 110" value={subTestForm.biological_range} onChange={e => setSubTestForm({ ...subTestForm, biological_range: e.target.value })} />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Description</label>
                  <input type="text" className="form-control" placeholder="Optional description" value={subTestForm.description} onChange={e => setSubTestForm({ ...subTestForm, description: e.target.value })} />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
                   <input type="checkbox" id="sub-active" checked={subTestForm.is_active} onChange={e => setSubTestForm({ ...subTestForm, is_active: e.target.checked })} style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }} />
                   <label htmlFor="sub-active" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer' }}>Active Component</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowSubTestModal(false); resetSubTestForm(); }} className="btn btn-secondary" style={{ width: '120px', height: '48px', borderRadius: '12px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: '120px', height: '48px', borderRadius: '12px', background: isEditingSubTest ? '#2563eb' : 'var(--primary)' }}>{isEditingSubTest ? 'Update' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1111500 }}>
          <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", textAlign: 'center', border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
            <div style={{ width: '80px', height: '80px', background: '#fef2f2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
               <Trash2 size={40} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>Are you sure?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
               You are about to delete <strong>{deleteTarget.label}</strong>. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary" style={{ flex: 1, height: '48px', borderRadius: '14px' }}>Cancel</button>
               <button onClick={handleConfirmDelete} className="btn btn-primary" style={{ flex: 1, height: '48px', borderRadius: '14px', background: '#dc2626' }}>Delete Record</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmModal?.isOpen && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1112000 }}>
          <div className="fade-in" style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "450px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid var(--border)" }}>
            <div style={{ width: '64px', height: '64px', background: '#fff1f2', color: '#e11d48', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.75rem' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '2rem' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, height: '52px', borderRadius: '16px' }}
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, height: '52px', borderRadius: '16px', background: '#e11d48', color: 'white', border: 'none' }}
                onClick={confirmModal.onConfirm}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isLedgerModalOpen && createPortal(
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999999,
          padding: "1rem"
        }}>
          <div className="card" style={{
            width: "100%",
            maxWidth: "700px",
            background: "var(--surface)",
            borderRadius: "24px",
            border: "1px solid var(--border)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "85vh",
            animation: "pulse 0.15s ease-out"
          }}>
            {/* Header */}
            <div style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <Pill size={20} color="var(--primary)" />
                  <span>Stock Deduction History</span>
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", margin: 0 }}>
                  Medication: <b style={{ color: "var(--text-main)" }}>{selectedBatchForLedger?.medication_name}</b> | Batch: <b style={{ color: "var(--text-main)" }}>{selectedBatchForLedger?.batch_number}</b>
                </p>
              </div>
              <button 
                onClick={() => setIsLedgerModalOpen(false)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  transition: "all 0.2s"
                }}
                className="hover-lift"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              {/* Batch Info Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1rem",
                marginBottom: "1.5rem"
              }}>
                <div style={{ background: "var(--background)", border: "1px solid var(--border)", padding: "0.75rem", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", display: "block" }}>Starting Stock</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)" }}>{selectedBatchForLedger?.initial_qty}</span>
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "0.75rem", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "0.625rem", color: "#10b981", fontWeight: 800, textTransform: "uppercase", display: "block" }}>Current Balance</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#10b981" }}>{selectedBatchForLedger?.quantity}</span>
                </div>
                <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", padding: "0.75rem", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "0.625rem", color: "#ef4444", fontWeight: 800, textTransform: "uppercase", display: "block" }}>Total Deductions</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ef4444" }}>
                    {(selectedBatchForLedger?.initial_qty || 0) - (selectedBatchForLedger?.quantity || 0)}
                  </span>
                </div>
              </div>

              {(() => {
                const records = Array.isArray(ledgerRecords) ? ledgerRecords : (ledgerRecords?.results || []);
                if (isLedgerLoading) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "12px" }}>
                      <div style={{ width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>Fetching deduction ledger...</span>
                    </div>
                  );
                }
                if (records.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "3rem", border: "2px dashed var(--border)", borderRadius: "16px" }}>
                      <Activity size={36} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: "0.75rem" }} />
                      <p style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>No deductions recorded yet</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", margin: 0 }}>This batch has not been dispensed in any prescriptions.</p>
                    </div>
                  );
                }
                return (
                  <div style={{ border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                      <thead>
                        <tr style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 800, color: "var(--text-muted)" }}>DATE & TIME</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 800, color: "var(--text-muted)" }}>PATIENT (CARD NO)</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>DEDUCTED</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 800, color: "var(--text-muted)" }}>PRESCRIBER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((rec) => (
                          <tr key={rec.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.75rem 1rem", color: "var(--text-main)", fontWeight: 700 }}>
                              {new Date(rec.dispensed_at).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true
                              })}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", color: "var(--text-main)", fontWeight: 700 }}>
                              <div>{rec.patient_name}</div>
                              <small style={{ color: "var(--text-muted)" }}>{rec.card_no}</small>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#ef4444", fontWeight: 800 }}>
                              -{rec.quantity}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", color: "var(--text-main)", fontWeight: 700 }}>
                              {rec.prescribed_by || "System"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{
              padding: "1rem 1.5rem",
              background: "var(--background)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button 
                onClick={() => setIsLedgerModalOpen(false)}
                className="btn btn-secondary"
                style={{ height: "42px", padding: "0 1.5rem", fontSize: "0.8125rem" }}
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedSession && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 100000,
            padding: "40px 1rem 60px 1rem",
            overflowY: "auto",
          }}
        >
          <div
            className="fade-in card"
            style={{
              width: "100%",
              maxWidth: "960px",
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              padding: 0,
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1.5rem 2rem",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)" }}>
                  Import Audit Logs Details
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 600 }}>
                  File: <span style={{ color: "#3b82f6" }}>{selectedSession.filename}</span> | Type: {selectedSession.registry_type_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={{
                  border: "none",
                  background: "var(--background)",
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {/* Session Meta Stats Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                padding: "1.5rem 2rem",
                background: "var(--background)",
                borderBottom: "1px solid var(--border)"
              }}
            >
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Uploaded By</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)", marginTop: "4px" }}>{selectedSession.username || 'System Admin'}</div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Upload Mode</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: selectedSession.mode === 'INCREMENT' || selectedSession.mode === 'ADD' ? '#059669' : '#d97706', marginTop: "4px" }}>
                  {selectedSession.mode === 'INCREMENT' || selectedSession.mode === 'ADD' ? 'Refill (Add)' : 'Replace'}
                </div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Succeeded Rows</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>{selectedSession.success_count} ✅</div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Failed Rows</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: selectedSession.error_count > 0 ? "#ef4444" : "var(--text-muted)", marginTop: "4px" }}>
                  {selectedSession.error_count} ❌
                </div>
              </div>
            </div>

            {/* Dynamic Tabs Selectors */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "0 2rem"
              }}
            >
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "1rem 1.5rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  color: activeDetailTab === "SUCCESS" ? "#10b981" : "var(--text-muted)",
                  borderBottom: activeDetailTab === "SUCCESS" ? "2px solid #10b981" : "2px solid transparent",
                  transition: "all 0.2s"
                }}
                onClick={() => setActiveDetailTab("SUCCESS")}
              >
                Succeeded List ({selectedSession.success_count})
              </button>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "1rem 1.5rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  color: activeDetailTab === "FAILED" ? "#ef4444" : "var(--text-muted)",
                  borderBottom: activeDetailTab === "FAILED" ? "2px solid #ef4444" : "2px solid transparent",
                  transition: "all 0.2s"
                }}
                onClick={() => setActiveDetailTab("FAILED")}
              >
                Failed List ({selectedSession.error_count})
              </button>
            </div>

            {/* Details Body */}
            <div style={{ padding: "1.5rem 2rem", maxHeight: "400px", overflowY: "auto", background: "var(--background)" }}>
              {activeDetailTab === "SUCCESS" ? (
                selectedSession.success_details && selectedSession.success_details.length > 0 ? (
                  <div className="table-responsive">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Code</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Name</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Category</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Quantity</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Unit Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSession.success_details.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)" }}>{item.ucode}</td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>{item.name}</td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {item.category ? (
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "var(--surface)", padding: "2px 6px", borderRadius: "4px" }}>
                                  {item.category}
                                </span>
                              ) : '-'}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 800, color: "#10b981", textAlign: "right" }}>
                              {selectedSession.mode === 'INCREMENT' || selectedSession.mode === 'ADD' ? `+${item.qty}` : item.qty}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", textAlign: "right" }}>
                              {item.cost ? `₹${parseFloat(item.cost).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)", fontWeight: 600 }}>
                    No successfully imported records in this session.
                  </div>
                )
              ) : (
                selectedSession.error_details && selectedSession.error_details.length > 0 ? (
                  <div className="table-responsive">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", width: "100px" }}>Row No.</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", width: "220px" }}>Item Identifier</th>
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSession.error_details.map((err, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 800, color: "#ef4444" }}>
                              Row {err.row || idx + 2}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>
                              {err.item || 'Unknown'}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#f43f5e", fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={14} />
                                {err.error || 'Failed to import'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "#10b981", fontWeight: 800 }}>
                    🎉 Awesome! This upload session completed with 100% success and 0 errors!
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "1rem 2rem",
                background: "var(--surface)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end"
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedSession(null)}
                style={{
                  borderRadius: "10px",
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 800
                }}
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {stockDetailModal.isOpen && createPortal(
        (() => {
          const filteredModalItems = stockDetailModal.items.filter(item => 
            item.name?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
            item.ucode?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
            item.category?.toLowerCase().includes(modalSearchQuery.toLowerCase())
          );
          
          return (
            <div 
              onClick={() => setStockDetailModal(prev => ({ ...prev, isOpen: false }))}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.08)', /* Transparent light backdrop overlay */
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999, /* Absolute root z-index overlay */
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <div 
                onClick={(e) => e.stopPropagation()} /* Prevents closing modal on internal clicks */
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  width: '90%',
                  maxWidth: '820px',
                  maxHeight: '85vh',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {/* Header */}
                <div style={{
                  background: stockDetailModal.type === 'LOW_STOCK' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: 'white',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'relative'
                }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.01em', margin: 0 }}>
                      {stockDetailModal.title}
                    </h3>
                    <p style={{ fontSize: '0.7rem', opacity: 0.85, margin: '4px 0 0 0', fontWeight: 500 }}>
                      {stockDetailModal.type === 'LOW_STOCK' 
                        ? `Stock levels currently operating below safe baseline threshold` 
                        : `Medications with zero recorded inventory balance in the system`}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}>
                      {stockDetailModal.items.length} {stockDetailModal.items.length === 1 ? 'item' : 'items'}
                    </span>
                    <button 
                      onClick={() => setStockDetailModal(prev => ({ ...prev, isOpen: false }))}
                      style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
                    <input 
                      type="text"
                      placeholder="Search items by name, code or category..."
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-main)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = stockDetailModal.type === 'LOW_STOCK' ? '#f59e0b' : '#ef4444'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                    {modalSearchQuery && (
                      <button 
                        onClick={() => setModalSearchQuery("")}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                  {filteredModalItems.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                      <thead>
                        <tr style={{ 
                          background: 'var(--background)',
                          color: 'var(--text-muted)', 
                          fontWeight: 900, 
                          textAlign: 'left',
                          fontSize: '0.625rem',
                          letterSpacing: '0.06em'
                        }}>
                          <th style={{ padding: '12px 16px', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>CODE</th>
                          <th style={{ padding: '12px 16px' }}>ITEM NAME</th>
                          <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>STOCK QTY</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>UNIT COST</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>TOTAL VALUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item, index) => {
                          const costVal = parseFloat(item.cost) || 0;
                          const qtyVal = parseFloat(item.quantity) || 0;
                          const totalVal = costVal * qtyVal;
                          
                          return (
                            <tr 
                              key={index} 
                              style={{ 
                                borderBottom: '1px solid var(--border)', 
                                transition: 'all 0.18s ease',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.015)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.6875rem' }}>
                                {item.ucode || 'N/A'}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.75rem' }}>{item.name}</div>
                                {item.description && (
                                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                                    {item.description}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{
                                  fontSize: '0.55rem',
                                  fontWeight: 900,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(99, 102, 241, 0.08)',
                                  color: '#4f46e5',
                                  border: '1px solid rgba(99, 102, 241, 0.15)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.02em'
                                }}>
                                  {item.category?.replace('_', ' ') || 'DRUG'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: 900,
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.65rem',
                                  background: qtyVal === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                  color: qtyVal === 0 ? '#ef4444' : '#d97706',
                                  border: qtyVal === 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: qtyVal === 0 ? '#ef4444' : '#f59e0b',
                                    display: 'inline-block'
                                  }} />
                                  {qtyVal} units
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                ₹{costVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)', fontSize: '0.75rem' }}>
                                ₹{totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      <AlertCircle size={32} color={stockDetailModal.type === 'LOW_STOCK' ? '#f59e0b' : '#ef4444'} style={{ marginBottom: '1rem', opacity: 0.8 }} />
                      <p style={{ fontWeight: 800, fontSize: '0.8rem', margin: 0 }}>No items match search filter</p>
                      <p style={{ fontSize: '0.65rem', margin: '4px 0 0 0' }}>Try entering a different drug name or code</p>
                    </div>
                  )}
                </div>

                {/* Total Estimated Summary */}
                <div style={{
                  padding: '1rem 1.5rem',
                  background: 'var(--background)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.72rem'
                }}>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>
                    Total Estimated Value of Listed Items:
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 900,
                    color: stockDetailModal.type === 'LOW_STOCK' ? '#d97706' : '#ef4444',
                    letterSpacing: '-0.01em'
                  }}>
                    ₹{filteredModalItems.reduce((acc, item) => acc + ((parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          );
        })()
      , document.body)}

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
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Paste Card Numbers
                      </span>
                      <label style={{ 
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)', 
                        background: 'rgba(99, 102, 241, 0.08)', padding: '6px 12px', borderRadius: '8px',
                        display: 'inline-flex', alignItems: 'center', gap: '4px', margin: 0, textTransform: 'none', letterSpacing: 'normal'
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
                      rows="6"
                      placeholder="e.g.&#10;2254&#10;2255&#10;2256"
                      style={{ 
                        width: '100%',
                        background: '#f8fafc', 
                        borderRadius: '16px', 
                        fontSize: '1rem', 
                        padding: '1rem', 
                        fontFamily: 'monospace',
                        border: '1.5px solid var(--border)',
                        color: 'var(--text-main)',
                        transition: 'all 0.2s',
                        resize: 'none',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.background = 'var(--surface)';
                        e.target.style.boxShadow = '0 0 0 4px var(--primary-light)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border)';
                        e.target.style.background = '#f8fafc';
                        e.target.style.boxShadow = 'none';
                      }}
                      value={bulkEnrollData}
                      onChange={(e) => setBulkEnrollData(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button 
                      className="btn btn-primary"
                      disabled={isBulkEnrolling}
                      onClick={handleBulkEnrollSubmit}
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '14px', 
                        fontWeight: 900,
                        border: 'none',
                        color: 'white',
                        width: '100%'
                      }}
                    >
                      {isBulkEnrolling ? 'ACTIVATING...' : 'ACTIVATE & SYNC RECORDS'}
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowBulkEnrollModal(false)}
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '14px', 
                        fontWeight: 900,
                        width: '100%'
                      }}
                    >Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .form-control { 
            background: var(--input-bg, var(--background)) !important; 
            height: 52px !important; 
            border-radius: 16px !important; 
            border: 1.5px solid var(--border) !important; 
            padding: 0 1.25rem !important; 
            width: 100% !important; 
            transition: all 0.2s !important; 
            font-size: 0.9375rem !important;
            font-weight: 600 !important;
            color: var(--text-main) !important;
        }
        .form-control:focus { 
            background: var(--surface) !important;
            border-color: var(--primary) !important; 
            outline: none !important; 
            box-shadow: 0 0 0 4px var(--primary-light) !important; 
        }
        label {
            font-size: 0.75rem !important;
            font-weight: 800 !important;
            color: var(--text-muted) !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            margin-bottom: 0.5rem !important;
            display: block !important;
        }
        .btn { border-radius: 14px; font-weight: 800; padding: 0.75rem 1.75rem; transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; justify-content: center; border: none; }
        .btn-primary { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(99, 102, 241, 0.3); }
        .btn-secondary { background: var(--surface); color: var(--text-main); border: 1.5px solid var(--border); }
        .btn-secondary:hover { background: var(--background); }
        .card { background: var(--surface); border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); border: 1px solid var(--border); }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>
    </>
  );
};

export default AdminMasters;
