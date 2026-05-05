import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Pill, Search, X, CheckCircle, Package, ArrowRight, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Pharmacy = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPresc, setSelectedPresc] = useState(null);
  const [dispenseData, setDispenseData] = useState({ quantity: 1, remarks: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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
        perDay = freq.split('-').reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else {
        const map = { 'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'SOS': 1, 'HS': 1, 'STAT': 1 };
        perDay = map[freq] || 1;
    }
    return perDay * (parseInt(dur) || 0);
  };

  const [pharmacyInventory, setPharmacyInventory] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  useEffect(() => {
    fetchPrescriptions();
    fetchPharmacyInventory();
  }, [user]);

  const fetchPharmacyInventory = async () => {
    setIsInventoryLoading(true);
    try {
      const projectId = user?.project?.id || user?.project;
      
      // Strict: Only fetch data that is categorized as CLINICAL_DRUGS or PHARMACY
      const endpoint = `patients/registry-data/?all=true&page_size=2000&type_category=CLINICAL_DRUGS,PHARMACY&registry_type__slug=pharmacy,pharmacy_drugs,pharmacy_inventory${projectId ? `&project=${projectId}` : ''}`;
        
      const res = await api.get(endpoint);
      const data = res.data.results || res.data;
      
      console.log(`[Pharmacy Debug] Project: ${projectId} | Items Fetched: ${data.length}`);
      if (data.length > 0) {
          // Log the name and the slug to see exactly what we got
          console.log(`[Pharmacy Debug] First 5 entries:`, data.slice(0, 5).map(d => `${d.name} (Type:${d.registry_type_slug})`));
      }
      
      setPharmacyInventory(data);
    } catch (err) {
      console.error("Stock sync offline:", err);
    } finally {
      setIsInventoryLoading(false);
    }
  };

  const getInventoryStock = (medName, projectId) => {
    if (!medName || !pharmacyInventory.length) return "0 items";
    
    const search = medName.trim().toLowerCase();
    
    // DEBUG: Log the search and the first few items to see if they match
    console.log(`[Pharmacy Debug] Searching for: "${search}" in Project: ${projectId}`);
    
    const item = pharmacyInventory.find(d => {
      const regProj = d.registry_type_project;
      const isProjectMatch = !regProj || String(regProj) === String(projectId);
      
      const dName = d.name.trim().toLowerCase();
      const match = dName === search;
      
      if (match) {
        console.log(`[Pharmacy Debug] MATCH FOUND: ${d.name} (Project: ${regProj})`);
      }
      
      return isProjectMatch && match;
    });

    return item ? `${item.quantity} items` : "0 items";
  };

  const fetchPrescriptions = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get(`pharmacy/prescriptions/?status=PENDING&page=${pageNum}`);
      
      const results = res.data.results || res.data;
      const count = res.data.count || res.data.length;

      // Group by VisitID
      const grouped = results.reduce((acc, curr) => {
        if (!acc[curr.visit_id]) {
            acc[curr.visit_id] = {
                visit_id: curr.visit_id,
                patient_name: curr.patient_name,
                uhid: curr.uhid,
                project_id: curr.project_id,
                items: []
            };
        }
        acc[curr.visit_id].items.push(curr);
        return acc;
      }, {});

      setPrescriptions(Object.values(grouped));
      setTotalCount(count);
      setPage(pageNum);
    } catch (err) {
      toast.error("Failed to fetch medication queue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispenseVisit = async (visitId) => {
    const loadingToast = toast.loading('Finalizing dispensing for all items...');
    try {
        const visitGroup = prescriptions.find(p => p.visit_id === visitId);
        
        // Dispense each medication with its correctly calculated dose count
        const dispensePromises = visitGroup.items.map(item => {
            const isDayBased = ['TABLETS', 'CAPSULES', 'GENERAL'].includes(item.item_group?.toUpperCase()) || !item.item_group;
            const calculatedQty = isDayBased 
                ? getDoseCount(item.frequency, item.duration, item.item_group) 
                : (item.total_units || 1);
            return api.post(`pharmacy/prescriptions/${item.id}/dispense/`, {
                ...dispenseData,
                quantity: calculatedQty
            });
        });

        await Promise.all(dispensePromises);
        
        toast.success("Visit complete! Patient discharged.", { id: loadingToast });
        setSelectedPresc(null);
        setDispenseData({ quantity: 1, remarks: '' });
        fetchPrescriptions();
    } catch (e) {
        console.error(e.response?.data);
        toast.error("Dispensing failed", { id: loadingToast });
    }
  };

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Pharmacy Dispensary</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage medication issuance and patient counseling</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPresc ? '1fr 1fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Prescription List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Active Prescriptions ({totalCount})</h3>
             <Pill size={18} color="#94a3b8" />
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
                {prescriptions.map(p => (
                  <tr key={p.visit_id}>
                    <td style={{ padding: '1.25rem' }}>
                       <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.patient_name}</p>
                       <p style={{ fontSize: '0.625rem', color: '#64748b' }}>UHID: #{p.uhid}</p>
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
                ))}
                {!isLoading && prescriptions.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
                       <CheckCircle size={40} style={{ marginBottom: '1rem', opacity: 0.1 }} />
                       <p>All medications have been dispensed.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalCount > 10 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Page {page}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="btn btn-secondary" disabled={page === 1} onClick={() => fetchPrescriptions(page - 1)}
                        style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        className="btn btn-secondary" disabled={page * 10 >= totalCount} onClick={() => fetchPrescriptions(page + 1)}
                        style={{ padding: '0.25rem 0.5rem', opacity: page * 10 >= totalCount ? 0.5 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Issuance Form */}
        {selectedPresc && (
          <div className="card fade-in" style={{ borderRadius: '24px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '12px' }}>
                     <Package size={24} color="white" />
                  </div>
                  <div>
                     <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Dispense Medication</h2>
                     <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Patient Receipt for <strong>{selectedPresc.patient_name}</strong></p>
                  </div>
               </div>
               <button onClick={() => setSelectedPresc(null)} style={{ border: 'none', background: 'var(--background)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>
                  <X size={16} />
               </button>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem' }}>
               <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem' }}>Active Prescription List</p>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {selectedPresc.items.map(item => (
                       <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                           <div>
                               <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.medication_name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                   {item.frequency} | {item.duration} days
                                   <span style={{ background: 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                       Total: {(['TABLETS', 'CAPSULES', 'GENERAL'].includes(item.item_group?.toUpperCase()) || !item.item_group) 
                                               ? getDoseCount(item.frequency, item.duration, item.item_group) 
                                               : (item.total_units || 1)} units
                                   </span>
                                   <span style={{ 
                                       marginLeft: 'auto',
                                       color: (typeof getInventoryStock(item.medication_name, item.project_id) === 'string' && getInventoryStock(item.medication_name, item.project_id).includes('Sync')) ? '#64748b' : 
                                              (parseInt(getInventoryStock(item.medication_name, item.project_id)) >= ((['TABLETS', 'CAPSULES', 'GENERAL'].includes(item.item_group?.toUpperCase()) || !item.item_group) ? getDoseCount(item.frequency, item.duration, item.item_group) : (item.total_units || 1)) ? '#10b981' : '#ef4444'), 
                                       fontWeight: 800,
                                       fontSize: '0.6875rem',
                                       background: 'var(--surface)',
                                       padding: '2px 8px',
                                       borderRadius: '6px',
                                       border: '1px solid #e9d5ff'
                                   }}>
                                       In Stock: {getInventoryStock(item.medication_name, item.project_id)}
                                   </span>
                               </p>
                           </div>
                           <CheckCircle size={18} color="#10b981" />
                       </div>
                   ))}
               </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleDispenseVisit(selectedPresc.visit_id); }}>
               <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <label>Pharmacist Notes / Counseling</label>
                  <textarea rows="3" onChange={e => setDispenseData({...dispenseData, remarks: e.target.value})} placeholder="Caution: Take after food. Avoid driving..."></textarea>
               </div>

               <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <AlertCircle size={20} color="#854d0e" />
                  <p style={{ fontSize: '0.75rem', color: '#854d0e', fontWeight: 500 }}>Confirming this will finalize the patient visit and mark all items as dispensed.</p>
               </div>

               <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1.125rem', background: '#4c1d95', borderColor: '#4c1d95', fontSize: '1rem' }}>
                  Dispense All & Finalize <ArrowRight size={18} style={{ marginLeft: '10px' }} />
               </button>
            </form>
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
