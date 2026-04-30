import React, { useState, useEffect } from 'react';
import { Database, Plus, X, Pencil, Trash2, Info, Activity, AlertTriangle } from 'lucide-react';
import api, { MEDIA_URL } from '../services/api';
import toast from 'react-hot-toast';

const ProjectManagement = () => {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [projectFormData, setProjectFormData] = useState({
        name: '',
        description: '',
        logo: null,
        categories: [],
        primary_color: '#6366f1',
        secondary_color: '#a5b4fc',
        accent_color: '#f43f5e',
        allow_appointments: true,
        use_registry_for_personnel: false,
        vitals_mandatory: true
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('patients/projects/');
            if (res.data.results) {
                setProjects(res.data.results);
            } else {
                setProjects(res.data);
            }
        } catch (err) {
            toast.error("Cloud sync delay. Please retry.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleProjectSubmit = async (e) => {
        e.preventDefault();
        if (projectFormData.categories.length === 0) {
            toast.error("Please map at least one patient category to this project.");
            return;
        }
        
        const loadId = toast.loading(isEditing ? "Global update in progress..." : "Saving project configuration...");
        try {
            const formData = new FormData();
            formData.append('name', projectFormData.name);
            formData.append('description', projectFormData.description);
            if (projectFormData.logo) {
                formData.append('logo', projectFormData.logo);
            }
            formData.append('primary_color', projectFormData.primary_color);
            formData.append('secondary_color', projectFormData.secondary_color);
            formData.append('accent_color', projectFormData.accent_color);
            formData.append('allow_appointments', projectFormData.allow_appointments);
            formData.append('use_registry_for_personnel', projectFormData.use_registry_for_personnel);
            formData.append('vitals_mandatory', projectFormData.vitals_mandatory);

            let projectId = editingProjectId;
            if (isEditing) {
                await api.put(`patients/projects/${editingProjectId}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                const res = await api.post('patients/projects/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                projectId = res.data.id;
            }

            // Sync Mappings using the new custom action
            await api.post(`patients/projects/${projectId}/sync-mappings/`, {
                categories: projectFormData.categories
            });

            toast.success(isEditing ? "Project Configuration Updated!" : "Project K Initialized & Mapped!", { id: loadId });
            setProjectFormData({ name: '', description: '', logo: null, categories: [], primary_color: '#6366f1', secondary_color: '#a5b4fc', accent_color: '#f43f5e', allow_appointments: true, use_registry_for_personnel: false, vitals_mandatory: true });
            setLogoPreview(null);
            setIsEditing(false);
            setEditingProjectId(null);
            fetchProjects();
        } catch (err) {
            toast.error("Failed to save project mappings.", { id: loadId });
        }
    };

    const handleEditProject = (p) => {
        setIsEditing(true);
        setEditingProjectId(p.id);
        setProjectFormData({
            name: p.name,
            description: p.description || '',
            categories: p.category_mappings?.map(m => m.category) || [],
            logo: null,
            primary_color: p.primary_color || '#6366f1',
            secondary_color: p.secondary_color || '#a5b4fc',
            accent_color: p.accent_color || '#f43f5e',
            allow_appointments: p.allow_appointments ?? true,
            use_registry_for_personnel: p.use_registry_for_personnel ?? false,
            vitals_mandatory: p.vitals_mandatory ?? true
        });
        setLogoPreview(p.logo ? (p.logo.startsWith('http') ? p.logo : `${MEDIA_URL}${p.logo}`) : null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteProject = async (id) => {
        if (!window.confirm("Are you sure? This will unmap all assigned categories.")) return;
        try {
            await api.delete(`patients/projects/${id}/`);
            toast.success("Project de-registered.");
            fetchProjects();
        } catch (err) {
            toast.error("Cannot delete active project with existing records.");
        }
    };

    return (
        <div className="fade-in">
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>Project Management</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>Global configuration for Employee (IE) and Outside patient mapping.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                {/* Projects List */}
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Database size={20} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Active Projects</h2>
                    </div>
                    
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                            <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Synchronizing project data...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {projects && Array.isArray(projects) && projects.length > 0 ? projects.map(p => (
                                <div key={p.id} className="card" style={{ background: 'var(--background)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid var(--border)', boxShadow: 'none' }}>
                                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                                        {p.logo && (
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)', background: 'white' }}>
                                                <img src={p.logo.startsWith('http') ? p.logo : `${MEDIA_URL}${p.logo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <div>
                                            <h3 style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.0625rem' }}>{p.name}</h3>
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>{p.description || 'No description provided.'}</p>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {p.category_mappings?.map(m => (
                                                    <span 
                                                        key={m.id} 
                                                        style={{ 
                                                            fontSize: '0.675rem', 
                                                            fontWeight: 800, 
                                                            padding: '4px 10px', 
                                                            background: m.category === 'EMPLOYEE' ? '#dcfce7' : m.category === 'FAMILY' ? '#f0f9ff' : '#fef2f2', 
                                                            color: m.category === 'EMPLOYEE' ? '#166534' : m.category === 'FAMILY' ? '#0369a1' : '#b91c1c',
                                                            borderRadius: '6px',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        {m.category === 'EMPLOYEE' ? 'Staff (IE)' : m.category === 'FAMILY' ? 'Dependents' : 'General'}
                                                    </span>
                                                ))}
                                                <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '4px 10px', background: p.allow_appointments !== false ? '#eef2ff' : '#f8fafc', color: p.allow_appointments !== false ? '#4338ca' : '#94a3b8', borderRadius: '6px', textTransform: 'uppercase', border: '1px solid ' + (p.allow_appointments !== false ? '#c7d2fe' : '#e2e8f0') }}>
                                                    {p.allow_appointments !== false ? 'Appointments Enabled' : 'Appointments Disabled'}
                                                </span>
                                                {p.use_registry_for_personnel && (
                                                    <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', textTransform: 'uppercase', border: '1px solid #fde68a' }}>
                                                        Registry Enabled
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            onClick={() => handleEditProject(p)}
                                            style={{ border: 'none', background: 'var(--surface)', color: 'var(--text-muted)', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                            title="Edit Project Configuration"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteProject(p.id)}
                                            style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                            title="Delete Project"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #e2e8f0', borderRadius: '20px' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No projects configured.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Create Project Form */}
                <div>
                    <div className="card" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '8px', background: isEditing ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
                                {isEditing ? <Pencil size={20} color="#f59e0b" /> : <Plus size={20} color="var(--primary)" />}
                            </div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>{isEditing ? 'Update Configuration' : 'Initialize New Project'}</h2>
                            {isEditing && (
                                <button 
                                    onClick={() => { setIsEditing(false); setEditingProjectId(null); setProjectFormData({ name: '', description: '', logo: null, categories: [], primary_color: '#6366f1', secondary_color: '#a5b4fc', accent_color: '#f43f5e', allow_appointments: true, use_registry_for_personnel: false, vitals_mandatory: true }); setLogoPreview(null); }}
                                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    CANCEL EDIT
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleProjectSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontWeight: 700 }}>Project Logo (IE Round Way)</label>
                                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--background)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {logoPreview ? (
                                                    <img src={logoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : <Plus size={20} color="#94a3b8" />}
                                            </div>
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setProjectFormData({ ...projectFormData, logo: file });
                                                        setLogoPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                                style={{ fontSize: '0.75rem' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontWeight: 700 }}>Project Name *</label>
                                    <input 
                                        required 
                                        className="form-control"
                                        placeholder="e.g. Project K - Hyderabad" 
                                        value={projectFormData.name}
                                        onChange={e => setProjectFormData({ ...projectFormData, name: e.target.value })}
                                        style={{ height: '48px' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 700 }}>Primary UI</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input 
                                                type="color" 
                                                className="form-control"
                                                value={projectFormData.primary_color}
                                                onChange={e => setProjectFormData({ ...projectFormData, primary_color: e.target.value })}
                                                style={{ height: '40px', padding: '2px', width: '50px' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{projectFormData.primary_color}</span>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 700 }}>Secondary</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input 
                                                type="color" 
                                                className="form-control"
                                                value={projectFormData.secondary_color}
                                                onChange={e => setProjectFormData({ ...projectFormData, secondary_color: e.target.value })}
                                                style={{ height: '40px', padding: '2px', width: '50px' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{projectFormData.secondary_color}</span>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 700 }}>Accent</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input 
                                                type="color" 
                                                className="form-control"
                                                value={projectFormData.accent_color}
                                                onChange={e => setProjectFormData({ ...projectFormData, accent_color: e.target.value })}
                                                style={{ height: '40px', padding: '2px', width: '50px' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{projectFormData.accent_color}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label style={{ fontWeight: 700 }}>Mapping Categories *</label>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Select patient types allowed in this project.</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                                        {[
                                            { id: 'EMPLOYEE', label: 'Company Employees (IE)', hint: 'Primary card holders' },
                                            { id: 'FAMILY', label: 'Family Members', hint: 'Outside dependency link' },
                                            { id: 'GENERAL', label: 'General Patients', hint: 'Non-linked registrations' }
                                        ].map(cat => (
                                            <label 
                                                key={cat.id} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '1rem', 
                                                    padding: '1rem', 
                                                    background: projectFormData.categories.includes(cat.id) ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)',
                                                    border: '1px solid ' + (projectFormData.categories.includes(cat.id) ? 'var(--primary)' : 'var(--border)'),
                                                    borderRadius: '12px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    style={{ width: '18px', height: '18px' }}
                                                    checked={projectFormData.categories.includes(cat.id)}
                                                    onChange={e => {
                                                        const newCats = e.target.checked 
                                                            ? [...projectFormData.categories, cat.id]
                                                            : projectFormData.categories.filter(c => c !== cat.id);
                                                        setProjectFormData({ ...projectFormData, categories: newCats });
                                                    }}
                                                />
                                                <div>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{cat.label}</p>
                                                    <p style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>{cat.hint}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '1rem', 
                                            padding: '1.25rem', 
                                            background: projectFormData.use_registry_for_personnel ? 'rgba(245, 158, 11, 0.03)' : '#f8fafc',
                                            border: '1px solid ' + (projectFormData.use_registry_for_personnel ? '#f59e0b' : '#e2e8f0'),
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: '0.2s'
                                        }}
                                    >
                                        <input 
                                            type="checkbox"
                                            style={{ width: '20px', height: '20px' }}
                                            checked={projectFormData.use_registry_for_personnel}
                                            onChange={e => setProjectFormData({ ...projectFormData, use_registry_for_personnel: e.target.checked })}
                                        />
                                        <div>
                                            <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b' }}>Enable Personnel & Family Registry</p>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Enable specialized onboarding for Staff (IE) and their family members.</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '1rem', 
                                            padding: '1.25rem', 
                                            background: projectFormData.allow_appointments ? 'rgba(79, 70, 229, 0.03)' : '#f8fafc',
                                            border: '1px solid ' + (projectFormData.allow_appointments ? 'var(--primary)' : '#e2e8f0'),
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: '0.2s'
                                        }}
                                    >
                                        <input 
                                            type="checkbox"
                                            style={{ width: '20px', height: '20px' }}
                                            checked={projectFormData.allow_appointments}
                                            onChange={e => setProjectFormData({ ...projectFormData, allow_appointments: e.target.checked })}
                                        />
                                        <div>
                                            <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b' }}>Enable Patient Self-Service Appointments</p>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Allow patients in this project to book consultations and tests from their portal.</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '1rem', 
                                            padding: '1.25rem', 
                                            background: projectFormData.vitals_mandatory ? 'rgba(239, 68, 68, 0.03)' : '#f8fafc',
                                            border: '1px solid ' + (projectFormData.vitals_mandatory ? '#ef4444' : '#e2e8f0'),
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: '0.2s'
                                        }}
                                    >
                                        <input 
                                            type="checkbox"
                                            style={{ width: '20px', height: '20px' }}
                                            checked={projectFormData.vitals_mandatory}
                                            onChange={e => setProjectFormData({ ...projectFormData, vitals_mandatory: e.target.checked })}
                                        />
                                        <div>
                                            <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b' }}>Enforce Mandatory Vitals</p>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>When enabled, Temp and Weight are required for every triage assessment.</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontWeight: 700 }}>Description</label>
                                    <textarea 
                                        rows="3" 
                                        className="form-control"
                                        placeholder="Optional description..."
                                        value={projectFormData.description}
                                        onChange={e => setProjectFormData({ ...projectFormData, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ height: '52px', marginTop: '1rem', background: isEditing ? '#f59e0b' : 'var(--primary)', borderColor: isEditing ? '#f59e0b' : 'var(--primary)' }}>
                                    {isEditing ? 'Save Changes' : 'Map & Start Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            {/* Project-Specific Branding Manager */}
            <BrandingManager projects={projects} />
        </div>
    );
};

const BrandingManager = ({ projects }) => {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [logos, setLogos] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    
    // Custom Confirm Modal State
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null });

    useEffect(() => {
        if (selectedProjectId) {
            fetchLogos();
        } else {
            setLogos([]);
        }
    }, [selectedProjectId]);

    const fetchLogos = async () => {
        try {
            const res = await api.get(`patients/project-logos/?project=${selectedProjectId}`);
            setLogos(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {}
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!selectedProjectId) {
            toast.error("Please select a project first.");
            return;
        }
        if (logos.length >= 6) {
            toast.error("Maximum 6 logos allowed per project.");
            return;
        }

        const loadId = toast.loading("Uploading project branding asset...");
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('project', selectedProjectId);
            formData.append('order', logos.length);
            await api.post('patients/project-logos/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Branding asset added to project!", { id: loadId });
            fetchLogos();
        } catch (err) {
            toast.error("Upload failed.", { id: loadId });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = (id) => {
        setConfirmModal({ show: true, id: id });
    };

    const confirmDelete = async () => {
        const id = confirmModal.id;
        try {
            await api.delete(`patients/project-logos/${id}/`);
            toast.success("Logo removed from project.");
            fetchLogos();
        } catch (err) {
            toast.error("Failed to remove logo.");
        } finally {
            setConfirmModal({ show: false, id: null });
        }
    };

    return (
        <>
            <div className="card" style={{ padding: '2rem', marginTop: '2.5rem', background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px' }}>
                            <Activity size={20} color="var(--primary)" />
                        </div>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Project Branding Manager</h2>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>SELECT PROJECT:</p>
                        <select 
                            className="form-control" 
                            style={{ width: '240px', height: '40px', fontWeight: 600 }}
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                        >
                            <option value="">Choose a project...</option>
                            {Array.isArray(projects) && projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {selectedProjectId ? (
                    <>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Manage up to 6 unique logos for <strong>{projects.find(p => p.id == selectedProjectId)?.name}</strong>. These appear in the header when this project is active.
                        </p>

                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {logos.map(logo => (
                                <div key={logo.id} style={{ position: 'relative', textAlign: 'center' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', margin: '0 auto', background: 'white' }}>
                                        <img src={logo.image.startsWith('http') ? logo.image : `${MEDIA_URL}${logo.image}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(logo.id)}
                                        style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                    >
                                        <X size={12} />
                                    </button>
                                    <p style={{ fontSize: '0.675rem', marginTop: '0.5rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logo {logo.order + 1}</p>
                                </div>
                            ))}
                            
                            {logos.length < 6 && (
                                <label style={{ 
                                    width: '80px', 
                                    height: '80px', 
                                    borderRadius: '50%', 
                                    border: '2px dashed var(--border)', 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: 'white'
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                    <Plus size={20} color="#94a3b8" />
                                    <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 800, marginTop: '4px' }}>UPLOAD</span>
                                    <input type="file" hidden accept="image/*" onChange={handleUpload} disabled={isUploading} />
                                </label>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '20px' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Select a project from the dropdown to manage its branding assets.</p>
                    </div>
                )}
            </div>

            {/* Custom Premium Pop-up Modal */}
            {confirmModal.show && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'white',
                        width: '100%',
                        maxWidth: '400px',
                        borderRadius: '24px',
                        padding: '2.4rem',
                        border: '1px solid var(--border)',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
                        textAlign: 'center',
                        animation: 'modalFadeIn 0.3s ease-out'
                    }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            background: '#fef2f2',
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            color: '#ef4444'
                        }}>
                            <AlertTriangle size={36} />
                        </div>
                        <h3 style={{ fontSize: '1.375rem', fontWeight: 900, marginBottom: '0.75rem', color: '#0f172a' }}>Confirm Removal</h3>
                        <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                            Are you sure you want to remove this branding asset? This will immediately update the project identity across all user headers.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                onClick={() => setConfirmModal({ show: false, id: null })}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    color: '#475569',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseOut={e => e.currentTarget.style.background = 'white'}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                                onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                    <style>{`
                        @keyframes modalFadeIn {
                            from { transform: scale(0.95); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default ProjectManagement;
