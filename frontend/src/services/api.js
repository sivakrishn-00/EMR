import axios from 'axios';

// Dynamic Cluster Bridge (Handles Dev, LAN, and Public IP Deployments)
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isDev 
  ? 'http://localhost:8000/api/'           // Terminal 1: Dev Loop
  : `http://${window.location.hostname}:9002/api/`; // Terminal 2: Production Server (9002)

export const MEDIA_URL = isDev
  ? 'http://localhost:8000'
  : `http://${window.location.hostname}:9002`;

const api = axios.create({
  baseURL: API_BASE_URL,
});


// Add a request interceptor to attach the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle token refresh or errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('accounts/login/')) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}accounts/token/refresh/`, {
          refresh: refreshToken,
        });
        localStorage.setItem('access_token', response.data.access);
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh token failed, redirect to login or clear state
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
