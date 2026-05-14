import api from './axios';
import type {
  CreateJobApplicationPayload,
  JobApplicationActivityDto,
  JobApplicationDto,
  JobApplicationStatus,
  PatchJobApplicationPayload,
} from '@/types/jobs';

export async function fetchJobApplications(): Promise<JobApplicationDto[]> {
  const { data } = await api.get<{ applications: JobApplicationDto[] }>('/applications');
  return data.applications;
}

export async function fetchJobApplication(
  id: string
): Promise<{ application: JobApplicationDto; activities: JobApplicationActivityDto[] }> {
  const { data } = await api.get<{
    application: JobApplicationDto;
    activities: JobApplicationActivityDto[];
  }>(`/applications/${id}`);
  return data;
}

export async function createJobApplication(
  body: CreateJobApplicationPayload
): Promise<JobApplicationDto> {
  const { data } = await api.post<{ application: JobApplicationDto }>('/applications', body);
  return data.application;
}

export async function patchJobApplication(
  id: string,
  body: PatchJobApplicationPayload
): Promise<JobApplicationDto> {
  const { data } = await api.patch<{ application: JobApplicationDto }>(`/applications/${id}`, body);
  return data.application;
}

export async function reorderJobBoard(
  columns: Record<JobApplicationStatus, string[]>
): Promise<JobApplicationDto[]> {
  const { data } = await api.post<{ applications: JobApplicationDto[] }>('/applications/reorder-board', {
    columns,
  });
  return data.applications;
}

export async function parseJobApplicationLink(url: string): Promise<{ company?: string; role?: string }> {
  const { data } = await api.post<{ company?: string; role?: string }>('/applications/parse-link', { url });
  return data;
}

export async function deleteJobApplication(id: string): Promise<void> {
  await api.delete(`/applications/${id}`);
}
