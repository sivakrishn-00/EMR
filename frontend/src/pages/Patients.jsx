import React, { useState, useEffect } from 'react';
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
  Info,
  Activity,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight, 
  ShieldCheck,
  Loader2
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
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackAppointment, setAckAppointment] = useState(null);
  const [ackForm, setAckForm] = useState({ date: '', startTime: '', endTime: '' });
  const [isAcking, setIsAcking] = useState(false);
  const [isEnablingPortal, setIsEnablingPortal] = useState(null);

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
        setTabCounts({
            active: res.data.active_count || 0,
            scheduled: res.data.scheduled_count || 0,
            completed: res.data.completed_count || 0,
            all: res.data.total_registered || 0
        });
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

  const handleInstantTriageSubmit = async (e) => {
    e.preventDefault();
    if (!triagePatient) return;

    const loadingToast = toast.loading('Initiating instant triage...');
    try {
      await api.post('clinical/visits/', {
        patient: triagePatient.id,
        reason: triageReason || 'OPD Consultation',
        status: 'PENDING_VITALS'
      });
      toast.success('Patient moved to Triage/Vitals queue!', { id: loadingToast });
      setShowTriageModal(false);
      setTriagePatient(null);
      setTriageReason('Routine Checkup');
      fetchPatients(1, viewMode, projectFilter);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start visit', { id: loadingToast });
    }
  };

  const handleEnablePortal = async (patientId) => {
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

  const downloadMasterReport = async (patient) => {
    const loading = toast.loading(`clinical report for ${patient.first_name}...`);
    try {
      if (!window.html2pdf) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      const res = await api.get(`patients/patients/${patient.id}/full_report/`);
      const { visits, patient: patientData } = res.data;
      const institutionName = (patientData.project_name || "Bavya Health Service").toUpperCase();
      const themeColor = "#0d9488"; // Premium Aqua Deep Teal

      const element = document.createElement('div');
      
      const renderV = (v) => {
          if (!v) return '<span style="color: #94a3b8;">--</span>';
          const upper = v.toString().toUpperCase();
          // ORANGE FOR POSITIVE INDICATORS
          const color = (upper === 'YES' || upper === 'FND' || upper === 'POSITIVE') ? '#f97316' : (upper === 'NO' || upper === 'NAD' || upper === 'NEGATIVE' ? '#059669' : '#1e1b4b');
          return `<span style="color: ${color}; font-weight: 950;">${upper}</span>`;
      };

      const renderHistoryItem = (label, value, labelWidth = "120px") => `
        <div style="display: flex; align-items: flex-start; margin-bottom: 8px; font-size: 11.5px;">
            <span style="width: ${labelWidth}; color: #64748b; font-weight: 900; text-transform: uppercase; font-size: 10px;">${label}</span>
            <span style="width: 20px; color: ${themeColor}; font-weight: 900; text-align: center;">:</span>
            <span style="flex: 1; color: #000; font-weight: 800;">${value}</span>
        </div>
      `;

      element.innerHTML = `
        <div style="background: #fff; padding: 0px 45px 30px 45px; font-family: 'Inter', sans-serif; color: #1e1b4b; width: 720px; box-sizing: border-box;">
            
            <!-- MASTER BRANDING -->
            <div style="text-align: center; margin-bottom: 35px;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; text-transform: uppercase; color: #191731ff; letter-spacing: -1.5px;">${institutionName}</h1>
              <div style="font-size: 13px; font-weight: 950; letter-spacing: 5px; color: #64748b; text-transform: uppercase; margin-top: 6px;">Patient Clinical Report</div>
              <div style="border-bottom: 3.5px solid ${themeColor}; width: 400px; margin: 15px auto;"></div>
            </div>

            <!-- I. PATIENT DETAILS -->
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <div style="background: ${themeColor}; color: #fff; padding: 7px 15px; font-size: 11.5px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px;">PATIENT DETAILS</div>
              <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; padding: 0 10px;">
                <div>
                  ${renderHistoryItem('Patient Name', `${patientData.first_name} ${patientData.last_name}`, "100px")}
                  ${renderHistoryItem('Age / Gender', `${new Date().getFullYear() - new Date(patientData.dob).getFullYear()}Y / ${patientData.gender}`, "100px")}
                </div>
                <div>
                  ${renderHistoryItem('Patient ID', patientData.patient_id, "90px")}
                  ${renderHistoryItem('Aadhar No', patientData.id_proof_number || '--', "90px")}
                </div>
              </div>
            </div>

            ${visits.map((v, vidx) => `
              <div style="${vidx > 0 ? 'page-break-before: always; padding-top: 0px;' : ''}">
                
                <div style="display: flex; justify-content: space-between; background: ${themeColor}; color: #fff; padding: 6px 15px; margin-bottom: 18px; border-radius: 2px;">
                  <span style="font-size: 13px; font-weight: 950;">DATE: ${new Date(v.visit_date).toLocaleDateString()}</span>
                  <span style="font-size: 10px; font-weight: 900; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">STATUS: VERIFIED</span>
                </div>

                <!-- VITALS BAR -->
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); background: #f0f9f9; border: 2px solid ${themeColor}; padding: 12px; margin-bottom: 30px; text-align: center; page-break-inside: avoid;">
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">BP</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.blood_pressure_sys}/${v.vitals?.blood_pressure_dia}</span></div>
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">HR</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.heart_rate || '--'}</span></div>
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">SPO2</div><span style="font-size: 14px; font-weight: 950; color: #dc2626;">${v.vitals?.spo2}%</span></div>
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">TEMP</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.temperature_c || '--'}°</span></div>
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">RR</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.respiratory_rate || '--'}</span></div>
                    <div style="border-right: 1px solid #99f6e4;"><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">WT</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.weight_kg || '--'}</span></div>
                    <div><div style="font-size: 8px; font-weight: 950; color: ${themeColor};">BMI</div><span style="font-size: 14px; font-weight: 950;">${v.vitals?.bmi || '--'}</span></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 0 10px; margin-bottom: 25px; page-break-inside: avoid;">
                    <div>
                        <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px;">PERSONAL HISTORY</div>
                        ${renderHistoryItem('Smoking Status', v.vitals?.smoking)}
                        ${renderHistoryItem('Alcohol Usage', v.vitals?.alcohol)}
                        ${renderHistoryItem('Physical Activity', v.vitals?.physical_activity)}
                        ${renderHistoryItem('Food Habit', ` ${v.vitals?.food_habit || '--'}`)}
                        ${renderHistoryItem('Drug Allergy', v.vitals?.allergy_drug)}
                    </div>
                    <div>
                        <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px;"> FAMILY HISTORY</div>
                        ${renderHistoryItem('Diabetes Mellitus', v.vitals?.family_dm)}
                        ${renderHistoryItem('Hypertension', v.vitals?.family_htn)}
                        ${renderHistoryItem('Oncology History', v.vitals?.family_cancer)}
                        ${renderHistoryItem('CVS Condition', v.vitals?.family_cvs)}
                        ${renderHistoryItem('Thyroid Hist', v.vitals?.family_thyroid)}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 0 10px; margin-bottom: 25px; page-break-inside: avoid;">
                    <div>
                        <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px;">SYSTEMIC EXAMINATION</div>
                        ${renderHistoryItem('Respiratory', v.vitals?.sys_respiratory)}
                        ${renderHistoryItem('CVS System', v.vitals?.sys_cvs)}
                        ${renderHistoryItem('CNS Function', v.vitals?.sys_cns)}
                        ${renderHistoryItem('GIS Status', v.vitals?.sys_gis)}
                        ${renderHistoryItem('MSS Integrity', v.vitals?.sys_mss)}
                    </div>
                    <div>
                        <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px;">KNOWN HISTORY</div>
                        ${renderHistoryItem('Known DM Status', v.vitals?.known_dm)}
                        ${renderHistoryItem('Known HTN Status', v.vitals?.known_htn)}
                        ${renderHistoryItem('Known Oncology', v.vitals?.known_cancer)}
                        ${renderHistoryItem('Known CVS Status', v.vitals?.known_cvs)}
                        ${renderHistoryItem('Thyroid / TB', v.vitals?.known_thyroid)}
                    </div>
                </div>

                <!-- VI. LAB DATA -->
                ${v.lab_requests?.length > 0 ? `
                <div style="margin-bottom: 25px; padding: 0 10px; page-break-inside: avoid;">
                  <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 12px;">LABORATORY DATA</div>
                  <div style="border: 2px solid ${themeColor}; border-radius: 4px; overflow: hidden;">
                    ${v.lab_requests.map(l => `
                        <div style="background: #f0fdfa; border-bottom: 1.5px solid ${themeColor}; padding: 8px 15px; font-weight: 950; font-size: 12.5px; color: ${themeColor};">&raquo; TEST: ${l.test_name}</div>
                        <table style="width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr style="background: #e6faf8;">
                              <th style="padding: 6px 15px; font-size: 9.5px; font-weight: 950; color: ${themeColor}; text-transform: uppercase; text-align: left; border-bottom: 1px solid #99f6e4; width: 40%;">Investigation</th>
                              <th style="padding: 6px 15px; font-size: 9.5px; font-weight: 950; color: ${themeColor}; text-transform: uppercase; text-align: center; border-bottom: 1px solid #99f6e4; width: 25%;">Observed Value</th>
                              <th style="padding: 6px 15px; font-size: 9.5px; font-weight: 950; color: ${themeColor}; text-transform: uppercase; text-align: center; border-bottom: 1px solid #99f6e4; width: 35%;">Biological Ref. Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${(l.test_master_details?.sub_tests || []).map((st, stIdx) => {
                              const observedVal = l.result?.values?.[st.name] || l.result?.values?.[st.code] || '--';
                              const unit = st.units || '';
                              const bioRange = st.biological_range || '--';
                              const rowBg = stIdx % 2 === 0 ? '#ffffff' : '#f8fffe';
                              return `
                              <tr style="background: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 7px 15px; font-size: 11px; font-weight: 800; color: #334155;">${st.name}</td>
                                <td style="padding: 7px 15px; font-size: 11px; text-align: center;">
                                  <b style="color: #0f172a; font-size: 12px;">${observedVal}</b>
                                  ${unit ? `<small style="color: #64748b; font-weight: 900; margin-left: 3px;">${unit}</small>` : ''}
                                </td>
                                <td style="padding: 7px 15px; font-size: 10.5px; text-align: center; color: #059669; font-weight: 800;">${bioRange}${unit && bioRange !== '--' ? ` <span style="color:#94a3b8; font-weight: 700;">${unit}</span>` : ''}</td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                    `).join('')}
                  </div>
                </div>
                ` : ''}

                <!-- VII. MEDICATION -->
                ${v.prescriptions?.length > 0 ? `
                <div style="margin-bottom: 25px; padding: 0 10px; page-break-inside: avoid;">
                  <div style="background: ${themeColor}; color: #fff; padding: 5px 12px; font-size: 10px; font-weight: 950; text-transform: uppercase; margin-bottom: 12px;">DRUGS PRESCRIBED</div>
                  <div style="border: 2px solid ${themeColor}; border-radius: 4px; padding: 8px;">
                      ${v.prescriptions.map((p, pidx) => `
                        <div style="display: flex; gap: 20px; font-size: 12px; padding: 10px; border-bottom: 1px solid #f1f5f9;">
                          <b style="color: #64748b; width: 25px;">${pidx + 1}.</b>
                          <span style="flex: 1;"><b style="color:#1e1b4b; font-size: 13px;">${p.medication_name}</b> &bull; ${p.dosage} [${p.frequency}]</span>
                          <b style="color: #dc2626; width: 85px; text-align: right; font-weight: 950;">${p.duration} DAYS</b>
                        </div>
                      `).join('')}
                  </div>
                </div>
                ` : ''}

                <!-- VIII. ASSESSMENT -->
                <div style="margin-top: 25px; padding: 0; background: #fff; border: 2.5px solid ${themeColor}; border-radius: 4px; page-break-inside: avoid; overflow: hidden;">
                  <div style="background: ${themeColor}; color: #fff; padding: 7px 15px; font-size: 10px; font-weight: 950; text-transform: uppercase;">ASSESSMENT & TREATMENT PLAN</div>
                  <div style="padding: 15px;">
                    <div style="font-size: 15px; font-weight: 950; color: #1e1b4b; margin-bottom: 10px; text-transform: uppercase;">DIAGNOSIS: ${v.consultation?.diagnosis || 'Standard Observation'}</div>
                    <div style="font-size: 12px; color: #475569; line-height: 1.7;">
                      <b style="color: ${themeColor};">CHIEF COMPLAINTS:</b> ${v.consultation?.chief_complaint || v.reason || '--'}<br/>
                      <b style="color: ${themeColor};">OUTLINED TREATMENT:</b> ${v.consultation?.plan || '--'}
                    </div>
                  </div>
                </div>

              </div>
            `).join('')}
        </div>
      `;


      const opt = {
        margin: [0.15, 0.3, 1.2, 0.3], // Ultra-compact top margin for multi-page consistency
        filename: `BavyaRegistry_${patientData.patient_id}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).toPdf().get('pdf').then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            
            // MASTER SOLID 4-SIDED RECTANGLE
            pdf.setLineWidth(0.06); 
            pdf.setDrawColor(themeColor); 
            pdf.rect(0.1, 0.1, pageWidth - 0.2, pageHeight - 0.2, 'S'); 

            // FOOTER - Placed in the 1.2-inch protected margin zone
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(themeColor);
            pdf.text("SYSTEM GENERATED CLINICAL REPORT", pageWidth / 2, pageHeight - 0.8, { align: "center" });
            
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`BAVYA HEALTH SERVICE PVT LTD\u2022 ${institutionName}`, pageWidth / 2, pageHeight - 0.6, { align: "center" });
            pdf.text(`UHID: ${patientData.patient_id} \u2022 Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 0.45, { align: "center" });
        }
      }).save();

      toast.success("Clinical Registry Optimized & Exported!", { id: loading });
    } catch (err) {
      console.error("PDF Export Failure:", err);
      toast.error("Failed to generate clinical registry", { id: loading });
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
        <div className="modal-content" style={{ maxWidth: '500px', borderRadius: '28px', padding: '0', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', padding: '1.5rem 2.5rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: 'white', color: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 8px 12px -3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <ShieldCheck size={24} />
            </div>
            <h2 style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.15rem', color: '#1e293b', letterSpacing: '-0.02em' }}>Slot Allocation</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>Validate and confirm clinical encounter</p>
          </div>

          <form onSubmit={handleAckSubmit} style={{ padding: '1.5rem 2.5rem 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.75rem' }}>

              <div className="form-group">
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.625rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allocation Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required 
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '42px', fontWeight: 600, fontSize: '0.875rem' }}
                  value={ackForm.date}
                  onChange={(e) => setAckForm({ ...ackForm, date: e.target.value })}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Time</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    required 
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '42px', fontWeight: 600, fontSize: '0.875rem' }}
                    value={ackForm.startTime}
                    onChange={(e) => setAckForm({ ...ackForm, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Time</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    required 
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '42px', fontWeight: 600, fontSize: '0.875rem' }}
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
                style={{ padding: '0.75rem', borderRadius: '14px', fontWeight: 800, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', width: '100%', fontSize: '0.875rem' }}
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
      {renderAckModal()}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Patient Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Manage registration and records of all patients</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => fetchPatients(page, viewMode, projectFilter)} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px' }}
          >
            <Clock size={16} className={isLoading ? 'spin-anim' : ''} /> Refresh Queue
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
                                     p.current_visit.status === 'PENDING_VITALS' ? 'In Triage' :
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
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'var(--primary)', borderRadius: '10px' }}
                                    onClick={async () => {
                                        const loading = toast.loading('Initiating Arrived Status...');
                                        try {
                                            if (p.upcoming_appointment?.id) {
                                                await api.post(`clinical/appointments/${p.upcoming_appointment.id}/check_in/`);
                                            } else {
                                                await api.post('clinical/visits/', { patient: p.id, reason: 'Scheduled Visit', status: 'PENDING_VITALS' });
                                            }
                                            toast.success("Patient Arrived & Registered!", { id: loading });
                                            fetchPatients();
                                        } catch (e) { toast.error("Check-in sync failed", { id: loading }); }
                                    }}
                                >
                                    <Check size={12} /> Start Visit
                                </button>
                            )
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#f59e0b', borderColor: '#f59e0b', borderRadius: '10px' }}
                                onClick={() => {
                                    setTriagePatient(p);
                                    setTriageReason('Routine Checkup');
                                    setShowTriageModal(true);
                                }}
                            >
                                <Activity size={12} /> Triage
                            </button>
                        )}
                        {(viewMode === 'ALL' || viewMode === 'COMPLETED') && (
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: '10px' }}
                                onClick={() => downloadMasterReport(p)}
                                title="Download Case Summary PDF"
                            >
                                <Download size={16} color="var(--primary)" />
                            </button>
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
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                    borderRadius: '16px', 
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' 
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
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Engagement</p>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--background)', padding: '4px', borderRadius: '12px' }}>
                        {(!user?.project || (projects.find(p => p.id === user.project)?.category_mappings?.some(m => m.category === 'GENERAL'))) && (
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, is_employee_linked: false})}
                            style={{ 
                                padding: '6px 20px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                background: !formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                color: !formData.is_employee_linked ? 'var(--primary)' : '#64748b',
                                boxShadow: !formData.is_employee_linked ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', transition: '0.3s'
                            }}
                        >General</button>
                        )}
                        {(!user?.project || (projects.find(p => p.id === user.project)?.category_mappings?.some(m => m.category === 'EMPLOYEE' || m.category === 'FAMILY'))) && (
                        <button 
                             type="button"
                             onClick={() => setFormData({...formData, is_employee_linked: true})}
                             style={{ 
                                 padding: '6px 20px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                 background: formData.is_employee_linked ? 'var(--surface)' : 'transparent',
                                 color: formData.is_employee_linked ? 'var(--primary)' : '#64748b',
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
                        <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Link Employee Record</p>
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
                                    <select 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
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
                            {projects.find(p => p.id === user.project)?.name || 'Mapped Project'}
                            <span style={{ fontSize: '0.625rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', marginLeft: 'auto', fontWeight: 900 }}>LOCKED</span>
                        </div>
                    ) : (
                        <select 
                            required 
                            className="form-control"
                            style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
                            value={formData.project} 
                            onChange={e => setFormData({...formData, project: e.target.value})} 
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
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Basic Details</p>
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
                    <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Identity Verification (Primary ID)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}><Fingerprint size={14} /> ID Proof Type *</label>
                            <select 
                                className="form-control"
                                style={{ height: '52px', borderRadius: '16px', background: 'var(--background)' }}
                                value={formData.id_proof_type} onChange={e => setFormData({...formData, id_proof_type: e.target.value})}
                            >
                                <option value="AADHAAR">Aadhaar Card</option>
                                <option value="VOTER_ID">Voter ID</option>
                                <option value="DRIVING_LICENCE">Driving Licence</option>
                                <option value="PASSPORT">Passport</option>
                                <option value="CARD_NO">Card No</option>
                            </select>
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
                  <input 
                    type="date" required 
                    className="form-control"
                    style={{ height: '52px', borderRadius: '16px' }}
                    value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} 
                  />
                  {formAttempted && !formData.dob && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <select 
                    required 
                    className="form-control"
                    style={{ height: '52px', borderRadius: '16px' }}
                    value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="">-- Select --</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {formAttempted && !formData.gender && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                </div>

                {/* Contact Information */}
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Contact & Address</p>
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
                      <select 
                        className="form-control"
                        style={{ height: '52px', borderRadius: '16px' }}
                        value={formData.patient_type} onChange={e => setFormData({...formData, patient_type: e.target.value})}
                      >
                        <option value="OPD">Outpatient (OPD)</option>
                        <option value="IPD">Inpatient (IPD)</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Review">Review</option>
                      </select>
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
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}
                >Complete Registration</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* INSTANT TRIAGE MODAL FOR EXISTING PATIENTS */}
      {showTriageModal && triagePatient && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="fade-in" style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.3)' }}>
                  <Activity size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 950, letterSpacing: '-0.02em', color: '#1e293b' }}>Confirm Triage</h2>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '1rem', borderRadius: '18px', fontWeight: 900, letterSpacing: '0.01em',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)'
                  }}
                >
                  START CLINICAL VISIT
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
