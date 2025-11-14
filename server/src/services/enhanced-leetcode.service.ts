import { LeetCode, Credential } from 'leetcode-query';
import { PrismaClient, User, Problem, Submission } from '@prisma/client';
import prisma from '../lib/prisma';

interface LeetCodeStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

interface LeetCodeSubmission {
  titleSlug: string;
  timestamp: number;
  statusDisplay: string;
  lang: string;
}

interface LeetCodeUserProfile {
  matchedUser: {
    submitStats: {
      acSubmissionNum: Array<{
        difficulty: 'All' | 'Easy' | 'Medium' | 'Hard';
        count: number;
      }>;
    };
  };
}

/**
 * Fetches LeetCode stats using unauthenticated API call
 */
export const fetchPublicLeetCodeStats = async (username: string): Promise<LeetCodeStats | null> => {
  console.log(`📊 Fetching public LeetCode stats for: ${username}`);
  
  try {
    const leetcode = new LeetCode();
    const user = await leetcode.user(username) as LeetCodeUserProfile;
    
    if (!user || !user.matchedUser) {
      console.log(`❌ Could not fetch public stats for ${username}`);
      return null;
    }

    // Extract accurate stats from matchedUser.submitStats.acSubmissionNum
    const stats = user.matchedUser.submitStats.acSubmissionNum;
    if (!stats) {
      console.log(`❌ No submission stats found for ${username}`);
      return null;
    }

    const result: LeetCodeStats = {
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0
    };

    // Parse the accurate difficulty breakdown from the API
    stats.forEach((stat) => {
      switch (stat.difficulty) {
        case 'All':
          result.totalSolved = stat.count;
          break;
        case 'Easy':
          result.easySolved = stat.count;
          break;
        case 'Medium':
          result.mediumSolved = stat.count;
          break;
        case 'Hard':
          result.hardSolved = stat.count;
          break;
      }
    });
    
    console.log(`📈 User ${username} public stats: Total=${result.totalSolved}, Easy=${result.easySolved}, Medium=${result.mediumSolved}, Hard=${result.hardSolved}`);
    
    return result;
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error fetching public stats for ${username}:`, err.message);
    return null;
  }
};

/**
 * Fetches recent submissions using authenticated API call
 */
export const fetchAuthenticatedSubmissions = async (cookie: string, limit: number = 100): Promise<LeetCodeSubmission[]> => {
  console.log(`🔒 Fetching authenticated submissions (limit: ${limit})`);
  
  try {
    const credential = new Credential();
    await credential.init(cookie);
    
    const leetcode = new LeetCode(credential);
    
    const submissionsResponse = await leetcode.submissions({ limit, offset: 0 });
    
    // Based on test results, the API returns an array directly, not an object with submissions property
    if (!submissionsResponse || !Array.isArray(submissionsResponse)) {
      console.log(`❌ Could not fetch authenticated submissions - invalid response format`);
      return [];
    }

    // Filter only accepted submissions
    const acceptedSubmissions = submissionsResponse.filter((sub) => 
      sub.statusDisplay === 'Accepted'
    );
    
    console.log(`📋 Found ${acceptedSubmissions.length} accepted submissions out of ${submissionsResponse.length} total`);
    
    return acceptedSubmissions.map((sub) => ({
      titleSlug: sub.titleSlug,
      timestamp: sub.timestamp,
      statusDisplay: sub.statusDisplay,
      lang: sub.lang
    }));
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error fetching authenticated submissions:`, err.message);
    throw error; // Re-throw to allow caller to handle expired sessions
  }
};

/**
 * Enhanced function to get comprehensive stats using authenticated API
 */
