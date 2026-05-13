import { Router } from 'express';
import {
  createClass,
  getClasses,
  joinClass,
  getClassAssignments,
  getClassDetails,
  getClassmates,
  getClassmateByUserId,
  updateClass,
  deleteClass,
  leaveClass,
  removeStudentFromClass,
  archiveClass,
  unarchiveClass,
  getArchivedClasses,
  checkClassSubmissionStatus,
} from './class.controller';
import { protect, isTeacher, isStudent } from '../auth/auth.middleware';

const router = Router();

router.get('/', protect, getClasses);
router.get('/archived', protect, getArchivedClasses);
router.post('/', protect, isTeacher, createClass);
router.post('/join', protect, isStudent, joinClass);
router.get('/:classId/classmates/:userId', protect, getClassmateByUserId);
router.get('/:classId/classmates', protect, getClassmates);
router.get('/:classId', protect, getClassDetails);
router.get('/:classId/assignments', protect, getClassAssignments);
router.patch('/:classId', protect, isTeacher, updateClass);
router.post('/:classId/archive', protect, archiveClass);
router.post('/:classId/unarchive', protect, unarchiveClass);

router.get('/:classId/check-submission-status', protect, isTeacher, checkClassSubmissionStatus);
router.delete('/:classId', protect, isTeacher, deleteClass);
router.post('/:classId/leave', protect, isStudent, leaveClass);
router.delete('/:classId/students/:studentId', protect, isTeacher, removeStudentFromClass);

export default router; 