import React, { useState, useEffect } from 'react';
import { Shield, Check, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const SYSTEM_MODULES = [
    { id: '/dashboard', name: 'Dashboard Analytics', icon: 'LayoutDashboard' },
    { id: '/patients', name: 'Patient Registry', icon: 'Users' },
    { id: '/vitals', name: 'Vitals Area', icon: 'Activity' },
    { id: '/consultations', name: 'Consult Desk', icon: 'ShieldPlus' },
    { id: '/lab', name: 'Laboratory', icon: 'Microscope' },
    { id: '/pharmacy', name: 'Pharmacy', icon: 'Pill' },
    { id: '/users', name: 'System Users', icon: 'UserCircle' },
    { id: '/audit', name: 'Audit Logs', icon: 'History' },
    { id: '/admin-masters', name: 'Admin Masters', icon: 'Settings' },
    { id: '/projects', name: 'Project Management', icon: 'Briefcase' },
    { id: '/roles', name: 'Role Management', icon: 'ShieldCheck' }
];

// Removed PREDEFINED_ROLES as role creation should be fully dynamic

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    
    const [roleForm, setRoleForm] = useState({ name: '', description: '', data_isolation: false, permissions: [] });
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await api.get('accounts/user-roles/');
            setRoles(res.data.results || res.data);
        } catch (err) {
            toast.error("Failed to load roles.");
        }
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        const loadId = toast.loading("Saving role...");
        try {
            if (isEditingRole) {
                await api.put(`accounts/user-roles/${editingRoleId}/`, roleForm);
                toast.success("Role updated!", { id: loadId });
            } else {
                await api.post('accounts/user-roles/', roleForm);
                toast.success("New role created!", { id: loadId });
            }
            setRoleForm({ name: '', description: '', data_isolation: false, permissions: [] });
            setIsEditingRole(false);
            setEditingRoleId(null);
            fetchRoles();
        } catch (err) {
            toast.error("Error saving role.", { id: loadId });
        }
    };

    return (
        <div className="fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>Role Management</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>Define access policies and explicitly map users to roles.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem', alignItems: 'start' }} className="fade-in">
                {/* Role Definitions */}
                <div className="card" style={{ padding: '2.5rem', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{isEditingRole ? 'Update Security Role' : 'Create Custom Role'}</h2>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>Define permissions for specific system modules</p>
                        </div>
                    </div>
                    <form onSubmit={handleRoleSubmit}>
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.875rem' }}>Role Name</label>
                            <input 
                                type="text"
                                required 
                                className="form-control" 
                                placeholder="e.g., HEAD_NURSE, RECEPTIONIST"
                                value={roleForm.name}
                                disabled={isEditingRole} // Prevent changing name during edit, to avoid orphan updates, but they can delete & recreate
                                onChange={e => {
                                    setRoleForm({ ...roleForm, name: e.target.value.toUpperCase().replace(/\s+/g, '_') });
                                }}
                            />
                            {isEditingRole && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Role name cannot be changed while editing. Create a new role instead.</p>
                            )}
                        </div>
                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.875rem' }}>Description</label>
                            <textarea 
                                rows="2" 
                                className="form-control" 
                                placeholder="Brief role responsibilities..."
                                value={roleForm.description}
                                onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                            ></textarea>
                        </div>
                        <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', background: roleForm.data_isolation ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: `1px solid ${roleForm.data_isolation ? 'rgba(99, 102, 241, 0.3)' : 'var(--border)'}`, transition: 'all 0.3s' }}>
                                <div style={{ paddingTop: '2px' }}>
                                    <div style={{ width: '46px', height: '26px', background: roleForm.data_isolation ? 'var(--primary)' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: 'all 0.3s ease' }}>
                                        <div style={{ position: 'absolute', top: '3px', left: roleForm.data_isolation ? '23px' : '3px', width: '20px', height: '20px', background: 'var(--surface)', borderRadius: '50%', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: roleForm.data_isolation ? 'var(--primary)' : 'var(--text-main)' }}>Enforce Strong Data Isolation</p>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.5' }}>If enabled, associated users can <b>strictly</b> see only their individually registered data (such as patients & vitals).</p>
                                </div>
                                <input 
                                    type="checkbox" 
                                    hidden
                                    checked={roleForm.data_isolation} 
                                    onChange={e => setRoleForm({ ...roleForm, data_isolation: e.target.checked })}
                                />
                            </label>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ fontWeight: 800, fontSize: '0.9375rem', display: 'block', color: 'var(--text-main)' }}>Module Permissions</label>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select accessible system areas</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                                    {roleForm.permissions?.length || 0} Modules Selected
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {SYSTEM_MODULES.map(mod => {
                                    const isChecked = roleForm.permissions?.includes(mod.id);
                                    return (
                                        <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.875rem 1rem', background: isChecked ? 'rgba(99, 102, 241, 0.04)' : 'var(--background)', border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '12px', transition: 'all 0.2s' }}>
                                            <div style={{ width: '18px', height: '18px', borderRadius: '6px', border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`, background: isChecked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                {isChecked && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <span style={{ fontSize: '0.875rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--primary)' : 'var(--text-muted)' }}>{mod.name}</span>
                                            <input 
                                                type="checkbox" 
                                                hidden
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    const perms = roleForm.permissions || [];
                                                    setRoleForm({
                                                        ...roleForm,
                                                        permissions: e.target.checked ? [...perms, mod.id] : perms.filter(p => p !== mod.id)
                                                    });
                                                }}
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '52px', borderRadius: '14px', fontSize: '1rem' }}>
                            {isEditingRole ? 'Save Changes' : 'Initialize Rule'}
                        </button>
                        {isEditingRole && (
                            <button type="button" onClick={() => { setIsEditingRole(false); setRoleForm({ name: '', description: '', data_isolation: false, permissions: [] }); }} style={{ width: '100%', marginTop: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 700, padding: '0.75rem', cursor: 'pointer' }}>Cancel Edit</button>
                        )}
                    </form>
                </div>

                <div className="card" style={{ padding: '2.5rem', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Active Policies</h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total established roles</p>
                        </div>
                        <span style={{ fontSize: '1.125rem', fontWeight: 800, background: 'var(--primary)', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}>{roles.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {roles.map(r => (
                            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{r.name}</p>
                                            {r.data_isolation && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', borderRadius: '4px', letterSpacing: '0.05em' }}>ISOLATED</span>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{r.description || 'Generic security access policy'}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => { setEditingRoleId(r.id); setIsEditingRole(true); setRoleForm({ name: r.name, description: r.description, data_isolation: r.data_isolation, permissions: r.permissions || [] }); window.scrollTo({top:0, behavior:'smooth'}) }} style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Pencil size={14} /></button>
                                        <button onClick={async () => { if(window.confirm(`Delete role ${r.name}?`)) { await api.delete(`accounts/user-roles/${r.id}/`); fetchRoles(); } }} style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                     <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}><span style={{ color: 'var(--primary)', fontWeight: 800 }}>{r.permissions?.length || 0}</span> Modules Mapped</p>
                                     <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}><span style={{ color: '#10b981', fontWeight: 800 }}>{r.users?.length || 0}</span> Users Assigned</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default RoleManagement;
