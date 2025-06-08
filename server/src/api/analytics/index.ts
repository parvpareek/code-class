import { Router } from 'express';
import { 
  getLeaderboard, 
  getClassLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
  getClassCompletionData,
  getPlatformData,
  getDifficultyData 
} from './analytics.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();

// Leaderboard endpoints
router.get('/leaderboard', protect, getLeaderboard);
router.get('/leaderboard/weekly', protect, getWeeklyLeaderboard);
router.get('/leaderboard/monthly', protect, getMonthlyLeaderboard);
router.get('/leaderboard/class/:classId', protect, getClassLeaderboard);

// Analytics endpoints
router.get('/:classId/completion', protect, getClassCompletionData);
router.get('/:classId/platforms', protect, getPlatformData);
router.get('/:classId/difficulty', protect, getDifficultyData);

export default router; 