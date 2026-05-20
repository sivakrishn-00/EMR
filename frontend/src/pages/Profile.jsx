import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  Building2, 
  Calendar, 
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectConfig, setProjectConfig] = useState(null);

  useEffect(() => {
    if (user?.project) {
      fetchProjectConfig(user.project.id || user.project);
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

  if (!user) return null;

  const personalInfo = [
    { label: 'Full Name', value: `${user.first_name} ${user.last_name}`, icon: UserIcon },
    { label: 'Primary Email', value: user.email, icon: Mail },
    { label: 'Direct Phone', value: user.phone || '+(Not Specified)', icon: Phone },
    { label: 'Assigned ID', value: `SYS-USR-${user.id.toString().padStart(4, '0')}`, icon: Shield },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Back to Dashboard Button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--surface)',
            border: projectConfig?.primary_color ? `1px solid ${projectConfig.primary_color}` : '1px solid var(--primary)',
            padding: '0.625rem 1.25rem',
            borderRadius: '12px',
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: projectConfig?.primary_color || 'var(--primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
          className="back-btn-hover"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <style>{`
        .back-btn-hover:hover {
          background: ${projectConfig?.primary_color || 'var(--primary)'} !important;
          border-color: ${projectConfig?.primary_color || 'var(--primary)'} !important;
          color: white !important;
          transform: translateX(-2px);
        }
      `}</style>

      {/* Top Banner: Identity Quick View */}
      <div className="card" style={{ 
        padding: '2.5rem', 
        borderRadius: '24px', 
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--background) 100%)', 
        border: '1px solid var(--border)', 
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2.5rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)'
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{ 
            width: '100px', height: '100px', 
            borderRadius: '24px', 
            background: 'var(--primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', fontWeight: 800, color: 'white',
            boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)'
          }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ 
            position: 'absolute', bottom: '-5px', right: '-5px', 
            background: '#10b981', width: '24px', height: '24px', 
            borderRadius: '50%', border: '4px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle size={10} color="white" />
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>{user.username}</h1>
            <span style={{ 
              background: user.is_active ? 'rgba(16, 185, 129, 0.1)' : '#fee2e2', 
              color: user.is_active ? '#059669' : '#dc2626',
              padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase'
            }}>
              {user.is_active ? 'Active Account' : 'Suspended'}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', fontWeight: 500 }}>
            Management Portal user since {new Date(user.date_joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', marginBottom: '2px' }}>ROLES</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--primary)' }}>{user.user_roles_details?.length || 1}</p>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', marginBottom: '2px' }}>PERMISSION LEVEL</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: '#f59e0b' }}>{user.role === 'ADMIN' ? 'EXECUTIVE' : 'STANDARD'}</p>
          </div>
        </div>
      </div>

      {/* Identity Card */}
      <div className="card" style={{ padding: '2.5rem', borderRadius: '24px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 850, color: 'var(--text-main)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <UserIcon size={20} color="var(--primary)" /> Employment Identity
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {personalInfo.map((info, i) => (
            <div key={i} style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>{info.label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <info.icon size={18} color="var(--primary)" />
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>{info.value || 'Not Disclosed'}</p>
              </div>
            </div>
          ))}
          <div style={{ gridColumn: 'span 2', background: 'var(--background)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Residency/Location Address</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MapPin size={18} color="var(--primary)" />
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.address || 'No location data mapped to this account.'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
