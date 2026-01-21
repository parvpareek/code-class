import { Request, Response } from 'express';
import { sendAnnouncementEmail } from '../../services/email.service';
import { checkTeacherAuthorization } from '../../services/authorization.service';
import prisma from '../../lib/prisma';

export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.params;
    const { content } = req.body;
    // @ts-expect-error: req.user is added by the protect middleware
    const { userId } = req.user;

    try {
        const isTeacherAuthorized = await checkTeacherAuthorization(userId, classId);
        if (!isTeacherAuthorized) {
            res.status(403).json({
                message: 'Only teachers can create announcements for this class'
            });
            return;
        }

        const newAnnouncement = await prisma.announcement.create({
            data: {
                content,
                classId,
                authorId: userId
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Send email notification (don't await to avoid blocking the response)
        if (newAnnouncement.author.name) {
            sendAnnouncementEmail(classId, content, newAnnouncement.author.name).catch((error) => {
                console.error('Failed to send announcement email:', error);
            });
        }

        res.status(201).json(newAnnouncement);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ message: 'Error creating announcement', error });
    }
};

export const getClassAnnouncements = async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.params;

    try {
        const announcements = await prisma.announcement.findMany({
            where: {
                classId
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Error fetching announcements', error });
    }
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const { announcementId } = req.params;
    // @ts-expect-error: req.user is added by the protect middleware
    const { userId, role } = req.user;

    try {
        const announcement = await prisma.announcement.findUnique({
            where: { id: announcementId }
        });

        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found' });
            return;
        }

        if (role !== 'TEACHER' || announcement.authorId !== userId) {
            res.status(403).json({
                message: 'You are not authorized to delete this announcement'
            });
            return;
        }

        await prisma.announcement.delete({
            where: { id: announcementId }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ message: 'Error deleting announcement', error });
    }
};
