import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  FlaskConical, 
  Search, 
  ArrowRight, 
  X, 
  Clock, 
  CheckCircle, 
  FileText, 
  Beaker, 
  ShieldCheck, 
  MoreHorizontal,
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const Laboratory = () => {
  const [labRequests, setLabRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form States
  const [resultData, setResultData] = useState({ 
    value: '', 
    values: {},
    reference_range: '', 
    interpretation: '' 
  });
  const [hardwareMatches, setHardwareMatches] = useState([]);
  const [isFetchingMatching, setIsFetchingMatching] = useState(false);

  const [sampleData, setSampleData] = useState({
    sample_type: 'Blood',
    remarks: ''
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLabRequests();
  }, []);

  const fetchLabRequests = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get(`laboratory/requests/?page=${pageNum}`);
      if (res.data.results) {
          setLabRequests(res.data.results);
          setTotalCount(res.data.count);
      } else {
          setLabRequests(res.data);
          setTotalCount(res.data.length);
      }
      setPage(pageNum);
    } catch (err) {
      toast.error("Failed to fetch lab workload");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollectSample = async () => {
    const loadingToast = toast.loading('Recording sample collection...');
    try {
      await api.post(`laboratory/requests/${selectedRequest.id}/collect_sample/`, sampleData);
      toast.success("Sample collection recorded!", { id: loadingToast });
      fetchLabRequests();
      const updated = await api.get(`laboratory/requests/${selectedRequest.id}/`);
      setSelectedRequest(updated.data);
    } catch (err) {
      toast.error("Error recording sample", { id: loadingToast });
    }
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading('Publishing lab results...');
    try {
      await api.post(`laboratory/requests/${selectedRequest.id}/record_result/`, {
        ...resultData,
        sample_type: sampleData.sample_type
      });
      toast.success("Results updated! Notifying doctor.", { id: loadingToast });
      setSelectedRequest(null);
      setResultData({ value: '', values: {}, reference_range: '', interpretation: '' });
      fetchLabRequests();
    } catch (err) {
      toast.error("Error saving result. Check if fields are valid.", { id: loadingToast });
    }
  };

  const fetchMatchingHardwareData = async (patientId) => {
    if (!patientId) return;
    setIsFetchingMatching(true);
    try {
        const res = await api.get(`laboratory/machine-data/?patient_id=${patientId}`);
        setHardwareMatches(res.data.results || res.data);
    } catch (err) {
        console.error("Link to hardware station offline");
    } finally {
        setIsFetchingMatching(false);
    }
  };

  const applyHardwareResult = (record) => {
    const newValues = { ...resultData.values };
    const normalize = (str) => (str || "").toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const mappingDict = {
        'wbc': ['WBC', 'WHITE', 'LEUCOCYTE', 'WBC COUNT'], 
        'rbc': ['RBC', 'RED'], 
        'hgb': ['HGB', 'HB', 'HEMOGLOBIN', 'HGB'], 
        'hct': ['HCT', 'PCV', 'HEMATOCRIT', 'HCT'], 
        'plt': ['PLT', 'PLATELET'],
        'mcv': ['MCV'], 'mch': ['MCH'], 'mchc': ['MCHC'],
        'rdw_cv': ['RDW-CV', 'RDW_CV', 'RDW'], 
        'rdw_sd': ['RDW-SD', 'RDW_SD']
    };

    if (selectedRequest?.test_master_details?.sub_tests) {
        selectedRequest.test_master_details.sub_tests.forEach(st => {
            const stNameNorm = normalize(st.name);
            const stCodeNorm = normalize(st.code || "");

            // 1. DIRECT CODE MATCH (e.g., [hgb] -> record['hgb'])
            if (st.code) {
                const val = record[st.code.toLowerCase()] || record[st.code.toUpperCase()] || record[st.code];
                if (val !== undefined && val !== null) {
                    newValues[st.name] = val;
                }
            }
            
            // 2. DICTIONARY MATCH (Backup for common variations)
            if (!newValues[st.name]) {
                Object.entries(mappingDict).forEach(([hwKey, aliases]) => {
                    const val = record[hwKey] || record[hwKey.toUpperCase()];
                    if (val !== undefined && val !== null) {
                        if (aliases.some(a => stNameNorm.includes(normalize(a))) || stNameNorm.includes(normalize(hwKey)) || stCodeNorm === normalize(hwKey)) {
                            newValues[st.name] = val;
                        }
                    }
                });
            }
            
            // 3. FUZZY NAME MATCH (Final fallback)
            if (!newValues[st.name]) {
                Object.entries(record).forEach(([rk, rv]) => {
                    if (normalize(rk) === stNameNorm || stNameNorm.includes(normalize(rk))) {
                        newValues[st.name] = rv;
                    }
                });
            }
        });
    }

    setResultData({ 
        ...resultData, 
        values: newValues, 
        interpretation: `Differential Pulse Synced from ${record.machine_name} (${new Date(record.received_at_machine).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}): Results verified.` 
    });
    toast.success(`Results synced from ${record.machine_name}!`);
  };

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Laboratory Hub</h1>
        <p style={{ color: 'var(--text-muted)' }}>Process diagnostics and manage clinical laboratory results</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '1fr 1.25fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Workload Queue ({labRequests.length})</h3>
             <Beaker size={18} color="#94a3b8" />
          </div>
          
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '1rem 1.25rem' }}>Patient / DHID</th>
                  <th>Test Requested</th>
                  <th>Workflow Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {labRequests.map(r => (
                  <tr key={r.id} style={{ background: selectedRequest?.id === r.id ? '#f8fafc' : 'transparent' }}>
                    <td style={{ padding: '1.25rem 1.25rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: '32px', height: '32px', 
                            background: r.status === 'COMPLETED' ? '#dcfce7' : r.status === 'COLLECTED' ? '#e0e7ff' : '#fef3c7', 
                            color: r.status === 'COMPLETED' ? '#166534' : r.status === 'COLLECTED' ? '#4338ca' : '#92400e', 
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' 
                          }}>
                             {r.patient_name?.[0] || 'P'}
                          </div>
                          <div>
                             <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.patient_name}</p>
                             <p style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: 800 }}>ID: {r.patient_id}</p>
                          </div>
                       </div>
                    </td>
                    <td>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{r.test_name}</p>
                        <p style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Req by Dr. {r.ordered_by_name || 'MD'}</p>
                    </td>
                    <td>
                       <span className={`badge`} style={{ 
                         background: r.status === 'COMPLETED' ? '#dcfce7' : r.status === 'COLLECTED' ? '#e0e7ff' : '#fef2f2', 
                         color: r.status === 'COMPLETED' ? '#166534' : r.status === 'COLLECTED' ? '#4338ca' : '#991b1b', 
                         fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase'
                       }}>
                         {r.status?.replace('_', ' ') || 'PENDING'}
                       </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <button className={`btn ${r.status === 'COMPLETED' ? 'btn-secondary' : 'btn-primary'}`} onClick={() => {
                        setSelectedRequest(r);
                        const hardwareData = r.result?.values || {};
                        const initValues = {};
                        if (r.test_master_details?.sub_tests) {
                           r.test_master_details.sub_tests.forEach(st => {
                               const hwKey = st.name.toUpperCase().split(' ')[0];
                               initValues[st.name] = hardwareData[st.name] || hardwareData[hwKey] || r.result?.values?.[st.name] || '';
                           });
                        }
                        setResultData({
                            value: r.result?.value || '',
                            values: initValues,
                            reference_range: r.result?.reference_range || '',
                            interpretation: r.result?.interpretation || (Object.keys(hardwareData).length > 0 ? "Data synced from hardware instrument." : '')
                        });
                        if (r.patient_id) fetchMatchingHardwareData(r.patient_id);
                      }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                         {r.status === 'COMPLETED' ? 'View Report' : 'Process'} <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedRequest && (
          <div className="card fade-in" style={{ borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: '#92400e', borderRadius: '14px', color: 'white' }}>
                     <FlaskConical size={24} />
                  </div>
                  <div>
                     <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Clinical Diagnostic Entry</h2>
                     <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Patient Case: <strong>{selectedRequest.patient_name}</strong></p>
                  </div>
               </div>
               <button onClick={() => setSelectedRequest(null)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>
                  <X size={16} />
               </button>
            </div>

            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Investigation Profile</span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>{selectedRequest.test_name}</div>
                {selectedRequest.test_master_details?.sub_tests?.length > 0 && (
                   <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedRequest.test_master_details.sub_tests.filter(st => st.is_active).map(st => (
                         <span key={st.id} style={{ fontSize: '0.625rem', background: 'var(--surface)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '8px', fontWeight: 700, border: '1px solid var(--border)' }}>
                            {st.name} {selectedRequest.status === 'COMPLETED' ? `: ${selectedRequest.result?.values?.[st.name] || '-'} ${st.units}` : `(${st.units})`}
                         </span>
                      ))}
                   </div>
                )}
            </div>

            {selectedRequest.status !== 'COMPLETED' && (
               <div style={{ marginBottom: '2rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={20} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--text-main)' }}>Hardware Pulse HUB</p>
                        </div>
                    </div>
                    <button onClick={() => fetchMatchingHardwareData(selectedRequest.patient_id)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>
                        <RefreshCw size={14} className={isFetchingMatching ? 'spin' : ''} />
                    </button>
                  </div>
                  
                  {hardwareMatches.length > 0 ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {hardwareMatches.map(m => (
                           <div key={m.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                                 <div>
                                     <p style={{ fontSize: '0.75rem', fontWeight: 900 }}>{m.machine_name} - {m.lab_id}</p>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface)', padding: '2px 8px', borderRadius: '6px' }}>
                                            <Clock size={10} color="#64748b" />
                                            <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>
                                                {new Date(m.received_at_machine).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
                                            </span>
                                        </div>
                                     </div>
                                 </div>
                                 <button onClick={() => applyHardwareResult(m)} style={{ border: 'none', background: 'var(--primary)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.1)' }}>Apply Results</button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                 {Object.entries(m).filter(([k, v]) => 
                                     v !== null && v !== undefined && v !== '' && 
                                     !['id', 'patient_id', 'patient_name', 'machine_id', 'machine_name', 'received_at_machine', 'lab_id', 'location', 'project', 'project_id', 'sample_id', 'is_processed', 'synced_at_cloud', 'raw_data'].includes(k)
                                 ).map(([key, value]) => (
                                     <span key={key} style={{ fontSize: '0.6rem', padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 800 }}>
                                         <span style={{ color: 'var(--primary)', fontWeight: 900 }}>{key.toUpperCase()}</span>: {value}
                                     </span>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: '16px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Waiting for {selectedRequest.patient_id} machine data...</p>
                     </div>
                  )}
               </div>
            )}

            <form onSubmit={handleSaveResult} className="fade-in">
               <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '2rem' }}>
                      <p style={{ fontSize: '0.9375rem', fontWeight: 950, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                           Verification Desk
                      </p>
                      
                      {selectedRequest.test_master_details?.sub_tests?.length > 0 && (
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {selectedRequest.test_master_details.sub_tests.filter(st => st.is_active).map(st => {
                               const val = resultData.values[st.name];
                               const hasData = val !== undefined && val !== '';
                               return (
                                  <div key={st.id} style={{ padding: '1.25rem', background: 'white', borderRadius: '24px', border: hasData ? '1px solid #e2e8f0' : '1px dashed #cbd5e1' }}>
                                     <label style={{ fontSize: '0.6rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{st.name}</label>
                                     <div style={{ fontSize: '1.5rem', fontWeight: 950, color: hasData ? '#1e293b' : '#f1f5f9' }}>{hasData ? val : '---'}</div>
                                     <div style={{ fontSize: '0.55rem', color: '#cbd5e1', fontWeight: 800 }}>{st.units} | {st.biological_range}</div>
                                  </div>
                               );
                            })}
                         </div>
                      )}

                      <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Clinical Interpretation</label>
                          <textarea 
                              rows="2" value={resultData.interpretation} 
                              onChange={e => setResultData({...resultData, interpretation: e.target.value})} 
                              placeholder="Diagnostic summary..."
                          ></textarea>
                      </div>

                      {selectedRequest.status !== 'COMPLETED' ? (
                          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', background: 'var(--primary)', borderRadius: '20px', fontWeight: 900, marginTop: '1.5rem' }}>
                              Finalize & Transmit <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                          </button>
                      ) : (
                           <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px', color: '#10b981', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', marginTop: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              Results Transmitted to Doctor
                           </div>
                      )}
                  </div>
               </div>
            </form>
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Laboratory;
