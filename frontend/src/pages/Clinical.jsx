import React, { useState, useEffect } from 'react';
import api from '../services/api';
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
  Pencil,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const Clinical = () => {
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

  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '1-0-1', duration: '', timing: 'After Food' });
  const [pharmacyInventory, setPharmacyInventory] = useState([]);
  const [totalInventoryCount, setTotalInventoryCount] = useState(0);
  
  const [labMasters, setLabMasters] = useState([]);
  const [registryTypes, setRegistryTypes] = useState([]);
  const [searchLab, setSearchLab] = useState("");
  const [showLabSearch, setShowLabSearch] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [patientHistory, setPatientHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [detailedVisit, setDetailedVisit] = useState(null);

  useEffect(() => {
    fetchVisitsToSee();
    fetchRegistryTypes();
  }, []);

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
      let url = `patients/registry-data/?registry_type=${slug}&page_size=1000`;
      if (projectId && slug !== 'pharmacy-drugs') url += `&project=${projectId}`;
      const res = await api.get(url);
      const data = res.data.results || res.data;
      setPharmacyInventory(Array.isArray(data) ? data : []);
      setTotalInventoryCount(res.data.count || (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error("Pharmacy link offline:", err);
    }
  };

  const getDoseCount = (freq, dur) => {
    if (!freq || !dur) return 0;
    let perDay = 0;
    if (freq.includes('-')) {
        perDay = freq.split('-').reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else {
        const map = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 };
        perDay = map[freq] || 1;
    }
    return perDay * (parseInt(dur) || 0);
  };

  useEffect(() => {
    fetchVisitsToSee();
  }, []);

  const fetchVisitsToSee = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      // Fetch only visits that need consultation
      const res = await api.get(`clinical/visits/?status=PENDING_CONSULTATION,FINAL_CONSULTATION&page=${pageNum}`);
      if (res.data.results) {
          setVisitsReady(res.data.results);
          setTotalCount(res.data.count);
      } else {
          setVisitsReady(res.data);
          setTotalCount(res.data.length);
      }
      setPage(pageNum);
    } catch (err) {
      toast.error("Failed to fetch doctor's queue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsultation = async (e) => {
    e.preventDefault();
    
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
        finalConsultData.medications = [...consultData.medications, newMed];
    }

    // Validation
    if (finalConsultData.next_step === 'PENDING_PHARMACY' && finalConsultData.medications.length === 0) {
        toast.error("Please add at least one medication for Pharmacy transfer.");
        return;
    }

    const loadingToast = toast.loading('Finalizing consultation...');
    try {
      await api.post(`clinical/visits/${selectedVisit.id}/record_consultation/`, finalConsultData);
      toast.success(`Patient moved to ${finalConsultData.next_step.replace('PENDING_', '')}`, { id: loadingToast });
      setSelectedVisit(null);
      setConsultData({
        chief_complaint: '', 
        diagnosis: '', 
        plan: '',
        next_step: '',
        lab_investigations: [],
        medications: []
      });
      setSearchLab("");
      setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '', timing: 'After Food' });
      fetchVisitsToSee();
    } catch (err) {
      toast.error("Error saving consultation", { id: loadingToast });
    }
  };

  const fetchHistory = async () => {
    if (!selectedVisit?.patient) return;
    setIsLoadingHistory(true);
    setShowHistory(true);
    try {
      // Scale Optimization: Only fetch last 5 completed encounters to prevent memory bloat
      const res = await api.get(`clinical/visits/?patient=${selectedVisit.patient}&status=COMPLETED&page_size=5`);
      setPatientHistory(res.data.results || res.data || []);
    } catch (err) {
      toast.error("Cloud link slow, retrying...");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Consult Desk</h1>
        <p style={{ color: 'var(--text-muted)' }}>Professional clinical assessment and treatment planning</p>
      </header>

      <div style={{ gap: '2rem', alignItems: 'start' }}>
        {/* Waiting Patients - Only show if NO patient is selected */}
        {!selectedVisit && (
          <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Consultation Queue ({totalCount})</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Patients waiting for examination</p>
               </div>
               <button onClick={() => fetchVisitsToSee()} style={{ border: 'none', background: '#f1f5f9', padding: '0.625rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="#6366f1" />
               </button>
            </div>
            
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                     <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Name</th>
                     <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</th>
                     <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vitals Status</th>
                     <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visitsReady.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.2s ease' }}>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '42px', height: '42px', background: '#eff6ff', color: '#2563eb', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.1)' }}>
                               {v.patient_details?.first_name[0].toLowerCase()}
                            </div>
                            <div>
                               <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>{v.patient_details?.first_name} {v.patient_details?.last_name}</p>
                               <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ID: {v.patient_details?.patient_id}</p>
                            </div>
                         </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>{v.reason?.substring(0, 30)}</td>
                      <td style={{ padding: '1rem' }}>
                         <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontSize: '0.6875rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: '8px' }}>Captured</span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <button 
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
                                    dosage: p.dosage,
                                    frequency: p.frequency,
                                    duration: p.duration,
                                    timing: p.timing || 'After Food'
                                })) || []
                              });
                            }} 
                            style={{ 
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              color: 'white',
                              border: 'none',
                              padding: '0.625rem 1.5rem',
                              borderRadius: '12px',
                              fontSize: '0.8125rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                             Examine <Stethoscope size={16} />
                          </button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && visitsReady.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                         <CheckCircle size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                         <p style={{ fontWeight: 600 }}>No patients waiting for consultation.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalCount > 10 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #f1f5f9', background: 'var(--background)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Page {page} of {Math.ceil(totalCount / 10)}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                          className="btn btn-secondary" disabled={page === 1} onClick={() => fetchVisitsToSee(page - 1)}
                          style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                      >
                          <ChevronLeft size={16} />
                      </button>
                      <button 
                          className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchVisitsToSee(page + 1)}
                          style={{ padding: '0.25rem 0.5rem', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                      >
                          <ChevronRight size={16} />
                      </button>
                  </div>
              </div>
            )}
          </div>
        )}

        {/* Examination & Plan - Only show if a patient is selected */}
        {selectedVisit && (
        <div className="workspace-split" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* TOP: HISTORICAL REFERENCE PANEL (Unified MNC View) */}
          {detailedVisit && (
            <div className="reference-panel">
                <div className="reference-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="dossier-icon-box">
                            <ClipboardList size={20} color="white" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 className="dossier-title">Historical Reference Summary</h2>
                                <span className="dossier-badge">Date: {new Date(detailedVisit.visit_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setDetailedVisit(null)} className="dossier-close">
                       <X size={18} />
                    </button>
                </div>
                <div className="reference-content">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1.5rem' }}>
                         {/* Snapshot */}
                         <div className="snapshot-list">
                            {[
                                { label: 'Weight', value: `${detailedVisit.vitals?.weight_kg || '--'} kg` },
                                { label: 'BP', value: `${detailedVisit.vitals?.blood_pressure_sys || '--'}/${detailedVisit.vitals?.blood_pressure_dia || '--'}` },
                                { label: 'HR', value: `${detailedVisit.heart_rate || '--'} BPM` },
                                { label: 'Temp', value: `${detailedVisit.vitals?.temperature_c || '--'} °C` },
                                { label: 'BMI', value: `${detailedVisit.vitals?.bmi || '--'}` }
                            ].map((item, id) => (
                                <div key={id} className="snapshot-item" style={{ padding: '0.625rem 0.875rem' }}>
                                    <span className="item-label" style={{ fontSize: '0.6rem' }}>{item.label}</span>
                                    <span className="item-value" style={{ fontSize: '0.7rem' }}>{item.value}</span>
                                </div>
                            ))}
                         </div>
                         {/* Details */}
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="diagnosis-box" style={{ padding: '0.75rem' }}>
                                <p className="section-label-alt" style={{ fontSize: '0.55rem' }}>PAST IMPRESSION</p>
                                <p className="diagnosis-text" style={{ fontSize: '0.8rem' }}>{detailedVisit.consultation?.diagnosis || 'N/A'}</p>
                            </div>
                            <div style={{ background: 'white', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '100px', overflowY: 'auto' }}>
                                <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#6366f1', marginBottom: '4px' }}>PAST MEDS</p>
                                {detailedVisit.prescriptions?.map((m, i) => (
                                    <p key={i} style={{ fontSize: '0.7rem', fontWeight: 700 }}>• {m.medication_name}</p>
                                ))}
                            </div>
                         </div>
                         {/* Labs */}
                         <div style={{ background: 'white', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto' }}>
                             <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#10b981', marginBottom: '8px' }}>HISTORICAL LABS</p>
                             {detailedVisit.lab_requests?.map((lr, i) => (
                                 <div key={i} style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                     <p style={{ fontSize: '0.75rem', fontWeight: 950, color: '#1e293b', marginBottom: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>{lr.test_name}</p>
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                         {lr.test_master_details?.sub_tests?.map(st => {
                                             const val = lr.result?.values?.[st.name];
                                             return (
                                                 <div key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                         <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569' }}>{st.name}</span>
                                                         <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0f172a' }}>{val || '--'} {st.units}</span>
                                                     </div>
                                                     {st.biological_range && (
                                                         <span style={{ fontSize: '0.55rem', color: '#94a3b8', fontStyle: 'italic' }}>Range: {st.biological_range}</span>
                                                     )}
                                                 </div>
                                             );
                                         })}
                                         {!lr.test_master_details?.sub_tests?.length && lr.result?.value && (
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>{lr.result.value}</span>
                                                  <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{lr.result.reference_range}</span>
                                              </div>
                                         )}
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
            </div>
          )}

          <div className="active-consult-panel card fade-in" style={{ border: '1px solid var(--primary)', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.5rem' }}>
                 <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                       <Stethoscope size={24} color="white" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Clinical Assessment</h2>
                      <p style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}> ID: {selectedVisit.patient_details?.patient_id} | {selectedVisit.patient_details?.first_name} {selectedVisit.patient_details?.last_name}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedVisit(null)} style={{ border: 'none', background: '#f1f5f9', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#64748b' }}>
                    <X size={20} />
                 </button>
              </div>
              
              {/* Patient Profile Summary */}
              <div style={{ background: 'var(--background)', margin: '0 0.5rem 2rem 0.5rem', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', gap: '3rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender / Age</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)' }}>{selectedVisit.patient_details?.gender || 'N/A'} / {selectedVisit.patient_details?.age || '28'}y</p>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Number</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>+91 {selectedVisit.patient_details?.phone ? selectedVisit.patient_details.phone.replace(/(\d{6})(\d{4})/, '$1XXXX') : 'N/A'}</p>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registry / Reason</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedVisit.reason?.substring(0, 30) || 'Routine'}</p>
                 </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
                     {selectedVisit?.patient_details?.total_visits > 1 && (
                        <button 
                           type="button"
                           onClick={fetchHistory}
                           style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                           <History size={13} /> VIEW HISTORY
                        </button>
                     )}
                     <span style={{ fontSize: '0.6875rem', background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800, width: 'fit-content' }}>EXAMINING</span>
                  </div>
              </div>

             {/* Clinic History & Lab Results */}
             <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                   {/* Vitals Summary */}
                   <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <div style={{ gridColumn: 'span 2', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Vitals</p>
                           <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700 }}>Weight: {selectedVisit.vitals?.weight_kg}kg | Height: {selectedVisit.vitals?.height_cm}cm</span>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Temp / Heart</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800 }}>{selectedVisit.vitals?.temperature_c}°C / {selectedVisit.vitals?.heart_rate} BPM</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>BP (S/D)</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800 }}>{selectedVisit.vitals?.blood_pressure_sys}/{selectedVisit.vitals?.blood_pressure_dia}</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>SPO2 / RR</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800 }}>{selectedVisit.vitals?.spo2}% / {selectedVisit.vitals?.respiratory_rate}</p>
                       </div>
                       <div>
                           <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>BMI</p>
                           <p style={{ fontSize: '0.875rem', fontWeight: 800 }}>{selectedVisit.vitals?.bmi || '--'}</p>
                       </div>
                   </div>

                   {/* Personal History */}
                   <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Personal History</p>
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
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Family History</p>
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
                   <div style={{ gridColumn: 'span 2', background: '#eff6ff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Known History / Co-morbidities</p>
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
                   <div style={{ gridColumn: 'span 2', background: '#f0fdf4', padding: '1.25rem', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                       <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Systemic Examination (Clinical Notes)</p>
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
                                <div key={lr.id} style={{ padding: '1rem', background: 'var(--surface)', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                        <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a' }}>{lr.test_name}</p>
                                        <span style={{ fontSize: '0.625rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>VERIFIED</span>
                                    </div>
                                    
                                    {lr.test_master_details?.sub_tests?.length > 0 ? (
                                        <div style={{ padding: 0 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: '#f1f5f9' }}>
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
                                                                    {val || '--'} {st.units && <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8' }}>{st.units}</span>}
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
                                                <p style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase' }}>Value</p>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{lr.result?.value}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase' }}>Ref. Range</p>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>{lr.result?.reference_range || '--'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {lr.result?.interpretation && (
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1' }}>
                                            <p style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 800 }}>Interpretation / Analyst Remarks</p>
                                            <p style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.4, fontWeight: 500 }}>{lr.result.interpretation}</p>
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
                  <label><ClipboardList size={14} /> Chief Complaint & History</label>
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
                    <label>Diagnosis</label>
                    <textarea rows="3" required value={consultData.diagnosis} onChange={e => setConsultData({...consultData, diagnosis: e.target.value})} placeholder="Differential or final diagnosis..."></textarea>
                  </div>
                  {consultData.next_step !== 'PENDING_LAB' && (
                     <div className="form-group fade-in">
                       <label>Treatment / Plan</label>
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
                        color: "#4338ca",
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
                      <span style={{ fontSize: "0.625rem", color: "#64748b", background: "white", padding: "2px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        Total Available: {totalInventoryCount} Drug Variations 
                      </span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ position: 'relative' }}>
                        <input 
                          list="drug-inventory"
                          placeholder="Drug Name" 
                          value={newMed.name} 
                          onChange={e => {
                            const val = e.target.value;
                            setNewMed({...newMed, name: val});
                          }} 
                          style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', width: '100%', marginBottom: '4px' }} 
                        />
                        <datalist id="drug-inventory">
                          {pharmacyInventory.map(d => (
                            <option key={d.id} value={d.name}>{d.name} (Stock: {d.quantity})</option>
                          ))}
                        </datalist>
                        
                        {/* Dynamic Stock Indicator */}
                        {newMed.name && (() => {
                            const drug = pharmacyInventory.find(d => d.name.toLowerCase() === newMed.name.toLowerCase());
                            if (!drug) return null;
                            const alreadyAdded = consultData.medications
                                .filter(m => m.name.toLowerCase() === newMed.name.toLowerCase())
                                .reduce((sum, m) => sum + getDoseCount(m.frequency, m.duration), 0);
                            const remaining = drug.quantity - alreadyAdded;
                            const color = remaining > 10 ? '#166534' : remaining > 0 ? '#b45309' : '#ef4444';
                            const bg = remaining > 10 ? '#dcfce7' : remaining > 0 ? '#fef3c7' : '#fee2e2';
                            return (
                                <div style={{ fontSize: '9px', fontWeight: 900, color: color, background: bg, padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                    REMAINING STOCK: {remaining} UNITS
                                </div>
                            );
                        })()}
                      </div>
                       <input placeholder="Dosage" value={newMed.dosage} onChange={e => setNewMed({...newMed, dosage: e.target.value})} style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem' }} />
                       <select 
                          value={newMed.frequency} 
                          onChange={e => setNewMed({...newMed, frequency: e.target.value})} 
                          style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 0.5rem' }}
                       >
                           <option value="1-0-1">1-0-1</option>
                           <option value="1-1-1">1-1-1</option>
                           <option value="1-0-0">1-0-0 (Morning Only)</option>
                           <option value="0-1-0">0-1-0 (Afternoon Only)</option>
                           <option value="0-0-1">0-0-1 (Night Only)</option>
                           <option value="1-1-0">1-1-0 (Morning/Afternoon)</option>
                           <option value="0-1-1">0-1-1 (Afternoon/Night)</option>
                           <option value="OD">OD (Once a day)</option>
                           <option value="BD">BD (Twice a day)</option>
                           <option value="TDS">TDS (Thrice a day)</option>
                           <option value="QID">QID (Four times a day)</option>
                           <option value="HS">HS (At Bedtime)</option>
                           <option value="SOS">SOS (When needed)</option>
                           <option value="STAT">STAT (Immediately)</option>
                       </select>
                       <select 
                           value={newMed.timing} 
                           onChange={e => setNewMed({...newMed, timing: e.target.value})} 
                           style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 0.5rem' }}
                        >
                           <option value="Before Food">Before Food</option>
                           <option value="After Food">After Food</option>
                           <option value="Empty Stomach">Empty Stomach</option>
                        </select>
                       <input placeholder="Days" type="number" value={newMed.duration} onChange={e => setNewMed({...newMed, duration: e.target.value})} style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem' }} />
                       <button type="button" onClick={() => {
                          if (!newMed.name || !newMed.duration) {
                              toast.error("Please provide both Drug Name and Number of Days");
                              return;
                          }
                          setConsultData({...consultData, medications: [...consultData.medications, newMed]});
                          setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '', timing: 'After Food' });
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
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>| {m.frequency} | {m.timing} | {m.duration} days</span>
                                                
                                                <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', padding: '3px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
                                                    Dose: {getDoseCount(m.frequency, m.duration)}
                                                </span>

                                                {(() => {
                                                    const drug = pharmacyInventory.find(d => d.name.toLowerCase() === m.name.toLowerCase());
                                                    if (drug) {
                                                        const isLow = drug.quantity < getDoseCount(m.frequency, m.duration);
                                                        return (
                                                            <span style={{ 
                                                                background: isLow ? '#fef2f2' : '#f0fdf4', 
                                                                color: isLow ? '#ef4444' : '#10b981', 
                                                                padding: '3px 12px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 900, 
                                                                border: `1px solid ${isLow ? '#fee2e2' : '#dcfce7'}`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                {isLow ? 'Low Stock' : 'In Stock'}: {drug.quantity} items
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
                                                setNewMed({ ...m });
                                                const updated = consultData.medications.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, medications: updated});
                                            }}
                                            style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updated = consultData.medications.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, medications: updated});
                                            }}
                                            style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
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

               <div style={{ background: '#f1f5f9', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', border: !consultData.next_step ? '1.5px solid #fed7d7' : '1.5px solid transparent', transition: 'all 0.3s ease' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                     <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} /> Select Next Workflow Action
                     </span>
                     {!consultData.next_step && (
                        <span style={{ fontSize: '0.625rem', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px', fontWeight: 900, animation: 'pulse 2s infinite' }}>REQUIRED</span>
                     )}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: consultData.next_step === 'PENDING_LAB' ? '1rem' : '0' }}>
                     <button 
                       type="button" 
                       onClick={() => setConsultData({...consultData, next_step: 'PENDING_LAB'})}
                       style={{ 
                         padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', background: consultData.next_step === 'PENDING_LAB' ? '#1d4ed8' : 'white', 
                         color: consultData.next_step === 'PENDING_LAB' ? 'white' : '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' 
                       }}
                     >
                       <FlaskConical size={14} /> Request Lab
                     </button>
                     <button 
                        type="button" 
                        onClick={() => setConsultData({...consultData, next_step: 'PENDING_PHARMACY'})}
                        style={{ 
                          padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', background: consultData.next_step === 'PENDING_PHARMACY' ? '#1d4ed8' : 'white', 
                          color: consultData.next_step === 'PENDING_PHARMACY' ? 'white' : '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' 
                        }}
                      >
                        <Pill size={14} /> Pharmacy ({consultData.medications.length})
                      </button>
                     <button 
                       type="button" 
                       onClick={() => setConsultData({...consultData, next_step: 'COMPLETED'})}
                       style={{ 
                         padding: '0.75rem', border: '2px solid transparent', borderRadius: '12px', background: consultData.next_step === 'COMPLETED' ? '#059669' : 'white', 
                         color: consultData.next_step === 'COMPLETED' ? 'white' : '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' 
                       }}
                     >
                       <CheckCircle size={14} /> Discharge
                     </button>
                  </div>

                  {consultData.next_step === 'PENDING_LAB' && (
                    <div className="fade-in" style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribe Investigations (Project Masters)</label>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>{labMasters.length} Tests Available</span>
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
                                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width: '100%', maxHeight: '300px', overflowY: 'auto', background: 'white', border: '1px solid #e0e7ff', borderRadius: '16px', zIndex: 1000, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '6px' }}>
                                     <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Diagnostic Protocols</div>
                                     {labMasters.filter(l => {
                                         const query = searchLab.toLowerCase();
                                         return l.name.toLowerCase().includes(query);
                                     }).map(l => (
                                        <div key={l.id} 
                                             onMouseDown={(e) => {
                                                // 🎯 onMouseDown fires before onBlur, ensuring the selection is captured
                                                e.preventDefault(); 
                                                setConsultData({
                                                    ...consultData, 
                                                    lab_investigations: [...consultData.lab_investigations, { id: l.id, name: l.name, code: l.code }]
                                                });
                                                setSearchLab("");
                                                setShowLabSearch(false);
                                             }}
                                             className="search-item"
                                             style={{ padding: '12px 15px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                             <div style={{ fontWeight: 800, fontSize: '0.8125rem' }}>{l.name}</div>
                                             <div style={{ fontSize: '0.625rem', padding: '2px 8px', background: '#f1f5f9', borderRadius: '6px', fontWeight: 700, color: '#64748b' }}>{l.code}</div>
                                          </div>
                                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>{l.test_type_name} • {l.department_name}</div>
                                        </div>
                                     ))}
                                     {labMasters.filter(l => {
                                         const q = searchLab.toLowerCase();
                                         return l.name.toLowerCase().includes(q);
                                     }).length === 0 && (
                                        <div style={{ padding: '20px', textAlign: 'center' }}>
                                           <p style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 600 }}>No unticked investigations matching search</p>
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
                                    <div key={`hist-${idx}`} style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
                                        <CheckCircle size={12} color="#10b981" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{req.test_name}</span>
                                        <span style={{ fontSize: '0.55rem', padding: '1px 5px', background: '#e2e8f0', borderRadius: '4px', fontWeight: 900 }}>FIXED</span>
                                    </div>
                                ))}

                                {/* New Additions */}
                                {consultData.lab_investigations.map((inv, idx) => (
                                    <div key={`new-${idx}`} className="fade-in" style={{ background: '#eff6ff', padding: '6px 12px', borderRadius: '10px', border: '1px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)' }}>
                                        <FlaskConical size={12} color="#2563eb" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>{inv.name}</span>
                                        <button 
                                            type="button" 
                                            onMouseDown={(e) => {
                                                e.preventDefault(); 
                                                const updated = consultData.lab_investigations.filter((_, i) => i !== idx);
                                                setConsultData({...consultData, lab_investigations: updated});
                                            }}
                                            style={{ border: 'none', background: 'transparent', padding: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.875rem', fontWeight: 800, borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}>
                     Confirm and Transfer Case <ArrowRight size={16} style={{ marginLeft: '10px' }} />
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
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

      {/* PATIENT HISTORY DRAWER (AUTO-SCALING COMPONENT) */}
      {showHistory && (
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2000 }}>
             <div onClick={() => setShowHistory(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(241, 245, 249, 0.8)', backdropFilter: 'blur(12px)' }} />
             <div className="fade-in-right" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '450px', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 50px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main)' }}>Patient History</h3>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Longitudinal Record for {selectedVisit.patient_details?.first_name}</p>
                   </div>
                   <button onClick={() => setShowHistory(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                   {isLoadingHistory ? (
                       <div style={{ textAlign: 'center', padding: '3rem' }}>
                          <Clock size={40} className="spin" style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                          <p style={{ fontWeight: 600, color: '#94a3b8' }}>Fetching global records...</p>
                       </div>
                   ) : patientHistory.length === 0 ? (
                       <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #f1f5f9', borderRadius: '20px' }}>
                           <p style={{ fontWeight: 700, color: '#94a3b8' }}>No past records found for this patient.</p>
                       </div>
                   ) : (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {patientHistory.map((h, idx) => (
                              <div key={h.id} style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                 <div style={{ position: 'absolute', top: 0, left: '-6px', width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', border: '2px solid white' }} />
                                 <div className="card" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                       <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#6366f1' }}>{new Date(h.visit_date).toLocaleDateString()}</span>
                                       <span style={{ fontSize: '0.625rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>COMPLETED</span>
                                    </div>
                                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Diagnosis</p>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>{h.consultation?.diagnosis || 'No diagnosis recorded'}</p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                       <div>
                                          <p style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>BP</p>
                                          <p style={{ fontSize: '0.75rem', fontWeight: 800 }}>{h.vitals?.blood_pressure_sys || '--'}/{h.vitals?.blood_pressure_dia || '--'}</p>
                                       </div>
                                       <div>
                                          <p style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>Meds</p>
                                          <p style={{ fontSize: '0.75rem', fontWeight: 800 }}>{h.prescriptions?.length || 0} drugs</p>
                                       </div>
                                    </div>
                                    <button 
                                        onClick={() => { setDetailedVisit(h); setShowHistory(false); }}
                                        style={{ width: '100%', marginTop: '1rem', background: 'white', border: '1.2px solid #e2e8f0', borderRadius: '12px', padding: '0.625rem', fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s' }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                    >
                                        <FileText size={14} /> VIEW FULL SUMMARY
                                    </button>
                                 </div>
                              </div>
                          ))}
                       </div>
                   )}
                </div>
                
                <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Limited to last 5 encounters for system performance.</p>
                </div>
              </div>
           </div>
       )}
    </div>
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
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8' }}>{label}:</span>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: isPositive ? (color || '#ef4444') : '#10b981' }}>{displayValue}</span>
        </div>
    );
};

const ExamItem = ({ label, value }) => {
    const isAbnormal = value === 'FND';
    return (
        <div style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <p style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: isAbnormal ? '#dc2626' : '#059669' }}>{value || '--'}</p>
        </div>
    );
};

export default Clinical;
