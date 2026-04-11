import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MEDIA_URL } from './services/api';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Clinical from './pages/Clinical';
import Laboratory from './pages/Laboratory';
import Pharmacy from './pages/Pharmacy';
import Vitals from './pages/Vitals';
import Users from './pages/Users';
import Audit from './pages/Audit';
import AdminMasters from './pages/AdminMasters';
import ProjectManagement from './pages/ProjectManagement';
import RoleManagement from './pages/RoleManagement';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import BridgeHub from './pages/BridgeHub';
import { Toaster } from 'react-hot-toast';

const ProtectedRoute = ({ children, requiredModule }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div className="loader"></div>
      <style>{`
        .loader { width: 48px; height: 48px; border: 5px solid #e2e8f0; border-bottom-color: #6366f1; border-radius: 50%; display: inline-block; box-sizing: border-box; animation: rotation 1s linear infinite; }
        @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  
  // Base dashboard access without specific module requirement
  if (!requiredModule) return children;

  // Dynamic permission check based on tokens assigned by admin UI
  const userPerms = user.permissions || [];
  const hasAccess = user.role === 'ADMIN' || userPerms.includes('ADMIN_ALL') || userPerms.includes(requiredModule);
  if (!hasAccess) {
    return (
      <div className="fade-in" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh', 
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', background: 'white', padding: '3rem', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', maxWidth: '440px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Access Restricted</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            You do not have the necessary permissions to view this module. Please contact your system administrator to assign the required access role.
          </p>
          <button onClick={() => window.history.back()} style={{ padding: '0.75rem 1.5rem', background: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem', transition: 'all 0.2s' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};

const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Maintain responsiveness without auto-expanding
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) setIsSidebarCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth > 1024) {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };
  const toggleCollapsed = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const sidebarWidth = isSidebarCollapsed ? '64px' : 'var(--sidebar-width)';

  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={toggleCollapsed} 
      />
      
      <div className="main-wrapper" style={{ 
        marginLeft: window.innerWidth > 1024 ? sidebarWidth : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '0'
      }}>
        <Navbar onToggleSidebar={toggleSidebar} isCollapsed={isSidebarCollapsed} />
        <main className="content-container" style={{ padding: '1rem 1.5rem', margin: '0' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .main-wrapper { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
};

const ThemedApp = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.branding) {
      const { primary_color, secondary_color, accent_color } = user.branding;
      const root = document.documentElement;
      root.style.setProperty('--primary', primary_color);
      root.style.setProperty('--secondary', secondary_color);
      root.style.setProperty('--accent', accent_color);
      
      // Compute helper colors for gradients and lights
      root.style.setProperty('--primary-dark', primary_color + 'dd'); 
      root.style.setProperty('--primary-light', primary_color + '44');
    } else {
      // System defaults
      const root = document.documentElement;
      root.style.setProperty('--primary', '#6366f1');
      root.style.setProperty('--secondary', '#10b981');
      root.style.setProperty('--accent', '#f59e0b');
      root.style.setProperty('--primary-dark', '#4f46e5');
      root.style.setProperty('--primary-light', '#818cf8');
    }
  }, [user]);

  return children;
};

function App() {
  return (
    <AuthProvider>
      <ThemedApp>
        <BrowserRouter>
        <Toaster position="top-right" 
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#fff',
              fontSize: '14px',
              padding: '12px 24px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' }
            }
          }} 
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/dashboard" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/dashboard">
                <Dashboard />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/patients" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/patients">
                <Patients />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/vitals" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/vitals">
                <Vitals />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/consultations" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/consultations">
                <Clinical />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/lab" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/lab">
                <Laboratory />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/pharmacy" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/pharmacy">
                <Pharmacy />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/reports" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/reports">
                <Reports />
              </ProtectedRoute>
            </MainLayout>
          } />

          {/* System Admin Routes - Still isolated to ADMIN_ALL for ultimate security, or specific assignment */}
          <Route path="/users" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/users">
                <Users />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/audit" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/audit">
                <Audit />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/admin-masters" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/admin-masters">
                <AdminMasters />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/projects" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/projects">
                <ProjectManagement />
              </ProtectedRoute>
            </MainLayout>
          } />


          <Route path="/bridge-hub" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/bridge-hub">
                <BridgeHub />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/roles" element={
            <MainLayout>
              <ProtectedRoute requiredModule="/roles">
                <RoleManagement />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="/profile" element={
            <MainLayout>
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            </MainLayout>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      </ThemedApp>
    </AuthProvider>
  );
}

export default App;
