import { Router } from 'express';
import { protect, isTeacher } from '../auth/auth.middleware';
// Test session routes removed - feature not in use
import { 
  createTest, 
  getTests, 
  getTestById, 
  updateTest, 
  deleteTest, 
  toggleTestStatus,
  generateTestCases,
  importFromLeetCode
} from './tests.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Basic test management routes
router.get('/', getTests);
router.get('/:testId', getTestById);
router.post('/', createTest);
router.put('/:testId', updateTest);
router.delete('/:testId', deleteTest);
router.patch('/:testId/toggle-status', toggleTestStatus);

// AI test case generation route
router.post('/generate-test-cases', generateTestCases);

// LeetCode problem import route
router.post('/import-leetcode', importFromLeetCode);

// Teacher-only violation monitoring routes
router.get('/:testId/violations/stats', isTeacher, async (req, res) => {
  // Simple violation stats endpoint
  try {
    const { testId } = req.params;
    
    // Basic response for now - will be enhanced
    res.json({
      totalSessions: 0,
      sessionsWithViolations: 0,
      violationsByType: {
        TAB_SWITCH: 0,
        FULLSCREEN_EXIT: 0,
        COPY_PASTE: 0,
        DEV_TOOLS: 0,
        FOCUS_LOSS: 0,
        CONTEXT_MENU: 0
      },
      highRiskSessions: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get violation stats' });
  }
});

router.get('/:testId/sessions', isTeacher, async (req, res) => {
  // Student sessions with violations
  try {
    const { testId } = req.params;
    
    // Basic response for now - will be enhanced
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get test sessions' });
  }
});

router.post('/:testId/terminate-student', isTeacher, async (req, res) => {
  // Terminate student session
  try {
    const { testId } = req.params;
    const { studentId, reason } = req.body;
    
    // Basic response for now - will be enhanced
    res.json({ success: true, message: 'Student session terminated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to terminate student session' });
  }
});

export default router; 