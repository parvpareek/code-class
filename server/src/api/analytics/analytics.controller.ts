import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { Role, User, Submission, Problem, Assignment } from '@prisma/client';

// The Prisma queries in this file are complex, and automatically inferring 
// the exact types for nested includes can be verbose. Using `any` for now 
// to ensure functionality and resolve linter errors.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Define types for Prisma query results
type SubmissionWithProblemAndAssignment = Submission & {
  problem: Problem & {
    assignment: Assignment;
  };
};

type StudentWithSubmissions = User & {
  submissions: SubmissionWithProblemAndAssignment[];
};

type AssignmentWithProblemsAndSubmissions = Assignment & {
  problems: (Problem & {
    submissions: Submission[];
  })[];
};

type UserWhereInput = {
  role: Role;
  classes?: {
    some: {
      classId: string;
    };
  };
};

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  completedCount: number;
  avgSubmissionTime: string;
  totalScore: number;
  weeklyScore?: number;
  monthlyScore?: number;
}

interface CompletionData {
  date: string;
  completionRate: number;
}

interface PlatformData {
  platform: string;
  count: number;
}

interface DifficultyData {
  difficulty: string;
  count: number;
}

// Calculate score based on completion count and speed
const calculateScore = (completedCount: number, avgSubmissionHours: number): number => {
  const completionScore = completedCount * 100;
  const speedBonus = completedCount > 0 ? 
    Math.max(0, 50 - (avgSubmissionHours * 2)) * completedCount : 0;
  return Math.round(completionScore + speedBonus);
};

// Calculate average submission time in hours
const calculateAvgSubmissionTime = (submissions: any[]): number => {
  if (submissions.length === 0) return 0;
  
  let validSubmissions = 0;
  const totalHours = submissions.reduce((sum: number, submission: any) => {
    if (!submission.submissionTime || !submission.problem?.assignment?.assignDate) {
      return sum;
    }
    
    const assignDate = new Date(submission.problem.assignment.assignDate);
    const submitDate = new Date(submission.submissionTime);

    if (isNaN(assignDate.getTime()) || isNaN(submitDate.getTime())) {
      return sum;
    }
    
    const hoursDiff = (submitDate.getTime() - assignDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 0) return sum;

    validSubmissions++;
    return sum + hoursDiff;
  }, 0);
  
  return validSubmissions > 0 ? totalHours / validSubmissions : 0;
};

// Format hours to readable string
const formatSubmissionTime = (hours: number): string => {
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  
  if (days === 0) return `${remainingHours}h`;
  if (remainingHours === 0) return `${days}d`;
  
  return `${days}d ${remainingHours}h`;
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    const userWhere: any = { role: 'STUDENT' };
    if (classId && classId !== 'all') {
      userWhere.classes = { some: { classId: classId as string } };
    }

    const submissionWhere: any = { completed: true };
    if (classId && classId !== 'all') {
      submissionWhere.problem = { assignment: { classId: classId as string } };
    }

    const students = await prisma.user.findMany({
      where: userWhere,
      include: {
        submissions: {
          where: submissionWhere,
          include: {
            problem: {
              include: {
                assignment: true,
              },
            },
          },
        },
      },
    });

    const leaderboardEntries: LeaderboardEntry[] = students
      .map((student: any) => {
        const completedSubmissions = student.submissions;
        const completedCount = completedSubmissions.length;
        const avgSubmissionHours = calculateAvgSubmissionTime(completedSubmissions);
        const totalScore = calculateScore(completedCount, avgSubmissionHours);

        return {
          id: student.id,
          rank: 0,
          name: student.name,
          completedCount,
          avgSubmissionTime: formatSubmissionTime(avgSubmissionHours),
          totalScore,
        };
      });

    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json(leaderboardEntries);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard', error });
  }
};

export const getWeeklyLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const userWhere: any = { role: 'STUDENT' };
    if (classId && classId !== 'all') {
      userWhere.classes = { some: { classId: classId as string } };
    }

    const submissionWhere: any = {
      completed: true,
      submissionTime: { gte: weekStart },
    };
    if (classId && classId !== 'all') {
      submissionWhere.problem = { assignment: { classId: classId as string } };
    }

    const students = await prisma.user.findMany({
      where: userWhere,
      include: {
        submissions: {
          where: submissionWhere,
          include: {
            problem: {
              include: {
                assignment: true,
              },
            },
          },
        },
      },
    });

    const leaderboardEntries: LeaderboardEntry[] = students
      .map((student: any) => {
        const completedSubmissions = student.submissions;
        const completedCount = completedSubmissions.length;
        const avgSubmissionHours = calculateAvgSubmissionTime(completedSubmissions);
        const weeklyScore = calculateScore(completedCount, avgSubmissionHours);

        return {
          id: student.id,
          rank: 0,
          name: student.name,
          completedCount,
          avgSubmissionTime: formatSubmissionTime(avgSubmissionHours),
          totalScore: weeklyScore,
          weeklyScore,
        };
      });

    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json(leaderboardEntries);
  } catch (error) {
    console.error('Error fetching weekly leaderboard:', error);
    res.status(500).json({ message: 'Error fetching weekly leaderboard', error });
  }
};

