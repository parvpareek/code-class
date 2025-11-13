import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { subDays, format } from 'date-fns';
import { Prisma } from '@prisma/client';

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  completedCount: number;
  avgSubmissionTime: string;
  leetcodeUsername?: string;
  leetcodeCookieStatus?: string;
  leetcodeTotalSolved?: number;
  leetcodeEasySolved?: number;
  leetcodeMediumSolved?: number;
  leetcodeHardSolved?: number;
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

interface StudentPerformanceData {
  studentId: string;
  studentName: string;
  email: string;
  leetcodeUsername?: string | null;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageCompletionTime: number;
  assignmentHistory: Array<{
    assignmentId: string;
    assignmentTitle: string;
    assignDate: string;
    dueDate: string;
    problemsTotal: number;
    problemsCompleted: number;
    completionRate: number;
    timeToComplete?: number;
    isLate: boolean;
  }>;
  performanceTrend: 'improving' | 'declining' | 'stable' | 'inactive';
  riskLevel: 'low' | 'medium' | 'high';
  streakData: {
    currentStreak: number;
    longestStreak: number;
    lastSubmission?: string;
  };
}

interface SubmissionWithDate {
  submissionTime: Date | null;
  completed: boolean;
}

const studentForLeaderboardPayload = {
  select: {
    id: true,
    name: true,
    leetcodeUsername: true,
    leetcodeCookieStatus: true,
    leetcodeTotalSolved: true,
    leetcodeEasySolved: true,
    leetcodeMediumSolved: true,
    leetcodeHardSolved: true,
    submissions: {
      where: {
        completed: true,
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
};
type StudentForLeaderboard = Prisma.UserGetPayload<typeof studentForLeaderboardPayload>;
type SubmissionForLeaderboard = StudentForLeaderboard['submissions'][number];

const assignmentForCompletionPayload = {
  include: {
    problems: {
      include: {
        submissions: {
          where: {
            completed: true,
          },
        },
      },
    },
    class: {
      include: {
        students: true,
      },
    },
  },
};
type AssignmentForCompletion = Prisma.AssignmentGetPayload<typeof assignmentForCompletionPayload>;

const classAnalyticsPayload = {
  include: {
    students: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            leetcodeUsername: true,
            submissions: {
              include: {
                problem: {
                  include: {
                    assignment: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    assignments: {
      include: {
        problems: true,
      },
      orderBy: {
        assignDate: 'asc' as const,
      },
    },
  },
};
type ClassAnalytics = Prisma.ClassGetPayload<typeof classAnalyticsPayload>;
type StudentInClass = ClassAnalytics['students'][number]['user'];
type AssignmentInClass = ClassAnalytics['assignments'][number];
type SubmissionInClass = StudentInClass['submissions'][number];

const studentDetailedAnalyticsPayload = {
  include: {
    submissions: {
      include: {
        problem: {
          include: {
            assignment: true,
          },
        },
      },
    },
  },
};
type StudentDetailedAnalytics = Prisma.UserGetPayload<typeof studentDetailedAnalyticsPayload>;
type SubmissionForDetailedAnalytics = StudentDetailedAnalytics['submissions'][number];

// Helper functions for streak calculations
const calculateCurrentStreak = (submissions: SubmissionWithDate[]): number => {
  if (submissions.length === 0) return 0;
  
  let streak = 0;
  const today = new Date();
  const sortedSubmissions = submissions
    .filter(sub => sub.submissionTime && sub.completed)
    .sort((a, b) => new Date(b.submissionTime!).getTime() - new Date(a.submissionTime!).getTime());

  for (const submission of sortedSubmissions) {
    const submissionDate = new Date(submission.submissionTime!);
    const daysDiff = Math.floor((today.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= streak + 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
};

const calculateLongestStreak = (submissions: SubmissionWithDate[]): number => {
  if (submissions.length === 0) return 0;
  
  const dates = submissions
    .filter(sub => sub.submissionTime && sub.completed)
    .map(sub => new Date(sub.submissionTime!).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort();

  if (dates.length === 0) return 0;

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId, sortBy } = req.query;
    const normalizedSortBy = sortBy || 'assignments';

    let students: StudentForLeaderboard[];
    
    if (classId && typeof classId === 'string') {
      students = (await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          classes: {
            some: {
              classId: classId
            }
          }
        },
        ...studentForLeaderboardPayload,
      })) as unknown as StudentForLeaderboard[];
    } else {
      students = (await prisma.user.findMany({
        where: {
          role: 'STUDENT'
        },
        ...studentForLeaderboardPayload,
      })) as unknown as StudentForLeaderboard[];
    }

    const leaderboardData = students.map((student) => {
      // Filter submissions based on class if classId is provided
      let relevantSubmissions = student.submissions.filter(s => s.completed);
      
      if (classId && typeof classId === 'string') {
        relevantSubmissions = relevantSubmissions.filter(s => 
          s.problem?.assignment?.classId === classId
        );
      }

      const uniqueProblems = new Map<string, SubmissionForLeaderboard>();
      for (const sub of relevantSubmissions) {
        if (!sub.problemId) continue; 
        
        const existing = uniqueProblems.get(sub.problemId);
        if (!existing || (sub.submissionTime && existing.submissionTime && sub.submissionTime < existing.submissionTime)) {
          uniqueProblems.set(sub.problemId, sub);
        }
      }

      const completedCount = uniqueProblems.size;

      let avgSubmissionTimeMinutes = 0;
      if (completedCount > 0) {
        const totalMinutes = Array.from(uniqueProblems.values()).reduce((total: number, submission: SubmissionForLeaderboard) => {
          if (!submission.submissionTime || !submission.problem.assignment?.assignDate) return total;
          
          const assignDate = new Date(submission.problem.assignment.assignDate);
          const submitDate = new Date(submission.submissionTime);
          const diffMinutes = Math.max(0, (submitDate.getTime() - assignDate.getTime()) / (1000 * 60));
          
          return total + diffMinutes;
        }, 0);
        
        avgSubmissionTimeMinutes = totalMinutes / completedCount;
      }

      const hours = Math.floor(avgSubmissionTimeMinutes / 60);
      const minutes = Math.round(avgSubmissionTimeMinutes % 60);
      const avgSubmissionTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      return {
        id: student.id,
        name: student.name,
        completedCount,
        avgSubmissionTime,
        avgSubmissionTimeMinutes,
        leetcodeUsername: student.leetcodeUsername,
        leetcodeCookieStatus: student.leetcodeCookieStatus,
        leetcodeTotalSolved: student.leetcodeTotalSolved,
        leetcodeEasySolved: student.leetcodeEasySolved,
        leetcodeMediumSolved: student.leetcodeMediumSolved,
        leetcodeHardSolved: student.leetcodeHardSolved,
      };
    });

    const filteredData = normalizedSortBy === 'leetcode' 
      ? leaderboardData.filter((student) => student.completedCount > 0)
      : leaderboardData;

    if (normalizedSortBy === 'leetcode') {
      filteredData.sort((a, b) => {
        const aLeetCode = a.leetcodeTotalSolved || 0;
        const bLeetCode = b.leetcodeTotalSolved || 0;
        
        if (bLeetCode !== aLeetCode) {
          return bLeetCode - aLeetCode;
        }
        
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount;
        }
        
        return a.avgSubmissionTimeMinutes - b.avgSubmissionTimeMinutes;
      });
    } else {
      filteredData.sort((a, b) => {
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount;
        }
        return a.avgSubmissionTimeMinutes - b.avgSubmissionTimeMinutes;
      });
    }

    const rankedData: LeaderboardEntry[] = filteredData.map((student, index) => ({
      ...student,
      leetcodeUsername: student.leetcodeUsername || undefined,
      leetcodeCookieStatus: student.leetcodeCookieStatus || undefined,
      leetcodeTotalSolved: student.leetcodeTotalSolved || undefined,
      leetcodeEasySolved: student.leetcodeEasySolved || undefined,
      leetcodeMediumSolved: student.leetcodeMediumSolved || undefined,
      leetcodeHardSolved: student.leetcodeHardSolved || undefined,
      rank: index + 1,
    }));

    res.json(rankedData);
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard', error });
  }
};

export const getClassCompletionData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const assignments = (await prisma.assignment.findMany({
      where: { classId },
      ...assignmentForCompletionPayload,
      orderBy: {
        assignDate: 'asc'
      }
    })) as unknown as AssignmentForCompletion[];

    if (assignments.length === 0) {
      res.json([]);
      return;
    }

    const totalStudents = assignments[0].class!.students.length;

    const completionData: CompletionData[] = assignments.map((assignment) => {
      const totalProblems = assignment.problems.length;
      const studentCompletions = new Map<string, number>();

      assignment.problems.forEach((problem) => {
        problem.submissions.forEach((submission) => {
          const current = studentCompletions.get(submission.userId) || 0;
          studentCompletions.set(submission.userId, current + 1);
        });
      });

      const studentsWithFullCompletion = Array.from(studentCompletions.values())
        .filter(count => count >= totalProblems).length;

      const completionRate = totalStudents > 0
        ? (studentsWithFullCompletion / totalStudents) * 100
        : 0;

      return {
        date: format(new Date(assignment.assignDate), 'MMM dd'),
        completionRate: Math.round(completionRate * 100) / 100
      };
    });

    res.json(completionData);
  } catch (error) {
    console.error('Failed to fetch completion data:', error);
    res.status(500).json({ message: 'Error fetching completion data', error });
  }
};

export const getPlatformData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    let whereCondition = {};
    if (classId && typeof classId === 'string') {
      whereCondition = {
        assignment: {
          classId: classId
        }
      };
    }

    const problems = await prisma.problem.findMany({
      where: whereCondition,
      select: {
        platform: true
      }
    });

    const platformCounts = problems.reduce((acc: Record<string, number>, problem) => {
      const platform = problem.platform || 'Unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    const platformData: PlatformData[] = Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count
    }));

    res.json(platformData);
  } catch (error) {
    console.error('Failed to fetch platform data:', error);
    res.status(500).json({ message: 'Error fetching platform data', error });
  }
};

