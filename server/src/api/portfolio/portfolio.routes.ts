import { Router } from 'express';
import multer from 'multer';
import { protect } from '../auth/auth.middleware';
import {
  getMyPortfolio,
  updateMyPortfolio,
  getPublicPortfolio,
  getGithubPreview,
  parseResumeHandler,
  suggestPortfolioCopy,
  getGithubReadmeText,
  fillPortfolioWithAi,
} from './portfolio.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.get('/public/:slug', getPublicPortfolio);
router.get('/me', protect, getMyPortfolio);
router.get('/github-preview', protect, getGithubPreview);
router.get('/github-readme', protect, getGithubReadmeText);
router.put('/me', protect, updateMyPortfolio);
router.post(
  '/me/parse-resume',
  protect,
  (req, res, next) => {
    upload.single('resume')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : 'Upload failed' });
        return;
      }
      next();
    });
  },
  parseResumeHandler
);
router.post('/me/suggest', protect, suggestPortfolioCopy);
router.post('/me/fill-with-ai', protect, fillPortfolioWithAi);

export default router;
