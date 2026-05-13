import React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Code, ExternalLink } from 'lucide-react';
import { getClassmateByUserId } from '@/api/classes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { classmatesQueryKey } from '@/lib/classmatesQuery';
import type { ClassmatePublic } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ClassPeerProfilePage() {
  const { classId, userId } = useParams<{ classId: string; userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const fromState = (location.state as { classmate?: ClassmatePublic } | undefined)?.classmate;
  const cachedList = classId ? qc.getQueryData<ClassmatePublic[]>(classmatesQueryKey(classId)) : undefined;
  const fromCache = cachedList?.find((c) => c.id === userId);
  const prefetched = fromState?.id === userId ? fromState : fromCache;

  const detailQuery = useQuery({
    queryKey: ['classmate-detail', classId, userId],
    queryFn: async () => (await getClassmateByUserId(classId!, userId!)).classmate,
    enabled: Boolean(classId && userId && !prefetched),
    staleTime: DAY_MS,
    gcTime: DAY_MS * 2,
  });

  const classmate = prefetched ?? detailQuery.data;
  const loading = !classmate && detailQuery.isPending;
  const failed = !classmate && detailQuery.isError;

  if (!classId || !userId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Invalid link.
        <Button variant="link" asChild>
          <Link to="/classes">Classes</Link>
        </Button>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;

  if (failed || !classmate) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/classes/${classId}?tab=classmates`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to class
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Profile unavailable</CardTitle>
            <CardDescription>This student may not be in this class anymore.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pf = classmate.portfolio;
  const hasLcStats =
    classmate.leetcodeTotalSolved != null &&
    classmate.leetcodeTotalSolved !== undefined &&
    classmate.leetcodeTotalSolved > 0;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(`/classes/${classId}?tab=classmates`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to class
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{classmate.name}</CardTitle>
          <CardDescription>Classmate profile · platforms shown here are public usernames only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platforms</h3>
            <ul className="space-y-1 text-sm">
              <li>
                LeetCode:{' '}
                {classmate.leetcodeUsername ? (
                  <span className="font-medium">@{classmate.leetcodeUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </li>
              <li>
                GeeksforGeeks:{' '}
                {classmate.gfgUsername ? (
                  <span className="font-medium">{classmate.gfgUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </li>
              <li>
                HackerRank:{' '}
                {classmate.hackerrankUsername ? (
                  <span className="font-medium">{classmate.hackerrankUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-orange-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LeetCode stats (cached)</h3>
            </div>
            {hasLcStats ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{classmate.leetcodeTotalSolved} total</Badge>
                <Badge variant="outline" className="border-green-200 text-green-700 dark:border-green-800">
                  E: {classmate.leetcodeEasySolved ?? 0}
                </Badge>
                <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:border-yellow-800">
                  M: {classmate.leetcodeMediumSolved ?? 0}
                </Badge>
                <Badge variant="outline" className="border-red-200 text-red-700 dark:border-red-800">
                  H: {classmate.leetcodeHardSolved ?? 0}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No cached solve counts on file.</p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio</h3>
            {pf?.published ? (
              <Button asChild className="gap-2">
                <Link to={`/p/${encodeURIComponent(pf.slug)}`} target="_blank" rel="noreferrer">
                  View portfolio
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Portfolio not published.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
