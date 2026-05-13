import type { PortfolioContent } from './portfolio.schema';
import prisma from '../../lib/prisma';
import {
  extractGithubLoginFromPortfolioContent,
  fetchGithubContributionsByDay,
} from './portfolio.github';

export type ActivityByDate = Record<string, number>;

/** Integrated DSA platforms we track via class assignments (submission timestamps). */
const DSA_PLATFORM_OR = [
  { platform: { equals: 'leetcode', mode: 'insensitive' as const } },
  { platform: { equals: 'hackerrank', mode: 'insensitive' as const } },
  { platform: { equals: 'gfg', mode: 'insensitive' as const } },
  { platform: { equals: 'geeksforgeeks', mode: 'insensitive' as const } },
] as const;

/**
 * Completed assignment submissions on LeetCode, HackerRank, or GeeksforGeeks,
 * bucketed by completion day (UTC). Uses submission time when present.
 */
export async function buildDsaPlatformSubmissionActivityByDate(userId: string): Promise<ActivityByDate> {
  const rows = await prisma.submission.findMany({
    where: {
      userId,
      completed: true,
      problem: { OR: [...DSA_PLATFORM_OR] },
    },
    select: { submissionTime: true, updatedAt: true },
  });
  const map: ActivityByDate = {};
  for (const r of rows) {
    const d = r.submissionTime ?? r.updatedAt;
    const key = d.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

export async function loadPortfolioActivity(
  userId: string,
  content: PortfolioContent
): Promise<{
  githubByDate: ActivityByDate;
  /** LeetCode / HackerRank / GeeksforGeeks assignment completions, per UTC day */
  dsaByDate: ActivityByDate;
  /** Same as dsaByDate (heatmap “platforms” mode); kept for a stable client payload shape */
  practiceByDate: ActivityByDate;
}> {
  const login = extractGithubLoginFromPortfolioContent(content);
  const [platformByDate, ghMap] = await Promise.all([
    buildDsaPlatformSubmissionActivityByDate(userId),
    login ? fetchGithubContributionsByDay(login) : Promise.resolve(null),
  ]);
  const githubByDate = ghMap ?? {};
  return { githubByDate, dsaByDate: platformByDate, practiceByDate: platformByDate };
}
