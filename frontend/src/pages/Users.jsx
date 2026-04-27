import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { UserPlus, Search, UserCheck, Shield, Trash2, Edit, X, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Check, ShieldCheck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [projects, setProjects] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editingUserRoles, setEditingUserRoles] = useState(null);
    const [tempUserRoles, setTempUserRoles] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [formData, setFormData] = useState({
        username: '', email: '', password: '', role: 'NURSE', first_name: '', last_name: '', phone: '', user_roles: [], project: ''
    });
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [viewMode, setViewMode] = useState('CLINICAL');
    const [statusFilter, setStatusFilter] = useState('ACTIVE');
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [availablePatients, setAvailablePatients] = useState([]);
    const [provisionSearch, setProvisionSearch] = useState('');
    const [selectedPatients, setSelectedPatients] = useState([]);
    const [isProvisioning, setIsProvisioning] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
        fetchProjects();
    }, []);

    const fetchUsers = async (pageNum = 1) => {
        try {
            // Increase page_size to 100 to show more users at once
            const res = await api.get(`accounts/users/?page=${pageNum}&page_size=100`);
            if (res.data.results) {
                setUsers(res.data.results);
                setTotalCount(res.data.count);
            } else {
                setUsers(res.data);
                setTotalCount(res.data.length);
            }
            setPage(pageNum);
        } catch (err) {
            toast.error("Failed to load users");
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('accounts/user-roles/');
            setRoles(res.data.results || res.data);
        } catch (err) {
            console.error("Failed to load roles");
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await api.get('patients/projects/');
            setProjects(res.data.results || res.data);
        } catch (err) {
            console.error("Failed to load projects");
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                email: user.email,
                role: user.role,
                first_name: user.first_name,
                last_name: user.last_name,
                phone: user.phone || '',
                user_roles: user.user_roles || [],
                project: user.project || '',
                password: '' // Keep empty unless changing
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '', email: '', password: '', role: 'NURSE', first_name: '', last_name: '', phone: '', user_roles: [], project: ''
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const loadingToast = toast.loading(editingUser ? 'Updating user...' : 'Creating staff member...');
        try {
            if (editingUser) {
                // For editing, we might need a specific patch endpoint if it's not DRF modelviewset default 
                await api.put(`accounts/users/${editingUser.id}/`, formData);
                toast.success("User updated successfully", { id: loadingToast });
            } else {
                await api.post('accounts/register/', formData);
                toast.success("User created successfully", { id: loadingToast });
            }
            setShowModal(false);
            fetchUsers();
        } catch (err) {
            toast.error(editingUser ? "Failed to update user" : "Error creating user", { id: loadingToast });
        }
    };

    const handleDelete = async () => {
        const loadingToast = toast.loading('Removing user access...');
        try {
            await api.delete(`accounts/users/${confirmDelete.id}/`);
            toast.success("User deleted successfully", { id: loadingToast });
            setConfirmDelete(null);
            fetchUsers(page);
        } catch (err) {
            toast.error("Error deleting user", { id: loadingToast });
        }
    };

    const handleToggleStatus = async (user) => {
        const loadingToast = toast.loading(user.is_active ? 'Disabling access...' : 'Activating user...');
        try {
            await api.patch(`accounts/users/${user.id}/`, { is_active: !user.is_active });
            toast.success(`User ${!user.is_active ? 'activated' : 'deactivated'} successfully`, { id: loadingToast });
            fetchUsers(page);
        } catch (err) {
            toast.error("Failed to update status", { id: loadingToast });
        }
    };

    const fetchAvailablePatients = async () => {
        try {
            // Increase limit to 1000 to see more patients in the provisioning list
            const res = await api.get('patients/patients/?limit=1000');
            // Filter only those who don't have an active portal account yet
            const data = res.data.results || res.data; // Handle both paginated and non-paginated
            const unprovisioned = data.filter(p => p.portal_status === 'DISABLED');
            setAvailablePatients(unprovisioned);
        } catch (err) {
            console.error("Failed to fetch registry");
        }
    };

    const handleEnablePortal = async (patientId) => {
        setIsProvisioning(patientId);
        const loading = toast.loading("Provisioning Portal Credentials...");
        try {
            await api.post(`patients/patients/${patientId}/enable_portal/`);
            toast.success("Portal Access Enabled!", { id: loading });
            fetchUsers(page);
            fetchAvailablePatients();
        } catch (err) {
            toast.error(err.response?.data?.error || "Provisioning failed", { id: loading });
        } finally {
            setIsProvisioning(null);
        }
    };

    const handleBulkEnablePortal = async () => {
        if (selectedPatients.length === 0) return;
        setIsProvisioning('BULK');
        const loading = toast.loading(`Provisioning ${selectedPatients.length} accounts...`);
        try {
            await api.post('patients/patients/bulk_enable_portal/', { patient_ids: selectedPatients });
            toast.success(`Access granted for ${selectedPatients.length} patients!`, { id: loading });
            setSelectedPatients([]);
            setShowProvisionModal(false);
            fetchUsers(page);
        } catch (err) {
            toast.error("Bulk provisioning failed", { id: loading });
        } finally {
            setIsProvisioning(null);
        }
    };

    const handleUserRoleSave = async (userId) => {
        const loadingToast = toast.loading('Updating user roles...');
        try {
            await api.patch(`accounts/users/${userId}/`, { user_roles: tempUserRoles });
            toast.success("Roles updated successfully", { id: loadingToast });
            setEditingUserRoles(null);
            fetchUsers(page);
        } catch (err) {
            toast.error("Failed to update roles", { id: loadingToast });
        }
    };

    return (
        <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Staff Directory</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Full management of clinical and administrative access</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        {['ACTIVE', 'INACTIVE'].map(s => (
                            <button 
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                style={{ 
                                    padding: '0.4rem 1rem', borderRadius: '8px', border: 'none',
                                    background: statusFilter === s ? 'var(--primary)' : 'transparent',
                                    color: statusFilter === s ? 'white' : 'var(--text-muted)',
                                    fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', transition: '0.3s'
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    {viewMode === 'PATIENTS' && (
                        <button 
                            className="btn btn-primary" 
                            style={{ 
                                background: '#f59e0b', 
                                borderColor: '#f59e0b', 
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                                cursor: 'pointer',
                                zIndex: 1000 // Ensure it's clickable
                            }}
                            onClick={() => {
                                console.log("Provision Button Clicked");
                                setProvisionSearch('');
                                setSelectedPatients([]);
                                fetchAvailablePatients();
                                setShowProvisionModal(true);
                            }}
                        >
                            <ShieldCheck size={20} /> Authorize New Access
                        </button>
                    )}
                    {viewMode !== 'PATIENTS' && (
                        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                            <UserPlus size={20} /> Add Staff Member
                        </button>
                    )}
                </div>
            </header>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '2rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    {[
                        { id: 'CLINICAL', label: 'Clinical Team', roles: ['DOCTOR', 'NURSE', 'LAB_TECH'] },
                        { id: 'MANAGEMENT', label: 'Admin & Operations', roles: ['ADMIN', 'DEO', 'PHARMACIST'] },
                        { id: 'PATIENTS', label: 'Patient Portal Users', roles: ['PATIENT'] }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setViewMode(tab.id)}
                            style={{ 
                                padding: '1rem 0.5rem', background: 'none', border: 'none',
                                borderBottom: viewMode === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                                fontWeight: 800, color: viewMode === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', textTransform: 'uppercase'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ padding: '1rem 1.5rem' }}>Staff Member</th>
                                <th>Designation</th>
                                <th>Contact Details</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.filter(u => {
                                // First Filter by Status
                                const matchesStatus = statusFilter === 'ACTIVE' ? u.is_active : !u.is_active;
                                if (!matchesStatus) return false;

                                // Then Filter by Tab
                                if (viewMode === 'CLINICAL') return ['DOCTOR', 'NURSE', 'LAB_TECH'].includes(u.role);
                                if (viewMode === 'MANAGEMENT') return ['ADMIN', 'DEO', 'PHARMACIST'].includes(u.role);
                                if (viewMode === 'PATIENTS') return u.role === 'PATIENT';
                                return true;
                            }).map(u => (
                                <tr key={u.id}>
                                    <td style={{ padding: '1.25rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ 
                                                width: '44px', height: '44px', 
                                                background: u.role === 'ADMIN' ? '#fee2e2' : '#e0e7ff', 
                                                color: u.role === 'ADMIN' ? '#991b1b' : '#4338ca', 
                                                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                fontWeight: 800, fontSize: '1rem' 
                                            }}>
                                                {u.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>{u.first_name} {u.last_name || '(No Name)'}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {u.role === 'PATIENT' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            ID: {u.username}
                                                        </span>
                                                    )}
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Joined {new Date(u.date_joined).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        {viewMode === 'PATIENTS' ? (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>Patient</span>
                                                {u.is_password_set ? (
                                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <CheckCircle size={10} /> Active Portal
                                                    </span>
                                                ) : (
                                                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={10} /> Provisioned
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            editingUserRoles === u.id ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxWidth: '300px' }}>
                                                {roles.filter(r => {
                                                    if (u.role === 'PATIENT') return r.name === 'PATIENT';
                                                    return r.name !== 'PATIENT';
                                                }).map(r => {
                                                    const isChecked = tempUserRoles.includes(r.id);
                                                    return (
                                                        <label key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.3rem 0.5rem', background: isChecked ? 'rgba(16, 185, 129, 0.1)' : 'white', border: `1px solid ${isChecked ? '#10b981' : '#e2e8f0'}`, borderRadius: '6px', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 600 }}>
                                                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: `1px solid ${isChecked ? '#10b981' : '#94a3b8'}`, background: isChecked ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                                {isChecked && <Check size={8} strokeWidth={4} />}
                                                            </div>
                                                            <span style={{ color: isChecked ? '#047857' : '#475569' }}>{r.name}</span>
                                                            <input type="checkbox" hidden checked={isChecked} onChange={(e) => {
                                                                setTempUserRoles(e.target.checked ? [...tempUserRoles, r.id] : tempUserRoles.filter(id => id !== r.id));
                                                            }} />
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '280px' }}>
                                                {u.user_roles_details?.length > 0 ? (
                                                    u.user_roles_details.map(ur => (
                                                        <span key={ur.id} className="badge" style={{ background: 'var(--background)', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.625rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border)' }}>
                                                            {ur.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="badge" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: 800, fontSize: '0.625rem', padding: '0.3rem 0.6rem' }}>
                                                        No Access Roles
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-main)' }}>{u.email}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.phone || 'No phone'}</div>
                                    </td>
                                    <td>
                                        <button 
                                            onClick={() => handleToggleStatus(u)}
                                            style={{ 
                                                display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: '0.4rem 0.6rem', borderRadius: '8px',
                                                transition: '0.2s',
                                                outline: 'none'
                                            }}
                                            className="status-toggle-btn"
                                            title={u.is_active ? "Click to Deactivate" : "Click to Activate"}
                                        >
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444' }}></div>
                                            <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                                                {u.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </button>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                        {editingUserRoles === u.id ? (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button className="btn btn-secondary" style={{ padding: '0.45rem', borderRadius: '10px' }} onClick={() => setEditingUserRoles(null)}>
                                                    <X size={16} />
                                                </button>
                                                <button className="btn btn-primary" style={{ padding: '0.45rem', borderRadius: '10px', background: '#10b981', borderColor: '#10b981' }} onClick={() => handleUserRoleSave(u.id)}>
                                                    <Check size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
                                                {viewMode !== 'PATIENTS' && (
                                                    <>
                                                        <button className="btn btn-secondary" title="Manage Roles" style={{ padding: '0.45rem', borderRadius: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }} onClick={() => { setEditingUserRoles(u.id); setTempUserRoles((u.user_roles || [])); }}>
                                                            <Shield size={16} />
                                                        </button>
                                                        <button className="btn btn-secondary" title="Edit Profile" style={{ padding: '0.45rem', borderRadius: '10px' }} onClick={() => handleOpenModal(u)}>
                                                            <Edit size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                <button className="btn btn-secondary" title="Revoke Access" style={{ padding: '0.45rem', borderRadius: '10px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => setConfirmDelete(u)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {totalCount > 10 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(totalCount / 10)}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-secondary" disabled={page === 1} onClick={() => fetchUsers(page - 1)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page === 1 ? 0.5 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                className="btn btn-secondary" disabled={page >= Math.ceil(totalCount / 10)} onClick={() => fetchUsers(page + 1)}
                                style={{ padding: '0.25rem 0.5rem', opacity: page >= Math.ceil(totalCount / 10) ? 0.5 : 1 }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Registration/Edit Modal */}
            {showModal && createPortal(
                <div style={{ 
                    position: 'fixed', 
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255, 255, 255, 0.85)', 
                    backdropFilter: 'blur(12px)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'flex-start', 
                    zIndex: 10000, 
                    padding: '80px 1rem 40px 1rem',
                    overflowY: 'auto'
                }}>
                    <div className="card fade-in" style={{ 
                        width: '100%', 
                        maxWidth: '560px', 
                        padding: 0, 
                        borderRadius: '32px', 
                        background: 'white', 
                        border: '1px solid var(--border)', 
                        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
                        position: 'relative'
                    }}>
                        {/* Header Section */}
                        <div style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                                        {editingUser ? 'Update Staff Profile' : 'Add Staff Member'}
                                    </h2>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                                        Configure credentials and access roles
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)} 
                                style={{ 
                                    border: 'none', 
                                    background: '#f1f5f9', 
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

                        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div className="form-group">
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>First Name</label>
                                    <input 
                                        required 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px' }}
                                        value={formData.first_name} 
                                        onChange={e => setFormData({...formData, first_name: e.target.value})} 
                                        placeholder="e.g. David" 
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Last Name</label>
                                    <input 
                                        required 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px' }}
                                        value={formData.last_name} 
                                        onChange={e => setFormData({...formData, last_name: e.target.value})} 
                                        placeholder="e.g. Miller" 
                                    />
                                </div>

                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Username (Login ID)</label>
                                    <input 
                                        required 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px' }}
                                        value={formData.username} 
                                        disabled={!!editingUser} 
                                        onChange={e => setFormData({...formData, username: e.target.value})} 
                                        placeholder="e.g. dmiller2024" 
                                    />
                                </div>

                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Email Address</label>
                                    <input 
                                        type="email" 
                                        required 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px' }}
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        placeholder="dmiller@clinic.com" 
                                    />
                                </div>

                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Assigned Project Facility</label>
                                    <select 
                                        required 
                                        className="form-control"
                                        style={{ height: '52px', borderRadius: '16px' }}
                                        value={formData.project} 
                                        onChange={e => setFormData({...formData, project: e.target.value})}
                                    >
                                        <option value="">-- Select Project Facility --</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                {!editingUser ? (
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Temporary Password</label>
                                        <input 
                                            type="password" 
                                            required 
                                            className="form-control"
                                            style={{ height: '52px', borderRadius: '16px' }}
                                            onChange={e => setFormData({...formData, password: e.target.value})} 
                                            placeholder="••••••••" 
                                        />
                                    </div>
                                ) : (
                                    <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                            Editing user permissions. Security identifiers are locked.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setShowModal(false)} 
                                    style={{ padding: '0.75rem 2rem', borderRadius: '16px', fontWeight: 800 }}
                                >
                                    Cancel
                                </button>
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
                                >
                                    {editingUser ? 'Save Updates' : 'Confirm Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation */}
            {confirmDelete && createPortal(
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.4)', 
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    zIndex: 10000 
                }}>
                    <div className="card fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2.5rem', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
                        <div style={{ 
                             width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', 
                             borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                             margin: '0 auto 1.5rem',
                             boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                        }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.75rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Revoke Access?</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem', fontWeight: 600 }}>
                             Are you sure you want to remove <strong>{confirmDelete.username}</strong>? This will disable their login credentials immediately.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1, borderRadius: '16px', fontWeight: 800 }} onClick={() => setConfirmDelete(null)}>Keep User</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444', borderRadius: '16px', fontWeight: 800, border: 'none', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }} onClick={handleDelete}>Delete User</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {showProvisionModal && createPortal(
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px', borderRadius: '24px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', padding: '1.5rem 2rem', borderBottom: '1px solid #fde68a' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f59e0b', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: '#92400e' }}>Bulk Provisioning</h2>
                                        <p style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Authorize {selectedPatients.length > 0 ? selectedPatients.length : 'multiple'} patients at once</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {availablePatients.length > 0 && (
                                        <button 
                                            onClick={() => {
                                                const filtered = availablePatients.filter(p => 
                                                    p.patient_id?.toLowerCase().includes(provisionSearch.toLowerCase()) ||
                                                    `${p.first_name} ${p.last_name}`.toLowerCase().includes(provisionSearch.toLowerCase())
                                                );
                                                if (selectedPatients.length >= filtered.length && filtered.every(p => selectedPatients.includes(p.id))) {
                                                    setSelectedPatients(selectedPatients.filter(id => !filtered.map(f => f.id).includes(id)));
                                                } else {
                                                    setSelectedPatients([...new Set([...selectedPatients, ...filtered.map(p => p.id)])]);
                                                }
                                            }}
                                            style={{ background: 'white', border: '1px solid #fde68a', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#b45309', cursor: 'pointer' }}
                                        >
                                            Toggle Filtered
                                        </button>
                                    )}
                                    <button onClick={() => { setShowProvisionModal(false); setSelectedPatients([]); setProvisionSearch(''); }} style={{ background: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={18} color="#b45309" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar inside Modal */}
                        <div style={{ padding: '1rem 2rem', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b45309' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search by Patient ID or Name..." 
                                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '12px', border: '1px solid #fde68a', fontSize: '0.8rem', fontWeight: 600, outline: 'none' }}
                                    value={provisionSearch}
                                    onChange={(e) => setProvisionSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                            {availablePatients.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    <p style={{ fontWeight: 700 }}>No unprovisioned patients found.</p>
                                    <p style={{ fontSize: '0.75rem' }}>All registered patients have portal access or are already enabled.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {availablePatients
                                        .filter(p => 
                                            p.patient_id?.toLowerCase().includes(provisionSearch.toLowerCase()) ||
                                            `${p.first_name} ${p.last_name}`.toLowerCase().includes(provisionSearch.toLowerCase())
                                        )
                                        .map(p => {
                                            const isSelected = selectedPatients.includes(p.id);
                                        return (
                                            <div 
                                                key={p.id} 
                                                onClick={() => {
                                                    if (isSelected) setSelectedPatients(selectedPatients.filter(id => id !== p.id));
                                                    else setSelectedPatients([...selectedPatients, p.id]);
                                                }}
                                                style={{ 
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', 
                                                    background: isSelected ? '#fffbeb' : '#f8fafc', 
                                                    borderRadius: '16px', border: `1px solid ${isSelected ? '#f59e0b' : '#e2e8f0'}`,
                                                    cursor: 'pointer', transition: '0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ 
                                                        width: '20px', height: '20px', borderRadius: '6px', 
                                                        border: `2px solid ${isSelected ? '#f59e0b' : '#cbd5e1'}`,
                                                        background: isSelected ? '#f59e0b' : 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'white'
                                                    }}>
                                                        {isSelected && <Check size={14} strokeWidth={4} />}
                                                    </div>
                                                    <div>
                                                        <p style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>{p.first_name} {p.last_name}</p>
                                                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {p.patient_id} • {p.phone}</p>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: isSelected ? '#f59e0b' : '#94a3b8', textTransform: 'uppercase' }}>
                                                    {isSelected ? 'Selected' : 'Click to select'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{selectedPatients.length} patients selected</p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowProvisionModal(false); setSelectedPatients([]); setProvisionSearch(''); }}>Cancel</button>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ background: '#f59e0b', borderColor: '#f59e0b', padding: '0.6rem 1.5rem', fontWeight: 800 }}
                                    onClick={handleBulkEnablePortal}
                                    disabled={selectedPatients.length === 0 || isProvisioning === 'BULK'}
                                >
                                    {isProvisioning === 'BULK' ? 'PROVISIONING...' : `Authorize Selected Access`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Users;
