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
  ChevronLeft,
  ChevronRight,
  Pencil
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
    next_step: 'PENDING_PHARMACY',
    lab_investigations: [],
    medications: []
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '1-0-1', duration: '' });
  const [pharmacyInventory, setPharmacyInventory] = useState([]);
  const [totalInventoryCount, setTotalInventoryCount] = useState(0);
  
  const [labMasters, setLabMasters] = useState([]);
  const [registryTypes, setRegistryTypes] = useState([]);
  const [searchLab, setSearchLab] = useState("");
  const [showLabSearch, setShowLabSearch] = useState(false);

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
      if (pid) {
          fetchProjectLabMasters(pid);
          fetchPharmacyInventory(pid);
      }
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
      if (projectId) url += `&project=${projectId}`;
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
        next_step: 'PENDING_PHARMACY',
        lab_investigations: [],
        medications: []
      });
      setSearchLab("");
      setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '' });
      fetchVisitsToSee();
    } catch (err) {
      toast.error("Error saving consultation", { id: loadingToast });
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
                                lab_investigations: [], // Start fresh for new investigations
                                medications: v.prescriptions?.map(p => ({
                                    name: p.medication_name,
                                    dosage: p.dosage,
                                    frequency: p.frequency,
                                    duration: p.duration
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
            
            {/* Pagination remains same... */}
          
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
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="card fade-in" style={{ border: '1px solid var(--primary)', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
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
                 <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Status</p>
                    <span style={{ fontSize: '0.6875rem', background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800, width: 'fit-content', marginLeft: 'auto' }}>EXAMINING</span>
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
                  <div className="form-group">
                    <label>Treatment / Plan</label>
                    <textarea rows="3" required value={consultData.plan} onChange={e => setConsultData({...consultData, plan: e.target.value})} placeholder="Instructions, follow-up, lifestyle changes..."></textarea>
                  </div>
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
                        Inventory: {totalInventoryCount} Drugs Available
                      </span>
                    </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
                          <option value="OD">OD</option>
                          <option value="BD">BD</option>
                          <option value="TDS">TDS</option>
                       </select>
                       <input placeholder="Days" type="number" value={newMed.duration} onChange={e => setNewMed({...newMed, duration: e.target.value})} style={{ background: 'var(--surface)', height: '36px', fontSize: '0.75rem' }} />
                       <button type="button" onClick={() => {
                          if (!newMed.name || !newMed.duration) {
                              toast.error("Please provide both Drug Name and Number of Days");
                              return;
                          }
                          setConsultData({...consultData, medications: [...consultData.medications, newMed]});
                          setNewMed({ name: '', dosage: '', frequency: '1-0-1', duration: '' });
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
                                        <div>
                                            <p style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{m.name}</p>
                                            <p style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>{m.dosage} • {m.frequency} • {m.duration} Days ({getDoseCount(m.frequency, m.duration)} units)</p>
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

               <div style={{ background: '#f1f5f9', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <AlertCircle size={14} /> Select Next Workflow Action
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
                                         const alreadyAdded = consultData.lab_investigations.some(i => i.id === l.id);
                                         const alreadyRequested = (selectedVisit?.lab_requests || []).some(r => r.test_master === l.id);
                                         return l.name.toLowerCase().includes(query) && !alreadyAdded && !alreadyRequested;
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
                                         const added = consultData.lab_investigations.some(i => i.id === l.id);
                                         const done = (selectedVisit?.lab_requests || []).some(r => r.test_master === l.id);
                                         return l.name.toLowerCase().includes(q) && !added && !done;
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
        textarea { border-radius: 12px !important; padding: 0.75rem !important; }
      `}</style>
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
