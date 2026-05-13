import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { PortfolioProject, PortfolioTheme } from '@/types/portfolio';
import { cn } from '@/lib/utils';

function metricsEntries(metrics: Record<string, string> | undefined): [string, string][] {
  if (!metrics || typeof metrics !== 'object') return [];
  return Object.entries(metrics).filter(([k, v]) => k.trim() && String(v).trim());
}

/** Best-effort live URL preview via thum.io; falls back to themed CTA if blocked or error. */
function ProjectSidePreview({
  imageUrl,
  liveUrl,
}: {
  imageUrl?: string | null;
  liveUrl?: string | null;
}) {
  const [thumbFailed, setThumbFailed] = React.useState(false);
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="h-full min-h-[9rem] w-full object-cover md:min-h-full"
        loading="lazy"
      />
    );
  }
  if (!liveUrl) return null;
  if (!thumbFailed) {
    const thumbSrc = `https://image.thum.io/get/width/640/crop/1200/noanimate/${encodeURIComponent(liveUrl)}`;
    return (
      <img
        src={thumbSrc}
        alt=""
        className="h-full min-h-[9rem] w-full object-cover object-top md:min-h-full"
        loading="lazy"
        onError={() => setThumbFailed(true)}
      />
    );
  }
  let host = liveUrl;
  try {
    host = new URL(liveUrl).hostname.replace(/^www\./, '');
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={liveUrl}
      target="_blank"
      rel="noreferrer"
      className="flex h-full min-h-[9rem] w-full flex-col items-center justify-center gap-1.5 bg-[color-mix(in_srgb,var(--pf-surface)_65%,var(--pf-bg))] px-3 py-4 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--pf-surface)_50%,var(--pf-bg))] md:min-h-full"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-7 w-7 shrink-0 text-[color:var(--pf-accent)] opacity-80" />
      <span className="text-xs font-medium text-[var(--pf-text)]">Live site</span>
      <span className="max-w-full break-all text-[11px] text-[var(--pf-muted)]">{host}</span>
    </a>
  );
}

export type FeaturedProjectCardProps = {
  project: PortfolioProject;
  index: number;
  featuredLayout: 'editorial' | 'grid';
  theme: PortfolioTheme;
  statsLine: string | null;
  onOpen: () => void;
};

