import type { QueryClient } from '@tanstack/react-query';

export const classmatesQueryKey = (classId: string) => ['classmates', classId] as const;

/** Called after portfolio saves so peer rosters refresh published/slug flags without waiting for staleTime. */
export function invalidateAllClassmateRosterQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['classmates'] });
}
