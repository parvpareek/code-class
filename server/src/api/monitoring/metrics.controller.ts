import { Request, Response } from 'express';
import { logger } from '../../utils/logger';

/**
 * Get current memory usage metrics
 */
export const getMemoryMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const usage = process.memoryUsage();
    
    // Convert bytes to MB for readability
    const metrics = {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // Resident Set Size
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round((usage as any).arrayBuffers / 1024 / 1024 * 100) / 100,
      timestamp: new Date().toISOString(),
    };

    res.json({
      status: 'success',
      memory: metrics,
      uptime: process.uptime(),
      nodeVersion: process.version,
    });
  } catch (error) {
    logger.error('Error fetching memory metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

/**
 * Get CPU usage metrics (requires sampling)
 */
export const getCpuMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const startUsage = process.cpuUsage();
    
    // Sample CPU usage over 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endUsage = process.cpuUsage(startUsage);
    
    // CPU usage in microseconds, convert to percentage
    const totalMicroseconds = endUsage.user + endUsage.system;
    const cpuPercent = (totalMicroseconds / 1000000) * 100; // Rough estimate
    
    res.json({
      status: 'success',
      cpu: {
        user: endUsage.user,
        system: endUsage.system,
        estimatedPercent: Math.round(cpuPercent * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching CPU metrics:', error);
    res.status(500).json({ error: 'Failed to fetch CPU metrics' });
  }
};

/**
 * Get comprehensive system metrics
 */
export const getSystemMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    
    res.json({
      status: 'success',
      metrics: {
        memory: {
          rss: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
          heapFree: Math.round((memory.heapTotal - memory.heapUsed) / 1024 / 1024 * 100) / 100,
          external: Math.round(memory.external / 1024 / 1024 * 100) / 100,
        },
        cpu: {
          user: cpu.user,
          system: cpu.system,
        },
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching system metrics:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
};

