import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, differenceInCalendarDays, endOfWeek, startOfWeek } from 'date-fns';
import { ChevronRight, ExternalLink, LogOut, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createJobApplication,
  deleteJobApplication,
  fetchJobApplication,
  fetchJobApplications,
  parseJobApplicationLink,
  patchJobApplication,
  reorderJobBoard,
} from '@/api/jobApplications';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { JobApplicationActivityDto, JobApplicationDto, JobApplicationStatus, PatchJobApplicationPayload } from '@/types/jobs';
import { JOB_APPLICATION_STATUSES } from '@/types/jobs';

const COLUMN_LABEL: Record<JobApplicationStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  OA: 'OA',
  INTERVIEW: 'Interview',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
};

const STAGE_LANE: Record<JobApplicationStatus, string> = {
  SAVED:
    'rounded-2xl border border-zinc-200/25 bg-zinc-100/30 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]',
  APPLIED:
    'rounded-2xl border border-sky-100/20 bg-sky-50/25 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]',
  OA: 'rounded-2xl border border-amber-100/20 bg-amber-50/22 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]',
  INTERVIEW:
    'rounded-2xl border border-violet-100/20 bg-violet-50/22 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]',
  REJECTED:
    'rounded-2xl border border-rose-100/15 bg-rose-50/18 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]',
  OFFER:
    'rounded-2xl border border-emerald-100/20 bg-emerald-50/22 backdrop-blur-[1px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)]',
};

const STAGE_DOT: Record<JobApplicationStatus, string> = {
  SAVED: 'bg-zinc-400',
  APPLIED: 'bg-sky-500',
  OA: 'bg-amber-500',
  INTERVIEW: 'bg-violet-500',
  REJECTED: 'bg-rose-400',
  OFFER: 'bg-emerald-500',
};

const COLUMN_EMPTY_COPY: Record<JobApplicationStatus, string> = {
  SAVED: 'Nothing here yet.',
  APPLIED: 'No applications in this stage.',
  OA: 'No OA yet.',
  INTERVIEW: 'No interviews yet.',
  REJECTED: 'None in this column.',
  OFFER: 'No offers yet.',
};

const QUERY_KEY = ['job-applications'] as const;

const JOBS_CANVAS_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(231, 231, 234, 0.94)',
  backgroundImage: [
    'radial-gradient(ellipse 100% 58% at 50% -6%, rgba(255,255,255,0.9), transparent 56%)',
    'linear-gradient(to right, rgba(24,24,27,0.022) 1px, transparent 1px)',
    'linear-gradient(to bottom, rgba(24,24,27,0.022) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: '100% 100%, 24px 24px, 24px 24px',
};

function faviconForUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname;
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

function cardEnergyClass(app: JobApplicationDto): string {
  const days =
    app.deadline != null ? differenceInCalendarDays(new Date(app.deadline), new Date()) : null;
  const oaSoon = app.status === 'OA' && days !== null && days >= 0 && days <= 3;
  if (app.status === 'OFFER') {
    return 'border-l-[3px] border-l-emerald-400/90 shadow-[0_2px_16px_rgba(16,185,129,0.08)]';
  }
  if (app.status === 'INTERVIEW') {
    return 'shadow-[0_2px_18px_rgba(139,92,246,0.09)]';
  }
  if (oaSoon) {
    return 'shadow-[0_2px_18px_rgba(245,158,11,0.1)]';
  }
  if (app.status === 'REJECTED') {
    return 'border-l-[3px] border-l-rose-300/70';
  }
  return '';
}

const STAGE_CARD_TOP: Record<JobApplicationStatus, string> = {
  SAVED:
    'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-300/30 before:to-transparent',
  APPLIED:
    'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-400/28 before:to-transparent',
  OA: 'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-400/32 before:to-transparent',
  INTERVIEW:
    'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-400/28 before:to-transparent',
  REJECTED:
    'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-rose-400/22 before:to-transparent',
  OFFER:
    'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-400/28 before:to-transparent',
};

