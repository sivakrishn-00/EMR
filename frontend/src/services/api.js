import axios from 'axios';

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173';
const API_BASE_URL = isDev 
  ? `http://${window.location.hostname}:8000/api/`
  : `http://${window.location.hostname}:9002/api/`;

export const MEDIA_URL = isDev
  ? `http://${window.location.hostname}:8000`
  : `http://${window.location.hostname}:9002`;

const api = axios.create({
  baseURL: API_BASE_URL,
});


api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
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
        const refreshToken = sessionStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}accounts/token/refresh/`, {
          refresh: refreshToken,
        });
        sessionStorage.setItem('access_token', response.data.access);
        if (response.data.refresh) {
          sessionStorage.setItem('refresh_token', response.data.refresh);
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh token failed, redirect to login or clear state
        sessionStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
