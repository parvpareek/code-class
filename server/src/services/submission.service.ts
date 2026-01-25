import axios from 'axios';
import { PrismaClient, Submission, User, Problem } from '@prisma/client';
import prisma from '../lib/prisma';
import { groupBy } from '../utils/array.utils';
import { syncAllLinkedLeetCodeUsers, forceCheckLeetCodeSubmissionsForAssignment } from './enhanced-leetcode.service';
import { syncAllLinkedHackerRankUsers, forceCheckHackerRankSubmissionsForAssignment } from './hackerrank.service';

type GfgPracticeApiUserProblemsSubmissionsRequest = {
  handle: string;
  requestType: '' | 'getYearwiseUserSubmissions';
  year: string;
  month: string;
};

type GfgPracticeApiUserProblemsSubmissionsResponse = {
  status: 'success' | 'failed' | string;
  message?: string;
  result?: Record<string, Record<string, { slug?: string; pname?: string; lang?: string }>>;
  count?: number;
};

/**
 * Fetches all solved GeeksForGeeks problem slugs for a user.
 * @param username - The GFG username.
 * @returns A Set containing the slugs of all solved problems.
 */
export const getAllGfgSolvedSlugs = async (username: string): Promise<Set<string>> => {
    console.log(`Fetching all solved GFG problems for user: ${username}`);
    try {
        const GFG_PRACTICE_API_URL = 'https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/';

        // Cookie-less endpoint: relies on handle only
        const payload: GfgPracticeApiUserProblemsSubmissionsRequest = {
          handle: username,
          requestType: '',
          year: '',
          month: ''
        };

        const response = await axios.post<GfgPracticeApiUserProblemsSubmissionsResponse>(
          GFG_PRACTICE_API_URL,
          payload,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.data || response.data.status !== 'success' || !response.data.result) {
          console.error(`GFG Practice API error for user ${username}: ${response.data?.message || 'No result found'}`);
          return new Set();
        }

        const solvedSlugs = new Set<string>();
        for (const difficultyKey of Object.keys(response.data.result)) {
          const byId = response.data.result[difficultyKey] || {};
          for (const submissionId of Object.keys(byId)) {
            const slug = byId[submissionId]?.slug;
            if (slug) {
              solvedSlugs.add(slug);
            }
          }
        }

        console.log(`Found ${solvedSlugs.size} solved GFG problems for ${username}.`);
        return solvedSlugs;
    } catch (error: unknown) {
        const axiosError = error as { response?: { status: number; data: unknown }; message?: string };
        if (axiosError.response) {
            console.error(`Error fetching GFG solved list for ${username}. Status: ${axiosError.response.status}, Data:`, axiosError.response.data);
        } else {
            console.error(`Error fetching GFG solved list for ${username}:`, axiosError.message);
        }
        return new Set();
    }
};

/**
 * Extracts the problem slug from a GeeksForGeeks problem URL.
 * @param url - The full URL of the problem.
 * @returns The problem slug or the original URL if extraction fails.
 */
export const getGfgProblemSlug = (url: string): string => {
    try {
        const match = url.match(/\/problems\/([^/]+)/);
        return match ? match[1] : url;
    } catch (error) {
        console.error(`Error extracting slug from GFG URL: ${url}`, error);
        return url;
    }
};

type GfgProblemSubmissionResponse = {
  results?: {
    id: number;
    problem_name: string;
    slug: string;
    problem_level: number;
    problem_level_text: string;
    submissions?: Array<{
      submission_id: string;
      subtime: string;
      lang: string;
      exec_status: string;
      exec_status_text: string;
      testcase_passed: string;
      total_testcase_count: string;
      user_score: string;
      correct_submission_sequence: string;
    }>;
  };
};

/**
 * Fetches submission details for a specific GFG problem using authenticated cookie.
 * @param problemSlug - The GFG problem slug.
 * @param gfgCookie - The gfguserName cookie value.
 * @returns The earliest correct submission with timestamp, or null if not found.
 */
