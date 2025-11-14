import axios from 'axios';
import { PrismaClient, User, Problem, Submission } from '@prisma/client';
import prisma from '../lib/prisma';

const HACKERRANK_API_URL = 'https://www.hackerrank.com/rest';

interface HackerRankSubmission {
  id: number;
  challenge_name: string;
  challenge_slug?: string | null;
  language: string;
  score: number;
  status: string;
  created_at: string;
  code?: string;
}

interface HackerRankSubmissionModel {
  id: number;
  status: string;
  score: number;
  language: string;
  created_at: string;
  challenge: {
    name: string;
    slug?: string;
  }
}

interface HackerRankSubmissionsResponse {
  models: HackerRankSubmissionModel[];
}

interface HackerRankSubmissionDetailResponse {
  model: {
    code: string;
    id: number;
    challenge: {
      name: string;
    };
    language: string;
    status: string;
    created_at: string;
  };
}

/**
 * Fetches recent submissions from HackerRank using an authenticated session.
 */
export const fetchHackerRankSubmissions = async (sessionCookie: string, limit: number = 100): Promise<HackerRankSubmission[]> => {
  console.log(`🔶 HackerRank: Fetching submissions (limit: ${limit})`);

  const url = `${HACKERRANK_API_URL}/contests/master/submissions?offset=0&limit=${limit}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Cookie': `_hrank_session=${sessionCookie}`,
    'Referer': 'https://www.hackerrank.com/',
    'Origin': 'https://www.hackerrank.com',
  };

  try {
    const response = await axios.get<HackerRankSubmissionsResponse>(url, { headers });

    if (response.status !== 200 || !response.data.models) {
      console.error('🔶 HackerRank: Failed to fetch submissions, status:', response.status);
      return [];
    }

    const submissions = response.data.models
      .filter((sub) => sub.status === 'Accepted') // Only accepted submissions
      .map((sub, index) => {
        // Debug: Log the full submission object for first few submissions to understand date format
        if (index < 2) {
          console.log(`🔍 DEBUG: Full submission object ${index + 1}:`, JSON.stringify({
            id: sub.id,
            status: sub.status,
            created_at: sub.created_at,
            created_at_type: typeof sub.created_at,
            challenge: sub.challenge
          }, null, 2));
        }
        
        return {
          id: sub.id,
          challenge_name: sub.challenge.name,
          challenge_slug: sub.challenge.slug || null, // Try to get slug if available
          language: sub.language,
          score: sub.score,
          status: sub.status,
          created_at: sub.created_at,
        };
      });
    
    console.log(`🔶 HackerRank: Found ${submissions.length} accepted submissions out of ${response.data.models.length} total`);
    return submissions;

  } catch (error: unknown) {
    const err = error as { response?: { status?: number }, message: string };
    if (err.response?.status === 401) {
      console.error('🔶 HackerRank: Unauthorized. The session cookie may be invalid or expired.');
      throw new Error('HackerRank session expired or invalid.');
    }
    console.error('🔶 HackerRank: Error fetching submissions:', err.message);
    throw error;
  }
};

/**
 * Fetches the code for a single HackerRank submission.
 */
export const fetchSubmissionCode = async (submissionId: number, sessionCookie: string): Promise<string | null> => {
  console.log(`🔶 HackerRank: Fetching code for submission ${submissionId}`);
  
  const url = `${HACKERRANK_API_URL}/contests/master/submissions/${submissionId}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Cookie': `_hrank_session=${sessionCookie}`,
    'Referer': 'https://www.hackerrank.com/',
    'Origin': 'https://www.hackerrank.com',
  };

  try {
    const response = await axios.get<HackerRankSubmissionDetailResponse>(url, { headers });
    if (response.status === 200 && response.data.model) {
      return response.data.model.code;
    }
    console.error(`🔶 HackerRank: Failed to fetch code for submission ${submissionId}, status:`, response.status);
    return null;
  } catch (error) {
    console.error(`🔶 HackerRank: Error fetching code for submission ${submissionId}:`, (error as Error).message);
    return null;
  }
};

/**
 * Extracts problem slug from HackerRank URL
 */