export const getMonthlyLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const userWhere: any = { role: 'STUDENT' };
    if (classId && classId !== 'all') {
      userWhere.classes = { some: { classId: classId as string } };
    }

    const submissionWhere: any = {
      completed: true,
      submissionTime: { gte: monthStart },
    };
    if (classId && classId !== 'all') {
      submissionWhere.problem = { assignment: { classId: classId as string } };
    }

    const students = await prisma.user.findMany({
      where: userWhere,
      include: {
        submissions: {
          where: submissionWhere,
          include: {
            problem: {
              include: {
                assignment: true,
              },
            },
          },
        },
      },
    });

    const leaderboardEntries: LeaderboardEntry[] = students
      .map((student: any) => {
        const completedSubmissions = student.submissions;
        const completedCount = completedSubmissions.length;
        const avgSubmissionHours = calculateAvgSubmissionTime(completedSubmissions);
        const monthlyScore = calculateScore(completedCount, avgSubmissionHours);

        return {
          id: student.id,
          rank: 0,
          name: student.name,
          completedCount,
          avgSubmissionTime: formatSubmissionTime(avgSubmissionHours),
          totalScore: monthlyScore,
          monthlyScore,
        };
      });

    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json(leaderboardEntries);
  } catch (error) {
    console.error('Error fetching monthly leaderboard:', error);
    res.status(500).json({ message: 'Error fetching monthly leaderboard', error });
  }
};

export const getClassLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    if (!classId) {
      res.status(400).json({ message: 'Class ID is required' });
      return;
    }

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        classes: { some: { classId } },
      },
      include: {
        submissions: {
          where: {
            completed: true,
            problem: { assignment: { classId } },
          },
          include: {
            problem: {
              include: {
                assignment: true,
              },
            },
          },
        },
      },
    });

    const leaderboardEntries: LeaderboardEntry[] = students
      .map((student: any) => {
        const completedSubmissions = student.submissions;
        const completedCount = completedSubmissions.length;
        const avgSubmissionHours = calculateAvgSubmissionTime(completedSubmissions);
        const totalScore = calculateScore(completedCount, avgSubmissionHours);

        return {
          id: student.id,
          rank: 0,
          name: student.name,
          completedCount,
          avgSubmissionTime: formatSubmissionTime(avgSubmissionHours),
          totalScore,
        };
      });

    leaderboardEntries.sort((a, b) => b.totalScore - a.totalScore);
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.status(200).json(leaderboardEntries);
  } catch (error) {
    console.error('Error fetching class leaderboard:', error);
    res.status(500).json({ message: 'Error fetching class leaderboard', error });
  }
};

export const getClassCompletionData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const assignments = await prisma.assignment.findMany({
      where: { classId },
      include: {
        problems: {
          include: {
            submissions: {
              where: { completed: true },
            },
          },
        },
      },
      orderBy: { assignDate: 'asc' },
    });

    const totalStudents = await prisma.usersOnClasses.count({
      where: { classId },
    });

    const completionData: CompletionData[] = assignments.map((assignment: any) => {
      const totalProblems = assignment.problems.length;
      const completedSubmissions = assignment.problems.reduce(
        (sum: number, problem: any) => sum + problem.submissions.length,
        0
      );
      
      const maxPossibleSubmissions = totalStudents * totalProblems;
      const completionRate = maxPossibleSubmissions > 0 
        ? (completedSubmissions / maxPossibleSubmissions) * 100 
        : 0;

      return {
        date: assignment.assignDate.toISOString().split('T')[0],
        completionRate: Math.round(completionRate * 100) / 100,
      };
    });

    res.status(200).json(completionData);
  } catch (error) {
    console.error('Error fetching completion data:', error);
    res.status(500).json({ message: 'Error fetching completion data', error });
  }
};

export const getPlatformData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const platformCounts = await prisma.problem.groupBy({
      by: ['platform'],
      where: {
        assignment: { classId },
      },
      _count: {
        platform: true,
      },
    });

    const platformData: PlatformData[] = platformCounts.map((item: any) => ({
      platform: item.platform,
      count: item._count.platform,
    }));

    res.status(200).json(platformData);
  } catch (error) {
    console.error('Error fetching platform data:', error);
    res.status(500).json({ message: 'Error fetching platform data', error });
  }
};

export const getDifficultyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const difficultyCounts = await prisma.problem.groupBy({
      by: ['difficulty'],
      where: {
        assignment: { classId },
        difficulty: { not: null },
      },
      _count: {
        difficulty: true,
      },
    });

    const difficultyData: DifficultyData[] = difficultyCounts.map((item: any) => ({
      difficulty: item.difficulty || 'Unknown',
      count: item._count.difficulty,
    }));

    res.status(200).json(difficultyData);
  } catch (error) {
    console.error('Error fetching difficulty data:', error);
    res.status(500).json({ message: 'Error fetching difficulty data', error });
  }
};