import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Lock, User as UserIcon, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back to the EMR Portal!');
      navigate('/');
    } catch (err) {
      toast.error('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '2rem',
      fontFamily: "'Outfit', sans-serif"
    }}>
      <div className="fade-in" style={{
        width: '100%',
        maxWidth: '1000px',
        display: 'flex',
        flexDirection: 'row',
        background: 'white',
        borderRadius: '32px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
      }}>

        {/* Left Side: Video Section */}
        <div style={{
          flex: '1.2',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#000',
          overflow: 'hidden',
          minHeight: '600px'
        }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 1
            }}
          >
            <source src="/EMR.mp4" type="video/mp4" />
          </video>

          {/* Overlay Content - Using a subtle gradient instead of blur for text readability */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '3rem',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '1.25rem',
              borderRadius: '24px',
              marginBottom: '2rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <Activity size={56} color="white" />
            </div>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              marginBottom: '1rem',
              letterSpacing: '-0.03em',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}>
              Electronic Medical Records
            </h2>
            <p style={{
              fontSize: '1.2rem',
              opacity: 0.95,
              fontWeight: 500,
              maxWidth: '320px',
              lineHeight: 1.6,
              textShadow: '0 1px 5px rgba(0,0,0,0.5)'
            }}>
              Empowering healthcare through precise data management.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div style={{
          flex: '1',
          padding: '3rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'white'
        }}>
          {/* Header Section */}
          <div style={{ textAlign: 'left', marginBottom: '2.5rem' }}>
            <h1 style={{
              color: '#1e293b',
              fontSize: '2rem',
              fontWeight: 800,
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em'
            }}>
              Sign In
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9375rem', fontWeight: 500 }}>
              Access your EMR Portal dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', color: '#64748b', display: 'block' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    paddingLeft: '3.25rem',
                    height: '52px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontWeight: 500,
                    fontSize: '1rem',
                    width: '100%'
                  }}
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', color: '#64748b', display: 'block' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    paddingLeft: '3.25rem',
                    height: '52px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontWeight: 500,
                    fontSize: '1rem',
                    width: '100%'
                  }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '54px',
                fontSize: '1.1rem',
                borderRadius: '14px',
                fontWeight: 700,
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',
                marginBottom: '2rem'
              }}
            >
              {isLoading ? 'Authenticating...' : 'Sign In Now'}
            </button>
          </form>

          <div style={{
            marginTop: 'auto',
            padding: '1rem',
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            border: '1px solid rgba(99, 102, 241, 0.1)'
          }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, lineHeight: 1.5 }}>
              SECURE ACCESS: This system is for authorized personnel only.
            </p>
          </div>

          <p style={{ textAlign: 'center', marginTop: '2rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
            &copy; 2026 Bavya Healthcare Group. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