export function FeaturedProjectCard({
  project: p,
  index: i,
  featuredLayout,
  theme,
  statsLine: ghStatsLine,
  onOpen,
}: FeaturedProjectCardProps) {
  const hasPreview = Boolean(p.imageUrl || p.liveUrl);
  const manualMets = metricsEntries(p.metrics);
  const cues = (p.signalCues ?? []).filter(Boolean);
  const highs = (p.engineeringHighlights ?? []).filter(Boolean);
  const telemetry = theme === 'FORMULA_ONE';
  const campaign = theme === 'MARLBORO';

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-accent)]';

  if (campaign && featuredLayout === 'editorial') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'pf-card pf-interactive group/proj w-full overflow-hidden text-left',
          'pf-project-card--campaign',
          focusRing,
          'flex flex-col p-0'
        )}
      >
        <div className="flex flex-col gap-6 px-5 pb-7 pt-6 md:gap-7 md:px-7 md:pb-9 md:pt-7">
          <div className="space-y-4 md:space-y-5">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.32em] text-[var(--pf-muted)] tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="pf-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-[var(--pf-text)] md:text-3xl">
              <span className="pf-campaign-title-wrap">
                <span className="pf-campaign-title inline-block">{p.title}</span>
              </span>
            </h3>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--pf-muted)] md:text-[15px]">{p.shortDescription}</p>
            {(p.whyBuilt ?? '').trim() ? (
              <p className="max-w-xl border-l-2 border-[color:var(--pf-accent)] pl-4 text-sm italic leading-relaxed text-[var(--pf-text)] opacity-[0.88] md:text-[15px]">
                {p.whyBuilt}
              </p>
            ) : null}
          </div>
          {hasPreview ? (
            <div className="relative aspect-video max-h-[14rem] w-full overflow-hidden border border-[var(--pf-border)] md:max-h-[16rem]">
              <ProjectSidePreview imageUrl={p.imageUrl} liveUrl={p.liveUrl} />
            </div>
          ) : null}
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--pf-accent)]">
            View story
          </span>
        </div>
      </button>
    );
  }

  if (campaign && featuredLayout === 'grid') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'pf-card pf-interactive group/proj w-full overflow-hidden text-left',
          'pf-project-card--campaign',
          focusRing,
          'flex min-h-[12rem] flex-col p-4 md:min-h-[12rem] md:p-5'
        )}
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--pf-muted)] tabular-nums">
          {String(i + 1).padStart(2, '0')}
        </span>
        <h3 className="pf-display pf-campaign-title-wrap mt-4 text-lg font-semibold leading-snug tracking-[-0.025em] md:mt-5 md:text-xl">
          <span className="pf-campaign-title inline-block">{p.title}</span>
        </h3>
        <p className="mt-3 flex-1 text-xs leading-relaxed text-[var(--pf-muted)] md:mt-4 md:text-sm">
          {p.shortDescription}
        </p>
        <span className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pf-accent)] md:mt-7">
          View story
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'pf-card pf-interactive group/proj w-full overflow-hidden text-left',
        telemetry && 'pf-project-card--telemetry',
        focusRing,
        featuredLayout === 'grid'
          ? 'flex min-h-[12rem] flex-col p-4'
          : 'flex flex-col gap-5 p-5 md:flex-row md:items-stretch md:gap-8 md:p-8'
      )}
    >
      {featuredLayout === 'editorial' ? (
        <>
          <div
            className={cn(
              'flex shrink-0 flex-col items-center gap-1.5 border-b border-[var(--pf-border)] pb-3 text-center md:w-[5.25rem] md:border-b-0 md:border-r md:pb-0 md:pr-4 md:text-left',
              telemetry && 'relative md:border-[color-mix(in_srgb,var(--pf-accent)_28%,var(--pf-border))]'
            )}
          >
            {telemetry ? (
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--pf-muted)]">
                UNIT
              </span>
            ) : null}
            <span
              className={cn(
                'pf-display text-3xl font-bold tabular-nums leading-none text-[color:var(--pf-accent)] opacity-90',
                telemetry && 'pf-telemetry-numeric'
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {ghStatsLine ? (
              <p className="line-clamp-2 max-w-[5.25rem] text-[9px] leading-tight text-[var(--pf-muted)] md:max-w-[4.75rem]">
                {ghStatsLine}
              </p>
            ) : null}
            {manualMets.length ? (
              <p className="line-clamp-1 max-w-[5.25rem] text-[9px] leading-tight text-[var(--pf-muted)] opacity-90 md:max-w-[4.75rem]">
                {manualMets.map(([k, v], mi) => (
                  <span key={`m-${k}-${mi}`}>
                    {mi > 0 ? ' · ' : ''}
                    {k}: {v}
                  </span>
                ))}
              </p>
            ) : null}
            {cues.length ? (
              <div className="flex flex-wrap justify-center gap-1 md:justify-start">
                {cues.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[var(--pf-border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-85"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-center md:text-left">
            <h3 className="pf-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">{p.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--pf-muted)]">{p.shortDescription}</p>
            {(p.whyBuilt ?? '').trim() ? (
              <p className="border-l-2 border-[color:var(--pf-accent)] pl-3 text-left text-sm italic leading-relaxed opacity-90">
                {p.whyBuilt}
              </p>
            ) : null}
            {highs.length ? (
              <ul className="list-inside list-disc space-y-1 text-left text-[12px] leading-relaxed text-[var(--pf-muted)]">
                {highs.map((h, hi) => (
                  <li key={hi}>{h}</li>
                ))}
              </ul>
            ) : null}
            {(p.techStack ?? []).length ? (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 md:justify-start">
                {(p.techStack ?? []).slice(0, 10).map((t) => (
                  <span key={t} className="pf-chip rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <span className="inline-block pt-1 text-[11px] font-semibold text-[color:var(--pf-accent)]">
              View story →
            </span>
          </div>
          {hasPreview ? (
            <div className="relative min-h-[9rem] w-full shrink-0 overflow-hidden rounded-lg border border-[var(--pf-border)] md:min-h-0 md:w-[min(32%,11rem)] md:self-stretch">
              <ProjectSidePreview imageUrl={p.imageUrl} liveUrl={p.liveUrl} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider text-[color:var(--pf-accent)]',
                telemetry && 'pf-telemetry-numeric tabular-nums'
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {cues.length ? (
              <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
                {cues.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[var(--pf-border)] px-1.5 py-0.5 text-[8px] font-semibold uppercase opacity-80"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <h3 className="pf-display mt-2 text-lg font-bold leading-snug">{p.title}</h3>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed opacity-85">{p.shortDescription}</p>
          {ghStatsLine || manualMets.length ? (
            <p className="mt-2 line-clamp-2 text-[9px] leading-tight text-[var(--pf-muted)]">
              {ghStatsLine ? <span>{ghStatsLine}</span> : null}
              {ghStatsLine && manualMets.length ? <span> · </span> : null}
              {manualMets.map(([k, v], mi) => (
                <span key={`${k}-g-${mi}`}>
                  {mi > 0 ? ' · ' : ''}
                  {k}: {v}
                </span>
              ))}
            </p>
          ) : null}
          {highs.length ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-[var(--pf-muted)]">
              {highs.slice(0, 3).map((h, hi) => (
                <li key={hi} className="line-clamp-2">
                  {h}
                </li>
              ))}
            </ul>
          ) : null}
          <span className="mt-auto pt-3 text-[10px] font-semibold text-[color:var(--pf-accent)]">View story →</span>
        </>
      )}
    </button>
  );
}
