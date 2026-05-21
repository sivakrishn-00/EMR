import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = sessionStorage.getItem('access_token');
      if (token) {
        try {
          const res = await api.get('accounts/me/');
          setUser(res.data);
        } catch (error) {
          console.error("Failed to fetch user", error);
          sessionStorage.clear();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('accounts/login/', { username, password });
    sessionStorage.setItem('access_token', res.data.access);
    sessionStorage.setItem('refresh_token', res.data.refresh);
    
    // Fetch user details after login
    const userRes = await api.get('accounts/me/');
    setUser(userRes.data);
    return userRes.data;
  };

  const loginFromData = (userData, access, refresh) => {
    sessionStorage.setItem('access_token', access);
    sessionStorage.setItem('refresh_token', refresh);
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  // 🛡️ Idle Session Timeout: Automatically log out after 15 minutes of inactivity
  useEffect(() => {
    if (!user) return;

    const TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        window.location.href = '/login?reason=timeout';
      }, TIMEOUT_DURATION);
    };

    // Track user interactions
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // Initialize timer

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginFromData, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

