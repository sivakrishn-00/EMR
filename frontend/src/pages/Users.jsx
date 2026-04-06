import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UserPlus, Search, UserCheck, Shield, Trash2, Edit, X, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Check } from 'lucide-react';
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

    useEffect(() => {
        fetchUsers();
        fetchRoles();
        fetchProjects();
    }, []);

    const fetchUsers = async (pageNum = 1) => {
        try {
            const res = await api.get(`accounts/users/?page=${pageNum}`);
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
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <UserPlus size={20} /> Add Staff Member
                </button>
            </header>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                            {users.map(u => (
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
                                                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Joined {new Date(u.date_joined).toLocaleDateString('en-GB')}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {editingUserRoles === u.id ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxWidth: '300px' }}>
                                                {roles.map(r => {
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
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-main)' }}>{u.email}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.phone || 'No phone'}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444' }}></div>
                                            <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                                                {u.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
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
                                                <button className="btn btn-secondary" title="Manage Roles" style={{ padding: '0.45rem', borderRadius: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }} onClick={() => { setEditingUserRoles(u.id); setTempUserRoles((u.user_roles || [])); }}>
                                                    <Shield size={16} />
                                                </button>
                                                <button className="btn btn-secondary" title="Edit Profile" style={{ padding: '0.45rem', borderRadius: '10px' }} onClick={() => handleOpenModal(u)}>
                                                    <Edit size={16} />
                                                </button>
                                                <button className="btn btn-secondary" title="Revoke Access" style={{ padding: '0.45rem', borderRadius: '10px', color: '#ef4444' }} onClick={() => setConfirmDelete(u)}>
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
            {showModal && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.7)', 
                    backdropFilter: 'blur(8px)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'flex-start', 
                    zIndex: 10000, 
                    padding: '80px 1rem 40px 1rem',
                    overflowY: 'auto'
                }}>
                    <div className="card fade-in" style={{ 
                        width: '100%', 
                        maxWidth: '520px', 
                        padding: 0, 
                        borderRadius: '24px', 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: 'var(--primary)', padding: '0.625rem', borderRadius: '10px' }}>
                                    <UserPlus size={20} color="white" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>{editingUser ? 'Update Staff Member' : 'Add Staff Member'}</h2>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure credentials and access roles</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'var(--background)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-main)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} placeholder="e.g. David" />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} placeholder="e.g. Miller" />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label>Username (Login ID)</label>
                                <input required value={formData.username} disabled={!!editingUser} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="e.g. dmiller2024" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label>Email Address</label>
                                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="dmiller@clinic.com" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label>Assigned Project Facility</label>
                                <select required value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})}>
                                    <option value="">-- Select Project Facility --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {!editingUser && (
                                <div className="form-group" style={{ marginBottom: '2rem' }}>
                                    <label>Temporary Password</label>
                                    <input type="password" required onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
                                </div>
                            )}
                            {editingUser && (
                                <div style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '10px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Editing user permissions. Account ID cannot be changed.</p>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '0.75rem 1.5rem' }}>Close</button>
                                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                                    {editingUser ? 'Save Updates' : 'Confirm Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <div style={{ 
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', 
                    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    zIndex: 10000 
                }}>
                    <div className="card fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2.5rem' }}>
                        <div style={{ 
                             width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444', 
                             borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                             margin: '0 auto 1.5rem'
                        }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Revoke Access?</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
                             Are you sure you want to remove <strong>{confirmDelete.username}</strong>? This will disable their login credentials immediately.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Keep User</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }} onClick={handleDelete}>Delete User</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
