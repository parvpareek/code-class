import adminApi from './admin-axios';

export interface AdminLoginResponse {
  token: string;
  message: string;
  expiresIn: string;
}

export interface SystemStats {
  overview: {
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalAssignments: number;
    totalProblems: number;
    totalSubmissions: number;
    completedSubmissions: number;
    completionRate: number;
    totalTests: number;
    activeTests: number;
  };
  platformIntegrations: {
    leetcode: { linked: number; expired: number; notLinked: number };
    hackerrank: { linked: number; expired: number; notLinked: number };
    gfg: { linked: number; expired: number; notLinked: number };
  };
  recentActivity: {
    newUsers24h: number;
    newSubmissions24h: number;
  };
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'TEACHER';
  createdAt: string;
  updatedAt: string;
  hackerrankUsername?: string;
  hackerrankCookieStatus?: string;
  gfgUsername?: string;
  gfgCookieStatus?: string;
  leetcodeUsername?: string;
  leetcodeCookieStatus?: string;
  leetcodeTotalSolved?: number;
  leetcodeEasySolved?: number;
  leetcodeMediumSolved?: number;
  leetcodeHardSolved?: number;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MemoryMetrics {
  status: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers?: number;
    timestamp: string;
  };
  uptime: number;
  nodeVersion: string;
}

export interface CpuMetrics {
  status: string;
  cpu: {
    user: number;
    system: number;
    estimatedPercent: number;
  };
  timestamp: string;
}

export interface SystemMetrics {
  status: string;
  metrics: {
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      heapFree: number;
      external: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    process: {
      uptime: number;
      pid: number;
      nodeVersion: string;
      platform: string;
      arch: string;
    };
    timestamp: string;
  };
}

import axios from 'axios';

// Admin login doesn't require token
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

// Admin authentication (no token required)
export const adminLogin = async (password: string): Promise<AdminLoginResponse> => {
  const response = await axios.post(`${getBaseURL()}/admin/login`, { password });
  return response.data;
};

// All other admin endpoints use adminApi
import adminApi from './admin-axios';

export const adminLogout = async (): Promise<void> => {
  await adminApi.post('/admin/logout');
};

// System stats
export const getSystemStats = async (): Promise<SystemStats> => {
  const response = await adminApi.get('/admin/stats');
  return response.data;
};

export const getDatabaseHealth = async () => {
  const response = await adminApi.get('/admin/health/database');
  return response.data;
};

// Metrics
export const getMemoryMetrics = async (): Promise<MemoryMetrics> => {
  const response = await adminApi.get('/admin/metrics/memory');
  return response.data;
};

export const getCpuMetrics = async (): Promise<CpuMetrics> => {
  const response = await adminApi.get('/admin/metrics/cpu');
  return response.data;
};

export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  const response = await adminApi.get('/admin/metrics/system');
  return response.data;
};

// User management
export const getAllUsers = async (params?: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}): Promise<UsersResponse> => {
  const response = await adminApi.get('/admin/users', { params });
  return response.data;
};

export const getUserById = async (userId: string) => {
  const response = await adminApi.get(`/admin/users/${userId}`);
  return response.data;
};

export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
  role?: 'STUDENT' | 'TEACHER';
}) => {
  const response = await adminApi.post('/admin/users', data);
  return response.data;
};

export const updateUser = async (userId: string, data: {
  name?: string;
  email?: string;
  role?: 'STUDENT' | 'TEACHER';
  hackerrankUsername?: string;
  gfgUsername?: string;
  leetcodeUsername?: string;
}) => {
  const response = await adminApi.patch(`/admin/users/${userId}`, data);
  return response.data;
};

export const deleteUser = async (userId: string) => {
  const response = await adminApi.delete(`/admin/users/${userId}`);
  return response.data;
};

export const resetUserPassword = async (userId: string, newPassword: string) => {
  const response = await adminApi.post(`/admin/users/${userId}/reset-password`, { newPassword });
  return response.data;
};

export const bulkDeleteUsers = async (userIds: string[]) => {
  const response = await adminApi.post('/admin/users/bulk-delete', { userIds });
  return response.data;
};

export const bulkUpdateRoles = async (userIds: string[], role: 'STUDENT' | 'TEACHER') => {
  const response = await adminApi.post('/admin/users/bulk-update-roles', { userIds, role });
  return response.data;
};

export const exportUsers = async (): Promise<Blob> => {
  const response = await adminApi.get('/admin/users/export', {
    responseType: 'blob',
  });
  return response.data;
};