function groupByStatus(apps: JobApplicationDto[]): Record<JobApplicationStatus, JobApplicationDto[]> {
  const out = {} as Record<JobApplicationStatus, JobApplicationDto[]>;
  for (const s of JOB_APPLICATION_STATUSES) {
    out[s] = [];
  }
  for (const a of apps) {
    out[a.status].push(a);
  }
  for (const s of JOB_APPLICATION_STATUSES) {
    out[s].sort((x, y) => x.sortOrder - y.sortOrder || x.updatedAt.localeCompare(y.updatedAt));
  }
  return out;
}

function toColumnIds(grouped: Record<JobApplicationStatus, JobApplicationDto[]>) {
  const cols = {} as Record<JobApplicationStatus, string[]>;
  for (const s of JOB_APPLICATION_STATUSES) {
    cols[s] = grouped[s].map((a) => a.id);
  }
  return cols;
}

function columnFromDroppableId(overId: string): JobApplicationStatus | undefined {
  if (overId.startsWith('drop-')) {
    const s = overId.slice(5);
    if ((JOB_APPLICATION_STATUSES as readonly string[]).includes(s)) {
      return s as JobApplicationStatus;
    }
  }
  return undefined;
}

function findContainer(
  itemId: UniqueIdentifier,
  columns: Record<JobApplicationStatus, string[]>
): JobApplicationStatus | undefined {
  const id = String(itemId);
  const fromDrop = columnFromDroppableId(id);
  if (fromDrop) return fromDrop;
  return JOB_APPLICATION_STATUSES.find((s) => columns[s].includes(id));
}

function activityCopy(a: JobApplicationActivityDto): string {
  if (a.kind === 'created') {
    return `Added to ${a.toStatus ? COLUMN_LABEL[a.toStatus] : 'pipeline'}`;
  }
  if (a.kind === 'status_change' && a.toStatus) {
    return `Moved to ${COLUMN_LABEL[a.toStatus]}`;
  }
  return a.kind.replace(/_/g, ' ');
}

function useDisplayedApps(
  applications: JobApplicationDto[],
  columnIds: Record<JobApplicationStatus, string[]>
) {
  return useMemo(() => {
    const base = new Map(applications.map((a) => [a.id, { ...a }]));
    for (const s of JOB_APPLICATION_STATUSES) {
      for (const id of columnIds[s]) {
        const row = base.get(id);
        if (row) base.set(id, { ...row, status: s });
      }
    }
    return base;
  }, [applications, columnIds]);
}

