import React, { useMemo } from 'react';
import type { PortfolioActivityPayload, PortfolioHeatmapMode } from '@/types/portfolio';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  activity: PortfolioActivityPayload;
  mode: PortfolioHeatmapMode;
};

const MAX_WEEKS = 53;

function buildWeekColumns(): (string | null)[][] {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let i = 370; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const first = new Date(`${days[0]}T12:00:00Z`);
  const pad = first.getUTCDay();
  const cells: (string | null)[] = [...Array(pad).fill(null), ...days];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks.slice(-MAX_WEEKS);
}

function levelCombined(commits: number, submissions: number): 0 | 1 | 2 | 3 | 4 {
  const t = commits + submissions;
  if (t <= 0) return 0;
  if (t <= 1) return 1;
  if (t <= 3) return 2;
  if (t <= 8) return 3;
  return 4;
}

function levelSingle(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n <= 1) return 1;
  if (n <= 3) return 2;
  if (n <= 8) return 3;
  return 4;
}

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-[color-mix(in_srgb,var(--pf-muted)_25%,transparent)]',
  1: 'bg-[color-mix(in_srgb,var(--pf-accent)_22%,transparent)]',
  2: 'bg-[color-mix(in_srgb,var(--pf-accent)_42%,transparent)]',
  3: 'bg-[color-mix(in_srgb,var(--pf-accent)_62%,transparent)]',
  4: 'bg-[color-mix(in_srgb,var(--pf-accent)_85%,transparent)]',
};

function formatLongDateUtc(isoYmd: string): string {
  const [y, m, d] = isoYmd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function detailLines(mode: PortfolioHeatmapMode, commits: number, codeClassCount: number): string {
  if (mode === 'github') {
    return commits > 0 ? `${commits} commit${commits === 1 ? '' : 's'}` : 'No commits';
  }
  if (mode === 'practice') {
    return codeClassCount > 0
      ? `${codeClassCount} DSA problem${codeClassCount === 1 ? '' : 's'} solved`
      : 'No DSA problems solved';
  }
  const parts: string[] = [];
  parts.push(commits > 0 ? `${commits} commit${commits === 1 ? '' : 's'}` : 'No commits');
  parts.push(
    codeClassCount > 0
      ? `${codeClassCount} DSA problem${codeClassCount === 1 ? '' : 's'} solved`
      : 'No DSA problems solved'
  );
  return parts.join(' · ');
}

function firstDateInWeek(week: (string | null)[]): string | null {
  for (const d of week) {
    if (d) return d;
  }
  return null;
}

function ym(iso: string): string {
  return iso.slice(0, 7);
}

/** Short label for month boundary row, e.g. "May '26" */
function formatMonthYearShortUtc(isoYmd: string): string {
  const [y, m] = isoYmd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function ActivityGrid({
  cols,
  commitsByDate,
  codeClassByDate,
  mode,
}: {
  cols: (string | null)[][];
  commitsByDate: Record<string, number>;
  codeClassByDate: Record<string, number>;
  mode: PortfolioHeatmapMode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="block w-full min-w-0">
        <div className="flex w-full min-w-0 gap-px sm:gap-0.5">
          {cols.map((week, wi) => (
            <div key={wi} className="flex min-w-0 flex-1 basis-0 flex-col gap-px sm:gap-0.5">
              {week.map((date, di) => {
                if (!date) {
                  return (
                    <div
                      key={`e-${wi}-${di}`}
                      className="aspect-square w-full min-h-[2px] shrink-0 rounded-sm bg-transparent"
                    />
                  );
                }
                const commits = commitsByDate[date] ?? 0;
                const codeClass = codeClassByDate[date] ?? 0;
                let lv: 0 | 1 | 2 | 3 | 4 = 0;
                if (mode === 'combined') lv = levelCombined(commits, codeClass);
                else if (mode === 'github') lv = levelSingle(commits);
                else lv = levelSingle(codeClass);
                const head = formatLongDateUtc(date);
                const detail = detailLines(mode, commits, codeClass);
                return (
                  <Tooltip key={date}>
                    <TooltipTrigger asChild>
                      <div
                        role="img"
                        className={cn(
                          'aspect-square w-full min-h-[2px] shrink-0 cursor-default rounded-sm',
                          LEVEL_CLASS[lv]
                        )}
                        aria-label={`${head}. ${detail}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[240px] border-[var(--pf-border)] bg-[var(--pf-surface)] px-2.5 py-2 text-xs text-[var(--pf-text)] shadow-md"
                    >
                      <p className="font-medium leading-snug text-[var(--pf-text)]">{head}</p>
                      <p className="mt-1 leading-snug text-[var(--pf-muted)]">{detail}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--pf-muted)] opacity-70">
                        UTC day
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex w-full min-w-0 gap-px sm:gap-0.5 border-t border-[color-mix(in_srgb,var(--pf-border)_45%,transparent)] pt-1">
          {cols.map((week, wi) => {
            const d = firstDateInWeek(week);
            const prev = wi > 0 ? firstDateInWeek(cols[wi - 1]) : null;
            const show = Boolean(d && (!prev || ym(d) !== ym(prev)));
            return (
              <div
                key={wi}
                className="relative flex min-h-9 min-w-0 flex-1 basis-0 justify-center overflow-visible"
                aria-hidden
              >
                {show && d ? (
                  <span className="pointer-events-none absolute left-1/2 top-0.5 origin-top -translate-x-1/2 rotate-[-52deg] whitespace-nowrap text-[8px] font-semibold uppercase tracking-tight text-[var(--pf-muted)]">
                    {formatMonthYearShortUtc(d)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

const MODE_HEADLINE: Record<PortfolioHeatmapMode, string> = {
  practice: 'DSA problems solved',
  github: 'GitHub commits',
  combined: 'GitHub + DSA problems solved',
};

function hasAnyPositive(m: Record<string, number>): boolean {
  return Object.values(m).some((n) => n > 0);
}

export function PortfolioActivityHeatmaps({ activity, mode }: Props) {
  const cols = useMemo(() => buildWeekColumns(), []);
  const practice = activity.practiceByDate ?? {};
  const inApp = activity.dsaByDate ?? {};
  const gh = activity.githubByDate ?? {};

  const hasPractice = hasAnyPositive(practice);
  const hasInApp = hasAnyPositive(inApp);
  const hasGh = hasAnyPositive(gh);

  if (mode === 'practice') {
    if (!hasPractice) {
      return (
        <p className="text-xs opacity-70">
          No DSA problems solved in this window (LeetCode, HackerRank, or GeeksforGeeks via Code Class).
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--pf-muted)] opacity-60">
          {MODE_HEADLINE.practice}
        </p>
        <ActivityGrid cols={cols} commitsByDate={{}} codeClassByDate={practice} mode="practice" />
      </div>
    );
  }

  if (mode === 'github') {
    if (!hasGh) {
      return (
        <p className="text-xs opacity-70">
          No GitHub calendar loaded. This creator can add a GitHub profile URL so public contributions can load here.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--pf-muted)] opacity-60">
          {MODE_HEADLINE.github}
        </p>
        <ActivityGrid cols={cols} commitsByDate={gh} codeClassByDate={{}} mode="github" />
      </div>
    );
  }

  if (!hasGh && !hasInApp) {
    return (
      <p className="text-xs opacity-70">
        Nothing to show yet (no GitHub data and no DSA problems solved in this window).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--pf-muted)] opacity-60">
        {MODE_HEADLINE.combined}
      </p>
      <ActivityGrid cols={cols} commitsByDate={gh} codeClassByDate={inApp} mode="combined" />
    </div>
  );
}