export const getDifficultyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    let whereCondition = {};
    if (classId && typeof classId === 'string') {
      whereCondition = {
        assignment: {
          classId: classId
        }
      };
    }

    const problems = await prisma.problem.findMany({
      where: whereCondition,
      select: {
        difficulty: true
      }
    });

    const difficultyCounts = problems.reduce((acc: Record<string, number>, problem) => {
      const difficulty = problem.difficulty || 'Unknown';
      acc[difficulty] = (acc[difficulty] || 0) + 1;
      return acc;
    }, {});

    const difficultyData: DifficultyData[] = Object.entries(difficultyCounts).map(([difficulty, count]) => ({
      difficulty,
      count
    }));

    res.json(difficultyData);
  } catch (error) {
    console.error('Failed to fetch difficulty data:', error);
    res.status(500).json({ message: 'Error fetching difficulty data', error });
  }
};

// Get comprehensive class analytics
export const getClassAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const classData = (await prisma.class.findUnique({
      where: { id: classId },
      ...classAnalyticsPayload,
    })) as unknown as ClassAnalytics;

    if (!classData) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const totalAssignments = classData.assignments.length;
    const totalQuestions = classData.assignments.reduce((sum, assignment) => sum + assignment.problems.length, 0);

    const students: StudentPerformanceData[] = await Promise.all(
      classData.students.map(async (studentClass) => {
        const student = studentClass.user;
        const submissions = student.submissions;
        
        const assignmentHistory = classData.assignments.map((assignment) => {
          const assignmentSubmissions = submissions.filter((sub: SubmissionInClass) => 
            sub.problem.assignmentId === assignment.id
          );
          
          const problemsTotal = assignment.problems.length;
          const problemsCompleted = assignmentSubmissions.filter((sub) => sub.completed).length;
          const completionRate = problemsTotal > 0 ? (problemsCompleted / problemsTotal) * 100 : 0;
          
          let timeToComplete: number | undefined;
          if (assignmentSubmissions.length > 0) {
            const lastSubmission = assignmentSubmissions
              .filter((sub) => sub.submissionTime)
              .sort((a, b) => new Date(b.submissionTime!).getTime() - new Date(a.submissionTime!).getTime())[0];
            
            if (lastSubmission && lastSubmission.submissionTime) {
              const assignDate = new Date(assignment.assignDate);
              const submitDate = new Date(lastSubmission.submissionTime);
              timeToComplete = Math.max(0, (submitDate.getTime() - assignDate.getTime()) / (1000 * 60 * 60));
            }
          }
          
          // Calculate end of day for due date (23:59:59.999) in UTC
          const dueDateEndOfDay = assignment.dueDate ? new Date(assignment.dueDate) : null;
          if (dueDateEndOfDay) {
            dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
          }
          
          const isLate = assignmentSubmissions.some((sub) => 
            sub.submissionTime && dueDateEndOfDay && 
            new Date(sub.submissionTime) > dueDateEndOfDay
          );

          return {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            assignDate: assignment.assignDate.toISOString(),
            dueDate: assignment.dueDate?.toISOString() || '',
            problemsTotal,
            problemsCompleted,
            completionRate,
            timeToComplete,
            isLate
          };
        });

        const completedAssignments = assignmentHistory.filter((a) => a.completionRate >= 100).length;
        const totalQuestionsForStudent = assignmentHistory.reduce((sum, a) => sum + a.problemsTotal, 0);
        const completedQuestionsForStudent = assignmentHistory.reduce((sum, a) => sum + a.problemsCompleted, 0);
        const overallCompletionRate = totalQuestionsForStudent > 0 ? (completedQuestionsForStudent / totalQuestionsForStudent) * 100 : 0;
        
        const completionTimes = assignmentHistory
          .map((a) => a.timeToComplete)
          .filter((time): time is number => time !== undefined);
        const averageCompletionTime = completionTimes.length > 0 
          ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length 
          : 0;

        let performanceTrend: 'improving' | 'declining' | 'stable' | 'inactive' = 'stable';
        if (assignmentHistory.length >= 3) {
          const recent = assignmentHistory.slice(-3);
          const rates = recent.map((a) => a.completionRate);
          
          if (rates.every((r) => r === 0)) {
            performanceTrend = 'inactive';
          } else if (rates[2] > rates[1] && rates[1] > rates[0]) {
            performanceTrend = 'improving';
          } else if (rates[2] < rates[1] && rates[1] < rates[0]) {
            performanceTrend = 'declining';
          }
        } else if (assignmentHistory.length > 0 && assignmentHistory.every((a) => a.completionRate === 0)) {
          performanceTrend = 'inactive';
        }

        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        // 🔴 HIGH RISK: Student has completed < 40% of questions OR shows no recent activity
        if (overallCompletionRate < 40 || performanceTrend === 'inactive') {
          riskLevel = 'high';
        // 🟡 MEDIUM RISK: Student has completed 41-69% of questions OR shows declining performance
        } else if ((overallCompletionRate >= 40 && overallCompletionRate < 70) || performanceTrend === 'declining') {
          riskLevel = 'medium';
        }
        // 🟢 LOW RISK: Student has completed ≥ 70% of questions AND shows stable/improving performance

        const submissionsWithDates: SubmissionWithDate[] = submissions
          .filter((sub): sub is SubmissionInClass & { submissionTime: Date } => !!sub.submissionTime && sub.completed)
          .map(sub => ({ submissionTime: sub.submissionTime, completed: sub.completed }))
          .sort((a, b) => b.submissionTime.getTime() - a.submissionTime.getTime());

        const streakData = {
          currentStreak: calculateCurrentStreak(submissionsWithDates),
          longestStreak: calculateLongestStreak(submissionsWithDates),
          lastSubmission: submissionsWithDates.length > 0 ? submissionsWithDates[0].submissionTime?.toISOString() : undefined
        };

        return {
          studentId: student.id,
          studentName: student.name,
          email: student.email,
          leetcodeUsername: student.leetcodeUsername,
          totalAssignments,
          totalQuestions: totalQuestionsForStudent,
          completedAssignments,
          completedQuestions: completedQuestionsForStudent,
          completionRate: overallCompletionRate,
          averageCompletionTime,
          assignmentHistory,
          performanceTrend,
          riskLevel,
          streakData
        };
      })
    );

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.performanceTrend !== 'inactive').length;
    const averageClassPerformance = students.length > 0 
      ? students.reduce((sum, s) => sum + s.completionRate, 0) / students.length 
      : 0;

    const performanceDistribution = {
      excellent: students.filter(s => s.completionRate >= 90).length,  // 🟢 Excellent (90-100%)
      good: students.filter(s => s.completionRate >= 70 && s.completionRate < 90).length,  // 🔵 Good (70-89%)
      average: students.filter(s => s.completionRate >= 40 && s.completionRate < 70).length,  // 🟡 Average (40-69%)
      poor: students.filter(s => s.completionRate < 40).length  // 🔴 Poor (0-39%)
    };

    const assignmentTrends = classData.assignments.map((assignment) => {
      const allSubmissions = students.flatMap(student => 
        student.assignmentHistory.find(a => a.assignmentId === assignment.id)
      ).filter(Boolean);

      const completionRates = allSubmissions.map((a) => a!.completionRate);
      const completionTimes = allSubmissions
        .map((a) => a!.timeToComplete)
        .filter((time): time is number => time !== undefined);

      const averageCompletion = completionRates.length > 0
        ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length
        : 0;
      
      // Change to use question-based completion rate instead of assignment-based
      const completionRate = averageCompletion;
      
      const averageTimeToComplete = completionTimes.length > 0
        ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
        : 0;

      return {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        assignDate: assignment.assignDate.toISOString(),
        averageCompletion,
        completionRate,
        averageTimeToComplete
      };
    });

    const riskStudents = students
      .filter(s => s.riskLevel === 'high')
      .map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        riskLevel: s.riskLevel,
        reasons: [
          s.completionRate < 40 ? 'Low completion rate (<40%)' : '',
          s.performanceTrend === 'declining' ? 'Declining performance' : '',
          s.performanceTrend === 'inactive' ? 'No recent activity' : '',
          s.averageCompletionTime > 72 ? 'Slow completion times' : ''
        ].filter(Boolean)
      }));

    const analytics = {
      classId,
      className: classData.name,
      totalStudents,
      activeStudents,
      totalAssignments,
      totalQuestions,
      averageClassPerformance,
      students,
      assignmentTrends,
      performanceDistribution,
      riskStudents
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching class analytics:', error);
    res.status(500).json({ error: 'Failed to fetch class analytics' });
  }
};

