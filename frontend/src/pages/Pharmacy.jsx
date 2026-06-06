import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Pill, Search, X, CheckCircle, Package, ArrowRight, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Pharmacy = () => {
  const { user } = useAuth();
  const [projectConfig, setProjectConfig] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPresc, setSelectedPresc] = useState(null);
  const [outOfStockItems, setOutOfStockItems] = useState({});
  const [dispenseData, setDispenseData] = useState({ remarks: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage] = useState(100);
  const [isDispensing, setIsDispensing] = useState(false);

  const getDoseCount = (freq, dur, itemGroup = "") => {
    if (!freq || !dur) return 0;

    // MNC Standard Logic: Only Tablets and Capsules follow frequency-based multiplication
    const isDayBased = ['TABLETS', 'CAPSULES', 'GENERAL'].includes(itemGroup?.toUpperCase()) || !itemGroup;

    if (!isDayBased) {
        // For Syrups, Ointments, Liquids, etc., the 'Duration' field is treated as 'Total Units/Bottles'
        return parseInt(dur) || 1;
    }

    let perDay = 0;
    if (freq.includes('-')) {
        perDay = freq.split('-').reduce((sum, val) => {
            const clean = val.trim();
            let parsed = parseFloat(clean) || 0;
            if (clean === '1/2') parsed = 0.5;
            return sum + parsed;
        }, 0);
    } else {
        const map = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 };
        perDay = map[freq] || 1;
    }
    return Math.ceil(perDay * (parseInt(dur) || 0));
  };

  const [pharmacyInventory, setPharmacyInventory] = useState([]);

  useEffect(() => {
    fetchPrescriptionsAndInventory();
    if (user?.project) {
      fetchProjectConfig(user.project.id || user.project);
    } else {
      setProjectConfig(null);
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPrescriptionsAndInventory(searchTerm, true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [searchTerm, selectedPresc]);

  const [showRevertSection, setShowRevertSection] = useState(false);
  const [revertNote, setRevertNote] = useState('');
  const [isReverting, setIsReverting] = useState(false);
  const [toggleHovered, setToggleHovered] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);

  useEffect(() => {
    if (selectedPresc) {
      fetchStockForPresc(selectedPresc);
      setShowRevertSection(false);
      setRevertNote('');
    } else {
      setPharmacyInventory([]);
    }
  }, [selectedPresc]);

  const fetchProjectConfig = async (projectId) => {
    try {
        const res = await api.get(`patients/projects/${projectId}/`);
        setProjectConfig(res.data);
    } catch (err) {
        console.error("Failed to fetch project config:", err);
    }
  };

  const fetchStockForPresc = async (presc) => {
    if (!presc || !presc.items.length) {
      setPharmacyInventory([]);
      return;
    }
    const names = presc.items.map(i => i.medication_name).join(',');
    const projectId = user?.project?.id || user?.project;
    const endpoint = `patients/registry-data/?all=true&type_category=CLINICAL_DRUGS,PHARMACY&registry_type__slug=pharmacy,pharmacy_drugs,pharmacy_inventory${projectId ? `&project=${projectId}` : ''}&names=${encodeURIComponent(names)}`;
    try {
        const res = await api.get(endpoint);
        setPharmacyInventory(res.data.results || res.data);
    } catch (e) {
        console.error("Failed to fetch stocks for prescription:", e);
    }
  };

  const fetchPrescriptionsAndInventory = async (search = searchTerm, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const prescRes = await api.get(`pharmacy/prescriptions/?status=PENDING&page_size=1000&search=${encodeURIComponent(search)}`);
      
      const results = prescRes.data.results || prescRes.data;
      const count = prescRes.data.count || prescRes.data.length;
      
      // Group by VisitID maintaining strict FIFO order from backend (No integer object keys sorting)
      const grouped = [];
      const visitMap = {};
      results.forEach(curr => {
        if (!visitMap[curr.visit_id]) {
            const newGroup = {
                visit_id: curr.visit_id,
                patient_name: curr.patient_name,
                uhid: curr.uhid,
                card_no: curr.card_no,
                employee_id: curr.employee_id,
                project_id: curr.project_id,
                is_late_entry: curr.visit_is_late_entry,
                late_entry_justification: curr.visit_late_entry_justification,
                items: []
            };
            grouped.push(newGroup);
            visitMap[curr.visit_id] = newGroup;
        }
        visitMap[curr.visit_id].items.push(curr);
      });
      
      setPrescriptions(grouped);
      setTotalCount(count);

      // Refresh stock for the selected prescription if still open
      if (selectedPresc) {
          const updatedGroup = grouped.find(p => p.visit_id === selectedPresc.visit_id);
          if (updatedGroup) {
              fetchStockForPresc(updatedGroup);
          }
      }

      return grouped;
    } catch (err) {
      if (!isBackground) toast.error("Failed to fetch medication queue");
      return [];
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const handleSmartDispenseClose = async (visitId) => {
    if (isDispensing) return;
    setIsDispensing(true);
    const loadingToast = toast.loading('Processing dispense and discharging patient...');
    try {
        const visitGroup = prescriptions.find(p => p.visit_id === visitId);
        if (!visitGroup || !visitGroup.items.length) {
            setIsDispensing(false);
            toast.dismiss(loadingToast);
            return;
        }

        // 1. Process all dispense and cancel actions
        const promises = visitGroup.items.map(item => {
            const drugObj = pharmacyInventory.find(d => d.name.toLowerCase() === item.medication_name.toLowerCase());
            const isDayBased = ['TABLETS', 'CAPSULES', 'GENERAL'].includes(item.item_group?.toUpperCase()) || !item.item_group;
            const calculatedQty = isDayBased 
                ? getDoseCount(item.frequency, item.duration, item.item_group) 
                : (item.total_units || 1);

            const hasStock = drugObj && drugObj.quantity >= calculatedQty;
            const isMarkedOutOfStock = !!outOfStockItems[item.id];

            if (hasStock && !isMarkedOutOfStock) {
                // Dispense in-stock item
                return api.post(`pharmacy/prescriptions/${item.id}/dispense/`, {
                    ...dispenseData,
                    quantity: calculatedQty
                });
            } else {
                // Mark out-of-stock item
                return api.post(`pharmacy/prescriptions/${item.id}/cancel/`, {
                    remarks: 'Out of Stock'
                });
            }
        });

        await Promise.all(promises);

        // 2. Decoupled Finalization: Safely close the visit after all items are resolved
        const targetPrescriptionId = visitGroup.items[0].id;
        await api.post(`pharmacy/prescriptions/${targetPrescriptionId}/finalize_visit/`);
        
        toast.success("Dispensing complete! Patient discharged successfully.", { id: loadingToast });
        setSelectedPresc(null);
        setOutOfStockItems({});
        setDispenseData({ remarks: '' });
        fetchPrescriptionsAndInventory();
    } catch (e) {
        console.error(e);
        toast.error("Dispensing failed", { id: loadingToast });
    } finally {
        setIsDispensing(false);
    }
  };
  const handleSendBackToDoctor = async () => {
    if (!revertNote.trim()) {
      toast.error("Please enter a reason for sending back to doctor");
      return;
    }
    setIsReverting(true);
    const loadingToast = toast.loading('Sending patient back to doctor...');
    try {
      await api.post(`clinical/visits/${selectedPresc.visit_id}/revert_to_doctor/`, {
        reversion_note: revertNote
      });
      toast.success("Case successfully sent back to doctor.", { id: loadingToast });
      setSelectedPresc(null);
      fetchPrescriptionsAndInventory();
    } catch (e) {
      console.error(e);
      toast.error("Failed to send back to doctor", { id: loadingToast });
    } finally {
      setIsReverting(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    const searchLow = searchTerm.toLowerCase().trim();
    if (!searchLow) return true;

    // Smart card group matching
    const cardMatch = searchLow.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || searchLow.match(/(\d+)(?:\/\d+)?/);
    if (cardMatch) {
      const baseCard = cardMatch[1].padStart(4, '0');
      const pCard = String(p.card_no || '').toLowerCase();
      const pCardMatch = pCard.match(/(?:bhspl)?(\d{4})(?:\/\d+)?/i) || pCard.match(/(\d+)(?:\/\d+)?/);
      if (pCardMatch && pCardMatch[1].padStart(4, '0') === baseCard) {
        return true;
      }
    }

    return (
      p.patient_name?.toLowerCase().includes(searchLow) ||
      String(p.uhid || '').toLowerCase().includes(searchLow) ||
      String(p.card_no || '').toLowerCase().includes(searchLow) ||
      String(p.employee_id || '').toLowerCase().includes(searchLow)
    );
  });

  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPrescriptions = filteredPrescriptions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPrescriptions.length / itemsPerPage);

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Pharmacy Dispensary</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage medication issuance and patient counseling</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPresc ? '1fr 1fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Prescription List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                 <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Active Prescriptions ({filteredPrescriptions.length})</h3>
                 <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Total pending: {totalCount}</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div className="search-container" style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', zIndex: 10 }} />
                    <input
                       type="text"
                       placeholder="Search by Patient/Employee ID, Name, Card No..."
                       value={searchTerm}
                       onChange={e => { const val = e.target.value; setSearchTerm(val); setPage(1); fetchPrescriptionsAndInventory(val); }}
                       className="search-input"
                       style={{ padding: '0.5rem 2rem 0.5rem 2.25rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.75rem', outline: 'none' }}
                    />
                    {searchTerm && (
                       <button 
                          onClick={() => { setSearchTerm(''); setPage(1); fetchPrescriptionsAndInventory(''); }}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                       >
                          <X size={14} />
                       </button>
                    )}
                 </div>
                 <Pill size={18} color="#94a3b8" />
              </div>
          </div>
          
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '1.25rem' }}>Patient Info</th>
                  <th>Medication</th>
                  <th>Instructions</th>
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
                             <Pill size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
                           </div>
                           <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Loading Pharmacy Queue...</p>
                         </div>
                         <style>{`
                           .pulse-loader { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--primary); animation: pulse 1.5s infinite; opacity: 0.5; }
                           @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
                         `}</style>
                      </td>
                    </tr>
                ) : currentPrescriptions.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
                         <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>No prescriptions found</p>
                         <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>Try searching with a different name or ID.</p>
                      </td>
                    </tr>
                 ) : (
                    currentPrescriptions.map(p => (
                  <tr key={p.visit_id}>
                    <td style={{ padding: '1.25rem' }}>
                       <p style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                          {p.patient_name}
                          {p.is_late_entry && (
                            <span 
                              style={{ 
                                marginLeft: '0.5rem', 
                                fontSize: '0.625rem', 
                                background: 'rgba(245, 158, 11, 0.1)', 
                                color: '#d97706', 
                                padding: '0.15rem 0.4rem', 
                                borderRadius: '6px', 
                                fontWeight: 800,
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                verticalAlign: 'middle',
                                display: 'inline-block'
                              }}
                              title={`Justification: ${p.late_entry_justification || 'N/A'}`}
                            >
                              Late Entry
                            </span>
                          )}
                       </p>
                       <p style={{ fontSize: '0.625rem', color: '#64748b' }}>UHID: #{p.uhid}{p.card_no ? ` | Card: ${p.card_no}` : ''}</p>
                    </td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {p.items.length} Medications
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {p.items.map(i => i.medication_name).join(', ').substring(0, 40)}...
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <button className="btn btn-primary" onClick={() => setSelectedPresc(p)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                         Open Case <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Showing <span style={{ color: 'var(--primary)' }}>{indexOfFirstItem + 1}</span> to <span style={{ color: 'var(--primary)' }}>{Math.min(indexOfLastItem, filteredPrescriptions.length)}</span> of {filteredPrescriptions.length} entries
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                      className="btn btn-secondary" 
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      style={{ padding: '0.4rem', borderRadius: '8px', opacity: page === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContents: 'center' }}
                  >
                      <ChevronLeft size={18} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {(() => {
                          if (totalPages <= 1) return null;

                          const buttons = [];
                          const maxVisiblePages = 5;
                          
                          buttons.push(
                              <button 
                                  key={1} 
                                  onClick={() => setPage(1)}
                                  style={{ 
                                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                      background: page === 1 ? 'var(--primary)' : 'transparent',
                                      color: page === 1 ? 'white' : 'var(--text-muted)',
                                      fontWeight: 700, cursor: 'pointer', transition: '0.3s'
                                  }}
                              >
                                  1
                              </button>
                          );

                          let startPage = Math.max(2, page - 1);
                          let endPage = Math.min(totalPages - 1, page + 1);

                          if (page <= 3) {
                              endPage = Math.min(totalPages - 1, maxVisiblePages - 1);
                          }
                          if (page >= totalPages - 2) {
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
                                          onClick={() => setPage(i)}
                                          style={{ 
                                              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                              background: page === i ? 'var(--primary)' : 'transparent',
                                              color: page === i ? 'white' : 'var(--text-muted)',
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

                          if (totalPages > 1) {
                              buttons.push(
                                  <button 
                                      key={totalPages} 
                                      onClick={() => setPage(totalPages)}
                                      style={{ 
                                          width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                                          background: page === totalPages ? 'var(--primary)' : 'transparent',
                                          color: page === totalPages ? 'white' : 'var(--text-muted)',
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
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      style={{ padding: '0.4rem', borderRadius: '8px', opacity: page >= totalPages ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContents: 'center' }}
                  >
                      <ChevronRight size={18} />
                  </button>
              </div>
          </div>
        </div>

        {/* Issuance Form */}
        {selectedPresc && (
          <div className="card fade-in" style={{ borderRadius: '24px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: projectConfig?.primary_color || 'var(--primary)', borderRadius: '12px' }}>
                     <Package size={24} color="white" />
                  </div>
                  <div>
                     <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Dispense Medication</h2>
                     <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Patient Receipt for <strong>{selectedPresc.patient_name}</strong></p>
                  </div>
               </div>
               <button onClick={() => { setSelectedPresc(null); setOutOfStockItems({}); }} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>
                  <X size={16} />
               </button>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem' }}>
               <p style={{ fontSize: '0.625rem', fontWeight: 800, color: projectConfig?.primary_color || 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Active Prescription List</p>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedPresc.items.map(item => {
                        const drugObj = pharmacyInventory.find(d => d.name.toLowerCase() === item.medication_name.toLowerCase());
                        const isDayBased = ['TABLETS', 'CAPSULES', 'GENERAL'].includes(item.item_group?.toUpperCase()) || !item.item_group;
                        const calculatedQty = isDayBased 
                            ? getDoseCount(item.frequency, item.duration, item.item_group) 
                            : (item.total_units || 1);
                        const hasStock = drugObj && drugObj.quantity >= calculatedQty;
                        const isMarkedOutOfStock = !!outOfStockItems[item.id];

                        return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <div style={{ flex: 1, marginRight: '1rem' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.medication_name}</p>
                                     <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '4px' }}>
                                        {item.dosage ? `${item.dosage} | ` : ''}{item.frequency} | {item.duration} days
                                        <span style={{ background: projectConfig?.primary_color || 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                            Total: {calculatedQty} units
                                        </span>
                                        {(() => {
                                            if (drugObj) {
                                                const qty = Math.max(0, drugObj.quantity);
                                                if (drugObj.quantity <= 0) {
                                                    return (
                                                        <span style={{ 
                                                            color: '#ef4444', 
                                                            fontWeight: 800,
                                                            fontSize: '0.6875rem',
                                                            background: '#fef2f2',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #fee2e2'
                                                        }}>
                                                            Out of Stock: 0 remaining
                                                        </span>
                                                    );
                                                }
                                                const initialQty = parseInt(drugObj.additional_fields?.initial_quantity) || 100;
                                                const threshold = Math.max(5, Math.round(initialQty * 0.2));
                                                const isLow = drugObj.quantity <= threshold;
                                                return (
                                                    <span style={{ 
                                                        color: isLow ? '#b45309' : '#10b981', 
                                                        fontWeight: 800,
                                                        fontSize: '0.6875rem',
                                                        background: isLow ? '#fffbeb' : '#f0fdf4',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${isLow ? '#fde68a' : '#dcfce7'}`
                                                    }}>
                                                        {isLow ? `Low Stock (Under 20%): ${qty} remaining` : `In Stock: ${qty} items`}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.6875rem', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                                                    Out of Registry
                                                </span>
                                            );
                                        })()}
                                     </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isMarkedOutOfStock ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ 
                                                color: '#64748b', 
                                                fontWeight: 800,
                                                fontSize: '0.75rem',
                                                background: '#f1f5f9',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                Marked Out of Stock
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={() => setOutOfStockItems(prev => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                })}
                                                style={{ 
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--primary)',
                                                    fontSize: '0.6875rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                Undo
                                            </button>
                                        </div>
                                    ) : !hasStock ? (
                                        <button 
                                            type="button"
                                            onClick={() => setOutOfStockItems(prev => ({ ...prev, [item.id]: true }))}
                                            className="btn btn-secondary"
                                            style={{ 
                                                padding: '0.4rem 0.85rem', 
                                                fontSize: '0.75rem', 
                                                borderRadius: '8px',
                                                background: '#ef4444',
                                                borderColor: '#ef4444',
                                                color: 'white',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                                            }}
                                            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                                        >
                                            Out of Stock
                                        </button>
                                    ) : (
                                        <span style={{ 
                                            color: '#10b981', 
                                            fontWeight: 800,
                                            fontSize: '0.75rem',
                                            background: '#f0fdf4',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            border: '1px solid #dcfce7'
                                        }}>
                                            Auto-Dispensing
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
               </div>
            </div>

             <form onSubmit={(e) => { e.preventDefault(); handleSmartDispenseClose(selectedPresc.visit_id); }}>
                <div className="form-group" style={{ marginBottom: '2rem' }}>
                   <label style={{ color: projectConfig?.primary_color || 'var(--text-main)', fontWeight: 800 }}>Pharmacist Notes / Counseling</label>
                   <textarea rows="3" onChange={e => setDispenseData({...dispenseData, remarks: e.target.value})} placeholder="Caution: Take after food. Avoid driving..."></textarea>
                </div>
 
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                   <CheckCircle size={20} color="#15803d" />
                   <p style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 500 }}>Dispense & Discharge will automatically dispense all in-stock medicines, mark out-of-stock items, and safely discharge the patient.</p>
                </div>
 
                <button type="submit" disabled={isDispensing} className="btn btn-primary" style={{ width: '100%', padding: '1.125rem', background: projectConfig?.primary_color || '#10b981', borderColor: projectConfig?.primary_color || '#10b981', fontSize: '1rem', fontWeight: 800, opacity: isDispensing ? 0.7 : 1, cursor: isDispensing ? 'not-allowed' : 'pointer' }}>
                   {isDispensing ? 'Processing Dispensation...' : 'Dispense & Discharge Patient'} <ArrowRight size={18} style={{ marginLeft: '10px' }} />
                </button>
             </form>

              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border)' }}>
                 <button
                    type="button"
                    onClick={() => setShowRevertSection(!showRevertSection)}
                    style={{ 
                       width: '100%', 
                       padding: '0.75rem 1.25rem', 
                       border: '1.5px solid #fca5a5', 
                       color: '#dc2626', 
                       background: toggleHovered ? '#fff5f5' : 'transparent', 
                       fontSize: '0.8125rem', 
                       fontWeight: 800,
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '8px',
                       borderRadius: '12px',
                       transition: 'all 0.2s ease',
                       boxShadow: toggleHovered ? '0 4px 12px rgba(220, 38, 38, 0.05)' : 'none'
                    }}
                    onMouseEnter={() => setToggleHovered(true)}
                    onMouseLeave={() => setToggleHovered(false)}
                 >
                    <AlertCircle size={16} /> {showRevertSection ? 'Hide Send Back Form' : 'Send Back to Doctor (Request Edit)'}
                 </button>
 
                 {showRevertSection && (
                   <div className="fade-in" style={{ marginTop: '1rem', padding: '1.25rem', background: '#fffcfc', border: '1px solid #fecaca', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.04), 0 8px 10px -6px rgba(220, 38, 38, 0.04)' }}>
                       <label style={{ color: '#991b1b', fontWeight: 900, fontSize: '0.7rem', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason / Correction Needed</label>
                       <textarea
                          rows="3"
                          value={revertNote}
                          onChange={e => setRevertNote(e.target.value)}
                          placeholder="Explain what needs to be changed (e.g. out of stock, dosage clarification...)"
                          style={{ 
                             width: '100%', 
                             padding: '0.75rem 1rem', 
                             borderRadius: '12px', 
                             border: textareaFocused ? '1.5px solid #f87171' : '1.5px solid var(--border)',
                             boxShadow: textareaFocused ? '0 0 0 4px rgba(220, 38, 38, 0.08)' : 'none',
                             background: 'var(--surface)',
                             color: 'var(--text-main)',
                             fontSize: '0.8125rem', 
                             marginBottom: '0.75rem',
                             outline: 'none',
                             fontFamily: 'inherit',
                             transition: 'all 0.2s ease',
                             resize: 'vertical',
                             minHeight: '80px'
                          }}
                          onFocus={() => setTextareaFocused(true)}
                          onBlur={() => setTextareaFocused(false)}
                       ></textarea>
                       <button
                          type="button"
                          onClick={handleSendBackToDoctor}
                          disabled={isReverting}
                          style={{ 
                             width: '100%', 
                             padding: '0.875rem', 
                             background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                             color: 'white', 
                             border: 'none', 
                             borderRadius: '12px', 
                             fontSize: '0.8125rem', 
                             fontWeight: 800, 
                             cursor: isReverting ? 'not-allowed' : 'pointer',
                             opacity: isReverting ? 0.7 : 1,
                             boxShadow: confirmHovered ? '0 6px 16px rgba(220, 38, 38, 0.35)' : '0 4px 12px rgba(220, 38, 38, 0.25)',
                             transform: confirmHovered && !isReverting ? 'translateY(-1px)' : 'none',
                             transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={() => setConfirmHovered(true)}
                          onMouseLeave={() => setConfirmHovered(false)}
                       >
                          {isReverting ? 'Sending Back...' : 'Confirm Send Back to Doctor'}
                       </button>
                   </div>
                 )}
              </div>
          </div>
        )}
      </div>

      <style>{`
         input, textarea { border-radius: 12px !important; }
      `}</style>
    </div>
  );
};

export default Pharmacy;
