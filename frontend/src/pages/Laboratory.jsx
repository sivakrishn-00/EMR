import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  RefreshCw,
  ClipboardList,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Upload,
  Trash2,
  Image
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Indents from './Indents';

const mappingDict = {
    'wbc': ['WBC', 'WHITE', 'LEUCOCYTE', 'WBC COUNT'], 
    'rbc': ['RBC', 'RED'], 
    'hgb': ['HGB', 'HB', 'HEMOGLOBIN', 'HGB'], 
    'hct': ['HCT', 'PCV', 'HEMATOCRIT', 'HCT'], 
    'plt': ['PLT', 'PLATELET'],
    'mcv': ['MCV'], 'mch': ['MCH'], 'mchc': ['MCHC'],
    'rdw_cv': ['RDW-CV', 'RDW_CV', 'RDW'], 
    'rdw_sd': ['RDW-SD', 'RDW_SD'],
    
    // Biochemistry parameters
    'alb': ['ALB', 'ALBUMIN'],
    'alp': ['ALP', 'ALKALINE PHOSPHATASE'],
    'dbil': ['DBIL', 'DIRECT BILIRUBIN'],
    'tbil': ['TBIL', 'TOTAL BILIRUBIN'],
    'chol': ['CHOL', 'CHOLESTEROL'],
    'crea': ['CREA', 'CREATININE'],
    'glu': ['GLU', 'GLUCOSE', 'SUGAR', 'BLOOD SUGAR'],
    'hdl': ['HDL', 'HDL CHOLESTEROL'],
    'ldl': ['LDL', 'LDL CHOLESTEROL'],
    'tp': ['TP', 'TOTAL PROTEIN'],
    'tgl': ['TGL', 'TRIGLYCERIDES'],
    'urea': ['UREA'],
    'uric': ['URIC', 'URIC ACID'],
    'sgot': ['SGOT', 'AST'],
    'sgpt': ['SGPT', 'ALT'],
    'na': ['NA', 'SODIUM'],
    'k': ['K', 'POTASSIUM'],
    'cl': ['CL', 'CHLORIDE'],
    'ldh': ['LDH', 'LACTATE DEHYDROGENASE'],
    'amyl': ['AMYL', 'AMYLASE'],
    'ibil': ['IBIL', 'INDIRECT BILIRUBIN'],
    'ggt': ['GGT', 'GAMMA GT'],
    'phos': ['PHOS', 'PHOSPHORUS'],
    'ca': ['CA', 'CALCIUM'],
    'mg': ['MG', 'MAGNESIUM'],
    'direct_ldl': ['DIRECT_LDL', 'DIRECT LDL'],
    'vldl': ['VLDL'],
    'bun': ['BUN', 'BLOOD UREA NITROGEN'],
    'ast': ['AST'],
    'alt': ['ALT']
};

const isRecordRelevant = (record, request) => {
  if (!request || !request.test_master_details || !request.test_master_details.sub_tests) return true;
  
  const normalize = (str) => (str || "").toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const subTests = request.test_master_details.sub_tests.filter(st => st.is_active);
  
  return subTests.some(st => {
    const stNameNorm = normalize(st.name);
    const stCodeNorm = normalize(st.code || "");
    
    // 1. Direct code check
    if (st.code) {
      const val = record[st.code.toLowerCase()] || record[st.code.toUpperCase()] || record[st.code];
      if (val !== undefined && val !== null && val !== '') return true;
    }
    
    // 2. Dictionary match
    for (const [hwKey, aliases] of Object.entries(mappingDict)) {
      const val = record[hwKey] || record[hwKey.toUpperCase()];
      if (val !== undefined && val !== null && val !== '') {
        if (aliases.some(a => stNameNorm.includes(normalize(a))) || stNameNorm.includes(normalize(hwKey)) || stCodeNorm === normalize(hwKey)) {
          return true;
        }
      }
    }
    
    // 3. Fuzzy name match
    for (const [rk, rv] of Object.entries(record)) {
      if (rv !== undefined && rv !== null && rv !== '' && !['id', 'patient_id', 'patient_name', 'machine_id', 'machine_name', 'received_at_machine', 'lab_id', 'location', 'project', 'project_id', 'sample_id', 'is_processed', 'synced_at_cloud', 'raw_data'].includes(rk)) {
        if (normalize(rk) === stNameNorm || stNameNorm.includes(normalize(rk))) {
          return true;
        }
      }
    }
    
    return false;
  });
};

const isRecordRelevantForGroup = (record, group) => {
  if (!group || !group.requests) return true;
  return group.requests.some(req => isRecordRelevant(record, req));
};