export const fetchAuthenticatedStats = async (cookie: string): Promise<LeetCodeStats | null> => {
  console.log(`🔒 Fetching authenticated LeetCode stats`);
  
  try {
    const credential = new Credential();
    await credential.init(cookie);
    
    const leetcode = new LeetCode(credential);
    
    // Get the current user's username to fetch their profile with accurate stats
    const whoAmI = await leetcode.whoami();
    if (!whoAmI || !whoAmI.username) {
      console.log(`❌ Could not determine current user`);
      return null;
    }

    // Fetch the user's profile with accurate difficulty stats
    const userProfile = await leetcode.user(whoAmI.username) as LeetCodeUserProfile;
    if (!userProfile || !userProfile.matchedUser) {
      console.log(`❌ Could not fetch user profile for ${whoAmI.username}`);
      return null;
    }

    // Extract accurate stats from matchedUser.submitStats.acSubmissionNum
    const stats = userProfile.matchedUser.submitStats.acSubmissionNum;
    if (!stats) {
      console.log(`❌ No submission stats found for authenticated user ${whoAmI.username}`);
      return null;
    }

    const result: LeetCodeStats = {
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0
    };

    // Parse the accurate difficulty breakdown from the API
    stats.forEach((stat) => {
      switch (stat.difficulty) {
        case 'All':
          result.totalSolved = stat.count;
          break;
        case 'Easy':
          result.easySolved = stat.count;
          break;
        case 'Medium':
          result.mediumSolved = stat.count;
          break;
        case 'Hard':
          result.hardSolved = stat.count;
          break;
      }
    });
    
    console.log(`📈 Authenticated stats for ${whoAmI.username}: Total=${result.totalSolved}, Easy=${result.easySolved}, Medium=${result.mediumSolved}, Hard=${result.hardSolved}`);
    
    return result;
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error fetching authenticated stats:`, err.message);
    throw error;
  }
};

/**
 * Core function to fetch stats and submissions for a user
 */
export const fetchLeetCodeStatsAndSubmissions = async (user: User & {
  leetcodeCookieStatus?: string;
  leetcodeCookie?: string | null;
  leetcodeTotalSolved?: number | null;
}): Promise<boolean> => {
  console.log(`🚀 Enhanced LeetCode sync for user: ${user.leetcodeUsername} (ID: ${user.id})`);
  
  if (!user.leetcodeUsername) {
    console.log(`⚠️ User ${user.id} has no LeetCode username`);
    return false;
  }

  if (user.leetcodeCookieStatus !== 'LINKED' || !user.leetcodeCookie) {
    console.log(`⚠️ User ${user.id} does not have a linked LeetCode session`);
    return false;
  }

  try {
    // Step 1: Get authenticated stats (this gives us more accurate data)
    let authenticatedStats: LeetCodeStats | null = null;
    try {
      authenticatedStats = await fetchAuthenticatedStats(user.leetcodeCookie);
    } catch (error: unknown) {
      // If authenticated call fails, mark cookie as expired
      console.error(`❌ Authenticated stats call failed for ${user.leetcodeUsername}, marking cookie as expired`);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { leetcodeCookieStatus: 'EXPIRED' }
      });
      
      return false;
    }
    
    if (!authenticatedStats) {
      console.log(`❌ Could not fetch authenticated stats for ${user.leetcodeUsername}`);
      return false;
    }

    // Step 2: Check if we need to update (compare with cached values)
    const needsUpdate = 
      user.leetcodeTotalSolved === null || 
      authenticatedStats.totalSolved > (user.leetcodeTotalSolved || 0);
    
    if (!needsUpdate) {
      console.log(`✅ User ${user.leetcodeUsername} stats are up to date (${authenticatedStats.totalSolved} solved)`);
      return true;
    }

    console.log(`📈 User ${user.leetcodeUsername} has new submissions. Previous: ${user.leetcodeTotalSolved || 0}, Current: ${authenticatedStats.totalSolved}`);

    // Step 3: Fetch recent submissions (authenticated)
    let submissions: LeetCodeSubmission[] = [];
    try {
      submissions = await fetchAuthenticatedSubmissions(user.leetcodeCookie, 100);
    } catch (error: unknown) {
      console.error(`❌ Authenticated submissions call failed for ${user.leetcodeUsername}`);
      return false;
    }

    // Step 4: Process submissions and update database
    await processLeetCodeSubmissions(user, submissions, authenticatedStats);
    
    console.log(`✅ Successfully synced ${submissions.length} submissions for ${user.leetcodeUsername}`);
    return true;
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error in fetchLeetCodeStatsAndSubmissions for ${user.leetcodeUsername}:`, err.message);
    return false;
  }
};

/**
 * Safely convert a timestamp to a valid Date object
 */
const safeDateFromTimestamp = (timestamp: number): Date => {
  // Handle various timestamp formats
  let validTimestamp = timestamp;
  
  // If timestamp is in seconds (typical Unix timestamp), convert to milliseconds
  if (timestamp < 1e12) { // Less than year 2001 in milliseconds, likely in seconds
    validTimestamp = timestamp * 1000;
  }
  
  // Create date and validate it's reasonable (between 1970 and 2030)
  const date = new Date(validTimestamp);
  const year = date.getFullYear();
  
  if (isNaN(date.getTime()) || year < 1970 || year > 2030) {
    console.warn(`⚠️ Invalid timestamp ${timestamp}, using current date`);
    return new Date();
  }
  
  return date;
};

