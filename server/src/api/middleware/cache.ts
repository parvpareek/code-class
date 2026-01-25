import { Request, Response, NextFunction } from 'express';
import redisClient from '../../lib/redis';
import { logger } from '../../utils/logger';

const CACHE_EXPIRATION_SECONDS = 900; // 15 minutes

/**
 * Cache middleware using async/await for better performance
 * Caches successful JSON responses in Redis for 15 minutes
 */
export const cacheMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.originalUrl && !req.url) {
    // Cannot determine a cache key, so skip caching
    return next();
  }
  
  const key = `__express__${req.originalUrl || req.url}`;
  
  try {
    const data = await redisClient.get(key);
    
    if (data !== null) {
      logger.debug(`✅ Cache HIT for ${key}`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).send(data);
    }
    
    logger.debug(`❌ Cache MISS for ${key}`);
    res.setHeader('X-Cache', 'MISS');
    const originalSend = res.send;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.send = (body: any): Response => {
      // Only cache successful JSON responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Ensure what we are caching is valid JSON
          const jsonData = JSON.parse(body);
          // Fire and forget - don't block response for cache write
          redisClient.setex(key, CACHE_EXPIRATION_SECONDS, JSON.stringify(jsonData))
            .then(() => {
              logger.debug(`✅ Cached successfully for ${key}`);
            })
            .catch((err) => {
              logger.error('Redis setex error:', err);
            });
        } catch (e) {
          // Not JSON, skip caching silently
        }
      }
      return originalSend.call(res, body);
    };
    
    next();
  } catch (err) {
    logger.error('Redis get error:', err);
    next(); // On error, proceed without cache
  }
}; 