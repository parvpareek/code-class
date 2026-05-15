import { Router } from 'express';
import { protect } from '../auth/auth.middleware';
import {
  createAssignment,
  getAssignmentById,
  deleteAssignment,
  updateAssignment,
  checkAssignmentSubmissions,
  checkMySubmissionsForAssignment,
  getMyAssignments,
  markAllAsCompleted,
  extractProblemFromUrl,
  debugExtractProblemFromUrl
} from './assignments.controller';
import { cacheMiddleware } from '../middleware/cache';

const router = Router();

// Conditional cache middleware - can be disabled via environment variable
const maybeCache = (req: Parameters<typeof cacheMiddleware>[0], res: Parameters<typeof cacheMiddleware>[1], next: Parameters<typeof cacheMiddleware>[2]) => {
  if (process.env.DISABLE_ASSIGNMENT_CACHE === 'true') {
    console.log('Assignment cache disabled via environment variable');
    return next();
  }
  return cacheMiddleware(req, res, next);
};

// Student routes
router.get('/my', protect, getMyAssignments);
router.post('/:assignmentId/check-submissions', protect, checkAssignmentSubmissions);
router.post('/:assignmentId/check-my-submissions', protect, checkMySubmissionsForAssignment);
router.post('/:assignmentId/mark-completed', protect, markAllAsCompleted);

// Teacher/Student assignment detail - do NOT cache because response varies per user/role
router.get('/:assignmentId', protect, getAssignmentById);

// Assignment CRUD
router.post('/', protect, createAssignment);
router.patch('/:assignmentId', protect, updateAssignment);
router.delete('/:assignmentId', protect, deleteAssignment);

// Submission checking: per-assignment only (POST /:assignmentId/check-submissions above)

// Mark all as completed
router.put('/:assignmentId/students/:studentId/mark-all-completed', protect, markAllAsCompleted);

// Extract problem details from URL
router.post('/extract-from-url', protect, extractProblemFromUrl);
router.post('/debug-extract-from-url', protect, debugExtractProblemFromUrl);

export default router; 