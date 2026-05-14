import { endOfWeek, startOfWeek } from 'date-fns';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export const getStudentProfile = async (req: Request, res: Response): Promise<void> => {
    const { studentId } = req.params;

    try {
        const student = await prisma.user.findUnique({
            where: { id: studentId, role: 'STUDENT' },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                leetcodeUsername: true,
                leetcodeCookieStatus: true,
                leetcodeTotalSolved: true,
                leetcodeEasySolved: true,
                leetcodeMediumSolved: true,
                leetcodeHardSolved: true,
                portfolioProfile: {
                    select: { slug: true, published: true },
                },
                submissions: {
                    select: {
                        completed: true,
                        submissionTime: true,
                        problem: {
                            select: {
                                id: true,
                                title: true,
                                difficulty: true,
                                platform: true,
                                assignment: {
                                    select: {
                                        id: true,
                                        title: true,
                                        dueDate: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        problem: {
                           assignment: {
                               createdAt: 'desc'
                           }
                        }
                    }
                }
            }
        });

        if (!student) {
            res.status(404).json({ message: 'Student not found' });
            return;
        }

        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

        const [jobApplicationsAppliedTotal, jobApplicationsAppliedThisWeek] = await Promise.all([
            prisma.jobApplication.count({
                where: { userId: studentId, appliedAt: { not: null } },
            }),
            prisma.jobApplication.count({
                where: {
                    userId: studentId,
                    appliedAt: {
                        not: null,
                        gte: weekStart,
                        lte: weekEnd,
                    },
                },
            }),
        ]);

        const { portfolioProfile, ...rest } = student;
        res.status(200).json({
            ...rest,
            portfolio: portfolioProfile
                ? { slug: portfolioProfile.slug, published: portfolioProfile.published }
                : null,
            jobApplications: {
                appliedTotal: jobApplicationsAppliedTotal,
                appliedThisWeek: jobApplicationsAppliedThisWeek,
            },
        });
    } catch (error) {
        console.error("Error fetching student profile:", error);
        res.status(500).json({ message: 'Error fetching student profile' });
    }
}; 