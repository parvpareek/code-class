import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { LeetCode } from 'leetcode-query';
import { Credential } from 'leetcode-query';
import { fetchAuthenticatedStats } from '../../services/enhanced-leetcode.service';
import { sanitizeUser } from '../../utils/user-sanitization';
import { logger } from '../../utils/logger';

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hackerrankUsername: true,
        hackerrankCookieStatus: true,
        gfgUsername: true,
        gfgCookieStatus: true,
        leetcodeUsername: true,
        leetcodeCookieStatus: true,
        leetcodeTotalSolved: true,
        leetcodeEasySolved: true,
        leetcodeMediumSolved: true,
        leetcodeHardSolved: true,

        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Sanitize user data before sending to frontend
    const sanitizedUser = sanitizeUser(user);
    res.status(200).json(sanitizedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { hackerrankUsername, gfgUsername, leetcodeUsername } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hackerrankUsername,
        gfgUsername,
        leetcodeUsername,
      },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

export const linkLeetCodeCredentials = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { leetcodeCookie } = req.body;

  if (!leetcodeCookie) {
    res.status(400).json({ message: 'LeetCode cookie is required' });
    return;
  }

  try {
    // Test the cookie by initializing credentials
    const credential = new Credential();
    await credential.init(leetcodeCookie);

    // Fetch LeetCode statistics using the authenticated API
    let leetcodeStats = null;
    try {
      leetcodeStats = await fetchAuthenticatedStats(leetcodeCookie);
    } catch {
      // We'll still link the account even if stats fetching fails
    }

    // If successful, save the cookie and update status with stats
    const updateData: any = {
      leetcodeCookie,
      leetcodeCookieStatus: 'LINKED',
    };

    // Add statistics if we successfully fetched them
    if (leetcodeStats) {
      updateData.leetcodeTotalSolved = leetcodeStats.totalSolved;
      updateData.leetcodeEasySolved = leetcodeStats.easySolved;
      updateData.leetcodeMediumSolved = leetcodeStats.mediumSolved;
      updateData.leetcodeHardSolved = leetcodeStats.hardSolved;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hackerrankUsername: true,
        gfgUsername: true,
        leetcodeUsername: true,
        leetcodeCookieStatus: true,
        leetcodeTotalSolved: true,
        leetcodeEasySolved: true,
        leetcodeMediumSolved: true,
        leetcodeHardSolved: true,
        createdAt: true,
      },
    });

    // Sanitize user data before sending to frontend
    const sanitizedUser = sanitizeUser(updatedUser);
    res.status(200).json({ 
      message: leetcodeStats 
        ? `LeetCode account linked successfully! Found ${leetcodeStats.totalSolved} solved problems.`
        : 'LeetCode account linked successfully! Statistics will be synced shortly.',
      user: sanitizedUser
    });
    
  } catch (error: any) {
    logger.error('LeetCode credential validation failed');

    // Check if error is due to invalid session or API issues
    if (error.message && (
      error.message.includes('login') || 
      error.message.includes('authentication') || 
      error.message.includes('401') ||
      error.message.includes('unauthorized') ||
      error.message.includes('invalid') ||
      error.message.includes('expired')
    )) {
      res.status(400).json({ 
        message: 'Invalid or expired LeetCode session cookie. Please get a fresh cookie from your browser.' 
      });
    } else {
      res.status(500).json({ 
        message: 'Error validating LeetCode credentials. Please try again or contact support.', 
        error: error.message 
      });
    }
  }
};



/**
 * Add or update Gemini API key for a teacher
 */
export const updateGeminiKey = async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;
  const { apiKey } = req.body;

  // Only teachers can add Gemini API keys
  if (role !== 'TEACHER') {
    res.status(403).json({ 
      message: 'Only teachers can manage Gemini API keys' 
    });
    return;
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 20) {
    res.status(400).json({ 
      message: 'Valid Gemini API key is required (minimum 20 characters)' 
    });
    return;
  }

  try {
    // Validate the API key first
    const isValid = await validateGeminiKey(apiKey.trim());
    
    if (!isValid) {
      res.status(400).json({ 
        message: 'Invalid Gemini API key. Please check your Google AI Studio key and try again.' 
      });
      return;
    }

    // Encrypt and store the key
    const encryptedKey = await encryptGeminiKey(apiKey.trim());

    // Update user with encrypted key
    await prisma.user.update({
      where: { id: userId },
      data: {
        geminiApiKey: encryptedKey,
        geminiKeyStatus: 'ACTIVE'
      }
    });

    res.status(200).json({
      message: 'Gemini API key added successfully! You can now generate AI-powered test cases.',
      keyStatus: 'ACTIVE'
    });

  } catch (error: any) {
    logger.error('Error adding Gemini API key');

    if (error.message.includes('Invalid API key')) {
      res.status(400).json({ 
        message: 'Invalid Gemini API key format. Please check your Google AI Studio key.' 
      });
    } else {
      res.status(500).json({ 
        message: 'Error saving Gemini API key. Please try again.', 
        error: error.message 
      });
    }
  }
};

/**
 * Remove Gemini API key for a teacher
 */
export const removeGeminiKey = async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  // Only teachers can remove Gemini API keys
  if (role !== 'TEACHER') {
    res.status(403).json({ 
      message: 'Only teachers can manage Gemini API keys' 
    });
    return;
  }

  try {
    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: {
        geminiApiKey: null,
        geminiKeyStatus: 'NOT_PROVIDED'
      }
    });

    res.status(200).json({
      message: 'Gemini API key removed successfully'
    });

  } catch (error: any) {
    logger.error('Error removing Gemini API key');
    res.status(500).json({ 
      message: 'Error removing Gemini API key. Please try again.', 
      error: error.message 
    });
  }
};