export const getGfgProblemSubmission = async (
  problemSlug: string, 
  gfgCookie: string
): Promise<{ submissionTime: Date; isCorrect: boolean } | null> => {
  const apiUrl = `https://practiceapi.geeksforgeeks.org/api/latest/problems/${problemSlug}/submissions/user/`;
  
  try {
    const response = await axios.get<GfgProblemSubmissionResponse>(apiUrl, {
      headers: {
        'Cookie': `gfguserName=${gfgCookie}`,
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://practice.geeksforgeeks.org/',
        'Accept': 'application/json',
      },
    });

    if (response.status === 200 && response.data?.results?.submissions) {
      const submissions = response.data.results.submissions;
      
      // Find the first correct submission (exec_status === "1")
      const correctSubmission = submissions.find((sub: any) => sub.exec_status === '1');
      
      if (correctSubmission && correctSubmission.subtime) {
        // Parse the timestamp (format: "2025-07-20 17:31:58")
        const submissionTime = new Date(correctSubmission.subtime);
        return {
          submissionTime,
          isCorrect: true
        };
      }
    }
    
    return null;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error(`🔒 GFG cookie expired/invalid for problem ${problemSlug}`);
      throw new Error('GFG_COOKIE_EXPIRED');
    }
    console.error(`Error fetching GFG problem submission for ${problemSlug}:`, error.message);
    return null;
  }
};

/**
 * Extracts the problem slug from a LeetCode problem URL.
 * @param url - The full URL of the problem.
 * @returns The problem slug or null if extraction fails.
 */
export const getLeetCodeProblemSlug = (url: string): string | null => {
    try {
        const match = url.match(/\/problems\/([^/]+)/);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`Error extracting slug from LeetCode URL: ${url}`, error);
        return null;
    }
};

/**
 * Gets the problem identifier based on platform and URL.
 * @param platform - The platform name.
 * @param url - The problem URL.
 * @returns The problem identifier.
 */
const getProblemIdentifier = (platform: string, url: string): string => {
    if (platform.toLowerCase() === 'leetcode') {
        return getLeetCodeProblemSlug(url) || url;
    } else if (platform.toLowerCase() === 'gfg') {
        return getGfgProblemSlug(url);
    }
    return url;
};

/**
 * Process only GFG submissions - uses cookie-based API when available for exact timestamps
 */
const processGfgSubmissions = async (
  submissions: (Submission & {
    user: User;
    problem: Problem & { assignment?: { assignDate: Date | null; dueDate: Date | null } | null };
  })[]
): Promise<number> => {
    // Filter to only GFG submissions
    const gfgSubmissions = submissions.filter(s => s.problem.platform.toLowerCase() === 'gfg');
    
    if (gfgSubmissions.length === 0) {
        console.log('📚 No GFG submissions to process.');
        return 0;
    }

    let totalUpdatedCount = 0;
    console.log(`📚 Processing ${gfgSubmissions.length} GFG submissions`);

    // Group submissions by user to process one user at a time
    const submissionsByUser = groupBy(gfgSubmissions, 'userId');

    for (const userId in submissionsByUser) {
        const userSubmissions = submissionsByUser[userId];
        const user = userSubmissions[0].user;
        
        if (!user.gfgUsername) {
            console.log(`⚠️ User ${user.name} has no GFG username - skipping ${userSubmissions.length} GFG problems`);
            continue;
        }
        
        console.log(`👤 Processing ${userSubmissions.length} GFG submissions for user: ${user.name} (${user.email})`);

        // Get user with cookie status
        const fullUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { gfgCookie: true, gfgCookieStatus: true }
        });

        const hasCookie = fullUser?.gfgCookie && fullUser?.gfgCookieStatus === 'LINKED';

        if (hasCookie) {
          console.log(`🔑 Using cookie-based API for ${user.name} (exact timestamps)`);
        } else {
          console.log(`📚 Using bulk API for ${user.name} (no timestamps)`);
        }

        // Process each GFG submission
        let updatedCount = 0;
        let cookieExpired = false;

        for (const submission of userSubmissions) {
            const { problem } = submission;
            const problemSlug = getGfgProblemSlug(problem.url);
            console.log(`📝 Checking GFG problem: '${problem.title}' (slug: '${problemSlug}')`);
            
            let submissionTime: Date | null = null;
            let isCompleted = false;

            // Try cookie-based API first if available
            if (hasCookie && !cookieExpired && fullUser?.gfgCookie) {
              try {
                const result = await getGfgProblemSubmission(problemSlug, fullUser.gfgCookie);
                if (result && result.isCorrect) {
                  isCompleted = true;
                  submissionTime = result.submissionTime;
                  console.log(`✅ Found correct submission with timestamp: ${submissionTime.toISOString()}`);
                }
              } catch (error: any) {
                if (error.message === 'GFG_COOKIE_EXPIRED') {
                  console.error(`❌ GFG cookie expired for ${user.name}, marking as expired`);
                  cookieExpired = true;
                  // Mark cookie as expired in database
                  await prisma.user.update({
                    where: { id: userId },
                    data: { gfgCookieStatus: 'EXPIRED' }
                  });
                  // Fall back to bulk API for remaining problems
                } else {
                  console.error(`⚠️ Error fetching problem submission: ${error.message}`);
                }
              }
            }

            // Fallback to bulk API if no cookie or cookie failed
            if (!isCompleted) {
              const gfgSolved = await getAllGfgSolvedSlugs(user.gfgUsername);
              isCompleted = gfgSolved.has(problemSlug);
              if (isCompleted) {
                console.log(`✅ Found in bulk API (no exact timestamp)`);
              }
            }

            if (isCompleted) {
                const finalSubmissionTime = submissionTime || new Date(); // Use current time if no exact timestamp
                const assignDate = problem.assignment?.assignDate;
                const dueDate = problem.assignment?.dueDate;
                
                // Check if submission is before assignment start date
                const isBeforeAssignment = assignDate && finalSubmissionTime < assignDate;
                
                // Check if submission is after due date
                let isAfterDueDate = false;
                if (dueDate) {
                  const dueDateEndOfDay = new Date(dueDate);
                  dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
                  isAfterDueDate = finalSubmissionTime > dueDateEndOfDay;
                }
                
                // Determine status
                let status = 'ON TIME';
                if (isBeforeAssignment) {
                    status = 'BEFORE ASSIGNMENT';
                } else if (isAfterDueDate) {
                    status = 'LATE';
                }
                
                console.log(`✅ Marking GFG submission as completed [${status}] for ${user.name} on ${problem.title}`);
                const result = await prisma.submission.updateMany({
                    where: { id: submission.id, completed: false },
                    data: { completed: true, submissionTime: finalSubmissionTime },
                });
                if (result.count > 0) {
                  updatedCount++;
                }
            } else {
                console.log(`❌ GFG problem '${problem.title}' not solved yet`);
            }
        }
        
        console.log(`✅ Updated ${updatedCount}/${userSubmissions.length} GFG submissions for ${user.name}`);
        totalUpdatedCount += updatedCount;
    }
    
    console.log('✅ Finished processing all GFG submissions');
    return totalUpdatedCount;
};

