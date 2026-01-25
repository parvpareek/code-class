import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';
import redisClient from '../../lib/redis';

// Rate limiting: 5 attempts per 15 minutes per IP
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds

/**
 * Admin login endpoint
 * Uses ADMIN_PASSWORD from environment variable
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    // Check rate limiting
    const rateLimitKey = `admin_login_attempts:${clientIp}`;
    const attempts = await redisClient.get(rateLimitKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= RATE_LIMIT_ATTEMPTS) {
      logger.warn(`Admin login rate limit exceeded for IP: ${clientIp}`);
      res.status(429).json({ 
        message: 'Too many login attempts. Please try again in 15 minutes.' 
      });
      return;
    }

    // Validate admin password
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      logger.error('ADMIN_PASSWORD environment variable is not set');
      res.status(500).json({ message: 'Admin authentication not configured' });
      return;
    }

    // Compare password (hash the env password for security)
    // In production, ADMIN_PASSWORD should be a bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, adminPassword) || password === adminPassword;

    if (!isPasswordValid) {
      // Increment rate limit counter
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW);
      
      logger.warn(`Failed admin login attempt from IP: ${clientIp}`);
      res.status(401).json({ message: 'Invalid admin password' });
      return;
    }

    // Reset rate limit on successful login
    await redisClient.del(rateLimitKey);

    // Generate admin JWT token
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not defined');
      res.status(500).json({ message: 'Authentication service error' });
      return;
    }

    const token = jwt.sign(
      { 
        admin: true,
        type: 'admin',
        ip: clientIp 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // Admin sessions last 8 hours
    );

    logger.log(`Admin login successful from IP: ${clientIp}`);

    res.status(200).json({
      token,
      message: 'Admin login successful',
      expiresIn: '8h'
    });

  } catch (error) {
    logger.error('Error in admin login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Admin logout (optional - mainly for audit logging)
 */
export const adminLogout = async (req: Request, res: Response): Promise<void> => {
  // In a more advanced setup, you could invalidate the token
  // For now, client-side token removal is sufficient
  logger.log('Admin logout');
  res.status(200).json({ message: 'Logged out successfully' });
};

