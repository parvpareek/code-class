import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { ExternalLink, MapPin, Github, Linkedin, Pencil, MoreVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  PortfolioContent,
  PortfolioProject,
  PortfolioTheme,
  PortfolioSectionId,
  PortfolioActivityPayload,
  PortfolioStoryImageAfter,
  PortfolioPlatformSolved,
  PortfolioHeatmapMode,
} from '@/types/portfolio';
import { PortfolioActivityHeatmaps } from '@/components/portfolio/PortfolioActivityHeatmaps';
import { PortfolioHeatmapModeToggle } from '@/components/portfolio/PortfolioHeatmapModeToggle';
import { resolvePortfolioHeroAvatarUrl } from '@/lib/githubAvatar';
import { formatEducationDateRange, formatExperienceDateRange } from '@/lib/portfolioDates';
import { FeaturedProjectCard } from '@/components/portfolio/FeaturedProjectCard';
import { markSignatureIntroPlayed, shouldPlaySignatureIntro, clearSignatureIntroPlayed } from '@/lib/portfolioIntroGate';
import { cn } from '@/lib/utils';

export type PortfolioEditTarget =
  | PortfolioSectionId
  | `project-${number}`;

export type PortfolioSectionStructureHandlers = {
  moveSection: (id: PortfolioSectionId, dir: -1 | 1) => void;
  toggleSectionHidden: (id: PortfolioSectionId) => void;
};

const DENSITY_SPACE: Record<'default' | 'compact', string> = {
  default: 'space-y-10',
  compact: 'space-y-6',
};

/** Themes that mount a full-screen signature intro on first public visit / replay. */
const SIGNATURE_INTRO_THEMES = new Set<PortfolioTheme>(['FORMULA_ONE', 'MARLBORO']);

function themeHasSignatureIntro(theme: PortfolioTheme): boolean {
  return SIGNATURE_INTRO_THEMES.has(theme);
}

const FormulaOneIntro = lazy(() => import('@/components/portfolio/signature/intros/FormulaOneIntro'));
const MarlboroIntro = lazy(() => import('@/components/portfolio/signature/intros/MarlboroIntro'));

function metricsEntries(metrics: Record<string, string> | undefined): [string, string][] {
  if (!metrics || typeof metrics !== 'object') return [];
  return Object.entries(metrics).filter(([k, v]) => k.trim() && String(v).trim());
}