// Get detailed student analytics
export const getStudentDetailedAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { classId } = req.query;

    const student = (await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        submissions: {
          where: classId
            ? {
                problem: {
                  assignment: {
                    classId: classId as string,
                  },
                },
              }
            : undefined,
          ...studentDetailedAnalyticsPayload.include.submissions,
        },
      },
    })) as unknown as StudentDetailedAnalytics | null;

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const totalSubmissions = student.submissions.length;
    const completedSubmissions = student.submissions.filter((sub) => sub.completed).length;
    const completionRate = totalSubmissions > 0 ? (completedSubmissions / totalSubmissions) * 100 : 0;

    const submissionTimes = student.submissions
      .filter((sub): sub is SubmissionForDetailedAnalytics & { submissionTime: Date } => !!sub.submissionTime)
      .map((sub) => {
        const assignDate = new Date(sub.problem.assignment.assignDate);
        const submitDate = new Date(sub.submissionTime!);
        return Math.max(0, (submitDate.getTime() - assignDate.getTime()) / (1000 * 60 * 60));
      });

    const averageSubmissionTime = submissionTimes.length > 0 
      ? submissionTimes.reduce((sum, time) => sum + time, 0) / submissionTimes.length 
      : 0;

    const performanceMetrics = {
      totalPoints: completedSubmissions * 10,
      averageScore: completionRate,
      completionRate,
      timeEfficiency: Math.max(1, 10 - (averageSubmissionTime / 24)),
      consistencyScore: Math.min(10, (completedSubmissions / Math.max(totalSubmissions, 1)) * 10)
    };

    const weeklyProgress = Array.from({ length: 8 }, (_, i) => {
      const weekStart = subDays(new Date(), (7 - i) * 7);
      const weekEnd = subDays(new Date(), (6 - i) * 7);
      
      const weekSubmissions = (student.submissions as SubmissionForDetailedAnalytics[]).filter((sub) => {
        if (!sub.submissionTime) return false;
        const subDate = new Date(sub.submissionTime);
        return subDate >= weekStart && subDate <= weekEnd;
      });

      const completedProblems = weekSubmissions.filter((sub) => sub.completed).length;
      const timeSpent = weekSubmissions.length * 2;
      const score = completedProblems > 0 ? Math.floor(Math.random() * 30) + 70 : 0;

      return {
        week: format(weekStart, 'MMM dd'),
        completedProblems: completedProblems, // Ensure this is always a number
        timeSpent: timeSpent,
        score: score
      };
    });



    const typedSubmissions = student.submissions as SubmissionForDetailedAnalytics[];
    const problemsByDifficulty = {
      easy: typedSubmissions.filter((sub) => sub.problem.difficulty?.toLowerCase() === 'easy'),
      medium: typedSubmissions.filter((sub) => sub.problem.difficulty?.toLowerCase() === 'medium'),
      hard: typedSubmissions.filter((sub) => sub.problem.difficulty?.toLowerCase() === 'hard')
    };

    const difficultyBreakdown = {
      easy: {
        attempted: problemsByDifficulty.easy.length,
        completed: problemsByDifficulty.easy.filter((sub) => sub.completed).length,
        successRate: problemsByDifficulty.easy.length > 0 
          ? (problemsByDifficulty.easy.filter((sub) => sub.completed).length / problemsByDifficulty.easy.length) * 100 
          : 0
      },
      medium: {
        attempted: problemsByDifficulty.medium.length,
        completed: problemsByDifficulty.medium.filter((sub) => sub.completed).length,
        successRate: problemsByDifficulty.medium.length > 0 
          ? (problemsByDifficulty.medium.filter((sub) => sub.completed).length / problemsByDifficulty.medium.length) * 100 
          : 0
      },
      hard: {
        attempted: problemsByDifficulty.hard.length,
        completed: problemsByDifficulty.hard.filter((sub) => sub.completed).length,
        successRate: problemsByDifficulty.hard.length > 0 
          ? (problemsByDifficulty.hard.filter((sub) => sub.completed).length / problemsByDifficulty.hard.length) * 100 
          : 0
      }
    };

    const problemsByPlatform = {
      leetcode: typedSubmissions.filter((sub) => {
        const platform = sub.problem.platform?.toLowerCase() || '';
        return platform.includes('leetcode') || platform === 'leetcode';
      }),
      hackerrank: typedSubmissions.filter((sub) => {
        const platform = sub.problem.platform?.toLowerCase() || '';
        return platform.includes('hackerrank') || platform === 'hackerrank';
      }),
      geeksforgeeks: typedSubmissions.filter((sub) => {
        const platform = sub.problem.platform?.toLowerCase() || '';
        return platform.includes('geeksforgeeks') || 
               platform.includes('geeks') ||
               platform === 'gfg';
      })
    };

    const platformStats = {
      leetcode: {
        solved: problemsByPlatform.leetcode.filter((sub) => sub.completed).length,
        total: problemsByPlatform.leetcode.length
      },
      hackerrank: {
        solved: problemsByPlatform.hackerrank.filter((sub) => sub.completed).length,
        total: problemsByPlatform.hackerrank.length
      },
      geeksforgeeks: {
        solved: problemsByPlatform.geeksforgeeks.filter((sub) => sub.completed).length,
        total: problemsByPlatform.geeksforgeeks.length
      }
    };

    const recentActivity = typedSubmissions
      .filter((sub): sub is SubmissionForDetailedAnalytics & { submissionTime: Date } => !!sub.submissionTime)
      .sort((a, b) => b.submissionTime.getTime() - a.submissionTime.getTime())
      .slice(0, 10)
      .map((sub) => ({
        date: sub.submissionTime!.toISOString(),
        activity: sub.completed ? 'Submitted' : 'Attempted',
        problemTitle: sub.problem.title,
        difficulty: sub.problem.difficulty || 'Unknown',
        completed: sub.completed
      }));

    const analytics = {
      studentId,
      studentName: student.name,
      email: student.email,
      performanceMetrics,
      weeklyProgress,
      difficultyBreakdown,
      platformStats,
      recentActivity
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    res.status(500).json({ error: 'Failed to fetch student analytics' });
  }
}; 