/**
 * Process submissions and update database records
 */
const processLeetCodeSubmissions = async (
  user: User, 
  submissions: LeetCodeSubmission[], 
  stats: LeetCodeStats
): Promise<void> => {
  console.log(`🔄 Processing ${submissions.length} submissions for user ${user.leetcodeUsername}`);
  
  // Get all LeetCode problems for this user's assignments
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

  // Create a map of problem slugs to problems with assignment info
  const problemSlugMap = new Map<string, { 
    problemId: string; 
    submissionId: string;
    assignDate: Date | null;
    dueDate: Date | null;
  }>();
  
  userProblems.forEach(submission => {
    if (submission.problem.platform.toLowerCase() === 'leetcode') {
      const slug = extractLeetCodeSlug(submission.problem.url);
      if (slug) {
        problemSlugMap.set(slug, {
          problemId: submission.problem.id,
          submissionId: submission.id,
          assignDate: submission.problem.assignment?.assignDate || null,
          dueDate: submission.problem.assignment?.dueDate || null
        });
      }
    }
  });

  // Update submissions that match our problems
  let updatedCount = 0;
  const submissionSlugs = new Set(submissions.map(s => s.titleSlug));
  
  for (const [slug, data] of problemSlugMap) {
    if (submissionSlugs.has(slug)) {
      // Find the corresponding submission to get timestamp
      const submission = submissions.find(s => s.titleSlug === slug);
      
      const submissionTime = submission 
        ? safeDateFromTimestamp(submission.timestamp)
        : new Date();
      
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
            submissionTime
          }
        });
        
        updatedCount++;
        let status = 'ON TIME';
        if (isBeforeAssignment) {
          status = 'BEFORE ASSIGNMENT';
        } else if (isAfterDueDate) {
          status = 'LATE';
        }
        console.log(`✅ LeetCode: Marked ${slug} as completed [${status}] (submitted: ${submissionTime.toISOString()}, window: ${data.assignDate?.toISOString() || 'N/A'} to ${data.dueDate?.toISOString() || 'N/A'})`);
      }
    }
  }

  // Update user's cached stats
  await prisma.user.update({
    where: { id: user.id },
    data: {
      leetcodeTotalSolved: stats.totalSolved,
      leetcodeEasySolved: stats.easySolved,
      leetcodeMediumSolved: stats.mediumSolved,
      leetcodeHardSolved: stats.hardSolved,
    }
  });

  console.log(`✅ Updated ${updatedCount} problem submissions out of ${submissions.length} fetched submissions`);
};

/**
 * Extract LeetCode problem slug from URL
 */
