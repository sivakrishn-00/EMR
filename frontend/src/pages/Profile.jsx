import React from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  Building2, 
  Calendar, 
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  const personalInfo = [
    { label: 'Full Name', value: `${user.first_name} ${user.last_name}`, icon: UserIcon },
    { label: 'Primary Email', value: user.email, icon: Mail },
    { label: 'Direct Phone', value: user.phone || '+(Not Specified)', icon: Phone },
    { label: 'Assigned ID', value: `SYS-USR-${user.id.toString().padStart(4, '0')}`, icon: Shield },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Top Banner: Identity Quick View */}
      <div className="card" style={{ 
        padding: '2.5rem', 
        borderRadius: '24px', 
        background: 'linear-gradient(135deg, white 0%, #f8fafc 100%)', 
        border: '1px solid #e2e8f0', 
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
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', color: '#0f172a' }}>{user.username}</h1>
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
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', marginBottom: '2px' }}>ROLES</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--primary)' }}>{user.user_roles_details?.length || 1}</p>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#94a3b8', marginBottom: '2px' }}>PERMISSION LEVEL</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: '#f59e0b' }}>{user.role === 'ADMIN' ? 'EXECUTIVE' : 'STANDARD'}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Identity Card */}
          <div className="card" style={{ padding: '2rem', borderRadius: '24px', background: 'white', border: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserIcon size={18} color="var(--primary)" /> Employment Identity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {personalInfo.map((info, i) => (
                <div key={i}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{info.label}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <info.icon size={16} color="#cbd5e1" />
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#334155' }}>{info.value || 'Not Disclosed'}</p>
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Residency/Location Address</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <MapPin size={16} color="#cbd5e1" />
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#334155' }}>{user.address || 'No location data mapped to this account.'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security & Access transparency */}
          <div className="card" style={{ padding: '2rem', borderRadius: '24px', background: 'white', border: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={18} color="var(--primary)" /> Corporate Access Scope
            </h3>
            <div style={{ padding: '1.5rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b' }}>Data Governance Model</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  {user.data_isolation 
                    ? 'Strict Isolation Enabled: Access limited to personally registered records.' 
                    : 'Global Visibility Enabled: Access to cross-facility organizational data.'}
                </p>
              </div>
              <span style={{ 
                background: user.data_isolation ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)', 
                color: 'white', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 800 
              }}>
                {user.data_isolation ? 'ISOLATED' : 'ADMINISTRATIVE'}
              </span>
            </div>
            
            <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem' }}>Active Module Authorizations</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                    {(user.permissions || []).map((perm, i) => (
                        <div key={i} style={{ padding: '0.5rem 0.875rem', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                            {perm.replace('/', '').toUpperCase() || 'ROOT'}
                        </div>
                    ))}
                    {(!user.permissions || user.permissions.length === 0) && (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No granular modules explicitly assigned. Falling back to basic role permissions.</p>
                    )}
                </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Facility Display */}
          <div className="card" style={{ padding: '2rem', borderRadius: '24px', background: '#0f172a', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} color="var(--primary)" />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800 }}>Primary Facility</h3>
            </div>
            
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'white' }}>{user.project_name || 'Corporate Head Office'}</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Project Code: {user.project ? `#PRJ-${user.project.toString().padStart(3, '0')}` : 'SYS-GLOBAL'}</p>
            </div>
            <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1.5rem', fontStyle: 'italic', textAlign: 'center' }}>You are currently assigned to this clinical unit.</p>
          </div>

          {/* Account Status / Metadata */}
          <div className="card" style={{ padding: '2rem', borderRadius: '24px', background: 'white', border: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem' }}>Account Integrity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Security Clearance</p>
                 <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#10b981' }}>VERIFIED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Authentication Method</p>
                 <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#334155' }}>SSO / JWT TOKEN</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Account Scope</p>
                 <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#6366f1' }}>FACILITY SCOPED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