const extractHackerRankSlug = (url: string): string | null => {
  try {
    const match = url.match(/\/challenges\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Normalizes a HackerRank challenge name to match URL slug format
 */
const normalizeHackerRankChallengeName = (challengeName: string): string => {
  return challengeName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Safe date conversion that handles multiple formats from HackerRank API
 */
const safeDateFromHackerRank = (dateValue: unknown): Date => {
  try {
    // Handle null/undefined
    if (!dateValue) {
      console.warn('🔍 HackerRank: Received null/undefined date, using current time');
      return new Date();
    }

    // If it's already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? new Date() : dateValue;
    }

    // If it's a string
    if (typeof dateValue === 'string') {
      // Try parsing as ISO string first
      const isoDate = new Date(dateValue);
      if (!isNaN(isoDate.getTime())) {
        console.log(`🔍 HackerRank: Parsed ISO date: ${dateValue} -> ${isoDate.toISOString()}`);
        return isoDate;
      }

      // Try parsing as Unix timestamp in seconds (string format)
      const timestamp = parseFloat(dateValue);
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
        if (!isNaN(date.getTime())) {
          console.log(`🔍 HackerRank: Parsed timestamp string: ${dateValue} -> ${date.toISOString()}`);
          return date;
        }
      }
    }

    // If it's a number (Unix timestamp in seconds)
    if (typeof dateValue === 'number') {
      const date = new Date(dateValue * 1000); // Convert seconds to milliseconds
      if (!isNaN(date.getTime())) {
        console.log(`🔍 HackerRank: Parsed timestamp number: ${dateValue} -> ${date.toISOString()}`);
        return date;
      }
    }

    console.warn(`🔍 HackerRank: Could not parse date value: ${dateValue}, using current time`);
    return new Date();
  } catch (error) {
    console.error(`🔍 HackerRank: Error parsing date: ${dateValue}`, error);
    return new Date();
  }
};

/**
 * Process HackerRank submissions and update database records
 */
const processHackerRankSubmissions = async (
  user: User, 
  submissions: HackerRankSubmission[]
): Promise<void> => {
  console.log(`🔶 HackerRank: Processing ${submissions.length} submissions for user ${user.hackerrankUsername}`);
  
  // Get all HackerRank problems for this user's assignments
  const userProblems = await prisma.submission.findMany({
    where: {
      userId: user.id,
    },
    include: {
      problem: {
        include: {
          assignment: true
        }
      }
    }
  });

  // Create a map of problem slugs to problems for HackerRank problems only
  const problemSlugMap = new Map<string, { 
    problemId: string; 
    submissionId: string;
    assignDate: Date | null;
    dueDate: Date | null;
  }>();
  
  userProblems.forEach(submission => {
    if (submission.problem.platform.toLowerCase() === 'hackerrank') {
      const slug = extractHackerRankSlug(submission.problem.url);
      if (slug) {
        problemSlugMap.set(slug, {
          problemId: submission.problem.id,
          submissionId: submission.id,
          assignDate: submission.problem.assignment?.assignDate || null,
          dueDate: submission.problem.assignment?.dueDate || null
        });
        console.log(`🔍 Problem mapped: ${submission.problem.title} -> slug: ${slug}`);
      }
    }
  });

  console.log(`🔍 Found ${problemSlugMap.size} HackerRank problems to check for user ${user.hackerrankUsername}`);
  console.log(`🔍 Available challenge names in submissions: ${submissions.map(s => s.challenge_name).slice(0, 5).join(', ')}${submissions.length > 5 ? '...' : ''}`);

  // Update submissions that match our problems using improved logic
  let updatedCount = 0;
  
  for (const [slug, data] of problemSlugMap) {
    // Try multiple matching strategies:
    // 1. Direct slug match (if API provides slug)
    // 2. Normalized challenge name match
    const matchingSubmission = submissions.find(s => {
      // Strategy 1: Direct slug comparison (if available)
      if (s.challenge_slug === slug) {
        return true;
      }
      
      // Strategy 2: Normalize the challenge name and compare with URL slug
      const normalizedChallengeName = normalizeHackerRankChallengeName(s.challenge_name);
      if (normalizedChallengeName === slug) {
        return true;
      }
      
      // Strategy 3: Compare normalized versions of both
      const normalizedSlug = normalizeHackerRankChallengeName(slug);
      if (normalizedChallengeName === normalizedSlug) {
        return true;
      }
      
      return false;
    });
    
    if (matchingSubmission) {
      const submissionTime = safeDateFromHackerRank(matchingSubmission.created_at);
      
      // Check if submission is before assignment start date
      const isBeforeAssignment = data.assignDate && submissionTime < data.assignDate;
      
      // Check if submission is after due date
      let isAfterDueDate = false;
      if (data.dueDate) {
        const dueDateEndOfDay = new Date(data.dueDate);
        dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
        isAfterDueDate = submissionTime > dueDateEndOfDay;
      }
      
      // Accept ALL submissions (problem is solved = completed)
      const shouldComplete = true;
      
      if (shouldComplete) {
        await prisma.submission.update({
          where: { id: data.submissionId },
          data: {
            completed: true,
            submissionTime,
            updatedAt: new Date() // Track when we updated this submission
          }
        });
        
        updatedCount++;
        let status = 'ON TIME';
        if (isBeforeAssignment) {
          status = 'BEFORE ASSIGNMENT';
        } else if (isAfterDueDate) {
          status = 'LATE';
        }
        console.log(`🔶 HackerRank: Marked ${slug} as completed [${status}] for ${user.hackerrankUsername}`);
        console.log(`   Matched via: ${matchingSubmission.challenge_slug ? 'slug' : 'normalized name'} (${matchingSubmission.challenge_name})`);
        console.log(`   Submission time: ${submissionTime.toISOString()} (window: ${data.assignDate?.toISOString() || 'N/A'} to ${data.dueDate?.toISOString() || 'N/A'})`);
      }
    } else {
      console.log(`🔶 HackerRank: No submission found for ${slug} by ${user.hackerrankUsername}`);
    }
  }

  console.log(`✅ HackerRank: Updated ${updatedCount} problem submissions out of ${submissions.length} fetched submissions for ${user.hackerrankUsername}`);
};

/**
 * Core function to fetch and process HackerRank submissions for a user
 */
export const fetchHackerRankStatsAndSubmissions = async (user: User & {
  hackerrankCookieStatus?: string;
  hackerrankCookie?: string | null;
}): Promise<boolean> => {
  console.log(`🚀 HackerRank sync for user: ${user.hackerrankUsername} (ID: ${user.id})`);
  
  if (!user.hackerrankUsername) {
    console.log(`⚠️ User ${user.id} has no HackerRank username`);
    return false;
  }

  if (user.hackerrankCookieStatus !== 'LINKED' || !user.hackerrankCookie) {
    console.log(`⚠️ User ${user.id} does not have a linked HackerRank session`);
    return false;
  }

  try {
    // Fetch recent submissions
    let submissions: HackerRankSubmission[] = [];
    try {
      submissions = await fetchHackerRankSubmissions(user.hackerrankCookie, 100);
    } catch (error: unknown) {
      // If authenticated call fails, mark cookie as expired
      console.error(`❌ HackerRank submissions call failed for ${user.hackerrankUsername}, marking cookie as expired`);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { hackerrankCookieStatus: 'EXPIRED' }
      });
      
      return false;
    }

    // Process submissions and update database
    await processHackerRankSubmissions(user, submissions);
    
    console.log(`✅ Successfully synced ${submissions.length} HackerRank submissions for ${user.hackerrankUsername}`);
    return true;
    
  } catch (error: unknown) {
    console.error(`❌ Error in fetchHackerRankStatsAndSubmissions for ${user.hackerrankUsername}:`, (error as Error).message);
    return false;
  }
};

