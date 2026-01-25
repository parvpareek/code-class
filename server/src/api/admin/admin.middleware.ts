import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';

/**
 * Middleware to require admin authentication
 * Validates JWT token with admin: true claim
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const bearer = req.headers.authorization;

  if (!bearer || !bearer.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Admin authentication required' });
    return;
  }

  const token = bearer.split(' ')[1];

  try {
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not defined');
      res.status(500).json({ message: 'Authentication service error' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    // Verify admin claim
    if (!decoded.admin || decoded.type !== 'admin') {
      logger.warn('Non-admin token used for admin endpoint');
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    // Attach admin info to request
    (req as any).admin = {
      isAdmin: true,
      ip: decoded.ip,
      tokenIssuedAt: decoded.iat,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Admin token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Invalid admin token' });
    } else {
      logger.error('Error verifying admin token:', error);
      res.status(500).json({ message: 'Authentication error' });
    }
  }
};

