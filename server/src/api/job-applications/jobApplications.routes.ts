import express from 'express';
import { protect } from '../auth/auth.middleware';
import {
  createJobApplication,
  deleteJobApplication,
  getJobApplication,
  listJobApplications,
  patchJobApplication,
  postParseJobLink,
  reorderJobApplications,
} from './jobApplications.controller';

const router = express.Router();

router.get('/', protect, listJobApplications);
router.post('/parse-link', protect, postParseJobLink);
router.post('/reorder-board', protect, reorderJobApplications);
router.post('/', protect, createJobApplication);
router.get('/:id', protect, getJobApplication);
router.patch('/:id', protect, patchJobApplication);
router.delete('/:id', protect, deleteJobApplication);

export default router;
