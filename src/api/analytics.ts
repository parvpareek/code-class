
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

export const getDifficultyData = async (classId: string) => {
  const response = await api.get(`/analytics/${classId}/difficulty`);
  return response.data as DifficultyData[];
};

export const getLeaderboard = async (classId?: string) => {
  const url = classId ? `/analytics/leaderboard?classId=${classId}` : '/analytics/leaderboard';
  const response = await api.get(url);
  return response.data as LeaderboardEntry[];
};

export const getWeeklyLeaderboard = async (classId?: string) => {
  const url = classId ? `/analytics/leaderboard/weekly?classId=${classId}` : '/analytics/leaderboard/weekly';
  const response = await api.get(url);
  return response.data as LeaderboardEntry[];
};

export const getMonthlyLeaderboard = async (classId?: string) => {
  const url = classId ? `/analytics/leaderboard/monthly?classId=${classId}` : '/analytics/leaderboard/monthly';
  const response = await api.get(url);
  return response.data as LeaderboardEntry[];
};

export const getClassLeaderboard = async (classId: string) => {
  const response = await api.get(`/analytics/leaderboard/class/${classId}`);
  return response.data as LeaderboardEntry[];
};
