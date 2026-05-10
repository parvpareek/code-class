import { Router } from 'express';
import { login } from './auth.controller';
import {
  oauthGoogleStart,
  oauthGoogleCallback,
  oauthGithubStart,
  oauthGithubCallback,
} from './oauth.controller';
import { getProfile, updateProfile, linkLeetCodeCredentials, linkHackerRankCredentials, linkGfgCredentials, updateGeminiKey, removeGeminiKey, getGeminiStatus } from './profile.controller';
import { protect } from './auth.middleware';

const router = Router();

router.post('/login', login);

router.get('/oauth/google/start', oauthGoogleStart);
router.get('/oauth/google/callback', oauthGoogleCallback);
router.get('/oauth/github/start', oauthGithubStart);
router.get('/oauth/github/callback', oauthGithubCallback);

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