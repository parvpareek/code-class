import { Router } from 'express';
import { MonitoringController } from './monitoring.controller';
import { getMemoryMetrics, getCpuMetrics, getSystemMetrics } from './metrics.controller';

const router = Router();

// System health endpoint - public for load balancers
router.get('/health', MonitoringController.getSystemHealth);

// Dashboard summary - key metrics for admins
router.get('/dashboard', MonitoringController.getDashboardSummary);

// Efficiency metrics - show multi-test performance gains
router.get('/efficiency', MonitoringController.getEfficiencyMetrics);

// User adoption metrics
router.get('/adoption', MonitoringController.getUserAdoption);

// Full system metrics - detailed view
router.get('/metrics', MonitoringController.getSystemMetrics);

// Performance monitoring endpoints
router.get('/memory', getMemoryMetrics);
router.get('/cpu', getCpuMetrics);
router.get('/system', getSystemMetrics);

// Reset metrics (admin only - for testing/maintenance)
router.post('/reset', MonitoringController.resetMetrics);

export default router; 