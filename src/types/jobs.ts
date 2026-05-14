export const JOB_APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'OA',
  'INTERVIEW',
  'REJECTED',
  'OFFER',
] as const;

export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export interface JobApplicationDto {
  id: string;
  userId: string;
  status: JobApplicationStatus;
  company: string;
  role: string;
  applicationUrl: string | null;
  notes: string | null;
  deadline: string | null;
  appliedAt: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationActivityDto {
  id: string;
  kind: string;
  fromStatus: JobApplicationStatus | null;
  toStatus: JobApplicationStatus | null;
  createdAt: string;
}

export interface CreateJobApplicationPayload {
  company: string;
  role: string;
  applicationUrl?: string | null;
  notes?: string | null;
  deadline?: string | null;
  tags?: string[];
  status?: JobApplicationStatus;
}

export interface PatchJobApplicationPayload {
  company?: string;
  role?: string;
  applicationUrl?: string | null;
  notes?: string | null;
  deadline?: string | null;
  tags?: string[];
  status?: JobApplicationStatus;
}
