import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

interface DSAProgressItem {
  questionId: string;
  isCompleted: boolean;
  isRevision: boolean;
  notes: string | null;
  completedAt: Date | null;
  updatedAt: Date;
}

interface DSAProgressRecord {
  isCompleted: boolean;
  isRevision: boolean;
  notes: string | null;
}

interface BulkUpdateItem {
  questionId: string;
  isCompleted?: boolean;
  isRevision?: boolean;
  notes?: string | null;
}

// Get user's DSA progress
export const getUserDSAProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const progress = await prisma.dSAProgress.findMany({
      where: { userId },
      select: {
        questionId: true,
        isCompleted: true,
        isRevision: true,
        notes: true,
        completedAt: true,
        updatedAt: true
      }
    });

    // Create a map for easy lookup
    const progressMap = progress.reduce((acc: Record<string, DSAProgressItem>, item: DSAProgressItem) => {
      acc[item.questionId] = item;
      return acc;
    }, {} as Record<string, DSAProgressItem>);

    res.status(200).json({ progress: progressMap });
  } catch (error) {
    console.error('Error fetching DSA progress:', error);
    res.status(500).json({ message: 'Error fetching progress', error });
  }
};

// Update question completion status
export const updateQuestionCompletion = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { questionId } = req.params;
    const { isCompleted } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (typeof isCompleted !== 'boolean') {
      return res.status(400).json({ message: 'isCompleted must be a boolean' });
    }

    const progress = await prisma.dSAProgress.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        updatedAt: new Date()
      },
      create: {
        userId,
        questionId,
        isCompleted,
        completedAt: isCompleted ? new Date() : null
      }
    });

    res.status(200).json(progress);
  } catch (error) {
    console.error('Error updating question completion:', error);
    res.status(500).json({ message: 'Error updating completion status', error });
  }
};

// Update question revision status
export const updateQuestionRevision = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { questionId } = req.params;
    const { isRevision } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (typeof isRevision !== 'boolean') {
      return res.status(400).json({ message: 'isRevision must be a boolean' });
    }

    const progress = await prisma.dSAProgress.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      },
      update: {
        isRevision,
        updatedAt: new Date()
      },
      create: {
        userId,
        questionId,
        isRevision
      }
    });

    res.status(200).json(progress);
  } catch (error) {
    console.error('Error updating question revision:', error);
    res.status(500).json({ message: 'Error updating revision status', error });
  }
};

// Update question notes
export const updateQuestionNotes = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { questionId } = req.params;
    const { notes } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (typeof notes !== 'string' && notes !== null) {
      return res.status(400).json({ message: 'notes must be a string or null' });
    }

    const progress = await prisma.dSAProgress.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      },
      update: {
        notes,
        updatedAt: new Date()
      },
      create: {
        userId,
        questionId,
        notes
      }
    });

    res.status(200).json(progress);
  } catch (error) {
    console.error('Error updating question notes:', error);
    res.status(500).json({ message: 'Error updating notes', error });
  }
};

// Get DSA statistics
export const getDSAStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const totalProgress = await prisma.dSAProgress.findMany({
      where: { userId }
    });

    const completed = totalProgress.filter((p: DSAProgressRecord) => p.isCompleted);
    const revision = totalProgress.filter((p: DSAProgressRecord) => p.isRevision);
    const withNotes = totalProgress.filter((p: DSAProgressRecord) => p.notes && p.notes.trim());

    const stats = {
      totalTracked: totalProgress.length,
      completed: completed.length,
      revision: revision.length,
      withNotes: withNotes.length,
      completionRate: totalProgress.length > 0 ? (completed.length / totalProgress.length) * 100 : 0
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching DSA statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics', error });
  }
};

// Bulk update progress (for import/sync operations)
export const bulkUpdateProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { updates } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: 'updates must be an array' });
    }

    const results = await Promise.all(
      updates.map(async (update: BulkUpdateItem) => {
        const { questionId, isCompleted, isRevision, notes } = update;
        
        return prisma.dSAProgress.upsert({
          where: {
            userId_questionId: {
              userId,
              questionId
            }
          },
          update: {
            ...(typeof isCompleted === 'boolean' && { 
              isCompleted, 
              completedAt: isCompleted ? new Date() : null 
            }),
            ...(typeof isRevision === 'boolean' && { isRevision }),
            ...(notes !== undefined && { notes }),
            updatedAt: new Date()
          },
          create: {
            userId,
            questionId,
            isCompleted: isCompleted || false,
            isRevision: isRevision || false,
            notes: notes || null,
            completedAt: isCompleted ? new Date() : null
          }
        });
      })
    );

    res.status(200).json({ updated: results.length, results });
  } catch (error) {
    console.error('Error bulk updating DSA progress:', error);
    res.status(500).json({ message: 'Error bulk updating progress', error });
  }
}; 