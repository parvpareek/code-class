import type { QueryClient } from '@tanstack/react-query';

export const classDetailsQueryKey = (classId: string) => ['class', 'details', classId] as const;
export const classAssignmentsQueryKey = (classId: string) => ['class', 'assignments', classId] as const;
export const classAnnouncementsQueryKey = (classId: string) => ['class', 'announcements', classId] as const;

/** Match cached class tab payloads until invalidated or gc expires (survives peer-profile navigation). */
export const CLASS_PAGE_GC_MS = 7 * 24 * 60 * 60 * 1000;

export function invalidateClassPageQueries(queryClient: QueryClient, classId: string): void {
  void queryClient.invalidateQueries({ queryKey: classDetailsQueryKey(classId) });
  void queryClient.invalidateQueries({ queryKey: classAssignmentsQueryKey(classId) });
  void queryClient.invalidateQueries({ queryKey: classAnnouncementsQueryKey(classId) });
}
