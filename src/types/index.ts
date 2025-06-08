export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  hackerrankUsername?: string;
  leetcodeUsername?: string;
  gfgUsername?: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  joinCode: string;
  createdAt: string;
  studentCount?: number;
  assignmentCount?: number;
  assignments?: Assignment[];
}

export interface ClassWithStudents extends Class {
  students: Student[];
}

export interface Student extends User {
  completedCount?: number;
  avgSubmissionTime?: string;
}

export enum Platform {
  LeetCode = 'LeetCode',
  HackerRank = 'HackerRank',
  GeeksforGeeks = 'GeeksforGeeks',
  Other = 'Other',
}

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
}

export interface Problem {
  id: string;
  assignmentId: string;
  title: string;
  url: string;
  platform: Platform;
  difficulty: Difficulty;
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string;
  assignDate: string;
  dueDate: string;
  problems: Problem[];
}

export interface StudentAssignment extends Assignment {
  status: 'completed' | 'pending' | 'overdue';
}

export interface Submission {
  studentId: string;
  studentName: string;
  completed: boolean;
  submissionTime: string | null;
  leetcodeUsername?: string | null;
  hackerrankUsername?: string | null;
  gfgUsername?: string | null;
}

export interface ProblemWithSubmissions extends Problem {
  submissions: Submission[];
}

export interface AssignmentWithSubmissions extends Assignment {
  problems: ProblemWithSubmissions[];
}

export interface CompletionData {
  date: string;
  completionRate: number;
}

export interface PlatformData {
  platform: string;
  count: number;
}

export interface DifficultyData {
  difficulty: string;
  count: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  completedCount: number;
  avgSubmissionTime: string;
  totalScore: number;
  weeklyScore?: number;
  monthlyScore?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: 'teacher' | 'student') => Promise<void>;
  logout: () => void;
  updateProfile: (data: {
    hackerrankUsername?: string;
    leetcodeUsername?: string;
    gfgUsername?: string;
  }) => Promise<void>;
  clearError: () => void;
}
