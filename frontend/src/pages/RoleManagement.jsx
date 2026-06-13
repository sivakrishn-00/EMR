import React, { useState, useEffect } from 'react';
import { Shield, Check, Pencil, Trash2, Briefcase, ChevronDown } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const SYSTEM_MODULES = [
    { id: '/dashboard', name: 'Dashboard Analytics', icon: 'LayoutDashboard' },
    { id: '/patients', name: 'Patient Registry', icon: 'Users' },
    { id: '/vitals', name: 'Vitals Area', icon: 'Activity' },
    { id: '/consultations', name: 'Consult Desk', icon: 'ShieldPlus' },
    { id: '/lab', name: 'Laboratory', icon: 'Microscope' },
    { id: '/pharmacy', name: 'Pharmacy', icon: 'Pill' },
    { id: '/indents/inventory', name: 'Room Stock - Inventory & Requests', icon: 'Package' },
    { id: '/indents/approval', name: 'Room Stock - Doctor Approval Desk', icon: 'UserCheck' },
    { id: '/reports', name: 'Analytics Hub', icon: 'BarChart3' },
    { id: '/operations-hub', name: 'Executive Operations Hub', icon: 'TrendingUp' },
    { id: '/reports/bulk-import', name: 'Reports - Bulk Import History', icon: 'Upload' },
    { id: '/users', name: 'System Users', icon: 'UserCircle' },
    { id: '/audit', name: 'Audit Logs', icon: 'History' },
    { id: '/admin-masters', name: 'Admin Masters (Full Access)', icon: 'Settings' },
    { id: '/admin-masters/protocols', name: 'Admin Masters - Data Hub', icon: 'Layers' },
    { id: '/admin-masters/diagnostics', name: 'Admin Masters - Lab Masters', icon: 'Activity' },
    { id: '/admin-masters/machines', name: 'Admin Masters - Sync Bridge', icon: 'Radio' },
    { id: '/admin-masters/stats', name: 'Admin Masters - Analytics & Stock Monitor', icon: 'BarChart3' },
    { id: '/admin-masters/upload_history', name: 'Admin Masters - Upload Audit Logs', icon: 'History' },
    { id: '/projects', name: 'Project Management', icon: 'Briefcase' },
    { id: '/roles', name: 'Role Management', icon: 'ShieldCheck' }
];

// Removed PREDEFINED_ROLES as role creation should be fully dynamic

const RoleManagement = () => {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const [roleForm, setRoleForm] = useState({ name: '', description: '', data_isolation: false, permissions: [] });
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.project-selector-container')) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (user) {
            if (user.project) {
                setSelectedProjectId(user.project);
            } else {
                fetchProjects();
            }
        }
    }, [user]);

    useEffect(() => {
        if (selectedProjectId) {
            fetchRoles(selectedProjectId);
        }
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('patients/projects/');
            const pList = res.data.results || res.data;
            setProjects(pList);
        } catch (err) {
            toast.error("Failed to load projects.");
        }
    };

    const fetchRoles = async (projId) => {
        try {
            const res = await api.get(`accounts/user-roles/?project=${projId}`);
            setRoles(res.data.results || res.data);
        } catch (err) {
            toast.error("Failed to load roles.");
        }
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        const loadId = toast.loading("Saving role...");
        try {
            const payload = {
                ...roleForm,
                project: selectedProjectId
            };
            if (isEditingRole) {
                await api.put(`accounts/user-roles/${editingRoleId}/`, payload);
                toast.success("Role updated!", { id: loadId });
            } else {
                await api.post('accounts/user-roles/', payload);
                toast.success("New role created!", { id: loadId });
            }
            setRoleForm({ name: '', description: '', data_isolation: false, permissions: [] });
            setIsEditingRole(false);
            setEditingRoleId(null);
            fetchRoles(selectedProjectId);
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

            {!user?.project && projects.length > 0 && (
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1.5rem', 
                    background: 'var(--surface)', 
                    padding: '1.25rem 2rem', 
                    borderRadius: '20px', 
                    border: '1px solid var(--border)', 
                    marginBottom: '2rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>Active Project Context:</span>
                    </div>

                    <div className="project-selector-container" style={{ position: 'relative', width: '320px' }}>
                        {/* Dropdown Trigger */}
                        <div 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1.25rem',
                                background: 'var(--background)',
                                border: isDropdownOpen ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                                borderRadius: '14px',
                                color: 'var(--text-main)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'all 0.2s ease',
                                boxShadow: isDropdownOpen ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Briefcase size={16} color="var(--primary)" />
                                <span>{projects.find(p => p.id == selectedProjectId)?.name || 'Select Project'}</span>
                            </div>
                            <ChevronDown 
                                size={16} 
                                color="var(--text-muted)" 
                                style={{ 
                                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }} 
                            />
                        </div>

                        {/* Dropdown List */}
                        {isDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '115%',
                                left: 0,
                                right: 0,
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                zIndex: 1000,
                                padding: '0.5rem',
                                maxHeight: '260px',
                                overflowY: 'auto'
                            }}>
                                {projects.map(p => {
                                    const isSelected = p.id == selectedProjectId;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProjectId(p.id);
                                                setIsDropdownOpen(false);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                fontWeight: isSelected ? 800 : 600,
                                                fontSize: '0.875rem',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'var(--background)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: isSelected ? 'var(--primary)' : 'transparent',
                                                border: isSelected ? 'none' : '1.5px solid var(--border)'
                                            }} />
                                            <span>{p.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!selectedProjectId ? (
                <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <Briefcase size={40} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>Select Project Context</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0', lineHeight: '1.6' }}>Please select a project facility from the dropdown above to view and manage its roles and access policies.</p>
                    </div>
                </div>
            ) : (
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
                        <span style={{ fontSize: '1.125rem', fontWeight: 800, background: 'var(--primary)', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}>{roles.filter(r => r.name !== 'PATIENT').length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {roles.filter(r => r.name !== 'PATIENT').map(r => (
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
                                        {r.name === 'PATIENT' ? (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 850, padding: '6px 12px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', letterSpacing: '0.05em' }}>SYSTEM PROTECTED</span>
                                        ) : (
                                            <>
                                                <button onClick={() => { setEditingRoleId(r.id); setIsEditingRole(true); setRoleForm({ name: r.name, description: r.description, data_isolation: r.data_isolation, permissions: r.permissions || [] }); window.scrollTo({top:0, behavior:'smooth'}) }} style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Pencil size={14} /></button>
                                                <button onClick={async () => { if(window.confirm(`Delete role ${r.name}?`)) { await api.delete(`accounts/user-roles/${r.id}/`); fetchRoles(selectedProjectId); } }} style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Trash2 size={14} /></button>
                                            </>
                                        )}
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
            )}

            <style>{`
                .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default RoleManagement;
