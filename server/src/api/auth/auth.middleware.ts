import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

interface JwtAuthPayload {
  userId: string;
  role: Role;
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const bearer = req.headers.authorization;

  if (!bearer || !bearer.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = bearer.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtAuthPayload;
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
};

export const isTeacher = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'TEACHER') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
};

export const isStudent = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'STUDENT') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
}; 