/**
 * Sync all users with linked HackerRank sessions
 */
export const syncAllLinkedHackerRankUsers = async (): Promise<void> => {
  console.log("🔶 HackerRank: Starting sync for all linked users");
  
  const users = await prisma.user.findMany({
    where: {
      hackerrankCookieStatus: 'LINKED',
      hackerrankCookie: { not: null },
      hackerrankUsername: { not: null }
    }
  });

  console.log(`🔶 HackerRank: Found ${users.length} users to sync`);
  
  for (const user of users) {
    try {
      console.log(`🔶 HackerRank: Syncing user ${user.hackerrankUsername}...`);
      await fetchHackerRankStatsAndSubmissions(user);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`🔶 HackerRank: Error syncing user ${user.hackerrankUsername}:`, (error as Error).message);
    }
  }
  
  console.log("✅ HackerRank: Finished sync for all linked users");
};

/**
 * Force sync HackerRank submissions for assignment checking (bypasses optimization)
 */
export const forceCheckHackerRankSubmissionsForAssignment = async (
  assignmentId: string,
  userId?: string
): Promise<number> => {
  console.log(`Force checking HackerRank submissions for assignment: ${assignmentId}`);
  let totalUpdatedCount = 0;

  // 1. Get all HackerRank problems for this assignment
  const hackerrankProblems = await prisma.problem.findMany({
    where: {
      assignmentId: assignmentId,
      platform: 'hackerrank',
    },
  });

  if (hackerrankProblems.length === 0) {
    console.log('No HackerRank problems in this assignment.');
    return 0;
  }

  const problemSlugMap = new Map<string, string>();
  hackerrankProblems.forEach(p => {
    const slug = extractHackerRankSlug(p.url);
    if (slug) problemSlugMap.set(slug, p.id);
  });
  console.log('Target HackerRank problem slugs:', Array.from(problemSlugMap.keys()));

  // 2. Get all students assigned to this assignment
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { classId: true, assignDate: true, dueDate: true },
  });

  if (!assignment) {
    console.log(`Assignment ${assignmentId} not found.`);
    return 0;
  }

  const users = await prisma.user.findMany({
    where: {
      classes: {
        some: {
          classId: assignment.classId,
        },
      },
      hackerrankCookieStatus: 'LINKED',
      id: userId, // If userId is provided, filter by it
    },
  });

  if (users.length === 0) {
    if (userId) {
      console.log(`User ${userId} is not in this class or has no linked HackerRank account.`);
    } else {
      console.log('No students with linked HackerRank accounts in this class.');
    }
    return 0;
  }

  // 3. For each user, fetch their recent submissions and check against the assignment problems
  for (const user of users) {
    if (!user.hackerrankCookie) continue;

    console.log(`Checking HackerRank submissions for user: ${user.name} (${user.id})`);

    try {
      const recentSubmissions = await fetchHackerRankSubmissions(user.hackerrankCookie, 200);

      // Group submissions by problem and keep only the most recent one
      const submissionsByProblem = new Map<string, { sub: typeof recentSubmissions[0], submissionTime: Date }>();
      
      for (const sub of recentSubmissions) {
        const submissionSlug = sub.challenge_slug || normalizeHackerRankChallengeName(sub.challenge_name);
        if (problemSlugMap.has(submissionSlug)) {
          const problemId = problemSlugMap.get(submissionSlug)!;
          const submissionTime = safeDateFromHackerRank(sub.created_at);
          
          // If we haven't seen this problem yet, or this submission is more recent, keep it
          const existing = submissionsByProblem.get(problemId);
          if (!existing || submissionTime > existing.submissionTime) {
            submissionsByProblem.set(problemId, { sub, submissionTime });
          }
        }
      }
      
      console.log(`📌 Processing ${submissionsByProblem.size} unique HackerRank problems (filtered from ${recentSubmissions.length} submissions)`);

      const submissionsToUpdate = [];
      for (const [problemId, { sub, submissionTime }] of submissionsByProblem) {
        // Check if submission is before assignment start date
        const isBeforeAssignment = assignment.assignDate && submissionTime < assignment.assignDate;
        
        // Check if submission is after due date
        let isAfterDueDate = false;
        if (assignment.dueDate) {
          const dueDateEndOfDay = new Date(assignment.dueDate);
          dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
          isAfterDueDate = submissionTime > dueDateEndOfDay;
        }
        
        let status = 'ON TIME';
        if (isBeforeAssignment) {
          status = 'BEFORE ASSIGNMENT';
        } else if (isAfterDueDate) {
          status = 'LATE';
        }
        
        const submissionSlug = sub.challenge_slug || normalizeHackerRankChallengeName(sub.challenge_name);
        console.log(`🔍 HackerRank: Found matching submission for ${sub.challenge_name} (${submissionSlug}) [${status}]`);
        console.log(`   Original created_at: ${sub.created_at}, Parsed time: ${submissionTime.toISOString()}`);
        submissionsToUpdate.push({
          userId: user.id,
          problemId: problemId,
          completed: true, // Always mark as completed if problem is solved
          submissionTime: submissionTime,
        });
      }

      // 4. Update the database
      if (submissionsToUpdate.length > 0) {
        const updatePromises = submissionsToUpdate.map(subData => 
          prisma.submission.updateMany({
            where: {
              userId: subData.userId,
              problemId: subData.problemId,
              completed: false, // Only update if not already completed
            },
            data: {
              completed: true,
              submissionTime: subData.submissionTime,
            },
          })
        );
        
        const results = await prisma.$transaction(updatePromises);
        const userUpdatedCount = results.reduce((sum, result) => sum + result.count, 0);

        totalUpdatedCount += userUpdatedCount;

        if (userUpdatedCount > 0) {
          console.log(`Updated ${userUpdatedCount} HackerRank submissions for ${user.name}.`);
        }
      }
    } catch (error) {
      const err = error as Error & { message: string };
      console.error(`Failed to check HackerRank submissions for ${user.name}: ${err.message}`);
      if (err.message.includes('session invalid')) {
        await prisma.user.update({
          where: { id: user.id },
          data: { hackerrankCookieStatus: 'EXPIRED' },
        });
        console.log(`Marked HackerRank cookie as expired for ${user.name}.`);
      }
    }
  }
  return totalUpdatedCount;
};
