import axios from 'axios';
import { getApiV1BaseUrl } from '../config/apiBase';

// Create an Axios instance with a base URL
// Environment Configuration:
// - VITE_API_URL should be set in .env.local or .env files
// - For local development: VITE_API_URL=http://localhost:4000/api/v1 in .env file
// - For production: VITE_API_URL=https://codeclass.up.railway.app/api/v1 in .env file

const api = axios.create({
  baseURL: getApiV1BaseUrl(),
});

// Interceptor to add JWT token to request headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle common response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to homepage if unauthorized
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