function SortableJobCard({
  app,
  onOpen,
}: {
  app: JobApplicationDto;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
    data: { type: 'card', status: app.status },
  });
  const [favFailed, setFavFailed] = useState(false);
  const fav = faviconForUrl(app.applicationUrl);
  const daysToDeadline =
    app.deadline != null ? differenceInCalendarDays(new Date(app.deadline), new Date()) : null;
  const showUrgentDue =
    app.status === 'OA' && daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 3;

  const baseTransform = CSS.Transform.toString(transform);
  const style = {
    transform: isDragging ? `${baseTransform} rotate(1.1deg) scale(1.02)` : baseTransform,
    transition,
  };

  const hasMeta = Boolean(app.appliedAt || app.deadline);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(app.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(app.id);
        }
      }}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-xl border border-zinc-200/40 bg-gradient-to-b from-white to-zinc-50/90 px-3 py-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.045),inset_0_1px_0_0_rgba(255,255,255,0.85)]',
        STAGE_CARD_TOP[app.status],
        'transition-[box-shadow,border-color,transform] duration-200 hover:border-zinc-200/55 hover:shadow-[0_4px_22px_rgba(0,0,0,0.055)]',
        'active:cursor-grabbing',
        isDragging && 'z-10 cursor-grabbing opacity-[0.94] shadow-[0_12px_40px_rgba(0,0,0,0.1)]',
        cardEnergyClass(app)
      )}
    >
      <ChevronRight
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-300 opacity-0 transition-opacity duration-200 group-hover:opacity-70"
        aria-hidden
      />

      <div className="flex min-w-0 gap-2.5 pr-5">
        {fav && !favFailed ? (
          <img
            src={fav}
            alt=""
            width={28}
            height={28}
            className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-zinc-200/35 bg-white object-contain p-0.5 shadow-sm"
            onError={() => setFavFailed(true)}
          />
        ) : (
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200/35 bg-zinc-50/90 text-[10px] font-semibold text-zinc-500 shadow-sm"
            aria-hidden
          >
            {app.company.trim().charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight text-zinc-900">{app.company}</p>
          <p className="mt-0.5 truncate text-xs leading-tight text-zinc-600">{app.role}</p>

          {hasMeta ? (
            <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] leading-tight text-zinc-500">
              {app.appliedAt ? (
                <p className="min-w-0 truncate">
                  <span className="text-zinc-400">Applied</span>{' '}
                  <span className="font-medium tabular-nums text-zinc-700">
                    {format(new Date(app.appliedAt), 'MMM d')}
                  </span>
                </p>
              ) : null}
              {app.deadline ? (
                <p className="min-w-0 truncate">
                  <span className="text-zinc-400">Deadline</span>{' '}
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      showUrgentDue ? 'text-amber-800' : 'text-zinc-700'
                    )}
                  >
                    {format(new Date(app.deadline), 'MMM d')}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {app.applicationUrl ? (
            <a
              href={app.applicationUrl}
              target="_blank"
              rel="noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex max-w-full items-center gap-0.5 truncate text-[11px] font-medium text-zinc-400 underline-offset-4 hover:text-zinc-600 hover:underline"
            >
              View application <span aria-hidden>→</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  status,
  apps,
  onOpen,
  showColumnHints,
}: {
  status: JobApplicationStatus;
  apps: JobApplicationDto[];
  onOpen: (id: string) => void;
  showColumnHints: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `drop-${status}` });
  const ids = apps.map((a) => a.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[140px] flex-col px-2 pb-3 pt-1.5 backdrop-blur-[1px]',
        STAGE_LANE[status]
      )}
    >
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {apps.map((app) => (
            <SortableJobCard key={app.id} app={app} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
      {showColumnHints && apps.length === 0 ? (
        <p className="mt-2 px-0.5 text-center text-[10px] leading-snug text-zinc-400/70">{COLUMN_EMPTY_COPY[status]}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white/70 p-8 shadow-sm shadow-zinc-900/5 backdrop-blur-sm">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200/80 shadow-inner" aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Track your placement journey.</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Save opportunities, track interviews, and stay organized during placements.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          A calm workspace—ready whenever you add your first role.
        </p>
        <Button className="mt-8 w-full rounded-full px-6" onClick={onAdd}>
          Add your first application
        </Button>
      </div>
    </div>
  );
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function AddApplicationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (!open) {
      setCompany('');
      setRole('');
      setApplicationUrl('');
      setNotes('');
      setDeadline('');
      setTagsRaw('');
    }
  }, [open]);

  const parseTimer = React.useRef<number | null>(null);
  const runParse = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http')) return;
    setParsing(true);
    try {
      const r = await parseJobApplicationLink(trimmed);
      setCompany((c) => (c.trim() ? c : r.company ?? c));
      setRole((x) => (x.trim() ? x : r.role ?? x));
    } catch {
      /* ignore */
    } finally {
      setParsing(false);
    }
  }, []);

  const onUrlBlur = () => {
    if (applicationUrl.trim()) void runParse(applicationUrl);
  };

  const onUrlChange = (v: string) => {
    setApplicationUrl(v);
    if (parseTimer.current) window.clearTimeout(parseTimer.current);
    parseTimer.current = window.setTimeout(() => {
      if (v.trim().startsWith('http')) void runParse(v);
    }, 500);
  };

  const createMut = useMutation({
    mutationFn: createJobApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'Application saved' });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Could not save', variant: 'destructive' });
    },
  });

  const submit = () => {
    if (!company.trim() || !role.trim()) {
      toast({ title: 'Company and role are required', variant: 'destructive' });
      return;
    }
    const tags = parseTagsInput(tagsRaw);
    createMut.mutate({
      company: company.trim(),
      role: role.trim(),
      applicationUrl: applicationUrl.trim() || null,
      notes: notes.trim() || null,
      deadline: deadline ? new Date(`${deadline}T12:00:00.000Z`).toISOString() : null,
      tags: tags.length ? tags : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">New application</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ja-company">Company</Label>
            <Input
              id="ja-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="bg-white"
              autoComplete="organization"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ja-role">Role</Label>
            <Input
              id="ja-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-white"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ja-url">Application link (optional)</Label>
            <Input
              id="ja-url"
              value={applicationUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              onBlur={onUrlBlur}
              placeholder="LinkedIn or careers page"
              className="bg-white"
            />
            {parsing ? <p className="text-[10px] text-zinc-400">Reading link…</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ja-notes">Notes (optional)</Label>
            <Textarea id="ja-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[72px] bg-white" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ja-deadline">Deadline (optional)</Label>
            <Input id="ja-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-white" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ja-tags">Tags (optional, comma-separated)</Label>
            <Input
              id="ja-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Remote, Intern, Backend"
              className="bg-white"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={createMut.isPending} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobDetailSheet({
  open,
  applicationId,
  onClose,
}: {
  open: boolean;
  applicationId: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const q = useQuery({
    queryKey: [...QUERY_KEY, 'detail', applicationId],
    queryFn: () => fetchJobApplication(applicationId!),
    enabled: open && !!applicationId,
  });

  const app = q.data?.application;
  const activities = q.data?.activities ?? [];

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');

  const resetDraftFromApp = useCallback((row: JobApplicationDto) => {
    setCompany(row.company);
    setRole(row.role);
    setApplicationUrl(row.applicationUrl?.trim() ?? '');
    setNotes(row.notes ?? '');
    setDeadline(row.deadline ? format(new Date(row.deadline), 'yyyy-MM-dd') : '');
    setTagsRaw(row.tags.join(', '));
  }, []);

  useEffect(() => {
    if (!open) setIsEditing(false);
  }, [open]);

  useEffect(() => {
    setIsEditing(false);
  }, [applicationId]);

  useEffect(() => {
    if (!open || !app || isEditing) return;
    resetDraftFromApp(app);
  }, [open, app, isEditing, resetDraftFromApp]);

  const beginEdit = () => {
    if (!app) return;
    resetDraftFromApp(app);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!app) return;
    resetDraftFromApp(app);
    setIsEditing(false);
  };

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchJobApplicationPayload }) => patchJobApplication(id, body),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData([...QUERY_KEY, 'detail', id], (prev: typeof q.data | undefined) =>
        prev ? { ...prev, application: updated } : prev
      );
      queryClient.setQueryData(QUERY_KEY, (prev: JobApplicationDto[] | undefined) =>
        prev?.map((row) => (row.id === updated.id ? updated : row))
      );
      setIsEditing(false);
      toast({ title: 'Saved' });
    },
    onError: () => toast({ title: 'Could not save', variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: deleteJobApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: 'Removed' });
      onClose();
    },
    onError: () => toast({ title: 'Could not delete', variant: 'destructive' }),
  });

  const save = () => {
    if (!applicationId || !app) return;
    if (!company.trim() || !role.trim()) {
      toast({ title: 'Company and role are required', variant: 'destructive' });
      return;
    }
    const tags = parseTagsInput(tagsRaw);
    patch.mutate({
      id: applicationId,
      body: {
        company: company.trim(),
        role: role.trim(),
        applicationUrl: applicationUrl.trim() || null,
        notes: notes.trim() || null,
        deadline: deadline ? new Date(`${deadline}T12:00:00.000Z`).toISOString() : null,
        tags,
      },
    });
  };

  const busy = patch.isPending || del.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        overlayClassName="bg-zinc-950/35 backdrop-blur-sm"
        className="flex h-full max-h-[100dvh] w-full min-w-0 max-w-[100vw] flex-col gap-0 overflow-hidden border-zinc-200/80 bg-[#f8f8f9] p-4 pb-5 pt-10 shadow-2xl sm:max-w-md sm:p-6 sm:pb-6 sm:pt-12"
      >
        {q.isLoading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
        ) : app ? (
          <>
            <SheetHeader className="shrink-0 space-y-0 border-b border-zinc-200/80 pb-4 pr-6 text-left sm:pr-8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <SheetTitle className="text-lg font-semibold leading-tight text-zinc-900">{app.company}</SheetTitle>
                  <p className="text-sm text-zinc-500">{app.role}</p>
                  {app.applicationUrl ? (
                    <a
                      href={app.applicationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 break-all text-xs font-medium text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline"
                    >
                      View application <span aria-hidden>→</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    </a>
                  ) : null}
                </div>
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busy}
                    onClick={beginEdit}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden py-4">
              {!isEditing ? (
                <div className="w-full min-w-0 max-w-full space-y-3 text-sm">
                  {app.appliedAt ? (
                    <p className="text-zinc-600">
                      Applied{' '}
                      <span className="font-medium text-zinc-800">
                        {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                      </span>
                    </p>
                  ) : null}
                  {app.deadline ? (
                    <p className="text-zinc-600">
                      Deadline{' '}
                      <span className="font-medium text-zinc-800">{format(new Date(app.deadline), 'MMM d, yyyy')}</span>
                    </p>
                  ) : null}
                  {app.notes ? (
                    <div className="w-full min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                        {app.notes}
                      </p>
                    </div>
                  ) : null}
                  {app.tags.length ? (
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {app.tags.map((t) => (
                        <span key={t} className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-xs text-zinc-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid w-full min-w-0 max-w-full gap-3 text-sm">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-company">Company</Label>
                    <Input
                      id="jd-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full min-w-0 max-w-full bg-white"
                      autoComplete="organization"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-role">Role</Label>
                    <Input
                      id="jd-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full min-w-0 max-w-full bg-white"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-url">Application link (optional)</Label>
                    <Input
                      id="jd-url"
                      value={applicationUrl}
                      onChange={(e) => setApplicationUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full min-w-0 max-w-full bg-white"
                    />
                    {applicationUrl.trim().startsWith('http') ? (
                      <a
                        href={applicationUrl.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full min-w-0 items-center gap-1 break-all text-[11px] font-medium text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline"
                      >
                        Open link <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    ) : null}
                  </div>
                  {app.appliedAt ? (
                    <p className="text-xs text-zinc-600">
                      Applied{' '}
                      <span className="font-medium text-zinc-800">
                        {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                      </span>
                    </p>
                  ) : null}
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-deadline">Deadline (optional)</Label>
                    <Input
                      id="jd-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full min-w-0 max-w-full bg-white"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-notes">Notes</Label>
                    <Textarea
                      id="jd-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[100px] w-full min-w-0 max-w-full resize-y bg-white"
                      placeholder="Interview prep, contacts, next steps…"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="jd-tags">Tags (comma-separated)</Label>
                    <Input
                      id="jd-tags"
                      value={tagsRaw}
                      onChange={(e) => setTagsRaw(e.target.value)}
                      placeholder="Remote, Intern, Backend"
                      className="w-full min-w-0 max-w-full bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 w-full min-w-0 max-w-full border-t border-zinc-200/80 pt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Activity</p>
                <ul className="mt-2 space-y-2">
                  {app.appliedAt ? (
                    <li className="text-xs text-zinc-600">
                      <span className="text-zinc-800">Applied</span>{' '}
                      {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                    </li>
                  ) : null}
                  {activities.map((a) => (
                    <li key={a.id} className="min-w-0 break-words text-xs text-zinc-600">
                      <span className="text-zinc-800">{activityCopy(a)}</span>{' '}
                      <span className="text-zinc-400">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex w-full min-w-0 max-w-full shrink-0 flex-col gap-2 border-t border-zinc-200/80 pt-4 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between sm:gap-3">
              <Button
                variant="outline"
                type="button"
                className="w-full shrink-0 text-destructive sm:w-auto"
                disabled={busy}
                onClick={() => applicationId && del.mutate(applicationId)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              {isEditing ? (
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={save}>
                    {patch.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">Could not load.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function JobsPipelinePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } })
  );

  const { data: applications = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchJobApplications,
    enabled: isAuthenticated,
  });

  const [columnIds, setColumnIds] = useState<Record<JobApplicationStatus, string[]>>(() =>
    toColumnIds(groupByStatus([]))
  );
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const columnIdsRef = React.useRef(columnIds);
  columnIdsRef.current = columnIds;

  useEffect(() => {
    setColumnIds(toColumnIds(groupByStatus(applications)));
  }, [applications]);

  const displayed = useDisplayedApps(applications, columnIds);

  const placementMetrics = useMemo(() => {
    const total = applications.length;
    const interviews = applications.filter((a) => a.status === 'INTERVIEW').length;
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const oaThisWeek = applications.filter((a) => {
      if (a.status !== 'OA' || !a.deadline) return false;
      const d = new Date(a.deadline);
      return d >= start && d <= end;
    }).length;
    return { total, interviews, oaThisWeek };
  }, [applications]);

  const reorderMutation = useMutation({
    mutationFn: reorderJobBoard,
    onSuccess: (list) => {
      queryClient.setQueryData(QUERY_KEY, list);
    },
    onError: () => {
      toast({ title: 'Could not save board', variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId || active.id === overId) return;

    setColumnIds((prev) => {
      const activeContainer = findContainer(active.id, prev);
      const overContainer =
        columnFromDroppableId(String(overId)) ?? findContainer(overId, prev);
      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return prev;
      }

      const aItems = [...prev[activeContainer]];
      const oItems = [...prev[overContainer]];
      const activeIndex = aItems.indexOf(String(active.id));
      if (activeIndex < 0) return prev;
      const overIndex = oItems.indexOf(String(overId));

      let newIndex: number;
      if (columnFromDroppableId(String(overId))) {
        newIndex = oItems.length;
      } else {
        const isBelow =
          over?.rect &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelow ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : oItems.length;
      }

      aItems.splice(activeIndex, 1);
      const insertAt = Math.min(Math.max(0, newIndex), oItems.length);
      const nextO = [...oItems];
      if (!nextO.includes(String(active.id))) {
        nextO.splice(insertAt, 0, String(active.id));
      }

      return {
        ...prev,
        [activeContainer]: aItems.filter((id) => id !== String(active.id)),
        [overContainer]: nextO,
      };
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const prev = columnIdsRef.current;
      let next: Record<JobApplicationStatus, string[]> = { ...prev };
      const ac = findContainer(active.id, prev);
      const oc = findContainer(over.id, prev);

      if (ac && oc && ac === oc) {
        const items = [...prev[ac]];
        const oldIndex = items.indexOf(String(active.id));
        let newIndex = items.indexOf(String(over.id));
        if (
          newIndex < 0 &&
          columnFromDroppableId(String(over.id)) === ac
        ) {
          newIndex = Math.max(0, items.length - 1);
        }
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          next = { ...prev, [ac]: arrayMove(items, oldIndex, newIndex) };
        }
      } else if (ac && oc && ac !== oc && !prev[oc].includes(String(active.id))) {
        const aItems = prev[ac].filter((id) => id !== String(active.id));
        const oItems = [...prev[oc]];
        const ni = oItems.indexOf(String(over.id));
        const insert = ni >= 0 ? ni : oItems.length;
        oItems.splice(insert, 0, String(active.id));
        next = { ...prev, [ac]: aItems, [oc]: oItems };
      }

      setColumnIds(next);
      reorderMutation.mutate(next);
    },
    [reorderMutation]
  );

  if (authLoading) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/jobs' }} />;
  }
  if (isLoading) {
    return <LoadingScreen />;
  }

  const activeApp = activeId ? displayed.get(String(activeId)) : undefined;
  const totalCount = applications.length;
  const { total: metricTotal, interviews: metricInterviews, oaThisWeek: metricOaWeek } = placementMetrics;

  return (
    <div className="jobs-tracker relative flex min-h-screen flex-col text-zinc-900 antialiased" style={JOBS_CANVAS_STYLE}>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/55 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[min(1040px,calc(100vw-1rem))] items-start justify-between gap-3 px-4 py-3 sm:items-center sm:px-5">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">Jobs</h1>
            <p className="text-xs text-zinc-600 sm:text-sm">Track your placement pipeline.</p>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              Stay organized during internship season.
            </p>
            {totalCount > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 sm:text-xs">
                <span>
                  <span className="font-semibold text-zinc-700">{metricTotal}</span> applications
                </span>
                <span className="text-zinc-300" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="font-semibold text-zinc-700">{metricInterviews}</span> interviews
                </span>
                <span className="text-zinc-300" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="font-semibold text-zinc-700">{metricOaWeek}</span> OA this week
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0 rounded-full sm:hidden"
              onClick={() => setAddOpen(true)}
              aria-label="Add application"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="hidden rounded-full shadow-sm sm:inline-flex"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Application
            </Button>
            <Button variant="ghost" size="sm" className="text-zinc-600" asChild>
              <Link to="/classes" className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Exit
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 pb-24 sm:pb-8">
        {totalCount === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="mx-auto w-full max-w-[min(1040px,calc(100vw-1rem))] px-2 pb-6 pt-4 sm:px-3">
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden pb-2 sm:gap-2.5">
                {JOB_APPLICATION_STATUSES.map((status, idx) => (
                  <React.Fragment key={status}>
                    {idx > 0 ? (
                      <div
                        className="hidden w-5 shrink-0 select-none flex-col items-center justify-start pt-16 lg:flex"
                        aria-hidden
                      >
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-300/90 to-transparent" />
                        <ChevronRight className="-mt-0.5 h-3.5 w-3.5 text-zinc-300" />
                      </div>
                    ) : null}
                    <div className="w-[min(88vw,272px)] shrink-0 snap-start sm:w-[248px]">
                      <div className="sticky top-[52px] z-10 mb-2.5 rounded-lg border border-zinc-200/35 bg-white/75 px-2 py-1.5 backdrop-blur-md sm:static sm:mb-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_DOT[status])} />
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                              {COLUMN_LABEL[status]}
                            </p>
                          </div>
                          <span className="shrink-0 tabular-nums text-[10px] text-zinc-400">{columnIds[status].length}</span>
                        </div>
                      </div>
                      <BoardColumn
                        status={status}
                        apps={columnIds[status].map((id) => displayed.get(id)!).filter(Boolean)}
                        onOpen={setDetailId}
                        showColumnHints={totalCount > 0}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <DragOverlay
              dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
            >
              {activeApp ? (
                <div className="w-[min(88vw,272px)] rotate-1 scale-[1.02] rounded-xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 px-3 py-2.5 shadow-2xl">
                  <p className="truncate text-sm font-semibold text-zinc-900">{activeApp.company}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{activeApp.role}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        <Button
          type="button"
          size="lg"
          className="fixed bottom-5 right-4 z-30 h-12 rounded-full px-5 shadow-lg sm:hidden"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" />
          Add
        </Button>
      </main>

      <AddApplicationDialog open={addOpen} onOpenChange={setAddOpen} />
      <JobDetailSheet open={detailId !== null} applicationId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
