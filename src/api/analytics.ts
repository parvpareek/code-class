import api from './axios';
import { CompletionData, PlatformData, DifficultyData, LeaderboardEntry } from '../types';

export const getClassCompletionData = async (classId: string) => {
  const response = await api.get(`/analytics/${classId}/completion`);
  return response.data as CompletionData[];
};

export const getPlatformData = async (classId: string) => {
  const response = await api.get(`/analytics/${classId}/platforms`);
  return response.data as PlatformData[];
};

export const getDifficultyData = async (): Promise<DifficultyData[]> => {
  const response = await api.get('/analytics/difficulty');
  return response.data;
};

export const getLeaderboard = async (classId?: string): Promise<LeaderboardEntry[]> => {
  const params = classId && classId !== 'all' ? { classId } : {};
  const response = await api.get('/analytics/leaderboard', { params });
  return response.data;
};

export const getWeeklyLeaderboard = async (classId?: string): Promise<LeaderboardEntry[]> => {
  const params = classId && classId !== 'all' ? { classId } : {};
  const response = await api.get('/analytics/leaderboard/weekly', { params });
  return response.data;
};

export const getMonthlyLeaderboard = async (classId?: string): Promise<LeaderboardEntry[]> => {
  const params = classId && classId !== 'all' ? { classId } : {};
  const response = await api.get('/analytics/leaderboard/monthly', { params });
  return response.data;
};

export const getClassLeaderboard = async (classId: string): Promise<LeaderboardEntry[]> => {
  const response = await api.get(`/analytics/leaderboard/class/${classId}`);
  return response.data;
};