/**
 * Check all pending submissions - uses enhanced LeetCode service + HackerRank service + GFG processing
 * 
 * NOTE: Automatic user syncing is DISABLED to prevent memory leaks and reduce server startup overhead.
 * User syncing should only happen when:
 * 1. Student manually clicks "Check Submissions" for a specific assignment
 * 2. Teacher manually triggers submission check for a specific assignment
 */
export const checkAllSubmissions = async () => {
    console.log('🚀 Starting comprehensive submission check...');
    
    // DISABLED: Automatic system-wide user syncing
    // This was causing memory leaks and running on every server startup
    // Step 1: Sync all LeetCode users with enhanced integration
    // console.log('📱 Step 1: Syncing LeetCode users with enhanced integration...');
    // await syncAllLinkedLeetCodeUsers();
    
    // Step 2: Sync all HackerRank users with enhanced integration
    // console.log('🔶 Step 2: Syncing HackerRank users with enhanced integration...');
    // await syncAllLinkedHackerRankUsers();
    
    // Step 3: Process remaining GFG submissions  
    console.log('📝 Processing GFG submissions...');
    // Use select instead of include to reduce memory usage
    // Process in batches to avoid loading all submissions into memory at once
    const BATCH_SIZE = 100;
    let skip = 0;
    let totalProcessed = 0;
    
    while (true) {
        const pendingSubmissions = await prisma.submission.findMany({
            where: { completed: false },
            select: {
                id: true,
                userId: true,
                problemId: true,
                completed: true,
                user: {
                    select: {
                        id: true,
                        gfgUsername: true,
                        gfgCookie: true,
                        gfgCookieStatus: true,
                    },
                },
                problem: {
                    select: {
                        id: true,
                        url: true,
                        title: true,
                    },
                },
            },
            skip,
            take: BATCH_SIZE,
        });
        
        if (pendingSubmissions.length === 0) break;
        
        console.log(`Processing batch: ${skip} to ${skip + pendingSubmissions.length}`);
        await processGfgSubmissions(pendingSubmissions as any);
        totalProcessed += pendingSubmissions.length;
        skip += BATCH_SIZE;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Found and processed ${totalProcessed} total pending submissions`);

    console.log('✅ Comprehensive submission check completed (GFG only - LeetCode/HackerRank syncing disabled)');
};

/**
 * Check submissions for a specific assignment - uses enhanced LeetCode service + GFG processing
 */
export const checkSubmissionsForAssignment = async (assignmentId: string, userId?: string): Promise<{ count: number }> => {
    console.log(`🎯 Starting submission check for assignment: ${assignmentId}...`);
    let totalUpdatedCount = 0;
    
    // Get assignment details for better logging
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { problems: true }
    });
    
    if (!assignment) {
        console.log(`❌ Assignment ${assignmentId} not found`);
        return { count: 0 };
    }
    
    console.log(`📋 Assignment: "${assignment.title}" with ${assignment.problems.length} problems`);
    
    // Show platform breakdown
    const leetcodeProblems = assignment.problems.filter((p: any) => p.platform.toLowerCase() === 'leetcode');
    const hackerrankProblems = assignment.problems.filter((p: any) => p.platform.toLowerCase() === 'hackerrank');
    const gfgProblems = assignment.problems.filter((p: any) => p.platform.toLowerCase() === 'gfg');
    const otherProblems = assignment.problems.filter((p: any) => !['leetcode', 'hackerrank', 'gfg'].includes(p.platform.toLowerCase()));
    
    console.log(`📊 Platform breakdown: ${leetcodeProblems.length} LeetCode, ${hackerrankProblems.length} HackerRank, ${gfgProblems.length} GFG, ${otherProblems.length} other`);
    
    // Step 1: Force check LeetCode submissions for this specific assignment
    if (leetcodeProblems.length > 0) {
        console.log('📱 Step 1: Force checking LeetCode submissions for assignment...');
        totalUpdatedCount += await forceCheckLeetCodeSubmissionsForAssignment(assignmentId, userId);
    } else {
        console.log('⏭️ No LeetCode problems in this assignment - skipping LeetCode sync');
    }
    
    // Step 2: Force check HackerRank submissions for this specific assignment
    if (hackerrankProblems.length > 0) {
        console.log('🔶 Step 2: Force checking HackerRank submissions for assignment...');
        totalUpdatedCount += await forceCheckHackerRankSubmissionsForAssignment(assignmentId, userId);
    } else {
        console.log('⏭️ No HackerRank problems in this assignment - skipping HackerRank sync');
    }
    
    // Step 3: Process GFG submissions for this assignment
    if (gfgProblems.length > 0) {
        console.log('📝 Step 3: Processing GFG submissions for assignment...');
        const pendingSubmissions = await prisma.submission.findMany({
            where: {
                problem: {
                    assignmentId: assignmentId,
                },
                completed: false,
                ...(userId && { userId }),
            },
            include: { 
                user: true, 
                problem: {
                    include: {
                        assignment: true
                    }
                }
            },
        });
        
        console.log(`Found ${pendingSubmissions.length} pending submissions for assignment ${assignmentId}`);
        totalUpdatedCount += await processGfgSubmissions(pendingSubmissions);
    } else {
        console.log('⏭️ No GFG problems in this assignment - skipping GFG processing');
    }
    
    console.log(`✅ Assignment "${assignment.title}" submission check completed. Total updated: ${totalUpdatedCount}`);
    return { count: totalUpdatedCount };
};

/**
 * Check submission fetching status for all students in a class
 * This verifies whether credentials/cookies are working properly for each platform
 */
export const checkClassSubmissionStatus = async (classId: string) => {
    console.log(`🎯 Starting submission status check for class: ${classId}...`);
    
    try {
        // Get all students in the class
        const classData = await prisma.class.findUnique({
            where: { id: classId },
            include: {
                students: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                leetcodeUsername: true,
                                leetcodeCookieStatus: true,
                                hackerrankUsername: true,
                                hackerrankCookieStatus: true,
                                gfgUsername: true,
                            }
                        }
                    }
                },
                assignments: {
                    include: {
                        problems: true
                    }
                }
            }
        });

        if (!classData) {
            throw new Error(`Class ${classId} not found`);
        }

        console.log(`📊 Found ${classData.students.length} students in class "${classData.name}"`);

        const statusResults = [];

        for (const studentEnrollment of classData.students) {
            const student = studentEnrollment.user;
            console.log(`\n👤 Checking submission status for: ${student.name} (${student.email})`);

            const platformStatus = {
                userId: student.id,
                name: student.name,
                email: student.email,
                platforms: {
                    leetcode: {
                        hasUsername: !!student.leetcodeUsername,
                        username: student.leetcodeUsername || null,
                        cookieStatus: student.leetcodeCookieStatus || 'NOT_LINKED',
                        isWorking: false,
                        lastError: null as string | null
                    },
                    hackerrank: {
                        hasUsername: !!student.hackerrankUsername,
                        username: student.hackerrankUsername || null,
                        cookieStatus: student.hackerrankCookieStatus || 'NOT_LINKED',
                        isWorking: false,
                        lastError: null as string | null
                    },
                    gfg: {
                        hasUsername: !!student.gfgUsername,
                        username: student.gfgUsername || null,
                        cookieStatus: 'N/A', // GFG doesn't use cookies
                        isWorking: false,
                        lastError: null as string | null
                    }
                }
            };

            // Test LeetCode status
            if (student.leetcodeUsername && student.leetcodeCookieStatus === 'LINKED') {
                try {
                    console.log(`📱 Testing LeetCode for ${student.name}...`);
                    // Get user with cookie for testing
                    const userWithCookie = await prisma.user.findUnique({
                        where: { id: student.id },
                        select: { leetcodeCookie: true }
                    });

                    if (userWithCookie?.leetcodeCookie) {
                        // Get full user object for the service
                        const fullUser = await prisma.user.findUnique({
                            where: { id: student.id }
                        });
                        
                        if (fullUser) {
                            // Import the function from enhanced-leetcode.service
                            const { fetchLeetCodeStatsAndSubmissions } = await import('./enhanced-leetcode.service');
                            const result = await fetchLeetCodeStatsAndSubmissions({
                                ...fullUser,
                                leetcodeCookieStatus: student.leetcodeCookieStatus,
                                leetcodeTotalSolved: null
                            });
                            platformStatus.platforms.leetcode.isWorking = result;
                            if (!result) {
                                platformStatus.platforms.leetcode.lastError = 'Failed to fetch data - cookie may be expired';
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ LeetCode test failed for ${student.name}:`, error);
                    platformStatus.platforms.leetcode.isWorking = false;
                    platformStatus.platforms.leetcode.lastError = (error as Error).message;
                }
            } else if (student.leetcodeUsername && student.leetcodeCookieStatus !== 'LINKED') {
                platformStatus.platforms.leetcode.lastError = 'Cookie not linked or expired';
            } else if (!student.leetcodeUsername) {
                platformStatus.platforms.leetcode.lastError = 'No username provided';
            }

            // Test HackerRank status
            if (student.hackerrankUsername && student.hackerrankCookieStatus === 'LINKED') {
                try {
                    console.log(`🔶 Testing HackerRank for ${student.name}...`);
                    // Get user with cookie for testing
                    const userWithCookie = await prisma.user.findUnique({
                        where: { id: student.id },
                        select: { hackerrankCookie: true }
                    });

                    if (userWithCookie?.hackerrankCookie) {
                        // Get full user object for the service
                        const fullUser = await prisma.user.findUnique({
                            where: { id: student.id }
                        });
                        
                        if (fullUser) {
                            // Import the function from hackerrank.service
                            const { fetchHackerRankStatsAndSubmissions } = await import('./hackerrank.service');
                            const result = await fetchHackerRankStatsAndSubmissions({
                                ...fullUser,
                                hackerrankCookieStatus: student.hackerrankCookieStatus
                            });
                            platformStatus.platforms.hackerrank.isWorking = result;
                            if (!result) {
                                platformStatus.platforms.hackerrank.lastError = 'Failed to fetch data - cookie may be expired';
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ HackerRank test failed for ${student.name}:`, error);
                    platformStatus.platforms.hackerrank.isWorking = false;
                    platformStatus.platforms.hackerrank.lastError = (error as Error).message;
                }
            } else if (student.hackerrankUsername && student.hackerrankCookieStatus !== 'LINKED') {
                platformStatus.platforms.hackerrank.lastError = 'Cookie not linked or expired';
            } else if (!student.hackerrankUsername) {
                platformStatus.platforms.hackerrank.lastError = 'No username provided';
            }

            // Test GFG status (no cookies, just API)
            if (student.gfgUsername) {
                try {
                    console.log(`📚 Testing GFG for ${student.name}...`);
                    const gfgSolved = await getAllGfgSolvedSlugs(student.gfgUsername);
                    platformStatus.platforms.gfg.isWorking = gfgSolved.size > 0;
                    if (gfgSolved.size === 0) {
                        platformStatus.platforms.gfg.lastError = 'No solved problems found or API error';
                    }
                } catch (error) {
                    console.error(`❌ GFG test failed for ${student.name}:`, error);
                    platformStatus.platforms.gfg.isWorking = false;
                    platformStatus.platforms.gfg.lastError = (error as Error).message;
                }
            } else {
                platformStatus.platforms.gfg.lastError = 'No username provided';
            }

            statusResults.push(platformStatus);

            // Add delay between students to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`✅ Submission status check completed for class "${classData.name}"`);
        return {
            classId,
            className: classData.name,
            studentCount: classData.students.length,
            checkedAt: new Date().toISOString(),
            students: statusResults
        };

    } catch (error) {
        console.error(`❌ Error checking class submission status:`, error);
        throw error;
    }
};