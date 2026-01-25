import { Router } from 'express';
import { signup, login } from './auth.controller';
import { getProfile, updateProfile, linkLeetCodeCredentials, linkHackerRankCredentials, linkGfgCredentials, updateGeminiKey, removeGeminiKey, getGeminiStatus } from './profile.controller';
import { protect } from './auth.middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);

router.get('/me', protect, getProfile);
router.get('/profile', protect, getProfile);
router.patch('/profile', protect, updateProfile);
router.post('/leetcode-credentials', protect, linkLeetCodeCredentials);
router.post('/hackerrank-credentials', protect, linkHackerRankCredentials);
router.post('/gfg-credentials', protect, linkGfgCredentials);



// Gemini API key management (Teachers only)
router.post('/gemini-key', protect, updateGeminiKey);
router.delete('/gemini-key', protect, removeGeminiKey);
router.get('/gemini-status', protect, getGeminiStatus);

export default router; 