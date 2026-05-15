import api from './axios';
import { Assignment, StudentAssignment, TeacherAssignment, Problem, AssignmentWithSubmissions, StudentAssignmentDetails } from '../types';

export interface AssignmentCreationData {
  title: string;
  description: string;
  classId: string;
  assignDate: Date;
  dueDate: Date;
  problems: {
    url: string;
    title: string;
    difficulty: string;
  }[];
}

export interface AssignmentUpdateData {
  title?: string;
  description?: string;
  assignDate?: Date;
  dueDate?: Date;
  problems?: {
    url: string;
    title: string;
    difficulty: string;
  }[];
}

export const createAssignment = async (
  assignmentData: AssignmentCreationData
): Promise<Assignment> => {
  const response = await api.post('/assignments', assignmentData);
  return response.data;
};

export const getAssignmentDetails = async (assignmentId: string): Promise<AssignmentWithSubmissions | StudentAssignmentDetails> => {
  const response = await api.get(`/assignments/${assignmentId}`);
  return response.data;
}

export const getClassAssignments = async (classId: string): Promise<Assignment[]> => {
  const response = await api.get(`/classes/${classId}/assignments`);
  return response.data;
};

export const getMyAssignments = async (): Promise<StudentAssignment[]> => {
  const response = await api.get('/assignments/my');
  return response.data;
};

export const updateAssignment = async (
  assignmentId: string,
  data: AssignmentUpdateData
) => {
  const response = await api.patch(`/assignments/${assignmentId}`, data);
  return response.data;
};

export const deleteAssignment = async (assignmentId: string) => {
  const response = await api.delete(`/assignments/${assignmentId}`);
  return response.data;
};

export const checkSubmissionsForAssignment = async (
  assignmentId: string
): Promise<{ message: string; lastChecked: string }> => {
  const response = await api.post(
    `/assignments/${assignmentId}/check-submissions`
  );
  return response.data;
};

export const checkMySubmissionsForAssignment = async (
  assignmentId: string
): Promise<{ message: string }> => {
  const response = await api.post(
    `/assignments/${assignmentId}/check-my-submissions`
  );
  return response.data;
};

export const extractProblemFromUrl = async (url: string): Promise<{
  title: string;
  difficulty: string;
  platform: string;
  url: string;
}> => {
  const response = await api.post('/assignments/extract-from-url', { url });
  return response.data.problem;
};
