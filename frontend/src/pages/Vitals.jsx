import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  Search, 
  Thermometer, 
  Heart, 
  User, 
  ArrowRight, 
  X, 
  UserCheck, 
  Clock, 
  Wind, 
  Droplet, 
  Clipboard, 
  FileText,
  Scale,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const RANGES = {
  weight_kg: { min: 1, max: 350, label: 'Weight', unit: 'KG' },
  temperature_c: { min: 34, max: 43, label: 'Temp', unit: '°C' },
  heart_rate: { min: 30, max: 220, label: 'Pulse', unit: 'BPM' },
  respiratory_rate: { min: 6, max: 60, label: 'Resp', unit: 'B/M' },
  blood_pressure_sys: { min: 70, max: 220, label: 'SYS', unit: 'mmHg' },
  blood_pressure_dia: { min: 40, max: 130, label: 'DIA', unit: 'mmHg' },
  spo2: { min: 50, max: 100, label: 'SPO2', unit: '%' },
};

const Vitals = () => {
  const { user } = useAuth();
  const [activeVisits, setActiveVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [vitalsData, setVitalsData] = useState({
    temperature_c: '', 
    temp_unit: 'C',
    blood_pressure_sys: '', 
    blood_pressure_dia: '', 
    heart_rate: '', 
    respiratory_rate: '',
    spo2: '',
    weight_kg: '', 
    height_cm: '',
    height_ft: '',
    height_in: '',
    bmi: '',
    symptoms: '',
    notes: '',
    // Personal History
    smoking: 'NO',
    alcohol: 'NO',
    physical_activity: 'NO',
    food_habit: 'VEG',
    allergy_food: 'NO',
    allergy_drug: 'NO',
    // Family History
    family_dm: 'NO',
    family_htn: 'NO',
    family_cancer: 'NO',
    family_cvs: 'NO',
    family_thyroid: 'NO',
    family_tb: 'NO',
    family_others: '',
    // Systemic Examination
    sys_respiratory: 'NAD',
    sys_cvs: 'NAD',
    sys_cns: 'NAD',
    sys_gis: 'NAD',
    sys_mss: 'NAD',
    sys_gus: 'NAD',
    // Known History
    known_dm: 'NO',
    known_htn: 'NO',
    known_cancer: 'NO',
    known_cvs: 'NO',
    known_thyroid: 'NO',
    known_tb: 'NO',
    known_others: ''
  });
  const [formAttempted, setFormAttempted] = useState(false);
  const [projectConfig, setProjectConfig] = useState({ vitals_mandatory: true });

  useEffect(() => {
    fetchActiveVisits();
  }, []);

  useEffect(() => {
    if (user?.project) {
        fetchProjectConfig();
        
        // Re-fetch when tab gets focus (user switched back from Admin tab)
        const onFocus = () => fetchProjectConfig();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }
  }, [user]);

  const fetchProjectConfig = async () => {
    try {
        const res = await api.get(`patients/projects/${user.project}/`);
        setProjectConfig(res.data);
    } catch (err) {
        console.error("Failed to fetch project config");
    }
  };

  const fetchActiveVisits = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get(`clinical/visits/?status=PENDING_VITALS&page=${pageNum}`);
      if (res.data.results) {
          setActiveVisits(res.data.results);
          setTotalCount(res.data.count);
      } else {
          setActiveVisits(res.data);
          setTotalCount(res.data.length);
      }
      setPage(pageNum);
    } catch (err) {
      toast.error("Failed to fetch triage queue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    setFormAttempted(true);
    const loadingToast = toast.loading('Recording vitals...');
    try {
      // Normalize temperature to Celsius for backend storage
      let finalTemp = vitalsData.temperature_c;
      if (vitalsData.temp_unit === 'F' && finalTemp) {
        finalTemp = ((parseFloat(finalTemp) - 32) * 5/9).toFixed(1);
      }

      const cleanedData = Object.fromEntries(
        Object.entries(vitalsData).map(([key, value]) => {
          if (value === '' || value === undefined) return [key, null];
          if (key === 'temperature_c') return [key, isNaN(parseFloat(finalTemp)) ? null : parseFloat(finalTemp)];
          if (['blood_pressure_sys', 'blood_pressure_dia', 'heart_rate', 'respiratory_rate', 'spo2', 'weight_kg', 'height_cm', 'bmi'].includes(key)) {
            const num = Number(value);
            return [key, isNaN(num) ? null : num];
          }
          return [key, value];
        })
      );
      
    if (projectConfig.vitals_mandatory) {
        const mandatoryFields = [
            { key: 'weight_kg', label: 'Weight', min: 0.1, max: 650 },
            { key: 'height_ft', label: 'Height (Ft)', min: 1, max: 8 },
            { key: 'temperature_c', label: 'Temperature', min: 34, max: 43 },
            { key: 'heart_rate', label: 'Pulse', min: 30, max: 220 },
            { key: 'respiratory_rate', label: 'Resp Rate', min: 6, max: 60 },
            { key: 'blood_pressure_sys', label: 'BP (Sys)', min: 70, max: 220 },
            { key: 'blood_pressure_dia', label: 'BP (Dia)', min: 40, max: 130 },
            { key: 'spo2', label: 'SPO2', min: 50, max: 100 }
        ];

        for (const field of mandatoryFields) {
            if (!cleanedData[field.key]) {
                toast.error(`${field.label} is required`, { id: loadingToast });
                setFormAttempted(true);
                return;
            }
            if (cleanedData[field.key] < field.min || cleanedData[field.key] > field.max) {
                toast.error(`${field.label} out of valid range`, { id: loadingToast });
                setFormAttempted(true);
                return;
            }
        }
    } else {
        // If optional, still check range IF value is provided
        const fieldsToCheck = [
            { key: 'weight_kg', min: 0.1, max: 650 },
            { key: 'temperature_c', min: 34, max: 43 },
            { key: 'heart_rate', min: 30, max: 220 },
            { key: 'respiratory_rate', min: 6, max: 60 },
            { key: 'blood_pressure_sys', min: 70, max: 220 },
            { key: 'blood_pressure_dia', min: 40, max: 130 },
            { key: 'spo2', min: 50, max: 100 }
        ];

        for (const field of fieldsToCheck) {
            if (cleanedData[field.key] && (cleanedData[field.key] < field.min || cleanedData[field.key] > field.max)) {
                toast.error(`Invalid ${field.key.replace('_', ' ')} detected`, { id: loadingToast });
                return;
            }
        }
    }

      await api.post(`clinical/visits/${selectedVisit.id}/record_vitals/`, cleanedData);
      toast.success("Vitals captured! Patient moved to consultation.", { id: loadingToast });
      setSelectedVisit(null);
      resetForm();
      setFormAttempted(false);
      fetchActiveVisits();
    } catch (err) {
      toast.error("Validation error. Please check formatting.", { id: loadingToast });
    }
  };

  const resetForm = () => {
    setVitalsData({ 
        temperature_c: '', temp_unit: 'C', blood_pressure_sys: '', blood_pressure_dia: '', 
        heart_rate: '', respiratory_rate: '', spo2: '', 
        weight_kg: '', height_cm: '', height_ft: '', height_in: '', bmi: '', symptoms: '', notes: '',
        smoking: 'NO', alcohol: 'NO', physical_activity: 'NO', food_habit: 'VEG', allergy_food: 'NO', allergy_drug: 'NO',
        family_dm: 'NO', family_htn: 'NO', family_cancer: 'NO', family_cvs: 'NO', family_thyroid: 'NO', family_tb: 'NO', family_others: '',
        sys_respiratory: 'NAD', sys_cvs: 'NAD', sys_cns: 'NAD', sys_gis: 'NAD', sys_mss: 'NAD', sys_gus: 'NAD',
        known_dm: 'NO', known_htn: 'NO', known_cancer: 'NO', known_cvs: 'NO', known_thyroid: 'NO', known_tb: 'NO', known_others: ''
    });
    setFormAttempted(false);
  };

  const updateBiometrics = (updates) => {
    let newData = { ...vitalsData, ...updates };
    
    // Hard limits for typing sanity (Human Scale)
    if (newData.weight_kg > 500) newData.weight_kg = 500;
    if (newData.height_ft > 8) newData.height_ft = 8;
    if (newData.height_in > 11) newData.height_in = 11;

    // Calculate Height in CM
    const ft = parseFloat(newData.height_ft) || 0;
    const inch = parseFloat(newData.height_in) || 0;
    const totalInches = (ft * 12) + inch;
    const heightCm = totalInches > 0 ? (totalInches * 2.54).toFixed(2) : '';
    
    // Calculate BMI
    let bmiValue = '';
    if (newData.weight_kg && heightCm && heightCm > 0) {
      const heightM = heightCm / 100;
      bmiValue = (newData.weight_kg / (heightM * heightM)).toFixed(1);
    }
    
    setVitalsData({
      ...newData,
      height_cm: heightCm,
      bmi: bmiValue
    });
  };

  const blockInvalidChar = (e) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const getBMIStatus = (bmi) => {
    if (!bmi) return { label: 'PENDING', color: '#94a3b8' };
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: 'Underweight', color: '#0ea5e9' };
    if (val < 25) return { label: 'Normal', color: '#10b981' };
    if (val < 30) return { label: 'Overweight', color: '#f59e0b' };
    return { label: 'Obese', color: '#ef4444' };
  };

  const getRangeError = (field, value) => {
    if (!value || isNaN(value)) return null;
    const val = parseFloat(value);
    
    // Temperature Specific Validation
    if (field === 'temperature_c') {
      const unit = vitalsData.temp_unit || 'C';
      const min = unit === 'C' ? 34 : 93.2;
      const max = unit === 'C' ? 43 : 109.4;
      if (val < min || val > max) {
        return `Warning: Unusual Temp range (${min}-${max} °${unit})`;
      }
      return null;
    }

    // BP Logic check: DIA must be < SYS
    if (field === 'blood_pressure_dia' && vitalsData.blood_pressure_sys) {
        if (val >= parseFloat(vitalsData.blood_pressure_sys)) {
            return "Warning: Diastolic must be lower than Systolic";
        }
    }
    const range = RANGES[field];
    if (!range) return null;
    if (val < range.min || val > range.max) {
      return `Warning: Unusual ${range.label} range (${range.min}-${range.max} ${range.unit})`;
    }
    return null;
  };
 
  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Triage & Nursing Station</h1>
        <p style={{ color: 'var(--text-muted)' }}>Initial assessment and vital signs monitoring</p>
      </header>

      <div style={{ gap: '2rem', alignItems: 'start' }}>
        {/* Waiting List - Only show if NO patient is selected */}
        {!selectedVisit && (
          <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Nurse Queue ({activeVisits.length})</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Updated just now</p>
               </div>
               <button onClick={() => fetchActiveVisits()} style={{ border: 'none', background: '#f1f5f9', padding: '0.625rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="#6366f1" />
               </button>
            </div>
            
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                     <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Name</th>
                     <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</th>
                     <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration</th>
                     <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeVisits.map(v => (
                    <tr key={v.id} style={{ background: selectedVisit?.id === v.id ? '#f8fafc' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'all 0.2s ease' }}>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '42px', height: '42px', background: '#f0fdf4', color: '#10b981', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.1)' }}>
                               {v.patient_details?.first_name[0].toLowerCase()}
                            </div>
                            <div>
                               <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>{v.patient_details?.first_name} {v.patient_details?.last_name}</p>
                               <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ID: {v.patient_details?.patient_id}</p>
                            </div>
                         </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>{v.reason || 'Routine Checkup...'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>{new Date(v.visit_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => {
                              setSelectedVisit(v);
                              if (v.vitals) {
                                  setVitalsData({
                                      temperature_c: v.vitals.temperature_c || '',
                                      temp_unit: 'C',
                                      blood_pressure_sys: v.vitals.blood_pressure_sys || '',
                                      blood_pressure_dia: v.vitals.blood_pressure_dia || '',
                                      heart_rate: v.vitals.heart_rate || '',
                                      respiratory_rate: v.vitals.respiratory_rate || '',
                                      spo2: v.vitals.spo2 || '',
                                      weight_kg: v.vitals.weight_kg || '',
                                      height_cm: v.vitals.height_cm || '',
                                      height_ft: v.vitals.height_cm ? Math.floor((v.vitals.height_cm / 2.54) / 12) : '',
                                      height_in: v.vitals.height_cm ? Math.round((v.vitals.height_cm / 2.54) % 12) : '',
                                      bmi: v.vitals.bmi || '',
                                      symptoms: v.vitals.symptoms || '',
                                      notes: v.vitals.notes || '',
                                      smoking: v.vitals.smoking || 'NO',
                                      alcohol: v.vitals.alcohol || 'NO',
                                      physical_activity: v.vitals.physical_activity || 'NO',
                                      food_habit: v.vitals.food_habit || 'VEG',
                                      allergy_food: v.vitals.allergy_food || 'NO',
                                      allergy_drug: v.vitals.allergy_drug || 'NO',
                                      family_dm: v.vitals.family_dm || 'NO',
                                      family_htn: v.vitals.family_htn || 'NO',
                                      family_cancer: v.vitals.family_cancer || 'NO',
                                      family_cvs: v.vitals.family_cvs || 'NO',
                                      family_thyroid: v.vitals.family_thyroid || 'NO',
                                      family_tb: v.vitals.family_tb || 'NO',
                                      family_others: v.vitals.family_others || '',
                                      sys_respiratory: v.vitals.sys_respiratory || 'NAD',
                                      sys_cvs: v.vitals.sys_cvs || 'NAD',
                                      sys_cns: v.vitals.sys_cns || 'NAD',
                                      sys_gis: v.vitals.sys_gis || 'NAD',
                                      sys_mss: v.vitals.sys_mss || 'NAD',
                                      sys_gus: v.vitals.sys_gus || 'NAD',
                                      known_dm: v.vitals.known_dm || 'NO',
                                      known_htn: v.vitals.known_htn || 'NO',
                                      known_cancer: v.vitals.known_cancer || 'NO',
                                      known_cvs: v.vitals.known_cvs || 'NO',
                                      known_thyroid: v.vitals.known_thyroid || 'NO',
                                      known_tb: v.vitals.known_tb || 'NO',
                                      known_others: v.vitals.known_others || ''
                                  });
                              } else {
                                  resetForm();
                              }
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
                          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                           Assess <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && activeVisits.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
                         <UserCheck size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                         <p>Queue is empty. Well done!</p>
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
                          className="btn btn-secondary" disabled={page === 1} onClick={() => fetchActiveVisits(page - 1)}
                          style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                      >
                          <ChevronLeft size={16} />
                      </button>
                      <button 
                          className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchActiveVisits(page + 1)}
                          style={{ padding: '0.25rem 0.5rem', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                      >
                          <ChevronRight size={16} />
                      </button>
                  </div>
              </div>
            )}
          </div>
        )}

        {/* Vitals & Observations Form - Only show if a patient is selected */}
        {selectedVisit && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="card fade-in" style={{ border: '1px solid var(--primary)', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '0.5rem' }}>
                 <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2) ' }}>
                       <Activity size={24} color="white" />
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
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aadhar/Card No</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)' }}>{selectedVisit.patient_details?.id_proof_number || 'N/A'}</p>
                 </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Number</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>+91 {selectedVisit.patient_details?.phone ? selectedVisit.patient_details.phone.replace(/(\d{6})(\d{4})/, '$1XXXX') : 'N/A'}</p>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registry / Reason</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedVisit.reason || 'OPD Consultation'}</p>
                 </div>
                 <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Status</p>
                    <span style={{ fontSize: '0.6875rem', background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 800, width: 'fit-content', marginLeft: 'auto' }}>WAITING</span>
                 </div>
              </div>

            <form onSubmit={handleSaveVitals}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Biometrics & BMI</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1.25rem', marginBottom: '2rem', alignItems: 'end' }}>
                    <div className="form-group">
                       <label><Scale size={14} /> Weight {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ position: 'relative' }}>
                          <input type="number" step="0.01" min="0.1" max="650" value={vitalsData.weight_kg} onKeyDown={blockInvalidChar} onChange={e => updateBiometrics({weight_kg: e.target.value})} placeholder="70.5" style={{ paddingRight: '3rem !important', border: (formAttempted && projectConfig.vitals_mandatory && (vitalsData.weight_kg > 650 || !vitalsData.weight_kg)) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                          <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>KG</span>
                       </div>
                      {getRangeError('weight_kg', vitalsData.weight_kg) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('weight_kg', vitalsData.weight_kg)}</p>}
                      {formAttempted && projectConfig.vitals_mandatory && !vitalsData.weight_kg && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                   </div>
                   
                    <div className="form-group">
                       <label>Height (Feet/Inches) {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                             <input type="number" step="1" min="0" max="8" value={vitalsData.height_ft} onKeyDown={blockInvalidChar} onChange={e => updateBiometrics({height_ft: e.target.value})} placeholder="Ft" style={{ paddingRight: '2rem !important', border: (formAttempted && projectConfig.vitals_mandatory && (vitalsData.height_ft > 8 || !vitalsData.height_ft)) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                             <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>FT</span>
                          </div>
                         <div style={{ position: 'relative', flex: 1 }}>
                            <input type="number" step="1" min="0" max="11" value={vitalsData.height_in} onKeyDown={blockInvalidChar} onChange={e => updateBiometrics({height_in: e.target.value})} placeholder="In" style={{ paddingRight: '2rem !important', border: (formAttempted && (vitalsData.height_in > 11)) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>IN</span>
                         </div>
                      </div>
                      {(vitalsData.height_ft > 7) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Warning: Unusual Height Range</p>}
                      {formAttempted && projectConfig.vitals_mandatory && !vitalsData.height_ft && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                   </div>

                   <div className="form-group" style={{ background: 'var(--background)', padding: '0.875rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ margin: 0, fontSize: '0.7rem' }}>BMI {vitalsData.bmi && <span style={{ color: getBMIStatus(vitalsData.bmi).color, fontWeight: 900 }}>• Auto Calculated</span>}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: vitalsData.bmi ? '#1e293b' : '#cbd5e1' }}>
                           {vitalsData.bmi || '--.-'}
                        </div>
                        {vitalsData.bmi && (
                           <div style={{ 
                              fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', 
                              padding: '4px 10px', borderRadius: '6px', 
                              background: getBMIStatus(vitalsData.bmi).color + '15', 
                              color: getBMIStatus(vitalsData.bmi).color,
                              border: `1px solid ${getBMIStatus(vitalsData.bmi).color}30`,
                              letterSpacing: '0.02em'
                           }}>
                              {getBMIStatus(vitalsData.bmi).label}
                           </div>
                        )}
                      </div>
                   </div>
                </div>

                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Vital Signs</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                   <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ margin: 0 }}><Thermometer size={14} /> Temperature {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                          {['C', 'F'].map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                const currentUnit = vitalsData.temp_unit || 'C';
                                if (currentUnit === u) return;
                                
                                let newVal = vitalsData.temperature_c;
                                if (newVal) {
                                  if (u === 'F') {
                                    newVal = ((parseFloat(newVal) * 9/5) + 32).toFixed(1);
                                  } else {
                                    newVal = ((parseFloat(newVal) - 32) * 5/9).toFixed(1);
                                  }
                                }
                                setVitalsData({ ...vitalsData, temperature_c: newVal, temp_unit: u });
                              }}
                              style={{
                                border: 'none',
                                padding: '2px 8px',
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: (vitalsData.temp_unit || 'C') === u ? '#6366f1' : 'transparent',
                                color: (vitalsData.temp_unit || 'C') === u ? 'white' : '#64748b',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              °{u}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ position: 'relative' }}>
                         <input type="number" step="0.1" value={vitalsData.temperature_c} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, temperature_c: e.target.value})} placeholder={ (vitalsData.temp_unit || 'C') === 'F' ? '98.6' : '36.5' } style={{ paddingRight: '2.5rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.temperature_c) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                         <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>°{vitalsData.temp_unit || 'C'}</span>
                      </div>
                      {getRangeError('temperature_c', vitalsData.temperature_c) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('temperature_c', vitalsData.temperature_c)}</p>}
                      {formAttempted && projectConfig.vitals_mandatory && !vitalsData.temperature_c && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                   </div>
                    <div className="form-group">
                       <label><Heart size={14} /> Pulse {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ position: 'relative' }}>
                          <input type="number" value={vitalsData.heart_rate} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, heart_rate: e.target.value})} placeholder="72" style={{ paddingRight: '3.5rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.heart_rate) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                          <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>BPM</span>
                       </div>
                       {getRangeError('heart_rate', vitalsData.heart_rate) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('heart_rate', vitalsData.heart_rate)}</p>}
                       {formAttempted && projectConfig.vitals_mandatory && !vitalsData.heart_rate && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                    <div className="form-group">
                       <label><Wind size={14} /> Resp Rate {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ position: 'relative' }}>
                          <input type="number" value={vitalsData.respiratory_rate} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, respiratory_rate: e.target.value})} placeholder="18" style={{ paddingRight: '3.5rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.respiratory_rate) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                          <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>B/M</span>
                       </div>
                       {getRangeError('respiratory_rate', vitalsData.respiratory_rate) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('respiratory_rate', vitalsData.respiratory_rate)}</p>}
                       {formAttempted && projectConfig.vitals_mandatory && !vitalsData.respiratory_rate && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.75rem', display: 'block' }}>Blood Pressure (Sys / Dia) {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                             <input type="number" value={vitalsData.blood_pressure_sys} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, blood_pressure_sys: e.target.value})} placeholder="120" style={{ textAlign: 'center', paddingRight: '2rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.blood_pressure_sys) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                             <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.625rem', fontWeight: 800, color: '#cbd5e1' }}>SYS</span>
                          </div>
                          <span style={{ fontSize: '1.25rem', color: '#cbd5e1', fontWeight: 300 }}>/</span>
                          <div style={{ position: 'relative', flex: 1 }}>
                             <input type="number" value={vitalsData.blood_pressure_dia} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, blood_pressure_dia: e.target.value})} placeholder="80" style={{ textAlign: 'center', paddingRight: '2rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.blood_pressure_dia) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                             <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.625rem', fontWeight: 800, color: '#cbd5e1' }}>DIA</span>
                          </div>
                       </div>
                       <div style={{ display: 'flex', gap: '1rem' }}>
                         {getRangeError('blood_pressure_sys', vitalsData.blood_pressure_sys) && <p style={{ color: '#ef4444', fontSize: '8px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('blood_pressure_sys', vitalsData.blood_pressure_sys)}</p>}
                         {getRangeError('blood_pressure_dia', vitalsData.blood_pressure_dia) && <p style={{ color: '#ef4444', fontSize: '8px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('blood_pressure_dia', vitalsData.blood_pressure_dia)}</p>}
                       </div>
                    </div>
                    <div className="form-group" style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                       <label><Droplet size={14} /> Oxygen (SPO2) {projectConfig.vitals_mandatory && <span style={{ color: '#ef4444' }}>*</span>}</label>
                       <div style={{ position: 'relative' }}>
                          <input type="number" value={vitalsData.spo2} onKeyDown={blockInvalidChar} onChange={e => setVitalsData({...vitalsData, spo2: e.target.value})} placeholder="98" style={{ paddingRight: '2.5rem !important', border: (formAttempted && projectConfig.vitals_mandatory && !vitalsData.spo2) ? '1px solid #ef4444' : '1px solid #e2e8f0' }} />
                          <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>%</span>
                       </div>
                       {getRangeError('spo2', vitalsData.spo2) && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>{getRangeError('spo2', vitalsData.spo2)}</p>}
                       {formAttempted && projectConfig.vitals_mandatory && !vitalsData.spo2 && <p style={{ color: '#ef4444', fontSize: '9px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>Required</p>}
                    </div>
                </div>

               <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Observations</p>
               <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label><Clipboard size={14} /> Current Symptoms</label>
                  <textarea rows="2" value={vitalsData.symptoms} onChange={e => setVitalsData({...vitalsData, symptoms: e.target.value})} placeholder="Chief complaints noted during triage..."></textarea>
               </div>
               
               <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                  <label><FileText size={14} /> Nursing Notes</label>
                  <textarea rows="2" value={vitalsData.notes} onChange={e => setVitalsData({...vitalsData, notes: e.target.value})} placeholder="Any additional observations or patient behavioral notes..."></textarea>
               </div>

               {/* Medical History Sections */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  {/* Personal History */}
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                     <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Personal History</p>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ToggleField label="Smoking (Tobacco)" value={vitalsData.smoking} onChange={val => setVitalsData({...vitalsData, smoking: val})} options={['YES', 'NO']} />
                        <ToggleField label="Alcohol" value={vitalsData.alcohol} onChange={val => setVitalsData({...vitalsData, alcohol: val})} options={['YES', 'NO']} />
                        <ToggleField label="Physical Activity" value={vitalsData.physical_activity} onChange={val => setVitalsData({...vitalsData, physical_activity: val})} options={['YES', 'NO']} />
                        <ToggleField label="Food Habit" value={vitalsData.food_habit} onChange={val => setVitalsData({...vitalsData, food_habit: val})} options={['VEG', 'NON-VEG']} />
                        <ToggleField label="Allergy: Food" value={vitalsData.allergy_food} onChange={val => setVitalsData({...vitalsData, allergy_food: val})} options={['YES', 'NO']} />
                        <ToggleField label="Allergy: Drug" value={vitalsData.allergy_drug} onChange={val => setVitalsData({...vitalsData, allergy_drug: val})} options={['YES', 'NO']} />
                     </div>
                  </div>

                  {/* Family History */}
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                     <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Family History (Parents/Siblings)</p>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ToggleField label="DM (Diabetes)" value={vitalsData.family_dm} onChange={val => setVitalsData({...vitalsData, family_dm: val})} options={['YES', 'NO']} />
                        <ToggleField label="HTN (Hypertension)" value={vitalsData.family_htn} onChange={val => setVitalsData({...vitalsData, family_htn: val})} options={['YES', 'NO']} />
                        <ToggleField label="Cancer" value={vitalsData.family_cancer} onChange={val => setVitalsData({...vitalsData, family_cancer: val})} options={['YES', 'NO']} />
                        <ToggleField label="CVS" value={vitalsData.family_cvs} onChange={val => setVitalsData({...vitalsData, family_cvs: val})} options={['YES', 'NO']} />
                        <ToggleField label="Thyroid" value={vitalsData.family_thyroid} onChange={val => setVitalsData({...vitalsData, family_thyroid: val})} options={['YES', 'NO']} />
                        <ToggleField label="TB" value={vitalsData.family_tb} onChange={val => setVitalsData({...vitalsData, family_tb: val})} options={['YES', 'NO']} />
                        <div className="form-group-mini">
                           <label style={{ fontSize: '0.7rem' }}>Other Family History</label>
                           <input type="text" style={{ padding: '0.4rem !important', fontSize: '0.75rem' }} value={vitalsData.family_others} onChange={e => setVitalsData({...vitalsData, family_others: e.target.value})} placeholder="e.g. Asthma..." />
                        </div>
                     </div>
                  </div>

                  {/* Systemic Examination */}
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                     <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Systemic Examination</p>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ToggleField label="Respiratory" value={vitalsData.sys_respiratory} onChange={val => setVitalsData({...vitalsData, sys_respiratory: val})} options={['FND', 'NAD']} />
                        <ToggleField label="C.V.S" value={vitalsData.sys_cvs} onChange={val => setVitalsData({...vitalsData, sys_cvs: val})} options={['FND', 'NAD']} />
                        <ToggleField label="C.N.S" value={vitalsData.sys_cns} onChange={val => setVitalsData({...vitalsData, sys_cns: val})} options={['FND', 'NAD']} />
                        <ToggleField label="G.I.S" value={vitalsData.sys_gis} onChange={val => setVitalsData({...vitalsData, sys_gis: val})} options={['FND', 'NAD']} />
                        <ToggleField label="M.S.S" value={vitalsData.sys_mss} onChange={val => setVitalsData({...vitalsData, sys_mss: val})} options={['FND', 'NAD']} />
                        <ToggleField label="G.U.S" value={vitalsData.sys_gus} onChange={val => setVitalsData({...vitalsData, sys_gus: val})} options={['FND', 'NAD']} />
                     </div>
                  </div>

                  {/* Known History */}
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                     <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Known History</p>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ToggleField label="Known DM" value={vitalsData.known_dm} onChange={val => setVitalsData({...vitalsData, known_dm: val})} options={['YES', 'NO']} />
                        <ToggleField label="Known HTN" value={vitalsData.known_htn} onChange={val => setVitalsData({...vitalsData, known_htn: val})} options={['YES', 'NO']} />
                        <ToggleField label="Known Cancer" value={vitalsData.known_cancer} onChange={val => setVitalsData({...vitalsData, known_cancer: val})} options={['YES', 'NO']} />
                        <ToggleField label="Known C.V.S" value={vitalsData.known_cvs} onChange={val => setVitalsData({...vitalsData, known_cvs: val})} options={['YES', 'NO']} />
                        <ToggleField label="Thyroid Disorder" value={vitalsData.known_thyroid} onChange={val => setVitalsData({...vitalsData, known_thyroid: val})} options={['YES', 'NO']} />
                        <ToggleField label="TB" value={vitalsData.known_tb} onChange={val => setVitalsData({...vitalsData, known_tb: val})} options={['YES', 'NO']} />
                        <div className="form-group-mini">
                           <label style={{ fontSize: '0.7rem' }}>Other History</label>
                           <input type="text" style={{ padding: '0.4rem !important', fontSize: '0.75rem' }} value={vitalsData.known_others} onChange={e => setVitalsData({...vitalsData, known_others: e.target.value})} placeholder="Any other relevant history..." />
                        </div>
                     </div>
                  </div>
               </div>

               <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.875rem', fontWeight: 800, borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}>
                     Complete Assessment <ArrowRight size={16} style={{ marginLeft: '10px' }} />
                  </button>
               </div>
            </form>
          </div>
        </div>
        )}
      </div>

      <style>{`
         .form-group label { display: flex; alignItems: center; gap: 0.5rem; color: #475569; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.8125rem; }
         input, select, textarea { 
            border: 1px solid var(--border) !important;
            background: var(--input-bg) !important;
            padding: 0.75rem 1rem !important;
            border-radius: 10px !important;
            font-size: 0.875rem !important;
            font-weight: 600 !important;
            color: var(--text-main) !important;
         }
         input:focus, textarea:focus {
            border-color: var(--primary) !important;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1) !important;
            outline: none !important;
         }
         .form-group-mini label { display: block; color: #64748b; margin-bottom: 0.25rem; font-weight: 800; }
      `}</style>
    </div>
  );
};

const ToggleField = ({ label, value, onChange, options }) => (
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{label}</span>
      <div style={{ display: 'flex', gap: '2px', background: 'var(--background)', padding: '2px', borderRadius: '6px' }}>
         {options.map(opt => (
            <button
               key={opt}
               type="button"
               onClick={() => onChange(opt)}
               style={{
                  border: 'none',
                  padding: '4px 10px',
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: value === opt ? 'var(--primary)' : 'transparent',
                  color: value === opt ? 'white' : '#64748b',
                  transition: 'all 0.2s ease'
               }}
            >
               {opt}
            </button>
         ))}
      </div>
   </div>
);

export default Vitals;
