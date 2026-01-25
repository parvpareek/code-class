import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { logger } from '../../utils/logger';
import { sanitizeUser, sanitizeUsers } from '../../utils/user-sanitization';

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const role = req.query.role as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (role && (role === 'STUDENT' || role === 'TEACHER')) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          hackerrankUsername: true,
          hackerrankCookieStatus: true,
          gfgUsername: true,
          gfgCookieStatus: true,
          leetcodeUsername: true,
          leetcodeCookieStatus: true,
          leetcodeTotalSolved: true,
          leetcodeEasySolved: true,
          leetcodeMediumSolved: true,
          leetcodeHardSolved: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: sanitizeUsers(users),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                joinCode: true,
              },
            },
          },
        },
        submissions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                platform: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const sanitizedUser = sanitizeUser(user);
    const classes = (user as any).classes?.map((uc: any) => uc.class) || [];
    const recentSubmissions = (user as any).submissions || [];

    res.json({
      user: sanitizedUser,
      classes,
      recentSubmissions,
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
};

/**
 * Create new user
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email, and password are required' });
      return;
    }

    // Validate role
    const userRole = role ? (role.toUpperCase() as Role) : Role.STUDENT;
    if (!Object.values(Role).includes(userRole)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ message: 'User with this email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    logger.log(`Admin created user: ${user.email} (${user.id})`);

    res.status(201).json({
      message: 'User created successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

/**
 * Update user
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { name, email, role, hackerrankUsername, gfgUsername, leetcodeUsername } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) {
      const userRole = role.toUpperCase() as Role;
      if (Object.values(Role).includes(userRole)) {
        updateData.role = userRole;
      }
    }
    if (hackerrankUsername !== undefined) updateData.hackerrankUsername = hackerrankUsername;
    if (gfgUsername !== undefined) updateData.gfgUsername = gfgUsername;
    if (leetcodeUsername !== undefined) updateData.leetcodeUsername = leetcodeUsername;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    logger.log(`Admin updated user: ${user.email} (${user.id})`);

    res.json({
      message: 'User updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Email already in use' });
    } else if (error.code === 'P2025') {
      res.status(404).json({ message: 'User not found' });
    } else {
      logger.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user' });
    }
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.log(`Admin deleted user: ${user.email} (${user.id})`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

/**
 * Reset user password
 */
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.log(`Admin reset password for user: ${userId}`);

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'User not found' });
    } else {
      logger.error('Error resetting password:', error);
      res.status(500).json({ message: 'Error resetting password' });
    }
  }
};

/**
 * Bulk delete users
 */
export const bulkDeleteUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: 'userIds array is required' });
      return;
    }

    const result = await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    });

    logger.log(`Admin bulk deleted ${result.count} users`);

    res.json({
      message: `${result.count} users deleted successfully`,
      deletedCount: result.count,
    });
  } catch (error) {
    logger.error('Error bulk deleting users:', error);
    res.status(500).json({ message: 'Error bulk deleting users' });
  }
};

/**
 * Bulk update user roles
 */
export const bulkUpdateRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, role } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: 'userIds array is required' });
      return;
    }

    if (!role || !Object.values(Role).includes(role.toUpperCase() as Role)) {
      res.status(400).json({ message: 'Valid role is required' });
      return;
    }

    const userRole = role.toUpperCase() as Role;

    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIds },
      },
      data: { role: userRole },
    });

    logger.log(`Admin bulk updated ${result.count} users to role: ${userRole}`);

    res.json({
      message: `${result.count} users updated to ${userRole}`,
      updatedCount: result.count,
    });
  } catch (error) {
    logger.error('Error bulk updating roles:', error);
    res.status(500).json({ message: 'Error bulk updating roles' });
  }
};

/**
 * Export users data (CSV format)
 */
export const exportUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        hackerrankUsername: true,
        gfgUsername: true,
        leetcodeUsername: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV
    const headers = ['ID', 'Email', 'Name', 'Role', 'Created At', 'HackerRank', 'GFG', 'LeetCode'];
    const rows = users.map((user: any) => [
      user.id,
      user.email,
      user.name,
      user.role,
      user.createdAt.toISOString(),
      user.hackerrankUsername || '',
      user.gfgUsername || '',
      user.leetcodeUsername || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
    res.send(csv);

    logger.log(`Admin exported ${users.length} users`);
  } catch (error) {
    logger.error('Error exporting users:', error);
    res.status(500).json({ message: 'Error exporting users' });
  }
};

