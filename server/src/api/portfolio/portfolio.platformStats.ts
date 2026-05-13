import type { User } from '@prisma/client';
import prisma from '../../lib/prisma';

export type PortfolioPlatformSolved = {
  leetcode?: number | null;
  hackerrank?: number;
  geeksforgeeks?: number;
};

type UserPick = Pick<User, 'leetcodeTotalSolved'>;

/** Cached LeetCode total + in-app completed counts by platform (no extra external API calls). */
export async function loadPortfolioPlatformSolved(
  userId: string,
  user: UserPick
): Promise<PortfolioPlatformSolved> {
  const [hackerrank, geeksforgeeks] = await Promise.all([
    prisma.submission.count({
      where: {
        userId,
        completed: true,
        problem: { platform: { equals: 'hackerrank', mode: 'insensitive' } },
      },
    }),
    prisma.submission.count({
      where: {
        userId,
        completed: true,
        problem: {
          OR: [
            { platform: { equals: 'gfg', mode: 'insensitive' } },
            { platform: { equals: 'geeksforgeeks', mode: 'insensitive' } },
          ],
        },
      },
    }),
  ]);

  const out: PortfolioPlatformSolved = {};
  const lc = user.leetcodeTotalSolved;
  if (lc != null && lc > 0) out.leetcode = lc;
  if (hackerrank > 0) out.hackerrank = hackerrank;
  if (geeksforgeeks > 0) out.geeksforgeeks = geeksforgeeks;
  return out;
}
