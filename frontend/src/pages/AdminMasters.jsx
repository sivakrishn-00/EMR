import React, { useState, useEffect } from "react";
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
  Shuffle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const AdminMasters = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employeeMasters, setEmployeeMasters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalFamilyCount, setTotalFamilyCount] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [viewMode, setViewMode] = useState("PROJECTS"); // PROJECTS, DATA
  const [activeBoard, setActiveBoard] = useState("PROTOCOLS"); // STATS, REGISTRY, PROTOCOLS
  const [projects, setProjects] = useState([]);
  const [customProtocols, setCustomProtocols] = useState({}); // { projectId: [ protocols ] }
  const [exploringProtocolId, setExploringProtocolId] = useState("employee_master");

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
      isCustom: !["PERSONNEL_PRIMARY", "PERSONNEL_DEPENDENT"].includes(rt.type_category),
      fields:
        rt.fields && rt.fields.length > 0
          ? rt.fields
          : rt.slug === "employee_master"
            ? [
                { label: "Card No", slug: "card_no" },
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
  
  const [dashboardStats, setDashboardStats] = useState(null);
  
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
  const [bulkMode, setBulkMode] = useState("OVERWRITE"); // OVERWRITE or INCREMENT

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
    additional_fields: {},
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
      } else {
        fetchEmployeeMasters(1);
      }
    }, 400);
    
    fetchProjects();
    return () => clearTimeout(timer);
  }, [selectedProject, exploringProtocolId, searchQuery, activeBoard]);

  const fetchDashboardStats = async () => {
    if (!selectedProject) return;
    try {
      const res = await api.get(`patients/registry-report/?project=${selectedProject}`);
      setDashboardStats(res.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
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

      if (res.data.results) {
        setEmployeeMasters(res.data.results);
        setTotalCount(res.data.count);
        setTotalFamilyCount(res.data.total_family_count || 0);
      } else {
        const results = Array.isArray(res.data)
          ? res.data
          : res.data.results || [];
        setEmployeeMasters(results);
        setTotalCount(res.data.count || results.length);
        setTotalFamilyCount(res.data.total_family_count || 0);
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

    try {
      if (isEditingMaster) {
        await api.put(`patients/employee-masters/${editingMasterId}/`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Employee Master Updated!");
      } else {
        await api.post("patients/employee-masters/", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Employee Master Registered!");
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
        additional_fields: {},
      });
      fetchEmployeeMasters();
    } catch (err) {
      console.error(err.response?.data);
      const errorMsg = err.response?.data 
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${v}`).join(", ")
        : (isEditingMaster ? "Error updating master" : "Error creating master");
      toast.error(errorMsg);
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
          toast.success("Legacy Family Member Updated!");
        } else {
          await api.post("patients/family-members/", data, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success("Legacy Family Member Added!");
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
          toast.success("Registry: Dependent Profile Updated!");
        } else {
          await api.post("patients/registry-data/", payload);
          toast.success("Registry: New Dependent Registered!");
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
              ? { records: batch }
              : { registry_type: exploringProtocolId, records: batch, mode: bulkMode };
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

  const stats = getStats();

  const downloadFailedRecords = () => {
    if (bulkStatus.failedRecords.length === 0) return;

    const headers = [
      "CardNo",
      "Name",
      "Age/Gender",
      "Aadhar",
      "Mobile",
      "Address",
      "Relationship",
      "Error Reason",
    ];
    const rows = bulkStatus.failedRecords.map((r) => [
      r.card_no,
      `"${r.name}"`,
      r.age_gender,
      r.aadhar_no,
      r.mobile_no,
      `"${r.address?.replace(/\n/g, " ")}"`,
      r.relationship,
      `"${r.error}"`,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `failed_records_${new Date().getTime()}.csv`);
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
                  className="btn btn-secondary"
                  onClick={() => {
                    setViewMode("PROJECTS");
                    setSelectedProject("");
                  }}
                >
                  Back to Project List
                </button>
                {projects.find((p) => String(p.id) === String(selectedProject))?.category_mappings?.some((m) => m.category === "EMPLOYEE") && (
                  <button
                    className="btn btn-primary"
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
                        additional_fields: {},
                      });
                      fetchNextCardNo(selectedProject || user?.project);
                      setShowMasterModal(true);
                    }}
                  >
                    <Plus size={20} /> New Registry Entry
                  </button>
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
                    setActiveBoard("PROTOCOLS");
                    fetchEmployeeMasters(1, p.id);
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              {/* Station Total Card */}
              <div
                className="card fade-in"
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                  borderRadius: "12px",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 10px rgba(99, 102, 241, 0.15)",
                  border: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                   <div style={{ padding: "0.25rem", background: "rgba(255, 255, 255, 0.2)", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                      <Users size={14} color="white" />
                   </div>
                   <div style={{ fontSize: "0.5rem", fontWeight: 900, background: "rgba(255, 255, 255, 0.2)", padding: "2px 5px", borderRadius: "4px", letterSpacing: "0.05em" }}>LIVE</div>
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 900, marginBottom: "0px" }}>
                  {projects.length}
                </h3>
                <p style={{ fontSize: "0.5rem", fontWeight: 800, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.025em" }}>Station Total</p>
                <div style={{ position: "absolute", bottom: "-8px", right: "-8px", width: "40px", height: "40px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }} />
              </div>

              {/* OPD Today Card */}
              <div
                className="card fade-in"
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  borderRadius: "12px",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.15)",
                  border: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                   <div style={{ padding: "0.25rem", background: "rgba(255, 255, 255, 0.2)", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                      <Activity size={14} color="white" />
                   </div>
                   <div style={{ fontSize: "0.5rem", fontWeight: 900, background: "rgba(255, 255, 255, 0.2)", padding: "2px 5px", borderRadius: "4px", letterSpacing: "0.05em" }}>LIVE</div>
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 900, marginBottom: "0px" }}>
                  {totalCount.toString().padStart(2, '0')}
                </h3>
                <p style={{ fontSize: "0.5rem", fontWeight: 800, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.025em" }}>OPD Today</p>
                <div style={{ position: "absolute", bottom: "-8px", right: "-8px", width: "40px", height: "40px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }} />
              </div>

              {/* Emergency Card */}
              <div
                className="card fade-in"
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  borderRadius: "12px",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 10px rgba(239, 68, 68, 0.15)",
                  border: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                   <div style={{ padding: "0.25rem", background: "rgba(255, 255, 255, 0.2)", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                      <Clock size={14} color="white" />
                   </div>
                   <div style={{ fontSize: "0.5rem", fontWeight: 900, background: "rgba(255, 255, 255, 0.2)", padding: "2px 5px", borderRadius: "4px", letterSpacing: "0.05em" }}>LIVE</div>
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 900, marginBottom: "0px" }}>
                  {(totalFamilyCount || 0).toString().padStart(2, '0')}
                </h3>
                <p style={{ fontSize: "0.5rem", fontWeight: 800, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.025em" }}>Emergency</p>
                <div style={{ position: "absolute", bottom: "-8px", right: "-8px", width: "40px", height: "40px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }} />
              </div>

              {/* Dependents Card */}
              <div
                className="card fade-in"
                style={{
                  padding: "0.75rem",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderRadius: "12px",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 10px rgba(245, 158, 11, 0.15)",
                  border: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                   <div style={{ padding: "0.25rem", background: "rgba(255, 255, 255, 0.2)", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                      <UserPlus size={14} color="white" />
                   </div>
                   <div style={{ fontSize: "0.5rem", fontWeight: 900, background: "rgba(255, 255, 255, 0.2)", padding: "2px 5px", borderRadius: "4px", letterSpacing: "0.05em" }}>LIVE</div>
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 900, marginBottom: "0px" }}>
                   {totalFamilyCount}
                </h3>
                <p style={{ fontSize: "0.5rem", fontWeight: 800, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.025em" }}>Dependents</p>
                <div style={{ position: "absolute", bottom: "-8px", right: "-8px", width: "40px", height: "40px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }} />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1.5rem",
                background: "var(--surface)",
                padding: "0.5rem",
                borderRadius: "20px",
                border: "1px solid var(--border)",
                width: "fit-content",
              }}
            >
              <button
                className="btn"
                style={{
                  background: activeBoard === "PROTOCOLS" ? "var(--background)" : "transparent",
                  color: activeBoard === "PROTOCOLS" ? "var(--primary)" : "var(--text-muted)",
                  boxShadow: activeBoard === "PROTOCOLS" ? "var(--shadow-sm)" : "none",
                  fontSize: "0.75rem",
                  padding: "0 1.25rem",
                  height: "40px",
                  borderRadius: "14px",
                  transition: "all 0.2s",
                }}
                onClick={() => setActiveBoard("PROTOCOLS")}
              >
                <Layers size={16} /> Data Hub
              </button>

              <button
                className="btn"
                style={{
                  background: activeBoard === "DIAGNOSTICS" ? "var(--background)" : "transparent",
                  color: activeBoard === "DIAGNOSTICS" ? "var(--primary)" : "var(--text-muted)",
                  boxShadow: activeBoard === "DIAGNOSTICS" ? "var(--shadow-sm)" : "none",
                  fontSize: "0.75rem",
                  padding: "0 1.25rem",
                  height: "40px",
                  borderRadius: "14px",
                  transition: "all 0.2s",
                }}
                onClick={() => {
                  setActiveBoard("DIAGNOSTICS");
                  fetchLabTests();
                }}
              >
                <Activity size={16} /> Lab Masters
              </button>

              <button
                className="btn"
                style={{
                  background: activeBoard === "MACHINES" ? "var(--background)" : "transparent",
                  color: activeBoard === "MACHINES" ? "var(--primary)" : "var(--text-muted)",
                  boxShadow: activeBoard === "MACHINES" ? "var(--shadow-sm)" : "none",
                  fontSize: "0.75rem",
                  padding: "0 1.25rem",
                  height: "40px",
                  borderRadius: "14px",
                  transition: "all 0.2s",
                }}
                onClick={() => {
                  setActiveBoard("MACHINES");
                  fetchLabMachines();
                }}
              >
                <Radio size={16} /> Sync Bridge
              </button>


              <div style={{ width: "1px", background: "var(--border)", margin: "8px 4px" }} />

              <button
                className="btn"
                style={{
                  background: "transparent",
                  color: "#64748b",
                  fontSize: "0.75rem",
                  padding: "0 1.25rem",
                  height: "40px",
                  borderRadius: "14px",
                }}
                onClick={handleExport}
              >
                <Download size={16} /> Export CSV
              </button>

              <button
                className="btn btn-primary"
                style={{
                  fontSize: "0.75rem",
                  padding: "0 1.25rem",
                  height: "40px",
                  borderRadius: "14px",
                  background: "#1e293b",
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
            </div>

            {activeBoard === "STATS" ? (
              <div className="fade-in">
                {dashboardStats ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "1.25rem",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div
                        className="card"
                        style={{
                          padding: "1.5rem",
                          borderRadius: "24px",
                          background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                          color: "white",
                        }}
                      >
                        <p style={{ fontSize: "0.75rem", fontWeight: 800, opacity: 0.8 }}>TOTAL INVENTORY VALUE</p>
                        <h2 style={{ fontSize: "2rem", fontWeight: 900, marginTop: "0.5rem" }}>
                          ₹{dashboardStats.inventory_value.toLocaleString()}
                        </h2>
                        <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                           <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: "6px" }}>
                              {dashboardStats.total_registered} Patients
                           </span>
                        </div>
                      </div>
                      
                      <div
                        className="card"
                        style={{
                          padding: "1.5rem",
                          borderRadius: "24px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)" }}>STOCK HEALTH</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "100%", paddingBottom: "1.5rem" }}>
                           <div>
                              <h4 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f59e0b" }}>{dashboardStats.stock_health.low}</h4>
                              <p style={{ fontSize: "0.625rem", fontWeight: 800, color: "var(--text-muted)" }}>LOW STOCK ITEMS</p>
                           </div>
                           <div style={{ borderLeft: "1px solid var(--border)", height: "40px" }} />
                           <div>
                              <h4 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ef4444" }}>{dashboardStats.stock_health.out}</h4>
                              <p style={{ fontSize: "0.625rem", fontWeight: 800, color: "var(--text-muted)" }}>OUT OF STOCK</p>
                           </div>
                        </div>
                      </div>

                      <div
                        className="card"
                        style={{
                          padding: "1.5rem",
                          borderRadius: "24px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)" }}>CLINICAL CONVERSION</p>
                        <h2 style={{ fontSize: "2rem", fontWeight: 900, color: "#10b981", marginTop: "0.5rem" }}>
                          {dashboardStats.conversion_rate}%
                        </h2>
                        <p style={{ fontSize: "0.625rem", fontWeight: 800, color: "var(--text-muted)", marginTop: "4px" }}>
                           Visits successfully completed today
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
                       <div className="card" style={{ padding: "1.5rem", borderRadius: "24px" }}>
                          <h4 style={{ fontSize: "0.875rem", fontWeight: 900, marginBottom: "1.5rem" }}>MEDICATION CONSUMPTION TRENDS</h4>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", height: "200px", padding: "1rem 0" }}>
                             {dashboardStats.trends.map((t, i) => (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                   <div style={{ 
                                      width: "100%", 
                                      background: "#eff6ff", 
                                      borderRadius: "8px", 
                                      height: `${Math.min(100, (t.units / (Math.max(...dashboardStats.trends.map(x=>x.units), 1))) * 100)}%`,
                                      border: "1px solid #dbeafe",
                                      minHeight: "4px"
                                   }} />
                                   <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#94a3b8" }}>{t.date.split('-').slice(1).join('/')}</span>
                                </div>
                             ))}
                          </div>
                       </div>
                       
                       <div className="card" style={{ padding: "1.5rem", borderRadius: "24px" }}>
                          <h4 style={{ fontSize: "0.875rem", fontWeight: 900, marginBottom: "1.5rem" }}>TOP DISPENSED</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                             {dashboardStats.top_medications.slice(0, 5).map((m, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "0.75rem", borderRadius: "12px" }}>
                                   <span style={{ fontSize: "0.75rem", fontWeight: 800 }}>{m.name}</span>
                                   <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--primary)" }}>{m.total} Units</span>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
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
                          background: "var(--background)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <th
                          style={{
                            padding: "1.25rem 2rem",
                            textAlign: "left",
                            fontSize: "0.625rem",
                            fontWeight: 900,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Available Upload Protocol
                        </th>
                        <th
                          style={{
                            padding: "1.25rem 2rem",
                            textAlign: "left",
                            fontSize: "0.625rem",
                            fontWeight: 900,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Data Coverage
                        </th>
                        <th
                          style={{
                            padding: "1.25rem 2rem",
                            textAlign: "right",
                            fontSize: "0.625rem",
                            fontWeight: 900,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Management Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentProtocols().map((proto) => (
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
                                color: "#64748b",
                                background: "#f1f5f9",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
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
                              {proto.isCustom && (
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
                                  background: "white",
                                  border: "1px solid #e2e8f0",
                                  color: "#475569",
                                  fontSize: "0.75rem",
                                  height: "40px",
                                  padding: "0 1.25rem",
                                  borderRadius: "10px",
                                  fontWeight: 800,
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
                      ))}
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
                            style={{ borderRadius: '12px', padding: '0.75rem 1.25rem', fontSize: '0.75rem' }}
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
                  <div style={{ padding: '8rem', textAlign: 'center', background: 'white', borderRadius: '32px' }}>
                      <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
                      <p style={{ fontWeight: 800, color: '#94a3b8' }}>Syncing registry states...</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
                      {labMachines.map(m => (
                        <div key={m.id} className="card" style={{ 
                            padding: '1.5rem', 
                            borderRadius: '24px', 
                            border: '1px solid #eef2f6', 
                            background: 'linear-gradient(to bottom right, #ffffff, #f9fafb)',
                            position: 'relative',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '16px', border: m.is_online ? '2.5px solid #10b981' : '2px solid #e2e8f0' }}>
                                            <Radio size={24} color={m.is_online ? '#10b981' : '#94a3b8'} />
                                        </div>
                                        {m.is_online && <div style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '3px solid white', animation: 'pulse 2s infinite' }} />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{m.machine_name || m.name}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{m.lab_id || 'LOCAL_GW'} • {m.location || 'SITE'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      onClick={() => { setCurrentMachine(m); setMachineForm({...m}); setIsEditingMachine(true); setShowMachineModal(true); }}
                                      style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#64748b' }}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '18px', border: '1px solid #f1f5f9', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Session Health</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: m.is_online ? '#059669' : '#eab308' }}>
                                        {m.is_online ? 'ACTIVE SIGNAL' : 'SIGNAL IDLE'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: m.is_online ? '100%' : '30%', height: '100%', background: m.is_online ? '#10b981' : '#f59e0b', transition: 'width 1s' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', marginBottom: '4px' }}>TELEMETRY</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#6366f1' }}>{m.telemetry_data?.total_records || 0} Records</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', marginBottom: '4px' }}>LAST PULSE</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>{m.last_pulse ? new Date(m.last_pulse).toLocaleTimeString() : '---'}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem', background: '#f0f9ff', padding: '0.75rem', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 800 }}>
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
                        <div style={{ gridColumn: '1/-1', padding: '8rem 2rem', textAlign: 'center', background: '#ffffff', borderRadius: '32px', border: '2px dashed #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                <Radio size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.25rem' }}>No Bridge Data Available</h3>
                                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600, maxWidth: '400px', margin: '0 auto' }}>Establishing a sync bridge is required to begin ingestion for this project workspace. Please ensure your local agents are configured with the correct project key.</p>
                            </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ) : activeBoard === "DIAGNOSTICS" ? (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>Laboratory Diagnostic Masters</h3>
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Configure project-specific lab tests and component definitions</p>
                    </div>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowLabTestModal(true)}
                        style={{ background: 'var(--primary)', borderRadius: '12px', padding: '0.75rem 1.5rem' }}
                    >
                        <Plus size={18} /> New Lab Test
                    </button>
                </div>
                
                <div className="card" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div className="table-responsive">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                              <tr style={{ background: 'var(--background)', borderBottom: '1px solid #f1f5f9' }}>
                                  <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Test Name / Code</th>
                                  <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                                  <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dept / Components</th>
                                  <th style={{ padding: '1.25rem 2rem', textAlign: 'right', fontSize: '0.625rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                               {labTests.map(test => (
                                 <React.Fragment key={test.id}>
                                   <tr style={{ borderBottom: '1px solid #f8fafc', background: test.is_active ? 'transparent' : '#fcfcfc' }}>
                                       <td style={{ padding: '1.5rem 2rem' }}>
                                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                              <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '10px' }}>
                                                 <FlaskConical size={20} color="var(--primary)" />
                                              </div>
                                              <div>
                                                <div style={{ fontWeight: 800, color: test.is_active ? '#1e293b' : '#94a3b8', fontSize: '1rem' }}>{test.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Code: {test.code || 'N/A'}</div>
                                              </div>
                                           </div>
                                       </td>
                                       <td style={{ padding: '1.5rem 2rem' }}>
                                           <span style={{ fontSize: '0.625rem', fontWeight: 900, background: test.is_active ? '#e0e7ff' : '#f1f5f9', color: test.is_active ? '#4338ca' : '#94a3b8', padding: '0.4rem 0.75rem', borderRadius: '8px', textTransform: 'uppercase' }}>
                                               {test.test_type_details?.name || 'N/A'}
                                           </span>
                                       </td>
                                       <td style={{ padding: '1.5rem 2rem' }}>
                                           <div style={{ fontSize: '0.875rem', fontWeight: 700, color: test.is_active ? '#475569' : '#cbd5e1' }}>{test.department_details?.name || 'N/A'}</div>
                                           <button 
                                              onClick={() => setExpandedLabTests({ ...expandedLabTests, [test.id]: !expandedLabTests[test.id] })}
                                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800, marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                           >
                                               {test.sub_tests?.length || 0} Dynamic Components
                                               {expandedLabTests[test.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                           </button>
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
                                        <td colSpan="4" style={{ padding: '0 2rem 1.5rem 4rem' }}>
                                            <div style={{ background: 'var(--background)', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
                                               <div style={{ fontSize: '0.625rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Component Definitions</div>
                                               {test.sub_tests && test.sub_tests.length > 0 ? (
                                                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                     {test.sub_tests.map(sub => (
                                                        <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: '12px', border: '1px solid #edf2f7', opacity: sub.is_active ? 1 : 0.6 }}>
                                                           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.is_active ? '#10b981' : '#cbd5e1' }}></div>
                                                              <div>
                                                                 <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem' }}>{sub.name} <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>[{sub.code}]</span></div>
                                                                 <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{sub.value_type} • {sub.units || 'No units'} • {sub.biological_range || 'No range'}</div>
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
                                                              }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#475569', cursor: 'pointer' }}><Edit2 size={12} /></button>
                                                              <button onClick={() => handleToggleSubTestStatus(sub)} style={{ background: sub.is_active ? '#fff7ed' : '#ecfdf5', border: 'none', borderRadius: '6px', padding: '4px 8px', color: sub.is_active ? '#ea580c' : '#059669', cursor: 'pointer' }}><Power size={12} /></button>
                                                              <button onClick={() => handleDeleteSubTest(sub.id, sub.name)} style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                                           </div>
                                                        </div>
                                                     ))}
                                                  </div>
                                               ) : (
                                                  <div style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No components defined for this test.</div>
                                               )}
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
                    background: "#f8fafc",
                    padding: "0.75rem 1.25rem",
                    borderRadius: "16px",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <button
                    onClick={() => setActiveBoard("PROTOCOLS")}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#64748b",
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
                  <ChevronRight size={14} color="#cbd5e1" />
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
                        size={18}
                        style={{
                          position: "absolute",
                          left: "1.25rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                        }}
                      />
                      <input
                        type="text"
                        placeholder={`Search ${getCurrentProtocols()
                            .find((p) => p.id === exploringProtocolId)
                            ?.name?.toLowerCase() || "repository"
                          }...`}
                        className="form-control"
                        style={{
                          paddingLeft: "3rem",
                          height: "52px",
                          border: "1.5px solid #f1f5f9",
                          borderRadius: "16px",
                          background: "#fbfcfe",
                        }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && fetchEmployeeMasters(1)
                        }
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        className="btn btn-secondary"
                        style={{
                          width: "52px",
                          height: "52px",
                          padding: 0,
                          background: "white",
                          border: "1.5px solid #f1f5f9",
                          borderRadius: "16px",
                        }}
                        onClick={() => fetchEmployeeMasters(1)}
                        title="Refresh Data"
                      >
                        <RotateCcw size={20} color="#64748b" />
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setBulkProject(selectedProject);
                          setExploringProtocolId(exploringProtocolId);
                          setBulkType("HEALTH");
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
                          background: "#1e293b",
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
                          background: "white",
                          color: "#1e293b",
                          border: "1.5px solid #f1f5f9"
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
                    border: "1px solid #f1f5f9",
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
                            background: "#f8fafc",
                            borderBottom: "1px solid #f1f5f9",
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
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                AADHAR/CARD NO
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
                              {getCurrentProtocols()
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
                                ))}
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
                                  background: "#fff",
                                }}
                              >
                                <div style={{ maxWidth: "300px", margin: "0 auto" }}>
                                  <div
                                    style={{
                                      width: "80px",
                                      height: "80px",
                                      background: "#f8fafc",
                                      borderRadius: "30px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      margin: "0 auto 1.5rem auto",
                                      border: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <Search size={32} color="#cbd5e1" />
                                  </div>
                                  <h3 style={{ fontWeight: 900, color: "#1e293b", marginBottom: "0.5rem", fontSize: "1.25rem" }}>No Records Found</h3>
                                  <p style={{ color: "#64748b", fontWeight: 700, fontSize: "0.875rem", lineHeight: 1.6 }}>
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
                                <tr style={{ background: "#fdfdff" }}>
                                  {["employee", "family", "health", "employee_master", "family_member"].includes(
                                    exploringProtocolId,
                                  ) ? (
                                    <>
                                      <td
                                        style={{
                                          padding: "1.25rem 1.5rem",
                                          fontWeight: 900,
                                          color: "#64748b",
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
                                          color: "#1e293b",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        {m.name}
                                      </td>
                                      <td style={{ fontWeight: 800, color: "#1e293b", fontSize: "0.8125rem" }}>
                                        {age !== "N/A" ? `${age} / ${m.gender?.[0] || m.gender}` : (m.gender || "--")}
                                      </td>
                                      <td style={{ color: "#475569", fontSize: '0.8125rem', fontWeight: 700 }}>
                                        {m.aadhar_no || "--"}
                                      </td>
                                      <td style={{ fontWeight: 600, color: "#64748b" }}>
                                        {m.mobile_no || "--"}
                                      </td>
                                      <td
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#64748b",
                                        }}
                                      >
                                        {m.address ? (m.address.length > 20 ? m.address.substring(0, 20) + "..." : m.address) : "--"}
                                      </td>
                                      <td
                                        style={{
                                          fontSize: "0.8125rem",
                                          fontWeight: 900,
                                          color: "#1e293b",
                                        }}
                                      >
                                        {m.designation || "-"}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td
                                        style={{
                                          padding: "1.5rem 1.5rem",
                                          fontWeight: 900,
                                          color: "#64748b",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        {sno}
                                      </td>
                                      {(
                                        getCurrentProtocols().find(
                                          (p) => p.id === exploringProtocolId,
                                        )?.fields || []
                                      ).map((f) => (
                                        <td
                                          key={f.id || f.slug}
                                          style={{
                                            padding: "1.5rem 1.5rem",
                                            fontWeight: 700,
                                            color: "#4b5563",
                                            fontSize: "0.875rem",
                                          }}
                                        >
                                          {String(
                                            m.additional_fields?.[f.slug] ||
                                            m.additional_fields?.[
                                            f.slug.toLowerCase()
                                            ] ||
                                            m.additional_fields?.[
                                            f.slug.toUpperCase()
                                            ] ||
                                            m[f.slug.toLowerCase()] ||
                                            "--",
                                          )}
                                        </td>
                                      ))}
                                    </>
                                  )}
                                  {exploringProtocolId === "employee_master" &&
                                    activeProjectFields.map((field) => (
                                      <td
                                        key={field.id}
                                        style={{
                                          fontSize: "0.8125rem",
                                          fontWeight: 700,
                                          color: "#1e293b",
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
                                              additional_fields:
                                                m.additional_fields || {},
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
                                          background: "white",
                                        }}
                                      >
                                        <td style={{ padding: "1rem 1.5rem" }}></td>
                                        <td
                                          style={{
                                            fontWeight: 900,
                                            color: "#94a3b8",
                                            fontSize: "0.8125rem",
                                          }}
                                        >
                                          {m.card_no}{f.card_no_suffix ? (f.card_no_suffix.startsWith('/') ? f.card_no_suffix : `/${f.card_no_suffix}`) : ""}
                                        </td>
                                        <td
                                          style={{
                                            fontWeight: 800,
                                            color: "#475569",
                                          }}
                                        >
                                          {f.name}
                                        </td>
                                        <td style={{ fontWeight: 600, color: "#64748b" }}>
                                          {fAge} / {f.gender?.[0] || f.gender}
                                        </td>
                                        <td style={{ color: "#94a3b8" }}>
                                          {f.aadhar_no || "--"}
                                        </td>
                                        <td style={{ color: "#64748b" }}>
                                          {f.mobile_no || m.mobile_no || "--"}
                                        </td>
                                        <td style={{ color: "#94a3b8", fontSize: '0.7rem' }}>
                                          {f.address ? (f.address.length > 10 ? f.address.substring(0, 10) + "..." : f.address) : "--"}
                                        </td>
                                        <td
                                          style={{
                                            color: "#64748b",
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
                                          background: "#f8fafc",
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        <td
                                          style={{
                                            padding: "0.75rem 1.5rem",
                                            color: "#94a3b8",
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
                                              color: "#4b5563",
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
                                                    background: "#e0e7ff",
                                                    color: "#4338ca",
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
                      borderTop: "1px solid #f1f5f9",
                      background: "#f8fafc",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "#64748b",
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
                          background: "white",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.8125rem",
                          fontWeight: 800,
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
              background: "rgba(255, 255, 255, 0.85)",
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
                background: "white",
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
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Clinical Registry & Personnel Onboarding</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMasterModal(false);
                    setIsEditingMaster(false);
                  }}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="#64748b" />
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
                        background: '#f8fafc',
                        cursor: 'not-allowed',
                        color: '#64748b'
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
                        borderTop: "1.5px dashed #f1f5f9",
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
                    background: "white",
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
                      background:
                        "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                    }}
                  >
                    {isEditingMaster
                      ? "Save Command Core Update"
                      : "Submit"}
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
              background: "rgba(255, 255, 255, 0.85)",
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
                background: "white",
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
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Personal Dependants & Relations</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowFamilyModal(false);
                    setIsEditingFamily(false);
                  }}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="#64748b" />
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
              background: "rgba(255, 255, 255, 0.85)",
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
                background: "white",
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
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Updating Global Database Entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRegistryEditModal(false)}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} color="#64748b" />
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
                      style={{ background: "#f8fafc" }}
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
            background: "rgba(255, 255, 255, 0.85)",
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
              background: "white",
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
                      color: "#64748b",
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
                  background: "#f1f5f9",
                  width: "36px",
                  height: "36px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} color="#64748b" />
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
                              : "1px solid #f1f5f9",
                          background:
                            String(bulkProject) == String(p.id)
                              ? "#f5f3ff"
                              : "white",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "1.25rem",
                            background: "#eff6ff",
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
                            color: "#1e293b",
                          }}
                        >
                          {p.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
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
                  {getCurrentProtocols(bulkProject).map((proto) => (
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
                        border: "1px solid #f1f5f9",
                        borderRadius: "24px",
                        transition: "all 0.2s ease",
                        background: "#fdfdff",
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
                          background: "#eff6ff",
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
                            color: "#1e293b",
                            marginBottom: "4px",
                          }}
                        >
                          {proto.name}
                        </h4>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
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
                          background: "#f8fafc",
                          padding: "1.5rem",
                          borderRadius: "20px",
                          marginBottom: "2rem",
                          border: "1px solid #f1f5f9",
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
                              color: "#1e293b",
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
                              background: "white",
                              padding: "0.75rem 1rem",
                              borderRadius: "12px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "0.625rem",
                                color: "#94a3b8",
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
                              background: "white",
                              padding: "0.75rem 1rem",
                              borderRadius: "12px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "0.625rem",
                                color: "#94a3b8",
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
                          border: "2px dashed #e2e8f0",
                          borderRadius: "24px",
                          padding: "4rem 2rem",
                          textAlign: "center",
                          background: "#f8fafc",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            padding: "1rem",
                            background: "#fff",
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
                            color: "#94a3b8",
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
                          background: "#f8fafc",
                          borderRadius: "20px",
                          border: "1px solid #e2e8f0",
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
                              color: "#1e293b",
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
                          {(
                            getCurrentProtocols(bulkProject).find(
                              (p) => p.id === exploringProtocolId,
                            )?.fields || []
                          ).map((f) => (
                            <span
                              key={f.slug}
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                background: "white",
                                color: "#6366f1",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "8px",
                                border: "1px solid #e0e7ff",
                              }}
                            >
                              {f.slug}
                            </span>
                          ))}
                        </div>
                        <p
                          style={{
                            fontSize: "0.675rem",
                            color: "#94a3b8",
                            fontWeight: 600,
                            marginTop: "1rem",
                            fontStyle: "italic",
                          }}
                        >
                          Note: Case-sensitive headers are mandatory in this
                          exact sequence for clinical integration.
                        </p>
                      </div>

                      <div
                        style={{
                          marginTop: "1.5rem",
                          padding: "1.25rem",
                          background: "#fff",
                          borderRadius: "18px",
                          border: "1.5px solid #eef2ff",
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
                             background: bulkMode === "INCREMENT" ? "rgba(16, 185, 129, 0.1)" : "rgba(99, 102, 241, 0.1)",
                             display: "flex",
                             alignItems: "center",
                             justifyContent: "center",
                             transition: "all 0.3s"
                           }}>
                              {bulkMode === "INCREMENT" ? <Plus size={22} color="#10b981" /> : <RotateCcw size={20} color="#6366f1" />}
                           </div>
                           <div>
                              <p style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                 {bulkMode === "INCREMENT" ? "Add to Existing Stock" : "Overwrite Current Data"}
                              </p>
                              <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, margin: 0 }}>
                                 {bulkMode === "INCREMENT" ? "Increments quantity for existing medicine codes" : "Replaces all data fields for existing codes"}
                              </p>
                           </div>
                        </div>
                        <div style={{ 
                          width: "52px", 
                          height: "28px", 
                          background: bulkMode === "INCREMENT" ? "#10b981" : "#cbd5e1",
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

                      {bulkMode === "INCREMENT" && (
                        <div style={{
                          marginTop: "1.25rem",
                          padding: "1rem",
                          background: "#fffbeb",
                          borderRadius: "14px",
                          border: "1px solid #fde68a",
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "flex-start"
                        }}>
                          <AlertCircle size={18} color="#b45309" style={{ marginTop: "2px" }} />
                          <div>
                            <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#92400e", margin: "0 0 2px 0" }}>Caution: Refill Mode Active</p>
                            <p style={{ fontSize: "0.675rem", fontWeight: 600, color: "#b45309", margin: 0, opacity: 0.9 }}>
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
                            background:
                              "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                          }}
                        >
                          Process Import
                        </button>
                      </div>
                    </>
                  ) : bulkStatus.isUploading ? (
                    <div style={{ textAlign: "center", padding: "4rem 0" }}>
                      <div
                        className="spinner"
                        style={{
                          width: "48px",
                          height: "48px",
                          border: "4px solid #f3f3f3",
                          borderTop: "4px solid #6366f1",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          margin: "0 auto 2rem auto",
                        }}
                      ></div>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 900 }}>
                        Processing Batch Payload...
                      </h3>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          color: "#64748b",
                          fontWeight: 600,
                          marginTop: "0.5rem",
                        }}
                      >
                        Uploaded {bulkStatus.current} of {bulkStatus.total}{" "}
                        records
                      </p>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: "300px",
                          height: "6px",
                          background: "#f1f5f9",
                          borderRadius: "10px",
                          margin: "2rem auto 0 auto",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(bulkStatus.current / bulkStatus.total) * 100}%`,
                            height: "100%",
                            background: "#6366f1",
                            transition: "width 0.3s ease",
                          }}
                        ></div>
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
                              color: "#1e293b",
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

      {confirmModal.isOpen && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 1200000,
            padding: "100px 1rem",
          }}
        >
          <div
            className="fade-in card"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "2rem",
              borderRadius: "24px",
              textAlign: "center",
            }}
          >
            <Trash2
              size={24}
              color="#ef4444"
              style={{ margin: "0 auto 1.5rem auto" }}
            />
            <h3 style={{ fontWeight: 800 }}>{confirmModal.title}</h3>
            <p style={{ color: "#64748b", margin: "1rem 0 2rem 0" }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() =>
                  setConfirmModal({ ...confirmModal, isOpen: false })
                }
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: "#ef4444",
                  borderColor: "#ef4444",
                }}
                onClick={confirmModal.onConfirm}
              >
                Delete
              </button>
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
                            color: "#1e293b",
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
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100000 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "450px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.6rem', background: 'linear-gradient(135deg, #6366f1 0%, #44403c 100%)', borderRadius: '12px' }}>
                     <Radio size={20} color="white" />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>{isEditingMachine ? 'Edit Station' : 'Register Station'}</h2>
               </div>
               <button onClick={() => setShowMachineModal(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                   style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onClick={() => setMachineForm({ ...machineForm, is_active: !machineForm.is_active })}
                >
                   <input type="checkbox" id="m-active" style={{ width: '1.25rem', height: '1.25rem', margin: 0, cursor: 'pointer', pointerEvents: 'none' }} checked={machineForm.is_active} readOnly />
                   <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#334155', margin: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Active Registry Station</label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px', background: '#1e293b' }}>
                {isEditingMachine ? 'Update Station Profile' : 'Register in Bridge Hub'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showLabTestModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100000 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <div style={{ padding: '0.6rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '12px' }}>
                    <Activity size={20} color="white" />
                 </div>
                 <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>{isEditingLabTest ? 'Edit Lab Test' : 'Lab Test Master'}</h2>
              </div>
              <button onClick={() => { setShowLabTestModal(false); resetLabForm(); }} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                   style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onClick={() => setLabTestForm({ ...labTestForm, is_active: !labTestForm.is_active })}
                >
                   <input type="checkbox" id="lab-active" style={{ width: '1.25rem', height: '1.25rem', margin: 0, cursor: 'pointer', pointerEvents: 'none' }} checked={labTestForm.is_active} readOnly />
                   <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#334155', margin: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Active Registry Entry</label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', height: '52px', borderRadius: '16px', background: isEditingLabTest ? '#2563eb' : 'var(--primary)' }}>{isEditingLabTest ? 'Update Test Master' : 'Save Test Master'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showDeptModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1110000 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>New Department</h2>
              <button onClick={() => setShowDeptModal(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1110000 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", border: "1px solid var(--border)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>New Test Type</h2>
              <button onClick={() => setShowTestTypeModal(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1111000 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "600px" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{isEditingSubTest ? 'Edit Component' : 'Sub Test Definition'}</h2>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>For: {currentLabTest?.name}</div>
              </div>
              <X onClick={() => { setShowSubTestModal(false); resetSubTestForm(); }} cursor="pointer" />
            </div>
            <form onSubmit={handleSubTestSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Sub Test Name (Required)</label>
                  <input type="text" className="form-control" required placeholder="Enter" value={subTestForm.name} onChange={e => setSubTestForm({ ...subTestForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Sub Test Code (Required)</label>
                  <input type="text" className="form-control" required placeholder="Enter" value={subTestForm.code} onChange={e => setSubTestForm({ ...subTestForm, code: e.target.value })} />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Value Type (Required)</label>
                  <select className="form-control" value={subTestForm.value_type} onChange={e => setSubTestForm({ ...subTestForm, value_type: e.target.value })}>
                    <option value="INPUT">Input</option>
                    <option value="DROPDOWN">Dropdown</option>
                    <option value="DESCRIPTIVE">Descriptive</option>
                  </select>
                </div>

                {subTestForm.value_type === "INPUT" && (
                   <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Input Data Type (Required)</label>
                      <select className="form-control" value={subTestForm.input_data_type} onChange={e => setSubTestForm({ ...subTestForm, input_data_type: e.target.value })}>
                        <option value="text">text</option>
                        <option value="number">number</option>
                      </select>
                   </div>
                )}

                {subTestForm.value_type === "INPUT" && subTestForm.input_data_type === "text" && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Min Chars Length (Required)</label>
                      <input type="number" className="form-control" placeholder="Enter" value={subTestForm.min_chars} onChange={e => setSubTestForm({ ...subTestForm, min_chars: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Max chars Length</label>
                      <input type="number" className="form-control" placeholder="Enter" value={subTestForm.max_chars} onChange={e => setSubTestForm({ ...subTestForm, max_chars: e.target.value })} />
                    </div>
                  </>
                )}

                {subTestForm.value_type === "DROPDOWN" && (
                  <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Dropdown Values (comma-separated)</label>
                    <input type="text" className="form-control" placeholder="e.g. Positive, Negative" value={subTestForm.dropdown_options} onChange={e => setSubTestForm({ ...subTestForm, dropdown_options: e.target.value })} />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Units (Required)</label>
                  <input type="text" className="form-control" placeholder="e.g. mg/dL" value={subTestForm.units} onChange={e => setSubTestForm({ ...subTestForm, units: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Biological Range (Required)</label>
                  <input type="text" className="form-control" placeholder="e.g. 70 - 110" value={subTestForm.biological_range} onChange={e => setSubTestForm({ ...subTestForm, biological_range: e.target.value })} />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>Description</label>
                  <input type="text" className="form-control" placeholder="Optional description" value={subTestForm.description} onChange={e => setSubTestForm({ ...subTestForm, description: e.target.value })} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <input type="checkbox" id="sub-active" checked={subTestForm.is_active} onChange={e => setSubTestForm({ ...subTestForm, is_active: e.target.checked })} />
                   <label htmlFor="sub-active" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569' }}>Active Component</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowSubTestModal(false); resetSubTestForm(); }} className="btn btn-secondary" style={{ width: '120px', height: '48px', borderRadius: '12px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: '120px', height: '48px', borderRadius: '12px', background: isEditingSubTest ? '#2563eb' : '#5d3191' }}>{isEditingSubTest ? 'Update' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1111500 }}>
          <div style={{ background: "white", padding: "2.5rem", borderRadius: "32px", width: "100%", maxWidth: "400px", textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#fef2f2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
               <Trash2 size={40} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>Are you sure?</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .form-control { 
            background: #f8fafc !important; 
            height: 52px !important; 
            border-radius: 16px !important; 
            border: 1.5px solid #e2e8f0 !important; 
            padding: 0 1.25rem !important; 
            width: 100% !important; 
            transition: all 0.2s !important; 
            font-size: 0.9375rem !important;
            font-weight: 600 !important;
            color: #1e293b !important;
        }
        .form-control:focus { 
            background: white !important;
            border-color: #6366f1 !important; 
            outline: none !important; 
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1) !important; 
        }
        label {
            font-size: 0.75rem !important;
            font-weight: 800 !important;
            color: #64748b !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            margin-bottom: 0.5rem !important;
            display: block !important;
        }
        .btn { border-radius: 14px; font-weight: 800; padding: 0.75rem 1.75rem; transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; justify-content: center; border: none; }
        .btn-primary { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(79, 70, 229, 0.3); }
        .btn-secondary { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
        .btn-secondary:hover { background: #e2e8f0; }
        .card { background: white; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>
    </>
  );
};

export default AdminMasters;
