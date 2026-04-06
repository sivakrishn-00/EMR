import React, { useState, useEffect } from 'react';
import { Database, Plus, X, Pencil, Trash2, Info, Activity } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ProjectManagement = () => {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [projectFormData, setProjectFormData] = useState({
        name: '',
        description: '',
        categories: []
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState(null);

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
            let projectId = editingProjectId;
            if (isEditing) {
                await api.put(`patients/projects/${editingProjectId}/`, {
                    name: projectFormData.name,
                    description: projectFormData.description
                });
            } else {
                const res = await api.post('patients/projects/', {
                    name: projectFormData.name,
                    description: projectFormData.description
                });
                projectId = res.data.id;
            }

            // Sync Mappings using the new custom action
            await api.post(`patients/projects/${projectId}/sync-mappings/`, {
                categories: projectFormData.categories
            });

            toast.success(isEditing ? "Project Configuration Updated!" : "Project K Initialized & Mapped!", { id: loadId });
            setProjectFormData({ name: '', description: '', categories: [] });
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
            categories: p.category_mappings?.map(m => m.category) || []
        });
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
                                    onClick={() => { setIsEditing(false); setEditingProjectId(null); setProjectFormData({ name: '', description: '', categories: [] }); }}
                                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    CANCEL EDIT
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleProjectSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
        </div>
    );
};

export default ProjectManagement;
