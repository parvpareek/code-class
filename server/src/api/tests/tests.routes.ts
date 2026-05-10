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
  importFromLeetCode,
  getViolationStats,
  getTestSessions,
  terminateStudentSession,
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

router.get('/:testId/violations/stats', isTeacher, getViolationStats);
router.get('/:testId/sessions', isTeacher, getTestSessions);
router.post('/:testId/terminate-student', isTeacher, terminateStudentSession);

export default router; 