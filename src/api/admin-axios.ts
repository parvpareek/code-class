import axios from 'axios';
import { getApiV1BaseUrl } from '../config/apiBase';

const adminApi = axios.create({
  baseURL: getApiV1BaseUrl(),
});

// Interceptor to add admin JWT token to request headers
adminApi.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle common response errors
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminToken');
      // Redirect to admin login if unauthorized
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;

