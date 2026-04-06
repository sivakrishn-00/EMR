import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Activity,
  Stethoscope,
  FlaskConical,
  Pill,
  LogOut,
  ChevronLeft,
  Settings,
  HelpCircle,
  UserCheck,
  ClipboardList,
  Database,
  ShieldCheck,
  BarChart3,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onToggleCollapsed, isCollapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Patients', icon: Users, path: '/patients' },
    { name: 'Vitals Area', icon: Activity, path: '/vitals' },
    { name: 'Consult Desk', icon: Stethoscope, path: '/consultations' },
    { name: 'Lab Hub', icon: FlaskConical, path: '/lab' },
    { name: 'Pharmacy', icon: Pill, path: '/pharmacy' },
    { name: 'Reports', icon: BarChart3, path: '/reports' },
  ];

  const adminItems = [
    { name: 'Admin Masters', icon: Database, path: '/admin-masters' },
    { name: 'Project Linking', icon: HardDrive, path: '/lab-machines' },
    { name: 'Project Management', icon: Settings, path: '/projects' },
    { name: 'Role Management', icon: ShieldCheck, path: '/roles' },
    { name: 'User Management', icon: UserCheck, path: '/users' },
    { name: 'Audit Logs', icon: ClipboardList, path: '/audit' },
  ];

  const userPerms = user?.permissions || [];
  const checkAccess = (path) => user?.role === 'ADMIN' || userPerms.includes('ADMIN_ALL') || userPerms.includes(path);

  const filteredNav = navItems.filter(item => checkAccess(item.path));
  const filteredAdmin = adminItems.filter(item => checkAccess(item.path));

  return (
    <>
      <div className={`sidebar-container ${isOpen ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div style={{ height: 'var(--header-height)', display: 'flex', alignItems: 'center', padding: '0 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', width: '100%' }}>
            <div style={{
              background: 'white',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              minWidth: isCollapsed ? '32px' : '36px'
            }}>
              <img
                src="/white_bavya.jpg"
                alt="Logo"
                style={{
                  height: isCollapsed ? '20px' : '24px',
                  objectFit: 'contain',
                  transition: 'all 0.3s'
                }}
              />
            </div>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: 1
                }}>
                  EMR
                </span>
                <span style={{
                  color: '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.6rem',
                  letterSpacing: '0.02em',
                  marginTop: '2px'
                }}>
                  Electronic Medical Records
                </span>
              </div>
            )}
          </div>
        </div>

        <nav style={{ padding: '1.25rem 0.75rem', flex: 1, overflowY: 'auto' }}>
          <p style={{
            fontSize: '0.625rem',
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
            paddingLeft: '0.75rem',
            display: isCollapsed ? 'none' : 'block'
          }}>Main Menu</p>

          <ul style={{ listStyle: 'none' }}>
            {filteredNav.map((item) => (
              <li key={item.name} style={{ marginBottom: '0.25rem' }}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={16} className="nav-icon" />
                  {!isCollapsed && <span className="nav-text">{item.name}</span>}
                  <div className="tooltip">{item.name}</div>
                </NavLink>
              </li>
            ))}
          </ul>

          {filteredAdmin.length > 0 && (
            <>
              <p style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '1.5rem',
                marginBottom: '0.75rem',
                paddingLeft: '0.75rem',
                display: isCollapsed ? 'none' : 'block'
              }}>System Administration</p>

              <ul style={{ listStyle: 'none' }}>
                {filteredAdmin.map((item) => (
                  <li key={item.name} style={{ marginBottom: '0.25rem' }}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                      <item.icon size={16} className="nav-icon" />
                      {!isCollapsed && <span className="nav-text">{item.name}</span>}
                      <div className="tooltip">{item.name}</div>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        {!isCollapsed && (
          <div style={{ padding: '1rem', borderTop: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'white' }}>System Version</p>
              <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '4px' }}>Build: v1.0.1-stable</p>
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapsed}
          className="collapse-btn"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <style>{`
        .sidebar-container {
          width: var(--sidebar-width);
          background: var(--sidebar-bg);
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.1, 1);
          box-shadow: 1px 0 10px rgba(0,0,0,0.1);
        }

        .sidebar-container.collapsed {
          width: 64px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
          color: var(--sidebar-text);
          text-decoration: none;
          border-radius: 10px;
          transition: all 0.2s;
          position: relative;
          background: transparent;
          border: none;
          width: 100%;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .nav-link:hover {
          color: white;
          background: rgba(255, 255, 255, 0.04);
        }

        .nav-link.active {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        .collapse-btn {
          position: absolute;
          bottom: 2rem;
          right: -12px;
          width: 24px;
          height: 24px;
          background: #334155;
          color: #94a3b8;
          border: 1px solid #475569;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.3s;
        }
        .collapse-btn:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .collapsed .collapse-btn {
          transform: rotate(180deg);
        }

        /* Tooltip for collapsed mode */
        .tooltip {
          position: absolute;
          left: calc(100% + 15px);
          background: #1e293b;
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          opacity: 0;
          pointer-events: none;
          transition: 0.2s;
          white-space: nowrap;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          display: none;
        }
        .collapsed .nav-link:hover .tooltip {
          opacity: 1;
          display: block;
        }

        @media (max-width: 1024px) {
          .sidebar-container { left: calc(-1 * var(--sidebar-width)); }
          .sidebar-container.active { left: 0; }
          .collapse-btn { display: none; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
