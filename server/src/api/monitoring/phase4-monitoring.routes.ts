import { Router } from 'express';
import { Phase4MonitoringController } from './phase4-monitoring.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();
const controller = new Phase4MonitoringController();

// Test Completion & Shutdown Routes
router.get('/test/:testId/completion-status', (req, res) => controller.getTestCompletionStatus(req, res));
router.post('/test/:testId/start-monitoring', (req, res) => controller.startTestMonitoring(req, res));
router.post('/test/:testId/stop-monitoring', (req, res) => controller.stopTestMonitoring(req, res));
router.post('/test/:testId/manual-shutdown', protect, (req, res) => controller.requestManualShutdown(req, res));
router.post('/test/:testId/emergency-shutdown', (req, res) => controller.emergencyShutdown(req, res));

// Cost Tracking Routes
router.get('/test/:testId/cost/real-time', (req, res) => controller.getRealTimeCost(req, res));
router.get('/test/:testId/cost/report', (req, res) => controller.generateCostReport(req, res));
router.get('/cost/summary', (req, res) => controller.getCostSummary(req, res));

// Notification Routes
router.get('/test/:testId/notifications', (req, res) => controller.getNotificationHistory(req, res));
router.post('/notifications/config', (req, res) => controller.updateNotificationConfig(req, res));
router.post('/notifications/daily-summary', (req, res) => controller.sendDailyCostSummary(req, res));

// System Health
router.get('/system/health', (req, res) => controller.getSystemHealth(req, res));

export default router; 