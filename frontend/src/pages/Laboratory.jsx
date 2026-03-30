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
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const Laboratory = () => {
  const [labRequests, setLabRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form States
  const [resultData, setResultData] = useState({ 
    value: '', 
    reference_range: '', 
    interpretation: '' 
  });

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
      // Keep selected for result entry if needed, but refresh data
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
      await api.post(`laboratory/requests/${selectedRequest.id}/record_result/`, resultData);
      toast.success("Results updated! Notifying doctor.", { id: loadingToast });
      setSelectedRequest(null);
      setResultData({ value: '', reference_range: '', interpretation: '' });
      fetchLabRequests();
    } catch (err) {
      toast.error("Error saving result. Check if fields are valid.", { id: loadingToast });
    }
  };

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Laboratory Hub</h1>
        <p style={{ color: 'var(--text-muted)' }}>Process diagnostics and manage clinical laboratory results</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '1fr 1.25fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Diagnostics Queue */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                             <p style={{ fontSize: '0.625rem', color: '#64748b' }}>#{1000 + r.id}</p>
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
                        setResultData({
                            value: r.result?.value || '',
                            reference_range: r.result?.reference_range || '',
                            interpretation: r.result?.interpretation || ''
                        });
                        setSampleData({
                            sample_type: r.sample_type || 'Blood',
                            remarks: r.remarks || ''
                        });
                      }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                         {r.status === 'COMPLETED' ? 'View Report' : 'Process'} <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && labRequests.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
                       <CheckCircle size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                       <p>Zero pending laboratory requests.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalCount > 10 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Page {page} of {Math.ceil(totalCount / 10)}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="btn btn-secondary" disabled={page === 1} onClick={() => fetchLabRequests(page - 1)}
                        style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchLabRequests(page + 1)}
                        style={{ padding: '0.25rem 0.5rem', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        {selectedRequest && (
          <div className="card fade-in" style={{ borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
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

            {/* Workflow Tabs/Steps */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ 
                    flex: 1, padding: '1rem', borderRadius: '16px', 
                    background: selectedRequest.status === 'PENDING' ? '#fffbeb' : '#f8fafc',
                    border: '1px solid',
                    borderColor: selectedRequest.status === 'PENDING' ? '#fef3c7' : '#e2e8f0',
                    opacity: selectedRequest.status === 'COMPLETED' ? 0.6 : 1
                }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Step 1: Sample Collection</p>
                    {selectedRequest.status === 'PENDING' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <select 
                                value={sampleData.sample_type} 
                                onChange={e => setSampleData({...sampleData, sample_type: e.target.value})}
                                style={{ height: '36px', fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                                <option value="Blood">Blood (Whole/Serum)</option>
                                <option value="Urine">Urine</option>
                                <option value="Swab">Swab (Throat/Nasal)</option>
                                <option value="Sputum">Sputum</option>
                                <option value="Others">Others</option>
                            </select>
                            <button className="btn btn-primary" onClick={handleCollectSample} style={{ width: '100%', padding: '0.5rem', background: '#92400e' }}>
                                Mark Sample Collected
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669' }}>
                            <ShieldCheck size={16} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{selectedRequest.sample_type} Collected</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Result Reporting Form - Only available if sample is collected or reporting exists */}
            {(selectedRequest.status !== 'PENDING') && (
                <form onSubmit={handleSaveResult} className="fade-in">
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="var(--primary)" /> Reporting Results
                        </p>
                        
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Test values / Report findings *</label>
                            <input 
                                required 
                                readOnly={selectedRequest.status === 'COMPLETED'}
                                value={resultData.value} 
                                onChange={e => setResultData({...resultData, value: e.target.value})} 
                                placeholder="e.g. 11.2 g/dL" 
                                style={{ height: '48px', fontSize: '1.125rem', fontWeight: 800, background: selectedRequest.status === 'COMPLETED' ? '#f1f5f9' : 'white' }} 
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Reference Range</label>
                                <input 
                                    readOnly={selectedRequest.status === 'COMPLETED'}
                                    value={resultData.reference_range} 
                                    onChange={e => setResultData({...resultData, reference_range: e.target.value})} 
                                    placeholder="e.g. 13.0 - 17.0 g/dL" 
                                    style={{ background: selectedRequest.status === 'COMPLETED' ? '#f1f5f9' : 'white' }} 
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>Clinical Interpretation / Remarks</label>
                                <textarea 
                                    rows="3" 
                                    readOnly={selectedRequest.status === 'COMPLETED'}
                                    value={resultData.interpretation} 
                                    onChange={e => setResultData({...resultData, interpretation: e.target.value})} 
                                    placeholder="Any abnormalities or observations..."
                                    style={{ background: selectedRequest.status === 'COMPLETED' ? '#f1f5f9' : 'white' }}
                                ></textarea>
                            </div>
                        </div>

                        {selectedRequest.status !== 'COMPLETED' && (
                            <>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#64748b', fontSize: '0.6875rem', background: '#f1f5f9', padding: '0.75rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                                    <Info size={14} />
                                    <p>Finalizing will move the patient to "Final Prescription" and notify the prescribing doctor.</p>
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn btn-primary" 
                                    style={{ 
                                        width: '100%', padding: '1rem', background: '#92400e', 
                                        borderColor: '#92400e', fontSize: '1rem', fontWeight: 700,
                                        boxShadow: '0 4px 6px -1px rgba(146, 64, 14, 0.2)'
                                    }}
                                >
                                    Finalize and Transmit Report <ArrowRight size={18} style={{ marginLeft: '10px' }} />
                                </button>
                            </>
                        )}
                        {selectedRequest.status === 'COMPLETED' && (
                             <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#166534', fontSize: '0.75rem', background: '#dcfce7', padding: '1rem', borderRadius: '12px' }}>
                                <ShieldCheck size={20} />
                                <p style={{ fontWeight: 600 }}>This report has been finalized and transmitted to the doctor. It is now in Read-Only mode.</p>
                             </div>
                        )}
                    </div>
                </form>
            )}
            
            {selectedRequest.status === 'PENDING' && (
                <div style={{ textAlign: 'center', padding: '2rem', background: '#f1f5f9', borderRadius: '20px', border: '1px dashed #cbd5e1' }}>
                    <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: '#64748b', fontWeight: 500 }}>Please record sample collection before entering results.</p>
                </div>
            )}
          </div>
        )}
      </div>
      
      <style>{`
         input, textarea, select { border-radius: 12px !important; }
         .badge { border-radius: 8px; padding: 0.35rem 0.75rem; }
      `}</style>
    </div>
  );
};

export default Laboratory;