const Laboratory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isExamineRoute = location.pathname === '/lab/examine';
  const [projectConfig, setProjectConfig] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('queue');
  const [labRequests, setLabRequests] = useState([]);
  const [selectedRequestGroup, setSelectedRequestGroup] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING or COMPLETED
  
  // Form States
  const [resultData, setResultData] = useState({ 
    value: '', 
    values: {},
    reference_range: '', 
    interpretation: '',
    attachment: null,
    attachments: []
  });
  const [hardwareMatches, setHardwareMatches] = useState([]);
  const [isFetchingMatching, setIsFetchingMatching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sampleData, setSampleData] = useState({
    sample_type: 'Blood',
    remarks: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const [sortConfig, setSortConfig] = useState({ key: 'oldest_created_at', direction: 'asc' });

  useEffect(() => {
    fetchLabRequests();
  }, []);

  useEffect(() => {
    // If path is /lab/examine but there is no selected group, redirect to /lab queue
    if (isExamineRoute && !selectedRequestGroup) {
      navigate('/lab', { replace: true });
    }
  }, [isExamineRoute, selectedRequestGroup, navigate]);

  useEffect(() => {
    // If user clicks sidebar or navigates back to /lab, reset selected group and request, and refresh list
    if (location.pathname === '/lab') {
      setSelectedRequest(null);
      setSelectedRequestGroup(null);
      setActiveSubTab('queue');
      fetchLabRequests(searchTerm);
    }
  }, [location.pathname]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLabRequests(searchTerm, true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [searchTerm]);

  useEffect(() => {
    if (user?.project) {
      fetchProjectConfig(user.project);
    } else {
      setProjectConfig(null);
    }
  }, [user]);

  const fetchProjectConfig = async (projectId) => {
    try {
        const res = await api.get(`patients/projects/${projectId}/`);
        setProjectConfig(res.data);
    } catch (err) {
        console.error("Failed to fetch project config:", err);
    }
  };

  const fetchLabRequests = async (search = searchTerm, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await api.get(`laboratory/requests/?page_size=1000&search=${encodeURIComponent(search)}`);
      const data = res.data.results || res.data;
      setLabRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isBackground) toast.error("Failed to fetch lab workload");
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const setupGroupResultForm = (group) => {
    const initValues = {};
    let combinedInterpretation = '';
    
    group.requests.forEach(r => {
      const hardwareData = r.result?.values || {};
      if (r.test_master_details?.sub_tests) {
         r.test_master_details.sub_tests.forEach(st => {
             const hwKey = st.name.toUpperCase().split(' ')[0];
             initValues[st.name] = r.result?.values?.[st.name] || hardwareData[st.name] || hardwareData[hwKey] || '';
         });
      }
      if (r.result?.interpretation) {
         if (combinedInterpretation && !combinedInterpretation.includes(r.result.interpretation)) {
            combinedInterpretation += ' | ';
         }
         if (!combinedInterpretation.includes(r.result.interpretation)) {
            combinedInterpretation += r.result.interpretation;
         }
      }
    });

    setResultData({
        value: '',
        values: initValues,
        reference_range: '',
        interpretation: combinedInterpretation || '',
        attachment: null,
        attachments: []
    });
  };

  const handleSaveGroupResults = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const loadingToast = toast.loading('Publishing all lab results...');
    try {
      // Submit results for all pending/collected requests in the group
      const promises = selectedRequestGroup.requests
        .filter(req => req.status !== 'COMPLETED')
        .map(req => {
          const reqValues = {};
          if (req.test_master_details?.sub_tests) {
            req.test_master_details.sub_tests.forEach(st => {
              if (resultData.values[st.name] !== undefined) {
                reqValues[st.name] = resultData.values[st.name];
              }
            });
          }
          
          const formData = new FormData();
          formData.append('value', resultData.value || '');
          formData.append('values', JSON.stringify(reqValues));
          formData.append('reference_range', resultData.reference_range || '');
          formData.append('interpretation', resultData.interpretation || 'Results verified.');
          formData.append('sample_type', sampleData.sample_type || '');
          
          if (req.test_master_details?.supports_attachments) {
            if (resultData.attachments && resultData.attachments.length > 0) {
              resultData.attachments.forEach(file => {
                formData.append('attachments', file);
              });
              formData.append('attachment', resultData.attachments[0]);
            } else if (resultData.attachment) {
              formData.append('attachment', resultData.attachment);
              formData.append('attachments', resultData.attachment);
            }
          }
          
          return api.post(`laboratory/requests/${req.id}/record_result/`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        });
      
      await Promise.all(promises);
      toast.success("All lab results updated! Notifying doctor.", { id: loadingToast });
      
      // Clear selection
      navigate('/lab');
      setResultData({ value: '', values: {}, reference_range: '', interpretation: '', attachment: null, attachments: [] });
      
      // Refresh list
      fetchLabRequests();
    } catch (err) {
      toast.error("Error saving some results. Check if fields are valid.", { id: loadingToast });
    } finally {
      setIsSubmitting(false);
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

    if (selectedRequestGroup) {
      selectedRequestGroup.requests.forEach(req => {
        if (req.test_master_details?.sub_tests) {
          req.test_master_details.sub_tests.forEach(st => {
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
      });
    }

    setResultData({ 
        ...resultData, 
        values: newValues, 
        interpretation: `Hardware pulses synced: Results verified.` 
    });
    toast.success(`Results synced from ${record.machine_name}!`);
  };

  const filteredRequests = labRequests
    .filter(r => activeTab === 'COMPLETED' ? r.status === 'COMPLETED' : r.status !== 'COMPLETED')
    .filter(r => {
      const searchLow = searchTerm.toLowerCase().trim();
      if (!searchLow) return true;

      // Smart card group matching: check if search term is a card base/suffix and extract the base
      const cardMatch = searchLow.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || searchLow.match(/(\d+)(?:\/\d+)?/);
      if (cardMatch) {
        const baseCard = cardMatch[1].padStart(4, '0');
        const pCard = String(r.card_no || '').toLowerCase();
        const pCardMatch = pCard.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || pCard.match(/(\d+)(?:\/\d+)?/);
        if (pCardMatch && pCardMatch[1].padStart(4, '0') === baseCard) {
          return true;
        }
      }

      return (
        r.patient_name?.toLowerCase().includes(searchLow) ||
        r.patient_id?.toLowerCase().includes(searchLow) ||
        String(r.card_no || '').toLowerCase().includes(searchLow) ||
        String(r.employee_id || '').toLowerCase().includes(searchLow) ||
        r.test_name?.toLowerCase().includes(searchLow)
      );
    });

  // Group filteredRequests by patient_id + visit
  const groupsMap = new Map();
  filteredRequests.forEach(r => {
    const key = `${r.patient_id}_${r.visit}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        id: key,
        patient_id: r.patient_id,
        patient_name: r.patient_name,
        card_no: r.card_no,
        employee_id: r.employee_id,
        visit: r.visit,
        requests: []
      });
    }
    groupsMap.get(key).requests.push(r);
  });

  const groupedList = Array.from(groupsMap.values());
  
  // Sort grouped list in strict FIFO order (oldest request first)
  groupedList.forEach(g => {
    g.requests.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    g.oldest_created_at = g.requests[0]?.created_at;
  });
  groupedList.sort((a, b) => new Date(a.oldest_created_at) - new Date(b.oldest_created_at));

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGroups = [...groupedList].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let aVal = '';
    let bVal = '';
    
    if (sortConfig.key === 'patient_name') {
      aVal = (a.patient_name || '').toLowerCase();
      bVal = (b.patient_name || '').toLowerCase();
    } else if (sortConfig.key === 'test_names') {
      aVal = a.requests.map(r => r.test_name).join(', ').toLowerCase();
      bVal = b.requests.map(r => r.test_name).join(', ').toLowerCase();
    } else if (sortConfig.key === 'oldest_created_at') {
      aVal = new Date(a.oldest_created_at).getTime();
      bVal = new Date(b.oldest_created_at).getTime();
    }
    
    if (aVal < bVal) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentGroups = sortedGroups.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(groupedList.length / itemsPerPage);

  const hasPending = selectedRequestGroup && selectedRequestGroup.requests.some(r => r.status !== 'COMPLETED');
  const groupSupportsAttachments = selectedRequestGroup && selectedRequestGroup.requests.some(r => r.test_master_details?.supports_attachments);

  return (
    <div className="fade-in">
      {!selectedRequestGroup && (
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Laboratory Hub</h1>
          <p style={{ color: 'var(--text-muted)' }}>Process diagnostics and manage clinical laboratory results</p>
        </div>
      </header>
      )}

      {!selectedRequestGroup && (
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
              Workload Queue ({groupedList.length})
          </button>
          {(user?.role === 'ADMIN' || user?.permissions?.includes('/indents/inventory')) && (
            <button 
                onClick={() => setActiveSubTab('stock')}
                style={{ 
                    padding: '0.75rem 0.5rem', background: 'none', border: 'none', whiteSpace: 'nowrap',
                    borderBottom: activeSubTab === 'stock' ? `3px solid ${projectConfig?.primary_color || 'var(--primary)'}` : '3px solid transparent',
                    fontWeight: 800, color: activeSubTab === 'stock' ? (projectConfig?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                    cursor: 'pointer', transition: '0.3s', fontSize: '0.875rem'
                }}
            >
                Room Stock
            </button>
          )}
        </div>
      )}

      <div style={{ width: '100%', margin: '0 auto' }}>
        {!selectedRequestGroup && activeSubTab === 'queue' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
             <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Workload Queue ({groupedList.length})</h3>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Total diagnostic requests: {labRequests.length}</p>
             </div>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-container" style={{ position: 'relative' }}>
                   <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', zIndex: 10 }} />
                   <input
                      type="text"
                      placeholder="Search by Patient/Employee ID, Name, Test..."
                      value={searchTerm}
                      onChange={e => { const val = e.target.value; setSearchTerm(val); setCurrentPage(1); fetchLabRequests(val); }}
                      className="search-input"
                      style={{ padding: '0.5rem 2rem 0.5rem 2.25rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.75rem', outline: 'none' }}
                   />
                   {searchTerm && (
                      <button 
                         onClick={() => { setSearchTerm(''); setCurrentPage(1); fetchLabRequests(''); }}
                         style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                         <X size={14} />
                      </button>
                   )}
                </div>
                
                <div style={{ background: 'var(--background)', padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid var(--border)' }}>
                   <button 
                     onClick={() => { setActiveTab('PENDING'); setSelectedRequest(null); setSelectedRequestGroup(null); setCurrentPage(1); }}
                     style={{ 
                       padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none', 
                       background: activeTab === 'PENDING' ? 'var(--surface)' : 'transparent',
                       color: activeTab === 'PENDING' ? (projectConfig?.primary_color || 'var(--primary)') : 'var(--text-muted)',
                       fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                       boxShadow: activeTab === 'PENDING' 
                         ? (projectConfig?.primary_color ? `0 4px 12px ${projectConfig.primary_color}26` : '0 4px 12px var(--primary-shadow)') 
                         : 'none',
                       transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '8px'
                     }}
                   >
                     <Clock size={14} /> PENDING ({labRequests.filter(r => r.status !== 'COMPLETED').length})
                   </button>
                   <button 
                     onClick={() => { setActiveTab('COMPLETED'); setSelectedRequest(null); setSelectedRequestGroup(null); setCurrentPage(1); }}
                     style={{ 
                       padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none', 
                       background: activeTab === 'COMPLETED' ? 'var(--surface)' : 'transparent',
                       color: activeTab === 'COMPLETED' ? '#10b981' : 'var(--text-muted)',
                       fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                       boxShadow: activeTab === 'COMPLETED' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
                       transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '8px'
                     }}
                   >
                     <CheckCircle size={14} /> COMPLETED ({labRequests.filter(r => r.status === 'COMPLETED').length})
                   </button>
                 </div>
              </div>
           </div>
          
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('patient_name')}
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Patient / DHID
                      {sortConfig.key === 'patient_name' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('test_names')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Test(s) Requested
                      {sortConfig.key === 'test_names' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('oldest_created_at')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Workflow Status
                      {sortConfig.key === 'oldest_created_at' ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : <ArrowUpDown size={12} style={{ color: '#94a3b8' }} />}
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Action</th>
                </tr>
              </thead>
  <tbody>
    {isLoading ? (
        <tr>
           <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
               <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                 <div className="pulse-loader"></div>
                 <FlaskConical size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
               </div>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Loading Lab Queue...</p>
             </div>
             <style>{`
               .pulse-loader { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--primary); animation: pulse 1.5s infinite; opacity: 0.5; }
               @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
             `}</style>
           </td>
        </tr>
    ) : currentGroups.length === 0 ? (
        <tr>
           <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#475569' }}>
             <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>No requests found</p>
             <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>Try searching with a different name or ID.</p>
          </td>
        </tr>
     ) : (
                    currentGroups.map(g => {
                       const isSelected = selectedRequestGroup?.id === g.id;
                       const testNames = g.requests.map(r => r.test_name).join(', ');
                       const orderedBy = g.requests[0]?.ordered_by_name;
                       
                       let groupStatus = 'PENDING';
                       if (g.requests.every(r => r.status === 'COMPLETED')) {
                         groupStatus = 'COMPLETED';
                       } else if (g.requests.some(r => r.status === 'IN_PROGRESS')) {
                         groupStatus = 'IN_PROGRESS';
                       } else if (g.requests.some(r => r.status === 'COLLECTED')) {
                         groupStatus = 'COLLECTED';
                       }

                       return (
                          <tr key={g.id} style={{ background: isSelected ? 'var(--background)' : 'transparent' }}>
                            <td style={{ padding: '1.25rem 1.25rem' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ 
                                    width: '32px', height: '32px', 
                                    background: groupStatus === 'COMPLETED' ? '#dcfce7' : groupStatus === 'COLLECTED' ? '#e0e7ff' : '#fef3c7', 
                                    color: groupStatus === 'COMPLETED' ? '#166534' : groupStatus === 'COLLECTED' ? '#4338ca' : '#92400e', 
                                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' 
                                  }}>
                                     {g.patient_name?.[0] || 'P'}
                                  </div>
                                  <div>
                                     <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{g.patient_name}</p>
                                     <p style={{ fontSize: '0.625rem', color: '#475569', fontWeight: 800 }}>ID: {g.patient_id}{g.card_no ? ` | Card: ${g.card_no}` : ''}{orderedBy ? ` | Ordered By: ${orderedBy}` : ''}</p>
                                  </div>
                               </div>
                            </td>
                            <td>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{testNames}</p>
                                <p style={{ fontSize: '0.625rem', color: '#475569' }}>{g.requests.length} test request{g.requests.length > 1 ? 's' : ''}</p>
                            </td>
                            <td>
                               <span className={`badge`} style={{ 
                                 background: groupStatus === 'COMPLETED' ? '#dcfce7' : groupStatus === 'COLLECTED' ? '#e0e7ff' : '#fef2f2', 
                                 color: groupStatus === 'COMPLETED' ? '#166534' : groupStatus === 'COLLECTED' ? '#4338ca' : '#991b1b', 
                                 fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase'
                               }}>
                                 {groupStatus.replace('_', ' ')}
                               </span>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                              <button 
                                className={`btn ${groupStatus === 'COMPLETED' ? 'btn-secondary' : 'btn-primary'}`} 
                                onClick={() => {
                                  setSelectedRequestGroup(g);
                                  setSelectedRequest(g.requests[0]);
                                  setupGroupResultForm(g);
                                  if (g.patient_id) fetchMatchingHardwareData(g.patient_id);
                                  navigate('/lab/examine');
                                }} 
                                style={{ 
                                  padding: '0.4rem 0.85rem', 
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  borderRadius: '10px',
                                  border: 'none',
                                  color: groupStatus === 'COMPLETED' ? 'var(--text-main)' : 'white',
                                  background: groupStatus === 'COMPLETED' 
                                    ? 'var(--surface)' 
                                    : (projectConfig?.primary_color 
                                       ? `linear-gradient(135deg, ${projectConfig.primary_color} 0%, ${projectConfig.secondary_color || projectConfig.primary_color} 100%)` 
                                       : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'),
                                  boxShadow: groupStatus === 'COMPLETED' 
                                    ? 'none' 
                                    : (projectConfig?.primary_color 
                                       ? `0 4px 10px ${projectConfig.primary_color}26` 
                                       : '0 4px 10px var(--primary-shadow)'),
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                                onMouseOver={e => {
                                  if (groupStatus !== 'COMPLETED') {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                      ? `0 6px 12px ${projectConfig.primary_color}4d` 
                                      : '0 6px 12px var(--primary-shadow)';
                                  }
                                }}
                                onMouseOut={e => {
                                  if (groupStatus !== 'COMPLETED') {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                      ? `0 4px 10px ${projectConfig.primary_color}26` 
                                      : '0 4px 10px var(--primary-shadow)';
                                  }
                                }}
                              >
                                  {groupStatus === 'COMPLETED' ? 'View Report' : 'Process'} <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                              </button>
                            </td>
                          </tr>
                       );
                    })
                 )}
              </tbody>
            </table>
          </div>
          
             {/* Pagination Controls */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                 <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                     Showing <span style={{ color: 'var(--primary)' }}>{indexOfFirstItem + 1}</span> to <span style={{ color: 'var(--primary)' }}>{Math.min(indexOfLastItem, groupedList.length)}</span> of {groupedList.length} entries
                 </p>
                 <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                     <button 
                         className="btn btn-secondary" 
                         disabled={currentPage === 1}
                         onClick={() => setCurrentPage(currentPage - 1)}
                         style={{ padding: '0.4rem', borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                     >
                         <ChevronLeft size={18} />
                     </button>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                         {(() => {
                             if (totalPages <= 1) return null;

                             const buttons = [];
                             const maxVisiblePages = 5;
                             
                             // Always show page 1
                             buttons.push(
                                 <button 
                                     key={1} 
                                     onClick={() => setCurrentPage(1)}
                                     style={{ 
                                         width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                         background: currentPage === 1 ? 'var(--primary)' : 'transparent',
                                         color: currentPage === 1 ? 'white' : 'var(--text-muted)',
                                         fontWeight: 700, cursor: 'pointer', transition: '0.3s'
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
                                             onClick={() => setCurrentPage(i)}
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
                                         onClick={() => setCurrentPage(totalPages)}
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

                             return buttons;
                         })()}
                     </div>
                     <button 
                         className="btn btn-secondary" 
                         disabled={currentPage >= totalPages}
                         onClick={() => setCurrentPage(currentPage + 1)}
                         style={{ padding: '0.4rem', borderRadius: '8px', opacity: currentPage >= totalPages ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                     >
                         <ChevronRight size={18} />
                     </button>
                 </div>
             </div>
        </div>)}

        {!selectedRequestGroup && activeSubTab === 'stock' && (
          <div className="fade-in">
             <Indents isEmbed={true} embedRoom="Lab Room" />
          </div>
        )}

        {selectedRequestGroup && (
          <div className="card fade-in" style={{ borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', padding: '0.5rem' }}>
               <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div>
                     <div style={{ width: 'fit-content' }}>
                        <h2 style={{ fontSize: '1.375rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>Clinical Diagnostic Entry</h2>
                        <div style={{ 
                          height: '3px', 
                          width: '100%', 
                          background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%)', 
                          borderRadius: '4px', 
                          marginTop: '6px',
                          marginBottom: '8px'
                        }}></div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 800 }}> 
                           Patient Case: <strong style={{ color: 'var(--text-main)' }}>{selectedRequestGroup.patient_name}</strong> | ID: {selectedRequestGroup.patient_id}{selectedRequestGroup.card_no ? ` | Card: ${selectedRequestGroup.card_no}` : ''}
                        </p>
                     </div>
                  </div>
               </div>
               <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                  <button 
                     onClick={() => navigate('/lab')} 
                     style={{ 
                       border: 'none',
                       background: 'var(--primary)', 
                       padding: '0.6rem 1.25rem', 
                       borderRadius: '12px', 
                       cursor: 'pointer', 
                       transition: 'all 0.2s ease', 
                       color: 'white',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '6px',
                       fontWeight: 800,
                       fontSize: '0.8125rem',
                       boxShadow: '0 4px 12px var(--primary-shadow)'
                     }}
                     onMouseOver={e => {
                       e.currentTarget.style.transform = 'translateY(-1px)';
                       e.currentTarget.style.boxShadow = '0 6px 16px var(--primary-shadow)';
                       e.currentTarget.style.background = 'var(--primary-dark)';
                     }}
                     onMouseOut={e => {
                       e.currentTarget.style.transform = 'translateY(0)';
                       e.currentTarget.style.boxShadow = '0 4px 12px var(--primary-shadow)';
                       e.currentTarget.style.background = 'var(--primary)';
                     }}
                  >
                     <ChevronLeft size={16} strokeWidth={2.5} /> Back to Queue
                  </button>
               </div>
            </div>

            <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    <span>Investigation Profiles</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedRequestGroup.requests.map(req => (
                     <div key={req.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: req.id !== selectedRequestGroup.requests[selectedRequestGroup.requests.length-1].id ? '1px solid var(--border)' : 'none', paddingBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-main)' }}>{req.test_name}</div>
                        {req.test_master_details?.sub_tests?.length > 0 && (
                           <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {req.test_master_details.sub_tests.filter(st => st.is_active).map(st => (
                                 <span key={st.id} style={{ fontSize: '0.625rem', background: 'var(--surface)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '8px', fontWeight: 700, border: '1px solid var(--border)' }}>
                                    {st.name} {req.status === 'COMPLETED' ? `: ${resultData.values[st.name] || '-'} ${st.units}` : `(${st.units})`}
                                 </span>
                              ))}
                           </div>
                        )}
                        {req.result?.attachment_url && (
                           <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 850 }}>ATTACHMENT:</span>
                              <a 
                                href={req.result.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  fontSize: '0.6875rem', 
                                  color: projectConfig?.primary_color || 'var(--primary)', 
                                  fontWeight: 800,
                                  textDecoration: 'none'
                                }}
                              >
                                <FileText size={12} /> View File
                              </a>
                           </div>
                        )}
                     </div>
                  ))}
                </div>
            </div>

            {hasPending && (
               <div style={{ marginBottom: '2rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--primary)' }}></span>
                        <p style={{ fontSize: '0.75rem', fontWeight: 950, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Data sync</p>
                    </div>
                    <button onClick={() => fetchMatchingHardwareData(selectedRequestGroup.patient_id)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>
                        <RefreshCw size={14} className={isFetchingMatching ? 'spin' : ''} />
                    </button>
                  </div>
                  
                  {(() => {
                     const relevantMatches = hardwareMatches.filter(m => isRecordRelevantForGroup(m, selectedRequestGroup));
                     if (relevantMatches.length > 0) {
                        return (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {relevantMatches.map(m => (
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
                                       <button 
                                           onClick={() => applyHardwareResult(m)} 
                                           style={{ 
                                             border: 'none', 
                                             background: projectConfig?.primary_color 
                                               ? `linear-gradient(135deg, ${projectConfig.primary_color} 0%, ${projectConfig.secondary_color || projectConfig.primary_color} 100%)` 
                                               : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', 
                                             color: 'white', 
                                             padding: '6px 14px', 
                                             borderRadius: '10px', 
                                             fontSize: '0.75rem', 
                                             fontWeight: 800, 
                                             cursor: 'pointer', 
                                             transition: 'all 0.2s ease', 
                                             boxShadow: projectConfig?.primary_color 
                                               ? `0 4px 10px ${projectConfig.primary_color}33` 
                                               : '0 4px 10px var(--primary-shadow)' 
                                           }}
                                           onMouseOver={e => {
                                             e.currentTarget.style.transform = 'translateY(-1px)';
                                             e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                               ? `0 6px 12px ${projectConfig.primary_color}4d` 
                                               : '0 6px 12px var(--primary-shadow)';
                                           }}
                                           onMouseOut={e => {
                                             e.currentTarget.style.transform = 'translateY(0)';
                                             e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                               ? `0 4px 10px ${projectConfig.primary_color}33` 
                                               : '0 4px 10px var(--primary-shadow)';
                                           }}
                                        >
                                           Apply Results
                                        </button>
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
                        );
                     } else {
                        return (
                           <div style={{ textAlign: 'center', padding: '1.25rem', background: 'var(--background)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>No relevant machine pulse found for this investigation profile.</p>
                           </div>
                        );
                     }
                  })()}
               </div>
            )}

            <form onSubmit={handleSaveGroupResults} className="fade-in">
               <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '2rem' }}>
                      <p style={{ fontSize: '0.9375rem', fontWeight: 950, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
                           Verification Desk
                      </p>
                      
                      {selectedRequestGroup.requests.map(req => {
                         const activeSubTests = req.test_master_details?.sub_tests?.filter(st => st.is_active) || [];
                         if (activeSubTests.length === 0) return null;
                         const isCompleted = req.status === 'COMPLETED';

                         return (
                            <div key={req.id} style={{ marginBottom: '1.75rem' }}>
                               <div style={{ fontSize: '0.75rem', fontWeight: 950, color: 'var(--primary)', marginBottom: '0.6rem', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                     <span style={{ width: '3px', height: '12px', borderRadius: '2px', background: 'var(--primary)' }}></span>
                                     {req.test_name}
                                  </span>
                                  <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: 800 }}>Status: {req.status}</span>
                                </div>
                               
                               <div className="table-responsive" style={{ borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                     <thead>
                                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                                           <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase' }}>Sub-Test</th>
                                           <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase' }}>Value</th>
                                           <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase' }}>Units</th>
                                           <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-main)', textTransform: 'uppercase' }}>Reference Range</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                 {activeSubTests.map(st => {
                                    const val = resultData.values[st.name];
                                    const hasData = val !== undefined && val !== '';
                                    return (
                                             <tr key={st.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: 900, color: hasData ? 'var(--text-main)' : '#94a3b8' }}>
                                                   {isCompleted ? (
                                                      <span>{val || '---'}</span>
                                                   ) : (
                                                      <input 
                                                         type="text" 
                                                         value={val || ''} 
                                                         onChange={e => {
                                                            const updatedValues = { ...resultData.values, [st.name]: e.target.value };
                                                            setResultData({ ...resultData, values: updatedValues });
                                                         }}
                                                         placeholder="---"
                                                         style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderBottom: '1px dashed var(--border)',
                                                            color: 'var(--text-main)',
                                                            fontWeight: 900,
                                                            fontSize: '1rem',
                                                            width: '80px',
                                                            outline: 'none',
                                                            padding: '2px'
                                                         }}
                                                      />
                                                   )}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>{st.units || '--'}</td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>{st.biological_range || '--'}</td>
                                             </tr>
                                    );
                                 })}
                                     </tbody>
                                  </table>
                                </div>
                            </div>
                         );
                      })}

                      {groupSupportsAttachments && hasPending && (
                        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: projectConfig?.primary_color || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                            File Attachment (X-Ray / Scan / PDF Report)
                          </label>
                          {/* Render existing attachments list */}
                          {resultData.attachments && resultData.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                              {resultData.attachments.map((file, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {file.type?.startsWith('image/') ? (
                                      <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                    ) : (
                                      <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                        <FileText size={18} color="var(--primary)" />
                                      </div>
                                    )}
                                    <div>
                                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, wordBreak: 'break-all' }}>{file.name}</p>
                                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const updated = resultData.attachments.filter((_, i) => i !== idx);
                                      setResultData({ ...resultData, attachments: updated });
                                    }}
                                    style={{ border: 'none', background: '#fef2f2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dropzone for adding files */}
                          <div 
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const newFiles = Array.from(e.dataTransfer.files);
                                setResultData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newFiles] }));
                              }
                            }}
                            style={{ 
                              border: '2px dashed var(--border)', 
                              borderRadius: '16px', 
                              padding: resultData.attachments?.length > 0 ? '1.25rem' : '2rem 1.5rem', 
                              textAlign: 'center', 
                              background: 'var(--background)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => document.getElementById('lab-file-input').click()}
                          >
                            <input 
                              type="file" 
                              id="lab-file-input" 
                              style={{ display: 'none' }} 
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  const newFiles = Array.from(e.target.files);
                                  setResultData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newFiles] }));
                                }
                              }}
                              accept="image/*,application/pdf"
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                              <Upload size={24} color={projectConfig?.primary_color || 'var(--primary)'} />
                              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                                Drag & drop files here, or <span style={{ color: projectConfig?.primary_color || 'var(--primary)' }}>browse</span>
                              </p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
                                Upload one or more files (images, X-Rays, scans, or PDFs)
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: projectConfig?.primary_color || 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Interpretation</label>
                          <textarea 
                              rows="2" value={resultData.interpretation} 
                              onChange={e => setResultData({...resultData, interpretation: e.target.value})} 
                              placeholder="Diagnostic summary..."
                          ></textarea>
                      </div>

                      {hasPending ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                              <button 
                                 type="submit" 
                                 className="btn btn-primary" 
                                 disabled={isSubmitting}
                                 style={{ 
                                   width: 'auto', 
                                   padding: '0.75rem 2.5rem', 
                                   border: 'none',
                                   background: isSubmitting 
                                     ? 'var(--text-muted)' 
                                     : (projectConfig?.primary_color 
                                        ? `linear-gradient(135deg, ${projectConfig.primary_color} 0%, ${projectConfig.secondary_color || projectConfig.primary_color} 100%)` 
                                        : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'), 
                                   borderRadius: '16px', 
                                   color: 'white',
                                   fontWeight: 900,
                                   fontSize: '0.9375rem',
                                   cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                   transition: 'all 0.3s ease',
                                   boxShadow: isSubmitting 
                                     ? 'none' 
                                     : (projectConfig?.primary_color 
                                        ? `0 10px 15px -3px ${projectConfig.primary_color}4d` 
                                        : '0 10px 15px -3px var(--primary-shadow)'),
                                   opacity: isSubmitting ? 0.7 : 1
                                 }}
                                 onMouseOver={e => {
                                   if (!isSubmitting) {
                                     e.currentTarget.style.transform = 'translateY(-1px)';
                                     e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                       ? `0 12px 20px -3px ${projectConfig.primary_color}66` 
                                       : '0 12px 20px -3px var(--primary-shadow)';
                                   }
                                 }}
                                 onMouseOut={e => {
                                   if (!isSubmitting) {
                                     e.currentTarget.style.transform = 'translateY(0)';
                                     e.currentTarget.style.boxShadow = projectConfig?.primary_color 
                                       ? `0 10px 15px -3px ${projectConfig.primary_color}4d` 
                                       : '0 10px 15px -3px var(--primary-shadow)';
                                   }
                                 }}
                              >
                                  {isSubmitting ? 'Transmitting...' : 'Finalize & Transmit'}
                              </button>
                          </div>
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
