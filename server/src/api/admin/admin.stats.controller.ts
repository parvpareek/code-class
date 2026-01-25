import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Get comprehensive system statistics
 */
export const getSystemStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Promise.all for parallel queries but limit concurrent database connections
    // This reduces memory pressure from too many simultaneous queries
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      totalAssignments,
      totalProblems,
      totalSubmissions,
      completedSubmissions,
      totalTests,
      activeTests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.class.count(),
      prisma.assignment.count(),
      prisma.problem.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { completed: true } }),
      prisma.codingTest.count(),
      prisma.codingTest.count({ where: { isActive: true } }),
    ]);

    // Platform integration stats
    const platformStats = {
      leetcode: {
        linked: await prisma.user.count({ where: { leetcodeCookieStatus: 'LINKED' } }),
        expired: await prisma.user.count({ where: { leetcodeCookieStatus: 'EXPIRED' } }),
        notLinked: await prisma.user.count({ where: { leetcodeCookieStatus: 'NOT_LINKED' } }),
      },
      hackerrank: {
        linked: await prisma.user.count({ where: { hackerrankCookieStatus: 'LINKED' } }),
        expired: await prisma.user.count({ where: { hackerrankCookieStatus: 'EXPIRED' } }),
        notLinked: await prisma.user.count({ where: { hackerrankCookieStatus: 'NOT_LINKED' } }),
      },
      gfg: {
        linked: await prisma.user.count({ where: { gfgCookieStatus: 'LINKED' } }),
        expired: await prisma.user.count({ where: { gfgCookieStatus: 'EXPIRED' } }),
        notLinked: await prisma.user.count({ where: { gfgCookieStatus: 'NOT_LINKED' } }),
      },
    };

    // Recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsers = await prisma.user.count({
      where: { createdAt: { gte: oneDayAgo } },
    });
    const recentSubmissions = await prisma.submission.count({
      where: { createdAt: { gte: oneDayAgo } },
    });

    res.json({
      overview: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalClasses,
        totalAssignments,
        totalProblems,
        totalSubmissions,
        completedSubmissions,
        completionRate: totalSubmissions > 0 
          ? Math.round((completedSubmissions / totalSubmissions) * 100) 
          : 0,
        totalTests,
        activeTests,
      },
      platformIntegrations: platformStats,
      recentActivity: {
        newUsers24h: recentUsers,
        newSubmissions24h: recentSubmissions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ message: 'Error fetching system statistics' });
  }
};

/**
 * Get database health metrics
 */
export const getDatabaseHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    // Test database connection
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const queryTime = Date.now() - startTime;

    // Get table counts
    const tableCounts = {
      users: await prisma.user.count(),
      classes: await prisma.class.count(),
      assignments: await prisma.assignment.count(),
      problems: await prisma.problem.count(),
      submissions: await prisma.submission.count(),
    };

    res.json({
      status: 'healthy',
      connectionTime: queryTime,
      tableCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
};

