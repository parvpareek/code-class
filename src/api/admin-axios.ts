import axios from 'axios';

// Separate axios instance for admin API calls
// Uses adminToken from localStorage instead of regular token

const getBaseURL = () => {
  const envURL = import.meta.env.VITE_API_URL;
  
  if (envURL) {
    if (envURL.endsWith('/api/v1')) {
      return envURL;
    } else if (envURL.endsWith('/')) {
      return envURL + 'api/v1';
    } else {
      return envURL + '/api/v1';
    }
  }
  
  return 'https://codeclass.up.railway.app/api/v1';
};

const adminApi = axios.create({
  baseURL: getBaseURL(),
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