function formatLocCompact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`.replace(/\.0M$/, 'M');
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

/** Short repo lifetime for display (no timezone label). */
function formatRepoSpanShort(isoFrom?: string, isoTo?: string): string | null {
  if (!isoFrom || !isoTo) return null;
  try {
    const a = new Date(isoFrom);
    const b = new Date(isoTo);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
    const A = a.toLocaleDateString(undefined, opts);
    const B = b.toLocaleDateString(undefined, opts);
    return A === B ? A : `${A}–${B}`;
  } catch {
    return null;
  }
}

/** One tight line for cards: LOC, stars, date span — no contributors. */
function projectGithubStatsLine(p: PortfolioProject): string | null {
  const ri = p.repoInsight;
  if (!ri || ri.error) return null;
  const bits: string[] = [];
  if (typeof ri.linesEstimate === 'number' && ri.linesEstimate > 0) {
    bits.push(`LOC: ${formatLocCompact(ri.linesEstimate)}`);
  }
  if (typeof ri.stars === 'number' && ri.stars > 0) {
    bits.push(`${ri.stars}★`);
  }
  const span = formatRepoSpanShort(ri.repoCreatedAt, ri.lastPushAt);
  if (span) bits.push(span);
  return bits.length ? bits.join(' · ') : null;
}

function hasPlatformSolvedRow(p?: PortfolioPlatformSolved | null): boolean {
  if (!p) return false;
  return (
    (p.leetcode ?? 0) > 0 || (p.hackerrank ?? 0) > 0 || (p.geeksforgeeks ?? 0) > 0
  );
}

function storySectionLabel(key: PortfolioStoryImageAfter): string {
  const map: Record<PortfolioStoryImageAfter, string> = {
    motivation: 'Motivation',
    architecture: 'Architecture',
    challenges: 'Challenges',
    lessons: 'Lessons',
    futurePlans: "What's next",
  };
  return map[key];
}

function hasStructuredStory(p: PortfolioProject): boolean {
  const s = p.story;
  if (!s) return false;
  return [s.motivation, s.architecture, s.challenges, s.lessons, s.futurePlans].some(
    (x) => (x ?? '').trim().length > 0
  );
}

function ProjectStoryBody({ p }: { p: PortfolioProject }) {
  const s = p.story;
  const order: { field: PortfolioStoryImageAfter; body?: string }[] = [
    { field: 'motivation', body: s?.motivation },
    { field: 'architecture', body: s?.architecture },
    { field: 'challenges', body: s?.challenges },
    { field: 'lessons', body: s?.lessons },
    { field: 'futurePlans', body: s?.futurePlans },
  ];
  const imgs = p.storyImages ?? [];
  const legacy = (p.longDescription ?? '').trim();
  const structured = hasStructuredStory(p);

  return (
    <div className="space-y-6 text-left">
      {order.map(({ field, body }) => {
        const text = (body ?? '').trim();
        const afterImgs = imgs.filter((im) => im.after === field);
        if (!text && afterImgs.length === 0) return null;
        return (
          <div key={field} className="space-y-2">
            {text ? (
              <>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {storySectionLabel(field)}
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
              </>
            ) : null}
            {afterImgs.map((im, j) => (
              <figure key={`${field}-img-${j}`} className="space-y-1">
                <img
                  src={im.url}
                  alt={im.caption ?? ''}
                  className="max-h-64 w-full rounded-md object-contain"
                  loading="lazy"
                />
                {im.caption ? (
                  <figcaption className="text-center text-[11px] text-muted-foreground">{im.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        );
      })}
      {!structured && legacy ? (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Story</h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{legacy}</p>
        </div>
      ) : null}
    </div>
  );
}
const HERO_LINK_BTN_CLASS =
  'pf-interactive h-8 gap-1 border-[var(--pf-border)] bg-[var(--pf-surface)] text-[var(--pf-text)] shadow-none hover:bg-[color-mix(in_srgb,var(--pf-surface)_85%,var(--pf-accent)_15%)] hover:text-[var(--pf-text)] [&_svg]:text-[var(--pf-text)]';

function SectionEditToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-10 flex h-8 items-center gap-1">
      {children}
    </div>
  );
}

function SectionOverflowMenu({
  sectionId,
  order,
  structure,
}: {
  sectionId: PortfolioSectionId;
  order: PortfolioSectionId[];
  structure: PortfolioSectionStructureHandlers;
}) {
  const i = order.indexOf(sectionId);
  const canUp = i > 0;
  const canDown = i >= 0 && i < order.length - 1;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 border-[var(--pf-border)] bg-[var(--pf-surface)] text-[var(--pf-text)] opacity-80 shadow-none transition-[opacity,border-color,transform] duration-200 hover:-translate-y-px hover:opacity-100"
          aria-label="Section actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled={!canUp} onClick={() => structure.moveSection(sectionId, -1)}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDown}
          onClick={() => structure.moveSection(sectionId, 1)}
        >
          Move down
        </DropdownMenuItem>
        {sectionId !== 'hero' ? (
          <DropdownMenuItem onClick={() => structure.toggleSectionHidden(sectionId)}>
            Hide section
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function sectionDimmed(
  mode: 'readonly' | 'edit',
  sectionId: PortfolioSectionId,
  focusKey: string | null | undefined
): boolean {
  if (mode !== 'edit' || !focusKey) return false;
  if (focusKey === sectionId) return false;
  if (sectionId === 'featured' && focusKey.startsWith('project-')) return false;
  return true;
}

function projectCardDimmed(mode: 'readonly' | 'edit', focusKey: string | null | undefined, index: number): boolean {
  if (mode !== 'edit' || !focusKey?.startsWith('project-')) return false;
  return focusKey !== `project-${index}`;
}

function portfolioShellClasses(theme: PortfolioTheme): string {
  const noiseThemes: PortfolioTheme[] = [
    'VOID',
    'PAPER',
    'EMBER',
    'FROST',
    'GLACIER',
    'PAAN',
    'GLASS',
    'HACKER',
    'TERMINAL',
    'FORMULA_ONE',
    'MARLBORO',
  ];
  const emberBg: PortfolioTheme[] = ['EMBER'];
  const formulaOne: PortfolioTheme[] = ['FORMULA_ONE'];
  const marlboro: PortfolioTheme[] = ['MARLBORO'];
  return cn(
    'pf-shell',
    noiseThemes.includes(theme) && 'pf-shell--noise',
    emberBg.includes(theme) && 'pf-shell--ember-bg',
    formulaOne.includes(theme) && 'pf-shell--formula-one',
    marlboro.includes(theme) && 'pf-shell--marlboro'
  );
}

function heroAvatarGlowClass(theme: PortfolioTheme): boolean {
  return !['MINIMAL', 'MONOCHROME', 'PAPER', 'MARLBORO'].includes(theme);
}

export interface PortfolioViewProps {
  displayName: string;
  content: PortfolioContent;
  platformSolved?: PortfolioPlatformSolved | null;
  /** GitHub + DSA problems solved (tracked platforms) by UTC date (yyyy-mm-dd) */
  activity?: PortfolioActivityPayload;
  theme: PortfolioTheme;
  /** When true, outer padding is lighter (nested in editor preview). */
  embedded?: boolean;
  mode?: 'readonly' | 'edit';
  /** When mode is edit, non-focused sections/cards are de-emphasized. */
  editFocusKey?: string | null;
  displayDensity?: 'default' | 'compact';
  onRequestEdit?: (target: PortfolioEditTarget) => void;
  /** Per-section ⋮ menu (move / hide) in edit mode */
  sectionStructure?: PortfolioSectionStructureHandlers;
  /** First paint stagger animation (respects reduced motion via CSS). */
  revealStagger?: boolean;
  /** Public portfolio slug — enables Pit wall signature intro on public URLs. */
  portfolioSlug?: string;
  /** Studio: increment to replay the signature intro overlay in edit mode without full reload. */
  signatureIntroReplayNonce?: number;
}

export function PortfolioView({
  displayName,
  content,
  platformSolved = null,
  activity,
  theme,
  embedded,
  mode = 'readonly',
  editFocusKey = null,
  displayDensity = 'compact',
  onRequestEdit,
  sectionStructure,
  revealStagger = false,
  portfolioSlug,
  signatureIntroReplayNonce = 0,
}: PortfolioViewProps): React.ReactNode {
  const activityPayload: PortfolioActivityPayload = {
    githubByDate: activity?.githubByDate ?? {},
    dsaByDate: activity?.dsaByDate ?? {},
    practiceByDate: activity?.practiceByDate ?? {},
  };
  const [projectOpen, setProjectOpen] = useState<PortfolioProject | null>(null);
  const [viewerHeatmapMode, setViewerHeatmapMode] = useState<PortfolioHeatmapMode>('combined');
  const { sections } = content;
  const hidden = new Set(sections.hidden);
  const order = sections.order.filter((id) => !hidden.has(id));
  const links = content.hero.links ?? {};
  const featuredLayout = content.featuredLayout ?? 'editorial';
  const featuredProjects = content.projects.filter((p) => p.featured !== false);
  const heroTitle = (content.hero.roleTitle ?? '').trim() || 'Developer';
  const density = content.displayDensity ?? displayDensity;
  const spaceY = DENSITY_SPACE[density === 'compact' ? 'compact' : 'default'];
  const interactive = mode === 'edit' && !!onRequestEdit;
  const structureMenu =
    interactive && sectionStructure ? sectionStructure : undefined;
  const secOrder = content.sections.order;
  const sectionToolbarPad = interactive && structureMenu ? 'pt-11' : '';

  const [nightIntroActive, setNightIntroActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const replayAppliedNonce = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const fn = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!themeHasSignatureIntro(theme)) {
      setNightIntroActive(false);
      replayAppliedNonce.current = 0;
      return;
    }
    if (!portfolioSlug || embedded) {
      setNightIntroActive(false);
      return;
    }

    if (signatureIntroReplayNonce > replayAppliedNonce.current) {
      replayAppliedNonce.current = signatureIntroReplayNonce;
      clearSignatureIntroPlayed(portfolioSlug, theme);
      setNightIntroActive(true);
      return;
    }

    if (mode === 'edit') {
      setNightIntroActive(false);
      return;
    }

    if (!shouldPlaySignatureIntro(portfolioSlug, theme)) {
      setNightIntroActive(false);
      return;
    }
    setNightIntroActive(true);
  }, [theme, portfolioSlug, embedded, mode, signatureIntroReplayNonce]);

  const handleNightIntroComplete = useCallback(() => {
    if (portfolioSlug && themeHasSignatureIntro(theme)) {
      markSignatureIntroPlayed(portfolioSlug, theme);
    }
    setNightIntroActive(false);
  }, [portfolioSlug, theme]);

  /** Section-level controls use named group hover; project cards use `group/card`. */
  const EditBtn = ({
    target,
    scope = 'section',
  }: {
    target: PortfolioEditTarget;
    scope?: 'section' | 'card';
  }) =>
    interactive ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'h-8 gap-1 border-[var(--pf-border)] bg-[var(--pf-surface)] px-2.5 text-xs text-[var(--pf-text)] opacity-0 shadow-md transition-[opacity,background-color,border-color] duration-200 hover:bg-[color-mix(in_srgb,var(--pf-surface)_82%,var(--pf-accent)_18%)] hover:text-[var(--pf-text)] [&_svg]:text-[var(--pf-text)]',
          scope === 'card'
            ? 'group-hover/card:opacity-100'
            : 'group-hover/section:opacity-100'
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRequestEdit(target);
        }}
      >
        <Pencil className="h-3 w-3" />
        Edit
      </Button>
    ) : null;

  return (
    <div
      data-pf-theme={theme}
      className={cn(
        'portfolio-studio-scope min-h-full',
        nightIntroActive && theme === 'FORMULA_ONE' && 'pf-f1-night-intro-active overflow-x-clip',
        portfolioShellClasses(theme),
        embedded ? 'rounded-lg p-6' : 'px-4 py-10 md:px-8'
      )}
    >
      {nightIntroActive ? (
        <Suspense fallback={null}>
          {theme === 'FORMULA_ONE' ? (
            <FormulaOneIntro onComplete={handleNightIntroComplete} reducedMotion={prefersReducedMotion} />
          ) : theme === 'MARLBORO' ? (
            <MarlboroIntro
              displayName={displayName}
              onComplete={handleNightIntroComplete}
              reducedMotion={prefersReducedMotion}
            />
          ) : null}
        </Suspense>
      ) : null}
      <div
        className={cn(
          'mx-auto',
          theme === 'MARLBORO' ? 'max-w-4xl' : 'max-w-2xl',
          nightIntroActive && theme === 'FORMULA_ONE' && !prefersReducedMotion && 'pf-f1-reveal-column',
          density === 'compact' && theme !== 'MARLBORO' && 'max-w-xl text-[15px]',
          spaceY,
          revealStagger && 'portfolio-reveal-stagger'
        )}
      >
        {order.map((sectionId) => {
          switch (sectionId) {
            case 'hero':
              return (
                <header
                  key={sectionId}
                  className={cn(
                    'group/section relative space-y-4 transition-all',
                    theme === 'MARLBORO'
                      ? 'w-full text-left'
                      : 'text-center md:text-left',
                    theme !== 'MARLBORO' && 'rounded-xl',
                    theme === 'FORMULA_ONE' && 'pf-hero--formula-one',
                    theme === 'MARLBORO' && 'pf-hero--marlboro',
                    sectionToolbarPad,
                    sectionDimmed(mode, 'hero', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="hero" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="hero" />
                  </SectionEditToolbar>
                  {theme === 'FORMULA_ONE' ? (
                    <div className="pf-f1-hero-art" aria-hidden>
                      <svg
                        className="pf-f1-hero-track"
                        viewBox="0 0 480 96"
                        preserveAspectRatio="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M-20 72 C80 28 200 52 240 48 C320 42 400 22 520 36"
                          fill="none"
                          stroke="rgba(61,212,192,0.11)"
                          strokeWidth="1.25"
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d="M-20 82 C100 48 220 68 280 62 C360 54 420 38 520 50"
                          fill="none"
                          stroke="rgba(200,214,232,0.07)"
                          strokeWidth="0.85"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="6 10"
                        />
                        <path
                          d="M40 88 L440 88"
                          fill="none"
                          stroke="rgba(200,214,232,0.05)"
                          strokeWidth="0.6"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="2 14"
                        />
                      </svg>
                    </div>
                  ) : null}
                  {theme === 'FORMULA_ONE' ? (
                    <div className="pf-f1-hero-pit-strip relative z-[1]">
                      <p className="pf-f1-hero-pit-strip__text">
                        <span className="pf-f1-hero-pit-strip__line">Slow is smooth.</span>
                        <span className="pf-f1-hero-pit-strip__dot" aria-hidden>
                          {' '}
                          ·{' '}
                        </span>
                        <span className="pf-f1-hero-pit-strip__line">Smooth is fast.</span>
                        <span className="pf-f1-hero-pit-strip__tag">Pit &amp; engineering</span>
                      </p>
                    </div>
                  ) : null}
                  {theme === 'MARLBORO' ? (
                    <div className="pf-hero-marlboro-watermark" aria-hidden>
                      <span>BUILD</span>
                      <span>SHIP</span>
                      <span>REPEAT</span>
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      'flex flex-col gap-4 md:flex-row',
                      theme === 'MARLBORO'
                        ? 'pf-hero-marlboro-inner items-start'
                        : 'items-center md:items-start',
                      theme === 'FORMULA_ONE' && 'relative z-[1]'
                    )}
                  >
                    {(() => {
                      const heroAvatarSrc = resolvePortfolioHeroAvatarUrl(content);
                      return heroAvatarSrc ? (
                      <div
                        className={cn(
                          'pf-hero-avatar-wrap shrink-0',
                          heroAvatarGlowClass(theme) && 'pf-hero-avatar-wrap--glow'
                        )}
                      >
                        <img
                          src={heroAvatarSrc}
                          alt=""
                          className="h-28 w-28 rounded-full object-cover ring-2 ring-[var(--pf-border)]"
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'pf-hero-avatar-wrap flex h-28 w-28 shrink-0 items-center justify-center rounded-full text-2xl font-semibold ring-2 ring-[var(--pf-border)]',
                          heroAvatarGlowClass(theme) && 'pf-hero-avatar-wrap--glow',
                          'bg-[var(--pf-surface)] text-[var(--pf-accent)]'
                        )}
                      >
                        {displayName
                          .split(/\s+/)
                          .map((s) => s[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    );
                    })()}
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <h1 className="pf-display text-4xl font-bold tracking-tight md:text-5xl">{displayName}</h1>
                      <p
                        className={cn(
                          'text-xl font-semibold tracking-tight opacity-95 md:text-2xl',
                          content.featuredSignal === 'DSA' && 'text-[color:var(--pf-accent)]',
                          content.featuredSignal === 'PROJECTS' && 'text-[color:var(--pf-accent)]'
                        )}
                      >
                        {heroTitle}
                      </p>
                      {(content.hero.statusLine ?? '').trim() ? (
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--pf-muted)]">
                          {content.hero.statusLine}
                        </p>
                      ) : null}
                      {(content.hero.currentFocus ?? '').trim() ? (
                        <p className="text-sm font-medium leading-snug text-[color:var(--pf-accent)] opacity-95">
                          {content.hero.currentFocus}
                        </p>
                      ) : null}
                      {(content.hero.tagline ?? '').trim() ? (
                        <p className="text-sm font-medium opacity-80">{content.hero.tagline}</p>
                      ) : null}
                      {(content.hero.bio ?? '').trim() ? (
                        <p className="max-w-xl text-sm leading-relaxed text-[var(--pf-muted)]">{content.hero.bio}</p>
                      ) : null}
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-2 pt-1',
                          theme === 'MARLBORO' ? 'justify-start' : 'justify-center md:justify-start'
                        )}
                      >
                        {(content.hero.location ?? '').trim() ? (
                          <span className="flex items-center gap-1 text-[11px] opacity-75">
                            <MapPin className="h-3.5 w-3.5" />
                            {content.hero.location}
                          </span>
                        ) : null}
                        {(content.hero.strongestSkill ?? '').trim() ? (
                          <span className="rounded border border-[var(--pf-border)] bg-[color-mix(in_srgb,var(--pf-surface)_70%,transparent)] px-2 py-0.5 text-[11px] font-medium opacity-90">
                            Strongest signal: {content.hero.strongestSkill}
                          </span>
                        ) : null}
                        {content.hero.openToWork ? (
                          <Badge variant="secondary" className="text-xs">
                            {(content.hero.availabilityText ?? '').trim() || 'Open to opportunities'}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {links.github ? (
                          <Button variant="outline" size="sm" asChild className={cn('text-xs', HERO_LINK_BTN_CLASS)}>
                            <a href={links.github} target="_blank" rel="noreferrer">
                              <Github className="h-3.5 w-3.5" />
                              GitHub
                            </a>
                          </Button>
                        ) : null}
                        {links.linkedin ? (
                          <Button variant="outline" size="sm" asChild className={cn('text-xs', HERO_LINK_BTN_CLASS)}>
                            <a href={links.linkedin} target="_blank" rel="noreferrer">
                              <Linkedin className="h-3.5 w-3.5" />
                              LinkedIn
                            </a>
                          </Button>
                        ) : null}
                        {links.x ? (
                          <Button variant="outline" size="sm" asChild className={cn('text-xs', HERO_LINK_BTN_CLASS)}>
                            <a href={links.x} target="_blank" rel="noreferrer">
                              <span className="text-[11px] font-semibold leading-none">𝕏</span>
                              X
                            </a>
                          </Button>
                        ) : null}
                        {links.website ? (
                          <Button variant="outline" size="sm" asChild className={cn('text-xs', HERO_LINK_BTN_CLASS)}>
                            <a href={links.website} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Website
                            </a>
                          </Button>
                        ) : null}
                        {links.resumeUrl ? (
                          <Button variant="outline" size="sm" asChild className={cn('text-xs', HERO_LINK_BTN_CLASS)}>
                            <a href={links.resumeUrl} target="_blank" rel="noreferrer">
                              Resume
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {theme === 'FORMULA_ONE' ? (
                    <div className="pf-hero-telemetry-strip" aria-hidden>
                      <span className="inline-flex select-none items-center gap-1.5 rounded-sm border border-[color:color-mix(in_srgb,var(--pf-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--pf-surface)_90%,#000)] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.24em] text-[color:var(--pf-accent)]">
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--pf-accent)] opacity-90"
                          style={{
                            boxShadow: '0 0 8px color-mix(in srgb, var(--pf-accent) 55%, transparent)',
                          }}
                        />
                        PREC
                      </span>
                      <span>
                        Best lap{' '}
                        <span className="pf-telemetry-numeric tracking-normal text-[color:var(--pf-accent)]">1:41.09</span>
                      </span>
                      <span>
                        Gap
                        <span className="pf-telemetry-numeric ml-1 tracking-normal text-[color:var(--pf-text)]">+0.4</span>
                      </span>
                      <span>COND / DRY</span>
                    </div>
                  ) : null}
                </header>
              );
            case 'proof': {
              const hasPractice = Object.values(activityPayload.practiceByDate).some((n) => (n ?? 0) > 0);
              const hasInApp = Object.values(activityPayload.dsaByDate).some((n) => (n ?? 0) > 0);
              const hasGh = Object.values(activityPayload.githubByDate).some((n) => (n ?? 0) > 0);
              const hasAnyActivityData = hasPractice || hasInApp || hasGh;
              const hasPlatform = hasPlatformSolvedRow(platformSolved);
              if (mode === 'readonly' && !hasAnyActivityData && !hasPlatform) {
                return null;
              }
              return (
                <section
                  key={sectionId}
                  className={cn(
                    'group/section relative',
                    theme === 'MARLBORO'
                      ? 'space-y-0 rounded-none border-0 bg-transparent p-0'
                      : 'space-y-3 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)]/40 p-4',
                    sectionToolbarPad,
                    sectionDimmed(mode, 'proof', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="proof" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="proof" />
                  </SectionEditToolbar>
                  {theme === 'MARLBORO' ? (
                    <div className="pf-marlboro-pack">
                      <div className="pf-marlboro-pack__lid">Activity</div>
                      <div className="pf-marlboro-pack__body space-y-3">
                        {hasPlatform ? (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--pf-muted)]">
                            {(platformSolved?.leetcode ?? 0) > 0 ? (
                              <span>LeetCode: {platformSolved!.leetcode}</span>
                            ) : null}
                            {(platformSolved?.hackerrank ?? 0) > 0 ? (
                              <span>HackerRank: {platformSolved!.hackerrank}</span>
                            ) : null}
                            {(platformSolved?.geeksforgeeks ?? 0) > 0 ? (
                              <span>GeeksforGeeks: {platformSolved!.geeksforgeeks}</span>
                            ) : null}
                          </div>
                        ) : null}
                        {hasAnyActivityData ? (
                          <div className="space-y-2">
                            <div className="w-full min-w-0">
                              <PortfolioActivityHeatmaps activity={activityPayload} mode={viewerHeatmapMode} />
                            </div>
                            <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--pf-border)_40%,transparent)] pt-2 sm:flex-row sm:items-end sm:justify-between">
                              <PortfolioHeatmapModeToggle mode={viewerHeatmapMode} onMode={setViewerHeatmapMode} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60">Activity</h2>
                      {hasPlatform ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--pf-muted)]">
                          {(platformSolved?.leetcode ?? 0) > 0 ? (
                            <span>LeetCode: {platformSolved!.leetcode}</span>
                          ) : null}
                          {(platformSolved?.hackerrank ?? 0) > 0 ? (
                            <span>HackerRank: {platformSolved!.hackerrank}</span>
                          ) : null}
                          {(platformSolved?.geeksforgeeks ?? 0) > 0 ? (
                            <span>GeeksforGeeks: {platformSolved!.geeksforgeeks}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {hasAnyActivityData ? (
                        <div className="space-y-2">
                          <div className="min-w-0 overflow-x-auto">
                            <PortfolioActivityHeatmaps activity={activityPayload} mode={viewerHeatmapMode} />
                          </div>
                          <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--pf-border)_40%,transparent)] pt-2 sm:flex-row sm:items-end sm:justify-between">
                            <PortfolioHeatmapModeToggle mode={viewerHeatmapMode} onMode={setViewerHeatmapMode} />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              );
            }
            case 'featured':
              if (featuredProjects.length === 0 && !interactive) {
                return null;
              }
              if (featuredProjects.length === 0) {
                return (
                  <section
                    key={sectionId}
                    className={cn(
                      'group/section relative space-y-2',
                      sectionToolbarPad,
                      sectionDimmed(mode, 'featured', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                    )}
                  >
                    <SectionEditToolbar>
                      {structureMenu ? (
                        <SectionOverflowMenu sectionId="featured" order={secOrder} structure={structureMenu} />
                      ) : null}
                      <EditBtn target="featured" />
                    </SectionEditToolbar>
                    <h2
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider opacity-60',
                        theme === 'MARLBORO' && 'pf-marlboro-featured-heading'
                      )}
                    >
                      Featured work
                    </h2>
                    <button
                      type="button"
                      onClick={() => onRequestEdit?.('featured')}
                      className="pf-link text-left text-sm underline-offset-4 opacity-80 hover:underline"
                    >
                      + Add projects
                    </button>
                  </section>
                );
              }
              return (
                <section
                  key={sectionId}
                  className={cn(
                    'group/section relative space-y-4',
                    sectionToolbarPad,
                    sectionDimmed(mode, 'featured', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="featured" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="featured" />
                  </SectionEditToolbar>
                  <h2
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider opacity-60',
                      theme === 'MARLBORO' && 'pf-marlboro-featured-heading'
                    )}
                  >
                    Featured work
                  </h2>
                  <div
                    className={cn(
                      featuredLayout === 'grid'
                        ? 'grid grid-cols-1 gap-4 md:grid-cols-2'
                        : 'flex flex-col gap-8'
                    )}
                  >
                    {featuredProjects.map((p, i) => {
                      const ghStatsLine = projectGithubStatsLine(p);
                      return (
                        <div
                          key={p.id ?? i}
                          className={cn(
                            'group/card relative',
                            projectCardDimmed(mode, editFocusKey, i) && 'opacity-35 blur-[0.5px]'
                          )}
                        >
                          <SectionEditToolbar>
                            <EditBtn target={`project-${i}`} scope="card" />
                          </SectionEditToolbar>
                          <FeaturedProjectCard
                            project={p}
                            index={i}
                            featuredLayout={featuredLayout}
                            theme={theme}
                            statsLine={ghStatsLine}
                            onOpen={() => setProjectOpen(p)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            case 'howIBuild': {
              const hb = content.howIBuild;
              const has =
                (hb?.bullets?.length ?? 0) > 0 || (hb?.interests?.length ?? 0) > 0;
              if (!has && !interactive) return null;
              if (!has) {
                return (
                  <section
                    key={sectionId}
                    className={cn(
                      'group/section relative space-y-2 rounded-lg border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] p-4',
                      sectionToolbarPad,
                      sectionDimmed(mode, 'howIBuild', editFocusKey) &&
                        'scale-[0.99] opacity-40 blur-[0.5px]'
                    )}
                  >
                    <SectionEditToolbar>
                      {structureMenu ? (
                        <SectionOverflowMenu sectionId="howIBuild" order={secOrder} structure={structureMenu} />
                      ) : null}
                      <EditBtn target="howIBuild" />
                    </SectionEditToolbar>
                    <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60">
                      How I build
                    </h2>
                    <button
                      type="button"
                      onClick={() => onRequestEdit?.('howIBuild')}
                      className="pf-link text-sm underline-offset-4 opacity-80 hover:underline"
                    >
                      + Add section
                    </button>
                  </section>
                );
              }
              return (
                <section
                  key={sectionId}
                  className={cn(
                    'group/section relative space-y-3 p-4',
                    sectionToolbarPad,
                    'pf-card',
                    sectionDimmed(mode, 'howIBuild', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="howIBuild" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="howIBuild" />
                  </SectionEditToolbar>
                  <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60">
                    How I build
                  </h2>
                  {hb?.bullets?.length ? (
                    <ul className="list-inside list-disc space-y-1 text-sm opacity-90">
                      {hb.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {hb?.interests?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hb.interests.map((x) => (
                        <span
                          key={x}
                          className="rounded-md border border-dashed border-[var(--pf-border)] px-2 py-0.5 text-[11px] opacity-90"
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            }
            case 'skills':
              if (!content.skills.length && !interactive) return null;
              if (!content.skills.length) {
                return (
                  <section
                    key={sectionId}
                    className={cn(
                      'group/section relative space-y-2 rounded-lg border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] p-4',
                      sectionToolbarPad,
                      sectionDimmed(mode, 'skills', editFocusKey) &&
                        'scale-[0.99] opacity-40 blur-[0.5px]'
                    )}
                  >
                    <SectionEditToolbar>
                      {structureMenu ? (
                        <SectionOverflowMenu sectionId="skills" order={secOrder} structure={structureMenu} />
                      ) : null}
                      <EditBtn target="skills" />
                    </SectionEditToolbar>
                    <h2
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider opacity-60',
                        theme === 'MARLBORO' && 'pf-marlboro-skills-heading'
                      )}
                    >
                      Skills
                    </h2>
                    <button
                      type="button"
                      onClick={() => onRequestEdit?.('skills')}
                      className="pf-link text-sm underline-offset-4 opacity-80 hover:underline"
                    >
                      + Add skills
                    </button>
                  </section>
                );
              }
              return (
                <section
                  key={sectionId}
                  className={cn(
                    'group/section relative space-y-3',
                    sectionToolbarPad,
                    sectionDimmed(mode, 'skills', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="skills" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="skills" />
                  </SectionEditToolbar>
                  <h2
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider opacity-60',
                      theme === 'MARLBORO' && 'pf-marlboro-skills-heading'
                    )}
                  >
                    Skills
                  </h2>
                  <div className="space-y-3">
                    {content.skills.map((s) => (
                      <div key={s.category}>
                        <h3 className="text-xs font-medium opacity-80">{s.category}</h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.items.map((item) => (
                            <span
                              key={item}
                              className="pf-chip rounded-md px-2 py-0.5 text-xs"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            case 'experience': {
              const has = content.experience.length > 0 || content.education.length > 0;
              if (!has && !interactive) return null;
              if (!has) {
                return (
                  <section
                    key={sectionId}
                    className={cn(
                      'group/section relative',
                      theme === 'MARLBORO'
                        ? 'space-y-0 rounded-none border-0 bg-transparent p-0'
                        : 'space-y-2 rounded-lg border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] p-4',
                      sectionToolbarPad,
                      sectionDimmed(mode, 'experience', editFocusKey) &&
                        'scale-[0.99] opacity-40 blur-[0.5px]'
                    )}
                  >
                    <SectionEditToolbar>
                      {structureMenu ? (
                        <SectionOverflowMenu sectionId="experience" order={secOrder} structure={structureMenu} />
                      ) : null}
                      <EditBtn target="experience" />
                    </SectionEditToolbar>
                    {theme === 'MARLBORO' ? (
                      <div className="pf-marlboro-pack">
                        <div className="pf-marlboro-pack__lid">Experience & education</div>
                        <div className="pf-marlboro-pack__body p-4">
                          <button
                            type="button"
                            onClick={() => onRequestEdit?.('experience')}
                            className="pf-link text-left text-sm underline-offset-4 opacity-80 hover:underline"
                          >
                            + Add experience or education
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60">
                          Experience & education
                        </h2>
                        <button
                          type="button"
                          onClick={() => onRequestEdit?.('experience')}
                          className="pf-link text-sm underline-offset-4 opacity-80 hover:underline"
                        >
                          + Add experience or education
                        </button>
                      </>
                    )}
                  </section>
                );
              }
              const experienceAccordion = (
                <Accordion
                  type="multiple"
                  defaultValue={content.experience.length > 0 ? ['exp-0'] : ['ed-0']}
                  className="w-full"
                >
                  {content.experience.map((ex, i) => {
                    const expRange = formatExperienceDateRange(ex);
                    return (
                      <AccordionItem
                        key={i}
                        value={`exp-${i}`}
                        className={cn(
                          'border-[var(--pf-border)]',
                          theme === 'MARLBORO' && 'pf-marlboro-accordion-item'
                        )}
                      >
                        <AccordionTrigger className="text-sm hover:no-underline">
                          <span className="flex flex-col items-start gap-0.5 text-left">
                            <span>
                              <span className="font-medium">{ex.title}</span>
                              <span className="opacity-70"> — {ex.org}</span>
                            </span>
                            {expRange ? (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--pf-muted)] opacity-90">
                                {expRange}
                              </span>
                            ) : null}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {ex.stack?.length ? (
                            <p className="mt-1 text-xs opacity-80">Stack: {ex.stack.join(', ')}</p>
                          ) : null}
                          {ex.bullets?.length ? (
                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                              {ex.bullets.map((b, j) => (
                                <li key={j}>{b}</li>
                              ))}
                            </ul>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  {content.education.map((ed, i) => {
                    const edRange = formatEducationDateRange(ed);
                    return (
                      <AccordionItem
                        key={`ed-${i}`}
                        value={`ed-${i}`}
                        className={cn(
                          'border-[var(--pf-border)]',
                          theme === 'MARLBORO' && 'pf-marlboro-accordion-item'
                        )}
                      >
                        <AccordionTrigger className="text-sm hover:no-underline">
                          <span className="flex flex-col items-start gap-0.5 text-left">
                            <span>
                              <span className="font-medium">{ed.school}</span>
                              <span className="opacity-70"> — {ed.degree}</span>
                            </span>
                            {edRange ? (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--pf-muted)] opacity-90">
                                {edRange}
                              </span>
                            ) : null}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {ed.details ? <p className="text-sm opacity-90">{ed.details}</p> : null}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              );

              return (
                <section
                  key={sectionId}
                  className={cn(
                    'group/section relative',
                    theme === 'MARLBORO' ? 'space-y-0' : 'space-y-3',
                    sectionToolbarPad,
                    sectionDimmed(mode, 'experience', editFocusKey) && 'scale-[0.99] opacity-40 blur-[0.5px]'
                  )}
                >
                  <SectionEditToolbar>
                    {structureMenu ? (
                      <SectionOverflowMenu sectionId="experience" order={secOrder} structure={structureMenu} />
                    ) : null}
                    <EditBtn target="experience" />
                  </SectionEditToolbar>
                  {theme === 'MARLBORO' ? (
                    <div className="pf-marlboro-pack">
                      <div className="pf-marlboro-pack__lid">Experience & education</div>
                      <div className="pf-marlboro-pack__body px-1 pb-1 pt-0 sm:px-2 sm:pb-2">
                        {experienceAccordion}
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60">
                        Experience & education
                      </h2>
                      {experienceAccordion}
                    </>
                  )}
                </section>
              );
            }
            default:
              return null;
          }
        })}
      </div>

      <Dialog open={!!projectOpen} onOpenChange={(o) => !o && setProjectOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {projectOpen ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">{projectOpen.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 text-left">
                    <p className="text-base text-foreground/90">{projectOpen.shortDescription}</p>
                    {(projectOpen.whyBuilt ?? '').trim() ? (
                      <p className="text-sm italic leading-relaxed text-foreground/85">{projectOpen.whyBuilt}</p>
                    ) : null}
                  </div>
                </DialogDescription>
              </DialogHeader>
              {(() => {
                const gh = projectGithubStatsLine(projectOpen);
                const man = metricsEntries(projectOpen.metrics);
                if (!gh && !man.length) return null;
                return (
                  <div className="space-y-1 border-b border-[var(--pf-border)] pb-3">
                    {gh ? <p className="text-[11px] text-muted-foreground">{gh}</p> : null}
                    {man.length ? (
                      <p className="text-[11px] text-muted-foreground">
                        {man.map(([k, v], mi) => (
                          <span key={`${k}-d-${mi}`}>
                            {mi > 0 ? ' · ' : ''}
                            {k}: {v}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                );
              })()}
              {(projectOpen.signalCues ?? []).filter(Boolean).length ? (
                <div className="flex flex-wrap gap-1">
                  {(projectOpen.signalCues ?? []).filter(Boolean).map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] font-normal">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {(projectOpen.engineeringHighlights ?? []).filter(Boolean).length ? (
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {(projectOpen.engineeringHighlights ?? []).filter(Boolean).map((h, hi) => (
                    <li key={hi}>{h}</li>
                  ))}
                </ul>
              ) : null}
              {projectOpen.imageUrl ? (
                <img
                  src={projectOpen.imageUrl}
                  alt=""
                  className="max-h-56 w-full rounded-md object-cover"
                />
              ) : null}
              <ProjectStoryBody p={projectOpen} />
              {((projectOpen.techStack) ?? []).length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(projectOpen.techStack ?? []).map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {projectOpen.githubUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={projectOpen.githubUrl} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </Button>
                ) : null}
                {projectOpen.liveUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={projectOpen.liveUrl} target="_blank" rel="noreferrer">
                      Live
                    </a>
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