/**
 * Get Gemini key status for a teacher
 */
export const getGeminiStatus = async (req: Request, res: Response): Promise<void> => {
  const { userId, role } = req.user!;

  // Only teachers can check Gemini API key status
  if (role !== 'TEACHER') {
    res.status(403).json({ 
      message: 'Only teachers can check Gemini API key status' 
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        geminiKeyStatus: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    res.status(200).json({
      hasKey: user.geminiKeyStatus !== 'NOT_PROVIDED',
      keyStatus: user.geminiKeyStatus || 'NOT_PROVIDED'
    });

  } catch (error: any) {
    logger.error('Error fetching Gemini key status');
    res.status(500).json({ 
      message: 'Error fetching Gemini key status', 
      error: error.message 
    });
  }
};

/**
 * Validate Gemini API key
 */
async function validateGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Test the API key with a simple request
    const result = await model.generateContent('Test');
    const response = await result.response;
    const text = response.text();
    
    return text && text.length > 0;
  } catch {
    logger.warn('Gemini API key validation failed');
    return false;
  }
}

/**
 * Encrypt Gemini API key (using same encryption as Judge0)
 */
async function encryptGeminiKey(apiKey: string): Promise<string> {
  const crypto = require('crypto');
  const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
  
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey);
  cipher.setAAD(Buffer.from('gemini-api-key'));
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

export const linkHackerRankCredentials = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { hackerrankCookie } = req.body;

  if (!hackerrankCookie) {
    res.status(400).json({ message: 'HackerRank session cookie is required' });
    return;
  }

  try {
    // Test the cookie by trying to fetch submissions
    const { fetchHackerRankSubmissions } = await import('../../services/hackerrank.service');
    
    try {
      await fetchHackerRankSubmissions(hackerrankCookie, 1); // Just fetch 1 submission to test
    } catch (error: any) {
      
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        res.status(400).json({ 
          message: 'Invalid or expired HackerRank session cookie. Please get a fresh cookie from your browser.' 
        });
        return;
      }
      
      throw error;
    }

    // If successful, save the cookie and update status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hackerrankCookie,
        hackerrankCookieStatus: 'LINKED',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hackerrankUsername: true,
        hackerrankCookieStatus: true,
        gfgUsername: true,
        gfgCookieStatus: true,
        leetcodeUsername: true,
        leetcodeCookieStatus: true,
        leetcodeTotalSolved: true,
        leetcodeEasySolved: true,
        leetcodeMediumSolved: true,
        leetcodeHardSolved: true,
        createdAt: true,
      },
    });

    // Sanitize user data before sending to frontend
    const sanitizedUser = sanitizeUser(updatedUser);
    res.status(200).json({ 
      message: 'HackerRank account linked successfully! Submissions will be synced shortly.',
      user: sanitizedUser
    });
    
  } catch (error: any) {
    logger.error('HackerRank credential validation failed');

    res.status(500).json({ 
      message: 'Error validating HackerRank credentials. Please try again or contact support.', 
      error: error.message 
    });
  }
};

export const linkGfgCredentials = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { gfgCookie } = req.body;

  if (!gfgCookie) {
    res.status(400).json({ message: 'GeeksforGeeks cookie (gfguserName) is required' });
    return;
  }

  try {
    // Test the cookie by trying to fetch a test problem submission
    // We'll use a common GFG problem slug for testing
    const testProblemSlug = 'print-1-to-n-without-loop';
    const testUrl = `https://practiceapi.geeksforgeeks.org/api/latest/problems/${testProblemSlug}/submissions/user/`;
    
    const axios = await import('axios');
    
    try {
      const response = await axios.default.get<{ results?: { submissions?: unknown[] } }>(testUrl, {
        headers: {
          'Cookie': `gfguserName=${gfgCookie}`,
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://practice.geeksforgeeks.org/',
          'Accept': 'application/json',
        },
      });
      
      if (response.status === 200 && response.data?.results) {
        // validated
      } else {
        throw new Error('Invalid response from GFG API');
      }
    } catch (error: any) {
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        res.status(400).json({ 
          message: 'Invalid or expired GeeksforGeeks cookie. Please get a fresh gfguserName cookie from your browser.' 
        });
        return;
      }
      
      throw error;
    }

    // If successful, save the cookie and update status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        gfgCookie,
        gfgCookieStatus: 'LINKED',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hackerrankUsername: true,
        hackerrankCookieStatus: true,
        gfgUsername: true,
        gfgCookieStatus: true,
        leetcodeUsername: true,
        leetcodeCookieStatus: true,
        leetcodeTotalSolved: true,
        leetcodeEasySolved: true,
        leetcodeMediumSolved: true,
        leetcodeHardSolved: true,
        createdAt: true,
      },
    });

    // Sanitize user data before sending to frontend
    const sanitizedUser = sanitizeUser(updatedUser);
    res.status(200).json({ 
      message: 'GeeksforGeeks account linked successfully! Submissions will now be checked with accurate timestamps.',
      user: sanitizedUser
    });
    
  } catch (error: any) {
    logger.error('GeeksforGeeks credential validation failed');

    res.status(500).json({ 
      message: 'Error validating GeeksforGeeks credentials. Please try again or contact support.', 
      error: error.message 
    });
  }
};