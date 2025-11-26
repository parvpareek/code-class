import api from './axios';
import { Class, ClassWithStudents, Assignment, TeacherAssignment, StudentAssignment } from '../types';

export const getClasses = async (): Promise<{ classes: Class[] }> => {
  const response = await api.get('/classes');
  return response.data;
};

export const getClassDetails = async (classId: string) => {
  const response = await api.get(`/classes/${classId}`);
  return response.data as ClassWithStudents;
};

export const getClassAssignments = async (classId: string): Promise<(Assignment | TeacherAssignment | StudentAssignment)[]> => {
  const response = await api.get(`/classes/${classId}/assignments`);
  return response.data;
};

export const createClass = async (name: string): Promise<Class> => {
  const response = await api.post('/classes', { name });
  return response.data;
};

export const deleteClass = async (classId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/classes/${classId}`);
  return response.data;
};

export const updateClass = async (
  classId: string,
  data: { name: string; description?: string }
): Promise<Class> => {
  const response = await api.patch(`/classes/${classId}`, data);
  return response.data;
};

export const joinClass = async (joinCode: string): Promise<{ message: string }> => {
  const response = await api.post('/classes/join', { joinCode });
  return response.data;
};

export const leaveClass = async (classId: string): Promise<{ message: string }> => {
  const response = await api.post(`/classes/${classId}/leave`);
  return response.data;
};

export const removeStudentFromClass = async (classId: string, studentId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/classes/${classId}/students/${studentId}`);
  return response.data;
};

export const checkClassSubmissionStatus = async (classId: string) => {
  const response = await api.get(`/classes/${classId}/check-submission-status`);
  return response.data;
};

export const getClassJudge0Status = async (classId: string) => {
  const response = await api.get(`/classes/${classId}/judge0-status`);
  return response.data;
};

export const archiveClass = async (classId: string): Promise<{ message: string }> => {
  const response = await api.post(`/classes/${classId}/archive`);
  return response.data;
};

export const unarchiveClass = async (classId: string): Promise<{ message: string }> => {
  const response = await api.post(`/classes/${classId}/unarchive`);
  return response.data;
};

export const getArchivedClasses = async (): Promise<{ classes: Class[] }> => {
  const response = await api.get('/classes/archived');
  return response.data;
};
