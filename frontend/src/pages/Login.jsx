import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, 
  User as UserIcon, 
  Lock, 
  Smartphone, 
  Fingerprint, 
  CheckCircle2,
  Activity,
  ArrowRight,
  Loader2,
  ChevronLeft
} from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { user, login, loginFromData } = useAuth();
  const [tempTokens, setTempTokens] = useState(null);

  // Step 0: Discovery, 1: Staff, 2: Patient Choice, 3: OTP, 4: Set Password
  const [step, setStep] = useState(0);
  const [identityData, setIdentityData] = useState(null);
  const [authMode, setAuthMode] = useState('PASSWORD'); 
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // 🛡️ SECURITY: Clean gateway entry
  useEffect(() => {
    if (step === 0 && !user) {
        localStorage.clear();
    }
  }, [user]);

  // Timer logic for Resend OTP
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleDiscovery = async (e) => {
    if (e) e.preventDefault();
    if (!identifier) return toast.error("Registry ID required");
    setIsLoading(true);
    try {
      const res = await api.post('accounts/portal/discover/', { identifier });
      setIdentityData(res.data);
      if (res.data.identity_type === 'PATIENT') {
        setStep(2); 
      } else {
        setStep(1); 
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Identity not found in Cloud Registry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(identifier, password);
      toast.success('System Access Granted');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Invalid Credentials. Access Restricted.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (phoneNumber.length !== 10) return toast.error("Valid 10-digit Mobile Number required");
    
    setIsLoading(true);
    try {
      const res = await api.post('accounts/portal/request-otp/', { 
        identifier, 
        phone_number: phoneNumber 
      });
      setIdentityData(prev => ({ ...prev, is_first_time: res.data.is_first_time }));
      toast.success(`Access code dispatched to your mobile.`);
      setStep(3);
      setResendTimer(60);
    } catch (err) {
      toast.error(err.response?.data?.error || "Connection failure");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientVerifyOTP = async (e) => {
    e.preventDefault();
    const fullOtp = otpArray.join('');
    if (fullOtp.length < 6) return toast.error("Incomplete 6-digit code");
    setIsLoading(true);
    try {
      const res = await api.post('accounts/portal/verify-otp/', { identifier, otp: fullOtp });
      
      if (res.data.user?.is_first_time || isResetting) {
          // 🛡️ ISOLATED TOKEN: Store in local state. Do not log in globally yet.
          setTempTokens({ access: res.data.access, refresh: res.data.refresh });
          toast.success("Identity Verified. Establish Credentials.");
          setStep(4);
      } else {
          loginFromData(res.data.user, res.data.access, res.data.refresh);
          toast.success("Identity Confirmed");
          navigate('/portal/dashboard');
      }
    } catch (err) {
      toast.error("Code match failed or expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizePassword = async (e) => {
      e.preventDefault();
      if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
      if (newPassword !== confirmPassword) return toast.error("Passwords do not match");

      setIsLoading(true);
      try {
          // Use Isolated Token for setup
          await api.post('accounts/portal/set-password/', 
            { password: newPassword },
            { headers: { Authorization: `Bearer ${tempTokens.access}` } }
          );
          toast.success("Security Credentials Established. Please Login.");
          // Complete reset of login state
          setStep(0);
          // Keep identifier for convenience
          setPassword('');
          setTempTokens(null);
          setIsResetting(false);
      } catch (err) {
          toast.error("Failed to set credentials.");
      } finally {
          setIsLoading(false);
      }
  };

  const handlePatientPasswordLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('accounts/login/', { username: identifier, password: password });
      loginFromData(res.data.user, res.data.access, res.data.refresh);
      toast.success(`Access Granted`);
      navigate('/portal/dashboard');
    } catch (err) {
      toast.error("Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    if (isNaN(value)) return;
    const newOtp = [...otpArray];
    newOtp[index] = value.substring(value.length - 1);
    setOtpArray(newOtp);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`).focus();
  };

  return (
    <div className="gateway-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap');
        
        .gateway-root { min-height: 100vh; display: flex; font-family: 'Plus Jakarta Sans', sans-serif; background: #ffffff; overflow: hidden; }

        .g-visual { flex: 1.25; position: relative; background: #0f172a; overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding: 0 8%; color: white; }
        .g-video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85; z-index: 0; filter: contrast(110%); }
        .g-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to right, rgba(15, 23, 42, 0.5), transparent); z-index: 1; }
        .g-content { position: relative; z-index: 2; text-shadow: 0 4px 12px rgba(0,0,0,0.6); }

        .l-panel { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 6%; position: relative; background: #ffffff; }

        .f-group { margin-bottom: 1.5rem; }
        .f-lbl { font-size: 0.65rem; font-weight: 850; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; display: block; }
        .f-wrap { display: flex; align-items: center; gap: 1rem; padding: 0 1.25rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .f-wrap:focus-within { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08); }
        .f-input { width: 100%; border: none; background: transparent; padding: 1.25rem 0; font-size: 0.9375rem; font-weight: 700; color: #0f172a; outline: none; }

        .g-btn { width: 100%; padding: 1.125rem; background: #4338ca; color: white; border: none; border-radius: 18px; font-size: 1rem; font-weight: 800; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .g-btn:hover { background: #3730a3; transform: translateY(-1px); }
        .g-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .otp-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin: 2rem 0; }
        .otp-box { aspect-ratio: 1; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; text-align: center; font-size: 1.5rem; font-weight: 900; outline: none; color: #4338ca; }
        .otp-box:focus { border-color: #4338ca; background: white; }

        .discovery-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 6px 14px; background: #f5f3ff; border-radius: 99px; font-size: 0.75rem; font-weight: 850; color: #4338ca; margin-bottom: 1.5rem; border: 1px solid #ddd6fe; }
        
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="g-visual">
        <video autoPlay muted loop playsInline className="g-video"><source src="/EMR.mp4" type="video/mp4" /></video>
        <div className="g-overlay"></div>
        <div className="g-content">
          <Activity size={48} color="#ffffff" strokeWidth={2.5} style={{ marginBottom: '2.5rem' }} />
          <h1 style={{ fontSize: '4.5rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9, color: '#ffffff' }}>Electronic <br /> <span style={{ color: '#ffffff', opacity: 0.9 }}>Medical Records</span></h1>
          <p style={{ marginTop: '2.5rem', opacity: 0.7, fontSize: '1.25rem', maxWidth: '400px', fontWeight: 500, lineHeight: 1.5 }}>Global clinical infrastructure for precision healthcare and automated registry analytics.</p>
        </div>
      </div>

      <div className="l-panel">
        {step === 0 && (
          <div className="animate-in">
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Sign In</h2>
            <p style={{ color: '#64748b', fontWeight: 600, marginBottom: '3rem' }}>Access your EMR Portal dashboard</p>

            <form onSubmit={handleDiscovery}>
              <div className="f-group">
                <label className="f-lbl">Individual / Personnel ID</label>
                <div className="f-wrap">
                  <UserIcon size={18} color="#94a3b8" />
                  <input className="f-input" placeholder="e.g. BHSPL0006 or admin" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
                </div>
              </div>
              <button className="g-btn" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 size={18} className="spin" /> : <>Identify Account <ArrowRight size={18} /></>}
              </button>
            </form>

            <div style={{
              marginTop: '3.5rem',
              padding: '1.25rem',
              background: 'rgba(67, 56, 202, 0.04)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              border: '1px solid rgba(67, 56, 202, 0.1)'
            }}>
              <ShieldCheck size={22} color="#4338ca" />
              <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
                SECURE ACCESS: This system is for authorized personnel only.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-in">
            <span className="discovery-badge"><ShieldCheck size={14} color="#4338ca" /> STAFF DETECTED</span>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Welcome Back</h2>
            <p style={{ color: '#64748b', fontWeight: 600, marginBottom: '2.5rem' }}>Verify identity for <span style={{ color: '#4338ca' }}>{identifier}</span>.</p>
            
            <form onSubmit={handleStaffLogin}>
              <div className="f-group">
                <label className="f-lbl">Master Password</label>
                <div className="f-wrap"><Lock size={18} color="#94a3b8" /><input className="f-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              </div>
              <button className="g-btn" type="submit" disabled={isLoading}>{isLoading ? <Loader2 size={18} className="spin" /> : 'Authorize Access'}</button>
            </form>
            <button style={{ background: 'none', border: 'none', width: '100%', marginTop: '2rem', fontSize: '0.8125rem', fontWeight: 800, color: '#94a3b8', cursor: 'pointer' }} onClick={() => setStep(0)}>Change Registry ID</button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in">
            <span className="discovery-badge"><CheckCircle2 size={14} color="#10b981" /> PATIENT RECORD: {identifier}</span>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900 }}>Hello, {identifier}</h2>
            <p style={{ color: '#64748b', fontWeight: 600, marginBottom: '3rem' }}>Select your preferred method to unlock your Health Records.</p>

            <form onSubmit={authMode === 'OTP' ? handlePatientRequestOTP : handlePatientPasswordLogin}>
              {authMode === 'PASSWORD' ? (
                <div className="f-group">
                  <label className="f-lbl">Password</label>
                  <div className="f-wrap"><Lock size={18} color="#94a3b8" /><input className="f-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                </div>
              ) : (
                <div className="f-group animate-in">
                  <label className="f-lbl">Registered Mobile Number (10 Digits)</label>
                  <div className="f-wrap"><Smartphone size={18} color="#94a3b8" /><input className="f-input" type="text" maxLength={10} placeholder="9876543210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} required /></div>
                </div>
              )}
              
              <button className="g-btn" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 size={18} className="spin" /> : (authMode === 'OTP' ? (isResetting ? 'Verify to Reset' : 'Request Secure Code') : 'Unlock Profile')}
              </button>
              
              {authMode === 'PASSWORD' && (
                <button type="button" style={{ background: 'none', border: 'none', width: '100%', marginTop: '1.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', cursor: 'pointer' }} onClick={() => { setAuthMode('OTP'); setIsResetting(true); }}>Forgot password?</button>
              )}
            </form>

            <button style={{ background: 'none', border: 'none', width: '100%', marginTop: '2.5rem', fontSize: '0.8125rem', fontWeight: 800, color: '#4338ca', cursor: 'pointer' }} onClick={() => { setAuthMode(authMode === 'OTP' ? 'PASSWORD' : 'OTP'); setIsResetting(false); }}>
              {authMode === 'OTP' ? 'Login with Master Password' : 'First time? Use Verification Code'}
            </button>
            
            <button style={{ background: 'none', border: 'none', width: '100%', marginTop: '2.5rem', fontSize: '0.8125rem', fontWeight: 800, color: '#cbd5e1', cursor: 'pointer' }} onClick={() => { setStep(0); setIsResetting(false); }}>Change Registry ID</button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in">
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900 }}><Fingerprint size={28} color="#4338ca" /> Verify</h2>
            <p style={{ color: '#64748b', fontWeight: 600, marginTop: '0.5rem' }}>Security code sent for <span style={{ fontWeight:900 }}>{identifier}</span>.</p>
            <form onSubmit={handlePatientVerifyOTP}>
              <div className="otp-grid">
                {otpArray.map((digit, idx) => (<input key={idx} id={`otp-${idx}`} className="otp-box" maxLength={1} value={digit} onChange={(e) => handleOtpChange(e.target.value, idx)} />))}
              </div>
              <button className="g-btn" type="submit" disabled={isLoading}>Confirm Identity</button>
            </form>
            {resendTimer > 0 ? <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>Retry in {resendTimer}s</p> : <button style={{ background: 'none', border: 'none', width: '100%', marginTop: '2rem', color: '#4338ca', fontWeight: 800, cursor: 'pointer' }} onClick={handlePatientRequestOTP}>Resend Code</button>}
            <button style={{ background: 'none', border: 'none', width: '100%', marginTop: '2rem', fontSize: '0.8125rem', fontWeight: 800, color: '#94a3b8', cursor: 'pointer' }} onClick={() => setStep(2)}>Back</button>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in">
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900 }}>Set Security Credentials</h2>
            <p style={{ color: '#64748b', fontWeight: 600, marginBottom: '2.5rem' }}>Establish permanent password for <span style={{ color: '#4338ca' }}>{identifier}</span>.</p>
            <form onSubmit={handleFinalizePassword}>
              <div className="f-group">
                <label className="f-lbl">New Password</label>
                <div className="f-wrap"><Lock size={18} color="#94a3b8" /><input className="f-input" type="password" placeholder="Min. 6 chars" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
              </div>
              <div className="f-group">
                <label className="f-lbl">Confirm Password</label>
                <div className="f-wrap"><ShieldCheck size={18} color="#94a3b8" /><input className="f-input" type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
              </div>
              <button className="g-btn" type="submit" disabled={isLoading}>{isLoading ? <Loader2 size={18} className="spin" /> : 'Finalize Credentials'}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
