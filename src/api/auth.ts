import api from './axios';
import { User } from '../types';

export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const signup = async (name: string, email: string, password: string, role: 'TEACHER' | 'STUDENT') => {
  const response = await api.post('/auth/signup', { name, email, password, role });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data as User;
};

export const updateUserProfile = async (data: {
  hackerrankUsername?: string;
  leetcodeUsername?: string;
  gfgUsername?: string;
}) => {
  const response = await api.patch('/auth/profile', data);
  return response.data;
};

export const linkLeetCodeCredentials = async (leetcodeCookie: string) => {
  const response = await api.post('/auth/leetcode-credentials', { leetcodeCookie });
  return response.data;
};

export const linkHackerRankCredentials = async (hackerrankCookie: string) => {
  const response = await api.post('/auth/hackerrank-credentials', { hackerrankCookie });
  return response.data;
};

export const linkGfgCredentials = async (gfgCookie: string) => {
  const response = await api.post('/auth/gfg-credentials', { gfgCookie });
  return response.data;
};
