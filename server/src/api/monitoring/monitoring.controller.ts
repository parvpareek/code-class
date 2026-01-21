import { Request, Response } from 'express';

// Simple stub implementation - monitoring service removed to reduce memory usage
export class MonitoringController {
  // Get system health status
  static async getSystemHealth(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        status: 'OK',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Get efficiency metrics summary
  static async getEfficiencyMetrics(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        message: 'Monitoring service disabled to reduce memory usage',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Get full system metrics
  static async getSystemMetrics(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        message: 'Monitoring service disabled to reduce memory usage',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Get user adoption statistics
  static async getUserAdoption(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        message: 'Monitoring service disabled to reduce memory usage',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Dashboard summary - essential metrics for quick overview
  static async getDashboardSummary(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        systemStatus: 'OK',
        message: 'Monitoring service disabled to reduce memory usage',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Reset metrics (admin only - for testing/maintenance)
  static async resetMetrics(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      message: 'Monitoring service disabled - no metrics to reset',
      timestamp: new Date().toISOString(),
    });
  }
} 