const extractLeetCodeSlug = (url: string): string | null => {
  try {
    const match = url.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Force sync LeetCode submissions for assignment checking (bypasses optimization)
 */
export const forceCheckLeetCodeSubmissionsForAssignment = async (
  assignmentId: string,
  userId?: string
): Promise<number> => {
  console.log(`Force checking LeetCode submissions for assignment: ${assignmentId}`);
  let totalUpdatedCount = 0;

  // 1. Get all LeetCode problems for this assignment
  const leetcodeProblems = await prisma.problem.findMany({
    where: {
      assignmentId: assignmentId,
      platform: 'leetcode',
    },
  });

  if (leetcodeProblems.length === 0) {
    console.log('No LeetCode problems in this assignment.');
    return 0;
  }

  const problemSlugs = new Set(
    leetcodeProblems.map(p => extractLeetCodeSlug(p.url)).filter(Boolean) as string[]
  );
  console.log('Target LeetCode problem slugs:', problemSlugs);

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
      leetcodeCookieStatus: 'LINKED',
      id: userId, // If userId is provided, filter by it
    },
  });

  if (users.length === 0) {
    if (userId) {
      console.log(`User ${userId} is not in this class or has no linked LeetCode account.`);
    } else {
      console.log('No students with linked LeetCode accounts in this class.');
    }
    return 0;
  }

  // 3. For each user, fetch their recent submissions and check against the assignment problems
  for (const user of users) {
    if (!user.leetcodeCookie) continue;

    console.log(`Checking LeetCode submissions for user: ${user.name} (${user.id})`);

    try {
      const recentSubmissions = await fetchAuthenticatedSubmissions(user.leetcodeCookie, 200);

      const relevantSubmissions = recentSubmissions.filter(s =>
        problemSlugs.has(s.titleSlug)
      );

      if (relevantSubmissions.length === 0) {
        console.log(`No relevant LeetCode submissions found for ${user.name}.`);
        continue;
      }

      console.log(`Found ${relevantSubmissions.length} relevant submissions for ${user.name}.`);

      // Find the corresponding DB problem for each submission
      // Group submissions by problem and keep only the most recent one
      type SubmissionData = { sub: LeetCodeSubmission, problem: typeof leetcodeProblems[0], submissionTime: Date };
      const submissionsByProblem = new Map<string, SubmissionData>();
      
      for (const sub of relevantSubmissions) {
        const problem = leetcodeProblems.find(p => extractLeetCodeSlug(p.url) === sub.titleSlug);
        if (problem) {
          const submissionTime = safeDateFromTimestamp(sub.timestamp);
          
          // If we haven't seen this problem yet, or this submission is more recent, keep it
          const existing = submissionsByProblem.get(problem.id);
          if (!existing || submissionTime > existing.submissionTime) {
            submissionsByProblem.set(problem.id, { sub, problem, submissionTime });
          }
        }
      }
      
      console.log(`📌 Processing ${submissionsByProblem.size} unique problems (filtered from ${relevantSubmissions.length} submissions)`);
      
      const submissionsToUpdate = [];
      for (const [problemId, { sub, problem, submissionTime }] of submissionsByProblem) {
        // Check if submission is before assignment start date
        const isBeforeAssignment = assignment.assignDate && submissionTime < assignment.assignDate;
        
        // Check if submission is after due date
        let isAfterDueDate = false;
        if (assignment.dueDate) {
          const dueDateEndOfDay = new Date(assignment.dueDate);
          dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
          isAfterDueDate = submissionTime > dueDateEndOfDay;
        }
        
        // Accept ALL submissions (problem is solved = completed)
        // Timing is only used for status display (ON TIME / LATE / BEFORE ASSIGNMENT)
        const completed = true;
        
        let status = 'ON TIME';
        if (isBeforeAssignment) {
          status = 'BEFORE ASSIGNMENT';
        } else if (isAfterDueDate) {
          status = 'LATE';
        }
        
        console.log(`🔍 Submission validation for ${sub.titleSlug}:`);
        console.log(`   - Submission time: ${submissionTime.toISOString()}`);
        console.log(`   - Assignment start: ${assignment.assignDate?.toISOString() || 'N/A'}`);
        console.log(`   - Due date (EOD): ${assignment.dueDate ? new Date(new Date(assignment.dueDate).setUTCHours(23, 59, 59, 999)).toISOString() : 'N/A'}`);
        console.log(`   - Status: ${status}`);
        console.log(`   - COMPLETED: ${completed}`);
        
        submissionsToUpdate.push({
          userId: user.id,
          problemId: problem.id,
          completed: completed, // Always mark as completed if problem is solved
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
            },
            data: {
              completed: subData.completed,
              submissionTime: subData.submissionTime,
            },
          })
        );

        const results = await prisma.$transaction(updatePromises);
        const userUpdatedCount = results.reduce((sum, result) => sum + result.count, 0);
        
        totalUpdatedCount += userUpdatedCount;

        if (userUpdatedCount > 0) {
          console.log(`✅ Updated ${userUpdatedCount} LeetCode submissions for ${user.name}.`);
        }
      }
    } catch (error: unknown) {
      const err = error as Error & { message: string };
      console.error(`Failed to check LeetCode submissions for ${user.name}: ${err.message}`);
      if (err.message.includes('session invalid')) {
        await prisma.user.update({
          where: { id: user.id },
          data: { leetcodeCookieStatus: 'EXPIRED' },
        });
        console.log(`Marked LeetCode cookie as expired for ${user.name}.`);
      }
    }
  }
  return totalUpdatedCount;
};

/**
 * Sync LeetCode data for all users with linked accounts (background sync)
 */
export const syncAllLinkedLeetCodeUsers = async (): Promise<void> => {
  console.log('🔄 Syncing all users with linked LeetCode accounts...');
  
  const linkedUsers = await prisma.user.findMany({
    where: {
      leetcodeCookieStatus: 'LINKED',
      leetcodeCookie: { not: null },
      leetcodeUsername: { not: null }
    }
  });

  console.log(`📊 Found ${linkedUsers.length} users with linked LeetCode accounts`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const user of linkedUsers) {
    try {
      const success = await fetchLeetCodeStatsAndSubmissions(user);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Rate limiting - space out requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`❌ Error syncing user ${user.leetcodeUsername}:`, err);
      errorCount++;
    }
  }
  
  console.log(`✅ Sync completed. Success: ${successCount}, Errors: ${errorCount}`);
}; 